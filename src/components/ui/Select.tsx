'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, id, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={id}
                        className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={id}
                    className={cn(
                        'w-full cursor-pointer appearance-none rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[0.95rem] text-[var(--foreground)] backdrop-blur-sm',
                        'hover:border-[var(--line-strong)]',
                        'focus:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--shadow-glow-blue)]',
                        'transition-all duration-200',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error && 'border-[var(--danger)] focus-visible:border-[var(--danger)]',
                        className
                    )}
                    {...props}
                >
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="bg-[var(--bg-secondary)] text-[var(--foreground)]"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';

export { Select };
