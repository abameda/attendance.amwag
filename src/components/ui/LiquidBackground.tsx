'use client';

import { motion, useReducedMotion } from 'framer-motion';

const fieldTransition = {
    duration: 36,
    repeat: Infinity,
    ease: 'easeInOut',
} as const;

export default function LiquidBackground() {
    const reducedMotion = useReducedMotion() ?? false;

    const primaryFieldMotion = reducedMotion
        ? {}
        : {
              animate: {
                  opacity: [0.82, 1, 0.88, 0.82],
                  scale: [1, 1.025, 1],
              },
              transition: fieldTransition,
          };

    const secondaryFieldMotion = reducedMotion
        ? {}
        : {
              animate: {
                  opacity: [0.68, 0.82, 0.7, 0.68],
                  scale: [1, 1.018, 1],
              },
              transition: { ...fieldTransition, duration: 42 },
          };

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[linear-gradient(135deg,oklch(9.5%_0.01_250)_0%,oklch(13.5%_0.012_250)_54%,oklch(10.5%_0.012_250)_100%)]"
        >
            <motion.div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgb(37_99_235_/_0.16),transparent_32rem)]"
                {...primaryFieldMotion}
            />
            <motion.div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgb(14_116_144_/_0.12),transparent_30rem)]"
                {...secondaryFieldMotion}
            />
            <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgb(255_255_255_/_0.18)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.18)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,rgb(0_0_0_/_0.48),transparent_74%)]" />
        </div>
    );
}
