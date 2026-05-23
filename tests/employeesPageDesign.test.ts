import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/admin/employees/page.tsx', 'utf8');
const bulkImportSource = readFileSync('src/components/BulkImportModal.tsx', 'utf8');
const analyticsSource = readFileSync('src/app/[locale]/admin/employees/[id]/analytics/page.tsx', 'utf8');

test('employees page uses focused management layout instead of decorative hero treatment', () => {
  assert.ok(
    !pageSource.includes('<GlowingCard>'),
    'employees page should not use GlowingCard for the management header'
  );
  assert.ok(
    !pageSource.includes('gradient-text'),
    'employees page title should use solid operational typography'
  );
  assert.ok(
    pageSource.includes("href={`/${locale}/admin/employees/${employee.id}/analytics`}"),
    'each employee record should keep a direct analytics link'
  );
  assert.ok(
    pageSource.includes('employee-analytics-action') && pageSource.includes("{t('attendanceAnalytics')}"),
    'analytics should be presented as a visible employee action'
  );
});

test('employees page uses Dark Graphite Glass admin primitives', () => {
  const requiredClasses = [
    'admin-glass-panel',
    'admin-glass-panel-muted',
    'admin-glass-panel-interactive',
    'admin-glass-button-primary',
    'admin-glass-button-secondary',
  ];

  for (const className of requiredClasses) {
    assert.ok(
      pageSource.includes(className),
      `employees page should use ${className} for the admin glass redesign`
    );
  }
});

test('bulk import modal uses dense admin glass import instrumentation', () => {
  assert.ok(
    bulkImportSource.includes('bulk-import-instrument'),
    'bulk import should expose a named instrument shell for visual regression'
  );
  assert.ok(
    bulkImportSource.includes('admin-glass-panel-muted') && bulkImportSource.includes('admin-glass-control'),
    'bulk import should use admin glass panels and controls'
  );
  assert.ok(
    bulkImportSource.includes('ImportResult') && bulkImportSource.includes('failedEmails'),
    'bulk import should retain visible success and failure result handling'
  );
});

test('employee analytics page uses command analytics glass layout', () => {
  assert.ok(
    analyticsSource.includes('employee-analytics-command'),
    'employee analytics should expose a command-center shell for visual regression'
  );
  assert.ok(
    !analyticsSource.includes('<GlowingCard>'),
    'employee analytics should not rely on GlowingCard for the primary analytics composition'
  );
  assert.ok(
    analyticsSource.includes('analytics-score-instrument') && analyticsSource.includes('analytics-history-table'),
    'employee analytics should include the score instrument and glass history table'
  );
  assert.ok(
    analyticsSource.includes('<AreaChart') && analyticsSource.includes('<BarChart'),
    'employee analytics should preserve dimensional trend and summary charts'
  );
});
