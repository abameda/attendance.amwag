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
        <div className="min-h-screen text-slate-100 flex relative overflow-x-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent"></div>
                <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen opacity-50"></div>
            </div>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 glass !rounded-none !border-x-0 !border-t-0 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors focus-ring"
                    >
                        <Menu className="w-6 h-6 text-slate-200" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                            <Image
                                src="/logo.png"
                                alt="Amwag"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="font-semibold text-white tracking-wide">Admin</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar (Floating Pill on Desktop) */}
            <aside
                className={cn(
                    'fixed lg:inset-y-4 lg:start-4 inset-y-0 start-0 w-72 glass lg:rounded-3xl z-50 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]',
                    isSidebarOpen
                        ? 'translate-x-0 rtl:-translate-x-0'
                        : '-translate-x-[110%] rtl:translate-x-[110%] lg:translate-x-0 lg:rtl:-translate-x-0'
                )}
            >
                <div className="h-24 flex flex-shrink-0 items-center justify-between px-6 border-b border-white/5 relative overflow-hidden">
                    {/* Subtle Top Glow in Sidebar */}
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-cyan-500/20 blur-[40px] rounded-full pointer-events-none"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="relative w-12 h-12 premium-surface rounded-2xl p-2 flex items-center justify-center border-white/10 shadow-lg shadow-cyan-500/5">
                            <Image
                                src="/logo.png"
                                alt="Amwag Transportation"
                                fill
                                className="object-contain p-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                            />
                        </div>
                        <div>
                            <h1 className="font-bold text-white tracking-widest uppercase text-sm">Amwag</h1>
                            <p className="text-xs font-medium text-cyan-400 capitalize">{t('adminPanel')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 hover:bg-white/10 rounded-xl transition-colors focus-ring"
                    >
                        <X className="w-5 h-5 text-slate-300" />
                    </button>
                </div>

                <nav className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar relative z-10">
                    {navItemsConfig
                        .filter((item) => userRole === 'admin' || !item.adminOnly)
                        .map((item, i) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3.5 mx-2 rounded-xl transition-all duration-300 focus-ring stagger group',
                                        isActive
                                            ? 'bg-white/10 border border-white/10 shadow-[0_8px_20px_-4px_rgba(6,182,212,0.15)] text-white font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/5 border border-transparent'
                                    )}
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        isActive ? "bg-cyan-500/20 text-cyan-300" : "bg-transparent text-slate-400 group-hover:text-cyan-300"
                                    )}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <span>{t(item.labelKey)}</span>
                                    {isActive && (
                                        <ChevronRight className="w-4 h-4 ml-auto text-cyan-400 opacity-60" />
                                    )}
                                </Link>
                            );
                        })}
                </nav>

                <div className="p-5 border-t border-white/5 space-y-4 mt-auto flex-shrink-0 relative z-10 bg-slate-900/20 lg:rounded-b-3xl">
                    <div className="px-2">
                        <LanguageSwitcher />
                    </div>

                    <div className="premium-surface border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-md shadow-black/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20 border border-white/20 flex-shrink-0">
                                {adminName.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-sm tracking-wide break-words">
                                    {adminName || 'Admin'}
                                </p>
                                <p className="text-[11px] text-cyan-300/80 font-medium truncate uppercase tracking-wider">{adminJobTitle || 'Administrator'}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/50 hover:bg-red-500/80 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-white/5 hover:border-red-400/50 rounded-lg transition-all duration-300 focus-ring"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ms-[19rem] pt-20 lg:pt-4 min-h-screen relative p-4 lg:pe-8 lg:pb-8 z-10 min-w-0 transition-all duration-300">
                <div className="relative h-full flex flex-col max-w-7xl mx-auto animate-fade-in">
                    <div className="flex-1">{children}</div>
                    <Footer className="py-6 mt-12 border-t border-white/5 text-slate-400" />
                </div>
            </main>

            <ToastContainer />
        </div>
    );
}
