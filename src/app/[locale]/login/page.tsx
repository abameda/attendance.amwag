'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Building2,
    CheckCircle2,
    Globe2,
    Lock,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
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
        <div className="relative z-10 flex min-h-screen flex-col bg-[oklch(96.2%_0.018_88)] text-[oklch(24.5%_0.018_125)] [--accent:oklch(42%_0.075_165)] [--accent-strong:oklch(35%_0.08_165)] [--bg-primary:oklch(96.2%_0.018_88)] [--danger:oklch(50%_0.13_28)] [--danger-soft:oklch(91%_0.05_28)] [--foreground:oklch(24.5%_0.018_125)] [--foreground-soft:oklch(39%_0.018_125)] [--line:oklch(84%_0.022_88)] [--line-strong:oklch(74%_0.028_88)] [--muted:oklch(49%_0.018_125)] [--muted-strong:oklch(37%_0.018_125)] [--shadow-glow-blue:0_0_0_3px_oklch(89%_0.045_165)] [--surface:oklch(98.5%_0.012_88)] [--surface-hover:oklch(94.8%_0.018_88)] [--surface-strong:oklch(98.5%_0.012_88)]">
            <main className="flex flex-1 items-center px-4 py-6 sm:px-6 lg:px-10">
                <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-[oklch(84%_0.022_88)] bg-[oklch(98.5%_0.012_88)] shadow-[0_18px_48px_oklch(24.5%_0.018_125_/_0.10)] lg:min-h-[680px] lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)]">
                    <section className="relative hidden bg-[oklch(93.4%_0.023_88)] p-8 lg:flex lg:flex-col lg:justify-between xl:p-10">
                        <div className="flex items-center gap-3 border-b border-[oklch(84%_0.022_88)] pb-6">
                            <div className="relative h-14 w-14 overflow-hidden rounded-md border border-[oklch(84%_0.022_88)] bg-[oklch(98.5%_0.012_88)]">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag Transportation"
                                    fill
                                    className="object-contain p-2"
                                    priority
                                />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[oklch(42%_0.075_165)]">
                                    {t('eyebrow')}
                                </p>
                                <p className="mt-1 text-base font-semibold text-[oklch(24.5%_0.018_125)]">
                                    {t('brand')}
                                </p>
                            </div>
                        </div>

                        <div className="relative max-w-md">
                            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[oklch(49%_0.018_125)]">
                                {t('accessPoint')}
                            </p>
                            <h1 className="mt-4 text-[2rem] font-bold leading-[1.15] text-[oklch(24.5%_0.018_125)]">
                                {t('title')}
                            </h1>
                            <p className="mt-5 max-w-[34rem] text-sm leading-6 text-[oklch(49%_0.018_125)]">
                                {t('subtitle')}
                            </p>
                        </div>

                        <div className="grid gap-3 text-sm">
                            {[
                                { icon: ShieldCheck, title: t('trustTitle'), body: t('trustBody') },
                                { icon: Building2, title: t('branchTitle'), body: t('branchBody') },
                                { icon: CheckCircle2, title: t('roleTitle'), body: t('roleBody') },
                            ].map((item) => (
                                <div
                                    key={item.title}
                                    className="flex gap-3 rounded-md border border-[oklch(84%_0.022_88)] bg-[oklch(98.5%_0.012_88)] p-4"
                                >
                                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(42%_0.075_165)]" />
                                    <div>
                                        <p className="font-semibold text-[oklch(24.5%_0.018_125)]">{item.title}</p>
                                        <p className="mt-1 leading-5 text-[oklch(49%_0.018_125)]">{item.body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="flex flex-col justify-center px-5 py-7 sm:px-8 lg:px-12 xl:px-16">
                        <div className="mb-10 flex items-start justify-between gap-4 lg:hidden">
                            <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 overflow-hidden rounded-md border border-[oklch(84%_0.022_88)] bg-[oklch(98.5%_0.012_88)]">
                                    <Image
                                        src="/logo.png"
                                        alt="Amwag Transportation"
                                        fill
                                        className="object-contain p-2"
                                        priority
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[oklch(42%_0.075_165)]">
                                        {t('eyebrow')}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">{t('brand')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mx-auto w-full max-w-md">
                            <div className="mb-8 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[oklch(42%_0.075_165)]">
                                        {t('formEyebrow')}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold leading-tight text-[oklch(24.5%_0.018_125)]">
                                        {t('formTitle')}
                                    </h2>
                                </div>
                                <div
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[oklch(84%_0.022_88)] bg-[oklch(94.8%_0.018_88)] p-1"
                                    aria-label={t('languageLabel')}
                                >
                                    <Globe2 className="mx-2 hidden h-4 w-4 text-[oklch(49%_0.018_125)] sm:block" />
                                    {(['en', 'ar'] as const).map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => switchLocale(item)}
                                            className={`min-h-9 rounded px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(48%_0.095_165)] ${
                                                locale === item
                                                    ? 'bg-[oklch(98.5%_0.012_88)] text-[oklch(42%_0.075_165)] shadow-[0_1px_2px_oklch(24.5%_0.018_125_/_0.08)]'
                                                    : 'text-[oklch(49%_0.018_125)] hover:text-[oklch(24.5%_0.018_125)]'
                                            }`}
                                            aria-pressed={locale === item}
                                        >
                                            {item === 'en' ? 'EN' : 'AR'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
                                    className="min-h-11 !rounded-md !bg-[oklch(98.5%_0.012_88)] !text-[oklch(24.5%_0.018_125)] !shadow-none focus-visible:!shadow-[0_0_0_3px_oklch(89%_0.045_165)]"
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
                                    className="min-h-11 !rounded-md !bg-[oklch(98.5%_0.012_88)] !text-[oklch(24.5%_0.018_125)] !shadow-none focus-visible:!shadow-[0_0_0_3px_oklch(89%_0.045_165)]"
                                />

                                {formError && (
                                    <div
                                        className="flex gap-3 rounded-md border border-[oklch(76%_0.07_28)] bg-[oklch(91%_0.05_28)] p-3 text-sm leading-5 text-[oklch(36%_0.11_28)]"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p>{formError}</p>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="min-h-11 w-full justify-between !rounded-md !bg-[oklch(42%_0.075_165)] !text-[oklch(98.5%_0.012_88)] !shadow-none hover:!translate-y-0 hover:!bg-[oklch(35%_0.08_165)]"
                                    size="lg"
                                    isLoading={isLoading}
                                    disabled={!canSubmit}
                                >
                                    <span>{isLoading ? t('signingIn') : t('submit')}</span>
                                    {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                </Button>
                            </form>

                            <div className="mt-6 rounded-md border border-[oklch(84%_0.022_88)] bg-[oklch(94.8%_0.018_88)] p-4">
                                <p className="text-sm font-semibold text-[oklch(24.5%_0.018_125)]">
                                    {t('supportTitle')}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-[oklch(49%_0.018_125)]">
                                    {t('supportBody')}
                                </p>
                            </div>

                            <p className="mt-8 text-xs leading-5 text-[oklch(49%_0.018_125)]">
                                {t('securityNote')}
                            </p>
                        </div>
                    </section>
                </div>
                <ToastContainer />
            </main>
            <Footer className="pb-4 pt-1" compact />
        </div>
    );
}
