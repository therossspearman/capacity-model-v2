/**
 * SlotOverlayChart - Discrete Slot Timeline with Collapsible Squads
 * Shows individual delivery slots aligned with chart columns
 * Sidebar is sticky to left edge during horizontal scroll
 */
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../design-system';

const SIDEBAR_WIDTH = 260; // Match InnerGrid's sidebar width for alignment

/**
 * Parse a YYYY-MM-DD date key as LOCAL midnight.
 * `new Date('2026-06-03')` parses as UTC midnight, which can shift the day
 * by one relative to local-time comparisons (e.g. the "today" cutoff below).
 * Falls back to the native parser for any non-ISO-date input.
 */
const parseDateKey = (dateKey) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(dateKey);
};

/**
 * Generate slot taxonomy ID
 */
const generateSlotId = (squad, slotNum, dateKey) => {
    const squadInitial = (squad || 'X').charAt(0).toUpperCase();
    const d = parseDateKey(dateKey);
    // Fiscal year starts in May (month index 4): May onward belongs to next FY.
    const fy = d.getMonth() >= 4 ? d.getFullYear() + 1 : d.getFullYear();
    const fyShort = String(fy).slice(-2);
    const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
    return `${squadInitial}${slotNum}FY${fyShort}W${weekNum}`;
};

/**
 * Extract discrete slots from slotMap
 */
const extractDiscreteSlots = (slotMap, dateRange, squad, durationWeeks = 12) => {
    if (!slotMap?.[squad] || !dateRange?.length) return [];

    const squadData = slotMap[squad];
    const slots = [];
    const consumedSlots = {};
    dateRange.forEach(dk => { consumedSlots[dk] = 0; });

    // Today at midnight for comparison
    const todayMs = new Date().setHours(0, 0, 0, 0);

    let slotNum = 1;

    dateRange.forEach((dateKey, colIndex) => {
        const bucket = squadData[dateKey];
        if (!bucket) return;

        // Skip past dates - slots cannot start before today
        const dateMs = parseDateKey(dateKey).getTime();
        if (dateMs < todayMs) return;

        const rawAvailable = bucket.availableSlots || 0;
        const alreadyConsumed = consumedSlots[dateKey] || 0;
        const netAvailable = Math.max(0, rawAvailable - alreadyConsumed);
        const wholeSlots = Math.floor(netAvailable);

        if (wholeSlots < 1) return;

        for (let s = 0; s < wholeSlots; s++) {
            for (let w = 0; w < durationWeeks && colIndex + w < dateRange.length; w++) {
                const futureKey = dateRange[colIndex + w];
                consumedSlots[futureKey] = (consumedSlots[futureKey] || 0) + 1;
            }

            const endColIndex = Math.min(colIndex + durationWeeks - 1, dateRange.length - 1);
            const endDateKey = dateRange[endColIndex];

            slots.push({
                id: `${squad}-slot-${slotNum}`,
                squad,
                startDateKey: dateKey,
                endDateKey,
                startColIndex: colIndex,
                endColIndex,
                slotNum,
                taxonomyId: bucket.slotIds?.[s] || generateSlotId(squad, slotNum, dateKey),
                score: bucket.score || 0.8,
                bottleneck: bucket.bottleneck
            });
            slotNum++;
        }
    });

    return slots;
};

export const SlotOverlayChart = React.memo(({ slotMap, enabledSquads = [], dateScaffold = [], columnWidth = 50, slotProfile }) => {
    const { isDark, colors } = useTheme();
    const [collapsedSquads, setCollapsedSquads] = useState(new Set());

    const durationWeeks = slotProfile?.durationWeeks || 12;

    const dateRange = useMemo(() => {
        return (dateScaffold || []).map(d => d.isoKey).filter(Boolean);
    }, [dateScaffold]);

    const squadData = useMemo(() => {
        const result = [];
        (enabledSquads || []).forEach(squad => {
            const squadSlots = extractDiscreteSlots(slotMap, dateRange, squad, durationWeeks);
            if (squadSlots.length > 0) {
                result.push({ squad, slots: squadSlots, slotCount: squadSlots.length });
            }
        });
        return result;
    }, [slotMap, enabledSquads, dateRange, durationWeeks]);

    const totalSlots = squadData.reduce((sum, sq) => sum + sq.slotCount, 0);
    const chartWidth = SIDEBAR_WIDTH + (dateRange.length * columnWidth);
    const headerHeight = 26;
    const slotRowHeight = 26;

    const toggleSquad = (squad) => {
        setCollapsedSquads(prev => {
            const next = new Set(prev);
            if (next.has(squad)) next.delete(squad);
            else next.add(squad);
            return next;
        });
    };

    const expandAll = () => setCollapsedSquads(new Set());
    const collapseAll = () => setCollapsedSquads(new Set(squadData.map(s => s.squad)));

    if (!slotMap || enabledSquads.length === 0 || dateRange.length === 0) {
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
                No slot data available.
            </div>
        );
    }

    if (totalSlots === 0) {
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
                No open delivery slots available.
            </div>
        );
    }

    // Build flat row list for rendering
    const rows = [];
    squadData.forEach((sq, sqIdx) => {
        const isCollapsed = collapsedSquads.has(sq.squad);
        rows.push({ type: 'header', squad: sq.squad, slotCount: sq.slotCount, isCollapsed, sqIdx });
        if (!isCollapsed) {
            sq.slots.forEach(slot => {
                rows.push({ type: 'slot', ...slot });
            });
        }
    });

    return (
        <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            backgroundColor: colors.bgAlt,
            width: chartWidth,
            minWidth: chartWidth
        }}>
            {/* Header - sticky to top within scroll */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: isDark ? '#0f172a' : 'white',
                position: 'sticky',
                left: 0,
                width: 'fit-content',
                minWidth: '100%',
                zIndex: 5
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00BD00" strokeWidth="2" style={{ marginRight: '8px' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                    Open Delivery Slots
                </span>
                <span style={{
                    marginLeft: '10px',
                    fontSize: '10px',
                    color: 'white',
                    backgroundColor: '#00BD00',
                    padding: '2px 6px',
                    borderRadius: '4px'
                }}>
                    {totalSlots}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button onClick={expandAll} title="Expand all" style={{ padding: '3px 6px', fontSize: '9px', fontWeight: '600', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: colors.textMuted, border: 'none', borderRadius: '3px', cursor: 'pointer' }}>▼</button>
                    <button onClick={collapseAll} title="Collapse all" style={{ padding: '3px 6px', fontSize: '9px', fontWeight: '600', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: colors.textMuted, border: 'none', borderRadius: '3px', cursor: 'pointer' }}>▶</button>
                </div>
                <span style={{ marginLeft: '8px', fontSize: '9px', color: colors.textMuted }}>{durationWeeks}w/slot</span>
            </div>

            {/* Rows - each row is a flex container with sticky sidebar */}
            {rows.map((row, idx) => {
                if (row.type === 'header') {
                    return (
                        <div key={`h-${row.squad}`} style={{ display: 'flex', borderTop: row.sqIdx > 0 ? `1px solid ${colors.border}` : 'none' }}>
                            {/* Sticky Squad Header */}
                            <div
                                onClick={() => toggleSquad(row.squad)}
                                style={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 4,
                                    width: SIDEBAR_WIDTH,
                                    height: headerHeight,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{ fontSize: '9px', color: colors.textMuted, transition: 'transform 0.15s', transform: row.isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>▶</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.squad}
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: 'white', backgroundColor: '#00BD00', padding: '1px 5px', borderRadius: '3px' }}>{row.slotCount}</span>
                            </div>
                            {/* Empty timeline area for header */}
                            <div style={{ flex: 1, height: headerHeight, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }} />
                        </div>
                    );
                } else {
                    // Slot row
                    const left = row.startColIndex * columnWidth;
                    const width = Math.max((row.endColIndex - row.startColIndex + 1) * columnWidth - 4, columnWidth - 4);
                    const healthColor = row.score >= 0.8 ? '#00BD00' : row.score >= 0.5 ? '#f59e0b' : '#ef4444';

                    return (
                        <div key={row.id} style={{ display: 'flex', borderTop: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` }}>
                            {/* Sticky Slot Label */}
                            <div style={{
                                position: 'sticky',
                                left: 0,
                                zIndex: 3,
                                width: SIDEBAR_WIDTH,
                                height: slotRowHeight,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 10px',
                                gap: '6px',
                                backgroundColor: isDark ? '#0f172a' : 'white',
                                flexShrink: 0,
                                borderRight: `1px solid ${colors.border}`
                            }}>
                                <span style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    color: 'white',
                                    backgroundColor: healthColor,
                                    padding: '2px 5px',
                                    borderRadius: '3px',
                                    minWidth: '60px',
                                    textAlign: 'center'
                                }}>
                                    {row.taxonomyId}
                                </span>
                                <span style={{ fontSize: '9px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                                    {parseDateKey(row.startDateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            {/* Timeline with bar */}
                            <div style={{ position: 'relative', height: slotRowHeight, flex: 1 }}>
                                <div
                                    title={`${row.taxonomyId} • ${row.startDateKey} to ${row.endDateKey} (${durationWeeks}w)`}
                                    style={{
                                        position: 'absolute',
                                        left: left + 2,
                                        top: 3,
                                        width: width,
                                        height: slotRowHeight - 6,
                                        backgroundColor: healthColor,
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: '8px',
                                        color: 'white',
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {width > 100 && row.taxonomyId}
                                </div>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    );
});

export default SlotOverlayChart;
