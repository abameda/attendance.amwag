'use client';

import { motion, useReducedMotion } from 'framer-motion';

const blobTransition = {
    duration: 22,
    repeat: Infinity,
    ease: 'easeInOut',
} as const;

export default function LiquidBackground() {
    const reducedMotion = useReducedMotion() ?? false;

    const motionProps = reducedMotion
        ? {}
        : {
              animate: {
                  x: [0, 28, -12, 0],
                  y: [0, -18, 20, 0],
                  scale: [1, 1.06, 0.98, 1],
              },
              transition: blobTransition,
          };

    const counterMotionProps = reducedMotion
        ? {}
        : {
              animate: {
                  x: [0, -24, 18, 0],
                  y: [0, 20, -16, 0],
                  scale: [1, 1.04, 1.08, 1],
              },
              transition: { ...blobTransition, duration: 26 },
          };

    const driftMotionProps = reducedMotion
        ? {}
        : {
              animate: {
                  x: [0, 18, -24, 0],
                  y: [0, -14, 22, 0],
                  scale: [1, 0.98, 1.05, 1],
              },
              transition: { ...blobTransition, duration: 30 },
          };

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[linear-gradient(135deg,oklch(97%_0.018_220)_0%,oklch(94%_0.042_210)_32%,oklch(95%_0.034_292)_64%,oklch(96%_0.024_178)_100%)]"
        >
            <motion.div
                className="pointer-events-none absolute -left-32 top-[-12rem] h-[24rem] w-[24rem] rounded-full bg-cyan-300/30 blur-2xl md:h-[34rem] md:w-[34rem] md:blur-3xl"
                {...motionProps}
            />
            <motion.div
                className="pointer-events-none absolute right-[-10rem] top-32 h-[26rem] w-[26rem] rounded-full bg-violet-300/25 blur-2xl md:h-[38rem] md:w-[38rem] md:blur-3xl"
                {...counterMotionProps}
            />
            <motion.div
                className="pointer-events-none absolute bottom-[-14rem] left-1/3 h-[22rem] w-[22rem] rounded-full bg-teal-300/25 blur-2xl md:h-[32rem] md:w-[32rem] md:blur-3xl"
                {...driftMotionProps}
            />
        </div>
    );
}
