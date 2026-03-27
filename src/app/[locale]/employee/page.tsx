'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    Calendar,
    CheckCircle2,
    LogIn,
    LogOut,
    MapPin,
    Timer,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { createClient } from '@/lib/supabase/client';
import { formatLateness, formatOvertime, formatTime, formatTimestamp } from '@/lib/utils';
import type { AttendanceRecord, Profile } from '@/types';
import {
    Badge,
    Button,
    Card,
    CardContent,
    PageReveal,
    Skeleton,
    StaggerGroup,
    StaggerItem,
    ToastContainer,
    addToast,
} from '@/components/ui';

export default function EmployeePortal() {
    const router = useRouter();
    const supabase = createClient();
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
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.push(`/${locale}/login`);
                    return;
                }

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                setProfile(profileData);

                const today = new Date().toISOString().split('T')[0];
                const { data: attendanceData } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .single();

                setTodayRecord(attendanceData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [locale, router, supabase]);

    const refreshTodayRecord = async () => {
        const today = new Date().toISOString().split('T')[0];
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)
            .single();

        setTodayRecord(data);
    };

    const handleCheckIn = async () => {
        setIsCheckingIn(true);

        try {
            const response = await fetch('/api/attendance/check-in', {
                method: 'POST',
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error);
            }

            addToast('Checked in successfully!', 'success');
            await refreshTodayRecord();
        } catch (error) {
            console.error('Check-in error:', error);
            addToast(
                error instanceof Error ? error.message : 'Failed to check in',
                'error'
            );
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleCheckOut = async () => {
        setIsCheckingOut(true);

        try {
            const response = await fetch('/api/attendance/check-out', {
                method: 'POST',
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error);
            }

            addToast('Checked out successfully!', 'success');
            await refreshTodayRecord();
        } catch (error) {
            console.error('Check-out error:', error);
            addToast(
                error instanceof Error ? error.message : 'Failed to check out',
                'error'
            );
        } finally {
            setIsCheckingOut(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push(`/${locale}/login`);
        router.refresh();
    };

    const hasCheckedIn = !!todayRecord?.check_in_time;
    const hasCheckedOut = !!todayRecord?.check_out_time;
    const isOnShift = hasCheckedIn && !hasCheckedOut;

    const formattedDate = currentTime.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const formattedTime = currentTime.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    const attendanceMetrics = todayRecord
        ? [
              { label: t('checkIn'), value: formatTimestamp(todayRecord.check_in_time) },
              { label: t('checkOut'), value: formatTimestamp(todayRecord.check_out_time) },
              { label: t('late'), value: formatLateness(todayRecord.late_minutes) },
              { label: t('overtime'), value: formatOvertime(todayRecord.overtime_minutes || 0) },
          ]
        : [];

    const statusBadge = hasCheckedOut
        ? { variant: 'present' as const, label: t('dayComplete') }
        : isOnShift
            ? { variant: 'info' as const, label: t('currentlyOnShift') }
            : { variant: 'default' as const, label: t('startYourDay') };

    if (isLoading) {
        return (
            <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
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

                    <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
                        <Card className="rounded-[2.4rem]">
                            <CardContent className="space-y-6 p-6 sm:p-8">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-14 w-3/4 rounded-[1.6rem]" />
                                <Skeleton className="h-36 rounded-[2rem]" />
                                <Skeleton className="h-14 rounded-full" />
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="rounded-[2.2rem]">
                                <CardContent className="space-y-4 p-6">
                                    <Skeleton className="h-20 rounded-[1.6rem]" />
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-4 w-1/2" />
                                </CardContent>
                            </Card>
                            <Card className="rounded-[2.2rem]">
                                <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <Skeleton key={index} className="h-24 rounded-[1.5rem]" />
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[10%] top-[16%] h-40 w-40 rounded-full bg-rose-300/30 blur-3xl" />
                <div className="absolute bottom-[14%] right-[8%] h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
            </div>

            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <PageReveal className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-14 w-14 rounded-[1.3rem] bg-[rgba(255,255,255,0.8)] p-3 shadow-[0_22px_46px_-28px_rgba(72,47,56,0.5)]">
                            <Image
                                src="/logo.png"
                                alt="Amwag"
                                fill
                                className="object-contain p-2"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="section-kicker">{t('title')}</p>
                            <h1 className="display-serif truncate text-3xl text-[#1e191d] sm:text-4xl">
                                {profile?.full_name || 'Employee workspace'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                        <LanguageSwitcher />
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </Button>
                    </div>
                </PageReveal>

                <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
                    <PageReveal delay={0.08}>
                        <Card className="editorial-frame rounded-[2.5rem] border-[rgba(66,42,50,0.08)]">
                            <CardContent className="relative space-y-8 p-6 sm:p-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-sm text-[#75676d]">
                                            <Calendar className="h-4 w-4 text-[#9d174d]" />
                                            <span>{formattedDate}</span>
                                        </div>
                                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                                    </div>

                                    <div>
                                        <p className="section-kicker">Live clock</p>
                                        <div className="display-serif mt-3 text-5xl text-[#1f191d] sm:text-7xl">
                                            {formattedTime}
                                        </div>
                                        <p className="mt-3 max-w-xl text-sm leading-7 text-[#6f6268]">
                                            Check in cleanly, stay aware of shift timing, and close
                                            the day with a complete record.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 rounded-[2rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-5 sm:grid-cols-[1fr_auto] sm:items-end">
                                    <div>
                                        <p className="section-kicker">Next action</p>
                                        <p className="mt-3 text-lg font-semibold text-[#251e23]">
                                            {hasCheckedOut
                                                ? t('shiftCompleted')
                                                : hasCheckedIn
                                                    ? t('currentlyOnShift')
                                                    : t('startYourDay')}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-[#72656a]">
                                            {hasCheckedOut
                                                ? `${t('checkOut')} ${formatTimestamp(todayRecord?.check_out_time ?? null)}`
                                                : hasCheckedIn
                                                    ? `${t('checkIn')} ${formatTimestamp(todayRecord?.check_in_time ?? null)}`
                                                    : 'Your shift card is ready for the first tap.'}
                                        </p>
                                    </div>

                                    {!hasCheckedIn ? (
                                        <Button
                                            onClick={handleCheckIn}
                                            disabled={isCheckingIn}
                                            size="lg"
                                            isLoading={isCheckingIn}
                                            className="w-full bg-[#0f9f6e] hover:bg-[#0b8a5f] sm:w-auto"
                                        >
                                            <LogIn className="h-5 w-5" />
                                            {t('checkIn')}
                                        </Button>
                                    ) : !hasCheckedOut ? (
                                        <Button
                                            onClick={handleCheckOut}
                                            disabled={isCheckingOut}
                                            variant="danger"
                                            size="lg"
                                            isLoading={isCheckingOut}
                                            className="w-full sm:w-auto"
                                        >
                                            <LogOut className="h-5 w-5" />
                                            {t('checkOut')}
                                        </Button>
                                    ) : (
                                        <div className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 font-semibold text-emerald-700">
                                            <CheckCircle2 className="h-5 w-5" />
                                            {t('dayComplete')}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </PageReveal>

                    <StaggerGroup className="space-y-6" delayChildren={0.12}>
                        <StaggerItem>
                            <Card className="rounded-[2.2rem]">
                                <CardContent className="space-y-5 p-6">
                                    <div className="flex items-start gap-4">
                                        <div className={`flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#171419] text-2xl font-bold text-white ${isOnShift ? 'animate-pulse-glow' : ''}`}>
                                            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="section-kicker">Profile</p>
                                            <h2 className="mt-2 truncate text-2xl font-semibold text-[#1e191d]">
                                                {profile?.full_name || 'Employee'}
                                            </h2>
                                            <p className="mt-1 text-sm text-[#6e6468]">
                                                {profile?.email || 'Attendance member'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        {profile?.job_title && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] px-4 py-3 text-sm text-[#4f4549]">
                                                <Briefcase className="h-4 w-4 text-[#9d174d]" />
                                                <span>{profile.job_title}</span>
                                            </div>
                                        )}
                                        {profile?.branch && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] px-4 py-3 text-sm text-[#4f4549]">
                                                <MapPin className="h-4 w-4 text-[#9d174d]" />
                                                <span>{profile.branch}</span>
                                            </div>
                                        )}
                                        {(profile?.shift_start || profile?.shift_end) && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.54)] px-4 py-3 text-sm text-[#4f4549]">
                                                <Timer className="h-4 w-4 text-[#9d174d]" />
                                                <span>
                                                    {formatTime(profile?.shift_start ?? null)} - {formatTime(profile?.shift_end ?? null)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </StaggerItem>

                        <StaggerItem>
                            <Card className="rounded-[2.2rem]">
                                <CardContent className="space-y-4 p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="section-kicker">{t('todaysRecord')}</p>
                                            <h2 className="mt-2 text-xl font-semibold text-[#1e191d]">
                                                {todayRecord ? 'Your day at a glance' : 'No record yet'}
                                            </h2>
                                        </div>
                                        {todayRecord?.status && (
                                            <Badge variant={todayRecord.status}>{todayRecord.status}</Badge>
                                        )}
                                    </div>

                                    {todayRecord ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {attendanceMetrics.map((metric) => (
                                                <div
                                                    key={metric.label}
                                                    className="rounded-[1.6rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.6)] p-4"
                                                >
                                                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">
                                                        {metric.label}
                                                    </p>
                                                    <p className="mt-3 text-lg font-semibold text-[#241d22]">
                                                        {metric.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[1.8rem] border border-dashed border-[rgba(66,42,50,0.14)] bg-[rgba(255,255,255,0.44)] p-5 text-sm leading-7 text-[#6e6367]">
                                            Your attendance record will appear here after the first
                                            check-in.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </StaggerItem>
                    </StaggerGroup>
                </div>
            </div>

            <Footer className="relative z-10 pb-3 pt-8" compact />
            <ToastContainer />
        </div>
    );
}
