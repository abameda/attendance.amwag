'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlarmClock,
    ArrowRight,
    Building2,
    Calendar,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Download,
    FileText,
    Hourglass,
    Network,
    ShieldAlert,
    TimerOff,
    TrendingUp,
    TriangleAlert,
    UserCheck,
    UserCog,
    UserX,
    Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useSpring, useMotionValue, useInView } from 'framer-motion';
import {
    AnimatedCounter,
    Badge,
    Card,
    CardContent,
    GlowingCard,
    Input,
    PageReveal,
    Skeleton,
    StaggerGroup,
    StaggerItem,
    addToast,
} from '@/components/ui';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
import { getEgyptDate, getEgyptMonth } from '@/lib/timezone';
import type { AttendanceRecord, DashboardSummary } from '@/types';

type KpiCard = {
    label: string;
    value: number;
    suffix?: string;
    icon: typeof Users;
    tone: string;
    helper?: string;
};

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

function EmptyState({ children }: { children: string }) {
    return (
        <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-5 text-sm leading-6 text-[var(--muted)]">
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
    const activePeriod = selectedDate || selectedMonth;
    const isDayView = Boolean(selectedDate);

    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedDate) {
            params.set('date', selectedDate);
        } else {
            params.set('month', selectedMonth);
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

    const presentTotal = (summary?.presentCount ?? 0) + (summary?.lateCount ?? 0) + (summary?.missingCheckoutCount ?? 0);
    const lowAttendanceBranches = useMemo(
        () =>
            (summary?.branchSummaries ?? [])
                .filter((branch) => branch.expected_days > 0 && branch.attendance_rate < 80)
                .sort((left, right) => left.attendance_rate - right.attendance_rate)
                .slice(0, 3),
        [summary?.branchSummaries]
    );

    const employeeNames = useMemo(() => {
        const employees = summary?.employeeSummaries ?? [];
        return {
            late: employees.filter((employee) => employee.late_days > 0).map((employee) => employee.full_name || employee.user_id),
            missing: employees.filter((employee) => employee.missing_checkout_days > 0).map((employee) => employee.full_name || employee.user_id),
            early: employees.filter((employee) => (employee.early_leave_days ?? 0) > 0).map((employee) => employee.full_name || employee.user_id),
        };
    }, [summary?.employeeSummaries]);

    const kpis: KpiCard[] = [
        { label: t('expectedEmployees'), value: summary?.expectedEmployees ?? 0, icon: Users, tone: 'bg-[var(--accent-soft)] text-[var(--accent)]' },
        { label: t('presentCount'), value: presentTotal, icon: UserCheck, tone: 'bg-[var(--success-soft)] text-[var(--success)]', helper: t('presentHelper') },
        { label: t('absentCount'), value: summary?.absentCount ?? 0, icon: UserX, tone: 'bg-[var(--danger-soft)] text-[var(--danger)]' },
        { label: t('onTimeCount'), value: summary?.onTimeCount ?? summary?.presentCount ?? 0, icon: CheckCircle2, tone: 'bg-[var(--success-soft)] text-[var(--success)]' },
        { label: t('lateCount'), value: summary?.lateCount ?? 0, icon: AlarmClock, tone: 'bg-[var(--warning-soft)] text-[var(--warning)]' },
        { label: t('earlyLeaveCount'), value: summary?.earlyLeaveCount ?? 0, icon: TimerOff, tone: 'bg-[var(--danger-soft)] text-[var(--danger)]' },
        { label: t('missingCheckoutCount'), value: summary?.missingCheckoutCount ?? 0, icon: TriangleAlert, tone: 'bg-[var(--warning-soft)] text-[var(--warning)]' },
        { label: t('overtimeCount'), value: summary?.overtimeCount ?? 0, icon: Hourglass, tone: 'bg-[var(--secondary-soft)] text-[var(--secondary)]' },
        { label: t('attendanceRate'), value: summary?.attendanceRate ?? 0, suffix: '%', icon: TrendingUp, tone: 'bg-[var(--accent-soft)] text-[var(--accent)]' },
        { label: t('departureCompletionRate'), value: summary?.departureCompletionRate ?? 0, suffix: '%', icon: Clock3, tone: 'bg-[var(--success-soft)] text-[var(--success)]' },
    ];

    async function handleExportTodayReport() {
        const exportDate = selectedDate || today;
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
        <div className="space-y-6">
            <PageReveal className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <GlowingCard halo>
                    <div className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('title')}</p>
                            <h1 className="gradient-text text-4xl font-bold sm:text-5xl">
                                {t('heroTitle')}
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                                {t('heroDescription')}
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
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
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('needsAction')}</p>
                                {isLoading ? (
                                    <Skeleton className="mt-3 h-8 w-20" />
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                        <AnimatedCounter
                                            value={
                                                (summary?.lateCount ?? 0) +
                                                (summary?.missingCheckoutCount ?? 0) +
                                                (summary?.earlyLeaveCount ?? 0) +
                                                lowAttendanceBranches.length
                                            }
                                        />
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
                        </div>
                    </div>
                </GlowingCard>

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
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(event) => {
                                    setSelectedMonth(event.target.value);
                                    setSelectedDate('');
                                }}
                            />
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('focusPeriod')}</p>
                                    <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                                        {formattedSelectedDate}
                                    </p>
                                </div>
                                <Badge variant={isDayView ? 'info' : 'default'}>
                                    {isDayView ? t('dayMode') : t('monthMode')}
                                </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                                {t('dateFirstHint')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>

            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {kpis.map((card) => (
                    <StaggerItem key={card.label}>
                        <GlowingCard>
                            <div className="min-h-36 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 space-y-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                                            {card.label}
                                        </p>
                                        {isLoading ? (
                                            <Skeleton className="h-10 w-20" />
                                        ) : (
                                            <p className="text-4xl font-semibold text-[var(--foreground)]">
                                                <AnimatedCounter value={card.value} suffix={card.suffix} />
                                            </p>
                                        )}
                                        {card.helper && <p className="text-xs leading-5 text-[var(--muted)]">{card.helper}</p>}
                                    </div>
                                    <div className={`shrink-0 rounded-xl p-3 ${card.tone}`}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </GlowingCard>
                    </StaggerItem>
                ))}
            </StaggerGroup>

            <StaggerGroup className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <StaggerItem>
                    <Card className="rounded-2xl">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-[var(--warning-soft)] p-2.5">
                                    <TriangleAlert className="h-5 w-5 text-[var(--warning)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('todayAlerts')}</p>
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                        {t('actionQueue')}
                                    </h2>
                                </div>
                            </div>

                            {!isDayView ? (
                                <EmptyState>{t('dailyAlertsEmpty')}</EmptyState>
                            ) : isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : summary &&
                              ((summary.lateCount ?? 0) > 0 ||
                                  (summary.missingCheckoutCount ?? 0) > 0 ||
                                  (summary.earlyLeaveCount ?? 0) > 0 ||
                                  lowAttendanceBranches.length > 0) ? (
                                <div className="space-y-3">
                                    {summary.lateCount > 0 && (
                                        <AlertRow
                                            icon={AlarmClock}
                                            title={t('lateEmployeesAlert')}
                                            value={summary.lateCount}
                                            detail={employeeNames.late.slice(0, 3).join(', ')}
                                            tone="warning"
                                        />
                                    )}
                                    {summary.missingCheckoutCount > 0 && (
                                        <AlertRow
                                            icon={TriangleAlert}
                                            title={t('missingCheckoutAlert')}
                                            value={summary.missingCheckoutCount}
                                            detail={employeeNames.missing.slice(0, 3).join(', ')}
                                            tone="warning"
                                        />
                                    )}
                                    {(summary.earlyLeaveCount ?? 0) > 0 && (
                                        <AlertRow
                                            icon={TimerOff}
                                            title={t('earlyLeaveAlert')}
                                            value={summary.earlyLeaveCount ?? 0}
                                            detail={employeeNames.early.slice(0, 3).join(', ')}
                                            tone="danger"
                                        />
                                    )}
                                    {lowAttendanceBranches.map((branch) => (
                                        <AlertRow
                                            key={branch.branch}
                                            icon={Building2}
                                            title={t('lowAttendanceAlert')}
                                            value={branch.attendance_rate}
                                            suffix="%"
                                            detail={`${branch.branch}: ${branch.present_days + branch.late_days + branch.missing_checkout_days}/${branch.expected_days}`}
                                            tone="danger"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState>{t('alertsEmpty')}</EmptyState>
                            )}

                            <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                                <div>
                                    <p className="text-sm font-medium text-[var(--foreground-soft)]">{t('unauthorizedIpTitle')}</p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('unauthorizedIpUnavailable')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>

                <StaggerItem>
                    <Card className="rounded-2xl">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-[var(--accent-soft)] p-2.5">
                                    <Building2 className="h-5 w-5 text-[var(--accent)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('branchPerformance')}</p>
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                        {t('branchPerformanceTitle')}
                                    </h2>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : summary?.branchSummaries?.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[660px] text-left text-sm">
                                        <thead className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                                            <tr className="border-b border-[var(--line)]">
                                                <th className="py-3 pe-4 font-semibold">{t('branchName')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('expectedShort')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('presentShort')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('absentShort')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('lateShort')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('attendancePercent')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.branchSummaries.map((branch) => (
                                                <tr key={branch.branch} className="border-b border-[var(--line)] last:border-0">
                                                    <td className="py-3 pe-4 font-medium text-[var(--foreground)]">{branch.branch}</td>
                                                    <td className="px-4 py-3 text-[var(--foreground-soft)]">{branch.expected_days}</td>
                                                    <td className="px-4 py-3 text-[var(--foreground-soft)]">
                                                        {branch.present_days + branch.late_days + branch.missing_checkout_days}
                                                    </td>
                                                    <td className="px-4 py-3 text-[var(--foreground-soft)]">{branch.absent_days}</td>
                                                    <td className="px-4 py-3 text-[var(--foreground-soft)]">{branch.late_days}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={branch.attendance_rate >= 80 ? 'present' : 'late'}>
                                                            {branch.attendance_rate}%
                                                        </Badge>
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
                </StaggerItem>
            </StaggerGroup>

            <StaggerGroup className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.85fr]">
                <StaggerItem>
                    <Card className="rounded-2xl">
                        <CardContent className="space-y-5 p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-[var(--secondary-soft)] p-2.5">
                                    <ClipboardList className="h-5 w-5 text-[var(--secondary)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('quickActions')}</p>
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">{t('quickActionsTitle')}</h2>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <QuickAction href={`/${locale}/admin/attendance`} icon={FileText} label={t('viewAttendanceLogs')} />
                                <button
                                    type="button"
                                    onClick={() => void handleExportTodayReport()}
                                    disabled={isExporting}
                                    className="group flex min-h-24 items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-start transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] disabled:pointer-events-none disabled:opacity-50"
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
                                            <Download className="h-5 w-5" />
                                        </span>
                                        <span className="text-sm font-semibold text-[var(--foreground-soft)]">{t('exportTodayReport')}</span>
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--foreground)]" />
                                </button>
                                <QuickAction href={`/${locale}/admin/employees`} icon={UserCog} label={t('manageEmployees')} />
                                <QuickAction href={`/${locale}/admin/branch-ips`} icon={Network} label={t('manageBranchIps')} />
                                <QuickAction href={`/${locale}/admin/attendance`} icon={TriangleAlert} label={t('reviewMissingCheckouts')} />
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>

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
                                        {t('snapshotMetrics')}
                                    </h2>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
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
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>
            </StaggerGroup>
        </div>
    );
}

function AlertRow({
    icon: Icon,
    title,
    value,
    detail,
    suffix = '',
    tone,
}: {
    icon: typeof Users;
    title: string;
    value: number;
    detail: string;
    suffix?: string;
    tone: 'warning' | 'danger';
}) {
    const toneClass = tone === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]';

    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex min-w-0 items-center gap-3">
                <div className={`shrink-0 rounded-xl p-2.5 ${toneClass}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground-soft)]">{title}</p>
                    {detail ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{detail}</p> : null}
                </div>
            </div>
            <p className="shrink-0 text-2xl font-semibold text-[var(--foreground)]">
                {value}
                {suffix}
            </p>
        </div>
    );
}

function QuickAction({
    href,
    icon: Icon,
    label,
}: {
    href: string;
    icon: typeof Users;
    label: string;
}) {
    return (
        <Link
            href={href}
            className="group flex min-h-24 items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]"
        >
            <span className="flex items-center gap-3">
                <span className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-[var(--foreground-soft)]">{label}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--foreground)]" />
        </Link>
    );
}
