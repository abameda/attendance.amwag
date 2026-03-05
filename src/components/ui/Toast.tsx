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
    toasts = toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t));
    notifyListeners();

    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        notifyListeners();
    }, 300);
}

export function removeToast(id: string) {
    dismissToast(id);
}

const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-teal-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
};

const backgrounds: Record<ToastType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/25',
    error: 'bg-red-500/10 border-red-500/25',
    info: 'bg-teal-500/10 border-teal-500/25',
    warning: 'bg-amber-500/10 border-amber-500/25',
};

const progressColors: Record<ToastType, string> = {
    success: 'bg-emerald-500/40',
    error: 'bg-red-500/40',
    info: 'bg-teal-500/40',
    warning: 'bg-amber-500/40',
};

export function ToastContainer() {
    const [localToasts, setLocalToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (newToasts: Toast[]) => setLocalToasts(newToasts);
        toastListeners.push(listener);
        return () => {
            toastListeners = toastListeners.filter((l) => l !== listener);
        };
    }, []);

    const handleDismiss = useCallback((id: string) => {
        dismissToast(id);
    }, []);

    if (localToasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {localToasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg shadow-black/20 backdrop-blur-md',
                        toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right',
                        backgrounds[toast.type]
                    )}
                >
                    {icons[toast.type]}
                    <p className="text-sm font-medium text-slate-100 flex-1">
                        {toast.message}
                    </p>
                    <button
                        onClick={() => handleDismiss(toast.id)}
                        className="ml-1 p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-white/5 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
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
