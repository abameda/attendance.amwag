'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Button,
    Input,
    Card,
    CardContent,
    Skeleton,
    Badge,
    addToast,
} from '@/components/ui';
import {
    formatDate,
    formatTimestamp,
    formatLateness,
    formatEarlyDeparture,
    formatOvertime,
    exportToCSV,
} from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import {
    Download,
    Search,
    Calendar,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Globe,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslations } from 'next-intl';

export default function AttendanceLogsPage() {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;
    const t = useTranslations('AttendanceLogs');

    const fetchAttendance = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                pageSize: String(recordsPerPage),
            });

            if (dateFilter) {
                params.set('date', dateFilter);
            }

            if (statusFilter) {
                params.set('status', statusFilter);
            }

            if (debouncedSearch.trim()) {
                params.set('search', debouncedSearch.trim());
            }

            const response = await fetch(`/api/attendance?${params.toString()}`);
            const result: {
                success: boolean;
                data?: AttendanceRecord[];
                total?: number;
                error?: string;
            } = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to fetch attendance');
            }

            setRecords(result.data || []);
            setTotalRecords(result.total || 0);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            addToast('Failed to load attendance records', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, dateFilter, statusFilter, debouncedSearch]);

    const fetchAllFilteredRecords = useCallback(async () => {
        const params = new URLSearchParams({
            page: '1',
            pageSize: '10000',
        });

        if (dateFilter) {
            params.set('date', dateFilter);
        }

        if (statusFilter) {
            params.set('status', statusFilter);
        }

        if (searchQuery.trim()) {
            params.set('search', searchQuery.trim());
        }

        const response = await fetch(`/api/attendance?${params.toString()}`);
        const result: {
            success: boolean;
            data?: AttendanceRecord[];
            error?: string;
        } = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to fetch export data');
        }

        return result.data || [];
    }, [dateFilter, statusFilter, searchQuery]);

    useEffect(() => {
        const debounceTimeout = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);

        return () => clearTimeout(debounceTimeout);
    }, [searchQuery]);

    useEffect(() => {
        fetchAttendance();
    }, [dateFilter, statusFilter, currentPage, debouncedSearch, fetchAttendance]);

    // Pagination
    const totalPages = Math.ceil(totalRecords / recordsPerPage);

    const handleExportCSV = useCallback(async () => {
        try {
            const allFilteredRecords = await fetchAllFilteredRecords();
            const exportData = allFilteredRecords.map((record) => ({
                'Employee Name': record.profiles?.full_name || '-',
                Email: record.profiles?.email || '-',
                Branch: record.profiles?.branch || '-',
                Date: record.date,
                'Check In': record.check_in_time
                    ? new Date(record.check_in_time).toLocaleTimeString()
                    : '-',
                'Check Out': record.check_out_time
                    ? new Date(record.check_out_time).toLocaleTimeString()
                    : '-',
                'Late Minutes': record.late_minutes,
                'Early Departure Minutes': record.early_departure_minutes || 0,
                'Overtime Minutes': record.overtime_minutes || 0,
                Status: record.status,
                'Check In Location': record.check_in_location || '-',
                'Check Out Location': record.check_out_location || '-',
            }));

            exportToCSV(exportData, `attendance_logs_${new Date().toISOString().split('T')[0]}`);
            addToast('CSV exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            addToast('Failed to export CSV', 'error');
        }
    }, [fetchAllFilteredRecords]);

    const handleExportExcel = useCallback(async () => {
        try {
            const allFilteredRecords = await fetchAllFilteredRecords();
            const exportData = allFilteredRecords.map((record) => ({
                'Employee Name': record.profiles?.full_name || '-',
                Email: record.profiles?.email || '-',
                Branch: record.profiles?.branch || '-',
                Date: record.date,
                'Check In': record.check_in_time
                    ? new Date(record.check_in_time).toLocaleTimeString()
                    : '-',
                'Check Out': record.check_out_time
                    ? new Date(record.check_out_time).toLocaleTimeString()
                    : '-',
                'Late Minutes': record.late_minutes,
                'Early Departure Minutes': record.early_departure_minutes || 0,
                'Overtime Minutes': record.overtime_minutes || 0,
                Status: record.status,
                'Check In Location': record.check_in_location || '-',
                'Check Out Location': record.check_out_location || '-',
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance Logs');
            XLSX.writeFile(wb, `amwag_attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
            addToast('Excel exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            addToast('Failed to export Excel', 'error');
        }
    }, [fetchAllFilteredRecords]);

    return (
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-50">
                        {t('title')}
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        {t('subtitle')}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="w-3.5 h-3.5 me-1.5" />
                        CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportExcel}>
                        <Download className="w-3.5 h-3.5 me-1.5" />
                        Excel
                    </Button>
                </div>
            </div>

            <Card className="premium-card">
                <CardContent className="p-3 relative z-10">
                    <div className="flex flex-col md:flex-row gap-3 md:flex-nowrap">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>

                        <div className="relative w-full md:w-44 shrink-0">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full md:w-32 shrink-0 px-3 py-2 text-sm text-slate-100 bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 transition-colors hover:border-white/20"
                        >
                            <option value="" className="bg-slate-800">{t('allStatus')}</option>
                            <option value="present" className="bg-slate-800">{t('present')}</option>
                            <option value="late" className="bg-slate-800">{t('late')}</option>
                            <option value="absent" className="bg-slate-800">{t('absent')}</option>
                            <option value="missing_checkout" className="bg-slate-800">{t('missingCheckout')}</option>
                        </select>

                        <Button variant="ghost" size="sm" onClick={fetchAttendance} className="md:w-auto shrink-0">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="premium-card">
                <div className="overflow-x-auto relative z-10 custom-scrollbar">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="border-b border-white/5 bg-slate-900/40">
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('employee')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('branch')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('date')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkIn')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkOut')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('lateness')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('earlyLeave')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('overtime')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('status')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkInLocation')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkInIP')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkOutLocation')}
                                </th>
                                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('checkOutIP')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="w-10 h-10 rounded-lg" />
                                                <div className="space-y-1.5">
                                                    <Skeleton className="h-4 w-28" />
                                                    <Skeleton className="h-3 w-36" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                    </tr>
                                ))
                            ) : records.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={13}
                                        className="px-3 py-12 text-center text-slate-500"
                                    >
                                        {t('noRecords')}
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr
                                        key={record.id}
                                        className="border-b border-white/5 hover:bg-slate-800/40 transition-colors group"
                                    >
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                                                    {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-100">
                                                        {record.profiles?.full_name || '-'}
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        {record.profiles?.email || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-slate-400">
                                            {record.profiles?.branch || '-'}
                                        </td>
                                        <td className="px-3 py-3 text-slate-400">
                                            {formatDate(record.date)}
                                        </td>
                                        <td className="px-3 py-3 text-slate-400">
                                            {formatTimestamp(record.check_in_time)}
                                        </td>
                                        <td className="px-3 py-3 text-slate-400">
                                            {formatTimestamp(record.check_out_time)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`${record.late_minutes > 0
                                                    ? 'text-amber-400 font-medium'
                                                    : 'text-slate-500'
                                                    }`}
                                            >
                                                {formatLateness(record.late_minutes)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`${(record.early_departure_minutes || 0) > 0
                                                    ? 'text-orange-400 font-medium'
                                                    : 'text-slate-500'
                                                    }`}
                                            >
                                                {formatEarlyDeparture(record.early_departure_minutes || 0)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`${(record.overtime_minutes || 0) > 0
                                                    ? 'text-teal-400 font-medium'
                                                    : 'text-slate-500'
                                                    }`}
                                            >
                                                {formatOvertime(record.overtime_minutes || 0)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <Badge variant={record.status as 'present' | 'late' | 'absent' | 'missing_checkout'}>
                                                {record.status}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {record.check_in_location === 'خارج الشركة' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                                                        ⚠️ {record.check_in_location || '-'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                                        ✅ {record.check_in_location || '-'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Globe className="w-3 h-3 text-slate-500" />
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {record.ip_address || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {record.check_out_location === 'خارج الشركة' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                                                        ⚠️ {record.check_out_location || '-'}
                                                    </span>
                                                ) : record.check_out_location ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                                        ✅ {record.check_out_location}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Globe className="w-3 h-3 text-slate-500" />
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {record.check_out_ip || '-'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-3 border-t border-white/5 relative z-10">
                        <p className="text-sm text-slate-500">
                            {t('showing')} {totalRecords === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1} {t('to')}{' '}
                            {Math.min((currentPage - 1) * recordsPerPage + records.length, totalRecords)} {t('of')}{' '}
                            {totalRecords} {t('records')}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
