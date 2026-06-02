import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { BRAND, useTheme, Z_INDEX } from '../../design-system';
import { ICONS } from '../../constants';

/**
 * Actions Menu - Consolidated menu for Export, Settings, Help, Audit, Financials
 */
export const ActionsMenu = ({ onExport, onSettings, onHelp, onAudit, showAuditor, onFinancials }) => {
    const { isDark, colors } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [showFinancialsSubmenu, setShowFinancialsSubmenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setShowFinancialsSubmenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleFinancialPeriod = (period) => {
        onFinancials?.(period);
        setIsOpen(false);
        setShowFinancialsSubmenu(false);
    };

    const menuItemStyle = {
        width: '100%',
        padding: '8px 16px',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s'
    };

    const menuItemHoverBg = isDark ? colors.bgAlt : '#f8fafc';

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px',
                    backgroundColor: 'transparent',
                    border: `1px solid transparent`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: colors.textSecondary,
                    transition: 'all 0.15s'
                }}
                aria-label="Actions menu"
            >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
            </button>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '8px',
                    width: '224px',
                    backgroundColor: colors.bgModal,
                    borderRadius: '12px',
                    boxShadow: colors.shadowXl,
                    border: `1px solid ${colors.border}`,
                    padding: '8px 0',
                    zIndex: Z_INDEX.DROPDOWN,
                    overflow: 'visible'
                }}>
                    {/* Financial Forecasts with submenu */}
                    <div
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setShowFinancialsSubmenu(true)}
                        onMouseLeave={() => setShowFinancialsSubmenu(false)}
                    >
                        <button
                            onClick={() => setShowFinancialsSubmenu(!showFinancialsSubmenu)}
                            style={menuItemStyle}
                        >
                            <svg style={{ width: '16px', height: '16px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Financial Forecasts</div>
                                <div style={{ fontSize: '11px', color: colors.textMuted }}>Revenue by project</div>
                            </div>
                            <svg style={{ width: '16px', height: '16px', color: colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Submenu - slides in from right */}
                        {showFinancialsSubmenu && (
                            <div style={{
                                position: 'absolute',
                                left: '100%',
                                top: 0,
                                marginLeft: '4px',
                                width: '208px',
                                backgroundColor: colors.bgModal,
                                borderRadius: '12px',
                                boxShadow: colors.shadowXl,
                                border: `1px solid ${colors.border}`,
                                padding: '8px 0',
                                zIndex: Z_INDEX.DROPDOWN + 1,
                                animation: 'slideInRight 0.15s ease-out'
                            }}>
                                <div style={{ padding: '6px 12px', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Period</div>
                                <button onClick={() => handleFinancialPeriod('fy')} style={menuItemStyle}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00BD00' }}></div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Current FY</div>
                                        <div style={{ fontSize: '11px', color: colors.textMuted }}>Fiscal year</div>
                                    </div>
                                </button>
                                <button onClick={() => handleFinancialPeriod('cy')} style={menuItemStyle}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }}></div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Calendar Year {new Date().getFullYear()}</div>
                                        <div style={{ fontSize: '11px', color: colors.textMuted }}>Jan - Dec</div>
                                    </div>
                                </button>
                                <button onClick={() => handleFinancialPeriod('cy_next')} style={menuItemStyle}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7637E3' }}></div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Calendar Year {new Date().getFullYear() + 1}</div>
                                        <div style={{ fontSize: '11px', color: colors.textMuted }}>Following year</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', backgroundColor: colors.border, margin: '4px 0' }}></div>

                    <button onClick={() => { onExport(); setIsOpen(false); }} style={menuItemStyle}>
                        <svg style={{ width: '16px', height: '16px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Export to CSV</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Download capacity data</div>
                        </div>
                    </button>
                    <button onClick={() => { onSettings(); setIsOpen(false); }} style={menuItemStyle}>
                        <svg style={{ width: '16px', height: '16px', color: colors.textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Configure Model</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Field mappings & settings</div>
                        </div>
                    </button>
                    <button onClick={() => { onHelp(); setIsOpen(false); }} style={menuItemStyle}>
                        <svg style={{ width: '16px', height: '16px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Help & Shortcuts</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Documentation & tips</div>
                        </div>
                    </button>
                    <div style={{ height: '1px', backgroundColor: colors.border, margin: '8px 0' }}></div>
                    <button onClick={() => { onAudit(); setIsOpen(false); }} style={menuItemStyle}>
                        <svg style={{ width: '16px', height: '16px', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>Audit Log</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>{showAuditor ? 'Hide' : 'Show'} data inclusion audit</div>
                        </div>
                    </button>
                </div>
            )}

            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

/**
 * Keyboard Shortcuts Modal
 */
export const KeyboardShortcutsModal = ({ onClose }) => {
    const { isDark, colors } = useTheme();

    const shortcutCategories = [
        {
            title: '🎯 Views',
            shortcuts: [
                { keys: ['1'], description: 'Switch to People view' },
                { keys: ['2'], description: 'Switch to Projects view' },
                { keys: ['3'], description: 'Switch to Slots view' },
                { keys: ['G'], description: 'Toggle graph visibility' },
            ]
        },
        {
            title: '⚡ Quick Actions',
            shortcuts: [
                { keys: ['F'], description: 'Focus search box' },
                { keys: ['I'], description: 'Open initiatives' },
                { keys: ['E'], description: 'Toggle exceptions filter' },
                { keys: ['P'], description: 'Cycle Plan → EAC → Impact' },
                { keys: ['T'], description: 'Jump to Today' },
                { keys: ['A'], description: 'Toggle Activity Log' },
                { keys: ['R'], description: 'Toggle Recently Viewed' },
            ]
        },
        {
            title: '🔧 Editing',
            shortcuts: [
                { keys: ['⌘', 'S'], description: 'Save scenario (draft mode)' },
                { keys: ['⌘', 'Z'], description: 'Undo last change' },
                { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
                { keys: ['←', '→'], description: 'Navigate projects in modal' },
            ]
        },
        {
            title: '💡 General',
            shortcuts: [
                { keys: ['Esc'], description: 'Close modals' },
                { keys: ['⌘', 'M'], description: 'Toggle toolbar' },
                { keys: ['⌘', '.'], description: 'Open settings' },
                { keys: ['⌘', '/'], description: 'Show this help' },
                { keys: ['?'], description: 'Open documentation' },
            ]
        },
    ];

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: Z_INDEX.MODAL_BACKDROP
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: colors.bgModal,
                    borderRadius: '16px',
                    boxShadow: colors.shadowXl,
                    border: `1px solid ${colors.border}`,
                    width: '100%',
                    maxWidth: '640px',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>⌨️ Keyboard Shortcuts</h3>
                        <p style={{ fontSize: '13px', color: 'rgba(191, 219, 254, 1)', marginTop: '4px' }}>Navigate faster with these shortcuts</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {shortcutCategories.map((category, catIdx) => (
                            <div key={catIdx}>
                                <h4 style={{ fontSize: '12px', fontWeight: '700', color: colors.textMuted, marginBottom: '10px' }}>{category.title}</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {category.shortcuts.map((shortcut, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 10px',
                                                backgroundColor: colors.bgAlt,
                                                borderRadius: '6px',
                                                border: `1px solid ${colors.border}`
                                            }}
                                        >
                                            <span style={{ color: colors.text, fontWeight: '500', fontSize: '12px' }}>{shortcut.description}</span>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                {shortcut.keys.map((key, keyIdx) => (
                                                    <kbd
                                                        key={keyIdx}
                                                        style={{
                                                            padding: '3px 8px',
                                                            backgroundColor: colors.bgCard,
                                                            border: `1px solid ${colors.border}`,
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            fontWeight: '600',
                                                            color: colors.text,
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                        }}
                                                    >
                                                        {key}
                                                    </kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                    border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'}`,
                    borderRadius: '8px'
                }}>
                    <p style={{ fontSize: '13px', color: isDark ? '#93c5fd' : '#1e40af', margin: 0 }}>
                        <strong>💡 Tip:</strong> Press <kbd style={{
                            padding: '2px 8px',
                            backgroundColor: colors.bgCard,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                        }}>?</kbd> anytime to see this help
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ActionsMenu;

ActionsMenu.propTypes = {
    onExport: PropTypes.func.isRequired,
    onSettings: PropTypes.func.isRequired,
    onHelp: PropTypes.func.isRequired,
    onAudit: PropTypes.func.isRequired,
    showAuditor: PropTypes.bool,
    onFinancials: PropTypes.func
};

KeyboardShortcutsModal.propTypes = {
    onClose: PropTypes.func.isRequired
};
