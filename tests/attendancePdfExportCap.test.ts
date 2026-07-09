import assert from 'node:assert/strict';
import test from 'node:test';

import { createAttendancePdfExportHandler } from '../src/app/api/admin/attendance/export-pdf/handler';
import type { AttendanceReportData } from '../src/lib/attendance-report';
import type { AttendanceRecord } from '../src/types';

const CAP_MESSAGE = 'Please narrow your date range or filter by employee';

function request(body: unknown) {
  return new Request('http://localhost/api/admin/attendance/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function attendanceRecord(index: number, overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `attendance-${index}`,
    user_id: `employee-${index}`,
    date: '2026-06-01',
    check_in_time: '2026-06-01T06:00:00.000Z',
    check_out_time: '2026-06-01T14:00:00.000Z',
    ip_address: null,
    check_out_ip: null,
    check_in_location: 'HQ',
    check_out_location: 'HQ',
    status: 'present',
    late_minutes: 0,
    early_departure_minutes: 0,
    overtime_minutes: 0,
    created_at: '2026-06-01T06:00:00.000Z',
    profiles: {
      id: `employee-${index}`,
      email: `employee-${index}@example.com`,
      full_name: `Employee ${index}`,
      role: 'employee',
      branch: 'HQ',
      branch_id: 'branch-hq',
      job_title: null,
      shift_start: '09:00',
      shift_end: '17:00',
      off_day: null,
      overtime_enabled: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function createTestHandler() {
  let renderCalls = 0;
  let renderedRows = 0;
  const post = createAttendancePdfExportHandler({
    isAdminOrAccountant: async () => ({ authorized: true, userId: 'admin-1', role: 'admin' }),
    getCurrentUser: async () => ({ fullName: 'Admin User', email: 'admin@example.com' }),
    renderPdf: async (data: AttendanceReportData) => {
      renderCalls += 1;
      renderedRows = data.rows.length;
      return Buffer.from('%PDF-test');
    },
  });

  return {
    post,
    get renderCalls() {
      return renderCalls;
    },
    get renderedRows() {
      return renderedRows;
    },
  };
}

test('attendance PDF export rejects more than 2,000 rows before rendering when not filtered to one employee', async () => {
  const handler = createTestHandler();
  const records = Array.from({ length: 2001 }, (_, index) => attendanceRecord(index + 1));

  const response = await handler.post(request({ records, filters: { dateRangeLabel: '2026-06-01 to 2026-06-01' } }));
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.success, false);
  assert.equal(body.error, CAP_MESSAGE);
  assert.equal(handler.renderCalls, 0);
});

test('attendance PDF export rejects ranges longer than 31 days before rendering when not filtered to one employee', async () => {
  const handler = createTestHandler();
  const records = [
    attendanceRecord(1, { date: '2026-06-01' }),
    attendanceRecord(2, { date: '2026-07-02' }),
  ];

  const response = await handler.post(request({ records, filters: { dateRangeLabel: '2026-06-01 to 2026-07-02' } }));
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.success, false);
  assert.equal(body.error, CAP_MESSAGE);
  assert.equal(handler.renderCalls, 0);
});

test('attendance PDF export allows the larger bounded single-employee export', async () => {
  const handler = createTestHandler();
  const records = Array.from({ length: 2001 }, (_, index) =>
    attendanceRecord(index + 1, {
      user_id: 'employee-1',
      date: index === 2000 ? '2026-07-02' : '2026-06-01',
    })
  );

  const response = await handler.post(request({ records, filters: { employeeName: 'Employee 1' } }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(handler.renderCalls, 1);
  assert.equal(handler.renderedRows, 2001);
});

test('attendance PDF export caps single-employee reports before rendering', async () => {
  const handler = createTestHandler();
  const records = Array.from({ length: 5001 }, (_, index) =>
    attendanceRecord(index + 1, { user_id: 'employee-1' })
  );

  const response = await handler.post(request({ records, filters: { employeeName: 'Employee 1' } }));

  assert.equal(response.status, 413);
  assert.equal(handler.renderCalls, 0);
});
