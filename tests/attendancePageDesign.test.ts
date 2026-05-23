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
    pageSource.includes('attendance-export-action') && pageSource.includes('handleExportPDF'),
    'export should remain a visible action tied to the current filtered data'
  );
  assert.ok(
    pageSource.includes('attendance-filter-band') && pageSource.includes('attendance-records-table'),
    'filters should sit directly above the attendance records table'
  );
});

test('attendance page uses the admin graphite glass foundation for its work surfaces', () => {
  assert.ok(
    pageSource.includes('attendance-page-shell'),
    'attendance page should define a scoped shell for the records workspace'
  );
  assert.ok(
    pageSource.includes('admin-glass-panel-strong') && pageSource.includes('admin-kpi-tile'),
    'attendance summary should use admin glass panels and KPI tiles'
  );
  assert.ok(
    pageSource.includes('admin-glass-control') && pageSource.includes('admin-glass-button-secondary'),
    'attendance filters should use the admin glass control vocabulary'
  );
  assert.ok(
    pageSource.includes('admin-glass-table') && pageSource.includes('admin-glass-table-row'),
    'attendance records should use the admin glass table treatment'
  );
  assert.ok(
    pageSource.includes('admin-glass-button-primary') && pageSource.includes('attendance-export-action'),
    'attendance export should remain a prominent primary glass action'
  );
});
