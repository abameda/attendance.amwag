import { TIMEZONE } from '@/lib/timezone';

const DAY_MINUTES = 24 * 60;

export interface CheckoutMetrics {
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
}

interface EmployeeAttendanceRecordLike {
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

function getEgyptDateFromTimestamp(timestamp: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

export function selectCurrentEmployeeAttendanceRecord<T extends EmployeeAttendanceRecordLike>(
  records: T[],
  today: string
): T | null {
  return (
    records.find((record) => record.date === today) ??
    records.find(
      (record) =>
        Boolean(record.check_in_time) &&
        !record.check_out_time &&
        record.status !== 'missing_checkout'
    ) ??
    records.find((record) => getEgyptDateFromTimestamp(record.check_out_time) === today) ??
    records.find(
      (record) =>
        Boolean(record.check_in_time) &&
        getEgyptDateFromTimestamp(record.check_in_time) === today
    ) ??
    null
  );
}

export function parseTimeMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isOvernightShift(shiftStart: string | null, shiftEnd: string | null): boolean {
  const startMinutes = parseTimeMinutes(shiftStart);
  const endMinutes = parseTimeMinutes(shiftEnd);
  return startMinutes !== null && endMinutes !== null && endMinutes < startMinutes;
}

export function calculateAttendanceWorkDate(params: {
  currentDate: string;
  currentTotalMinutes: number;
  shiftStart: string | null;
  shiftEnd: string | null;
}): string {
  const endMinutes = parseTimeMinutes(params.shiftEnd);
  if (
    endMinutes !== null &&
    isOvernightShift(params.shiftStart, params.shiftEnd) &&
    params.currentTotalMinutes < endMinutes
  ) {
    return addIsoDays(params.currentDate, -1);
  }

  return params.currentDate;
}

export function calculateFinalizationCandidateDates(params: {
  currentDate: string;
  currentTotalMinutes: number;
  shiftStart: string | null;
  shiftEnd: string | null;
}): string[] {
  if (parseTimeMinutes(params.shiftStart) === null || parseTimeMinutes(params.shiftEnd) === null) {
    return [params.currentDate];
  }

  return [addIsoDays(params.currentDate, -1), params.currentDate];
}

export function calculateLateMinutes(params: {
  currentTotalMinutes: number;
  shiftStart: string | null;
  lateGraceMinutes: number;
}): number {
  const shiftStartMinutes = parseTimeMinutes(params.shiftStart);
  if (shiftStartMinutes === null) {
    return 0;
  }

  let diff = params.currentTotalMinutes - shiftStartMinutes;
  if (diff < -DAY_MINUTES / 2) {
    diff += DAY_MINUTES;
  }

  return diff > params.lateGraceMinutes ? diff : 0;
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

export function egyptLocalDateTimeToDate(date: string, time: string): Date {
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

export function getShiftEndDate(params: {
  workDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
}): Date | null {
  if (!params.shiftEnd) {
    return null;
  }

  const endWorkDate = isOvernightShift(params.shiftStart, params.shiftEnd)
    ? addIsoDays(params.workDate, 1)
    : params.workDate;

  return egyptLocalDateTimeToDate(endWorkDate, params.shiftEnd);
}

export function isShiftEndReached(params: {
  workDate: string;
  now: Date;
  shiftStart: string | null;
  shiftEnd: string | null;
}): boolean {
  const shiftEndDate = getShiftEndDate(params);
  return shiftEndDate ? params.now.getTime() >= shiftEndDate.getTime() : true;
}

export function isCheckoutWindowExpired(params: {
  workDate: string;
  now: Date;
  shiftStart: string | null;
  shiftEnd: string | null;
  checkoutWindowMinutes: number;
}): boolean {
  const shiftEndDate = getShiftEndDate(params);
  if (!shiftEndDate) {
    return true;
  }

  return params.now.getTime() > shiftEndDate.getTime() + params.checkoutWindowMinutes * 60000;
}

export function calculateShiftDurationMinutes(
  shiftStart: string | null,
  shiftEnd: string | null
): number | null {
  const startMinutes = parseTimeMinutes(shiftStart);
  const endMinutes = parseTimeMinutes(shiftEnd);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  let duration = endMinutes - startMinutes;
  if (duration < 0) {
    duration += DAY_MINUTES;
  }

  return duration;
}

export function calculateCheckoutMetrics(params: {
  workDate: string;
  checkInTime?: Date | null;
  checkOutTime: Date;
  shiftStart: string | null;
  shiftEnd: string | null;
  overtimeEnabled: boolean | number;
  maxOvertimeMinutes: number;
}): CheckoutMetrics {
  const shiftEndDate = getShiftEndDate(params);
  const workedMinutes = params.checkInTime
    ? Math.max(0, Math.floor((params.checkOutTime.getTime() - params.checkInTime.getTime()) / 60000))
    : 0;

  if (!shiftEndDate) {
    return {
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      workedMinutes,
    };
  }

  const diffMinutes = Math.floor((shiftEndDate.getTime() - params.checkOutTime.getTime()) / 60000);
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;

  if (diffMinutes > 0) {
    earlyDepartureMinutes = diffMinutes;
  } else if (diffMinutes < 0 && Boolean(params.overtimeEnabled)) {
    overtimeMinutes = Math.min(Math.abs(diffMinutes), params.maxOvertimeMinutes);
  }

  return {
    earlyDepartureMinutes,
    overtimeMinutes,
    workedMinutes,
  };
}

export function buildMissingCheckoutUpdate(): {
  status: 'missing_checkout';
  checkOutTime: null;
} {
  return {
    status: 'missing_checkout',
    checkOutTime: null,
  };
}
