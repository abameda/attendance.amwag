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
                        className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#7b6670]"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={id}
                    className={cn(
                        'focus-ring w-full cursor-pointer appearance-none rounded-[1.4rem] border border-[rgba(66,42,50,0.1)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-[0.95rem] text-[#221c21] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm',
                        'hover:border-[rgba(66,42,50,0.16)] hover:bg-[rgba(255,255,255,0.88)]',
                        'focus:border-[rgba(157,23,77,0.18)] focus:bg-white',
                        'transition-all duration-200',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error && 'border-red-400 focus:border-red-500',
                        className
                    )}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value} className="bg-white text-[#221c21]">
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';

export { Select };
