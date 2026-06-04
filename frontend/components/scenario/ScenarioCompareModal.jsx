import React, { useState, useMemo } from 'react';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { deriveFyWindow, calculateProjectRevenue } from '../../utils/revenueRecognition';

export const ScenarioCompareModal = ({ scenarios, activeScenario, onClose, revRecTotals, liveRevenueData, periodContext, allProjects = [], onMerge, onMergeToNew, onMultiMerge, onMultiMergeToNew }) => {
    const { isDark, colors } = useTheme();

    // Multi-select: set of selected scenario IDs
    const [selectedIds, setSelectedIds] = useState(() => {
        const initial = new Set();
        if (activeScenario && activeScenario.id !== 'live') {
            initial.add(activeScenario.id);
        }
        return initial;
    });

    // Track which scenario rows are expanded to show details
    const [expandedIds, setExpandedIds] = useState(new Set());

    const toggleScenario = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleExpanded = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(scenarios.map(s => s.id)));
    };

    const clearAll = () => {
        setSelectedIds(new Set());
    };

    // Merge modal state
    const [showMergeConfirm, setShowMergeConfirm] = useState(false);
    const [showMergeToNewInput, setShowMergeToNewInput] = useState(false);
    const [mergeNewName, setMergeNewName] = useState('');
    const [mergeTargetId, setMergeTargetId] = useState(null); // For multi-merge: which scenario to merge INTO

    // Calculate live revenue from base projects
    // Use the passed context-aware live totals if available, otherwise fall back to worker totals (legacy)
    const liveRevenue = useMemo(() => {
        if (liveRevenueData?.totals) {
            return {
                implFee: { fullYear: liveRevenueData.totals.implFee },
                arr: { fullYear: liveRevenueData.totals.arr },
                total: { fullYear: liveRevenueData.totals.total }
            };
        }
        return revRecTotals || {
            implFee: { fullYear: 0 },
            arr: { fullYear: 0 },
            total: { fullYear: 0 }
        };
    }, [revRecTotals, liveRevenueData]);

    // Get change details for a scenario - now with name lookups
    const getScenarioChanges = (scenario, projectList) => {
        const changes = scenario.changes || {};
        const projectChanges = changes.projects || {};
        const resourceChanges = changes.resources || {};

        const projectDiffs = [];
        const resourceDiffs = [];

        // Build lookup maps for names
        const projectNameMap = {};
        projectList.forEach(p => { projectNameMap[p.id] = p.name; });

        // Parse project changes.
        // NOTE: scenario.changes.projects[id] has two historical persisted shapes:
        //   - current:  { changes: { launch, kickOff, ... }, original: { ... }, name }
        //   - legacy:   { launch, kickOff, ... }   (fields stored flat on the entry)
        // The `data.changes || data` / `innerData.changes || innerData` chains below
        // unwrap both: prefer the nested `.changes` bag when present, else treat the
        // entry itself as the field bag.
        for (const [projectId, data] of Object.entries(projectChanges)) {
            const innerData = data.changes || data;
            const changeFields = innerData.changes || innerData;
            const originals = innerData.original || data.original || {};
            // Look up name from projects array, fall back to stored name, then ID
            const projectName = projectNameMap[projectId] || innerData.name || data.name || projectId;

            const fieldChanges = [];
            if (changeFields.kickOff) fieldChanges.push({ field: 'Kick-off', from: originals.kickOff, to: changeFields.kickOff });
            if (changeFields.launch) fieldChanges.push({ field: 'Launch', from: originals.launch, to: changeFields.launch });
            if (changeFields.status) fieldChanges.push({ field: 'Status', from: originals.status, to: changeFields.status });
            if (changeFields.squad) fieldChanges.push({ field: 'Squad', from: originals.squad, to: changeFields.squad });
            if (changeFields.effortProfile) fieldChanges.push({ field: 'Effort Profile', from: originals.effortProfile, to: changeFields.effortProfile });

            if (fieldChanges.length > 0) {
                projectDiffs.push({ id: projectId, name: projectName, changes: fieldChanges });
            }
        }

        // Parse resource changes (resources not passed in, use stored names)
        for (const [resourceId, data] of Object.entries(resourceChanges)) {
            const innerData = data.changes || data;
            const changeFields = innerData.changes || innerData;
            const originals = innerData.original || data.original || {};
            const resourceName = innerData.name || data.name || resourceId;

            const fieldChanges = [];
            if (changeFields.startDate) fieldChanges.push({ field: 'Start Date', from: originals.startDate, to: changeFields.startDate });
            if (changeFields.leaveDate) fieldChanges.push({ field: 'Termination Date', from: originals.leaveDate, to: changeFields.leaveDate });
            if (changeFields.squad) fieldChanges.push({ field: 'Squad', from: originals.squad, to: changeFields.squad });
            if (changeFields.rampProfile) fieldChanges.push({ field: 'Ramp Profile', from: originals.rampProfile, to: changeFields.rampProfile });

            if (fieldChanges.length > 0) {
                resourceDiffs.push({ id: resourceId, name: resourceName, changes: fieldChanges });
            }
        }

        return { projects: projectDiffs, resources: resourceDiffs };
    };

    // Calculate revenue for each selected scenario
    // This now does FULL recalculation by applying all scenario changes to projects
    const scenarioRevenues = useMemo(() => {
        const results = [];

        // Baseline values from live data
        const liveImplFee = liveRevenue.implFee?.fullYear || 0;
        const liveArr = liveRevenue.arr?.fullYear || 0;
        const liveTotal = liveRevenue.total?.fullYear || 0;

        // FY window + per-project revenue recognition now live in a shared module
        // (utils/revenueRecognition.js) that mirrors the canonical worker algorithm —
        // see that file's header. This removes the hand-duplicated copy that used to
        // live inline here and could drift from the worker.
        const { fyStart, fyEnd } = deriveFyWindow(periodContext);

        for (const id of selectedIds) {
            const scenario = scenarios.find(s => s.id === id);
            if (!scenario) continue;

            const changes = scenario.changes || {};
            const projectChanges = changes.projects || {};
            const financialAdjustments = changes.financialAdjustments || [];

            // Build effective projects list by applying scenario changes
            let scenarioImplFee = 0;
            let scenarioArr = 0;

            // NOTE: revenue here intentionally mirrors the canonical worker algorithm
            // (calculateProjectRevenue ignores project status — status is NOT a revenue
            // gate, so the live baseline and scenario totals stay consistent). Resource
            // changes are surfaced in changeDetails for display only and deliberately do
            // not feed revenue. The override chain below uses the same dual-shape unwrap
            // (changeData.changes || changeData) documented in getScenarioChanges.
            allProjects.forEach(baseProject => {
                // Create effective project with scenario overrides
                const changeData = projectChanges[baseProject.id];
                let effectiveProject = { ...baseProject };

                if (changeData) {
                    const innerData = changeData.changes || changeData;
                    const changedFields = innerData.changes || innerData;

                    // Apply all field changes
                    if (changedFields.launch !== undefined) effectiveProject.launch = changedFields.launch;
                    if (changedFields.kickOff !== undefined) effectiveProject.kickOff = changedFields.kickOff;
                    if (changedFields.start !== undefined) effectiveProject.start = changedFields.start;
                    if (changedFields.end !== undefined) effectiveProject.end = changedFields.end;
                    if (changedFields.status !== undefined) effectiveProject.status = changedFields.status;
                    if (changedFields.implFee !== undefined) effectiveProject.implFee = changedFields.implFee;
                    if (changedFields.arr !== undefined) effectiveProject.arr = changedFields.arr;
                    if (changedFields.revenueModel !== undefined) effectiveProject.revenueModel = changedFields.revenueModel;
                }

                // Calculate revenue for this effective project
                const projectRev = calculateProjectRevenue(effectiveProject, fyStart, fyEnd);
                scenarioImplFee += projectRev.implFee;
                scenarioArr += projectRev.arr;
            });

            // Add financial adjustments
            financialAdjustments.forEach(adj => {
                if (adj.type === 'implFee') scenarioImplFee += adj.amount;
                if (adj.type === 'arr') scenarioArr += adj.amount;
            });

            const total = scenarioImplFee + scenarioArr;
            const deltaImplFee = scenarioImplFee - liveImplFee;
            const deltaArr = scenarioArr - liveArr;
            const deltaTotal = total - liveTotal;

            const changeDetails = getScenarioChanges(scenario, allProjects);
            const totalChanges = changeDetails.projects.length + changeDetails.resources.length;

            results.push({
                id: scenario.id,
                name: scenario.name,
                description: scenario.description,
                notes: scenario.metadata?.notes,
                status: scenario.status || 'Draft',
                changes: totalChanges,
                changeDetails,
                implFee: scenarioImplFee,
                arr: scenarioArr,
                total,
                deltaImplFee,
                deltaArr,
                deltaTotal
            });
        }

        return results;
    }, [selectedIds, scenarios, allProjects, liveRevenue]);

    const formatDelta = (value) => {
        if (value === 0) return { text: '—', color: colors.textMuted };
        const sign = value > 0 ? '+' : '';
        return {
            text: `${sign}£${Math.round(value).toLocaleString()}`,
            color: value > 0 ? '#00BD00' : '#dc2626'
        };
    };

    const formatValue = (val) => {
        if (!val) return '—';
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
            return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return String(val);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
                boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(0,0,0,0.25)',
                border: `1px solid ${colors.border}`,
                width: '100%',
                maxWidth: '1000px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.text, margin: 0 }}>Compare Scenarios</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                            Select scenarios to compare against live data
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = colors.bgAccent;
                            e.currentTarget.style.color = colors.text;
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = colors.bgAlt;
                            e.currentTarget.style.color = colors.textMuted;
                        }}
                        style={{
                            padding: '8px',
                            backgroundColor: colors.bgAlt,
                            border: 'none',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: colors.textMuted,
                            transition: 'all 0.2s ease'
                        }}
                    >{ICONS.CLOSE}</button>
                </div>

                {/* Scenario Selection */}
                <div style={{
                    padding: '16px 24px',
                    backgroundColor: colors.bgAlt,
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, marginRight: '8px' }}>
                        SELECT:
                    </span>
                    {scenarios.filter(s => s.status !== 'Committed').map(s => (
                        <button
                            key={s.id}
                            onClick={() => toggleScenario(s.id)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: selectedIds.has(s.id)
                                    ? '2px solid #082F24'
                                    : `1px solid ${colors.border}`,
                                backgroundColor: selectedIds.has(s.id)
                                    ? (isDark ? 'rgba(0, 189, 0, 0.2)' : '#F5EDE1')
                                    : colors.bgCard,
                                color: selectedIds.has(s.id) ? '#082F24' : colors.text,
                                fontSize: '13px',
                                fontWeight: selectedIds.has(s.id) ? '600' : '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            {selectedIds.has(s.id) && (
                                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {s.name}
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                            onClick={selectAll}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = colors.bgAccent;
                                e.currentTarget.style.borderColor = colors.primary;
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = colors.border;
                            }}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${colors.border}`,
                                backgroundColor: 'transparent',
                                color: colors.textSecondary,
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >Select All</button>
                        <button
                            onClick={clearAll}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = colors.bgAccent;
                                e.currentTarget.style.borderColor = colors.primary;
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = colors.border;
                            }}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${colors.border}`,
                                backgroundColor: 'transparent',
                                color: colors.textSecondary,
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >Clear</button>
                        {/* Merge buttons - show when 2+ scenarios selected */}
                        {selectedIds.size >= 2 && (
                            <>
                                {(onMerge || onMultiMerge) && (
                                    <button
                                        onClick={() => {
                                            // Set first selected as default target
                                            const ids = Array.from(selectedIds);
                                            setMergeTargetId(ids[ids.length - 1]); // Last selected = target
                                            setShowMergeConfirm(true);
                                        }}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #FF8EFB, #082F24)',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        Merge {selectedIds.size} Into
                                    </button>
                                )}
                                {(onMergeToNew || onMultiMergeToNew) && (
                                    <button
                                        onClick={() => {
                                            const ids = Array.from(selectedIds);
                                            const names = ids.map(id => scenarios.find(s => s.id === id)?.name || 'Scenario').slice(0, 3);
                                            const defaultName = names.length <= 3 ? names.join(' + ') : `${names.slice(0, 2).join(' + ')} +${ids.length - 2} more`;
                                            setMergeNewName(defaultName);
                                            setShowMergeToNewInput(true);
                                        }}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #00BD00, #059669)',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Merge {selectedIds.size} to New
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Merge Confirm Modal - supports 2+ scenarios */}
                {showMergeConfirm && selectedIds.size >= 2 && (() => {
                    const ids = Array.from(selectedIds);
                    const sourceIds = ids.filter(id => id !== mergeTargetId);
                    const sourceNames = sourceIds.map(id => scenarios.find(s => s.id === id)?.name || 'Unknown');
                    const targetScenario = scenarios.find(s => s.id === mergeTargetId);
                    const targetName = targetScenario?.name || 'Target';
                    const isMulti = ids.length > 2;

                    const handleMerge = () => {
                        if (isMulti && onMultiMerge) {
                            onMultiMerge(sourceIds, mergeTargetId);
                        } else if (onMerge && sourceIds.length === 1) {
                            onMerge(sourceIds[0], mergeTargetId);
                        } else if (onMultiMerge) {
                            onMultiMerge(sourceIds, mergeTargetId);
                        }
                        setShowMergeConfirm(false);
                    };

                    return (
                        <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}>
                            <div style={{
                                backgroundColor: colors.bgCard, borderRadius: '12px', padding: '24px',
                                maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                            }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: colors.textPrimary }}>
                                    Merge {ids.length} Scenarios
                                </h3>

                                {/* Target selector */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, marginBottom: '6px' }}>
                                        Merge INTO:
                                    </label>
                                    <select
                                        value={mergeTargetId || ''}
                                        onChange={(e) => setMergeTargetId(e.target.value)}
                                        style={{
                                            width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px',
                                            border: `1px solid ${colors.border}`, backgroundColor: colors.bgAlt, color: colors.textPrimary
                                        }}
                                    >
                                        {ids.map(id => {
                                            const s = scenarios.find(sc => sc.id === id);
                                            return <option key={id} value={id}>{s?.name || id}</option>;
                                        })}
                                    </select>
                                </div>

                                <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>
                                    {sourceNames.length === 1 ? (
                                        <>Merge "<strong>{sourceNames[0]}</strong>" into "<strong>{targetName}</strong>"</>
                                    ) : (
                                        <>Merge <strong>{sourceNames.length} scenarios</strong> into "<strong>{targetName}</strong>":<br />
                                            <span style={{ fontSize: '12px', color: colors.textMuted }}>{sourceNames.join(', ')}</span></>
                                    )}
                                </p>
                                <p style={{ margin: '0 0 20px', fontSize: '11px', color: colors.textMuted }}>
                                    Later scenarios in the selection take priority on conflicts.
                                </p>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowMergeConfirm(false)} style={{
                                        padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.border}`,
                                        backgroundColor: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}>Cancel</button>
                                    <button onClick={handleMerge} style={{
                                        padding: '8px 16px', borderRadius: '6px', border: 'none',
                                        background: 'linear-gradient(135deg, #FF8EFB, #082F24)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}>Merge {sourceNames.length} into Target</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Merge to New Input Modal - supports 2+ scenarios */}
                {showMergeToNewInput && selectedIds.size >= 2 && (() => {
                    const ids = Array.from(selectedIds);
                    const names = ids.map(id => scenarios.find(s => s.id === id)?.name || 'Unknown');
                    const isMulti = ids.length > 2;

                    const handleCreate = () => {
                        if (!mergeNewName.trim()) return;
                        if (isMulti && onMultiMergeToNew) {
                            onMultiMergeToNew(ids, mergeNewName.trim());
                        } else if (onMergeToNew && ids.length === 2) {
                            onMergeToNew(ids[0], ids[1], mergeNewName.trim());
                        } else if (onMultiMergeToNew) {
                            onMultiMergeToNew(ids, mergeNewName.trim());
                        }
                        setShowMergeToNewInput(false);
                    };

                    return (
                        <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}>
                            <div style={{
                                backgroundColor: colors.bgCard, borderRadius: '12px', padding: '24px',
                                maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                            }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: colors.textPrimary }}>
                                    Create Merged Scenario from {ids.length} Sources
                                </h3>
                                <p style={{ margin: '0 0 8px', fontSize: '12px', color: colors.textMuted }}>
                                    Merging: {names.length <= 4 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`}
                                </p>
                                <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary }}>Enter a name for the new merged scenario:</p>
                                <input
                                    type="text"
                                    value={mergeNewName}
                                    onChange={(e) => setMergeNewName(e.target.value)}
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '6px',
                                        border: `1px solid ${colors.border}`, backgroundColor: colors.bgAlt, color: colors.textPrimary,
                                        marginBottom: '16px', outline: 'none', boxSizing: 'border-box'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && mergeNewName.trim()) {
                                            handleCreate();
                                        }
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowMergeToNewInput(false)} style={{
                                        padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.border}`,
                                        backgroundColor: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}>Cancel</button>
                                    <button
                                        onClick={handleCreate}
                                        style={{
                                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                                            background: 'linear-gradient(135deg, #00BD00, #059669)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                        }}
                                    >Create from {ids.length} Scenarios</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Comparison Table */}
                <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '24px' }}>
                    {selectedIds.size === 0 ? (
                        <div style={{
                            padding: '48px',
                            textAlign: 'center',
                            color: colors.textMuted,
                            fontSize: '14px'
                        }}>
                            <svg style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Select one or more scenarios above to compare
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr>
                                    <th style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        color: colors.textSecondary,
                                        textTransform: 'uppercase',
                                        borderBottom: `2px solid ${colors.border}`,
                                        position: 'sticky',
                                        left: 0,
                                        backgroundColor: colors.bgModal
                                    }}>Scenario</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>Impl Fees</th>
                                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>Δ</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>ARR</th>
                                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>Δ</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#00BD00', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>Total</th>
                                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#00BD00', textTransform: 'uppercase', borderBottom: `2px solid ${colors.border}` }}>Δ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Live Data Row (baseline) */}
                                <tr style={{ backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4' }}>
                                    <td style={{
                                        padding: '14px 16px',
                                        borderBottom: `1px solid ${colors.border}`,
                                        position: 'sticky',
                                        left: 0,
                                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                backgroundColor: '#00BD00',
                                                boxShadow: '0 0 8px #00BD00'
                                            }} />
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#00BD00' }}>Live Data</div>
                                                <div style={{ fontSize: '11px', color: colors.textMuted }}>Baseline</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#0284c7', borderBottom: `1px solid ${colors.border}` }}>
                                        £{Math.round(liveRevenue.implFee?.fullYear || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>—</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#082F24', borderBottom: `1px solid ${colors.border}` }}>
                                        £{Math.round(liveRevenue.arr?.fullYear || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>—</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#00BD00', borderBottom: `1px solid ${colors.border}` }}>
                                        £{Math.round(liveRevenue.total?.fullYear || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>—</td>
                                </tr>

                                {/* Selected Scenario Rows */}
                                {scenarioRevenues.map((sr, idx) => {
                                    const implDelta = formatDelta(sr.deltaImplFee);
                                    const arrDelta = formatDelta(sr.deltaArr);
                                    const totalDelta = formatDelta(sr.deltaTotal);
                                    const isExpanded = expandedIds.has(sr.id);
                                    const hasChanges = sr.changeDetails.projects.length > 0 || sr.changeDetails.resources.length > 0;

                                    return (
                                        <React.Fragment key={sr.id}>
                                            <tr
                                                style={{
                                                    backgroundColor: idx % 2 === 0 ? colors.bgCard : colors.bgAlt,
                                                    cursor: hasChanges ? 'pointer' : 'default'
                                                }}
                                                onClick={() => hasChanges && toggleExpanded(sr.id)}
                                            >
                                                <td style={{
                                                    padding: '14px 16px',
                                                    borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}`,
                                                    position: 'sticky',
                                                    left: 0,
                                                    backgroundColor: idx % 2 === 0 ? colors.bgCard : colors.bgAlt
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {hasChanges && (
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                transition: 'transform 0.2s'
                                                            }}>
                                                                {ICONS.CHEVRON_RIGHT}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {sr.name}
                                                                {sr.notes && (
                                                                    <span
                                                                        title={sr.notes}
                                                                        style={{
                                                                            width: '16px',
                                                                            height: '16px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: '#FE9922',
                                                                            cursor: 'help'
                                                                        }}
                                                                    >
                                                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                                        </svg>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: colors.textMuted }}>
                                                                {sr.changes} changes • {sr.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '500', color: '#0284c7', borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    £{Math.round(sr.implFee).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: implDelta.color, borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    {implDelta.text}
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '500', color: '#082F24', borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    £{Math.round(sr.arr).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: arrDelta.color, borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    {arrDelta.text}
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#00BD00', borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    £{Math.round(sr.total).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: totalDelta.color, borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}` }}>
                                                    {totalDelta.text}
                                                </td>
                                            </tr>

                                            {/* Expanded Details Row */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={7} style={{
                                                        padding: 0,
                                                        borderBottom: `1px solid ${colors.border}`,
                                                        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'
                                                    }}>
                                                        <div style={{
                                                            padding: '16px 24px 20px 56px',
                                                            display: 'flex',
                                                            gap: '32px',
                                                            flexWrap: 'wrap'
                                                        }}>
                                                            {/* Project Changes */}
                                                            {sr.changeDetails.projects.length > 0 && (
                                                                <div style={{ flex: 1, minWidth: '280px' }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: '700',
                                                                        color: '#082F24',
                                                                        textTransform: 'uppercase',
                                                                        marginBottom: '12px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                        </svg>
                                                                        Project Changes ({sr.changeDetails.projects.length})
                                                                    </div>
                                                                    {sr.changeDetails.projects.map((p, i) => (
                                                                        <div key={i} style={{
                                                                            padding: '10px 12px',
                                                                            backgroundColor: colors.bgCard,
                                                                            borderRadius: '8px',
                                                                            marginBottom: '8px',
                                                                            border: `1px solid ${colors.border}`
                                                                        }}>
                                                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '6px' }}>
                                                                                {p.name}
                                                                            </div>
                                                                            {p.changes.map((c, j) => (
                                                                                <div key={j} style={{
                                                                                    fontSize: '11px',
                                                                                    color: colors.textSecondary,
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '8px',
                                                                                    marginTop: '4px'
                                                                                }}>
                                                                                    <span style={{ color: colors.textMuted, minWidth: '80px' }}>{c.field}:</span>
                                                                                    <span style={{ textDecoration: 'line-through', color: '#E5554F' }}>{formatValue(c.from)}</span>
                                                                                    <span style={{ color: colors.textMuted }}>→</span>
                                                                                    <span style={{ color: '#00BD00', fontWeight: '500' }}>{formatValue(c.to)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Resource Changes */}
                                                            {sr.changeDetails.resources.length > 0 && (
                                                                <div style={{ flex: 1, minWidth: '280px' }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: '700',
                                                                        color: '#0284c7',
                                                                        textTransform: 'uppercase',
                                                                        marginBottom: '12px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                                        </svg>
                                                                        Resource Changes ({sr.changeDetails.resources.length})
                                                                    </div>
                                                                    {sr.changeDetails.resources.map((r, i) => (
                                                                        <div key={i} style={{
                                                                            padding: '10px 12px',
                                                                            backgroundColor: colors.bgCard,
                                                                            borderRadius: '8px',
                                                                            marginBottom: '8px',
                                                                            border: `1px solid ${colors.border}`
                                                                        }}>
                                                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '6px' }}>
                                                                                {r.name}
                                                                            </div>
                                                                            {r.changes.map((c, j) => (
                                                                                <div key={j} style={{
                                                                                    fontSize: '11px',
                                                                                    color: colors.textSecondary,
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '8px',
                                                                                    marginTop: '4px'
                                                                                }}>
                                                                                    <span style={{ color: colors.textMuted, minWidth: '80px' }}>{c.field}:</span>
                                                                                    <span style={{ textDecoration: 'line-through', color: '#E5554F' }}>{formatValue(c.from)}</span>
                                                                                    <span style={{ color: colors.textMuted }}>→</span>
                                                                                    <span style={{ color: '#00BD00', fontWeight: '500' }}>{formatValue(c.to)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {!hasChanges && (
                                                                <div style={{ color: colors.textMuted, fontSize: '12px', fontStyle: 'italic' }}>
                                                                    No changes recorded in this scenario
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: BRAND.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
