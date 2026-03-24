'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, FileText, Globe, RefreshCw, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, Input, Skeleton, addToast } from '@/components/ui';
import { formatDate, formatEarlyDeparture, formatLateness, formatOvertime, formatTimestamp } from '@/lib/utils';
import { exportAttendancePDF } from '@/lib/pdfExport';
import type { AttendanceRecord } from '@/types';

const RECORDS_PER_PAGE = 10;

function getAttendanceCacheKey(params: URLSearchParams) {
    return `attendance-logs:${params.toString()}`;
}

export default function AttendanceLogsPage() {
    const t = useTranslations('AttendanceLogs');
    const locale = useLocale();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            page: String(currentPage),
            pageSize: String(RECORDS_PER_PAGE),
            includeExpected: 'true',
        });

        if (dateFilter && !showAllHistory) params.set('date', dateFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (deferredSearch.trim()) params.set('search', deferredSearch.trim());

        return params;
    }, [currentPage, dateFilter, showAllHistory, statusFilter, deferredSearch]);

    useEffect(() => {
        if (!dateFilter && !showAllHistory) {
            setRecords([]);
            setTotalRecords(0);
            setIsLoading(false);
            return;
        }

        const cacheKey = getAttendanceCacheKey(queryParams);
        const cachedValue = sessionStorage.getItem(cacheKey);
        if (cachedValue) {
            const cachedResult = JSON.parse(cachedValue) as {
                data: AttendanceRecord[];
                total: number;
            };
            setRecords(cachedResult.data);
            setTotalRecords(cachedResult.total);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);

        void (async () => {
            try {
                const response = await fetch(`/api/attendance?${queryParams.toString()}`, {
                    signal: controller.signal,
                });
                const result: {
                    success: boolean;
                    data?: AttendanceRecord[];
                    total?: number;
                    error?: string;
                } = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Failed to fetch attendance');
                }

                const payload = {
                    data: result.data ?? [],
                    total: result.total ?? 0,
                };

                setRecords(payload.data);
                setTotalRecords(payload.total);
                sessionStorage.setItem(cacheKey, JSON.stringify(payload));
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Attendance fetch error:', error);
                setRecords([]);
                setTotalRecords(0);
                addToast(t('loadError'), 'error');
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [dateFilter, queryParams, refreshKey, showAllHistory, t]);

    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

    async function fetchAllFilteredRecords() {
        if (!dateFilter && !showAllHistory) {
            throw new Error('Select a date before exporting');
        }

        const params = new URLSearchParams({
            page: '1',
            pageSize: '10000',
            includeExpected: 'true',
        });

        if (dateFilter && !showAllHistory) params.set('date', dateFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (deferredSearch.trim()) params.set('search', deferredSearch.trim());

        const response = await fetch(`/api/attendance?${params.toString()}`);
        const result: {
            success: boolean;
            data?: AttendanceRecord[];
            error?: string;
        } = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to fetch export data');
        }

        return result.data ?? [];
    }

    async function handleExportPDF() {
        try {
            const allFilteredRecords = await fetchAllFilteredRecords();
            await exportAttendancePDF(allFilteredRecords, {
                locale,
                dateFilter,
                statusFilter: statusFilter || undefined,
                searchQuery: deferredSearch.trim() || undefined,
            });
            addToast(t('exportSuccess'), 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            addToast(
                error instanceof Error ? error.message : t('exportError'),
                'error'
            );
        }
    }

    return (
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-50">{t('title')}</h1>
                    <p className="text-slate-400 text-sm mt-0.5">{t('subtitle')}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    disabled={(!dateFilter && !showAllHistory) || isLoading}
                >
                    <FileText className="w-3.5 h-3.5 me-1.5" />
                    PDF
                </Button>
            </div>

            <Card className="premium-card">
                <CardContent className="p-3 relative z-10">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>

                        <div className="relative w-full md:w-48 shrink-0">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(event) => {
                                    setDateFilter(event.target.value);
                                    setShowAllHistory(false);
                                    setCurrentPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>

                        <Button
                            variant={showAllHistory ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setShowAllHistory((currentValue) => !currentValue);
                                setCurrentPage(1);
                            }}
                            className="shrink-0"
                        >
                            {t('allHistory')}
                        </Button>

                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full md:w-40 shrink-0 px-3 py-2 text-sm text-slate-100 bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 transition-colors hover:border-white/20"
                        >
                            <option value="" className="bg-slate-800">{t('allStatus')}</option>
                            <option value="present" className="bg-slate-800">{t('present')}</option>
                            <option value="late" className="bg-slate-800">{t('late')}</option>
                            <option value="absent" className="bg-slate-800">{t('absent')}</option>
                            <option value="missing_checkout" className="bg-slate-800">{t('missingCheckout')}</option>
                            <option value="pending" className="bg-slate-800">{t('pending')}</option>
                        </select>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                sessionStorage.removeItem(getAttendanceCacheKey(queryParams));
                                setRefreshKey((value) => value + 1);
                                setCurrentPage(1);
                            }}
                            className="md:w-auto shrink-0"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {!dateFilter && !showAllHistory ? (
                <Card className="premium-card">
                    <CardContent className="p-10 text-center space-y-3">
                        <Calendar className="w-10 h-10 text-cyan-400 mx-auto" />
                        <h2 className="text-xl font-semibold text-white">{t('chooseDateTitle')}</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">{t('chooseDateDescription')}</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="premium-card">
                    <div className="overflow-x-auto relative z-10 custom-scrollbar">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-white/5 bg-slate-900/40">
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('employee')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('branch')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('date')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkIn')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkOut')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('lateness')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('earlyLeave')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('overtime')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('status')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkInLocation')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkInIP')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkOutLocation')}</th>
                                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('checkOutIP')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    [...Array(5)].map((_, index) => (
                                        <tr key={index} className="border-b border-white/5">
                                            <td className="px-3 py-3"><Skeleton className="h-12 w-40" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                                        </tr>
                                    ))
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="px-3 py-12 text-center text-slate-500">
                                            {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
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
                                                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-lg shadow-cyan-500/20">
                                                        {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-100">{record.profiles?.full_name || '-'}</p>
                                                        <p className="text-sm text-slate-500">{record.profiles?.email || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-400">{record.profiles?.branch || '-'}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatDate(record.date)}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatTimestamp(record.check_in_time)}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatTimestamp(record.check_out_time)}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatLateness(record.late_minutes)}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatEarlyDeparture(record.early_departure_minutes || 0)}</td>
                                            <td className="px-3 py-3 text-slate-400">{formatOvertime(record.overtime_minutes || 0)}</td>
                                            <td className="px-3 py-3">
                                                <Badge variant={record.status}>
                                                    {record.status === 'missing_checkout'
                                                        ? t('missingCheckout')
                                                        : record.status === 'pending'
                                                            ? t('pending')
                                                            : t(record.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 text-slate-400">{record.check_in_location || '-'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe className="w-3 h-3 text-slate-500" />
                                                    <span className="text-xs text-slate-400 font-mono">{record.ip_address || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-400">{record.check_out_location || '-'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe className="w-3 h-3 text-slate-500" />
                                                    <span className="text-xs text-slate-400 font-mono">{record.check_out_ip || '-'}</span>
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
                                {t('showing')} {totalRecords === 0 ? 0 : (currentPage - 1) * RECORDS_PER_PAGE + 1} {t('to')}{' '}
                                {Math.min((currentPage - 1) * RECORDS_PER_PAGE + records.length, totalRecords)} {t('of')}{' '}
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
            )}
        </div>
    );
}
