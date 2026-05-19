'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    Database,
    Download,
    Lock,
    Plus,
    RefreshCw,
    ShieldAlert,
    Trash2,
    Unlock,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
    Badge,
    Button,
    Card,
    CardContent,
    PageReveal,
    Skeleton,
    addToast,
} from '@/components/ui';

type BackupRecord = {
    id: string;
    name: string;
    fileName: string;
    createdAt: string;
    createdBy: string;
    fileSize: number;
    status: 'ready';
    includedTables: string[];
    excludedTables: string[];
    rowCounts: Record<string, number>;
    encrypted: boolean;
    checksum: string;
};

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function BackupsPage() {
    const t = useTranslations('Backups');
    const locale = useLocale();
    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }),
        [locale]
    );

    const loadBackups = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/backups', { credentials: 'include' });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('loadError'));
            }

            setBackups(result.data ?? []);
        } catch (error) {
            console.error('Failed to load backups:', error);
            addToast(error instanceof Error ? error.message : t('loadError'), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadBackups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createBackup = async () => {
        setIsCreating(true);
        try {
            const response = await fetch('/api/admin/backups/create', {
                method: 'POST',
                credentials: 'include',
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('createError'));
            }

            addToast(t('createSuccess'), 'success');
            await loadBackups();
        } catch (error) {
            console.error('Failed to create backup:', error);
            addToast(error instanceof Error ? error.message : t('createError'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const deleteBackup = async (backup: BackupRecord) => {
        if (!window.confirm(t('deleteConfirm', { name: backup.name }))) return;

        setDeletingId(backup.id);
        try {
            const response = await fetch(`/api/admin/backups/${encodeURIComponent(backup.id)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || t('deleteError'));
            }

            addToast(t('deleteSuccess'), 'success');
            await loadBackups();
        } catch (error) {
            console.error('Failed to delete backup:', error);
            addToast(error instanceof Error ? error.message : t('deleteError'), 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const downloadBackup = (backup: BackupRecord) => {
        window.location.assign(`/api/admin/backups/${encodeURIComponent(backup.id)}/download`);
    };

    return (
        <div className="space-y-6">
            <PageReveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-glow-blue)]">
                                <Archive className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    {t('kicker')}
                                </p>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                                    {t('title')}
                                </h1>
                            </div>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => void loadBackups()} disabled={isLoading}>
                            <RefreshCw className="h-4 w-4" />
                            {t('refresh')}
                        </Button>
                        <Button onClick={createBackup} isLoading={isCreating} disabled={isCreating}>
                            <Plus className="h-4 w-4" />
                            {t('createButton')}
                        </Button>
                    </div>
                </div>
            </PageReveal>

            <Card className="rounded-2xl border-[var(--warning)]/20 bg-[var(--warning-soft)]/40">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--foreground)]">{t('warningTitle')}</h2>
                        <p className="mt-1 max-w-3xl text-xs leading-6 text-[var(--muted)]">{t('warningBody')}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl">
                <CardContent className="p-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent)]">
                                <Database className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[var(--foreground)]">{t('historyTitle')}</h2>
                                <p className="mt-1 text-xs text-[var(--muted)]">{t('historySubtitle')}</p>
                            </div>
                        </div>
                        <Badge variant="info">{t('count', { count: backups.length })}</Badge>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3 p-5">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-20 rounded-xl" />
                            ))}
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-strong)] text-[var(--muted)]">
                                <Archive className="h-5 w-5" />
                            </div>
                            <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">{t('emptyTitle')}</h3>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{t('emptyBody')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-[var(--line)] text-sm">
                                <thead>
                                    <tr className="text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] rtl:text-right">
                                        <th className="px-5 py-3">{t('name')}</th>
                                        <th className="px-5 py-3">{t('createdAt')}</th>
                                        <th className="px-5 py-3">{t('createdBy')}</th>
                                        <th className="px-5 py-3">{t('size')}</th>
                                        <th className="px-5 py-3">{t('status')}</th>
                                        <th className="px-5 py-3">{t('tables')}</th>
                                        <th className="px-5 py-3 text-end">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--line)]">
                                    {backups.map((backup) => (
                                        <tr key={backup.id} className="align-top">
                                            <td className="max-w-xs px-5 py-4">
                                                <div className="flex items-start gap-2">
                                                    {backup.encrypted ? (
                                                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                                                    ) : (
                                                        <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="break-all font-medium text-[var(--foreground)]">{backup.name}</p>
                                                        <p className="mt-1 font-mono text-[0.68rem] text-[var(--muted)]">
                                                            {backup.checksum ? backup.checksum.slice(0, 12) : t('noChecksum')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-[var(--muted-strong)]">
                                                {dateFormatter.format(new Date(backup.createdAt))}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-[var(--muted-strong)]">
                                                {backup.createdBy}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-[var(--muted-strong)]">
                                                {formatBytes(backup.fileSize)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="space-y-2">
                                                    <Badge variant="present">{t('ready')}</Badge>
                                                    <Badge variant={backup.encrypted ? 'present' : 'late'}>
                                                        {backup.encrypted ? t('encrypted') : t('notEncrypted')}
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="min-w-64 px-5 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {backup.includedTables.map((table) => (
                                                        <span
                                                            key={table}
                                                            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted-strong)]"
                                                        >
                                                            {table}: {backup.rowCounts?.[table] ?? 0}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => downloadBackup(backup)}>
                                                        <Download className="h-4 w-4" />
                                                        {t('download')}
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => void deleteBackup(backup)}
                                                        isLoading={deletingId === backup.id}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        {t('delete')}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
