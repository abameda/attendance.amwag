'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CursorPosition {
    x: number;
    y: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    opacity: number;
    scale: number;
    vx: number;
    vy: number;
}

export default function CustomCursor() {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const trailCanvasRef = useRef<HTMLCanvasElement>(null);
    const mousePos = useRef<CursorPosition>({ x: -100, y: -100 });
    const ringPos = useRef<CursorPosition>({ x: -100, y: -100 });
    const dotPos = useRef<CursorPosition>({ x: -100, y: -100 });
    const velocity = useRef<CursorPosition>({ x: 0, y: 0 });
    const lastMouse = useRef<CursorPosition>({ x: -100, y: -100 });
    const rafId = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);
    const particleIdCounter = useRef(0);
    const lastParticleTime = useRef(0);

    const [isHovering, setIsHovering] = useState(false);
    const [isClicking, setIsClicking] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [isTextHover, setIsTextHover] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [clickPos, setClickPos] = useState<CursorPosition>({ x: -100, y: -100 });

    // Detect touch devices
    useEffect(() => {
        const checkTouch = () => {
            setIsTouchDevice(
                'ontouchstart' in window ||
                navigator.maxTouchPoints > 0 ||
                window.matchMedia('(pointer: coarse)').matches
            );
        };
        checkTouch();
        window.addEventListener('resize', checkTouch);
        return () => window.removeEventListener('resize', checkTouch);
    }, []);

    // Detect interactive elements
    const checkElement = useCallback((target: EventTarget | null) => {
        if (!target || !(target instanceof HTMLElement)) return;

        const el = target.closest(
            'a, button, [role="button"], input[type="submit"], input[type="reset"], ' +
            'input[type="button"], input[type="checkbox"], input[type="radio"], ' +
            'label[for], select, summary, .cursor-pointer, [onclick], ' +
            'input[type="text"], input[type="email"], input[type="password"], ' +
            'input[type="search"], input[type="tel"], input[type="url"], ' +
            'input[type="number"], input[type="date"], input[type="time"], ' +
            'textarea, [contenteditable="true"], [role="textbox"]'
        );

        if (!el) {
            setIsHovering(false);
            setIsTextHover(false);
            return;
        }

        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type?.toLowerCase();
        const textInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'time'];

        if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true' ||
            el.getAttribute('role') === 'textbox' ||
            (tag === 'input' && textInputTypes.includes(type))) {
            setIsTextHover(true);
            setIsHovering(false);
        } else {
            setIsHovering(true);
            setIsTextHover(false);
        }
    }, []);

    // Mouse move handler
    useEffect(() => {
        if (isTouchDevice) return;

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();

            // Calculate velocity for trail effects
            velocity.current = {
                x: e.clientX - lastMouse.current.x,
                y: e.clientY - lastMouse.current.y
            };
            lastMouse.current = { x: e.clientX, y: e.clientY };

            mousePos.current = { x: e.clientX, y: e.clientY };
            checkElement(e.target);

            // Spawn particles based on velocity
            const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2);
            if (speed > 3 && now - lastParticleTime.current > 30) {
                lastParticleTime.current = now;
                particlesRef.current.push({
                    id: particleIdCounter.current++,
                    x: e.clientX,
                    y: e.clientY,
                    opacity: Math.min(0.6, speed * 0.02),
                    scale: Math.min(1, speed * 0.05),
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                });
                // Limit particles
                if (particlesRef.current.length > 30) {
                    particlesRef.current.shift();
                }
            }
        };

        const handleMouseDown = () => {
            setClickPos({ x: mousePos.current.x, y: mousePos.current.y });
            setIsClicking(true);
        };
        const handleMouseUp = () => setIsClicking(false);
        const handleMouseLeave = () => setIsHidden(true);
        const handleMouseEnter = () => setIsHidden(false);

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [isTouchDevice, checkElement]);

    // Animation loop
    useEffect(() => {
        if (isTouchDevice) return;

        const animate = () => {
            // Smooth follow for dot (fast)
            dotPos.current.x += (mousePos.current.x - dotPos.current.x) * 0.35;
            dotPos.current.y += (mousePos.current.y - dotPos.current.y) * 0.35;

            // Smooth follow for ring (slower, springy)
            ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.15;
            ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.15;

            // Apply transforms
            if (dotRef.current) {
                dotRef.current.style.transform = `translate(${dotPos.current.x}px, ${dotPos.current.y}px) translate(-50%, -50%)`;
            }
            if (ringRef.current) {
                ringRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%)`;
            }
            if (glowRef.current) {
                glowRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%)`;
            }

            // Draw particle trail on canvas
            const canvas = trailCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    particlesRef.current.forEach((p, i) => {
                        p.x += p.vx;
                        p.y += p.vy;
                        p.opacity -= 0.012;
                        p.scale -= 0.008;

                        if (p.opacity <= 0 || p.scale <= 0) {
                            particlesRef.current.splice(i, 1);
                            return;
                        }

                        ctx.save();
                        ctx.globalAlpha = p.opacity;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 2 * p.scale, 0, Math.PI * 2);
                        ctx.fillStyle = '#22d3ee';
                        ctx.shadowColor = '#06b6d4';
                        ctx.shadowBlur = 8;
                        ctx.fill();
                        ctx.restore();
                    });
                }
            }

            rafId.current = requestAnimationFrame(animate);
        };

        rafId.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId.current);
    }, [isTouchDevice]);

    if (isTouchDevice) return null;

    const hiddenStyle = isHidden ? { opacity: 0 } : {};

    return (
        <>
            {/* Particle trail canvas */}
            <canvas
                ref={trailCanvasRef}
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 99997 }}
                aria-hidden="true"
            />

            {/* Ambient spotlight glow */}
            <div
                ref={glowRef}
                className="fixed top-0 left-0 pointer-events-none"
                style={{
                    zIndex: 99998,
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)`,
                    transition: 'opacity 0.3s ease',
                    ...hiddenStyle,
                }}
                aria-hidden="true"
            />

            {/* Outer ring */}
            <div
                ref={ringRef}
                className="fixed top-0 left-0 pointer-events-none"
                style={{
                    zIndex: 99999,
                    width: isTextHover ? 3 : isHovering ? 50 : isClicking ? 26 : 36,
                    height: isTextHover ? 28 : isHovering ? 50 : isClicking ? 26 : 36,
                    borderRadius: isTextHover ? '2px' : '50%',
                    border: isTextHover
                        ? '1.5px solid rgba(34, 211, 238, 0.8)'
                        : `2px solid ${isHovering ? 'rgba(168, 85, 247, 0.6)' : 'rgba(6, 182, 212, 0.5)'}`,
                    background: isHovering
                        ? 'rgba(168, 85, 247, 0.08)'
                        : isTextHover
                            ? 'rgba(6, 182, 212, 0.1)'
                            : 'transparent',
                    boxShadow: isHovering
                        ? '0 0 20px rgba(168, 85, 247, 0.3), inset 0 0 20px rgba(168, 85, 247, 0.05)'
                        : isTextHover
                            ? '0 0 12px rgba(6, 182, 212, 0.3)'
                            : '0 0 15px rgba(6, 182, 212, 0.15), inset 0 0 15px rgba(6, 182, 212, 0.03)',
                    backdropFilter: isHovering ? 'blur(2px)' : 'none',
                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), border 0.3s ease, border-radius 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease, backdrop-filter 0.3s ease',
                    ...hiddenStyle,
                }}
                aria-hidden="true"
            />

            {/* Inner dot */}
            <div
                ref={dotRef}
                className="fixed top-0 left-0 pointer-events-none"
                style={{
                    zIndex: 100000,
                    width: isTextHover ? 2 : isClicking ? 10 : isHovering ? 5 : 6,
                    height: isTextHover ? 20 : isClicking ? 10 : isHovering ? 5 : 6,
                    borderRadius: isTextHover ? '1px' : '50%',
                    background: isHovering
                        ? '#c084fc'
                        : isTextHover
                            ? '#22d3ee'
                            : 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                    boxShadow: isHovering
                        ? '0 0 10px rgba(192, 132, 252, 0.6), 0 0 25px rgba(168, 85, 247, 0.3)'
                        : '0 0 8px rgba(34, 211, 238, 0.6), 0 0 20px rgba(6, 182, 212, 0.3)',
                    transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease, background 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease',
                    ...hiddenStyle,
                }}
                aria-hidden="true"
            />

            {/* Click ripple burst */}
            {isClicking && (
                <div
                    className="fixed pointer-events-none"
                    style={{
                        zIndex: 99998,
                        left: clickPos.x,
                        top: clickPos.y,
                        width: 60,
                        height: 60,
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        animation: 'cursor-ripple 0.6s ease-out forwards',
                    }}
                    aria-hidden="true"
                />
            )}
        </>
    );
}
