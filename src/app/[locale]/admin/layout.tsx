'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import AdminShell from '@/components/layout/AdminShell';
import { ToastContainer, addToast } from '@/components/ui';

export default function AdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('Sidebar');
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [adminName, setAdminName] = useState('');
    const [adminJobTitle, setAdminJobTitle] = useState('');
    const [userRole, setUserRole] = useState<string>('admin');

    useEffect(() => {
        let isCancelled = false;

        const fetchAdminProfile = async () => {
            try {
                const response = await fetch('/api/auth/me', { credentials: 'include' });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    router.push(`/${locale}/login`);
                    return;
                }

                if (isCancelled) {
                    return;
                }

                setAdminName(result.data.full_name || '');
                setAdminJobTitle(result.data.job_title || t('administratorFallback'));
                setUserRole(result.data.role || 'admin');
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                console.error('Admin profile error:', error);
                addToast(t('profileLoadError'), 'error');
                router.push(`/${locale}/login`);
            } finally {
                if (!isCancelled) {
                    setIsProfileLoading(false);
                }
            }
        };

        void fetchAdminProfile();

        return () => {
            isCancelled = true;
        };
    }, [locale, router, t]);

    const handleLogout = useCallback(async () => {
        if (isLoggingOut) {
            return;
        }

        setIsLoggingOut(true);

        try {
            const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            if (!response.ok) {
                throw new Error('Logout failed');
            }

            router.push(`/${locale}/login`);
            router.refresh();
        } catch (error) {
            console.error('Admin logout error:', error);
            addToast(t('logoutError'), 'error');
            setIsLoggingOut(false);
        }
    }, [isLoggingOut, locale, router, t]);

    const adminInitial = adminName.trim().charAt(0).toLocaleUpperCase(locale === 'ar' ? 'ar-EG' : 'en-US') || 'A';

    return (
        <>
            <AdminShell
                locale={locale}
                userRole={userRole}
                adminName={adminName}
                adminJobTitle={adminJobTitle}
                adminInitial={adminInitial}
                isProfileLoading={isProfileLoading}
                isLoggingOut={isLoggingOut}
                onLogout={handleLogout}
            >
                {children}
            </AdminShell>
            <ToastContainer />
        </>
    );
}
