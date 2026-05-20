'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AppSidebar from '@/components/layout/AppSidebar';
import LiquidBackground from '@/components/ui/LiquidBackground';
import { AnimatePresence, PageReveal, motion } from '@/components/ui';
import { cn } from '@/lib/utils';

type AdminShellProps = {
    children: React.ReactNode;
    locale: string;
    userRole: string;
    adminName: string;
    adminJobTitle: string;
    adminInitial: string;
    isProfileLoading: boolean;
    isLoggingOut: boolean;
    onLogout: () => void;
};

export default function AdminShell({
    children,
    locale,
    userRole,
    adminName,
    adminJobTitle,
    adminInitial,
    isProfileLoading,
    isLoggingOut,
    onLogout,
}: AdminShellProps) {
    const t = useTranslations('Sidebar');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isSidebarOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSidebarOpen]);

    return (
        <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="admin-ledger-surface relative min-h-dvh overflow-x-hidden text-slate-800"
        >
            <LiquidBackground />

            <header className="sticky top-0 z-40 px-4 pt-4 lg:hidden">
                <div className="flex items-center justify-between rounded-2xl border border-white/55 bg-white/35 px-4 py-3 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(true)}
                            className="focus-ring inline-flex size-11 items-center justify-center rounded-xl border border-white/50 bg-white/30 text-slate-800 transition-all duration-200 hover:bg-white/50"
                            aria-label={t('openNavigation')}
                            aria-expanded={isSidebarOpen}
                        >
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="relative h-11 w-11 shrink-0 rounded-xl border border-white/55 bg-white/35 p-2 shadow-sm backdrop-blur-xl">
                                <Image src="/logo.png" alt="Amwag" fill sizes="44px" className="object-contain p-1.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="section-kicker text-slate-500">{t('adminPanel')}</p>
                                <p className="truncate text-sm font-bold text-slate-900">Amwag Admin</p>
                            </div>
                        </div>
                    </div>
                    <LanguageSwitcher />
                </div>
            </header>

            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AppSidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                userRole={userRole}
                adminName={adminName}
                adminJobTitle={adminJobTitle}
                adminInitial={adminInitial}
                isProfileLoading={isProfileLoading}
                isLoggingOut={isLoggingOut}
                onLogout={onLogout}
            />

            <main className="relative z-10 min-h-screen px-4 pb-8 pt-4 lg:pe-8 lg:ps-[22.5rem]">
                <PageReveal className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col">
                    <div className={cn('flex-1')}>{children}</div>
                    <Footer className="mt-12 border-t border-white/40 py-6" />
                </PageReveal>
            </main>
        </div>
    );
}
