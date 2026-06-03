// Design System Tokens - Enterprise Scale
// Color Palette - Extended with semantic colors

export const BRAND = {
    // ── 2026 Rebrand ───────────────────────────────────────────────────────
    // Green-led palette. Usage proportions (per brand guide):
    //   Dark Green / Cream / White ~22% each · Green ~12% · Black ~6%
    //   Light Green ~4% · Orange/Yellow/Dark Blue/Light Blue/Red/Pink ~2% each
    // The former purple/indigo brand colours now resolve to Dark Green so the
    // many legacy key names (indigo, benifexPurple, oregon…) stay valid while
    // pointing at the new palette. Prefer the explicit names below in new code.

    // Primary Brand Colors
    indigo: '#082F24',        // (legacy name) → Dark Green, primary dark surface
    benifexPurple: '#082F24', // (legacy name) → Dark Green, primary interactive
    benifexGreen: '#00BD00',  // Green — success / action
    oregon: '#082F24',        // Dark Green

    // Accent Colors ('Pops')
    lime: '#8DF01F',          // Light Green — pop 1
    violet: '#FF8EFB',        // Pink — pop 2

    // Neutrals / Backgrounds
    white: '#FFFFFF',
    oat: '#F5EDE1',           // Cream — primary background alt
    taupe: '#E8E1D9',         // Secondary background

    // Semantic Mappings (for backward compatibility & usage)
    primary: '#082F24',       // Dark Green
    primaryLight: '#082F24',  // Dark Green (legacy "light" key)
    primaryDark: '#061f18',   // Deepest green / near-black

    success: '#00BD00',       // Green
    successLight: '#dcfce7',
    successDark: '#082F24',   // Dark Green

    // Re-mapped accents
    oregonDark: '#082F24',    // Dark Green
    oregonLight: '#00BD00',   // Green

    // Standard UI Colors
    danger: '#E5554F',
    dangerLight: '#fee2e2',
    dangerDark: '#dc2626',

    warning: '#FE9922',
    warningLight: '#fef3c7',
    warningDark: '#d97706',

    info: '#4794FF',
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
    financeBlue: '#4794FF',
    financeBlueLight: '#60A5FA',
    financeBlueDark: '#1E40AF',

    // Utility
    cyan: '#00D9FF',
    amber: '#FE9922',

    // UI Backgrounds
    bg: '#ffffff',
    bgAlt: '#F5EDE1',       // Oat
    bgAccent: '#E8E1D9',    // Taupe
    border: '#E0D8CC',      // Warm border to match Oat
    borderLight: '#F0EBE3',

    // ── Explicit 2026 palette (prefer these names in new code) ──────────────
    darkGreen: '#082F24',   // Primary dark / interactive (~22%)
    green: '#00BD00',       // Action / success (~12%)
    lightGreen: '#8DF01F',  // Accent pop (~4%)
    cream: '#F5EDE1',       // Background (~22%)
    black: '#0A0A0A',       // Text (~6%)
    orange: '#FE9922',      // Accent (~2%)
    yellow: '#FFD23F',      // Accent (~2%)
    darkBlue: '#4794FF',    // Accent (~2%)
    lightBlue: '#68E4FF',   // Accent (~2%)
    red: '#E5554F',         // Accent / danger (~2%)
    pink: '#FF8EFB'         // Accent (~2%)
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
        sm: '0 1px 2px rgba(8, 47, 36, 0.05)',
        md: '0 4px 6px rgba(8, 47, 36, 0.07)',
        lg: '0 10px 15px rgba(8, 47, 36, 0.1)',
        xl: '0 20px 25px rgba(8, 47, 36, 0.12)',
        glow: '0 0 20px rgba(255, 142, 251, 0.3)',      // Pink glow
        glowLime: '0 0 20px rgba(141, 240, 31, 0.3)'     // Light-green glow
    },
    gradients: {
        primary: `linear-gradient(135deg, ${BRAND.indigo} 0%, ${BRAND.benifexPurple} 100%)`,
        violet: `linear-gradient(135deg, ${BRAND.benifexPurple} 0%, ${BRAND.violet} 100%)`,
        green: `linear-gradient(135deg, ${BRAND.oregon} 0%, ${BRAND.benifexGreen} 100%)`,
        lime: `linear-gradient(135deg, ${BRAND.benifexGreen} 0%, ${BRAND.lime} 100%)`
    }
};
