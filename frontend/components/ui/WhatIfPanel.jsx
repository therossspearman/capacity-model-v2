/**
 * WhatIfPanel - UI for What-If Analysis sandbox mode
 * Shows active sandbox indicator, change list, and impact summary
 */

import React from 'react';
import { useTheme } from '../../design-system';

const WhatIfPanel = ({
    isActive,
    changeList = [],
    impactSummary = null,
    onEnter,
    onDiscard,
    onUndo,
    canUndo = false
}) => {
    const { isDark } = useTheme();

    // Not active - show enter button
    if (!isActive) {
        return (
            <button
                onClick={onEnter}
                style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#1e293b' : 'white',
                    color: isDark ? '#f1f5f9' : '#1e293b',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                title="Enter What-If mode to test hypothetical changes"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                What-If
            </button>
        );
    }

    // Active mode - show panel
    return (
        <div style={{
            backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
            border: `2px solid ${isDark ? '#BD65FF' : '#a78bfa'}`,
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '12px'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: '#BD65FF',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        </svg>
                        What-If Mode
                    </span>
                    <span style={{
                        fontSize: '11px',
                        color: isDark ? '#c4b5fd' : '#7637E3'
                    }}>
                        Changes are not saved until you apply
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: isDark ? '#374151' : '#e5e7eb',
                            color: canUndo ? (isDark ? '#f1f5f9' : '#1e293b') : (isDark ? '#6b7280' : '#9ca3af'),
                            fontSize: '10px',
                            fontWeight: '600',
                            cursor: canUndo ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ↩ Undo
                    </button>
                    <button
                        onClick={onDiscard}
                        style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        ✕ Discard
                    </button>
                </div>
            </div>

            {/* Impact Summary */}
            {impactSummary && impactSummary.totalChanges > 0 && (
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '8px 12px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                    borderRadius: '6px',
                    marginBottom: '10px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#BD65FF' }}>
                            {impactSummary.totalChanges}
                        </div>
                        <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                            Changes
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
                            {impactSummary.projectsModified}
                        </div>
                        <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                            Projects
                        </div>
                    </div>
                    {impactSummary.datesMoved > 0 && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                                {impactSummary.datesMoved}
                            </div>
                            <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                                Dates
                            </div>
                        </div>
                    )}
                    {impactSummary.squadChanges > 0 && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00BD00' }}>
                                {impactSummary.squadChanges}
                            </div>
                            <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                                Squads
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Change List */}
            {changeList.length > 0 && (
                <div style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    {changeList.map((change, idx) => (
                        <div
                            key={change.id}
                            style={{
                                padding: '6px 8px',
                                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: isDark ? '#e2e8f0' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span style={{
                                fontSize: '9px',
                                color: isDark ? '#94a3b8' : '#64748b',
                                minWidth: '20px'
                            }}>
                                #{idx + 1}
                            </span>
                            {change.description}
                        </div>
                    ))}
                </div>
            )}

            {changeList.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '12px'
                }}>
                    Drag projects to test different placements.<br />
                    Changes won't affect live data.
                </div>
            )}
        </div>
    );
};

export default WhatIfPanel;
