import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEmployeeAttendanceAnalytics,
  resolveAnalyticsDateRange,
  type AnalyticsAttendanceRow,
  type AnalyticsEmployee,
} from '../src/lib/employeeAttendanceAnalytics';

const employee: AnalyticsEmployee = {
  id: 'employee-1',
  email: 'arabic@example.com',
  fullName: 'أحمد علي',
  branch: 'Cairo',
  jobTitle: 'Driver',
  shiftStart: '09:00',
  shiftEnd: '17:00',
  offDay: 'friday',
  overtimeEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function record(
  date: string,
  status: AnalyticsAttendanceRow['status'],
  overrides: Partial<AnalyticsAttendanceRow> = {}
): AnalyticsAttendanceRow {
  return {
    id: `${date}-${status}`,
    userId: 'employee-1',
    date: new Date(`${date}T00:00:00.000Z`),
    checkInTime: status === 'absent' ? null : new Date(`${date}T06:05:00.000Z`),
    checkOutTime: status === 'absent' || status === 'missing_checkout' ? null : new Date(`${date}T14:10:00.000Z`),
    ipAddress: '10.0.0.10',
    checkOutIp: '10.0.0.11',
    checkInLocation: 'Cairo',
    checkOutLocation: 'Cairo',
    status,
    lateMinutes: status === 'late' ? 35 : 0,
    earlyDepartureMinutes: 0,
    overtimeMinutes: 0,
    createdAt: new Date(`${date}T06:05:00.000Z`),
    ...overrides,
  };
}

test('resolveAnalyticsDateRange supports preset periods and custom dates', () => {
  assert.deepEqual(resolveAnalyticsDateRange({ preset: 'this_month', today: '2026-05-19' }), {
    preset: 'this_month',
    from: '2026-05-01',
    to: '2026-05-19',
  });
  assert.deepEqual(resolveAnalyticsDateRange({ preset: 'last_month', today: '2026-05-19' }), {
    preset: 'last_month',
    from: '2026-04-01',
    to: '2026-04-30',
  });
  assert.deepEqual(resolveAnalyticsDateRange({ preset: 'last_7_days', today: '2026-05-19' }), {
    preset: 'last_7_days',
    from: '2026-05-13',
    to: '2026-05-19',
  });
  assert.deepEqual(
    resolveAnalyticsDateRange({
      preset: 'custom',
      from: '2026-05-04',
      to: '2026-05-12',
      today: '2026-05-19',
    }),
    {
      preset: 'custom',
      from: '2026-05-04',
      to: '2026-05-12',
    }
  );
  assert.deepEqual(resolveAnalyticsDateRange({ preset: 'all', today: '2026-05-19' }), {
    preset: 'all',
    from: null,
    to: '2026-05-19',
  });
});

test('buildEmployeeAttendanceAnalytics calculates KPIs, trends, insights, comparison, and score', () => {
  const rows: AnalyticsAttendanceRow[] = [
    record('2026-05-03', 'late', { lateMinutes: 20 }),
    record('2026-05-04', 'late', { lateMinutes: 45, earlyDepartureMinutes: 20 }),
    record('2026-05-05', 'absent'),
    record('2026-05-06', 'missing_checkout'),
    record('2026-05-07', 'present', { overtimeMinutes: 75 }),
    record('2026-05-09', 'present', { checkInTime: new Date('2026-05-09T06:00:00.000Z'), checkOutTime: new Date('2026-05-09T14:00:00.000Z') }),
  ];

  const previousRows: AnalyticsAttendanceRow[] = [
    record('2026-04-25', 'absent'),
    record('2026-04-26', 'late', { lateMinutes: 50 }),
    record('2026-04-27', 'late', { lateMinutes: 30 }),
    record('2026-04-28', 'missing_checkout'),
  ];

  const analytics = buildEmployeeAttendanceAnalytics({
    employee,
    rows,
    previousRows,
    range: { preset: 'custom', from: '2026-05-03', to: '2026-05-09' },
    branchRows: [...rows, record('2026-05-03', 'present', { userId: 'employee-2' })],
    companyRows: [...rows, record('2026-05-04', 'absent', { userId: 'employee-3' })],
    today: '2026-05-19',
  });

  assert.equal(analytics.employee.full_name, 'أحمد علي');
  assert.equal(analytics.summary.expectedWorkingDays, 6);
  assert.equal(analytics.summary.presentDays, 5);
  assert.equal(analytics.summary.absentDays, 1);
  assert.equal(analytics.summary.onTimeDays, 2);
  assert.equal(analytics.summary.lateDays, 2);
  assert.equal(analytics.summary.earlyLeaveDays, 1);
  assert.equal(analytics.summary.missingCheckoutDays, 1);
  assert.equal(analytics.summary.overtimeDays, 1);
  assert.equal(analytics.summary.attendanceRate, 83.33);
  assert.equal(analytics.summary.punctualityRate, 40);
  assert.equal(analytics.summary.departureCompletionRate, 80);
  assert.equal(analytics.summary.totalLateMinutes, 65);
  assert.equal(analytics.summary.averageLateMinutes, 32.5);
  assert.equal(analytics.summary.totalOvertimeMinutes, 75);
  assert.equal(analytics.summary.averageCheckInTime, '09:04');
  assert.equal(analytics.summary.averageCheckOutTime, '17:08');
  assert.equal(analytics.comparison.branchAverage.attendanceRate, 85.71);
  assert.equal(analytics.comparison.companyAverage.attendanceRate, 71.43);
  assert.equal(analytics.score.value, 57);
  assert.ok(analytics.insights.some((insight) => insight.code === 'frequent_late'));
  assert.ok(analytics.insights.some((insight) => insight.code === 'attendance_improved'));
  assert.equal(analytics.trends.daily.length, 6);
  assert.equal(analytics.history[0].date, '2026-05-09');
});

test('buildEmployeeAttendanceAnalytics returns clean empty states for employees with no records', () => {
  const analytics = buildEmployeeAttendanceAnalytics({
    employee: { ...employee, id: 'employee-empty' },
    rows: [],
    previousRows: [],
    range: { preset: 'custom', from: '2026-05-03', to: '2026-05-09' },
    branchRows: [],
    companyRows: [],
    today: '2026-05-19',
  });

  assert.equal(analytics.summary.expectedWorkingDays, 6);
  assert.equal(analytics.summary.presentDays, 0);
  assert.equal(analytics.summary.absentDays, 0);
  assert.equal(analytics.summary.attendanceRate, 0);
  assert.equal(analytics.score.value, 100);
  assert.deepEqual(analytics.insights, [
    {
      code: 'no_records',
      severity: 'neutral',
      title: 'No attendance records in this period.',
      detail: 'The selected range has expected working days but no recorded attendance events yet.',
    },
  ]);
  assert.deepEqual(analytics.history, []);
});
