import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, useTheme } from '../../design-system';

// Comprehensive tour step definitions covering all major features
const TOUR_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Capacity Model! 👋',
        description: 'This quick tour will show you the key features to plan resources and projects effectively. Takes about 2 minutes.',
        target: null,
        position: 'center'
    },
    {
        id: 'date-nav',
        title: 'Timeline Navigation',
        description: 'Jump to today or set a custom date range. You can also drag the timeline horizontally to scroll through time.',
        target: '[data-tour="date-nav"]',
        position: 'bottom'
    },
    {
        id: 'search',
        title: 'Search & Filter',
        description: 'Type here to instantly find resources by name, role, or squad. Press "/" as a shortcut to focus the search bar.',
        target: '[data-tour="search"]',
        position: 'bottom'
    },
    {
        id: 'view-toggle',
        title: 'Switch Views',
        description: 'Toggle between People View (who works on what) and Projects View (what projects need resources).',
        target: '[data-tour="view-toggle"]',
        position: 'bottom'
    },
    {
        id: 'slots-view',
        title: 'Slot Planning',
        description: 'Switch to Slots view for granular, day-by-day resource allocation. Use the "Optimize" feature here to auto-resolve conflicts.',
        target: '[data-tour="slots-view"]',
        position: 'bottom'
    },
    {
        id: 'ai-insights',
        title: 'AI Insights 🧠',
        description: 'New! Click to generate intelligent staffing recommendations, detect bottlenecks, and summarize capacity risks for your current plan.',
        target: '[data-tour="ai-insights"]',
        position: 'left'
    },
    {
        id: 'programs',
        title: 'Program Management',
        description: 'Manage high-level programs, assign projects to them, and track budget vs. actuals at the program level.',
        target: '[data-tour="programs-manage"]',
        position: 'left'
    },
    {
        id: 'scenarios',
        title: 'Scenario Planning',
        description: 'Create draft scenarios to model "what-if" changes. A banner will appear to track revenue impact before you commit or discard.',
        target: '[data-tour="scenario-selector"]',
        position: 'bottom'
    },
    {
        id: 'resource-row',
        title: 'Resource Rows',
        description: 'Each row is a team member. Click their name to see their full profile, assignments, and availability details.',
        target: '[data-tour="resource-row"]',
        position: 'right'
    },
    {
        id: 'capacity-cell',
        title: 'Capacity Cells',
        description: 'Each cell shows utilization for that period. Color indicates load: Green = Available, Blue = Busy, Red border = Over-allocated. Click to see project breakdown.',
        target: '[data-tour="capacity-cell"]',
        position: 'left'
    },
    {
        id: 'cell-indicators',
        title: 'Visual Indicators',
        description: 'Gray stripes = Not yet started or left. Yellow stripes = On temporary leave. Yellow underline = In ramp-up period (new joiner).',
        target: '[data-tour="capacity-cell"]',
        position: 'left'
    },
    {
        id: 'unassigned',
        title: 'Unassigned Demand',
        description: 'This row shows projects without team members assigned. Click to see what work needs staffing and make assignments.',
        target: '[data-tour="unassigned"]',
        position: 'top'
    },
    {
        id: 'settings',
        title: 'Settings & Configuration',
        description: 'Configure field mappings, role categories, active squads, and ramp-up profiles. Essential for first-time setup.',
        target: '[data-tour="settings"]',
        position: 'bottom'
    },
    {
        id: 'help',
        title: 'Help & Documentation',
        description: 'Click the question mark for the comprehensive how-to guide. Press "?" anytime to access keyboard shortcuts.',
        target: '[data-tour="help"]',
        position: 'bottom'
    },
    {
        id: 'dark-mode',
        title: 'Dark Mode Support 🌙',
        description: 'Prefer a darker interface? This app automatically follows your Airtable theme. Go to Airtable Settings → Appearance → Dark to switch!',
        target: null,
        position: 'center'
    },
    {
        id: 'complete',
        title: "You're Ready! 🎉",
        description: 'Start exploring! Click any cell to drill into details. Use the help guide for in-depth tutorials. You can restart this tour anytime from the play button in the toolbar.',
        target: null,
        position: 'center'
    }
];

/**
 * First-Time User Guided Tour
 * Using inline styles for Airtable Blocks compatibility (no Tailwind)
 */
export const GuidedTour = ({ onComplete, onSkip }) => {
    const { isDark, colors } = useTheme();
    const [step, setStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const currentStep = TOUR_STEPS[step];
    const isFirst = step === 0;
    const isLast = step === TOUR_STEPS.length - 1;

    // NOTE: each non-center step targets a `[data-tour="..."]` attribute that must
    // exist in the DOM rendered by Dashboard.jsx (and related components). The full
    // set of required attributes is the union of `target` values in TOUR_STEPS above
    // (e.g. date-nav, search, view-toggle, slots-view, ai-insights, programs-manage,
    // scenario-selector, resource-row, capacity-cell, unassigned, settings, help).
    // If one of those attributes is renamed/removed the step silently falls back to a
    // centered tooltip — the dev-mode warning below surfaces that during development.
    useEffect(() => {
        if (!currentStep.target) {
            setTargetRect(null);
            return undefined;
        }

        const el = document.querySelector(currentStep.target);
        if (!el) {
            setTargetRect(null);
            if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.warn(`[GuidedTour] step "${currentStep.id}" target not found: ${currentStep.target}`);
            }
            return undefined;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const measure = () => setTargetRect(el.getBoundingClientRect());
        const timerId = setTimeout(measure, 300);

        // Keep the spotlight/tooltip aligned if the user scrolls or the iframe resizes
        // after the initial measurement (getBoundingClientRect is viewport-relative).
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);

        return () => {
            clearTimeout(timerId);
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [step, currentStep.target, currentStep.id]);

    const handleNext = () => { if (isLast) onComplete(); else setStep(s => s + 1); };
    const handlePrev = () => { if (!isFirst) setStep(s => s - 1); };

    const getTooltipStyle = () => {
        const tooltipWidth = 400;
        const tooltipHeight = 240;

        // Center position for welcome/complete screens
        if (!targetRect || currentStep.position === 'center') {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${tooltipWidth}px`
            };
        }

        const padding = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let pos = currentStep.position;

        // Smart repositioning if tooltip would overflow
        if (pos === 'right' && targetRect.right + tooltipWidth + padding > viewportWidth) pos = 'bottom';
        if (pos === 'left' && targetRect.left - tooltipWidth - padding < 0) pos = 'bottom';
        if (pos === 'top' && targetRect.top - tooltipHeight - padding < 0) pos = 'bottom';
        if (pos === 'bottom' && targetRect.bottom + tooltipHeight + padding > viewportHeight) pos = 'top';

        const centeredLeft = Math.min(
            Math.max(padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
            viewportWidth - tooltipWidth - padding
        );

        const baseStyle = { position: 'fixed', width: `${tooltipWidth}px` };

        switch (pos) {
            case 'bottom':
                return { ...baseStyle, top: `${targetRect.bottom + padding}px`, left: `${centeredLeft}px` };
            case 'top':
                return { ...baseStyle, top: `${targetRect.top - tooltipHeight - padding}px`, left: `${centeredLeft}px` };
            case 'left':
                return { ...baseStyle, top: `${targetRect.top + targetRect.height / 2}px`, left: `${targetRect.left - tooltipWidth - padding}px`, transform: 'translateY(-50%)' };
            case 'right':
                return { ...baseStyle, top: `${targetRect.top + targetRect.height / 2}px`, left: `${targetRect.right + padding}px`, transform: 'translateY(-50%)' };
            default:
                return { ...baseStyle, top: `${targetRect.bottom + padding}px`, left: `${centeredLeft}px` };
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: Z_INDEX.TOUR || 9999
        }}>
            {/* Overlay with spotlight cutout */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                ...(targetRect ? {
                    clipPath: `polygon(0% 0%, 0% 100%, ${targetRect.left - 8}px 100%, ${targetRect.left - 8}px ${targetRect.top - 8}px, ${targetRect.right + 8}px ${targetRect.top - 8}px, ${targetRect.right + 8}px ${targetRect.bottom + 8}px, ${targetRect.left - 8}px ${targetRect.bottom + 8}px, ${targetRect.left - 8}px 100%, 100% 100%, 100% 0%)`
                } : {})
            }} />

            {/* Spotlight ring */}
            {targetRect && (
                <div style={{
                    position: 'absolute',
                    left: targetRect.left - 8,
                    top: targetRect.top - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                    border: '2px solid rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 20px rgba(255,255,255,0.3)'
                }} />
            )}

            {/* Tooltip */}
            <div style={{
                ...getTooltipStyle(),
                backgroundColor: colors.bgModal,
                borderRadius: '16px',
                boxShadow: colors.shadowXl,
                border: `1px solid ${colors.border}`,
                overflow: 'hidden'
            }}>
                {/* Header with gradient */}
                <div style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #7637E3 0%, #7637E3 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>{currentStep.title}</h3>
                        <span style={{
                            fontSize: '11px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            padding: '4px 10px',
                            borderRadius: '999px'
                        }}>
                            {step + 1}/{TOUR_STEPS.length}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                    <p style={{
                        margin: 0,
                        color: colors.textSecondary,
                        fontSize: '14px',
                        lineHeight: '1.6'
                    }}>
                        {currentStep.description}
                    </p>
                </div>

                {/* Footer with navigation */}
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: colors.bgAlt,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: `1px solid ${colors.border}`
                }}>
                    <button
                        onClick={onSkip}
                        style={{
                            fontSize: '12px',
                            color: '#94a3b8',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px'
                        }}
                    >
                        Skip tour
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isFirst && (
                            <button
                                onClick={handlePrev}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#475569',
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            style={{
                                padding: '8px 20px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                background: 'linear-gradient(135deg, #7637E3 0%, #7637E3 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                            }}
                        >
                            {isLast ? 'Get Started!' : 'Next'}
                        </button>
                    </div>
                </div>

                {/* Progress dots */}
                <div style={{
                    position: 'absolute',
                    bottom: '-24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '6px'
                }}>
                    {TOUR_STEPS.map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: i === step ? '8px' : '6px',
                                height: i === step ? '8px' : '6px',
                                borderRadius: '50%',
                                backgroundColor: i === step ? 'white' : i < step ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                                transition: 'all 0.2s'
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export { TOUR_STEPS };
export default GuidedTour;

GuidedTour.propTypes = {
    onComplete: PropTypes.func.isRequired,
    onSkip: PropTypes.func.isRequired
};
