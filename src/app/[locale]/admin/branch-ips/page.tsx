'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    CircleSlash,
    Edit2,
    ListChecks,
    Network,
    Plus,
    RefreshCw,
    Save,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';

import {
    Badge,
    Button,
    Input,
    PageReveal,
    Skeleton,
    addToast,
} from '@/components/ui';

type RuleType = 'exact_ip' | 'cidr';

type BranchIpRule = {
    id: string;
    branch_name: string;
    branch_id?: string | null;
    rule_type: RuleType;
    value: string;
    label: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
};

type BranchOption = {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
};

type FormState = {
    branch_id: string;
    branch_name: string;
    rule_type: RuleType;
    value: string;
    label: string;
    is_active: boolean;
};

const emptyForm: FormState = {
    branch_id: '',
    branch_name: '',
    rule_type: 'exact_ip',
    value: '',
    label: '',
    is_active: true,
};

function valuePlaceholder(ruleType: RuleType) {
    return ruleType === 'exact_ip' ? '156.200.10.20' : '156.200.10.0/24';
}

function validateForm(form: FormState) {
    if (!form.branch_name) return 'Choose a branch';
    if (!form.value.trim()) {
        return form.rule_type === 'exact_ip'
            ? 'Enter a valid IP address'
            : 'Enter a valid CIDR range, for example 192.168.1.0/24';
    }
    if (form.value.includes('*')) return 'Wildcards and partial IPs are not supported';
    return '';
}

function formatDate(value: string) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
}

export default function BranchIpsPage() {
    const [rules, setRules] = useState<BranchIpRule[]>([]);
    const [branches, setBranches] = useState<string[]>([]);
    const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
    const [branchFilter, setBranchFilter] = useState('');
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const filteredRules = useMemo(() => {
        if (!branchFilter) return rules;
        return rules.filter((rule) => rule.branch_name === branchFilter);
    }, [branchFilter, rules]);

    const activeRuleCount = rules.filter((rule) => rule.is_active).length;
    const inactiveRuleCount = rules.length - activeRuleCount;
    const branchCount = branchOptions.length || branches.length;

    const loadRules = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter) params.set('branch', branchFilter);
            const response = await fetch(`/api/admin/branch-ips?${params.toString()}`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to load branch IP rules');
            }

            setRules(result.data ?? []);
            setBranches(result.branches ?? []);
            setBranchOptions(result.branch_options ?? []);
        } catch (loadError) {
            console.error('Failed to load branch IP rules:', loadError);
            addToast(loadError instanceof Error ? loadError.message : 'Failed to load branch IP rules', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadRules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchFilter]);

    useEffect(() => {
        const initialBranch = new URLSearchParams(window.location.search).get('branch');
        if (initialBranch) setBranchFilter(initialBranch);
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setPendingDeleteId(null);
        setForm({
            ...emptyForm,
            branch_name: branchFilter || '',
            branch_id: branchOptions.find((branch) => branch.name === branchFilter)?.id ?? '',
        });
        setError('');
    };

    const submitForm = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const validationError = validateForm(form);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const response = await fetch(
                editingId ? `/api/admin/branch-ips/${editingId}` : '/api/admin/branch-ips',
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                }
            );
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to save branch IP rule');
            }

            addToast(editingId ? 'Branch IP rule updated' : 'Branch IP rule added', 'success');
            resetForm();
            await loadRules();
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Failed to save branch IP rule';
            setError(message);
            addToast(message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (rule: BranchIpRule) => {
        setEditingId(rule.id);
        setForm({
            branch_id: rule.branch_id ?? branchOptions.find((branch) => branch.name === rule.branch_name)?.id ?? '',
            branch_name: rule.branch_name,
            rule_type: rule.rule_type,
            value: rule.value,
            label: rule.label,
            is_active: rule.is_active,
        });
        setPendingDeleteId(null);
        setError('');
    };

    const toggleRule = async (rule: BranchIpRule) => {
        try {
            const response = await fetch(`/api/admin/branch-ips/${rule.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !rule.is_active }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to update rule status');
            }
            await loadRules();
        } catch (toggleError) {
            addToast(toggleError instanceof Error ? toggleError.message : 'Failed to update rule status', 'error');
        }
    };

    const deleteRule = async (rule: BranchIpRule) => {
        try {
            const response = await fetch(`/api/admin/branch-ips/${rule.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to delete branch IP rule');
            }
            addToast('Branch IP rule deleted', 'success');
            setPendingDeleteId(null);
            await loadRules();
        } catch (deleteError) {
            addToast(deleteError instanceof Error ? deleteError.message : 'Failed to delete branch IP rule', 'error');
        }
    };

    return (
        <div className="space-y-7">
            <PageReveal className="space-y-5">
                <div className="admin-glass-panel-strong overflow-hidden p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <p className="section-kicker">Network Access</p>
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                                    <Network className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <h1 className="text-3xl font-bold leading-tight text-[var(--admin-ink-strong)] sm:text-4xl">
                                    Branch IP Rules
                                </h1>
                            </div>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--admin-text-soft)]">
                                Manage exact IP addresses and CIDR subnet ranges that authorize employee attendance by branch.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => void loadRules()}
                            className="admin-glass-button-secondary w-full justify-between rounded-xl sm:w-auto"
                        >
                            <span>Refresh</span>
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Rules', value: rules.length, icon: ListChecks },
                        { label: 'Active', value: activeRuleCount, icon: ShieldCheck },
                        { label: 'Inactive', value: inactiveRuleCount, icon: CircleSlash },
                        { label: 'Branches', value: branchCount, icon: Building2 },
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
                                            {isLoading ? '...' : stat.value}
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

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(21rem,23rem)_minmax(0,1fr)]">
                <PageReveal delay={0.06}>
                    <section className="admin-glass-panel p-5 sm:p-6">
                        <form className="space-y-5" onSubmit={submitForm}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/[0.25] bg-emerald-400/[0.12] text-emerald-200">
                                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-[var(--admin-ink-strong)]">
                                            {editingId ? 'Edit rule' : 'Add rule'}
                                        </h2>
                                        <p className="mt-1 text-xs leading-5 text-[var(--admin-text-muted)]">
                                            Wildcards and partial IPs are not supported.
                                        </p>
                                    </div>
                                </div>
                                {editingId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetForm}
                                        className="rounded-xl text-[var(--admin-text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--admin-ink-strong)]"
                                    >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                        Cancel
                                    </Button>
                                )}
                            </div>

                            <div>
                                <label className="mb-2 block text-[0.72rem] font-semibold uppercase text-[var(--admin-text-muted)]">
                                    Branch
                                </label>
                                <select
                                    value={form.branch_id}
                                    onChange={(event) => {
                                        const branch = branchOptions.find((option) => option.id === event.target.value);
                                        setForm((current) => ({
                                            ...current,
                                            branch_id: branch?.id ?? '',
                                            branch_name: branch?.name ?? '',
                                        }));
                                    }}
                                    className="admin-branch-ip-select admin-glass-control focus-ring min-h-11 w-full min-w-0 rounded-xl px-4 py-2.5 text-sm outline-none"
                                >
                                    <option value="">Choose branch</option>
                                    {branchOptions.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-[0.72rem] font-semibold uppercase text-[var(--admin-text-muted)]">
                                    Rule type
                                </label>
                                <div className="admin-glass-control grid grid-cols-2 gap-1.5 rounded-xl p-1">
                                    {[
                                        ['exact_ip', 'Exact IP'],
                                        ['cidr', 'CIDR/Subnet'],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((current) => ({ ...current, rule_type: value as RuleType, value: '' }))}
                                            className={`focus-ring min-h-11 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
                                                form.rule_type === value
                                                    ? 'border border-blue-300/[0.25] bg-blue-400/[0.16] text-blue-100'
                                                    : 'text-[var(--admin-text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--admin-ink-strong)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Input
                                label={form.rule_type === 'exact_ip' ? 'IP address' : 'CIDR range'}
                                placeholder={valuePlaceholder(form.rule_type)}
                                value={form.value}
                                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                                error={error}
                                className="admin-glass-control rounded-xl"
                            />

                            <Input
                                label="Label"
                                placeholder="Main office WiFi"
                                value={form.label}
                                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                                className="admin-glass-control rounded-xl"
                            />

                            <label className="admin-glass-panel-muted flex items-start justify-between gap-4 px-4 py-3">
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-[var(--admin-ink-strong)]">Active</span>
                                    <span className="mt-1 block text-xs leading-5 text-[var(--admin-text-muted)]">Inactive rules do not authorize attendance.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--admin-primary)]"
                                />
                            </label>

                            <Button type="submit" isLoading={isSaving} disabled={isSaving} className="admin-glass-button-primary w-full rounded-xl">
                                {editingId ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                                {editingId ? 'Save changes' : 'Add rule'}
                            </Button>
                        </form>
                    </section>
                </PageReveal>

                <PageReveal delay={0.1}>
                    <section className="admin-glass-panel min-w-0 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-[var(--admin-ink-strong)]">Allowed rules</h2>
                                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Filter by branch, then edit status or values inline.</p>
                            </div>
                            <select
                                value={branchFilter}
                                onChange={(event) => setBranchFilter(event.target.value)}
                                className="admin-branch-ip-select admin-glass-control focus-ring min-h-11 w-full rounded-xl px-4 text-sm outline-none sm:w-auto sm:min-w-48"
                            >
                                <option value="">All branches</option>
                                {branches.map((branch) => (
                                    <option key={branch} value={branch}>
                                        {branch}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={index} className="h-14 rounded-xl" />
                                ))}
                            </div>
                        ) : (
                            <div className="admin-branch-ip-table admin-glass-table min-w-0 overflow-x-auto">
                                <table className="w-full min-w-[820px] text-start text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--admin-glass-border-muted)] bg-[rgb(255_255_255_/_0.045)] text-xs uppercase text-[var(--admin-text-muted)]">
                                            <th className="px-4 py-3 text-start font-semibold">Branch</th>
                                            <th className="px-4 py-3 text-start font-semibold">Label</th>
                                            <th className="px-4 py-3 text-start font-semibold">Type</th>
                                            <th className="px-4 py-3 text-start font-semibold">IP/CIDR value</th>
                                            <th className="px-4 py-3 text-start font-semibold">Status</th>
                                            <th className="px-4 py-3 text-start font-semibold">Created at</th>
                                            <th className="w-72 px-4 py-3 text-end font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRules.map((rule) => (
                                            <tr key={rule.id} className="admin-glass-table-row last:border-0">
                                                <td className="px-4 py-4">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--admin-info)]">
                                                            <Building2 className="h-4 w-4" aria-hidden="true" />
                                                        </div>
                                                        <span className="truncate font-semibold text-[var(--admin-ink-strong)]">{rule.branch_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-[var(--admin-text-soft)]">{rule.label || '-'}</td>
                                                <td className="px-4 py-4">
                                                    <Badge variant="info" className="admin-glass-status-pill">
                                                        {rule.rule_type === 'exact_ip' ? 'Exact IP' : 'CIDR'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4 font-mono text-xs text-[var(--admin-ink)]">{rule.value}</td>
                                                <td className="px-4 py-4">
                                                    <Badge variant={rule.is_active ? 'present' : 'default'} className="admin-glass-status-pill">
                                                        {rule.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-4 text-[var(--admin-text-muted)]">{formatDate(rule.created_at)}</td>
                                                <td className="w-72 px-4 py-4 text-end">
                                                    <div className="flex flex-nowrap justify-end gap-1.5">
                                                        {pendingDeleteId === rule.id ? (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => void deleteRule(rule)}
                                                                    className="admin-glass-button-danger-subtle whitespace-nowrap rounded-xl"
                                                                >
                                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                                    Confirm delete
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setPendingDeleteId(null)}
                                                                    className="whitespace-nowrap rounded-xl text-[var(--admin-text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--admin-ink-strong)]"
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => startEdit(rule)}
                                                                    aria-label={`Edit ${rule.label || rule.value}`}
                                                                    title={`Edit ${rule.label || rule.value}`}
                                                                    className="h-10 w-10 rounded-xl px-0 text-[var(--admin-text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--admin-ink-strong)]"
                                                                >
                                                                    <Edit2 className="h-4 w-4" aria-hidden="true" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => void toggleRule(rule)}
                                                                    className="admin-glass-button-secondary rounded-xl"
                                                                >
                                                                    {rule.is_active ? 'Disable' : 'Enable'}
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setPendingDeleteId(rule.id)}
                                                                    aria-label={`Delete ${rule.label || rule.value}`}
                                                                    title={`Delete ${rule.label || rule.value}`}
                                                                    className="h-10 w-10 rounded-xl px-0 text-red-200 hover:bg-red-400/[0.12]"
                                                                >
                                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredRules.length === 0 && (
                                    <div className="admin-glass-panel-muted m-4 p-8 text-center">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-glass-muted)] text-[var(--admin-text-muted)]">
                                            <Network className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-4 text-sm font-semibold text-[var(--admin-ink-strong)]">No branch IP rules found</h3>
                                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--admin-text-muted)]">
                                            Add the first exact IP or CIDR rule to authorize attendance from a branch network.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </PageReveal>
            </div>
        </div>
    );
}
