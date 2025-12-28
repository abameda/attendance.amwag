'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

export function addToast(message: string, type: ToastType = 'info') {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, message, type };
    toasts = [...toasts, newToast];
    toastListeners.forEach((listener) => listener(toasts));

    // Auto remove after 5 seconds
    setTimeout(() => {
        removeToast(id);
    }, 5000);
}

export function removeToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((listener) => listener(toasts));
}

export function ToastContainer() {
    const [localToasts, setLocalToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (newToasts: Toast[]) => setLocalToasts([...newToasts]);
        toastListeners.push(listener);
        return () => {
            toastListeners = toastListeners.filter((l) => l !== listener);
        };
    }, []);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-teal-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    };

    const backgrounds = {
        success: 'bg-emerald-500/10 border-emerald-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        info: 'bg-teal-500/10 border-teal-500/30',
        warning: 'bg-amber-500/10 border-amber-500/30',
    };

    if (localToasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {localToasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-slide-in-right',
                        backgrounds[toast.type]
                    )}
                >
                    {icons[toast.type]}
                    <p className="text-sm font-medium text-slate-100">
                        {toast.message}
                    </p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="ml-2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
