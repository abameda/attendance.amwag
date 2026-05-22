'use client';

import { ReactNode } from 'react';
import {
    AlarmClock,
    AlertCircle,
    CheckCircle2,
    Circle,
    Hourglass,
    TimerOff,
    TriangleAlert,
    UserX,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'present' | 'late' | 'absent' | 'missing_checkout' | 'early_leave' | 'overtime' | 'pending' | 'info';

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted-strong)]',
    present: 'border-emerald-300/[0.25] bg-emerald-400/[0.12] text-emerald-200',
    late: 'border-amber-300/[0.28] bg-amber-400/[0.12] text-amber-200',
    absent: 'border-red-300/[0.25] bg-red-400/[0.12] text-red-200',
    missing_checkout: 'border-amber-300/[0.28] bg-amber-400/[0.12] text-amber-200',
    early_leave: 'border-red-300/[0.25] bg-red-400/[0.12] text-red-200',
    overtime: 'border-blue-300/[0.25] bg-blue-400/[0.12] text-blue-200',
    pending: 'border-slate-300/[0.20] bg-slate-300/[0.10] text-slate-200',
    info: 'border-blue-300/[0.25] bg-blue-400/[0.12] text-blue-200',
};

const variantIcons: Record<BadgeVariant, LucideIcon> = {
    default: Circle,
    present: CheckCircle2,
    late: AlarmClock,
    absent: UserX,
    missing_checkout: TriangleAlert,
    early_leave: TimerOff,
    overtime: Hourglass,
    pending: AlertCircle,
    info: AlertCircle,
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    const Icon = variantIcons[variant];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-normal backdrop-blur-md',
                variantStyles[variant],
                className
            )}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {children}
        </span>
    );
}
