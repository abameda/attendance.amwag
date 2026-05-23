'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-skeleton rounded-[1rem] bg-[var(--skeleton-bg,rgba(255,255,255,0.06))]',
                className
            )}
        />
    );
}
