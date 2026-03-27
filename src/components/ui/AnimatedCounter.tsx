'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionValue, useSpring, useInView } from 'framer-motion';

interface AnimatedCounterProps {
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    className?: string;
}

export function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    className,
}: AnimatedCounterProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const spring = useSpring(motionValue, { stiffness: 50, damping: 20 });
    const [display, setDisplay] = useState(`${prefix}${(0).toFixed(decimals)}${suffix}`);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
        if (isInView) {
            motionValue.set(value);
        }
    }, [isInView, motionValue, value]);

    useEffect(() => {
        return spring.on('change', (v) => {
            setDisplay(`${prefix}${v.toFixed(decimals)}${suffix}`);
        });
    }, [spring, prefix, suffix, decimals]);

    return (
        <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {display}
        </span>
    );
}
