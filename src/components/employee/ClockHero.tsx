'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { CheckCircle, LogIn, LogOut } from 'lucide-react';

type ShiftStatus = 'idle' | 'on_shift' | 'complete';

interface ClockHeroProps {
    currentTime: Date;
    shiftStatus: ShiftStatus;
    shiftProgress: number;
    onCheckIn: () => void;
    onCheckOut: () => void;
    isLoading: boolean;
    t: (key: string) => string;
}

const SIZE = 320;
const RADIUS = 140;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Particle burst on success
function ParticleBurst({ active }: { active: boolean }) {
    const particles = Array.from({ length: 6 });
    return (
        <AnimatePresence>
            {active && (
                <>
                    {particles.map((_, i) => {
                        const angle = (i / particles.length) * 2 * Math.PI;
                        const x = Math.cos(angle) * 60;
                        const y = Math.sin(angle) * 60;
                        return (
                            <motion.div
                                key={i}
                                className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--success)]"
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                animate={{ x, y, opacity: 0, scale: 0.3 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        );
                    })}
                </>
            )}
        </AnimatePresence>
    );
}

export function ClockHero({
    currentTime,
    shiftStatus,
    shiftProgress,
    onCheckIn,
    onCheckOut,
    isLoading,
    t,
}: ClockHeroProps) {
    const [showBurst, setShowBurst] = useState(false);
    const [timeAnnouncement, setTimeAnnouncement] = useState('');
    const prevStatus = useRef<ShiftStatus>(shiftStatus);
    const prevMinute = useRef<number>(-1);

    // Announce time to screen readers once per minute
    useEffect(() => {
        const currentMinute = currentTime.getMinutes();
        if (currentMinute !== prevMinute.current) {
            prevMinute.current = currentMinute;
            const announcement = `Current time: ${currentTime.getHours().toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            const t = setTimeout(() => setTimeAnnouncement(announcement), 0);
            return () => clearTimeout(t);
        }
    }, [currentTime]);

    // Trigger burst when transitioning to complete
    useEffect(() => {
        if (prevStatus.current !== 'complete' && shiftStatus === 'complete') {
            const onTimer = setTimeout(() => setShowBurst(true), 0);
            const offTimer = setTimeout(() => setShowBurst(false), 700);
            prevStatus.current = shiftStatus;
            return () => {
                clearTimeout(onTimer);
                clearTimeout(offTimer);
            };
        }
        prevStatus.current = shiftStatus;
    }, [shiftStatus]);

    // Animated progress ring
    const rawProgress = useSpring(shiftProgress, { stiffness: 40, damping: 20 });
    const dashOffset = useTransform(rawProgress, (v) => CIRCUMFERENCE * (1 - v));

    // Time parts
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getSeconds().toString().padStart(2, '0');

    const gradientId = 'progress-gradient';
    const statusRingId = 'status-gradient';

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Screen reader time announcement (throttled to 1/min) */}
            <span aria-live="polite" aria-atomic="true" className="sr-only">{timeAnnouncement}</span>

            {/* Clock Circle */}
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
                <svg
                    width={SIZE}
                    height={SIZE}
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="absolute inset-0"
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent)" />
                            <stop offset="100%" stopColor="var(--secondary)" />
                        </linearGradient>
                        <linearGradient id={statusRingId} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.2" />
                        </linearGradient>
                    </defs>

                    {/* Track ring */}
                    <circle
                        cx={CX}
                        cy={CY}
                        r={RADIUS}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3"
                    />

                    {/* Progress ring */}
                    <motion.circle
                        cx={CX}
                        cy={CY}
                        r={RADIUS}
                        fill="none"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        style={{
                            strokeDashoffset: dashOffset,
                            rotate: '-90deg',
                            transformOrigin: `${CX}px ${CY}px`,
                        }}
                    />

                    {/* Inner status ring */}
                    <circle
                        cx={CX}
                        cy={CY}
                        r={RADIUS - 12}
                        fill="none"
                        stroke={
                            shiftStatus === 'idle'
                                ? 'rgba(255,255,255,0.04)'
                                : shiftStatus === 'on_shift'
                                    ? 'var(--success)'
                                    : 'var(--success)'
                        }
                        strokeWidth="1"
                        strokeOpacity={shiftStatus === 'idle' ? 0.4 : 0.25}
                        strokeDasharray={shiftStatus === 'on_shift' ? '6 4' : undefined}
                    />

                    {/* Time display */}
                    <text
                        x={CX}
                        y={CY - 14}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--foreground)"
                        fontSize="52"
                        fontWeight="700"
                        fontFamily="var(--font-display, sans-serif)"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {hours}:{minutes}
                    </text>
                    <motion.text
                        x={CX}
                        y={CY + 32}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--muted)"
                        fontSize="22"
                        fontWeight="600"
                        fontFamily="var(--font-display, sans-serif)"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                        animate={{ opacity: [1, 0.35, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        {seconds}
                    </motion.text>
                </svg>
            </div>

            {/* Action Button */}
            <div className="relative flex flex-col items-center gap-3">
                <ParticleBurst active={showBurst} />

                <AnimatePresence mode="wait">
                    {shiftStatus === 'idle' && (
                        <motion.div
                            key="check-in"
                            className="relative flex flex-col items-center gap-2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            {/* Pulsing glow ring */}
                            <motion.div
                                className="pointer-events-none absolute inset-0 rounded-full bg-[var(--accent)]"
                                style={{ width: 100, height: 100 }}
                                animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0, 0.35] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <motion.button
                                onClick={onCheckIn}
                                disabled={isLoading}
                                className="relative flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-60"
                                whileHover={{ scale: 1.06, boxShadow: '0 0 40px rgba(59,130,246,0.6)' }}
                                whileTap={{ scale: 0.92 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                                <LogIn className="h-8 w-8" />
                            </motion.button>
                            <span className="text-sm font-medium text-[var(--muted-strong)]">
                                {t('checkIn')}
                            </span>
                        </motion.div>
                    )}

                    {shiftStatus === 'on_shift' && (
                        <motion.div
                            key="check-out"
                            className="relative flex flex-col items-center gap-2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            {/* Red pulsing glow */}
                            <motion.div
                                className="pointer-events-none absolute inset-0 rounded-full bg-[var(--danger)]"
                                style={{ width: 100, height: 100 }}
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <motion.button
                                onClick={onCheckOut}
                                disabled={isLoading}
                                className="relative flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-[0_0_30px_rgba(239,68,68,0.35)] disabled:opacity-60"
                                whileHover={{ scale: 1.06, boxShadow: '0 0 40px rgba(239,68,68,0.55)' }}
                                whileTap={{ scale: 0.92 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                                <LogOut className="h-8 w-8" />
                            </motion.button>
                            <span className="text-sm font-medium text-[var(--muted-strong)]">
                                {t('checkOut')}
                            </span>
                        </motion.div>
                    )}

                    {shiftStatus === 'complete' && (
                        <motion.div
                            key="complete"
                            className="flex flex-col items-center gap-2"
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        >
                            <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full border border-[var(--success)]/20 bg-[var(--success-soft)]">
                                <CheckCircle className="h-10 w-10 text-[var(--success)]" />
                            </div>
                            <span className="text-sm font-medium text-[var(--success)]">
                                {t('dayComplete')}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
