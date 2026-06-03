/**
 * ViewChangesModal - Display scenario changes in a modal
 * Extracted from Dashboard.jsx for maintainability
 * Enhanced with filters (Squad, Change Type, Customer) and Before/After team diff
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

const Z_INDEX = { MODAL_BACKDROP: 1000, MODAL: 1001 };

// ── Helper functions (module-level) ──────────────────────────

// A change entry may be stored either as the raw field map (current format)
// or wrapped as { changes, original } (legacy/persisted format). Normalize to
// the field map in one place.
const getChangeFields = (entry) => (entry && entry.changes) || entry || {};

const extractTeamMembers = (teamVal) => {
    if (!teamVal) return [];
    if (Array.isArray(teamVal)) return teamVal;
    if (typeof teamVal === 'object') {
        const members = [];
        ['pm', 'sc', 'pd'].forEach(role => {
            (teamVal[role] || []).forEach(m => {
                members.push({ ...m, role: role.toUpperCase() });
            });
        });
        return members;
    }
    return [];
};

const getMemberName = (member, allResources) => {
    if (!member) return 'Unknown';
    if (typeof member === 'string') {
        // Try to resolve from allResources by ID
        if (allResources) {
            const found = allResources.find(r => r.id === member);
            if (found?.name) return found.name;
        }
        return member;
    }
    if (member.name) return member.name;
    // Try to resolve by id from allResources
    if (member.id && allResources) {
        const found = allResources.find(r => r.id === member.id);
        if (found?.name) return found.name;
    }
    return 'Unknown';
};

const getMemberId = (member) => {
    if (!member) return null;
    if (typeof member === 'string') return member;
    return member.id || member.name || null;
};

// ── FilterPill (module-level component) ──────────────────────

const FilterPill = ({ label, options, activeSet, onToggle }) => {
    const [open, setOpen] = useState(false);
    if (options.length === 0) return null;
    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: activeSet.size > 0 ? '1px solid #818cf8' : '1px solid #e2e8f0',
                    backgroundColor: activeSet.size > 0 ? '#f0fdf4' : 'white',
                    color: activeSet.size > 0 ? '#082F24' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                }}
            >
                {label}
                {activeSet.size > 0 && (
                    <span style={{
                        backgroundColor: '#818cf8',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        minWidth: '14px',
                        textAlign: 'center'
                    }}>
                        {activeSet.size}
                    </span>
                )}
                <svg style={{ width: '10px', height: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        minWidth: '160px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                        padding: '4px'
                    }}>
                        {options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => onToggle(opt)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    border: 'none',
                                    backgroundColor: activeSet.has(opt) ? '#f0fdf4' : 'transparent',
                                    color: '#1e293b',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    textAlign: 'left',
                                    fontWeight: activeSet.has(opt) ? '600' : '400'
                                }}
                            >
                                <div style={{
                                    width: '14px', height: '14px',
                                    borderRadius: '3px',
                                    border: activeSet.has(opt) ? '2px solid #818cf8' : '2px solid #cbd5e1',
                                    backgroundColor: activeSet.has(opt) ? '#818cf8' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {activeSet.has(opt) && (
                                        <svg style={{ width: '8px', height: '8px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                {opt}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ── TeamDiff (module-level component) ────────────────────────

const TeamDiff = ({ original, changed, allResources }) => {
    const beforeMembers = extractTeamMembers(original);
    const afterMembers = extractTeamMembers(changed);

    const beforeIds = new Set(beforeMembers.map(getMemberId).filter(Boolean));
    const afterIds = new Set(afterMembers.map(getMemberId).filter(Boolean));

    const removed = beforeMembers.filter(m => !afterIds.has(getMemberId(m)));
    const added = afterMembers.filter(m => !beforeIds.has(getMemberId(m)));

    return (
        <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Team</div>

            {/* Before */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{
                    fontSize: '10px', fontWeight: '700', color: '#94a3b8',
                    textTransform: 'uppercase', minWidth: '42px', paddingTop: '2px', flexShrink: 0
                }}>Before</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {beforeMembers.length > 0 ? beforeMembers.map((m, i) => {
                        const isRemoved = !afterIds.has(getMemberId(m));
                        return (
                            <span key={i} style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: isRemoved ? '#fef2f2' : '#f8fafc',
                                color: isRemoved ? '#dc2626' : '#475569',
                                textDecoration: isRemoved ? 'line-through' : 'none',
                                border: `1px solid ${isRemoved ? '#fecaca' : '#f1f5f9'}`,
                                fontWeight: isRemoved ? '600' : '400'
                            }}>
                                {getMemberName(m, allResources)}
                            </span>
                        );
                    }) : <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>None</span>}
                </div>
            </div>

            {/* After */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{
                    fontSize: '10px', fontWeight: '700', color: '#94a3b8',
                    textTransform: 'uppercase', minWidth: '42px', paddingTop: '2px', flexShrink: 0
                }}>After</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {afterMembers.length > 0 ? afterMembers.map((m, i) => {
                        const isAdded = !beforeIds.has(getMemberId(m));
                        return (
                            <span key={i} style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: isAdded ? '#f0fdf4' : '#f8fafc',
                                color: isAdded ? '#16a34a' : '#475569',
                                border: `1px solid ${isAdded ? '#bbf7d0' : '#f1f5f9'}`,
                                fontWeight: isAdded ? '700' : '400'
                            }}>
                                {isAdded && '+ '}{getMemberName(m, allResources)}
                            </span>
                        );
                    }) : <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>None</span>}
                </div>
            </div>

            {/* Summary line */}
            {(removed.length > 0 || added.length > 0) && (
                <div style={{ marginTop: '6px', paddingLeft: '48px', display: 'flex', gap: '12px', fontSize: '10px' }}>
                    {removed.length > 0 && (
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>
                            − {removed.length} removed
                        </span>
                    )}
                    {added.length > 0 && (
                        <span style={{ color: '#16a34a', fontWeight: '600' }}>
                            + {added.length} added
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * @param {Object} props
 * @param {Object} props.activeScenario - The active scenario object
 * @param {Array} props.allProjects - All projects for name lookup
 * @param {Array} props.allResources - All resources for name lookup
 * @param {Object} props.scenarioManager - Scenario manager for persisting changes
 * @param {Function} props.setScenarios - Setter for scenarios list
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.addToast - Toast notification function
 */
export const ViewChangesModal = ({
    activeScenario,
    allProjects,
    allResources,
    scenarioManager,
    setScenarios,
    onClose,
    addToast
}) => {
    const [changeToDelete, setChangeToDelete] = useState(null);

    // Filter state
    const [filterSquad, setFilterSquad] = useState(new Set());
    const [filterChangeType, setFilterChangeType] = useState(new Set());
    const [filterCustomer, setFilterCustomer] = useState(new Set());

    // Helper to format date values
    const formatDateValue = (val) => {
        if (!val) return '—';
        if (val instanceof Date) return val.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        if (typeof val === 'string') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            return val.split('T')[0];
        }
        return String(val);
    };

    const handleRevertChange = async () => {
        if (!activeScenario || !scenarioManager || !changeToDelete) return;
        try {
            const updatedChanges = {
                projects: { ...(activeScenario.changes?.projects || {}) },
                resources: { ...(activeScenario.changes?.resources || {}) }
            };

            if (changeToDelete.type === 'project') {
                delete updatedChanges.projects[changeToDelete.id];
            } else if (changeToDelete.type === 'resource') {
                delete updatedChanges.resources[changeToDelete.id];
            }

            const metadata = {
                ...activeScenario.metadata,
                totalChanges: Object.keys(updatedChanges.projects).length + Object.keys(updatedChanges.resources).length,
                lastSavedAt: new Date().toISOString()
            };

            // Persist first, then update in-memory state only on success.
            // This avoids leaving the UI showing a reverted change that never
            // actually saved (no rollback path needed since state isn't touched
            // until persistence resolves).
            await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);
            setScenarios(prev => prev.map(s => {
                if (s.id === activeScenario.id) {
                    return { ...s, changes: updatedChanges, metadata };
                }
                return s;
            }));
            addToast({ type: 'success', title: 'Change reverted', duration: 2000 });
            setChangeToDelete(null);
        } catch (err) {
            console.error('Failed to revert change:', err);
            addToast({ type: 'error', title: 'Failed to revert', message: err.message });
        }
    };

    const projectChanges = activeScenario.changes?.projects || {};
    const resourceChanges = activeScenario.changes?.resources || {};
    const hasNoChanges = Object.keys(projectChanges).length === 0 && Object.keys(resourceChanges).length === 0;

    // Derive filter options from changed projects
    const filterOptions = useMemo(() => {
        const squads = new Set();
        const changeTypes = new Set();
        const customers = new Set();

        Object.entries(projectChanges).forEach(([projectId, changes]) => {
            const project = allProjects?.find(p => p.id === projectId);
            const squad = project?.squads?.[0] || project?.squad;
            if (squad) squads.add(squad);
            const customer = project?.customer;
            if (customer) customers.add(customer);

            const changeFields = getChangeFields(changes);
            if (changeFields.status) changeTypes.add('Status');
            if (changeFields.squad !== undefined) changeTypes.add('Squad');
            if (changeFields.kickOff || changeFields.start || changeFields.launch || changeFields.end) changeTypes.add('Dates');
            if (changeFields.team) changeTypes.add('Team');
            if (changeFields.effortProfile) changeTypes.add('Effort Profile');
            if (changeFields.wave !== undefined) changeTypes.add('Wave');
        });

        return {
            squads: [...squads].sort(),
            changeTypes: [...changeTypes].sort(),
            customers: [...customers].sort()
        };
    }, [projectChanges, allProjects]);

    const hasActiveFilters = filterSquad.size > 0 || filterChangeType.size > 0 || filterCustomer.size > 0;

    const clearAllFilters = () => {
        setFilterSquad(new Set());
        setFilterChangeType(new Set());
        setFilterCustomer(new Set());
    };

    const toggleFilter = (setter, value) => {
        setter(prev => {
            const next = new Set(prev);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    // Filtered project changes
    const filteredProjectChanges = useMemo(() => {
        if (!hasActiveFilters) return projectChanges;

        const filtered = {};
        Object.entries(projectChanges).forEach(([projectId, changes]) => {
            const project = allProjects?.find(p => p.id === projectId);
            const squad = project?.squads?.[0] || project?.squad || '';
            const customer = project?.customer || '';
            const changeFields = getChangeFields(changes);

            // Squad filter
            if (filterSquad.size > 0 && !filterSquad.has(squad)) return;

            // Customer filter
            if (filterCustomer.size > 0 && !filterCustomer.has(customer)) return;

            // Change type filter
            if (filterChangeType.size > 0) {
                const types = new Set();
                if (changeFields.status) types.add('Status');
                if (changeFields.squad !== undefined) types.add('Squad');
                if (changeFields.kickOff || changeFields.start || changeFields.launch || changeFields.end) types.add('Dates');
                if (changeFields.team) types.add('Team');
                if (changeFields.effortProfile) types.add('Effort Profile');
                if (changeFields.wave !== undefined) types.add('Wave');
                const hasMatch = [...filterChangeType].some(t => types.has(t));
                if (!hasMatch) return;
            }

            filtered[projectId] = changes;
        });
        return filtered;
    }, [projectChanges, allProjects, filterSquad, filterChangeType, filterCustomer, hasActiveFilters]);


    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                width: '100%',
                maxWidth: '720px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to right, #f8fafc, #f1f5f9)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                            Changes in "{activeScenario.name}"
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                            {activeScenario.metadata?.totalChanges || 0} total changes
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#94a3b8'
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filter Bar */}
                {!hasNoChanges && Object.keys(projectChanges).length > 0 && (
                    <div style={{
                        padding: '12px 24px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        backgroundColor: '#fafbfc'
                    }}>
                        <svg style={{ width: '14px', height: '14px', color: '#94a3b8', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        <FilterPill
                            label="Squad"
                            options={filterOptions.squads}
                            activeSet={filterSquad}
                            onToggle={(v) => toggleFilter(setFilterSquad, v)}
                        />
                        <FilterPill
                            label="Change Type"
                            options={filterOptions.changeTypes}
                            activeSet={filterChangeType}
                            onToggle={(v) => toggleFilter(setFilterChangeType, v)}
                        />
                        <FilterPill
                            label="Customer"
                            options={filterOptions.customers}
                            activeSet={filterCustomer}
                            onToggle={(v) => toggleFilter(setFilterCustomer, v)}
                        />
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#E5554F',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginLeft: 'auto'
                                }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
                    {/* Empty State */}
                    {hasNoChanges && (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#94a3b8',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            border: '1px dashed #e2e8f0'
                        }}>
                            <div style={{
                                backgroundColor: '#f1f5f9',
                                borderRadius: '50%',
                                width: '64px', height: '64px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <svg style={{ width: '32px', height: '32px', color: '#cbd5e1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>No changes yet</h4>
                            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                                Make edits to projects or resources to see them here.
                            </p>
                        </div>
                    )}

                    {/* Filtered empty state */}
                    {!hasNoChanges && Object.keys(filteredProjectChanges).length === 0 && hasActiveFilters && Object.keys(resourceChanges).length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#94a3b8',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            border: '1px dashed #e2e8f0'
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>No changes match your filters</div>
                            <button
                                onClick={clearAllFilters}
                                style={{
                                    marginTop: '12px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#082F24',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}

                    {/* Project Changes */}
                    {Object.keys(filteredProjectChanges).length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <div style={{
                                    backgroundColor: '#dbeafe', color: '#1d4ed8',
                                    padding: '4px 8px', borderRadius: '6px',
                                    fontSize: '12px', fontWeight: '700'
                                }}>
                                    PROJECTS
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                                    {Object.keys(filteredProjectChanges).length} Modified
                                    {hasActiveFilters && Object.keys(filteredProjectChanges).length !== Object.keys(projectChanges).length && (
                                        <span style={{ color: '#94a3b8', fontWeight: '400' }}> (of {Object.keys(projectChanges).length})</span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {Object.entries(filteredProjectChanges).map(([projectId, changes]) => {
                                    const project = allProjects?.find(p => p.id === projectId);
                                    const originalStatus = project?.status || '—';
                                    const originalSquad = (project?.squads?.[0]) || project?.squad || '—';
                                    const originalKickOff = formatDateValue(project?.kickOff || project?.start);
                                    const originalLaunch = formatDateValue(project?.launch || project?.end);
                                    const changeFields = getChangeFields(changes);
                                    const originalData = changes.original || {};

                                    return (
                                        <div key={projectId} style={{
                                            backgroundColor: 'white',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                padding: '16px 20px',
                                                borderBottom: '1px solid #f1f5f9',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#eff6ff',
                                                        color: '#4794FF',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                                                            {project?.name || projectId}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            {project?.customer || 'Internal Project'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setChangeToDelete({ type: 'project', id: projectId, name: project?.name || projectId })}
                                                    style={{
                                                        padding: '6px 10px',
                                                        color: '#94a3b8',
                                                        backgroundColor: 'transparent',
                                                        border: '1px solid transparent',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}
                                                >
                                                    <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Revert
                                                </button>
                                            </div>
                                            <div style={{ padding: '16px 20px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                                    {changeFields.status && (
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '12px', color: '#64748b', textDecoration: 'line-through' }}>{originalStatus}</span>
                                                                <span style={{ color: '#94a3b8' }}>→</span>
                                                                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{changeFields.status}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {changeFields.squad !== undefined && (
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Squad</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '12px', color: '#64748b', textDecoration: 'line-through' }}>{originalSquad || '—'}</span>
                                                                <span style={{ color: '#94a3b8' }}>→</span>
                                                                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{changeFields.squad || '—'}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(changeFields.kickOff || changeFields.start) && (
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Kick-off</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '12px', color: '#64748b', textDecoration: 'line-through' }}>{originalKickOff}</span>
                                                                <span style={{ color: '#94a3b8' }}>→</span>
                                                                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{formatDateValue(changeFields.kickOff || changeFields.start)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(changeFields.launch || changeFields.end) && (
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Launch</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '12px', color: '#64748b', textDecoration: 'line-through' }}>{originalLaunch}</span>
                                                                <span style={{ color: '#94a3b8' }}>→</span>
                                                                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{formatDateValue(changeFields.launch || changeFields.end)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {changeFields.team && (
                                                        <TeamDiff
                                                            original={originalData.team || project?.team || {}}
                                                            changed={changeFields.team}
                                                            allResources={allResources}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Resource Changes */}
                    {Object.keys(resourceChanges).length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <div style={{
                                    backgroundColor: '#dcfce7', color: '#166534',
                                    padding: '4px 8px', borderRadius: '6px',
                                    fontSize: '12px', fontWeight: '700'
                                }}>
                                    RESOURCES
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                                    {Object.keys(resourceChanges).length} Modified
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {Object.entries(resourceChanges).map(([resourceId, changes]) => {
                                    const resource = allResources?.find(r => r.id === resourceId);
                                    return (
                                        <div key={resourceId} style={{
                                            backgroundColor: 'white',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                            overflow: 'hidden',
                                            padding: '16px 20px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                    </div>
                                                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                                                        {resource?.name || resourceId}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setChangeToDelete({ type: 'resource', id: resourceId, name: resource?.name || resourceId })}
                                                    style={{
                                                        padding: '6px 10px',
                                                        color: '#94a3b8',
                                                        backgroundColor: 'transparent',
                                                        border: '1px solid transparent',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    Revert
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                {Object.keys(getChangeFields(changes)).join(', ')} modified
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Overlay */}
            {changeToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: Z_INDEX.MODAL
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        width: '100%',
                        maxWidth: '400px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #e2e8f0'
                        }}>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                                Revert Change?
                            </h4>
                            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
                                This will remove the changes to <strong>"{changeToDelete.name}"</strong> from this scenario.
                            </p>
                        </div>
                        <div style={{
                            padding: '16px 24px',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setChangeToDelete(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRevertChange}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#E5554F',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Revert
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

ViewChangesModal.propTypes = {
    activeScenario: PropTypes.object.isRequired,
    allProjects: PropTypes.array,
    allResources: PropTypes.array,
    scenarioManager: PropTypes.object,
    setScenarios: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    addToast: PropTypes.func.isRequired
};

export default ViewChangesModal;
