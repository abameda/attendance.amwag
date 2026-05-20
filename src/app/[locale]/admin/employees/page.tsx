'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    BarChart3,
    Briefcase,
    CalendarOff,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    Edit2,
    KeyRound,
    MapPin,
    Search,
    Timer,
    Trash2,
    Upload,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import BulkImportModal from '@/components/BulkImportModal';
import {
    DEFAULT_EMPLOYEE_LIMIT,
    EMPLOYEE_PAGE_SIZE,
    filterEmployeeOptions,
    type EmployeeOption,
} from '@/lib/employeeDirectory';
import { formatTime } from '@/lib/utils';
import type { Profile } from '@/types';
import {
    AnimatePresence,
    motion,
    Button,
    Card,
    CardContent,
    Input,
    Modal,
    AnimatedCounter,
    PageReveal,
    Select,
    Skeleton,
    addToast,
} from '@/components/ui';

type EmployeeStats = {
    employees: number;
    branches: number;
    overtimeEnabled: number;
};

type BranchOption = {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
};

type EmployeesListResponse = {
    success: boolean;
    data?: Profile[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    stats?: EmployeeStats;
    error?: string;
};

type EmployeeOptionsResponse = {
    success: boolean;
    data?: EmployeeOption[];
    error?: string;
};

type BranchOptionsResponse = {
    success: boolean;
    data?: BranchOption[];
    error?: string;
};

type EmployeeResponse = {
    success: boolean;
    data?: Profile;
    error?: string;
};

type EmployeeViewMode = 'default' | 'selected' | 'all';

const EMPTY_STATS: EmployeeStats = {
    employees: 0,
    branches: 0,
    overtimeEnabled: 0,
};

const SELECTOR_RESULT_LIMIT = 8;

export default function EmployeesPage() {
    const locale = useLocale();
    const t = useTranslations('Employees');
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
    const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats>(EMPTY_STATS);
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [viewMode, setViewMode] = useState<EmployeeViewMode>('default');
    const [isLoading, setIsLoading] = useState(true);
    const [isSelectorLoading, setIsSelectorLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        branch: '',
        job_title: '',
        shift_start: '',
        shift_duration: '8',
        off_day: '',
        overtime_enabled: true,
        must_change_password: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const latestCardsRequestId = useRef(0);
    const [resetModal, setResetModal] = useState<{ open: boolean; tempPassword: string; employeeName: string }>({
        open: false,
        tempPassword: '',
        employeeName: '',
    });
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const calculateShiftEnd = (startTime: string, durationHours: string): string => {
        if (!startTime) return '';
        const [hours, minutes] = startTime.split(':').map(Number);
        const duration = parseFloat(durationHours);
        const totalMinutes = hours * 60 + minutes + duration * 60;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = Math.floor(totalMinutes % 60);
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    const calculateDurationFromTimes = (startTime: string | null, endTime: string | null): string => {
        if (!startTime || !endTime) return '8';
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (durationMinutes < 0) durationMinutes += 24 * 60;
        const durationHours = durationMinutes / 60;
        const validDurations = [0.5, 1, 2, 4, 8, 10, 12];
        if (validDurations.includes(durationHours)) return String(durationHours);
        return '8';
    };

    const fetchEmployeeOptions = useCallback(async () => {
        setIsSelectorLoading(true);
        try {
            const response = await fetch('/api/employees?view=options', { credentials: 'include' });
            const result: EmployeeOptionsResponse = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('loadError'));
            }

            setEmployeeOptions(result.data ?? []);
        } catch (error) {
            console.error('Error fetching employee options:', error);
            addToast(t('loadError'), 'error');
        } finally {
            setIsSelectorLoading(false);
        }
    }, [t]);

    const fetchBranchOptions = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/branches?active=true', { credentials: 'include' });
            const result: BranchOptionsResponse = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('loadError'));
            }

            setBranchOptions(result.data ?? []);
        } catch (error) {
            console.error('Error fetching branch options:', error);
            addToast(t('loadError'), 'error');
        }
    }, [t]);

    const fetchEmployeePage = useCallback(async (mode: 'default' | 'all', page = 1) => {
        const requestId = latestCardsRequestId.current + 1;
        latestCardsRequestId.current = requestId;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ includeStats: 'true' });
            if (mode === 'all') {
                params.set('page', String(page));
                params.set('pageSize', String(EMPLOYEE_PAGE_SIZE));
            } else {
                params.set('limit', String(DEFAULT_EMPLOYEE_LIMIT));
            }

            const response = await fetch(`/api/employees?${params.toString()}`, { credentials: 'include' });
            const result: EmployeesListResponse = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('loadError'));
            }

            if (latestCardsRequestId.current !== requestId) {
                return;
            }

            setEmployees(result.data ?? []);
            setTotalEmployees(result.total ?? result.data?.length ?? 0);
            setEmployeeStats(result.stats ?? EMPTY_STATS);
            setCurrentPage(result.page ?? page);
            setViewMode(mode);
        } catch (error) {
            if (latestCardsRequestId.current !== requestId) {
                return;
            }

            console.error('Error fetching employees:', error);
            setEmployees([]);
            addToast(t('loadError'), 'error');
        } finally {
            if (latestCardsRequestId.current === requestId) {
                setIsLoading(false);
            }
        }
    }, [t]);

    const fetchSelectedEmployee = useCallback(async (id: string) => {
        const requestId = latestCardsRequestId.current + 1;
        latestCardsRequestId.current = requestId;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/employees/${id}`, { credentials: 'include' });
            const result: EmployeeResponse = await response.json();

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.error || t('loadError'));
            }

            if (latestCardsRequestId.current !== requestId) {
                return;
            }

            setEmployees([result.data]);
            setSelectedEmployeeId(id);
            setViewMode('selected');
        } catch (error) {
            if (latestCardsRequestId.current !== requestId) {
                return;
            }

            console.error('Error fetching selected employee:', error);
            setEmployees([]);
            addToast(t('loadError'), 'error');
        } finally {
            if (latestCardsRequestId.current === requestId) {
                setIsLoading(false);
            }
        }
    }, [t]);

    const fetchEmployees = useCallback(async () => {
        await Promise.all([
            viewMode === 'selected' && selectedEmployeeId
                ? fetchSelectedEmployee(selectedEmployeeId)
                : fetchEmployeePage(viewMode === 'all' ? 'all' : 'default', viewMode === 'all' ? currentPage : 1),
            fetchEmployeeOptions(),
            fetchBranchOptions(),
        ]);
    }, [currentPage, fetchBranchOptions, fetchEmployeeOptions, fetchEmployeePage, fetchSelectedEmployee, selectedEmployeeId, viewMode]);

    useEffect(() => {
        fetchEmployeePage('default', 1);
        fetchEmployeeOptions();
        fetchBranchOptions();
    }, [fetchBranchOptions, fetchEmployeeOptions, fetchEmployeePage]);

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            full_name: '',
            branch: '',
            job_title: '',
            shift_start: '',
            shift_duration: '8',
            off_day: '',
            overtime_enabled: true,
            must_change_password: false,
        });
        setEditingEmployee(null);
    };

    const openAddModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (employee: Profile) => {
        const branchId = employee.branch_id ?? branchOptions.find((branch) => branch.name === employee.branch)?.id ?? '';
        setEditingEmployee(employee);
        setFormData({
            email: employee.email,
            password: '',
            full_name: employee.full_name,
            branch: branchId,
            job_title: employee.job_title || '',
            shift_start: employee.shift_start || '',
            shift_duration: calculateDurationFromTimes(employee.shift_start, employee.shift_end),
            off_day: employee.off_day || '',
            overtime_enabled: employee.overtime_enabled ?? true,
            must_change_password: employee.must_change_password ?? false,
        });
        setIsModalOpen(true);
    };

    const handleSelectEmployee = async (employee: EmployeeOption) => {
        setSearchQuery(employee.full_name);
        setIsSelectorOpen(false);
        await fetchSelectedEmployee(employee.id);
    };

    const handleResetEmployeeView = async () => {
        setSearchQuery('');
        setSelectedEmployeeId('');
        setIsSelectorOpen(false);
        await fetchEmployeePage('default', 1);
    };

    const handleShowAllEmployees = async (page = 1) => {
        setSearchQuery('');
        setSelectedEmployeeId('');
        setIsSelectorOpen(false);
        await fetchEmployeePage('all', page);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        const selectedBranch = branchOptions.find((branch) => branch.id === formData.branch);

        try {
            if (editingEmployee) {
                const calculatedShiftEnd = calculateShiftEnd(formData.shift_start, formData.shift_duration);
                const response = await fetch(`/api/employees/${editingEmployee.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        full_name: formData.full_name,
                        branch_id: formData.branch,
                        branch: selectedBranch?.name ?? '',
                        job_title: formData.job_title,
                        shift_start: formData.shift_start || null,
                        shift_end: calculatedShiftEnd || null,
                        off_day: formData.off_day || null,
                        overtime_enabled: formData.overtime_enabled,
                        must_change_password: formData.must_change_password,
                    }),
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || t('saveError'));
                }
                addToast(t('employeeUpdated'), 'success');
            } else {
                const calculatedShiftEnd = calculateShiftEnd(formData.shift_start, formData.shift_duration);
                const submitData = {
                    ...formData,
                    branch_id: formData.branch,
                    branch: selectedBranch?.name ?? '',
                    shift_end: calculatedShiftEnd,
                };
                const response = await fetch('/api/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(submitData),
                });

                const result = await response.json();
                if (!result.success) throw new Error(result.error);
                addToast(t('employeeCreated'), 'success');
            }

            setIsModalOpen(false);
            resetForm();
            await fetchEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            addToast(
                error instanceof Error ? error.message : t('saveError'),
                'error'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('deleteConfirm'))) return;

        try {
            const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!result.success) throw new Error(result.error || t('deleteError'));
            addToast(t('employeeDeleted'), 'success');
            if (selectedEmployeeId === id) {
                await handleResetEmployeeView();
                await fetchEmployeeOptions();
            } else {
                await fetchEmployees();
            }
        } catch (error) {
            console.error('Error deleting employee:', error);
            addToast(t('deleteError'), 'error');
        }
    };

    const handleResetPassword = async (id: string, name: string) => {
        if (!confirm(t('resetConfirm', { name }))) return;

        try {
            const response = await fetch(`/api/employees/${id}/reset-password`, {
                method: 'POST',
                credentials: 'include',
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || t('passwordResetFailed'));
            }
            setResetModal({ open: true, tempPassword: result.data.tempPassword, employeeName: name });
        } catch (error) {
            console.error('Error resetting password:', error);
            addToast(error instanceof Error ? error.message : t('passwordResetFailed'), 'error');
        }
    };

    const selectorResults = useMemo(
        () => filterEmployeeOptions(employeeOptions, deferredSearchQuery).slice(0, SELECTOR_RESULT_LIMIT),
        [employeeOptions, deferredSearchQuery]
    );

    const selectedEmployeeOption = useMemo(
        () => employeeOptions.find((employee) => employee.id === selectedEmployeeId),
        [employeeOptions, selectedEmployeeId]
    );

    const stats = useMemo(() => {
        return [
            { label: t('employees'), value: employeeStats.employees },
            { label: t('branches'), value: employeeStats.branches },
            { label: t('overtimeEnabled'), value: employeeStats.overtimeEnabled },
        ];
    }, [employeeStats, t]);

    const totalPages = Math.max(1, Math.ceil(totalEmployees / EMPLOYEE_PAGE_SIZE));
    const visibleStart = viewMode === 'all' && totalEmployees > 0 ? (currentPage - 1) * EMPLOYEE_PAGE_SIZE + 1 : 1;
    const visibleEnd = viewMode === 'all'
        ? Math.min(currentPage * EMPLOYEE_PAGE_SIZE, totalEmployees)
        : Math.min(employees.length, totalEmployees || employees.length);
    const skeletonCount = viewMode === 'all' ? 6 : DEFAULT_EMPLOYEE_LIMIT;
    const emptyTitle = searchQuery ? t('noSearchResults') : t('noEmployees');

    const dayLabel = (day: string) => t(`days.${day}`);

    return (
        <div className="space-y-6">
            <PageReveal className="space-y-5">
                <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl space-y-3">
                        <p className="section-kicker">{t('kicker')}</p>
                        <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
                            {t('title')}
                        </h1>
                        <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                        <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="w-full justify-between rounded-md sm:w-auto">
                            <span>{t('bulkImport')}</span>
                            <Upload className="h-4 w-4" />
                        </Button>
                        <Button onClick={openAddModal} className="w-full justify-between rounded-md sm:w-auto">
                            <span>{t('addEmployee')}</span>
                            <UserPlus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]"
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{stat.label}</p>
                            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                                {isLoading ? '...' : <AnimatedCounter value={stat.value} />}
                            </p>
                        </div>
                    ))}
                </div>
            </PageReveal>

            <PageReveal delay={0.08}>
                <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div className="relative">
                            <label
                                htmlFor="employee-selector"
                                className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted-strong)]"
                            >
                                {t('selectorLabel')}
                            </label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                                <Input
                                    id="employee-selector"
                                    placeholder={t('searchPlaceholder')}
                                    value={searchQuery}
                                    onFocus={() => setIsSelectorOpen(true)}
                                    onBlur={() => window.setTimeout(() => setIsSelectorOpen(false), 120)}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setIsSelectorOpen(true);
                                    }}
                                    className="rounded-md ps-11 pe-12"
                                    autoComplete="off"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={handleResetEmployeeView}
                                        className="focus-ring absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
                                        title={t('clearSelection')}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            {isSelectorOpen && (
                                <div
                                    className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-md)]"
                                    onMouseDown={(event) => event.preventDefault()}
                                >
                                    {isSelectorLoading ? (
                                        <div className="px-3 py-3 text-sm text-[var(--muted)]">{t('selectorLoading')}</div>
                                    ) : selectorResults.length === 0 ? (
                                        <div className="px-3 py-3 text-sm text-[var(--muted)]">{t('noSelectorResults')}</div>
                                    ) : (
                                        selectorResults.map((employee) => (
                                            <button
                                                key={employee.id}
                                                type="button"
                                                onClick={() => handleSelectEmployee(employee)}
                                                className="focus-ring flex w-full items-start justify-between gap-4 rounded-md px-3 py-3 text-start transition-colors hover:bg-[var(--surface-muted)]"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                                                        {employee.full_name}
                                                    </span>
                                                    <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                                                        {[employee.email, employee.branch, employee.job_title].filter(Boolean).join(' / ')}
                                                    </span>
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleResetEmployeeView}
                                className="w-full rounded-md sm:w-auto"
                            >
                                <X className="h-4 w-4" />
                                {t('clearSelection')}
                            </Button>
                            {viewMode === 'all' ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleResetEmployeeView}
                                    className="w-full rounded-md sm:w-auto"
                                >
                                    {t('showLess')}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleShowAllEmployees(1)}
                                    className="w-full rounded-md sm:w-auto"
                                >
                                    <Users className="h-4 w-4" />
                                    {t('showAllEmployees')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
                        {viewMode === 'selected'
                            ? t('showingSelected', { name: selectedEmployeeOption?.full_name ?? employees[0]?.full_name ?? '' })
                            : viewMode === 'all'
                                ? t('showingAll', { start: visibleStart, end: visibleEnd, total: totalEmployees })
                                : t('showingDefault', { count: employees.length, total: totalEmployees })}
                    </div>
                </section>
            </PageReveal>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {Array.from({ length: skeletonCount }).map((_, index) => (
                        <Card key={index} className="rounded-lg">
                            <CardContent className="space-y-4 p-5">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-44" />
                                    </div>
                                </div>
                                {Array.from({ length: 4 }).map((__, metricIndex) => (
                                    <Skeleton key={metricIndex} className="h-10 rounded-lg" />
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : employees.length === 0 ? (
                <Card className="rounded-lg">
                    <CardContent className="p-10 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--surface-strong)] text-[var(--muted)]">
                            <Users className="h-6 w-6" />
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
                            {emptyTitle}
                        </h2>
                    </CardContent>
                </Card>
            ) : (
                <AnimatePresence>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {employees.map((employee) => (
                            <motion.div
                                key={employee.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <Card className="rounded-lg">
                                    <CardContent className="space-y-4 p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-base font-semibold text-[var(--foreground)]">
                                                    {employee.full_name.charAt(0).toLocaleUpperCase(locale === 'ar' ? 'ar-EG' : 'en-US')}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
                                                        {employee.full_name}
                                                    </h3>
                                                    <p className="truncate text-sm text-[var(--muted)]">
                                                        {employee.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(employee)}
                                                    className="focus-ring rounded-md p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                                                    title={t('editEmployee')}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleResetPassword(employee.id, employee.full_name)}
                                                    className="focus-ring rounded-md p-2 text-[var(--muted)] transition-colors hover:bg-[var(--warning-soft)] hover:text-[var(--warning)]"
                                                    title={t('resetPassword')}
                                                >
                                                    <KeyRound className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(employee.id)}
                                                    className="focus-ring rounded-md p-2 text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                                    title={t('deleteEmployee')}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <dl className="grid gap-2 text-sm">
                                            {employee.job_title && (
                                                <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[var(--foreground-soft)]">
                                                    <Briefcase className="h-4 w-4 text-[var(--accent)]" />
                                                    <dt className="sr-only">{t('jobTitle')}</dt>
                                                    <dd className="truncate">{employee.job_title}</dd>
                                                </div>
                                            )}
                                            {employee.branch && (
                                                <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[var(--foreground-soft)]">
                                                    <MapPin className="h-4 w-4 text-[var(--accent)]" />
                                                    <dt className="sr-only">{t('branch')}</dt>
                                                    <dd className="truncate">{employee.branch}</dd>
                                                </div>
                                            )}
                                            {(employee.shift_start || employee.shift_end) && (
                                                <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[var(--foreground-soft)]">
                                                    <Clock className="h-4 w-4 text-[var(--accent)]" />
                                                    <dt className="sr-only">{t('shiftStartTime')}</dt>
                                                    <dd>
                                                        {formatTime(employee.shift_start)} - {formatTime(employee.shift_end)}
                                                    </dd>
                                                </div>
                                            )}
                                            {employee.off_day && (
                                                <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[var(--foreground-soft)]">
                                                    <CalendarOff className="h-4 w-4 text-[var(--warning)]" />
                                                    <dt className="sr-only">{t('offDayLabel')}</dt>
                                                    <dd>{t('offDay', { day: dayLabel(employee.off_day) })}</dd>
                                                </div>
                                            )}
                                        </dl>

                                        <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5">
                                            <div className="flex items-center gap-3 text-sm text-[var(--foreground-soft)]">
                                                <Timer className="h-4 w-4 text-[var(--accent)]" />
                                                <span>{t('overtimeTracking')}</span>
                                            </div>
                                            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${employee.overtime_enabled ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--surface)] text-[var(--muted)]'}`}>
                                                {employee.overtime_enabled ? t('enabled') : t('disabled')}
                                            </span>
                                        </div>

                                        <Link
                                            href={`/${locale}/admin/employees/${employee.id}/analytics`}
                                            className="employee-analytics-action focus-ring flex min-h-11 items-center justify-between rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
                                        >
                                            <span>{t('attendanceAnalytics')}</span>
                                            <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
                                        </Link>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </AnimatePresence>
            )}

            {viewMode === 'all' && totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row">
                    <p className="text-sm text-[var(--muted)]">
                        {t('pageOf', { page: currentPage, totalPages })}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleShowAllEmployees(currentPage - 1)}
                            disabled={currentPage <= 1 || isLoading}
                            className="rounded-md"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {t('previousPage')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleShowAllEmployees(currentPage + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="rounded-md"
                        >
                            {t('nextPage')}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingEmployee ? t('editEmployeeTitle') : t('addEmployeeTitle')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input
                            id="full_name"
                            label={t('fullName')}
                            placeholder={t('fullNamePlaceholder')}
                            value={formData.full_name}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, full_name: event.target.value }))
                            }
                            required
                        />
                        <Input
                            id="email"
                            label={t('email')}
                            type="email"
                            placeholder={t('emailPlaceholder')}
                            value={formData.email}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, email: event.target.value }))
                            }
                            disabled={!!editingEmployee}
                            required
                        />
                        {!editingEmployee && (
                            <Input
                                id="password"
                                label={t('password')}
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                                }
                                required
                            />
                        )}
                        <Select
                            id="branch"
                            label={t('branch')}
                            value={formData.branch}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, branch: event.target.value }))
                            }
                            options={[
                                { value: '', label: t('selectBranch') },
                                ...branchOptions.map((branch) => ({ value: branch.id, label: branch.name })),
                            ]}
                        />
                        <Input
                            id="job_title"
                            label={t('jobTitle')}
                            placeholder={t('jobTitlePlaceholder')}
                            value={formData.job_title}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, job_title: event.target.value }))
                            }
                        />
                        <div className="space-y-2">
                            <Input
                                id="shift_start"
                                label={t('shiftStartTime')}
                                type="time"
                                value={formData.shift_start}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, shift_start: event.target.value }))
                                }
                            />
                            {formData.shift_start && (
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                                    <Clock className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                    <span>
                                        <span className="font-semibold text-[var(--foreground-soft)]">
                                            {t('shiftEndsAt', { time: calculateShiftEnd(formData.shift_start, formData.shift_duration) || '--:--' })}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                        <Select
                            id="shift_duration"
                            label={t('shiftDuration')}
                            value={formData.shift_duration}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, shift_duration: event.target.value }))
                            }
                            options={[
                                { value: '0.5', label: t('durations.halfHour') },
                                { value: '1', label: t('durations.oneHour') },
                                { value: '2', label: t('durations.twoHours') },
                                { value: '4', label: t('durations.fourHours') },
                                { value: '8', label: t('durations.eightHours') },
                                { value: '10', label: t('durations.tenHours') },
                                { value: '12', label: t('durations.twelveHours') },
                            ]}
                        />
                        <Select
                            id="off_day"
                            label={t('offDayLabel')}
                            value={formData.off_day}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, off_day: event.target.value }))
                            }
                            options={[
                                { value: '', label: t('noOffDay') },
                                { value: 'sunday', label: t('days.sunday') },
                                { value: 'monday', label: t('days.monday') },
                                { value: 'tuesday', label: t('days.tuesday') },
                                { value: 'wednesday', label: t('days.wednesday') },
                                { value: 'thursday', label: t('days.thursday') },
                                { value: 'friday', label: t('days.friday') },
                                { value: 'saturday', label: t('days.saturday') },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Timer className="mt-1 h-5 w-5 text-[var(--accent)]" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-[var(--foreground)]">{t('overtimeTrackingTitle')}</p>
                                <p className="text-xs leading-6 text-[var(--muted)]">
                                    {t('overtimeTrackingDescription')}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, overtime_enabled: !prev.overtime_enabled }))}
                            className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.overtime_enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${formData.overtime_enabled ? 'switch-thumb-on' : 'switch-thumb-off'}`}
                            />
                        </button>
                    </div>

                    {editingEmployee && (
                        <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <KeyRound className="mt-1 h-5 w-5 text-[var(--warning)]" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--foreground)]">{t('forcePasswordReset')}</p>
                                    <p className="text-xs leading-6 text-[var(--muted)]">
                                        {t('forcePasswordResetDescription')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, must_change_password: !prev.must_change_password }))}
                                className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.must_change_password ? 'bg-[var(--warning)]' : 'bg-[var(--surface-strong)]'}`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${formData.must_change_password ? 'switch-thumb-on' : 'switch-thumb-off'}`}
                                />
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}
                        >
                            {t('cancel')}
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
                            {editingEmployee ? t('updateEmployee') : t('createEmployee')}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={resetModal.open}
                onClose={() => setResetModal((prev) => ({ ...prev, open: false }))}
                title={t('passwordResetTitle')}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-[var(--muted)]">
                        {t('temporaryPasswordIntro', { name: resetModal.employeeName })}
                    </p>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                        <code className="flex-1 font-mono text-base tracking-widest text-[var(--foreground)]">
                            {resetModal.tempPassword}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(resetModal.tempPassword);
                                addToast(t('copied'), 'success');
                            }}
                            className="focus-ring rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                            title={t('copyToClipboard')}
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                    </div>
                    <Button
                        className="w-full"
                        onClick={() => setResetModal((prev) => ({ ...prev, open: false }))}
                    >
                        {t('done')}
                    </Button>
                </div>
            </Modal>

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={fetchEmployees}
            />
        </div>
    );
}
