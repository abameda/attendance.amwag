import { buildDashboardSummary } from '@/lib/utils';
import {
  getEgyptDayNameFromISODate,
} from '@/lib/timezone';
import type { AttendanceRecord, DashboardSummary } from '@/types';

export interface SummaryEmployee {
  id: string;
  fullName?: string | null;
  branch: string | null;
  offDay: string | null;
}

export interface SummaryAttendanceRow {
  userId: string;
  status: Exclude<AttendanceRecord['status'], 'pending'>;
  date: Date;
}

interface EmployeeDaySummary {
  user_id: string;
  full_name: string | null;
  branch: string;
  expected_days: number;
  attended_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  missing_checkout_days: number;
}

interface BranchDaySummary {
  branch: string;
  expected_days: number;
  attended_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  missing_checkout_days: number;
  attendance_rate: number;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function emptyEmployeeSummary(employee: SummaryEmployee): EmployeeDaySummary {
  return {
    user_id: employee.id,
    full_name: employee.fullName ?? null,
    branch: employee.branch?.trim() || 'Unassigned',
    expected_days: 0,
    attended_days: 0,
    present_days: 0,
    late_days: 0,
    absent_days: 0,
    missing_checkout_days: 0,
  };
}

function emptyBranchSummary(branch: string): BranchDaySummary {
  return {
    branch,
    expected_days: 0,
    attended_days: 0,
    present_days: 0,
    late_days: 0,
    absent_days: 0,
    missing_checkout_days: 0,
    attendance_rate: 0,
  };
}

function applyStatus(
  status: Exclude<AttendanceRecord['status'], 'pending'> | undefined,
  employeeSummary: EmployeeDaySummary,
  branchSummary: BranchDaySummary
) {
  employeeSummary.expected_days += 1;
  branchSummary.expected_days += 1;

  if (status === 'present') {
    employeeSummary.present_days += 1;
    employeeSummary.attended_days += 1;
    branchSummary.present_days += 1;
    branchSummary.attended_days += 1;
  } else if (status === 'late') {
    employeeSummary.late_days += 1;
    employeeSummary.attended_days += 1;
    branchSummary.late_days += 1;
    branchSummary.attended_days += 1;
  } else if (status === 'missing_checkout') {
    employeeSummary.missing_checkout_days += 1;
    employeeSummary.attended_days += 1;
    branchSummary.missing_checkout_days += 1;
    branchSummary.attended_days += 1;
  } else {
    employeeSummary.absent_days += 1;
    branchSummary.absent_days += 1;
  }
}

export function buildDailyAttendanceSummary(params: {
  date: string;
  employees: SummaryEmployee[];
  attendanceRows: SummaryAttendanceRow[];
}): DashboardSummary {
  return buildMonthlyAttendanceSummary({
    month: params.date,
    employees: params.employees,
    attendanceRows: params.attendanceRows,
    dates: [params.date],
  });
}

export function buildMonthlyAttendanceSummary(params: {
  month: string;
  employees: SummaryEmployee[];
  attendanceRows: SummaryAttendanceRow[];
  dates: string[];
}): DashboardSummary {
  const attendanceByKey = new Map(
    params.attendanceRows.map((record) => [`${toIsoDate(record.date)}:${record.userId}`, record.status])
  );
  const employeeSummaries = new Map<string, EmployeeDaySummary>();
  const branchSummaries = new Map<string, BranchDaySummary>();

  for (const employee of params.employees) {
    employeeSummaries.set(employee.id, emptyEmployeeSummary(employee));
  }

  for (const date of params.dates) {
    const dayOfWeek = getEgyptDayNameFromISODate(date);

    for (const employee of params.employees) {
      if (employee.offDay?.toLowerCase() === dayOfWeek) {
        continue;
      }

      const employeeSummary = employeeSummaries.get(employee.id) ?? emptyEmployeeSummary(employee);
      const branchName = employee.branch?.trim() || 'Unassigned';
      const branchSummary = branchSummaries.get(branchName) ?? emptyBranchSummary(branchName);
      const status = attendanceByKey.get(`${date}:${employee.id}`);

      applyStatus(status, employeeSummary, branchSummary);
      employeeSummaries.set(employee.id, employeeSummary);
      branchSummaries.set(branchName, branchSummary);
    }
  }

  const branchSummaryList = Array.from(branchSummaries.values()).map((summary) => ({
    ...summary,
    attendance_rate: toPercent(summary.attended_days, summary.expected_days),
  }));

  const totals = Array.from(employeeSummaries.values()).reduce(
    (acc, summary) => {
      acc.expectedEmployees += summary.expected_days;
      acc.presentCount += summary.present_days;
      acc.lateCount += summary.late_days;
      acc.absentCount += summary.absent_days;
      acc.missingCheckoutCount += summary.missing_checkout_days;
      return acc;
    },
    {
      expectedEmployees: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      missingCheckoutCount: 0,
    }
  );

  return {
    ...buildDashboardSummary({
      date: params.month,
      expectedEmployees: totals.expectedEmployees,
      presentCount: totals.presentCount,
      lateCount: totals.lateCount,
      absentCount: totals.absentCount,
      missingCheckoutCount: totals.missingCheckoutCount,
      branchMetrics: branchSummaryList.map((summary) => ({
        branch: summary.branch,
        expectedEmployees: summary.expected_days,
        presentCount: summary.present_days,
        lateCount: summary.late_days,
        missingCheckoutCount: summary.missing_checkout_days,
      })),
    }),
    employeeSummaries: Array.from(employeeSummaries.values()),
    branchSummaries: branchSummaryList,
  };
}

export function getMonthDates(month: string, maxDate?: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(year, monthIndex - 1, 1, 12));

  while (cursor.getUTCMonth() === monthIndex - 1) {
    const date = cursor.toISOString().slice(0, 10);
    if (!maxDate || date <= maxDate) {
      dates.push(date);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}
