'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const baseStyles =
            'focus-ring inline-flex items-center justify-center gap-2 rounded-full border text-sm font-semibold tracking-[0.02em] transition-all duration-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.985]';

        const variants = {
            primary:
                'border-transparent bg-[#171419] text-[#fff9f5] shadow-[0_18px_40px_-22px_rgba(23,20,25,0.8)] hover:-translate-y-0.5 hover:bg-[#281e26] hover:shadow-[0_24px_44px_-20px_rgba(23,20,25,0.72)]',
            secondary:
                'border-[rgba(236,72,153,0.16)] bg-[#fff4f8] text-[#9d174d] shadow-[0_16px_30px_-24px_rgba(157,23,77,0.45)] hover:-translate-y-0.5 hover:bg-[#ffe7f2]',
            outline:
                'border-[rgba(66,42,50,0.12)] bg-[rgba(255,255,255,0.54)] text-[#231c21] shadow-[0_12px_28px_-24px_rgba(72,47,56,0.42)] hover:-translate-y-0.5 hover:border-[rgba(157,23,77,0.18)] hover:bg-[rgba(255,255,255,0.82)]',
            ghost:
                'border-transparent bg-transparent text-[#675d62] hover:bg-[rgba(255,255,255,0.6)] hover:text-[#241d22]',
            danger:
                'border-transparent bg-[#8b1f28] text-white shadow-[0_16px_36px_-22px_rgba(139,31,40,0.72)] hover:-translate-y-0.5 hover:bg-[#a62430]',
        };

        const sizes = {
            sm: 'min-h-10 px-4 py-2 text-sm',
            md: 'min-h-11 px-5 py-2.5 text-sm',
            lg: 'min-h-12 px-6 py-3 text-base',
            xl: 'min-h-14 px-8 py-4 text-lg',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
