import assert from 'node:assert/strict';
import test from 'node:test';
import jsPDF from 'jspdf';

import {
  createAttendancePdfDocument,
  getAttendancePdfSummary,
} from '../src/lib/pdfExport';
import type { AttendanceRecord } from '../src/types';

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: overrides.id ?? 'attendance-1',
    user_id: overrides.user_id ?? 'employee-1',
    date: overrides.date ?? '2026-05-19',
    check_in_time: overrides.check_in_time ?? '2026-05-19T06:05:00.000Z',
    check_out_time: overrides.check_out_time ?? '2026-05-19T14:30:00.000Z',
    ip_address: overrides.ip_address ?? '10.0.0.10',
    check_out_ip: overrides.check_out_ip ?? '10.0.0.10',
    check_in_location: overrides.check_in_location ?? 'Cairo Branch',
    check_out_location: overrides.check_out_location ?? 'Cairo Branch',
    status: overrides.status ?? 'late',
    late_minutes: overrides.late_minutes ?? 5,
    early_departure_minutes: overrides.early_departure_minutes ?? 0,
    overtime_minutes: overrides.overtime_minutes ?? 30,
    created_at: overrides.created_at ?? '2026-05-19T06:05:00.000Z',
    profiles: {
      id: overrides.profiles?.id ?? 'employee-1',
      email: overrides.profiles?.email ?? 'employee@example.com',
      full_name: overrides.profiles?.full_name ?? 'Mona Hassan',
      role: overrides.profiles?.role ?? 'employee',
      branch: overrides.profiles?.branch ?? 'Cairo Branch',
      job_title: overrides.profiles?.job_title ?? 'Travel Consultant',
      shift_start: overrides.profiles?.shift_start ?? '09:00',
      shift_end: overrides.profiles?.shift_end ?? '17:00',
      off_day: overrides.profiles?.off_day ?? null,
      overtime_enabled: overrides.profiles?.overtime_enabled ?? true,
      created_at: overrides.profiles?.created_at ?? '2026-01-01T00:00:00.000Z',
      updated_at: overrides.profiles?.updated_at ?? '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function pdfBytes(records: AttendanceRecord[]) {
  const pdf = createAttendancePdfDocument(records, {
    dateFilter: '2026-05-19',
    generatedAt: new Date('2026-05-19T10:30:00.000Z'),
    generatedBy: 'Admin User',
  });

  return Buffer.from(pdf.output('arraybuffer'));
}

test('attendance PDF uses compact real PDF content for a one-record English report', () => {
  const bytes = pdfBytes([record()]);
  const content = bytes.toString('latin1');

  assert.ok(bytes.byteLength < 1_000_000);
  assert.match(content, /\/Type \/Page/);
  assert.doesNotMatch(content, /\/Subtype \/Image/);
});

test('attendance PDF paginates many records without raster image pages', () => {
  const records = Array.from({ length: 80 }, (_, index) =>
    record({
      id: `attendance-${index + 1}`,
      user_id: `employee-${index + 1}`,
      profiles: {
        ...record().profiles!,
        full_name: `Employee ${index + 1}`,
      },
      status: index % 5 === 0 ? 'missing_checkout' : index % 3 === 0 ? 'late' : 'present',
      check_out_time: index % 5 === 0 ? null : '2026-05-19T14:30:00.000Z',
      overtime_minutes: index % 4 === 0 ? 45 : 0,
    })
  );

  const bytes = pdfBytes(records);
  const content = bytes.toString('latin1');
  const pageCount = (content.match(/\/Type \/Page\b/g) ?? []).length;

  assert.ok(pageCount > 1);
  assert.doesNotMatch(content, /\/Subtype \/Image/);
});

test('attendance PDF summary counts statuses and overtime from existing record values', () => {
  const summary = getAttendancePdfSummary([
    record({ status: 'present', late_minutes: 0, overtime_minutes: 0 }),
    record({ status: 'late', late_minutes: 15, overtime_minutes: 0 }),
    record({ status: 'absent', check_in_time: null, check_out_time: null, overtime_minutes: 0 }),
    record({ status: 'missing_checkout', check_out_time: null, overtime_minutes: 0 }),
    record({ status: 'present', overtime_minutes: 25 }),
  ]);

  assert.deepEqual(summary, {
    totalRecords: 5,
    present: 2,
    absent: 1,
    late: 1,
    earlyLeave: 0,
    missingCheckout: 1,
    overtime: 1,
  });
});

test('attendance PDF can render Arabic names while staying under the small-report target', () => {
  const bytes = pdfBytes([
    record({
      profiles: {
        ...record().profiles!,
        full_name: 'أحمد علي',
        branch: 'فرع القاهرة',
      },
      check_in_location: 'فرع القاهرة',
      check_out_location: 'فرع القاهرة',
    }),
  ]);

  assert.ok(bytes.byteLength < 1_000_000);
});

test('attendance PDF embeds an Arabic-capable font for direct jsPDF exports', () => {
  const pdf = createAttendancePdfDocument(
    [
      record({
        profiles: {
          ...record().profiles!,
          full_name: 'أحمد علي',
          branch: 'فرع القاهرة',
        },
        check_in_location: 'فرع القاهرة',
        check_out_location: 'فرع القاهرة',
      }),
    ],
    {
      branchName: 'فرع القاهرة',
      dateFilter: '2026-05-19',
      generatedAt: new Date('2026-05-19T10:30:00.000Z'),
    }
  );

  const content = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
  const pages = (pdf.internal as unknown as { pages: string[][] }).pages.flat().join('\n');

  assert.match(content, /\/Identity-H/);
  assert.match(content, /\/ToUnicode/);
  assert.doesNotMatch(pages, /þ/);
});

test('attendance PDF header includes selected employee and branch filters', () => {
  const pdf = createAttendancePdfDocument([record()], {
    employeeName: 'Ahmed Ali',
    branchName: 'Cairo Branch',
    dateRangeLabel: 'Full history',
    generatedAt: new Date('2026-05-19T10:30:00.000Z'),
    generatedBy: 'Admin User',
  });
  const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
  const drawnText = pages.flat().join('\n');

  assert.match(drawnText, /Attendance Report - Ahmed Ali/);
  assert.match(drawnText, /Employee: Ahmed Ali/);
  assert.ok(drawnText.includes('Branch:') || drawnText.includes('\x00B\x00r\x00a\x00n\x00c\x00h\x00:'));
  assert.match(drawnText, /Date Range: Full history/);
  assert.match(drawnText, /Generated By: Admin User/);
});

test('attendance PDF drawing uses formal ledger report styling and status badges', () => {
  type DrawingCall = { method: string; args: unknown[] };
  const calls: DrawingCall[] = [];
  const api = jsPDF.API as unknown as Record<string, (...args: unknown[]) => unknown>;
  const methods = ['setFillColor', 'setTextColor', 'setDrawColor', 'rect', 'roundedRect'];
  const originals = new Map<string, (...args: unknown[]) => unknown>();

  for (const method of methods) {
    originals.set(method, api[method]);
    api[method] = function patched(this: unknown, ...args: unknown[]) {
      calls.push({ method, args });
      return originals.get(method)?.apply(this, args);
    };
  }

  try {
    createAttendancePdfDocument(
      [
        record({ status: 'present', late_minutes: 0, overtime_minutes: 0 }),
        record({ status: 'absent', check_in_time: null, check_out_time: null, overtime_minutes: 0 }),
      ],
      {
        dateFilter: '2026-05-19',
        generatedAt: new Date('2026-05-19T10:30:00.000Z'),
      }
    );
  } finally {
    for (const [method, original] of originals) {
      api[method] = original;
    }
  }

  assert.ok(
    calls.some((call) => call.method === 'setFillColor' && call.args.join(',') === '246,242,229'),
    'warm ledger canvas should be used as a page fill'
  );
  assert.ok(
    calls.some((call) => call.method === 'setFillColor' && call.args.join(',') === '48,119,90'),
    'operations green should be used as the restrained brand accent'
  );
  assert.ok(
    calls.some((call) => call.method === 'rect' && call.args[0] === 8 && call.args[1] === 30 && call.args[3] === 0.6),
    'header should draw a thin ledger rule under report metadata'
  );
  assert.ok(
    calls.some((call) => call.method === 'setFillColor' && call.args.join(',') === '242,237,220'),
    'table headers should use a warm paper fill'
  );
  assert.ok(
    calls.some((call) => call.method === 'roundedRect'),
    'header/cards/statuses should use rounded rectangles'
  );
  assert.ok(
    calls.some((call) => call.method === 'setFillColor' && call.args.join(',') === '220,242,226'),
    'present status should draw a muted ledger green badge background'
  );
  assert.ok(
    calls.some((call) => call.method === 'setFillColor' && call.args.join(',') === '244,217,210'),
    'absent status should draw a muted ledger red badge background'
  );
});
