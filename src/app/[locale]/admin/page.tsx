'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    AlarmClock,
    ArrowRight,
    AlertCircle,
    Building2,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Download,
    FileText,
    Hourglass,
    Network,
    RefreshCw,
    ShieldAlert,
    TimerOff,
    TriangleAlert,
    UserCheck,
    UserCog,
    UserX,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge, Card, CardContent, Input, Skeleton, addToast } from '@/components/ui';
import {
    buildBranchHealthRows,
    buildDashboardOperations,
    buildExceptionGroups,
    normalizeDashboardPeriod,
    type BranchHealthStatus,
    type DashboardExceptionKey,
} from '@/lib/adminDashboardOperations';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
import { getEgyptDate, getEgyptMonth } from '@/lib/timezone';
import type { AttendanceRecord, DashboardSummary } from '@/types';

type KpiCard = {
    label: string;
    value: string;
    meta?: string;
    icon: LucideIcon;
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

const exceptionIcon: Record<DashboardExceptionKey, LucideIcon> = {
    absent: UserX,
    late: AlarmClock,
    missing_checkout: TriangleAlert,
    early_leave: TimerOff,
};

const exceptionTone: Record<DashboardExceptionKey, 'warning' | 'danger'> = {
    absent: 'danger',
    late: 'warning',
    missing_checkout: 'warning',
    early_leave: 'danger',
};

function toneClass(tone: KpiCard['tone']) {
    if (tone === 'success') return 'bg-[var(--success-soft)] text-[var(--success)]';
    if (tone === 'warning') return 'bg-[var(--warning-soft)] text-[var(--warning)]';
    if (tone === 'danger') return 'bg-[var(--danger-soft)] text-[var(--danger)]';
    if (tone === 'info') return 'bg-[var(--info-soft)] text-[var(--info)]';
    return 'bg-[var(--surface-muted)] text-[var(--foreground-soft)]';
}

function healthBadge(status: BranchHealthStatus) {
    if (status === 'needs_attention') return 'absent';
    if (status === 'watch') return 'late';
    return 'present';
}

function EmptyState({ children }: { children: string }) {
    return (
        <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface-muted)] px-4 py-5 text-sm leading-6 text-[var(--muted)]">
            {children}
        </div>
    );
}

export default function AdminDashboard() {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const today = getEgyptDate();
    const [selectedMonth, setSelectedMonth] = useState(() => getEgyptMonth());
    const [selectedDate, setSelectedDate] = useState(() => today);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const period = useMemo(
        () => normalizeDashboardPeriod({ selectedDate, selectedMonth, fallbackDate: today }),
        [selectedDate, selectedMonth, today]
    );
    const isDayView = period.isDayView;
    const resolvedLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const numberFormatter = useMemo(() => new Intl.NumberFormat(resolvedLocale), [resolvedLocale]);
    const formatCount = (value: number) => numberFormatter.format(value);
    const formatPercent = (value: number) => `${numberFormatter.format(value)}%`;

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        setLoadError(null);

        void (async () => {
            try {
                const response = await fetch(`/api/attendance/summary?${period.queryString}`, {
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
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Dashboard summary error:', error);
                setSummary(null);
                setLoadError(t('loadErrorDetail'));
                addToast(t('loadError'), 'error');
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [period.queryString, retryNonce, t]);

    const operations = useMemo(
        () =>
            summary
                ? buildDashboardOperations(summary)
                : { checkedInCount: 0, expectedEmployees: 0, attendanceRate: 0, needsActionCount: 0 },
        [summary]
    );
    const exceptionGroups = useMemo(() => (summary ? buildExceptionGroups(summary) : []), [summary]);
    const branchHealthRows = useMemo(() => (summary ? buildBranchHealthRows(summary) : []), [summary]);

    const formattedSelectedDate = period.selectedDate
        ? new Date(`${period.selectedDate}T12:00:00Z`).toLocaleDateString(resolvedLocale, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : new Date(`${period.selectedMonth}-01T12:00:00Z`).toLocaleDateString(resolvedLocale, {
              year: 'numeric',
              month: 'long',
          });

    const kpis: KpiCard[] = [
        {
            label: t('expectedEmployees'),
            value: formatCount(summary?.expectedEmployees ?? 0),
            icon: Users,
            tone: 'neutral',
        },
        {
            label: t('presentCount'),
            value: formatCount(operations.checkedInCount),
            meta: t('rawAttendance', {
                present: formatCount(operations.checkedInCount),
                expected: formatCount(operations.expectedEmployees),
            }),
            icon: UserCheck,
            tone: 'success',
        },
        {
            label: t('absentCount'),
            value: formatCount(summary?.absentCount ?? 0),
            icon: UserX,
            tone: 'danger',
        },
        {
            label: t('lateCount'),
            value: formatCount(summary?.lateCount ?? 0),
            icon: AlarmClock,
            tone: 'warning',
        },
        {
            label: t('earlyLeaveCount'),
            value: formatCount(summary?.earlyLeaveCount ?? 0),
            icon: TimerOff,
            tone: 'danger',
        },
        {
            label: t('missingCheckoutCount'),
            value: formatCount(summary?.missingCheckoutCount ?? 0),
            icon: TriangleAlert,
            tone: 'warning',
        },
        {
            label: t('overtimeCount'),
            value: formatCount(summary?.overtimeCount ?? 0),
            icon: Hourglass,
            tone: 'info',
        },
        {
            label: t('attendanceRate'),
            value: formatPercent(operations.attendanceRate),
            meta: t('rawAttendance', {
                present: formatCount(operations.checkedInCount),
                expected: formatCount(operations.expectedEmployees),
            }),
            icon: CheckCircle2,
            tone: operations.attendanceRate >= 95 ? 'success' : operations.attendanceRate >= 80 ? 'warning' : 'danger',
        },
    ];

    async function handleExportTodayReport() {
        if (!period.selectedDate) {
            addToast(t('selectDateToExport'), 'warning');
            return;
        }

        const exportDate = period.selectedDate;
        setIsExporting(true);

        try {
            const params = new URLSearchParams({
                page: '1',
                pageSize: '10000',
                includeExpected: 'true',
                export: 'true',
                date: exportDate,
            });
            const response = await fetch(`/api/attendance?${params.toString()}`);
            const result: {
                success: boolean;
                data?: AttendanceRecord[];
                error?: string;
            } = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to fetch export data');
            }

            await exportAttendancePremiumPDF(result.data ?? [], {
                locale,
                dateFilter: exportDate,
            });
            addToast(t('exportSuccess'), 'success');
        } catch (error) {
            console.error('Dashboard PDF export error:', error);
            addToast(error instanceof Error ? error.message : t('exportError'), 'error');
        } finally {
            setIsExporting(false);
        }
    }

    return (
        <div className="space-y-5">
            <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-sm)] sm:px-5">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="min-w-0 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                            {t('operationsLabel')}
                        </p>
                        <h1 className="text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">
                            {isDayView ? t('todayOperationsTitle') : t('monthlyReportTitle')}
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
                            {t('operationsDescription')}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto] 2xl:min-w-[42rem]">
                        <Input
                            id="dashboard-selected-date"
                            label={t('selectedDate')}
                            type="date"
                            value={selectedDate}
                            onChange={(event) => {
                                const nextDate = event.target.value;
                                setSelectedDate(nextDate);
                                if (nextDate) {
                                    setSelectedMonth(nextDate.slice(0, 7));
                                } else if (!selectedMonth) {
                                    setSelectedMonth(today.slice(0, 7));
                                }
                            }}
                            className="h-10 rounded-md bg-[var(--surface)] py-2"
                        />
                        <Input
                            id="dashboard-selected-month"
                            label={t('selectedMonth')}
                            type="month"
                            value={period.selectedMonth}
                            onChange={(event) => {
                                setSelectedMonth(event.target.value || today.slice(0, 7));
                                setSelectedDate('');
                            }}
                            className="h-10 rounded-md bg-[var(--surface)] py-2"
                        />
                        <Link
                            href={`/${locale}/admin/attendance`}
                            className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
                        >
                            <FileText className="h-4 w-4" />
                            {t('viewAttendanceLogs')}
                        </Link>
                        <button
                            type="button"
                            onClick={() => void handleExportTodayReport()}
                            disabled={isExporting || !period.selectedDate}
                            className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-md border border-transparent bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--accent-strong)] disabled:pointer-events-none disabled:opacity-55"
                            aria-disabled={isExporting || !period.selectedDate}
                        >
                            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {isExporting ? t('exportingReport') : period.selectedDate ? t('exportTodayReport') : t('selectDateToExport')}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
                    <CalendarDays className="h-4 w-4 text-[var(--accent)]" />
                    <span className="font-medium text-[var(--foreground-soft)]">{formattedSelectedDate}</span>
                    <Badge variant={isDayView ? 'info' : 'default'} className="ms-1">
                        {isDayView ? t('dayMode') : t('monthMode')}
                    </Badge>
                    <span className="text-[var(--muted)]">{t('egyptTimezone')}</span>
                </div>
            </section>

            {loadError ? (
                <section
                    role="alert"
                    className="flex flex-col gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-4 text-[var(--danger)] sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">{t('loadErrorTitle')}</p>
                            <p className="mt-1 text-sm leading-6">{loadError}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setRetryNonce((value) => value + 1)}
                        className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                    >
                        <RefreshCw className="h-4 w-4" />
                        {t('retry')}
                    </button>
                </section>
            ) : null}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((card) => (
                    <KpiTile key={card.label} card={card} isLoading={isLoading} />
                ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Card className="rounded-lg backdrop-blur-none">
                    <CardContent className="space-y-4 p-4 sm:p-5">
                        <PanelHeader
                            icon={TriangleAlert}
                            tone="warning"
                            kicker={t('todayAlerts')}
                            title={t('actionQueue')}
                            detail={t('actionQueueDetail', { count: operations.needsActionCount })}
                        />

                        {!isDayView ? (
                            <EmptyState>{t('dailyAlertsEmpty')}</EmptyState>
                        ) : isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        ) : exceptionGroups.length ? (
                            <div className="space-y-3">
                                {exceptionGroups.map((group) => (
                                    <ExceptionRow
                                        key={group.key}
                                        icon={exceptionIcon[group.key]}
                                        title={t(`exceptions.${group.key}`)}
                                        value={formatCount(group.count)}
                                        employees={group.employees}
                                        tone={exceptionTone[group.key]}
                                        href={`/${locale}/admin/attendance`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState>{t('alertsEmpty')}</EmptyState>
                        )}

                        <div className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                            <div className="rounded-md bg-[var(--info-soft)] p-2 text-[var(--info)]">
                                <ShieldAlert className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--foreground)]">{t('unauthorizedIpTitle')}</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('unauthorizedIpUnavailable')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-lg backdrop-blur-none">
                    <CardContent className="space-y-4 p-4 sm:p-5">
                        <PanelHeader
                            icon={Building2}
                            tone="accent"
                            kicker={t('branchPerformance')}
                            title={t('branchPerformanceTitle')}
                            detail={t('branchPerformanceDetail')}
                        />

                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : branchHealthRows.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-start text-sm">
                                    <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                                        <tr className="border-y border-[var(--line)]">
                                            <th className="py-3 pe-4 ps-3 font-semibold">{t('branchName')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('expectedShort')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('presentShort')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('attendancePercent')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('lateShort')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('missingShort')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branchHealthRows.map((branch) => (
                                            <tr key={branch.branch} className="border-b border-[var(--line)] last:border-0">
                                                <td className="max-w-64 truncate py-3 pe-4 ps-3 font-semibold text-[var(--foreground)]" title={branch.branch}>
                                                    {branch.branch}
                                                </td>
                                                <td className="px-3 py-3 text-[var(--foreground-soft)]">{formatCount(branch.expected)}</td>
                                                <td className="px-3 py-3 text-[var(--foreground-soft)]">
                                                    {formatCount(branch.present)}/{formatCount(branch.expected)}
                                                </td>
                                                <td className="px-3 py-3 text-[var(--foreground-soft)]">{formatPercent(branch.attendanceRate)}</td>
                                                <td className="px-3 py-3 text-[var(--foreground-soft)]">{formatCount(branch.late)}</td>
                                                <td className="px-3 py-3 text-[var(--foreground-soft)]">{formatCount(branch.missingCheckout)}</td>
                                                <td className="px-3 py-3">
                                                    <Badge variant={healthBadge(branch.status)}>{t(`branchStatus.${branch.status}`)}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState>{t('branchPerformanceEmpty')}</EmptyState>
                        )}
                    </CardContent>
                </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.85fr]">
                <Card className="rounded-lg backdrop-blur-none">
                    <CardContent className="space-y-4 p-4 sm:p-5">
                        <PanelHeader
                            icon={ClipboardList}
                            tone="accent"
                            kicker={t('quickActions')}
                            title={t('quickActionsTitle')}
                            detail={t('quickActionsDetail')}
                        />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <QuickAction href={`/${locale}/admin/attendance`} icon={FileText} label={t('viewAttendanceLogs')} />
                            <QuickAction href={`/${locale}/admin/employees`} icon={UserCog} label={t('manageEmployees')} />
                            <QuickAction href={`/${locale}/admin/branches`} icon={Building2} label={t('branches')} />
                            <QuickAction href={`/${locale}/admin/branch-ips`} icon={Network} label={t('manageBranchIps')} />
                            <QuickAction href={`/${locale}/admin/attendance`} icon={TriangleAlert} label={t('reviewMissingCheckouts')} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-lg backdrop-blur-none">
                    <CardContent className="space-y-4 p-4 sm:p-5">
                        <PanelHeader
                            icon={CheckCircle2}
                            tone="success"
                            kicker={t('insightsTitle')}
                            title={t('snapshotMetrics')}
                            detail={t('snapshotMetricsDetail')}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <RateTile
                                label={t('attendanceRate')}
                                value={formatPercent(operations.attendanceRate)}
                                meta={t('rawAttendance', {
                                    present: formatCount(operations.checkedInCount),
                                    expected: formatCount(operations.expectedEmployees),
                                })}
                                loading={isLoading}
                            />
                            <RateTile
                                label={t('departureCompletionRate')}
                                value={formatPercent(summary?.departureCompletionRate ?? 0)}
                                meta={t('departureCompletionMeta')}
                                loading={isLoading}
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

function KpiTile({ card, isLoading }: { card: KpiCard; isLoading: boolean }) {
    return (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{card.label}</p>
                    {isLoading ? (
                        <Skeleton className="mt-3 h-8 w-20" />
                    ) : (
                        <p className="mt-3 text-3xl font-semibold leading-none text-[var(--foreground)]">{card.value}</p>
                    )}
                    {card.meta ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{card.meta}</p> : null}
                </div>
                <div className={`rounded-md p-2.5 ${toneClass(card.tone)}`}>
                    <card.icon className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
}

function PanelHeader({
    icon: Icon,
    tone,
    kicker,
    title,
    detail,
}: {
    icon: LucideIcon;
    tone: 'accent' | 'success' | 'warning';
    kicker: string;
    title: string;
    detail: string;
}) {
    const toneClasses = {
        accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
        success: 'bg-[var(--success-soft)] text-[var(--success)]',
        warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    };

    return (
        <div className="flex items-start gap-3">
            <div className={`rounded-md p-2.5 ${toneClasses[tone]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{kicker}</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p>
            </div>
        </div>
    );
}

function ExceptionRow({
    icon: Icon,
    title,
    value,
    employees,
    tone,
    href,
}: {
    icon: LucideIcon;
    title: string;
    value: string;
    employees: Array<{ name: string; branch: string }>;
    tone: 'warning' | 'danger';
    href: string;
}) {
    const toneClasses = tone === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]';
    const sample = employees.map((employee) => `${employee.name}, ${employee.branch}`).join(' | ');

    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className={`shrink-0 rounded-md p-2.5 ${toneClasses}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                    {sample ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{sample}</p> : null}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <span className="text-2xl font-semibold text-[var(--foreground)]">{value}</span>
                <ArrowRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--foreground)] rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </div>
        </Link>
    );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
    return (
        <Link
            href={href}
            className="group flex min-h-20 items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="rounded-md bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
                    <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words text-sm font-semibold text-[var(--foreground)]">{label}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--foreground)] rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
    );
}

function RateTile({ label, value, meta, loading }: { label: string; value: string; meta: string; loading: boolean }) {
    return (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
            {loading ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{value}</p>}
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{meta}</p>
        </div>
    );
}
