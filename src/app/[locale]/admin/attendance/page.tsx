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
import { Badge, Button, Card, CardContent, GlowingCard, AnimatedCounter, Input, PageReveal, Skeleton, addToast } from '@/components/ui';
import { formatDate, formatEarlyDeparture, formatLateness, formatOvertime, formatTimestamp } from '@/lib/utils';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
import type { AttendanceRecord } from '@/types';

const RECORDS_PER_PAGE = 10;

export default function AttendanceLogsPage() {
    const t = useTranslations('AttendanceLogs');
    const locale = useLocale();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);
    const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
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

                setRecords(result.data ?? []);
                setTotalRecords(result.total ?? 0);
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
                <GlowingCard>
                    <div className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('title')}</p>
                            <h1 className="gradient-text text-4xl font-bold sm:text-5xl">
                                Attendance history with a calmer read
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                                Search the full attendance history, compare punctuality, and export
                                reports without dropping back into a dense legacy table feel.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-[0.24em]">Records</p>
                                <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                                    <AnimatedCounter value={isLoading ? 0 : totalRecords} />
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-[0.24em]">Mode</p>
                                <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                                    {showAllHistory ? t('allHistory') : dateFilter || 'Date-specific'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-[0.24em]">Status</p>
                                <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                                    {statusFilter || t('allStatus')}
                                </p>
                            </div>
                        </div>
                    </div>
                </GlowingCard>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-3 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Exports</p>
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
                <Card className="rounded-2xl">
                    <CardContent className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_auto_auto_auto] xl:p-5">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                className="ps-11"
                            />
                        </div>

                        <div className="relative min-w-0">
                            <Calendar className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(event) => {
                                    setDateFilter(event.target.value);
                                    setShowAllHistory(false);
                                    setCurrentPage(1);
                                }}
                                className="ps-11"
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
                            onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}
                            className="focus-ring w-full cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] xl:w-44"
                        >
                            <option value="" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('allStatus')}</option>
                            <option value="present" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('present')}</option>
                            <option value="late" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('late')}</option>
                            <option value="absent" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('absent')}</option>
                            <option value="missing_checkout" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('missingCheckout')}</option>
                            <option value="pending" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('pending')}</option>
                        </select>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
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
                <Card className="rounded-2xl">
                    <CardContent className="space-y-3 p-12 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--accent)]">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--foreground)]">{t('chooseDateTitle')}</h2>
                        <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--muted)]">
                            {t('chooseDateDescription')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-2xl">
                    <div className="md:hidden">
                        {isLoading ? (
                            <div className="space-y-3 p-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                        <Skeleton className="h-5 w-40" />
                                        <Skeleton className="mt-2 h-4 w-24" />
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            {Array.from({ length: 6 }).map((__, metricIndex) => (
                                                <Skeleton key={metricIndex} className="h-14 w-full rounded-xl" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : records.length === 0 ? (
                            <div className="px-3 py-12 text-center text-[var(--muted)]">
                                {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
                            </div>
                        ) : (
                            <div className="space-y-3 p-3">
                                {records.map((record) => (
                                    <div key={record.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--surface-strong)] font-semibold text-[var(--foreground-soft)]">
                                                    {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-[var(--foreground)]">
                                                        {record.profiles?.full_name || '-'}
                                                    </p>
                                                    <p className="truncate text-sm text-[var(--muted)]">
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
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('branch')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{record.profiles?.branch || '-'}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('date')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatDate(record.date)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('checkIn')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.check_in_time)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('checkOut')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.check_out_time)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('lateness')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatLateness(record.late_minutes)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('overtime')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatOvertime(record.overtime_minutes || 0)}</p>
                                            </div>
                                            <div className="col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('checkInIP')}</p>
                                                <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">{record.ip_address || '-'}</p>
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
                                <tr className="border-b border-[var(--line)] bg-[var(--surface)]">
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('employee')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('branch')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('date')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkIn')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkOut')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('lateness')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('earlyLeave')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('overtime')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('status')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkInLocation')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkInIP')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkOutLocation')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkOutIP')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <tr key={index} className="border-b border-[var(--line)]">
                                            {Array.from({ length: 13 }).map((__, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-4">
                                                    <Skeleton className="h-10 w-full rounded-[1rem]" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="px-4 py-12 text-center text-[var(--muted)]">
                                            {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="border-b border-[var(--line)] hover:bg-[var(--surface-hover)]">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[var(--surface-strong)] font-semibold text-[var(--foreground-soft)]">
                                                        {record.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-[var(--foreground)]">{record.profiles?.full_name || '-'}</p>
                                                        <p className="text-sm text-[var(--muted)]">{record.profiles?.email || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{record.profiles?.branch || '-'}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatDate(record.date)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.check_in_time)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatTimestamp(record.check_out_time)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatLateness(record.late_minutes)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatEarlyDeparture(record.early_departure_minutes || 0)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatOvertime(record.overtime_minutes || 0)}</td>
                                            <td className="px-4 py-4">
                                                <Badge variant={record.status}>
                                                    {record.status === 'missing_checkout'
                                                        ? t('missingCheckout')
                                                        : record.status === 'pending'
                                                            ? t('pending')
                                                            : t(record.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{record.check_in_location || '-'}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-[var(--foreground-soft)]">
                                                    <Globe className="h-3.5 w-3.5 text-[var(--accent)]" />
                                                    <span className="font-mono text-xs text-[var(--muted)]">{record.ip_address || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{record.check_out_location || '-'}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-[var(--foreground-soft)]">
                                                    <Globe className="h-3.5 w-3.5 text-[var(--accent)]" />
                                                    <span className="font-mono text-xs text-[var(--muted)]">{record.check_out_ip || '-'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-[var(--muted)]">
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
                                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
