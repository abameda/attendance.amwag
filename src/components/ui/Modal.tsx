'use client';

import { ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const subscribe = () => () => { };
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Centering wrapper */}
            <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
                {/* Modal */}
                <div
                    ref={modalRef}
                    className={cn(
                        'relative w-full overflow-hidden rounded-2xl glass premium-surface shadow-2xl shadow-black/80',
                        'animate-scale-in',
                        sizes[size]
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
                        <h2 className="pr-4 text-base font-semibold text-slate-50 sm:text-lg">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="max-h-[min(85dvh,calc(100vh-5rem))] overflow-y-auto p-4 sm:p-6">{children}</div>
                </div>
            </div>
        </div>,
        document.body
    );
}
