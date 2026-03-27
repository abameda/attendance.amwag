'use client';

import { memo, useEffect, useState } from 'react';

interface ElegantShapeProps {
  className: string;
  gradient: string;
  size: string;
  delay: number;
  duration: number;
}

function ElegantShape({ className, gradient, size, delay, duration }: ElegantShapeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`absolute rounded-full ${size} ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(-30px)',
        transition: `opacity 2.4s ease, transform 2.4s ease`,
        animation: isVisible ? `aurora-float ${duration}s ease-in-out infinite` : 'none',
      }}
    >
      <div
        className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} backdrop-blur-[2px] border border-white/[0.08]`}
      />
    </div>
  );
}

function AuroraBackgroundBase() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Floating gradient orbs */}
      <ElegantShape
        className="top-[-8%] left-[-5%]"
        gradient="from-indigo-500/[0.12] to-transparent"
        size="w-[32rem] h-[32rem]"
        delay={0}
        duration={16}
      />
      <ElegantShape
        className="top-[12%] right-[-8%]"
        gradient="from-violet-500/[0.10] to-transparent"
        size="w-[28rem] h-[28rem]"
        delay={0.4}
        duration={18}
      />
      <ElegantShape
        className="bottom-[5%] left-[10%]"
        gradient="from-cyan-500/[0.06] to-transparent"
        size="w-[24rem] h-[24rem]"
        delay={0.8}
        duration={20}
      />
      <ElegantShape
        className="bottom-[-10%] right-[15%]"
        gradient="from-blue-500/[0.08] to-transparent"
        size="w-[30rem] h-[30rem]"
        delay={1.2}
        duration={14}
      />
      <ElegantShape
        className="top-[45%] left-[40%]"
        gradient="from-indigo-400/[0.05] to-transparent"
        size="w-[20rem] h-[20rem]"
        delay={0.6}
        duration={17}
      />

      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#0A0A0F]/80 to-transparent" />

      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0A0A0F] to-transparent" />

      <style jsx>{`
        @keyframes aurora-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(15px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes aurora-float {
            0%, 100% {
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </div>
  );
}

export default memo(AuroraBackgroundBase);
