import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMissingCheckoutUpdate,
  calculateAttendanceWorkDate,
  calculateCheckoutMetrics,
  calculateLateMinutes,
  isCheckoutWindowExpired,
  selectCurrentEmployeeAttendanceRecord,
} from '../src/lib/attendanceCalculations';
import {
  buildMonthlyAttendanceSummary,
  type SummaryAttendanceRow,
  type SummaryEmployee,
} from '../src/lib/attendanceSummary';
import { getEgyptTime } from '../src/lib/timezone';

test('normal check-in and check-out at shift end has no late, early leave, or overtime', () => {
  assert.equal(
    calculateLateMinutes({
      currentTotalMinutes: 9 * 60,
      shiftStart: '09:00',
      lateGraceMinutes: 0,
    }),
    0
  );

  assert.deepEqual(
    calculateCheckoutMetrics({
      workDate: '2026-07-01',
      checkInTime: new Date('2026-07-01T06:00:00.000Z'),
      checkOutTime: new Date('2026-07-01T14:00:00.000Z'),
      shiftStart: '09:00',
      shiftEnd: '17:00',
      overtimeEnabled: true,
      maxOvertimeMinutes: 180,
    }),
    { earlyDepartureMinutes: 0, overtimeMinutes: 0, workedMinutes: 480 }
  );
});

test('late check-in uses the employee branch shift start and grace period', () => {
  assert.equal(
    calculateLateMinutes({
      currentTotalMinutes: 9 * 60 + 25,
      shiftStart: '09:00',
      lateGraceMinutes: 10,
    }),
    25
  );
});

test('early checkout records minutes before configured shift end', () => {
  assert.deepEqual(
    calculateCheckoutMetrics({
      workDate: '2026-07-01',
      checkInTime: new Date('2026-07-01T06:00:00.000Z'),
      checkOutTime: new Date('2026-07-01T13:30:00.000Z'),
      shiftStart: '09:00',
      shiftEnd: '17:00',
      overtimeEnabled: true,
      maxOvertimeMinutes: 180,
    }),
    { earlyDepartureMinutes: 30, overtimeMinutes: 0, workedMinutes: 450 }
  );
});

test('missing checkout status does not auto-fill a fake checkout time', () => {
  assert.deepEqual(buildMissingCheckoutUpdate(), {
    status: 'missing_checkout',
    checkOutTime: null,
  });
});

test('checkout window expires after the configured grace period, not max overtime', () => {
  assert.equal(
    isCheckoutWindowExpired({
      workDate: '2026-07-01',
      now: new Date('2026-07-01T15:01:00.000Z'),
      shiftStart: '09:00',
      shiftEnd: '17:00',
      checkoutWindowMinutes: 60,
    }),
    true
  );
});

test('overnight check-in after midnight belongs to the previous work date', () => {
  assert.equal(
    calculateAttendanceWorkDate({
      currentDate: '2026-07-02',
      currentTotalMinutes: 30,
      shiftStart: '22:00',
      shiftEnd: '06:00',
    }),
    '2026-07-01'
  );
});

test('overnight checkout calculates overtime against Cairo shift end', () => {
  assert.deepEqual(
    calculateCheckoutMetrics({
      workDate: '2026-07-01',
      checkInTime: new Date('2026-07-01T19:00:00.000Z'),
      checkOutTime: new Date('2026-07-02T03:15:00.000Z'),
      shiftStart: '22:00',
      shiftEnd: '06:00',
      overtimeEnabled: true,
      maxOvertimeMinutes: 180,
    }),
    { earlyDepartureMinutes: 0, overtimeMinutes: 15, workedMinutes: 495 }
  );
});

test('checkout before check-in produces no worked minutes', () => {
  assert.deepEqual(
    calculateCheckoutMetrics({
      workDate: '2026-07-01',
      checkInTime: new Date('2026-07-01T14:30:00.000Z'),
      checkOutTime: new Date('2026-07-01T13:30:00.000Z'),
      shiftStart: '09:00',
      shiftEnd: '17:00',
      overtimeEnabled: true,
      maxOvertimeMinutes: 180,
    }),
    { earlyDepartureMinutes: 30, overtimeMinutes: 0, workedMinutes: 0 }
  );
});

test('Cairo midnight is normalized to hour zero', () => {
  assert.deepEqual(getEgyptTime(new Date('2026-07-01T21:30:00.000Z')), {
    hours: 0,
    minutes: 30,
    totalMinutes: 30,
  });
});

test('monthly dashboard counts raw employee-days with employee and branch detail', () => {
  const employees: SummaryEmployee[] = [
    { id: 'e1', fullName: 'A', branch: 'Cairo', offDay: null },
    { id: 'e2', fullName: 'B', branch: 'Cairo', offDay: null },
  ];
  const attendanceRows: SummaryAttendanceRow[] = [
    { userId: 'e1', status: 'present', date: new Date('2026-05-01T00:00:00.000Z') },
    { userId: 'e1', status: 'late', date: new Date('2026-05-02T00:00:00.000Z') },
    { userId: 'e2', status: 'missing_checkout', date: new Date('2026-05-01T00:00:00.000Z') },
  ];

  const summary = buildMonthlyAttendanceSummary({
    month: '2026-05',
    employees,
    attendanceRows,
    dates: ['2026-05-01', '2026-05-02'],
  });

  assert.equal(summary.expectedEmployees, 4);
  assert.equal(summary.presentCount, 1);
  assert.equal(summary.lateCount, 1);
  assert.equal(summary.missingCheckoutCount, 1);
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.attendanceRate, 75);
  assert.deepEqual(summary.employeeSummaries, [
    {
      user_id: 'e1',
      full_name: 'A',
      branch: 'Cairo',
      expected_days: 2,
      attended_days: 2,
      present_days: 1,
      late_days: 1,
      absent_days: 0,
      missing_checkout_days: 0,
    },
    {
      user_id: 'e2',
      full_name: 'B',
      branch: 'Cairo',
      expected_days: 2,
      attended_days: 1,
      present_days: 0,
      late_days: 0,
      absent_days: 1,
      missing_checkout_days: 1,
    },
  ]);
  assert.deepEqual(summary.branchSummaries, [
    {
      branch: 'Cairo',
      expected_days: 4,
      attended_days: 3,
      present_days: 1,
      late_days: 1,
      absent_days: 1,
      missing_checkout_days: 1,
      attendance_rate: 75,
    },
  ]);
});

test('employee portal selects an open overnight record from the previous work date', () => {
  const records = [
    {
      id: 'overnight',
      date: '2026-07-01',
      check_in_time: '2026-07-01T19:30:00.000Z',
      check_out_time: null,
      status: 'late',
    },
  ];

  assert.equal(selectCurrentEmployeeAttendanceRecord(records, '2026-07-02')?.id, 'overnight');
});
