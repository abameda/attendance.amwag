import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const liquidBackgroundPath = 'src/components/ui/LiquidBackground.tsx';
const appSidebarPath = 'src/components/layout/AppSidebar.tsx';
const adminShellPath = 'src/components/layout/AdminShell.tsx';
const adminLayoutPath = 'src/app/[locale]/admin/layout.tsx';
const globalsPath = 'src/app/globals.css';

function readRequiredSource(path: string): string {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('liquid background uses motion with reduced-motion static fallback', () => {
  const source = readRequiredSource(liquidBackgroundPath);

  assert.ok(source.includes('useReducedMotion'), 'background should respect reduced motion');
  assert.ok(source.includes('aria-hidden="true"'), 'background should be hidden from assistive tech');
  assert.ok(source.includes('pointer-events-none'), 'background should not block interaction');
  assert.ok(source.includes('oklch(9.5%_0.01_250)'), 'background should use the DESIGN.md graphite base');
  assert.ok(source.includes('rgb(37_99_235_/_0.16)'), 'background should include a restrained cool blue field');
  assert.ok(source.includes('rgb(14_116_144_/_0.12)'), 'background should include a restrained cool cyan field');
  assert.ok(!source.includes('violet'), 'background should not include violet or purple fields');
  assert.ok(!source.includes('rounded-full'), 'background should not use animated blob shapes');
});

test('app sidebar renders translated path-based navigation with glass active state', () => {
  const source = readRequiredSource(appSidebarPath);
  const globalsSource = readRequiredSource(globalsPath);

  assert.ok(source.includes('usePathname'), 'sidebar should derive active state from the current path');
  assert.ok(source.includes("useTranslations('Sidebar')"), 'sidebar should use existing Sidebar translations');
  assert.ok(source.includes('pathname === localizedHref'), 'exact route should be active');
  assert.ok(source.includes('pathname.startsWith(`${localizedHref}/`)'), 'nested admin routes should keep their parent nav item active');
  assert.ok(source.includes('admin-glass-sidebar'), 'desktop sidebar should use the shared sidebar glass utility');
  assert.ok(source.includes('admin-nav-item-active'), 'active item should use the shared DESIGN.md active glass state');
  assert.ok(globalsSource.includes('.admin-glass-sidebar'), 'sidebar glass token should live in shared CSS');
  assert.ok(globalsSource.includes('.admin-nav-item-active'), 'active nav state should live in shared CSS');
  assert.ok(globalsSource.includes('rgb(30 64 175 / 0.34)'), 'active nav should use contained translucent navy fill');
  assert.ok(globalsSource.includes('0 12px 32px rgba(0, 0, 0, 0.28)'), 'active nav should use a dark contained shadow');
  assert.ok(!source.includes('border-s-2'), 'active items should not use thick side stripes');
});

test('admin layout keeps admin behavior and delegates visual shell only', () => {
  const shellSource = readRequiredSource(adminShellPath);
  const layoutSource = readRequiredSource(adminLayoutPath);

  assert.ok(shellSource.includes('<LiquidBackground />'), 'admin shell should own the background layer');
  assert.ok(shellSource.includes('admin-glass-surface'), 'admin shell should use the Dark Graphite Glass admin surface');
  assert.ok(shellSource.includes('<AppSidebar'), 'admin shell should render the sidebar');
  assert.ok(shellSource.includes('relative z-10'), 'admin main content should sit above the background');
  assert.ok(layoutSource.includes('fetchAdminProfile'), 'admin profile fetch should remain in the admin layout');
  assert.ok(layoutSource.includes("fetch('/api/auth/logout'"), 'logout behavior should remain in the admin layout');
  assert.ok(layoutSource.includes('setUserRole'), 'role filtering state should remain in the admin layout');
  assert.ok(layoutSource.includes('<AdminShell'), 'admin layout should delegate the visual foundation to AdminShell');
});

test('admin mobile navigation behaves like an accessible dialog', () => {
  const shellSource = readRequiredSource(adminShellPath);
  const sidebarSource = readRequiredSource(appSidebarPath);

  assert.ok(shellSource.includes('menuButtonRef'), 'menu button should keep a ref for focus return');
  assert.ok(shellSource.includes('sidebarDialogRef'), 'mobile drawer should expose a dialog ref for focus management');
  assert.ok(shellSource.includes('aria-controls="admin-mobile-navigation"'), 'menu button should point to the controlled drawer');
  assert.ok(shellSource.includes('focusableSelectors'), 'drawer should find focusable controls when opened');
  assert.ok(shellSource.includes("event.key === 'Tab'"), 'drawer should trap tab focus while open');
  assert.ok(shellSource.includes("event.key === 'Escape'"), 'Escape should close the drawer');
  assert.ok(shellSource.includes('menuButton?.focus()'), 'focus should return to the menu button after close');
  assert.ok(shellSource.includes('inert={backgroundShouldBeInert ? true : undefined}'), 'background should be inert while the mobile drawer is open');
  assert.ok(shellSource.includes('aria-hidden={backgroundShouldBeInert}'), 'background should be hidden from assistive tech while the mobile drawer is open');

  assert.ok(sidebarSource.includes("role={isMobileDialog && isOpen ? 'dialog' : undefined}"), 'open mobile sidebar should use dialog semantics');
  assert.ok(sidebarSource.includes('aria-modal={isMobileDialog && isOpen ? true : undefined}'), 'open mobile sidebar should be modal');
  assert.ok(sidebarSource.includes('aria-labelledby={labelId}'), 'dialog should have a stable accessible label');
  assert.ok(sidebarSource.includes('inert={isMobileDialog && !isOpen ? true : undefined}'), 'closed mobile sidebar should not be tabbable');
  assert.ok(!sidebarSource.includes('<h1'), 'sidebar brand should not create a repeated page h1');
  assert.ok(sidebarSource.includes('<p') && sidebarSource.includes('id={labelId}'), 'sidebar brand should label the dialog without using h1');
});
