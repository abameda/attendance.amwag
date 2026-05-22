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

interface GlassTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}

export function GlassTooltip({ active, payload, label }: GlassTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="admin-glass-tooltip p-3">
            {label && (
                <p className="mb-2 text-xs font-bold uppercase tracking-normal text-[var(--muted)]">
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

export const liquidChartDefaults = {
    axis: {
        tick: { fill: 'var(--muted)', fontSize: 12 },
        axisLine: { stroke: 'rgba(148, 163, 184, 0.22)' },
        tickLine: false as const,
    },
    cartesianGrid: {
        strokeDasharray: '3 3' as const,
        stroke: 'rgba(148, 163, 184, 0.22)',
    },
};

export const DarkTooltip = GlassTooltip;
export const darkChartDefaults = liquidChartDefaults;
