/**
 * ToastContainer - Enterprise Toast Notification System
 * Displays stacked toast notifications with animations
 */
import React from 'react';
import { useTheme, Z_INDEX } from '../../design-system';

/**
 * Toast type configurations
 */
const TOAST_CONFIG = {
    success: {
        icon: '✓',
        gradient: 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)',
        bgLight: '#f0fdf4',
        bgDark: '#052e16',
        borderLight: '#86efac',
        borderDark: '#166534',
        textLight: '#166534',
        textDark: '#86efac'
    },
    error: {
        icon: '✕',
        gradient: 'linear-gradient(135deg, #E5554F 0%, #dc2626 100%)',
        bgLight: '#fef2f2',
        bgDark: '#450a0a',
        borderLight: '#fca5a5',
        borderDark: '#991b1b',
        textLight: '#991b1b',
        textDark: '#fca5a5'
    },
    warning: {
        icon: '⚠',
        gradient: 'linear-gradient(135deg, #FE9922 0%, #d97706 100%)',
        bgLight: '#fffbeb',
        bgDark: '#451a03',
        borderLight: '#fcd34d',
        borderDark: '#92400e',
        textLight: '#92400e',
        textDark: '#fcd34d'
    },
    info: {
        icon: 'ℹ',
        gradient: 'linear-gradient(135deg, #4794FF 0%, #2563eb 100%)',
        bgLight: '#eff6ff',
        bgDark: '#1e1b4b',
        borderLight: '#93c5fd',
        borderDark: '#1e40af',
        textLight: '#1e40af',
        textDark: '#93c5fd'
    }
};

/**
 * Single Toast component
 */
const Toast = ({ toast, onDismiss, isDark }) => {
    const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                backgroundColor: isDark ? config.bgDark : config.bgLight,
                borderRadius: '12px',
                border: `1px solid ${isDark ? config.borderDark : config.borderLight}`,
                boxShadow: isDark
                    ? '0 8px 24px rgba(0, 0, 0, 0.4)'
                    : '0 8px 24px rgba(0, 0, 0, 0.12)',
                minWidth: '320px',
                maxWidth: '420px',
                animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Icon */}
            <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: config.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}>
                {config.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && (
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: isDark ? config.textDark : config.textLight,
                        marginBottom: toast.message ? '4px' : 0
                    }}>
                        {toast.title}
                    </div>
                )}
                {toast.message && (
                    <div style={{
                        fontSize: '12px',
                        color: isDark ? '#94a3b8' : '#64748b',
                        lineHeight: '1.4'
                    }}>
                        {toast.message}
                    </div>
                )}
            </div>

            {/* Dismiss button */}
            <button
                onClick={() => onDismiss(toast.id)}
                style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isDark ? '#6b7280' : '#9ca3af',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                    e.target.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                    e.target.style.color = isDark ? '#f1f5f9' : '#1e293b';
                }}
                onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = isDark ? '#6b7280' : '#9ca3af';
                }}
            >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Progress bar (auto-dismiss indicator) */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: config.gradient,
                animation: 'shrinkWidth 4s linear forwards',
                borderRadius: '0 0 12px 12px'
            }} />
        </div>
    );
};

/**
 * ToastContainer - Renders all active toasts
 */
export const ToastContainer = ({ toasts, onDismiss }) => {
    const { isDark } = useTheme();

    if (!toasts || toasts.length === 0) return null;

    return (
        <>
            <style>{`
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes shrinkWidth {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
            <div style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: Z_INDEX.TOAST || 9999,
                pointerEvents: 'none'
            }}>
                {toasts.map(toast => (
                    <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                        <Toast
                            toast={toast}
                            onDismiss={onDismiss}
                            isDark={isDark}
                        />
                    </div>
                ))}
            </div>
        </>
    );
};

export default ToastContainer;
