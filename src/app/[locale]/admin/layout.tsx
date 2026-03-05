'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    LogOut,
    Menu,
    X,
    ChevronRight,
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Footer from '@/components/Footer';

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
            if (user) {
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
            }
        };
        fetchAdminProfile();
    }, [supabase]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    }, [supabase, router]);

    return (
        <div className="min-h-screen bg-slate-950">
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/60 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                    >
                        <Menu className="w-6 h-6 text-slate-400" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8">
                            <Image
                                src="/logo.png"
                                alt="Amwag"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="font-semibold text-slate-50">Admin</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                </div>
            </header>

            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                className={cn(
                    'fixed top-0 left-0 h-full w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/60 z-50 transition-transform duration-300',
                    'lg:translate-x-0',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-white/5 rounded-xl p-1 shadow-xl shadow-black/20">
                            <Image
                                src="/logo.png"
                                alt="Amwag Transportation"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-50">Amwag</h1>
                            <p className="text-xs text-slate-500">{t('adminPanel')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {navItemsConfig
                        .filter((item) => userRole === 'admin' || !item.adminOnly)
                        .map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                        isActive
                                            ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 active:scale-[0.98]'
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{t(item.labelKey)}</span>
                                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                                </Link>
                            );
                        })}
                </nav>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/60 space-y-2">
                    <div className="px-4">
                        <LanguageSwitcher />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-lg shadow-teal-500/20">
                            {adminName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-50 text-sm">
                                {adminName || 'Admin'}
                            </p>
                            <p className="text-xs text-slate-500">{adminJobTitle || 'Administrator'}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.98]"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">{t('logout')}</span>
                    </button>
                </div>
            </aside>

            <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen relative">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-[400px] h-[400px] bg-teal-600/[0.02] rounded-full blur-[100px]" />
                </div>
                <div className="relative p-4 lg:p-8">{children}</div>

                <Footer className="py-4 border-t border-slate-800" />
            </main>

            <ToastContainer />
        </div>
    );
}
