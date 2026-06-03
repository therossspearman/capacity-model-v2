/**
 * Program Detail Modal Component - Premium Design
 * Shows program workstream breakdown and allows resource assignment management
 */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useGlobalConfig } from '@airtable/blocks/interface/ui';
import { SETTINGS } from '../../constants';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { formatNumber } from '../../utils';

// Single source of truth for the workstream-name → SETTINGS-field-key mapping,
// shared by the read path (programAssignments memo) and the write path
// (writeToProxy). Keep additions/edits in this one place.
const WORKSTREAM_FIELD_MAP = {
    'Integrations': SETTINGS.PROGRAM_WS_INTEGRATIONS,
    'Payroll': SETTINGS.PROGRAM_WS_PAYROLL,
    'Consulting': SETTINGS.PROGRAM_WS_CONSULTING,
    'Best Practice': SETTINGS.PROGRAM_WS_BEST_PRACTICE,
    'Comms': SETTINGS.PROGRAM_WS_COMMS,
    'Home': SETTINGS.PROGRAM_WS_HOME,
    'Comms & Branding': SETTINGS.PROGRAM_WS_COMMS,
    'Homepage': SETTINGS.PROGRAM_WS_HOME,
    'Program Governance': SETTINGS.PROGRAM_WS_GOVERNANCE,
    'Governance': SETTINGS.PROGRAM_WS_GOVERNANCE
};

const ProgramDetailModal = ({
    program,
    allPrograms,
    onNavigate,
    allResources,
    allRows,
    storedSettings,
    onUpdateSettings,
    onClose,
    isDraftMode,
    onProjectClick,
    programsTable,
    programRecords
}) => {
    const globalConfig = useGlobalConfig();
    const { isDark, colors } = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [pendingAdds, setPendingAdds] = useState([]);
    const [pendingRemoves, setPendingRemoves] = useState(new Set());
    const [pendingUpdates, setPendingUpdates] = useState({});
    const [showLinkDropdown, setShowLinkDropdown] = useState(false);

    // Arrow key navigation between programs
    useEffect(() => {
        if (!allPrograms || allPrograms.length <= 1 || !onNavigate) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                // Don't navigate if focus is inside an input/select/textarea
                const tag = document.activeElement?.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

                e.preventDefault();
                const currentIdx = allPrograms.findIndex(p => p.customer === program.customer);
                if (currentIdx < 0) return;
                const nextIdx = e.key === 'ArrowDown'
                    ? (currentIdx + 1) % allPrograms.length
                    : (currentIdx - 1 + allPrograms.length) % allPrograms.length;
                // Reset local state
                setPendingAdds([]);
                setPendingRemoves(new Set());
                setPendingUpdates({});
                setActiveTab('overview');
                setShowLinkDropdown(false);
                onNavigate(allPrograms[nextIdx]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allPrograms, program, onNavigate]);

    const workstreams = useMemo(() => {
        return program?.workstreams || []; // These come from project aggregation (virtual)
    }, [program]);

    // Pre-compute the weekly-effort sparkline per workstream ONCE per data change.
    // Previously this nested date-bucketing (workstreams × projects × weeks) ran inline
    // in JSX on every render of the modal. Logic is unchanged — just memoised.
    const sparklineByWorkstream = useMemo(() => {
        const projects = program?.programProjects || [];
        const discount = storedSettings?.programDiscount || 15;
        const out = {};
        for (const ws of workstreams) {
            if (projects.length === 0) { out[ws.name] = null; continue; }
            const wsShare = ws.allocationPct / 100;
            let minDate = null, maxDate = null;
            projects.forEach(p => {
                const start = p.start ? new Date(p.start) : null;
                const end = p.end ? new Date(p.end) : null;
                if (start && (!minDate || start < minDate)) minDate = start;
                if (end && (!maxDate || end > maxDate)) maxDate = end;
            });
            if (!minDate || !maxDate || minDate >= maxDate) { out[ws.name] = null; continue; }
            const weeklyData = [];
            const current = new Date(minDate);
            const dayOfWeek = current.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            current.setDate(current.getDate() + daysToMonday);
            while (current <= maxDate) {
                const weekStart = new Date(current);
                const weekEnd = new Date(current);
                weekEnd.setDate(weekEnd.getDate() + 6);
                let weekHours = 0;
                projects.forEach(p => {
                    const pStart = p.start ? new Date(p.start) : null;
                    const pEnd = p.end ? new Date(p.end) : null;
                    if (!pStart || !pEnd) return;
                    if (weekEnd >= pStart && weekStart <= pEnd) {
                        const totalHours = (p.pmValOriginal || p.pmVal || 0) + (p.scValOriginal || p.scVal || 0) + (p.pdValOriginal || p.pdVal || 0);
                        const programHours = totalHours * (discount / 100) * wsShare;
                        const projectDuration = Math.max(1, (pEnd - pStart) / (1000 * 60 * 60 * 24 * 7));
                        weekHours += programHours / projectDuration;
                    }
                });
                weeklyData.push({ date: new Date(current), hours: weekHours });
                current.setDate(current.getDate() + 7);
            }
            out[ws.name] = weeklyData.length ? { weeklyData, maxHours: Math.max(...weeklyData.map(w => w.hours), 1) } : null;
        }
        return out;
    }, [program, storedSettings?.programDiscount, workstreams]);


    // Find the actual Airtable Record for this program
    // Priority: 1. Explicit mapping in programRecordMap  2. Name/customer field match
    const programRecord = useMemo(() => {
        if (!programRecords) return null;

        // 1. Check explicit mapping first
        const recordMap = storedSettings?.programRecordMap || {};
        const mappedId = recordMap[program.customer];
        if (mappedId) {
            const mapped = programRecords.find(r => r.id === mappedId);
            if (mapped) return mapped;
        }

        // 2. Fall back to name / customer field matching
        const customerFieldId = globalConfig.get(SETTINGS.PROGRAM_CUSTOMER);
        return programRecords.find(r => {
            if (r.name === program.customer) return true;
            if (customerFieldId) {
                try { return r.getCellValueAsString(customerFieldId) === program.customer; }
                catch (e) { return false; }
            }
            return false;
        });
    }, [programRecords, program, globalConfig, storedSettings?.programRecordMap]);

    // Is this the global "Program Budget" aggregate (no table record needed)
    const isGlobalProgram = program?.customer === 'Program Budget' || program?.id === 'global_program';

    // Find program records available for linking (all records shown, already-linked ones marked)
    const unlinkedRecords = useMemo(() => {
        if (!programRecords || !programRecords.length) return [];
        const customerFieldId = globalConfig.get(SETTINGS.PROGRAM_CUSTOMER);
        return programRecords.filter(r => {
            // Already matched to this program? Skip (it's already linked)
            if (programRecord && r.id === programRecord.id) return false;
            return true;
        }).map(r => {
            let label = r.name || 'Unnamed';
            if (customerFieldId) {
                try {
                    const custVal = r.getCellValueAsString(customerFieldId);
                    if (custVal && custVal !== label) label = `${label} (${custVal})`;
                } catch (e) { /* skip */ }
            }
            return { id: r.id, label, record: r };
        });
    }, [programRecords, programRecord, globalConfig]);

    // Save the customer → record mapping to settings
    const saveProgramMapping = (recordId) => {
        if (!onUpdateSettings) return;
        const currentMap = storedSettings?.programRecordMap || {};
        onUpdateSettings({
            programRecordMap: {
                ...currentMap,
                [program.customer]: recordId
            }
        });
    };

    // Handler: Link an existing record
    const handleLinkRecord = (record) => {
        setShowLinkDropdown(false);
        saveProgramMapping(record.id);
    };

    // Compute assignments: Merge Table Data (Live) + JSON Data (Draft/Legacy) + Optimistic Updates
    const programAssignments = useMemo(() => {
        if (program?.customer === 'Program Budget' || program?.id === 'global_program') {
            return storedSettings?.programAssignments || [];
        }

        let assignments = [];
        const jsonAssignments = (storedSettings?.programAssignments || []).filter(a => a.customer === program.customer);

        // 1. Calculate Table Data (Available in both modes as baseline)
        let fromTable = [];
        if (programRecord) {
            Object.entries(WORKSTREAM_FIELD_MAP).forEach(([wsName, fieldKey]) => {
                if (!fieldKey) return;
                const fieldId = globalConfig.get(fieldKey);
                if (fieldId) {
                    const linkedResources = programRecord.getCellValue(fieldId) || [];
                    linkedResources.forEach(link => {
                        // Try to find metadata in JSON (Hybrid model: Who in Table, How in JSON)
                        // Note: In Draft mode, jsonAssignments might override this completely.
                        // In Live mode, we match against global JSON.
                        const match = (storedSettings?.programAssignments || []).find(ja =>
                            ja.resourceId === link.id &&
                            ja.workstream === wsName &&
                            ja.customer === program.customer
                        );
                        fromTable.push({
                            id: match ? match.id : `${wsName}_${link.id}`,
                            workstream: wsName,
                            customer: program.customer,
                            resourceId: link.id,
                            startDate: match ? match.startDate : program.start,
                            endDate: match ? match.endDate : program.end,
                            allocationPct: match ? match.allocationPct : 100
                        });
                    });
                }
            });
        }

        // 2. Determine Source of Truth
        if (isDraftMode) {
            // If we have draft assignments, use them. 
            // If not, fallback to table data (Mirror Live state)
            // This handles the "Start Draft" case. 
            // Limitation: Deleting ALL assignments in Draft will revert to showing Live assignments.
            assignments = jsonAssignments.length > 0 ? jsonAssignments : fromTable;
        } else {
            // Live Mode

            // Fallback to JSON if Table is empty (Legacy functionality)
            if (fromTable.length === 0 && jsonAssignments.length > 0) {
                fromTable = [...jsonAssignments];
            }

            // Apply Optimistic Changes (Live Mode only)
            // 1. Filter Removes
            assignments = fromTable.filter(a => !pendingRemoves.has(a.id) && !pendingRemoves.has(a.resourceId)); // Check both ID types

            // 2. Apply Updates
            assignments = assignments.map(a => pendingUpdates[a.id] ? { ...a, ...pendingUpdates[a.id] } : a);

            // 3. Append Adds
            assignments = [...assignments, ...pendingAdds];
        }

        return assignments;
    }, [programRecords, program, storedSettings, isDraftMode, programRecord, globalConfig, pendingAdds, pendingRemoves, pendingUpdates]);

    // Live Mode Writer Helper — writes program-workstream linked records directly
    // to the canonical fields. The function is still named *Proxy for blame
    // continuity, but the proxy (*_UPDATE) fields are no longer used: writes go
    // to canonical, matching the read path above and the rest of the codebase.
    // (Old behaviour wrote to *_UPDATE and relied on an Airtable automation to
    // copy through to canonical — that broke this modal whenever the automation
    // was off, since the read above only sees canonical.)
    // Returns the Airtable write promise (or a resolved promise) so callers can
    // await it and surface failures / roll back optimistic UI.
    const writeToProxy = (currentAssignments) => {
        if (!programRecord || !programsTable) return Promise.resolve();

        // Group by Workstream
        const byWorkstream = {};
        currentAssignments.forEach(a => {
            if (a.customer === program.customer) { // Safety check
                if (!byWorkstream[a.workstream]) byWorkstream[a.workstream] = [];
                byWorkstream[a.workstream].push(a.resourceId);
            }
        });

        // Canonical fields — same map as the read path above.
        const FIELD_MAP_CANONICAL = WORKSTREAM_FIELD_MAP;

        // Initialise EVERY managed canonical field to empty first, so that removing
        // the last resource from a workstream actually clears it in Airtable instead
        // of leaving the stale link behind (workstreams with zero assignments are
        // absent from byWorkstream and would otherwise never be written).
        const fields = {};
        Object.values(FIELD_MAP_CANONICAL).forEach(key => {
            const fieldId = globalConfig.get(key);
            if (fieldId) fields[fieldId] = [];
        });

        // Accumulate ids per field id (deduped) so workstream aliases that share a
        // single canonical field (e.g. 'Comms' + 'Comms & Branding') are MERGED
        // rather than overwriting each other (previously last-write-wins corrupted
        // the linked-record set).
        Object.entries(byWorkstream).forEach(([wsName, ids]) => {
            const key = FIELD_MAP_CANONICAL[wsName] || FIELD_MAP_CANONICAL[wsName.replace('Program ', '')];
            if (!key) return;
            const fieldId = globalConfig.get(key);
            if (!fieldId) return;
            const existing = fields[fieldId] || (fields[fieldId] = []);
            const seen = new Set(existing.map(r => r.id));
            ids.forEach(id => { if (id && !seen.has(id)) { seen.add(id); existing.push({ id }); } });
        });

        if (Object.keys(fields).length > 0) {
            return programsTable.updateRecordAsync(programRecord.id, fields);
        }
        return Promise.resolve();
    };

    // Core assignment updater — routes through onUpdateSettings (which handles draft vs live in Dashboard)
    // and also writes to proxy fields in live mode for immediate Airtable sync
    // Persists the assignment list. In live mode the Airtable write is awaited so a
    // failure can be surfaced and the optimistic UI rolled back via onWriteError,
    // instead of being swallowed (which left the user believing a failed save worked).
    const updateAssignment = (updatedList, onWriteError) => {
        if (!onUpdateSettings) return;

        // Save to settings (draft or live path handled by Dashboard's onUpdateSettings callback)
        onUpdateSettings({ programAssignments: updatedList });

        // In live mode, also write to proxy fields for immediate Airtable persistence
        if (!isDraftMode) {
            const writePromise = writeToProxy(updatedList);
            if (writePromise && typeof writePromise.catch === 'function') {
                writePromise.catch(err => {
                    console.error('[ProgramDetailModal] Failed to persist workstream links:', err);
                    if (onWriteError) onWriteError(err);
                    else alert('Failed to save program assignment to Airtable — your change may not have persisted. Please retry.');
                });
            }
        }
    };

    const handleAddAssignment = (workstream, resourceId) => {
        const newAssignment = {
            id: `pa_${Date.now()}`,
            workstream: workstream.name,
            customer: program.customer,
            resourceId,
            startDate: program.start,
            endDate: program.end,
            allocationPct: 100
        };

        // Optimistic: show instantly in UI
        setPendingAdds(prev => [...prev, newAssignment]);

        const prevList = storedSettings.programAssignments || [];
        const updatedList = [...prevList, newAssignment];
        updateAssignment(updatedList, () => {
            // Roll back: drop the optimistic add and restore the prior list
            setPendingAdds(prev => prev.filter(a => a.id !== newAssignment.id));
            onUpdateSettings({ programAssignments: prevList });
            alert('Could not add the program assignment — it has been reverted. Please retry.');
        });

        // Clear optimistic state after Airtable refreshes
        setTimeout(() => {
            setPendingAdds(prev => prev.filter(a => a.id !== newAssignment.id));
        }, 20000);
    };

    const handleRemoveAssignment = (assignmentId) => {
        if (!onUpdateSettings) return;

        // Optimistic: hide instantly in UI
        setPendingRemoves(prev => new Set([...prev, assignmentId]));

        const prevList = storedSettings.programAssignments || [];
        const updatedList = prevList.filter(a => a.id !== assignmentId);
        updateAssignment(updatedList, () => {
            // Roll back: un-hide the assignment and restore the prior list
            setPendingRemoves(prev => {
                const next = new Set(prev);
                next.delete(assignmentId);
                return next;
            });
            onUpdateSettings({ programAssignments: prevList });
            alert('Could not remove the program assignment — it has been restored. Please retry.');
        });

        // Clear optimistic state after Airtable refreshes
        setTimeout(() => {
            setPendingRemoves(prev => {
                const next = new Set(prev);
                next.delete(assignmentId);
                return next;
            });
        }, 20000);
    };

    const handleUpdateAssignment = (assignmentId, changes) => {
        // Optimistic: update instantly in UI
        setPendingUpdates(prev => ({
            ...prev,
            [assignmentId]: { ...(prev[assignmentId] || {}), ...changes }
        }));

        const prevList = storedSettings.programAssignments || [];
        const updatedList = prevList.map(a =>
            a.id === assignmentId ? { ...a, ...changes } : a
        );
        updateAssignment(updatedList, () => {
            // Roll back: clear the optimistic update and restore the prior list
            setPendingUpdates(prev => {
                const next = { ...prev };
                delete next[assignmentId];
                return next;
            });
            onUpdateSettings({ programAssignments: prevList });
            alert('Could not update the program assignment — it has been reverted. Please retry.');
        });

        // Clear optimistic state after Airtable refreshes
        setTimeout(() => {
            setPendingUpdates(prev => {
                const next = { ...prev };
                delete next[assignmentId];
                return next;
            });
        }, 20000);
    };

    if (!program) return null;

    // Theme Colors (Emerald for Programs)
    const themeColor = '#00BD00';
    const themeBg = '#d1fae5';
    const themeBorder = '#6ee7b7';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 10010
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: colors.bgModal || '#ffffff',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    width: '100%',
                    maxWidth: '900px',
                    height: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 10011,
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '32px 40px 0 40px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '16px',
                            backgroundColor: '#ecfdf5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -2px rgba(16, 185, 129, 0.05)',
                            border: '1px solid #d1fae5'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                    {program.customer}
                                </h1>
                                <span style={{
                                    fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '6px',
                                    backgroundColor: '#d1fae5', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}>
                                    Program Budget
                                </span>
                                {isDraftMode && <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#d97706' }}>DRAFT</span>}
                            </div>
                            <div style={{ marginTop: '8px', display: 'flex', gap: '16px', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
                                <span>{program.programProjects?.length || 0} Contributing Projects</span>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1', alignSelf: 'center' }}></span>
                                <span>{workstreams.length} Workstreams</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '36px', fontWeight: '800', color: '#00BD00', lineHeight: 1, letterSpacing: '-0.03em' }}>
                            {formatNumber(Math.round(program.totalHours || 0))}h
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                            Total Allocation
                        </div>
                    </div>
                </div>

                {/* Warning Banner: No Airtable record linked */}
                {!programRecord && !isGlobalProgram && programsTable && (
                    <div style={{
                        margin: '16px 40px 0 40px',
                        padding: '14px 20px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fcd34d',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>No Airtable Record Linked</div>
                                <div style={{ fontSize: '11px', color: '#b45309' }}>Resource allocations won't persist until this program is linked to a Programs table record.</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, position: 'relative' }}>
                            <button
                                onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                                disabled={unlinkedRecords.length === 0}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '11px', fontWeight: '700',
                                    backgroundColor: 'white', border: '1px solid #e5e7eb',
                                    borderRadius: '8px', cursor: unlinkedRecords.length > 0 ? 'pointer' : 'not-allowed',
                                    color: '#374151', opacity: unlinkedRecords.length === 0 ? 0.5 : 1,
                                    transition: 'all 0.15s'
                                }}
                            >
                                Link Existing ▾
                            </button>
                            <div style={{ fontSize: '10px', color: '#92400e', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                                or contact Delivery Ops to add a program
                            </div>
                            {/* Link Existing Dropdown */}
                            {showLinkDropdown && unlinkedRecords.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                                    minWidth: '220px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10
                                }}>
                                    {unlinkedRecords.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => handleLinkRecord(r.record)}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '8px 14px',
                                                fontSize: '12px',
                                                textAlign: 'left',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                                color: '#1e293b',
                                                borderBottom: '1px solid #f1f5f9'
                                            }}
                                            onMouseEnter={e => e.target.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tabs - Segmented Control */}
                <div style={{ padding: '32px 40px 24px 40px' }}>
                    <div style={{
                        display: 'inline-flex',
                        backgroundColor: '#f1f5f9',
                        padding: '4px',
                        borderRadius: '12px'
                    }}>
                        {['overview', 'assignments'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === tab ? 'white' : 'transparent',
                                    color: activeTab === tab ? '#0f172a' : '#64748b',
                                    boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 40px 40px 40px',
                    backgroundColor: '#fafafa', // Light gray background for contrast
                    borderTop: '1px solid #f1f5f9'
                }}>
                    <div style={{ paddingTop: '24px' }}>
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Logic Banner */}
                                <div style={{
                                    padding: '16px 20px',
                                    backgroundColor: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #d1fae5',
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)'
                                }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        backgroundColor: '#ecfdf5', color: '#059669',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '16px', fontWeight: 'bold'
                                    }}>ƒ</div>
                                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                                        <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>Budget Calculation Logic</div>
                                        Project efforts are reduced by <span style={{ color: '#059669', fontWeight: '700' }}>{storedSettings?.programEfficiencyFactor || 0}%</span> (Efficiency Factor). <br />
                                        Then, <span style={{ color: '#059669', fontWeight: '700' }}>{storedSettings?.programDiscount || 15}%</span> of that remaining effort is allocated to this Program Budget.
                                    </div>
                                </div>

                                {/* Project Breakdown Table/Card */}
                                <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contribution Breakdown</h3>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: `1px solid #f1f5f9` }}>
                                                <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Project</th>
                                                <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>Original</th>
                                                <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600', color: '#00BD00' }}>Program Share</th>
                                                <th style={{ padding: '16px 24px', width: '120px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                // Compute the discount and the per-program max share ONCE rather than
                                                // recomputing maxHours inside every row (was O(n^2) over the project list).
                                                const discount = storedSettings?.programDiscount || 15;
                                                const maxHours = Math.max(...(program.programProjects || []).map(prj =>
                                                    ((prj.pmValOriginal || prj.pmVal || 0) + (prj.scValOriginal || prj.scVal || 0) + (prj.pdValOriginal || prj.pdVal || 0)) * (discount / 100)
                                                ), 1);

                                                return (program.programProjects || []).map((p, i) => {
                                                const originalHours = (p.pmValOriginal || p.pmVal || 0) + (p.scValOriginal || p.scVal || 0) + (p.pdValOriginal || p.pdVal || 0);
                                                const programHours = originalHours * (discount / 100);

                                                return (
                                                    <tr
                                                        key={i}
                                                        style={{
                                                            borderBottom: '1px solid #f8fafc',
                                                            cursor: onProjectClick ? 'pointer' : 'default',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                        onClick={() => onProjectClick && onProjectClick(p)}
                                                        onMouseEnter={e => onProjectClick && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                                        onMouseLeave={e => onProjectClick && (e.currentTarget.style.backgroundColor = 'transparent')}
                                                    >
                                                        <td style={{ padding: '16px 24px', color: '#1e293b', fontWeight: '500' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                {p.countryFlag ? <img src={p.countryFlag} style={{ width: '20px', height: '20px', borderRadius: '50%' }} /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e2e8f0' }}></div>}
                                                                <span style={{ color: onProjectClick ? '#082F24' : '#1e293b' }}>{p.name}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', textAlign: 'right', color: '#94a3b8' }}>
                                                            {formatNumber(Math.round(originalHours))}h
                                                        </td>
                                                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '700', color: '#00BD00' }}>
                                                            +{formatNumber(Math.round(programHours))}h
                                                        </td>
                                                        <td style={{ padding: '16px 24px' }}>
                                                            <div style={{ height: '6px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%', width: `${(programHours / maxHours) * 100}%`,
                                                                    backgroundColor: '#00BD00', borderRadius: '3px'
                                                                }} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'assignments' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {workstreams.filter(ws => ws.hours > 0).map((ws, i) => {
                                    const wsAssignments = programAssignments.filter(a => a.workstream === ws.name);
                                    const availableResources = (allResources || []).filter(
                                        r => !wsAssignments.some(a => a.resourceId === r.id)
                                    );

                                    return (
                                        <div key={i} style={{
                                            backgroundColor: 'white',
                                            borderRadius: '20px',
                                            padding: '24px',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00BD00', boxShadow: '0 0 0 4px #d1fae5' }}></div>
                                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{ws.name}</h3>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '20px' }}>{ws.allocationPct}% Share</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>{formatNumber(Math.round(ws.hours))}h</div>
                                                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Allowed Budget</div>
                                                    </div>

                                                    {/* Premium Dropdown */}
                                                    <div style={{ position: 'relative' }}>
                                                        <select
                                                            value=""
                                                            onChange={(e) => e.target.value && handleAddAssignment(ws, e.target.value)}
                                                            style={{
                                                                appearance: 'none',
                                                                padding: '10px 32px 10px 16px',
                                                                borderRadius: '10px',
                                                                border: '1px solid #cbd5e1',
                                                                backgroundColor: 'white',
                                                                fontSize: '13px', fontWeight: '600', color: '#475569',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                            }}
                                                        >
                                                            <option value="">+ Assign Resource</option>
                                                            {(() => {
                                                                // Group by function (role), then squad, then alphabetical
                                                                const grouped = {};
                                                                availableResources.forEach(r => {
                                                                    const fn = r.role || 'Other';
                                                                    const pod = (r.squads && r.squads[0]) || 'Unassigned';
                                                                    const key = `${fn}|||${pod}`;
                                                                    if (!grouped[key]) grouped[key] = { fn, pod, resources: [] };
                                                                    grouped[key].resources.push(r);
                                                                });
                                                                // Sort groups: by function name, then pod name
                                                                const sortedGroups = Object.values(grouped).sort((a, b) =>
                                                                    a.fn.localeCompare(b.fn) || a.pod.localeCompare(b.pod)
                                                                );
                                                                // Sort resources within each group alphabetically
                                                                sortedGroups.forEach(g => g.resources.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
                                                                return sortedGroups.map(g => (
                                                                    <optgroup key={`${g.fn}-${g.pod}`} label={`${g.fn} · ${g.pod}`}>
                                                                        {g.resources.map(r => (
                                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                ));
                                                            })()}
                                                        </select>
                                                        <svg style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#64748b', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* List */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {wsAssignments.length > 0 ? (
                                                    wsAssignments.map(a => {
                                                        const resource = allResources?.find(r => r.id === a.resourceId);
                                                        // allResources headshots are pre-normalised to a URL string (or null)
                                                        // by Dashboard; the old `|| resource?.headshot?.[0]?.url` fallback
                                                        // was dead (a string has no [0].url) so it has been dropped.
                                                        const headshot = resource?.headshot;

                                                        return (
                                                            <div key={a.id} style={{
                                                                display: 'flex', alignItems: 'center', gap: '16px',
                                                                padding: '12px 16px', borderRadius: '12px',
                                                                backgroundColor: '#f8fafc', border: '1px solid #f1f5f9',
                                                                transition: 'all 0.2s',
                                                            }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'white'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                            >
                                                                {headshot ? (
                                                                    <img src={headshot} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                                                                ) : (
                                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>
                                                                        {(resource?.name || '?').charAt(0)}
                                                                    </div>
                                                                )}

                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{resource?.name || 'Unknown'}</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>{resource?.role || 'Resource'}</span>
                                                                        {/* Show customer/program badge in global view */}
                                                                        {(program?.customer === 'Program Budget' || program?.id === 'global_program') && a.customer && a.customer !== 'Program Budget' && (
                                                                            <span style={{
                                                                                fontSize: '9px',
                                                                                fontWeight: '600',
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: '#dbeafe',
                                                                                color: '#1d4ed8',
                                                                                border: '1px solid #93c5fd'
                                                                            }}>
                                                                                {a.customer}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    <div style={{
                                                                        padding: '4px 8px', borderRadius: '8px', backgroundColor: 'white',
                                                                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px'
                                                                    }}>
                                                                        <input
                                                                            type="number" min="1" max="100"
                                                                            value={a.allocationPct || 100}
                                                                            onChange={(e) => {
                                                                                const newPct = Math.min(100, Math.max(1, parseInt(e.target.value) || 100));
                                                                                handleUpdateAssignment(a.id, { allocationPct: newPct });
                                                                            }}
                                                                            style={{ width: '30px', border: 'none', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#00BD00', outline: 'none' }}
                                                                        />
                                                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>%</span>
                                                                    </div>

                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <input type="date" value={a.startDate || ''} onChange={e => {
                                                                            handleUpdateAssignment(a.id, { startDate: e.target.value });
                                                                        }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#475569' }} />
                                                                        <span style={{ color: '#cbd5e1' }}>→</span>
                                                                        <input type="date" value={a.endDate || ''} onChange={e => {
                                                                            handleUpdateAssignment(a.id, { endDate: e.target.value });
                                                                        }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#475569' }} />
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleRemoveAssignment(a.id)}
                                                                        style={{
                                                                            width: '28px', height: '28px', borderRadius: '8px',
                                                                            backgroundColor: '#fee2e2', color: '#E5554F', border: 'none',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fecaca'}
                                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', border: '2px dashed #f1f5f9', borderRadius: '12px' }}>
                                                        No resources assigned to this workstream yet.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Weekly Effort Sparkline Chart */}
                                            {(() => {
                                                // Memoised in sparklineByWorkstream (see above) — no per-render recompute.
                                                const sk = sparklineByWorkstream[ws.name];
                                                if (!sk) return null;
                                                const { weeklyData, maxHours } = sk;

                                                return (
                                                    <div style={{
                                                        marginTop: '16px',
                                                        padding: '16px',
                                                        backgroundColor: '#f8fafc',
                                                        borderRadius: '12px',
                                                        border: '1px solid #f1f5f9'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            marginBottom: '12px'
                                                        }}>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                color: '#94a3b8',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em'
                                                            }}>
                                                                Weekly Effort Distribution
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                                {weeklyData[0].date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} → {weeklyData[weeklyData.length - 1].date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-end',
                                                            gap: '2px',
                                                            height: '40px'
                                                        }}>
                                                            {weeklyData.map((w, idx) => {
                                                                const heightPct = (w.hours / maxHours) * 100;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        title={`${w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.hours.toFixed(1)}h`}
                                                                        style={{
                                                                            flex: 1,
                                                                            height: `${Math.max(heightPct, 4)}%`,
                                                                            backgroundColor: w.hours > 0 ? '#00BD00' : '#e2e8f0',
                                                                            borderRadius: '2px',
                                                                            minWidth: '3px',
                                                                            maxWidth: '12px',
                                                                            transition: 'all 0.2s',
                                                                            cursor: 'help'
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                        {/* Month indicators */}
                                                        <div style={{
                                                            display: 'flex',
                                                            gap: '2px',
                                                            marginTop: '4px',
                                                            position: 'relative'
                                                        }}>
                                                            {weeklyData.map((w, idx) => {
                                                                const isFirstOrNewMonth = idx === 0 || w.date.getMonth() !== weeklyData[idx - 1].date.getMonth();
                                                                return (
                                                                    <div key={idx} style={{ flex: 1, minWidth: '3px', maxWidth: '12px', position: 'relative' }}>
                                                                        {isFirstOrNewMonth && (
                                                                            <span style={{
                                                                                fontSize: '8px',
                                                                                fontWeight: '600',
                                                                                color: '#94a3b8',
                                                                                whiteSpace: 'nowrap',
                                                                                position: 'absolute',
                                                                                left: 0,
                                                                                top: 0
                                                                            }}>
                                                                                {w.date.toLocaleDateString('en-US', { month: 'short' })}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '24px 40px',
                    display: 'flex', justifyContent: 'flex-end',
                    backgroundColor: 'white',
                    borderTop: '1px solid #f1f5f9'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 32px', borderRadius: '12px',
                            backgroundColor: 'white', color: '#64748b',
                            border: '1px solid #e2e8f0',
                            fontWeight: '700', cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProgramDetailModal;

ProgramDetailModal.propTypes = {
    program: PropTypes.object.isRequired,
    allPrograms: PropTypes.array,
    onNavigate: PropTypes.func,
    allResources: PropTypes.array,
    allRows: PropTypes.array,
    storedSettings: PropTypes.object,
    onUpdateSettings: PropTypes.func,
    onClose: PropTypes.func.isRequired,
    isDraftMode: PropTypes.bool,
    onProjectClick: PropTypes.func,
    programsTable: PropTypes.object,
    programRecords: PropTypes.array
};
