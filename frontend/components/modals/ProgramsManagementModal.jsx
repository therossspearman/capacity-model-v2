/**
 * Programs Selector Modal
 * Simple list of programs - click to open Program Detail Modal
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { formatNumber } from '../../utils';

const ProgramsManagementModal = ({
    isOpen,
    onClose,
    programs, // Array of program objects with { customer, workstreams, totalHours, ... }
    allResources,
    storedSettings,
    onUpdateSettings,
    isDraftMode,
    programRecords,
    programsTable,
    onSelectProgram // Callback to open ProgramDetailModal for a specific program
}) => {
    const { isDark, colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    // Filter programs by search
    const filteredPrograms = useMemo(() => {
        if (!searchTerm.trim()) return programs || [];
        const term = searchTerm.toLowerCase();
        return (programs || []).filter(p =>
            p.customer?.toLowerCase().includes(term) ||
            p.workstreams?.some(ws => ws.name?.toLowerCase().includes(term))
        );
    }, [programs, searchTerm]);

    const totalPrograms = (programs || []).length;
    const totalHours = (programs || []).reduce((sum, p) => sum + (p.totalHours || 0), 0);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: Z_INDEX.MODAL
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '95%',
                    maxWidth: '600px',
                    maxHeight: '80vh',
                    backgroundColor: colors.bgCard,
                    borderRadius: '16px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                                        Programs
                                    </h2>
                                    {isDraftMode && (
                                        <span style={{
                                            fontSize: '9px', fontWeight: '700',
                                            padding: '3px 8px', borderRadius: '4px',
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            textTransform: 'uppercase'
                                        }}>
                                            Draft
                                        </span>
                                    )}
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                                    {totalPrograms} program{totalPrograms !== 1 ? 's' : ''} • {formatNumber(Math.round(totalHours))}h total budget
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px', borderRadius: '8px', border: 'none',
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                color: 'white', cursor: 'pointer'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ position: 'relative' }}>
                        <svg
                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: colors.textMuted }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search programs..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 40px',
                                fontSize: '13px',
                                border: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                backgroundColor: colors.bgCard,
                                color: colors.text,
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Programs List - Click to open detail */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {filteredPrograms.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '48px 24px',
                            color: colors.textMuted
                        }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, margin: '0 auto 16px' }}>
                                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p style={{ fontSize: '14px', fontWeight: '600' }}>No programs found</p>
                            <p style={{ fontSize: '12px', marginTop: '4px' }}>
                                Enable "Program Team" on projects to create program budgets
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredPrograms.map(program => {
                                const workstreamCount = program.workstreams?.length || 0;

                                return (
                                    <div
                                        key={program.customer}
                                        onClick={() => onSelectProgram && onSelectProgram(program)}
                                        style={{
                                            padding: '16px 20px',
                                            borderRadius: '12px',
                                            border: `1px solid ${colors.border}`,
                                            backgroundColor: colors.bgCard,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = '#00BD00';
                                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = colors.border;
                                            e.currentTarget.style.backgroundColor = colors.bgCard;
                                        }}
                                    >
                                        {/* Program Icon */}
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BD00" strokeWidth="2">
                                                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>

                                        {/* Program Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '700',
                                                color: colors.text,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {program.customer}
                                            </div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                                                {workstreamCount} workstream{workstreamCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Hours Badge */}
                                        <div style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5',
                                            color: '#059669',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            flexShrink: 0
                                        }}>
                                            {formatNumber(Math.round(program.totalHours || 0))}h
                                        </div>

                                        {/* Arrow indicator */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" style={{ flexShrink: 0 }}>
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    backgroundColor: colors.bgAlt
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: '600',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                            color: colors.text,
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div >
    );
};

export default ProgramsManagementModal;

ProgramsManagementModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    programs: PropTypes.array,
    allResources: PropTypes.array,
    storedSettings: PropTypes.object,
    onUpdateSettings: PropTypes.func,
    isDraftMode: PropTypes.bool,
    programRecords: PropTypes.array,
    programsTable: PropTypes.object,
    onSelectProgram: PropTypes.func
};
