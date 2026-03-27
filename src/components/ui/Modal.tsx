'use client';

import { ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const subscribe = () => () => {};
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
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
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
            <div
                className="fixed inset-0 bg-[rgba(23,20,25,0.35)] backdrop-blur-md"
                onClick={onClose}
            />

            <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
                <div
                    ref={modalRef}
                    className={cn(
                        'premium-card relative w-full overflow-hidden rounded-[2rem] shadow-[0_36px_80px_-32px_rgba(23,20,25,0.55)]',
                        'animate-scale-in',
                        sizes[size]
                    )}
                >
                    <div className="flex items-center justify-between border-b border-[rgba(66,42,50,0.08)] px-4 py-4 sm:px-6">
                        <h2 className="display-serif pr-4 text-xl font-semibold text-[#1f1a1e] sm:text-2xl">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-[#8f7f84] hover:bg-[rgba(36,29,34,0.06)] hover:text-[#241d22]"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="max-h-[min(85dvh,calc(100vh-5rem))] overflow-y-auto p-4 sm:p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
