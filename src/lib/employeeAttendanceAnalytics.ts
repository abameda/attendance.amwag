import { getEgyptDayNameFromISODate, TIMEZONE } from '@/lib/timezone';

export type AnalyticsRangePreset =
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'custom'
  | 'all';

export interface AnalyticsDateRange {
  preset: AnalyticsRangePreset;
  from: string | null;
  to: string;
}

export interface AnalyticsEmployee {
  id: string;
  email: string;
  fullName: string;
  branch: string | null;
  jobTitle: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  offDay: string | null;
  overtimeEnabled: boolean | number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsAttendanceRow {
  id: string;
  userId: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  ipAddress: string | null;
  checkOutIp: string | null;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  status: 'present' | 'late' | 'absent' | 'missing_checkout';
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  createdAt: Date;
}

export interface AnalyticsComparisonEmployee {
  id: string;
  offDay: string | null;
  createdAt?: Date;
}

export interface EmployeeAttendanceAnalytics {
  employee: {
    id: string;
    email: string;
    full_name: string;
    branch: string | null;
    job_title: string | null;
    shift_start: string | null;
    shift_end: string | null;
    off_day: string | null;
    overtime_enabled: boolean;
  };
  range: AnalyticsDateRange;
  summary: {
    expectedWorkingDays: number;
    presentDays: number;
    absentDays: number;
    onTimeDays: number;
    lateDays: number;
    earlyLeaveDays: number;
    missingCheckoutDays: number;
    overtimeDays: number;
    attendanceRate: number;
    punctualityRate: number;
    departureCompletionRate: number;
    totalLateMinutes: number;
    averageLateMinutes: number;
    totalOvertimeMinutes: number;
    averageCheckInTime: string | null;
    averageCheckOutTime: string | null;
  };
  trends: {
    daily: Array<{
      date: string;
      status: AnalyticsAttendanceRow['status'] | 'no_record';
      present: number;
      absent: number;
      lateMinutes: number;
      overtimeMinutes: number;
    }>;
  };
  insights: Array<{
    code: string;
    severity: 'positive' | 'warning' | 'neutral';
    title: string;
    detail: string;
  }>;
  history: Array<{
    id: string;
    date: string;
    shift: string | null;
    checkIn: string | null;
    checkOut: string | null;
    lateMinutes: number;
    earlyDepartureMinutes: number;
    overtimeMinutes: number;
    status: AnalyticsAttendanceRow['status'];
    ipAddress: string | null;
    checkOutIp: string | null;
    location: string | null;
  }>;
  comparison: {
    branchAverage: { attendanceRate: number | null; expectedWorkingDays: number; presentDays: number };
    companyAverage: { attendanceRate: number | null; expectedWorkingDays: number; presentDays: number };
  };
  score: {
    value: number;
    deductions: Array<{ reason: string; points: number }>;
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function lastDayOfPreviousMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 0, 12)).toISOString().slice(0, 10);
}

function firstDayOfPreviousMonth(value: string): string {
  const previousLastDay = lastDayOfPreviousMonth(value);
  return firstDayOfMonth(previousLastDay);
}

function isValidDate(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DATE_PATTERN.test(value));
}

export function resolveAnalyticsDateRange(params: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  today: string;
}): AnalyticsDateRange {
  const preset = (
    ['this_month', 'last_month', 'last_7_days', 'last_30_days', 'custom', 'all'].includes(
      params.preset ?? ''
    )
      ? params.preset
      : 'this_month'
  ) as AnalyticsRangePreset;
  const today = params.today;

  if (preset === 'last_month') {
    return { preset, from: firstDayOfPreviousMonth(today), to: lastDayOfPreviousMonth(today) };
  }

  if (preset === 'last_7_days') {
    return { preset, from: addIsoDays(today, -6), to: today };
  }

  if (preset === 'last_30_days') {
    return { preset, from: addIsoDays(today, -29), to: today };
  }

  if (preset === 'custom') {
    const from = isValidDate(params.from) ? params.from : today;
    const to = isValidDate(params.to) ? params.to : from;
    return from <= to ? { preset, from, to } : { preset, from: to, to: from };
  }

  if (preset === 'all') {
    return { preset, from: null, to: today };
  }

  return { preset: 'this_month', from: firstDayOfMonth(today), to: today };
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function enumerateExpectedDates(range: AnalyticsDateRange, employee: Pick<AnalyticsEmployee, 'offDay' | 'createdAt'>): string[] {
  const employeeStart = toIsoDate(employee.createdAt);
  const from = range.from ? (range.from > employeeStart ? range.from : employeeStart) : employeeStart;
  if (from > range.to) {
    return [];
  }

  const dates: string[] = [];
  let cursor = from;
  while (cursor <= range.to) {
    if (employee.offDay?.toLowerCase() !== getEgyptDayNameFromISODate(cursor)) {
      dates.push(cursor);
    }
    cursor = addIsoDays(cursor, 1);
  }
  return dates;
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toAverage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(2));
}

function getCairoMinutes(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hours * 60 + minutes;
}

function formatMinutesAsTime(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  const minutes = Math.round(value) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function buildSummary(rows: AnalyticsAttendanceRow[], expectedWorkingDays: number) {
  const presentRows = rows.filter((row) => row.status !== 'absent');
  const checkoutRows = presentRows.filter((row) => row.checkOutTime);
  const lateRows = rows.filter((row) => row.status === 'late' || row.lateMinutes > 0);
  const onTimeRows = presentRows.filter((row) => row.status === 'present' && row.lateMinutes === 0);
  const absentRows = rows.filter((row) => row.status === 'absent');
  const missingCheckoutRows = rows.filter((row) => row.status === 'missing_checkout');
  const earlyLeaveRows = rows.filter((row) => row.earlyDepartureMinutes > 0);
  const overtimeRows = rows.filter((row) => row.overtimeMinutes > 0);
  const totalLateMinutes = rows.reduce((sum, row) => sum + row.lateMinutes, 0);
  const totalOvertimeMinutes = rows.reduce((sum, row) => sum + row.overtimeMinutes, 0);
  const checkInMinutes = presentRows.flatMap((row) =>
    row.checkInTime ? [getCairoMinutes(row.checkInTime)] : []
  );
  const checkOutMinutes = checkoutRows.flatMap((row) =>
    row.checkOutTime ? [getCairoMinutes(row.checkOutTime)] : []
  );

  return {
    expectedWorkingDays,
    presentDays: presentRows.length,
    absentDays: absentRows.length,
    onTimeDays: onTimeRows.length,
    lateDays: lateRows.length,
    earlyLeaveDays: earlyLeaveRows.length,
    missingCheckoutDays: missingCheckoutRows.length,
    overtimeDays: overtimeRows.length,
    attendanceRate: toPercent(presentRows.length, expectedWorkingDays),
    punctualityRate: toPercent(onTimeRows.length, presentRows.length),
    departureCompletionRate: toPercent(checkoutRows.length, presentRows.length),
    totalLateMinutes,
    averageLateMinutes: toAverage(totalLateMinutes, lateRows.length),
    totalOvertimeMinutes,
    averageCheckInTime: formatMinutesAsTime(
      checkInMinutes.length
        ? checkInMinutes.reduce((sum, minutes) => sum + minutes, 0) / checkInMinutes.length
        : null
    ),
    averageCheckOutTime: formatMinutesAsTime(
      checkOutMinutes.length
        ? checkOutMinutes.reduce((sum, minutes) => sum + minutes, 0) / checkOutMinutes.length
        : null
    ),
  };
}

function buildInsights(params: {
  rows: AnalyticsAttendanceRow[];
  summary: ReturnType<typeof buildSummary>;
  previousAttendanceRate: number | null;
}) {
  const insights: EmployeeAttendanceAnalytics['insights'] = [];
  const { rows, summary } = params;

  if (rows.length === 0) {
    return [
      {
        code: 'no_records',
        severity: 'neutral',
        title: 'No attendance records in this period.',
        detail: 'The selected range has expected working days but no recorded attendance events yet.',
      },
    ] satisfies EmployeeAttendanceAnalytics['insights'];
  }

  if (summary.lateDays >= 2 && summary.lateDays / Math.max(summary.presentDays, 1) >= 0.3) {
    insights.push({
      code: 'frequent_late',
      severity: 'warning',
      title: 'This employee is frequently late.',
      detail: `${summary.lateDays} of ${summary.presentDays} attended days include late arrival.`,
    });
  }

  const lateWeekdays = new Map<string, number>();
  for (const row of rows) {
    if (row.status === 'late' || row.lateMinutes > 0) {
      const day = getEgyptDayNameFromISODate(toIsoDate(row.date));
      lateWeekdays.set(day, (lateWeekdays.get(day) ?? 0) + 1);
    }
  }
  const topLateDay = Array.from(lateWeekdays.entries()).sort((left, right) => right[1] - left[1])[0];
  if (topLateDay && topLateDay[1] >= 2) {
    insights.push({
      code: 'late_weekday_pattern',
      severity: 'neutral',
      title: `Most late arrivals happen on ${topLateDay[0]}.`,
      detail: `${topLateDay[1]} late arrivals are concentrated on that weekday.`,
    });
  }

  if (params.previousAttendanceRate !== null) {
    const delta = summary.attendanceRate - params.previousAttendanceRate;
    if (delta >= 5) {
      insights.push({
        code: 'attendance_improved',
        severity: 'positive',
        title: 'Attendance improved compared to the previous period.',
        detail: `Attendance rate increased by ${delta.toFixed(2)} percentage points.`,
      });
    } else if (delta <= -5) {
      insights.push({
        code: 'attendance_declined',
        severity: 'warning',
        title: 'Attendance declined compared to the previous period.',
        detail: `Attendance rate dropped by ${Math.abs(delta).toFixed(2)} percentage points.`,
      });
    }
  }

  if (summary.missingCheckoutDays >= 2 || summary.missingCheckoutDays / Math.max(summary.presentDays, 1) >= 0.15) {
    insights.push({
      code: 'repeated_missing_checkout',
      severity: 'warning',
      title: 'Missing checkout happens repeatedly.',
      detail: `${summary.missingCheckoutDays} attended days are missing checkout.`,
    });
  }

  if (summary.attendanceRate >= 95 && summary.punctualityRate >= 85 && summary.missingCheckoutDays === 0) {
    insights.push({
      code: 'strong_consistency',
      severity: 'positive',
      title: 'Employee has strong attendance consistency.',
      detail: 'Attendance and punctuality are both high in the selected period.',
    });
  }

  if (summary.earlyLeaveDays >= 2 || summary.earlyLeaveDays / Math.max(summary.presentDays, 1) >= 0.15) {
    insights.push({
      code: 'early_leave_pattern',
      severity: 'warning',
      title: 'Employee often leaves before shift end.',
      detail: `${summary.earlyLeaveDays} days include early leave minutes.`,
    });
  }

  if (summary.overtimeDays >= 2 || summary.overtimeDays / Math.max(summary.presentDays, 1) >= 0.2) {
    insights.push({
      code: 'frequent_overtime',
      severity: 'neutral',
      title: 'Overtime is frequent for this employee.',
      detail: `${summary.overtimeDays} days include overtime minutes.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      code: 'stable_period',
      severity: 'neutral',
      title: 'Attendance behavior is stable in this period.',
      detail: 'No repeated lateness, absence, checkout, early leave, or overtime pattern crossed the alert threshold.',
    });
  }

  return insights;
}

function buildScore(summary: ReturnType<typeof buildSummary>): EmployeeAttendanceAnalytics['score'] {
  const deductions: EmployeeAttendanceAnalytics['score']['deductions'] = [];
  const addDeduction = (reason: string, points: number) => {
    if (points > 0) {
      deductions.push({ reason, points });
    }
  };

  /*
   * Attendance score starts at 100 and only deducts for recorded behavior issues:
   * absence carries the largest penalty, lateness combines frequency and minutes,
   * early leave and missing checkout are moderate operational penalties, and
   * overtime never reduces the score because it is not an attendance risk by itself.
   */
  addDeduction('Recorded absence days', summary.absentDays * 15);
  addDeduction('Late arrival frequency', summary.lateDays * 4);
  addDeduction('Total late minutes', Math.round(summary.totalLateMinutes / 10));
  addDeduction('Early leave days', summary.earlyLeaveDays * 6);
  addDeduction('Missing checkout days', summary.missingCheckoutDays * 7);

  const totalDeduction = deductions.reduce((sum, item) => sum + item.points, 0);
  return {
    value: Math.max(0, Math.min(100, 100 - totalDeduction)),
    deductions,
  };
}

function buildComparison(
  rows: AnalyticsAttendanceRow[],
  employees: AnalyticsComparisonEmployee[] | undefined,
  range: AnalyticsDateRange
) {
  if (!employees?.length) {
    const presentDays = rows.filter((row) => row.status !== 'absent').length;
    return {
      attendanceRate: rows.length ? toPercent(presentDays, rows.length) : null,
      expectedWorkingDays: rows.length,
      presentDays,
    };
  }

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const rowKeySet = new Set(
    rows.filter((row) => row.status !== 'absent').map((row) => `${row.userId}:${toIsoDate(row.date)}`)
  );
  const expectedWorkingDays = employees.reduce(
    (sum, employee) =>
      sum +
      enumerateExpectedDates(range, {
        offDay: employee.offDay,
        createdAt: employee.createdAt ?? new Date(`${range.from ?? '1970-01-01'}T00:00:00.000Z`),
      }).length,
    0
  );
  const presentDays = Array.from(rowKeySet).filter((key) => {
    const userId = key.slice(0, key.indexOf(':'));
    return employeeIds.has(userId);
  }).length;

  return {
    attendanceRate: expectedWorkingDays > 0 ? toPercent(presentDays, expectedWorkingDays) : null,
    expectedWorkingDays,
    presentDays,
  };
}

export function buildEmployeeAttendanceAnalytics(params: {
  employee: AnalyticsEmployee;
  rows: AnalyticsAttendanceRow[];
  previousRows: AnalyticsAttendanceRow[];
  range: AnalyticsDateRange;
  branchRows?: AnalyticsAttendanceRow[];
  companyRows?: AnalyticsAttendanceRow[];
  branchEmployees?: AnalyticsComparisonEmployee[];
  companyEmployees?: AnalyticsComparisonEmployee[];
  today: string;
}): EmployeeAttendanceAnalytics {
  const expectedDates = enumerateExpectedDates(params.range, params.employee);
  const rowsByDate = new Map(params.rows.map((row) => [toIsoDate(row.date), row]));
  const summary = buildSummary(params.rows, expectedDates.length);
  const previousExpectedDays = params.previousRows.length
    ? new Set(params.previousRows.map((row) => toIsoDate(row.date))).size
    : 0;
  const previousSummary = buildSummary(params.previousRows, previousExpectedDays);
  const previousAttendanceRate = previousExpectedDays > 0 ? previousSummary.attendanceRate : null;
  const shift =
    params.employee.shiftStart && params.employee.shiftEnd
      ? `${params.employee.shiftStart} - ${params.employee.shiftEnd}`
      : null;

  return {
    employee: {
      id: params.employee.id,
      email: params.employee.email,
      full_name: params.employee.fullName,
      branch: params.employee.branch,
      job_title: params.employee.jobTitle,
      shift_start: params.employee.shiftStart,
      shift_end: params.employee.shiftEnd,
      off_day: params.employee.offDay,
      overtime_enabled: Boolean(params.employee.overtimeEnabled),
    },
    range: params.range,
    summary,
    trends: {
      daily: expectedDates.map((date) => {
        const row = rowsByDate.get(date);
        return {
          date,
          status: row?.status ?? 'no_record',
          present: row && row.status !== 'absent' ? 1 : 0,
          absent: row?.status === 'absent' ? 1 : 0,
          lateMinutes: row?.lateMinutes ?? 0,
          overtimeMinutes: row?.overtimeMinutes ?? 0,
        };
      }),
    },
    insights: buildInsights({ rows: params.rows, summary, previousAttendanceRate }),
    history: [...params.rows]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .map((row) => ({
        id: row.id,
        date: toIsoDate(row.date),
        shift,
        checkIn: row.checkInTime?.toISOString() ?? null,
        checkOut: row.checkOutTime?.toISOString() ?? null,
        lateMinutes: row.lateMinutes,
        earlyDepartureMinutes: row.earlyDepartureMinutes,
        overtimeMinutes: row.overtimeMinutes,
        status: row.status,
        ipAddress: row.ipAddress,
        checkOutIp: row.checkOutIp,
        location:
          row.checkInLocation && row.checkOutLocation && row.checkInLocation !== row.checkOutLocation
            ? `${row.checkInLocation} / ${row.checkOutLocation}`
            : row.checkInLocation ?? row.checkOutLocation,
      })),
    comparison: {
      branchAverage: buildComparison(params.branchRows ?? [], params.branchEmployees, params.range),
      companyAverage: buildComparison(params.companyRows ?? [], params.companyEmployees, params.range),
    },
    score: buildScore(summary),
  };
}
