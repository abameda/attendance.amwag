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
    Line,
    LineChart,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AnimatedCounter,
    Badge,
    Button,
    Card,
    CardContent,
    ChartWrapper,
    DarkTooltip,
    GlowingCard,
    Input,
    PageReveal,
    Skeleton,
    darkChartDefaults,
    addToast,
} from '@/components/ui';
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
        <div className="space-y-6">
            <PageReveal>
                <Link
                    href={`/${locale}/admin/employees`}
                    className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground-soft)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    {t('backToEmployees')}
                </Link>
            </PageReveal>

            <PageReveal className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <GlowingCard>
                    <div className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('kicker')}</p>
                            {isLoading || !analytics ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-64 rounded-xl" />
                                    <Skeleton className="h-5 w-full max-w-xl rounded-xl" />
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-4xl font-bold text-[var(--foreground)] sm:text-5xl" dir="auto">
                                        {analytics.employee.full_name}
                                    </h1>
                                    <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                                        {analytics.employee.job_title || t('fallbackJobTitle')}{analytics.employee.branch ? `, ${analytics.employee.branch}` : ''}. {activeRangeLabel}
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t('attendanceRate')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                    {analytics ? formatPercent(analytics.summary.attendanceRate) : '-'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t('punctuality')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                    {analytics ? formatPercent(analytics.summary.punctualityRate) : '-'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t('score')}</p>
                                <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                    {analytics ? <AnimatedCounter value={analytics.score.value} /> : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </GlowingCard>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('dateRange')}</p>
                        <select
                            value={preset}
                            onChange={(event) => setPreset(event.target.value as RangePreset)}
                            className="focus-ring w-full cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]"
                        >
                            {presetValues.map((option) => (
                                <option key={option} value={option} className="bg-[var(--bg-secondary)] text-[var(--foreground)]">
                                    {t(`presets.${option}`)}
                                </option>
                            ))}
                        </select>

                        {preset === 'custom' && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={t('fromDate')} />
                                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label={t('toDate')} />
                            </div>
                        )}

                        <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)} className="w-full justify-between">
                            {t('refresh')}
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.05}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
                        : kpiCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Card key={card.label} className="rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{card.label}</p>
                                            <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                        </div>
                                        <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                                            {typeof card.value === 'number' ? <AnimatedCounter value={card.value} /> : card.value}
                                        </p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>
            </PageReveal>

            <PageReveal delay={0.08} className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('attendanceScore')}</p>
                            <Gauge className="h-5 w-5 text-[var(--accent)]" />
                        </div>
                        {analytics ? (
                            <>
                                <div className="flex items-end gap-3">
                                    <p className="text-6xl font-semibold text-[var(--foreground)]">{analytics.score.value}</p>
                                    <p className="pb-2 text-sm text-[var(--muted)]">{t('outOf100')}</p>
                                </div>
                                <div className="space-y-2">
                                    {analytics.score.deductions.length === 0 ? (
                                        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
                                            {t('noDeductions')}
                                        </p>
                                    ) : (
                                        analytics.score.deductions.map((deduction) => (
                                            <div key={deduction.reason} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
                                                <span className="text-[var(--foreground-soft)]">{deduction.reason}</span>
                                                <span className="font-semibold text-[var(--warning)]">-{deduction.points}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <Skeleton className="h-40 rounded-2xl" />
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('ruleInsights')}</p>
                        {isLoading ? (
                            <div className="grid gap-3">
                                <Skeleton className="h-20 rounded-xl" />
                                <Skeleton className="h-20 rounded-xl" />
                            </div>
                        ) : analytics && analytics.insights.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {analytics.insights.map((insight) => (
                                    <div key={insight.code} className={`rounded-xl border p-4 ${insightClass(insight.severity)}`}>
                                        <div className="flex items-start gap-3">
                                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                                            <div>
                                                <p className="font-semibold text-[var(--foreground)]">{localizedInsight(insight).title}</p>
                                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{localizedInsight(insight).detail}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                                {t('noInsights')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.1} className="grid gap-6 xl:grid-cols-2">
                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('attendanceTrend')}</p>
                        {analytics && analytics.trends.daily.length > 0 ? (
                            <ChartWrapper height={260}>
                                <AreaChart data={analytics.trends.daily}>
                                    <defs>
                                        <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid {...darkChartDefaults.cartesianGrid} />
                                    <XAxis dataKey="date" {...darkChartDefaults.axis} />
                                    <YAxis {...darkChartDefaults.axis} />
                                    <DarkTooltip />
                                    <Area type="monotone" dataKey="present" stroke="var(--accent)" fill="url(#presentFill)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="absent" stroke="var(--danger)" fill="transparent" strokeWidth={2} />
                                </AreaChart>
                            </ChartWrapper>
                        ) : (
                            <p className="py-16 text-center text-sm text-[var(--muted)]">{t('noTrend')}</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('minutesTrend')}</p>
                        {analytics && analytics.trends.daily.length > 0 ? (
                            <ChartWrapper height={260}>
                                <LineChart data={analytics.trends.daily}>
                                    <CartesianGrid {...darkChartDefaults.cartesianGrid} />
                                    <XAxis dataKey="date" {...darkChartDefaults.axis} />
                                    <YAxis {...darkChartDefaults.axis} />
                                    <DarkTooltip />
                                    <Line type="monotone" dataKey="lateMinutes" name={t('lateMinutes')} stroke="var(--warning)" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="overtimeMinutes" name={t('overtimeMinutes')} stroke="var(--success)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ChartWrapper>
                        ) : (
                            <p className="py-16 text-center text-sm text-[var(--muted)]">{t('noMinutesTrend')}</p>
                        )}
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.12} className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('comparison')}</p>
                        {analytics ? (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <p className="text-sm text-[var(--muted)]">{t('employeeAttendanceRate')}</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{formatPercent(analytics.summary.attendanceRate)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <p className="text-sm text-[var(--muted)]">{t('branchAverage')}</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{formatPercent(analytics.comparison.branchAverage.attendanceRate)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <p className="text-sm text-[var(--muted)]">{t('companyAverage')}</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{formatPercent(analytics.comparison.companyAverage.attendanceRate)}</p>
                                </div>
                            </div>
                        ) : (
                            <Skeleton className="h-64 rounded-2xl" />
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-4 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('absenceOvertimeSummary')}</p>
                        {analytics && analytics.trends.daily.length > 0 ? (
                            <ChartWrapper height={300}>
                                <BarChart data={analytics.trends.daily}>
                                    <CartesianGrid {...darkChartDefaults.cartesianGrid} />
                                    <XAxis dataKey="date" {...darkChartDefaults.axis} />
                                    <YAxis {...darkChartDefaults.axis} />
                                    <DarkTooltip />
                                    <Bar dataKey="absent" name={t('absence')} fill="var(--danger)" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="overtimeMinutes" name={t('overtimeMinutes')} fill="var(--success)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ChartWrapper>
                        ) : (
                            <p className="py-16 text-center text-sm text-[var(--muted)]">{t('noAbsenceOvertime')}</p>
                        )}
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.14}>
                <Card className="rounded-2xl">
                    <div className="border-b border-[var(--line)] px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('attendanceHistory')}</p>
                    </div>
                    <div className="custom-scrollbar overflow-x-auto">
                        <table className="w-full min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-[var(--line)] bg-[var(--surface)]">
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
                                        <th key={heading} className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, rowIndex) => (
                                        <tr key={rowIndex} className="border-b border-[var(--line)]">
                                            {Array.from({ length: 10 }).map((__, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-4">
                                                    <Skeleton className="h-9 w-full rounded-xl" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : analytics && analytics.history.length > 0 ? (
                                    analytics.history.map((record) => (
                                        <tr key={record.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-hover)]">
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatDate(record.date)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatShift(record.shift)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.checkIn)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.checkOut)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatLateness(record.lateMinutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatEarlyDeparture(record.earlyDepartureMinutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatOvertime(record.overtimeMinutes)}</td>
                                            <td className="px-4 py-4">
                                                <Badge variant={record.status}>{t(`status.${record.status}`)}</Badge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]" dir="auto">{record.location || '-'}</td>
                                            <td className="px-4 py-4 font-mono text-xs text-[var(--muted)]">
                                                {record.ipAddress || '-'}{record.checkOutIp && record.checkOutIp !== record.ipAddress ? ` / ${record.checkOutIp}` : ''}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-12 text-center text-sm text-[var(--muted)]">
                                            {t('noRecords')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </PageReveal>
        </div>
    );
}
