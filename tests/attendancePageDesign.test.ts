import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/admin/attendance/page.tsx', 'utf8');

test('attendance page centers searchable logs and export instead of decorative hero treatment', () => {
  assert.ok(
    !pageSource.includes('<GlowingCard>'),
    'attendance page should not use GlowingCard for the records workspace'
  );
  assert.ok(
    !pageSource.includes('gradient-text'),
    'attendance page title should use solid operational typography'
  );
  assert.ok(
    pageSource.includes('attendance-export-action') && pageSource.includes('exportAttendancePremiumPDF'),
    'export should remain a visible action tied to the current filtered data'
  );
  assert.ok(
    pageSource.includes('attendance-filter-band') && pageSource.includes('attendance-records-table'),
    'filters should sit directly above the attendance records table'
  );
});
