import { randomUUID } from 'node:crypto';

import { and, eq, ne } from 'drizzle-orm';

import {
  buildMissingCheckoutUpdate,
  calculateFinalizationCandidateDates,
  isCheckoutWindowExpired,
  isShiftEndReached,
} from '@/lib/attendanceCalculations';
import { db, pool } from '@/lib/db';
import { attendance, users } from '@/lib/db/schema';
import { getGlobalSettings } from '@/lib/globalSettings';
import {
  getEgyptDayNameFromISODate,
  getEgyptDayName,
  getEgyptNow,
  TIMEZONE,
} from '@/lib/timezone';
import type { InternalFinalizationResult } from '@/types';

const FINALIZATION_LOCK_NAME = 'mark_absent_employees';

type FinalizationDependencies = {
  db: Pick<typeof db, 'select' | 'insert' | 'update'>;
  getGlobalSettings: typeof getGlobalSettings;
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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

export function createMarkAbsentForEndedShifts(dependencies: FinalizationDependencies) {
  return async function markAbsentForEndedShifts(): Promise<InternalFinalizationResult> {
  const now = new Date();
  const { date: currentDate, totalMinutes: currentTotalMinutes } = getEgyptNow();
  const dayOfWeek = getEgyptDayName();
  const settings = await dependencies.getGlobalSettings();

  let markedAbsent = 0;
  let markedMissingCheckout = 0;
  let alreadyRecorded = 0;
  let skippedShiftNotEnded = 0;
  const absentEmployees: string[] = [];
  const missingCheckoutEmployees: string[] = [];

  const employees = await dependencies.db
    .select({
      id: users.id,
      fullName: users.fullName,
      offDay: users.offDay,
      shiftStart: users.shiftStart,
      shiftEnd: users.shiftEnd,
    })
    .from(users)
    .where(eq(users.role, 'employee'));

  for (const employee of employees) {
    const targetDates = calculateFinalizationCandidateDates({
      currentDate,
      currentTotalMinutes,
      shiftStart: employee.shiftStart,
      shiftEnd: employee.shiftEnd,
    });

    for (const targetDate of targetDates) {
      if (employee.offDay?.toLowerCase() === getEgyptDayNameFromISODate(targetDate)) {
        continue;
      }

      const shiftEndReached = isShiftEndReached({
        workDate: targetDate,
        now,
        shiftStart: employee.shiftStart,
        shiftEnd: employee.shiftEnd,
      });

      if (!shiftEndReached) {
        skippedShiftNotEnded += 1;
        continue;
      }

      const existingRows = await dependencies.db
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
        await dependencies.db.insert(attendance).values({
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

        const checkoutWindowExpired = isCheckoutWindowExpired({
          workDate: targetDate,
          now,
          shiftStart: employee.shiftStart,
          shiftEnd: employee.shiftEnd,
          checkoutWindowMinutes: settings.checkout_window_minutes,
        });

        if (!checkoutWindowExpired) {
          skippedShiftNotEnded += 1;
          continue;
        }

        const result = await dependencies.db
          .update(attendance)
          .set(buildMissingCheckoutUpdate())
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
  };
}

export const markAbsentForEndedShifts = createMarkAbsentForEndedShifts({
  db,
  getGlobalSettings,
});

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
