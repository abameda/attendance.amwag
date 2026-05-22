'use client';

import { useEffect, useState } from 'react';
import { Clock, Hourglass, Save, ShieldCheck, Timer, LogIn, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    Button,
    Card,
    CardContent,
    Input,
    PageReveal,
    Skeleton,
    StaggerGroup,
    StaggerItem,
    addToast,
} from '@/components/ui';

interface GlobalSettings {
    early_checkin_minutes: number;
    late_grace_minutes: number;
    checkout_window_minutes: number;
    max_overtime_minutes: number;
    updated_at?: string;
}

export default function SettingsPage() {
    const t = useTranslations('Settings');
    const [settings, setSettings] = useState<GlobalSettings>({
        early_checkin_minutes: 60,
        late_grace_minutes: 0,
        checkout_window_minutes: 60,
        max_overtime_minutes: 180,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/settings');
                const result = await response.json();
                if (result.success && result.data) {
                    setSettings(result.data);
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
                addToast(t('loadError'), 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [t]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    early_checkin_minutes: settings.early_checkin_minutes,
                    late_grace_minutes: settings.late_grace_minutes,
                    checkout_window_minutes: settings.checkout_window_minutes,
                    max_overtime_minutes: settings.max_overtime_minutes,
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error);
            }

            setSettings(result.data);
            addToast(t('saveSuccess'), 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            addToast(
                error instanceof Error ? error.message : t('saveError'),
                'error'
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-56 rounded-[2rem]" />
                    ))}
                </div>
            </div>
        );
    }

    const settingsCards = [
        {
            key: 'early_checkin_minutes',
            icon: LogIn,
            title: t('earlyCheckinTitle'),
            description: t('earlyCheckinDesc'),
            value: settings.early_checkin_minutes,
            min: 0,
            max: 180,
            unit: t('minutes'),
            accent: 'text-[var(--success)]',
            accentBg: 'bg-[var(--success-soft)]',
        },
        {
            key: 'late_grace_minutes',
            icon: Timer,
            title: t('lateGraceTitle'),
            description: t('lateGraceDesc'),
            value: settings.late_grace_minutes,
            min: 0,
            max: 60,
            unit: t('minutes'),
            accent: 'text-[var(--warning)]',
            accentBg: 'bg-[var(--warning-soft)]',
        },
        {
            key: 'checkout_window_minutes',
            icon: LogOut,
            title: t('checkoutWindowTitle'),
            description: t('checkoutWindowDesc'),
            value: settings.checkout_window_minutes,
            min: 0,
            max: 300,
            unit: t('minutes'),
            accent: 'text-[var(--accent)]',
            accentBg: 'bg-[var(--accent-soft)]',
        },
        {
            key: 'max_overtime_minutes',
            icon: Hourglass,
            title: t('maxOvertimeTitle'),
            description: t('maxOvertimeDesc'),
            value: settings.max_overtime_minutes,
            min: 0,
            max: 480,
            unit: t('minutes'),
            accent: 'text-[var(--secondary)]',
            accentBg: 'bg-[var(--secondary-soft)]',
        },
    ];

    return (
        <div className="space-y-8">
            <PageReveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-glow-blue)]">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('kicker')}</p>
                                <h1 className="text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">{t('title')}</h1>
                            </div>
                        </div>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t('subtitle')}</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        disabled={isSaving}
                        size="lg"
                    >
                        <Save className="h-4 w-4" />
                        {t('saveButton')}
                    </Button>
                </div>
            </PageReveal>

            <StaggerGroup className="grid gap-6 sm:grid-cols-2" delayChildren={0.08}>
                {settingsCards.map((card) => (
                    <StaggerItem key={card.key}>
                        <Card className="rounded-2xl">
                            <CardContent className="flex h-full flex-col space-y-5 p-6">
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.accentBg} ${card.accent}`}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-semibold text-[var(--foreground)]">
                                            {card.title}
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                                            {card.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-2">
                                    <div className="flex items-center gap-3">
                                        <Input
                                            type="number"
                                            min={card.min}
                                            max={card.max}
                                            value={card.value}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                if (!isNaN(val)) {
                                                    setSettings((prev) => ({
                                                        ...prev,
                                                        [card.key]: Math.min(Math.max(val, card.min), card.max),
                                                    }));
                                                }
                                            }}
                                            className="text-center text-lg font-semibold"
                                        />
                                        <span className="shrink-0 text-sm font-medium text-[var(--muted)]">
                                            {card.unit}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[0.68rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                                        <span>{t('min')}: {card.min}</span>
                                        <span>{t('max')}: {card.max}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </StaggerItem>
                ))}
            </StaggerGroup>

            <PageReveal delay={0.2}>
                <Card className="rounded-[2rem]">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                                <Clock className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--foreground)]">{t('howItWorksTitle')}</h3>
                                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                    {t('howItWorksBody')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>
        </div>
    );
}
