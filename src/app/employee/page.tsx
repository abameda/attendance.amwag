'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Card,
    CardContent,
    addToast,
    ToastContainer,
} from '@/components/ui';
import { formatTime, formatTimestamp, formatLateness, getStatusColor } from '@/lib/utils';
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

export default function EmployeePortal() {
    const router = useRouter();
    const supabase = createClient();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch user data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.push('/login');
                    return;
                }

                // Get profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                setProfile(profileData);

                // Get today's attendance
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
    }, [supabase, router]);

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

            // Refresh attendance data
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

            // Refresh attendance data
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
        router.push('/login');
        router.refresh();
    };

    const hasCheckedIn = !!todayRecord?.check_in_time;
    const hasCheckedOut = !!todayRecord?.check_out_time;

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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-teal-500/5 to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-teal-500/5 to-transparent rounded-full blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-slate-800">
                        <Image
                            src="/logo.png"
                            alt="Amwag"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-50">Amwag</h1>
                        <p className="text-xs text-slate-500">Attendance System</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 px-4 max-w-lg mx-auto w-full flex flex-col justify-center py-2">
                {/* Date & Time Display */}
                <div className="text-center py-3">
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formattedDate}</span>
                    </div>
                    <div className="text-4xl sm:text-5xl font-bold text-slate-50 tracking-tight font-mono">
                        {formattedTime}
                    </div>
                </div>

                {/* User Profile Card */}
                <Card className="mb-3 bg-slate-900/80 backdrop-blur-xl border-slate-800">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/20 flex-shrink-0">
                                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-bold text-slate-50">
                                    {profile?.full_name || 'Employee'}
                                </h2>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                    {profile?.job_title && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Briefcase className="w-3 h-3" />
                                            {profile.job_title}
                                        </div>
                                    )}
                                    {profile?.branch && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <MapPin className="w-3 h-3" />
                                            {profile.branch}
                                        </div>
                                    )}
                                    {(profile?.shift_start || profile?.shift_end) && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Timer className="w-3 h-3" />
                                            {formatTime(profile?.shift_start)} - {formatTime(profile?.shift_end)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Status */}
                {todayRecord && (
                    <Card className="mb-3 bg-slate-900/80 backdrop-blur-xl border-slate-800">
                        <CardContent className="p-4">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Today&apos;s Record
                            </h3>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500">Check In</p>
                                    <p className="font-semibold text-slate-50 text-sm">
                                        {formatTimestamp(todayRecord.check_in_time)}
                                    </p>
                                </div>
                                <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500">Check Out</p>
                                    <p className="font-semibold text-slate-50 text-sm">
                                        {formatTimestamp(todayRecord.check_out_time)}
                                    </p>
                                </div>
                                <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500">Status</p>
                                    <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${getStatusColor(
                                            todayRecord.status
                                        )}`}
                                    >
                                        {todayRecord.status}
                                    </span>
                                </div>
                                <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500">Late</p>
                                    <p
                                        className={`font-semibold text-sm ${todayRecord.late_minutes > 0
                                            ? 'text-amber-400'
                                            : 'text-slate-50'
                                            }`}
                                    >
                                        {formatLateness(todayRecord.late_minutes)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Action Buttons */}
                <div>
                    {!hasCheckedIn ? (
                        <button
                            onClick={handleCheckIn}
                            disabled={isCheckingIn}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                        >
                            {isCheckingIn ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <LogIn className="w-6 h-6" />
                                    Check In
                                </>
                            )}
                        </button>
                    ) : !hasCheckedOut ? (
                        <button
                            onClick={handleCheckOut}
                            disabled={isCheckingOut}
                            className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                        >
                            {isCheckingOut ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <LogOut className="w-6 h-6" />
                                    Check Out
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="w-full py-4 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-300 text-lg font-bold rounded-xl flex items-center justify-center gap-3">
                            <CheckCircle2 className="w-6 h-6" />
                            Day Complete
                        </div>
                    )}
                </div>

                {/* Status Message */}
                <div className="mt-2 text-center text-sm">
                    {hasCheckedOut ? (
                        <p className="text-slate-500 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Shift completed for today
                        </p>
                    ) : hasCheckedIn ? (
                        <p className="text-slate-500 flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 text-teal-500 animate-pulse" />
                            Currently on shift
                        </p>
                    ) : (
                        <p className="text-slate-500">
                            Start your day by checking in
                        </p>
                    )}
                </div>
            </main>

            {/* Developer Signature */}
            <footer className="relative z-10 py-2 text-center">
                <p className="text-xs text-slate-600">
                    Developed by <span className="font-semibold text-slate-500">Eng/Abdelhmeed Elshorbagy</span>
                </p>
                <div className="flex items-center justify-center gap-4 mt-1">
                    <a
                        href="https://www.instagram.com/abamedax/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-pink-400 transition-colors"
                        title="Instagram"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                    </a>
                    <a
                        href="https://www.linkedin.com/in/abameda/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-teal-400 transition-colors"
                        title="LinkedIn"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                    </a>
                </div>
            </footer>

            <ToastContainer />
        </div>
    );
}
