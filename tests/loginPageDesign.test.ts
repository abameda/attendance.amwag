import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const loginSource = readFileSync('src/app/[locale]/login/page.tsx', 'utf8');
const footerSource = readFileSync('src/components/Footer.tsx', 'utf8');

test('login page uses a single-card Dark Graphite Glass access surface', () => {
  assert.ok(
    loginSource.includes('admin-glass-surface'),
    'login should opt into the Dark Graphite Glass token scope'
  );
  assert.ok(
    loginSource.includes('login-graphite-shell') && loginSource.includes('login-card-shell'),
    'login should use a named graphite shell and a single sign-in card'
  );
  assert.ok(
    loginSource.includes('admin-glass-panel-strong') && loginSource.includes('admin-glass-control'),
    'login form and controls should use shared admin glass vocabulary'
  );
  assert.ok(
    !loginSource.includes('login-background-mark'),
    'login should not include the oversized faint AMWAG background mark'
  );
  assert.ok(
    !loginSource.includes('lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)]'),
    'login should not keep the old two-panel split layout'
  );
  assert.ok(
    !loginSource.includes('login-access-bar') && !loginSource.includes('trustTitle') && !loginSource.includes('supportTitle'),
    'login should not show the previous hero/access panel or help block'
  );
  assert.ok(
    !loginSource.includes("import Footer from '@/components/Footer'") && !loginSource.includes('<Footer'),
    'login should not render the shared footer'
  );
  assert.ok(
    !loginSource.includes('oklch(96.2%_0.018_88)') && !loginSource.includes('employee-ledger-surface'),
    'login should not use the old light employee ledger surface tokens'
  );
});

test('login redesign preserves auth behavior, localization, and error states', () => {
  assert.ok(
    loginSource.includes('switchLocale') && loginSource.includes("(['en', 'ar'] as const)"),
    'language switching should remain available'
  );
  assert.ok(
    loginSource.includes("router.push(`/${locale}/admin`)") &&
      loginSource.includes("router.push(`/${locale}/admin/attendance`)") &&
      loginSource.includes("router.push(`/${locale}/employee`)"),
    'role-based routing should stay intact'
  );
  assert.ok(
    loginSource.includes('getLoginError') &&
      loginSource.includes('inactiveError') &&
      loginSource.includes('networkError') &&
      loginSource.includes('invalidCredentials'),
    'mapped login errors should remain intact'
  );
  assert.ok(
    loginSource.includes('role="alert"') && loginSource.includes('aria-live="polite"'),
    'form errors should remain announced to assistive technology'
  );
  assert.ok(
    loginSource.includes("useTranslations('Common')") &&
      loginSource.includes("tc('developedBy')") &&
      loginSource.includes("tc('devName')"),
    'copyright should move into the sign-in card using existing Common translations'
  );
  assert.ok(
    loginSource.includes('absolute right-5 top-5') &&
      loginSource.includes('pt-24 sm:pt-24') &&
      loginSource.includes('<SocialLinks') &&
      footerSource.includes('https://github.com/abameda') &&
      footerSource.includes('https://www.instagram.com/abamedax/') &&
      footerSource.includes('https://www.linkedin.com/in/elshorbagy/'),
    'language switcher should sit at the top-right of the card and social links should appear below copyright'
  );
});
