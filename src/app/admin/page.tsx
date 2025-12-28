'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, Button, addToast } from '@/components/ui';
import { Users, UserCheck, Clock, UserX, TrendingUp, Calendar, AlertTriangle, ClipboardList } from 'lucide-react';
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

    const fetchStats = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get total employees
            const { count: totalEmployees } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'employee');

            // Get today's attendance
            const { data: todayAttendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('date', today);

            const presentToday = todayAttendance?.filter((a) => a.status === 'present').length || 0;
            const lateToday = todayAttendance?.filter((a) => a.status === 'late').length || 0;
            const checkedIn = (todayAttendance?.length || 0);
            const absentToday = (totalEmployees || 0) - checkedIn;

            setStats({
                totalEmployees: totalEmployees || 0,
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

    const handleMarkAbsences = async () => {
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
    };

    const statCards = [
        {
            title: 'Total Employees',
            value: stats.totalEmployees,
            icon: Users,
            gradient: 'from-blue-500 to-blue-600',
            shadowColor: 'shadow-blue-500/30',
        },
        {
            title: 'Present Today',
            value: stats.presentToday,
            icon: UserCheck,
            gradient: 'from-emerald-500 to-emerald-600',
            shadowColor: 'shadow-emerald-500/30',
        },
        {
            title: 'Late Today',
            value: stats.lateToday,
            icon: Clock,
            gradient: 'from-amber-500 to-amber-600',
            shadowColor: 'shadow-amber-500/30',
        },
        {
            title: 'Absent Today',
            value: stats.absentToday,
            icon: UserX,
            gradient: 'from-red-500 to-red-600',
            shadowColor: 'shadow-red-500/30',
        },
    ];

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-50">
                        Dashboard
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {today}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 rounded-xl border border-teal-500/30">
                    <TrendingUp className="w-5 h-5 text-teal-400" />
                    <span className="text-sm font-medium text-teal-300">
                        Attendance Rate:{' '}
                        {stats.totalEmployees > 0
                            ? Math.round(
                                ((stats.presentToday + stats.lateToday) / stats.totalEmployees) * 100
                            )
                            : 0}
                        %
                    </span>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {statCards.map((card) => (
                    <Card key={card.title} className="overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-400">
                                        {card.title}
                                    </p>
                                    <p className="text-3xl font-bold text-slate-50 mt-2">
                                        {isLoading ? '-' : card.value}
                                    </p>
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

            {/* Quick Actions */}
            <Card>
                <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-slate-50 mb-4">
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <a
                            href="/admin/employees"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors group border border-slate-700/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">Manage Employees</p>
                                <p className="text-sm text-slate-400">Add or edit staff</p>
                            </div>
                        </a>
                        <a
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors group border border-slate-700/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                                <ClipboardList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">View Attendance</p>
                                <p className="text-sm text-slate-400">Check daily logs</p>
                            </div>
                        </a>
                        <a
                            href="/admin/attendance"
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors group border border-slate-700/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">Export Reports</p>
                                <p className="text-sm text-slate-400">Download CSV/Excel</p>
                            </div>
                        </a>
                        <button
                            onClick={handleMarkAbsences}
                            disabled={isMarkingAbsent}
                            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-red-500/10 transition-colors group text-left disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700/50"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-100">
                                    {isMarkingAbsent ? 'Processing...' : 'Mark Absences'}
                                </p>
                                <p className="text-sm text-slate-400">Record absent today</p>
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
