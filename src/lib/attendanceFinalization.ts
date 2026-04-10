import { randomUUID } from 'node:crypto';

import { and, eq, ne } from 'drizzle-orm';

import { db, pool } from '@/lib/db';
import { attendance, users } from '@/lib/db/schema';
import { getGlobalSettings } from '@/lib/globalSettings';
import {
  getEgyptDayName,
  getEgyptNow,
  TIMEZONE,
} from '@/lib/timezone';
import type { InternalFinalizationResult } from '@/types';

const FINALIZATION_LOCK_NAME = 'mark_absent_employees';

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function previousIsoDate(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseTimeMinutes(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatEgyptDateTime(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part(
    'minute'
  )}:${part('second')}`;
}

function getTimeZoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const localAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  );

  return localAsUtc - date.getTime();
}

function egyptLocalDateTimeToDate(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds);

  let candidate = new Date(localAsUtc);
  let offset = getTimeZoneOffsetMs(candidate);
  candidate = new Date(localAsUtc - offset);

  const correctedOffset = getTimeZoneOffsetMs(candidate);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    candidate = new Date(localAsUtc - offset);
  }

  return candidate;
}

function getAffectedRows(result: unknown): number {
  return (
    (result as { rowsAffected?: number }).rowsAffected ??
    (result as { affectedRows?: number }).affectedRows ??
    0
  );
}

async function acquireFinalizationLock() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query('SELECT GET_LOCK(?, 0) AS locked', [
    FINALIZATION_LOCK_NAME,
  ]);
  const locked =
    Array.isArray(rows) &&
    rows.length > 0 &&
    Number((rows as { locked: number | string | null }[])[0].locked) === 1;

  if (!locked) {
    connection.release();
    return null;
  }

  return connection;
}

async function releaseFinalizationLock(
  connection: Awaited<ReturnType<typeof pool.getConnection>>
) {
  try {
    await connection.query('SELECT RELEASE_LOCK(?)', [FINALIZATION_LOCK_NAME]);
  } finally {
    connection.release();
  }
}

export async function markAbsentForEndedShifts(): Promise<InternalFinalizationResult> {
  const { date: currentDate, totalMinutes: currentTotalMinutes } = getEgyptNow();
  const dayOfWeek = getEgyptDayName();
  const settings = await getGlobalSettings();

  let markedAbsent = 0;
  let markedMissingCheckout = 0;
  let alreadyRecorded = 0;
  let skippedShiftNotEnded = 0;
  const absentEmployees: string[] = [];
  const missingCheckoutEmployees: string[] = [];

  const employees = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      offDay: users.offDay,
      shiftStart: users.shiftStart,
      shiftEnd: users.shiftEnd,
      overtimeEnabled: users.overtimeEnabled,
    })
    .from(users)
    .where(eq(users.role, 'employee'));

  for (const employee of employees) {
    if (employee.offDay?.toLowerCase() === dayOfWeek) {
      continue;
    }

    const shiftStartMinutes = parseTimeMinutes(employee.shiftStart);
    const shiftEndMinutes = parseTimeMinutes(employee.shiftEnd);
    let shiftEnded = true;
    let targetDate = currentDate;

    if (shiftStartMinutes !== null && shiftEndMinutes !== null) {
      const graceMinutes = employee.overtimeEnabled ? settings.max_overtime_minutes : 0;

      if (shiftEndMinutes < shiftStartMinutes) {
        shiftEnded =
          currentTotalMinutes >= shiftEndMinutes + graceMinutes &&
          currentTotalMinutes < shiftStartMinutes;
        targetDate =
          currentTotalMinutes < shiftStartMinutes ? previousIsoDate(currentDate) : currentDate;
      } else {
        shiftEnded = currentTotalMinutes >= shiftEndMinutes + graceMinutes;
      }
    }

    if (!shiftEnded) {
      skippedShiftNotEnded += 1;
      continue;
    }

    const existingRows = await db
      .select({
        id: attendance.id,
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
      })
      .from(attendance)
      .where(and(eq(attendance.userId, employee.id), eq(attendance.date, parseIsoDate(targetDate))))
      .limit(1);

    const existing = existingRows[0] ?? null;

    if (!existing) {
      await db.insert(attendance).values({
        id: randomUUID(),
        userId: employee.id,
        date: parseIsoDate(targetDate),
        status: 'absent',
        checkInTime: null,
        checkOutTime: null,
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
      });

      markedAbsent += 1;
      absentEmployees.push(employee.fullName);
      continue;
    }

    if (existing.checkInTime && !existing.checkOutTime) {
      if (existing.status === 'missing_checkout') {
        alreadyRecorded += 1;
        continue;
      }

      const checkoutTime = employee.shiftEnd
        ? egyptLocalDateTimeToDate(targetDate, employee.shiftEnd)
        : new Date();

      const result = await db
        .update(attendance)
        .set({
          status: 'missing_checkout',
          checkOutTime: checkoutTime,
        })
        .where(and(eq(attendance.id, existing.id), ne(attendance.status, 'missing_checkout')));

      if (getAffectedRows(result) > 0) {
        markedMissingCheckout += 1;
        missingCheckoutEmployees.push(employee.fullName);
      } else {
        alreadyRecorded += 1;
      }

      continue;
    }

    alreadyRecorded += 1;
  }

  return {
    success: true,
    message: `Marked ${markedAbsent} absent, ${markedMissingCheckout} missing checkout`,
    markedAbsent,
    markedMissingCheckout,
    alreadyRecorded,
    skippedShiftNotEnded,
    currentTime: formatEgyptDateTime(),
    currentDate,
    dayOfWeek,
    absentEmployees,
    missingCheckoutEmployees,
  };
}

export async function executeAttendanceFinalization(): Promise<{
  status: number;
  body: InternalFinalizationResult | { success: false; error: string };
}> {
  const lockConnection = await acquireFinalizationLock();

  if (!lockConnection) {
    return {
      status: 409,
      body: { success: false, error: 'Another attendance finalization run is already active' },
    };
  }

  try {
    const body = await markAbsentForEndedShifts();
    return { status: 200, body };
  } catch (error) {
    console.error('Attendance finalization failed:', error);
    return {
      status: 500,
      body: { success: false, error: 'Failed to execute attendance finalization' },
    };
  } finally {
    await releaseFinalizationLock(lockConnection);
  }
}
