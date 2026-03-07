'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, Skeleton, addToast } from '@/components/ui';
import { Users, UserCheck, Clock, UserX, TrendingUp, Calendar, AlertTriangle, ClipboardList } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import type { DashboardStats } from '@/types';

export default function AdminDashboard() {
    // Memoize the supabase client to prevent recreation on every render
    const supabase = useMemo(() => createClient(), []);
    const [stats, setStats] = useState<DashboardStats>({
        totalEmployees: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingAbsent, setIsMarkingAbsent] = useState(false);
    const t = useTranslations('Dashboard');
    const locale = useLocale();

    const fetchStats = useCallback(async () => {
        try {
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

            const [employeeResult, presentResult, lateResult, checkedInResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('role', 'employee'),
                supabase
                    .from('attendance')
                    .select('id', { count: 'exact', head: true })
                    .eq('date', today)
                    .eq('status', 'present'),
                supabase
                    .from('attendance')
                    .select('id', { count: 'exact', head: true })
                    .eq('date', today)
                    .eq('status', 'late'),
                supabase
                    .from('attendance')
                    .select('id', { count: 'exact', head: true })
                    .eq('date', today),
            ]);

            const totalEmployees = employeeResult.count || 0;
            const presentToday = presentResult.count || 0;
            const lateToday = lateResult.count || 0;
            const checkedIn = checkedInResult.count || 0;
            const absentToday = totalEmployees - checkedIn;

            setStats({
                totalEmployees,
                presentToday,
                lateToday,
                absentToday: absentToday > 0 ? absentToday : 0,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMarkAbsences = useCallback(async () => {
        if (!confirm('This will mark all employees who haven\'t checked in today as absent. Continue?')) {
            return;
        }

        setIsMarkingAbsent(true);
        try {
            const response = await fetch('/api/attendance/mark-absent', {
                method: 'POST',
            });
            const result = await response.json();

            if (result.success) {
                addToast(`Marked ${result.markedAbsent} employee(s) as absent`, 'success');
                // Refresh stats without full page reload
                await fetchStats();
            } else {
                addToast(result.error || 'Failed to mark absences', 'error');
            }
        } catch (error) {
            console.error('Error marking absences:', error);
            addToast('Failed to mark absences', 'error');
        } finally {
            setIsMarkingAbsent(false);
        }
    }, [fetchStats]);

    const statCards = useMemo(() => [
        {
            titleKey: 'totalEmployees',
            value: stats.totalEmployees,
            icon: Users,
            iconStyle: 'bg-blue-500/20 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
        },
        {
            titleKey: 'presentToday',
            value: stats.presentToday,
            icon: UserCheck,
            iconStyle: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        },
        {
            titleKey: 'lateToday',
            value: stats.lateToday,
            icon: Clock,
            iconStyle: 'bg-amber-500/20 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        },
        {
            titleKey: 'absentToday',
            value: stats.absentToday,
            icon: UserX,
            iconStyle: 'bg-red-500/20 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        },
    ], [stats]);

    const today = useMemo(() => new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }), [locale]);

    return (
        <div className="space-y-8 animate-fade-in-up relative z-10 w-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
                        {t('title')}
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        {today}
                    </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 premium-surface rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    <TrendingUp className="w-5 h-5 text-cyan-400 relative z-10" />
                    <span className="text-sm font-bold text-white relative z-10 tracking-wide">
                        {t('attendanceRate')}:{' '}
                        <span className="text-cyan-300">
                            {stats.totalEmployees > 0
                                ? Math.round(
                                    ((stats.presentToday + stats.lateToday) / stats.totalEmployees) * 100
                                )
                                : 0}
                            %
                        </span>
                    </span>
                </div>
            </div>

            <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {statCards.map((card) => (
                    <Card key={card.titleKey} className="overflow-hidden premium-card card-hover group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        <CardContent className="p-6 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                                        {t(card.titleKey)}
                                    </p>
                                    {isLoading ? (
                                        <Skeleton className="h-10 w-20 bg-slate-800/50" />
                                    ) : (
                                        <p className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                                            {card.value}
                                        </p>
                                    )}
                                </div>
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-110 ${card.iconStyle}`}>
                                    <card.icon className="w-6 h-6 drop-shadow-lg" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="premium-surface overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                <CardContent className="p-6 lg:p-8 relative z-10">
                    <h2 className="text-xl font-bold text-white mb-6 tracking-wide flex items-center gap-3">
                        <div className="w-2 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                        {t('quickActions')}
                    </h2>
                    <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link
                            href="/admin/employees"
                            className="flex items-center gap-4 p-4 premium-surface !bg-slate-900/40 rounded-2xl transition-all duration-300 group border border-white/5 hover:border-cyan-500/30 hover:bg-slate-800/60 focus-ring hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10"
                        >
                            <div className="w-12 h-12 bg-slate-800 text-slate-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl flex items-center justify-center transition-all duration-300 border border-white/5">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">{t('manageEmployees')}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{t('addOrEditStaff')}</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 premium-surface !bg-slate-900/40 rounded-2xl transition-all duration-300 group border border-white/5 hover:border-emerald-500/30 hover:bg-slate-800/60 focus-ring hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10"
                        >
                            <div className="w-12 h-12 bg-slate-800 text-slate-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded-xl flex items-center justify-center transition-all duration-300 border border-white/5">
                                <ClipboardList className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">{t('viewAttendance')}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{t('checkDailyLogs')}</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 premium-surface !bg-slate-900/40 rounded-2xl transition-all duration-300 group border border-white/5 hover:border-purple-500/30 hover:bg-slate-800/60 focus-ring hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10"
                        >
                            <div className="w-12 h-12 bg-slate-800 text-slate-400 group-hover:bg-purple-500/20 group-hover:text-purple-400 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-xl flex items-center justify-center transition-all duration-300 border border-white/5">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">{t('exportReports')}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{t('downloadCSV')}</p>
                            </div>
                        </Link>
                        <button
                            onClick={handleMarkAbsences}
                            disabled={isMarkingAbsent}
                            className="flex items-center text-left gap-4 p-4 premium-surface !bg-slate-900/40 rounded-2xl transition-all duration-300 group border border-white/5 hover:border-red-500/30 hover:bg-slate-800/60 focus-ring hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
                        >
                            <div className="w-12 h-12 bg-slate-800 text-slate-400 group-hover:bg-red-500/20 group-hover:text-red-400 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] rounded-xl flex items-center justify-center transition-all duration-300 border border-white/5">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                                    {isMarkingAbsent ? '...' : t('markAbsences')}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{t('recordAbsentToday')}</p>
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
