import React, { useState } from 'react';
import { useTheme, Z_INDEX } from '../../design-system';

/**
 * Create Scenario Modal - Inline styled for compatibility
 */
export const CreateScenarioModal = ({ onClose, onCreate, isLoading }) => {
    const { isDark, colors } = useTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    // Internal submit guard: the parent passes isLoading={false}, so without this
    // the loading UI is dead and a fast double-click can fire onCreate twice.
    // Dismissal contract: the parent owns closing this modal after onCreate resolves.
    const [submitting, setSubmitting] = useState(false);
    const busy = submitting || isLoading;

    const handleCreate = async () => {
        if (!name.trim() || busy) return;
        setSubmitting(true);
        try {
            await onCreate(name.trim(), description.trim());
        } finally {
            setSubmitting(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        fontSize: '14px',
        border: `2px solid ${colors.border}`,
        borderRadius: '8px',
        outline: 'none',
        boxSizing: 'border-box',
        backgroundColor: colors.bgCard,
        color: colors.text
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(24, 1, 38, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: colors.bgModal,
                borderRadius: '16px',
                boxShadow: colors.shadowXl,
                border: `1px solid ${colors.border}`,
                width: '100%',
                maxWidth: '420px',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(to right, #7637E3, #7637E3)',
                    color: 'white'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Create New Scenario</h3>
                    <p style={{ fontSize: '13px', color: '#e0e7ff', marginTop: '4px' }}>Plan changes without affecting live data</p>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                            Scenario Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q2 2026 Expansion Plan"
                            autoFocus
                            disabled={busy}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                            Description (Optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the purpose of this scenario..."
                            rows={3}
                            disabled={busy}
                            style={{
                                ...inputStyle,
                                resize: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    backgroundColor: colors.bgAlt,
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            backgroundColor: colors.bgCard,
                            border: `2px solid ${colors.border}`,
                            color: colors.textSecondary,
                            fontWeight: '500',
                            fontSize: '14px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            opacity: busy ? 0.5 : 1
                        }}
                    >Cancel</button>
                    <button
                        onClick={handleCreate}
                        disabled={!name.trim() || busy}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: 'linear-gradient(to right, #7637E3, #7637E3)',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '14px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!name.trim() || busy) ? 'not-allowed' : 'pointer',
                            opacity: (!name.trim() || busy) ? 0.5 : 1
                        }}
                    >{busy ? 'Creating...' : 'Create Scenario'}</button>
                </div>
            </div>
        </div>
    );
};

/**
 * Copy Scenario Modal - Inline styled
 */
export const CopyScenarioModal = ({ sourceScenario, onClose, onCopy, isLoading }) => {
    const { isDark, colors } = useTheme();
    const [name, setName] = useState(sourceScenario ? `${sourceScenario.name} (Copy)` : '');
    // Internal submit guard (see CreateScenarioModal): prevents double-submit and
    // drives the loading UI even when the parent passes a static isLoading.
    const [submitting, setSubmitting] = useState(false);
    const busy = submitting || isLoading;

    const handleCopy = async () => {
        if (!name.trim() || !sourceScenario || busy) return;
        setSubmitting(true);
        try {
            await onCopy(sourceScenario, name.trim());
            // Dismissal contract: this modal closes itself once the copy resolves.
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    if (!sourceScenario) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(24, 1, 38, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: colors.bgModal,
                borderRadius: '16px',
                boxShadow: colors.shadowXl,
                border: `1px solid ${colors.border}`,
                width: '100%',
                maxWidth: '420px',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(to right, #7637E3, #7637E3)',
                    color: 'white'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Copy Scenario</h3>
                    <p style={{ fontSize: '13px', color: '#c7d2fe', marginTop: '4px' }}>Duplicate "{sourceScenario.name}" with all changes</p>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                            New Scenario Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q2 Plan v2"
                            autoFocus
                            disabled={busy}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                fontSize: '14px',
                                border: `2px solid ${colors.border}`,
                                borderRadius: '8px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                backgroundColor: colors.bgCard,
                                color: colors.text
                            }}
                        />
                    </div>
                    <div style={{ padding: '12px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'}` }}>
                        <p style={{ fontSize: '12px', color: isDark ? '#a5b4fc' : '#4338ca', margin: 0 }}>
                            <strong>{sourceScenario.metadata?.totalChanges || 0}</strong> changes will be copied
                        </p>
                    </div>
                </div>
                <div style={{ padding: '16px 24px', backgroundColor: colors.bgAlt, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} disabled={busy} style={{
                        flex: 1, padding: '10px 16px', backgroundColor: colors.bgCard, border: `2px solid ${colors.border}`,
                        color: colors.textSecondary, fontWeight: '500', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', opacity: busy ? 0.5 : 1
                    }}>Cancel</button>
                    <button onClick={handleCopy} disabled={!name.trim() || busy} style={{
                        flex: 1, padding: '10px 16px', background: 'linear-gradient(to right, #7637E3, #7637E3)',
                        color: 'white', fontWeight: '600', fontSize: '14px', border: 'none', borderRadius: '8px',
                        cursor: (!name.trim() || busy) ? 'not-allowed' : 'pointer', opacity: (!name.trim() || busy) ? 0.5 : 1
                    }}>{busy ? 'Copying...' : 'Create Copy'}</button>
                </div>
            </div>
        </div>
    );
};

/**
 * Scenario Notes Modal - Inline styled
 */
export const ScenarioNotesModal = ({ scenario, onSave, onClose, isLoading }) => {
    const { isDark, colors } = useTheme();
    const [notes, setNotes] = useState(scenario?.metadata?.notes || '');
    // Internal submit guard (see CreateScenarioModal): prevents double-submit and
    // drives the loading UI even when the parent passes a static isLoading.
    // Dismissal contract: the parent owns closing this modal after onSave resolves.
    const [submitting, setSubmitting] = useState(false);
    const busy = submitting || isLoading;
    const handleSave = async () => {
        if (busy) return;
        setSubmitting(true);
        try {
            await onSave(notes);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(24, 1, 38, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: colors.bgModal,
                borderRadius: '16px',
                boxShadow: colors.shadowXl,
                border: `1px solid ${colors.border}`,
                width: '100%',
                maxWidth: '500px',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(to right, #d97706, #ea580c)',
                    color: 'white'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Scenario Notes</h3>
                    <p style={{ fontSize: '13px', color: '#fed7aa', marginTop: '4px' }}>Add commentary for "{scenario?.name}"</p>
                </div>
                <div style={{ padding: '24px' }}>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes, assumptions, or commentary about this scenario..."
                        rows={6}
                        disabled={busy}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '12px 14px',
                            fontSize: '14px',
                            border: `2px solid ${colors.border}`,
                            borderRadius: '8px',
                            outline: 'none',
                            resize: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            backgroundColor: colors.bgCard,
                            color: colors.text
                        }}
                    />
                    <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '8px' }}>Notes are saved with the scenario and visible in commit preview.</p>
                </div>
                <div style={{ padding: '16px 24px', backgroundColor: colors.bgAlt, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} disabled={busy} style={{
                        flex: 1, padding: '10px 16px', backgroundColor: colors.bgCard, border: `2px solid ${colors.border}`,
                        color: colors.textSecondary, fontWeight: '500', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', opacity: busy ? 0.5 : 1
                    }}>Cancel</button>
                    <button onClick={handleSave} disabled={busy} style={{
                        flex: 1, padding: '10px 16px', background: 'linear-gradient(to right, #d97706, #ea580c)',
                        color: 'white', fontWeight: '600', fontSize: '14px', border: 'none', borderRadius: '8px',
                        cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1
                    }}>{busy ? 'Saving...' : 'Save Notes'}</button>
                </div>
            </div>
        </div>
    );
};

export default CreateScenarioModal;
