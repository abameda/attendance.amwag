'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Clock,
    Gauge,
    History,
    Info,
    RefreshCw,
    ShieldAlert,
    Timer,
    TrendingUp,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AnimatedCounter,
    Badge,
    Button,
    Input,
    PageReveal,
    Skeleton,
    addToast,
} from '@/components/ui';
import { ChartWrapper, GlassTooltip, liquidChartDefaults } from '@/components/ui/ChartWrapper';
import { formatDate, formatEarlyDeparture, formatLateness, formatOvertime, formatTimestamp } from '@/lib/utils';

type RangePreset = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days' | 'custom' | 'all';

type AnalyticsResponse = {
    employee: {
        id: string;
        email: string;
        full_name: string;
        branch: string | null;
        job_title: string | null;
        shift_start: string | null;
        shift_end: string | null;
        off_day: string | null;
        overtime_enabled: boolean;
    };
    range: {
        preset: RangePreset;
        from: string | null;
        to: string;
    };
    summary: {
        expectedWorkingDays: number;
        presentDays: number;
        absentDays: number;
        onTimeDays: number;
        lateDays: number;
        earlyLeaveDays: number;
        missingCheckoutDays: number;
        overtimeDays: number;
        attendanceRate: number;
        punctualityRate: number;
        departureCompletionRate: number;
        totalLateMinutes: number;
        averageLateMinutes: number;
        totalOvertimeMinutes: number;
        averageCheckInTime: string | null;
        averageCheckOutTime: string | null;
    };
    trends: {
        daily: Array<{
            date: string;
            status: 'present' | 'late' | 'absent' | 'missing_checkout' | 'no_record';
            present: number;
            absent: number;
            lateMinutes: number;
            overtimeMinutes: number;
        }>;
    };
    insights: Array<{
        code: string;
        severity: 'positive' | 'warning' | 'neutral';
        title: string;
        detail: string;
    }>;
    history: Array<{
        id: string;
        date: string;
        shift: string | null;
        checkIn: string | null;
        checkOut: string | null;
        lateMinutes: number;
        earlyDepartureMinutes: number;
        overtimeMinutes: number;
        status: 'present' | 'late' | 'absent' | 'missing_checkout';
        ipAddress: string | null;
        checkOutIp: string | null;
        location: string | null;
    }>;
    comparison: {
        branchAverage: { attendanceRate: number | null; expectedWorkingDays: number; presentDays: number };
        companyAverage: { attendanceRate: number | null; expectedWorkingDays: number; presentDays: number };
    };
    score: {
        value: number;
        deductions: Array<{ reason: string; points: number }>;
    };
};

const presetValues: RangePreset[] = [
    'this_month',
    'last_month',
    'last_7_days',
    'last_30_days',
    'custom',
    'all',
];

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
    return `${todayIsoDate().slice(0, 7)}-01`;
}

function formatPercent(value: number | null) {
    return value === null ? '-' : `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;
}

function formatAverageTime(value: string | null, locale: string) {
    if (!value) return '-';
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatShift(shift: string | null) {
    return shift ?? '-';
}

function insightClass(severity: AnalyticsResponse['insights'][number]['severity']) {
    if (severity === 'positive') return 'border-[color-mix(in_oklab,var(--success)_35%,var(--line))] bg-[color-mix(in_oklab,var(--success)_10%,var(--surface))]';
    if (severity === 'warning') return 'border-[color-mix(in_oklab,var(--warning)_35%,var(--line))] bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))]';
    return 'border-[var(--line)] bg-[var(--surface)]';
}

function firstNumber(value: string) {
    return value.match(/\d+(?:\.\d+)?/)?.[0] ?? '0';
}

export default function EmployeeAnalyticsPage() {
    const params = useParams<{ id: string; locale: string }>();
    const t = useTranslations('EmployeeAnalytics');
    const employeeId = params.id;
    const locale = params.locale;
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [preset, setPreset] = useState<RangePreset>('this_month');
    const [from, setFrom] = useState(firstDayOfMonth);
    const [to, setTo] = useState(todayIsoDate);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const query = new URLSearchParams({ preset });
        if (preset === 'custom') {
            if (from) query.set('from', from);
            if (to) query.set('to', to);
        }

        setIsLoading(true);
        void (async () => {
            try {
                const response = await fetch(`/api/admin/employees/${employeeId}/attendance-analytics?${query.toString()}`, {
                    signal: controller.signal,
                    credentials: 'include',
                });
                const result: { success: boolean; data?: AnalyticsResponse; error?: string } = await response.json();
                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.error || t('loadError'));
                }
                setAnalytics(result.data);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Employee analytics load error:', error);
                setAnalytics(null);
                addToast(error instanceof Error ? error.message : t('loadError'), 'error');
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [employeeId, from, preset, refreshKey, t, to]);

    const kpiCards = useMemo(() => {
        if (!analytics) return [];
        const summary = analytics.summary;
        return [
            { label: t('expectedWorkingDays'), value: summary.expectedWorkingDays, icon: Calendar },
            { label: t('presentDays'), value: summary.presentDays, icon: CheckCircle2 },
            { label: t('absentDays'), value: summary.absentDays, icon: ShieldAlert },
            { label: t('onTimeDays'), value: summary.onTimeDays, icon: Clock },
            { label: t('lateDays'), value: summary.lateDays, icon: Timer },
            { label: t('earlyLeaveDays'), value: summary.earlyLeaveDays, icon: ArrowLeft },
            { label: t('missingCheckoutDays'), value: summary.missingCheckoutDays, icon: History },
            { label: t('overtimeDays'), value: summary.overtimeDays, icon: TrendingUp },
            { label: t('attendanceRate'), value: formatPercent(summary.attendanceRate), icon: Gauge },
            { label: t('punctualityRate'), value: formatPercent(summary.punctualityRate), icon: Clock },
            { label: t('departureCompletion'), value: formatPercent(summary.departureCompletionRate), icon: CheckCircle2 },
            { label: t('totalLateMinutes'), value: summary.totalLateMinutes, icon: Timer },
            { label: t('averageLateMinutes'), value: summary.averageLateMinutes, icon: Timer },
            { label: t('totalOvertimeMinutes'), value: summary.totalOvertimeMinutes, icon: TrendingUp },
            { label: t('averageCheckIn'), value: formatAverageTime(summary.averageCheckInTime, locale), icon: Clock },
            { label: t('averageCheckOut'), value: formatAverageTime(summary.averageCheckOutTime, locale), icon: Clock },
        ];
    }, [analytics, locale, t]);

    const activeRangeLabel = analytics?.range.from
        ? t('rangeFromTo', { from: analytics.range.from, to: analytics.range.to })
        : analytics?.range.to
            ? t('rangeThrough', { to: analytics.range.to })
            : '-';

    const localizedInsight = (insight: AnalyticsResponse['insights'][number]) => {
        if (!analytics) return insight;

        if (insight.code === 'no_records') {
            return { title: t('insights.no_records.title'), detail: t('insights.no_records.detail') };
        }
        if (insight.code === 'frequent_late') {
            return {
                title: t('insights.frequent_late.title'),
                detail: t('insights.frequent_late.detail', {
                    lateDays: analytics.summary.lateDays,
                    presentDays: analytics.summary.presentDays,
                }),
            };
        }
        if (insight.code === 'late_weekday_pattern') {
            const day = insight.title.match(/on ([A-Za-z]+)\./)?.[1] ?? '';
            return {
                title: t('insights.late_weekday_pattern.title', {
                    day: day ? t(`weekdays.${day}`) : '-',
                }),
                detail: t('insights.late_weekday_pattern.detail', { count: firstNumber(insight.detail) }),
            };
        }
        if (insight.code === 'attendance_improved') {
            return {
                title: t('insights.attendance_improved.title'),
                detail: t('insights.attendance_improved.detail', { delta: firstNumber(insight.detail) }),
            };
        }
        if (insight.code === 'attendance_declined') {
            return {
                title: t('insights.attendance_declined.title'),
                detail: t('insights.attendance_declined.detail', { delta: firstNumber(insight.detail) }),
            };
        }
        if (insight.code === 'repeated_missing_checkout') {
            return {
                title: t('insights.repeated_missing_checkout.title'),
                detail: t('insights.repeated_missing_checkout.detail', {
                    missingCheckoutDays: analytics.summary.missingCheckoutDays,
                }),
            };
        }
        if (insight.code === 'strong_consistency') {
            return { title: t('insights.strong_consistency.title'), detail: t('insights.strong_consistency.detail') };
        }
        if (insight.code === 'early_leave_pattern') {
            return {
                title: t('insights.early_leave_pattern.title'),
                detail: t('insights.early_leave_pattern.detail', {
                    earlyLeaveDays: analytics.summary.earlyLeaveDays,
                }),
            };
        }
        if (insight.code === 'frequent_overtime') {
            return {
                title: t('insights.frequent_overtime.title'),
                detail: t('insights.frequent_overtime.detail', {
                    overtimeDays: analytics.summary.overtimeDays,
                }),
            };
        }
        if (insight.code === 'stable_period') {
            return { title: t('insights.stable_period.title'), detail: t('insights.stable_period.detail') };
        }

        return insight;
    };

    return (
        <div className="employee-analytics-command space-y-6">
            <PageReveal>
                <Link
                    href={`/${locale}/admin/employees`}
                    className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--admin-glass-border)] bg-[var(--admin-glass)] px-4 py-2 text-sm font-semibold text-[var(--admin-text-soft)] backdrop-blur-md transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--admin-ink-strong)]"
                >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    {t('backToEmployees')}
                </Link>
            </PageReveal>

            <PageReveal className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="admin-glass-panel-strong overflow-hidden p-5 sm:p-6">
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div className="min-w-0 space-y-4">
                            <p className="section-kicker">{t('kicker')}</p>
                            {isLoading || !analytics ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-64 rounded-xl" />
                                    <Skeleton className="h-5 w-full max-w-xl rounded-xl" />
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold leading-tight text-[var(--admin-ink-strong)] sm:text-4xl" dir="auto">
                                        {analytics.employee.full_name}
                                    </h1>
                                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--admin-text-soft)]">
                                        <span className="admin-glass-panel-muted px-3 py-2">{analytics.employee.job_title || t('fallbackJobTitle')}</span>
                                        {analytics.employee.branch && <span className="admin-glass-panel-muted px-3 py-2">{analytics.employee.branch}</span>}
                                        <span className="admin-glass-panel-muted px-3 py-2">{activeRangeLabel}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[25rem]">
                            {[
                                { label: t('attendanceRate'), value: analytics ? formatPercent(analytics.summary.attendanceRate) : '-' },
                                { label: t('punctuality'), value: analytics ? formatPercent(analytics.summary.punctualityRate) : '-' },
                                { label: t('score'), value: analytics ? analytics.score.value : '-' },
                            ].map((item) => (
                                <div key={item.label} className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]">
                                    <p className="text-[0.68rem] font-semibold uppercase text-[var(--admin-text-muted)]">{item.label}</p>
                                    <p className="mt-2 text-2xl font-semibold text-[var(--admin-ink-strong)]">
                                        {typeof item.value === 'number' ? <AnimatedCounter value={item.value} /> : item.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="admin-glass-panel p-5">
                    <div className="space-y-4">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('dateRange')}</p>
                        <select
                            value={preset}
                            onChange={(event) => setPreset(event.target.value as RangePreset)}
                            className="admin-glass-control focus-ring w-full cursor-pointer rounded-xl px-4 py-3 text-sm"
                        >
                            {presetValues.map((option) => (
                                <option key={option} value={option} className="bg-[var(--bg-secondary)] text-[var(--foreground)]">
                                    {t(`presets.${option}`)}
                                </option>
                            ))}
                        </select>

                        {preset === 'custom' && (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={t('fromDate')} className="admin-glass-control rounded-xl" />
                                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label={t('toDate')} className="admin-glass-control rounded-xl" />
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRefreshKey((value) => value + 1)}
                            className="admin-glass-button-secondary w-full justify-between"
                        >
                            {t('refresh')}
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </section>
            </PageReveal>

            <PageReveal delay={0.05}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
                        : kpiCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div key={card.label} className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-[0.68rem] font-semibold uppercase text-[var(--admin-text-muted)]">{card.label}</p>
                                        <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                    </div>
                                    <p className="mt-3 text-2xl font-semibold text-[var(--admin-ink-strong)]">
                                        {typeof card.value === 'number' ? <AnimatedCounter value={card.value} /> : card.value}
                                    </p>
                                </div>
                            );
                        })}
                </div>
            </PageReveal>

            <PageReveal delay={0.08} className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                <section className="analytics-score-instrument admin-glass-panel-strong p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('attendanceScore')}</p>
                        <Gauge className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    {analytics ? (
                        <div className="mt-5 space-y-5">
                            <div className="flex items-end gap-3">
                                <p className="text-6xl font-semibold leading-none text-[var(--admin-ink-strong)]">{analytics.score.value}</p>
                                <p className="pb-2 text-sm text-[var(--admin-text-muted)]">{t('outOf100')}</p>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.08)]">
                                <div
                                    className="h-full rounded-full bg-[var(--accent)]"
                                    style={{ width: `${Math.max(0, Math.min(100, analytics.score.value))}%` }}
                                />
                            </div>
                            <div className="space-y-2">
                                {analytics.score.deductions.length === 0 ? (
                                    <p className="admin-glass-highlight p-3 text-sm text-[var(--admin-text-soft)]">
                                        {t('noDeductions')}
                                    </p>
                                ) : (
                                    analytics.score.deductions.map((deduction) => (
                                        <div key={deduction.reason} className="admin-glass-panel-muted flex items-center justify-between gap-4 p-3 text-sm">
                                            <span className="text-[var(--admin-text-soft)]">{deduction.reason}</span>
                                            <span className="font-semibold text-[var(--warning)]">-{deduction.points}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <Skeleton className="mt-5 h-40 rounded-2xl" />
                    )}
                </section>

                <section className="admin-glass-panel p-5 sm:p-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('ruleInsights')}</p>
                    {isLoading ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <Skeleton className="h-24 rounded-xl" />
                            <Skeleton className="h-24 rounded-xl" />
                        </div>
                    ) : analytics && analytics.insights.length > 0 ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {analytics.insights.map((insight) => (
                                <div key={insight.code} className={`rounded-xl border p-4 backdrop-blur-md ${insightClass(insight.severity)}`}>
                                    <div className="flex items-start gap-3">
                                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                                        <div>
                                            <p className="font-semibold text-[var(--admin-ink-strong)]">{localizedInsight(insight).title}</p>
                                            <p className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">{localizedInsight(insight).detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="admin-glass-panel-muted mt-4 p-6 text-center text-sm text-[var(--admin-text-muted)]">
                            {t('noInsights')}
                        </p>
                    )}
                </section>
            </PageReveal>

            <PageReveal delay={0.1} className="grid gap-6 xl:grid-cols-2">
                <section className="admin-glass-panel p-5 sm:p-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('attendanceTrend')}</p>
                    {analytics && analytics.trends.daily.length > 0 ? (
                        <ChartWrapper height={280}>
                            <AreaChart data={analytics.trends.daily}>
                                <defs>
                                    <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.42} />
                                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="absentFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.28} />
                                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...liquidChartDefaults.cartesianGrid} />
                                <XAxis dataKey="date" {...liquidChartDefaults.axis} />
                                <YAxis {...liquidChartDefaults.axis} />
                                <GlassTooltip />
                                <Area type="monotone" dataKey="present" stroke="var(--accent)" fill="url(#presentFill)" strokeWidth={2} />
                                <Area type="monotone" dataKey="absent" stroke="var(--danger)" fill="url(#absentFill)" strokeWidth={2} />
                            </AreaChart>
                        </ChartWrapper>
                    ) : (
                        <p className="py-16 text-center text-sm text-[var(--admin-text-muted)]">{t('noTrend')}</p>
                    )}
                </section>

                <section className="admin-glass-panel p-5 sm:p-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('minutesTrend')}</p>
                    {analytics && analytics.trends.daily.length > 0 ? (
                        <ChartWrapper height={280}>
                            <BarChart data={analytics.trends.daily}>
                                <CartesianGrid {...liquidChartDefaults.cartesianGrid} />
                                <XAxis dataKey="date" {...liquidChartDefaults.axis} />
                                <YAxis {...liquidChartDefaults.axis} />
                                <GlassTooltip />
                                <Bar dataKey="lateMinutes" name={t('lateMinutes')} fill="var(--warning)" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="overtimeMinutes" name={t('overtimeMinutes')} fill="var(--success)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ChartWrapper>
                    ) : (
                        <p className="py-16 text-center text-sm text-[var(--admin-text-muted)]">{t('noMinutesTrend')}</p>
                    )}
                </section>
            </PageReveal>

            <PageReveal delay={0.12} className="grid gap-6 xl:grid-cols-[0.74fr_1.26fr]">
                <section className="admin-glass-panel p-5 sm:p-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('comparison')}</p>
                    {analytics ? (
                        <div className="mt-4 space-y-3">
                            {[
                                { label: t('employeeAttendanceRate'), value: formatPercent(analytics.summary.attendanceRate), icon: CheckCircle2 },
                                { label: t('branchAverage'), value: formatPercent(analytics.comparison.branchAverage.attendanceRate), icon: Calendar },
                                { label: t('companyAverage'), value: formatPercent(analytics.comparison.companyAverage.attendanceRate), icon: Gauge },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} className="admin-glass-panel-muted flex items-center justify-between gap-4 p-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                            <p className="truncate text-sm text-[var(--admin-text-muted)]">{item.label}</p>
                                        </div>
                                        <p className="text-2xl font-semibold text-[var(--admin-ink-strong)]">{item.value}</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <Skeleton className="mt-4 h-64 rounded-2xl" />
                    )}
                </section>

                <section className="admin-glass-panel p-5 sm:p-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('absenceOvertimeSummary')}</p>
                    {analytics && analytics.trends.daily.length > 0 ? (
                        <ChartWrapper height={300}>
                            <BarChart data={analytics.trends.daily}>
                                <CartesianGrid {...liquidChartDefaults.cartesianGrid} />
                                <XAxis dataKey="date" {...liquidChartDefaults.axis} />
                                <YAxis {...liquidChartDefaults.axis} />
                                <GlassTooltip />
                                <Bar dataKey="absent" name={t('absence')} fill="var(--danger)" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="overtimeMinutes" name={t('overtimeMinutes')} fill="var(--success)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ChartWrapper>
                    ) : (
                        <p className="py-16 text-center text-sm text-[var(--admin-text-muted)]">{t('noAbsenceOvertime')}</p>
                    )}
                </section>
            </PageReveal>

            <PageReveal delay={0.14}>
                <section className="analytics-history-table admin-glass-table">
                    <div className="border-b border-[var(--line)] px-5 py-4">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">{t('attendanceHistory')}</p>
                    </div>
                    <div className="custom-scrollbar overflow-x-auto">
                        <table className="w-full min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-[var(--line)] bg-[rgb(255_255_255_/_0.055)]">
                                    {[
                                        t('table.date'),
                                        t('table.shift'),
                                        t('table.checkIn'),
                                        t('table.checkOut'),
                                        t('table.late'),
                                        t('table.earlyLeave'),
                                        t('table.overtime'),
                                        t('table.status'),
                                        t('table.location'),
                                        t('table.ip'),
                                    ].map((heading) => (
                                        <th key={heading} className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--admin-text-muted)]">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, rowIndex) => (
                                        <tr key={rowIndex} className="admin-glass-table-row">
                                            {Array.from({ length: 10 }).map((__, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-4">
                                                    <Skeleton className="h-9 w-full rounded-xl" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : analytics && analytics.history.length > 0 ? (
                                    analytics.history.map((record) => (
                                        <tr key={record.id} className="admin-glass-table-row">
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatDate(record.date)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatShift(record.shift)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatTimestamp(record.checkIn)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatTimestamp(record.checkOut)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatLateness(record.lateMinutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatEarlyDeparture(record.earlyDepartureMinutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]">{formatOvertime(record.overtimeMinutes)}</td>
                                            <td className="px-4 py-4">
                                                <Badge variant={record.status}>{t(`status.${record.status}`)}</Badge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--admin-text-soft)]" dir="auto">{record.location || '-'}</td>
                                            <td className="px-4 py-4 font-mono text-xs text-[var(--admin-text-muted)]">
                                                {record.ipAddress || '-'}{record.checkOutIp && record.checkOutIp !== record.ipAddress ? ` / ${record.checkOutIp}` : ''}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-12 text-center text-sm text-[var(--admin-text-muted)]">
                                            {t('noRecords')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </PageReveal>
        </div>
    );
}
