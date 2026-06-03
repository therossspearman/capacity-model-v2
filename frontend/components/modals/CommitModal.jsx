/**
 * CommitModal - Scenario commit confirmation modal with selective commit
 * Allows users to choose which changes to commit to live Airtable data
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX } from '../../design-system';

/* ── Checkbox component ── */
const CheckboxRow = ({ checked, onChange, label, detail, color = '#059669' }) => (
    <div
        onClick={() => onChange(!checked)}
        style={{
            padding: '8px 12px',
            backgroundColor: checked ? '#f0fdf4' : '#f8fafc',
            borderRadius: '6px',
            border: `1px solid ${checked ? '#bbf7d0' : '#e2e8f0'}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            transition: 'all 0.15s ease',
            opacity: checked ? 1 : 0.65
        }}
    >
        <div style={{
            width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, marginTop: '1px',
            border: checked ? 'none' : '2px solid #cbd5e1',
            background: checked ? `linear-gradient(135deg, ${color}, #00BD00)` : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease'
        }}>
            {checked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            {detail && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div>}
        </div>
    </div>
);

/**
 * @param {Object} props
 * @param {Object} props.activeScenario - The active scenario object
 * @param {Array} props.allProjects - All projects for name lookup
 * @param {Array} props.allResources - All resources for name lookup
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onCommit - Commit handler, receives selection object
 */
export const CommitModal = ({
    activeScenario,
    allProjects,
    allResources,
    onClose,
    onCommit
}) => {
    const projectChanges = activeScenario.changes?.projects || {};
    const resourceChanges = activeScenario.changes?.resources || {};
    const programAssignments = activeScenario.changes?.programAssignments || [];

    const projectIds = useMemo(() => Object.keys(projectChanges), [projectChanges]);
    const resourceIds = useMemo(() => Object.keys(resourceChanges), [resourceChanges]);
    const hasPrograms = programAssignments.length > 0;

    // Group program assignments by customer
    const programsByCustomer = useMemo(() => {
        const grouped = {};
        programAssignments.forEach(a => {
            if (!grouped[a.customer]) grouped[a.customer] = [];
            grouped[a.customer].push(a);
        });
        return grouped;
    }, [programAssignments]);
    const programCustomerList = useMemo(() => Object.keys(programsByCustomer), [programsByCustomer]);

    // Selection state — all checked by default
    const [selectedProjects, setSelectedProjects] = useState(() => new Set(projectIds));
    const [selectedResources, setSelectedResources] = useState(() => new Set(resourceIds));
    const [selectedPrograms, setSelectedPrograms] = useState(() => new Set(programCustomerList));

    const totalItems = projectIds.length + resourceIds.length + programCustomerList.length;
    const selectedCount = selectedProjects.size + selectedResources.size + selectedPrograms.size;
    const allSelected = selectedCount === totalItems;
    const noneSelected = selectedCount === 0;

    const toggleProject = (id, checked) => {
        setSelectedProjects(prev => {
            const next = new Set(prev);
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    };
    const toggleResource = (id, checked) => {
        setSelectedResources(prev => {
            const next = new Set(prev);
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    };
    const toggleAll = (checked) => {
        setSelectedProjects(checked ? new Set(projectIds) : new Set());
        setSelectedResources(checked ? new Set(resourceIds) : new Set());
        setSelectedPrograms(checked ? new Set(programCustomerList) : new Set());
    };

    const handleCommit = () => {
        if (noneSelected) return;
        // If all selected, pass null to signal "commit everything" (backwards-compatible)
        if (allSelected) {
            onCommit(null);
        } else {
            onCommit({
                projectIds: [...selectedProjects],
                resourceIds: [...selectedResources],
                commitPrograms: selectedPrograms.size > 0,
                commitProgramCustomers: [...selectedPrograms]
            });
        }
    };

    const formatChangeDetail = (change) => {
        const fields = change.changes || change;
        return Object.entries(fields)
            .filter(([k]) => !['name', 'original', 'changes'].includes(k))
            .map(([k, v]) => {
                if (k === 'team') return 'team assignments';
                if (typeof v === 'object' && v !== null) return k;
                return `${k}: ${v}`;
            })
            .join(' · ');
    };


    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.MODAL,
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '560px',
                maxWidth: '95vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    background: 'linear-gradient(135deg, #059669 0%, #00BD00 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Commit to Live Data</h2>
                            <p style={{ fontSize: '13px', opacity: 0.9, margin: '4px 0 0 0' }}>
                                Select changes from &ldquo;{activeScenario.name}&rdquo; to commit
                            </p>
                        </div>
                    </div>
                </div>

                {/* Warning Banner */}
                <div style={{
                    padding: '10px 24px',
                    backgroundColor: '#fffbeb',
                    borderBottom: '1px solid #fde68a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <svg style={{ width: '16px', height: '16px', color: '#FE9922', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '500' }}>
                        Selected changes will permanently overwrite live Airtable values.
                    </span>
                </div>

                {/* Select All bar */}
                <div style={{
                    padding: '10px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            onClick={() => toggleAll(!allSelected)}
                            style={{
                                width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer',
                                border: allSelected ? 'none' : '2px solid #cbd5e1',
                                background: allSelected ? 'linear-gradient(135deg, #059669, #00BD00)' : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {allSelected && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }} onClick={() => toggleAll(!allSelected)}>
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                        {selectedCount} of {totalItems} selected
                    </span>
                </div>

                {/* Scrollable Changes List */}
                <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>

                    {/* Project Changes */}
                    {projectIds.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg style={{ width: '14px', height: '14px', color: '#4794FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Projects ({projectIds.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {projectIds.map(id => {
                                    const project = allProjects?.find(p => p.id === id);
                                    return (
                                        <CheckboxRow
                                            key={id}
                                            checked={selectedProjects.has(id)}
                                            onChange={(c) => toggleProject(id, c)}
                                            label={project?.name || id}
                                            detail={formatChangeDetail(projectChanges[id])}
                                            color="#4794FF"
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Resource Changes */}
                    {resourceIds.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg style={{ width: '14px', height: '14px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Resources ({resourceIds.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {resourceIds.map(id => {
                                    const resource = allResources?.find(r => r.id === id);
                                    const detail = formatChangeDetail(resourceChanges[id]);
                                    return (
                                        <CheckboxRow
                                            key={id}
                                            checked={selectedResources.has(id)}
                                            onChange={(c) => toggleResource(id, c)}
                                            label={resource?.name || id}
                                            detail={detail}
                                            color="#00BD00"
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Program Assignments */}
                    {hasPrograms && (
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg style={{ width: '14px', height: '14px', color: '#FE9922' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Program Assignments
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {programCustomerList.map(customer => {
                                    const assignments = programsByCustomer[customer];
                                    const resourceNames = [...new Set(assignments.map(a => {
                                        const res = allResources?.find(r => r.id === a.resourceId);
                                        return res?.name || a.resourceName || 'Unknown';
                                    }))];
                                    const wsNames = [...new Set(assignments.map(a => a.workstream))];
                                    return (
                                        <CheckboxRow
                                            key={customer}
                                            checked={selectedPrograms.has(customer)}
                                            onChange={(c) => {
                                                setSelectedPrograms(prev => {
                                                    const next = new Set(prev);
                                                    c ? next.add(customer) : next.delete(customer);
                                                    return next;
                                                });
                                            }}
                                            label={`${customer} — ${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`}
                                            detail={`${wsNames.join(', ')} · ${resourceNames.join(', ')}`}
                                            color="#FE9922"
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* No Changes */}
                    {totalItems === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                            <p>No changes to commit</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc'
                }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {!allSelected && selectedCount > 0 && 'Unselected changes will remain in draft'}
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '9px 18px',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                color: '#64748b',
                                fontSize: '13px',
                                fontWeight: '600',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCommit}
                            disabled={noneSelected}
                            style={{
                                padding: '9px 20px',
                                background: noneSelected
                                    ? '#cbd5e1'
                                    : 'linear-gradient(135deg, #059669 0%, #00BD00 100%)',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '700',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: noneSelected ? 'not-allowed' : 'pointer',
                                boxShadow: noneSelected ? 'none' : '0 4px 14px rgba(5, 150, 105, 0.4)',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {allSelected
                                ? `✓ Commit All (${totalItems})`
                                : `✓ Commit Selected (${selectedCount})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

CommitModal.propTypes = {
    activeScenario: PropTypes.object.isRequired,
    allProjects: PropTypes.array,
    allResources: PropTypes.array,
    onClose: PropTypes.func.isRequired,
    onCommit: PropTypes.func.isRequired
};

export default CommitModal;
