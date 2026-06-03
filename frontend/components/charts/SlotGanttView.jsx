/**
 * SlotGanttView - Gantt-style Slot Planning with Drag-Drop
 * Shows open slots and assigned projects with drag-drop from unresourced sidebar
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../design-system';

const SIDEBAR_WIDTH = 260;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 28;

/**
 * Generate slot taxonomy ID
 */
const generateSlotId = (squad, slotNum, dateKey) => {
    const squadInitial = (squad || 'X').charAt(0).toUpperCase();
    const d = new Date(dateKey);
    const fy = d.getMonth() >= 4 ? d.getFullYear() + 1 : d.getFullYear();
    const fyShort = String(fy).slice(-2);
    const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
    return `${squadInitial}${slotNum}FY${fyShort}W${weekNum}`;
};

/**
 * Extract discrete slots from slotMap
 */
const extractDiscreteSlots = (slotMap, dateRange, squad, durationWeeks = 12, slotOptimization = {}) => {
    if (!slotMap?.[squad] || !dateRange?.length) return [];

    const squadData = slotMap[squad];
    const slots = [];
    const consumedSlots = {};
    dateRange.forEach(dk => { consumedSlots[dk] = 0; });

    const todayMs = new Date().setHours(0, 0, 0, 0);
    let slotNum = 1;

    dateRange.forEach((dateKey, colIndex) => {
        const bucket = squadData[dateKey];
        if (!bucket) return;

        const dateMs = new Date(dateKey).getTime();
        if (dateMs < todayMs) return;

        const rawAvailable = bucket.availableSlots || 0;
        const alreadyConsumed = consumedSlots[dateKey] || 0;
        const netAvailable = Math.max(0, rawAvailable - alreadyConsumed);
        const wholeSlots = Math.floor(netAvailable);

        if (wholeSlots < 1) return;

        for (let s = 0; s < wholeSlots; s++) {
            // Reserve this slot's capacity across the next `durationWeeks` columns:
            // a slot started here occupies one unit of availableSlots in every week
            // it spans, so those weeks see reduced netAvailable above and we don't
            // double-count the same engineer capacity for overlapping slots.
            // Cost is O(wholeSlots * durationWeeks) per squad — fine at current sizes;
            // see handover note about hoisting this into the worker (processedData).
            for (let w = 0; w < durationWeeks && colIndex + w < dateRange.length; w++) {
                const futureKey = dateRange[colIndex + w];
                consumedSlots[futureKey] = (consumedSlots[futureKey] || 0) + 1;
            }

            const endColIndex = Math.min(colIndex + durationWeeks - 1, dateRange.length - 1);
            slots.push({
                id: `${squad}-slot-${slotNum}`,
                squad,
                startDateKey: dateKey,
                endDateKey: dateRange[endColIndex],
                startColIndex: colIndex,
                endColIndex,
                slotNum,
                taxonomyId: generateSlotId(squad, slotNum, dateKey),
                score: bucket.score || 0.8,
                bottleneck: bucket.bottleneck,
                // Utilization % is the inverse of availability score
                // Score 0.8+ = OPEN (low utilization), Score <0.4 = FULL (high utilization)
                // Show utilization as: how much of capacity is USED
                utilizationPct: Math.round((1 - (bucket.score || 0.8)) * 100),
                // Also include raw capacity data for tooltips
                capacity: bucket.capacity || {},
                type: 'slot'
            });
            slotNum++;
        }
    });

    // Post-process to mark reserved slots
    if (slotOptimization?.reserveEnabled && slotOptimization?.reservePerMonth > 0) {
        const slotsByMonth = {};
        slots.forEach(slot => {
            const month = slot.startDateKey.substring(0, 7);
            if (!slotsByMonth[month]) slotsByMonth[month] = [];
            slotsByMonth[month].push(slot);
        });

        Object.keys(slotsByMonth).sort().forEach(month => {
            const mSlots = slotsByMonth[month];
            // Sort by date desc (latest first) to take from end of month
            mSlots.sort((a, b) => new Date(b.startDateKey) - new Date(a.startDateKey));

            // Mark top N as reserved
            for (let i = 0; i < slotOptimization.reservePerMonth; i++) {
                if (mSlots[i]) {
                    mSlots[i].isReserved = true;
                }
            }
        });
    }

    return slots;
};

/**
 * Compute forward allocation / backward shortfall for dropping a project
 * spanning `slotsRequired` slots starting at `hoverIndex` within `slots`.
 * Shared by handleDrop and the dragImpact preview so the two stay in sync.
 */
const computeAllocation = (slots, hoverIndex, slotsRequired, maxForwardWeeks) => {
    const hoverSlotStart = new Date(slots[hoverIndex]?.startDateKey);

    let validForwardCount = 1;
    for (let i = 1; i < slotsRequired; i++) {
        const targetIndex = hoverIndex + i;
        if (targetIndex < slots.length) {
            const targetStart = new Date(slots[targetIndex].startDateKey);
            const diffTime = Math.abs(targetStart - hoverSlotStart);
            const diffWeeks = diffTime / (1000 * 60 * 60 * 24 * 7);
            if (diffWeeks <= maxForwardWeeks) {
                validForwardCount++;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    const forwardAllocated = validForwardCount;
    const backwardShortfall = Math.max(0, slotsRequired - forwardAllocated);
    const forwardEndIndex = hoverIndex + forwardAllocated - 1;
    const backwardStartIndex = hoverIndex - backwardShortfall;

    return { forwardAllocated, backwardShortfall, forwardEndIndex, backwardStartIndex };
};

/**
 * Extract projects for a squad within date range
 */
const extractSquadProjects = (projects, dateRange, squad) => {
    if (!projects?.length || !dateRange?.length) return [];

    const startDate = new Date(dateRange[0]);
    const endDate = new Date(dateRange[dateRange.length - 1]);

    return projects
        .filter(p => {
            const pSquads = p.squads || [];
            return pSquads.includes(squad);
        })
        .filter(p => {
            const pStart = p.kickOff || p.start;
            const pEnd = p.launch || p.end;
            if (!pStart && !pEnd) return false;

            const ps = new Date(pStart || pEnd);
            const pe = new Date(pEnd || pStart);

            // Project overlaps with visible range
            return ps <= endDate && pe >= startDate;
        })
        .map(p => {
            const pStart = new Date(p.kickOff || p.start);
            const pEnd = new Date(p.launch || p.end);

            // Find column indices
            let startColIndex = dateRange.findIndex(dk => new Date(dk) >= pStart);
            if (startColIndex < 0) startColIndex = 0;

            let endColIndex = dateRange.findIndex(dk => new Date(dk) > pEnd);
            if (endColIndex < 0) endColIndex = dateRange.length - 1;
            else endColIndex = Math.max(0, endColIndex - 1);

            // Calculate project duration in weeks
            const projectDurationMs = pEnd.getTime() - pStart.getTime();
            const projectDurationWeeks = Math.round(projectDurationMs / (7 * 24 * 60 * 60 * 1000));
            // Standard slot duration (default 12 weeks)
            const slotDurationWeeks = 12; // Could be passed from slotProfile
            // Idle weeks = slot duration - project duration (if project is shorter)
            const idleWeeks = projectDurationWeeks < slotDurationWeeks
                ? slotDurationWeeks - projectDurationWeeks
                : 0;

            return {
                id: p.id,
                name: p.name,
                customer: p.customer,
                squad,
                startDateKey: dateRange[startColIndex],
                endDateKey: dateRange[endColIndex],
                startColIndex,
                endColIndex,
                team: p.team,
                status: p.status,
                countryFlag: p.countryFlag,
                kickOff: p.kickOff || p.start,
                launch: p.launch || p.end,
                idleWeeks, // Capacity waste metric
                projectDurationWeeks, // For display
                type: 'project'
            };
        });
};

const SlotGanttView = ({
    slotMap,
    dateScaffold,
    slotProfile,
    enabledSquads = [],
    projects = [],
    draggedProject = null,
    columnWidth = 50,
    onSlotDrop = null,
    onProjectClick = null,
    viewMode,
    globalExpand,
    slotOptimization = {}, // Accept slotOptimization settings
    mergeSquads = false // Squad Merging Experiment
}) => {
    const { isDark, colors } = useTheme();
    const [expandedSquads, setExpandedSquads] = useState({});
    const [dragOverSlot, setDragOverSlot] = useState(null);

    const durationWeeks = slotProfile?.durationWeeks || 12;
    const slotHours = (slotProfile?.pmHours || 40) + (slotProfile?.scHours || 120) + (slotProfile?.buildHours || 80);

    const dateRange = useMemo(() => {
        return (dateScaffold || []).map(d => d.isoKey).filter(Boolean);
    }, [dateScaffold]);

    // Build squad data with slots and projects
    const squadData = useMemo(() => {
        const rawData = (enabledSquads || []).map(squad => {
            const slots = extractDiscreteSlots(slotMap, dateRange, squad, durationWeeks, slotOptimization);
            const squadProjects = extractSquadProjects(projects, dateRange, squad);
            return { squad, slots, projects: squadProjects };
        }).filter(sq => sq.slots.length > 0 || sq.projects.length > 0);

        if (mergeSquads && rawData.length > 1) {
            // POOLED CAPACITY CALCULATION:
            // Instead of just concatenating pre-calculated slots from each squad,
            // we must aggregate the raw capacity (availableSlots) FIRST, then extract slots.
            // This allows fractional capacity from different squads to combine into whole slots.

            // 1. Create a merged slotMap
            const mergedSlotMap = { 'Merged View': {} };

            dateRange.forEach(dateKey => {
                let totalAvailable = 0;
                let weightedScoreNum = 0;
                let weightedScoreDenom = 0;

                (enabledSquads || []).forEach(squad => {
                    const bucket = slotMap?.[squad]?.[dateKey];
                    if (bucket) {
                        totalAvailable += (bucket.availableSlots || 0);
                        // Simple weighted score based on availability
                        if (bucket.score !== undefined) {
                            weightedScoreNum += (bucket.score * (bucket.availableSlots || 1));
                            weightedScoreDenom += (bucket.availableSlots || 1);
                        }
                    }
                });

                mergedSlotMap['Merged View'][dateKey] = {
                    availableSlots: totalAvailable,
                    score: weightedScoreDenom > 0 ? (weightedScoreNum / weightedScoreDenom) : 0.8,
                    // We don't merge IDs, we'll generate new ones
                    slotIds: []
                };
            });

            // 2. Extract slots from the merged map
            // Use 'Merged View' as the squad name so slots get IDs like 'M1FY24W12'
            const pooledSlots = extractDiscreteSlots(mergedSlotMap, dateRange, 'Merged View', durationWeeks, slotOptimization);

            // 3. Map slots to include originalSquad metadata (which is just 'Merged View' here)
            // But we can try to "assign" them back to original squads? No, they are pooled.
            // When dropping, we need to decide where it goes. 
            // The Drop Handler in Dashboard currently looks at `slot.originalSquad || slot.squad`.
            // If I drop on a 'Merged View' slot, `squad` becomes 'Merged View'. 
            // `handleAssignProject` generates an ID based on that squad.
            // It might create a project assigned to 'Merged View' squad.
            // We probably want to assign it to one of the *actual* selected squads.
            // Let's add a `targetSquads` property to the slot so UI can offer a choice?
            // For this phase, let's assume 'Merged View' assignments might happen and user changes it later.

            const mergedSlots = pooledSlots.map(s => ({
                ...s,
                originalSquad: 'Merged View', // It's a pooled slot!
                isPooled: true
            }));

            // 4. Aggregate Projects (these retain their original squad)
            const allProjects = rawData.flatMap(sq => sq.projects).map(p => ({
                ...p,
                originalSquad: p.squad,
                squad: 'Merged View'
            }));

            return [{
                squad: 'Merged View',
                slots: mergedSlots,
                projects: allProjects,
                isMerged: true
            }];
        }

        return rawData;
    }, [slotMap, enabledSquads, dateRange, durationWeeks, projects, slotOptimization, mergeSquads]);

    // Bulk expand/collapse: only fire when the parent's globalExpand toggle changes,
    // so we don't clobber the user's manual per-squad expand/collapse every time
    // squadData is recomputed (e.g. on drag, prop changes, etc.).
    useEffect(() => {
        setExpandedSquads(prev => {
            const next = { ...prev };
            (squadData || []).forEach(s => { next[s.squad] = globalExpand; });
            return next;
        });
        // Intentionally depends on globalExpand only — see comment above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalExpand]);

    // Initialise expand state for any newly-appeared squads (default expanded)
    // without resetting squads the user has already toggled.
    useEffect(() => {
        setExpandedSquads(prev => {
            let changed = false;
            const next = { ...prev };
            (squadData || []).forEach(s => {
                if (next[s.squad] === undefined) {
                    next[s.squad] = globalExpand;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [squadData]);

    // Calculate slots required for dragged project (using prop from parent)
    const draggedProjectInfo = useMemo(() => {
        if (!draggedProject) return null;

        const totalEffort = ((draggedProject.pmVal || 0) + (draggedProject.scVal || 0) + (draggedProject.pdVal || 0)) / 3600;
        const slotsRequired = Math.ceil(totalEffort / slotHours) || 1;
        return { project: draggedProject, slotsRequired, totalEffort };
    }, [draggedProject, slotHours]);

    const toggleSquad = (squad) => {
        setExpandedSquads(prev => ({
            ...prev,
            [squad]: !prev[squad]
        }));
    };

    const expandAll = () => {
        const newExpandedState = {};
        squadData.forEach(s => newExpandedState[s.squad] = true);
        setExpandedSquads(newExpandedState);
    };
    const collapseAll = () => {
        const newExpandedState = {};
        squadData.forEach(s => newExpandedState[s.squad] = false);
        setExpandedSquads(newExpandedState);
    };

    const handleDragOver = (e, slotId, squad) => {
        e.preventDefault();
        // The actual project payload (projectId/text/plain) is only readable in the
        // drop handler; here we rely on the draggedProject prop for the hover preview.
        setDragOverSlot({ slotId, squad });
    };

    const handleDragLeave = () => {
        setDragOverSlot(null);
    };

    const handleDrop = (e, slot, squadSlots) => {
        e.preventDefault();
        setDragOverSlot(null);
        // Try both projectId and text/plain keys
        const projectId = e.dataTransfer.getData('projectId') || e.dataTransfer.getData('text/plain');

        if (projectId && onSlotDrop) {
            // Merged-view slots are a pooled aggregate carrying squad='Merged View'.
            // Assigning from one would hand that phantom squad to handleAssignProject and
            // create a project on a non-existent 'Merged View' squad. Block it and tell the
            // user to turn off Merge Squads to assign to a real squad.
            if (slot.squad === 'Merged View' || slot.originalSquad === 'Merged View') {
                alert('Turn off "Merge Squads" to assign a project — the merged view is a pooled overview with no real squad to assign to.');
                return;
            }
            // Calculate shortfall info
            const project = projects.find(p => p.id === projectId);
            const totalEffort = project ? ((project.pmVal || 0) + (project.scVal || 0) + (project.pdVal || 0)) / 3600 : 0;
            const slotsRequired = Math.ceil(totalEffort / slotHours) || 1;
            const slotIndex = squadSlots.findIndex(s => s.id === slot.id);

            // Time-based constraint logic (matches render loop / dragImpact preview)
            const maxForwardWeeks = slotOptimization?.maxForwardWeeks !== undefined ? slotOptimization.maxForwardWeeks : 4;
            const { forwardAllocated, backwardShortfall } = computeAllocation(squadSlots, slotIndex, slotsRequired, maxForwardWeeks);

            // Available is just what we found valid forward
            const availableSlots = forwardAllocated;

            onSlotDrop(projectId, {
                ...slot,
                slotsRequired,
                shortfall: backwardShortfall, // Passed as shortfall to trigger modal "Backward Extension"
                availableSlots
            });
        }
    };

    const chartWidth = SIDEBAR_WIDTH + (dateRange.length * columnWidth);

    if (!squadData.length) {
        return (
            <div style={{
                padding: '24px',
                textAlign: 'center',
                color: colors.textMuted,
                fontSize: '13px',
                backgroundColor: colors.bgAlt,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`
            }}>
                No slot or project data available.
            </div>
        );
    }

    // Calculate active drag impact to determine highlighting and ghost slots
    const dragImpact = useMemo(() => {
        if (!dragOverSlot || !draggedProjectInfo) return null;

        const { squad, slotId } = dragOverSlot;
        const squadEntry = squadData.find(s => s.squad === squad);
        if (!squadEntry) return null;

        const slots = squadEntry.slots;
        const hoverIndex = slots.findIndex(s => s.id === slotId);
        if (hoverIndex === -1) return null;

        const { slotsRequired } = draggedProjectInfo;
        const maxForwardWeeks = slotOptimization?.maxForwardWeeks !== undefined ? slotOptimization.maxForwardWeeks : 4;

        const { backwardShortfall, forwardEndIndex, backwardStartIndex } =
            computeAllocation(slots, hoverIndex, slotsRequired, maxForwardWeeks);

        // Determine how many "ghost" slots we need (if backward extension goes off the top)
        const ghostCount = backwardStartIndex < 0 ? Math.abs(backwardStartIndex) : 0;

        return {
            squad,
            hoverIndex, // The slot we are hovering
            forwardEndIndex,
            backwardStartIndex, // Can be negative
            ghostCount,
            backwardShortfall
        };
    }, [dragOverSlot, draggedProjectInfo, squadData, slotOptimization]);

    // Build flat row list with ghost slots injected
    const rows = [];
    squadData.forEach((sq, sqIdx) => {
        const isExpanded = expandedSquads[sq.squad] ?? true;
        rows.push({ type: 'header', squad: sq.squad, slotCount: sq.slots.length, projectCount: sq.projects.length, isExpanded, sqIdx });

        if (isExpanded) {
            // Interleave slots and projects
            sq.slots.forEach((slot, slotIdx) => {
                rows.push(slot);

                // If this is the hover target and we need ghost slots, inject them AFTER to prevent layout shift
                if (dragImpact && dragImpact.squad === sq.squad && dragImpact.ghostCount > 0 && slotIdx === dragImpact.hoverIndex) {
                    for (let g = 0; g < dragImpact.ghostCount; g++) {
                        rows.push({
                            type: 'ghost',
                            id: `ghost-${sq.squad}-${g}`,
                            squad: sq.squad,
                            startColIndex: slot.startColIndex, // Align with target
                            endColIndex: slot.endColIndex,
                            taxonomyId: `NEW SLOT`, // Placeholder ID
                            startDateKey: slot.startDateKey
                        });
                    }
                }
            });
            sq.projects.forEach(proj => rows.push(proj));
        }
    });

    // Post-process rows to identify group boundaries for the "visual box"
    // We do this here because ghosts make index calculation tricky otherwise
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.type !== 'slot' && row.type !== 'ghost') continue;

        let isInGroup = false;

        if (row.type === 'ghost') {
            isInGroup = true;
        } else if (row.type === 'slot' && dragImpact && dragImpact.squad === row.squad) {
            const currentSquadData = squadData.find(s => s.squad === row.squad);
            const squadSlots = currentSquadData?.slots || [];
            const slotIndex = squadSlots.findIndex(s => s.id === row.id);

            if (slotIndex >= dragImpact.backwardStartIndex && slotIndex <= dragImpact.forwardEndIndex) {
                isInGroup = true;
            }
        }

        if (isInGroup) {
            row.inDragGroup = true;

            // Check previous
            const prev = rows[i - 1];
            let prevInGroup = false;
            if (prev && (prev.type === 'slot' || prev.type === 'ghost')) {
                if (prev.type === 'ghost') prevInGroup = true;
                else if (prev.type === 'slot' && dragImpact && dragImpact.squad === prev.squad) {
                    const psd = squadData.find(s => s.squad === prev.squad);
                    const pss = psd?.slots || [];
                    const psi = pss.findIndex(s => s.id === prev.id);
                    if (psi >= dragImpact.backwardStartIndex && psi <= dragImpact.forwardEndIndex) prevInGroup = true;
                }
            }
            row.isGroupTop = !prevInGroup;

            // Check next
            const next = rows[i + 1];
            let nextInGroup = false;
            if (next && (next.type === 'slot' || next.type === 'ghost')) {
                if (next.type === 'ghost') nextInGroup = true;
                else if (next.type === 'slot' && dragImpact && dragImpact.squad === next.squad) {
                    const nsd = squadData.find(s => s.squad === next.squad);
                    const nss = nsd?.slots || [];
                    const nsi = nss.findIndex(s => s.id === next.id);
                    if (nsi >= dragImpact.backwardStartIndex && nsi <= dragImpact.forwardEndIndex) nextInGroup = true;
                }
            }
            row.isGroupBottom = !nextInGroup;
        }
    }

    return (
        <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            backgroundColor: colors.bgAlt,
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
            width: '100%'
        }}>
            {/* Timeline Header with expand/collapse all */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                gap: '12px'
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4794FF" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <rect x="4" y="10" width="12" height="2" rx="1" fill="#4794FF" />
                    <rect x="8" y="14" width="10" height="2" rx="1" fill="#4794FF" />
                    <rect x="6" y="18" width="14" height="2" rx="1" fill="#4794FF" />
                </svg>
                <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                    Timeline View
                </span>
                <span style={{
                    fontSize: '10px',
                    color: 'white',
                    backgroundColor: '#4794FF',
                    padding: '2px 6px',
                    borderRadius: '4px'
                }}>
                    {squadData.reduce((sum, s) => sum + s.slots.length, 0)} slots
                </span>

                {/* Expand/Collapse All Buttons */}
                <div style={{ marginLeft: 'auto', display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                    <button
                        onClick={expandAll}
                        title="Expand all squads"
                        style={{
                            width: '28px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            borderRight: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            color: '#4794FF',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        +
                    </button>
                    <button
                        onClick={collapseAll}
                        title="Collapse all squads"
                        style={{
                            width: '28px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            color: '#4794FF',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        −
                    </button>
                </div>
            </div>

            {/* Header - Sticky */}
            <div style={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: isDark ? '#0f172a' : 'white',
                borderBottom: `1px solid ${colors.border}`
            }}>
                <div style={{
                    width: SIDEBAR_WIDTH,
                    minWidth: SIDEBAR_WIDTH,
                    height: HEADER_HEIGHT,
                    borderRight: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    backgroundColor: isDark ? '#0f172a' : 'white', // Ensure opaque background
                    zIndex: 11 // Higher than date cells
                }}>
                    Squad / Slot
                </div>
                <div style={{ display: 'flex' }}>
                    {dateRange.map((dk, idx) => (
                        <div key={dk} style={{
                            width: columnWidth,
                            minWidth: columnWidth,
                            height: HEADER_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            color: colors.textMuted,
                            borderRight: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`
                        }}>
                            {new Date(dk).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Rows */}
            {rows.map((row, idx) => {
                // Should retrieve squadSlots here for usage in handlers
                const rowSquadData = squadData.find(s => s.squad === row.squad);
                const squadSlots = rowSquadData?.slots || [];

                if (row.type === 'header') {
                    return (
                        <div key={`h-${row.squad}`} style={{ display: 'flex', borderTop: row.sqIdx > 0 ? `1px solid ${colors.border}` : 'none' }}>
                            <div
                                onClick={() => toggleSquad(row.squad)}
                                style={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 4,
                                    width: SIDEBAR_WIDTH,
                                    minWidth: SIDEBAR_WIDTH,
                                    height: HEADER_HEIGHT,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <span style={{ fontSize: '9px', color: colors.textMuted, transition: 'transform 0.15s', transform: row.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.squad}
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: 'white', backgroundColor: '#00BD00', padding: '1px 5px', borderRadius: '3px' }}>{row.slotCount}</span>
                                {row.projectCount > 0 && (
                                    <span style={{ fontSize: '9px', fontWeight: '700', color: 'white', backgroundColor: '#4794FF', padding: '1px 5px', borderRadius: '3px' }}>{row.projectCount}</span>
                                )}
                            </div>
                            <div style={{ flex: 1, height: HEADER_HEIGHT, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                        </div>
                    );
                }

                // Slot or Project row
                const left = row.startColIndex * columnWidth;
                const width = Math.max((row.endColIndex - row.startColIndex + 1) * columnWidth - 4, columnWidth - 4);
                const isSlot = row.type === 'slot';
                const isGhost = row.type === 'ghost';

                // Grouping Logic - Handled in pre-process, read props
                const isInDragGroup = row.inDragGroup;

                const isDragTarget = isSlot && dragOverSlot?.slotId === row.id;

                let barColor, barBg, barBorder;
                let containerStyle = {};

                if (isSlot || isGhost) {
                    const score = row.score || 0.8;
                    barColor = score >= 0.8 ? '#00BD00' : score >= 0.5 ? '#FE9922' : '#E5554F';

                    if (isGhost) {
                        barColor = '#E5554F';
                        barBg = 'transparent';
                        barBorder = '2px dashed #E5554F';
                    } else if (row.isReserved) {
                        barColor = '#FF8EFB'; // Purple for reserved
                        barBg = isDark ? 'rgba(0, 189, 0, 0.15)' : 'rgba(0, 189, 0, 0.1)';
                        barBorder = `1px dashed ${isDark ? '#FF8EFB' : '#86efac'}`;
                    } else if (isInDragGroup) {
                        // Drag group styling
                        barBg = isDragTarget ? '#00BD00' : '#00BD00';
                        // Borders handled by container, but we might want individual borders too?
                        // Let's keep individual slot borders simple or removed to emphasize the group box
                        barBorder = '1px solid #00BD00';
                    } else {
                        barBg = barColor;
                        barBorder = 'none';
                    }

                    // Group Box Styling (Container)
                    if (isInDragGroup) {
                        const boxColor = '#082F24'; // Indigo for group
                        containerStyle = {
                            borderLeft: `2px dashed ${boxColor}`,
                            borderRight: `2px dashed ${boxColor}`,
                            borderTop: row.isGroupTop ? `2px dashed ${boxColor}` : 'none',
                            borderBottom: row.isGroupBottom ? `2px dashed ${boxColor}` : 'none',
                            backgroundColor: 'rgba(8, 47, 36, 0.05)', // Faint tint
                        };
                    }
                } else {
                    // Project
                    barColor = '#4794FF';
                    barBg = '#4794FF';
                    barBorder = 'none';
                }

                return (
                    <div key={row.id} style={{ display: 'flex', borderTop: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`, ...containerStyle }}>
                        {/* Sticky label */}
                        <div style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 3,
                            width: SIDEBAR_WIDTH,
                            minWidth: SIDEBAR_WIDTH,
                            height: ROW_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 10px',
                            gap: '6px',
                            backgroundColor: isDark ? '#0f172a' : 'white',
                            borderRight: `1px solid ${colors.border}`
                        }}>
                            {isSlot ? (
                                <>
                                    <span style={{
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        color: 'white',
                                        backgroundColor: barColor,
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {row.taxonomyId}
                                        <span style={{ fontSize: '8px', opacity: 0.8, fontWeight: '500' }}>
                                            {new Date(row.startDateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(row.endDateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </span>
                                    <span style={{ fontSize: '9px', color: colors.textMuted }}>
                                        {new Date(row.startDateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        color: colors.textPrimary,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1
                                    }}>
                                        {row.name}
                                    </span>
                                    {/* Staffing dots */}
                                    <span style={{ display: 'flex', gap: '2px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.team?.pm?.length ? '#00BD00' : '#E5554F' }} />
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.team?.sc?.length ? '#00BD00' : '#E5554F' }} />
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.team?.pd?.length ? '#00BD00' : '#E5554F' }} />
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Timeline bar with week grid lines */}
                        <div style={{ position: 'relative', height: ROW_HEIGHT, flex: 1, display: 'flex' }}>
                            {/* Week delineation lines */}
                            {dateRange.map((dk, colIdx) => (
                                <div key={dk} style={{
                                    width: columnWidth,
                                    minWidth: columnWidth,
                                    height: '100%',
                                    borderRight: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.6)'}`,
                                    boxSizing: 'border-box'
                                }} />
                            ))}
                            {/* The actual bar */}
                            <div
                                onClick={!isSlot && onProjectClick ? () => onProjectClick({ id: row.id, name: row.name }) : undefined}
                                onDragOver={isSlot ? (e) => handleDragOver(e, row.id, row.squad) : undefined}
                                onDragLeave={isSlot ? handleDragLeave : undefined}
                                onDrop={isSlot ? (e) => handleDrop(e, row, squadSlots) : undefined}
                                style={{
                                    position: 'absolute',
                                    left: left + 2,
                                    top: 4,
                                    width: width,
                                    height: ROW_HEIGHT - 8,
                                    backgroundColor: barBg,
                                    border: barBorder,
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    paddingLeft: '8px',
                                    paddingRight: '8px',
                                    color: 'white',
                                    fontSize: '9px',
                                    fontWeight: '600',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    cursor: isSlot ? 'default' : 'pointer',
                                    transition: 'all 0.15s',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                {isSlot ? (
                                    isDragTarget ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            Drop here
                                        </span>
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                            {width > 60 && <span>{row.taxonomyId}</span>}
                                            {/* Utilization % badge */}
                                            {width > 100 && row.utilizationPct !== undefined && (
                                                <span style={{
                                                    fontSize: '8px',
                                                    padding: '1px 4px',
                                                    backgroundColor: row.utilizationPct > 80 ? 'rgba(239,68,68,0.3)' : row.utilizationPct > 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)',
                                                    borderRadius: '3px',
                                                    marginLeft: 'auto'
                                                }}>
                                                    {row.utilizationPct}%
                                                </span>
                                            )}
                                        </span>
                                    )
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', width: '100%' }}>
                                        {/* Country flag if available (render as image since it's a URL) */}
                                        {row.countryFlag && (
                                            <img
                                                src={row.countryFlag}
                                                alt=""
                                                style={{
                                                    width: '16px',
                                                    height: '12px',
                                                    objectFit: 'cover',
                                                    borderRadius: '2px',
                                                    flexShrink: 0
                                                }}
                                            />
                                        )}
                                        {/* Project name */}
                                        <span style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            minWidth: 0
                                        }}>
                                            {row.name}{width > 150 && row.customer ? ` • ${row.customer}` : ''}
                                        </span>
                                        {/* Idle weeks badge (capacity waste) */}
                                        {row.idleWeeks > 0 && width > 120 && (
                                            <span style={{
                                                fontSize: '8px',
                                                padding: '1px 4px',
                                                backgroundColor: 'rgba(245,158,11,0.3)',
                                                color: '#FE9922',
                                                borderRadius: '3px',
                                                fontWeight: '600',
                                                flexShrink: 0
                                            }}>
                                                {row.idleWeeks}w idle
                                            </span>
                                        )}
                                        {/* Date pills - show when bar is wide enough */}
                                        {width > 200 && (
                                            <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                {row.kickOff && (
                                                    <span style={{
                                                        fontSize: '8px',
                                                        padding: '2px 5px',
                                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                                        borderRadius: '3px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                                                            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                                                        </svg>
                                                        {new Date(row.kickOff).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                                {row.launch && (
                                                    <span style={{
                                                        fontSize: '8px',
                                                        padding: '2px 5px',
                                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                                        borderRadius: '3px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                                            <line x1="4" x2="4" y1="22" y2="15" />
                                                        </svg>
                                                        {new Date(row.launch).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SlotGanttView;
