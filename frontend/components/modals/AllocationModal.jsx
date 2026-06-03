import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, BRAND, useTheme } from '../../design-system';
import { ICONS } from '../../constants';

export const AllocationModal = ({
    resource,
    dateKey,
    allProjects, // List of all projects for dropdowns
    onClose,
    onSave, // Function to update Airtable record
    settings // To know how to format things
}) => {
    const { isDark, colors } = useTheme();
    // 1. Identify active allocations for this period
    // resource.projects contains the allocations
    const [allocations, setAllocations] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Format a date-only value (Date | 'YYYY-MM-DD' | ISO string) to 'YYYY-MM-DD'
    // without timezone shifting. Avoids toISOString() which converts to UTC and
    // can roll a stored midnight date back a day for negative-UTC-offset users.
    const toDateInputValue = (value) => {
        if (!value) return '';
        if (typeof value === 'string') {
            // Already a date-only string, or take the date portion of an ISO string.
            const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) return `${match[1]}-${match[2]}-${match[3]}`;
        }
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Copy State
    const [copySource, setCopySource] = useState(null); // Allocation object being copied
    const [copyTargets, setCopyTargets] = useState([]); // List of project IDs to copy to

    const toggleCopyTarget = (projectId) => {
        setCopyTargets(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    const handleCopyConfirm = () => {
        if (!copySource || copyTargets.length === 0) return;

        const newAllocations = copyTargets.map(targetId => {
            const project = allProjects.find(p => p.id === targetId);
            return {
                id: `temp_${Date.now()}_${targetId}`, // Temporary ID
                projectId: targetId,
                projectName: project ? project.name : 'Unknown Project',
                start: copySource.start,
                end: copySource.end,
                allocation: copySource.allocation,
                hours: copySource.hours,
                type: copySource.type,
                isNew: true // Flag to identify as new
            };
        });

        setAllocations(prev => [...prev, ...newAllocations]);
        setCopySource(null);
        setCopyTargets([]);
    };

    useEffect(() => {
        if (resource && dateKey) {
            // Filter resource projects that overlap with dateKey
            const periodStart = new Date(dateKey);
            const periodEnd = new Date(dateKey);
            periodEnd.setDate(periodEnd.getDate() + 7);

            const active = (resource.projects || []).filter(p => {
                const start = new Date(p.start);
                const end = new Date(p.end);
                return start < periodEnd && end >= periodStart;
            });

            // Map to editable structure
            setAllocations(active.map(a => ({
                id: a.id, // Record ID
                projectId: a.projectId,
                projectName: a.name || 'Unnamed Project',
                start: a.start,
                end: a.end,
                allocation: a.allocation || 0,
                hours: a.hours || 0,
                type: a.breakdownCategory || 'pm' // pm, sc, pd
            })));
        }
    }, [resource, dateKey]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(allocations);
            onClose();
        } catch (err) {
            console.error(err);
            setSaveError(err && err.message ? err.message : 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateAllocation = (id, field, value) => {
        setAllocations(prev => prev.map(a =>
            a.id === id ? { ...a, [field]: value } : a
        ));
    };

    if (!resource) return null;

    const getTypeColor = (type) => {
        if (type === 'pm') return { bg: isDark ? '#312e81' : '#e0e7ff', text: isDark ? '#c7d2fe' : '#4338ca', border: isDark ? '#4338ca' : '#c7d2fe' };
        if (type === 'sc') return { bg: isDark ? '#1e3a8a' : '#dbeafe', text: isDark ? '#bfdbfe' : '#1d4ed8', border: isDark ? '#1e40af' : '#93c5fd' };
        return { bg: isDark ? '#064e3b' : '#dcfce7', text: isDark ? '#6ee7b7' : '#15803d', border: isDark ? '#065f46' : '#86efac' };
    };

    const inputStyle = {
        width: '100%',
        fontSize: '13px',
        border: `1px solid ${colors.border || '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '8px 12px',
        backgroundColor: colors.bgHover || '#f8fafc',
        color: colors.text || '#1e293b',
        outline: 'none',
        transition: 'all 0.2s'
    };

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
                zIndex: Z_INDEX.MODAL_BACKDROP
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: colors.bgModal || '#ffffff',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: Z_INDEX.MODAL
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '32px 40px',
                    borderBottom: `1px solid ${colors.borderLight || '#f1f5f9'}`,
                    backgroundColor: colors.bgModal || 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            backgroundColor: '#eff6ff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
                        }}>
                            <svg style={{ width: '28px', height: '28px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', color: colors.text || '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Edit Allocations
                            </h2>
                            <p style={{ fontSize: '13px', color: colors.textSecondary || '#64748b', margin: '4px 0 0', fontWeight: '500' }}>
                                {resource.name} • <span style={{ color: '#3b82f6' }}>{new Date(dateKey).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            border: `1px solid ${colors.border || '#e2e8f0'}`, backgroundColor: colors.bgModal || 'white',
                            cursor: 'pointer', color: colors.textSecondary || '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.bgHover || '#f8fafc'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.bgModal || 'white'; e.currentTarget.style.transform = 'rotate(0)'; }}
                    >
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '32px 40px',
                    overflowY: 'auto',
                    flex: 1,
                    backgroundColor: colors.bgAlt || '#fafafa'
                }}>
                    {copySource ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px' }}>
                            <div style={{
                                padding: '20px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
                                display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    backgroundColor: '#f3e8ff', color: '#7637E3',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {ICONS.COPY || 'C'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>Copy Mode Active</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        Select projects to copy <strong>{copySource.projectName}</strong> allocation to.
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                flex: 1, overflowY: 'auto',
                                backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}>
                                {allProjects
                                    .filter(p => p.id !== copySource.projectId && !allocations.some(a => a.projectId === p.id))
                                    .map(project => (
                                        <div
                                            key={project.id}
                                            onClick={() => toggleCopyTarget(project.id)}
                                            style={{
                                                padding: '16px 20px',
                                                borderBottom: '1px solid #f1f5f9',
                                                display: 'flex', alignItems: 'center',
                                                cursor: 'pointer',
                                                backgroundColor: copyTargets.includes(project.id) ? '#eff6ff' : 'transparent',
                                                transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => !copyTargets.includes(project.id) && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                            onMouseLeave={e => !copyTargets.includes(project.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <div style={{
                                                width: '20px', height: '20px',
                                                borderRadius: '6px',
                                                border: `2px solid ${copyTargets.includes(project.id) ? '#3b82f6' : '#cbd5e1'}`,
                                                backgroundColor: copyTargets.includes(project.id) ? '#3b82f6' : 'white',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                marginRight: '16px',
                                                color: 'white',
                                                transition: 'all 0.2s'
                                            }}>
                                                {copyTargets.includes(project.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>{project.name}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>{project.squads ? project.squads.join(', ') : 'No Squad'}</div>
                                            </div>
                                        </div>
                                    ))}
                                {allProjects.filter(p => !allocations.some(a => a.projectId === p.id)).length === 0 && (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                        No other available projects to copy to.
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                <button
                                    onClick={() => { setCopySource(null); setCopyTargets([]); }}
                                    style={{
                                        padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}
                                >
                                    Cancel Copy
                                </button>
                                <button
                                    onClick={handleCopyConfirm}
                                    disabled={copyTargets.length === 0}
                                    style={{
                                        padding: '12px 24px', borderRadius: '12px', border: 'none',
                                        backgroundColor: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '700',
                                        cursor: copyTargets.length === 0 ? 'not-allowed' : 'pointer',
                                        opacity: copyTargets.length === 0 ? 0.5 : 1,
                                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.25)'
                                    }}
                                >
                                    Copy to {copyTargets.length} Projects
                                </button>
                            </div>
                        </div>
                    ) : (
                        allocations.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '64px',
                                color: '#94a3b8',
                                border: '2px dashed #cbd5e1',
                                borderRadius: '24px',
                                backgroundColor: '#f8fafc'
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', margin: '0 0 8px 0' }}>No Active Allocations</h3>
                                <p style={{ margin: '0 0 24px 0', fontSize: '13px' }}>There are no projects assigned to {resource.name} for this period.</p>
                                <button style={{
                                    padding: '12px 24px', borderRadius: '12px',
                                    color: 'white', backgroundColor: '#3b82f6',
                                    border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.25)'
                                }}>
                                    + Add New Allocation
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {allocations.map((alloc) => {
                                    const typeColors = getTypeColor(alloc.type);
                                    return (
                                        <div key={alloc.id} style={{
                                            padding: '24px',
                                            border: `1px solid ${colors.border || '#e2e8f0'}`,
                                            borderRadius: '20px',
                                            backgroundColor: colors.bgCard || 'white',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
                                            transition: 'all 0.2s',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: typeColors.text, boxShadow: `0 0 0 4px ${typeColors.bg}` }}></div>
                                                    <h4 style={{ fontWeight: '800', color: colors.text || '#1e293b', margin: 0, fontSize: '16px' }}>{alloc.projectName}</h4>
                                                    <span style={{
                                                        fontSize: '11px', padding: '4px 10px', borderRadius: '8px',
                                                        fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        backgroundColor: typeColors.bg, color: typeColors.text, border: `1px solid ${typeColors.border}40`
                                                    }}>
                                                        {alloc.type}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setCopySource(alloc)}
                                                    title="Copy allocation to other projects"
                                                    style={{
                                                        padding: '8px 16px', borderRadius: '8px',
                                                        border: '1px solid #e2e8f0', backgroundColor: 'white',
                                                        color: '#64748b', fontSize: '12px', fontWeight: '600',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    {ICONS.COPY || <span>Copy</span>} Copy
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={toDateInputValue(alloc.start)}
                                                        onChange={(e) => updateAllocation(alloc.id, 'start', e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>End Date</label>
                                                    <input
                                                        type="date"
                                                        value={toDateInputValue(alloc.end)}
                                                        onChange={(e) => updateAllocation(alloc.id, 'end', e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Allocation %</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            value={Math.round(alloc.allocation * 100)}
                                                            onChange={(e) => updateAllocation(alloc.id, 'allocation', parseFloat(e.target.value) / 100)}
                                                            style={{ ...inputStyle, paddingRight: '30px', fontWeight: '700', color: '#3b82f6' }}
                                                        />
                                                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>%</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Status</label>
                                                    <div style={{
                                                        ...inputStyle, backgroundColor: '#f1f5f9', color: '#94a3b8',
                                                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'not-allowed'
                                                    }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00BD00' }}></div>
                                                        Active
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button style={{
                                    width: '100%',
                                    padding: '16px',
                                    border: '2px dashed #e2e8f0',
                                    borderRadius: '16px',
                                    backgroundColor: 'transparent',
                                    color: '#64748b',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    + Add Another Project
                                </button>
                            </div>
                        ))}
                </div>

                {/* Footer */}
                {saveError && (
                    <div style={{
                        padding: '12px 40px',
                        backgroundColor: colors.dangerBg || '#fef2f2',
                        color: colors.danger || '#ef4444',
                        borderTop: `1px solid ${colors.danger || '#ef4444'}`,
                        fontSize: '13px',
                        fontWeight: '600'
                    }}>
                        {saveError}
                    </div>
                )}
                <div style={{
                    padding: '24px 40px',
                    borderTop: `1px solid ${colors.borderLight || '#f1f5f9'}`,
                    backgroundColor: colors.bgModal || 'white',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '16px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 28px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            backgroundColor: colors.bgModal || 'white',
                            border: `1px solid ${colors.border || '#e2e8f0'}`,
                            color: colors.textSecondary || '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.bgHover || '#f8fafc'; e.currentTarget.style.color = colors.text || '#1e293b'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.bgModal || 'white'; e.currentTarget.style.color = colors.textSecondary || '#64748b'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            padding: '12px 32px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '700',
                            backgroundColor: '#3b82f6',
                            border: 'none',
                            color: 'white',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                        onMouseEnter={e => !isSaving && (e.currentTarget.style.transform = 'translateY(-1px)')}
                        onMouseLeave={e => !isSaving && (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                        {isSaving && <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle><path d="M4 12a8 8 0 018-8v8H4z" strokeOpacity="0.75"></path></svg>}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// PropTypes for runtime type validation
AllocationModal.propTypes = {
    /** Resource object with allocation data */
    resource: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        projects: PropTypes.array
    }),
    /** Selected date key (week start) */
    dateKey: PropTypes.string,
    /** All projects for dropdowns */
    allProjects: PropTypes.array,
    /** Close handler */
    onClose: PropTypes.func.isRequired,
    /** Save handler */
    onSave: PropTypes.func.isRequired,
    /** Settings for formatting */
    settings: PropTypes.object
};
