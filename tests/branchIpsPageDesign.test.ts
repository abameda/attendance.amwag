import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/admin/branch-ips/page.tsx', 'utf8');

test('branch IP rules page uses the admin graphite glass foundation', () => {
  assert.ok(
    pageSource.includes('admin-glass-panel-strong') &&
      pageSource.includes('admin-kpi-tile') &&
      pageSource.includes('admin-glass-panel') &&
      pageSource.includes('admin-glass-table') &&
      pageSource.includes('admin-glass-table-row'),
    'branch IP screen should use shared glass hero, KPI, panel, table, and row treatments'
  );
  assert.ok(
    pageSource.includes('admin-glass-control') &&
      pageSource.includes('admin-glass-button-primary') &&
      pageSource.includes('admin-glass-button-secondary') &&
      pageSource.includes('admin-glass-status-pill'),
    'branch IP controls, actions, and statuses should use the shared admin glass vocabulary'
  );
});

test('branch IP delete flow uses inline confirmation instead of native confirm', () => {
  assert.ok(
    pageSource.includes('pendingDeleteId') && pageSource.includes('Confirm delete'),
    'delete should require a visible inline confirmation state on the row'
  );
  assert.ok(
    !pageSource.includes('window.confirm('),
    'branch IP page should not use a native blocking confirm dialog'
  );
});
