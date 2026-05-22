'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    AlarmClock,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    FileText,
    Globe,
    Hourglass,
    RefreshCw,
    RotateCcw,
    Search,
    TimerOff,
    TriangleAlert,
    UserX,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Input, PageReveal, Skeleton, addToast } from '@/components/ui';
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
    const [isExporting, setIsExporting] = useState(false);

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
        { label: t('records'), value: summary.totalRecords, tone: 'text-[var(--admin-ink-strong)]', icon: FileText, marker: 'bg-slate-300/70' },
        { label: t('present'), value: summary.present, tone: 'text-[var(--success)]', icon: CheckCircle2, marker: 'bg-emerald-300/75' },
        { label: t('absent'), value: summary.absent, tone: 'text-[var(--danger)]', icon: UserX, marker: 'bg-red-300/75' },
        { label: t('late'), value: summary.late, tone: 'text-[var(--warning)]', icon: AlarmClock, marker: 'bg-amber-300/75' },
        { label: t('earlyLeave'), value: summary.earlyLeave, tone: 'text-[var(--danger)]', icon: TimerOff, marker: 'bg-rose-300/75' },
        { label: t('missingCheckout'), value: summary.missingCheckout, tone: 'text-[var(--warning)]', icon: TriangleAlert, marker: 'bg-orange-300/75' },
        { label: t('overtime'), value: summary.overtime, tone: 'text-[var(--info)]', icon: Hourglass, marker: 'bg-sky-300/75' },
    ];
    const controlClassName =
        'focus-ring admin-glass-control min-h-10 w-full cursor-pointer px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-all duration-200';

    function statusText(status: AttendanceRecord['status']) {
        if (status === 'missing_checkout') return t('missingCheckout');
        if (status === 'pending') return t('pending');
        return t(status);
    }

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
        setIsExporting(true);
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
        } finally {
            setIsExporting(false);
        }
    }

    return (
        <div className="attendance-page-shell space-y-5">
            <PageReveal className="admin-glass-panel-strong overflow-hidden">
                <div className="grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:items-stretch">
                    <div className="min-w-0 space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t('title')}</p>
                                <h1 className="mt-1 text-2xl font-bold leading-tight text-[var(--admin-ink-strong)] sm:text-3xl">
                                    {t('heroTitle')}
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                                    {t('heroDescription')}
                                </p>
                            </div>
                            <div className="admin-glass-highlight shrink-0 px-3 py-2 sm:max-w-72">
                                <p className="text-xs font-semibold uppercase text-[var(--muted)]">{t('dateRange')}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-[var(--admin-ink-strong)]">{activeDateLabel}</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                            {summaryCards.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold uppercase text-[var(--muted)]">{item.label}</p>
                                                <p className={`mt-2 text-2xl font-bold leading-none ${item.tone}`}>
                                                    {isLoading ? '-' : item.value}
                                                </p>
                                            </div>
                                            <div className="admin-glass-control flex size-9 shrink-0 items-center justify-center rounded-xl">
                                                <Icon className="h-4 w-4 text-[var(--foreground-soft)]" />
                                            </div>
                                        </div>
                                        <div className="mt-4 h-1 rounded-full bg-white/[0.08]">
                                            <div className={`h-full w-8 rounded-full ${item.marker}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="admin-glass-panel-muted flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase text-[var(--muted)]">{t('exports')}</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">{activeDateLabel}</p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => void handleExportPDF()}
                            disabled={isLoading || isExporting}
                            isLoading={isExporting}
                            className="attendance-export-action admin-glass-button-primary w-full justify-between shadow-none sm:w-64"
                        >
                            <span>{t('exportPDF')}</span>
                            <FileText className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </PageReveal>

            <PageReveal delay={0.08}>
                <div className="attendance-filter-band admin-glass-panel p-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_11rem_11rem] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto_auto_auto]">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                className="admin-glass-control rounded-xl ps-11"
                            />
                        </div>

                        <select
                            value={employeeFilter}
                            onChange={(event) => {
                                setEmployeeFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className={controlClassName}
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
                            className={controlClassName}
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
                                className="admin-glass-control rounded-xl ps-11"
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
                                className="admin-glass-control rounded-xl ps-11"
                            />
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAllHistory((currentValue) => !currentValue);
                                setCurrentPage(1);
                            }}
                            className={`${showAllHistory ? 'admin-glass-button-primary' : 'admin-glass-button-secondary'} w-full shadow-none xl:w-auto`}
                        >
                            {t('allHistory')}
                        </Button>

                        <select
                            value={statusFilter}
                            onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}
                            className={`${controlClassName} xl:w-44`}
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
                            className="admin-glass-button-secondary w-full shadow-none xl:w-auto"
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
                            className="admin-glass-icon-button w-full shadow-none xl:w-auto"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </PageReveal>

            <section className="attendance-records-table admin-glass-table">
                    <div className="md:hidden">
                        {isLoading ? (
                            <div className="space-y-3 p-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="admin-glass-panel-muted p-4">
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
                            <div className="px-3 py-14 text-center text-[var(--muted)]">
                                {showAllHistory ? t('noRecords') : t('noRecordsForDate')}
                            </div>
                        ) : (
                            <div className="space-y-3 p-3">
                                {records.map((record) => (
                                    <article key={record.id} className="admin-glass-panel-muted p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="admin-glass-control flex h-10 w-10 items-center justify-center rounded-xl font-semibold text-[var(--foreground-soft)]">
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
                                                {statusText(record.status)}
                                            </Badge>
                                        </div>

                                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--admin-glass-border-muted)] pt-4 text-sm">
                                            {[
                                                [t('branch'), record.profiles?.branch || '-', 'auto'],
                                                [t('date'), formatDate(record.date)],
                                                [t('shift'), formatShift(record)],
                                                [t('checkIn'), formatTimestamp(record.check_in_time)],
                                                [t('checkOut'), formatTimestamp(record.check_out_time)],
                                                [t('lateness'), formatLateness(record.late_minutes)],
                                                [t('earlyLeave'), formatEarlyDeparture(record.early_departure_minutes || 0)],
                                                [t('overtime'), formatOvertime(record.overtime_minutes || 0)],
                                                [t('location'), formatLocation(record), 'auto'],
                                            ].map(([label, value, dir]) => (
                                                <div key={String(label)} className={label === t('location') ? 'col-span-2' : ''}>
                                                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</dt>
                                                    <dd className="mt-1 text-[var(--foreground-soft)]" dir={dir || undefined}>{value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="custom-scrollbar hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[1200px]">
                            <thead>
                                <tr className="border-b border-[var(--admin-glass-border-muted)] bg-white/[0.055]">
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
                                        <tr key={index} className="admin-glass-table-row">
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
                                        <tr key={record.id} className="admin-glass-table-row">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="admin-glass-control flex h-10 w-10 items-center justify-center rounded-xl font-semibold text-[var(--foreground-soft)]">
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
                                                    {statusText(record.status)}
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
                        <div className="flex flex-col gap-3 border-t border-[var(--admin-glass-border-muted)] bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                                    className="admin-glass-icon-button shadow-none"
                                >
                                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="admin-glass-icon-button shadow-none"
                                >
                                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                                </Button>
                            </div>
                        </div>
                    )}
            </section>
        </div>
    );
}
