'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, CalendarDays, MapPin, Network, Plus, Users } from 'lucide-react';
import { useLocale } from 'next-intl';

import { AnimatedCounter, Badge, Button, PageReveal, Skeleton, addToast } from '@/components/ui';

type BranchDetail = {
    id: string;
    name: string;
    code: string;
    address: string | null;
    is_active: boolean;
    employee_count: number;
    attendance_summary: {
        present: number;
        late: number;
        absent: number;
        missing_checkout: number;
    };
    employees: Array<{
        id: string;
        email: string;
        full_name: string;
        branch: string | null;
        job_title: string | null;
        shift_start: string | null;
        shift_end: string | null;
        off_day: string | null;
    }>;
    ip_rules: Array<{
        id: string;
        branch_name: string;
        rule_type: 'exact_ip' | 'cidr';
        value: string;
        label: string;
        is_active: boolean;
    }>;
};

export default function BranchDetailsPage() {
    const locale = useLocale();
    const params = useParams<{ id: string }>();
    const [branch, setBranch] = useState<BranchDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);

        void (async () => {
            try {
                const response = await fetch(`/api/admin/branches/${params.id}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });
                const result: { success: boolean; data?: BranchDetail; error?: string } = await response.json();
                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.error || 'Failed to load branch');
                }
                setBranch(result.data);
            } catch (error) {
                if (controller.signal.aborted) return;
                addToast(error instanceof Error ? error.message : 'Failed to load branch', 'error');
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        })();

        return () => controller.abort();
    }, [params.id]);

    const attendanceCards = useMemo(() => {
        const summary = branch?.attendance_summary;
        return [
            ['Present', summary?.present ?? 0],
            ['Late', summary?.late ?? 0],
            ['Absent', summary?.absent ?? 0],
            ['Missing checkout', summary?.missing_checkout ?? 0],
        ];
    }, [branch?.attendance_summary]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        );
    }

    if (!branch) {
        return (
            <section className="admin-glass-panel p-12 text-center text-[var(--admin-text-muted)]">
                Branch not found.
            </section>
        );
    }

    return (
        <div className="space-y-7">
            <PageReveal className="admin-glass-panel-strong overflow-hidden p-5 sm:p-6">
                <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="min-w-0">
                        <Link
                            href={`/${locale}/admin/branches`}
                            className="focus-ring mb-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-ink-strong)]"
                        >
                            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                            Back to branches
                        </Link>
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                                <Building2 className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="section-kicker">Branch Details</p>
                                <h1 className="break-words text-3xl font-bold leading-tight text-[var(--admin-ink-strong)] sm:text-4xl">{branch.name}</h1>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Badge variant={branch.is_active ? 'present' : 'default'} className="admin-glass-status-pill">
                                {branch.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="info" className="admin-glass-status-pill">{branch.code}</Badge>
                            {branch.address && (
                                <span className="admin-glass-status-pill inline-flex items-center gap-2 rounded-full border border-[var(--admin-glass-border-muted)] bg-[var(--admin-glass-muted)] px-3 py-1 text-xs font-semibold text-[var(--admin-text-soft)]">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {branch.address}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row 2xl:justify-end">
                        <Link href={`/${locale}/admin/attendance?branch=${encodeURIComponent(branch.name)}`}>
                            <Button variant="outline" className="admin-glass-button-secondary w-full justify-between rounded-xl sm:w-auto">
                                <span>View attendance</span>
                                <CalendarDays className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href={`/${locale}/admin/branch-ips?branch=${encodeURIComponent(branch.name)}`}>
                            <Button variant="outline" className="admin-glass-button-secondary w-full justify-between rounded-xl sm:w-auto">
                                <span>Manage IPs</span>
                                <Network className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href={`/${locale}/admin/employees`}>
                            <Button className="admin-glass-button-primary w-full justify-between rounded-xl sm:w-auto">
                                <span>Add employee</span>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </PageReveal>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold uppercase text-[var(--admin-text-muted)]">Employees</p>
                            <p className="mt-2 text-2xl font-semibold text-[var(--admin-ink-strong)]">
                                <AnimatedCounter value={branch.employee_count} />
                            </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                            <Users className="h-5 w-5" aria-hidden="true" />
                        </div>
                    </div>
                </div>
                {attendanceCards.map(([label, value]) => (
                    <div key={label} className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]">
                        <p className="truncate text-xs font-semibold uppercase text-[var(--admin-text-muted)]">{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-[var(--admin-ink-strong)]">
                            <AnimatedCounter value={Number(value)} />
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
                <section className="admin-glass-panel p-4 sm:p-5">
                    <div className="space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--admin-ink-strong)]">Employees</h2>
                                <p className="text-xs text-[var(--admin-text-muted)]">People currently assigned to this branch.</p>
                            </div>
                            <Users className="h-5 w-5 text-[var(--admin-info)]" />
                        </div>
                        <div className="admin-glass-table min-w-0 overflow-x-auto">
                            <table className="w-full min-w-[680px] text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--admin-glass-border-muted)] bg-[rgb(255_255_255_/_0.045)] text-xs uppercase text-[var(--admin-text-muted)]">
                                        <th className="px-4 py-3 text-start font-semibold">Employee</th>
                                        <th className="px-4 py-3 text-start font-semibold">Job title</th>
                                        <th className="px-4 py-3 text-start font-semibold">Shift</th>
                                        <th className="px-4 py-3 text-start font-semibold">Off day</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branch.employees.map((employee) => (
                                        <tr key={employee.id} className="admin-glass-table-row last:border-0">
                                            <td className="px-4 py-4">
                                                <p className="font-semibold text-[var(--admin-ink-strong)]">{employee.full_name}</p>
                                                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{employee.email}</p>
                                            </td>
                                            <td className="px-4 py-4 text-[var(--admin-text-soft)]">{employee.job_title || '-'}</td>
                                            <td className="px-4 py-4 text-[var(--admin-text-soft)]">
                                                {employee.shift_start && employee.shift_end ? `${employee.shift_start} - ${employee.shift_end}` : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-[var(--admin-text-soft)]">{employee.off_day || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                            {branch.employees.length === 0 && (
                                <div className="admin-glass-panel-muted mt-4 p-6 text-center text-sm text-[var(--admin-text-muted)]">
                                    No employees assigned to this branch.
                                </div>
                            )}
                    </div>
                </section>

                <section className="admin-glass-panel p-4 sm:p-5">
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--admin-ink-strong)]">Allowed IP rules</h2>
                            <p className="text-xs text-[var(--admin-text-muted)]">Rules linked to this branch.</p>
                        </div>
                        <div className="space-y-3">
                            {branch.ip_rules.map((rule) => (
                                <div key={rule.id} className="admin-glass-panel-muted p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-mono text-sm text-[var(--admin-ink-strong)]">{rule.value}</p>
                                            <p className="mt-1 truncate text-xs text-[var(--admin-text-muted)]">{rule.label || '-'}</p>
                                        </div>
                                        <Badge variant={rule.is_active ? 'present' : 'default'} className="admin-glass-status-pill">
                                            {rule.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 text-xs font-semibold uppercase text-[var(--admin-text-muted)]">
                                        {rule.rule_type === 'exact_ip' ? 'Exact IP' : 'CIDR/Subnet'}
                                    </p>
                                </div>
                            ))}
                            {branch.ip_rules.length === 0 && (
                                <div className="admin-glass-panel-muted p-6 text-center text-sm text-[var(--admin-text-muted)]">
                                    No branch IP rules found.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
