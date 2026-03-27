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
    Users,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { createClient } from '@/lib/supabase/client';
import { PageReveal, ToastContainer, motion } from '@/components/ui';
import { cn } from '@/lib/utils';

const navItemsConfig = [
    { href: '/admin', icon: LayoutDashboard, labelKey: 'dashboard', adminOnly: true },
    { href: '/admin/employees', icon: Users, labelKey: 'employees', adminOnly: true },
    { href: '/admin/attendance', icon: ClipboardList, labelKey: 'attendanceLogs', adminOnly: false },
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
        <div className="relative min-h-screen overflow-x-hidden text-[#1f191d]">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[8%] top-[10%] h-44 w-44 rounded-full bg-rose-300/25 blur-3xl" />
                <div className="absolute bottom-[14%] right-[10%] h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
            </div>

            <header className="sticky top-0 z-40 px-4 pt-4 lg:hidden">
                <div className="premium-card flex items-center justify-between rounded-[1.8rem] px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="focus-ring rounded-full bg-[rgba(255,255,255,0.72)] p-2.5 text-[#241d22]"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="relative h-11 w-11 rounded-[1rem] bg-white/80 p-2 shadow-[0_20px_40px_-24px_rgba(72,47,56,0.45)]">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag"
                                    fill
                                    className="object-contain p-1.5"
                                />
                            </div>
                            <div>
                                <p className="section-kicker">{t('adminPanel')}</p>
                                <p className="text-sm font-semibold text-[#241d22]">Amwag Admin</p>
                            </div>
                        </div>
                    </div>
                    <LanguageSwitcher />
                </div>
            </header>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-[rgba(23,20,25,0.22)] backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                className={cn(
                    'fixed inset-y-0 start-0 z-50 w-[19.5rem] px-4 py-4 transition-transform duration-300 lg:translate-x-0 lg:rtl:-translate-x-0',
                    isSidebarOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full'
                )}
            >
                <div className="editorial-frame flex h-full flex-col rounded-[2.4rem] border-[rgba(66,42,50,0.08)] bg-[rgba(255,251,247,0.84)] p-4">
                    <div className="flex items-center justify-between border-b border-[rgba(66,42,50,0.08)] px-2 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="relative h-14 w-14 rounded-[1.3rem] bg-white/85 p-3 shadow-[0_20px_44px_-28px_rgba(72,47,56,0.45)]">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag Transportation"
                                    fill
                                    className="object-contain p-1.5"
                                />
                            </div>
                            <div>
                                <p className="section-kicker">{t('adminPanel')}</p>
                                <h1 className="display-serif text-2xl text-[#1e191d]">Amwag</h1>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="focus-ring rounded-full p-2 text-[#7d6e73] lg:hidden"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

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
                                            'group flex items-center gap-3 rounded-[1.4rem] px-4 py-3.5 text-sm font-medium transition-all duration-300',
                                            isActive
                                                ? 'bg-[#171419] text-white shadow-[0_22px_42px_-26px_rgba(23,20,25,0.8)]'
                                                : 'text-[#665b60] hover:bg-white/75 hover:text-[#241d22]'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'rounded-full p-2 transition-colors',
                                                isActive
                                                    ? 'bg-white/10 text-white'
                                                    : 'bg-[rgba(255,255,255,0.64)] text-[#9d174d] group-hover:bg-white'
                                            )}
                                        >
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <span>{t(item.labelKey)}</span>
                                        {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                                    </Link>
                                );
                            })}
                    </nav>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 border-t border-[rgba(66,42,50,0.08)] px-2 pt-4"
                    >
                        <LanguageSwitcher />

                        <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.62)] p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#171419] text-lg font-bold text-white">
                                    {adminName.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[#241d22]">
                                        {adminName || 'Admin'}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#856e79]">
                                        {adminJobTitle || 'Administrator'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(139,31,40,0.12)] bg-[rgba(139,31,40,0.06)] px-4 py-3 text-sm font-semibold text-[#8b1f28] hover:bg-[rgba(139,31,40,0.1)]"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>{t('logout')}</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </aside>

            <main className="min-h-screen px-4 pb-8 pt-4 lg:pe-8 lg:ps-[22.5rem]">
                <PageReveal className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col">
                    <div className="flex-1">{children}</div>
                    <Footer className="mt-12 border-t border-[rgba(66,42,50,0.08)] py-6" />
                </PageReveal>
            </main>

            <ToastContainer />
        </div>
    );
}
