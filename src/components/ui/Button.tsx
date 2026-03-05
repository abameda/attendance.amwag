'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const baseStyles =
            'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97]';

        const variants = {
            primary:
                'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 focus-visible:ring-teal-500',
            secondary:
                'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 focus-visible:ring-slate-500',
            outline:
                'border border-slate-700 hover:border-teal-500/50 hover:bg-teal-500/5 bg-transparent text-slate-200 focus-visible:ring-teal-500',
            ghost:
                'bg-transparent hover:bg-slate-800/80 text-slate-300 hover:text-slate-100 focus-visible:ring-slate-500',
            danger:
                'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 focus-visible:ring-red-500',
        };

        const sizes = {
            sm: 'text-sm px-3 py-1.5 gap-1.5',
            md: 'text-sm px-4 py-2.5 gap-2',
            lg: 'text-base px-6 py-3 gap-2',
            xl: 'text-lg px-8 py-4 gap-2.5',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
