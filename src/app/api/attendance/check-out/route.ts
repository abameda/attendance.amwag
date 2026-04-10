import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, branchAllowedIps } from '@/lib/db/schema';
import { getGlobalSettings } from '@/lib/globalSettings';
import { getEgyptDate, getEgyptNow } from '@/lib/timezone';

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
          error: 'You must be connected to the company network (WiFi) to check out.',
        },
        { status: 403 }
      );
    }

    const checkOutLocation = matchingBranch.branchName;
    const now = new Date();
    const { date: egyptDate } = getEgyptNow();
    const today = egyptDate;

    const existingRecordRows = await db
      .select({
        id: attendance.id,
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

      const yesterdayRecordRows = await db
        .select({
          id: attendance.id,
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

    let shiftDurationHours = 9;
    if (user.shiftStart && user.shiftEnd) {
      const [startH, startM] = user.shiftStart.split(':').map(Number);
      const [endH, endM] = user.shiftEnd.split(':').map(Number);
      let durationMinutes = endH * 60 + endM - (startH * 60 + startM);
      if (durationMinutes < 0) durationMinutes += 24 * 60;
      shiftDurationHours = durationMinutes / 60;
    }

    const checkInTime = existingRecord.checkInTime;
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

    const settings = await getGlobalSettings();

    if (user.shiftStart && user.shiftEnd) {
      const [endH, endM] = user.shiftEnd.split(':').map(Number);
      const [startH, startM] = user.shiftStart.split(':').map(Number);

      const shiftEndRef = new Date(checkInTime);
      shiftEndRef.setHours(endH, endM, 0, 0);

      if (endH < startH || (endH === startH && endM < startM)) {
        shiftEndRef.setDate(shiftEndRef.getDate() + 1);
      }

      const windowMinutes = user.overtimeEnabled
        ? settings.max_overtime_minutes
        : settings.checkout_window_minutes;
      const windowEnd = new Date(shiftEndRef.getTime() + windowMinutes * 60000);

      if (now.getTime() > windowEnd.getTime()) {
        return NextResponse.json(
          {
            success: false,
            error: `Check-out window has expired. You had ${windowMinutes} minutes after your shift ended to check out.`,
          },
          { status: 400 }
        );
      }
    }

    let earlyDepartureMinutes = 0;
    let overtimeMinutes = 0;

    if (user.shiftEnd) {
      const [endH, endM] = user.shiftEnd.split(':').map(Number);
      const shiftEndDate = new Date(checkInTime);
      shiftEndDate.setHours(endH, endM, 0, 0);

      if (user.shiftStart) {
        const [startH, startM] = user.shiftStart.split(':').map(Number);
        if (endH < startH || (endH === startH && endM < startM)) {
          shiftEndDate.setDate(shiftEndDate.getDate() + 1);
        }
      }

      const diffMinutes = Math.floor((shiftEndDate.getTime() - now.getTime()) / 60000);

      if (diffMinutes > 0) {
        earlyDepartureMinutes = diffMinutes;
      } else if (diffMinutes < 0 && user.overtimeEnabled) {
        const overtimeDiff = Math.abs(diffMinutes);
        overtimeMinutes = Math.min(overtimeDiff, settings.max_overtime_minutes);
      }
    }

    let resolvedStatus = existingRecord.status;
    if (resolvedStatus === 'missing_checkout') {
      resolvedStatus =
        existingRecord.lateMinutes && existingRecord.lateMinutes > 0 ? 'late' : 'present';
    }

    const updateResult = await db
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
      (updateResult as unknown as { rowsAffected?: number; affectedRows?: number }).rowsAffected ??
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
}
