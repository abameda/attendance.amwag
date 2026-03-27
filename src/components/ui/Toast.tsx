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
    success: <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />,
    error: <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />,
    info: <Info className="h-5 w-5 shrink-0 text-sky-600" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />,
};

const backgrounds: Record<ToastType, string> = {
    success: 'bg-[rgba(255,255,255,0.86)] border-emerald-200',
    error: 'bg-[rgba(255,255,255,0.86)] border-rose-200',
    info: 'bg-[rgba(255,255,255,0.86)] border-sky-200',
    warning: 'bg-[rgba(255,255,255,0.86)] border-amber-200',
};

const progressColors: Record<ToastType, string> = {
    success: 'bg-emerald-400/70',
    error: 'bg-rose-400/70',
    info: 'bg-sky-400/70',
    warning: 'bg-amber-400/70',
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
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
            {localToasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'relative flex items-center gap-3 overflow-hidden rounded-[1.4rem] border px-4 py-3 text-[#241d22] shadow-[0_24px_48px_-28px_rgba(72,47,56,0.55)] backdrop-blur-xl',
                        toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right',
                        backgrounds[toast.type]
                    )}
                >
                    {icons[toast.type]}
                    <p className="flex-1 text-sm font-medium">{toast.message}</p>
                    <button
                        onClick={() => handleDismiss(toast.id)}
                        className="ml-1 shrink-0 rounded-full p-1 text-[#8f7f84] hover:bg-[rgba(36,29,34,0.06)] hover:text-[#241d22]"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                    {!toast.exiting && (
                        <div
                            className={cn(
                                'absolute bottom-0 left-0 h-0.5 w-full origin-left',
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
