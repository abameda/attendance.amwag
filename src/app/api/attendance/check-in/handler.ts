import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { calculateAttendanceWorkDate, calculateLateMinutes } from '@/lib/attendanceCalculations';
import { db } from '@/lib/db';
import { attendance, branchAllowedIps } from '@/lib/db/schema';
import { getTrustXForwardedFor } from '@/lib/env';
import { getGlobalSettings } from '@/lib/globalSettings';
import { isIpAllowedForBranch, resolveClientIp } from '@/lib/ipValidation';
import { getEgyptNow, isWithinTimeWindow } from '@/lib/timezone';

type CheckInDependencies = {
  db: Pick<typeof db, 'select' | 'insert'>;
  getCurrentUser: typeof getCurrentUser;
  getGlobalSettings: typeof getGlobalSettings;
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isDuplicateEntryError(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown; sqlState?: unknown };
  return (
    candidate?.code === 'ER_DUP_ENTRY' ||
    candidate?.errno === 1062 ||
    candidate?.sqlState === '23000'
  );
}

export function createCheckInHandler(dependencies: CheckInDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const user = await dependencies.getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const currentIp = resolveClientIp(request.headers, {
        trustForwardedFor: getTrustXForwardedFor(),
      });

      if (!user.branch || !user.branchId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your account is not assigned to a branch. Contact an administrator.',
          },
          { status: 403 }
        );
      }

      // Query IP rules by branchId (the reliable FK), not branchName
      const branchIpRows = await dependencies.db
        .select({
          branchName: branchAllowedIps.branchName,
          ruleType: branchAllowedIps.ruleType,
          ipNetwork: branchAllowedIps.ipNetwork,
          isActive: branchAllowedIps.isActive,
        })
        .from(branchAllowedIps)
        .where(and(eq(branchAllowedIps.branchId, user.branchId), eq(branchAllowedIps.isActive, 1)));

      const matchingBranch = isIpAllowedForBranch(currentIp, branchIpRows);

      if (!matchingBranch.allowed) {
        // Development-only: allow localhost IPs so local testing works
        const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
        const isDev = process.env.NODE_ENV === 'development';
        const isLocalhost = LOCALHOST_IPS.includes(currentIp);

        console.warn('[check-in] Branch IP denied', {
          clientIp: currentIp,
          xForwardedFor: request.headers.get('x-forwarded-for'),
          xRealIp: request.headers.get('x-real-ip'),
          employeeBranchId: user.branchId,
          employeeBranch: user.branch,
          rulesCount: branchIpRows.length,
          rules: branchIpRows.map((r) => ({
            ipNetwork: r.ipNetwork,
            ruleType: r.ruleType,
            isActive: r.isActive,
          })),
          isDev,
          isLocalhost,
        });

        if (isDev && isLocalhost) {
          // Allow in development for localhost
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'You must be connected to the company network (WiFi) to check in.',
            },
            { status: 403 }
          );
        }
      }

      const checkInLocation = matchingBranch.branchName ?? user.branch;
      const now = new Date();
      const { date: egyptToday, totalMinutes: currentTotalMinutes } = getEgyptNow();

      const formatTime = (hours: number, minutes: number) => {
        const hour = hours < 0 ? hours + 24 : hours >= 24 ? hours - 24 : hours;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
      };

      const settings = await dependencies.getGlobalSettings();
      let workDate = egyptToday;

      if (user.shiftStart && user.shiftEnd) {
        const [startH, startM] = user.shiftStart.split(':').map(Number);
        const [endH, endM] = user.shiftEnd.split(':').map(Number);

        const shiftStartMinutes = startH * 60 + startM;
        let windowStartMinutes = shiftStartMinutes - settings.early_checkin_minutes;
        if (windowStartMinutes < 0) windowStartMinutes += 1440;

        const shiftEndMinutes = endH * 60 + endM;
        const windowStartH = Math.floor(windowStartMinutes / 60) % 24;
        const windowStartM = windowStartMinutes % 60;

        const isWithinWindow = isWithinTimeWindow(
          currentTotalMinutes,
          windowStartMinutes,
          shiftEndMinutes
        );

        if (!isWithinWindow) {
          return NextResponse.json(
            {
              success: false,
              error: `Check-in is only allowed between ${formatTime(windowStartH, windowStartM)} and ${formatTime(endH, endM)}. You are currently outside your shift window.`,
            },
            { status: 400 }
          );
        }

        workDate = calculateAttendanceWorkDate({
          currentDate: egyptToday,
          currentTotalMinutes,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd,
        });
      }

      const lateMinutes = calculateLateMinutes({
        currentTotalMinutes,
        shiftStart: user.shiftStart,
        lateGraceMinutes: settings.late_grace_minutes,
      });
      const status: 'present' | 'late' = lateMinutes > 0 ? 'late' : 'present';

      const existingAttendanceRows = await dependencies.db
        .select({
          id: attendance.id,
          status: attendance.status,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
        })
        .from(attendance)
        .where(and(eq(attendance.userId, user.id), eq(attendance.date, parseIsoDate(workDate))))
        .limit(1);

      const existingAttendance = existingAttendanceRows[0] ?? null;

      if (existingAttendance?.checkInTime) {
        return NextResponse.json(
          { success: false, error: 'Duplicate check-in is not allowed for the same work date' },
          { status: 409 }
        );
      }

      if (existingAttendance) {
        return NextResponse.json(
          {
            success: false,
            error:
              existingAttendance.status === 'absent'
                ? 'Attendance for this work date has already been finalized'
                : 'Attendance already exists for this work date',
          },
          { status: 409 }
        );
      }

      try {
        await dependencies.db.insert(attendance).values({
          id: randomUUID(),
          userId: user.id,
          date: parseIsoDate(workDate),
          checkInTime: now,
          ipAddress: currentIp,
          checkInLocation,
          lateMinutes,
          status,
        });
      } catch (error) {
        if (isDuplicateEntryError(error)) {
          return NextResponse.json(
            { success: false, error: 'Duplicate check-in is not allowed for the same work date' },
            { status: 409 }
          );
        }

        throw error;
      }

      return NextResponse.json({
        success: true,
        data: {
          check_in_time: now.toISOString(),
          ip_address: currentIp,
          check_in_location: checkInLocation,
          late_minutes: lateMinutes,
          status,
        },
      });
    } catch (error) {
      console.error('Check-in error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}
