'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileText,
    Globe,
    RefreshCw,
    Search,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, Input, PageReveal, Skeleton, addToast } from '@/components/ui';
import { formatDate, formatEarlyDeparture, formatLateness, formatOvertime, formatTimestamp } from '@/lib/utils';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
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

            await exportAttendancePremiumPDF(allFilteredRecords, {
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
        <div className="space-y-6">
            <PageReveal className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="editorial-frame rounded-[2.5rem] border-[rgba(66,42,50,0.08)]">
                    <CardContent className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="section-kicker">{t('title')}</p>
                            <h1 className="display-serif text-4xl text-[#1d181c] sm:text-5xl">
                                Attendance history with a calmer read
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[#6f6367]">
                                Search the full attendance history, compare punctuality, and export
                                reports without dropping back into a dense legacy table feel.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                <p className="section-kicker">Records</p>
                                <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                    {isLoading ? '...' : totalRecords}
                                </p>
                            </div>
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                <p className="section-kicker">Mode</p>
                                <p className="mt-3 text-lg font-semibold text-[#1e191d]">
                                    {showAllHistory ? t('allHistory') : dateFilter || 'Date-specific'}
                                </p>
                            </div>
                            <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                <p className="section-kicker">Status</p>
                                <p className="mt-3 text-lg font-semibold text-[#1e191d]">
                                    {statusFilter || t('allStatus')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.3rem]">
                    <CardContent className="space-y-3 p-6">
                        <p className="section-kicker">Exports</p>
                        <Button
                            size="sm"
                            onClick={() => handleExportPDF()}
                            disabled={(!dateFilter && !showAllHistory) || isLoading}
                            className="justify-between"
                        >
                            <span>Export PDF</span>
                            <FileText className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.08}>
                <Card className="rounded-[2.2rem]">
                    <CardContent className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_auto_auto_auto] xl:p-5">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a7a86]" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-11"
                            />
                        </div>

                        <div className="relative min-w-0">
                            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a7a86]" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(event) => {
                                    setDateFilter(event.target.value);
                                    setShowAllHistory(false);
                                    setCurrentPage(1);
                                }}
                                className="pl-11"
                            />
                        </div>

                        <Button
                            variant={showAllHistory ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setShowAllHistory((currentValue) => !currentValue);
                                setCurrentPage(1);
                            }}
                            className="w-full xl:w-auto"
                        >
                            {t('allHistory')}
                        </Button>

                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="focus-ring w-full cursor-pointer rounded-full border border-[rgba(66,42,50,0.12)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-[#221c21] xl:w-44"
                        >
                            <option value="">{t('allStatus')}</option>
                            <option value="present">{t('present')}</option>
                            <option value="late">{t('late')}</option>
                            <option value="absent">{t('absent')}</option>
                            <option value="missing_checkout">{t('missingCheckout')}</option>
                            <option value="pending">{t('pending')}</option>
                        </select>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                sessionStorage.removeItem(getAttendanceCacheKey(queryParams));
                                setRefreshKey((value) => value + 1);
                                setCurrentPage(1);
                            }}
                            className="w-full xl:w-auto"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </PageReveal>

            {!dateFilter && !showAllHistory ? (
                <Card className="rounded-[2.2rem]">
                    <CardContent className="space-y-3 p-12 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,255,255,0.72)] text-[#9d174d]">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-semibold text-[#1f1a1e]">{t('chooseDateTitle')}</h2>
                        <p className="mx-auto max-w-xl text-sm leading-7 text-[#73666a]">
                            {t('chooseDateDescription')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-[2.2rem]">
                    <div className="md:hidden">
                        {isLoading ? (
                            <div className="space-y-3 p-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                        <Skeleton className="h-5 w-40" />
                                        <Skeleton className="mt-2 h-4 w-24" />
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            {Array.from({ length: 6 }).map((__, metricIndex) => (
                                                <Skeleton key={metricIndex} className="h-14 w-full rounded-[1.2rem]" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : records.length === 0 ? (
                            <div className="px-3 py-12 text-center text-[#7a6c71]">
                                {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
                            </div>
                        ) : (
                            <div className="space-y-3 p-3">
                                {records.map((record) => (
                                    <div key={record.id} className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[#171419] font-semibold text-white">
                                                    {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-[#1f1a1e]">
                                                        {record.profiles?.full_name || '-'}
                                                    </p>
                                                    <p className="truncate text-sm text-[#7a6c71]">
                                                        {record.profiles?.email || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={record.status}>
                                                {record.status === 'missing_checkout'
                                                    ? t('missingCheckout')
                                                    : record.status === 'pending'
                                                        ? t('pending')
                                                        : t(record.status)}
                                            </Badge>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('branch')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{record.profiles?.branch || '-'}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('date')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{formatDate(record.date)}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('checkIn')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{formatTimestamp(record.check_in_time)}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('checkOut')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{formatTimestamp(record.check_out_time)}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('lateness')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{formatLateness(record.late_minutes)}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('overtime')}</p>
                                                <p className="mt-1 text-sm text-[#241d22]">{formatOvertime(record.overtime_minutes || 0)}</p>
                                            </div>
                                            <div className="col-span-2 rounded-[1.2rem] border border-[rgba(66,42,50,0.08)] bg-white/70 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#88797f]">{t('checkInIP')}</p>
                                                <p className="mt-1 break-all font-mono text-xs text-[#473d41]">{record.ip_address || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="custom-scrollbar hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)]">
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('employee')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('branch')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('date')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkIn')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkOut')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('lateness')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('earlyLeave')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('overtime')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('status')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkInLocation')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkInIP')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkOutLocation')}</th>
                                    <th className="px-4 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#88797f]">{t('checkOutIP')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <tr key={index} className="border-b border-[rgba(66,42,50,0.08)]">
                                            {Array.from({ length: 13 }).map((__, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-4">
                                                    <Skeleton className="h-10 w-full rounded-[1rem]" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="px-4 py-12 text-center text-[#7a6c71]">
                                            {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="border-b border-[rgba(66,42,50,0.08)] hover:bg-[rgba(255,255,255,0.4)]">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#171419] font-semibold text-white">
                                                        {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-[#1f1a1e]">{record.profiles?.full_name || '-'}</p>
                                                        <p className="text-sm text-[#7a6c71]">{record.profiles?.email || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{record.profiles?.branch || '-'}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatDate(record.date)}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatTimestamp(record.check_in_time)}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatTimestamp(record.check_out_time)}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatLateness(record.late_minutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatEarlyDeparture(record.early_departure_minutes || 0)}</td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{formatOvertime(record.overtime_minutes || 0)}</td>
                                            <td className="px-4 py-4">
                                                <Badge variant={record.status}>
                                                    {record.status === 'missing_checkout'
                                                        ? t('missingCheckout')
                                                        : record.status === 'pending'
                                                            ? t('pending')
                                                            : t(record.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{record.check_in_location || '-'}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-[#4f4549]">
                                                    <Globe className="h-3.5 w-3.5 text-[#9d174d]" />
                                                    <span className="font-mono text-xs">{record.ip_address || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[#4f4549]">{record.check_out_location || '-'}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-[#4f4549]">
                                                    <Globe className="h-3.5 w-3.5 text-[#9d174d]" />
                                                    <span className="font-mono text-xs">{record.check_out_ip || '-'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-[rgba(66,42,50,0.08)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-[#786b70]">
                                {t('showing')} {totalRecords === 0 ? 0 : (currentPage - 1) * RECORDS_PER_PAGE + 1} {t('to')}{' '}
                                {Math.min((currentPage - 1) * RECORDS_PER_PAGE + records.length, totalRecords)} {t('of')}{' '}
                                {totalRecords} {t('records')}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
