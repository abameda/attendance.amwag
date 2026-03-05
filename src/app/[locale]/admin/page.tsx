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
            gradient: 'from-blue-500 to-blue-600',
            shadowColor: 'shadow-blue-500/30',
        },
        {
            titleKey: 'presentToday',
            value: stats.presentToday,
            icon: UserCheck,
            gradient: 'from-emerald-500 to-emerald-600',
            shadowColor: 'shadow-emerald-500/30',
        },
        {
            titleKey: 'lateToday',
            value: stats.lateToday,
            icon: Clock,
            gradient: 'from-amber-500 to-amber-600',
            shadowColor: 'shadow-amber-500/30',
        },
        {
            titleKey: 'absentToday',
            value: stats.absentToday,
            icon: UserX,
            gradient: 'from-red-500 to-red-600',
            shadowColor: 'shadow-red-500/30',
        },
    ], [stats]);

    const today = useMemo(() => new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }), [locale]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-50">
                        {t('title')}
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {today}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 rounded-xl border border-teal-500/20 shadow-sm shadow-teal-500/5">
                    <TrendingUp className="w-5 h-5 text-teal-400" />
                    <span className="text-sm font-medium text-teal-300">
                        {t('attendanceRate')}:{' '}
                        {stats.totalEmployees > 0
                            ? Math.round(
                                ((stats.presentToday + stats.lateToday) / stats.totalEmployees) * 100
                            )
                            : 0}
                        %
                    </span>
                </div>
            </div>

            <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {statCards.map((card) => (
                    <Card key={card.titleKey} interactive className="overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-400">
                                        {t(card.titleKey)}
                                    </p>
                                    {isLoading ? (
                                        <Skeleton className="h-9 w-16 mt-2" />
                                    ) : (
                                        <p className="text-3xl font-bold text-slate-50 mt-2">
                                            {card.value}
                                        </p>
                                    )}
                                </div>
                                <div
                                    className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-lg ${card.shadowColor}`}
                                >
                                    <card.icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800/60">
                <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-slate-50 mb-4">
                        {t('quickActions')}
                    </h2>
                    <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link
                            href="/admin/employees"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-all group border border-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">{t('manageEmployees')}</p>
                                <p className="text-sm text-slate-400">{t('addOrEditStaff')}</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-all group border border-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                                <ClipboardList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">{t('viewAttendance')}</p>
                                <p className="text-sm text-slate-400">{t('checkDailyLogs')}</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-all group border border-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">{t('exportReports')}</p>
                                <p className="text-sm text-slate-400">{t('downloadCSV')}</p>
                            </div>
                        </Link>
                        <button
                            onClick={handleMarkAbsences}
                            disabled={isMarkingAbsent}
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-red-500/10 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">
                                    {isMarkingAbsent ? '...' : t('markAbsences')}
                                </p>
                                <p className="text-sm text-slate-400">{t('recordAbsentToday')}</p>
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
