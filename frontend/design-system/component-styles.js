import { BRAND } from './tokens';

// Component Styles - Enterprise Patterns
// Inline-style objects only (NOT Tailwind class strings) — Tailwind JIT does not run
// inside the Airtable iframe, so these are spread directly into a React `style` prop.
// Consumers: ui/Button.jsx, ui/Input.jsx, ui/Badge.jsx.
export const COMPONENT_STYLES = {
    badge: {
        base: {
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '10px', fontSize: '10px',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em',
            border: '1px solid transparent', transition: 'all 0.2s',
        },
        status: { backgroundColor: '#ffffff', borderColor: BRAND.border, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
        squad: { background: 'linear-gradient(to right, #f0fdf4, #f0fdf4)', color: BRAND.indigo, borderColor: '#bbf7d0' },
        wave: { backgroundColor: BRAND.oat, color: BRAND.neutral, borderColor: BRAND.border },
        complete: {
            high: { background: 'linear-gradient(to right, #16a34a, #059669)', color: '#ffffff', borderColor: '#15803d', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' },
            medium: { background: 'linear-gradient(to right, #FE9922, #f97316)', color: '#ffffff', borderColor: '#d97706', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' },
            low: { background: 'linear-gradient(to right, #94a3b8, #64748b)', color: '#ffffff', borderColor: '#64748b', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' },
        },
        profile: {
            front: { background: 'linear-gradient(to right, #fff7ed, #fef2f2)', color: '#c2410c', borderColor: '#fed7aa' },
            back: { background: 'linear-gradient(to right, #eff6ff, #ecfeff)', color: '#1d4ed8', borderColor: '#bfdbfe' },
            even: { backgroundColor: BRAND.oat, color: BRAND.neutral, borderColor: BRAND.border },
        },
    },
    button: {
        base: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', borderRadius: '10px', fontWeight: 700,
            transition: 'all 0.2s', border: 'none', cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        },
        sizes: {
            sm: { padding: '4px 8px', fontSize: '12px' },
            md: { padding: '8px 12px', fontSize: '12px' },
            lg: { padding: '10px 16px', fontSize: '14px' },
        },
        primary: { background: `linear-gradient(to right, ${BRAND.indigo}, ${BRAND.benifexPurple})`, color: '#ffffff' },
        secondary: { backgroundColor: '#ffffff', border: `2px solid ${BRAND.border}`, color: BRAND.indigo },
        ghost: { backgroundColor: 'transparent', color: BRAND.neutral },
        danger: { background: `linear-gradient(to right, ${BRAND.danger}, ${BRAND.dangerDark})`, color: '#ffffff' },
        success: { backgroundColor: BRAND.benifexGreen, color: BRAND.oregon },
        // BRAND.limeDark did not exist — use the green→lime gradient from tokens.
        lime: { background: `linear-gradient(to right, ${BRAND.benifexGreen}, ${BRAND.lime})`, color: BRAND.indigo, fontWeight: 800 },
        disabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' },
    },
    input: {
        base: { padding: '10px 12px', fontSize: '14px', fontWeight: 500, border: '2px solid', borderRadius: '10px', outline: 'none', transition: 'all 0.2s' },
        default: { borderColor: BRAND.border, backgroundColor: '#ffffff' },
        error: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
    },
    card: {
        base: { backgroundColor: '#ffffff', borderRadius: '20px', border: `1px solid ${BRAND.borderLight}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' },
        elevated: { backgroundColor: '#ffffff', borderRadius: '20px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', border: `1px solid ${BRAND.borderLight}` },
        gradient: { background: `linear-gradient(to bottom right, #ffffff, ${BRAND.oat})`, borderRadius: '20px', border: `1px solid ${BRAND.borderLight}`, boxShadow: '0 4px 6px rgba(0,0,0,0.07)' },
    },
};

// Inline style objects for React components (not Tailwind classes)
export const INLINE_STYLES = {
    // Pill group container (view toggle, cell display, etc.)
    pillGroup: {
        display: 'flex',
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        borderRadius: '10px',
        padding: '3px',
        border: '1px solid rgba(226, 232, 240, 0.6)',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
    },

    // Pill button (active state)
    pillButtonActive: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '6px 12px',
        fontSize: '11px',
        fontWeight: '600',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: 'white',
        color: '#082F24',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        letterSpacing: '-0.01em'
    },

    // Pill button (inactive state)
    pillButtonInactive: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '6px 12px',
        fontSize: '11px',
        fontWeight: '500',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        color: '#64748b',
        boxShadow: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        letterSpacing: '-0.01em'
    },

    // Icon button (32x32 action buttons)
    iconButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        color: '#64748b',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease'
    },

    // Icon button active state
    iconButtonActive: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: '1px solid #082F24',
        backgroundColor: '#f0fdf4',
        color: '#082F24',
        cursor: 'pointer',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease'
    },

    // Dropdown button
    dropdownButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        fontSize: '11px',
        fontWeight: '500',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        borderRadius: '8px',
        backgroundColor: 'white',
        color: '#475569',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        transition: 'all 0.15s ease'
    },

    // Dropdown menu
    dropdownMenu: {
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
        minWidth: '140px',
        overflow: 'hidden'
    }
};

// Helper function to get pill button style based on active state
export const getPillButtonStyle = (isActive) =>
    isActive ? INLINE_STYLES.pillButtonActive : INLINE_STYLES.pillButtonInactive;

// Helper function to get icon button style based on active state  
export const getIconButtonStyle = (isActive) =>
    isActive ? INLINE_STYLES.iconButtonActive : INLINE_STYLES.iconButton;
