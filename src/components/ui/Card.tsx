'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: ReactNode;
    className?: string;
    interactive?: boolean;
}

export function Card({ children, className, interactive }: CardProps) {
    return (
        <div
            className={cn(
                'glass rounded-2xl shadow-xl shadow-black/20',
                interactive && 'transition-all duration-300 hover:bg-slate-800/60 hover:shadow-black/40 hover:-translate-y-1 hover:border-cyan-500/30',
                className
            )}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
    return (
        <div
            className={cn(
                'px-6 py-4 border-b border-slate-800/60',
                className
            )}
        >
            {children}
        </div>
    );
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
    return <div className={cn('p-6', className)}>{children}</div>;
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
    return (
        <h3
            className={cn(
                'text-lg font-semibold text-slate-50',
                className
            )}
        >
            {children}
        </h3>
    );
}

interface CardDescriptionProps {
    children: ReactNode;
    className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
    return (
        <p className={cn('text-sm text-slate-400 mt-1', className)}>
            {children}
        </p>
    );
}
