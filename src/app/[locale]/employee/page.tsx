'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Briefcase,
    CheckCircle2,
    CircleDashed,
    Clock3,
    Languages,
    LogOut,
    MapPin,
    Timer,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { selectCurrentEmployeeAttendanceRecord } from '@/lib/attendanceCalculations';
import { cn, formatEarlyDeparture, formatLateness, formatOvertime } from '@/lib/utils';
import type { AttendanceRecord, AttendanceStatus, Profile } from '@/types';
import { Skeleton, ToastContainer, addToast } from '@/components/ui';
import { ClockHero } from '@/components/employee/ClockHero';
import { GLSLHills } from '@/components/ui/glsl-hills';

type StatusTone = 'ready' | 'active' | 'complete' | 'warning';

function getEgyptToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}

function formatCairoTimestamp(timestamp: string | null, locale: string) {
    if (!timestamp) return '-';

    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Cairo',
    }).format(new Date(timestamp));
}

function formatShiftTimeForLocale(time: string | null, locale: string) {
    if (!time) return '-';
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

async function fetchTodayRecord() {
    const response = await fetch('/api/attendance/me', { credentials: 'include' });
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load attendance');
    }

    const today = getEgyptToday();
    const records = (result.data || []) as AttendanceRecord[];
    return selectCurrentEmployeeAttendanceRecord(records, today);
}

function statusCopy(status: AttendanceStatus | 'idle' | 'on_shift' | 'complete', t: (key: string) => string) {
    const labels: Record<typeof status, string> = {
        idle: t('readyToCheckIn'),
        on_shift: t('currentlyOnShift'),
        complete: t('dayComplete'),
        present: t('present'),
        late: t('late'),
        absent: t('absent'),
        missing_checkout: t('missingCheckout'),
        pending: t('pending'),
    };

    return labels[status];
}

function StatusMarker({ tone }: { tone: StatusTone }) {
    if (tone === 'complete') return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
    if (tone === 'warning') return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
    if (tone === 'active') return <Clock3 className="h-4 w-4" aria-hidden="true" />;
    return <CircleDashed className="h-4 w-4" aria-hidden="true" />;
}

function DetailRow({
    icon: Icon,
    label,
    value,
    tone = 'default',
}: {
    icon: typeof Briefcase;
    label: string;
    value: string;
    tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
    const toneClass = {
        default: 'text-[var(--employee-ink)]',
        success: 'text-[var(--employee-success)]',
        warning: 'text-[var(--employee-warning)]',
        danger: 'text-[var(--employee-danger)]',
    }[tone];

    return (
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-b border-[var(--employee-line)] py-3 last:border-b-0">
            <Icon className={cn('mt-0.5 h-4 w-4 text-[var(--employee-muted)]', toneClass)} aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                    {label}
                </p>
                <p className={cn('mt-1 truncate text-sm font-semibold text-[var(--employee-ink-strong)]', toneClass)}>{value}</p>
            </div>
        </div>
    );
}

export default function EmployeePortal() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const locale = useLocale();
    const t = useTranslations('Employee');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userResponse = await fetch('/api/auth/me', { credentials: 'include' });
                const userResult = await userResponse.json();

                if (!userResponse.ok || !userResult.success) {
                    router.push(`/${locale}/login`);
                    return;
                }

                setProfile(userResult.data as Profile);
                setTodayRecord(await fetchTodayRecord());
            } catch (error) {
                console.error('Error fetching data:', error);
                setActionError(t('loadError'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [locale, router, t]);

    const refreshTodayRecord = async () => {
        setTodayRecord(await fetchTodayRecord());
    };

    const runAttendanceAction = async (path: string, successMessage: string, fallbackError: string) => {
        setActionError('');
        setActionSuccess('');

        try {
            const response = await fetch(path, { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || fallbackError);

            setActionSuccess(successMessage);
            addToast(successMessage, 'success');
            await refreshTodayRecord();
        } catch (error) {
            const message = error instanceof Error ? error.message : fallbackError;
            setActionError(message);
            addToast(message, 'error');
        }
    };

    const handleCheckIn = async () => {
        setIsCheckingIn(true);
        try {
            await runAttendanceAction('/api/attendance/check-in', t('checkInSuccess'), t('checkInError'));
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleCheckOut = async () => {
        setIsCheckingOut(true);
        try {
            await runAttendanceAction('/api/attendance/check-out', t('checkOutSuccess'), t('checkOutError'));
        } finally {
            setIsCheckingOut(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        router.push(`/${locale}/login`);
        router.refresh();
    };

    const hasCheckedIn = !!todayRecord?.check_in_time;
    const hasCheckedOut = !!todayRecord?.check_out_time;
    const isMissingCheckout = todayRecord?.status === 'missing_checkout';
    const isOnShift = hasCheckedIn && !hasCheckedOut && !isMissingCheckout;
    const shiftStatus = (hasCheckedOut || isMissingCheckout) ? 'complete' : isOnShift ? 'on_shift' : 'idle';
    const employeeName = profile?.full_name || t('employeeFallback');
    const branchName = profile?.branch || t('unassignedBranch');

    const shiftProgress = useMemo(() => {
        if (!profile?.shift_start || !profile?.shift_end) return 0;
        if (shiftStatus === 'complete') return 1;
        if (shiftStatus === 'idle') return 0;

        const [sh, sm] = profile.shift_start.split(':').map(Number);
        const [eh, em] = profile.shift_end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        const total = endMins - startMins;
        if (total <= 0) return 0;
        return Math.min(Math.max((nowMins - startMins) / total, 0), 1);
    }, [currentTime, profile?.shift_end, profile?.shift_start, shiftStatus]);

    const formattedDate = currentTime.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Africa/Cairo',
    });

    const statusTone: StatusTone = isMissingCheckout
        ? 'warning'
        : hasCheckedOut
            ? 'complete'
            : isOnShift
                ? 'active'
                : 'ready';

    const statusLabel = isMissingCheckout
        ? t('missingCheckout')
        : hasCheckedOut
            ? t('dayComplete')
            : isOnShift
                ? t('currentlyOnShift')
                : t('readyToCheckIn');

    const actionKind = hasCheckedOut || isMissingCheckout ? 'complete' : isOnShift ? 'check-out' : 'check-in';
    const actionLabel = hasCheckedOut || isMissingCheckout
        ? t('actionComplete')
        : isOnShift
            ? t('checkOut')
            : t('checkIn');
    const actionHint = isMissingCheckout
        ? t('missingCheckoutGuidance')
        : hasCheckedOut
            ? t('shiftCompleted')
            : isOnShift
                ? t('checkOutHint')
                : t('checkInHint');

    const issueRows = [
        {
            label: t('late'),
            value: formatLateness(todayRecord?.late_minutes ?? 0),
            active: !!todayRecord && (todayRecord.late_minutes ?? 0) > 0,
            tone: 'warning' as const,
        },
        {
            label: t('earlyLeave'),
            value: formatEarlyDeparture(todayRecord?.early_departure_minutes ?? 0),
            active: !!todayRecord && (todayRecord.early_departure_minutes ?? 0) > 0,
            tone: 'warning' as const,
        },
        {
            label: t('overtime'),
            value: formatOvertime(todayRecord?.overtime_minutes ?? 0),
            active: !!todayRecord && (todayRecord.overtime_minutes ?? 0) > 0,
            tone: 'success' as const,
        },
    ];

    if (isLoading) {
        return (
            <div className="employee-glass-surface min-h-screen px-4 py-6 sm:px-6 lg:px-8">
                <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                    <GLSLHills width="100%" height="100%" speed={0.45} />
                </div>
                <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-lg" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-44" />
                            </div>
                        </div>
                        <Skeleton className="h-11 w-28 rounded-md" />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
                        <Skeleton className="h-[460px] rounded-lg" />
                        <Skeleton className="h-[460px] rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="employee-glass-surface min-h-screen text-[var(--employee-ink)]">
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <GLSLHills width="100%" height="100%" speed={0.45} />
            </div>
            <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
                <header className="employee-glass-panel flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[var(--employee-line)] bg-[var(--employee-glass-muted)]">
                            <Image src="/logo.png" alt="Amwag" fill className="object-contain p-2" priority />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-accent)]">
                                {t('title')}
                            </p>
                            <h1 className="truncate text-xl font-semibold text-[var(--employee-ink-strong)]">
                                {employeeName}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="employee-glass-control inline-flex min-h-11 items-center gap-2 px-2">
                            <Languages className="h-4 w-4 text-[var(--employee-muted)]" aria-hidden="true" />
                            <LanguageSwitcher />
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="employee-glass-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:shadow-[var(--employee-focus-ring)]"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                </header>

                <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-start">
                    <div className="flex flex-col gap-4">
                        <div className="employee-glass-panel-strong px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                    {t('today')}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-[var(--employee-ink-strong)]">{formattedDate}</p>
                            </div>
                        </div>

                        <ClockHero
                            currentTime={currentTime}
                            locale={locale}
                            shiftStatus={shiftStatus}
                            shiftProgress={shiftProgress}
                            actionKind={actionKind}
                            actionLabel={actionLabel}
                            actionHint={actionHint}
                            timeLabel={t('cairoTime')}
                            progressLabel={t('shiftProgress')}
                            onCheckIn={handleCheckIn}
                            onCheckOut={handleCheckOut}
                            isLoading={isCheckingIn || isCheckingOut}
                            isDisabled={isMissingCheckout}
                        />

                        {(actionError || actionSuccess) && (
                            <div
                                role={actionError ? 'alert' : 'status'}
                                className={cn(
                                    'employee-glass-alert flex items-start gap-3 border px-4 py-3 text-sm font-medium',
                                    actionError
                                        ? 'border-[var(--employee-danger)]/30 bg-[var(--employee-danger-soft)] text-[var(--employee-danger)]'
                                        : 'border-[var(--employee-success)]/25 bg-[var(--employee-success-soft)] text-[var(--employee-success)]'
                                )}
                            >
                                {actionError ? (
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                )}
                                <span dir="auto">{actionError || actionSuccess}</span>
                            </div>
                        )}
                    </div>

                    <aside className="employee-glass-panel p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                    {t('employeeSummary')}
                                </p>
                                <h2 className="mt-1 truncate text-xl font-semibold text-[var(--employee-ink-strong)]">
                                    {employeeName}
                                </h2>
                                <p className="mt-1 truncate text-sm text-[var(--employee-muted)]">{profile?.email || '-'}</p>
                            </div>
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--employee-line)] bg-[var(--employee-glass-muted)] text-lg font-semibold text-[var(--employee-accent)]">
                                {employeeName.charAt(0).toUpperCase()}
                            </div>
                        </div>

                        <div className="mt-5 border-y border-[var(--employee-line)]">
                            <DetailRow icon={Briefcase} label={t('jobTitle')} value={profile?.job_title || '-'} />
                            <DetailRow icon={MapPin} label={t('branch')} value={branchName} />
                            <DetailRow
                                icon={Timer}
                                label={t('shiftWindow')}
                                value={`${formatShiftTimeForLocale(profile?.shift_start ?? null, locale)} - ${formatShiftTimeForLocale(profile?.shift_end ?? null, locale)}`}
                            />
                        </div>

                        <section className="mt-6" aria-labelledby="today-record-heading">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                        {t('todaysRecord')}
                                    </p>
                                    <h3 id="today-record-heading" className="mt-1 text-base font-semibold text-[var(--employee-ink-strong)]">
                                        {todayRecord ? t('recordAvailable') : t('recordEmpty')}
                                    </h3>
                                </div>
                                <span className="employee-status-pill inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                                    <StatusMarker tone={statusTone} />
                                    {statusLabel}
                                </span>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--employee-line)] bg-[var(--employee-glass-muted)]">
                                <dl className="divide-y divide-[var(--employee-line)]">
                                    <div className="employee-record-grid grid gap-3 bg-[var(--employee-glass-muted)] px-4 py-3">
                                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                            {t('status')}
                                        </dt>
                                        <dd className="flex items-center gap-2 text-sm font-semibold text-[var(--employee-ink-strong)]">
                                            <StatusMarker tone={statusTone} />
                                            {todayRecord?.status ? statusCopy(todayRecord.status, t) : statusLabel}
                                        </dd>
                                    </div>
                                    <div className="employee-record-grid grid gap-3 px-4 py-3">
                                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                            {t('checkInTime')}
                                        </dt>
                                        <dd className="text-sm font-semibold text-[var(--employee-ink-strong)]">
                                            {formatCairoTimestamp(todayRecord?.check_in_time ?? null, locale)}
                                        </dd>
                                    </div>
                                    <div className="employee-record-grid grid gap-3 px-4 py-3">
                                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                            {t('checkOutTime')}
                                        </dt>
                                        <dd className="text-sm font-semibold text-[var(--employee-ink-strong)]">
                                            {formatCairoTimestamp(todayRecord?.check_out_time ?? null, locale)}
                                        </dd>
                                    </div>
                                    {issueRows.map((row) => (
                                        <div key={row.label} className="employee-record-grid grid gap-3 px-4 py-3">
                                            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                                                {row.label}
                                            </dt>
                                            <dd
                                                className={cn(
                                                    'text-sm font-semibold',
                                                    row.active && row.tone === 'warning' && 'text-[var(--employee-warning)]',
                                                    row.active && row.tone === 'success' && 'text-[var(--employee-success)]',
                                                    !row.active && 'text-[var(--employee-ink-strong)]'
                                                )}
                                            >
                                                {row.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {!todayRecord && (
                                <div className="mt-4 rounded-2xl border border-dashed border-[var(--employee-line-strong)] bg-[var(--employee-glass-muted)] px-4 py-5 text-sm leading-6 text-[var(--employee-muted)]">
                                    {t('recordEmptyDetail')}
                                </div>
                            )}
                        </section>
                    </aside>
                </div>

                <Footer className="pb-3 pt-2" compact />
            </main>

            <ToastContainer />
        </div>
    );
}
