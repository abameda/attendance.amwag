'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-skeleton rounded-[1rem] bg-[rgba(142,123,131,0.16)]',
                className
            )}
        />
    );
}
