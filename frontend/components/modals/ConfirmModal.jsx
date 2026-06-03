import React from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, useTheme } from '../../design-system';

/**
 * ConfirmModal - Premium Design
 * Replaces window.confirm() with a glassmorphic dialog
 */
export const ConfirmModal = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger' // 'danger', 'warning', 'info'
}) => {
    const { colors } = useTheme();

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: (
                <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            ),
            iconBg: '#fef2f2',
            iconColor: '#E5554F',
            confirmButtonBg: '#E5554F',
            confirmButtonColor: 'white',
            shadowColor: 'rgba(239, 68, 68, 0.25)'
        },
        warning: {
            icon: (
                <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            iconBg: '#fffbeb',
            iconColor: '#FE9922',
            confirmButtonBg: '#FE9922',
            confirmButtonColor: 'white',
            shadowColor: 'rgba(245, 158, 11, 0.25)'
        },
        info: {
            icon: (
                <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            iconBg: '#eff6ff',
            iconColor: '#4794FF',
            confirmButtonBg: '#4794FF',
            confirmButtonColor: 'white',
            shadowColor: 'rgba(71, 148, 255, 0.25)'
        }
    };

    const style = variantStyles[variant] || variantStyles.danger;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                zIndex: Z_INDEX.MODAL_BACKDROP + 200, // Higher than others
                animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    backgroundColor: colors.bgModal || '#ffffff',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    width: '100%',
                    maxWidth: '440px',
                    overflow: 'hidden',
                    transformOrigin: 'center center',
                    animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            backgroundColor: style.iconBg,
                            color: style.iconColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: `0 4px 6px -1px ${style.shadowColor}`
                        }}>
                            {style.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                                {title}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: '24px 32px',
                    backgroundColor: '#fafafa',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '12px',
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '12px',
                            backgroundColor: style.confirmButtonBg,
                            border: 'none',
                            color: style.confirmButtonColor,
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: 'pointer',
                            boxShadow: `0 4px 6px -1px ${style.shadowColor}`,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 10px 15px -3px ${style.shadowColor}`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 6px -1px ${style.shadowColor}`; }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;

ConfirmModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    title: PropTypes.string,
    message: PropTypes.node,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    variant: PropTypes.oneOf(['danger', 'warning', 'info'])
};
