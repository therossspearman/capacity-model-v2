/**
 * Theme System - Dark Mode Support
 * 
 * Uses Airtable's useColorScheme hook to automatically adapt
 * to the user's Airtable theme preference (light/dark).
 */
import React, { createContext, useContext, useMemo } from 'react';

// Try to import from blocks/ui (standard SDK), fallback to interface/ui if needed
let useColorScheme;
try {
    const uiModule = require('@airtable/blocks/ui');
    useColorScheme = uiModule.useColorScheme;
} catch (e) {
    try {
        const interfaceModule = require('@airtable/blocks/interface/ui');
        useColorScheme = interfaceModule.useColorScheme;
    } catch (e2) {
        // Fallback - always light mode if hook not available
        useColorScheme = () => ({ colorScheme: 'light' });
    }
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

/**
 * Light Theme Colors (current default)
 */
export const LIGHT = {
    // Backgrounds
    bg: '#ffffff',
    bgAlt: '#F7F3ED',           // Oat
    bgAccent: '#E8E1D9',        // Taupe
    bgHover: '#f8fafc',
    bgCard: '#ffffff',
    bgModal: '#ffffff',
    bgOverlay: 'rgba(15, 23, 42, 0.6)',

    // Text
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    textInverse: '#ffffff',

    // Borders
    border: '#E0D8CC',
    borderLight: '#F0EBE3',
    borderFocus: '#7637E3',

    // Brand Colors (consistent in both modes)
    primary: '#180126',
    primaryLight: '#7637E3',
    primaryDark: '#0D0113',

    // Semantic
    success: '#00BD00',
    successLight: '#dcfce7',
    successBg: '#f0fdf4',

    danger: '#ef4444',
    dangerLight: '#fee2e2',
    dangerBg: '#fef2f2',

    warning: '#f59e0b',
    warningLight: '#fef3c7',
    warningBg: '#fffbeb',

    info: '#3b82f6',
    infoLight: '#dbeafe',
    infoBg: '#eff6ff',

    // Grid/Chart specific
    gridLine: '#e2e8f0',
    capacityLine: '#00BD00',
    todayHighlight: 'rgba(118, 55, 227, 0.08)',

    // Shadows
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    shadowMd: '0 4px 6px rgba(0, 0, 0, 0.07)',
    shadowLg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    shadowXl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

/**
 * Dark Theme Colors
 */
export const DARK = {
    // Backgrounds
    bg: '#0f1117',              // Deeper background for more contrast
    bgAlt: '#1a1d2e',           // Slate dark
    bgAccent: '#252a3d',        // Lighter slate
    bgHover: '#2d3348',
    bgCard: '#1a1d2e',
    bgModal: '#141722',
    bgOverlay: 'rgba(0, 0, 0, 0.75)',

    // Text - IMPROVED CONTRAST
    text: '#e2e8f0',            // Brighter - WCAG AA compliant
    textSecondary: '#94a3b8',   // Better secondary visibility
    textMuted: '#64748b',       // More visible muted
    textInverse: '#0f1117',

    // Borders
    border: '#334155',          // More visible borders
    borderLight: '#1e293b',
    borderFocus: '#a78bfa',     // Brighter focus ring

    // Brand Colors (adjusted for dark mode visibility)
    primary: '#c4b5fd',         // Brighter purple for dark backgrounds
    primaryLight: '#a78bfa',
    primaryDark: '#7637E3',

    // Semantic (IMPROVED VISIBILITY)
    success: '#00BD00',         // Brighter green
    successLight: '#166534',
    successBg: '#14532d',

    danger: '#f87171',          // Brighter red
    dangerLight: '#991b1b',
    dangerBg: '#7f1d1d',

    warning: '#fbbf24',         // Brighter amber
    warningLight: '#92400e',
    warningBg: '#78350f',

    info: '#60a5fa',            // Brighter blue
    infoLight: '#1e3a8a',
    infoBg: '#1e3a5f',

    // Grid/Chart specific - IMPROVED VISIBILITY
    gridLine: '#334155',        // More visible grid
    capacityLine: '#00BD00',    // Brighter capacity line
    todayHighlight: 'rgba(167, 139, 250, 0.2)',

    // Shadows (more subtle in dark mode)
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    shadowMd: '0 4px 6px rgba(0, 0, 0, 0.5)',
    shadowLg: '0 10px 15px rgba(0, 0, 0, 0.6)',
    shadowXl: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
};

// ============================================================================
// THEME CONTEXT
// ============================================================================

const ThemeContext = createContext({
    isDark: false,
    colors: LIGHT,
    colorScheme: 'light'
});

/**
 * ThemeProvider - Wraps the app and provides theme context
 * Automatically syncs with Airtable's color scheme preference
 */
export const ThemeProvider = ({ children }) => {
    // Get Airtable's color scheme preference
    const { colorScheme } = useColorScheme ? useColorScheme() : { colorScheme: 'light' };
    const isDark = colorScheme === 'dark';

    const value = useMemo(() => ({
        isDark,
        colorScheme,
        colors: isDark ? DARK : LIGHT
    }), [isDark, colorScheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * useTheme - Hook to access current theme
 * @returns {{ isDark: boolean, colors: object, colorScheme: 'light' | 'dark' }}
 */
export const useTheme = () => {
    return useContext(ThemeContext);
};

/**
 * Helper: Get theme-aware background style for modal overlays
 */
export const getOverlayStyle = (colors) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgOverlay,
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
});

/**
 * Helper: Get theme-aware modal container style
 */
export const getModalStyle = (colors) => ({
    backgroundColor: colors.bgModal,
    color: colors.text,
    borderRadius: '16px',
    boxShadow: colors.shadowXl,
    border: `1px solid ${colors.border}`
});

/**
 * Helper: Get theme-aware card style
 */
export const getCardStyle = (colors) => ({
    backgroundColor: colors.bgCard,
    color: colors.text,
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    boxShadow: colors.shadowSm
});

export default {
    ThemeProvider,
    useTheme,
    LIGHT,
    DARK,
    getOverlayStyle,
    getModalStyle,
    getCardStyle
};
