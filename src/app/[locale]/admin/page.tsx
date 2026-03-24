'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock3, TriangleAlert, TrendingUp, Users, UserCheck, UserX } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, Input, Skeleton, addToast } from '@/components/ui';
import { getDashboardSummaryCacheKey } from '@/lib/utils';
import type { DashboardSummary } from '@/types';
import { getEgyptMonth } from '@/lib/timezone';

const summaryCards = [
    { key: 'expectedEmployees', icon: Users, accent: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10' },
    { key: 'presentCount', icon: UserCheck, accent: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' },
    { key: 'absentCount', icon: UserX, accent: 'text-red-300 border-red-500/20 bg-red-500/10' },
    { key: 'missingCheckoutCount', icon: TriangleAlert, accent: 'text-amber-300 border-amber-500/20 bg-amber-500/10' },
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
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <h1 className="text-2xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
                        {t('title')}
                    </h1>
                    <p className="text-sm text-slate-400 max-w-2xl">
                        {t('subtitle')}
                    </p>
                </div>

                <Card className="premium-card w-full max-w-md">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Calendar className="w-4 h-4 text-cyan-400" />
                            {selectedDate ? t('selectedDate') : t('selectedMonth')}
                        </div>
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
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {summaryCards.map((card) => (
                    <Card key={card.key} className="premium-card">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        {t(card.key)}
                                    </p>
                                    {isLoading ? (
                                        <Skeleton className="h-9 w-20" />
                                    ) : (
                                        <p className="text-3xl font-bold text-white">
                                            {summary?.[card.key] ?? 0}
                                        </p>
                                    )}
                                </div>
                                <div className={`rounded-2xl border p-3 ${card.accent}`}>
                                    <card.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="premium-card xl:col-span-2">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-semibold">{t('insightsTitle')}</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                                <p className="text-sm text-slate-400">{t('attendanceRate')}</p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {isLoading ? '...' : `${summary?.attendanceRate ?? 0}%`}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                                <p className="text-sm text-slate-400">{t('departureCompletionRate')}</p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {isLoading ? '...' : `${summary?.departureCompletionRate ?? 0}%`}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                                <p className="text-sm text-slate-400">{t('lateCount')}</p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {isLoading ? '...' : summary?.lateCount ?? 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="premium-card">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <Clock3 className="w-5 h-5 text-amber-400" />
                            <h2 className="text-lg font-semibold">{t('selectedDateOverview')}</h2>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 space-y-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                    {selectedDate ? t('selectedDate') : t('selectedMonth')}
                                </p>
                                <p className="mt-1 text-sm text-slate-200">{formattedSelectedDate}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('topBranch')}</p>
                                <p className="mt-1 text-sm text-slate-200">
                                    {isLoading
                                        ? '...'
                                        : summary?.topBranch
                                            ? `${summary.topBranch.name} (${summary.topBranch.attendanceRate}%)`
                                            : t('topBranchEmpty')}
                                </p>
                            </div>
                            <p className="text-sm text-slate-400">{t('dateFirstHint')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
