import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBranchHealthRows,
  buildDashboardOperations,
  buildExceptionGroups,
  normalizeDashboardPeriod,
} from '../src/lib/adminDashboardOperations';
import type { DashboardSummary } from '../src/types';

const summary: DashboardSummary = {
  date: '2026-05-20',
  periodType: 'day',
  expectedEmployees: 20,
  presentCount: 10,
  onTimeCount: 10,
  lateCount: 3,
  absentCount: 4,
  missingCheckoutCount: 2,
  earlyLeaveCount: 1,
  overtimeCount: 2,
  attendanceRate: 75,
  departureCompletionRate: 86.67,
  topBranch: { name: 'Alexandria', attendanceRate: 100 },
  employeeSummaries: [
    {
      user_id: 'e1',
      full_name: 'Late One',
      branch: 'Cairo',
      expected_days: 1,
      attended_days: 1,
      present_days: 0,
      late_days: 1,
      absent_days: 0,
      missing_checkout_days: 0,
      early_leave_days: 0,
      overtime_days: 0,
    },
    {
      user_id: 'e2',
      full_name: 'Missing One',
      branch: 'Giza',
      expected_days: 1,
      attended_days: 1,
      present_days: 0,
      late_days: 0,
      absent_days: 0,
      missing_checkout_days: 1,
      early_leave_days: 0,
      overtime_days: 0,
    },
    {
      user_id: 'e3',
      full_name: 'Absent One',
      branch: 'Cairo',
      expected_days: 1,
      attended_days: 0,
      present_days: 0,
      late_days: 0,
      absent_days: 1,
      missing_checkout_days: 0,
      early_leave_days: 0,
      overtime_days: 0,
    },
    {
      user_id: 'e4',
      full_name: 'Early One',
      branch: 'Alexandria',
      expected_days: 1,
      attended_days: 1,
      present_days: 1,
      late_days: 0,
      absent_days: 0,
      missing_checkout_days: 0,
      early_leave_days: 1,
      overtime_days: 0,
    },
  ],
  branchSummaries: [
    {
      branch: 'Alexandria',
      expected_days: 5,
      attended_days: 5,
      present_days: 5,
      late_days: 0,
      absent_days: 0,
      missing_checkout_days: 0,
      early_leave_days: 1,
      overtime_days: 0,
      attendance_rate: 100,
    },
    {
      branch: 'Cairo',
      expected_days: 10,
      attended_days: 6,
      present_days: 5,
      late_days: 1,
      absent_days: 4,
      missing_checkout_days: 0,
      early_leave_days: 0,
      overtime_days: 1,
      attendance_rate: 60,
    },
    {
      branch: 'Giza',
      expected_days: 5,
      attended_days: 4,
      present_days: 3,
      late_days: 0,
      absent_days: 1,
      missing_checkout_days: 1,
      early_leave_days: 0,
      overtime_days: 1,
      attendance_rate: 80,
    },
  ],
};

test('dashboard operations exposes attendance rate with raw counts', () => {
  assert.deepEqual(buildDashboardOperations(summary), {
    checkedInCount: 15,
    expectedEmployees: 20,
    attendanceRate: 75,
    needsActionCount: 10,
  });
});

test('exception groups include actionable employee samples by severity', () => {
  assert.deepEqual(buildExceptionGroups(summary), [
    {
      key: 'absent',
      count: 4,
      employees: [{ name: 'Absent One', branch: 'Cairo' }],
    },
    {
      key: 'late',
      count: 3,
      employees: [{ name: 'Late One', branch: 'Cairo' }],
    },
    {
      key: 'missing_checkout',
      count: 2,
      employees: [{ name: 'Missing One', branch: 'Giza' }],
    },
    {
      key: 'early_leave',
      count: 1,
      employees: [{ name: 'Early One', branch: 'Alexandria' }],
    },
  ]);
});

test('branch health rows sort branches needing attention before healthy branches', () => {
  assert.deepEqual(buildBranchHealthRows(summary), [
    {
      branch: 'Cairo',
      expected: 10,
      present: 6,
      attendanceRate: 60,
      late: 1,
      missingCheckout: 0,
      status: 'needs_attention',
    },
    {
      branch: 'Giza',
      expected: 5,
      present: 4,
      attendanceRate: 80,
      late: 0,
      missingCheckout: 1,
      status: 'watch',
    },
    {
      branch: 'Alexandria',
      expected: 5,
      present: 5,
      attendanceRate: 100,
      late: 0,
      missingCheckout: 0,
      status: 'on_track',
    },
  ]);
});

test('dashboard period uses a valid selected day and keeps month in sync', () => {
  assert.deepEqual(
    normalizeDashboardPeriod({
      selectedDate: '2026-05-18',
      selectedMonth: '2026-04',
      fallbackDate: '2026-05-20',
    }),
    {
      selectedDate: '2026-05-18',
      selectedMonth: '2026-05',
      isDayView: true,
      queryString: 'date=2026-05-18',
    }
  );
});

test('dashboard period falls back to the current month when both inputs are cleared', () => {
  assert.deepEqual(
    normalizeDashboardPeriod({
      selectedDate: '',
      selectedMonth: '',
      fallbackDate: '2026-05-20',
    }),
    {
      selectedDate: '',
      selectedMonth: '2026-05',
      isDayView: false,
      queryString: 'month=2026-05',
    }
  );
});

test('dashboard operations clamps invalid summary numbers before they reach the UI', () => {
  assert.deepEqual(
    buildDashboardOperations({
      ...summary,
      expectedEmployees: -4,
      presentCount: Number.NaN,
      lateCount: 150.8,
      absentCount: -1,
      missingCheckoutCount: Number.POSITIVE_INFINITY,
      earlyLeaveCount: 2.9,
      attendanceRate: 130.4,
    }),
    {
      checkedInCount: 150,
      expectedEmployees: 0,
      attendanceRate: 100,
      needsActionCount: 152,
    }
  );
});
