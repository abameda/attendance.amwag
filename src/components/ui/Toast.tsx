'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    exiting?: boolean;
}

const TOAST_DURATION = 5000;

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
    toastListeners.forEach((listener) => listener([...toasts]));
}

export function addToast(message: string, type: ToastType = 'info') {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, message, type }];
    notifyListeners();

    setTimeout(() => {
        dismissToast(id);
    }, TOAST_DURATION);
}

function dismissToast(id: string) {
    toasts = toasts.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast));
    notifyListeners();

    setTimeout(() => {
        toasts = toasts.filter((toast) => toast.id !== id);
        notifyListeners();
    }, 300);
}

export function removeToast(id: string) {
    dismissToast(id);
}

const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 shrink-0 text-[var(--toast-success)]" />,
    error: <AlertCircle className="h-5 w-5 shrink-0 text-[var(--toast-danger)]" />,
    info: <Info className="h-5 w-5 shrink-0 text-[var(--toast-accent)]" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--toast-warning)]" />,
};

const accentColors: Record<ToastType, string> = {
    success: 'bg-[var(--toast-success)]',
    error: 'bg-[var(--toast-danger)]',
    info: 'bg-[var(--toast-accent)]',
    warning: 'bg-[var(--toast-warning)]',
};

const progressColors: Record<ToastType, string> = {
    success: 'bg-[var(--toast-success)]/40',
    error: 'bg-[var(--toast-danger)]/40',
    info: 'bg-[var(--toast-accent)]/40',
    warning: 'bg-[var(--toast-warning)]/40',
};

export function ToastContainer() {
    const [localToasts, setLocalToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (newToasts: Toast[]) => setLocalToasts(newToasts);
        toastListeners.push(listener);

        return () => {
            toastListeners = toastListeners.filter((currentListener) => currentListener !== listener);
        };
    }, []);

    const handleDismiss = useCallback((id: string) => {
        dismissToast(id);
    }, []);

    if (localToasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 end-4 z-50 flex max-w-sm flex-col gap-2">
            {localToasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'relative flex items-center gap-3 overflow-hidden rounded-[1.4rem] border border-[var(--toast-line)] bg-[var(--toast-surface)] px-4 py-3 text-[var(--toast-foreground)] shadow-[var(--toast-shadow)] backdrop-blur-2xl',
                        toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
                    )}
                >
                    {/* Status accent bar */}
                    <div className={cn('absolute inset-y-0 start-0 w-0.5 rounded-full', accentColors[toast.type])} />
                    {icons[toast.type]}
                    <p className="flex-1 text-sm font-medium" dir="auto">{toast.message}</p>
                    <button
                        onClick={() => handleDismiss(toast.id)}
                        className="ms-1 shrink-0 rounded-full p-1 text-[var(--toast-muted)] transition-colors hover:bg-[var(--toast-hover)] hover:text-[var(--toast-foreground)]"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                    {!toast.exiting && (
                        <div
                            className={cn(
                                'absolute bottom-0 start-0 h-0.5 w-full origin-left',
                                progressColors[toast.type]
                            )}
                            style={{ animation: `progress-shrink ${TOAST_DURATION}ms linear forwards` }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
