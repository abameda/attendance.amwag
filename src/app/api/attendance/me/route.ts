import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance } from '@/lib/db/schema';
import type { AttendanceRecord } from '@/types';

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rows = await db
      .select()
      .from(attendance)
      .where(eq(attendance.userId, user.id))
      .orderBy(desc(attendance.date))
      .limit(90);

    const data: AttendanceRecord[] = rows.map((row) => ({
      id: row.id,
      user_id: row.userId,
      date: toIsoDate(row.date),
      check_in_time: toIsoString(row.checkInTime),
      check_out_time: toIsoString(row.checkOutTime),
      ip_address: row.ipAddress,
      check_out_ip: row.checkOutIp,
      check_in_location: row.checkInLocation,
      check_out_location: row.checkOutLocation,
      status: row.status,
      late_minutes: row.lateMinutes,
      early_departure_minutes: row.earlyDepartureMinutes,
      overtime_minutes: row.overtimeMinutes,
      created_at: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get current user attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
