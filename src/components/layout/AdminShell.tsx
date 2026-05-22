'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AppSidebar from '@/components/layout/AppSidebar';
import LiquidBackground from '@/components/ui/LiquidBackground';
import { AnimatePresence, PageReveal, motion } from '@/components/ui';
import { cn } from '@/lib/utils';

const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement) {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter((element) => {
        const isHidden = element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden');
        return !isHidden && !element.hasAttribute('disabled') && element.tabIndex !== -1;
    });
}

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
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const sidebarDialogRef = useRef<HTMLElement>(null);
    const backgroundShouldBeInert = isSidebarOpen && isMobileViewport;

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);

        return () => mediaQuery.removeEventListener('change', syncViewport);
    }, []);

    useEffect(() => {
        if (!backgroundShouldBeInert) {
            return;
        }

        const dialog = sidebarDialogRef.current;
        if (!dialog) {
            return;
        }

        const menuButton = menuButtonRef.current;
        const originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusFrame = window.requestAnimationFrame(() => {
            const [firstFocusable] = getFocusableElements(dialog);
            (firstFocusable ?? dialog).focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setIsSidebarOpen(false);
                return;
            }

            if (event.key === 'Tab') {
                const focusableElements = getFocusableElements(dialog);
                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];

                if (!firstFocusable || !lastFocusable) {
                    event.preventDefault();
                    dialog.focus();
                    return;
                }

                if (event.shiftKey && (document.activeElement === firstFocusable || document.activeElement === dialog)) {
                    event.preventDefault();
                    lastFocusable.focus();
                    return;
                }

                if (!event.shiftKey && document.activeElement === lastFocusable) {
                    event.preventDefault();
                    firstFocusable.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalBodyOverflow;
            menuButton?.focus();
        };
    }, [backgroundShouldBeInert]);

    return (
        <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="admin-glass-surface relative min-h-dvh overflow-x-hidden text-[var(--foreground)]"
        >
            <LiquidBackground />

            <header
                className="sticky top-0 z-40 px-4 pt-4 lg:hidden"
                inert={backgroundShouldBeInert ? true : undefined}
                aria-hidden={backgroundShouldBeInert}
            >
                <div className="admin-glass-topbar flex items-center justify-between px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            ref={menuButtonRef}
                            type="button"
                            onClick={() => setIsSidebarOpen(true)}
                            className="focus-ring admin-glass-icon-button inline-flex size-11 items-center justify-center transition-all duration-200"
                            aria-label={t('openNavigation')}
                            aria-expanded={isSidebarOpen}
                            aria-controls="admin-mobile-navigation"
                        >
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="admin-glass-control relative h-11 w-11 shrink-0 p-2">
                                <Image src="/logo.png" alt="Amwag" fill sizes="44px" className="object-contain p-1.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="section-kicker text-slate-500">{t('adminPanel')}</p>
                        <p className="truncate text-sm font-bold text-[var(--admin-ink-strong)]">Amwag Admin</p>
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
                        className="fixed inset-0 z-40 bg-slate-950/[0.70] lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AppSidebar
                ref={sidebarDialogRef}
                dialogId="admin-mobile-navigation"
                labelId="admin-mobile-navigation-title"
                isMobileDialog={isMobileViewport}
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

            <main
                className="relative z-10 min-h-screen px-4 pb-8 pt-4 lg:pe-8 lg:ps-[22.5rem]"
                inert={backgroundShouldBeInert ? true : undefined}
                aria-hidden={backgroundShouldBeInert}
            >
                <PageReveal className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col">
                    <div className={cn('flex-1')}>{children}</div>
                    <Footer className="mt-12 border-t border-white/[0.12] py-6" />
                </PageReveal>
            </main>
        </div>
    );
}
