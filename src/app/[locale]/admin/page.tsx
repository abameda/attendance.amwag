'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    AlarmClock,
    AlertCircle,
    ArrowRight,
    BarChart3,
    Building2,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Download,
    FileText,
    Gauge,
    History,
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

import { Skeleton, StaggerGroup, StaggerItem, addToast } from '@/components/ui';
import {
    buildBranchHealthRows,
    buildDashboardOperations,
    buildExceptionGroups,
    normalizeDashboardPeriod,
    type BranchHealthRow,
    type BranchHealthStatus,
    type DashboardExceptionKey,
} from '@/lib/adminDashboardOperations';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
import { getEgyptDate, getEgyptMonth } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { AttendanceRecord, DashboardSummary } from '@/types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BRANCH_ROW_LIMIT = 50;

type KpiCard = {
    label: string;
    value: string;
    meta?: string;
    icon: LucideIcon;
    tone: Tone;
    emphasis?: 'wide' | 'rate';
};

type LocalCopy = {
    loaded: string;
    notLoaded: string;
    cairoTimezone: string;
    nowAction: string;
    reviewAbsences: string;
    reviewLate: string;
    reviewMissing: string;
    reviewBranches: string;
    monitor: string;
    chooseDay: string;
    presentExpected: string;
    unauthorizedUnavailable: string;
    recentActivity: string;
    recentActivityUnavailable: string;
    reportingShortcuts: string;
    exportSelectedDay: string;
    openDailyLogs: string;
    openBranchControls: string;
    topBranch: string;
    noTopBranch: string;
    employeesShown: string;
    noEmployeeNames: string;
    branchRowsShown: (shown: string, total: string) => string;
};

const localCopy: Record<'en' | 'ar', LocalCopy> = {
    en: {
        loaded: 'Loaded',
        notLoaded: 'Not loaded yet',
        cairoTimezone: 'Africa/Cairo',
        nowAction: 'Action now',
        reviewAbsences: 'Review absences and contact branch owners.',
        reviewLate: 'Review late arrivals before payroll closes.',
        reviewMissing: 'Resolve missing checkouts before day close.',
        reviewBranches: 'Open branch health and assign follow-up.',
        monitor: 'No immediate exception is active. Keep monitoring live logs.',
        chooseDay: 'Choose a day to activate employee-level operations.',
        presentExpected: 'present of expected',
        unauthorizedUnavailable: 'Unauthorized IP and blocked-attempt data is not included in the current dashboard summary.',
        recentActivity: 'Recent activity',
        recentActivityUnavailable: 'Chronological check-in and checkout events are not available in this summary response. Use attendance logs for event-level review.',
        reportingShortcuts: 'Reporting shortcuts',
        exportSelectedDay: 'Export selected day',
        openDailyLogs: 'Open attendance logs',
        openBranchControls: 'Open branch controls',
        topBranch: 'Top branch',
        noTopBranch: 'No top branch data available',
        employeesShown: 'Sample employees shown',
        noEmployeeNames: 'Employee names are not available for this item.',
        branchRowsShown: (shown, total) => `Showing ${shown} highest-risk branches of ${total}. Use attendance logs for the full branch list.`,
    },
    ar: {
        loaded: 'آخر تحميل',
        notLoaded: 'لم يتم التحميل بعد',
        cairoTimezone: 'Africa/Cairo',
        nowAction: 'الإجراء الآن',
        reviewAbsences: 'راجع الغياب وتواصل مع مسؤولي الفروع.',
        reviewLate: 'راجع حالات التأخير قبل إغلاق الرواتب.',
        reviewMissing: 'أغلق حالات الانصراف المفقود قبل نهاية اليوم.',
        reviewBranches: 'افتح صحة الفروع وحدد المتابعة.',
        monitor: 'لا يوجد استثناء فوري. تابع السجلات المباشرة.',
        chooseDay: 'اختر يوماً لتفعيل متابعة الموظفين.',
        presentExpected: 'حاضر من المتوقع',
        unauthorizedUnavailable: 'بيانات محاولات IP غير المصرح بها أو المحظورة غير موجودة في ملخص لوحة التحكم الحالي.',
        recentActivity: 'النشاط الأخير',
        recentActivityUnavailable: 'أحداث الحضور والانصراف الزمنية غير متاحة في استجابة الملخص الحالية. استخدم سجلات الحضور للمراجعة التفصيلية.',
        reportingShortcuts: 'اختصارات التقارير',
        exportSelectedDay: 'تصدير اليوم المحدد',
        openDailyLogs: 'فتح سجلات الحضور',
        openBranchControls: 'فتح ضوابط الفروع',
        topBranch: 'أفضل فرع',
        noTopBranch: 'لا تتوفر بيانات أفضل فرع',
        employeesShown: 'عينة موظفين معروضة',
        noEmployeeNames: 'أسماء الموظفين غير متاحة لهذا البند.',
        branchRowsShown: (shown, total) => `عرض أعلى ${shown} فروع خطورة من أصل ${total}. استخدم سجلات الحضور لعرض القائمة الكاملة.`,
    },
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

const toneClasses: Record<Tone, { icon: string; text: string; wash: string; border: string }> = {
    neutral: {
        icon: 'border-white/[0.15] bg-white/[0.07] text-slate-300',
        text: 'text-slate-300',
        wash: 'bg-white/[0.065]',
        border: 'border-white/[0.15]',
    },
    success: {
        icon: 'border-emerald-300/[0.25] bg-emerald-400/[0.12] text-emerald-200',
        text: 'text-emerald-200',
        wash: 'bg-emerald-400/[0.075]',
        border: 'border-emerald-300/[0.20]',
    },
    warning: {
        icon: 'border-amber-300/[0.28] bg-amber-400/[0.12] text-amber-200',
        text: 'text-amber-200',
        wash: 'bg-amber-400/[0.075]',
        border: 'border-amber-300/[0.22]',
    },
    danger: {
        icon: 'border-red-300/[0.25] bg-red-400/[0.12] text-red-200',
        text: 'text-red-200',
        wash: 'bg-red-400/[0.075]',
        border: 'border-red-300/[0.22]',
    },
    info: {
        icon: 'border-blue-300/[0.25] bg-blue-400/[0.12] text-blue-200',
        text: 'text-blue-200',
        wash: 'bg-blue-400/[0.075]',
        border: 'border-blue-300/[0.22]',
    },
};

function healthTone(status: BranchHealthStatus): Tone {
    if (status === 'needs_attention') return 'danger';
    if (status === 'watch') return 'warning';
    return 'success';
}

function statusPillClasses(tone: Tone) {
    if (tone === 'success') return 'border-emerald-300/[0.25] bg-emerald-400/[0.12] text-emerald-200';
    if (tone === 'warning') return 'border-amber-300/[0.28] bg-amber-400/[0.12] text-amber-200';
    if (tone === 'danger') return 'border-red-300/[0.25] bg-red-400/[0.12] text-red-200';
    if (tone === 'info') return 'border-blue-300/[0.25] bg-blue-400/[0.12] text-blue-200';
    return 'border-white/[0.15] bg-white/[0.07] text-slate-300';
}

function StatusIcon({ tone }: { tone: Tone }) {
    const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'danger' ? TriangleAlert : AlertCircle;
    return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function EmptyState({ children, icon: Icon = AlertCircle }: { children: string; icon?: LucideIcon }) {
    return (
        <div className="admin-glass-panel-muted flex items-start gap-3 border-dashed px-4 py-5 text-sm leading-6 text-slate-600">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
            <span>{children}</span>
        </div>
    );
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        return null;
    }

    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

export default function AdminDashboard() {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const copy = localCopy[locale === 'ar' ? 'ar' : 'en'];
    const today = getEgyptDate();
    const [selectedMonth, setSelectedMonth] = useState(() => getEgyptMonth());
    const [selectedDate, setSelectedDate] = useState(() => today);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);

    const period = useMemo(
        () => normalizeDashboardPeriod({ selectedDate, selectedMonth, fallbackDate: today }),
        [selectedDate, selectedMonth, today]
    );
    const isDayView = period.isDayView;
    const resolvedLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const numberFormatter = useMemo(() => new Intl.NumberFormat(resolvedLocale), [resolvedLocale]);
    const timeFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(resolvedLocale, {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Cairo',
            }),
        [resolvedLocale]
    );
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
                const result = await readJsonResponse<{
                    success: boolean;
                    data?: DashboardSummary;
                    error?: string;
                }>(response);

                if (!response.ok || !result?.success || !result.data) {
                    throw new Error(result?.error || 'Failed to fetch attendance summary');
                }

                setSummary(result.data);
                setLastLoadedAt(new Date());
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
    const branchesNeedingAttention = branchHealthRows.filter((branch) => branch.status !== 'on_track').length;
    const visibleBranchRows = branchHealthRows.slice(0, BRANCH_ROW_LIMIT);

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

    const lastLoadedLabel = lastLoadedAt ? `${copy.loaded} ${timeFormatter.format(lastLoadedAt)}` : copy.notLoaded;

    const currentAction = useMemo(() => {
        if (!isDayView) return copy.chooseDay;
        if ((summary?.missingCheckoutCount ?? 0) > 0) return copy.reviewMissing;
        if ((summary?.absentCount ?? 0) > 0) return copy.reviewAbsences;
        if ((summary?.lateCount ?? 0) > 0) return copy.reviewLate;
        if (branchesNeedingAttention > 0) return copy.reviewBranches;
        return copy.monitor;
    }, [branchesNeedingAttention, copy, isDayView, summary]);

    const kpis: KpiCard[] = [
        {
            label: t('expectedEmployees'),
            value: formatCount(summary?.expectedEmployees ?? 0),
            icon: Users,
            tone: 'neutral',
            emphasis: 'wide',
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
            emphasis: 'wide',
        },
        {
            label: t('attendanceRate'),
            value: formatPercent(operations.attendanceRate),
            meta: `${formatCount(operations.checkedInCount)} ${copy.presentExpected} ${formatCount(operations.expectedEmployees)}`,
            icon: Gauge,
            tone: operations.attendanceRate >= 95 ? 'success' : operations.attendanceRate >= 80 ? 'warning' : 'danger',
            emphasis: 'rate',
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
            const result = await readJsonResponse<{
                success: boolean;
                data?: AttendanceRecord[];
                error?: string;
            }>(response);

            if (!response.ok || !result?.success) {
                throw new Error(result?.error || 'Failed to fetch export data');
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
        <div className="space-y-5 text-[var(--foreground)]">
            <section className="admin-glass-panel overflow-hidden p-5 md:p-6">
                <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="info">{t('operationsLabel')}</StatusPill>
                            <StatusPill tone={isDayView ? 'success' : 'neutral'}>{isDayView ? t('dayMode') : t('monthMode')}</StatusPill>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-extrabold leading-tight text-slate-950 md:text-5xl">
                                {isDayView ? t('todayOperationsTitle') : t('monthlyReportTitle')}
                            </h1>
                            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                                {t('operationsDescription')}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 2xl:min-w-[44rem] 2xl:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto]">
                        <DateControl
                            id="dashboard-selected-date"
                            label={t('selectedDate')}
                            type="date"
                            value={selectedDate}
                            onChange={(nextDate) => {
                                setSelectedDate(nextDate);
                                if (nextDate) {
                                    setSelectedMonth(nextDate.slice(0, 7));
                                } else if (!selectedMonth) {
                                    setSelectedMonth(today.slice(0, 7));
                                }
                            }}
                        />
                        <DateControl
                            id="dashboard-selected-month"
                            label={t('selectedMonth')}
                            type="month"
                            value={period.selectedMonth}
                            onChange={(nextMonth) => {
                                setSelectedMonth(nextMonth || today.slice(0, 7));
                                setSelectedDate('');
                            }}
                        />
                        <HeaderAction href={`/${locale}/admin/attendance`} icon={FileText} label={t('viewAttendanceLogs')} />
                        <button
                            type="button"
                            onClick={() => void handleExportTodayReport()}
                            disabled={isExporting || !period.selectedDate}
                            className="focus-ring admin-glass-button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 self-end px-4 text-sm font-bold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55"
                            aria-disabled={isExporting || !period.selectedDate}
                            aria-busy={isExporting}
                        >
                            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {isExporting ? t('exportingReport') : period.selectedDate ? t('exportTodayReport') : t('selectDateToExport')}
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 border-t border-white/[0.12] pt-4 text-sm text-slate-600 md:grid-cols-3">
                    <MetaLine icon={CalendarDays} label={formattedSelectedDate} />
                    <MetaLine icon={Network} label={`${t('egyptTimezone')} (${copy.cairoTimezone})`} />
                    <MetaLine icon={RefreshCw} label={lastLoadedLabel} />
                </div>
            </section>

            {loadError ? (
                <section
                    role="alert"
                    className="admin-glass-alert-danger flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold">{t('loadErrorTitle')}</p>
                            <p className="mt-1 text-sm leading-6">{loadError}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setRetryNonce((value) => value + 1)}
                        className="focus-ring admin-glass-button-danger-subtle inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-3 text-sm font-bold transition"
                    >
                        <RefreshCw className="h-4 w-4" />
                        {t('retry')}
                    </button>
                </section>
            ) : null}

            <StaggerGroup
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3 2xl:grid-cols-8"
                stagger={0.045}
            >
                {kpis.map((card) => (
                    <StaggerItem key={card.label}>
                        <KpiTile card={card} isLoading={isLoading} />
                    </StaggerItem>
                ))}
            </StaggerGroup>

            <section className="admin-glass-panel p-4 md:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="space-y-4">
                        <PanelHeader
                            icon={TriangleAlert}
                            tone="warning"
                            kicker={t('todayAlerts')}
                            title={t('actionQueue')}
                            detail={t('actionQueueDetail', { count: operations.needsActionCount })}
                        />

                        <div className="admin-glass-highlight p-4">
                            <p className="text-xs font-bold uppercase text-sky-700">{copy.nowAction}</p>
                            <p className="mt-2 text-base font-extrabold leading-6">{currentAction}</p>
                        </div>

                        {!isDayView ? (
                            <EmptyState>{t('dailyAlertsEmpty')}</EmptyState>
                        ) : isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-2xl" />
                                <Skeleton className="h-20 w-full rounded-2xl" />
                                <Skeleton className="h-20 w-full rounded-2xl" />
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
                                        copy={copy}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState icon={CheckCircle2}>{t('alertsEmpty')}</EmptyState>
                        )}

                        <DataGap icon={ShieldAlert} title={t('unauthorizedIpTitle')} detail={copy.unauthorizedUnavailable} />
                    </div>

                    <div className="space-y-4">
                        <PanelHeader
                            icon={Building2}
                            tone="info"
                            kicker={t('branchPerformance')}
                            title={t('branchPerformanceTitle')}
                            detail={t('branchPerformanceDetail')}
                        />

                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                            </div>
                        ) : branchHealthRows.length ? (
                            <div className="space-y-3">
                                {branchHealthRows.length > BRANCH_ROW_LIMIT ? (
                                    <p className="admin-glass-panel-muted px-4 py-3 text-xs font-bold leading-5 text-slate-600">
                                        {copy.branchRowsShown(formatCount(visibleBranchRows.length), formatCount(branchHealthRows.length))}
                                    </p>
                                ) : null}

                                <div className="grid gap-3 md:hidden">
                                    {visibleBranchRows.map((branch) => (
                                        <BranchHealthCard
                                            key={branch.branch}
                                            branch={branch}
                                            formatCount={formatCount}
                                            formatPercent={formatPercent}
                                            labels={{
                                                expected: t('expectedShort'),
                                                present: t('presentShort'),
                                                attendance: t('attendancePercent'),
                                                late: t('lateShort'),
                                                missing: t('missingShort'),
                                                status: t(`branchStatus.${branch.status}`),
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="admin-glass-table hidden md:block">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] text-start text-sm">
                                            <thead className="bg-white/[0.055] text-xs font-bold uppercase text-slate-500">
                                                <tr className="border-b border-white/[0.10]">
                                                    <th className="py-3 pe-4 ps-4 text-start">{t('branchName')}</th>
                                                    <th className="px-3 py-3 text-start">{t('expectedShort')}</th>
                                                    <th className="px-3 py-3 text-start">{t('presentShort')}</th>
                                                    <th className="px-3 py-3 text-start">{t('attendancePercent')}</th>
                                                    <th className="px-3 py-3 text-start">{t('lateShort')}</th>
                                                    <th className="px-3 py-3 text-start">{t('missingShort')}</th>
                                                    <th className="px-3 py-3 text-start">{t('status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visibleBranchRows.map((branch) => (
                                                    <tr key={branch.branch} className="admin-glass-table-row last:border-0">
                                                        <td className="max-w-64 truncate py-3.5 pe-4 ps-4 font-bold text-slate-900" title={branch.branch}>
                                                            {branch.branch}
                                                        </td>
                                                        <td className="px-3 py-3.5 text-slate-700">{formatCount(branch.expected)}</td>
                                                        <td className="px-3 py-3.5 font-bold text-slate-800">
                                                            {formatCount(branch.present)} / {formatCount(branch.expected)}
                                                        </td>
                                                        <td className="px-3 py-3.5 text-slate-700">{formatPercent(branch.attendanceRate)}</td>
                                                        <td className="px-3 py-3.5 text-slate-700">{formatCount(branch.late)}</td>
                                                        <td className="px-3 py-3.5 text-slate-700">{formatCount(branch.missingCheckout)}</td>
                                                        <td className="px-3 py-3.5">
                                                            <StatusPill tone={healthTone(branch.status)}>{t(`branchStatus.${branch.status}`)}</StatusPill>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <EmptyState>{t('branchPerformanceEmpty')}</EmptyState>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="admin-glass-panel space-y-4 p-4 md:p-5">
                    <PanelHeader
                        icon={History}
                        tone="neutral"
                        kicker={t('selectedDateOverview')}
                        title={copy.recentActivity}
                        detail={copy.recentActivityUnavailable}
                    />
                    <DataGap icon={ClipboardList} title={copy.recentActivity} detail={copy.recentActivityUnavailable} />
                </div>

                <div className="admin-glass-panel space-y-5 p-4 md:p-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div className="space-y-4">
                            <PanelHeader
                                icon={ClipboardList}
                                tone="info"
                                kicker={t('quickActions')}
                                title={t('quickActionsTitle')}
                                detail={t('quickActionsDetail')}
                            />
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
                                <QuickAction href={`/${locale}/admin/attendance`} icon={FileText} label={t('viewAttendanceLogs')} />
                                <QuickAction href={`/${locale}/admin/employees`} icon={UserCog} label={t('manageEmployees')} />
                                <QuickAction href={`/${locale}/admin/branches`} icon={Building2} label={t('branches')} />
                                <QuickAction href={`/${locale}/admin/branch-ips`} icon={Network} label={t('manageBranchIps')} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <PanelHeader
                                icon={BarChart3}
                                tone="success"
                                kicker={t('insightsTitle')}
                                title={copy.reportingShortcuts}
                                detail={t('snapshotMetricsDetail')}
                            />
                            <div className="grid gap-3">
                                <ShortcutButton
                                    icon={Download}
                                    label={copy.exportSelectedDay}
                                    disabled={isExporting || !period.selectedDate}
                                    onClick={() => void handleExportTodayReport()}
                                    busy={isExporting}
                                />
                                <QuickAction href={`/${locale}/admin/attendance`} icon={FileText} label={copy.openDailyLogs} compact />
                                <QuickAction href={`/${locale}/admin/branch-ips`} icon={Network} label={copy.openBranchControls} compact />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-white/[0.12] pt-5 sm:grid-cols-3">
                        <RateTile
                            label={t('attendanceRate')}
                            value={formatPercent(operations.attendanceRate)}
                            meta={t('rawAttendance', {
                                present: formatCount(operations.checkedInCount),
                                expected: formatCount(operations.expectedEmployees),
                            })}
                            loading={isLoading}
                            tone={operations.attendanceRate >= 95 ? 'success' : operations.attendanceRate >= 80 ? 'warning' : 'danger'}
                        />
                        <RateTile
                            label={t('departureCompletionRate')}
                            value={formatPercent(summary?.departureCompletionRate ?? 0)}
                            meta={t('departureCompletionMeta')}
                            loading={isLoading}
                            tone="info"
                        />
                        <RateTile
                            label={copy.topBranch}
                            value={summary?.topBranch ? summary.topBranch.name : '-'}
                            meta={summary?.topBranch ? formatPercent(summary.topBranch.attendanceRate) : copy.noTopBranch}
                            loading={isLoading}
                            tone="success"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function DateControl({
    id,
    label,
    type,
    value,
    onChange,
}: {
    id: string;
    label: string;
    type: 'date' | 'month';
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label htmlFor={id} className="block self-end">
            <span className="mb-2 block text-xs font-bold text-slate-500">{label}</span>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="focus-ring admin-glass-control h-11 w-full px-3 text-sm font-bold transition-all duration-200"
            />
        </label>
    );
}

function HeaderAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
    return (
        <Link
            href={href}
            className="focus-ring admin-glass-button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 self-end px-4 text-sm font-bold transition-all duration-200"
        >
            <Icon className="h-4 w-4" />
            {label}
        </Link>
    );
}

function MetaLine({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <div className="admin-glass-panel-muted flex min-w-0 items-center gap-2 px-3 py-2">
            <Icon className="h-4 w-4 shrink-0 text-sky-700" />
            <span className="truncate font-bold text-slate-700">{label}</span>
        </div>
    );
}

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
    return (
        <span className={cn('admin-glass-status-pill inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold leading-5', statusPillClasses(tone))}>
            <StatusIcon tone={tone} />
            <span className="min-w-0 break-words">{children}</span>
        </span>
    );
}

function KpiTile({ card, isLoading }: { card: KpiCard; isLoading: boolean }) {
    const tone = toneClasses[card.tone];

    return (
        <div
            className={cn(
                'admin-kpi-tile h-full border',
                tone.wash,
                tone.border,
                card.emphasis === 'rate' ? 'min-h-[11rem] p-5' : 'min-h-[9.5rem]'
            )}
        >
            <div className="flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 max-w-[10rem] break-words text-xs font-bold uppercase leading-5 text-slate-500">{card.label}</p>
                    <div className={cn('rounded-xl border p-2.5', tone.icon)}>
                        <card.icon className="h-4 w-4" />
                    </div>
                </div>
                <div>
                    {isLoading ? (
                        <Skeleton className="h-10 w-24 rounded-xl" />
                    ) : (
                        <p
                            className={cn(
                                'break-words font-extrabold leading-none text-slate-950 [overflow-wrap:anywhere]',
                                card.emphasis === 'rate' ? 'text-4xl sm:text-5xl md:text-6xl' : 'text-4xl md:text-5xl'
                            )}
                        >
                            {card.value}
                        </p>
                    )}
                    {card.meta ? <p className={cn('mt-2 break-words text-xs font-bold leading-5 [overflow-wrap:anywhere]', tone.text)}>{card.meta}</p> : null}
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
    tone: Tone;
    kicker: string;
    title: string;
    detail: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className={cn('rounded-xl border p-2.5', toneClasses[tone].icon)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-slate-500">{kicker}</p>
                <h2 className="mt-1 text-xl font-extrabold leading-tight text-slate-950">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
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
    copy,
}: {
    icon: LucideIcon;
    title: string;
    value: string;
    employees: Array<{ name: string; branch: string }>;
    tone: 'warning' | 'danger';
    href: string;
    copy: LocalCopy;
}) {
    const resolvedTone = tone === 'danger' ? 'danger' : 'warning';
    const sample = employees.map((employee) => `${employee.name}, ${employee.branch}`).join(' | ');

    return (
        <Link
            href={href}
            className="admin-glass-panel-interactive group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className={cn('shrink-0 rounded-xl border p-2.5', toneClasses[resolvedTone].icon)}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-950">{title}</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-600" title={sample || copy.noEmployeeNames}>
                        {sample || copy.noEmployeeNames}
                    </p>
                    {sample ? <p className="mt-1 text-xs font-bold text-slate-500">{copy.employeesShown}</p> : null}
                </div>
            </div>
            <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                <span className="text-3xl font-extrabold leading-none text-slate-950">{value}</span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-900 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </div>
        </Link>
    );
}

function BranchHealthCard({
    branch,
    labels,
    formatCount,
    formatPercent,
}: {
    branch: BranchHealthRow;
    labels: {
        expected: string;
        present: string;
        attendance: string;
        late: string;
        missing: string;
        status: string;
    };
    formatCount: (value: number) => string;
    formatPercent: (value: number) => string;
}) {
    return (
        <article className="admin-glass-panel-muted p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="break-words text-base font-extrabold leading-6 text-slate-950 [overflow-wrap:anywhere]">
                        {branch.branch}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{labels.attendance}</p>
                </div>
                <StatusPill tone={healthTone(branch.status)}>{labels.status}</StatusPill>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <MetricCell label={labels.present} value={`${formatCount(branch.present)} / ${formatCount(branch.expected)}`} strong />
                <MetricCell label={labels.attendance} value={formatPercent(branch.attendanceRate)} strong />
                <MetricCell label={labels.late} value={formatCount(branch.late)} />
                <MetricCell label={labels.missing} value={formatCount(branch.missingCheckout)} />
            </div>
        </article>
    );
}

function MetricCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="rounded-xl border border-white/[0.10] bg-white/[0.055] px-3 py-2">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className={cn('mt-1 break-words leading-tight text-slate-900 [overflow-wrap:anywhere]', strong ? 'text-lg font-extrabold' : 'text-sm font-bold')}>
                {value}
            </p>
        </div>
    );
}

function DataGap({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
    return (
        <div className="admin-glass-panel-muted flex items-start gap-3 p-4 text-slate-700">
            <div className="rounded-xl border border-white/[0.12] bg-white/[0.07] p-2.5 text-slate-300">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
            </div>
        </div>
    );
}

function QuickAction({ href, icon: Icon, label, compact = false }: { href: string; icon: LucideIcon; label: string; compact?: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                'admin-glass-panel-interactive group flex items-center justify-between p-4',
                compact ? 'min-h-12' : 'min-h-20'
            )}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="rounded-xl border border-blue-300/[0.25] bg-blue-400/[0.12] p-2.5 text-blue-200">
                    <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words text-sm font-extrabold text-slate-900">{label}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-900 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
    );
}

function ShortcutButton({
    icon: Icon,
    label,
    disabled,
    onClick,
    busy = false,
}: {
    icon: LucideIcon;
    label: string;
    disabled: boolean;
    onClick: () => void;
    busy?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="focus-ring admin-glass-panel-interactive flex min-h-12 items-center justify-between p-4 text-start disabled:pointer-events-none disabled:opacity-55"
            aria-busy={busy}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="rounded-xl border border-blue-300/[0.25] bg-blue-400/[0.12] p-2.5 text-blue-200">
                    <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words text-sm font-extrabold text-slate-900">{label}</span>
            </span>
        </button>
    );
}

function RateTile({
    label,
    value,
    meta,
    loading,
    tone,
}: {
    label: string;
    value: string;
    meta: string;
    loading: boolean;
    tone: Tone;
}) {
    return (
        <div className="admin-glass-panel-muted p-4">
            <p className="break-words text-xs font-bold uppercase leading-5 text-slate-500">{label}</p>
            {loading ? (
                <Skeleton className="mt-3 h-8 w-20 rounded-xl" />
            ) : (
                <p className="mt-3 break-words text-3xl font-extrabold leading-none text-slate-950 [overflow-wrap:anywhere]">{value}</p>
            )}
            <p className={cn('mt-2 break-words text-xs font-bold leading-5 [overflow-wrap:anywhere]', toneClasses[tone].text)}>{meta}</p>
        </div>
    );
}
