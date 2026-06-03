import React, { useState, useEffect, useRef } from 'react';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { ConfirmModal } from '../modals/ConfirmModal';

/**
 * Scenario Selector Dropdown
 */
export const ScenarioSelector = ({ scenarios, activeScenario, onSelect, onCreate, onClone, onDelete, onRevert, onRename, onManage, onCompare, ...props }) => {
    const { isDark, colors } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [revertConfirm, setRevertConfirm] = useState(null); // scenario to confirm revert
    const dropdownRef = useRef(null);

    // Separate draft, committed, and reverted scenarios
    const draftScenarios = scenarios.filter(s => s.status !== 'Committed' && s.status !== 'Reverted');
    const committedScenarios = scenarios.filter(s => s.status === 'Committed' || s.status === 'Reverted');

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const displayName = activeScenario ? activeScenario.name : 'Live Data';
    const isLiveMode = !activeScenario;

    const CompareIcon = <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>;
    const CloneIcon = <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    const RenameIcon = <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef} {...props}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    border: '1px solid rgba(226, 232, 240, 0.6)',
                    borderRadius: '10px',
                    background: isLiveMode ? 'rgba(248, 250, 252, 0.8)' : 'linear-gradient(to right, #F7F3ED, #eef2ff)',
                    color: isLiveMode ? '#475569' : '#7637E3',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                    transition: 'all 0.15s ease',
                    letterSpacing: '-0.01em'
                }}
            >
                <svg style={{ width: '14px', height: '14px', color: isLiveMode ? '#00BD00' : '#BD65FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLiveMode ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
                </svg>
                <span>{displayName}</span>
                {draftScenarios.length > 0 && (
                    <span style={{
                        padding: '1px 6px',
                        backgroundColor: '#BD65FF',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        borderRadius: '10px'
                    }}>
                        {draftScenarios.length}
                    </span>
                )}
                <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                    backgroundColor: colors.bgModal, border: `1px solid ${colors.border}`,
                    borderRadius: '12px', boxShadow: colors.shadowXl,
                    zIndex: Z_INDEX.DROPDOWN, minWidth: '280px', overflow: 'hidden'
                }}>
                    {/* Live Data Option */}
                    <button
                        onClick={() => { onSelect(null); setIsOpen(false); }}
                        style={{
                            width: '100%', padding: '12px 16px', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            border: 'none', cursor: 'pointer',
                            backgroundColor: isLiveMode ? colors.bgAlt : colors.bgModal,
                            transition: 'background-color 0.1s'
                        }}
                    >
                        <span style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: '#d1fae5', color: '#059669',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: isLiveMode ? '600' : '500', color: colors.text }}>Live Data</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Production environment</div>
                        </div>
                        {isLiveMode && (
                            <svg style={{ width: '16px', height: '16px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    {/* Divider */}
                    <div style={{ borderTop: `1px solid ${colors.border}` }}></div>

                    {/* Scenarios List - Only show non-committed (Draft/Active) */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {draftScenarios.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: colors.textMuted, fontStyle: 'italic' }}>
                                No draft scenarios. Create one to get started!
                            </div>
                        ) : (
                            draftScenarios.map(scenario => (
                                <div
                                    key={scenario.id}
                                    style={{
                                        width: '100%', padding: '12px 16px',
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        backgroundColor: activeScenario?.id === scenario.id ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#F7F3ED') : colors.bgModal,
                                        transition: 'background-color 0.1s'
                                    }}
                                >
                                    <button
                                        onClick={() => { onSelect(scenario.id); setIsOpen(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            flex: 1, minWidth: 0, border: 'none', background: 'none',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <span style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            backgroundColor: '#E8E1D9', color: '#7637E3',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: activeScenario?.id === scenario.id ? '600' : '500', color: activeScenario?.id === scenario.id ? '#BD65FF' : colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {scenario.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {scenario.description || 'No description'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{scenario.metadata?.totalChanges || 0} changes • Draft</span>
                                                {scenario.metadata?.lastEditedBy && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: '#f59e0b',
                                                        backgroundColor: '#fef3c7',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #fde68a'
                                                    }}>
                                                        ✎ {scenario.metadata.lastEditedBy}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {activeScenario?.id === scenario.id && (
                                            <svg style={{ width: '16px', height: '16px', color: '#BD65FF', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                    {onRename && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRename(scenario); setIsOpen(false); }}
                                            style={{
                                                padding: '6px', borderRadius: '6px', border: 'none',
                                                backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title={`Rename "${scenario.name}"`}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                                        >
                                            {RenameIcon}
                                        </button>
                                    )}
                                    {onClone && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onClone(scenario.id); setIsOpen(false); }}
                                            style={{
                                                padding: '6px', borderRadius: '6px', border: 'none',
                                                backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title={`Clone "${scenario.name}"`}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            {CloneIcon}
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(scenario.id); setIsOpen(false); }}
                                            style={{
                                                padding: '6px', borderRadius: '6px', border: 'none',
                                                backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title={`Delete "${scenario.name}"`}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                                        >
                                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Commit History Section */}
                    {committedScenarios.length > 0 && (
                        <>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                style={{
                                    width: '100%', padding: '10px 16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    backgroundColor: colors.bgAlt, border: 'none', borderTop: `1px solid ${colors.border}`,
                                    cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                                    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg style={{ width: '14px', height: '14px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Commit History ({committedScenarios.length})
                                </div>
                                <svg style={{ width: '12px', height: '12px', transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {showHistory && (
                                <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: colors.bgAlt }}>
                                    {committedScenarios.map(scenario => (
                                        <div
                                            key={scenario.id}
                                            style={{
                                                width: '100%', padding: '10px 16px',
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                borderBottom: `1px solid ${colors.border}`
                                            }}
                                        >
                                            <span style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                backgroundColor: '#d1fae5', color: '#059669',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: '500', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {scenario.name}
                                                    {scenario.status === 'Reverted' && (
                                                        <span style={{ fontSize: '9px', color: '#f59e0b', backgroundColor: '#fef3c7', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontWeight: '600' }}>REVERTED</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '10px', color: colors.textMuted }}>
                                                    {scenario.metadata?.totalChanges || 0} changes {scenario.status === 'Reverted' ? 'reverted' : 'committed'}
                                                </div>
                                            </div>
                                            {onRevert && scenario.status !== 'Reverted' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setRevertConfirm(scenario); }}
                                                    style={{
                                                        padding: '4px', borderRadius: '4px', border: 'none',
                                                        backgroundColor: 'transparent', cursor: 'pointer', color: '#d1d5db',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title={`Revert "${scenario.name}" — undo this commit`}
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.backgroundColor = '#fef3c7'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                >
                                                    <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                                                    </svg>
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDelete(scenario.id); }}
                                                    style={{
                                                        padding: '4px', borderRadius: '4px', border: 'none',
                                                        backgroundColor: 'transparent', cursor: 'pointer', color: '#d1d5db'
                                                    }}
                                                    title="Remove from history"
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
                                                >
                                                    <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Footer Actions */}
                    <div style={{
                        borderTop: `1px solid ${colors.border}`, backgroundColor: colors.bgAlt,
                        padding: '8px', display: 'flex', gap: '8px'
                    }}>
                        <button
                            onClick={() => { onCreate(); setIsOpen(false); }}
                            style={{
                                flex: 1, padding: '8px 12px',
                                background: 'linear-gradient(to right, #7637E3, #7637E3)',
                                color: 'white', fontSize: '12px', fontWeight: '600',
                                border: 'none', borderRadius: '8px', cursor: 'pointer'
                            }}
                        >+ New Scenario</button>
                        {scenarios.length >= 2 && onCompare && (
                            <button
                                onClick={() => { onCompare(); setIsOpen(false); }}
                                style={{
                                    padding: '8px 12px', backgroundColor: colors.bgCard,
                                    border: `1px solid ${colors.border}`, color: colors.textSecondary,
                                    fontSize: '12px', fontWeight: '500',
                                    borderRadius: '8px', cursor: 'pointer'
                                }}
                                title="Compare Scenarios"
                            >{CompareIcon}</button>
                        )}
                        {scenarios.length > 0 && (
                            <button
                                onClick={() => { onManage(); setIsOpen(false); }}
                                style={{
                                    padding: '8px 12px', backgroundColor: colors.bgCard,
                                    border: `1px solid ${colors.border}`, color: colors.textSecondary,
                                    fontSize: '12px', fontWeight: '500',
                                    borderRadius: '8px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >{ICONS.SETTINGS}</button>
                        )}
                    </div>
                </div>
            )
            }
            {/* Styled revert confirmation modal */}
            <ConfirmModal
                isOpen={!!revertConfirm}
                variant="warning"
                title={`Revert "${revertConfirm?.name}"?`}
                message={`This will restore ${(revertConfirm?.metadata?.totalChanges ?? (Object.keys(revertConfirm?.changes?.projects || {}).length + Object.keys(revertConfirm?.changes?.resources || {}).length + (revertConfirm?.changes?.financialAdjustments || []).length))} item(s) to their pre-commit values in Airtable. This cannot be undone.`}
                confirmText="Revert"
                cancelText="Cancel"
                onConfirm={() => { onRevert(revertConfirm.id); setRevertConfirm(null); setIsOpen(false); }}
                onCancel={() => setRevertConfirm(null)}
            />
        </div >
    );
};

/**
 * Live Data Badge indicator
 */
export const LiveDataBadge = ({ onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            background: 'linear-gradient(to right, #2563eb, #4f46e5)',
            color: 'white',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
        }}
    >
        <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#00BD00',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
        }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: '700' }}>LIVE DATA</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>Production</span>
        </div>
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    </button>
);

/**
 * Draft Mode Banner - Inline styled
 */
export const DraftModeBanner = ({
    scenario,
    onCommit,
    onDiscard,
    onViewChanges,
    onNotes,
    onExitDraft,
    onExport,
    revRecTotals,
    liveRevRecTotals,  // NEW: Live data totals for comparison
    onAddFinancialAdjustment,
    onRemoveFinancialAdjustment,
    isSaving = false,  // QoL: Show saving indicator
    ...props
}) => {
    const { name, metadata, changes } = scenario || {};
    const { totalChanges, lastSavedAt, notes } = metadata || {};
    const financialAdjustments = changes?.financialAdjustments || [];

    // State for inline add form
    const [showAddForm, setShowAddForm] = useState(false);
    const [adjType, setAdjType] = useState('arr');
    const [adjAmount, setAdjAmount] = useState('');
    const [adjDescription, setAdjDescription] = useState('');

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return 'Never';
        const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const handleAddAdjustment = () => {
        if (!adjAmount || !adjDescription.trim()) return;
        const amount = parseFloat(adjAmount);
        if (isNaN(amount)) return;

        onAddFinancialAdjustment?.({
            id: `adj_${Date.now()}`,
            type: adjType,
            amount,
            description: adjDescription.trim(),
            createdAt: new Date().toISOString()
        });

        // Reset form
        setAdjType('arr');
        setAdjAmount('');
        setAdjDescription('');
        setShowAddForm(false);
    };

    // Calculate total adjustments
    const totalAdjustmentArr = financialAdjustments.filter(a => a.type === 'arr').reduce((sum, a) => sum + a.amount, 0);
    const totalAdjustmentImplFee = financialAdjustments.filter(a => a.type === 'implFee').reduce((sum, a) => sum + a.amount, 0);

    if (!scenario) return null;

    // Revenue totals with fallback
    const implFeeTotal = revRecTotals?.implFee?.fullYear || 0;
    const arrTotal = revRecTotals?.arr?.fullYear || 0;
    const revenueTotal = revRecTotals?.total?.fullYear || 0;

    // Live data totals for comparison
    const liveImplFeeTotal = liveRevRecTotals?.implFee?.fullYear || 0;
    const liveArrTotal = liveRevRecTotals?.arr?.fullYear || 0;
    const liveRevenueTotal = liveRevRecTotals?.total?.fullYear || 0;

    // Calculate deltas (Draft - Live)
    const implFeeDelta = implFeeTotal - liveImplFeeTotal;
    const arrDelta = arrTotal - liveArrTotal;
    const revenueDelta = revenueTotal - liveRevenueTotal;

    // Helper to format delta with +/- sign
    const formatDelta = (delta) => {
        if (delta === 0) return null;
        const sign = delta > 0 ? '+' : '';
        return `${sign}£${Math.round(Math.abs(delta)).toLocaleString()}`;
    };

    return (
        <div style={{
            background: 'linear-gradient(to right, #065f46, #047857, #065f46)',
            color: 'white',
            padding: '12px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }} {...props}>
            {/* Main Banner Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <svg style={{ width: '20px', height: '20px', color: '#86efac' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>DRAFT MODE: "{name}"</div>
                        <div style={{ fontSize: '12px', color: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {totalChanges || 0} changes •{' '}
                            {isSaving ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <svg style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Saving...
                                </span>
                            ) : (
                                <>Last saved {getTimeAgo(lastSavedAt)}</>
                            )}
                            {notes ? ' • Has notes' : ''}
                            {financialAdjustments.length > 0 && ` • ${financialAdjustments.length} financial adj.`}
                        </div>
                    </div>

                    {/* Revenue Recognition Totals (Financial Mode) */}
                    {revenueTotal > 0 && (
                        <div style={{
                            marginLeft: '16px',
                            paddingLeft: '16px',
                            borderLeft: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <div>
                                <div style={{ fontSize: '9px', color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected Revenue (FY)</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '700' }}>£{Math.round(revenueTotal).toLocaleString()}</span>
                                    {formatDelta(revenueDelta) && (
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: revenueDelta >= 0 ? '#86efac' : '#fca5a5',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: revenueDelta >= 0 ? 'rgba(134, 239, 172, 0.2)' : 'rgba(252, 165, 165, 0.2)'
                                        }}>
                                            {formatDelta(revenueDelta)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '9px', color: '#a5f3fc' }}>Impl Fees</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>£{Math.round(implFeeTotal).toLocaleString()}</span>
                                        {formatDelta(implFeeDelta) && (
                                            <span style={{
                                                fontSize: '9px',
                                                fontWeight: '600',
                                                color: implFeeDelta >= 0 ? '#86efac' : '#fca5a5'
                                            }}>
                                                {formatDelta(implFeeDelta)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', color: '#ddd6fe' }}>ARR</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>£{Math.round(arrTotal).toLocaleString()}</span>
                                        {formatDelta(arrDelta) && (
                                            <span style={{
                                                fontSize: '9px',
                                                fontWeight: '600',
                                                color: arrDelta >= 0 ? '#86efac' : '#fca5a5'
                                            }}>
                                                {formatDelta(arrDelta)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Optimizer Stats — shown when draft was created from optimizer */}
                    {metadata?.optimizerStats && (() => {
                        const os = metadata.optimizerStats;
                        return (
                            <div style={{
                                marginLeft: '16px',
                                paddingLeft: '16px',
                                borderLeft: '1px solid rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{
                                    fontSize: '9px', color: '#c4b5fd', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', fontWeight: '700'
                                }}>Optimizer</div>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700',
                                    backgroundColor: os.fillRate >= 80 ? 'rgba(34,197,94,0.25)' : os.fillRate >= 50 ? 'rgba(251,191,36,0.25)' : 'rgba(239,68,68,0.25)',
                                    color: os.fillRate >= 80 ? '#86efac' : os.fillRate >= 50 ? '#fde68a' : '#fca5a5',
                                    border: `1px solid ${os.fillRate >= 80 ? 'rgba(34,197,94,0.4)' : os.fillRate >= 50 ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.4)'}`
                                }}>{os.fillRate}% fill</span>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600',
                                    backgroundColor: 'rgba(99,102,241,0.2)', color: '#c7d2fe',
                                    border: '1px solid rgba(99,102,241,0.3)'
                                }}>{os.scheduled} sched / {os.deferred} def</span>
                                {os.arrProtected > 0 && (
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600',
                                        backgroundColor: 'rgba(34,197,94,0.2)', color: '#86efac',
                                        border: '1px solid rgba(34,197,94,0.3)'
                                    }}>£{(os.arrProtected / 1000).toFixed(0)}k ARR</span>
                                )}
                                {os.crossSquadFills > 0 && (
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600',
                                        backgroundColor: 'rgba(251,191,36,0.2)', color: '#fde68a',
                                        border: '1px solid rgba(251,191,36,0.3)'
                                    }}>{os.crossSquadFills} x-squad</span>
                                )}
                            </div>
                        );
                    })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Add Financial Adjustment Button */}
                    {onAddFinancialAdjustment && (
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: showAddForm ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.15)',
                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                color: '#fef3c7',
                                fontSize: '12px',
                                fontWeight: '500',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title="Add financial adjustment"
                        >
                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            £ Adjust
                        </button>
                    )}
                    <button
                        onClick={onExitDraft}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                        title="Exit draft mode"
                    >Exit Draft</button>
                    <button
                        onClick={onNotes}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#fef3c7',
                            fontSize: '12px',
                            fontWeight: '500',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                        title="Add notes"
                    >Notes</button>
                    <button
                        onClick={onViewChanges}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(163, 230, 53, 0.2)',
                            border: '1px solid rgba(163, 230, 53, 0.3)',
                            color: '#ecfccb',
                            fontSize: '12px',
                            fontWeight: '500',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >View Changes</button>
                    <button
                        onClick={() => onCommit()}
                        style={{
                            padding: '6px 16px',
                            backgroundColor: '#a3e635',
                            color: '#14532d',
                            fontSize: '12px',
                            fontWeight: '700',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >Commit</button>
                    <button
                        onClick={onDiscard}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >Discard</button>
                </div>
            </div>

            {/* Financial Adjustments Section - Show when there are adjustments or form is open */}
            {(showAddForm || financialAdjustments.length > 0) && (
                <div style={{
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center'
                }}>
                    {/* Add Form */}
                    {showAddForm && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(251, 191, 36, 0.3)'
                        }}>
                            <select
                                value={adjType}
                                onChange={e => setAdjType(e.target.value)}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    color: '#1e293b',
                                    fontWeight: '500'
                                }}
                            >
                                <option value="arr">ARR</option>
                                <option value="implFee">Impl Fee</option>
                            </select>
                            <input
                                type="number"
                                placeholder="Amount (£)"
                                value={adjAmount}
                                onChange={e => setAdjAmount(e.target.value)}
                                style={{
                                    width: '90px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    color: '#1e293b'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Description"
                                value={adjDescription}
                                onChange={e => setAdjDescription(e.target.value)}
                                style={{
                                    width: '180px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    color: '#1e293b'
                                }}
                            />
                            <button
                                onClick={handleAddAdjustment}
                                disabled={!adjAmount || !adjDescription.trim()}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    backgroundColor: adjAmount && adjDescription.trim() ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                                    color: adjAmount && adjDescription.trim() ? '#78350f' : 'rgba(255,255,255,0.5)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: adjAmount && adjDescription.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >Add</button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                style={{
                                    padding: '4px 6px',
                                    fontSize: '11px',
                                    backgroundColor: 'transparent',
                                    color: 'rgba(255,255,255,0.6)',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >✕</button>
                        </div>
                    )}

                    {/* List of existing adjustments */}
                    {financialAdjustments.map(adj => (
                        <div
                            key={adj.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: adj.amount >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: `1px solid ${adj.amount >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                fontSize: '11px'
                            }}
                        >
                            <span style={{
                                fontWeight: '600',
                                color: adj.type === 'arr' ? '#c4b5fd' : '#a5f3fc'
                            }}>
                                {adj.type === 'arr' ? 'ARR' : 'IMPL'}
                            </span>
                            <span style={{
                                fontWeight: '700',
                                color: adj.amount >= 0 ? '#86efac' : '#fca5a5'
                            }}>
                                {adj.amount >= 0 ? '+' : ''}£{Math.abs(adj.amount).toLocaleString()}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {adj.description}
                            </span>
                            {onRemoveFinancialAdjustment && (
                                <button
                                    onClick={() => onRemoveFinancialAdjustment(adj.id)}
                                    style={{
                                        padding: '2px 4px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.4)',
                                        cursor: 'pointer',
                                        fontSize: '10px'
                                    }}
                                    title="Remove adjustment"
                                >✕</button>
                            )}
                        </div>
                    ))}

                    {/* Summary of adjustments */}
                    {financialAdjustments.length > 0 && (
                        <div style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.7)',
                            display: 'flex',
                            gap: '12px'
                        }}>
                            {totalAdjustmentImplFee !== 0 && (
                                <span>
                                    Impl Adj: <span style={{ fontWeight: '600', color: totalAdjustmentImplFee >= 0 ? '#86efac' : '#fca5a5' }}>
                                        {totalAdjustmentImplFee >= 0 ? '+' : ''}£{Math.abs(totalAdjustmentImplFee).toLocaleString()}
                                    </span>
                                </span>
                            )}
                            {totalAdjustmentArr !== 0 && (
                                <span>
                                    ARR Adj: <span style={{ fontWeight: '600', color: totalAdjustmentArr >= 0 ? '#86efac' : '#fca5a5' }}>
                                        {totalAdjustmentArr >= 0 ? '+' : ''}£{Math.abs(totalAdjustmentArr).toLocaleString()}
                                    </span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScenarioSelector;
