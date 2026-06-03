/**
 * SlotHeatmap - Slot Availability Visualization
 * Shows delivery slot availability across squads and time periods
 */
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../design-system';
import { getSlotUtilizationSummary, generateRoleInsights } from '../../utils/SlotOptimizer';
import { SlotSnapshotPanel } from './SlotSnapshotPanel';
import SlotGanttView from './SlotGanttView';
import SlotAssignmentModal from '../modals/SlotAssignmentModal';

/**
 * Get color for slot score (0-1)
 * Green = OPEN (0.8+), Yellow = PARTIAL (0.4-0.8), Red = FULL (<0.4)
 */
const getSlotColor = (score, isDark) => {
    if (score >= 0.8) return isDark ? '#00BD00' : '#00BD00'; // Green - Open
    if (score >= 0.4) return isDark ? '#eab308' : '#ca8a04'; // Yellow - Partial
    return isDark ? '#ef4444' : '#dc2626'; // Red - Full
};

const getSlotBg = (score, isDark) => {
    if (score >= 0.8) return isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(22, 163, 74, 0.1)';
    if (score >= 0.4) return isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(202, 138, 4, 0.1)';
    return isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.1)';
};

/**
 * Bottleneck badge colors
 */
const bottleneckColors = {
    PM: { bg: '#BD65FF', text: 'white' },
    SC: { bg: '#3b82f6', text: 'white' },
    Build: { bg: '#00BD00', text: 'white' }
};

/**
 * Single slot cell component
 */
const SlotCell = ({ data, dateKey, isDark }) => {
    if (!data) {
        return (
            <div style={{
                padding: '8px',
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderRadius: '6px',
                textAlign: 'center',
                color: isDark ? '#475569' : '#94a3b8',
                fontSize: '10px'
            }}>
                —
            </div>
        );
    }

    const { score, state, availableSlots, bottleneck } = data;
    const color = getSlotColor(score, isDark);
    const bg = getSlotBg(score, isDark);
    const bottleneckStyle = bottleneck ? bottleneckColors[bottleneck] : null;

    return (
        <div style={{
            padding: '8px 10px',
            backgroundColor: bg,
            borderRadius: '8px',
            border: `1px solid ${color}20`,
            textAlign: 'center',
            minWidth: '70px',
            transition: 'all 0.2s'
        }}>
            {/* Slot count */}
            <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color,
                lineHeight: 1.2
            }}>
                {(Math.floor((Number(availableSlots) || 0) * 4) / 4).toFixed(2).replace(/\.00$/, '')}
            </div>

            {/* State badge */}
            <div style={{
                fontSize: '9px',
                fontWeight: '600',
                color: isDark ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '2px'
            }}>
                {state}
            </div>

            {/* Bottleneck indicator */}
            {bottleneck && state !== 'OPEN' && (
                <div style={{
                    marginTop: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    backgroundColor: bottleneckStyle?.bg || '#64748b',
                    color: bottleneckStyle?.text || 'white',
                    borderRadius: '4px',
                    fontSize: '8px',
                    fontWeight: '700',
                    letterSpacing: '0.02em'
                }}>
                    <svg style={{ width: '8px', height: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {bottleneck}
                </div>
            )}
        </div>
    );
};

/**
 * Main SlotHeatmap component
 */
export const SlotHeatmap = ({
    slotMap,
    dateScaffold,
    slotProfile,
    enabledSquads = [],
    projects = [],
    allProjects = [], // Full project list for Copy Resourcing
    resources = [], // All resources with availability data
    slotOptimization = {},
    roleConfig = {},
    onGenerateAIInsights = null,
    aiEnabled = false,
    onSaveAsDraft = null,
    allGroupsExpanded = false,
    onOptimize = null,
    onAssignProject = null,
    onProjectClick = null,
    mergeSquads = false // Squad Merging Experiment
}) => {
    const { isDark, colors } = useTheme();
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewOffset, setViewOffset] = useState(0); // Weeks offset from today
    const [weeksVisible, setWeeksVisible] = useState(12); // How many weeks to show at once
    const [dragOverCell, setDragOverCell] = useState(null); // { squad, dateKey } for visual feedback
    const [pendingDrop, setPendingDrop] = useState(null); // { projectId, squad, dateKey, projectName } for confirmation
    const [focusedCell, setFocusedCell] = useState(null); // { squadIdx, dateIdx } for keyboard navigation
    const [selectedSlot, setSelectedSlot] = useState(null); // { squad, dateKey, data } for detail modal
    const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' | 'gantt'
    const [draggedProject, setDraggedProject] = useState(null); // Project object being dragged for Gantt multi-slot highlight
    const [dragPreviewPosition, setDragPreviewPosition] = useState({ x: 0, y: 0 }); // QoL: Position for drag preview tooltip
    // Unresourced projects filters
    const [sidebarYearFilter, setSidebarYearFilter] = useState('');
    const [sidebarCustomerFilter, setSidebarCustomerFilter] = useState('');
    const [sidebarSquadFilter, setSidebarSquadFilter] = useState('');
    // Shift-click range selection state
    const [selectedProjects, setSelectedProjects] = useState(new Set());
    const [lastClickedIndex, setLastClickedIndex] = useState(null);
    const gridRef = React.useRef(null);

    // Destructure recommendations from slotOptimization
    const { recommendations = [] } = slotOptimization || {};

    // POOLED VIEW: Logic moved inside useMemo to support merging
    // We also need the "raw" list of enabled squads for SlotGanttView to do its own merging logic
    const rawSquads = useMemo(() => {
        const allSquads = Object.keys(slotMap || {}).sort();
        if (enabledSquads && enabledSquads.length > 0) {
            return allSquads.filter(s => enabledSquads.includes(s));
        }
        return allSquads;
    }, [slotMap, enabledSquads]);

    const squads = useMemo(() => {
        if (mergeSquads && enabledSquads && enabledSquads.length > 1) {
            return ['Merged View'];
        }
        return rawSquads;
    }, [mergeSquads, enabledSquads, rawSquads]);

    // Calculate aggregated data for Merged View
    const mergedSlotMap = useMemo(() => {
        if (!mergeSquads || !enabledSquads || enabledSquads.length <= 1) return null;

        const mergedMap = { 'Merged View': {} };
        const allDates = new Set();
        (enabledSquads || []).forEach(s => {
            if (slotMap?.[s]) {
                Object.keys(slotMap[s]).forEach(d => allDates.add(d));
            }
        });

        allDates.forEach(dateKey => {
            let totalAvailable = 0;
            let weightedScoreNum = 0;
            let weightedScoreDenom = 0;
            let statePriority = 0; // 0=OPEN, 1=PARTIAL, 2=FULL (worst case wins?) or average?
            // "Open" is best. Let's assume we sum capacity.
            // If sum capacity >= 1.0 (or threshold), it's OPEN?
            // Let's rely on capacity sum.

            (enabledSquads || []).forEach(squad => {
                const bucket = slotMap?.[squad]?.[dateKey];
                if (bucket) {
                    totalAvailable += (bucket.availableSlots || 0);
                    if (bucket.score !== undefined) {
                        weightedScoreNum += (bucket.score * (bucket.availableSlots || 1));
                        weightedScoreDenom += (bucket.availableSlots || 1);
                    }
                }
            });

            // Re-calculate state based on total available
            // Assuming 1 slot = OPEN? 
            // In original logic: <0.4 = FULL, <0.8 = PARTIAL, >=0.8 = OPEN
            // Score usually comes from (available / max_capacity).
            // But here we are summing RAW available slots.
            // If we have 2.2 slots available, that is very OPEN.
            // Let's derive a synthetic score.
            // If totalAvailable >= 1.0 -> OPEN (score 1.0)
            // If totalAvailable > 0 -> PARTIAL (score 0.5)
            // If totalAvailable <= 0 -> FULL (score 0.0)
            // OR we use the weighted average score. 
            // Weighted average score is better for "utilization" feel.

            const avgScore = weightedScoreDenom > 0 ? (weightedScoreNum / weightedScoreDenom) : 0;

            // Override state text
            let state = 'FULL';
            if (totalAvailable >= 1.0) state = 'OPEN';
            else if (totalAvailable > 0) state = 'PARTIAL';

            mergedMap['Merged View'][dateKey] = {
                availableSlots: totalAvailable,
                score: avgScore, // Use weighted average for color
                state: state,
                bottleneck: null // Complex to merge bottlenecks, ignore for now
            };
        });
        return mergedMap;
    }, [slotMap, enabledSquads, mergeSquads]);

    // Effective SlotMap to use for rendering
    const effectiveSlotMap = mergeSquads && mergedSlotMap ? mergedSlotMap : slotMap;

    // Get all future dates for the 2-year planning horizon
    const allFutureDates = useMemo(() => {
        if (!dateScaffold) return [];
        const today = Date.now();
        return dateScaffold
            .filter(d => d.rawDate >= today - 7 * 24 * 60 * 60 * 1000)
            .slice(0, 104);
    }, [dateScaffold]);

    // Get visible dates based on slider position
    const visibleDates = useMemo(() => {
        return allFutureDates.slice(viewOffset, viewOffset + weeksVisible);
    }, [allFutureDates, viewOffset, weeksVisible]);

    // Max offset for the slider
    const maxOffset = Math.max(0, allFutureDates.length - weeksVisible);

    // Filter unresourced projects for sidebar with staffing status
    const unresourcedProjects = useMemo(() => {
        if (!projects) return [];
        // Build derived shapes instead of mutating the project objects passed via
        // props (those are shared with useCapacityData/worker output). Use reduce so
        // we can both filter and attach derived fields in a single pass.
        return projects.reduce((acc, p) => {
            // Check if squad is unassigned/empty
            const hasSquad = p.squads && p.squads.length > 0 && p.squads[0] !== 'Unassigned';
            // Check if project is closed/cancelled
            const isClosed = (p.status || '').toLowerCase().match(/closed|cancelled|completed/);
            // Check if project has scheduled dates in the grid
            const hasDates = p.kickOff || p.start || p.launch || p.end;
            // Check if project has team members assigned per role
            const hasPM = p.team?.pm?.length > 0;
            const hasSC = p.team?.sc?.length > 0;
            const hasPD = p.team?.pd?.length > 0;
            const hasTeam = hasPM || hasSC || hasPD;

            // Calculate staffing status:
            // FULLY_STAFFED: Has squad + dates + all roles filled
            // PARTIAL: Has squad and/or dates but missing some roles
            // UNASSIGNED: No squad, no dates, no team
            let staffingStatus = 'UNASSIGNED';
            const rolesFilled = [hasPM, hasSC, hasPD].filter(Boolean).length;

            if (hasSquad && hasDates && rolesFilled === 3) {
                staffingStatus = 'FULLY_STAFFED';
            } else if (hasSquad || hasDates || hasTeam) {
                staffingStatus = 'PARTIAL';
            }

            // Unresourced = anything that's not FULLY_STAFFED
            const isResourced = staffingStatus === 'FULLY_STAFFED';

            if (!isResourced && !isClosed) {
                // Return a copy with derived display fields attached (never mutate p.*).
                acc.push({ ...p, staffingStatus, rolesFilled });
            }
            return acc;
        }, []);
    }, [projects]);

    // Calculate filter options from unresourced projects
    const sidebarFilterOptions = useMemo(() => {
        const years = new Set();
        const customers = new Set();
        const squads = new Set();

        unresourcedProjects.forEach(p => {
            // Extract year from kickOff
            if (p.kickOff || p.start) {
                const date = new Date(p.kickOff || p.start);
                if (!isNaN(date.getTime())) years.add(date.getFullYear());
            }
            // Customer
            if (p.customer) customers.add(p.customer);
            // Squad
            const squad = (p.squads && p.squads.length > 0 && p.squads[0] !== 'Unassigned') ? p.squads[0] : 'Unassigned';
            squads.add(squad);
        });

        return {
            years: Array.from(years).sort((a, b) => a - b),
            customers: Array.from(customers).sort(),
            squads: Array.from(squads).sort((a, b) => {
                if (a === 'Unassigned') return 1;
                if (b === 'Unassigned') return -1;
                return a.localeCompare(b);
            })
        };
    }, [unresourcedProjects]);

    // Filter unresourced projects based on sidebar filters
    const filteredUnresourcedProjects = useMemo(() => {
        return unresourcedProjects.filter(p => {
            // Year filter
            if (sidebarYearFilter) {
                const date = p.kickOff || p.start;
                if (!date) return false;
                const year = new Date(date).getFullYear();
                if (year !== parseInt(sidebarYearFilter)) return false;
            }
            // Customer filter
            if (sidebarCustomerFilter && p.customer !== sidebarCustomerFilter) return false;
            // Squad filter
            if (sidebarSquadFilter) {
                const squad = (p.squads && p.squads.length > 0 && p.squads[0] !== 'Unassigned') ? p.squads[0] : 'Unassigned';
                if (squad !== sidebarSquadFilter) return false;
            }
            return true;
        });
    }, [unresourcedProjects, sidebarYearFilter, sidebarCustomerFilter, sidebarSquadFilter]);

    // Calculate utilization summary for AI insights
    const summary = useMemo(() => {
        return getSlotUtilizationSummary(slotMap, enabledSquads);
    }, [slotMap, enabledSquads]);

    // Calculate role insights
    const roleInsights = useMemo(() => {
        return generateRoleInsights(slotMap, roleConfig);
    }, [slotMap, roleConfig]);

    // Drag and Drop Handlers
    const handleDragStart = (e, projectId) => {
        e.dataTransfer.setData('text/plain', projectId);
        e.dataTransfer.setData('projectId', projectId); // For Gantt view detection
        e.dataTransfer.effectAllowed = 'move';
        // Set dragged project for Gantt multi-slot highlighting
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setDraggedProject(project);
            setDragPreviewPosition({ x: e.clientX, y: e.clientY });
            // QoL: Track mouse movement during drag for preview tooltip
            const handleMouseMove = (ev) => {
                setDragPreviewPosition({ x: ev.clientX, y: ev.clientY });
            };
            document.addEventListener('dragover', handleMouseMove);
            // Cleanup: Remove listener when drag ends
            const cleanup = () => {
                document.removeEventListener('dragover', handleMouseMove);
                document.removeEventListener('dragend', cleanup);
            };
            document.addEventListener('dragend', cleanup);
        }
    };

    const handleDragEnd = () => {
        setDraggedProject(null);
    };

    const handleDragOver = (e, squad, dateKey) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // dragover fires continuously; only update state when the hovered cell actually
        // changes, otherwise React re-renders the whole heatmap many times per second.
        setDragOverCell(prev => (prev && prev.squad === squad && prev.dateKey === dateKey) ? prev : { squad, dateKey });
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e, squad, dateKey) => {
        e.preventDefault();
        setDragOverCell(null);
        const projectId = e.dataTransfer.getData('text/plain');

        if (projectId) {
            // Find project name for confirmation
            const project = projects.find(p => p.id === projectId);
            setPendingDrop({
                projectId,
                squad,
                dateKey,
                projectName: project?.name || 'Unknown Project',
                projectCustomer: project?.customer || ''
            });
        }
    };

    const confirmDrop = async () => {
        if (pendingDrop && onAssignProject) {
            await onAssignProject(pendingDrop.projectId, pendingDrop.squad, pendingDrop.dateKey);
        }
        setPendingDrop(null);
    };

    const cancelDrop = () => {
        setPendingDrop(null);
    };

    // Keyboard navigation handler
    const handleKeyDown = (e) => {
        if (!focusedCell) return;
        const { squadIdx, dateIdx } = focusedCell;
        const maxSquadIdx = squads.length - 1;
        const maxDateIdx = visibleDates.length - 1;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (squadIdx > 0) setFocusedCell({ squadIdx: squadIdx - 1, dateIdx });
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (squadIdx < maxSquadIdx) setFocusedCell({ squadIdx: squadIdx + 1, dateIdx });
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (dateIdx > 0) setFocusedCell({ squadIdx, dateIdx: dateIdx - 1 });
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (dateIdx < maxDateIdx) setFocusedCell({ squadIdx, dateIdx: dateIdx + 1 });
                break;
            case 'Escape':
                e.preventDefault();
                setFocusedCell(null);
                setDragOverCell(null);
                break;
            default:
                break;
        }
    };

    if (!slotMap || squads.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderRadius: '12px',
                color: isDark ? '#94a3b8' : '#64748b'
            }}>
                <svg style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No Slot Data Available</h3>
                <p style={{ fontSize: '12px' }}>
                    Configure your standard project profile in Settings → Delivery Slots to enable slot detection.
                </p>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                {/* Main Heatmap Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                    {/* Header with legend */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                        borderRadius: '10px',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                    }}>
                        <div>
                            <h3 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                marginBottom: '2px'
                            }}>
                                Slot Availability Heatmap
                            </h3>
                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                {slotProfile ? `1x = ${slotProfile.pmHours}/${slotProfile.scHours}/${slotProfile.buildHours} hrs (PM/SC/Build) over ${slotProfile.durationWeeks} weeks` : 'No profile configured'}
                            </p>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {[
                                { label: 'Open', color: getSlotColor(1, isDark) },
                                { label: 'Partial', color: getSlotColor(0.5, isDark) },
                                { label: 'Full', color: getSlotColor(0, isDark) }
                            ].map(({ label, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '3px',
                                        backgroundColor: color
                                    }} />
                                    <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>{label}</span>
                                </div>
                            ))}

                            {/* Generate AI Insights Button */}
                            {onGenerateAIInsights && aiEnabled && (
                                <button
                                    data-tour="ai-insights"
                                    onClick={async () => {
                                        setIsGenerating(true);
                                        try {
                                            await onGenerateAIInsights({ slotMap, summary, roleInsights, roleConfig });
                                        } finally {
                                            setIsGenerating(false);
                                        }
                                    }}
                                    disabled={isGenerating}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        backgroundColor: isGenerating ? (isDark ? '#374151' : '#e2e8f0') : (isDark ? '#2563eb' : '#3b82f6'),
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        cursor: isGenerating ? 'wait' : 'pointer',
                                        transition: 'all 0.2s',
                                        marginLeft: '8px'
                                    }}
                                >
                                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {isGenerating ? 'Generating...' : 'AI Insights'}
                                </button>
                            )}
                            {/* Optimize Button */}
                            {onOptimize && (
                                <button
                                    onClick={onOptimize}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        backgroundColor: isDark ? '#00BD00' : '#00BD00',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        marginLeft: '8px'
                                    }}
                                >
                                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    Optimize
                                </button>
                            )}

                            {/* View Mode Toggle */}
                            <div style={{
                                display: 'flex',
                                marginLeft: '12px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`
                            }}>
                                <button
                                    onClick={() => setViewMode('heatmap')}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: viewMode === 'heatmap' ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#1e293b' : 'white'),
                                        color: viewMode === 'heatmap' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title="Heatmap View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="7" height="7" rx="1" />
                                        <rect x="14" y="3" width="7" height="7" rx="1" />
                                        <rect x="3" y="14" width="7" height="7" rx="1" />
                                        <rect x="14" y="14" width="7" height="7" rx="1" />
                                    </svg>
                                    Heatmap
                                </button>
                                <button
                                    onClick={() => setViewMode('gantt')}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        border: 'none',
                                        borderLeft: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                        cursor: 'pointer',
                                        backgroundColor: viewMode === 'gantt' ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#1e293b' : 'white'),
                                        color: viewMode === 'gantt' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title="Timeline View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="4" y1="6" x2="20" y2="6" />
                                        <rect x="4" y="10" width="12" height="2" rx="1" fill="currentColor" />
                                        <rect x="8" y="14" width="10" height="2" rx="1" fill="currentColor" />
                                        <rect x="6" y="18" width="14" height="2" rx="1" fill="currentColor" />
                                    </svg>
                                    Timeline
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Time Range Slider */}
                    {allFutureDates.length > weeksVisible && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '12px 16px',
                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                            borderRadius: '10px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>View:</span>
                                <select
                                    value={weeksVisible}
                                    onChange={(e) => {
                                        setWeeksVisible(Number(e.target.value));
                                        setViewOffset(0);
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: isDark ? '#e2e8f0' : '#1e293b',
                                        fontSize: '11px',
                                        fontWeight: '500'
                                    }}
                                >
                                    <option value={8}>8 weeks</option>
                                    <option value={12}>12 weeks</option>
                                    <option value={26}>6 months</option>
                                    <option value={52}>1 year</option>
                                </select>
                            </div>

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => setViewOffset(Math.max(0, viewOffset - weeksVisible))}
                                    disabled={viewOffset === 0}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: viewOffset === 0 ? (isDark ? '#475569' : '#cbd5e1') : (isDark ? '#e2e8f0' : '#1e293b'),
                                        cursor: viewOffset === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    ← Prev
                                </button>

                                <input
                                    type="range"
                                    min={0}
                                    max={maxOffset}
                                    value={viewOffset}
                                    onChange={(e) => setViewOffset(Number(e.target.value))}
                                    style={{
                                        flex: 1,
                                        height: '6px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        accentColor: '#3b82f6'
                                    }}
                                />

                                <button
                                    onClick={() => setViewOffset(Math.min(maxOffset, viewOffset + weeksVisible))}
                                    disabled={viewOffset >= maxOffset}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: viewOffset >= maxOffset ? (isDark ? '#475569' : '#cbd5e1') : (isDark ? '#e2e8f0' : '#1e293b'),
                                        cursor: viewOffset >= maxOffset ? 'not-allowed' : 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    Next →
                                </button>
                            </div>

                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                {visibleDates[0]?.label || ''} — {visibleDates[visibleDates.length - 1]?.label || ''}
                            </div>
                        </div>
                    )}

                    {/* Heatmap vs Timeline View */}
                    {viewMode === 'gantt' ? (
                        <SlotGanttView
                            slotMap={slotMap}
                            dateScaffold={visibleDates}
                            slotProfile={slotProfile}
                            enabledSquads={!mergeSquads ? squads : rawSquads} // Pass actual squads to GanttView so it can assume them and merge internally
                            // Actually better to pass original squads and let GanttView handle the merging logic
                            // But for simplicity in GanttView logic, we can also handle it there
                            mergeSquads={mergeSquads}
                            projects={projects}
                            draggedProject={draggedProject}
                            columnWidth={50}
                            globalExpand={allGroupsExpanded}
                            slotOptimization={slotOptimization}
                            onSlotDrop={(projectId, slot) => {
                                // Find project info
                                const project = projects.find(p => p.id === projectId);
                                if (!project) return;
                                // Calculate backward extension if shortfall exists
                                let adjustedStart = slot.startDateKey;
                                let shiftWeeks = 0;

                                if (slot.shortfall > 0) {
                                    const durationWeeks = slotProfile?.durationWeeks || 12;
                                    shiftWeeks = slot.shortfall * durationWeeks;

                                    // Shift date back by shiftWeeks
                                    const d = new Date(slot.startDateKey);
                                    d.setDate(d.getDate() - (shiftWeeks * 7));
                                    adjustedStart = d.toISOString().split('T')[0];
                                }

                                // Open confirmation/assignment modal with slot info
                                setPendingDrop({
                                    projectId,
                                    projectName: project.name,
                                    projectCustomer: project.customer,
                                    squad: slot.originalSquad || slot.squad, // Pivot for merged view
                                    dateKey: slot.startDateKey,
                                    slotId: slot.taxonomyId,
                                    slotStart: adjustedStart, // Use adjusted start date
                                    originalSlotStart: slot.startDateKey, // Keep track of original drop target
                                    slotEnd: slot.endDateKey, // This needs to be adjusted too if we want to show the full range? 
                                    // Actually slotEnd typically is just the end of the *single* slot. 
                                    // But for alignment, the modal calculates based on project duration anyway.

                                    slotsRequired: slot.slotsRequired,
                                    availableSlots: slot.availableSlots,
                                    shortfall: slot.shortfall,
                                    shiftWeeks
                                });
                            }}
                            onProjectClick={onProjectClick}
                        />
                    ) : (
                        /* Heatmap grid */
                        <div
                            ref={gridRef}
                            tabIndex={0}
                            onKeyDown={handleKeyDown}
                            style={{
                                overflowX: 'auto',
                                backgroundColor: isDark ? '#0f172a' : 'white',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                padding: '16px',
                                outline: 'none'
                            }}
                        >
                            <table style={{ borderCollapse: 'separate', borderSpacing: '4px', width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: isDark ? '#94a3b8' : '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Squad
                                        </th>
                                        {/* d.isoKey is the canonical key for slotMap lookups,
                                            React keys, drag handlers and selectedSlot.
                                            d.dateKey is the human-readable display label only. */}
                                        {visibleDates.map(d => (
                                            <th key={d.isoKey} style={{
                                                textAlign: 'center',
                                                padding: '8px',
                                                fontSize: '10px',
                                                fontWeight: '500',
                                                color: isDark ? '#64748b' : '#94a3b8',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {d.dateKey}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {squads.map((squad, squadIdx) => (
                                        <tr key={squad}>
                                            <td style={{
                                                padding: '8px 12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: isDark ? '#f1f5f9' : '#1e293b',
                                                whiteSpace: 'nowrap',
                                                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                                borderRadius: '6px'
                                            }}>
                                                {squad}
                                            </td>
                                            {visibleDates.map((d, dateIdx) => {
                                                const isDropTarget = dragOverCell?.squad === squad && dragOverCell?.dateKey === d.isoKey;
                                                const isFocused = focusedCell?.squadIdx === squadIdx && focusedCell?.dateIdx === dateIdx;
                                                return (
                                                    <td
                                                        key={d.isoKey}
                                                        onClick={() => setFocusedCell({ squadIdx, dateIdx })}
                                                        onDoubleClick={() => setSelectedSlot({
                                                            squad,
                                                            dateKey: d.isoKey,
                                                            dateLabel: d.label,
                                                            data: effectiveSlotMap[squad]?.[d.isoKey]
                                                        })}
                                                        style={{
                                                            padding: '2px',
                                                            outline: isFocused ? '2px solid #3b82f6' : isDropTarget ? '3px solid #f59e0b' : 'none',
                                                            outlineOffset: '-2px',
                                                            backgroundColor: isDropTarget ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                                                            borderRadius: isFocused || isDropTarget ? '6px' : '0',
                                                            transition: 'all 0.1s',
                                                            boxShadow: isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : isDropTarget ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                        onDragOver={(e) => handleDragOver(e, squad, d.isoKey)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, squad, d.isoKey)}
                                                    >
                                                        <SlotCell
                                                            data={effectiveSlotMap[squad]?.[d.isoKey]}
                                                            dateKey={d.isoKey}
                                                            isDark={isDark}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Summary stats - show only in heatmap mode */}
                    {viewMode === 'heatmap' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px'
                        }}>
                            {squads.map(squad => {
                                // Calculate aggregate stats for this squad
                                const squadData = effectiveSlotMap[squad] || {};
                                const buckets = Object.values(squadData);
                                const totalSlots = buckets.reduce((sum, b) => sum + (Number(b.availableSlots) || 0), 0);
                                const avgScore = buckets.length > 0
                                    ? buckets.reduce((sum, b) => sum + (Number(b.score) || 0), 0) / buckets.length
                                    : 0;

                                // Find most common bottleneck
                                const bottleneckCounts = {};
                                buckets.forEach(b => {
                                    if (b.bottleneck) bottleneckCounts[b.bottleneck] = (bottleneckCounts[b.bottleneck] || 0) + 1;
                                });
                                const primaryBottleneck = Object.entries(bottleneckCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

                                return (
                                    <div key={squad} style={{
                                        padding: '14px 16px',
                                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                        borderRadius: '10px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                {squad}
                                            </div>
                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                                                {(Number(totalSlots) || 0).toFixed(1)} total slots available
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Health indicator */}
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: getSlotColor(avgScore, isDark)
                                            }} />
                                            {/* Primary bottleneck */}
                                            {primaryBottleneck && (
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: bottleneckColors[primaryBottleneck]?.bg || '#64748b',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: '600'
                                                }}>
                                                    {primaryBottleneck} constrained
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Optimization Recommendations Panel */}
                    {recommendations.length > 0 && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: isDark ? '#1e293b' : '#fffbeb',
                            borderRadius: '12px',
                            border: `1px solid ${isDark ? '#334155' : '#fcd34d'}`
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg style={{ width: '18px', height: '18px', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#fcd34d' : '#92400e', margin: 0 }}>
                                        Optimization Recommendations
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        padding: '4px 10px',
                                        backgroundColor: isDark ? '#78350f' : '#fef3c7',
                                        color: isDark ? '#fcd34d' : '#92400e',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        fontWeight: '600'
                                    }}>
                                        {recommendations.length} suggestion{recommendations.length !== 1 ? 's' : ''}
                                    </span>
                                    {onSaveAsDraft && (
                                        <button
                                            onClick={() => onSaveAsDraft(recommendations)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                backgroundColor: isDark ? '#1e40af' : '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '10px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Save as Draft
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {recommendations.slice(0, 5).map((rec, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        borderRadius: '8px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                {rec.projectName}
                                            </div>
                                            <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                                {rec.reason}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {rec.type === 'date' && (
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: '#dbeafe',
                                                    color: '#1e40af',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    📅 Move Date
                                                </span>
                                            )}
                                            {rec.type === 'squad' && (
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: '#dcfce7',
                                                    color: '#166534',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    👥 Move Squad
                                                </span>
                                            )}
                                            <span style={{
                                                padding: '3px 8px',
                                                backgroundColor: rec.slotGain > 0.3 ? '#dcfce7' : '#f1f5f9',
                                                color: rec.slotGain > 0.3 ? '#166534' : '#64748b',
                                                borderRadius: '4px',
                                                fontSize: '9px',
                                                fontWeight: '700'
                                            }}>
                                                +{Math.round(rec.slotGain * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {recommendations.length > 5 && (
                                <div style={{
                                    textAlign: 'center',
                                    marginTop: '8px',
                                    fontSize: '10px',
                                    color: isDark ? '#94a3b8' : '#64748b'
                                }}>
                                    +{recommendations.length - 5} more recommendations
                                </div>
                            )}
                        </div>
                    )}

                    {/* Utilization Summary */}
                    {summary && summary.totalSlots > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '12px 16px',
                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                            borderRadius: '10px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#00BD00' }}>{summary.openSlots}</div>
                                <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>Open</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ca8a04' }}>{summary.partialSlots}</div>
                                <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>Partial</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>{summary.fullSlots}</div>
                                <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>Full</div>
                            </div>
                            <div style={{ width: '1px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>{summary.utilizationPct}%</div>
                                <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>Utilized</div>
                            </div>
                            {summary.primaryBottleneck && (
                                <>
                                    <div style={{ width: '1px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 10px',
                                            backgroundColor: bottleneckColors[summary.primaryBottleneck]?.bg || '#64748b',
                                            color: 'white',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700'
                                        }}>
                                            {summary.primaryBottleneck}
                                        </div>
                                        <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Primary Constraint</div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Role Insights Panel */}
                    {roleInsights && roleInsights.length > 0 && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: isDark ? '#1e293b' : '#eff6ff',
                            borderRadius: '12px',
                            border: `1px solid ${isDark ? '#334155' : '#93c5fd'}`
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg style={{ width: '18px', height: '18px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#93c5fd' : '#1e40af', margin: 0 }}>
                                        Role Intelligence
                                    </h4>
                                </div>
                                <span style={{
                                    padding: '4px 10px',
                                    backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
                                    color: isDark ? '#93c5fd' : '#1e40af',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                }}>
                                    {roleInsights.length} insight{roleInsights.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {roleInsights.slice(0, 4).map((insight, idx) => {
                                    const severityColors = {
                                        success: { bg: '#dcfce7', border: '#00BD00', text: '#166534', icon: '✓' },
                                        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: 'ℹ' },
                                        warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '⚠' }
                                    };
                                    const style = severityColors[insight.severity] || severityColors.info;

                                    return (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 12px',
                                            backgroundColor: isDark ? '#0f172a' : style.bg,
                                            borderRadius: '8px',
                                            border: `1px solid ${isDark ? '#334155' : style.border}30`
                                        }}>
                                            <span style={{ fontSize: '14px' }}>{style.icon}</span>
                                            <span style={{ fontSize: '12px', color: isDark ? '#e2e8f0' : style.text, flex: 1 }}>
                                                {insight.message}
                                            </span>
                                            {insight.actionable && (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    backgroundColor: isDark ? '#334155' : '#e0e7ff',
                                                    color: isDark ? '#94a3b8' : '#4338ca',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: '600'
                                                }}>
                                                    Action
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Unresourced Project Sidebar - NEW */}
                {unresourcedProjects.length > 0 && (
                    <div style={{
                        width: '280px',
                        minWidth: '280px',
                        backgroundColor: isDark ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'fit-content',
                        maxHeight: 'calc(100vh - 200px)',
                        position: 'sticky',
                        top: '20px'
                    }}>
                        <div style={{
                            padding: '8px 12px',
                            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    Unresourced
                                </span>
                                <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                    {filteredUnresourcedProjects.length}/{unresourcedProjects.length}
                                </span>
                            </div>

                            {/* Compact Filter Row */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <select
                                    value={sidebarYearFilter}
                                    onChange={(e) => setSidebarYearFilter(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '3px 4px',
                                        fontSize: '10px',
                                        borderRadius: '4px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        minWidth: 0
                                    }}
                                    title="Filter by year"
                                >
                                    <option value="">Year</option>
                                    {sidebarFilterOptions.years.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>

                                <select
                                    value={sidebarCustomerFilter}
                                    onChange={(e) => setSidebarCustomerFilter(e.target.value)}
                                    style={{
                                        flex: 2,
                                        padding: '3px 4px',
                                        fontSize: '10px',
                                        borderRadius: '4px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        minWidth: 0
                                    }}
                                    title="Filter by customer"
                                >
                                    <option value="">Customer</option>
                                    {sidebarFilterOptions.customers.map(c => (
                                        <option key={c} value={c}>{c.length > 15 ? c.substring(0, 15) + '...' : c}</option>
                                    ))}
                                </select>

                                <select
                                    value={sidebarSquadFilter}
                                    onChange={(e) => setSidebarSquadFilter(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '3px 4px',
                                        fontSize: '10px',
                                        borderRadius: '4px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        minWidth: 0
                                    }}
                                    title="Filter by squad"
                                >
                                    <option value="">Squad</option>
                                    {sidebarFilterOptions.squads.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Project List (flat, sorted by date) */}
                        <div style={{ padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[...filteredUnresourcedProjects]
                                .sort((a, b) => {
                                    const aDate = a.kickOff || a.start;
                                    const bDate = b.kickOff || b.start;
                                    if (!aDate && !bDate) return 0;
                                    if (!aDate) return 1;
                                    if (!bDate) return -1;
                                    return new Date(aDate) - new Date(bDate);
                                })
                                .map((p, idx, arr) => {
                                    const isSelected = selectedProjects.has(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => {
                                                if (e.shiftKey && lastClickedIndex !== null) {
                                                    // Range selection: select all between lastClickedIndex and current idx
                                                    const start = Math.min(lastClickedIndex, idx);
                                                    const end = Math.max(lastClickedIndex, idx);
                                                    const newSelection = new Set(selectedProjects);
                                                    for (let i = start; i <= end; i++) {
                                                        newSelection.add(arr[i].id);
                                                    }
                                                    setSelectedProjects(newSelection);
                                                } else if (e.metaKey || e.ctrlKey) {
                                                    // Toggle individual selection
                                                    const newSelection = new Set(selectedProjects);
                                                    if (newSelection.has(p.id)) {
                                                        newSelection.delete(p.id);
                                                    } else {
                                                        newSelection.add(p.id);
                                                    }
                                                    setSelectedProjects(newSelection);
                                                    setLastClickedIndex(idx);
                                                } else {
                                                    // Single click: clear selection and select only this one OR trigger onProjectClick
                                                    if (onProjectClick) {
                                                        onProjectClick(p);
                                                    } else {
                                                        setSelectedProjects(new Set([p.id]));
                                                        setLastClickedIndex(idx);
                                                    }
                                                }
                                            }}
                                            style={{
                                                padding: '10px',
                                                borderRadius: '8px',
                                                backgroundColor: isSelected ? (isDark ? '#1e3a8a' : '#dbeafe') : (isDark ? '#0f172a' : '#fff'),
                                                border: `2px solid ${isSelected ? '#3b82f6' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                cursor: onProjectClick ? 'pointer' : 'grab',
                                                boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                                                transition: 'transform 0.1s, box-shadow 0.1s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.transform = 'none';
                                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                                }
                                            }}
                                        >
                                            {(() => {
                                                // Calculate slots required based on total effort vs slotProfile
                                                // Effort values from Airtable are in SECONDS - convert to hours
                                                const pmVal = (Number(p.pmVal) || 0) / 3600;
                                                const scVal = (Number(p.scVal) || 0) / 3600;
                                                const pdVal = (Number(p.pdVal) || 0) / 3600;
                                                const totalEffort = pmVal + scVal + pdVal;

                                                // Default slot profile: derive from slotProfile prop or fallback to PM=40h, SC=120h, Build=80h
                                                const slotTotal = slotProfile
                                                    ? (Number(slotProfile.pmHours) || 40) + (Number(slotProfile.scHours) || 120) + (Number(slotProfile.buildHours) || 80)
                                                    : 240; // Fallback only if slotProfile completely missing
                                                const rawSlots = slotTotal > 0 ? totalEffort / slotTotal : 0;
                                                // Round to nearest 0.25, cap at 10x max to avoid display errors
                                                const slotsRequired = Math.min(10, Math.ceil(rawSlots * 4) / 4);

                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        marginBottom: '4px'
                                                    }}>
                                                        <div style={{
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            color: isDark ? '#f1f5f9' : '#1e293b',
                                                            lineHeight: 1.3,
                                                            flex: 1
                                                        }}>
                                                            {String(p.name || 'Untitled')}
                                                        </div>
                                                        {slotsRequired > 0 && (
                                                            <span
                                                                title={`${Math.round(totalEffort)}h total effort ≈ ${slotsRequired} slot${slotsRequired !== 1 ? 's' : ''}`}
                                                                style={{
                                                                    fontSize: '9px',
                                                                    fontWeight: '700',
                                                                    color: 'white',
                                                                    backgroundColor: slotsRequired >= 2 ? '#ef4444' : slotsRequired >= 1 ? '#f59e0b' : '#00BD00',
                                                                    padding: '2px 5px',
                                                                    borderRadius: '4px',
                                                                    marginLeft: '6px',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {slotsRequired}x
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Customer & Scope */}
                                            {(p.customer || p.scope) && (
                                                <div style={{ fontSize: '10px', color: isDark ? '#cbd5e1' : '#475569', marginBottom: '6px' }}>
                                                    {p.customer && <span style={{ fontWeight: '500' }}>{String(p.customer)} • </span>}
                                                    {p.scope && (
                                                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                                                            {String(p.scope).length > 40 ? String(p.scope).substring(0, 40) + '...' : String(p.scope)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Staffing Status Badge */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                marginBottom: '6px',
                                                fontSize: '9px'
                                            }}>
                                                {/* Role dots: PM/SC/PD */}
                                                <span style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                                    <span style={{
                                                        width: '6px', height: '6px', borderRadius: '50%',
                                                        backgroundColor: p.team?.pm?.length > 0 ? '#00BD00' : '#dc2626'
                                                    }} title={p.team?.pm?.length > 0 ? 'PM assigned' : 'PM needed'} />
                                                    <span style={{
                                                        width: '6px', height: '6px', borderRadius: '50%',
                                                        backgroundColor: p.team?.sc?.length > 0 ? '#00BD00' : '#dc2626'
                                                    }} title={p.team?.sc?.length > 0 ? 'SC assigned' : 'SC needed'} />
                                                    <span style={{
                                                        width: '6px', height: '6px', borderRadius: '50%',
                                                        backgroundColor: p.team?.pd?.length > 0 ? '#00BD00' : '#dc2626'
                                                    }} title={p.team?.pd?.length > 0 ? 'PD assigned' : 'PD needed'} />
                                                </span>
                                                <span style={{
                                                    color: p.staffingStatus === 'PARTIAL' ? '#f59e0b' : '#dc2626',
                                                    fontWeight: '600'
                                                }}>
                                                    {p.staffingStatus === 'PARTIAL' ? `${p.rolesFilled}/3 roles` : 'Unassigned'}
                                                </span>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                fontSize: '9px',
                                                color: isDark ? '#64748b' : '#94a3b8',
                                                borderTop: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                paddingTop: '6px',
                                                marginTop: '6px'
                                            }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                                                            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                                                            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                                                            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                                                        </svg>
                                                        {p.kickOff ? new Date(p.kickOff).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                                            <line x1="4" x2="4" y1="22" y2="15" />
                                                        </svg>
                                                        {p.launch ? new Date(p.launch).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div >

            {/* Slot Snapshot Comparison Panel */}
            < SlotSnapshotPanel slotMap={slotMap} enabledSquads={enabledSquads} />

            {/* Drop Confirmation Modal - Enhanced SlotAssignmentModal */}
            {pendingDrop && (
                <SlotAssignmentModal
                    project={projects.find(p => p.id === pendingDrop.projectId) || { name: pendingDrop.projectName, customer: pendingDrop.projectCustomer, id: pendingDrop.projectId }}
                    resources={resources} // Pass resources for staffing recommendations
                    allProjects={allProjects} // Pass all projects for copy feature
                    slot={{
                        squad: pendingDrop.squad,
                        slotId: pendingDrop.slotId || `Slot-${pendingDrop.dateKey}`,
                        slotStart: pendingDrop.slotStart || pendingDrop.dateKey,
                        slotEnd: pendingDrop.slotEnd || pendingDrop.dateKey
                    }}
                    slotProfile={slotProfile}
                    onCancel={cancelDrop}
                    onConfirm={(changes) => {
                        // Direct update via proxy
                        if (onAssignProject) {
                            onAssignProject(pendingDrop.projectId, changes.squad, changes.kickOff, { direct: true, ...changes });
                        }
                        setPendingDrop(null);
                    }}
                    onCreateDraft={(changes) => {
                        // Create draft scenario
                        if (onSaveAsDraft) {
                            onSaveAsDraft(pendingDrop.projectId, changes);
                        } else if (onAssignProject) {
                            onAssignProject(pendingDrop.projectId, changes.squad, changes.kickOff, { draft: true, ...changes });
                        }
                        setPendingDrop(null);
                    }}
                />
            )}

            {/* Slot Detail Modal - Shows capacity breakdown */}
            {
                selectedSlot && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9999,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onClick={() => setSelectedSlot(null)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                borderRadius: '16px',
                                padding: '24px',
                                width: '600px',
                                maxHeight: '80vh',
                                overflowY: 'auto',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', margin: 0 }}>
                                        {selectedSlot.squad} - {selectedSlot.dateLabel}
                                    </h2>
                                    <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
                                        Capacity & Demand Breakdown
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedSlot(null)}
                                    style={{
                                        background: 'none', border: 'none', fontSize: '20px',
                                        color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer'
                                    }}
                                >×</button>
                            </div>

                            {/* Slot Summary */}
                            {selectedSlot.data ? (
                                <>
                                    {/* Available Slots */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
                                        marginBottom: '20px'
                                    }}>
                                        {['pm', 'sc', 'build'].map(role => {
                                            const cap = Number(selectedSlot.data.capacity?.[role]) || 0;
                                            const dem = Number(selectedSlot.data.demand?.[role]) || 0;
                                            const available = Math.max(0, cap - dem);
                                            const util = cap > 0 ? (dem / cap * 100) : 0;
                                            return (
                                                <div key={role} style={{
                                                    padding: '12px',
                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                                }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                                                        {role === 'build' ? 'PD' : role.toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: '24px', fontWeight: '700', color: util > 100 ? '#ef4444' : util > 80 ? '#f59e0b' : '#00BD00' }}>
                                                        {(Number(available) || 0).toFixed(0)}h
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                        {(Number(dem) || 0).toFixed(0)}h / {(Number(cap) || 0).toFixed(0)}h ({(Number(util) || 0).toFixed(0)}%)
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Resources in Squad */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '12px' }}>
                                            👥 Team Members
                                        </h3>
                                        {selectedSlot.data.resources?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {selectedSlot.data.resources.map((r, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '8px 12px',
                                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                        borderRadius: '6px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                                {r.name}
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                                {r.role}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '12px', fontWeight: '600', color: r.util > 100 ? '#ef4444' : isDark ? '#f1f5f9' : '#1e293b' }}>
                                                                {(Number(r.util) || 0).toFixed(0)}%
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                                {(Number(r.demand) || 0).toFixed(0)}h / {(Number(r.capacity) || 0).toFixed(0)}h
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', fontStyle: 'italic' }}>
                                                No resource data available for this week
                                            </div>
                                        )}
                                    </div>

                                    {/* Projects in Squad */}
                                    <div>
                                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '12px' }}>
                                            📋 Projects This Week
                                        </h3>
                                        {selectedSlot.data.projects?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {selectedSlot.data.projects.map((p, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '8px 12px',
                                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                        borderRadius: '6px'
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                                {p.name}
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                                {p.customer || 'No customer'}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                            {(Number(p.hours) || 0).toFixed(0)}h
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', fontStyle: 'italic' }}>
                                                No projects scheduled this week
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                    No slot data available
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* QoL: Drag Preview Tooltip - Shows project info while dragging */}
            {draggedProject && (
                <div
                    style={{
                        position: 'fixed',
                        left: dragPreviewPosition.x + 15,
                        top: dragPreviewPosition.y + 15,
                        zIndex: 10000,
                        pointerEvents: 'none',
                        padding: '10px 14px',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                        border: `2px solid ${isDark ? '#7637E3' : '#BD65FF'}`,
                        borderRadius: '10px',
                        boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        maxWidth: '280px'
                    }}
                >
                    <div style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: isDark ? '#c4b5fd' : '#7637E3',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '4px'
                    }}>
                        Dragging Project
                    </div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {draggedProject.name || 'Unknown Project'}
                    </div>
                    {draggedProject.customer && (
                        <div style={{
                            fontSize: '11px',
                            color: isDark ? '#94a3b8' : '#64748b',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {draggedProject.customer}
                        </div>
                    )}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                    }}>
                        {(() => {
                            const pmVal = (Number(draggedProject.pmVal) || 0) / 3600;
                            const scVal = (Number(draggedProject.scVal) || 0) / 3600;
                            const pdVal = (Number(draggedProject.pdVal) || 0) / 3600;
                            const totalHours = Math.round(pmVal + scVal + pdVal);
                            return (
                                <>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                                        color: isDark ? '#93c5fd' : '#1d4ed8'
                                    }}>
                                        {totalHours}h total
                                    </span>
                                    {draggedProject.squads?.[0] && (
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '600',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: isDark ? '#065f46' : '#d1fae5',
                                            color: isDark ? '#6ee7b7' : '#047857'
                                        }}>
                                            {draggedProject.squads[0]}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </>
    );
};
