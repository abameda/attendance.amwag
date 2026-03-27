'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronRight,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings,
    Users,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ShaderBackground from '@/components/backgrounds/ShaderBackground';
import NoiseOverlay from '@/components/backgrounds/NoiseOverlay';
import { createClient } from '@/lib/supabase/client';
import { AnimatePresence, PageReveal, ToastContainer, motion } from '@/components/ui';
import { cn } from '@/lib/utils';

const navItemsConfig = [
    { href: '/admin', icon: LayoutDashboard, labelKey: 'dashboard', adminOnly: true },
    { href: '/admin/employees', icon: Users, labelKey: 'employees', adminOnly: true },
    { href: '/admin/attendance', icon: ClipboardList, labelKey: 'attendanceLogs', adminOnly: false },
    { href: '/admin/settings', icon: Settings, labelKey: 'settings', adminOnly: true },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const supabase = useMemo(() => createClient(), []);
    const t = useTranslations('Sidebar');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [adminName, setAdminName] = useState('');
    const [adminJobTitle, setAdminJobTitle] = useState('');
    const [userRole, setUserRole] = useState<string>('admin');

    useEffect(() => {
        const fetchAdminProfile = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, job_title, role')
                .eq('id', user.id)
                .single();

            if (profile) {
                setAdminName(profile.full_name);
                setAdminJobTitle(profile.job_title || 'Administrator');
                setUserRole(profile.role || 'admin');
            }
        };

        fetchAdminProfile();
    }, [supabase]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        router.push(`/${locale}/login`);
        router.refresh();
    }, [locale, router, supabase]);

    return (
        <div className="relative min-h-screen overflow-x-hidden text-[var(--foreground)]">
            <ShaderBackground />
            <NoiseOverlay />

            {/* Mobile header */}
            <header className="sticky top-0 z-40 px-4 pt-4 lg:hidden">
                <div className="flex items-center justify-between rounded-[1.8rem] border border-[var(--line)] bg-[var(--bg-primary)]/80 px-4 py-3 backdrop-blur-lg">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="focus-ring rounded-full bg-[var(--surface)] p-2.5 text-[var(--foreground)]"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="relative h-11 w-11 rounded-[1rem] bg-[var(--surface-strong)] p-2 shadow-[var(--shadow-glow-blue)]">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag"
                                    fill
                                    className="object-contain p-1.5"
                                />
                            </div>
                            <div>
                                <p className="section-kicker">{t('adminPanel')}</p>
                                <p className="text-sm font-semibold text-[var(--foreground)]">Amwag Admin</p>
                            </div>
                        </div>
                    </div>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence>
                {(isSidebarOpen || typeof window !== 'undefined') && (
                    <aside
                        className={cn(
                            'fixed inset-y-0 start-0 z-50 w-[19.5rem] px-4 py-4 transition-transform duration-300 lg:translate-x-0 lg:rtl:-translate-x-0',
                            isSidebarOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full'
                        )}
                    >
                        <div className="flex h-full flex-col rounded-[2.4rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4 backdrop-blur-[20px]">
                            {/* Logo */}
                            <div className="flex items-center justify-between border-b border-[var(--line)] px-2 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative h-14 w-14 rounded-[1.3rem] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow-glow-blue)]">
                                        <Image
                                            src="/logo.png"
                                            alt="Amwag Transportation"
                                            fill
                                            className="object-contain p-1.5"
                                        />
                                    </div>
                                    <div>
                                        <p className="section-kicker">{t('adminPanel')}</p>
                                        <h1 className="display-serif text-2xl text-[var(--foreground)]">Amwag</h1>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="focus-ring rounded-full p-2 text-[var(--muted-strong)] hover:text-[var(--foreground)] lg:hidden"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Navigation */}
                            <nav className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-1 py-5">
                                {navItemsConfig
                                    .filter((item) => userRole === 'admin' || !item.adminOnly)
                                    .map((item) => {
                                        const localizedHref = `/${locale}${item.href}`;
                                        const isActive = pathname === localizedHref;

                                        return (
                                            <Link
                                                key={item.href}
                                                href={localizedHref}
                                                onClick={() => setIsSidebarOpen(false)}
                                                className={cn(
                                                    'group relative flex items-center gap-3 rounded-[1.4rem] px-4 py-3.5 text-sm font-medium transition-all duration-300',
                                                    isActive
                                                        ? 'border-s-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)] shadow-[var(--shadow-glow-blue)]'
                                                        : 'bg-transparent text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
                                                )}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="active-nav"
                                                        className="absolute inset-0 rounded-[1.4rem] bg-[var(--accent-soft)]"
                                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                                        style={{ zIndex: -1 }}
                                                    />
                                                )}
                                                <div
                                                    className={cn(
                                                        'rounded-full p-2 transition-colors',
                                                        isActive
                                                            ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                                                            : 'bg-[var(--surface)] text-[var(--muted-strong)] group-hover:text-[var(--foreground)]'
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4" />
                                                </div>
                                                <span>{t(item.labelKey)}</span>
                                                {isActive && <ChevronRight className="ms-auto h-4 w-4 rtl:rotate-180" />}
                                            </Link>
                                        );
                                    })}
                            </nav>

                            {/* Bottom section */}
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                className="space-y-4 border-t border-[var(--line)] px-2 pt-4"
                            >
                                <LanguageSwitcher />

                                {/* Profile card */}
                                <div className="rounded-[1.8rem] border border-[var(--line)] bg-[var(--surface)] p-4 backdrop-blur-md">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-[var(--accent)] to-[var(--secondary)] text-lg font-bold text-white">
                                            {adminName.charAt(0).toUpperCase() || 'A'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                                {adminName || 'Admin'}
                                            </p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                                {adminJobTitle || 'Administrator'}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLogout}
                                        className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/20"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>{t('logout')}</span>
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </aside>
                )}
            </AnimatePresence>

            <main className="relative z-[2] min-h-screen px-4 pb-8 pt-4 lg:pe-8 lg:ps-[22.5rem]">
                <PageReveal className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col">
                    <div className="flex-1">{children}</div>
                    <Footer className="mt-12 border-t border-[var(--line)] py-6" />
                </PageReveal>
            </main>

            <ToastContainer />
        </div>
    );
}
