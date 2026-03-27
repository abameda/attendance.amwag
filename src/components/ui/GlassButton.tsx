'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const glassButtonVariants = cva(
    'relative isolate all-unset cursor-pointer rounded-full transition-all',
    {
        variants: {
            size: {
                default: 'text-base font-medium',
                sm: 'text-sm font-medium',
                lg: 'text-lg font-medium',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

const glassButtonTextVariants = cva(
    'glass-button-text relative block select-none tracking-tighter',
    {
        variants: {
            size: {
                default: 'px-6 py-3.5',
                sm: 'px-4 py-2',
                lg: 'px-8 py-4',
                icon: 'flex h-10 w-10 items-center justify-center',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

export interface GlassButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof glassButtonVariants> {
    contentClassName?: string;
    isLoading?: boolean;
    variant?: 'default' | 'accent' | 'secondary' | 'danger' | 'success';
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
    (
        {
            className,
            children,
            size,
            contentClassName,
            isLoading,
            disabled,
            variant = 'default',
            ...props
        },
        ref
    ) => {
        const variantWrapClass = {
            default: 'glass-button-wrap--default',
            accent: 'glass-button-wrap--accent',
            secondary: 'glass-button-wrap--secondary',
            danger: 'glass-button-wrap--danger',
            success: 'glass-button-wrap--success',
        }[variant];

        return (
            <div
                className={cn(
                    'glass-button-wrap cursor-pointer rounded-full',
                    variantWrapClass,
                    className
                )}
            >
                <button
                    className={cn('glass-button', glassButtonVariants({ size }))}
                    ref={ref}
                    disabled={disabled || isLoading}
                    {...props}
                >
                    <span
                        className={cn(
                            glassButtonTextVariants({ size }),
                            contentClassName
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            children
                        )}
                    </span>
                </button>
                <div className="glass-button-shadow rounded-full" />
            </div>
        );
    }
);

GlassButton.displayName = 'GlassButton';

export { GlassButton, glassButtonVariants };
