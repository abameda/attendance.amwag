'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, CalendarDays, MapPin, Network, Plus, Users } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Badge, Button, Card, CardContent, PageReveal, Skeleton, addToast } from '@/components/ui';

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
            <Card className="rounded-2xl">
                <CardContent className="p-12 text-center text-[var(--muted)]">Branch not found.</CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <PageReveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <Link
                            href={`/${locale}/admin/branches`}
                            className="focus-ring mb-4 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                            Back to branches
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-glow-blue)]">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Branch Details</p>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">{branch.name}</h1>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Badge variant={branch.is_active ? 'present' : 'default'}>
                                {branch.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="info">{branch.code}</Badge>
                            {branch.address && (
                                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {branch.address}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href={`/${locale}/admin/attendance?branch=${encodeURIComponent(branch.name)}`}>
                            <Button variant="outline">
                                <CalendarDays className="h-4 w-4" />
                                View attendance
                            </Button>
                        </Link>
                        <Link href={`/${locale}/admin/branch-ips?branch=${encodeURIComponent(branch.name)}`}>
                            <Button variant="outline">
                                <Network className="h-4 w-4" />
                                Manage IPs
                            </Button>
                        </Link>
                        <Link href={`/${locale}/admin/employees`}>
                            <Button>
                                <Plus className="h-4 w-4" />
                                Add employee
                            </Button>
                        </Link>
                    </div>
                </div>
            </PageReveal>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Card className="rounded-2xl">
                    <CardContent>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Employees</p>
                        <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{branch.employee_count}</p>
                    </CardContent>
                </Card>
                {attendanceCards.map(([label, value]) => (
                    <Card key={label} className="rounded-2xl">
                        <CardContent>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
                            <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
                <Card className="rounded-2xl">
                    <CardContent className="space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--foreground)]">Employees</h2>
                                <p className="text-xs text-[var(--muted)]">People currently assigned to this branch.</p>
                            </div>
                            <Users className="h-5 w-5 text-[var(--accent)]" />
                        </div>
                        <div className="min-w-0 overflow-x-auto">
                            <table className="w-full min-w-[680px] text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                                        <th className="px-3 py-3 text-start">Employee</th>
                                        <th className="px-3 py-3 text-start">Job title</th>
                                        <th className="px-3 py-3 text-start">Shift</th>
                                        <th className="px-3 py-3 text-start">Off day</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branch.employees.map((employee) => (
                                        <tr key={employee.id} className="border-b border-[var(--line)] last:border-0">
                                            <td className="px-3 py-4">
                                                <p className="font-semibold text-[var(--foreground)]">{employee.full_name}</p>
                                                <p className="mt-1 text-xs text-[var(--muted)]">{employee.email}</p>
                                            </td>
                                            <td className="px-3 py-4 text-[var(--foreground-soft)]">{employee.job_title || '-'}</td>
                                            <td className="px-3 py-4 text-[var(--foreground-soft)]">
                                                {employee.shift_start && employee.shift_end ? `${employee.shift_start} - ${employee.shift_end}` : '-'}
                                            </td>
                                            <td className="px-3 py-4 text-[var(--foreground-soft)]">{employee.off_day || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {branch.employees.length === 0 && (
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                                    No employees assigned to this branch.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="space-y-5">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Allowed IP rules</h2>
                            <p className="text-xs text-[var(--muted)]">Rules linked to this branch.</p>
                        </div>
                        <div className="space-y-3">
                            {branch.ip_rules.map((rule) => (
                                <div key={rule.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-mono text-sm text-[var(--foreground)]">{rule.value}</p>
                                            <p className="mt-1 truncate text-xs text-[var(--muted)]">{rule.label || '-'}</p>
                                        </div>
                                        <Badge variant={rule.is_active ? 'present' : 'default'}>
                                            {rule.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                                        {rule.rule_type === 'exact_ip' ? 'Exact IP' : 'CIDR/Subnet'}
                                    </p>
                                </div>
                            ))}
                            {branch.ip_rules.length === 0 && (
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                                    No branch IP rules found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
