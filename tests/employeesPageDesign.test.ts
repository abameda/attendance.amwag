import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/admin/employees/page.tsx', 'utf8');

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
