'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Input,
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    addToast,
} from '@/components/ui';
import {
    formatDate,
    formatTimestamp,
    formatLateness,
    formatEarlyDeparture,
    getStatusColor,
    exportToCSV,
} from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import {
    Download,
    Search,
    Filter,
    Calendar,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Globe,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AttendanceLogsPage() {
    const supabase = useMemo(() => createClient(), []);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    const fetchAttendance = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('attendance')
                .select(
                    `
          *,
          profiles (
            full_name,
            email,
            branch,
            job_title
          )
        `
                )
                .order('date', { ascending: false })
                .order('check_in_time', { ascending: false });

            if (dateFilter) {
                query = query.eq('date', dateFilter);
            }

            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            addToast('Failed to load attendance records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [dateFilter, statusFilter]);

    const filteredRecords = records.filter((record) => {
        const profile = record.profiles;
        const searchLower = searchQuery.toLowerCase();
        return (
            profile?.full_name?.toLowerCase().includes(searchLower) ||
            profile?.branch?.toLowerCase().includes(searchLower) ||
            profile?.email?.toLowerCase().includes(searchLower)
        );
    });

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const paginatedRecords = filteredRecords.slice(
        (currentPage - 1) * recordsPerPage,
        currentPage * recordsPerPage
    );

    const handleExportCSV = () => {
        const exportData = filteredRecords.map((record) => ({
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
            Status: record.status,
            'IP Address': record.ip_address || '-',
        }));

        exportToCSV(exportData, `attendance_logs_${new Date().toISOString().split('T')[0]}`);
        addToast('CSV exported successfully', 'success');
    };

    const handleExportExcel = () => {
        const exportData = filteredRecords.map((record) => ({
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
            Status: record.status,
            'IP Address': record.ip_address || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Logs');
        XLSX.writeFile(wb, `amwag_attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast('Excel exported successfully', 'success');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-50">
                        Attendance Logs
                    </h1>
                    <p className="text-slate-400 mt-1">
                        View and export attendance records
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel}>
                        <Download className="w-4 h-4 mr-2" />
                        Excel
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <Input
                                placeholder="Search by name, email, or branch..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10"
                            />
                        </div>

                        {/* Date Filter */}
                        <div className="relative w-full md:w-48">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10"
                            />
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full md:w-40 px-4 py-2.5 text-slate-100 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="" className="bg-slate-800">All Status</option>
                            <option value="present" className="bg-slate-800">Present</option>
                            <option value="late" className="bg-slate-800">Late</option>
                            <option value="absent" className="bg-slate-800">Absent</option>
                        </select>

                        {/* Refresh */}
                        <Button variant="ghost" onClick={fetchAttendance} className="md:w-auto">
                            <RefreshCw className="w-5 h-5" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Employee
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Branch
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Date
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Check In
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Check Out
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Lateness
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Early Leave
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    Status
                                </th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">
                                    IP Address
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td colSpan={9} className="px-6 py-4">
                                            <div className="h-8 bg-slate-800 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : paginatedRecords.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-6 py-12 text-center text-slate-500"
                                    >
                                        No attendance records found
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecords.map((record) => (
                                    <tr
                                        key={record.id}
                                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold">
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
                                        <td className="px-6 py-4 text-slate-400">
                                            {record.profiles?.branch || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {formatDate(record.date)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {formatTimestamp(record.check_in_time)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {formatTimestamp(record.check_out_time)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`${record.late_minutes > 0
                                                    ? 'text-amber-400 font-medium'
                                                    : 'text-slate-500'
                                                    }`}
                                            >
                                                {formatLateness(record.late_minutes)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`${(record.early_departure_minutes || 0) > 0
                                                    ? 'text-orange-400 font-medium'
                                                    : 'text-slate-500'
                                                    }`}
                                            >
                                                {formatEarlyDeparture(record.early_departure_minutes || 0)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                                    record.status
                                                )}`}
                                            >
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Globe className="w-4 h-4" />
                                                <span className="text-sm font-mono">
                                                    {record.ip_address || '-'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
                        <p className="text-sm text-slate-500">
                            Showing {(currentPage - 1) * recordsPerPage + 1} to{' '}
                            {Math.min(currentPage * recordsPerPage, filteredRecords.length)} of{' '}
                            {filteredRecords.length} records
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
