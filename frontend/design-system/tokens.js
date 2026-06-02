// Design System Tokens - Enterprise Scale
// Color Palette - Extended with semantic colors

export const BRAND = {
    // Primary Brand Colors
    indigo: '#180126',      // Primary Dark
    benifexPurple: '#7637E3', // Primary Light/Highlight
    benifexGreen: '#00BD00',  // Success/Action
    oregon: '#082F24',      // Dark Green

    // Accent Colors ('Pops')
    lime: '#B8FF00',        // Pop 1
    violet: '#BD65FF',      // Pop 2

    // Neutrals / Backgrounds
    white: '#FFFFFF',
    oat: '#F7F3ED',         // Primary Background Alt
    taupe: '#E8E1D9',       // Secondary Background

    // Semantic Mappings (for backward compatibility & usage)
    primary: '#180126',     // Indigo
    primaryLight: '#7637E3', // Benifex Purple
    primaryDark: '#0D0113', // Deepest Indigo/Black

    success: '#00BD00',     // Benifex Green
    successLight: '#dcfce7',
    successDark: '#082F24', // Oregon

    // Re-mapped accents
    oregonDark: '#082F24',  // Oregon
    oregonLight: '#00BD00', // Benifex Green

    // Standard UI Colors
    danger: '#ef4444',
    dangerLight: '#fee2e2',
    dangerDark: '#dc2626',

    warning: '#f59e0b',
    warningLight: '#fef3c7',
    warningDark: '#d97706',

    info: '#3b82f6',
    infoLight: '#dbeafe',
    infoDark: '#2563eb',

    neutral: '#64748b',
    neutralLight: '#f1f5f9',

    // Complementary Off-Brand Colors (approved for specific use cases)
    // Crimson - Pipeline Status
    crimson: '#DC2626',
    crimsonLight: '#F87171',
    crimsonDark: '#B91C1C',

    // Finance Blue - Forecasts
    financeBlue: '#3B82F6',
    financeBlueLight: '#60A5FA',
    financeBlueDark: '#1E40AF',

    // Utility
    cyan: '#00D9FF',
    amber: '#F59E0B',

    // UI Backgrounds
    bg: '#ffffff',
    bgAlt: '#F7F3ED',       // Oat
    bgAccent: '#E8E1D9',    // Taupe
    border: '#E0D8CC',      // Warm border to match Oat
    borderLight: '#F0EBE3'
};

export const TOKENS = {
    spacing: {
        xs: '0.25rem',   // 4px
        sm: '0.5rem',    // 8px
        md: '0.75rem',   // 12px
        lg: '1rem',      // 16px
        xl: '1.5rem',    // 24px
        xxl: '2rem',     // 32px
        xxxl: '3rem'     // 48px
    },
    borderRadius: {
        sm: '0.625rem',  // 10px - Brand guideline for small
        md: '0.75rem',   // 12px
        lg: '1.25rem',   // 20px - Brand guideline for large
        xl: '1.5rem',    // 24px
        xxl: '2rem',     // 32px
        full: '9999px'
    },
    fontSize: {
        xs: '0.625rem',  // 10px
        sm: '0.6875rem', // 11px
        md: '0.75rem',   // 12px
        lg: '0.875rem',  // 14px
        xl: '1rem',      // 16px
        xxl: '1.25rem',  // 20px
        xxxl: '1.5rem'   // 24px
    },
    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800
    },
    shadows: {
        sm: '0 1px 2px rgba(24, 1, 38, 0.05)',
        md: '0 4px 6px rgba(24, 1, 38, 0.07)',
        lg: '0 10px 15px rgba(24, 1, 38, 0.1)',
        xl: '0 20px 25px rgba(24, 1, 38, 0.12)',
        glow: '0 0 20px rgba(189, 101, 255, 0.3)',      // Violet glow
        glowLime: '0 0 20px rgba(184, 255, 0, 0.3)'     // Lime glow
    },
    gradients: {
        primary: `linear-gradient(135deg, ${BRAND.indigo} 0%, ${BRAND.benifexPurple} 100%)`,
        violet: `linear-gradient(135deg, ${BRAND.benifexPurple} 0%, ${BRAND.violet} 100%)`,
        green: `linear-gradient(135deg, ${BRAND.oregon} 0%, ${BRAND.benifexGreen} 100%)`,
        lime: `linear-gradient(135deg, ${BRAND.benifexGreen} 0%, ${BRAND.lime} 100%)`
    }
};
