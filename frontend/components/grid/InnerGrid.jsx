import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useScrollFreezing } from '../../hooks/useScrollFreezing'; // direct import (no barrel)
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { formatNumber } from '../../utils';
import ResourceRow from './ResourceRow';

// Memoized date header row — prevents re-render on every hover event
const DateHeaderRow = React.memo(({ dates, todayKey, hoverDateKey, columnWidth, colLeftOffset }) => (
    // data-capacity-date-header: stable selector so chart-export.js can find this element
    // and composite the date labels into the chart PNG (the chart's own <XAxis> has
    // tick={false} for UI density, so dates live only in this grid header).
    <div data-capacity-date-header="true" style={{ display: 'flex', backgroundColor: 'inherit', height: '60px', alignItems: 'flex-end', paddingBottom: '4px' }}>
        {colLeftOffset > 0 && <div style={{ flexShrink: 0, width: colLeftOffset }} />}
        {dates.map((d) => {
            const isMonthStart = d.dateKey.includes(' 1');
            const isHovered = hoverDateKey === d.dateKey;
            const dateLabel = d.dateKey.includes('20') ? d.dateKey.split(' 20')[0] : d.dateKey;

            return (
                <div key={d.dateKey}
                    data-date-key={d.dateKey}
                    data-date-label={dateLabel}
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', transition: 'color 0.2s', borderLeft: isMonthStart ? `1px solid ${BRAND.border}` : '1px solid transparent', backgroundColor: isHovered ? BRAND.bgAlt : 'transparent', width: `${columnWidth}px` }}
                >
                    {d.dateKey === todayKey && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '4px', backgroundColor: BRAND.primary, zIndex: 10 }} />}

                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: isHovered ? 'bold' : '500', color: isHovered ? BRAND.primary : '#64748b', transition: 'opacity 0.2s', cursor: 'default', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            {dateLabel}
                        </span>
                    </div>
                </div>
            )
        })}
    </div>
));

const ROW_HEIGHT = 42; // V1 Parity: Must match V1's value
const BUFFER = 5;
const COL_BUFFER = 5; // Extra columns rendered beyond viewport edges
const SIDEBAR_WIDTH = 260; // Should match Dashboard constant ideally
const ROW_STYLE = { height: ROW_HEIGHT, position: 'absolute', width: '100%', left: 0 };

const InnerGrid = React.memo(({ groupedData, dates, onCellClick, onHover, todayKey, cellDisplayMode, forecastMode, toggleShowAll, columnWidth, fontSize, highlightProject, hoverDateKey, thresholds, groupStats, pinnedResources, onTogglePin, viewMode, children, footerChildren, onResourceClick, selectedProjects, onToggleSelection, allGroupsExpanded, customerSort, onResourceHover }) => {
    const { isDark, colors } = useTheme();
    const [collapsedSquads, setCollapsedSquads] = useState({});
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);
    const [containerHeight, setContainerHeight] = useState(600);
    const [containerWidth, setContainerWidth] = useState(1200);
    const [showBackToTop, setShowBackToTop] = useState(false);

    // Keyboard Navigation: focused cell { rowIdx, colIdx } into flatList/dates
    const [focusedCell, setFocusedCell] = useState(null);

    useScrollFreezing(containerRef);

    const toggleSquad = useCallback((squadName) => setCollapsedSquads(prev => ({ ...prev, [squadName]: !prev[squadName] })), []);

    // Sync allGroupsExpanded prop from parent to local collapsedSquads state
    // Only trigger when allGroupsExpanded prop CHANGES, not on every groupedData update
    const prevAllGroupsExpanded = useRef(allGroupsExpanded);
    useEffect(() => {
        // Only react if allGroupsExpanded actually changed
        if (prevAllGroupsExpanded.current !== allGroupsExpanded) {
            prevAllGroupsExpanded.current = allGroupsExpanded;
            if (groupedData && typeof groupedData === 'object') {
                const allGroups = Object.keys(groupedData);
                if (allGroupsExpanded) {
                    // Expand all: remove all from collapsed
                    setCollapsedSquads({});
                } else {
                    // Collapse all: set all groups to collapsed
                    const collapsed = {};
                    allGroups.forEach(name => collapsed[name] = true);
                    setCollapsedSquads(collapsed);
                }
            }
        }
    }, [allGroupsExpanded, groupedData]);

    const useFlatList = (groupedData, collapsedSquads, pinnedIds) => useMemo(() => {
        const rows = [];
        const pinnedRows = [];
        if (!groupedData || typeof groupedData !== 'object') return rows;

        const pinnedSet = new Set(pinnedIds || []);
        const safeGroupStats = groupStats || {};

        // Helper function to extract number from wave name for sorting
        const extractWaveNumber = (waveName) => {
            const match = waveName.match(/\d+/);
            return match ? parseInt(match[0], 10) : Infinity;
        };

        // Sort group entries by name if customerSort is enabled in projects mode
        let groupEntries = Object.entries(groupedData);
        if (viewMode === 'projects' && customerSort) {
            groupEntries = groupEntries.sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
        }

        groupEntries.forEach(([squadName, functions]) => {
            const isCollapsed = collapsedSquads[squadName];
            const stats = safeGroupStats[squadName] || { cap: 0, dem: 0, count: 0 };
            const util = stats.cap > 0 ? Math.round((stats.dem / stats.cap) * 100) : 0;

            // Push Squad Header — include raw hours for utilisation display
            rows.push({ type: 'SQUAD_HEADER', key: `squad-${squadName}`, name: squadName, isCollapsed, stats: { count: stats.count, util, capHours: Math.round(stats.cap), demHours: Math.round(stats.dem) } });

            if (!isCollapsed) {
                // Aggregate per-week utilisation across all resources in this squad.
                // Multi-squad resources carry a _groupShare of 1/(number of groups they're in),
                // set by useGrouping — so a person in 2 squads contributes 50% of their bucket
                // to each squad's weekly total rather than 100% to both. Keeps the sum across
                // squads honest without changing individual resource row display.
                const weeklyUtil = {};
                const allSquadResources = [];
                Object.values(functions).forEach(resources => {
                    resources.forEach(res => {
                        if (res.isProgram) return; // Skip program budget rows
                        allSquadResources.push(res);
                        const share = (typeof res._groupShare === 'number' && res._groupShare > 0) ? res._groupShare : 1;
                        if (res.buckets) {
                            Object.entries(res.buckets).forEach(([dateKey, bucket]) => {
                                if (!weeklyUtil[dateKey]) weeklyUtil[dateKey] = { cap: 0, dem: 0 };
                                weeklyUtil[dateKey].cap += (bucket.cap || 0) * share;
                                weeklyUtil[dateKey].dem += (bucket.dem || 0) * share;
                            });
                        }
                    });
                });
                rows.push({
                    type: 'SQUAD_UTIL_ROW',
                    key: `squad-util-${squadName}`,
                    name: squadName,
                    weeklyUtil,
                    resourceCount: allSquadResources.length
                });

                const functionEntries = Object.entries(functions);
                const isProjectMode = viewMode === 'projects';

                if (isProjectMode) {
                    functionEntries.sort(([nameA], [nameB]) => {
                        // Program subgroup always goes first
                        if (nameA.startsWith('★')) return -1;
                        if (nameB.startsWith('★')) return 1;
                        // Then sort by wave number
                        const numA = extractWaveNumber(nameA);
                        const numB = extractWaveNumber(nameB);
                        return numA - numB;
                    });
                }

                functionEntries.forEach(([funcName, resources]) => {
                    let hasUnpinnedResources = false;
                    const unpinnedRes = [];

                    resources.forEach(res => {
                        if (pinnedSet.has(res.id)) {
                            pinnedRows.push({ type: 'RESOURCE', key: `pinned-${res.uniqueKey}`, data: res });
                        } else {
                            unpinnedRes.push(res);
                        }
                    });

                    if (unpinnedRes.length > 0) {
                        // Sort projects by name within each wave/function group
                        if (isProjectMode) {
                            unpinnedRes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        }
                        rows.push({
                            type: 'FUNC_HEADER',
                            key: `func-${squadName}-${funcName}`,
                            name: funcName,
                            stats: { count: unpinnedRes.length }
                        });
                        unpinnedRes.forEach(res => {
                            rows.push({ type: 'RESOURCE', key: res.uniqueKey, data: res });
                        });
                    }
                });
            }
        });

        // Prepend Pinned Section
        if (pinnedRows.length > 0) {
            return [
                { type: 'SQUAD_HEADER', key: 'header-pinned', name: 'Pinned Actions', isCollapsed: false, stats: { count: pinnedRows.length, util: 0 }, isPinned: true },
                ...pinnedRows,
                ...rows
            ];
        }

        return rows;
    }, [groupedData, collapsedSquads, groupStats, pinnedIds, viewMode, customerSort]);


    const [listOffset, setListOffset] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const listRef = useRef(null);

    useEffect(() => {
        const measureOffset = () => {
            if (listRef.current) {
                const offset = listRef.current.offsetTop;
                setListOffset(prev => (prev !== offset ? offset : prev));
            }
        };

        measureOffset();
        window.addEventListener('resize', measureOffset);
        const timer = setTimeout(measureOffset, 100);

        return () => {
            window.removeEventListener('resize', measureOffset);
            clearTimeout(timer);
        };
    }, []);

    const flatRows = useFlatList(groupedData, collapsedSquads, pinnedResources);
    const totalContentHeight = flatRows.length * ROW_HEIGHT;

    // focusedCell.rowIdx is a positional index into flatRows. When the row list is
    // restructured (squad collapse/expand, sort/view change, or data refresh) that
    // index no longer points at the same RESOURCE row — keyboard nav would then act
    // on the wrong row or run out of bounds. Reset focus whenever flatRows changes
    // identity so the next arrow press re-anchors to the first visible cell.
    useEffect(() => {
        setFocusedCell(null);
    }, [flatRows]);

    // Ordered list of the IDs of every RESOURCE row that is actually visible in the grid.
    // "Visible" here means "not inside a collapsed squad" — virtualised off-screen rows still count,
    // because shift-select should span the scrollable range, not just what fits in the viewport.
    // This list is the single source of truth for shift-range selection and replaces the stale
    // reconstruction that used to live in Dashboard.handleToggleSelection.
    const visibleOrderedIds = useMemo(
        () => flatRows.filter(r => r.type === 'RESOURCE' && r.data?.id).map(r => r.data.id),
        [flatRows]
    );

    // Wrap the incoming onToggleSelection so callers (ResourceRow checkboxes etc.) don't need
    // to know about the ordered-id list — we pass it through as the 3rd arg for accurate ranges.
    const onToggleSelectionWithOrder = useCallback((id, shiftKey) => {
        if (onToggleSelection) onToggleSelection(id, shiftKey, visibleOrderedIds);
    }, [onToggleSelection, visibleOrderedIds]);

    const effectiveScrollTop = Math.max(0, scrollTop - listOffset);
    const startIndex = Math.max(0, Math.floor(effectiveScrollTop / ROW_HEIGHT) - BUFFER);
    const endIndex = Math.min(flatRows.length, Math.ceil((effectiveScrollTop + containerHeight) / ROW_HEIGHT) + BUFFER);
    const visibleRows = flatRows.slice(startIndex, endIndex);

    const onScroll = useCallback((e) => {
        const target = e.target;
        requestAnimationFrame(() => {
            setScrollTop(target.scrollTop);
            setScrollLeft(target.scrollLeft);
        });
    }, []);

    useEffect(() => { if (containerRef.current) { const updateDims = () => { setContainerHeight(containerRef.current.clientHeight); setContainerWidth(containerRef.current.clientWidth); }; updateDims(); window.addEventListener('resize', updateDims); return () => window.removeEventListener('resize', updateDims); } }, []);
    useEffect(() => { setShowBackToTop(scrollTop > 300); }, [scrollTop]);
    const scrollToTop = () => { if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' }); };

    // Jump to Today - scroll horizontally to center today's column
    const scrollToToday = useCallback(() => {
        if (!containerRef.current || !todayKey || !dates?.length) return;
        const todayIndex = dates.findIndex(d => d.dateKey === todayKey);
        if (todayIndex === -1) return;
        const todayOffset = SIDEBAR_WIDTH + (todayIndex * columnWidth) - (containerRef.current.clientWidth / 2) + (columnWidth / 2);
        containerRef.current.scrollTo({ left: Math.max(0, todayOffset), behavior: 'smooth' });
    }, [todayKey, dates, columnWidth]);

    const yearGroups = useMemo(() => {
        if (!dates || !Array.isArray(dates) || !dates.length) return [];
        const groups = [];
        try {
            const firstDate = dates[0]?.rawDate ? new Date(dates[0].rawDate) : null;
            if (!firstDate || isNaN(firstDate.getTime())) return [];
            let currentYear = firstDate.getFullYear();
            let count = 0;
            dates.forEach(d => {
                if (!d?.rawDate) return;
                const parsed = new Date(d.rawDate);
                if (isNaN(parsed.getTime())) return;
                const y = parsed.getFullYear();
                if (y === currentYear) { count++; }
                else { groups.push({ year: currentYear, count }); currentYear = y; count = 1; }
            });
            if (count > 0) groups.push({ year: currentYear, count });
        } catch (err) {
            console.warn('Error parsing year groups:', err);
        }
        return groups;
    }, [dates]);

    const currentVisibleYear = useMemo(() => {
        if (!yearGroups.length || !dates.length) return null;
        const visibleColumnIndex = Math.floor(scrollLeft / columnWidth);
        let cumulativeColumns = 0;
        for (const group of yearGroups) {
            cumulativeColumns += group.count;
            if (visibleColumnIndex < cumulativeColumns) {
                return group.year;
            }
        }
        return yearGroups[yearGroups.length - 1]?.year;
    }, [yearGroups, scrollLeft, columnWidth, dates.length]);

    const totalWidth = SIDEBAR_WIDTH + (dates.length * columnWidth);

    // ── Column Virtualization ──────────────────────────────────────────
    // Only render date columns that are visible in the horizontal viewport
    const gridAreaWidth = Math.max(0, containerWidth - SIDEBAR_WIDTH);
    const visibleColStart = Math.max(0, Math.floor(scrollLeft / columnWidth) - COL_BUFFER);
    const visibleColEnd = Math.min(dates.length, Math.ceil((scrollLeft + gridAreaWidth) / columnWidth) + COL_BUFFER);
    const visibleDates = dates.slice(visibleColStart, visibleColEnd);
    const colLeftOffset = visibleColStart * columnWidth;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: colors.bg, minHeight: 0, overflow: 'hidden' }}>
            {/* ... (Sticky Controls) ... */}

            {/* SCROLLABLE CONTAINER */}
            <div
                style={{ flexGrow: 1, position: 'relative', overflowY: 'auto', overflowX: 'auto', minHeight: 0, backgroundColor: colors.bg }}
                ref={containerRef}
                onScroll={onScroll}
                data-grid-scroll
                tabIndex={0}
                onKeyDown={(e) => {
                    // Keyboard Grid Navigation
                    const resourceRows = flatRows.filter(r => r.type === 'RESOURCE' && !r.data?.isProgram);
                    if (!resourceRows.length || !dates.length) return;

                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
                        e.preventDefault();
                    } else {
                        return;
                    }

                    if (e.key === 'Escape') {
                        setFocusedCell(null);
                        return;
                    }

                    const maxRow = resourceRows.length - 1;
                    const maxCol = dates.length - 1;

                    if (!focusedCell) {
                        // First arrow press: focus first visible cell
                        const firstRowIdx = flatRows.findIndex(r => r.type === 'RESOURCE' && !r.data?.isProgram);
                        const firstColIdx = Math.max(0, visibleColStart);
                        setFocusedCell({ rowIdx: firstRowIdx, colIdx: firstColIdx });
                        return;
                    }

                    let { rowIdx, colIdx } = focusedCell;

                    if (e.key === 'Enter') {
                        // Open detail modal for focused cell
                        const row = flatRows[rowIdx];
                        if (row?.type === 'RESOURCE' && row.data) {
                            const dateObj = dates[colIdx];
                            if (dateObj) {
                                const bucket = row.data.buckets?.[dateObj.dateKey] || {};
                                if (Math.abs(bucket.dem || 0) > 0) {
                                    onCellClick({ resourceName: row.data.name, dateKey: dateObj.dateKey, bucketData: bucket });
                                }
                            }
                        }
                        return;
                    }

                    if (e.key === 'ArrowUp') {
                        // Move to previous RESOURCE row
                        for (let i = rowIdx - 1; i >= 0; i--) {
                            if (flatRows[i].type === 'RESOURCE' && !flatRows[i].data?.isProgram) {
                                rowIdx = i;
                                break;
                            }
                        }
                    } else if (e.key === 'ArrowDown') {
                        for (let i = rowIdx + 1; i < flatRows.length; i++) {
                            if (flatRows[i].type === 'RESOURCE' && !flatRows[i].data?.isProgram) {
                                rowIdx = i;
                                break;
                            }
                        }
                    } else if (e.key === 'ArrowLeft') {
                        colIdx = Math.max(0, colIdx - 1);
                    } else if (e.key === 'ArrowRight') {
                        colIdx = Math.min(maxCol, colIdx + 1);
                    }

                    setFocusedCell({ rowIdx, colIdx });

                    // Auto-scroll into view
                    if (containerRef.current) {
                        const rowTop = rowIdx * ROW_HEIGHT;
                        const cellLeft = SIDEBAR_WIDTH + (colIdx * columnWidth);
                        const container = containerRef.current;

                        // Vertical scroll
                        if (rowTop < container.scrollTop) {
                            container.scrollTop = rowTop - ROW_HEIGHT;
                        } else if (rowTop + ROW_HEIGHT > container.scrollTop + container.clientHeight) {
                            container.scrollTop = rowTop - container.clientHeight + ROW_HEIGHT * 2;
                        }

                        // Horizontal scroll
                        if (cellLeft < container.scrollLeft + SIDEBAR_WIDTH) {
                            container.scrollLeft = cellLeft - SIDEBAR_WIDTH;
                        } else if (cellLeft + columnWidth > container.scrollLeft + container.clientWidth) {
                            container.scrollLeft = cellLeft - container.clientWidth + columnWidth + SIDEBAR_WIDTH;
                        }
                    }
                }}
            >

                {/* Top Section - Stats cards and chart */}
                {children && (
                    <div style={{ marginBottom: '8px', padding: '0 16px' }}>
                        {children}
                    </div>
                )}

                {/* STICKY HEADER */}
                <div style={{ position: 'sticky', top: 0, backgroundColor: colors.bg, boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)', borderBottom: `1px solid ${colors.border}`, minWidth: 'fit-content', zIndex: Z_INDEX.STICKY_HEADER, width: totalWidth }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
                        {/* Resource Column Header */}
                        <div
                            style={{
                                flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '8px', borderRight: `1px solid ${colors.border}`, backgroundColor: colors.bg, position: 'sticky', left: 0, boxShadow: isDark ? '2px 0 5px -2px rgba(0,0,0,0.3)' : '2px 0 5px -2px rgba(0,0,0,0.1)', width: `${SIDEBAR_WIDTH}px`, zIndex: Z_INDEX.STICKY_HEADER + 10
                            }}
                        >
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: colors.textMuted, paddingLeft: '24px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Resource</span>
                        </div>

                        {/* Date Headers */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Year Row */}
                            <div style={{ display: 'flex', height: '24px', backgroundColor: colors.bgAlt, borderBottom: `1px solid ${colors.border}` }}>
                                {yearGroups.map((group, idx) => (
                                    <div key={idx} style={{ width: group.count * columnWidth, position: 'relative', borderRight: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center' }}>
                                        <div
                                            style={{
                                                padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: colors.bgCard, boxShadow: colors.shadowSm, border: `1px solid ${colors.border}`, position: 'sticky', left: `${SIDEBAR_WIDTH + 8}px`, zIndex: Z_INDEX.STICKY_HEADER + 5
                                            }}
                                        >
                                            {group.year}
                                        </div>
                                    </div>
                                ))}
                            </div>



                            {/* Month/Day Row — memoized to avoid re-render on hover */}
                            <DateHeaderRow dates={visibleDates} todayKey={todayKey} hoverDateKey={hoverDateKey} columnWidth={columnWidth} colLeftOffset={colLeftOffset} />
                        </div>
                    </div>
                </div>

                {/* UNASSIGNED ROW */}
                <div data-tour="unassigned" style={{ display: 'flex', alignItems: 'center', marginBottom: 0, paddingBottom: '8px', paddingTop: '8px', borderBottom: `2px dashed ${colors.border}`, backgroundColor: colors.bg, minWidth: 'fit-content', width: totalWidth }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '16px', paddingRight: '8px', position: 'sticky', left: 0, backgroundColor: colors.bg, borderRight: `1px solid transparent`, width: `${SIDEBAR_WIDTH}px`, zIndex: Z_INDEX.STICKY_COL }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fde68a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><svg style={{ width: '12px', height: '12px', color: '#FE9922' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unassigned</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', height: '100%' }}>
                        {colLeftOffset > 0 && <div style={{ flexShrink: 0, width: colLeftOffset }} />}
                        {visibleDates.map((d) => {
                            const u = d.unassignedStat || { val: 0, projects: [] };
                            return (
                                <div key={d.dateKey} style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: `1px solid ${BRAND.border}4D`, width: `${columnWidth}px` }}>
                                    <div
                                        onClick={() => u.val > 0 && onCellClick({ resourceName: 'Unassigned Demand', dateKey: d.dateKey, bucketData: { projects: u.projects } })}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            transition: 'all 0.2s',
                                            backgroundColor: u.val > 0 ? '#fffbeb' : 'transparent',
                                            color: u.val > 0 ? '#d97706' : 'transparent',
                                            border: u.val > 0 ? '1px solid #fde68a' : '1px solid transparent',
                                            cursor: u.val > 0 ? 'pointer' : 'default'
                                        }}
                                    >
                                        {u.val > 0 ? formatNumber(u.val) : ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* VIRTUALIZED ROWS */}
                <div ref={listRef} style={{ height: totalContentHeight, position: 'relative', width: totalWidth }}>
                    {visibleRows.map((row, index) => {
                        const top = (startIndex + index) * ROW_HEIGHT;
                        return (
                            <div key={row.key} style={{ ...ROW_STYLE, transform: `translateY(${top}px)` }}>
                                {/* Squad Header Row */}
                                {row.type === 'SQUAD_HEADER' && (() => {
                                    // Capacity Threshold Warnings — aligned to spec:
                                    //   <100  : green  (success)
                                    //   100-120: amber/orange (warning)
                                    //   ≥120  : red    (danger)
                                    const util = row.stats.util;
                                    const capHours = row.stats.capHours || 0;
                                    const demHours = row.stats.demHours || 0;
                                    const isDanger = util >= 120;
                                    const isWarning = util >= 100 && util < 120;

                                    // Color scheme based on utilization thresholds
                                    const thresholdColor = isDanger
                                        ? colors.danger
                                        : isWarning
                                            ? '#FE9922' // amber
                                            : colors.success;

                                    const thresholdBg = isDanger
                                        ? colors.dangerBg
                                        : isWarning
                                            ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb')
                                            : colors.successBg;

                                    const thresholdBorder = isDanger
                                        ? colors.dangerLight
                                        : isWarning
                                            ? (isDark ? 'rgba(245, 158, 11, 0.4)' : '#fcd34d')
                                            : colors.success + '33';

                                    // Progress bar width (capped at 100% visually)
                                    const barPct = Math.min(util, 100);

                                    return (
                                        <div
                                            onClick={(e) => toggleSquad(row.name)}
                                            style={{
                                                height: '90%',
                                                backgroundColor: isWarning || isDanger
                                                    ? thresholdBg
                                                    : colors.bgCard,
                                                borderLeft: `4px solid ${thresholdColor}`,
                                                padding: '0 16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                borderRadius: '0 4px 4px 0',
                                                boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                                                borderTop: `1px solid ${isWarning || isDanger ? thresholdBorder : colors.border}`,
                                                borderRight: `1px solid ${isWarning || isDanger ? thresholdBorder : colors.border}`,
                                                borderBottom: `1px solid ${isWarning || isDanger ? thresholdBorder : colors.border}`,
                                                margin: 'auto 0',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Utilisation progress bar background */}
                                            {capHours > 0 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: `${barPct}%`,
                                                    backgroundColor: isDanger
                                                        ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)')
                                                        : isWarning
                                                            ? (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)')
                                                            : (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)'),
                                                    transition: 'width 0.3s ease',
                                                    borderRight: `2px solid ${thresholdColor}40`,
                                                    pointerEvents: 'none'
                                                }} />
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', left: 0, zIndex: Z_INDEX.STICKY_COL }}
                                            >
                                                {/* +/- Expand/Collapse Button */}
                                                <div style={{
                                                    width: '22px', height: '22px', borderRadius: '4px',
                                                    backgroundColor: row.isCollapsed ? (isDark ? colors.successBg : '#f0fdf4') : colors.bgAlt,
                                                    border: `1px solid ${row.isCollapsed ? (isDark ? colors.success : '#86efac') : colors.border}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: '700', fontSize: '14px',
                                                    color: row.isCollapsed ? colors.success : colors.textMuted,
                                                    flexShrink: 0
                                                }}>
                                                    {row.isCollapsed ? '+' : '−'}
                                                </div>
                                                {/* Star icon for pinned section */}
                                                {row.isPinned && (
                                                    <svg style={{ width: '14px', height: '14px', color: '#FE9922' }} fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                    </svg>
                                                )}
                                                {/* Warning/Danger icon for high utilization */}
                                                {(isWarning || isDanger) && (
                                                    <div style={{
                                                        width: '20px', height: '20px', borderRadius: '50%',
                                                        backgroundColor: thresholdBg,
                                                        border: `1px solid ${thresholdBorder}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <svg style={{ width: '12px', height: '12px', color: thresholdColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span style={{ color: colors.text, fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.name}</span>
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: colors.bgAlt, fontSize: '9px', fontWeight: 'bold', border: `1px solid ${colors.border}`, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {row.stats.count} {viewMode === 'projects' ? 'Projects' : 'Resources'}
                                                </span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '9px',
                                                    fontWeight: 'bold',
                                                    border: `1px solid ${thresholdBorder}`,
                                                    color: thresholdColor,
                                                    backgroundColor: thresholdBg
                                                }}>
                                                    {Math.round(util)}% Util
                                                </span>
                                                {/* Hours breakdown — distinct visual treatment */}
                                                {capHours > 0 && (
                                                    <span style={{
                                                        padding: '2px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '9px',
                                                        fontWeight: '700',
                                                        letterSpacing: '0.02em',
                                                        border: `1px solid ${isDark ? 'rgba(8,47,36,0.3)' : '#bbf7d0'}`,
                                                        color: isDark ? '#a5b4fc' : '#4f46e5',
                                                        backgroundColor: isDark ? 'rgba(8,47,36,0.1)' : '#f0fdf4'
                                                    }}>
                                                        {formatNumber(demHours)}h / {formatNumber(capHours)}h
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {/* Squad Utilization Heatmap Row */}
                                {row.type === 'SQUAD_UTIL_ROW' && (
                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, backgroundColor: isDark ? '#0c1222' : '#f1f5f9' }}>
                                        {/* Sticky sidebar label */}
                                        <div style={{
                                            width: SIDEBAR_WIDTH, flexShrink: 0,
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '0 16px',
                                            position: 'sticky', left: 0,
                                            backgroundColor: isDark ? '#0c1222' : '#f1f5f9',
                                            zIndex: Z_INDEX.STICKY_COL,
                                            borderRight: `1px solid ${colors.border}`
                                        }}>
                                            <span style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                📊 Squad Util %
                                            </span>
                                            <span style={{ fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                {row.resourceCount} resources
                                            </span>
                                        </div>
                                        {/* Per-week utilisation cells */}
                                        <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                                            {colLeftOffset > 0 && <div style={{ flexShrink: 0, width: colLeftOffset }} />}
                                            {visibleDates.map(d => {
                                                const bucketKey = d.isoKey || d.dateKey;
                                                const wk = row.weeklyUtil[bucketKey] || { cap: 0, dem: 0 };
                                                const pct = wk.cap > 0 ? Math.round((wk.dem / wk.cap) * 100) : 0;
                                                // Tier model — green ≤100, amber 100-110, orange 110-120, red ≥120,
                                                // grey for very low utilisation. Matches resource-cell tiers in cell-metrics.js.
                                                const isRed = pct >= 120;
                                                const isOrange = pct >= 110 && pct < 120;
                                                const isAmber = pct >= 100 && pct < 110;
                                                const isLow = pct < 50 && wk.cap > 0;
                                                const cellColor = isRed
                                                    ? (isDark ? '#fca5a5' : '#dc2626')
                                                    : isOrange
                                                        ? (isDark ? '#fdba74' : '#ea580c')
                                                        : isAmber
                                                            ? (isDark ? '#fcd34d' : '#d97706')
                                                            : isLow
                                                                ? (isDark ? '#64748b' : '#94a3b8')
                                                                : (isDark ? '#4ade80' : '#16a34a');
                                                const cellBg = isRed
                                                    ? (isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)')
                                                    : isOrange
                                                        ? (isDark ? 'rgba(234,88,12,0.18)' : 'rgba(234,88,12,0.10)')
                                                        : isAmber
                                                            ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)')
                                                            : isLow
                                                                ? (isDark ? 'rgba(100,116,139,0.1)' : 'rgba(148,163,184,0.08)')
                                                                : (isDark ? 'rgba(74,222,128,0.1)' : 'rgba(22,163,74,0.06)');
                                                return (
                                                    <div key={d.dateKey} style={{ flexShrink: 0, width: `${columnWidth}px`, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                                        {wk.cap > 0 ? (
                                                            <div
                                                                title={`${row.name}: ${pct}% (${formatNumber(Math.round(wk.dem))}h / ${formatNumber(Math.round(wk.cap))}h)`}
                                                                style={{
                                                                    width: Math.min(columnWidth - 4, 34), height: '28px',
                                                                    borderRadius: '4px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '8px', fontWeight: '800',
                                                                    color: cellColor,
                                                                    backgroundColor: cellBg,
                                                                    border: `1px solid ${cellColor}25`,
                                                                    letterSpacing: '-0.02em'
                                                                }}
                                                            >
                                                                {pct}%
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {row.type === 'FUNC_HEADER' && (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${colors.border}`, marginLeft: '8px', backgroundColor: colors.bg, gap: '8px', position: 'sticky', left: 0, zIndex: Z_INDEX.STICKY_COL }}>
                                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.name}</span>
                                        {row.stats?.count > 0 && (
                                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: colors.textSecondary, backgroundColor: colors.bgAlt, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${colors.border}` }}>
                                                {row.stats.count} {viewMode === 'projects' ? 'PROJECTS' : 'RESOURCES'}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {/* Program Budget Row - Special Rendering */}
                                {row.type === 'RESOURCE' && row.data?.isProgram && (
                                    <div
                                        onClick={() => onCellClick({ resourceName: row.data.name, dateKey: 'program', program: row.data })}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            height: '100%',
                                            background: isDark
                                                ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)'
                                                : 'linear-gradient(135deg, rgba(209,250,229,0.8) 0%, rgba(167,243,208,0.5) 100%)',
                                            borderBottom: `1px solid ${colors.border}`,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {/* Sidebar */}
                                        <div style={{
                                            width: SIDEBAR_WIDTH,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '0 16px',
                                            position: 'sticky',
                                            left: 0,
                                            background: isDark
                                                ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.15) 100%)'
                                                : 'linear-gradient(135deg, rgba(209,250,229,1) 0%, rgba(167,243,208,0.8) 100%)',
                                            zIndex: Z_INDEX.STICKY_COL,
                                            borderRight: `1px solid ${isDark ? '#00BD00' : '#6ee7b7'}`
                                        }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '8px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#a7f3d0' : '#065f46' }}>
                                                    Program Budget
                                                </div>
                                                <div style={{ fontSize: '10px', color: isDark ? '#6ee7b7' : '#047857' }}>
                                                    {row.data.programProjects?.length || 0} projects • {formatNumber(Math.round(row.data.totalHours || 0))}h
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Normal Resource/Project Row */}
                                {row.type === 'RESOURCE' && !row.data?.isProgram && (<ResourceRow resource={row.data} dates={visibleDates} colLeftOffset={colLeftOffset} onCellClick={onCellClick} onHover={onHover} sidebarWidth={SIDEBAR_WIDTH} columnWidth={columnWidth} todayKey={todayKey} cellDisplayMode={cellDisplayMode} forecastMode={forecastMode} highlightProject={highlightProject} hoverDateKey={hoverDateKey} thresholds={thresholds} isPinned={(pinnedResources || []).includes(row.data.id)} onTogglePin={onTogglePin} viewMode={viewMode} onResourceClick={onResourceClick} isSelected={selectedProjects && selectedProjects.has(row.data.id)} onToggleSelection={onToggleSelectionWithOrder} onResourceHover={onResourceHover} focusedColIdx={focusedCell?.rowIdx === (startIndex + index) ? focusedCell.colIdx : null} />)}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Content - BAU projects render here */}
                {footerChildren && (
                    <div style={{ padding: '16px', minWidth: 'fit-content' }}>
                        {footerChildren}
                    </div>
                )}

            </div>

            {/* Floating Action Buttons */}
            <div style={{ position: 'absolute', bottom: '16px', right: '24px', zIndex: Z_INDEX.TOAST, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Jump to Today */}
                <button
                    onClick={scrollToToday}
                    style={{
                        padding: '10px 16px',
                        backgroundColor: BRAND.primary,
                        color: 'white',
                        borderRadius: '24px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(8, 47, 36, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                    }}
                    title="Jump to Today (Cmd+T)"
                >
                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Today
                </button>

                {/* Scroll to Top */}
                {showBackToTop && (
                    <button
                        onClick={scrollToTop}
                        style={{
                            padding: '12px',
                            backgroundColor: colors.bgCard,
                            color: colors.text,
                            borderRadius: '50%',
                            border: `1px solid ${colors.border}`,
                            cursor: 'pointer',
                            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        title="Scroll to Top"
                    >
                        {ICONS.ARROW_UP}
                    </button>
                )}
            </div>
        </div>
    );
});

export default InnerGrid;
