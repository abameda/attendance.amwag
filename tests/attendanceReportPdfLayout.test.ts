import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAttendancePdfFooterTextsForTest,
  getAttendancePdfHeaderCellStyleForTest,
  getAttendancePdfMetadataValueStyleForTest,
  getAttendancePdfPagesForTest,
  getAttendancePdfReportBannerTextsForTest,
  getAttendancePdfRowStyleForTest,
} from '../src/components/pdf/AttendanceReportPdf';
import { buildAttendanceReportData, buildPdfFilename } from '../src/lib/attendance-report';
import type { AttendanceReportData } from '../src/lib/attendance-report';
import type { AttendanceRecord } from '../src/types';

function reportData(rowCount: number): AttendanceReportData {
  return {
    filters: { dateFilter: '2026-05-22' },
    meta: {
      generatedBy: 'Abdelhmeed Mohsen Elshorbagy',
      generatedAt: 'May 23, 2026, 12:42 AM',
      reportId: 'AMW-20260523-004200',
    },
    summary: {
      totalRecords: rowCount,
      present: rowCount,
      absent: 0,
      late: 0,
      earlyLeave: 0,
      missingCheckout: 0,
      overtime: 0,
      pending: 0,
    },
    notes: {
      pendingCount: 0,
      missingCheckoutCount: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
    },
    rows: Array.from({ length: rowCount }, (_, index) => ({
      index: index + 1,
      employeeName: `Employee ${index + 1}`,
      branch: 'Cairo Branch',
      date: '2026-05-22',
      shift: '09:00 - 17:00',
      checkIn: '09:00 AM',
      checkOut: '05:00 PM',
      late: '-',
      earlyLeave: '-',
      overtime: '-',
      status: 'present',
      location: 'Cairo Branch',
    })),
  };
}

function attendanceRecordWithShift(): AttendanceRecord {
  return {
    id: 'attendance-1',
    user_id: 'employee-1',
    date: '2026-05-22',
    check_in_time: null,
    check_out_time: null,
    ip_address: null,
    check_out_ip: null,
    check_in_location: null,
    check_out_location: null,
    status: 'present',
    late_minutes: 0,
    early_departure_minutes: 0,
    overtime_minutes: 0,
    created_at: '2026-05-22T00:00:00.000Z',
    profiles: {
      id: 'employee-1',
      email: 'employee@example.com',
      full_name: 'Employee One',
      role: 'employee',
      branch: 'Cairo Branch',
      job_title: null,
      shift_start: '09:00:00',
      shift_end: '17:00:00',
      off_day: null,
      overtime_enabled: false,
      created_at: '2026-05-22T00:00:00.000Z',
      updated_at: '2026-05-22T00:00:00.000Z',
    },
  };
}

test('attendance PDF starts table rows on page 1 after compact report metadata', () => {
  const pages = getAttendancePdfPagesForTest(reportData(12));

  assert.equal(pages.length, 1);
  assert.equal(pages[0].isFirstPage, true);
  assert.equal(pages[0].rows[0]?.index, 1);
  assert.ok(pages[0].rows.length > 0);
});

test('attendance PDF stripes full rows, not individual columns', () => {
  const firstRowCells = Array.from({ length: 12 }, (_, columnIndex) =>
    getAttendancePdfRowStyleForTest(0, columnIndex).backgroundColor
  );
  const secondRowCells = Array.from({ length: 12 }, (_, columnIndex) =>
    getAttendancePdfRowStyleForTest(1, columnIndex).backgroundColor
  );

  assert.equal(new Set(firstRowCells).size, 1);
  assert.equal(new Set(secondRowCells).size, 1);
  assert.notEqual(firstRowCells[0], secondRowCells[0]);
});

test('attendance PDF header separators are neutral instead of green or white accent dividers', () => {
  const first = getAttendancePdfHeaderCellStyleForTest(0, 18);
  const second = getAttendancePdfHeaderCellStyleForTest(1, 128);

  assert.equal(first.borderLeftColor, '#D4DEE7');
  assert.equal(first.borderRightColor, '#D4DEE7');
  assert.equal(second.borderRightColor, '#D4DEE7');
});

test('attendance PDF footer uses left center right print labels', () => {
  assert.deepEqual(getAttendancePdfFooterTextsForTest(1, 2), [
    'Amwag Travel Attendance System',
    'Powered by Abdelhmeed Elshorbagy',
    'Page 1 of 2',
  ]);
});

test('attendance PDF report banner omits the selected period text', () => {
  assert.deepEqual(getAttendancePdfReportBannerTextsForTest(reportData(1)), [
    'Amwag Travel — Attendance Daily Report',
  ]);
});

test('Arabic attendance PDF uses Arabic report banner text', () => {
  assert.deepEqual(getAttendancePdfReportBannerTextsForTest(reportData(1), 'ar'), [
    'أمواج للسياحة - تقرير الحضور اليومي',
  ]);
});

test('Arabic attendance PDF uses Arabic footer print labels', () => {
  assert.deepEqual(getAttendancePdfFooterTextsForTest(1, 2, 'ar'), [
    'نظام حضور أمواج للسياحة',
    'تم الإنشاء بواسطة عبدالحميد الشوربجي',
    'صفحة 1 من 2',
  ]);
});

test('Arabic attendance PDF filename is distinct from English export filename', () => {
  assert.equal(
    buildPdfFilename({ dateFilter: '2026-05-22' }, 'ar'),
    'Amwag_Attendance_Report_AR_2026-05-22.pdf',
  );
});

test('Arabic attendance PDF filename falls back when Arabic labels are not filesystem-safe', () => {
  assert.equal(
    buildPdfFilename({ dateRangeLabel: 'كل السجل' }, 'ar'),
    'Amwag_Attendance_Report_AR_all-history.pdf',
  );
});

test('attendance PDF shift values use locale-aware 12-hour time formatting', () => {
  const record = attendanceRecordWithShift();

  assert.equal(
    buildAttendanceReportData([record], {}, 'Admin', 'en').rows[0]?.shift,
    '09:00 AM - 05:00 PM',
  );
  assert.equal(
    buildAttendanceReportData([record], {}, 'Admin', 'ar').rows[0]?.shift,
    '٠٩:٠٠ ص - ٠٥:٠٠ م',
  );
});

test('attendance PDF metadata renders Arabic period values with the Arabic font', () => {
  const style = getAttendancePdfMetadataValueStyleForTest(
    '\u0643\u0644 \u0627\u0644\u0633\u062c\u0644',
  ) as { fontFamily?: string };

  assert.equal(
    style.fontFamily,
    'Amiri',
  );
});
