'use client';

import type { HTMLMotionProps, Variants } from 'framer-motion';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

function createItemVariants(reducedMotion: boolean, distance: number): Variants {
    if (reducedMotion) {
        return {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        };
    }

    return {
        hidden: { opacity: 0, y: distance },
        visible: { opacity: 1, y: 0 },
    };
}

type PageRevealProps = HTMLMotionProps<'div'> & {
    delay?: number;
    distance?: number;
};

export function PageReveal({
    children,
    delay = 0,
    distance = 22,
    transition,
    ...props
}: PageRevealProps) {
    const reducedMotion = useReducedMotion() ?? false;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={createItemVariants(reducedMotion, distance)}
            transition={{
                duration: reducedMotion ? 0.2 : 0.72,
                delay,
                ease,
                ...transition,
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

type StaggerGroupProps = HTMLMotionProps<'div'> & {
    stagger?: number;
    delayChildren?: number;
};

export function StaggerGroup({
    children,
    stagger = 0.08,
    delayChildren = 0,
    transition,
    viewport,
    ...props
}: StaggerGroupProps) {
    const reducedMotion = useReducedMotion() ?? false;

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewport ?? { once: true, amount: 0.12 }}
            variants={{
                hidden: {},
                visible: {
                    transition: reducedMotion
                        ? { delayChildren }
                        : {
                              staggerChildren: stagger,
                              delayChildren,
                          },
                },
            }}
            transition={transition}
            {...props}
        >
            {children}
        </motion.div>
    );
}

type StaggerItemProps = HTMLMotionProps<'div'> & {
    distance?: number;
};

export function StaggerItem({
    children,
    distance = 22,
    transition,
    ...props
}: StaggerItemProps) {
    const reducedMotion = useReducedMotion() ?? false;

    return (
        <motion.div
            variants={createItemVariants(reducedMotion, distance)}
            transition={{
                duration: reducedMotion ? 0.18 : 0.64,
                ease,
                ...transition,
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export { AnimatePresence, motion };
