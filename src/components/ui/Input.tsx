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
                        className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#7b6670]"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#9a7a86]">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        type={resolvedType}
                        id={id}
                        className={cn(
                            'focus-ring w-full rounded-[1.4rem] border border-[rgba(66,42,50,0.1)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-[0.95rem] text-[#221c21] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm',
                            'placeholder:text-[#9e9192]',
                            'hover:border-[rgba(66,42,50,0.16)] hover:bg-[rgba(255,255,255,0.88)]',
                            'focus-visible:border-[rgba(157,23,77,0.18)] focus-visible:bg-white',
                            'transition-all duration-200',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            error && 'border-red-400/70 focus-visible:border-red-400/80',
                            icon && 'pl-11',
                            isPassword && 'pr-12',
                            className
                        )}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#9a7a86] transition-colors hover:text-[#5a474f]"
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
                    <p className="mt-1.5 text-sm text-red-600">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
