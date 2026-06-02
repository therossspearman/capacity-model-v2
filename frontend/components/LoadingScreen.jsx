import React, { useEffect, useState, useMemo } from 'react';
import { BRAND } from '../design-system/tokens';
import { useTheme } from '../design-system';

// ═══════════════════════════════════════════════════════════════════
// BENIFEX PULSE — Cinematic Loading Experience v2
// Mega "B" mark w/ glow corona, orbiting particles, pulse rings,
// staggered text reveal, gradient shimmer progress
// ═══════════════════════════════════════════════════════════════════


const LoadingScreen = ({ message = "Initializing..." }) => {
    const { isDark, colors } = useTheme();
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState(0); // 0→logo, 1→text, 2→progress
    const [messageIndex, setMessageIndex] = useState(0);

    const messages = useMemo(() => [
        "Initializing capacity engine...",
        "Loading project data...",
        "Calculating resource allocations...",
        "Building visualization...",
        "Almost ready..."
    ], []);

    useEffect(() => {
        const t1 = setTimeout(() => setPhase(1), 400);
        const t2 = setTimeout(() => setPhase(2), 900);
        const msgInterval = setInterval(() => setMessageIndex(i => (i + 1) % 5), 2200);
        const progressInterval = setInterval(() => {
            setProgress(p => {
                if (p >= 96) return p;
                return Math.min(96, p + (p < 30 ? 4 + Math.random() * 6 : p < 70 ? 2 + Math.random() * 3 : 0.5 + Math.random()));
            });
        }, 300);
        return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(msgInterval); clearInterval(progressInterval); };
    }, []);

    const currentMessage = message !== "Initializing..." ? message : messages[messageIndex];

    // Particles
    const particles = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360;
            const ring = i % 3; // 3 concentric rings
            return {
                angle,
                radius: 100 + ring * 30,
                size: 1.5 + (i % 4),
                speed: 15 + ring * 8 + (i % 5) * 2,
                delay: i * 0.15,
                color: ring === 0 ? BRAND.benifexGreen : ring === 1 ? BRAND.benifexPurple : 'rgba(255,255,255,0.7)',
                reverse: ring === 1,
            };
        })
        , []);

    const P = BRAND.benifexPurple;
    const G = BRAND.benifexGreen;

    const keyframes = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinR { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes fadeSlideUp { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes ringPulse {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes logoFloat {
            0%,100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-6px) scale(1.02); }
        }
        @keyframes glowPulse {
            0%,100% { box-shadow: 0 0 40px ${G}30, 0 0 80px ${P}15, inset 0 0 30px ${G}10; }
            50% { box-shadow: 0 0 60px ${G}50, 0 0 120px ${P}25, inset 0 0 50px ${G}20; }
        }
        @keyframes coronaPulse {
            0%,100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.08); }
        }
        @keyframes particleGlow {
            0%,100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.8); }
        }
        @keyframes dotOrbit {
            from { transform: rotate(var(--start-angle)); }
            to { transform: rotate(calc(var(--start-angle) + 360deg)); }
        }
        @keyframes textGlow {
            0%,100% { text-shadow: 0 0 0px transparent; }
            50% { text-shadow: 0 0 24px ${G}25; }
        }
    `;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: isDark
                ? `radial-gradient(ellipse at 50% 40%, #1a0830 0%, #0c0118 50%, #060010 100%)`
                : `radial-gradient(ellipse at 50% 40%, #f5f0ff 0%, #ede4f9 45%, ${colors.bg} 100%)`,
            zIndex: 9999, overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            <style>{keyframes}</style>

            {/* ── Ambient Grid (subtle depth) ── */}
            <div style={{
                position: 'absolute', inset: 0, opacity: isDark ? 0.03 : 0.015,
                backgroundImage: `linear-gradient(${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'} 1px, transparent 1px),
                                  linear-gradient(90deg, ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'} 1px, transparent 1px)`,
                backgroundSize: '50px 50px',
            }} />

            {/* ── Orbiting Particles — 3 rings ── */}
            {particles.map((p, i) => (
                <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: '0', height: '0',
                    animation: `${p.reverse ? 'spinR' : 'spin'} ${p.speed}s linear infinite`,
                    animationDelay: `${-p.delay}s`,
                }}>
                    <div style={{
                        position: 'absolute',
                        width: `${p.size}px`, height: `${p.size}px`,
                        borderRadius: '50%',
                        background: p.color,
                        boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
                        top: `${-Math.sin(p.angle * Math.PI / 180) * p.radius}px`,
                        left: `${Math.cos(p.angle * Math.PI / 180) * p.radius}px`,
                        animation: `particleGlow ${2 + (i % 3)}s ease-in-out infinite ${i * 0.2}s`,
                    }} />
                </div>
            ))}

            {/* ── Orbital Ring Lines ── */}
            {[220, 280, 340].map((size, i) => (
                <div key={`ring-${i}`} style={{
                    position: 'absolute',
                    width: `${size}px`, height: `${size}px`,
                    borderRadius: '50%',
                    border: `1px solid ${isDark ? `rgba(255,255,255,${0.06 - i * 0.015})` : `rgba(118,55,227,${0.06 - i * 0.015})`}`,
                    animation: `${i === 1 ? 'spinR' : 'spin'} ${25 + i * 12}s linear infinite`,
                }} />
            ))}

            {/* ── Expanding Pulse Rings ── */}
            {[0, 1.2, 2.4].map((delay, i) => (
                <div key={`pulse-${i}`} style={{
                    position: 'absolute',
                    width: '120px', height: '120px',
                    borderRadius: '50%',
                    border: `1.5px solid ${i % 2 === 0 ? G : P}`,
                    opacity: 0,
                    animation: `ringPulse 3.5s ease-out infinite ${delay}s`,
                }} />
            ))}

            {/* ── MEGA LOGO ── */}
            <div style={{
                position: 'relative',
                width: '120px', height: '120px',
                marginBottom: '36px',
                animation: 'logoFloat 4s ease-in-out infinite',
            }}>
                {/* Corona glow */}
                <div style={{
                    position: 'absolute', inset: '-40px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${G}18 0%, ${P}08 40%, transparent 70%)`,
                    animation: 'coronaPulse 3s ease-in-out infinite',
                }} />

                {/* Glass container */}
                <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    background: isDark
                        ? `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.3) 100%)`
                        : `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, rgba(240,235,250,0.6) 100%)`,
                    backdropFilter: 'blur(10px)',
                    animation: 'glowPulse 3s ease-in-out infinite',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(118,55,227,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {/* Pure CSS "B" lettermark — no external assets */}
                    <span style={{
                        fontSize: '56px',
                        fontWeight: 900,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        color: G,
                        lineHeight: 1,
                        filter: isDark
                            ? `drop-shadow(0 0 14px ${G}60)`
                            : `drop-shadow(0 0 8px ${G}30)`,
                    }}>B</span>
                </div>

                {/* Rotating highlight arc */}
                <svg style={{ position: 'absolute', inset: '-4px', animation: 'spin 6s linear infinite' }}
                    viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="62" fill="none"
                        stroke={`url(#arcGrad)`} strokeWidth="1.5"
                        strokeDasharray="60 330" strokeLinecap="round" />
                    <defs>
                        <linearGradient id="arcGrad">
                            <stop offset="0%" stopColor={G} stopOpacity="0.8" />
                            <stop offset="100%" stopColor={G} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* ── Typography ── */}
            <div style={{
                textAlign: 'center',
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                <h1 style={{
                    color: isDark ? '#ffffff' : BRAND.indigo,
                    fontSize: '30px', fontWeight: 800,
                    letterSpacing: '-0.8px', marginBottom: '6px',
                    animation: 'textGlow 4s ease-in-out infinite',
                }}>
                    Benifex Capacity
                </h1>
                <p style={{
                    color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(24,1,38,0.4)',
                    fontSize: '13px', fontWeight: 500,
                    letterSpacing: '0.3px',
                    minHeight: '18px',
                    transition: 'opacity 0.3s ease',
                }}>
                    {currentMessage}
                </p>
            </div>

            {/* ── Progress Bar ── */}
            <div style={{
                width: '200px', marginTop: '28px',
                opacity: phase >= 2 ? 1 : 0,
                transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)',
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                <div style={{
                    width: '100%', height: '2.5px', borderRadius: '4px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(118,55,227,0.06)',
                    overflow: 'hidden', position: 'relative',
                }}>
                    <div style={{
                        height: '100%', width: `${progress}%`, borderRadius: '4px',
                        background: `linear-gradient(90deg, ${P}, ${G})`,
                        transition: 'width 0.3s ease-out',
                        position: 'relative',
                    }}>
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s ease-in-out infinite',
                        }} />
                    </div>
                </div>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: '8px', fontSize: '10px', fontWeight: 600,
                    color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(24,1,38,0.2)',
                    letterSpacing: '0.5px',
                }}>
                    <span>{Math.round(progress)}%</span>
                    <span style={{ fontWeight: 400, letterSpacing: '2px', textTransform: 'uppercase', fontSize: '9px' }}>
                        v3.9.9
                    </span>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
