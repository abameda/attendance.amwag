'use client';

import { CheckCircle2, Loader2, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

type ShiftStatus = 'idle' | 'on_shift' | 'complete';
type ActionKind = 'check-in' | 'check-out' | 'complete';

interface ClockHeroProps {
    currentTime: Date;
    locale: string;
    shiftStatus: ShiftStatus;
    shiftProgress: number;
    actionKind: ActionKind;
    actionLabel: string;
    actionHint: string;
    timeLabel: string;
    progressLabel: string;
    onCheckIn: () => void;
    onCheckOut: () => void;
    isLoading: boolean;
    isDisabled?: boolean;
}

function formatCairoTime(date: Date, locale: string) {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Africa/Cairo',
    }).format(date);
}

export function ClockHero({
    currentTime,
    locale,
    shiftStatus,
    shiftProgress,
    actionKind,
    actionLabel,
    actionHint,
    timeLabel,
    progressLabel,
    onCheckIn,
    onCheckOut,
    isLoading,
    isDisabled = false,
}: ClockHeroProps) {
    const isComplete = actionKind === 'complete';
    const progressPercent = Math.round(Math.min(Math.max(shiftProgress, 0), 1) * 100);
    const numberFormatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US');
    const progressText = `${numberFormatter.format(progressPercent)}%`;
    const actionIcon = actionKind === 'check-out' ? LogOut : LogIn;
    const ActionIcon = actionIcon;

    const handleAction = () => {
        if (isDisabled || isLoading || isComplete) return;
        if (actionKind === 'check-out') {
            onCheckOut();
            return;
        }
        onCheckIn();
    };

    return (
        <section
            aria-labelledby="employee-clock-title"
            className="employee-glass-clock-panel p-5 sm:p-6"
        >
            <div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                        {timeLabel}
                    </p>
                    <h2
                        id="employee-clock-title"
                        className="mt-2 font-mono text-5xl font-semibold leading-none text-[var(--employee-ink-strong)] sm:text-6xl"
                    >
                        {formatCairoTime(currentTime, locale)}
                    </h2>
                </div>
            </div>

            <div className="mt-6">
                <button
                    type="button"
                    onClick={handleAction}
                    disabled={isDisabled || isLoading || isComplete}
                    className={cn(
                        'flex min-h-[4.5rem] w-full items-center justify-center gap-3 px-5 py-4 text-base font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:shadow-[var(--employee-focus-ring)] disabled:cursor-not-allowed',
                        isComplete
                            ? 'rounded-[0.875rem] border border-[var(--employee-success)]/35 bg-[var(--employee-success-soft)] text-[var(--employee-success)]'
                            : 'employee-glass-button-primary disabled:border-[var(--employee-glass-border-muted)] disabled:bg-[var(--employee-disabled)] disabled:text-[var(--employee-muted)] disabled:shadow-none'
                    )}
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : isComplete ? (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                        <ActionIcon className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span>{actionLabel}</span>
                </button>
                <p className="mt-3 text-center text-sm leading-6 text-[var(--employee-muted)]">
                    {actionHint}
                </p>
            </div>

            <div className="mt-6" aria-label={progressLabel}>
                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--employee-muted)]">
                    <span>{progressLabel}</span>
                    <span>{shiftStatus === 'idle' ? `${numberFormatter.format(0)}%` : progressText}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--employee-rule-soft)]">
                    <div
                        className="h-full rounded-full bg-[var(--employee-accent)] transition-[width] duration-200 ease-out"
                        style={{ width: `${shiftStatus === 'idle' ? 0 : progressPercent}%` }}
                    />
                </div>
            </div>
        </section>
    );
}
