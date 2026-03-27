'use client';

import { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface ChartWrapperProps {
    children: ReactNode;
    height?: number | `${number}%`;
    className?: string;
}

export function ChartWrapper({ children, height = 300 as number, className }: ChartWrapperProps) {
    return (
        <div className={cn('w-full', className)}>
            <ResponsiveContainer width="100%" height={height}>
                {children as React.ReactElement}
            </ResponsiveContainer>
        </div>
    );
}

interface TooltipEntry {
    name: string;
    value: number | string;
    color?: string;
}

interface DarkTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}

export function DarkTooltip({ active, payload, label }: DarkTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 backdrop-blur-2xl shadow-[var(--shadow-md)]">
            {label && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {label}
                </p>
            )}
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color ?? 'var(--accent)' }}
                    />
                    <span className="text-sm text-[var(--foreground-soft)]">{entry.name}:</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{entry.value}</span>
                </div>
            ))}
        </div>
    );
}

export const darkChartDefaults = {
    axis: {
        tick: { fill: 'var(--muted)', fontSize: 12 },
        axisLine: { stroke: 'rgba(255,255,255,0.04)' },
        tickLine: false as const,
    },
    cartesianGrid: {
        strokeDasharray: '3 3' as const,
        stroke: 'rgba(255,255,255,0.04)',
    },
};
