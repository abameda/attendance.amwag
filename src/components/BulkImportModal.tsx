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
            <div className="space-y-4">
                {/* Format Hint */}
                <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4">
                    <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
                        <div>
                            <h4 className="mb-1 font-medium text-[var(--foreground)]">{t('formatTitle')}</h4>
                            <p className="font-mono text-sm text-[var(--foreground-soft)]">
                                {t('formatColumns')}
                            </p>
                            <p className="mt-2 text-xs text-[var(--muted)]">
                                {t('example')}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                                {t('offDayHint')}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                                {t('optionalHint')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* CSV Input */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">{t('pasteCsv')}</label>
                    <textarea
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        placeholder={`ahmed@amwag.com, 123456, Ahmed Ali, ملوي, 09:00, 8, Driver, friday\nsara@amwag.com, 123456, Sara Mahmoud, الجيزه, 08:00, 8, Accountant, saturday`}
                        className="focus-ring h-48 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:shadow-[var(--shadow-glow-blue)]"
                        disabled={isSubmitting}
                    />
                </div>

                {/* Results */}
                {result && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-[var(--success)]">
                                <CheckCircle className="h-5 w-5" />
                                <span className="font-medium">{t('success', { count: result.successCount })}</span>
                            </div>
                            {result.failedCount > 0 && (
                                <div className="flex items-center gap-2 text-[var(--danger)]">
                                    <XCircle className="h-5 w-5" />
                                    <span className="font-medium">{t('failed', { count: result.failedCount })}</span>
                                </div>
                            )}
                        </div>

                        {result.failedEmails.length > 0 && (
                            <div className="max-h-32 overflow-y-auto rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-3">
                                <p className="mb-2 text-sm font-medium text-[var(--danger)]">{t('failedEmails')}</p>
                                <ul className="space-y-1 text-xs text-[var(--foreground-soft)]">
                                    {result.failedEmails.map((item, index) => (
                                        <li key={index}>
                                            <span className="font-mono">{item.email}</span>
                                            {item.error && <span className="ms-2 text-[var(--muted)]">— {item.error}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
                    <Button variant="outline" onClick={handleClose}>
                        {result ? t('close') : t('cancel')}
                    </Button>
                    {!result && (
                        <Button onClick={handleSubmit} isLoading={isSubmitting}>
                            <Upload className="me-2 h-4 w-4" />
                            {t('importEmployees')}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
