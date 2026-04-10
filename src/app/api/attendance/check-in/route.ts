import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, branchAllowedIps } from '@/lib/db/schema';
import { getGlobalSettings } from '@/lib/globalSettings';
import { getEgyptNow, isWithinTimeWindow } from '@/lib/timezone';

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentIp =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      'Unknown';

    const ipv4Parts = currentIp.split('.');
    const ipNetwork = ipv4Parts.length === 4 ? ipv4Parts.slice(0, 3).join('.') : currentIp;

    const matchingBranchRows = await db
      .select({
        branchName: branchAllowedIps.branchName,
      })
      .from(branchAllowedIps)
      .where(
        and(eq(branchAllowedIps.ipNetwork, ipNetwork), eq(branchAllowedIps.isActive, 1))
      )
      .limit(1);

    const matchingBranch = matchingBranchRows[0] ?? null;

    if (!matchingBranch) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must be connected to the company network (WiFi) to check in.',
        },
        { status: 403 }
      );
    }

    const checkInLocation = matchingBranch.branchName;
    const now = new Date();
    const { date: egyptToday, totalMinutes: currentTotalMinutes } = getEgyptNow();

    const formatTime = (hours: number, minutes: number) => {
      const hour = hours < 0 ? hours + 24 : hours >= 24 ? hours - 24 : hours;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const settings = await getGlobalSettings();

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
    }

    let lateMinutes = 0;
    let status: 'present' | 'late' = 'present';

    if (user.shiftStart) {
      const [shiftHours, shiftMinutes] = user.shiftStart.split(':').map(Number);
      const shiftStartTotalMinutes = shiftHours * 60 + shiftMinutes;

      let diff = currentTotalMinutes - shiftStartTotalMinutes;
      if (diff < -720) {
        diff += 1440;
      }

      if (diff > settings.late_grace_minutes) {
        lateMinutes = diff;
        status = 'late';
      }
    }

    const existingAttendanceRows = await db
      .select({
        id: attendance.id,
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
      })
      .from(attendance)
      .where(and(eq(attendance.userId, user.id), eq(attendance.date, parseIsoDate(egyptToday))))
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

    await db.insert(attendance).values({
      id: randomUUID(),
      userId: user.id,
      date: parseIsoDate(egyptToday),
      checkInTime: now,
      ipAddress: currentIp,
      checkInLocation,
      lateMinutes,
      status,
    });

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
}
