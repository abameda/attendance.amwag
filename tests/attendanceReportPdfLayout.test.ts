import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getAttendancePdfFooterTextsForTest,
  getAttendancePdfHeaderCellStyleForTest,
  getAttendancePdfPagesForTest,
  getAttendancePdfRowStyleForTest,
} from '../src/components/pdf/AttendanceReportPdf';
import type { AttendanceReportData } from '../src/lib/attendance-report';

const pdfSource = readFileSync('src/components/pdf/AttendanceReportPdf.tsx', 'utf8');

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

test('attendance PDF banner omits the right-side period label', () => {
  assert.ok(!pdfSource.includes('style={s.tableBannerMeta}'));
});
