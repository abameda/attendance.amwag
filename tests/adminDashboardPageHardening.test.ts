import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/admin/page.tsx', 'utf8');
const globalsSource = readFileSync('src/app/globals.css', 'utf8');
const shellSource = readFileSync('src/components/layout/AdminShell.tsx', 'utf8');
const sidebarSource = readFileSync('src/components/layout/AppSidebar.tsx', 'utf8');
const badgeSource = readFileSync('src/components/ui/Badge.tsx', 'utf8');
const cardSource = readFileSync('src/components/ui/Card.tsx', 'utf8');
const chartSource = readFileSync('src/components/ui/ChartWrapper.tsx', 'utf8');
const toastSource = readFileSync('src/components/ui/Toast.tsx', 'utf8');
const settingsSource = readFileSync('src/app/[locale]/admin/settings/page.tsx', 'utf8');
const analyticsSource = readFileSync('src/app/[locale]/admin/employees/[id]/analytics/page.tsx', 'utf8');

test('admin dashboard hardens network and large-data states', () => {
  assert.ok(
    pageSource.includes('readJsonResponse'),
    'dashboard fetches should tolerate non-JSON and malformed API responses'
  );
  assert.ok(
    pageSource.includes('BRANCH_ROW_LIMIT') && pageSource.includes('visibleBranchRows.map'),
    'branch health table should cap rendered rows for large branch lists'
  );
  assert.ok(
    pageSource.includes('aria-busy={isExporting}') && pageSource.includes('aria-busy={busy}'),
    'export actions should expose busy state to assistive technology'
  );
  assert.ok(
    pageSource.includes('[overflow-wrap:anywhere]'),
    'dashboard tiles should protect against extreme names and translated labels'
  );
  assert.ok(
    pageSource.includes('grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))]'),
    'dashboard shortcut tiles should use content-aware columns so desktop nested panels do not squeeze labels vertically'
  );
  assert.ok(
    pageSource.includes('grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]'),
    'dashboard KPI tiles should use content-aware columns so tablet and narrow desktop layouts reflow without awkward tracks'
  );
  assert.ok(
    pageSource.includes('function BranchHealthCard') &&
      pageSource.includes('md:hidden') &&
      pageSource.includes('hidden md:block'),
    'branch health should render mobile cards at phone widths while preserving the data table for tablet and desktop'
  );
  assert.ok(
    pageSource.includes('flex flex-col gap-4 p-4 sm:flex-row'),
    'exception rows should stack on small screens instead of squeezing labels beside the count'
  );
});

test('admin dashboard uses shared Dark Graphite Glass utilities', () => {
  assert.ok(
    globalsSource.includes('--admin-canvas: oklch(13.5% 0.012 250)') &&
      globalsSource.includes('--admin-glass: rgb(255 255 255 / 0.075)') &&
      globalsSource.includes('.admin-glass-panel') &&
      globalsSource.includes('.admin-glass-table') &&
      globalsSource.includes('.admin-glass-control') &&
      globalsSource.includes('.admin-kpi-tile') &&
      globalsSource.includes('@media (max-width: 768px)'),
    'Dark Graphite Glass tokens and utilities should be centralized in globals.css'
  );
  assert.ok(
    pageSource.includes('admin-glass-panel') &&
      pageSource.includes('admin-glass-table') &&
      pageSource.includes('admin-glass-control') &&
      pageSource.includes('admin-glass-button-primary') &&
      pageSource.includes('admin-kpi-tile'),
    'dashboard panels, table, controls, primary action, and KPIs should use shared glass utilities'
  );
  assert.ok(pageSource.includes('grid-cols-[repeat(auto-fit'), 'desktop KPI layout should use responsive auto-fit columns to fill wide admin screens without awkward empty tracks');
  assert.ok(pageSource.includes('function StatusIcon'), 'status pills should include an icon, not color alone');
  assert.ok(pageSource.includes('border-blue-300/[0.25] bg-blue-400/[0.12]'), 'dashboard accents should use restrained dark blue glass');
  assert.ok(
    badgeSource.includes('CheckCircle2') &&
      badgeSource.includes('AlarmClock') &&
      badgeSource.includes('UserX') &&
      badgeSource.includes('TriangleAlert') &&
      badgeSource.includes('TimerOff') &&
      badgeSource.includes('Hourglass'),
    'shared admin status badges should pair status color and text with useful icons'
  );
  assert.doesNotMatch(pageSource, /backdrop-blur-(xl|2xl|3xl)/, 'dashboard should not bypass shared responsive blur utilities');
  assert.doesNotMatch(shellSource, /backdrop-blur-(xl|2xl|3xl)/, 'admin shell should not bypass shared responsive blur utilities');
  assert.doesNotMatch(sidebarSource, /backdrop-blur-(xl|2xl|3xl)/, 'admin sidebar should not bypass shared responsive blur utilities');
  assert.doesNotMatch(cardSource, /backdrop-blur-(xl|2xl|3xl)/, 'shared cards should use responsive blur utilities');
  assert.doesNotMatch(chartSource, /backdrop-blur-(xl|2xl|3xl)/, 'chart tooltip should use responsive blur utilities');
  assert.doesNotMatch(toastSource, /backdrop-blur-(xl|2xl|3xl)/, 'toasts should use responsive blur utilities');
  assert.ok(!pageSource.includes('function glassPanel'), 'dashboard should not keep a local glassPanel token');
  assert.ok(!pageSource.includes('gradient-text'), 'admin dashboard should not use banned gradient text');
  assert.ok(!settingsSource.includes('gradient-text'), 'admin settings should not use banned gradient text');
  assert.ok(!globalsSource.includes('.gradient-text'), 'banned gradient text utility should not remain globally available');
  assert.ok(!analyticsSource.includes('DarkTooltip'), 'admin analytics should not use dark chart tooltip naming');
  assert.ok(!analyticsSource.includes('darkChartDefaults'), 'admin analytics should not use dark chart defaults');
});
