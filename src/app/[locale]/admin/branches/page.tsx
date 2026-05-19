'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Edit2, Eye, MapPin, Plus, Power, RefreshCw, Save } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Badge, Button, Card, CardContent, Input, Modal, PageReveal, Skeleton, addToast } from '@/components/ui';

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
        <div className="space-y-6">
            <PageReveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-glow-blue)]">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Branch Management</p>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">Branches</h1>
                            </div>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                            Manage branch records used by employee assignment, attendance filters, and branch IP rules.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => void loadBranches()}>
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>
                        <Button onClick={openAddModal}>
                            <Plus className="h-4 w-4" />
                            Add branch
                        </Button>
                    </div>
                </div>
            </PageReveal>

            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    ['Branches', branches.length],
                    ['Active', activeCount],
                    ['Employees', employeeCount],
                ].map(([label, value]) => (
                    <Card key={label} className="rounded-2xl">
                        <CardContent>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
                            <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="rounded-2xl">
                <CardContent className="space-y-5">
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-16 rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="min-w-0 overflow-x-auto">
                            <table className="w-full min-w-[860px] text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                                        <th className="px-3 py-3 text-start">Branch</th>
                                        <th className="px-3 py-3 text-start">Code</th>
                                        <th className="px-3 py-3 text-start">Location</th>
                                        <th className="px-3 py-3 text-start">Employees</th>
                                        <th className="px-3 py-3 text-start">IP rules</th>
                                        <th className="px-3 py-3 text-start">Status</th>
                                        <th className="px-3 py-3 text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map((branch) => (
                                        <tr key={branch.id} className="border-b border-[var(--line)] last:border-0">
                                            <td className="px-3 py-4 font-semibold text-[var(--foreground)]">{branch.name}</td>
                                            <td className="px-3 py-4 font-mono text-xs text-[var(--muted-strong)]">{branch.code}</td>
                                            <td className="px-3 py-4 text-[var(--muted-strong)]">{branch.address || '-'}</td>
                                            <td className="px-3 py-4 text-[var(--foreground-soft)]">{branch.employee_count}</td>
                                            <td className="px-3 py-4 text-[var(--foreground-soft)]">{branch.ip_rule_count}</td>
                                            <td className="px-3 py-4">
                                                <Badge variant={branch.is_active ? 'present' : 'default'}>
                                                    {branch.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-4">
                                                <div className="flex flex-nowrap justify-end gap-2">
                                                    <Link href={`/${locale}/admin/branches/${branch.id}`}>
                                                        <Button type="button" variant="outline" size="sm">
                                                            <Eye className="h-4 w-4" />
                                                            Open
                                                        </Button>
                                                    </Link>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditModal(branch)}>
                                                        <Edit2 className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => void toggleBranch(branch)}>
                                                        <Power className="h-4 w-4" />
                                                        {branch.is_active ? 'Disable' : 'Enable'}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {branches.length === 0 && (
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                                    No branches found.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

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
                    <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                        <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                                <MapPin className="h-4 w-4 text-[var(--accent)]" />
                                Active branch
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Inactive branches stay visible but are hidden from new employee/IP selectors.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                        />
                    </label>
                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSaving}>
                            <Save className="h-4 w-4" />
                            Save branch
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
