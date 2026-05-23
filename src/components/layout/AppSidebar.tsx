'use client';

import { forwardRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Archive,
    Building2,
    ChevronRight,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Network,
    Settings,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';

type NavItem = {
    href: string;
    icon: LucideIcon;
    labelKey: string;
    adminOnly: boolean;
};

const navItems: NavItem[] = [
    { href: '/admin', icon: LayoutDashboard, labelKey: 'dashboard', adminOnly: true },
    { href: '/admin/employees', icon: Users, labelKey: 'employees', adminOnly: true },
    { href: '/admin/branches', icon: Building2, labelKey: 'branches', adminOnly: true },
    { href: '/admin/attendance', icon: ClipboardList, labelKey: 'attendanceLogs', adminOnly: false },
    { href: '/admin/branch-ips', icon: Network, labelKey: 'branchIps', adminOnly: true },
    { href: '/admin/backups', icon: Archive, labelKey: 'systemBackups', adminOnly: true },
    { href: '/admin/settings', icon: Settings, labelKey: 'settings', adminOnly: true },
];

export type AppSidebarProps = {
    dialogId: string;
    labelId: string;
    isMobileDialog: boolean;
    isOpen: boolean;
    onClose: () => void;
    userRole: string;
    adminName: string;
    adminJobTitle: string;
    adminInitial: string;
    isProfileLoading: boolean;
    isLoggingOut: boolean;
    onLogout: () => void;
};

const AppSidebar = forwardRef<HTMLElement, AppSidebarProps>(function AppSidebar(
{
    dialogId,
    labelId,
    isMobileDialog,
    isOpen,
    onClose,
    userRole,
    adminName,
    adminJobTitle,
    adminInitial,
    isProfileLoading,
    isLoggingOut,
    onLogout,
},
ref
) {
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Sidebar');

    return (
        <aside
            ref={ref}
            id={dialogId}
            role={isMobileDialog && isOpen ? 'dialog' : undefined}
            aria-modal={isMobileDialog && isOpen ? true : undefined}
            aria-labelledby={labelId}
            aria-hidden={isMobileDialog && !isOpen ? true : undefined}
            inert={isMobileDialog && !isOpen ? true : undefined}
            tabIndex={isMobileDialog && isOpen ? -1 : undefined}
            className={cn(
                'fixed inset-y-0 start-0 z-50 w-[19.5rem] max-w-[calc(100vw-1.5rem)] px-3 py-3 transition-transform duration-300 ease-out lg:px-5 lg:py-5 lg:translate-x-0 lg:rtl:-translate-x-0',
                isOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full'
            )}
        >
            <div className="admin-glass-sidebar flex h-full flex-col p-4">
                <div className="flex items-center justify-between border-b border-white/[0.12] px-2 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="admin-glass-control relative h-14 w-14 shrink-0 rounded-2xl p-3">
                            <Image
                                src="/logo.png"
                                alt="Amwag Transportation"
                                fill
                                sizes="56px"
                                className="object-contain p-1.5"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="section-kicker text-slate-500">{t('adminPanel')}</p>
                            <p id={labelId} className="truncate text-xl font-extrabold text-[var(--admin-ink-strong)]">
                                Amwag
                            </p>
                        </div>
                    </div>
                    <button
                        data-sidebar-close
                        type="button"
                        onClick={onClose}
                        className="focus-ring admin-glass-icon-button inline-flex size-10 items-center justify-center transition-all duration-200 lg:hidden"
                        aria-label={t('closeNavigation')}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-1 py-5" aria-label={t('adminPanel')}>
                    {navItems
                        .filter((item) => userRole === 'admin' || !item.adminOnly)
                        .map((item) => {
                            const localizedHref = `/${locale}${item.href}`;
                            const isActive =
                                pathname === localizedHref ||
                                (item.href !== '/admin' && pathname.startsWith(`${localizedHref}/`));
                            const Icon = item.icon;
                            const label = t(item.labelKey);

                            return (
                                <Link
                                    key={item.href}
                                    href={localizedHref}
                                    onClick={onClose}
                                    aria-label={label}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cn(
                                        'focus-ring admin-nav-item group',
                                        isActive
                                            ? 'admin-nav-item-active'
                                            : ''
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                                            isActive
                                                ? 'border border-blue-300/[0.25] bg-blue-500/[0.18] text-blue-200'
                                                : 'border border-white/[0.10] bg-white/[0.06] text-slate-400 group-hover:text-slate-100'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{label}</span>
                                    {isActive && <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />}
                                </Link>
                            );
                        })}
                </nav>

                <div className="space-y-4 border-t border-white/[0.12] px-2 pt-4">
                    <LanguageSwitcher />

                    <div className="admin-glass-panel-muted p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-300/[0.25] bg-blue-600/[0.65] text-lg font-extrabold text-[var(--admin-ink-strong)] shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
                                {adminInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--admin-ink-strong)]">
                                    {isProfileLoading ? t('loadingProfile') : adminName || t('adminFallback')}
                                </p>
                                <p className="mt-1 truncate text-xs font-bold uppercase text-slate-500">
                                    {adminJobTitle || t('administratorFallback')}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onLogout}
                            disabled={isLoggingOut}
                            className="focus-ring mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/[0.30] bg-red-950/[0.35] px-4 py-2.5 text-sm font-bold text-red-200 transition-all duration-200 hover:bg-red-900/[0.45] disabled:pointer-events-none disabled:opacity-60"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            <span>{isLoggingOut ? t('loggingOut') : t('logout')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
});

export default AppSidebar;
