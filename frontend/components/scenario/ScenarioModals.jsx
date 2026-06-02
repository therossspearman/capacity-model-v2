import React, { useState } from 'react';
import { useTheme, Z_INDEX } from '../../design-system';

/**
 * Create Scenario Modal - Inline styled for compatibility
 */
export const CreateScenarioModal = ({ onClose, onCreate, isLoading }) => {
    const { isDark, colors } = useTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) return;
        await onCreate(name.trim(), description.trim());
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
                            disabled={isLoading}
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
                            disabled={isLoading}
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
                        disabled={isLoading}
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
                            opacity: isLoading ? 0.5 : 1
                        }}
                    >Cancel</button>
                    <button
                        onClick={handleCreate}
                        disabled={!name.trim() || isLoading}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: 'linear-gradient(to right, #7637E3, #7637E3)',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '14px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!name.trim() || isLoading) ? 'not-allowed' : 'pointer',
                            opacity: (!name.trim() || isLoading) ? 0.5 : 1
                        }}
                    >{isLoading ? 'Creating...' : 'Create Scenario'}</button>
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

    const handleCopy = async () => {
        if (!name.trim() || !sourceScenario) return;
        await onCopy(sourceScenario, name.trim());
        onClose();
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
                            disabled={isLoading}
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
                    <button onClick={onClose} disabled={isLoading} style={{
                        flex: 1, padding: '10px 16px', backgroundColor: colors.bgCard, border: `2px solid ${colors.border}`,
                        color: colors.textSecondary, fontWeight: '500', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', opacity: isLoading ? 0.5 : 1
                    }}>Cancel</button>
                    <button onClick={handleCopy} disabled={!name.trim() || isLoading} style={{
                        flex: 1, padding: '10px 16px', background: 'linear-gradient(to right, #7637E3, #7637E3)',
                        color: 'white', fontWeight: '600', fontSize: '14px', border: 'none', borderRadius: '8px',
                        cursor: (!name.trim() || isLoading) ? 'not-allowed' : 'pointer', opacity: (!name.trim() || isLoading) ? 0.5 : 1
                    }}>{isLoading ? 'Copying...' : 'Create Copy'}</button>
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
    const handleSave = async () => { await onSave(notes); };

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
                        disabled={isLoading}
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
                    <button onClick={onClose} disabled={isLoading} style={{
                        flex: 1, padding: '10px 16px', backgroundColor: colors.bgCard, border: `2px solid ${colors.border}`,
                        color: colors.textSecondary, fontWeight: '500', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', opacity: isLoading ? 0.5 : 1
                    }}>Cancel</button>
                    <button onClick={handleSave} disabled={isLoading} style={{
                        flex: 1, padding: '10px 16px', background: 'linear-gradient(to right, #d97706, #ea580c)',
                        color: 'white', fontWeight: '600', fontSize: '14px', border: 'none', borderRadius: '8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1
                    }}>{isLoading ? 'Saving...' : 'Save Notes'}</button>
                </div>
            </div>
        </div>
    );
};

export default CreateScenarioModal;
