'use client';

import { forwardRef, InputHTMLAttributes, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon, type = 'text', id, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const isPassword = type === 'password';
        const resolvedType = isPassword && showPassword ? 'text' : type;

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
                <div className="relative">
                    {icon && (
                        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-[var(--accent)]">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        type={resolvedType}
                        id={id}
                        className={cn(
                            'w-full rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[0.95rem] text-[var(--foreground)] backdrop-blur-sm',
                            'placeholder:text-[var(--muted)]',
                            'hover:border-[var(--line-strong)]',
                            'focus:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--shadow-glow-blue)]',
                            'transition-all duration-200',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            error &&
                                'border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:shadow-[0_0_16px_rgba(239,68,68,0.2)]',
                            icon && 'ps-11',
                            isPassword && 'pe-12',
                            className
                        )}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 end-0 flex items-center pe-4 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-[var(--danger)]">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
