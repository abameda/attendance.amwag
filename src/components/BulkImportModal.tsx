'use client';

import { useState } from 'react';
import { Modal, Button, addToast } from '@/components/ui';
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react';

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
    const [csvData, setCsvData] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleSubmit = async () => {
        if (!csvData.trim()) {
            addToast('Please enter CSV data', 'error');
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
                addToast(`Successfully imported ${data.data.successCount} employees`, 'success');
                onSuccess();
            }

            if (data.data.failedCount > 0) {
                addToast(`${data.data.failedCount} employees failed to import`, 'error');
            }
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Import failed', 'error');
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Employees" size="lg">
            <div className="space-y-4">
                {/* Format Hint */}
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-teal-400 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-teal-100 mb-1">
                                CSV Format
                            </h4>
                            <p className="text-sm text-teal-300 font-mono">
                                Email, Password, Full Name, Branch, Shift Start (HH:mm), Shift End (HH:mm)
                            </p>
                            <p className="text-xs text-teal-400 mt-2">
                                Example: ahmed@amwag.com, 123456, Ahmed Ali, ملوي, 09:00, 17:00
                            </p>
                        </div>
                    </div>
                </div>

                {/* CSV Input */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Paste CSV Data
                    </label>
                    <textarea
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        placeholder={`ahmed@amwag.com, 123456, Ahmed Ali, ملوي, 09:00, 17:00\nsara@amwag.com, 123456, Sara Mahmoud, الجيزه, 08:00, 16:00`}
                        className="w-full h-48 px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none font-mono text-sm"
                        disabled={isSubmitting}
                    />
                </div>

                {/* Results */}
                {result && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">{result.successCount} Success</span>
                            </div>
                            {result.failedCount > 0 && (
                                <div className="flex items-center gap-2 text-red-400">
                                    <XCircle className="w-5 h-5" />
                                    <span className="font-medium">{result.failedCount} Failed</span>
                                </div>
                            )}
                        </div>

                        {result.failedEmails.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                                <p className="text-sm font-medium text-red-200 mb-2">
                                    Failed Emails:
                                </p>
                                <ul className="text-xs text-red-300 space-y-1">
                                    {result.failedEmails.map((item, index) => (
                                        <li key={index}>
                                            <span className="font-mono">{item.email}</span>
                                            {item.error && <span className="ml-2 text-red-400">— {item.error}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <Button variant="outline" onClick={handleClose}>
                        {result ? 'Close' : 'Cancel'}
                    </Button>
                    {!result && (
                        <Button onClick={handleSubmit} isLoading={isSubmitting}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Employees
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
