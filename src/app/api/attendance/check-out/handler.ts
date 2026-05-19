import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import {
  calculateCheckoutMetrics,
  calculateShiftDurationMinutes,
  isCheckoutWindowExpired,
} from '@/lib/attendanceCalculations';
import { db } from '@/lib/db';
import { attendance, branchAllowedIps } from '@/lib/db/schema';
import { getGlobalSettings } from '@/lib/globalSettings';
import { getEgyptDate, getEgyptNow } from '@/lib/timezone';

type CheckOutDependencies = {
  db: Pick<typeof db, 'select' | 'update'>;
  getCurrentUser: typeof getCurrentUser;
  getGlobalSettings: typeof getGlobalSettings;
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function createCheckOutHandler(dependencies: CheckOutDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const user = await dependencies.getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const currentIp =
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        'Unknown';

      const ipv4Parts = currentIp.split('.');
      const ipNetwork = ipv4Parts.length === 4 ? ipv4Parts.slice(0, 3).join('.') : currentIp;

      const matchingBranchRows = await dependencies.db
        .select({
          branchName: branchAllowedIps.branchName,
        })
        .from(branchAllowedIps)
        .where(and(eq(branchAllowedIps.ipNetwork, ipNetwork), eq(branchAllowedIps.isActive, 1)))
        .limit(1);

      const matchingBranch = matchingBranchRows[0] ?? null;

      if (!matchingBranch) {
        return NextResponse.json(
          {
            success: false,
            error: 'You must be connected to the company network (WiFi) to check out.',
          },
          { status: 403 }
        );
      }

      const checkOutLocation = matchingBranch.branchName;
      const now = new Date();
      const { date: egyptDate } = getEgyptNow();
      const today = egyptDate;

      const existingRecordRows = await dependencies.db
        .select({
          id: attendance.id,
          date: attendance.date,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
          ipAddress: attendance.ipAddress,
          status: attendance.status,
          lateMinutes: attendance.lateMinutes,
        })
        .from(attendance)
        .where(and(eq(attendance.userId, user.id), eq(attendance.date, parseIsoDate(today))))
        .limit(1);

      let existingRecord = existingRecordRows[0] ?? null;

      if (!existingRecord?.checkInTime) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = getEgyptDate(yesterday);

        const yesterdayRecordRows = await dependencies.db
          .select({
            id: attendance.id,
            date: attendance.date,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            ipAddress: attendance.ipAddress,
            status: attendance.status,
            lateMinutes: attendance.lateMinutes,
          })
          .from(attendance)
          .where(
            and(
              eq(attendance.userId, user.id),
              eq(attendance.date, parseIsoDate(yesterdayDate)),
              isNull(attendance.checkOutTime)
            )
          )
          .limit(1);

        const yesterdayRecord = yesterdayRecordRows[0] ?? null;

        if (yesterdayRecord?.checkInTime) {
          existingRecord = yesterdayRecord;
        }
      }

      if (!existingRecord?.checkInTime) {
        return NextResponse.json(
          { success: false, error: 'Must check in before checking out' },
          { status: 400 }
        );
      }

      if (existingRecord.checkOutTime) {
        return NextResponse.json(
          { success: false, error: 'Already checked out today' },
          { status: 409 }
        );
      }

      const checkInTime = existingRecord.checkInTime;
      if (now.getTime() < checkInTime.getTime()) {
        return NextResponse.json(
          { success: false, error: 'Check-out time cannot be before check-in time' },
          { status: 400 }
        );
      }

      const shiftDurationMinutes = calculateShiftDurationMinutes(user.shiftStart, user.shiftEnd);
      const shiftDurationHours = shiftDurationMinutes === null ? 9 : shiftDurationMinutes / 60;
      const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      const maxAllowedSessionHours = Math.max(14, shiftDurationHours + 5);

      if (hoursSinceCheckIn > maxAllowedSessionHours) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your session timed out. You forgot to check out of your previous shift.',
          },
          { status: 400 }
        );
      }

      const settings = await dependencies.getGlobalSettings();
      const workDate = toIsoDate(existingRecord.date);

      if (user.shiftEnd) {
        if (
          isCheckoutWindowExpired({
            workDate,
            now,
            shiftStart: user.shiftStart,
            shiftEnd: user.shiftEnd,
            checkoutWindowMinutes: settings.checkout_window_minutes,
          })
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `Check-out window has expired. You had ${settings.checkout_window_minutes} minutes after your shift ended to check out.`,
            },
            { status: 400 }
          );
        }
      }

      const { earlyDepartureMinutes, overtimeMinutes } = calculateCheckoutMetrics({
        workDate,
        checkInTime,
        checkOutTime: now,
        shiftStart: user.shiftStart,
        shiftEnd: user.shiftEnd,
        overtimeEnabled: user.overtimeEnabled,
        maxOvertimeMinutes: settings.max_overtime_minutes,
      });

      let resolvedStatus = existingRecord.status;
      if (resolvedStatus === 'missing_checkout') {
        resolvedStatus =
          existingRecord.lateMinutes && existingRecord.lateMinutes > 0 ? 'late' : 'present';
      }

      const updateResult = await dependencies.db
        .update(attendance)
        .set({
          checkOutTime: now,
          checkOutIp: currentIp,
          checkOutLocation,
          earlyDepartureMinutes,
          overtimeMinutes,
          status: resolvedStatus,
        })
        .where(and(eq(attendance.id, existingRecord.id), isNull(attendance.checkOutTime)));

      const affectedRows =
        (updateResult as unknown as { rowsAffected?: number; affectedRows?: number })
          .rowsAffected ??
        (updateResult as unknown as { affectedRows?: number }).affectedRows ??
        0;

      if (affectedRows === 0) {
        return NextResponse.json(
          { success: false, error: 'Already checked out today' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          check_out_time: now.toISOString(),
          check_out_location: checkOutLocation,
          early_departure_minutes: earlyDepartureMinutes,
          overtime_minutes: overtimeMinutes,
          status: resolvedStatus,
        },
      });
    } catch (error) {
      console.error('Check-out error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}
