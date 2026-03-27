'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, Clock3, TrendingUp, TriangleAlert, UserCheck, UserX, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useSpring, useMotionValue, useInView } from 'framer-motion';
import { AnimatedCounter, Card, CardContent, GlowingCard, Input, PageReveal, Skeleton, StaggerGroup, StaggerItem, addToast } from '@/components/ui';
import { getDashboardSummaryCacheKey } from '@/lib/utils';
import type { DashboardSummary } from '@/types';
import { getEgyptMonth } from '@/lib/timezone';

const summaryCards = [
    { key: 'expectedEmployees' as const, icon: Users,         iconBg: 'bg-[var(--accent-soft)]',   iconColor: 'text-[var(--accent)]'   },
    { key: 'presentCount'      as const, icon: UserCheck,     iconBg: 'bg-[var(--success-soft)]',  iconColor: 'text-[var(--success)]'  },
    { key: 'absentCount'       as const, icon: UserX,         iconBg: 'bg-[var(--danger-soft)]',   iconColor: 'text-[var(--danger)]'   },
    { key: 'missingCheckoutCount' as const, icon: TriangleAlert, iconBg: 'bg-[var(--warning-soft)]', iconColor: 'text-[var(--warning)]' },
];

function AttendanceGauge({ value, label }: { value: number; label: string }) {
    const radius = 78;
    const cx = 110;
    const cy = 100;
    const circumference = Math.PI * radius;
    const containerRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(containerRef, { once: true });
    const motionOffset = useMotionValue(circumference);
    const springOffset = useSpring(motionOffset, { stiffness: 40, damping: 20 });

    useEffect(() => {
        if (isInView) {
            motionOffset.set(circumference * (1 - value / 100));
        }
    }, [isInView, value, circumference, motionOffset]);

    const gradId = `gauge-${label.replace(/\s+/g, '-')}`;

    return (
        <div ref={containerRef} className="flex flex-col items-center">
            <svg width="220" height="120" viewBox="0 0 220 110" aria-hidden="true">
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#EF4444" />
                        <stop offset="50%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                </defs>
                <path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                <motion.path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset: springOffset }}
                />
                <text x={cx} y={cy - 18} textAnchor="middle" fill="var(--foreground)" fontSize="24" fontWeight="700">
                    {value}%
                </text>
                <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--muted)" fontSize="10">
                    {label}
                </text>
            </svg>
        </div>
    );
}

export default function AdminDashboard() {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const [selectedMonth, setSelectedMonth] = useState(() => getEgyptMonth());
    const [selectedDate, setSelectedDate] = useState('');
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const activePeriod = selectedDate || selectedMonth;

    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedDate) {
            params.set('date', selectedDate);
        } else {
            params.set('month', selectedMonth);
        }

        const cacheKey = getDashboardSummaryCacheKey(activePeriod);
        const cachedSummary = sessionStorage.getItem(cacheKey);
        if (cachedSummary) {
            setSummary(JSON.parse(cachedSummary) as DashboardSummary);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);

        void (async () => {
            try {
                const response = await fetch(`/api/attendance/summary?${params.toString()}`, {
                    signal: controller.signal,
                });
                const result: {
                    success: boolean;
                    data?: DashboardSummary;
                    error?: string;
                } = await response.json();

                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.error || 'Failed to fetch attendance summary');
                }

                setSummary(result.data);
                sessionStorage.setItem(cacheKey, JSON.stringify(result.data));
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Dashboard summary error:', error);
                setSummary(null);
                addToast(t('loadError'), 'error');
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [activePeriod, selectedDate, selectedMonth, t]);

    const formattedSelectedDate = selectedDate
        ? new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : new Date(`${selectedMonth}-01T12:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
              year: 'numeric',
              month: 'long',
          });

    return (
        <div className="space-y-6">
            <PageReveal className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                {/* Hero GlowingCard */}
                <GlowingCard halo>
                    <div className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('title')}</p>
                            <h1 className="gradient-text text-4xl font-bold sm:text-5xl">
                                Executive attendance overview
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                                Follow daily attendance rhythm, monitor late arrivals, and keep
                                branch performance visible without losing the calm of the interface.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('attendanceRate')}</p>
                                {isLoading ? (
                                    <Skeleton className="mt-3 h-8 w-20" />
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                        <AnimatedCounter value={summary?.attendanceRate ?? 0} suffix="%" />
                                    </p>
                                )}
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('departureCompletionRate')}</p>
                                {isLoading ? (
                                    <Skeleton className="mt-3 h-8 w-20" />
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                        <AnimatedCounter value={summary?.departureCompletionRate ?? 0} suffix="%" />
                                    </p>
                                )}
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('lateCount')}</p>
                                {isLoading ? (
                                    <Skeleton className="mt-3 h-8 w-20" />
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                        <AnimatedCounter value={summary?.lateCount ?? 0} />
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </GlowingCard>

                {/* Date Picker Card */}
                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[var(--accent)]" />
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                {selectedDate ? t('selectedDate') : t('selectedMonth')}
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(event) => {
                                    setSelectedMonth(event.target.value);
                                    setSelectedDate('');
                                }}
                            />
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(event) => {
                                    const nextDate = event.target.value;
                                    setSelectedDate(nextDate);
                                    if (nextDate) {
                                        setSelectedMonth(nextDate.slice(0, 7));
                                    }
                                }}
                            />
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Focus period</p>
                            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                                {formattedSelectedDate}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                                {t('dateFirstHint')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>

            {/* 4 Stat Cards */}
            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <StaggerItem key={card.key}>
                        <GlowingCard>
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                            {t(card.key)}
                                        </p>
                                        {isLoading ? (
                                            <Skeleton className="h-10 w-20" />
                                        ) : (
                                            <p className="text-4xl font-semibold text-[var(--foreground)]">
                                                <AnimatedCounter value={summary?.[card.key] ?? 0} />
                                            </p>
                                        )}
                                    </div>
                                    <div className={`rounded-xl p-3 ${card.iconBg}`}>
                                        <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                                    </div>
                                </div>
                            </div>
                        </GlowingCard>
                    </StaggerItem>
                ))}
            </StaggerGroup>

            {/* Insights + Period Notes */}
            <StaggerGroup className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <StaggerItem>
                    <Card className="rounded-2xl">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-[var(--accent-soft)] p-2.5">
                                    <TrendingUp className="h-5 w-5 text-[var(--accent)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('insightsTitle')}</p>
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                        Snapshot metrics
                                    </h2>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    {isLoading ? (
                                        <Skeleton className="h-[120px] w-full" />
                                    ) : (
                                        <AttendanceGauge value={summary?.attendanceRate ?? 0} label={t('attendanceRate')} />
                                    )}
                                </div>
                                <div className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    {isLoading ? (
                                        <Skeleton className="h-[120px] w-full" />
                                    ) : (
                                        <AttendanceGauge value={summary?.departureCompletionRate ?? 0} label={t('departureCompletionRate')} />
                                    )}
                                </div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <p className="text-sm text-[var(--muted)]">{t('lateCount')}</p>
                                    <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                        {isLoading ? '...' : <AnimatedCounter value={summary?.lateCount ?? 0} />}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>

                <StaggerItem>
                    <Card className="rounded-2xl">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-[var(--warning-soft)] p-2.5">
                                    <Clock3 className="h-5 w-5 text-[var(--warning)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('selectedDateOverview')}</p>
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                        Period notes
                                    </h2>
                                </div>
                            </div>

                            <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                        {selectedDate ? t('selectedDate') : t('selectedMonth')}
                                    </p>
                                    <p className="mt-2 text-sm text-[var(--foreground-soft)]">{formattedSelectedDate}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                        {t('topBranch')}
                                    </p>
                                    <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                                        {isLoading
                                            ? '...'
                                            : summary?.topBranch
                                                ? `${summary.topBranch.name} (${summary.topBranch.attendanceRate}%)`
                                                : t('topBranchEmpty')}
                                    </p>
                                </div>
                                <p className="text-sm leading-6 text-[var(--muted)]">{t('dateFirstHint')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>
            </StaggerGroup>
        </div>
    );
}
