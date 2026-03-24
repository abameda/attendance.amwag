'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    Skeleton,
    Badge,
    addToast,
    ToastContainer,
} from '@/components/ui';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale, useTranslations } from 'next-intl';
import { formatTime, formatTimestamp, formatLateness, formatOvertime } from '@/lib/utils';
import type { Profile, AttendanceRecord } from '@/types';
import {
    LogIn,
    LogOut,
    Clock,
    Calendar,
    CheckCircle2,
    Timer,
    MapPin,
    Briefcase,
} from 'lucide-react';
import Footer from '@/components/Footer';

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
    }, [locale, supabase, router]);

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

            const today = new Date().toISOString().split('T')[0];
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .single();
                setTodayRecord(data);
            }
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

            const today = new Date().toISOString().split('T')[0];
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('date', today)
                    .single();
                setTodayRecord(data);
            }
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

    const formattedDate = currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const formattedTime = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    if (isLoading) {
        return (
            <div className="min-h-dvh flex min-h-screen flex-col bg-slate-950">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div>
                            <Skeleton className="h-4 w-16 rounded mb-1" />
                            <Skeleton className="h-3 w-24 rounded" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-24 rounded-lg" />
                        <Skeleton className="h-9 w-20 rounded-xl" />
                    </div>
                </div>

                <div className="flex-1 px-4 max-w-lg mx-auto w-full flex flex-col justify-center py-4 sm:py-6">
                    <div className="text-center py-3">
                        <Skeleton className="h-4 w-48 mx-auto rounded mb-2" />
                        <Skeleton className="h-12 w-56 mx-auto rounded-lg" />
                    </div>

                    <div className="mb-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-36 rounded mb-1.5" />
                                <Skeleton className="h-3 w-48 rounded" />
                            </div>
                        </div>
                    </div>

                    <div className="mb-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                        <Skeleton className="h-3 w-28 rounded mb-3" />
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <Skeleton className="h-2.5 w-12 rounded mb-1.5" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Skeleton className="h-14 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex min-h-screen flex-col bg-slate-950 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/[0.04] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-[400px] h-[400px] bg-teal-600/[0.03] rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px]" />
            </div>

            <header className="relative z-10 p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in-up">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="relative w-10 h-10 bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 border border-slate-800/60 shadow-xl shadow-black/20">
                        <Image
                            src="/logo.png"
                            alt="Amwag"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-slate-50">Amwag</h1>
                        <p className="text-xs text-slate-500">{t('title')}</p>
                    </div>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    <LanguageSwitcher />
                    <button
                        onClick={handleLogout}
                        className="flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-slate-400 transition-all duration-200 hover:bg-slate-800/50 hover:text-slate-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            <main className="relative z-10 flex-1 px-4 max-w-lg mx-auto w-full flex flex-col justify-center py-4 sm:py-6">
                <div className="stagger">
                    <div className="py-3 text-center">
                        <div className="mb-1 flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span className="max-w-full break-words">{formattedDate}</span>
                        </div>
                        <div className="font-mono text-3xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                            {formattedTime}
                        </div>
                    </div>

                    <Card interactive className="mb-3 bg-slate-900/60 backdrop-blur-xl border-slate-800/60">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/20 flex-shrink-0 ${
                                        isOnShift ? 'animate-pulse-glow' : ''
                                    }`}
                                >
                                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-bold text-slate-50 truncate">
                                        {profile?.full_name || 'Employee'}
                                    </h2>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {profile?.job_title && (
                                            <div className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
                                                <Briefcase className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{profile.job_title}</span>
                                            </div>
                                        )}
                                        {profile?.branch && (
                                            <div className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
                                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{profile.branch}</span>
                                            </div>
                                        )}
                                        {(profile?.shift_start || profile?.shift_end) && (
                                            <div className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
                                                <Timer className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">
                                                    {formatTime(profile?.shift_start ?? null)} - {formatTime(profile?.shift_end ?? null)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {todayRecord && (
                        <Card className="mb-3 bg-slate-900/60 backdrop-blur-xl border-slate-800/60">
                            <CardContent className="p-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    {t('todaysRecord')}
                                </h3>
                                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                                    <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                        <p className="text-[10px] text-slate-500 mb-0.5">{t('checkIn')}</p>
                                        <p className="font-semibold text-slate-50 text-sm">
                                            {formatTimestamp(todayRecord.check_in_time)}
                                        </p>
                                    </div>
                                    <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                        <p className="text-[10px] text-slate-500 mb-0.5">{t('checkOut')}</p>
                                        <p className="font-semibold text-slate-50 text-sm">
                                            {formatTimestamp(todayRecord.check_out_time)}
                                        </p>
                                    </div>
                                    <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                        <p className="text-[10px] text-slate-500 mb-0.5">{t('status')}</p>
                                        <Badge variant={todayRecord.status}>{todayRecord.status}</Badge>
                                    </div>
                                    <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                        <p className="text-[10px] text-slate-500 mb-0.5">{t('late')}</p>
                                        <p
                                            className={`font-semibold text-sm ${
                                                todayRecord.late_minutes > 0
                                                    ? 'text-amber-400'
                                                    : 'text-slate-50'
                                            }`}
                                        >
                                            {formatLateness(todayRecord.late_minutes)}
                                        </p>
                                    </div>
                                    <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                        <p className="text-[10px] text-slate-500 mb-0.5">{t('overtime')}</p>
                                        <p
                                            className={`font-semibold text-sm ${
                                                (todayRecord.overtime_minutes || 0) > 0
                                                    ? 'text-teal-400'
                                                    : 'text-slate-50'
                                            }`}
                                        >
                                            {formatOvertime(todayRecord.overtime_minutes || 0)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div>
                        {!hasCheckedIn ? (
                            <button
                                onClick={handleCheckIn}
                                disabled={isCheckingIn}
                                className="w-full min-h-[56px] py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            >
                                {isCheckingIn ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <>
                                        <LogIn className="w-6 h-6" />
                                        {t('checkIn')}
                                    </>
                                )}
                            </button>
                        ) : !hasCheckedOut ? (
                            <button
                                onClick={handleCheckOut}
                                disabled={isCheckingOut}
                                className="w-full min-h-[56px] py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            >
                                {isCheckingOut ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <>
                                        <LogOut className="w-6 h-6" />
                                        {t('checkOut')}
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="w-full min-h-[56px] py-4 bg-gradient-to-r from-slate-800 to-slate-800/80 text-slate-300 text-lg font-bold rounded-xl border border-slate-700/50 flex items-center justify-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                {t('dayComplete')}
                            </div>
                        )}
                    </div>

                    <div className="mt-2 text-center text-sm">
                        {hasCheckedOut ? (
                            <p className="text-slate-500 flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                {t('shiftCompleted')}
                            </p>
                        ) : hasCheckedIn ? (
                            <p className="text-slate-500 flex items-center justify-center gap-2">
                                <span className="animate-pulse-glow rounded-full p-0.5">
                                    <Clock className="w-4 h-4 text-teal-500" />
                                </span>
                                {t('currentlyOnShift')}
                            </p>
                        ) : (
                            <p className="text-slate-500">
                                {t('startYourDay')}
                            </p>
                        )}
                    </div>
                </div>
            </main>

            <Footer className="relative z-10 py-2" compact />

            <ToastContainer />
        </div>
    );
}
