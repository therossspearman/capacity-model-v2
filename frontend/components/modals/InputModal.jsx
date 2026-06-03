import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, useTheme } from '../../design-system';

/**
 * Input Modal - Premium Design
 * Replaces window.prompt() with a premium glassmorphic dialog
 */
export const InputModal = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Enter Value',
    message,
    initialValue = '',
    placeholder = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    icon = 'edit' // 'edit', 'rename', 'add'
}) => {
    const { isDark, colors } = useTheme();
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    // Reset value when modal opens
    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(value);
    };

    // Icon mapping
    const icons = {
        edit: (
            <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        ),
        rename: (
            <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
        add: (
            <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
        )
    };

    const selectedIcon = icons[icon] || icons.edit;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: Z_INDEX.MODAL_BACKDROP + 200,
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
            onClick={onCancel}>
            <div style={{
                backgroundColor: colors.bgModal || '#ffffff',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                width: '100%',
                maxWidth: '480px',
                overflow: 'hidden',
                transformOrigin: 'center center',
                animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
                onClick={e => e.stopPropagation()}>

                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '16px',
                                backgroundColor: '#f0f9ff',
                                color: '#0284c7',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.1)'
                            }}>
                                {selectedIcon}
                            </div>

                            <div style={{ flex: 1 }}>
                                <h3 style={{
                                    fontSize: '18px', fontWeight: '800', color: '#1e293b',
                                    margin: '0 0 8px 0', letterSpacing: '-0.02em'
                                }}>
                                    {title}
                                </h3>
                                {message && (
                                    <p style={{
                                        fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5
                                    }}>
                                        {message}
                                    </p>
                                )}

                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder={placeholder}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        fontSize: '15px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: '#f8fafc',
                                        color: '#334155',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onFocus={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.borderColor = '#4794FF'; e.target.style.boxShadow = '0 0 0 3px rgba(71, 148, 255, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.backgroundColor = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)'; }}
                                />
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
                            type="button"
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
                            type="submit"
                            style={{
                                padding: '12px 24px',
                                borderRadius: '12px',
                                backgroundColor: '#4794FF',
                                border: 'none',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(71, 148, 255, 0.25)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(71, 148, 255, 0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(71, 148, 255, 0.25)'; }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
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

export default InputModal;

InputModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    title: PropTypes.string,
    message: PropTypes.node,
    initialValue: PropTypes.string,
    placeholder: PropTypes.string,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    icon: PropTypes.oneOf(['edit', 'rename', 'add'])
};
