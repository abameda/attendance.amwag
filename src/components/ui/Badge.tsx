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
    default: 'border-[rgba(66,42,50,0.12)] bg-[rgba(255,255,255,0.72)] text-[#54484d]',
    present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    late: 'border-amber-200 bg-amber-50 text-amber-700',
    absent: 'border-rose-200 bg-rose-50 text-rose-700',
    missing_checkout: 'border-orange-200 bg-orange-50 text-orange-700',
    pending: 'animate-pulse border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em]',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </span>
    );
}
