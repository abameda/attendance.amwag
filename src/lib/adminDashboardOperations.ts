import type { DashboardBranchAttendanceSummary, DashboardEmployeeAttendanceSummary, DashboardSummary } from '@/types';
import { isValidISODateString, isValidISOMonthString } from '@/lib/timezone';

export type DashboardExceptionKey = 'absent' | 'late' | 'missing_checkout' | 'early_leave';
export type BranchHealthStatus = 'needs_attention' | 'watch' | 'on_track';

export type DashboardOperations = {
  checkedInCount: number;
  expectedEmployees: number;
  attendanceRate: number;
  needsActionCount: number;
};

export type DashboardPeriodInput = {
  selectedDate: string;
  selectedMonth: string;
  fallbackDate: string;
};

export type DashboardPeriodSelection = {
  selectedDate: string;
  selectedMonth: string;
  isDayView: boolean;
  queryString: string;
};

export type DashboardExceptionGroup = {
  key: DashboardExceptionKey;
  count: number;
  employees: Array<{
    name: string;
    branch: string;
  }>;
};

export type BranchHealthRow = {
  branch: string;
  expected: number;
  present: number;
  attendanceRate: number;
  late: number;
  missingCheckout: number;
  status: BranchHealthStatus;
};

function attendedCount(summary: DashboardSummary | DashboardBranchAttendanceSummary): number {
  if ('attended_days' in summary) {
    return safeCount(summary.attended_days);
  }

  return safeCount(summary.presentCount) + safeCount(summary.lateCount) + safeCount(summary.missingCheckoutCount);
}

function employeeHasException(employee: DashboardEmployeeAttendanceSummary, key: DashboardExceptionKey): boolean {
  if (key === 'absent') return employee.absent_days > 0;
  if (key === 'late') return employee.late_days > 0;
  if (key === 'missing_checkout') return employee.missing_checkout_days > 0;
  return (employee.early_leave_days ?? 0) > 0;
}

function exceptionCount(summary: DashboardSummary, key: DashboardExceptionKey): number {
  if (key === 'absent') return safeCount(summary.absentCount);
  if (key === 'late') return safeCount(summary.lateCount);
  if (key === 'missing_checkout') return safeCount(summary.missingCheckoutCount);
  return safeCount(summary.earlyLeaveCount ?? 0);
}

function branchStatus(branch: DashboardBranchAttendanceSummary): BranchHealthStatus {
  const attendanceRate = safePercent(branch.attendance_rate);

  if (attendanceRate < 80) {
    return 'needs_attention';
  }

  if (attendanceRate < 95 || safeCount(branch.late_days) > 0 || safeCount(branch.missing_checkout_days) > 0) {
    return 'watch';
  }

  return 'on_track';
}

function statusPriority(status: BranchHealthStatus): number {
  if (status === 'needs_attention') return 0;
  if (status === 'watch') return 1;
  return 2;
}

function safeCount(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function safePercent(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

export function normalizeDashboardPeriod({
  selectedDate,
  selectedMonth,
  fallbackDate,
}: DashboardPeriodInput): DashboardPeriodSelection {
  const fallbackMonth = isValidISODateString(fallbackDate) ? fallbackDate.slice(0, 7) : '';
  const cleanDate = selectedDate.trim();
  const cleanMonth = selectedMonth.trim();

  if (isValidISODateString(cleanDate)) {
    return {
      selectedDate: cleanDate,
      selectedMonth: cleanDate.slice(0, 7),
      isDayView: true,
      queryString: `date=${encodeURIComponent(cleanDate)}`,
    };
  }

  if (isValidISOMonthString(cleanMonth)) {
    return {
      selectedDate: '',
      selectedMonth: cleanMonth,
      isDayView: false,
      queryString: `month=${encodeURIComponent(cleanMonth)}`,
    };
  }

  return {
    selectedDate: '',
    selectedMonth: fallbackMonth,
    isDayView: false,
    queryString: fallbackMonth ? `month=${encodeURIComponent(fallbackMonth)}` : '',
  };
}

export function buildDashboardOperations(summary: DashboardSummary): DashboardOperations {
  const checkedInCount = attendedCount(summary);

  return {
    checkedInCount,
    expectedEmployees: safeCount(summary.expectedEmployees),
    attendanceRate: safePercent(summary.attendanceRate),
    needsActionCount:
      safeCount(summary.absentCount) +
      safeCount(summary.lateCount) +
      safeCount(summary.missingCheckoutCount) +
      safeCount(summary.earlyLeaveCount ?? 0),
  };
}

export function buildExceptionGroups(summary: DashboardSummary): DashboardExceptionGroup[] {
  const employees = summary.employeeSummaries ?? [];
  const keys: DashboardExceptionKey[] = ['absent', 'late', 'missing_checkout', 'early_leave'];

  return keys
    .map((key) => ({
      key,
      count: exceptionCount(summary, key),
      employees: employees
        .filter((employee) => employeeHasException(employee, key))
        .slice(0, 3)
        .map((employee) => ({
          name: employee.full_name || employee.user_id,
          branch: employee.branch,
        })),
    }))
    .filter((group) => group.count > 0);
}

export function buildBranchHealthRows(summary: DashboardSummary): BranchHealthRow[] {
  return (summary.branchSummaries ?? [])
    .map((branch) => {
      const status = branchStatus(branch);

      return {
        branch: branch.branch.trim() || 'Unassigned',
        expected: safeCount(branch.expected_days),
        present: attendedCount(branch),
        attendanceRate: safePercent(branch.attendance_rate),
        late: safeCount(branch.late_days),
        missingCheckout: safeCount(branch.missing_checkout_days),
        status,
      };
    })
    .sort((left, right) => {
      const priorityDiff = statusPriority(left.status) - statusPriority(right.status);
      if (priorityDiff !== 0) return priorityDiff;

      const rateDiff = left.attendanceRate - right.attendanceRate;
      if (rateDiff !== 0) return rateDiff;

      const missingDiff = right.missingCheckout - left.missingCheckout;
      if (missingDiff !== 0) return missingDiff;

      return right.late - left.late;
    });
}
