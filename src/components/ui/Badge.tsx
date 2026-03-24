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
    default: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    present: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    late: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    absent: 'bg-red-500/15 text-red-400 border-red-500/25',
    missing_checkout: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/25 animate-pulse',
    info: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </span>
    );
}
