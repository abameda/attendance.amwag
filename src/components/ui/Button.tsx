'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const baseStyles =
            'inline-flex items-center justify-center gap-2 rounded-full border text-sm font-semibold tracking-[0.02em] transition-all duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]';

        const variants = {
            primary:
                'border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-glow-blue)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-[0_0_28px_rgba(59,130,246,0.35)]',
            secondary:
                'border-[var(--secondary)]/20 bg-[var(--secondary-soft)] text-[#A78BFA] hover:-translate-y-0.5 hover:bg-[rgba(139,92,246,0.22)]',
            outline:
                'border-[var(--line)] bg-transparent text-[var(--foreground-soft)] hover:-translate-y-0.5 hover:bg-[var(--surface)] hover:border-[var(--line-strong)]',
            ghost:
                'border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
            danger:
                'border-transparent bg-[var(--danger)] text-white shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:-translate-y-0.5 hover:bg-[#dc2626] hover:shadow-[0_0_28px_rgba(239,68,68,0.3)]',
            success:
                'border-transparent bg-[var(--success)] text-white shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 hover:bg-[#059669] hover:shadow-[0_0_28px_rgba(16,185,129,0.3)]',
        };

        const sizes = {
            sm: 'min-h-10 px-4 py-2 text-sm',
            md: 'min-h-11 px-5 py-2.5 text-sm',
            lg: 'min-h-12 px-6 py-3 text-base',
            xl: 'min-h-14 px-8 py-4 text-lg',
        };

        const filledVariants = ['primary', 'danger', 'success'];
        const spinnerClass = filledVariants.includes(variant) ? 'text-white' : 'text-[var(--accent)]';

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className={cn('h-4 w-4 animate-spin', spinnerClass)} />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
