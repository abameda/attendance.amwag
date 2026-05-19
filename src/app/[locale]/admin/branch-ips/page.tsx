'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Edit2, Network, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardContent,
    Input,
    PageReveal,
    Skeleton,
    addToast,
} from '@/components/ui';

type RuleType = 'exact_ip' | 'cidr';

type BranchIpRule = {
    id: string;
    branch_name: string;
    rule_type: RuleType;
    value: string;
    label: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
};

type FormState = {
    branch_name: string;
    rule_type: RuleType;
    value: string;
    label: string;
    is_active: boolean;
};

const emptyForm: FormState = {
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
    const [branchFilter, setBranchFilter] = useState('');
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const filteredRules = useMemo(() => {
        if (!branchFilter) return rules;
        return rules.filter((rule) => rule.branch_name === branchFilter);
    }, [branchFilter, rules]);

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

    const resetForm = () => {
        setEditingId(null);
        setForm({
            ...emptyForm,
            branch_name: branchFilter || '',
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
            branch_name: rule.branch_name,
            rule_type: rule.rule_type,
            value: rule.value,
            label: rule.label,
            is_active: rule.is_active,
        });
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
        if (!window.confirm(`Delete "${rule.label || rule.value}"?`)) return;

        try {
            const response = await fetch(`/api/admin/branch-ips/${rule.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to delete branch IP rule');
            }
            addToast('Branch IP rule deleted', 'success');
            await loadRules();
        } catch (deleteError) {
            addToast(deleteError instanceof Error ? deleteError.message : 'Failed to delete branch IP rule', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <PageReveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-glow-blue)]">
                                <Network className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    Network Access
                                </p>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                                    Branch IP Rules
                                </h1>
                            </div>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                            Manage exact IP addresses and CIDR subnet ranges that employees can use for attendance.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => void loadRules()}>
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </PageReveal>

            <div className="grid items-start gap-6 2xl:grid-cols-[minmax(21rem,23rem)_minmax(0,1fr)]">
                <Card className="min-w-0 rounded-2xl">
                    <CardContent className="p-5 sm:p-6">
                        <form className="space-y-5" onSubmit={submitForm}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-[var(--foreground)]">
                                            {editingId ? 'Edit rule' : 'Add rule'}
                                        </h2>
                                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                                            Wildcards and partial IPs are not supported.
                                        </p>
                                    </div>
                                </div>
                                {editingId && (
                                    <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                                        <X className="h-4 w-4" />
                                        Cancel
                                    </Button>
                                )}
                            </div>

                            <div>
                                <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                                    Branch
                                </label>
                                <select
                                    value={form.branch_name}
                                    onChange={(event) => setForm((current) => ({ ...current, branch_name: event.target.value }))}
                                    className="min-h-11 w-full min-w-0 rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[0.95rem] text-[var(--foreground)] outline-none transition-colors focus-visible:border-[var(--accent)]"
                                >
                                    <option value="">Choose branch</option>
                                    {branches.map((branch) => (
                                        <option key={branch} value={branch}>
                                            {branch}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                                    Rule type
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] p-1">
                                    {[
                                        ['exact_ip', 'Exact IP'],
                                        ['cidr', 'CIDR/Subnet'],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((current) => ({ ...current, rule_type: value as RuleType, value: '' }))}
                                            className={`min-h-11 whitespace-nowrap rounded-[0.9rem] px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
                                                form.rule_type === value
                                                    ? 'bg-[var(--accent)] text-white'
                                                    : 'text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]'
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
                            />

                            <Input
                                label="Label"
                                placeholder="Main office WiFi"
                                value={form.label}
                                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                            />

                            <label className="flex items-start justify-between gap-4 rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-[var(--foreground)]">Active</span>
                                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Inactive rules do not authorize attendance.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                                />
                            </label>

                            <Button type="submit" isLoading={isSaving} disabled={isSaving} className="w-full">
                                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {editingId ? 'Save changes' : 'Add rule'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="min-w-0 rounded-2xl">
                    <CardContent className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-[var(--foreground)]">Allowed rules</h2>
                                <p className="text-xs text-[var(--muted)]">Filter by branch, then edit status or values inline.</p>
                            </div>
                            <select
                                value={branchFilter}
                                onChange={(event) => setBranchFilter(event.target.value)}
                                className="min-h-11 w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--accent)] sm:w-auto sm:min-w-48"
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
                            <div className="min-w-0 overflow-x-auto">
                                <table className="w-full min-w-[820px] text-start text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                                            <th className="px-3 py-3 text-start">Branch</th>
                                            <th className="px-3 py-3 text-start">Label</th>
                                            <th className="px-3 py-3 text-start">Type</th>
                                            <th className="px-3 py-3 text-start">IP/CIDR value</th>
                                            <th className="px-3 py-3 text-start">Status</th>
                                            <th className="px-3 py-3 text-start">Created at</th>
                                            <th className="px-3 py-3 text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRules.map((rule) => (
                                            <tr key={rule.id} className="border-b border-[var(--line)] last:border-0">
                                                <td className="px-3 py-4 font-medium text-[var(--foreground)]">{rule.branch_name}</td>
                                                <td className="px-3 py-4 text-[var(--muted-strong)]">{rule.label || '-'}</td>
                                                <td className="px-3 py-4">
                                                    <Badge variant="info">
                                                        {rule.rule_type === 'exact_ip' ? 'Exact IP' : 'CIDR'}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-4 font-mono text-[var(--foreground)]">{rule.value}</td>
                                                <td className="px-3 py-4">
                                                    <Badge variant={rule.is_active ? 'present' : 'default'}>
                                                        {rule.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-4 text-[var(--muted)]">{formatDate(rule.created_at)}</td>
                                                <td className="px-3 py-4 text-end">
                                                    <div className="flex flex-nowrap justify-end gap-2">
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(rule)}>
                                                            <Edit2 className="h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => void toggleRule(rule)}>
                                                            {rule.is_active ? 'Disable' : 'Enable'}
                                                        </Button>
                                                        <Button type="button" variant="danger" size="sm" onClick={() => void deleteRule(rule)}>
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredRules.length === 0 && (
                                    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                                        No branch IP rules found.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
