'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'present' | 'late' | 'absent' | 'missing_checkout' | 'pending' | 'info';

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted-strong)]',
    present: 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]',
    late: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
    absent: 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]',
    missing_checkout: 'border-orange-500/20 bg-[rgba(249,115,22,0.15)] text-orange-400',
    pending: 'border-[var(--secondary)]/20 bg-[var(--secondary-soft)] text-[var(--secondary)]',
    info: 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]',
};

const dotStyles: Record<BadgeVariant, string> = {
    default: 'bg-[var(--muted)]',
    present: 'bg-[var(--success)] shadow-[0_0_6px_var(--success)]',
    late: 'bg-[var(--warning)] shadow-[0_0_6px_var(--warning)]',
    absent: 'bg-[var(--danger)] shadow-[0_0_6px_var(--danger)]',
    missing_checkout: 'bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]',
    pending: 'bg-[var(--secondary)] shadow-[0_0_6px_var(--secondary)] animate-pulse',
    info: 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em]',
                variantStyles[variant],
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[variant])} />
            {children}
        </span>
    );
}
