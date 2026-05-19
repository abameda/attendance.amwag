'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileText,
    Globe,
    RefreshCw,
    RotateCcw,
    Search,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, GlowingCard, AnimatedCounter, Input, PageReveal, Skeleton, addToast } from '@/components/ui';
import { formatDate, formatEarlyDeparture, formatLateness, formatOvertime, formatTimestamp } from '@/lib/utils';
import { exportAttendancePremiumPDF } from '@/lib/pdfExport';
import type { AttendanceRecord } from '@/types';

const RECORDS_PER_PAGE = 10;

type EmployeeOption = {
    id: string;
    full_name: string;
    email: string;
    branch: string | null;
};

type BranchOption = {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
};

type AttendanceSummary = {
    totalRecords: number;
    present: number;
    absent: number;
    late: number;
    earlyLeave: number;
    missingCheckout: number;
    overtime: number;
};

const emptySummary: AttendanceSummary = {
    totalRecords: 0,
    present: 0,
    absent: 0,
    late: 0,
    earlyLeave: 0,
    missingCheckout: 0,
    overtime: 0,
};

function todayIsoDate() {
    return new Date().toISOString().split('T')[0];
}

function formatShift(record: AttendanceRecord) {
    const start = record.profiles?.shift_start;
    const end = record.profiles?.shift_end;
    return start && end ? `${start} - ${end}` : '-';
}

function formatLocation(record: AttendanceRecord) {
    const checkIn = record.check_in_location || '-';
    const checkOut = record.check_out_location || '-';
    return checkIn === checkOut ? checkIn : `${checkIn} / ${checkOut}`;
}

export default function AttendanceLogsPage() {
    const t = useTranslations('AttendanceLogs');
    const locale = useLocale();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [summary, setSummary] = useState<AttendanceSummary>(emptySummary);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);
    const [dateFrom, setDateFrom] = useState(() => todayIsoDate());
    const [dateTo, setDateTo] = useState(() => todayIsoDate());
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const selectedEmployee = useMemo(
        () => employees.find((employee) => employee.id === employeeFilter),
        [employeeFilter, employees]
    );

    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            page: String(currentPage),
            pageSize: String(RECORDS_PER_PAGE),
            includeExpected: 'true',
        });

        if (!showAllHistory) {
            const effectiveDateFrom = !dateFrom && !dateTo ? todayIsoDate() : dateFrom;
            const effectiveDateTo = !dateFrom && !dateTo ? todayIsoDate() : dateTo;
            if (effectiveDateFrom) params.set('dateFrom', effectiveDateFrom);
            if (effectiveDateTo) params.set('dateTo', effectiveDateTo);
        }

        if (employeeFilter) params.set('employeeId', employeeFilter);
        if (branchFilter) params.set('branch', branchFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (deferredSearch.trim()) params.set('search', deferredSearch.trim());

        return params;
    }, [currentPage, dateFrom, dateTo, employeeFilter, branchFilter, showAllHistory, statusFilter, deferredSearch]);

    useEffect(() => {
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
                    summary?: AttendanceSummary;
                    error?: string;
                } = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Failed to fetch attendance');
                }

                setRecords(result.data ?? []);
                setTotalRecords(result.total ?? 0);
                setSummary(result.summary ?? emptySummary);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Attendance fetch error:', error);
                setRecords([]);
                setTotalRecords(0);
                setSummary(emptySummary);
                addToast(t('loadError'), 'error');
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [queryParams, refreshKey, t]);

    useEffect(() => {
        const controller = new AbortController();

        void (async () => {
            try {
                const [employeeResponse, branchResponse] = await Promise.all([
                    fetch('/api/employees', { signal: controller.signal }),
                    fetch('/api/admin/branches?active=true', { signal: controller.signal }),
                ]);

                if (employeeResponse.ok) {
                    const employeeResult: { success: boolean; data?: EmployeeOption[] } = await employeeResponse.json();
                    if (employeeResult.success) {
                        const nextEmployees = employeeResult.data ?? [];
                        setEmployees(nextEmployees);
                    }
                }

                if (branchResponse.ok) {
                    const branchResult: { success: boolean; data?: BranchOption[] } = await branchResponse.json();
                    if (branchResult.success) {
                        setBranchOptions(branchResult.data ?? []);
                    }
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Attendance filter option load error:', error);
                }
            }
        })();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const initialBranch = new URLSearchParams(window.location.search).get('branch');
        if (initialBranch) {
            setBranchFilter(initialBranch);
            setCurrentPage(1);
        }
    }, []);

    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);
    const activeDateLabel = showAllHistory
        ? t('allHistory')
        : dateFrom && dateTo
            ? `${dateFrom} - ${dateTo}`
            : dateFrom || dateTo || todayIsoDate();
    const summaryCards = [
        { label: t('records'), value: summary.totalRecords },
        { label: t('present'), value: summary.present },
        { label: t('absent'), value: summary.absent },
        { label: t('late'), value: summary.late },
        { label: t('earlyLeave'), value: summary.earlyLeave },
        { label: t('missingCheckout'), value: summary.missingCheckout },
        { label: t('overtime'), value: summary.overtime },
    ];

    async function fetchAllFilteredRecords() {
        const params = new URLSearchParams({
            page: '1',
            pageSize: '50000',
            includeExpected: 'true',
            export: 'true',
        });

        if (!showAllHistory) {
            const effectiveDateFrom = !dateFrom && !dateTo ? todayIsoDate() : dateFrom;
            const effectiveDateTo = !dateFrom && !dateTo ? todayIsoDate() : dateTo;
            if (effectiveDateFrom) params.set('dateFrom', effectiveDateFrom);
            if (effectiveDateTo) params.set('dateTo', effectiveDateTo);
        }

        if (employeeFilter) params.set('employeeId', employeeFilter);
        if (branchFilter) params.set('branch', branchFilter);
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
            let generatedBy: string | undefined;

            try {
                const userResponse = await fetch('/api/auth/me', { credentials: 'include' });
                const userResult: { success: boolean; data?: { full_name?: string } } = await userResponse.json();
                generatedBy = userResult.success ? userResult.data?.full_name : undefined;
            } catch {
                generatedBy = undefined;
            }

            await exportAttendancePremiumPDF(allFilteredRecords, {
                locale,
                dateRangeLabel: showAllHistory
                    ? t('allHistory')
                    : (dateFrom || (!dateFrom && !dateTo ? todayIsoDate() : '')) && (dateTo || (!dateFrom && !dateTo ? todayIsoDate() : ''))
                        ? `${dateFrom || todayIsoDate()} to ${dateTo || todayIsoDate()}`
                        : dateFrom || dateTo || todayIsoDate(),
                statusFilter: statusFilter || undefined,
                searchQuery: deferredSearch.trim() || undefined,
                employeeName: selectedEmployee?.full_name,
                branchName: branchFilter || undefined,
                generatedBy,
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
                                {t('heroTitle')}
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                                {t('heroDescription')}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {summaryCards.map((item) => (
                                <div key={item.label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                                    <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                                        <AnimatedCounter value={isLoading ? 0 : item.value} />
                                    </p>
                                </div>
                            ))}
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-[0.18em]">{t('dateRange')}</p>
                                <p className="mt-3 truncate text-base font-semibold text-[var(--foreground)]">{activeDateLabel}</p>
                            </div>
                        </div>
                    </div>
                </GlowingCard>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-3 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('exports')}</p>
                        <Button
                            size="sm"
                            onClick={() => handleExportPDF()}
                            disabled={isLoading}
                            className="justify-between"
                        >
                            <span>{t('exportPDF')}</span>
                            <FileText className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.08}>
                <Card className="rounded-2xl">
                    <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto_auto_auto] xl:p-5">
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

                        <select
                            value={employeeFilter}
                            onChange={(event) => {
                                setEmployeeFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="focus-ring w-full cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]"
                        >
                            <option value="" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('allEmployees')}</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id} className="bg-[var(--bg-secondary)] text-[var(--foreground)]">
                                    {employee.full_name}
                                    {employee.branch ? ` - ${employee.branch}` : ''}
                                </option>
                            ))}
                        </select>

                        <select
                            value={branchFilter}
                            onChange={(event) => {
                                setBranchFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="focus-ring w-full cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]"
                        >
                            <option value="" className="bg-[var(--bg-secondary)] text-[var(--foreground)]">{t('allBranches')}</option>
                            {branchOptions.map((branch) => (
                                <option key={branch.id} value={branch.name} className="bg-[var(--bg-secondary)] text-[var(--foreground)]">
                                    {branch.name}
                                </option>
                            ))}
                        </select>

                        <div className="relative min-w-0">
                            <Calendar className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(event) => {
                                    setDateFrom(event.target.value);
                                    setShowAllHistory(false);
                                    setCurrentPage(1);
                                }}
                                aria-label={t('dateFrom')}
                                className="ps-11"
                            />
                        </div>

                        <div className="relative min-w-0">
                            <Calendar className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(event) => {
                                    setDateTo(event.target.value);
                                    setShowAllHistory(false);
                                    setCurrentPage(1);
                                }}
                                aria-label={t('dateTo')}
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
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSearchQuery('');
                                setEmployeeFilter('');
                                setBranchFilter('');
                                setDateFrom(todayIsoDate());
                                setDateTo(todayIsoDate());
                                setStatusFilter('');
                                setShowAllHistory(false);
                                setCurrentPage(1);
                            }}
                            className="w-full xl:w-auto"
                        >
                            <RotateCcw className="h-4 w-4" />
                            <span className="xl:hidden 2xl:inline">{t('resetFilters')}</span>
                        </Button>

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
                                                    <p className="truncate font-medium text-[var(--foreground)]" dir="auto">
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
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]" dir="auto">{record.profiles?.branch || '-'}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('date')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatDate(record.date)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('shift')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatShift(record)}</p>
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
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('earlyLeave')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatEarlyDeparture(record.early_departure_minutes || 0)}</p>
                                            </div>
                                            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('overtime')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]">{formatOvertime(record.overtime_minutes || 0)}</p>
                                            </div>
                                            <div className="col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{t('location')}</p>
                                                <p className="mt-1 text-sm text-[var(--foreground-soft)]" dir="auto">{formatLocation(record)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="custom-scrollbar hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[1200px]">
                            <thead>
                                <tr className="border-b border-[var(--line)] bg-[var(--surface)]">
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('employee')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('branch')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('date')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('shift')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkIn')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkOut')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('lateness')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('earlyLeave')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('overtime')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('status')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('location')}</th>
                                    <th className="px-4 py-4 text-start text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('checkInIP')}</th>
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
                                                        <p className="font-medium text-[var(--foreground)]" dir="auto">{record.profiles?.full_name || '-'}</p>
                                                        <p className="text-sm text-[var(--muted)]">{record.profiles?.email || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]" dir="auto">{record.profiles?.branch || '-'}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatDate(record.date)}</td>
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]">{formatShift(record)}</td>
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
                                            <td className="px-4 py-4 text-sm text-[var(--foreground-soft)]" dir="auto">{formatLocation(record)}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-[var(--foreground-soft)]">
                                                    <Globe className="h-3.5 w-3.5 text-[var(--accent)]" />
                                                    <span className="font-mono text-xs text-[var(--muted)]">{record.ip_address || '-'}</span>
                                                </div>
                                            </td>
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
        </div>
    );
}
