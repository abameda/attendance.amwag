'use client';

import { useEffect, useState } from 'react';
import {
    Calendar,
    Clock3,
    TrendingUp,
    TriangleAlert,
    UserCheck,
    UserX,
    Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, Input, PageReveal, Skeleton, StaggerGroup, StaggerItem, addToast } from '@/components/ui';
import { getDashboardSummaryCacheKey } from '@/lib/utils';
import type { DashboardSummary } from '@/types';
import { getEgyptMonth } from '@/lib/timezone';

const summaryCards = [
    {
        key: 'expectedEmployees',
        icon: Users,
        accent: 'bg-[rgba(255,255,255,0.72)] text-[#9d174d]',
    },
    {
        key: 'presentCount',
        icon: UserCheck,
        accent: 'bg-emerald-50 text-emerald-700',
    },
    {
        key: 'absentCount',
        icon: UserX,
        accent: 'bg-rose-50 text-rose-700',
    },
    {
        key: 'missingCheckoutCount',
        icon: TriangleAlert,
        accent: 'bg-amber-50 text-amber-700',
    },
] as const;

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
                <Card className="editorial-frame rounded-[2.5rem] border-[rgba(66,42,50,0.08)]">
                    <CardContent className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="section-kicker">{t('title')}</p>
                            <h1 className="display-serif text-4xl text-[#1d181c] sm:text-5xl">
                                Executive attendance overview
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[#6f6367]">
                                Follow daily attendance rhythm, monitor late arrivals, and keep
                                branch performance visible without losing the calm of the interface.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] p-4">
                                <p className="section-kicker">{t('attendanceRate')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                    {isLoading ? '...' : `${summary?.attendanceRate ?? 0}%`}
                                </p>
                            </div>
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] p-4">
                                <p className="section-kicker">{t('departureCompletionRate')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                    {isLoading ? '...' : `${summary?.departureCompletionRate ?? 0}%`}
                                </p>
                            </div>
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] p-4">
                                <p className="section-kicker">{t('lateCount')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                    {isLoading ? '...' : summary?.lateCount ?? 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.3rem]">
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-center gap-2 text-[#9d174d]">
                            <Calendar className="h-4 w-4" />
                            <p className="section-kicker">
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
                        <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                            <p className="section-kicker">Focus period</p>
                            <p className="mt-3 text-sm font-medium text-[#241d22]">
                                {formattedSelectedDate}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#72656a]">
                                {t('dateFirstHint')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>

            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <StaggerItem key={card.key}>
                        <Card interactive className="rounded-[2rem]">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-3">
                                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">
                                            {t(card.key)}
                                        </p>
                                        {isLoading ? (
                                            <Skeleton className="h-10 w-20" />
                                        ) : (
                                            <p className="text-4xl font-semibold text-[#1e191d]">
                                                {summary?.[card.key] ?? 0}
                                            </p>
                                        )}
                                    </div>
                                    <div className={`rounded-[1.4rem] p-3 ${card.accent}`}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </StaggerItem>
                ))}
            </StaggerGroup>

            <StaggerGroup className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <StaggerItem>
                    <Card className="rounded-[2.3rem]">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-[rgba(255,255,255,0.72)] p-2.5 text-[#9d174d]">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="section-kicker">{t('insightsTitle')}</p>
                                    <h2 className="text-xl font-semibold text-[#1e191d]">
                                        Snapshot metrics
                                    </h2>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                    <p className="text-sm text-[#786b70]">{t('attendanceRate')}</p>
                                    <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                        {isLoading ? '...' : `${summary?.attendanceRate ?? 0}%`}
                                    </p>
                                </div>
                                <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                    <p className="text-sm text-[#786b70]">{t('departureCompletionRate')}</p>
                                    <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                        {isLoading ? '...' : `${summary?.departureCompletionRate ?? 0}%`}
                                    </p>
                                </div>
                                <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                    <p className="text-sm text-[#786b70]">{t('lateCount')}</p>
                                    <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                        {isLoading ? '...' : summary?.lateCount ?? 0}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>

                <StaggerItem>
                    <Card className="rounded-[2.3rem]">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-amber-50 p-2.5 text-amber-700">
                                    <Clock3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="section-kicker">{t('selectedDateOverview')}</p>
                                    <h2 className="text-xl font-semibold text-[#1e191d]">
                                        Period notes
                                    </h2>
                                </div>
                            </div>

                            <div className="space-y-4 rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                <div>
                                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">
                                        {selectedDate ? t('selectedDate') : t('selectedMonth')}
                                    </p>
                                    <p className="mt-2 text-sm text-[#241d22]">{formattedSelectedDate}</p>
                                </div>
                                <div>
                                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">
                                        {t('topBranch')}
                                    </p>
                                    <p className="mt-2 text-sm text-[#241d22]">
                                        {isLoading
                                            ? '...'
                                            : summary?.topBranch
                                                ? `${summary.topBranch.name} (${summary.topBranch.attendanceRate}%)`
                                                : t('topBranchEmpty')}
                                    </p>
                                </div>
                                <p className="text-sm leading-6 text-[#72656a]">{t('dateFirstHint')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>
            </StaggerGroup>
        </div>
    );
}
