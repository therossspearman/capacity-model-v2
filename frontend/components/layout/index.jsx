import React from 'react';
import { BRAND } from '../../design-system';
import { ICONS } from '../../constants';

// Inline styles only — Tailwind JIT does not run inside the Airtable iframe.
// (`animate-shimmer` is a real injected keyframe class from design-system/animations.js,
// so it is kept as a className.)
const BORDER = BRAND.border;
const BG_ALT = BRAND.bgAlt;
const TEXT = BRAND.indigo;
const PRIMARY = BRAND.primary;
const PRIMARY_LIGHT = BRAND.primaryLight;
const MUTED = '#94a3b8';

const shimmerBlock = {
    backgroundColor: BG_ALT,
    borderRadius: '8px',
};

/**
 * Loading screen with shimmer animation
 */
export const LoadingScreen = () => (
    <div style={{ width: '100%', height: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="animate-shimmer" style={{ ...shimmerBlock, height: '128px' }}></div>
        <div style={{ display: 'flex', gap: '16px' }}>
            <div className="animate-shimmer" style={{ ...shimmerBlock, width: '25%', height: '320px' }}></div>
            <div className="animate-shimmer" style={{ ...shimmerBlock, width: '75%', height: '320px' }}></div>
        </div>
    </div>
);

/**
 * Empty state placeholder
 */
export const EmptyState = ({ message, subtext, icon }) => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '256px',
            textAlign: 'center',
            padding: '32px',
            backgroundColor: BG_ALT,
            borderRadius: '8px',
            border: `1px dashed ${BORDER}`,
        }}
    >
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '9999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: '16px', color: MUTED }}>
            {icon || ICONS.SEARCH}
        </div>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: TEXT, marginBottom: '4px' }}>{message}</h3>
        <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '20rem' }}>{subtext}</p>
    </div>
);

/**
 * Stat card for KPIs
 * `color` is a CSS color string used to tint the icon background.
 */
export const StatCard = ({ label, value, subtext, icon, color, children }) => (
    <div
        style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${BORDER}`,
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
            minWidth: '120px',
            height: '64px',
            flexShrink: 0,
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.025em' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>{value}</span>
                    {subtext && <span style={{ fontSize: '9px', color: MUTED, fontWeight: 500 }}>{subtext}</span>}
                </div>
            </div>
            {children ? (
                <div style={{ opacity: 0.9, marginLeft: '8px', alignSelf: 'center' }}>{children}</div>
            ) : (
                <div
                    style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: color || `${PRIMARY_LIGHT}1A`, // 1A = ~10% alpha
                        marginLeft: '8px',
                    }}
                >
                    {React.isValidElement(icon)
                        ? React.cloneElement(icon, { style: { ...(icon.props.style || {}), width: '16px', height: '16px' } })
                        : icon}
                </div>
            )}
        </div>
    </div>
);

/**
 * Styled date picker wrapper
 */
export const StyledDatePicker = ({ value, onChange, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                border: `1px solid ${BORDER}`,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: TEXT,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s',
                minWidth: '110px',
            }}
        >
            <div style={{ color: MUTED }}>{ICONS.CALENDAR}</div>
            <span style={{ color: !value ? MUTED : TEXT }}>{value || placeholder}</span>
        </div>
        <input
            type="date"
            value={value}
            onChange={onChange}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
        />
    </div>
);
