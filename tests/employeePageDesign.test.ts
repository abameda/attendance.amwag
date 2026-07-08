import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/employee/page.tsx', 'utf8');
const clockHeroSource = readFileSync('src/components/employee/ClockHero.tsx', 'utf8');
const globalsSource = readFileSync('src/app/globals.css', 'utf8');

test('employee portal uses the Dark Graphite Glass employee surface', () => {
  assert.ok(
    globalsSource.includes('.employee-glass-surface') &&
      globalsSource.includes('--employee-canvas: oklch(13.5% 0.012 250)') &&
      globalsSource.includes('--employee-glass: rgb(255 255 255 / 0.075)') &&
      globalsSource.includes('--employee-shadow-glass'),
    'employee surface should expose scoped Dark Graphite Glass tokens'
  );

  assert.ok(
    pageSource.includes('employee-glass-surface') && !pageSource.includes('employee-ledger-surface'),
    'employee page should use the graphite glass surface instead of the old light ledger shell'
  );

  assert.ok(
    pageSource.includes('employee-glass-panel') &&
      pageSource.includes('employee-glass-panel-strong') &&
      pageSource.includes('employee-glass-control') &&
      pageSource.includes('employee-glass-button-secondary'),
    'employee page should use shared employee glass panels, controls, and secondary actions'
  );
});

test('employee clock action keeps the primary attendance action prominent and accessible', () => {
  assert.ok(
    clockHeroSource.includes('employee-glass-clock-panel') &&
      clockHeroSource.includes('employee-glass-button-primary') &&
      clockHeroSource.includes('min-h-[4.5rem]'),
    'clock hero should use a strong glass panel and large primary action'
  );

  assert.ok(
    clockHeroSource.includes('focus-visible:shadow-[var(--employee-focus-ring)]') &&
      clockHeroSource.includes('disabled:cursor-not-allowed'),
    'clock action should preserve visible focus and disabled states'
  );
});

test('employee adjacent feedback uses scoped graphite glass tokens', () => {
  assert.ok(
    globalsSource.includes('--toast-surface: var(--employee-glass-strong)') &&
      globalsSource.includes('--footer-strong: var(--employee-ink-strong)') &&
      globalsSource.includes('--skeleton-bg: rgb(255 255 255 / 0.09)'),
    'toasts, footer, and skeletons should inherit employee graphite glass tokens'
  );

  assert.ok(
    pageSource.includes('employee-glass-alert') &&
      pageSource.includes('employee-status-pill') &&
      pageSource.includes('employee-record-grid'),
    'success/error feedback, status, and record rows should use employee glass utilities'
  );
});

test('employee attendance refresh bypasses browser cache after clock actions', () => {
  assert.ok(
    pageSource.includes("cache: 'no-store'"),
    'employee attendance fetches should not reuse the pre-check-in attendance response'
  );
});
