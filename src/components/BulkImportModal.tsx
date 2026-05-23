'use client';

import { useState } from 'react';
import { Modal, Button, addToast } from '@/components/ui';
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ImportResult {
    total: number;
    successCount: number;
    failedCount: number;
    failedEmails: { email: string; error?: string }[];
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
    const t = useTranslations('BulkImport');
    const [csvData, setCsvData] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleSubmit = async () => {
        if (!csvData.trim()) {
            addToast(t('emptyCsv'), 'error');
            return;
        }

        setIsSubmitting(true);
        setResult(null);

        try {
            const response = await fetch('/api/employees/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csvData }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            setResult(data.data);

            if (data.data.successCount > 0) {
                addToast(t('successToast', { count: data.data.successCount }), 'success');
                onSuccess();
            }

            if (data.data.failedCount > 0) {
                addToast(t('failedToast', { count: data.data.failedCount }), 'error');
            }
        } catch (error) {
            addToast(error instanceof Error ? error.message : t('importFailed'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setCsvData('');
        setResult(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={t('title')} size="lg">
            <div className="bulk-import-instrument space-y-4">
                <div className="admin-glass-panel-muted p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border-muted)] bg-[var(--admin-primary-soft)] text-[var(--accent)]">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-[var(--admin-ink-strong)]">{t('formatTitle')}</h4>
                            <p className="mt-2 overflow-x-auto rounded-xl border border-[var(--admin-glass-border-muted)] bg-[rgb(255_255_255_/_0.045)] px-3 py-2 font-mono text-xs leading-6 text-[var(--admin-text-soft)]">
                                {t('formatColumns')}
                            </p>
                            <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--admin-text-muted)]">
                                <p>{t('example')}</p>
                                <p>{t('offDayHint')}</p>
                                <p>{t('optionalHint')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-soft)]">
                        {t('pasteCsv')}
                    </label>
                    <textarea
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        placeholder={`ahmed@amwag.com, 123456, Ahmed Ali, ملوي, 09:00, 8, Driver, friday\nsara@amwag.com, 123456, Sara Mahmoud, الجيزه, 08:00, 8, Accountant, saturday`}
                        className="admin-glass-control focus-ring min-h-52 w-full resize-y rounded-xl px-4 py-3 font-mono text-sm leading-6 text-[var(--admin-ink)] placeholder:text-[var(--admin-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                    />
                </div>

                {result && (
                    <div className="admin-glass-panel-muted space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]">
                                <CheckCircle className="h-5 w-5" />
                                <span className="text-sm font-semibold">{t('success', { count: result.successCount })}</span>
                            </div>
                            {result.failedCount > 0 && (
                                <div className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger)]">
                                    <XCircle className="h-5 w-5" />
                                    <span className="text-sm font-semibold">{t('failed', { count: result.failedCount })}</span>
                                </div>
                            )}
                        </div>

                        {result.failedEmails.length > 0 && (
                            <div className="custom-scrollbar max-h-36 overflow-y-auto rounded-xl border border-red-400/25 bg-[var(--danger-soft)] p-3">
                                <p className="mb-2 text-sm font-medium text-[var(--danger)]">{t('failedEmails')}</p>
                                <ul className="space-y-1 text-xs text-[var(--foreground-soft)]">
                                    {result.failedEmails.map((item, index) => (
                                        <li key={index}>
                                            <span className="font-mono">{item.email}</span>
                                            {item.error && <span className="ms-2 text-[var(--muted)]">: {item.error}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={handleClose} className="admin-glass-button-secondary">
                        {result ? t('close') : t('cancel')}
                    </Button>
                    {!result && (
                        <Button onClick={handleSubmit} isLoading={isSubmitting} className="admin-glass-button-primary">
                            <Upload className="me-2 h-4 w-4" />
                            {t('importEmployees')}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
