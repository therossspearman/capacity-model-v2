/**
 * useDashboardHandlers - Extracted handlers from Dashboard.jsx
 * 
 * This hook encapsulates the core business logic handlers for:
 * - Cell interactions (click, allocations)
 * - Project updates (batch, optimization, team assignment)
 * - Scenario management (commit, conflict resolution)
 * 
 * Dependencies are injected to keep the hook testable and maintain
 * Dashboard.jsx's control over state.
 */
import { useCallback, useRef } from 'react';
// NOTE: logAuditEvent / AUDIT_EVENTS are injected via deps (see destructure below)
// to keep this hook's dependency-injection contract consistent and testable.
// They are NOT imported here to avoid the imported names being shadowed by the
// destructured deps of the same name.

/**
 * @typedef {Object} HandlerDependencies
 * @property {Object} projTable - Airtable projects table
 * @property {Object} resTable - Airtable resources table
 * @property {Object} scenarioManager - ScenarioManager instance
 * @property {Object} activeScenario - Currently active scenario
 * @property {Object} pendingUpdates - Optimistic UI pending updates
 * @property {Object} pendingResourceUpdates - Optimistic resource updates
 * @property {Array} effectiveProjects - Projects with scenario overlays
 * @property {Array} allProjects - Base projects without overlays
 * @property {Array} allResources - All resources
 * @property {Object} storedSettings - App settings
 * @property {string} currentUserName - Current user's name
 * @property {Function} addToast - Toast notification function
 * @property {Function} setActiveCell - Setter for active cell
 * @property {Function} setSelectedBucketData - Setter for detail modal data
 * @property {Function} setSelectedProgram - Setter for program modal
 * @property {Function} setPendingUpdates - Setter for pending updates
 * @property {Function} setPendingResourceUpdates - Setter for resource updates
 * @property {Function} setScenarios - Setter for scenarios list
 */

/**
 * Core Dashboard handlers extracted for maintainability
 * @param {HandlerDependencies} deps - All required dependencies
 */
export const useDashboardHandlers = (deps) => {
    const {
        projTable,
        resTable,
        scenarioManager,
        activeScenario,
        pendingUpdates,
        pendingResourceUpdates,
        effectiveProjects,
        allProjects,
        allResources,
        storedSettings,
        currentUserName,
        addToast,
        setActiveCell,
        setSelectedBucketData,
        setSelectedProgram,
        setPendingUpdates,
        setPendingResourceUpdates,
        setScenarios,
        filteredProjects,
        selectedBucketData,
        // Scenario-related deps for handleScenarioSelect/handleConflictResolve
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        pendingScenarioId,
        setPendingScenarioId,
        setShowConflictModal,
        setDetectedConflicts,
        // Assignment history deps for undo/redo
        assignmentHistory,
        assignmentFuture,
        setAssignmentHistory,
        setAssignmentFuture,
        // Commit scenario deps
        stableSettings,
        resolveFieldId,
        squadIdMap,
        setShowCommitModal,
        logAuditEvent,
        AUDIT_EVENTS,
        SETTINGS,
        // Apply optimizations dep
        saveAISnapshot,
        // Slot assignment deps
        squadViewFilter,
        pendingSlotAssignment,
        setPendingSlotAssignment,
        // Team Management deps
        squadRecords,
        viewMode,
        // SaveAllocations / BatchApply deps
        activeCell,
        setShowBatchModal,
        setSelectedProjects,
        setIsBatchUpdating,
        // Scenario clone/delete deps
        setDeleteConfirmScenario,
        setRenameData,
        renameData,
        // Scenario create deps
        setShowCreateScenario,
        // Settings save deps
        settingsTable,
        settingsRecords,
        setStoredSettings,
        // Initiatives deps
        setShowInitiativesModal,
        // AI Insights deps
        base,
        setAiLoading,
        setAiInsightData,
        setShowAIModal,
        writeSlotSnapshot,
        readAIRecommendations,
        // Notes deps
        setShowNotesModal,
        // Optimization deps
        setShowOptimizationModal,
        // Merge conflict modal deps
        setMergeConflictData,
        // Delete confirm deps
        deleteConfirmScenario,
        // Program table deps
        programsTable,
        programRecords,
    } = deps;

    // ═══════════════════════════════════════════════════════════════════
    // HELPER: Build allocations JSON with date support
    // Converts team structure to JSON for storage, preserving dates
    // ═══════════════════════════════════════════════════════════════════
    const buildAllocationsJson = useCallback((teamData) => {
        const allocations = {};
        ['pm', 'sc', 'pd'].forEach(role => {
            const roleTeam = teamData[role] || [];
            const roleAllocs = {};
            roleTeam.forEach(m => {
                const hasCustomDates = m.startDate || m.endDate;
                const isPlaceholder = m.isPlaceholder || (m.id && m.id.startsWith('PLACEHOLDER'));

                if (isPlaceholder) {
                    const entry = { pct: m.allocationPct || 0, name: m.name, isPlaceholder: true };
                    if (m.startDate) entry.startDate = m.startDate;
                    if (m.endDate) entry.endDate = m.endDate;
                    roleAllocs[m.id] = entry;
                } else if (m.allocationPct > 0 || hasCustomDates) {
                    // If there are dates or allocation, use object format
                    if (hasCustomDates) {
                        const entry = { pct: m.allocationPct || 0 };
                        if (m.startDate) entry.startDate = m.startDate;
                        if (m.endDate) entry.endDate = m.endDate;
                        roleAllocs[m.id] = entry;
                    } else {
                        roleAllocs[m.id] = m.allocationPct;
                    }
                }
            });
            if (Object.keys(roleAllocs).length > 0) allocations[role] = roleAllocs;
        });
        return allocations;
    }, []);

    // ═══════════════════════════════════════════════════════════════════
    // CELL CLICK HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleCellClick = useCallback((data) => {
        // Program Resourcing: If clicking a program row, open ProgramDetailModal
        if (data.program) {
            setSelectedProgram(data.program);
            return;
        }
        // If data contains bucketData with projects, open DetailModal
        if (data.bucketData && data.bucketData.projects && data.bucketData.projects.length > 0) {
            setSelectedBucketData({
                dateKey: `${data.resourceName || 'Demand Details'} - ${data.dateKey || ''}`,
                details: data.bucketData.projects.map(p => ({
                    ...p,
                    name: p.name || p.projectName || 'Unknown',
                    hours: p.hours || p.totalNeeded || 0,
                    status: p.status || 'Active',
                    startDate: p.startDate,
                    endDate: p.endDate,
                    squads: p.squads || [],
                    projectId: p.id || p.projectId
                }))
            });
        } else if (data.resourceId) {
            // Resource cell click - open AllocationModal
            setActiveCell(data);
        }
    }, [setSelectedProgram, setSelectedBucketData, setActiveCell]);

    // ═══════════════════════════════════════════════════════════════════
    // FIELD-WRITE HELPER (canonical-only, simplified)
    // ═══════════════════════════════════════════════════════════════════
    // History: this used to switch between canonical and *_UPDATE proxy fields based on
    // a `useDirectFieldWrites` toggle. The proxy pattern existed because Airtable used
    // to disallow direct writes to synced fields, so writes went via a local proxy and
    // an automation copied them across. Airtable now allows direct writes on synced
    // tables, so the proxy pattern was retired in favour of canonical-only writes.
    //
    // The signature still takes a `proxyKey` second arg for backward compatibility with
    // ~30 call sites; it's now ignored. The proxy field mappings still exist in
    // storedSettings (and the proxy automation can still run) but are not used by this
    // application for either reads or writes.
    const resolveWriteFieldId = useCallback((canonicalKey /* , proxyKey - ignored */) => {
        return canonicalKey ? resolveFieldId(stableSettings[canonicalKey]) : null;
    }, [stableSettings, resolveFieldId]);

    // ═══════════════════════════════════════════════════════════════════
    // PER-PROJECT WRITE QUEUE
    // ═══════════════════════════════════════════════════════════════════
    // Serialise concurrent writes to the same project record so two rapid
    // edits (e.g. remove-then-add a team member) don't race. Without this,
    // two `updateRecordAsync` calls on the same row can collide — the SDK
    // does optimistic updates with version checking and one will lose the
    // race, surfacing as a silent failure or an error toast. The queue
    // makes them strictly sequential per-project; cross-project writes
    // still parallelise.
    const projectWriteQueueRef = useRef(new Map());
    const enqueueProjectWrite = useCallback((projectId, writeFn) => {
        const prev = projectWriteQueueRef.current.get(projectId) || Promise.resolve();
        // Don't let an earlier failure block later writes — swallow the rejection,
        // each write does its own try/catch and toasts independently.
        const next = prev.catch(() => null).then(() => writeFn());
        projectWriteQueueRef.current.set(projectId, next);
        // Clean up when we're the last in line, so the map doesn't grow forever.
        next.finally(() => {
            if (projectWriteQueueRef.current.get(projectId) === next) {
                projectWriteQueueRef.current.delete(projectId);
            }
        });
        return next;
    }, []);

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE PROJECT HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleUpdateProject = useCallback(async (projectId, updates) => {
        if (!projTable) return;

        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        const updateId = Date.now();

        try {
            // ═══ DRAFT MODE ═══
            if (activeScenario && !activeScenario.isLive) {
                const scenarioChanges = {
                    ...activeScenario.changes,
                    projects: { ...(activeScenario.changes?.projects || {}) }
                };

                const existingEntry = scenarioChanges.projects[projectId] || {};
                const existingOriginal = existingEntry.original || {};
                const existingChanges = existingEntry.changes || {};

                // Capture original values for fields being changed
                Object.keys(updates).forEach(field => {
                    if (!(field in existingOriginal)) {
                        const baseProj = allProjects?.find(p => p.id === projectId);
                        existingOriginal[field] = baseProj?.[field] ?? project[field];
                    }
                });

                // Normalize date aliases: ensure both start/kickOff and end/launch are set
                const normalizedUpdates = { ...updates };
                if (normalizedUpdates.start !== undefined && normalizedUpdates.kickOff === undefined) {
                    normalizedUpdates.kickOff = normalizedUpdates.start;
                }
                if (normalizedUpdates.kickOff !== undefined && normalizedUpdates.start === undefined) {
                    normalizedUpdates.start = normalizedUpdates.kickOff;
                }
                if (normalizedUpdates.end !== undefined && normalizedUpdates.launch === undefined) {
                    normalizedUpdates.launch = normalizedUpdates.end;
                }
                if (normalizedUpdates.launch !== undefined && normalizedUpdates.end === undefined) {
                    normalizedUpdates.end = normalizedUpdates.launch;
                }

                // Merge new changes
                const newChanges = { ...existingChanges, ...normalizedUpdates };

                scenarioChanges.projects[projectId] = {
                    name: project.name || projectId,
                    original: existingOriginal,
                    changes: newChanges,
                    ...newChanges
                };

                // Optimistic UI
                setPendingUpdates(prev => ({
                    ...prev,
                    [projectId]: { ...normalizedUpdates, isDraft: true, timestamp: Date.now(), updateId }
                }));

                // Persist to scenario
                const now = new Date().toISOString();
                const metadata = {
                    ...(activeScenario.metadata || {}),
                    lastModified: now,
                    lastSavedAt: now,
                    lastEditedBy: currentUserName,
                    totalChanges: Object.keys(scenarioChanges.projects || {}).length +
                        Object.keys(scenarioChanges.resources || {}).length
                };
                await scenarioManager.saveScenarioChanges(activeScenario.id, scenarioChanges, metadata);

                setScenarios(prev => prev.map(s =>
                    s.id === activeScenario.id ? { ...s, changes: scenarioChanges, metadata } : s
                ));

                addToast({ type: 'success', title: 'Draft Updated', message: `Changes saved to "${activeScenario.name}"` });

                // Cleanup pending after confirmation
                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev };
                            delete next[projectId];
                            return next;
                        }
                        return prev;
                    });
                }, 30000);

            } else {
                // ═══ LIVE MODE: Write to Airtable ═══
                setPendingUpdates(prev => ({
                    ...prev,
                    [projectId]: { ...updates, timestamp: Date.now(), updateId }
                }));

                // Resolve field IDs and prepare Airtable update
                const airtableFields = {};
                const fieldMappings = storedSettings?.fieldMapping || {};

                // Map common fields to their proxy equivalents
                // Also includes aliases (start → kickOffDate, end → launchDate)
                const proxyFieldMap = {
                    kickOffDate: 'kickOffDateProxy',
                    launchDate: 'launchDateProxy',
                    start: 'kickOffDateProxy',  // DetailModal uses 'start'
                    end: 'launchDateProxy',     // DetailModal uses 'end'
                    status: 'statusProxy',
                    squad: 'squadProxy',
                    wave: 'waveProxy',
                    effortProfile: 'effortProfileProxy',
                    resourcingOverride: 'resourcingOverrideProxy',
                    lockLaunch: 'lockLaunchProxy',
                    lockSquad: 'lockSquadProxy',
                    lockResources: 'lockResourcesProxy',
                    resourcedWithinProgram: 'resourcedWithinProgramProxy'
                };

                for (const [field, value] of Object.entries(updates)) {
                    let fieldId = null;

                    if (field === 'wave') {
                        // Single Select — { name: "Value" }
                        fieldId = resolveWriteFieldId(SETTINGS.PROJECT_WAVE, SETTINGS.WAVE_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = value ? { name: value } : null;
                            continue;
                        }
                    } else if (field === 'effortProfile') {
                        // Single Select — { name: "Value" }
                        fieldId = resolveWriteFieldId(SETTINGS.EFFORT_PROFILE, SETTINGS.EFFORT_PROFILE_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = value ? { name: value } : null;
                            continue;
                        }
                    } else if (field === 'squad') {
                        // Linked record
                        fieldId = resolveWriteFieldId(SETTINGS.PROJECT_SQUAD, SETTINGS.PROJECT_SQUAD_UPDATE);

                        // Legacy generic lookup fallback
                        if (!fieldId) {
                            const proxyField = proxyFieldMap[field];
                            fieldId = fieldMappings[proxyField] || fieldMappings[field];
                        }

                        if (fieldId) {
                            if (!value || value === 'Unassigned' || value === 'unassigned') {
                                airtableFields[fieldId] = []; // Clear linked record
                            } else {
                                // If it's a valid squad name, we need to map it to an ID if possible, 
                                // but for now assuming the UI passes an ID or the field accepts name writes (some do, most linked don't)
                                // Actually, Dashboard.jsx usually passes IDs. If it passes a name, we might need to look it up.
                                // BUT, for now, let's just assume value is correct unless it's "Unassigned"

                                // If value is array (already formatted), use as is
                                if (Array.isArray(value)) {
                                    airtableFields[fieldId] = value;
                                } else {
                                    // Try to find squad ID from name map
                                    const squadId = squadIdMap?.[value] || value;
                                    // If it looks like an ID (rec...), wrap it
                                    if (typeof squadId === 'string' && squadId.startsWith('rec')) {
                                        airtableFields[fieldId] = [{ id: squadId }];
                                    } else {
                                        // Fallback - might fail if field doesn't accept strings
                                        airtableFields[fieldId] = [{ name: value }];
                                    }
                                }
                            }
                            continue;
                        }
                    } else if (field === 'start' || field === 'kickOffDate') {
                        fieldId = resolveWriteFieldId(SETTINGS.KICK_OFF, SETTINGS.KICK_OFF_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = value || null;
                            continue;
                        }
                    } else if (field === 'end' || field === 'launchDate') {
                        fieldId = resolveWriteFieldId(SETTINGS.LAUNCH, SETTINGS.LAUNCH_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = value || null;
                            continue;
                        }
                    } else if (field === 'status') {
                        fieldId = resolveWriteFieldId(SETTINGS.STATUS, SETTINGS.STATUS_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = value ? { name: value } : null;
                            continue;
                        }
                    } else if (field === 'resourcingOverride') {
                        fieldId = resolveWriteFieldId(SETTINGS.RESOURCING_OVERRIDE, SETTINGS.RESOURCING_OVERRIDE_UPDATE);
                        if (fieldId) {
                            airtableFields[fieldId] = (value === '' || value === null) ? null : value;
                            continue;
                        }
                    } else if (field === 'transactionalBenefits') {
                        // Number field — direct write (no proxy)
                        fieldId = resolveFieldId(stableSettings[SETTINGS.TRANSACTIONAL_BENEFITS]);
                        if (fieldId) {
                            airtableFields[fieldId] = (value === '' || value === null) ? null : Number(value);
                            continue;
                        }
                    } else if (field === 'nonTransactionalBenefits') {
                        // Number field — direct write (no proxy)
                        fieldId = resolveFieldId(stableSettings[SETTINGS.NON_TRANSACTIONAL_BENEFITS]);
                        if (fieldId) {
                            airtableFields[fieldId] = (value === '' || value === null) ? null : Number(value);
                            continue;
                        }
                    } else if (field === 'contentOnlyBenefits') {
                        // Number field — direct write (no proxy)
                        fieldId = resolveFieldId(stableSettings[SETTINGS.CONTENT_ONLY_BENEFITS]);
                        if (fieldId) {
                            airtableFields[fieldId] = (value === '' || value === null) ? null : Number(value);
                            continue;
                        }
                    } else if (field === 'lockLaunch') {
                        fieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_LAUNCH, SETTINGS.SLOT_LOCK_LAUNCH_UPDATE);
                        if (fieldId) { airtableFields[fieldId] = !!value; continue; }
                    } else if (field === 'lockSquad') {
                        fieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_SQUAD, SETTINGS.SLOT_LOCK_SQUAD_UPDATE);
                        if (fieldId) { airtableFields[fieldId] = !!value; continue; }
                    } else if (field === 'lockResources') {
                        fieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_RESOURCES, SETTINGS.SLOT_LOCK_RESOURCES_UPDATE);
                        if (fieldId) { airtableFields[fieldId] = !!value; continue; }
                    } else if (field === 'resourcedWithinProgram') {
                        // Handle checkbox field
                        fieldId = resolveFieldId(stableSettings[SETTINGS.RESOURCED_WITHIN_PROGRAM]);
                        if (fieldId) {
                            airtableFields[fieldId] = !!value; // Ensure boolean
                            continue;
                        }
                    } else if (field === 'resourced') {
                        // Handle Resourced checkbox (non-synced, direct write)
                        fieldId = resolveFieldId(stableSettings[SETTINGS.RESOURCED]);
                        if (fieldId) {
                            airtableFields[fieldId] = !!value; // Ensure boolean
                            continue;
                        }
                    } else if (field === 'resourcingNotes') {
                        // Handle Resourcing Notes text (non-synced, direct write)
                        fieldId = resolveFieldId(stableSettings[SETTINGS.RESOURCING_NOTES]);
                        if (fieldId) {
                            airtableFields[fieldId] = value || '';
                            continue;
                        }
                    } else {
                        // Fallback to internal fieldMappings for legacy/other proxy fields
                        const proxyField = proxyFieldMap[field];
                        fieldId = fieldMappings[proxyField] || fieldMappings[field];
                    }

                    if (fieldId) {
                        airtableFields[fieldId] = value;
                    }
                }

                if (Object.keys(airtableFields).length > 0) {
                    await projTable.updateRecordAsync(projectId, airtableFields);
                    logAuditEvent(AUDIT_EVENTS.PROJECT_UPDATED, {
                        projectId,
                        projectName: project.name,
                        updates
                    });
                }

                addToast({ type: 'success', title: 'Project Updated', message: `${project.name} has been updated` });

                // Cleanup pending updates
                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev };
                            delete next[projectId];
                            return next;
                        }
                        return prev;
                    });
                }, 10000);
            }

            // Sync with DetailModal data if open
            if (selectedBucketData && selectedBucketData.details) {
                const updatedDetails = selectedBucketData.details.map(p => {
                    if (p.projectId === projectId || p.id === projectId) {
                        return { ...p, ...updates };
                    }
                    return p;
                });

                // Only update if changes were made
                if (JSON.stringify(updatedDetails) !== JSON.stringify(selectedBucketData.details)) {
                    setSelectedBucketData(prev => ({
                        ...prev,
                        details: updatedDetails
                    }));
                }
            }

        } catch (err) {
            console.error('handleUpdateProject error:', err);
            addToast({ type: 'error', title: 'Update Failed', message: err.message });

            // Rollback optimistic update
            setPendingUpdates(prev => {
                const next = { ...prev };
                delete next[projectId];
                return next;
            });
        }
    }, [
        projTable, effectiveProjects, allProjects, activeScenario, pendingUpdates,
        storedSettings, currentUserName, scenarioManager, addToast,
        setPendingUpdates, setScenarios, selectedBucketData, setSelectedBucketData,
        resolveFieldId, stableSettings, SETTINGS, squadIdMap, logAuditEvent, AUDIT_EVENTS
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE RESOURCE HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleUpdateResource = useCallback(async (resourceId, updates) => {
        if (!resTable) return;

        const resource = allResources?.find(r => r.id === resourceId);
        if (!resource) return;

        const updateId = Date.now();

        try {
            // ═══ DRAFT MODE ═══
            if (activeScenario && !activeScenario.isLive) {
                const scenarioChanges = {
                    ...activeScenario.changes,
                    resources: { ...(activeScenario.changes?.resources || {}) }
                };

                const existingEntry = scenarioChanges.resources[resourceId] || {};
                const existingOriginal = existingEntry.original || {};
                const existingChanges = existingEntry.changes || {};

                // Capture originals
                Object.keys(updates).forEach(field => {
                    if (!(field in existingOriginal)) {
                        existingOriginal[field] = resource[field];
                    }
                });

                const newChanges = { ...existingChanges, ...updates };

                scenarioChanges.resources[resourceId] = {
                    name: resource.name || resourceId,
                    original: existingOriginal,
                    changes: newChanges,
                    ...newChanges
                };

                // Optimistic UI
                setPendingResourceUpdates(prev => ({
                    ...prev,
                    [resourceId]: { ...updates, isDraft: true, timestamp: Date.now(), updateId }
                }));

                // Persist
                const now = new Date().toISOString();
                const metadata = {
                    ...(activeScenario.metadata || {}),
                    lastModified: now,
                    lastSavedAt: now,
                    lastEditedBy: currentUserName,
                    totalChanges: Object.keys(scenarioChanges.projects || {}).length +
                        Object.keys(scenarioChanges.resources || {}).length
                };
                await scenarioManager.saveScenarioChanges(activeScenario.id, scenarioChanges, metadata);

                setScenarios(prev => prev.map(s =>
                    s.id === activeScenario.id ? { ...s, changes: scenarioChanges, metadata } : s
                ));

                addToast({ type: 'success', title: 'Draft Updated', message: `Resource changes saved` });

                // Cleanup
                setTimeout(() => {
                    setPendingResourceUpdates(prev => {
                        if (prev[resourceId]?.updateId === updateId) {
                            const next = { ...prev };
                            delete next[resourceId];
                            return next;
                        }
                        return prev;
                    });
                }, 30000);

            } else {
                // ═══ LIVE MODE — direct writes only ═══
                setPendingResourceUpdates(prev => ({
                    ...prev,
                    [resourceId]: { ...updates, timestamp: Date.now(), updateId }
                }));

                // Shape values for Airtable. Airtable expects different formats per field type;
                // get it wrong and the server returns 422 even with typecast:true. Diagnosed
                // historically as the cause of "silent" write failures on select fields.
                //   - singleSelect          → { name: value }
                //   - multipleSelects       → [{ name: value }]
                //   - multipleRecordLinks   → [{ name: value }] (typecast:true resolves by name)
                //   - everything else       → raw value
                const shapeValue = (fieldId, value) => {
                    if (!fieldId || value == null || value === '') return null;
                    const f = resTable.getFieldByIdIfExists ? resTable.getFieldByIdIfExists(fieldId) : null;
                    if (!f) return value;
                    if (f.type === 'singleSelect') return { name: String(value) };
                    if (f.type === 'multipleSelects' || f.type === 'multipleRecordLinks') {
                        return Array.isArray(value)
                            ? value.map(v => typeof v === 'string' ? { name: v } : v)
                            : [{ name: String(value) }];
                    }
                    return value;
                };

                // Build the canonical-only write payload. We used to also build a proxy
                // (*_UPDATE) payload as a fallback for the days when Airtable disallowed
                // direct writes to synced fields, but that's been retired — direct writes
                // now work, and the dual-write created its own bugs (stale proxy snapshots
                // hiding legitimate edits).
                const fields = {};
                const addField = (canonicalKey, value, { numeric = false, datelike = false } = {}) => {
                    const fid = canonicalKey ? resolveFieldId(stableSettings[canonicalKey]) : null;
                    if (!fid) return;
                    const toNumberOrNull = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);
                    const toDateOrNull = (v) => (v === '' || v === null || v === undefined) ? null : v;
                    if (numeric) fields[fid] = toNumberOrNull(value);
                    else if (datelike) fields[fid] = toDateOrNull(value);
                    else fields[fid] = shapeValue(fid, value);
                };

                for (const [field, value] of Object.entries(updates)) {
                    if (field === 'rampProfile') addField(SETTINGS.RAMP_UP_PROFILE, value);
                    else if (field === 'rampStartDate') addField(SETTINGS.RAMP_START_DATE, value, { datelike: true });
                    else if (field === 'targetUtilization') {
                        // Airtable stores a literal 0 in a Percent/Number field as empty, which the
                        // read path (Dashboard.jsx) then treats as "unset" and defaults to 80%.
                        // Persist an explicit 0% as the -1 sentinel; the read path maps any negative
                        // value back to 0, so 0% now survives the round-trip instead of showing 80%.
                        const num = (value === '' || value === null || value === undefined) ? null : Number(value);
                        addField(SETTINGS.TARGET_UTILIZATION, num === 0 ? -1 : value, { numeric: true });
                    }
                    else if (field === 'workingHours') addField(SETTINGS.WORKING_HOURS, value, { numeric: true });
                    else if (field === 'startDate') addField(SETTINGS.START_DATE, value, { datelike: true });
                    else if (field === 'leaveDate') addField(SETTINGS.LEAVE_DATE, value, { datelike: true });
                    else if (field === 'leaveStartDate') addField(SETTINGS.LEAVE_START_DATE, value, { datelike: true });
                    else if (field === 'leaveEndDate') addField(SETTINGS.LEAVE_END_DATE, value, { datelike: true });
                    else if (field === 'annualUtilization') {
                        // Same Airtable 0-as-empty problem as targetUtilization; the read path
                        // already maps a negative sentinel back to 0, so persist 0% as -1.
                        const num = (value === '' || value === null || value === undefined) ? null : Number(value);
                        addField(SETTINGS.ANNUAL_UTILIZATION, num === 0 ? -1 : value, { numeric: true });
                    }
                    // Silently drop unknown fields rather than mis-writing.
                }

                if (Object.keys(fields).length > 0) {
                    try {
                        await resTable.updateRecordsAsync(
                            [{ id: resourceId, fields }],
                            { typecast: true }
                        );
                    } catch (err) {
                        // Diagnostic on error: log field types + Airtable permission check so
                        // the failure mode is visible. Common cause is value-doesn't-match-option
                        // on a select field (e.g. typed name not in the option list).
                        const diag = {};
                        for (const fid of Object.keys(fields)) {
                            const f = resTable.getFieldByIdIfExists ? resTable.getFieldByIdIfExists(fid) : null;
                            let perm = null;
                            try {
                                perm = resTable.checkPermissionsForUpdateRecord
                                    ? resTable.checkPermissionsForUpdateRecord(resourceId, { [fid]: fields[fid] })
                                    : null;
                            } catch (e) { perm = { error: String(e?.message || e) }; }
                            diag[fid] = { name: f?.name, type: f?.type, isComputed: f?.isComputed, value: fields[fid], permission: perm };
                        }
                        console.warn('[handleUpdateResource] Write failed — diagnostics:', { resourceId, resourceName: resource.name, requestedUpdates: updates, fieldDetails: diag });
                        throw err;
                    }

                    logAuditEvent(AUDIT_EVENTS.RESOURCE_UPDATED, { resourceId, resourceName: resource.name, updates });
                    addToast({ type: 'success', title: 'Resource Updated', message: `${resource.name} has been updated` });
                } else {
                    // No canonical field IDs resolved — nothing to write. Surface a warning so
                    // the user can map the missing fields via the gear icon.
                    const fieldList = Object.keys(updates).join(', ');
                    addToast({
                        type: 'warning',
                        title: 'Nothing to save',
                        message: `Field(s) not mapped: ${fieldList}. Open the gear icon and map these resource fields, then try again.`
                    });
                }

                // Cleanup
                setTimeout(() => {
                    setPendingResourceUpdates(prev => {
                        if (prev[resourceId]?.updateId === updateId) {
                            const next = { ...prev };
                            delete next[resourceId];
                            return next;
                        }
                        return prev;
                    });
                }, 10000);
            }
        } catch (err) {
            console.error('handleUpdateResource error:', err);
            addToast({ type: 'error', title: 'Update Failed', message: err.message });

            setPendingResourceUpdates(prev => {
                const next = { ...prev };
                delete next[resourceId];
                return next;
            });
        }
    }, [
        resTable, allResources, activeScenario, storedSettings, currentUserName,
        scenarioManager, addToast, setPendingResourceUpdates, setScenarios
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // DETAIL MODAL NAVIGATION
    // Handle arrow key navigation in DetailModal - cycles through filteredProjects
    // ═══════════════════════════════════════════════════════════════════
    const handleDetailModalNavigate = useCallback((direction) => {
        if (!selectedBucketData || !filteredProjects?.length) return;

        // Get current project from detail modal
        const currentDetails = selectedBucketData.details || [];
        const currentProjectId = currentDetails[0]?.projectId || currentDetails[0]?.id;

        if (!currentProjectId) return;

        // Find current index in filtered projects
        const currentIndex = filteredProjects.findIndex(p => p.id === currentProjectId);
        if (currentIndex === -1) return;

        // Calculate next index with wraparound
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % filteredProjects.length;
        } else {
            nextIndex = (currentIndex - 1 + filteredProjects.length) % filteredProjects.length;
        }

        const nextProject = filteredProjects[nextIndex];
        if (!nextProject) return;

        // Update selectedBucketData with next project
        setSelectedBucketData({
            dateKey: nextProject.name,
            details: [{
                ...nextProject,
                name: nextProject.name,
                hours: (nextProject.pmEffort || 0) / 3600 + (nextProject.scEffort || 0) / 3600 + (nextProject.pdEffort || 0) / 3600,
                status: nextProject.status || 'Active',
                startDate: nextProject.kickOff || nextProject.start,
                endDate: nextProject.launch || nextProject.end,
                squads: nextProject.squads || [],
                projectId: nextProject.id,
                customer: nextProject.customer,
                countryFlag: nextProject.countryFlag,
                country: nextProject.country,
                team: nextProject.team || { pm: [], sc: [], pd: [] },
                effortProfile: nextProject.effortProfile,
                pctComplete: nextProject.pctComplete,
                wave: nextProject.wave
            }]
        });
    }, [selectedBucketData, filteredProjects, setSelectedBucketData]);

    // ═══════════════════════════════════════════════════════════════════
    // CLONE PROJECT HANDLER
    // Shows toast with project template info and copies to clipboard
    // ═══════════════════════════════════════════════════════════════════
    const handleCloneProject = useCallback((projectData) => {
        addToast({
            type: 'success',
            title: 'Project Template Ready',
            message: `"${projectData.name}" template copied. Create a new project in Airtable with these settings.`
        });

        // Copy project details to clipboard for easy pasting
        const templateInfo = `Project Template:
Name: ${projectData.name}
Status: ${projectData.status || 'Draft'}
Squad: ${(projectData.squads || []).join(', ') || 'Not set'}
Effort Profile: ${projectData.effortProfile || 'Default'}`;

        navigator.clipboard.writeText(templateInfo).catch(() => { });
    }, [addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO SELECT HANDLER
    // Handles selection with conflict detection
    // ═══════════════════════════════════════════════════════════════════
    const handleScenarioSelect = useCallback((scenarioId) => {
        // If deselecting scenario (returning to Live mode), just do it
        if (!scenarioId) {
            setActiveScenarioId(null);
            setPendingUpdates({});
            setPendingResourceUpdates({});
            return;
        }

        // Find the scenario being selected
        const scenario = scenarios?.find(s => s.id === scenarioId);
        if (!scenario || !scenario.changes) {
            setActiveScenarioId(scenarioId);
            return;
        }

        // Detect conflicts between draft changes and current database state
        if (scenarioManager) {
            const conflicts = scenarioManager.detectConflicts(scenario.changes, allProjects, allResources);
            const isStale = scenarioManager.isDraftStale(scenario);

            if (conflicts.hasConflicts || isStale) {
                setDetectedConflicts({ ...conflicts, isStale, draftName: scenario.name });
                setPendingScenarioId(scenarioId);
                setShowConflictModal(true);
                return;
            }
        }

        setActiveScenarioId(scenarioId);
    }, [scenarios, scenarioManager, allProjects, allResources, setActiveScenarioId, setPendingUpdates, setPendingResourceUpdates, setDetectedConflicts, setPendingScenarioId, setShowConflictModal]);

    // ═══════════════════════════════════════════════════════════════════
    // CONFLICT RESOLVE HANDLER
    // Applies user resolutions back to the scenario, then switches to it
    // ═══════════════════════════════════════════════════════════════════
    const handleConflictResolve = useCallback(async (resolvedConflicts) => {
        const scenarioId = pendingScenarioId;
        if (!scenarioId) {
            setShowConflictModal(false);
            setDetectedConflicts(null);
            setPendingScenarioId(null);
            return;
        }

        // Apply resolutions: patch the scenario's changes so originals match current DB
        if (resolvedConflicts && scenarioManager) {
            try {
                const scenario = scenarios?.find(s => s.id === scenarioId);
                if (scenario?.changes) {
                    const patchedChanges = JSON.parse(JSON.stringify(scenario.changes));
                    let modified = false;

                    // Process project conflict resolutions
                    if (resolvedConflicts.projects) {
                        for (const [projectId, fieldResolutions] of Object.entries(resolvedConflicts.projects)) {
                            const projectEntry = patchedChanges.projects?.[projectId];
                            if (!projectEntry) continue;

                            for (const [field, resolution] of Object.entries(fieldResolutions)) {
                                if (resolution === 'current') {
                                    // User chose "Use Current" — remove draft change, update original to current
                                    const currentProject = allProjects?.find(p => p.id === projectId);
                                    if (projectEntry.changes) delete projectEntry.changes[field];
                                    delete projectEntry[field];
                                    if (projectEntry.original) {
                                        projectEntry.original[field] = currentProject?.[field] ?? null;
                                    }
                                    modified = true;
                                } else if (resolution === 'draft') {
                                    // User chose "Use Draft" — keep draft value, update original to current
                                    const currentProject = allProjects?.find(p => p.id === projectId);
                                    if (projectEntry.original) {
                                        projectEntry.original[field] = currentProject?.[field] ?? null;
                                    }
                                    modified = true;
                                }
                            }
                        }
                    }

                    // Process resource conflict resolutions
                    if (resolvedConflicts.resources) {
                        for (const [resourceId, fieldResolutions] of Object.entries(resolvedConflicts.resources)) {
                            const resourceEntry = patchedChanges.resources?.[resourceId];
                            if (!resourceEntry) continue;

                            for (const [field, resolution] of Object.entries(fieldResolutions)) {
                                if (resolution === 'current') {
                                    const currentResource = allResources?.find(r => r.id === resourceId);
                                    if (resourceEntry.changes) delete resourceEntry.changes[field];
                                    delete resourceEntry[field];
                                    if (resourceEntry.original) {
                                        resourceEntry.original[field] = currentResource?.[field] ?? null;
                                    }
                                    modified = true;
                                } else if (resolution === 'draft') {
                                    const currentResource = allResources?.find(r => r.id === resourceId);
                                    if (resourceEntry.original) {
                                        resourceEntry.original[field] = currentResource?.[field] ?? null;
                                    }
                                    modified = true;
                                }
                            }
                        }
                    }

                    // Save patched changes back to the scenario
                    if (modified) {
                        const now = new Date().toISOString();
                        const metadata = {
                            ...(scenario.metadata || {}),
                            lastModified: now,
                            lastSavedAt: now,
                            conflictsResolvedAt: now
                        };
                        await scenarioManager.saveScenarioChanges(scenarioId, patchedChanges, metadata);
                        setScenarios(prev => prev.map(s =>
                            s.id === scenarioId ? { ...s, changes: patchedChanges, metadata } : s
                        ));
                        console.log(`[CONFLICT] Applied ${Object.keys(resolvedConflicts.projects || {}).length + Object.keys(resolvedConflicts.resources || {}).length} conflict resolutions to scenario`);
                    }
                }
            } catch (err) {
                console.error('[CONFLICT] Failed to apply resolutions:', err);
                // Continue anyway — better to load the draft than block
            }
        }

        setActiveScenarioId(scenarioId);
        setShowConflictModal(false);
        setDetectedConflicts(null);
        setPendingScenarioId(null);
    }, [pendingScenarioId, scenarios, scenarioManager, allProjects, allResources, setActiveScenarioId, setShowConflictModal, setDetectedConflicts, setPendingScenarioId, setScenarios]);

    // ═══════════════════════════════════════════════════════════════════
    // FINANCIAL ADJUSTMENT HANDLERS
    // Add/remove financial adjustments to/from active scenario
    // ═══════════════════════════════════════════════════════════════════
    const handleAddFinancialAdjustment = useCallback(async (adjustment) => {
        if (!activeScenario) return;

        const currentChanges = activeScenario.changes || { projects: {}, resources: {} };
        const currentAdjustments = currentChanges.financialAdjustments || [];

        const newChanges = {
            ...currentChanges,
            financialAdjustments: [...currentAdjustments, adjustment]
        };

        // Update local state immediately for optimistic UI
        setScenarios(prev => prev.map(s =>
            s.id === activeScenario.id
                ? { ...s, changes: newChanges }
                : s
        ));

        // Persist to Airtable
        if (scenarioManager) {
            try {
                await scenarioManager.saveScenarioChanges(
                    activeScenario.id,
                    newChanges,
                    { ...activeScenario.metadata, lastSavedAt: new Date().toISOString() }
                );
            } catch (err) {
                console.error('Failed to save financial adjustment:', err);
            }
        }
    }, [activeScenario, scenarioManager, setScenarios]);

    const handleRemoveFinancialAdjustment = useCallback(async (adjustmentId) => {
        if (!activeScenario) return;

        const currentChanges = activeScenario.changes || { projects: {}, resources: {} };
        const currentAdjustments = currentChanges.financialAdjustments || [];

        const newChanges = {
            ...currentChanges,
            financialAdjustments: currentAdjustments.filter(a => a.id !== adjustmentId)
        };

        // Update local state immediately
        setScenarios(prev => prev.map(s =>
            s.id === activeScenario.id
                ? { ...s, changes: newChanges }
                : s
        ));

        // Persist to Airtable
        if (scenarioManager) {
            try {
                await scenarioManager.saveScenarioChanges(
                    activeScenario.id,
                    newChanges,
                    { ...activeScenario.metadata, lastSavedAt: new Date().toISOString() }
                );
            } catch (err) {
                console.error('Failed to save financial adjustment removal:', err);
            }
        }
    }, [activeScenario, scenarioManager, setScenarios]);

    // ═══════════════════════════════════════════════════════════════════
    // UNDO/REDO ASSIGNMENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════
    const handleUndoAssignment = useCallback(async () => {
        if (!assignmentHistory?.length) return;

        const lastAction = assignmentHistory[assignmentHistory.length - 1];
        setAssignmentHistory(prev => prev.slice(0, -1));
        setAssignmentFuture(prev => [...prev, lastAction]);

        // Revert the project using hook's handleUpdateProject
        if (lastAction.oldSquad || lastAction.oldStart) {
            await handleUpdateProject(lastAction.projectId, {
                squad: lastAction.oldSquad,
                start: lastAction.oldStart,
                kickOff: lastAction.oldStart,
                end: lastAction.oldEnd,
                launch: lastAction.oldEnd
            });
            addToast({ type: 'info', title: 'Undone', message: `Reverted ${lastAction.projectName}` });
        }
    }, [assignmentHistory, setAssignmentHistory, setAssignmentFuture, handleUpdateProject, addToast]);

    const handleRedoAssignment = useCallback(async () => {
        if (!assignmentFuture?.length) return;

        const redoAction = assignmentFuture[assignmentFuture.length - 1];
        setAssignmentFuture(prev => prev.slice(0, -1));
        setAssignmentHistory(prev => [...prev, redoAction]);

        // Re-apply the assignment using hook's handleUpdateProject
        await handleUpdateProject(redoAction.projectId, {
            squad: redoAction.newSquad,
            start: redoAction.newStart,
            kickOff: redoAction.newStart,
            end: redoAction.newEnd,
            launch: redoAction.newEnd
        });
        addToast({ type: 'info', title: 'Redone', message: `Re-applied ${redoAction.projectName}` });
    }, [assignmentFuture, setAssignmentFuture, setAssignmentHistory, handleUpdateProject, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // COMMIT SCENARIO HANDLER
    // Commits draft scenario changes to live Airtable data
    // ═══════════════════════════════════════════════════════════════════
    const handleCommitScenario = useCallback(async (skipConfirm = false, selection = null) => {
        if (!activeScenario || !activeScenario.changes) return;

        // Show confirmation modal if not already confirmed
        if (!skipConfirm) {
            setShowCommitModal(true);
            return;
        }

        setShowCommitModal(false);
        try {
            const changes = activeScenario.changes || {};
            const projectUpdates = [];
            const resourceUpdates = [];

            // Determine which items to commit (null selection = commit all)
            const selectedProjectIds = selection?.projectIds ? new Set(selection.projectIds) : null;
            const selectedResourceIds = selection?.resourceIds ? new Set(selection.resourceIds) : null;
            const commitPrograms = selection ? (selection.commitPrograms !== false) : true;
            const commitProgramCustomers = selection?.commitProgramCustomers ? new Set(selection.commitProgramCustomers) : null;

            // 1. Process PROJECT changes
            const projectChanges = changes.projects || {};
            for (const [projectId, entry] of Object.entries(projectChanges)) {
                // Skip if not selected in partial commit
                if (selectedProjectIds && !selectedProjectIds.has(projectId)) continue;
                const fields = {};
                const updates = entry.changes || entry;

                if (!updates || typeof updates !== 'object') continue;

                if (updates.status !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.STATUS, SETTINGS.STATUS_UPDATE);
                    if (fid) fields[fid] = updates.status ? { name: updates.status } : null;
                }
                if (updates.squad !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.PROJECT_SQUAD, SETTINGS.PROJECT_SQUAD_UPDATE);
                    if (fid) {
                        if (updates.squad) {
                            const squadRecordId = squadIdMap[updates.squad];
                            if (squadRecordId) {
                                fields[fid] = [{ id: squadRecordId }];
                            } else {
                                fields[fid] = [{ name: updates.squad }];
                            }
                        } else {
                            fields[fid] = [];
                        }
                    }
                }
                if (updates.effortProfile !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.EFFORT_PROFILE, SETTINGS.EFFORT_PROFILE_UPDATE);
                    // Treat 'None' as a clear, matching the LIVE batch-apply path (handleBatchApply)
                    // so committing a draft that selected 'None' clears the field rather than
                    // writing a literal 'None' option.
                    if (fid) fields[fid] = updates.effortProfile && updates.effortProfile !== 'None' ? { name: updates.effortProfile } : null;
                }
                if (updates.start !== undefined || updates.kickOff !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.KICK_OFF, SETTINGS.KICK_OFF_UPDATE);
                    const dateValue = updates.start ?? updates.kickOff;
                    if (fid) fields[fid] = dateValue || null;
                }
                if (updates.end !== undefined || updates.launch !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.LAUNCH, SETTINGS.LAUNCH_UPDATE);
                    const dateValue = updates.end ?? updates.launch;
                    if (fid) fields[fid] = dateValue || null;
                }
                if (updates.wave !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.PROJECT_WAVE, SETTINGS.WAVE_UPDATE);
                    if (fid) fields[fid] = updates.wave ? { name: updates.wave } : null;
                }
                if (updates.resourcingOverride !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RESOURCING_OVERRIDE, SETTINGS.RESOURCING_OVERRIDE_UPDATE);
                    if (fid) fields[fid] = (updates.resourcingOverride === '' || updates.resourcingOverride === null) ? null : updates.resourcingOverride;
                }
                if (updates.lockLaunch !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_LAUNCH, SETTINGS.SLOT_LOCK_LAUNCH_UPDATE);
                    if (fid) fields[fid] = !!updates.lockLaunch;
                }
                if (updates.lockSquad !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_SQUAD, SETTINGS.SLOT_LOCK_SQUAD_UPDATE);
                    if (fid) fields[fid] = !!updates.lockSquad;
                }
                if (updates.lockResources !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_RESOURCES, SETTINGS.SLOT_LOCK_RESOURCES_UPDATE);
                    if (fid) fields[fid] = !!updates.lockResources;
                }
                if (updates.resourcedWithinProgram !== undefined) {
                    const fid = resolveFieldId(stableSettings[SETTINGS.RESOURCED_WITHIN_PROGRAM]);
                    if (fid) fields[fid] = !!updates.resourcedWithinProgram;
                }
                // Team (PM/SC/PD) linked record assignments — canonical-only writes,
                // matching resolveWriteFieldId behaviour for the rest of the codebase.
                // (Was previously proxy-first, which dropped writes onto fields the
                // canonical-only reads in Dashboard.jsx wouldn't see.)
                if (updates.team && typeof updates.team === 'object') {
                    const roleSettings = {
                        pm: { update: SETTINGS.PM_ALLOC_UPDATE, source: SETTINGS.PM_ALLOCATION },
                        sc: { update: SETTINGS.SC_ALLOC_UPDATE, source: SETTINGS.SC_ALLOCATION },
                        pd: { update: SETTINGS.PD_ALLOC_UPDATE, source: SETTINGS.PD_ALLOCATION }
                    };
                    for (const [role, keys] of Object.entries(roleSettings)) {
                        if (updates.team[role]) {
                            const fid = resolveWriteFieldId(keys.source, keys.update);
                            if (fid) {
                                const realUsers = updates.team[role].filter(m => !m.isPlaceholder).map(m => ({ id: m.id }));
                                fields[fid] = realUsers;
                            }
                        }
                    }
                    // Also write the JSON allocations blob
                    const allocFieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (allocFieldId) {
                        const allocations = buildAllocationsJson(updates.team);
                        fields[allocFieldId] = JSON.stringify(allocations);
                    }
                }

                if (Object.keys(fields).length > 0) {
                    console.log(`[COMMIT] Project "${entry.name || projectId}" (${projectId}): ${Object.keys(fields).length} fields`, Object.keys(fields));
                    projectUpdates.push({ id: projectId, fields });
                } else {
                    console.warn(`[COMMIT] Project "${entry.name || projectId}" (${projectId}): SKIPPED — no fields resolved. updates keys:`, Object.keys(updates));
                }
            }

            // 2. Process RESOURCE changes
            const resourceChanges = changes.resources || {};
            for (const [resourceId, entry] of Object.entries(resourceChanges)) {
                // Skip if not selected in partial commit
                if (selectedResourceIds && !selectedResourceIds.has(resourceId)) continue;
                const fields = {};
                const updates = entry.changes || entry;

                if (!updates || typeof updates !== 'object') continue;

                if (updates.rampProfile !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RAMP_UP_PROFILE, SETTINGS.RAMP_PROFILE_UPDATE);
                    if (fid) fields[fid] = updates.rampProfile ? { name: updates.rampProfile } : null;

                    if (!updates.rampProfile) {
                        const dateFid = resolveWriteFieldId(SETTINGS.RAMP_START_DATE, SETTINGS.RAMP_START_DATE_UPDATE);
                        if (dateFid) fields[dateFid] = null;
                    }
                }
                if (updates.rampStartDate !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RAMP_START_DATE, SETTINGS.RAMP_START_DATE_UPDATE);
                    if (fid) fields[fid] = updates.rampStartDate || null;
                }

                if (Object.keys(fields).length > 0) resourceUpdates.push({ id: resourceId, fields });
            }

            // 3. Process PROGRAM ASSIGNMENT changes
            const programUpdates = [];
            const draftAssignments = changes.programAssignments || [];

            if (commitPrograms && draftAssignments.length > 0 && programsTable && programRecords) {
                // Build lookup: customer name → program record
                const programsByCustomer = {};
                const recordMap = storedSettings?.programRecordMap || {};

                // First: apply explicit mappings from programRecordMap
                Object.entries(recordMap).forEach(([customer, recordId]) => {
                    const rec = programRecords.find(r => r.id === recordId);
                    if (rec) programsByCustomer[customer] = rec;
                });

                // Then: name / customer field matching (won't overwrite explicit mappings)
                (programRecords || []).forEach(r => {
                    if (r.name && !programsByCustomer[r.name]) programsByCustomer[r.name] = r;
                    const customerFieldId = stableSettings?.[SETTINGS.PROGRAM_CUSTOMER];
                    if (customerFieldId) {
                        try {
                            const val = r.getCellValueAsString(customerFieldId);
                            if (val && !programsByCustomer[val]) programsByCustomer[val] = r;
                        } catch (e) { /* skip */ }
                    }
                });



                // Workstream → update field settings key
                // Workstream → update field settings key
                const WS_FIELD_MAP = {
                    'Integrations': SETTINGS.PROGRAM_WS_INTEGRATIONS_UPDATE,
                    'Payroll': SETTINGS.PROGRAM_WS_PAYROLL_UPDATE,
                    'Consulting': SETTINGS.PROGRAM_WS_CONSULTING_UPDATE,
                    'Best Practice': SETTINGS.PROGRAM_WS_BEST_PRACTICE_UPDATE,
                    'Comms': SETTINGS.PROGRAM_WS_COMMS_UPDATE,
                    'Home': SETTINGS.PROGRAM_WS_HOME_UPDATE,
                    'Comms & Branding': SETTINGS.PROGRAM_WS_COMMS_UPDATE,
                    'Homepage': SETTINGS.PROGRAM_WS_HOME_UPDATE,
                    'Program Governance': SETTINGS.PROGRAM_WS_GOVERNANCE_UPDATE,
                    'Governance': SETTINGS.PROGRAM_WS_GOVERNANCE_UPDATE
                };

                // Workstream → read field settings key (fallback)
                const WS_FIELD_MAP_READ = {
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

                // Group assignments by customer + workstream
                const grouped = {};
                draftAssignments.forEach(a => {
                    if (!grouped[a.customer]) grouped[a.customer] = {};
                    if (!grouped[a.customer][a.workstream]) grouped[a.customer][a.workstream] = [];
                    grouped[a.customer][a.workstream].push(a.resourceId);
                });



                for (const [customer, wsMap] of Object.entries(grouped)) {
                    // Skip customers not selected for commit
                    if (commitProgramCustomers && !commitProgramCustomers.has(customer)) {
                        continue;
                    }

                    let record = programsByCustomer[customer];

                    // Auto-create a Programs table record if one doesn't exist (safety net)
                    if (!record) {
                        try {
                            const customerFieldId = stableSettings?.[SETTINGS.PROGRAM_CUSTOMER];
                            const createFields = {};
                            if (customerFieldId) {
                                // Detect field type — skip if linked record (can't set without target record ID)
                                try {
                                    const custField = programsTable.getFieldByIdIfExists(customerFieldId);
                                    if (custField && custField.type !== 'multipleRecordLinks' && custField.type !== 'singleRecordLink') {
                                        createFields[customerFieldId] = customer;
                                    }
                                } catch (e) { /* skip setting customer */ }
                            }
                            const newRecordId = await programsTable.createRecordAsync(createFields);
                            record = { id: newRecordId };
                        } catch (createErr) {
                            console.warn(`[COMMIT] Failed to auto-create Programs record for "${customer}":`, createErr.message);
                            continue;
                        }
                    }

                    const fields = {};
                    let hasUpdates = false;
                    for (const [wsName, resourceIds] of Object.entries(wsMap)) {
                        // try direct lookup, then try stripping "Program " prefix
                        let settingsKey = WS_FIELD_MAP[wsName] || WS_FIELD_MAP[wsName.replace('Program ', '')];

                        if (!settingsKey) {
                            console.warn(`[COMMIT] No WS_FIELD_MAP entry for workstream "${wsName}"`);
                            continue;
                        }
                        // Routed via resolveWriteFieldId so the direct-writes toggle controls program-WS commits too.
                        const readKey = WS_FIELD_MAP_READ[wsName] || WS_FIELD_MAP_READ[wsName.replace('Program ', '')];
                        const fieldId = resolveWriteFieldId(readKey, settingsKey);
                        if (!fieldId) {
                            console.warn(`[COMMIT] No field ID in settings for "${settingsKey}" (workstream "${wsName}")`);
                            continue;
                        }
                        // Validate the field actually exists in the Programs table
                        try {
                            const field = programsTable.getFieldByIdIfExists(fieldId);
                            if (!field) {
                                console.warn(`[COMMIT] Skipping program field ${fieldId} for "${wsName}" — field does not exist in Programs table`);
                                continue;
                            }
                        } catch (e) {
                            console.warn(`[COMMIT] Skipping program field ${fieldId} for "${wsName}":`, e.message);
                            continue;
                        }
                        const uniqueIds = [...new Set(resourceIds)];
                        fields[fieldId] = uniqueIds.map(id => ({ id }));
                        hasUpdates = true;
                    }
                    if (hasUpdates) {
                        programUpdates.push({ id: record.id, fields });
                    } else {
                        console.warn(`[COMMIT] No field updates for "${customer}" — all workstreams skipped`);
                    }
                }
            }


            // 4. Batch Execute Updates
            const processBatch = async (table, items, label = '') => {
                const BATCH_SIZE = 50;
                console.log(`[COMMIT] ${label}: writing ${items.length} records in batches of ${BATCH_SIZE}`);
                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);
                    console.log(`[COMMIT] ${label} batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`, batch.map(r => ({ id: r.id, fieldCount: Object.keys(r.fields).length, fieldIds: Object.keys(r.fields) })));
                    await table.updateRecordsAsync(batch, { typecast: true });
                    console.log(`[COMMIT] ${label} batch ${Math.floor(i / BATCH_SIZE) + 1}: SUCCESS`);
                }
            };

            // Log the full projectUpdates for debugging
            if (projectUpdates.length > 0) {
                console.log(`[COMMIT] projectUpdates (${projectUpdates.length}):`, JSON.stringify(projectUpdates, null, 2));
            }

            if (projectUpdates.length > 0 && projTable) {
                await processBatch(projTable, projectUpdates, 'Projects');
            }

            if (resourceUpdates.length > 0 && resTable) {
                await processBatch(resTable, resourceUpdates, 'Resources');
            }

            if (programUpdates.length > 0 && programsTable) {
                try {
                    await processBatch(programsTable, programUpdates);
                } catch (programErr) {
                    console.error('[COMMIT] Program update failed (non-fatal):', programErr);
                    addToast({ type: 'warning', title: 'Program update issue', message: programErr.message });
                }
            }

            // 4. Determine if partial or full commit
            const totalCount = projectUpdates.length + resourceUpdates.length + programUpdates.length;
            const isPartialCommit = selection !== null;

            // Build remaining changes for partial commit
            const remainingProjects = {};
            const remainingResources = {};
            let remainingPrograms = [];

            if (isPartialCommit) {
                // Keep projects that were NOT selected for commit
                // When selectedProjectIds is null (full commit), this block is entered via isPartialCommit guard above
                // but the Set is null so no entries match, leaving remainingProjects empty — correct behavior
                for (const [id, entry] of Object.entries(projectChanges)) {
                    if (selectedProjectIds && !selectedProjectIds.has(id)) {
                        remainingProjects[id] = entry;
                    }
                }
                // Keep resources that were NOT selected
                for (const [id, entry] of Object.entries(resourceChanges)) {
                    if (selectedResourceIds && !selectedResourceIds.has(id)) {
                        remainingResources[id] = entry;
                    }
                }
                // Keep programs if not committed
                if (!commitPrograms) {
                    remainingPrograms = draftAssignments;
                } else if (commitProgramCustomers) {
                    // Keep assignments for un-selected customers
                    remainingPrograms = draftAssignments.filter(a => !commitProgramCustomers.has(a.customer));
                }
            }

            const hasRemainingChanges = Object.keys(remainingProjects).length > 0 ||
                Object.keys(remainingResources).length > 0 ||
                remainingPrograms.length > 0;

            if (hasRemainingChanges) {
                // Partial commit: save remaining changes back to scenario
                const remainingChanges = {
                    projects: remainingProjects,
                    resources: remainingResources,
                    programAssignments: remainingPrograms,
                    financialAdjustments: changes.financialAdjustments || []
                };
                const remainingCount = Object.keys(remainingProjects).length +
                    Object.keys(remainingResources).length +
                    remainingPrograms.length;

                const now = new Date().toISOString();
                const metadata = {
                    ...(activeScenario.metadata || {}),
                    lastModified: now,
                    lastSavedAt: now,
                    totalChanges: remainingCount
                };
                await scenarioManager.saveScenarioChanges(activeScenario.id, remainingChanges, metadata);
                setScenarios(prev => prev.map(s =>
                    s.id === activeScenario.id
                        ? { ...s, changes: remainingChanges, metadata }
                        : s
                ));

                // Clear pending for committed items only
                setPendingUpdates(prev => {
                    const next = { ...prev };
                    projectUpdates.forEach(u => delete next[u.id]);
                    return next;
                });
                setPendingResourceUpdates(prev => {
                    const next = { ...prev };
                    resourceUpdates.forEach(u => delete next[u.id]);
                    return next;
                });

                // Create a committed snapshot of the selected changes for audit trail + revert
                try {
                    const committedChanges = {
                        projects: {},
                        resources: {},
                        programAssignments: []
                    };
                    // Collect committed project changes
                    for (const [id, entry] of Object.entries(projectChanges)) {
                        if (!selectedProjectIds || selectedProjectIds.has(id)) {
                            committedChanges.projects[id] = entry;
                        }
                    }
                    // Collect committed resource changes
                    for (const [id, entry] of Object.entries(resourceChanges)) {
                        if (!selectedResourceIds || selectedResourceIds.has(id)) {
                            committedChanges.resources[id] = entry;
                        }
                    }
                    // Collect committed program assignment changes
                    if (commitPrograms) {
                        committedChanges.programAssignments = commitProgramCustomers
                            ? draftAssignments.filter(a => commitProgramCustomers.has(a.customer))
                            : [...draftAssignments];
                    }

                    const commitTimestamp = new Date().toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    });
                    const commitName = `${activeScenario.name || 'Draft'} · commit ${commitTimestamp}`;
                    const newId = await scenarioManager.createScenario(commitName, 'Partial commit snapshot');
                    const commitMeta = {
                        committedAt: now,
                        totalChanges: totalCount,
                        parentScenarioId: activeScenario.id,
                        parentScenarioName: activeScenario.name,
                        isPartialCommit: true,
                        lastSavedAt: now
                    };
                    await scenarioManager.saveScenarioChanges(newId, committedChanges, commitMeta);
                    await scenarioManager.updateScenarioStatus(newId, 'Committed');

                    // Add the committed snapshot to local state
                    setScenarios(prev => [...prev, {
                        id: newId,
                        name: commitName,
                        status: 'Committed',
                        changes: committedChanges,
                        metadata: commitMeta
                    }]);


                } catch (snapshotErr) {
                    console.warn('[COMMIT] Failed to create commit snapshot (non-fatal):', snapshotErr.message);
                }

                addToast({
                    type: 'success',
                    title: 'Partial commit',
                    message: `${totalCount} change${totalCount !== 1 ? 's' : ''} committed · ${remainingCount} remaining in draft`
                });
            } else {
                // Full commit: mark scenario as Committed and exit draft
                // Preserve changes (including originals) for revert capability
                await scenarioManager.updateScenarioStatus(activeScenario.id, 'Committed');

                setScenarios(prev => prev.map(s =>
                    s.id === activeScenario.id
                        ? {
                            ...s,
                            status: 'Committed',
                            metadata: {
                                ...s.metadata,
                                committedAt: new Date().toISOString(),
                                totalChanges: totalCount
                            }
                        }
                        : s
                ));

                setPendingUpdates({});
                setPendingResourceUpdates({});
                setActiveScenarioId(null);

                addToast({
                    type: 'success',
                    title: 'Scenario committed',
                    message: `${totalCount} change${totalCount !== 1 ? 's' : ''} synced to Airtable`
                });
            }

            // Log audit event
            if (logAuditEvent && AUDIT_EVENTS) {
                logAuditEvent(AUDIT_EVENTS.SCENARIO_COMMITTED, {
                    scenarioId: activeScenario.id,
                    scenarioName: activeScenario.name || 'Untitled',
                    changeCount: totalCount,
                    isPartial: isPartialCommit && hasRemainingChanges
                });
            }

        } catch (err) {
            console.error('Failed to commit scenario:', err);
            addToast({ type: 'error', title: 'Commit failed', message: err.message });
        }
    }, [activeScenario, projTable, resTable, programsTable, programRecords, scenarioManager, stableSettings, resolveFieldId, buildAllocationsJson, squadIdMap, SETTINGS, setShowCommitModal, setScenarios, setPendingUpdates, setPendingResourceUpdates, setActiveScenarioId, addToast, logAuditEvent, AUDIT_EVENTS]);

    // ═══════════════════════════════════════════════════════════════════
    // REVERT COMMITTED SCENARIO HANDLER
    // Writes the original (pre-commit) values back to Airtable
    // ═══════════════════════════════════════════════════════════════════
    const handleRevertScenario = useCallback(async (scenarioId) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario || !scenario.changes) {
            addToast({ type: 'error', title: 'Revert failed', message: 'Scenario not found or has no changes to revert' });
            return;
        }

        // Confirmation is handled by the UI component (ConfirmModal in ScenarioSelector)
        const changeCount = Object.keys(scenario.changes.projects || {}).length + Object.keys(scenario.changes.resources || {}).length;

        try {
            const changes = scenario.changes || {};
            const projectUpdates = [];
            const resourceUpdates = [];

            // 1. Revert PROJECT changes using original values
            const projectChanges = changes.projects || {};
            for (const [projectId, entry] of Object.entries(projectChanges)) {
                const original = entry.original;
                if (!original || typeof original !== 'object') continue;

                const fields = {};

                if (original.status !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.STATUS, SETTINGS.STATUS_UPDATE);
                    if (fid) fields[fid] = original.status ? { name: original.status } : null;
                }
                if (original.squad !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.PROJECT_SQUAD, SETTINGS.PROJECT_SQUAD_UPDATE);
                    if (fid) {
                        if (original.squad) {
                            const squadRecordId = squadIdMap[original.squad];
                            if (squadRecordId) {
                                fields[fid] = [{ id: squadRecordId }];
                            } else {
                                fields[fid] = [{ name: original.squad }];
                            }
                        } else {
                            fields[fid] = [];
                        }
                    }
                }
                if (original.effortProfile !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.EFFORT_PROFILE, SETTINGS.EFFORT_PROFILE_UPDATE);
                    if (fid) fields[fid] = original.effortProfile ? { name: original.effortProfile } : null;
                }
                if (original.start !== undefined || original.kickOff !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.KICK_OFF, SETTINGS.KICK_OFF_UPDATE);
                    const dateValue = original.start ?? original.kickOff;
                    if (fid) fields[fid] = dateValue || null;
                }
                if (original.end !== undefined || original.launch !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.LAUNCH, SETTINGS.LAUNCH_UPDATE);
                    const dateValue = original.end ?? original.launch;
                    if (fid) fields[fid] = dateValue || null;
                }
                if (original.wave !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.PROJECT_WAVE, SETTINGS.WAVE_UPDATE);
                    if (fid) fields[fid] = original.wave ? { name: original.wave } : null;
                }
                if (original.resourcingOverride !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RESOURCING_OVERRIDE, SETTINGS.RESOURCING_OVERRIDE_UPDATE);
                    if (fid) fields[fid] = (original.resourcingOverride === '' || original.resourcingOverride === null) ? null : original.resourcingOverride;
                }
                if (original.lockLaunch !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_LAUNCH, SETTINGS.SLOT_LOCK_LAUNCH_UPDATE);
                    if (fid) fields[fid] = !!original.lockLaunch;
                }
                if (original.lockSquad !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_SQUAD, SETTINGS.SLOT_LOCK_SQUAD_UPDATE);
                    if (fid) fields[fid] = !!original.lockSquad;
                }
                if (original.lockResources !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.SLOT_LOCK_RESOURCES, SETTINGS.SLOT_LOCK_RESOURCES_UPDATE);
                    if (fid) fields[fid] = !!original.lockResources;
                }
                if (original.resourcedWithinProgram !== undefined) {
                    const fid = resolveFieldId(stableSettings[SETTINGS.RESOURCED_WITHIN_PROGRAM]);
                    if (fid) fields[fid] = !!original.resourcedWithinProgram;
                }
                // Team (PM/SC/PD) linked record assignments — canonical-only writes
                // (was proxy-first; mismatch with canonical-only reads in Dashboard.jsx).
                if (original.team && typeof original.team === 'object') {
                    const roleSettings = {
                        pm: { update: SETTINGS.PM_ALLOC_UPDATE, source: SETTINGS.PM_ALLOCATION },
                        sc: { update: SETTINGS.SC_ALLOC_UPDATE, source: SETTINGS.SC_ALLOCATION },
                        pd: { update: SETTINGS.PD_ALLOC_UPDATE, source: SETTINGS.PD_ALLOCATION }
                    };
                    for (const [role, keys] of Object.entries(roleSettings)) {
                        if (original.team[role]) {
                            const fid = resolveWriteFieldId(keys.source, keys.update);
                            if (fid) {
                                const realUsers = original.team[role].filter(m => !m.isPlaceholder).map(m => ({ id: m.id }));
                                fields[fid] = realUsers;
                            }
                        }
                    }
                    const allocFieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (allocFieldId) {
                        const allocations = buildAllocationsJson(original.team);
                        fields[allocFieldId] = JSON.stringify(allocations);
                    }
                }

                if (Object.keys(fields).length > 0) projectUpdates.push({ id: projectId, fields });
            }

            // 2. Revert RESOURCE changes using original values
            const resourceChanges = changes.resources || {};
            for (const [resourceId, entry] of Object.entries(resourceChanges)) {
                const original = entry.original;
                if (!original || typeof original !== 'object') continue;

                const fields = {};

                if (original.rampProfile !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RAMP_UP_PROFILE, SETTINGS.RAMP_PROFILE_UPDATE);
                    if (fid) fields[fid] = original.rampProfile ? { name: original.rampProfile } : null;
                }
                if (original.rampStartDate !== undefined) {
                    const fid = resolveWriteFieldId(SETTINGS.RAMP_START_DATE, SETTINGS.RAMP_START_DATE_UPDATE);
                    if (fid) fields[fid] = original.rampStartDate || null;
                }

                if (Object.keys(fields).length > 0) resourceUpdates.push({ id: resourceId, fields });
            }

            // 3. Revert PROGRAM ASSIGNMENT changes
            // Read the committed assignments and clear the workstream fields that were written
            const programUpdates = [];
            const draftAssignments = changes.programAssignments || [];
            if (draftAssignments.length > 0 && programsTable && programRecords) {
                // Build lookup: customer name → program record (same logic as commit)
                const programsByCustomer = {};
                const recordMap = storedSettings?.programRecordMap || {};
                Object.entries(recordMap).forEach(([customer, recordId]) => {
                    const rec = programRecords.find(r => r.id === recordId);
                    if (rec) programsByCustomer[customer] = rec;
                });
                (programRecords || []).forEach(r => {
                    if (r.name && !programsByCustomer[r.name]) programsByCustomer[r.name] = r;
                    const customerFieldId = stableSettings?.[SETTINGS.PROGRAM_CUSTOMER];
                    if (customerFieldId) {
                        try {
                            const val = r.getCellValueAsString(customerFieldId);
                            if (val && !programsByCustomer[val]) programsByCustomer[val] = r;
                        } catch (e) { /* skip */ }
                    }
                });

                const WS_FIELD_MAP = {
                    'Integrations': SETTINGS.PROGRAM_WS_INTEGRATIONS_UPDATE,
                    'Payroll': SETTINGS.PROGRAM_WS_PAYROLL_UPDATE,
                    'Consulting': SETTINGS.PROGRAM_WS_CONSULTING_UPDATE,
                    'Best Practice': SETTINGS.PROGRAM_WS_BEST_PRACTICE_UPDATE,
                    'Comms': SETTINGS.PROGRAM_WS_COMMS_UPDATE,
                    'Home': SETTINGS.PROGRAM_WS_HOME_UPDATE,
                    'Comms & Branding': SETTINGS.PROGRAM_WS_COMMS_UPDATE,
                    'Homepage': SETTINGS.PROGRAM_WS_HOME_UPDATE,
                    'Program Governance': SETTINGS.PROGRAM_WS_GOVERNANCE_UPDATE,
                    'Governance': SETTINGS.PROGRAM_WS_GOVERNANCE_UPDATE
                };
                const WS_FIELD_MAP_READ = {
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

                // Group by customer + workstream, then clear those fields
                const grouped = {};
                draftAssignments.forEach(a => {
                    if (!grouped[a.customer]) grouped[a.customer] = new Set();
                    grouped[a.customer].add(a.workstream);
                });

                for (const [customer, workstreams] of Object.entries(grouped)) {
                    const record = programsByCustomer[customer];
                    if (!record) continue;

                    const fields = {};
                    for (const wsName of workstreams) {
                        const settingsKey = WS_FIELD_MAP[wsName] || WS_FIELD_MAP[wsName.replace('Program ', '')];
                        const readKey = WS_FIELD_MAP_READ[wsName] || WS_FIELD_MAP_READ[wsName.replace('Program ', '')];
                        // Canonical-only via resolveWriteFieldId — matches the commit path
                        // above and the read path in ProgramDetailModal. Was previously
                        // proxy-first, which left reverts pointed at a field nothing reads.
                        const fieldId = resolveWriteFieldId(readKey, settingsKey);
                        if (fieldId) {
                            // If original assignments were stored, restore them; otherwise clear
                            const originalForWs = draftAssignments.find(a => a.customer === customer && a.workstream === wsName)?.originalResourceIds;
                            fields[fieldId] = originalForWs ? originalForWs.map(id => ({ id })) : [];
                        }
                    }
                    if (Object.keys(fields).length > 0) {
                        programUpdates.push({ id: record.id, fields });
                    }
                }
            }

            // Batch write to Airtable
            const processBatch = async (table, updates) => {
                for (let i = 0; i < updates.length; i += 50) {
                    await table.updateRecordsAsync(updates.slice(i, i + 50));
                }
            };

            if (projectUpdates.length > 0 && projTable) {
                await processBatch(projTable, projectUpdates);
            }
            if (resourceUpdates.length > 0 && resTable) {
                await processBatch(resTable, resourceUpdates);
            }
            if (programUpdates.length > 0 && programsTable) {
                try {
                    await processBatch(programsTable, programUpdates);
                } catch (progErr) {
                    console.warn('[REVERT] Program revert failed (non-fatal):', progErr.message);
                }
            }

            const totalCount = projectUpdates.length + resourceUpdates.length + programUpdates.length;

            // Mark scenario as reverted in the list
            setScenarios(prev => prev.map(s =>
                s.id === scenarioId
                    ? { ...s, status: 'Reverted', metadata: { ...s.metadata, revertedAt: new Date().toISOString() } }
                    : s
            ));

            // Log audit event
            if (logAuditEvent && AUDIT_EVENTS) {
                logAuditEvent(AUDIT_EVENTS.SCENARIO_REVERTED, {
                    scenarioId,
                    scenarioName: scenario.name || 'Untitled',
                    changeCount: totalCount
                });
            }

            addToast({
                type: 'success',
                title: 'Scenario reverted',
                message: `${totalCount} change${totalCount !== 1 ? 's' : ''} restored to pre-commit values`
            });
        } catch (err) {
            console.error('Failed to revert scenario:', err);
            addToast({ type: 'error', title: 'Revert failed', message: err.message });
        }
    }, [scenarios, projTable, resTable, programsTable, programRecords, storedSettings, stableSettings, resolveFieldId, buildAllocationsJson, squadIdMap, SETTINGS, setScenarios, addToast, logAuditEvent, AUDIT_EVENTS]);

    // ═══════════════════════════════════════════════════════════════════
    // APPLY OPTIMIZATIONS HANDLER
    // Applies AI optimizer recommendations directly to Airtable
    // ═══════════════════════════════════════════════════════════════════
    const handleApplyOptimizations = useCallback(async (recommendations) => {
        if (!projTable) {
            addToast({ type: 'error', title: 'Project table not available' });
            return;
        }

        const recordUpdates = [];
        let successCount = 0;
        let failedCount = 0;

        try {
            for (const rec of recommendations) {
                const fields = {};
                const project = effectiveProjects?.find(p => p.id === rec.projectId);
                if (!project) {
                    failedCount++;
                    continue;
                }

                // Squad assignment
                if (rec.suggestedSquad) {
                    const squadFieldId = resolveWriteFieldId(SETTINGS.PROJECT_SQUAD, SETTINGS.PROJECT_SQUAD_UPDATE);
                    if (squadFieldId) {
                        const squadRecordId = squadIdMap[rec.suggestedSquad];
                        if (squadRecordId) {
                            fields[squadFieldId] = [{ id: squadRecordId }];
                        } else {
                            fields[squadFieldId] = [{ name: rec.suggestedSquad }];
                        }
                    }
                }

                // Date shift - calculate new kick-off and launch
                if (rec.suggestedWeek && rec.currentKickOff) {
                    const recDate = new Date(rec.suggestedWeek);
                    const currKO = new Date(rec.currentKickOff);
                    const shiftMs = recDate - currKO;

                    if (shiftMs !== 0) {
                        const startFieldId = resolveWriteFieldId(SETTINGS.KICK_OFF, SETTINGS.KICK_OFF_UPDATE);
                        if (startFieldId) {
                            const newKickOff = new Date(currKO.getTime() + shiftMs);
                            fields[startFieldId] = newKickOff.toISOString().split('T')[0];
                        }

                        const currentLaunch = project.launch || project.end;
                        if (currentLaunch) {
                            const endFieldId = resolveWriteFieldId(SETTINGS.LAUNCH, SETTINGS.LAUNCH_UPDATE);
                            if (endFieldId) {
                                const launchDate = new Date(currentLaunch);
                                const newLaunch = new Date(launchDate.getTime() + shiftMs);
                                fields[endFieldId] = newLaunch.toISOString().split('T')[0];
                            }
                        }
                    }
                }

                if (Object.keys(fields).length > 0) {
                    recordUpdates.push({ id: rec.projectId, fields });
                }
            }

            // Batch update in chunks of 50
            for (let i = 0; i < recordUpdates.length; i += 50) {
                const chunk = recordUpdates.slice(i, i + 50);
                await projTable.updateRecordsAsync(chunk, { typecast: true });
                successCount += chunk.length;
            }

            addToast({
                type: 'success',
                title: 'Recommendations applied',
                message: `${successCount} project${successCount !== 1 ? 's' : ''} updated successfully${failedCount > 0 ? ` (${failedCount} failed)` : ''}`
            });

            // Save AI snapshot for performance tracking
            if (saveAISnapshot) {
                try {
                    const aiTarget = recommendations[0]?.aiTarget || 'manual';
                    saveAISnapshot(`live_${Date.now()}`, recommendations, aiTarget);
                } catch (snapshotErr) {
                    console.warn('[AIPerformanceTracker] Failed to save snapshot:', snapshotErr);
                }
            }

        } catch (error) {
            console.error('[ApplyOptimizations] Failed:', error);
            addToast({
                type: 'error',
                title: 'Failed to apply recommendations',
                message: error.message
            });
        }
    }, [projTable, effectiveProjects, stableSettings, resolveFieldId, squadIdMap, SETTINGS, addToast, saveAISnapshot]);

    // ═══════════════════════════════════════════════════════════════════
    // SLOT ASSIGNMENT HANDLERS
    // Handles drag-and-drop project assignment to squad slots
    // ═══════════════════════════════════════════════════════════════════

    // Helper: Execute the actual slot assignment (called directly or from modal)
    const executeSlotAssignment = useCallback(async (projectId, squad, newStart, newEnd, project, wasAligned = false) => {
        const updates = {
            squad: squad,
            start: newStart,
            kickOff: newStart,
            end: newEnd,
            launch: newEnd
        };

        if (activeScenario && !activeScenario.isLive) {
            await handleUpdateProject(projectId, updates);
            addToast({ type: 'success', title: 'Draft Updated', message: `Moved ${project.name} to ${squad}` });
        } else {
            if (!scenarioManager) {
                addToast({ type: 'error', title: 'Scenario Manager Unavailable' });
                return;
            }
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const scenarioChanges = {
                projects: {
                    [projectId]: {
                        squad: squad,
                        start: newStart,
                        kickOff: newStart,
                        end: newEnd,
                        launch: newEnd
                    }
                }
            };

            await scenarioManager.handleAddScenario(
                `Planning Draft - ${timeString}`,
                scenarioChanges
            );
            addToast({ type: 'success', title: 'Draft Created', message: `Started new draft for ${project.name}` });
        }

        // Record in undo history
        setAssignmentHistory(prev => [...prev, {
            projectId,
            projectName: project.name,
            newSquad: squad,
            newStart: newStart,
            newEnd: newEnd,
            oldSquad: project.squads?.[0] || project.squad || null,
            oldStart: project.start || project.kickOff || null,
            oldEnd: project.end || project.launch || null,
            timestamp: Date.now()
        }]);
        setAssignmentFuture([]);
    }, [activeScenario, handleUpdateProject, scenarioManager, addToast, setAssignmentHistory, setAssignmentFuture]);

    const handleAssignProject = useCallback(async (projectId, squad, dateKey) => {
        const project = allProjects?.find(p => p.id === projectId);
        if (!project) return;

        // Resolve 'Merged View' to a concrete squad
        let targetSquad = squad;
        if (squad === 'Merged View') {
            const currentSquad = project.squads?.[0];
            if (currentSquad && squadViewFilter?.includes(currentSquad)) {
                targetSquad = currentSquad;
            } else if (squadViewFilter?.length > 0) {
                targetSquad = squadViewFilter[0];
            } else {
                targetSquad = 'Unassigned';
            }
        }

        const durationWeeks = storedSettings.slotProfile?.durationWeeks || 12;
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        const slotStart = dateKey;
        const slotEndDate = new Date(new Date(slotStart).getTime() + durationWeeks * weekMs);
        const slotEnd = slotEndDate.toISOString().split('T')[0];

        let projectStart = project.kickOff || project.start;
        let projectEnd = project.launch || project.end;

        if (!projectStart || !projectEnd) {
            projectStart = slotStart;
            projectEnd = slotEnd;
        }

        // Build the slot taxonomy id, e.g. "P1FY26W3".
        //  - squadInitial: first letter of the target squad (defaults to 'X' when unknown).
        //  - FY: fiscal year starts in MAY (month index 4). Slots dated May..Dec roll into
        //    the NEXT calendar year's FY (hence getFullYear() + 1); Jan..Apr stay in the
        //    current calendar year's FY. fyShort is the 2-digit FY (e.g. 2026 -> "26").
        //  - weekNum: week-of-month (1-based), computed from the day-of-month offset by the
        //    weekday of the 1st of that month so partial first weeks count as week 1.
        const squadInitial = (targetSquad || 'X').charAt(0).toUpperCase();
        const d = new Date(slotStart);
        const fy = d.getMonth() >= 4 ? d.getFullYear() + 1 : d.getFullYear();
        const fyShort = String(fy).slice(-2);
        const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
        const taxonomyId = `${squadInitial}1FY${fyShort}W${weekNum}`;

        const projStartMs = new Date(projectStart).getTime();
        const slotStartMs = new Date(slotStart).getTime();
        const idleStartWeeks = Math.round((projStartMs - slotStartMs) / weekMs);

        const hasExistingDates = (project.kickOff || project.start) && (project.launch || project.end);
        const isMisaligned = hasExistingDates && Math.abs(idleStartWeeks) >= 1;

        if (isMisaligned) {
            setPendingSlotAssignment({
                projectId,
                project,
                squad,
                targetSquad,
                slot: {
                    taxonomyId,
                    startDateKey: slotStart,
                    endDateKey: slotEnd,
                    squad: targetSquad
                },
                durationWeeks
            });
            return;
        }

        await executeSlotAssignment(projectId, targetSquad, slotStart, slotEnd, project, false);
    }, [allProjects, squadViewFilter, storedSettings, setPendingSlotAssignment, executeSlotAssignment]);

    const handleSlotAlignmentConfirm = useCallback(async (option, adjustedDates) => {
        if (!pendingSlotAssignment) return;

        const { projectId, project, squad, slot } = pendingSlotAssignment;

        if (option === 'align') {
            await executeSlotAssignment(projectId, squad, adjustedDates.start, adjustedDates.end, project, true);
        } else if (option === 'accept') {
            const projectStart = project.kickOff || project.start;
            const projectEnd = project.launch || project.end;
            await executeSlotAssignment(projectId, squad, projectStart, projectEnd, project, false);
        }

        setPendingSlotAssignment(null);
    }, [pendingSlotAssignment, executeSlotAssignment, setPendingSlotAssignment]);

    // ═══════════════════════════════════════════════════════════════════
    // TEAM MANAGEMENT HANDLERS
    // Handles assigning, unassigning, and updating team members
    // ═══════════════════════════════════════════════════════════════════

    const handleAssignTeamMember = useCallback(async (projectId, userId, role, options = {}) => {
        const { isPlaceholder, name: placeholderName } = options;
        const updateId = Date.now();

        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        let resourceWithName;
        if (isPlaceholder) {
            resourceWithName = { id: userId, name: placeholderName || 'TBD', isPlaceholder: true };
        } else {
            const assignedResource = allResources?.find(r => r.id === userId);
            resourceWithName = assignedResource
                ? { id: userId, name: assignedResource.name }
                : { id: userId, name: 'Assigned (Pending)' };
        }

        // Compute the new team SYNCHRONOUSLY from the closure-captured pendingUpdates.
        // The previous version did this from inside `setPendingUpdates(prev => …)` and
        // captured the result on closure variables, which works under React 17 (where
        // updaters run synchronously) but breaks under React 18 concurrent rendering —
        // the updater is queued and runs *after* the post-check, so the captured
        // variables stay null and the function silently returns. The closure-captured
        // `pendingUpdates` is fresh per render; the only edge case it doesn't cover is
        // multiple clicks within a single tick, which is mitigated by enqueueProjectWrite
        // serialising writes per project.
        const previousPending = pendingUpdates[projectId] || {};
        const baseTeamForUpdate = previousPending.team || project.team || { pm: [], sc: [], pd: [] };
        const currentRoleTeam = baseTeamForUpdate[role] || [];

        if (currentRoleTeam.some(m => m.id === userId)) {
            // Already in the latest team — nothing to do.
            return;
        }

        const newTeam = {
            ...baseTeamForUpdate,
            [role]: [...currentRoleTeam, resourceWithName]
        };
        const updatedRoleTeam = newTeam[role] || [];

        // Persist optimistic state. The updater form is still used so concurrent updaters
        // (e.g. cleanup setTimeout below) compose correctly.
        setPendingUpdates(prev => ({
            ...prev,
            [projectId]: {
                ...(prev[projectId] || {}),
                team: newTeam,
                updateId
            }
        }));

        if (activeScenario && activeScenario.id && !activeScenario.isLive) {
            const existingEntry = activeScenario.changes?.projects?.[projectId] || {};
            const existingOriginal = existingEntry.original || {};
            let existingChanges = existingEntry.changes || existingEntry;

            // Capture the live team as the original before the first team change
            if (!('team' in existingOriginal)) {
                const baseProj = allProjects?.find(p => p.id === projectId);
                existingOriginal.team = baseProj?.team || {};
            }

            if (pendingUpdates[projectId]) {
                const pending = { ...pendingUpdates[projectId] };
                delete pending.isDraft;
                delete pending.timestamp;
                delete pending.updateId;
                existingChanges = { ...existingChanges, ...pending };
            }

            const newChanges = {
                ...existingChanges,
                team: newTeam
            };

            const projectChanges = {
                name: project.name || projectId,
                original: existingOriginal,
                changes: newChanges,
                ...newChanges
            };

            if (scenarioManager) {
                try {
                    const updatedChanges = {
                        ...activeScenario.changes,
                        projects: {
                            ...(activeScenario.changes?.projects || {}),
                            [projectId]: projectChanges
                        }
                    };
                    const now = new Date().toISOString();
                    const metadata = {
                        ...(activeScenario.metadata || {}),
                        lastModified: now,
                        lastSavedAt: now,
                        lastEditedBy: currentUserName,
                        totalChanges: Object.keys(updatedChanges.projects || {}).length + Object.keys(updatedChanges.resources || {}).length
                    };
                    // Optimistic update
                    setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: updatedChanges, metadata } : s));
                    await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);

                    setTimeout(() => {
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev };
                                delete next[projectId];
                                return next;
                            }
                            return prev;
                        });
                    }, 30000);
                } catch (err) {
                    console.error('[DRAFT-MODE] Failed to assign team member:', err);
                }
            }
            return;
        }

        if (!projTable) return;

        // Queue this write behind any in-flight writes for the same project so a
        // remove-then-add doesn't race the SDK. Cross-project writes still parallelise.
        await enqueueProjectWrite(projectId, async () => {
            try {
                if (!isPlaceholder) {
                    let updateFieldId;
                    if (role === 'pm') updateFieldId = resolveWriteFieldId(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE);
                    else if (role === 'sc') updateFieldId = resolveWriteFieldId(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE);
                    else if (role === 'pd') updateFieldId = resolveWriteFieldId(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE);

                    if (!updateFieldId) {
                        // Canonical allocation setting wasn't configured in the extension — surface
                        // a toast rather than silently swallowing the write.
                        addToast({ type: 'warning', title: 'Field not mapped', message: `${role.toUpperCase()} allocation field is not configured in extension Settings — write skipped.` });
                    }

                    if (updateFieldId) {
                        const realUserIds = updatedRoleTeam.filter(m => !m.isPlaceholder).map(m => ({ id: m.id }));
                        await projTable.updateRecordAsync(projectId, { [updateFieldId]: realUserIds });
                    }
                }

                // TEAM_ALLOCATIONS JSON write
                {
                    const fieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (fieldId) {
                        const allocations = buildAllocationsJson(newTeam);
                        await projTable.updateRecordAsync(projectId, { [fieldId]: JSON.stringify(allocations) });
                    }
                }

                if (!isPlaceholder) {
                    const project = effectiveProjects?.find(p => p.id === projectId);
                    logAuditEvent(AUDIT_EVENTS.RESOURCE_ASSIGNED, {
                        projectId,
                        projectName: project?.name || 'Unknown',
                        resourceId: userId,
                        resourceName: resourceWithName.name,
                        role: role.toUpperCase()
                    });
                }

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev };
                            delete next[projectId];
                            return next;
                        }
                        return prev;
                    });
                }, 30000);

            } catch (err) {
                console.error('Failed to assign team member:', err);
                addToast({ type: 'error', title: 'Assign failed', message: err?.message || 'Could not save team member.' });
                setPendingUpdates(prev => {
                    if (prev[projectId]?.updateId === updateId) {
                        const next = { ...prev };
                        delete next[projectId];
                        return next;
                    }
                    return prev;
                });
            }
        });
    }, [effectiveProjects, pendingUpdates, allResources, allProjects, activeScenario, scenarioManager, currentUserName, setScenarios, projTable, stableSettings, resolveFieldId, SETTINGS, logAuditEvent, AUDIT_EVENTS, setPendingUpdates, enqueueProjectWrite, addToast, buildAllocationsJson]);

    const handleUnassignTeamMember = useCallback(async (projectId, userId, role) => {
        const updateId = Date.now();
        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        const targetId = String(userId);

        // Compute synchronously from closure-captured pendingUpdates. The previous
        // version captured `removedMember`/`capturedNewTeam` from inside the
        // setPendingUpdates updater, which fails under React 18 (updater queued, not
        // synchronous). enqueueProjectWrite serialises rapid removes per project, so
        // a fresh-per-render closure is safe.
        const previousPending = pendingUpdates[projectId] || {};
        const baseTeamForUpdate = previousPending.team || project.team || { pm: [], sc: [], pd: [] };
        const currentRoleTeam = baseTeamForUpdate[role] || [];
        const removedMember = currentRoleTeam.find(m => String(m.id) === targetId) || null;
        if (!removedMember) return;

        const updatedRoleTeam = currentRoleTeam.filter(m => String(m.id) !== targetId);
        const newTeam = { ...baseTeamForUpdate, [role]: updatedRoleTeam };

        setPendingUpdates(prev => ({
            ...prev,
            [projectId]: {
                ...(prev[projectId] || {}),
                team: newTeam,
                updateId
            }
        }));

        if (activeScenario && activeScenario.id && !activeScenario.isLive) {
            const existingEntry = activeScenario.changes?.projects?.[projectId] || {};
            const existingOriginal = existingEntry.original || {};
            let existingChanges = existingEntry.changes || existingEntry;

            // Capture the live team as the original before the first team change
            if (!('team' in existingOriginal)) {
                const baseProj = allProjects?.find(p => p.id === projectId);
                existingOriginal.team = baseProj?.team || {};
            }

            if (pendingUpdates[projectId]) {
                const pending = { ...pendingUpdates[projectId] };
                delete pending.isDraft; delete pending.timestamp; delete pending.updateId;
                existingChanges = { ...existingChanges, ...pending };
            }

            const newChanges = { ...existingChanges, team: newTeam };
            const projectChanges = { name: project.name || projectId, original: existingOriginal, changes: newChanges, ...newChanges };

            if (scenarioManager) {
                try {
                    const updatedChanges = { ...activeScenario.changes, projects: { ...(activeScenario.changes?.projects || {}), [projectId]: projectChanges } };
                    const now = new Date().toISOString();
                    const metadata = { ...(activeScenario.metadata || {}), lastModified: now, lastSavedAt: now, lastEditedBy: currentUserName, totalChanges: Object.keys(updatedChanges.projects || {}).length + Object.keys(updatedChanges.resources || {}).length };

                    // Optimistic update for UI responsiveness
                    setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: updatedChanges, metadata } : s));

                    await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);

                    setTimeout(() => {
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev };
                                delete next[projectId];
                                return next;
                            }
                            return prev;
                        });
                    }, 30000);
                } catch (err) { console.error('[DRAFT] Failed unassign', err); }
            }
            return;
        }

        if (!projTable) return;

        await enqueueProjectWrite(projectId, async () => {
            try {
                // Placeholders only live in the JSON allocations blob — no linked-record write.
                if (!removedMember.isPlaceholder) {
                    let updateFieldId;
                    if (role === 'pm') updateFieldId = resolveWriteFieldId(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE);
                    else if (role === 'sc') updateFieldId = resolveWriteFieldId(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE);
                    else if (role === 'pd') updateFieldId = resolveWriteFieldId(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE);

                    if (updateFieldId) {
                        const realUserIds = updatedRoleTeam.filter(m => !m.isPlaceholder).map(m => ({ id: m.id }));
                        await projTable.updateRecordAsync(projectId, { [updateFieldId]: realUserIds });
                    }
                }

                {
                    const fieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (fieldId) {
                        const allocations = buildAllocationsJson(newTeam);
                        await projTable.updateRecordAsync(projectId, { [fieldId]: JSON.stringify(allocations) });
                    }
                }

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev }; delete next[projectId]; return next;
                        }
                        return prev;
                    });
                }, 30000);
            } catch (err) {
                console.error('Failed to unassign team member:', err);
                addToast({ type: 'error', title: 'Remove failed', message: err?.message || 'Could not save team change.' });
                setPendingUpdates(prev => {
                    if (prev[projectId]?.updateId === updateId) {
                        const next = { ...prev }; delete next[projectId]; return next;
                    }
                    return prev;
                });
            }
        });
    }, [effectiveProjects, pendingUpdates, allProjects, activeScenario, scenarioManager, currentUserName, setScenarios, projTable, stableSettings, resolveFieldId, SETTINGS, setPendingUpdates, enqueueProjectWrite, addToast, buildAllocationsJson]);

    const handleUpdateAllocation = useCallback(async (projectId, role, userId, allocationPct, dateUpdates = null) => {
        const updateId = Date.now();

        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        // Compute newTeam synchronously from closure-captured pendingUpdates. The
        // previous in-updater capture pattern is broken under React 18 (updater is
        // queued, not synchronous — closure variables stay null). enqueueProjectWrite
        // serialises rapid %-edits per project so a fresh-per-render closure is safe.
        const previousPending = pendingUpdates[projectId] || {};
        const baseTeamForUpdate = previousPending.team || project.team || { pm: [], sc: [], pd: [] };
        const currentRoleTeam = baseTeamForUpdate[role] || [];

        let memberFound = false;
        const updatedRoleTeamInternal = currentRoleTeam.map(member => {
            if (member.id !== userId) return member;
            memberFound = true;
            const updated = (allocationPct !== null && allocationPct !== undefined)
                ? { ...member, allocationPct }
                : { ...member };
            if (dateUpdates) {
                if ('startDate' in dateUpdates) updated.startDate = dateUpdates.startDate;
                if ('endDate' in dateUpdates) updated.endDate = dateUpdates.endDate;
            }
            return updated;
        });

        if (!memberFound) return;

        const newTeam = { ...baseTeamForUpdate, [role]: updatedRoleTeamInternal };

        setPendingUpdates(prev => ({
            ...prev,
            [projectId]: {
                ...(prev[projectId] || {}),
                team: newTeam,
                updateId
            }
        }));

        if (activeScenario && activeScenario.id && !activeScenario.isLive) {
            const existingEntry = activeScenario.changes?.projects?.[projectId] || {};
            const existingOriginal = existingEntry.original || {};
            let existingChanges = existingEntry.changes || existingEntry;

            // Capture the live team as the original before the first team change
            if (!('team' in existingOriginal)) {
                const baseProj = allProjects?.find(p => p.id === projectId);
                existingOriginal.team = baseProj?.team || {};
            }

            if (pendingUpdates[projectId]) {
                const pending = { ...pendingUpdates[projectId] };
                delete pending.isDraft;
                delete pending.timestamp;
                delete pending.updateId;
                existingChanges = { ...existingChanges, ...pending };
            }

            const newChanges = {
                ...existingChanges,
                team: newTeam
            };

            const projectChanges = {
                name: project.name || projectId,
                original: existingOriginal,
                changes: newChanges,
                ...newChanges
            };

            if (scenarioManager) {
                try {
                    const updatedChanges = {
                        ...activeScenario.changes,
                        projects: {
                            ...(activeScenario.changes?.projects || {}),
                            [projectId]: projectChanges
                        }
                    };
                    const now = new Date().toISOString();
                    const metadata = {
                        ...(activeScenario.metadata || {}),
                        lastModified: now,
                        lastSavedAt: now,
                        lastEditedBy: currentUserName,
                        totalChanges: Object.keys(updatedChanges.projects || {}).length + Object.keys(updatedChanges.resources || {}).length
                    };
                    await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);
                    setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: updatedChanges, metadata } : s));

                    setTimeout(() => {
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev };
                                delete next[projectId];
                                return next;
                            }
                            return prev;
                        });
                    }, 30000);
                } catch (err) {
                    console.error('[DRAFT-MODE] Failed to persist allocation:', err);
                }
            }
            return;
        }

        if (projTable) {
            const fieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
            if (fieldId) {
                await enqueueProjectWrite(projectId, async () => {
                    try {
                        // Use the shared buildAllocationsJson helper — same shape as
                        // handleAssign/handleUnassign, so the JSON written here is
                        // structurally identical to what those handlers write.
                        const allocations = buildAllocationsJson(newTeam);
                        await projTable.updateRecordAsync(projectId, {
                            [fieldId]: JSON.stringify(allocations)
                        });

                        setTimeout(() => {
                            setPendingUpdates(prev => {
                                if (prev[projectId]?.updateId === updateId) {
                                    const next = { ...prev };
                                    delete next[projectId];
                                    return next;
                                }
                                return prev;
                            });
                        }, 30000);
                    } catch (err) {
                        console.error('Failed to update allocation:', err);
                        addToast({ type: 'error', title: 'Allocation save failed', message: err?.message || 'Could not update allocation %.' });
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev };
                                delete next[projectId];
                                return next;
                            }
                            return prev;
                        });
                    }
                });
            }
        }
    }, [effectiveProjects, pendingUpdates, allProjects, activeScenario, scenarioManager, currentUserName, setScenarios, projTable, stableSettings, resolveFieldId, SETTINGS, setPendingUpdates, enqueueProjectWrite, addToast, buildAllocationsJson]);

    const handleCopyToOtherRoles = useCallback(async (projectId, fromRole, toRole) => {
        const updateId = Date.now();
        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        const roleLabels = { pm: 'PM', sc: 'SC', pd: 'PD' };
        const baseTimestamp = Date.now();

        // Compute synchronously from closure-captured pendingUpdates. Same React 18
        // updater-deferral fix as handleAssign/Unassign/UpdateAllocation.
        const prevPending = pendingUpdates[projectId] || {};
        const baseTeam = prevPending.team || project.team || { pm: [], sc: [], pd: [] };
        const sourceTeam = baseTeam[fromRole] || [];
        if (sourceTeam.length === 0) return;

        const copiedTeam = sourceTeam.map((member, idx) => {
            if (member.isPlaceholder || (member.id && member.id.startsWith('PLACEHOLDER'))) {
                return {
                    ...member,
                    id: `PLACEHOLDER_${baseTimestamp}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                    name: `TBD ${roleLabels[toRole] || toRole.toUpperCase()}`,
                    isPlaceholder: true
                };
            }
            return { ...member };
        });

        const newTeam = { ...baseTeam, [toRole]: copiedTeam };

        setPendingUpdates(prev => ({
            ...prev,
            [projectId]: {
                ...(prev[projectId] || {}),
                team: newTeam,
                updateId
            }
        }));

        if (activeScenario && activeScenario.id && !activeScenario.isLive) {
            const existingEntry = activeScenario.changes?.projects?.[projectId] || {};
            const existingOriginal = existingEntry.original || {};
            let existingChanges = existingEntry.changes || existingEntry;

            // Capture the live team as the original before the first team change
            if (!('team' in existingOriginal)) {
                const baseProj = allProjects?.find(p => p.id === projectId);
                existingOriginal.team = baseProj?.team || {};
            }

            if (pendingUpdates[projectId]) {
                const pending = { ...pendingUpdates[projectId] };
                delete pending.isDraft; delete pending.timestamp; delete pending.updateId;
                existingChanges = { ...existingChanges, ...pending };
            }

            const newChanges = { ...existingChanges, team: newTeam };
            const projectChanges = { name: project.name || projectId, original: existingOriginal, changes: newChanges, ...newChanges };

            if (scenarioManager) {
                try {
                    const updatedChanges = { ...activeScenario.changes, projects: { ...(activeScenario.changes?.projects || {}), [projectId]: projectChanges } };
                    const now = new Date().toISOString();
                    const metadata = { ...(activeScenario.metadata || {}), lastModified: now, lastSavedAt: now, lastEditedBy: currentUserName, totalChanges: Object.keys(updatedChanges.projects || {}).length + Object.keys(updatedChanges.resources || {}).length };
                    await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);
                    setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: updatedChanges, metadata } : s));

                    setTimeout(() => {
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev }; delete next[projectId]; return next;
                            }
                            return prev;
                        });
                    }, 30000);
                } catch (err) { console.error('[DRAFT] Failed copy role', err); }
            }
            return;
        }

        if (!projTable) return;

        await enqueueProjectWrite(projectId, async () => {
            try {
                const realMembers = copiedTeam.filter(m => m.id && typeof m.id === 'string' && m.id.startsWith('rec'));
                let updateFieldId;
                if (toRole === 'pm') updateFieldId = resolveWriteFieldId(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE);
                else if (toRole === 'sc') updateFieldId = resolveWriteFieldId(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE);
                else if (toRole === 'pd') updateFieldId = resolveWriteFieldId(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE);

                if (updateFieldId && realMembers.length > 0) {
                    const newIds = realMembers.map(m => ({ id: m.id }));
                    await projTable.updateRecordAsync(projectId, { [updateFieldId]: newIds });
                }

                const hasPlaceholders = copiedTeam.some(m => m.isPlaceholder || (m.id && m.id.startsWith('PLACEHOLDER')));
                if (hasPlaceholders || copiedTeam.some(m => m.allocationPct > 0) || copiedTeam.some(m => m.startDate || m.endDate)) {
                    const fieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (fieldId) {
                        const allocations = buildAllocationsJson(newTeam);
                        await projTable.updateRecordAsync(projectId, { [fieldId]: JSON.stringify(allocations) });
                    }
                }

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev }; delete next[projectId]; return next;
                        }
                        return prev;
                    });
                }, 30000);
            } catch (err) {
                console.error('Failed to copy role:', err);
                addToast({ type: 'error', title: 'Copy failed', message: err?.message || 'Could not copy role.' });
                setPendingUpdates(prev => {
                    if (prev[projectId]?.updateId === updateId) {
                        const next = { ...prev }; delete next[projectId]; return next;
                    }
                    return prev;
                });
            }
        });
    }, [effectiveProjects, pendingUpdates, allProjects, activeScenario, scenarioManager, currentUserName, setScenarios, projTable, stableSettings, resolveFieldId, SETTINGS, setPendingUpdates, enqueueProjectWrite, addToast, buildAllocationsJson]);

    const handleCopyToAllRoles = useCallback(async (projectId, fromRole) => {
        const updateId = Date.now();
        const project = effectiveProjects?.find(p => p.id === projectId);
        if (!project) return;

        const otherRoles = ['pm', 'sc', 'pd'].filter(r => r !== fromRole);
        const roleLabels = { pm: 'PM', sc: 'SC', pd: 'PD' };
        const baseTimestamp = Date.now();

        // Build all role updates at once using functional update to ensure we see latest state
        let newTeamSnapshot = null;

        setPendingUpdates(prev => {
            const prevPending = prev[projectId] || {};
            const baseTeam = prevPending.team || project.team || { pm: [], sc: [], pd: [] };
            const sourceTeam = baseTeam[fromRole] || [];

            if (sourceTeam.length === 0) return prev;

            const newTeam = { ...baseTeam };

            // Copy to all other roles at once
            otherRoles.forEach((toRole, roleIdx) => {
                const copiedTeam = sourceTeam.map((member, idx) => {
                    if (member.isPlaceholder || (member.id && member.id.startsWith('PLACEHOLDER'))) {
                        return {
                            ...member,
                            id: `PLACEHOLDER_${baseTimestamp}_${roleIdx}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                            name: `TBD ${roleLabels[toRole] || toRole.toUpperCase()}`,
                            isPlaceholder: true
                        };
                    }
                    return { ...member };
                });
                newTeam[toRole] = copiedTeam;
            });

            newTeamSnapshot = newTeam; // Capture for scenario persistence

            return {
                ...prev,
                [projectId]: {
                    ...prevPending,
                    team: newTeam,
                    updateId
                }
            };
        });

        // No need to await a tick — capturedNewTeam is set synchronously inside the
        // setPendingUpdates updater (React calls it synchronously on dispatch), so by
        // the time we reach this line the closure variable is populated.
        if (!newTeamSnapshot) return; // Source was empty

        // DRAFT MODE: Store changes in scenario
        if (activeScenario && activeScenario.id && !activeScenario.isLive) {
            const existingEntry = activeScenario.changes?.projects?.[projectId] || {};
            const existingOriginal = existingEntry.original || {};
            let existingChanges = existingEntry.changes || existingEntry;

            // Capture the live team as the original before the first team change
            if (!('team' in existingOriginal)) {
                const baseProj = allProjects?.find(p => p.id === projectId);
                existingOriginal.team = baseProj?.team || {};
            }

            const newChanges = { ...existingChanges, team: newTeamSnapshot };
            const projectChanges = { name: project.name || projectId, original: existingOriginal, changes: newChanges, ...newChanges };

            if (scenarioManager) {
                try {
                    const updatedChanges = { ...activeScenario.changes, projects: { ...(activeScenario.changes?.projects || {}), [projectId]: projectChanges } };
                    const now = new Date().toISOString();
                    const metadata = { ...(activeScenario.metadata || {}), lastModified: now, lastSavedAt: now, lastEditedBy: currentUserName, totalChanges: Object.keys(updatedChanges.projects || {}).length + Object.keys(updatedChanges.resources || {}).length };
                    await scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, metadata);
                    setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: updatedChanges, metadata } : s));

                    setTimeout(() => {
                        setPendingUpdates(prev => {
                            if (prev[projectId]?.updateId === updateId) {
                                const next = { ...prev }; delete next[projectId]; return next;
                            }
                            return prev;
                        });
                    }, 30000);
                } catch (err) { console.error('[DRAFT] Failed copy all roles', err); }
            }
            return;
        }

        // LIVE MODE: Update Airtable
        if (!projTable) return;

        await enqueueProjectWrite(projectId, async () => {
            try {
                // Update linked record fields for each role
                for (const toRole of otherRoles) {
                    const copiedTeam = newTeamSnapshot[toRole] || [];
                    const realMembers = copiedTeam.filter(m => m.id && typeof m.id === 'string' && m.id.startsWith('rec'));

                    let updateFieldId;
                    if (toRole === 'pm') updateFieldId = resolveWriteFieldId(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE);
                    else if (toRole === 'sc') updateFieldId = resolveWriteFieldId(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE);
                    else if (toRole === 'pd') updateFieldId = resolveWriteFieldId(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE);

                    if (updateFieldId && realMembers.length > 0) {
                        const newIds = realMembers.map(m => ({ id: m.id }));
                        await projTable.updateRecordAsync(projectId, { [updateFieldId]: newIds });
                    }
                }

                // Update allocations JSON with all roles
                {
                    const fieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                    if (fieldId) {
                        const allocations = buildAllocationsJson(newTeamSnapshot);
                        await projTable.updateRecordAsync(projectId, { [fieldId]: JSON.stringify(allocations) });
                    }
                }

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        if (prev[projectId]?.updateId === updateId) {
                            const next = { ...prev }; delete next[projectId]; return next;
                        }
                        return prev;
                    });
                }, 30000);
            } catch (err) {
                console.error('Failed to copy all roles:', err);
                addToast({ type: 'error', title: 'Copy to all failed', message: err?.message || 'Could not copy roles.' });
                setPendingUpdates(prev => {
                    if (prev[projectId]?.updateId === updateId) {
                        const next = { ...prev }; delete next[projectId]; return next;
                    }
                    return prev;
                });
            }
        });
    }, [effectiveProjects, allProjects, activeScenario, scenarioManager, currentUserName, setScenarios, projTable, stableSettings, resolveFieldId, SETTINGS, setPendingUpdates, enqueueProjectWrite, addToast, buildAllocationsJson]);

    const handleAssignTeamMemberProxy = useCallback((projectId, userId, role, options) => {
        return handleAssignTeamMember(projectId, userId, role, options);
    }, [handleAssignTeamMember]);

    const handleUnassignTeamMemberProxy = useCallback((projectId, userId, role) => {
        return handleUnassignTeamMember(projectId, userId, role);
    }, [handleUnassignTeamMember]);

    const handleUpdateAllocationProxy = useCallback((projectId, role, userId, allocationPct, dateUpdates = null) => {
        return handleUpdateAllocation(projectId, role, userId, allocationPct, dateUpdates);
    }, [handleUpdateAllocation]);

    const handleCopyToOtherRolesProxy = useCallback((projectId, fromRole, toRole) => {
        return handleCopyToOtherRoles(projectId, fromRole, toRole);
    }, [handleCopyToOtherRoles]);

    const handleCopyToAllRolesProxy = useCallback((projectId, fromRole) => {
        return handleCopyToAllRoles(projectId, fromRole);
    }, [handleCopyToAllRoles]);

    // ═══════════════════════════════════════════════════════════════════
    // SAVE ALLOCATIONS HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveAllocations = useCallback(async (updatedAllocations) => {
        if (!projTable) return;
        const resourceId = activeCell?.resourceId;
        if (!resourceId) { setActiveCell(null); return; }

        const updateId = Date.now();

        // Group by Project ID to batch updates
        const projectUpdates = {};
        for (const alloc of updatedAllocations) {
            if (!projectUpdates[alloc.projectId]) projectUpdates[alloc.projectId] = [];
            projectUpdates[alloc.projectId].push(alloc);
        }

        try {
            // DRAFT MODE: Store changes in scenario, DO NOT write to Airtable
            if (activeScenario && !activeScenario.isLive) {
                const scenarioChanges = {
                    ...activeScenario.changes,
                    projects: { ...(activeScenario.changes?.projects || {}) }
                };

                const optimisticUpdates = {};

                for (const projectId of Object.keys(projectUpdates)) {
                    const allocs = projectUpdates[projectId];
                    const existingEntry = scenarioChanges.projects[projectId] || {};
                    const existingOriginal = existingEntry.original || {};
                    const existingChanges = existingEntry.changes || existingEntry;

                    if (pendingUpdates[projectId]) {
                        const pending = { ...pendingUpdates[projectId] };
                        delete pending.isDraft; delete pending.timestamp; delete pending.updateId;
                        Object.assign(existingChanges, pending);
                    }

                    const project = effectiveProjects?.find(p => p.id === projectId);
                    const currentTeam = {
                        pm: [...(project?.team?.pm || [])],
                        sc: [...(project?.team?.sc || [])],
                        pd: [...(project?.team?.pd || [])]
                    };

                    allocs.forEach(alloc => {
                        const role = alloc.type;
                        const roleTeam = currentTeam[role];
                        const existingIdx = roleTeam.findIndex(m => m.id === resourceId);
                        if (existingIdx >= 0) {
                            roleTeam[existingIdx] = { ...roleTeam[existingIdx], allocationPct: alloc.allocation };
                        } else {
                            const res = allResources?.find(r => r.id === resourceId) || { name: 'Unknown' };
                            roleTeam.push({ id: resourceId, name: res.name, allocationPct: alloc.allocation });
                        }
                    });

                    if (!('team' in existingOriginal)) {
                        const baseProj = allProjects?.find(p => p.id === projectId);
                        existingOriginal.team = baseProj?.team || {};
                    }

                    existingChanges.team = currentTeam;

                    scenarioChanges.projects[projectId] = {
                        name: project?.name || projectId,
                        original: existingOriginal,
                        changes: existingChanges,
                        ...existingChanges
                    };

                    optimisticUpdates[projectId] = {
                        team: currentTeam,
                        isDraft: true,
                        timestamp: Date.now(),
                        updateId
                    };
                }

                setPendingUpdates(prev => ({ ...prev, ...optimisticUpdates }));

                const now = new Date().toISOString();
                const metadata = {
                    ...(activeScenario.metadata || {}),
                    lastModified: now,
                    lastSavedAt: now,
                    lastEditedBy: currentUserName,
                    totalChanges: Object.keys(scenarioChanges.projects || {}).length + Object.keys(scenarioChanges.resources || {}).length
                };
                await scenarioManager.saveScenarioChanges(activeScenario.id, scenarioChanges, metadata);
                setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: scenarioChanges, metadata } : s));

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        const next = { ...prev };
                        Object.keys(optimisticUpdates).forEach(pid => {
                            if (next[pid]?.updateId === updateId) delete next[pid];
                        });
                        return next;
                    });
                }, 30000);

            } else {
                // LIVE MODE — bulk allocation save across multiple projects for one resource.
                //
                // We compute each project's new team INSIDE setPendingUpdates so we read
                // the latest team state (including any earlier in-flight edits from
                // handleAssign / handleUpdateAllocation that haven't yet propagated to
                // project.team). Then queue per-project Airtable writes via the same
                // serialiser other handlers use, so a save here can't race a recent
                // single-cell edit on the same project.
                const projectIds = Object.keys(projectUpdates);
                const perProjectFields = {};

                setPendingUpdates(prev => {
                    const next = { ...prev };
                    for (const projectId of projectIds) {
                        const allocs = projectUpdates[projectId];
                        const project = effectiveProjects?.find(p => p.id === projectId);
                        const previousPending = prev[projectId] || {};
                        const baseTeam = previousPending.team || project?.team || { pm: [], sc: [], pd: [] };
                        const teamToMutate = {
                            pm: [...(baseTeam.pm || [])],
                            sc: [...(baseTeam.sc || [])],
                            pd: [...(baseTeam.pd || [])]
                        };

                        allocs.forEach(alloc => {
                            const role = alloc.type;
                            const roleTeam = teamToMutate[role];
                            const existingIdx = roleTeam.findIndex(m => m.id === resourceId);
                            if (existingIdx >= 0) {
                                roleTeam[existingIdx] = { ...roleTeam[existingIdx], allocationPct: alloc.allocation };
                            } else {
                                const res = allResources?.find(r => r.id === resourceId) || { name: 'Unknown' };
                                roleTeam.push({ id: resourceId, name: res.name, allocationPct: alloc.allocation });
                            }
                        });

                        next[projectId] = {
                            ...previousPending,
                            team: teamToMutate,
                            isPending: true,
                            timestamp: Date.now(),
                            updateId
                        };

                        // Build the Airtable payload now that team is finalised. Capture for
                        // use in the per-project write below.
                        const fields = {};
                        const rolesTouched = new Set(allocs.map(a => a.type));
                        rolesTouched.forEach(role => {
                            let updateFieldId;
                            if (role === 'pm') updateFieldId = resolveWriteFieldId(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE);
                            else if (role === 'sc') updateFieldId = resolveWriteFieldId(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE);
                            else if (role === 'pd') updateFieldId = resolveWriteFieldId(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE);
                            if (updateFieldId) {
                                const realUserIds = teamToMutate[role].filter(m => !m.isPlaceholder).map(m => ({ id: m.id }));
                                fields[updateFieldId] = realUserIds;
                            }
                        });
                        const jsonFieldId = resolveWriteFieldId(SETTINGS.TEAM_ALLOCATIONS, SETTINGS.TEAM_ALLOCATIONS_UPDATE);
                        if (jsonFieldId) {
                            fields[jsonFieldId] = JSON.stringify(buildAllocationsJson(teamToMutate));
                        }
                        if (Object.keys(fields).length > 0) {
                            perProjectFields[projectId] = fields;
                        }
                    }
                    return next;
                });

                // Queue each project's write so we serialise vs any in-flight edits on
                // the same row. Cross-project writes parallelise via the queue's per-key
                // chains. Errors per-project don't block others.
                await Promise.all(Object.keys(perProjectFields).map(projectId =>
                    enqueueProjectWrite(projectId, async () => {
                        try {
                            await projTable.updateRecordAsync(projectId, perProjectFields[projectId]);
                        } catch (err) {
                            console.error('Failed to save allocation for project', projectId, err);
                            addToast({ type: 'error', title: 'Save failed', message: `${projectId}: ${err?.message || err}` });
                        }
                    })
                ));

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        const next = { ...prev };
                        Object.keys(perProjectFields).forEach(pid => {
                            if (next[pid]?.updateId === updateId) delete next[pid];
                        });
                        return next;
                    });
                }, 2000);
            }

            setActiveCell(null);
        } catch (err) {
            console.error('Failed to save allocations:', err);
            addToast({ type: 'error', title: 'Save failed', message: err.message });
        }
    }, [projTable, activeCell, activeScenario, pendingUpdates, effectiveProjects, allResources, allProjects, currentUserName, scenarioManager, setScenarios, setPendingUpdates, setActiveCell, addToast, resolveFieldId, stableSettings, SETTINGS, squadIdMap, enqueueProjectWrite, buildAllocationsJson]);

    // ═══════════════════════════════════════════════════════════════════
    // BATCH APPLY HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleBatchApply = useCallback(async (projectIds, updates) => {
        if (!projTable) return;
        setIsBatchUpdating(true);
        const updateId = Date.now();

        const shiftDate = (date, amount, unit) => {
            if (!date) return null;
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;
            switch (unit) {
                case 'days': d.setDate(d.getDate() + amount); break;
                case 'weeks': d.setDate(d.getDate() + (amount * 7)); break;
                case 'months': d.setMonth(d.getMonth() + amount); break;
            }
            return d.toISOString().split('T')[0];
        };

        try {
            if (activeScenario && !activeScenario.isLive) {
                // DRAFT MODE
                const scenarioChanges = {
                    ...activeScenario.changes,
                    projects: { ...(activeScenario.changes?.projects || {}) }
                };

                const optimisticUpdates = {};

                for (const projectId of projectIds) {
                    const existingEntry = scenarioChanges.projects[projectId] || {};
                    const existingOriginal = existingEntry.original || {};
                    const existingChanges = existingEntry.changes || existingEntry;

                    const currentProject = allProjects?.find(p => p.id === projectId);

                    let computedKickOff = updates.kickOffDate;
                    let computedLaunch = updates.launchDate;

                    if (updates.type === 'dateShift' && updates.shiftAmount !== 0) {
                        computedKickOff = shiftDate(currentProject?.kickOff || currentProject?.start, updates.shiftAmount, updates.shiftUnit);
                        computedLaunch = shiftDate(currentProject?.launch || currentProject?.end, updates.shiftAmount, updates.shiftUnit);
                    }

                    const original = { ...existingOriginal };
                    const trackedFields = ['status', 'squad', 'kickOff', 'launch', 'effortProfile', 'resourcingOverride', 'resourcedWithinProgram', 'lockLaunch', 'lockSquad', 'lockResources', 'wave'];
                    trackedFields.forEach(field => {
                        if (!(field in original)) {
                            let val;
                            if (field === 'squad') val = currentProject?.squads?.[0] || currentProject?.squad;
                            else if (field === 'kickOff') val = currentProject?.kickOff || currentProject?.start;
                            else if (field === 'launch') val = currentProject?.launch || currentProject?.end;
                            else val = currentProject?.[field];
                            original[field] = val !== undefined ? val : null;
                        }
                    });

                    const newChanges = {
                        ...existingChanges,
                        ...(updates.status && { status: updates.status }),
                        ...(updates.squad !== undefined && { squad: updates.squad || '', squads: updates.squad ? [updates.squad] : [] }),
                        ...(computedKickOff && { start: computedKickOff, kickOff: computedKickOff }),
                        ...(computedLaunch && { end: computedLaunch, launch: computedLaunch }),
                        ...(updates.lockLaunch !== undefined && { lockLaunch: updates.lockLaunch }),
                        ...(updates.lockSquad !== undefined && { lockSquad: updates.lockSquad }),
                        ...(updates.lockResources !== undefined && { lockResources: updates.lockResources }),
                        ...(updates.effortProfile !== undefined && { effortProfile: updates.effortProfile }),
                        ...(updates.resourcingOverride !== undefined && { resourcingOverride: updates.resourcingOverride }),
                        ...(updates.resourcedWithinProgram !== undefined && { resourcedWithinProgram: updates.resourcedWithinProgram }),
                        ...(updates.wave !== undefined && { wave: updates.wave })
                    };

                    scenarioChanges.projects[projectId] = {
                        name: currentProject?.name || projectId,
                        original,
                        changes: newChanges,
                        ...newChanges
                    };

                    optimisticUpdates[projectId] = { ...newChanges, isDraft: true, timestamp: Date.now(), updateId };
                }

                setPendingUpdates(prev => ({ ...prev, ...optimisticUpdates }));

                const now = new Date().toISOString();
                const metadata = {
                    ...(activeScenario.metadata || {}),
                    lastModified: now,
                    lastSavedAt: now,
                    lastEditedBy: currentUserName,
                    totalChanges: Object.keys(scenarioChanges.projects || {}).length + Object.keys(scenarioChanges.resources || {}).length
                };
                await scenarioManager.saveScenarioChanges(activeScenario.id, scenarioChanges, metadata);
                setScenarios(prev => prev.map(s => s.id === activeScenario.id ? { ...s, changes: scenarioChanges, metadata } : s));

                setTimeout(() => {
                    setPendingUpdates(prev => {
                        const next = { ...prev };
                        projectIds.forEach(id => { if (next[id]?.updateId === updateId) delete next[id]; });
                        return next;
                    });
                }, 30000);

            } else {
                // LIVE MODE
                const recordUpdates = [];
                const optimisticUpdates = {};
                // Shared batch timestamp — all projects in this batch share the same value so the
                // cleanup timer at the end can identify *every* entry belonging to this batch, not
                // just the first one. Prior bug: Date.now() inside the per-project loop gave each
                // entry a slightly different timestamp; cleanup only matched the first.
                const batchTimestamp = Date.now();

                for (const projectId of projectIds) {
                    const currentProject = allProjects?.find(p => p.id === projectId);

                    let computedKickOff = updates.kickOffDate;
                    let computedLaunch = updates.launchDate;

                    if (updates.type === 'dateShift' && updates.shiftAmount !== 0) {
                        computedKickOff = shiftDate(currentProject?.kickOff || currentProject?.start, updates.shiftAmount, updates.shiftUnit);
                        computedLaunch = shiftDate(currentProject?.launch || currentProject?.end, updates.shiftAmount, updates.shiftUnit);
                    }

                    optimisticUpdates[projectId] = {
                        ...(updates.status && { status: updates.status }),
                        ...(updates.squad !== undefined && { squad: updates.squad || '', squads: updates.squad ? [updates.squad] : [] }),
                        ...(computedKickOff !== undefined && { start: computedKickOff || null, kickOff: computedKickOff || null }),
                        ...(computedLaunch !== undefined && { end: computedLaunch || null, launch: computedLaunch || null }),
                        ...(updates.lockLaunch !== undefined && { lockLaunch: updates.lockLaunch }),
                        ...(updates.lockSquad !== undefined && { lockSquad: updates.lockSquad }),
                        ...(updates.lockResources !== undefined && { lockResources: updates.lockResources }),
                        ...(updates.effortProfile !== undefined && { effortProfile: updates.effortProfile }),
                        ...(updates.resourcingOverride !== undefined && { resourcingOverride: updates.resourcingOverride }),
                        ...(updates.resourcedWithinProgram !== undefined && { resourcedWithinProgram: updates.resourcedWithinProgram }),
                        ...(updates.wave !== undefined && { wave: updates.wave }),
                        isPending: true,
                        timestamp: batchTimestamp
                    };

                    const fields = {};

                    if (updates.status) {
                        const statusFieldId = resolveWriteFieldId(SETTINGS.STATUS, SETTINGS.STATUS_UPDATE);
                        if (statusFieldId) fields[statusFieldId] = { name: updates.status };
                    }
                    if (updates.squad !== undefined) {
                        const squadFieldId = resolveWriteFieldId(SETTINGS.PROJECT_SQUAD, SETTINGS.PROJECT_SQUAD_UPDATE);
                        if (squadFieldId) {
                            if (updates.squad && updates.squad !== 'Unassigned') {
                                // Try lookup
                                const squadRecordId = squadIdMap?.[updates.squad];
                                if (squadRecordId) {
                                    fields[squadFieldId] = [{ id: squadRecordId }];
                                } else {
                                    fields[squadFieldId] = [{ name: updates.squad }];
                                }
                            } else {
                                fields[squadFieldId] = []; // Clear field
                            }
                        }
                    }
                    if (computedKickOff) {
                        const startFieldId = resolveWriteFieldId(SETTINGS.KICK_OFF, SETTINGS.KICK_OFF_UPDATE);
                        if (startFieldId) fields[startFieldId] = computedKickOff;
                    }
                    if (computedLaunch) {
                        const endFieldId = resolveWriteFieldId(SETTINGS.LAUNCH, SETTINGS.LAUNCH_UPDATE);
                        if (endFieldId) fields[endFieldId] = computedLaunch;
                    }
                    if (updates.lockLaunch !== undefined) {
                        const lockLaunchFieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_LAUNCH, SETTINGS.SLOT_LOCK_LAUNCH_UPDATE);
                        if (lockLaunchFieldId) fields[lockLaunchFieldId] = !!updates.lockLaunch;
                    }
                    if (updates.lockSquad !== undefined) {
                        const lockSquadFieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_SQUAD, SETTINGS.SLOT_LOCK_SQUAD_UPDATE);
                        if (lockSquadFieldId) fields[lockSquadFieldId] = !!updates.lockSquad;
                    }
                    if (updates.lockResources !== undefined) {
                        const lockResourcesFieldId = resolveWriteFieldId(SETTINGS.SLOT_LOCK_RESOURCES, SETTINGS.SLOT_LOCK_RESOURCES_UPDATE);
                        if (lockResourcesFieldId) fields[lockResourcesFieldId] = !!updates.lockResources;
                    }
                    if (updates.effortProfile !== undefined) {
                        const effortProfileFieldId = resolveWriteFieldId(SETTINGS.EFFORT_PROFILE, SETTINGS.EFFORT_PROFILE_UPDATE);
                        if (effortProfileFieldId) fields[effortProfileFieldId] = updates.effortProfile && updates.effortProfile !== 'None' ? { name: updates.effortProfile } : null;
                    }
                    if (updates.resourcingOverride !== undefined) {
                        const resourcingOverrideFieldId = resolveWriteFieldId(SETTINGS.RESOURCING_OVERRIDE, SETTINGS.RESOURCING_OVERRIDE_UPDATE);
                        if (resourcingOverrideFieldId) {
                            const numValue = parseFloat(updates.resourcingOverride);
                            fields[resourcingOverrideFieldId] = isNaN(numValue) ? null : numValue;
                        }
                    }
                    if (updates.resourcedWithinProgram !== undefined) {
                        const programFieldId = resolveFieldId(stableSettings[SETTINGS.RESOURCED_WITHIN_PROGRAM]);
                        if (programFieldId) fields[programFieldId] = !!updates.resourcedWithinProgram;
                    }

                    if (updates.wave !== undefined) {
                        const waveFieldId = resolveWriteFieldId(SETTINGS.PROJECT_WAVE, SETTINGS.WAVE_UPDATE);
                        if (waveFieldId) {
                            fields[waveFieldId] = updates.wave ? { name: updates.wave } : null;
                        }
                    }

                    if (Object.keys(fields).length > 0) {
                        recordUpdates.push({ id: projectId, fields });
                    }
                }

                // Apply optimistic state and close modal BEFORE the DB call
                // so the user sees instant feedback
                setPendingUpdates(prev => ({ ...prev, ...optimisticUpdates }));
                setShowBatchModal(false);
                setSelectedProjects(new Set());
                setIsBatchUpdating(false);

                // Fire DB updates in the background
                try {
                    for (let i = 0; i < recordUpdates.length; i += 50) {
                        const chunk = recordUpdates.slice(i, i + 50);
                        await projTable.updateRecordsAsync(chunk, { typecast: true });
                    }
                } catch (dbErr) {
                    console.error('Batch DB update failed:', dbErr);
                }

                // Keep optimistic state for ~3s. Direct writes land inside a second + Airtable's
                // reactive sync picks it up shortly after, so 15s was overkill and left the UI
                // showing "pending" badges long after the write landed. If a later update
                // overwrites our batch entry we also skip cleanup (timestamp mismatch).
                setTimeout(() => {
                    setPendingUpdates(prev => {
                        const newState = { ...prev };
                        projectIds.forEach(id => {
                            if (newState[id]?.timestamp === batchTimestamp) {
                                delete newState[id];
                            }
                        });
                        return newState;
                    });
                }, 3000);
            }
        } catch (err) {
            console.error('Batch update failed:', err);
        } finally {
            setIsBatchUpdating(false);
        }
    }, [projTable, activeScenario, allProjects, currentUserName, scenarioManager, setScenarios, setPendingUpdates, setShowBatchModal, setSelectedProjects, setIsBatchUpdating, resolveFieldId, stableSettings, SETTINGS, squadIdMap]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO CLONE HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleCloneScenario = useCallback(async (scenarioId) => {
        if (!scenarioManager) return;
        const source = scenarios?.find(s => s.id === scenarioId);
        if (!source) return;
        const newName = `${source.name} (Copy)`;
        try {
            const newId = await scenarioManager.createScenario(newName, source.description || 'Cloned scenario');
            if (newId) {
                // Copy changes and metadata from source
                await scenarioManager.saveScenarioChanges(newId, source.changes || { projects: {}, resources: {} }, {
                    ...source.metadata,
                    lastSavedAt: new Date().toISOString(),
                    clonedFrom: source.name
                });
                setActiveScenarioId(newId);
                addToast({ type: 'success', title: 'Scenario cloned', message: `"${newName}" is now active` });
            }
        } catch (err) {
            console.error('Failed to clone scenario:', err);
            addToast({ type: 'error', title: 'Clone failed', message: err.message });
        }
    }, [scenarioManager, scenarios, setActiveScenarioId, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO DELETE HANDLER (opens confirmation modal)
    // ═══════════════════════════════════════════════════════════════════
    const handleDeleteScenario = useCallback((scenarioId) => {
        const scenario = scenarios?.find(s => s.id === scenarioId);
        if (!scenario) return;
        setDeleteConfirmScenario(scenario);
    }, [scenarios, setDeleteConfirmScenario]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO RENAME HANDLER (opens rename modal)
    // ═══════════════════════════════════════════════════════════════════
    const handleRenameScenario = useCallback((scenario) => {
        setRenameData({ isOpen: true, scenario });
    }, [setRenameData]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO MERGE HANDLER (merge sourceId into targetId)
    // ═══════════════════════════════════════════════════════════════════
    const handleMergeScenarios = useCallback(async (sourceId, targetId) => {
        if (!scenarioManager) return;
        try {
            await scenarioManager.mergeScenarios(sourceId, targetId, scenarios);

            const sourceScenario = scenarios?.find(s => s.id === sourceId);
            const targetScenario = scenarios?.find(s => s.id === targetId);

            const mergedChanges = {
                projects: { ...(targetScenario?.changes?.projects || {}), ...(sourceScenario?.changes?.projects || {}) },
                resources: { ...(targetScenario?.changes?.resources || {}), ...(sourceScenario?.changes?.resources || {}) },
                financialAdjustments: [
                    ...(targetScenario?.changes?.financialAdjustments || []),
                    ...(sourceScenario?.changes?.financialAdjustments || [])
                ],
                programAssignments: [
                    ...(targetScenario?.changes?.programAssignments || []),
                    ...(sourceScenario?.changes?.programAssignments || [])
                ]
            };

            setScenarios(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        changes: mergedChanges,
                        metadata: {
                            ...s.metadata,
                            lastSavedAt: new Date().toISOString(),
                            mergedFrom: [...(s.metadata?.mergedFrom || []), sourceScenario?.name || 'Unknown'],
                            totalChanges: Object.keys(mergedChanges.projects).length +
                                Object.keys(mergedChanges.resources).length +
                                mergedChanges.financialAdjustments.length +
                                mergedChanges.programAssignments.length
                        }
                    }
                    : s
            ));

            const sourceName = sourceScenario?.name || 'Source';
            const targetName = targetScenario?.name || 'Target';
            addToast({ type: 'success', title: 'Scenarios merged', message: `"${sourceName}" merged into "${targetName}"` });
        } catch (err) {
            console.error('Failed to merge scenarios:', err);
            addToast({ type: 'error', title: 'Merge failed', message: err.message });
        }
    }, [scenarioManager, scenarios, setScenarios, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SCENARIO MERGE TO NEW HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleMergeScenariosToNew = useCallback(async (id1, id2, newName) => {
        if (!scenarioManager) return;
        try {
            const newId = await scenarioManager.mergeScenariosToNew(id1, id2, newName, scenarios);

            const scenario1 = scenarios?.find(s => s.id === id1);
            const scenario2 = scenarios?.find(s => s.id === id2);

            const mergedChanges = {
                projects: { ...(scenario1?.changes?.projects || {}), ...(scenario2?.changes?.projects || {}) },
                resources: { ...(scenario1?.changes?.resources || {}), ...(scenario2?.changes?.resources || {}) },
                financialAdjustments: [
                    ...(scenario1?.changes?.financialAdjustments || []),
                    ...(scenario2?.changes?.financialAdjustments || [])
                ],
                programAssignments: [
                    ...(scenario1?.changes?.programAssignments || []),
                    ...(scenario2?.changes?.programAssignments || [])
                ]
            };

            const mergedMetadata = {
                createdAt: new Date().toISOString(),
                lastSavedAt: new Date().toISOString(),
                mergedFrom: [scenario1?.name || 'Unknown', scenario2?.name || 'Unknown'],
                totalChanges: Object.keys(mergedChanges.projects).length +
                    Object.keys(mergedChanges.resources).length +
                    mergedChanges.financialAdjustments.length +
                    mergedChanges.programAssignments.length
            };

            setScenarios(prev => [...prev, {
                id: newId,
                name: newName,
                description: `Merged from "${scenario1?.name}" and "${scenario2?.name}"`,
                isActive: false,
                status: 'Draft',
                changes: mergedChanges,
                metadata: mergedMetadata
            }]);

            addToast({ type: 'success', title: 'Merged to new scenario', message: `Created "${newName}"` });
            setActiveScenarioId(newId);
        } catch (err) {
            console.error('Failed to merge to new:', err);
            addToast({ type: 'error', title: 'Merge failed', message: err.message });
        }
    }, [scenarioManager, scenarios, setScenarios, setActiveScenarioId, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // MULTI-MERGE HANDLER (merge N sources into target)
    // ═══════════════════════════════════════════════════════════════════
    const handleMultiMergeScenarios = useCallback(async (sourceIds, targetId) => {
        if (!scenarioManager) return;
        try {
            await scenarioManager.mergeMultipleScenarios(sourceIds, targetId, scenarios);

            const targetScenario = scenarios?.find(s => s.id === targetId);
            let mergedProjects = { ...(targetScenario?.changes?.projects || {}) };
            let mergedResources = { ...(targetScenario?.changes?.resources || {}) };
            let mergedFinancial = [...(targetScenario?.changes?.financialAdjustments || [])];
            let mergedProgram = [...(targetScenario?.changes?.programAssignments || [])];
            const sourceNames = [];

            for (const srcId of sourceIds) {
                const src = scenarios?.find(s => s.id === srcId);
                if (src) {
                    mergedProjects = { ...mergedProjects, ...(src.changes?.projects || {}) };
                    mergedResources = { ...mergedResources, ...(src.changes?.resources || {}) };
                    mergedFinancial = [...mergedFinancial, ...(src.changes?.financialAdjustments || [])];
                    mergedProgram = [...mergedProgram, ...(src.changes?.programAssignments || [])];
                    sourceNames.push(src.name);
                }
            }

            const mergedChanges = {
                projects: mergedProjects,
                resources: mergedResources,
                financialAdjustments: mergedFinancial,
                programAssignments: mergedProgram
            };

            setScenarios(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        changes: mergedChanges,
                        metadata: {
                            ...s.metadata,
                            lastSavedAt: new Date().toISOString(),
                            mergedFrom: [...(s.metadata?.mergedFrom || []), ...sourceNames],
                            totalChanges: Object.keys(mergedChanges.projects).length +
                                Object.keys(mergedChanges.resources).length +
                                mergedChanges.financialAdjustments.length +
                                mergedChanges.programAssignments.length
                        }
                    }
                    : s
            ));

            const targetName = targetScenario?.name || 'Target';
            addToast({ type: 'success', title: 'Multi-merge complete', message: `Merged ${sourceIds.length} scenarios into "${targetName}"` });
        } catch (err) {
            console.error('Failed to multi-merge:', err);
            addToast({ type: 'error', title: 'Merge failed', message: err.message });
        }
    }, [scenarioManager, scenarios, setScenarios, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // MULTI-MERGE TO NEW HANDLER (create new scenario from N sources)
    // ═══════════════════════════════════════════════════════════════════
    const handleMultiMergeScenariosToNew = useCallback(async (scenarioIds, newName) => {
        if (!scenarioManager) return;

        // Get scenarios for conflict detection
        const scenariosToMerge = scenarioIds
            .map(id => scenarios?.find(s => s.id === id))
            .filter(Boolean);

        // Check for conflicts before merging
        const conflicts = scenarioManager.detectScenarioMergeConflicts(scenariosToMerge);

        // Helper to execute the merge (with optional user resolutions)
        const executeMerge = async (userResolutions = null) => {
            try {
                const newId = await scenarioManager.mergeMultipleScenariosToNew(
                    scenarioIds,
                    newName,
                    scenarios,
                    userResolutions // Pass user resolutions to apply
                );

                // Use smart merge for local state too
                const scenarioChanges = scenariosToMerge.map(s => s.changes || {});
                let mergedChanges = scenarioManager._smartMergeChanges(scenarioChanges);

                // Apply user resolutions if provided
                if (userResolutions) {
                    // Override merged values with user selections
                    for (const [projectId, fields] of Object.entries(userResolutions.projects || {})) {
                        if (!mergedChanges.projects[projectId]) mergedChanges.projects[projectId] = {};
                        for (const [field, selectedScenario] of Object.entries(fields)) {
                            const sourceScenario = scenariosToMerge.find(s => s.name === selectedScenario);
                            if (sourceScenario?.changes?.projects?.[projectId]?.[field] !== undefined) {
                                mergedChanges.projects[projectId][field] = sourceScenario.changes.projects[projectId][field];
                            }
                        }
                    }
                    for (const [resourceId, fields] of Object.entries(userResolutions.resources || {})) {
                        if (!mergedChanges.resources[resourceId]) mergedChanges.resources[resourceId] = {};
                        for (const [field, selectedScenario] of Object.entries(fields)) {
                            const sourceScenario = scenariosToMerge.find(s => s.name === selectedScenario);
                            if (sourceScenario?.changes?.resources?.[resourceId]?.[field] !== undefined) {
                                mergedChanges.resources[resourceId][field] = sourceScenario.changes.resources[resourceId][field];
                            }
                        }
                    }
                }

                const names = scenariosToMerge.map(s => s.name);
                const mergedMetadata = {
                    createdAt: new Date().toISOString(),
                    lastSavedAt: new Date().toISOString(),
                    mergedFrom: names,
                    totalChanges: Object.keys(mergedChanges.projects).length +
                        Object.keys(mergedChanges.resources).length +
                        (mergedChanges.financialAdjustments?.length || 0) +
                        (mergedChanges.programAssignments?.length || 0),
                    hadConflicts: conflicts.hasConflicts,
                    conflictCount: conflicts.summary?.length || 0,
                    conflictsResolved: !!userResolutions
                };

                setScenarios(prev => [...prev, {
                    id: newId,
                    name: newName,
                    description: `Merged from ${names.length} scenarios: ${names.join(', ')}`,
                    isActive: false,
                    status: 'Draft',
                    changes: mergedChanges,
                    metadata: mergedMetadata
                }]);

                addToast({
                    type: 'success',
                    title: 'Merge complete',
                    message: `Created "${newName}" from ${scenarioIds.length} scenarios${userResolutions ? ' with resolved conflicts' : ''}`
                });
                setActiveScenarioId(newId);
            } catch (err) {
                console.error('Failed to multi-merge to new:', err);
                addToast({ type: 'error', title: 'Merge failed', message: err.message });
            }
        };

        // If conflicts exist and modal setter is available, show modal for user resolution
        if (conflicts.hasConflicts && setMergeConflictData) {
            setMergeConflictData({
                conflicts,
                scenarios: scenariosToMerge,
                newName,
                onResolve: (resolutions) => {
                    executeMerge(resolutions);
                }
            });
        } else {
            // No conflicts (or no modal available) - proceed with auto-merge
            await executeMerge();
        }
    }, [scenarioManager, scenarios, setScenarios, setActiveScenarioId, addToast, setMergeConflictData]);

    // ═══════════════════════════════════════════════════════════════════
    // CREATE SCENARIO HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleCreateScenario = useCallback(async (name, description) => {
        try {
            if (!scenarioManager) {
                console.error('ScenarioManager not available. Check base/globalConfig props.');
                addToast({ type: 'error', title: 'Unable to create scenario', message: 'Scenarios table not configured' });
                return;
            }
            const newScenario = await scenarioManager.createScenario(name, description, 'User');

            if (newScenario && newScenario.id) {
                setActiveScenarioId(newScenario.id);
                addToast({ type: 'success', title: 'Scenario created', message: `"${name}" is now active` });
            }

            setShowCreateScenario(false);
        } catch (err) {
            console.error('Failed to create scenario:', err);
            addToast({ type: 'error', title: 'Failed to create scenario', message: err.message });
        }
    }, [scenarioManager, setActiveScenarioId, setShowCreateScenario, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SAVE SETTINGS HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveSettings = useCallback(async (newSettings) => {
        // Update local state immediately
        setStoredSettings(newSettings);

        // Persist to Airtable
        if (settingsTable && settingsRecords) {
            try {
                const jsonString = JSON.stringify(newSettings);
                const fieldId = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD]);

                if (settingsRecords.length > 0) {
                    // Update existing
                    await settingsTable.updateRecordAsync(settingsRecords[0].id, {
                        [fieldId]: jsonString
                    });
                } else {
                    // Create new
                    await settingsTable.createRecordAsync({
                        [fieldId]: jsonString
                    });
                }
                addToast({ type: 'success', title: 'Settings saved', duration: 2000 });
            } catch (err) {
                console.error('Failed to save settings to Airtable:', err);
                addToast({ type: 'error', title: 'Settings failed to save', message: err.message });
            }
        }
    }, [settingsTable, settingsRecords, setStoredSettings, resolveFieldId, stableSettings, SETTINGS, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SAVE INITIATIVES HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveInitiatives = useCallback(async (initiatives) => {
        const newSettings = { ...storedSettings, initiatives };
        setStoredSettings(newSettings);

        // Persist to Airtable
        if (settingsTable && settingsRecords) {
            try {
                const jsonString = JSON.stringify(newSettings);
                const fieldId = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD]);

                if (settingsRecords.length > 0) {
                    await settingsTable.updateRecordAsync(settingsRecords[0].id, {
                        [fieldId]: jsonString
                    });
                }
            } catch (err) {
                console.error('Failed to save initiatives:', err);
            }
        }
    }, [storedSettings, settingsTable, settingsRecords, setStoredSettings, resolveFieldId, stableSettings, SETTINGS]);

    // ═══════════════════════════════════════════════════════════════════
    // GENERATE AI INSIGHTS HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleGenerateAIInsights = useCallback(async ({ slotMap, summary, roleInsights, roleConfig }) => {
        if (!base || !storedSettings.aiIntelligence?.tableId) {
            console.warn('[AI] No base or tableId configured');
            return;
        }

        setAiLoading(true);
        addToast({ message: 'Generating AI insights...', type: 'info' });

        try {
            const result = await writeSlotSnapshot(
                base,
                storedSettings.aiIntelligence.tableId,
                { slotMap, summary, insights: roleInsights, roleConfig }
            );
            // Update last sync time
            setStoredSettings(prev => ({
                ...prev,
                aiIntelligence: {
                    ...prev.aiIntelligence,
                    lastSyncTime: new Date().toISOString()
                }
            }));

            // Poll for completion
            await new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 20; // 40 seconds
                const pollInterval = 2000;

                const poll = async () => {
                    attempts++;
                    try {
                        const recs = await readAIRecommendations(base, storedSettings.aiIntelligence.tableId, 1);
                        const latest = recs[0];

                        if (latest && latest.analysis && latest.recommendations) {
                            // Check timestamp match
                            const recordTime = new Date(latest.snapshotTime).getTime();
                            const snapTime = new Date(result.snapshotData.timestamp).getTime();

                            // Allow slight clock drift (within 1 second)
                            if (recordTime >= snapTime - 1000) {
                                setAiInsightData(latest);
                                setAiLoading(false);
                                setShowAIModal(true);
                                addToast({ message: 'AI Insights Ready', type: 'success' });
                                resolve();
                                return;
                            }
                        }

                        if (attempts < maxAttempts) {
                            setTimeout(poll, pollInterval);
                        } else {
                            setAiLoading(false);
                            addToast({ message: 'Analysis timed out. Check back later.', type: 'warning' });
                            resolve();
                        }
                    } catch (err) {
                        console.error('[AI] Polling error:', err);
                        if (attempts < maxAttempts) {
                            setTimeout(poll, pollInterval);
                        } else {
                            resolve();
                        }
                    }
                };

                setTimeout(poll, 2000);
            });

        } catch (error) {
            console.error('[AI] Failed to write snapshot:', error);
            setAiLoading(false);
            addToast({ message: 'Failed to generate insights', type: 'error' });
        }
    }, [base, storedSettings, setAiLoading, setAiInsightData, setShowAIModal, setStoredSettings, writeSlotSnapshot, readAIRecommendations, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SAVE SLOT OPTIMIZATION AS DRAFT HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveAsDraft = useCallback(async (arg1, arg2) => {
        if (!scenarioManager) {
            addToast({ type: 'error', title: 'Scenario manager not available' });
            return;
        }

        try {
            const changes = { projects: {}, resources: {} };

            if (Array.isArray(arg1)) {
                arg1.forEach(rec => {
                    const pChanges = {};
                    if (rec.suggestedDate) pChanges.launch = rec.suggestedDate;
                    if (rec.suggestedSquad) pChanges.squad = rec.suggestedSquad;
                    if (rec.suggestedKickOff) pChanges.kickOff = rec.suggestedKickOff;

                    if (rec.projectId && Object.keys(pChanges).length > 0) {
                        changes.projects[rec.projectId] = {
                            ...(changes.projects[rec.projectId] || {}),
                            ...pChanges,
                            _metadata: { source: 'slot' }
                        };
                    }
                });
            } else if (typeof arg1 === 'string' && arg2) {
                changes.projects[arg1] = {
                    ...arg2,
                    _metadata: { source: 'slot' }
                };
            }

            if (Object.keys(changes.projects).length === 0) {
                addToast({ type: 'warning', title: 'No actionable recommendations to save' });
                return;
            }

            // 1. Create scenario
            const scenarioName = `Optimizer ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
            const description = `Auto-generated from ${Array.isArray(arg1) ? arg1.length : 1} optimization recommendations`;
            const newId = await scenarioManager.createScenario(scenarioName, description);

            // 2. Save changes
            const metadata = {
                createdAt: new Date().toISOString(),
                lastSavedAt: new Date().toISOString(),
                totalChanges: Object.keys(changes.projects).length,
                source: 'slot_optimizer'
            };
            await scenarioManager.saveScenarioChanges(newId, changes, metadata);

            // 3. Activate scenario
            await scenarioManager.activateScenario(newId);

            // 4. Update local state
            const newScenario = {
                id: newId,
                name: scenarioName,
                description,
                isActive: true,
                status: 'Draft',
                changes,
                metadata,
                isLive: false
            };

            setScenarios(prev => [
                ...prev.map(s => ({ ...s, isActive: false })),
                newScenario
            ]);
            setActiveScenarioId(newId);

            addToast({
                type: 'success',
                title: 'Draft scenario created & activated',
                message: `${Object.keys(changes.projects).length} project changes saved to "${scenarioName}"`
            });
        } catch (error) {
            console.error('[SaveAsDraft] Failed:', error);
            addToast({ type: 'error', title: 'Failed to create scenario', message: error.message });
        }
    }, [scenarioManager, setScenarios, setActiveScenarioId, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // SAVE SCENARIO NOTES HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveScenarioNotes = useCallback(async (notes) => {
        try {
            if (!scenarioManager || !activeScenario) {
                console.error('ScenarioManager or activeScenario not available');
                return;
            }
            const updatedMetadata = {
                ...activeScenario.metadata,
                notes,
                lastSavedAt: new Date().toISOString()
            };
            await scenarioManager.saveScenarioChanges(
                activeScenario.id,
                activeScenario.changes || {},
                updatedMetadata
            );
            setShowNotesModal(false);
        } catch (err) {
            console.error('Failed to save notes:', err);
            addToast({ type: 'error', title: 'Failed to save notes', message: err.message });
        }
    }, [scenarioManager, activeScenario, setShowNotesModal, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // RENAME SCENARIO CONFIRM HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleRenameScenarioConfirm = useCallback(async (newName) => {
        const scenario = renameData?.scenario;
        if (!newName || newName.trim() === scenario?.name) {
            setRenameData({ isOpen: false, scenario: null });
            return;
        }
        if (!scenarioManager) return;
        try {
            await scenarioManager.renameScenario(scenario.id, newName.trim());
            addToast({ type: 'success', title: 'Scenario renamed', message: `Renamed to "${newName.trim()}"` });
        } catch (err) {
            console.error('Failed to rename scenario:', err);
            addToast({ type: 'error', title: 'Rename failed', message: err.message });
        }
        setRenameData({ isOpen: false, scenario: null });
    }, [scenarioManager, renameData, setRenameData, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // CREATE DRAFT FROM OPTIMIZATION HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleCreateDraftFromOptimization = useCallback(async (recommendations) => {
        if (!scenarioManager) {
            addToast({ type: 'error', title: 'Scenario manager not available' });
            return;
        }
        try {
            // ReprioritizationTab sends a pre-built object { name, description, changes, optimizerStats }
            // while SlotHeatmap sends an array of recommendation objects
            if (recommendations && !Array.isArray(recommendations) && recommendations.changes) {
                const { name: scenarioName, description, changes: scenarioChanges, optimizerStats } = recommendations;
                const finalName = scenarioName || `Replan ${new Date().toLocaleDateString()}`;
                const finalDesc = description || 'Auto-generated from portfolio reprioritization';

                const metadata = {
                    totalChanges: Object.keys(scenarioChanges.projects || {}).length,
                    lastSavedAt: new Date().toISOString(),
                    source: 'reprioritizer',
                    ...(optimizerStats ? { optimizerStats } : {})
                };

                const newScenarioId = await scenarioManager.createScenario(finalName, finalDesc);
                if (newScenarioId) {
                    setScenarios(prev => {
                        if (prev.find(s => s.id === newScenarioId)) return prev;
                        return [...prev, {
                            id: newScenarioId,
                            name: finalName,
                            description: finalDesc,
                            isLive: false,
                            status: 'Draft',
                            changes: scenarioChanges,
                            metadata
                        }];
                    });

                    await scenarioManager.saveScenarioChanges(newScenarioId, scenarioChanges, metadata);

                    setActiveScenarioId(newScenarioId);
                    setShowOptimizationModal(false);

                    addToast({
                        type: 'success',
                        title: 'Draft scenario created',
                        message: `${Object.keys(scenarioChanges.projects || {}).length} project changes saved to "${finalName}"`
                    });
                }
                return;
            }

            // Array format from SlotHeatmap / other callers
            const changes = {};

            recommendations.forEach(rec => {
                if (!changes[rec.projectId]) changes[rec.projectId] = {};

                // Squad Move
                if (rec.suggestedSquad && rec.suggestedSquad !== rec.currentSquad) {
                    changes[rec.projectId].squad = rec.suggestedSquad;
                }

                const project = effectiveProjects?.find(p => p.id === rec.projectId);

                // Date changes
                if (rec.suggestedWeek) {
                    if (rec.currentWeek && rec.currentWeek !== rec.suggestedWeek) {
                        const recDate = new Date(rec.suggestedWeek);
                        const currDate = new Date(rec.currentWeek);
                        const shiftMs = recDate - currDate;

                        if (shiftMs !== 0) {
                            changes[rec.projectId].launch = rec.suggestedWeek;

                            const originalKickOff = project?.kickOff || project?.start;
                            if (originalKickOff) {
                                const kDate = new Date(originalKickOff);
                                if (!isNaN(kDate.getTime())) {
                                    const newKickOff = new Date(kDate.getTime() + shiftMs);
                                    changes[rec.projectId].start = newKickOff.toISOString().split('T')[0];
                                    changes[rec.projectId].kickOff = newKickOff.toISOString().split('T')[0];
                                }
                            }
                            changes[rec.projectId].end = rec.suggestedWeek;
                        }
                    } else if (!rec.currentWeek) {
                        changes[rec.projectId].start = rec.suggestedWeek;
                        changes[rec.projectId].kickOff = rec.suggestedWeek;
                        const durationWeeks = storedSettings?.slotProfile?.durationWeeks || 12;
                        const koDate = new Date(rec.suggestedWeek);
                        if (!isNaN(koDate.getTime())) {
                            const launchDate = new Date(koDate.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000);
                            changes[rec.projectId].launch = launchDate.toISOString().split('T')[0];
                            changes[rec.projectId].end = launchDate.toISOString().split('T')[0];
                        }
                    }
                }

                if (Object.keys(changes[rec.projectId]).length === 0) {
                    delete changes[rec.projectId];
                }
            });

            if (Object.keys(changes).length === 0) {
                addToast({ type: 'warning', title: 'No actionable recommendations to save' });
                return;
            }

            const scenarioName = `Optimizer ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const newScenarioId = await scenarioManager.createScenario(
                scenarioName,
                `Auto-generated from ${recommendations.length} optimization recommendations`
            );

            if (newScenarioId) {
                const scenarioChanges = { projects: changes, resources: {} };

                setScenarios(prev => {
                    if (prev.find(s => s.id === newScenarioId)) return prev;
                    return [...prev, {
                        id: newScenarioId,
                        name: scenarioName,
                        description: `Auto-generated from ${recommendations.length} optimization recommendations`,
                        isLive: false,
                        status: 'Draft',
                        changes: scenarioChanges,
                        metadata: {
                            totalChanges: Object.keys(changes).length,
                            lastSavedAt: new Date().toISOString()
                        }
                    }];
                });

                await scenarioManager.saveScenarioChanges(newScenarioId, scenarioChanges, {
                    totalChanges: Object.keys(changes).length,
                    lastSavedAt: new Date().toISOString()
                });

                setActiveScenarioId(newScenarioId);
                setShowOptimizationModal(false);

                addToast({
                    type: 'success',
                    title: 'Draft scenario created',
                    message: `${Object.keys(changes).length} project changes saved to "${scenarioName}"`
                });
            }
        } catch (error) {
            console.error('[Optimize] Failed:', error);
            addToast({ type: 'error', title: 'Failed to create scenario', message: error.message });
        }
    }, [scenarioManager, effectiveProjects, storedSettings, setScenarios, setActiveScenarioId, setShowOptimizationModal, addToast]);

    // ═══════════════════════════════════════════════════════════════════
    // DELETE SCENARIO CONFIRM HANDLER
    // ═══════════════════════════════════════════════════════════════════
    const handleDeleteScenarioConfirm = useCallback(async () => {
        if (!deleteConfirmScenario || !scenarioManager) return;
        const scenarioToDelete = deleteConfirmScenario;

        // Clear state FIRST to prevent race condition
        setDeleteConfirmScenario(null);
        if (activeScenarioId === scenarioToDelete.id) {
            setActiveScenarioId(null);
        }
        setScenarios(prev => prev.filter(s => s.id !== scenarioToDelete.id));

        // Now safely delete from Airtable
        try {
            await scenarioManager.deleteScenario(scenarioToDelete.id);
        } catch (err) {
            console.error('Failed to delete scenario:', err);
        }
    }, [deleteConfirmScenario, scenarioManager, activeScenarioId, setDeleteConfirmScenario, setActiveScenarioId, setScenarios]);

    return {
        handleCellClick,
        handleUpdateProject,
        handleUpdateResource,
        handleDetailModalNavigate,
        handleCloneProject,
        handleScenarioSelect,
        handleConflictResolve,
        handleAddFinancialAdjustment,
        handleRemoveFinancialAdjustment,
        handleUndoAssignment,
        handleRedoAssignment,
        handleCommitScenario,
        handleApplyOptimizations,
        handleAssignProject,
        handleSlotAlignmentConfirm,
        handleAssignTeamMember: handleAssignTeamMemberProxy,
        handleUnassignTeamMember: handleUnassignTeamMemberProxy,
        handleUpdateAllocation: handleUpdateAllocationProxy,
        handleCopyToOtherRoles: handleCopyToOtherRolesProxy,
        handleCopyToAllRoles: handleCopyToAllRolesProxy,
        handleSaveAllocations,
        handleBatchApply,
        handleCloneScenario,
        handleDeleteScenario,
        handleRevertScenario,
        handleRenameScenario,
        handleMergeScenarios,
        handleMergeScenariosToNew,
        handleMultiMergeScenarios,
        handleMultiMergeScenariosToNew,
        handleCreateScenario,
        handleSaveSettings,
        handleSaveInitiatives,
        handleGenerateAIInsights,
        handleSaveAsDraft,
        handleSaveScenarioNotes,
        handleRenameScenarioConfirm,
        handleCreateDraftFromOptimization,
        handleDeleteScenarioConfirm,
    };
};

export default useDashboardHandlers;
