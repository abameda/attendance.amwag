'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowingCardProps {
    children: ReactNode;
    className?: string;
    glowColor?: string;
    halo?: boolean;
}

export function GlowingCard({
    children,
    className,
    halo = false,
}: GlowingCardProps) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-[var(--line-strong)] via-[var(--line)] to-[var(--line-strong)]',
                className
            )}
        >
            {halo && (
                <>
                    <motion.div
                        className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-xl"
                        animate={{ x: [-50, 50, 50, -50, -50], y: [-30, -30, 30, 30, -30] }}
                        transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
                    />
                    <motion.div
                        className="pointer-events-none absolute inset-0 rounded-full bg-white/5 blur-2xl"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
                    />
                </>
            )}
            <div className="glowing-card-surface relative">
                {children}
            </div>
        </div>
    );
}
