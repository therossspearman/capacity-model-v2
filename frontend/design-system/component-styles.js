import { BRAND } from './tokens';

// Component Styles - Enterprise Patterns
export const COMPONENT_STYLES = {
    badge: {
        base: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[10px] font-bold uppercase tracking-wide border transition-all hover:scale-105',
        status: 'bg-white border shadow-sm',
        squad: `bg-gradient-to-r from-violet-50 to-purple-50 text-[${BRAND.indigo}] border-violet-200 hover:border-violet-300`,
        wave: `bg-[${BRAND.oat}] text-[${BRAND.neutral}] border-[${BRAND.border}]`,
        complete: {
            high: `bg-gradient-to-r from-green-600 to-emerald-600 text-white border-green-700 shadow-md`,
            medium: `bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 shadow-md`,
            low: `bg-gradient-to-r from-slate-400 to-slate-500 text-white border-slate-500 shadow-md`
        },
        profile: {
            front: `bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-200`,
            back: `bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border-blue-200`,
            even: `bg-[${BRAND.oat}] text-[${BRAND.neutral}] border-[${BRAND.border}]`
        }
    },
    button: {
        base: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 shadow-sm hover:shadow-md',
        primary: `bg-gradient-to-r from-[${BRAND.indigo}] to-[${BRAND.benifexPurple}] text-white hover:shadow-lg hover:shadow-violet-500/50 focus-visible:outline-[${BRAND.violet}]`,
        secondary: `bg-white border-2 border-[${BRAND.border}] text-[${BRAND.indigo}] hover:border-[${BRAND.violet}] hover:text-[${BRAND.violet}] hover:shadow-md`,
        ghost: `bg-transparent text-[${BRAND.neutral}] hover:bg-[${BRAND.oat}]`,
        danger: `bg-gradient-to-r from-[${BRAND.danger}] to-[${BRAND.dangerDark}] text-white hover:shadow-lg hover:shadow-red-500/50`,
        success: `bg-[${BRAND.benifexGreen}] text-[${BRAND.oregon}] hover:shadow-lg hover:shadow-green-500/50`,
        lime: `bg-gradient-to-r from-[${BRAND.limeDark}] to-[${BRAND.lime}] text-[${BRAND.indigo}] hover:shadow-lg hover:shadow-lime-500/50 font-extrabold`,
        disabled: 'opacity-50 cursor-not-allowed active:scale-100 shadow-none'
    },
    input: {
        base: 'px-3 py-2.5 text-sm font-medium border-2 rounded-[10px] focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none transition-all',
        default: `border-[${BRAND.border}] bg-white hover:border-[${BRAND.violet}]`,
        error: 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
    },
    card: {
        base: `bg-white rounded-[20px] border border-[${BRAND.borderLight}] shadow-sm hover:shadow-md transition-all duration-200`,
        elevated: `bg-white rounded-[20px] shadow-lg border border-[${BRAND.borderLight}]`,
        gradient: `bg-gradient-to-br from-white to-[${BRAND.oat}] rounded-[20px] border border-[${BRAND.borderLight}] shadow-md`
    }
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
        color: '#7637E3',
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
        border: '1px solid #7637E3',
        backgroundColor: '#eef2ff',
        color: '#7637E3',
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
