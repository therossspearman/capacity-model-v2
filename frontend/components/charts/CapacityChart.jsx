/**
 * Capacity Chart Component
 * Stacked area/bar chart showing capacity vs demand over time
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BRAND, TOKENS, useTheme } from '../../design-system';
import { getStatusColor } from '../../utils';
import { SIDEBAR_WIDTH } from '../../constants';
import StatusFilterBar from './StatusFilterBar';

// Format Y-axis values
const formatYAxis = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
};

// Custom X-axis tick to show year markers
const YearTick = ({ x, y, payload, data }) => {
    const dateKey = payload?.value;
    if (!dateKey || !data) return null;

    // Check if this is the first data point of a new year
    const currentIndex = data.findIndex(d => d.dateKey === dateKey);
    if (currentIndex < 0) return null;

    const currentYear = dateKey.split('-')[0];
    const prevItem = data[currentIndex - 1];
    const prevYear = prevItem?.dateKey?.split('-')[0];

    // Show year label at first occurrence of each year
    if (currentIndex === 0 || currentYear !== prevYear) {
        return (
            <text x={x} y={y + 15} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight="bold">
                {currentYear}
            </text>
        );
    }

    return null;
};

// Glass-style tooltip with V1 status breakdown
const GlassTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const capacity = payload.find(p => p.dataKey === 'capacity')?.value || 0;

    // Access full data object for details relative time calculation
    const dataItem = payload[0]?.payload;
    const details = dataItem?.details || [];

    // Calculate Relative Time (plain computation — this tooltip is re-created per
    // hover, so memoization adds nothing and calling hooks after the early return
    // above would violate the Rules of Hooks)
    const relativeTimeStr = (() => {
        if (!label) return '';
        try {
            const dateStr = dataItem?.isoKey || label;
            const date = new Date(dateStr);
            const today = new Date();
            const diffTime = date - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.round(diffDays / 7);

            if (diffWeeks === 0) return '(This Week)';
            if (diffWeeks === 1) return '(Next Week)';
            if (diffWeeks > 1) return `(in ${diffWeeks} wks)`;
            if (diffWeeks === -1) return '(Last Week)';
            if (diffWeeks < -1) return `(${Math.abs(diffWeeks)} wks ago)`;
            return '';
        } catch (e) { return ''; }
    })();

    // Top Drivers Logic
    const topDrivers = (!details || details.length === 0)
        ? []
        // Sort by total demand (descending)
        : [...details]
            .sort((a, b) => (b.totalNeeded || 0) - (a.totalNeeded || 0))
            .slice(0, 3);


    // Get status entries (exclude capacity, capacityBuffer, baseline_ prefixed,
    // and the non-demand overlay series slotCapacity / forecastDemand which are
    // also present in the payload but must not be summed into total demand)
    const statusEntries = payload.filter(p =>
        p.dataKey !== 'capacity' &&
        p.dataKey !== 'capacityBuffer' &&
        p.dataKey !== 'slotCapacity' &&
        p.dataKey !== 'forecastDemand' &&
        !p.dataKey.startsWith('baseline_') &&
        (p.value || 0) > 0
    );

    const totalDemand = statusEntries.reduce((sum, p) => sum + (p.value || 0), 0);
    const utilization = capacity > 0 ? Math.round((totalDemand / capacity) * 100) : 0;

    return (
        <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: '200px',
            maxWidth: '260px',
            pointerEvents: 'none'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '6px'
            }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{label}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>{relativeTimeStr}</span>
            </div>

            {/* Capacity & Utilization */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8' }}>Capacity:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{Math.round(capacity).toLocaleString()}h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8' }}>Demand:</span>
                <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: totalDemand > capacity ? '#ef4444' : '#00BD00'
                }}>
                    {Math.round(totalDemand).toLocaleString()}h
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Utilization:</span>
                <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: utilization > 100 ? '#ef4444' : utilization > 80 ? '#f59e0b' : '#00BD00'
                }}>
                    {utilization}%
                </span>
            </div>

            {/* Top Drivers Section */}
            {topDrivers.length > 0 && (
                <div style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Top Drivers
                    </div>
                    {topDrivers.map((d, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                            <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                {d.name}
                            </span>
                            <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                                {Math.round(d.totalNeeded || 0)}h
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Status Breakdown */}
            {statusEntries.length > 0 && (
                <div style={{ fontSize: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Breakdown
                    </div>
                    {statusEntries.slice(0, 5).map((entry, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: entry.color, flexShrink: 0 }} />
                            <span style={{ color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.dataKey}:</span>
                            <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>{Math.round(entry.value || 0)}h</span>
                        </div>
                    ))}
                    {statusEntries.length > 5 && (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>+{statusEntries.length - 5} more...</div>
                    )}
                </div>
            )}
        </div>
    );
};

// Internal Chart Component (Stable Fixed Dimensions)
const CapacityChartDisplay = React.memo(({ data, statusOrder, hiddenLines, hoverStatus, yAxisDomain, onBarClick, todayKey, forecastMode, capacityBuffer = 10, showSlots, showFinanceForecast = false, fyStartKey = null }) => {
    const cleanId = (str) => str.replace(/[^a-zA-Z0-9-_]/g, '_');

    const gradientDefs = useMemo(() => (
        <defs>
            <linearGradient id="gradCapacity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.2} />
                <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0.02} />
            </linearGradient>
            {/* Finance Forecast Gradient - Blue */}
            <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            {statusOrder.map((s, i) => (
                <linearGradient key={`grad-${s}`} id={`grad-${cleanId(s)}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getStatusColor(s, i)} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={getStatusColor(s, i)} stopOpacity={0.2} />
                </linearGradient>
            ))}
        </defs>
    ), [statusOrder]);

    if (!data || data.length === 0) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No chart data available
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '200px', cursor: 'pointer', outline: 'none' }} tabIndex={-1}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <ComposedChart
                    data={data}
                    margin={{ top: 30, right: 30, left: 0, bottom: 0 }}
                    onClick={(state) => {
                        // Use activeIndex to look up data directly since activePayload can be empty for Area charts
                        if (state && state.activeIndex !== undefined && onBarClick) {
                            const idx = parseInt(state.activeIndex, 10);
                            if (!isNaN(idx) && data[idx]) {
                                onBarClick(data[idx]);
                            }
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <YAxis
                        width={SIDEBAR_WIDTH}
                        yAxisId="left"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8' }}
                        tickFormatter={formatYAxis}
                        domain={yAxisDomain || ['auto', 'auto']}
                    />
                    <XAxis
                        dataKey="dateKey"
                        tick={false}
                        height={10}
                        axisLine={false}
                        tickLine={false}
                    />
                    {gradientDefs}
                    <Tooltip content={<GlassTooltip />} cursor={{ stroke: BRAND.primary, strokeWidth: 1 }} isAnimationActive={false} />



                    {/* Capacity Buffer Line */}
                    {forecastMode !== 'impact' && (
                        <Line
                            yAxisId="left"
                            type="stepAfter"
                            dataKey="capacityBuffer"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                        />
                    )}

                    {/* Slot Capacity Overlay */}
                    {showSlots && (
                        <Line
                            yAxisId="left"
                            type="stepAfter"
                            dataKey="slotCapacity"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            strokeDasharray="3 3"
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                            name="Slot Capacity"
                        />
                    )}

                    {/* Capacity Line */}
                    {forecastMode !== 'impact' && (
                        <Area
                            yAxisId="left"
                            type="stepAfter"
                            dataKey="capacity"
                            stroke="#1e293b"
                            strokeWidth={2}
                            fill="url(#gradCapacity)"
                            activeDot={false}
                            isAnimationActive={false}
                            fillOpacity={0.1}
                            dot={false}
                        />
                    )}

                    {/* Status stacked areas */}
                    {(statusOrder || []).map((s, i) => {
                        if ((hiddenLines || []).includes(s)) return null;
                        if (forecastMode === 'impact') {
                            return (
                                <Bar
                                    key={s}
                                    yAxisId="left"
                                    dataKey={s}
                                    stackId="a"
                                    fill={getStatusColor(s, i)}
                                    isAnimationActive={false}
                                    opacity={(hoverStatus && hoverStatus !== s) ? 0.3 : 1}
                                />
                            );
                        }
                        return (
                            <Area
                                key={`eac_${s}`}
                                yAxisId="left"
                                type="monotone"
                                dataKey={s}
                                stackId="eac_stack"
                                stroke={getStatusColor(s, i)}
                                strokeWidth={0}
                                fill={`url(#grad-${cleanId(s)})`}
                                fillOpacity={1}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                isAnimationActive={false}
                                opacity={(hoverStatus && hoverStatus !== s) ? 0.3 : 1}
                            />
                        );
                    })}

                    {forecastMode === 'eac' && statusOrder.map((s, i) => {
                        if ((hiddenLines || []).includes(s)) return null;
                        return (
                            <Area
                                key={`model_${s}`}
                                yAxisId="left"
                                type="monotone"
                                dataKey={`baseline_${s}`}
                                stackId="model_stack"
                                stroke={getStatusColor(s, i)}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                fill="none"
                                isAnimationActive={false}
                                activeDot={false}
                                opacity={0.6}
                            />
                        );
                    })}

                    {forecastMode === 'impact' && (
                        <ReferenceLine yAxisId="left" y={0} stroke="#000" />
                    )}

                    {todayKey && (
                        <ReferenceLine
                            yAxisId="left"
                            x={todayKey}
                            stroke="#f97316"
                            strokeWidth={2}
                            label={{ position: 'top', value: 'Today', fill: '#f97316', fontSize: 10, fontWeight: 'bold' }}
                        />
                    )}

                    {/* Finance Forecast Area - Blue (stacks on top of existing demand) */}
                    {showFinanceForecast && (
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="forecastDemand"
                            stackId="eac_stack"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#gradForecast)"
                            fillOpacity={0.8}
                            isAnimationActive={false}
                            dot={false}
                            connectNulls={false}
                            name="Finance Forecast"
                        />
                    )}

                    {/* FY Start Reference Line */}
                    {showFinanceForecast && fyStartKey && (
                        <ReferenceLine
                            yAxisId="left"
                            x={fyStartKey}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{ position: 'top', value: 'FY Start', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
});

// Export internal component alias for legacy compatibility
export const CapacityChart = CapacityChartDisplay;

// Main Export Component (V1: ChartSection)
export const ChartSection = React.memo(({ data, statusOrder, yAxisDomain, onBarClick, todayKey, forecastMode, capacityBuffer, columnWidth = 50, slotMap, enabledSquads = [], showSlots = false, showFinanceForecast = false, financeForecastData = null, fyStartKey = null }) => {
    const { isDark, colors } = useTheme();
    // Early return if no data - prevents ResponsiveContainer rendering with invalid dimensions
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
                Loading chart data...
            </div>
        );
    }

    // Calculate chart width to match grid alignment
    const chartWidth = SIDEBAR_WIDTH + (data.length * columnWidth);
    const [hoverStatus, setHoverStatus] = useState(null);
    const [hiddenLines, setHiddenLines] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('capacityHiddenLines') || '[]');
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('capacityHiddenLines', JSON.stringify(hiddenLines));
    }, [hiddenLines]);

    const handleLegendClick = useCallback((status) => {
        // V1 Logic: Alt/Meta key solo mode
        if (window.event && (window.event.altKey || window.event.metaKey)) {
            const allOtherStatuses = statusOrder.filter(s => s !== status);
            setHiddenLines(prev =>
                (prev.length === allOtherStatuses.length && !prev.includes(status))
                    ? []
                    : allOtherStatuses
            );
        } else {
            setHiddenLines(prev =>
                prev.includes(status)
                    ? prev.filter(k => k !== status)
                    : [...prev, status]
            );
        }
    }, [statusOrder]);

    // Merge Slot Data if enabled
    const processedData = useMemo(() => {
        if (!showSlots || !slotMap || !enabledSquads) return data;
        return data.map(d => {
            let slotCap = 0;
            enabledSquads.forEach(squad => {
                if (slotMap[squad] && slotMap[squad][d.dateKey]) {
                    slotCap += (slotMap[squad][d.dateKey].available || 0); // Use available capacity
                }
            });
            return { ...d, slotCapacity: slotCap };
        });
    }, [data, showSlots, slotMap, enabledSquads]);

    // Merge Finance Forecast Data if enabled
    const forecastMergedData = useMemo(() => {
        if (!showFinanceForecast || !financeForecastData || !Array.isArray(financeForecastData)) return processedData;

        return processedData.map(d => {
            const forecastEntry = financeForecastData.find(f => f.dateKey === d.dateKey);
            // Only merge forecast data when there's actual demand (> 0)
            // Use null for non-FY dates so Recharts treats them as gaps (with connectNulls=false)
            if (forecastEntry && forecastEntry.forecastDemand > 0) {
                return {
                    ...d,
                    forecastDemand: forecastEntry.forecastDemand,
                    forecastPm: forecastEntry.forecastPm || 0,
                    forecastSc: forecastEntry.forecastSc || 0,
                    forecastPd: forecastEntry.forecastPd || 0
                };
            }
            // Explicitly set null so stacked area doesn't render at zero height
            return { ...d, forecastDemand: null };
        });
    }, [processedData, showFinanceForecast, financeForecastData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* Header/Legend */}
            <div style={{
                position: 'sticky',
                left: 0,
                width: '100%',
                paddingBottom: '16px',
                zIndex: 10,
                background: isDark
                    ? 'linear-gradient(180deg, rgba(26,27,38,0.95) 85%, rgba(26,27,38,0) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.95) 85%, rgba(255,255,255,0) 100%)'
            }}>
                <StatusFilterBar
                    statuses={(statusOrder || []).slice().reverse()}
                    hiddenLines={hiddenLines}
                    onToggle={handleLegendClick}
                    onHover={setHoverStatus}
                    onLeave={() => setHoverStatus(null)}
                />
            </div>

            {/* Chart Container - Width matches grid for alignment */}
            <div style={{ height: '400px', width: chartWidth, marginBottom: '16px' }}>
                <CapacityChartDisplay
                    data={forecastMergedData}
                    statusOrder={statusOrder}
                    hiddenLines={hiddenLines}
                    hoverStatus={hoverStatus}
                    yAxisDomain={yAxisDomain}
                    onBarClick={onBarClick}
                    todayKey={todayKey}
                    forecastMode={forecastMode}
                    capacityBuffer={capacityBuffer}
                    showSlots={showSlots}
                    showFinanceForecast={showFinanceForecast}
                    fyStartKey={fyStartKey}
                />
            </div>
        </div>
    );
});

export default ChartSection;
