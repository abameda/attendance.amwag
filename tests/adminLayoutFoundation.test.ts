import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const liquidBackgroundPath = 'src/components/ui/LiquidBackground.tsx';
const appSidebarPath = 'src/components/layout/AppSidebar.tsx';
const adminShellPath = 'src/components/layout/AdminShell.tsx';
const adminLayoutPath = 'src/app/[locale]/admin/layout.tsx';

function readRequiredSource(path: string): string {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('liquid background uses motion with reduced-motion static fallback', () => {
  const source = readRequiredSource(liquidBackgroundPath);

  assert.ok(source.includes('useReducedMotion'), 'background should respect reduced motion');
  assert.ok(source.includes('aria-hidden="true"'), 'background should be hidden from assistive tech');
  assert.ok(source.includes('pointer-events-none'), 'background should not block interaction');
  assert.ok(source.includes('oklch(97%_0.018_220)'), 'background should use the DESIGN.md liquid gradient');
  assert.ok(source.includes('bg-cyan-300/30'), 'background should include the cyan blob');
  assert.ok(source.includes('bg-violet-300/25'), 'background should include the violet blob');
  assert.ok(source.includes('bg-teal-300/25'), 'background should include the teal blob');
});

test('app sidebar renders translated path-based navigation with glass active state', () => {
  const source = readRequiredSource(appSidebarPath);

  assert.ok(source.includes('usePathname'), 'sidebar should derive active state from the current path');
  assert.ok(source.includes("useTranslations('Sidebar')"), 'sidebar should use existing Sidebar translations');
  assert.ok(source.includes('pathname === localizedHref'), 'exact route should be active');
  assert.ok(source.includes('pathname.startsWith(`${localizedHref}/`)'), 'nested admin routes should keep their parent nav item active');
  assert.ok(source.includes('bg-white/30 border border-white/50 backdrop-blur-2xl'), 'desktop sidebar should use the sidebar glass token');
  assert.ok(source.includes('bg-cyan-100/55 text-sky-900 border border-cyan-200/60 shadow-sm'), 'active item should use the requested glass active state');
  assert.ok(!source.includes('border-s-2'), 'active items should not use thick side stripes');
});

test('admin layout keeps admin behavior and delegates visual shell only', () => {
  const shellSource = readRequiredSource(adminShellPath);
  const layoutSource = readRequiredSource(adminLayoutPath);

  assert.ok(shellSource.includes('<LiquidBackground />'), 'admin shell should own the background layer');
  assert.ok(shellSource.includes('<AppSidebar'), 'admin shell should render the sidebar');
  assert.ok(shellSource.includes('relative z-10'), 'admin main content should sit above the background');
  assert.ok(layoutSource.includes('fetchAdminProfile'), 'admin profile fetch should remain in the admin layout');
  assert.ok(layoutSource.includes("fetch('/api/auth/logout'"), 'logout behavior should remain in the admin layout');
  assert.ok(layoutSource.includes('setUserRole'), 'role filtering state should remain in the admin layout');
  assert.ok(layoutSource.includes('<AdminShell'), 'admin layout should delegate the visual foundation to AdminShell');
});
