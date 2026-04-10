'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    Calendar,
    Clock,
    LogOut,
    MapPin,
    Timer,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { formatLateness, formatOvertime, formatTimestamp, formatTime } from '@/lib/utils';
import type { AttendanceRecord, Profile } from '@/types';
import {
    Badge,
    Button,
    Skeleton,
    ToastContainer,
    addToast,
    AnimatedCounter,
    StaggerGroup,
    StaggerItem,
    PageReveal,
} from '@/components/ui';
import { ClockHero } from '@/components/employee/ClockHero';
import { SplineScene } from '@/components/ui/splite';

function getEgyptToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}

async function fetchTodayRecord() {
    const response = await fetch('/api/attendance/me', { credentials: 'include' });
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load attendance');
    }

    const today = getEgyptToday();
    const records = (result.data || []) as AttendanceRecord[];
    return records.find((record) => record.date === today) ?? null;
}

export default function EmployeePortal() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
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
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [locale, router]);

    const refreshTodayRecord = async () => {
        setTodayRecord(await fetchTodayRecord());
    };

    const handleCheckIn = async () => {
        setIsCheckingIn(true);
        try {
            const response = await fetch('/api/attendance/check-in', { method: 'POST' });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            addToast('Checked in successfully!', 'success');
            await refreshTodayRecord();
        } catch (error) {
            console.error('Check-in error:', error);
            addToast(error instanceof Error ? error.message : 'Failed to check in', 'error');
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleCheckOut = async () => {
        setIsCheckingOut(true);
        try {
            const response = await fetch('/api/attendance/check-out', { method: 'POST' });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            addToast('Checked out successfully!', 'success');
            await refreshTodayRecord();
        } catch (error) {
            console.error('Check-out error:', error);
            addToast(error instanceof Error ? error.message : 'Failed to check out', 'error');
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

    // Compute shift progress (0-1) based on shift_start/shift_end
    const shiftProgress = (() => {
        if (!profile?.shift_start || !profile?.shift_end) return 0;
        if (shiftStatus === 'complete') return 1;
        if (shiftStatus === 'idle') return 0;
        const now = currentTime;
        const [sh, sm] = profile.shift_start.split(':').map(Number);
        const [eh, em] = profile.shift_end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const total = endMins - startMins;
        if (total <= 0) return 0;
        return Math.min(Math.max((nowMins - startMins) / total, 0), 1);
    })();

    const formattedDate = currentTime.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const statusBadge = isMissingCheckout
        ? { variant: 'missing_checkout' as const, label: t('missingCheckout') }
        : hasCheckedOut
            ? { variant: 'present' as const, label: t('dayComplete') }
            : isOnShift
                ? { variant: 'info' as const, label: t('currentlyOnShift') }
                : { variant: 'default' as const, label: t('startYourDay') };

    if (isLoading) {
        return (
            <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    {/* Header skeleton */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-[1.2rem]" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-40" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-28 rounded-full" />
                            <Skeleton className="h-10 w-28 rounded-full" />
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Skeleton className="h-[520px] rounded-3xl" />
                        <div className="space-y-6">
                            <Skeleton className="h-60 rounded-3xl" />
                            <Skeleton className="h-52 rounded-3xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isRTL = locale === 'ar';

    return (
        <div className={`relative flex min-h-screen overflow-hidden ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* ── Content column (65%) ── */}
            <motion.div
                className="w-full px-4 py-6 sm:px-6 lg:w-[65%] lg:px-8"
                initial={{ x: isRTL ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
            <div className="mx-auto flex max-w-4xl flex-col gap-6">

                {/* Header */}
                <PageReveal className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-primary)]/80 px-4 py-3 backdrop-blur-lg">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[var(--surface)] p-2">
                            <Image
                                src="/logo.png"
                                alt="Amwag"
                                fill
                                className="object-contain p-1"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--accent)]">
                                {t('title')}
                            </p>
                            <h1 className="truncate text-lg font-bold text-[var(--foreground)]">
                                {profile?.full_name || 'Employee workspace'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    </div>
                </PageReveal>

                {/* Main grid */}
                <div className="grid gap-6 lg:grid-cols-2">

                    {/* Left: Clock Hero Card */}
                    <PageReveal delay={0.08}>
                        <div className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 backdrop-blur-2xl sm:p-8">
                            {/* Date & status row */}
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                                    <Calendar className="h-4 w-4 text-[var(--accent)]" />
                                    <span>{formattedDate}</span>
                                </div>
                                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                            </div>

                            {/* Clock with check-in/out button */}
                            <ClockHero
                                currentTime={currentTime}
                                shiftStatus={shiftStatus}
                                shiftProgress={shiftProgress}
                                onCheckIn={handleCheckIn}
                                onCheckOut={handleCheckOut}
                                isLoading={isCheckingIn || isCheckingOut}
                                t={t}
                            />

                            {/* Status text */}
                            <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                    Next action
                                </p>
                                <p className="mt-1.5 font-semibold text-[var(--foreground)]">
                                    {isMissingCheckout
                                        ? t('missingCheckout')
                                        : hasCheckedOut
                                            ? t('shiftCompleted')
                                            : hasCheckedIn
                                                ? t('currentlyOnShift')
                                                : t('startYourDay')}
                                </p>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                    {isMissingCheckout
                                        ? `${t('checkIn')}: ${formatTimestamp(todayRecord?.check_in_time ?? null)}`
                                        : hasCheckedOut
                                            ? `${t('checkOut')}: ${formatTimestamp(todayRecord?.check_out_time ?? null)}`
                                            : hasCheckedIn
                                                ? `${t('checkIn')}: ${formatTimestamp(todayRecord?.check_in_time ?? null)}`
                                                : 'Your shift card is ready for the first tap.'}
                                </p>
                            </div>
                        </div>
                    </PageReveal>

                    {/* Right: Profile + Today's Record */}
                    <StaggerGroup className="flex flex-col gap-6" delayChildren={0.12}>

                        {/* Profile Card */}
                        <StaggerItem>
                            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 backdrop-blur-2xl">
                                <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                    Profile
                                </p>
                                <div className="flex items-start gap-4">
                                    {/* Avatar with animated gradient ring when on shift */}
                                    <div className="relative shrink-0">
                                        <motion.div
                                            className="absolute inset-[-3px] rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--secondary)]"
                                            animate={isOnShift ? { rotate: 360 } : {}}
                                            transition={
                                                isOnShift
                                                    ? { duration: 8, ease: 'linear', repeat: Infinity }
                                                    : {}
                                            }
                                        />
                                        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xl font-bold text-[var(--foreground)]">
                                            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="truncate text-xl font-bold text-[var(--foreground)]">
                                            {profile?.full_name || 'Employee'}
                                        </h2>
                                        <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                                            {profile?.email || ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-2">
                                    {profile?.job_title && (
                                        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground-soft)]">
                                            <Briefcase className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                            <span className="truncate">{profile.job_title}</span>
                                        </div>
                                    )}
                                    {profile?.branch && (
                                        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground-soft)]">
                                            <MapPin className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                            <span className="truncate">{profile.branch}</span>
                                        </div>
                                    )}
                                    {(profile?.shift_start || profile?.shift_end) && (
                                        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground-soft)]">
                                            <Timer className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                            <span>
                                                {formatTime(profile?.shift_start ?? null)} – {formatTime(profile?.shift_end ?? null)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </StaggerItem>

                        {/* Today's Record Card */}
                        <StaggerItem>
                            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 backdrop-blur-2xl">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                            {t('todaysRecord')}
                                        </p>
                                        <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">
                                            {todayRecord ? 'Your day at a glance' : 'No record yet'}
                                        </h2>
                                    </div>
                                    {todayRecord?.status && (
                                        <Badge variant={todayRecord.status}>{todayRecord.status}</Badge>
                                    )}
                                </div>

                                {todayRecord ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {/* Check-in */}
                                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                                {t('checkIn')}
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--foreground)]">
                                                {formatTimestamp(todayRecord.check_in_time)}
                                            </p>
                                        </div>
                                        {/* Check-out */}
                                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                                {t('checkOut')}
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--foreground)]">
                                                {formatTimestamp(todayRecord.check_out_time)}
                                            </p>
                                        </div>
                                        {/* Late minutes */}
                                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                                {t('late')}
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--foreground)]">
                                                {todayRecord.late_minutes != null && todayRecord.late_minutes > 0 ? (
                                                    <AnimatedCounter
                                                        value={todayRecord.late_minutes}
                                                        suffix=" min"
                                                        className="text-[var(--warning)]"
                                                    />
                                                ) : (
                                                    formatLateness(todayRecord.late_minutes)
                                                )}
                                            </p>
                                        </div>
                                        {/* Overtime */}
                                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
                                                {t('overtime')}
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--foreground)]">
                                                {todayRecord.overtime_minutes != null && todayRecord.overtime_minutes > 0 ? (
                                                    <AnimatedCounter
                                                        value={todayRecord.overtime_minutes}
                                                        suffix=" min"
                                                        className="text-[var(--success)]"
                                                    />
                                                ) : (
                                                    formatOvertime(todayRecord.overtime_minutes || 0)
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-6 text-center">
                                        <Clock className="h-8 w-8 text-[var(--muted)]" />
                                        <p className="text-sm leading-6 text-[var(--muted)]">
                                            Your attendance record will appear here after the first check-in.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </StaggerItem>
                    </StaggerGroup>
                </div>
            </div>

            <Footer className="relative z-10 pb-3 pt-8" compact />
            </motion.div>

            {/* ── Spline column (35%) — desktop only ── */}
            <motion.div
                className="hidden lg:block lg:w-[35%] relative overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.5 }}
            >
                <SplineScene
                    scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                    className="w-full h-full"
                />
            </motion.div>

            <ToastContainer />
        </div>
    );
}
