'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Globe2,
    Lock,
    Mail,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
    Button,
    Input,
    ToastContainer,
    addToast,
} from '@/components/ui';

export default function LoginPage() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Login');
    const tc = useTranslations('Common');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState('');

    const isRtl = locale === 'ar';
    const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

    const switchLocale = (nextLocale: 'en' | 'ar') => {
        if (nextLocale === locale) {
            return;
        }

        router.push(pathname.replace(`/${locale}`, `/${nextLocale}`));
    };

    const getLoginError = (error?: string) => {
        const normalized = (error ?? '').toLowerCase();

        if (normalized.includes('inactive')) {
            return t('inactiveError');
        }

        if (normalized.includes('branch') || normalized.includes('ip') || normalized.includes('network')) {
            return t('networkError');
        }

        if (normalized.includes('invalid email') || normalized.includes('password')) {
            return t('invalidCredentials');
        }

        if (normalized.includes('request')) {
            return t('invalidRequest');
        }

        return t('serverError');
    };

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const json = await response.json();

            if (!response.ok || !json.success) {
                setFormError(getLoginError(json.error));
                return;
            }

            const { role, mustChangePassword } = json.data as {
                role: 'admin' | 'accountant' | 'employee';
                mustChangePassword: boolean;
            };

            addToast(t('success'), 'success');

            if (mustChangePassword) {
                router.push(`/${locale}/change-password`);
            } else if (role === 'admin') {
                router.push(`/${locale}/admin`);
            } else if (role === 'accountant') {
                router.push(`/${locale}/admin/attendance`);
            } else {
                router.push(`/${locale}/employee`);
            }

            router.refresh();
        } catch (error) {
            console.error('Login request failed:', error);
            setFormError(t('serverError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-glass-surface login-graphite-shell relative z-10 flex min-h-screen w-full max-w-full overflow-hidden text-[var(--admin-ink)]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgb(37_99_235_/_0.16),transparent_34rem),radial-gradient(circle_at_82%_18%,rgb(14_116_144_/_0.12),transparent_30rem),linear-gradient(135deg,var(--admin-canvas-deep),var(--admin-canvas)_52%,oklch(11%_0.012_250))]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.055),transparent)]"
            />

            <div
                aria-hidden="true"
                className="login-background-mark pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[82vmin] w-[82vmin] min-w-[54rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.055]"
            >
                <Image
                    src="/logo.png"
                    alt=""
                    fill
                    className="object-contain"
                    priority
                />
            </div>

            <main className="relative z-10 flex min-h-screen w-full min-w-0 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
                <section className="login-card-shell admin-glass-panel-strong relative w-full max-w-[27rem] overflow-hidden p-5 sm:p-7">
                    <div
                        aria-hidden="true"
                        className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(147_197_253_/_0.46),transparent)]"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(96_165_250_/_0.14),transparent_16rem)]"
                    />

                    <div className="relative">
                        <div className="mb-6 flex justify-center">
                            <div className="admin-glass-control relative h-24 w-24 overflow-hidden rounded-[1.75rem] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.32)] sm:h-28 sm:w-28">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag Transportation"
                                    fill
                                    className="object-contain p-4"
                                    priority
                                />
                            </div>
                        </div>

                        <div className="mb-7 text-center">
                            <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">
                                {t('formEyebrow')}
                            </p>
                            <h1 className="mt-2 text-2xl font-bold leading-tight text-[var(--admin-ink-strong)]">
                                {t('formTitle')}
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-[var(--admin-text-soft)]">
                                {t('brand')}
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="min-w-0 space-y-5" noValidate>
                            <Input
                                id="email"
                                label={t('email')}
                                type="email"
                                placeholder={t('emailPlaceholder')}
                                value={email}
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    setFormError('');
                                }}
                                icon={<Mail className="h-4 w-4" />}
                                required
                                autoComplete="email"
                                autoFocus
                                disabled={isLoading}
                                className="admin-glass-control focus-ring min-h-12 rounded-xl ps-11 text-[var(--admin-ink-strong)] shadow-none outline-none placeholder:text-[var(--admin-text-muted)]"
                            />

                            <Input
                                id="password"
                                label={t('password')}
                                type="password"
                                placeholder={t('passwordPlaceholder')}
                                value={password}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    setFormError('');
                                }}
                                icon={<Lock className="h-4 w-4" />}
                                required
                                autoComplete="current-password"
                                disabled={isLoading}
                                className="admin-glass-control focus-ring min-h-12 rounded-xl ps-11 text-[var(--admin-ink-strong)] shadow-none outline-none placeholder:text-[var(--admin-text-muted)]"
                            />

                            {formError && (
                                <div
                                    className="admin-glass-alert-danger flex gap-3 p-3 text-sm leading-5"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p>{formError}</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="admin-glass-button-primary min-h-12 w-full justify-between rounded-xl shadow-none"
                                size="lg"
                                isLoading={isLoading}
                                disabled={!canSubmit}
                            >
                                <span>{isLoading ? t('signingIn') : t('submit')}</span>
                                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                            </Button>
                        </form>

                        <div className="mt-5 flex justify-center">
                            <div
                                className="admin-glass-control inline-flex shrink-0 items-center gap-1 rounded-2xl p-1"
                                aria-label={t('languageLabel')}
                            >
                                <Globe2 className="mx-2 hidden h-4 w-4 text-[var(--admin-text-soft)] sm:block" />
                                {(['en', 'ar'] as const).map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => switchLocale(item)}
                                        className={`focus-ring min-h-9 rounded-xl px-3 text-xs font-bold transition-all duration-200 ${
                                            locale === item
                                                ? 'border border-[rgb(96_165_250_/_0.34)] bg-[rgb(30_64_175_/_0.34)] text-[var(--admin-ink-strong)] shadow-[0_10px_24px_rgba(0,0,0,0.24)]'
                                                : 'border border-transparent text-[var(--admin-text-soft)] hover:bg-[rgb(255_255_255_/_0.085)] hover:text-[var(--admin-ink-strong)]'
                                        }`}
                                        aria-pressed={locale === item}
                                    >
                                        {item === 'en' ? 'EN' : 'AR'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <p className="mt-5 text-center text-xs leading-5 text-[var(--admin-text-muted)]">
                            {tc('developedBy')}{' '}
                            <a
                                href="https://www.shorbagy.space/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-[var(--admin-text-soft)] transition-colors hover:text-[var(--admin-primary)]"
                            >
                                {tc('devName')}
                            </a>
                        </p>
                    </div>
                </section>
                <ToastContainer />
            </main>
        </div>
    );
}
