'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Edit2, Eye, MapPin, Network, Plus, Power, RefreshCw, Save, Users } from 'lucide-react';
import { useLocale } from 'next-intl';

import { AnimatedCounter, Badge, Button, Input, Modal, PageReveal, Skeleton, addToast } from '@/components/ui';

type BranchRow = {
    id: string;
    name: string;
    code: string;
    address: string | null;
    is_active: boolean;
    employee_count: number;
    ip_rule_count: number;
};

type BranchForm = {
    name: string;
    code: string;
    address: string;
    is_active: boolean;
};

const emptyForm: BranchForm = {
    name: '',
    code: '',
    address: '',
    is_active: true,
};

export default function BranchesPage() {
    const locale = useLocale();
    const [branches, setBranches] = useState<BranchRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
    const [form, setForm] = useState<BranchForm>(emptyForm);

    async function loadBranches() {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/branches', { credentials: 'include' });
            const result: { success: boolean; data?: BranchRow[]; error?: string } = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to load branches');
            }
            setBranches(result.data ?? []);
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to load branches', 'error');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadBranches();
    }, []);

    function openAddModal() {
        setEditingBranch(null);
        setForm(emptyForm);
        setIsModalOpen(true);
    }

    function openEditModal(branch: BranchRow) {
        setEditingBranch(branch);
        setForm({
            name: branch.name,
            code: branch.code,
            address: branch.address ?? '',
            is_active: branch.is_active,
        });
        setIsModalOpen(true);
    }

    async function submitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        try {
            const response = await fetch(
                editingBranch ? `/api/admin/branches/${editingBranch.id}` : '/api/admin/branches',
                {
                    method: editingBranch ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(form),
                }
            );
            const result: { success: boolean; error?: string } = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to save branch');
            }

            addToast(editingBranch ? 'Branch updated' : 'Branch added', 'success');
            setIsModalOpen(false);
            setEditingBranch(null);
            setForm(emptyForm);
            await loadBranches();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to save branch', 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function toggleBranch(branch: BranchRow) {
        try {
            const response = await fetch(`/api/admin/branches/${branch.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ is_active: !branch.is_active }),
            });
            const result: { success: boolean; error?: string } = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to update branch');
            }
            await loadBranches();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to update branch', 'error');
        }
    }

    const activeCount = branches.filter((branch) => branch.is_active).length;
    const employeeCount = branches.reduce((total, branch) => total + branch.employee_count, 0);

    return (
        <div className="space-y-7">
            <PageReveal className="space-y-5">
                <div className="admin-glass-panel-strong overflow-hidden p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <p className="section-kicker">Branch Management</p>
                            <h1 className="text-3xl font-bold leading-tight text-[var(--admin-ink-strong)] sm:text-4xl">
                                Branches
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--admin-text-soft)]">
                                Manage branch records used by employee assignment, attendance filters, and branch IP rules.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => void loadBranches()}
                                className="admin-glass-button-secondary w-full justify-between rounded-xl sm:w-auto"
                            >
                                <span>Refresh</span>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                                onClick={openAddModal}
                                className="admin-glass-button-primary w-full justify-between rounded-xl sm:w-auto"
                            >
                                <span>Add branch</span>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { label: 'Branches', value: branches.length, icon: Building2 },
                        { label: 'Active', value: activeCount, icon: Power },
                        { label: 'Employees', value: employeeCount, icon: Users },
                    ].map((stat) => {
                        const StatIcon = stat.icon;
                        return (
                            <div
                                key={stat.label}
                                className="admin-kpi-tile border border-[var(--admin-glass-border-muted)]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold uppercase text-[var(--admin-text-muted)]">
                                            {stat.label}
                                        </p>
                                        <p className="mt-2 text-2xl font-semibold text-[var(--admin-ink-strong)]">
                                            {isLoading ? '...' : <AnimatedCounter value={stat.value} />}
                                        </p>
                                    </div>
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                                        <StatIcon className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </PageReveal>

            <PageReveal delay={0.08}>
                <section className="admin-glass-panel p-4 sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--admin-ink-strong)]">Branch directory</h2>
                            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                                Operational branch records, assignment counts, and linked network rules.
                            </p>
                        </div>
                        <div className="admin-glass-panel-muted flex w-fit items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-[var(--admin-text-soft)]">
                            <Network className="h-4 w-4 text-[var(--admin-info)]" />
                            {branches.reduce((total, branch) => total + branch.ip_rule_count, 0)} IP rules
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-16 rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="admin-glass-table min-w-0 overflow-x-auto">
                                <table className="w-full min-w-[780px] text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--admin-glass-border-muted)] bg-[rgb(255_255_255_/_0.045)] text-xs uppercase text-[var(--admin-text-muted)]">
                                            <th className="px-4 py-3 text-start font-semibold">Branch</th>
                                            <th className="px-4 py-3 text-start font-semibold">Code</th>
                                            <th className="px-4 py-3 text-start font-semibold">Location</th>
                                            <th className="px-4 py-3 text-start font-semibold">Employees</th>
                                            <th className="px-4 py-3 text-start font-semibold">IP rules</th>
                                            <th className="px-4 py-3 text-start font-semibold">Status</th>
                                            <th className="px-4 py-3 text-end font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branches.map((branch) => (
                                            <tr key={branch.id} className="admin-glass-table-row last:border-0">
                                                <td className="px-4 py-4">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <span className="truncate font-semibold text-[var(--admin-ink-strong)]">
                                                            {branch.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-[var(--admin-text-soft)]">{branch.code}</td>
                                                <td className="max-w-72 px-4 py-4 text-[var(--admin-text-soft)]">
                                                    <span className="line-clamp-2">{branch.address || '-'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-[var(--admin-ink)]">{branch.employee_count}</td>
                                                <td className="px-4 py-4 text-[var(--admin-ink)]">{branch.ip_rule_count}</td>
                                                <td className="px-4 py-4">
                                                    <Badge
                                                        variant={branch.is_active ? 'present' : 'default'}
                                                        className="admin-glass-status-pill"
                                                    >
                                                        {branch.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-nowrap justify-end gap-1.5">
                                                        <Link href={`/${locale}/admin/branches/${branch.id}`}>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                aria-label={`Open ${branch.name}`}
                                                                title={`Open ${branch.name}`}
                                                                className="admin-glass-button-secondary h-10 w-10 rounded-xl px-0"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditModal(branch)}
                                                            aria-label={`Edit ${branch.name}`}
                                                            title={`Edit ${branch.name}`}
                                                            className="h-10 w-10 rounded-xl px-0 text-[var(--admin-text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--admin-ink-strong)]"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => void toggleBranch(branch)}
                                                            aria-label={`${branch.is_active ? 'Disable' : 'Enable'} ${branch.name}`}
                                                            title={`${branch.is_active ? 'Disable' : 'Enable'} ${branch.name}`}
                                                            className="admin-glass-button-secondary h-10 w-10 rounded-xl px-0"
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {branches.length === 0 && (
                                <div className="admin-glass-panel-muted mt-4 p-8 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-glass-muted)] text-[var(--admin-text-muted)]">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <p className="mt-3 text-sm text-[var(--admin-text-muted)]">No branches found.</p>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </PageReveal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingBranch(null);
                    setForm(emptyForm);
                }}
                title={editingBranch ? 'Edit branch' : 'Add branch'}
                size="lg"
            >
                <form onSubmit={submitForm} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            label="Branch name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            required
                        />
                        <Input
                            label="Code"
                            value={form.code}
                            placeholder="Auto-generated if empty"
                            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                        />
                    </div>
                    <Input
                        label="Address / location"
                        value={form.address}
                        onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    />
                    <label className="admin-glass-panel-muted flex items-start justify-between gap-4 px-4 py-3">
                        <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink-strong)]">
                                <MapPin className="h-4 w-4 text-[var(--admin-info)]" />
                                Active branch
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--admin-text-muted)]">Inactive branches stay visible but are hidden from new employee/IP selectors.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--admin-primary)]"
                        />
                    </label>
                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            className="admin-glass-button-secondary rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving} className="admin-glass-button-primary rounded-xl">
                            <Save className="h-4 w-4" />
                            Save branch
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
