'use client';

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

export default function AppSidebar({
    isOpen,
    onClose,
    userRole,
    adminName,
    adminJobTitle,
    adminInitial,
    isProfileLoading,
    isLoggingOut,
    onLogout,
}: AppSidebarProps) {
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Sidebar');

    return (
        <aside
            className={cn(
                'fixed inset-y-0 start-0 z-50 w-[19.5rem] max-w-[calc(100vw-1.5rem)] px-3 py-3 transition-transform duration-300 ease-out lg:px-5 lg:py-5 lg:translate-x-0 lg:rtl:-translate-x-0',
                isOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full'
            )}
        >
            <div className="flex h-full flex-col bg-white/30 border border-white/50 backdrop-blur-2xl shadow-[0_16px_60px_0_rgba(45,70,140,0.12)] rounded-[1.75rem] p-4 max-lg:backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/45 px-2 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-14 w-14 shrink-0 rounded-2xl border border-white/55 bg-white/35 p-3 shadow-sm backdrop-blur-xl">
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
                            <h1 className="truncate text-xl font-extrabold text-slate-900">Amwag</h1>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="focus-ring inline-flex size-10 items-center justify-center rounded-xl border border-white/50 bg-white/30 text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-slate-950 lg:hidden"
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
                                        'focus-ring group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200',
                                        isActive
                                            ? 'bg-cyan-100/55 text-sky-900 border border-cyan-200/60 shadow-sm'
                                            : 'border border-transparent text-slate-600 hover:bg-white/35 hover:text-slate-950'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                                            isActive
                                                ? 'bg-white/40 text-sky-800'
                                                : 'bg-white/25 text-slate-500 group-hover:text-slate-900'
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

                <div className="space-y-4 border-t border-white/45 px-2 pt-4">
                    <LanguageSwitcher />

                    <div className="rounded-2xl border border-white/50 bg-white/35 p-4 shadow-sm backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-lg font-extrabold text-[oklch(99%_0.004_220)] shadow-[0_12px_30px_rgba(2,132,199,0.22)]">
                                {adminInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
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
                            className="focus-ring mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200/70 bg-rose-100/65 px-4 py-2.5 text-sm font-bold text-rose-800 transition-all duration-200 hover:bg-white/55 disabled:pointer-events-none disabled:opacity-60"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            <span>{isLoggingOut ? t('loggingOut') : t('logout')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
