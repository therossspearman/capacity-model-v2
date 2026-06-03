import React, { useMemo } from 'react';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { getCellMetrics, getStatusColor, formatNumber } from '../../utils';

const ResourceRow = React.memo(({ resource, dates, colLeftOffset, onCellClick, onHover, sidebarWidth, columnWidth, todayKey, cellDisplayMode, forecastMode, highlightProject, hoverDateKey, thresholds, isPinned, onTogglePin, viewMode, onResourceClick, isSelected, onToggleSelection, onResourceHover, focusedColIdx }) => {
    const { isDark, colors } = useTheme();
    const isZeroCap = resource.effectiveHours === 0 && (resource.targetUtilization ?? 0.8) !== 0 && viewMode !== 'projects';
    const isUnassigned = resource.name.toLowerCase().includes('unassigned');
    const isProjectView = viewMode === 'projects';

    // Determine if project has team members assigned (PM/SC/PD)
    // A project is "resourced" if it has any non-placeholder team members
    const hasTeamMembers = useMemo(() => {
        if (!isProjectView) return false;

        const team = resource.team;
        if (!team) return false;

        // Check each role category for actual team members
        const placeholderPattern = /^(tbd|tbh|tba|unassigned|placeholder|pending|vacant)/i;

        const checkRole = (members) => {
            if (!Array.isArray(members) || members.length === 0) return false;
            // Has at least one non-placeholder member
            return members.some(m => m && m.name && !placeholderPattern.test(m.name.trim()));
        };

        return checkRole(team.pm) || checkRole(team.sc) || checkRole(team.pd) || checkRole(team.build);
    }, [isProjectView, resource.team]);

    const rowHasProject = useMemo(() => {
        if (!highlightProject) return true;
        return Object.values(resource.buckets || {}).some(b =>
            Array.isArray(b.projects) && b.projects.some(p => p.name.toLowerCase().includes(highlightProject.toLowerCase()))
        );
    }, [resource, highlightProject]);

    const isDimmedRow = highlightProject && !rowHasProject;

    return (
        <div data-tour="resource-row" style={{ display: 'flex', alignItems: 'center', borderRadius: '0 4px 4px 0', padding: '4px', transition: 'all 0.3s', height: '100%', opacity: isZeroCap || isDimmedRow || resource.isPending ? (isDimmedRow ? 0.2 : 0.5) : 1, filter: isZeroCap ? 'grayscale(1)' : 'none' }}>
            {/* STICKY LEFT SIDEBAR */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', paddingRight: '8px', backgroundColor: colors.bgCard, borderRight: `1px solid ${colors.border}`, position: 'sticky', left: 0, height: '100%', boxShadow: isDark ? '4px 0 12px -4px rgba(0, 0, 0, 0.3)' : '4px 0 12px -4px rgba(0, 0, 0, 0.05)', zIndex: Z_INDEX.STICKY_COL, width: `${sidebarWidth}px` }}>
                {isProjectView && onToggleSelection && (
                    <input
                        type="checkbox"
                        checked={isSelected || false}
                        // onClick carries shiftKey reliably (MouseEvent); onChange does not (Event, not MouseEvent).
                        // We drive selection entirely from onClick and keep a no-op onChange just to satisfy
                        // React's controlled-checkbox warning.
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelection(resource.id, e.shiftKey);
                        }}
                        onChange={() => { }}
                        style={{ width: '14px', height: '14px', borderRadius: '4px', borderColor: '#cbd5e1', accentColor: '#7637E3', cursor: 'pointer' }}
                    />
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onTogglePin) {
                            onTogglePin(resource.id);
                        }
                    }}
                    style={{
                        color: isPinned ? '#eab308' : '#cbd5e1',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        transition: 'color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => !isPinned && (e.currentTarget.style.color = BRAND.benifexPurple)}
                    onMouseLeave={(e) => !isPinned && (e.currentTarget.style.color = '#cbd5e1')}
                    title={isPinned ? 'Unpin from top' : 'Pin to top'}
                >
                    {isPinned ? ICONS.STAR : ICONS.STAR_OUTLINE}
                </button>
                {isProjectView ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', width: '100%' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{ width: '6px', height: '32px', borderRadius: '999px', backgroundColor: getStatusColor(resource.status, 0) }}></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    onClick={() => {
                                        if (!onCellClick) {
                                            console.warn('onCellClick handler not provided');
                                            return;
                                        }
                                        const buckets = Object.values(resource.buckets || {});
                                        const firstBucket = buckets.find(b => b && Math.abs(b.dem || 0) > 0) || buckets[0];
                                        if (firstBucket && firstBucket.projects && firstBucket.projects.length > 0) {
                                            const dateKey = Object.keys(resource.buckets).find(k => resource.buckets[k] === firstBucket);
                                            onCellClick({ resourceName: resource.name, dateKey: dateKey || '', bucketData: firstBucket });
                                        } else {
                                            onCellClick({ resourceName: resource.name, dateKey: '', bucketData: { projects: [resource] } });
                                        }
                                    }}
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: colors.text,
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        minWidth: 0,
                                        flex: 1
                                    }}
                                    title={`Click to view ${resource.name} details`}
                                >
                                    {resource.name}
                                </button>
                                {/* Resourcing Indicators */}
                                {resource.resourced && (
                                    <span title="Resourced" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                        <svg style={{ width: '14px', height: '14px', color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                )}
                                {resource.resourcingNotes && (
                                    <span title={resource.resourcingNotes} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                        <svg style={{ width: '13px', height: '13px', color: '#7637E3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                {resource.status} {resource.wave && <span style={{ color: '#818cf8' }}>• {resource.wave}</span>}
                            </span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Avatar with optional country flag overlay */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            {isUnassigned ? (
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#fffbeb', // amber-50
                                    border: '1px solid #fcd34d', // amber-300
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    color: '#d97706' // amber-600
                                }} title="Unassigned Demand">
                                    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                            ) : resource.headshot ? (
                                <img
                                    src={resource.headshot}
                                    alt={resource.name}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: `1px solid ${BRAND.border}`
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: BRAND.bgAlt,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    color: '#64748b'
                                }}>
                                    {resource.name.charAt(0)}
                                </div>
                            )}
                            {!isUnassigned && resource.countryFlag && (
                                <img
                                    src={resource.countryFlag}
                                    alt={resource.country || 'Country'}
                                    style={{
                                        position: 'absolute',
                                        bottom: '-2px',
                                        right: '-2px',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1px solid white',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}
                                    title={resource.country || 'Country'}
                                />
                            )}
                        </div>
                        {/* Name - clickable button without box */}
                        <button
                            onClick={() => onResourceClick && onResourceClick(resource)}
                            onDoubleClick={() => onResourceClick && onResourceClick(resource)}
                            onMouseEnter={(e) => {
                                if (onResourceHover && !isUnassigned) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onResourceHover({ resource, position: { x: rect.right + 8, y: rect.top } });
                                }
                            }}
                            onMouseLeave={() => onResourceHover && onResourceHover(null)}
                            style={{
                                fontSize: '12px',
                                fontWeight: isUnassigned ? '700' : '500',
                                color: isUnassigned ? colors.textSecondary : colors.text, // Theme-aware text
                                textTransform: isUnassigned ? 'uppercase' : 'none',
                                letterSpacing: isUnassigned ? '0.05em' : 'normal',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                minWidth: 0,
                                width: '100%'
                            }}
                            title="Click or double-click to edit profile"
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {resource.name}
                            </span>
                            {resource.lockLaunch && (
                                <span style={{ marginLeft: '6px', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Launch date is locked">
                                    {ICONS.LOCK}
                                </span>
                            )}
                        </button>
                        {/* Ramp-up indicator badge */}
                        {resource.rampProfile && (
                            <span style={{
                                fontSize: '7px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                border: '1px solid #fde68a',
                                marginLeft: '4px',
                                whiteSpace: 'nowrap'
                            }} title={`Ramping: ${resource.rampProfile}`}><svg style={{ width: '8px', height: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></span>
                        )}
                        {/* Hypercare badge — Benifex projects with a configured hypercare phase */}
                        {isProjectView && resource.hcWeeks > 0 && (
                            <span style={{
                                fontSize: '8px',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#fffbeb',
                                color: '#b45309',
                                fontWeight: '700',
                                letterSpacing: '0.02em',
                                border: '1px solid #fde68a',
                                marginLeft: '4px',
                                whiteSpace: 'nowrap'
                            }} title={`Hypercare phase: ${resource.hcWeeks} weeks of fixed support after Launch (may extend past the visible grid range)`}>
                                +{resource.hcWeeks}w HC
                            </span>
                        )}
                    </>
                )}
            </div>

            <div style={{ display: 'flex', height: '100%' }}>
                {colLeftOffset > 0 && <div style={{ flexShrink: 0, width: colLeftOffset }} />}
                {dates.map((dateObj, dateIdx) => {
                    const key = dateObj.isoKey || dateObj.dateKey;
                    const bucket = (resource.buckets && resource.buckets[key]) || { cap: 0, dem: 0, planned: 0, projects: [] };
                    // Normalize once — real worker buckets may omit dem/cap, in which case
                    // Math.abs(undefined) -> NaN and `bucket.cap === 0` would be false.
                    const bucketDem = bucket.dem || 0;
                    const bucketCap = bucket.cap || 0;
                    const isToday = dateObj.dateKey === todayKey;
                    const isColHover = hoverDateKey === dateObj.dateKey;
                    const isOOO = bucketCap === 0 && !isProjectView;

                    // Unavailable-period detection — resource has 0 capacity here because they're
                    // either (a) past their departure date, (b) not yet started, or (c) inside a
                    // temporary leave range. Any of the three should show the diagonal stripes and
                    // suppress the cell text. Mirrors `isResourceUnavailable` in the worker.
                    let isOnLeave = false;
                    if (!isProjectView) {
                        const bucketDate = new Date(dateObj.rawDate || dateObj.dateKey).getTime();
                        // (a) After departure / employment end
                        if (resource.leaveDate) {
                            const ld = new Date(resource.leaveDate).getTime();
                            if (!isNaN(ld) && bucketDate > ld) isOnLeave = true;
                        }
                        // (b) Before employment start
                        if (!isOnLeave && resource.startDate) {
                            const ss = new Date(resource.startDate).getTime();
                            if (!isNaN(ss) && bucketDate < ss) isOnLeave = true;
                        }
                        // (c) Inside temporary leave range
                        if (!isOnLeave && resource.leaveStartDate && resource.leaveEndDate) {
                            const leaveStart = new Date(resource.leaveStartDate).getTime();
                            const leaveEnd = new Date(resource.leaveEndDate).getTime();
                            if (bucketDate >= leaveStart && bucketDate <= leaveEnd) isOnLeave = true;
                        }
                    }

                    // Ramp-up period detection - bucket.isRamping flag from worker if available
                    // Otherwise check if capacity is reduced due to ramp profile
                    let isRamping = false;
                    if (resource.rampProfile && !isProjectView && !isOOO && !isOnLeave) {
                        // If bucket has reduced capacity compared to full capacity, it's ramping
                        // We check bucket.isRamping if set by worker, or infer from capacity < expected
                        isRamping = bucket.isRamping || (bucket.cap > 0 && bucket.cap < (resource.effectiveHours || 40) * 0.95);
                    }

                    const hasSlotAllocation = bucket.projects && bucket.projects.some(p => p._metadata && p._metadata.source === 'slot');

                    let displayContent;
                    let mainHeightPercent, shadowHeightPercent;
                    let mainColor, shadowColor;
                    let isOverloaded = false;
                    // Local stacked-bar metrics (project view). Computed per render and read
                    // directly in JSX below — never written back onto the shared bucket object.
                    let resourcedHeightPct = 0;
                    let unresourcedHeightPct = 0;
                    let hasStackedBars = false;

                    if (isProjectView) {
                        const planned = bucket.planned || 0;
                        let eac = bucket.dem || 0;
                        if (forecastMode === 'eac') eac = bucket.dem_eac || bucket.dem || 0;
                        else if (forecastMode === 'impact') eac = bucket.dem_imp || 0;

                        const scaleMax = 50; // Use 50h as '100%' height for visualization

                        if (forecastMode === 'impact') {
                            const impact = eac;
                            shadowHeightPercent = 0;
                            mainHeightPercent = Math.min(Math.abs(impact) / scaleMax * 100, 100);
                            shadowColor = 'transparent';
                            if (impact > 0.5) mainColor = '#ef4444'; // Red - overburn
                            else if (impact < -0.5) mainColor = BRAND.success; // Green - savings
                            else mainColor = 'transparent';
                            displayContent = Math.abs(impact) > 0.1 ? (impact > 0 ? `+${Math.ceil(impact)}` : Math.floor(impact)) : '';
                        } else {
                            shadowHeightPercent = Math.min((planned / scaleMax) * 100, 100);
                            mainHeightPercent = Math.min((eac / scaleMax) * 100, 100);

                            // Per-bucket resourced percentage calculation
                            // bucket.assigned = hours with real team members assigned
                            // bucket.dem = total demand hours for this bucket
                            const totalDemand = eac > 0 ? eac : (bucket.dem || 0);
                            const assignedHours = bucket.assigned || 0;

                            // Calculate resourced percentage (clamped 0-100%)
                            let resourcedPct = totalDemand > 0.1 ? Math.min(100, (assignedHours / totalDemand) * 100) : 0;

                            // Placeholder row check - if project name is a placeholder, force 0% resourced
                            const placeholderPatterns = /^(tbd|tbh|tba|unassigned|placeholder|pending|vacant)/i;
                            const isPlaceholderRow = resource.name && placeholderPatterns.test(resource.name.trim());
                            if (isPlaceholderRow || bucket.hasPlaceholder) {
                                resourcedPct = 0;
                            }

                            // Split the bar height into resourced (purple) and unresourced (red)
                            resourcedHeightPct = (resourcedPct / 100) * mainHeightPercent;
                            unresourcedHeightPct = mainHeightPercent - resourcedHeightPct;

                            // For color, use dark purple for EAC text color since we have mixed bars
                            mainColor = totalDemand > 0.1 ? '#7637E3' : 'transparent';

                            // Shadow color for planned bar
                            shadowColor = resourcedPct > 0 ? '#7637E3' : '#e2e8f0';

                            // Flag for the stacked-bar render path below
                            hasStackedBars = totalDemand > 0.1;

                            displayContent = Math.ceil(eac);
                            if (Math.abs(eac) < 0.1 && Math.abs(planned) < 0.1) displayContent = '';
                        }
                    } else {
                        // Resource View Logic
                        const metrics = getCellMetrics(bucket, forecastMode, thresholds);

                        // Default to hours content
                        displayContent = metrics.content;

                        if (cellDisplayMode === 'percent') {
                            displayContent = bucket.cap > 0 ? `${Math.round(metrics.util * 100)}%` : '';
                        } else if (cellDisplayMode === 'heatmap') {
                            displayContent = ''; // No text, just color
                        }

                        mainHeightPercent = metrics.heightPercent;
                        mainColor = metrics.barColor;
                        isOverloaded = metrics.isOverloaded;
                    }


                    return (
                        <div key={key} data-tour="capacity-cell" style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', borderRight: `1px solid ${BRAND.border}70`, width: `${columnWidth}px`, backgroundColor: isToday ? `${BRAND.primary}0D` : (isColHover ? BRAND.bgAlt : 'transparent'), transition: 'opacity 0.3s', ...(focusedColIdx !== null && focusedColIdx === dateIdx + (colLeftOffset / columnWidth) ? { outline: '2px solid #7637E3', outlineOffset: '-2px', borderRadius: '4px', zIndex: 5 } : {}) }}>
                            {isUnassigned ? (
                                <div style={{
                                    width: '90%',
                                    height: '80%',
                                    borderRadius: '10px',
                                    backgroundColor: '#fffbeb', // amber-50
                                    border: '1px solid #fcd34d', // amber-300
                                    color: '#b45309', // amber-700
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: '700'
                                }}>
                                    {(bucket.dem || 0) > 0.1 ? formatNumber(Math.ceil(bucket.dem)) : ''}
                                </div>
                            ) : (
                                <div
                                    onClick={() => Math.abs(bucketDem) > 0 && onCellClick({ resourceName: resource.name, dateKey: dateObj.dateKey, bucketData: bucket })}
                                    onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onHover({ x: rect.left + rect.width / 2, y: rect.top, data: { ...bucket, dateKey: dateObj.dateKey } }); }}
                                    onMouseLeave={() => onHover(null)}
                                    style={{
                                        width: '90%',
                                        height: '80%',
                                        borderRadius: '6px',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s',
                                        cursor: Math.abs(bucketDem) > 0 ? 'pointer' : 'default',
                                        backgroundColor: isOnLeave ? (isDark ? '#1e293b' : '#f1f5f9') : (isOOO ? colors.bgHover : 'transparent'),
                                        // Visual Indicator for Slot Allocations (purple dashed border)
                                        ...(hasSlotAllocation && {
                                            border: `2px dashed ${BRAND.violet}`, // Accent violet (#BD65FF)
                                            boxShadow: `inset 0 0 4px ${BRAND.violet}20` // Subtle glow
                                        }),
                                        // Diagonal stripe patterns — leave + OOO both use a muted slate hash
                                        // (yellow read as "active capacity"; muted grey reads cleanly as "unavailable")
                                        ...(isOnLeave && {
                                            background: isDark
                                                ? 'repeating-linear-gradient(135deg, #334155, #334155 2px, #1e293b 2px, #1e293b 6px)'
                                                : 'repeating-linear-gradient(135deg, #cbd5e1, #cbd5e1 2px, #f1f5f9 2px, #f1f5f9 6px)',
                                            opacity: 0.7
                                        }),
                                        ...(isOOO && !isOnLeave && {
                                            background: isDark
                                                ? `repeating-linear-gradient(135deg, ${colors.bgAccent}, ${colors.bgAccent} 2px, ${colors.bgAlt} 2px, ${colors.bgAlt} 6px)`
                                                : 'repeating-linear-gradient(135deg, #f1f5f9, #f1f5f9 2px, #f8fafc 2px, #f8fafc 6px)',
                                            opacity: 0.8
                                        })
                                    }}
                                >
                                    {/* Bars are suppressed entirely on leave / OOO cells — the diagonal-stripe
                                        background already says "no capacity here" and any bar inside (even from a
                                        partial-week boundary write) reads as if the resource still has capacity. */}
                                    {!isOnLeave && !isOOO && isProjectView && (
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', borderRadius: '2px', opacity: 0.6, height: `${shadowHeightPercent}%`, backgroundColor: shadowColor, zIndex: 1 }} />
                                    )}
                                    {!isOnLeave && !isOOO && (
                                        /* Project View: Stacked bars - Purple (resourced) on bottom, Red (unresourced) on top */
                                        isProjectView && hasStackedBars ? (
                                            <>
                                                {/* Purple bar (resourced) - starts at bottom */}
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', transition: 'all 0.5s ease-out', height: `${resourcedHeightPct || 0}%`, opacity: 0.85, backgroundColor: '#7637E3', zIndex: 2 }} />
                                                {/* Red bar (unresourced) - stacked on top of purple */}
                                                <div style={{ position: 'absolute', bottom: `${resourcedHeightPct || 0}%`, left: 0, width: '100%', transition: 'all 0.5s ease-out', height: `${unresourcedHeightPct || 0}%`, opacity: 0.85, backgroundColor: '#ef4444', zIndex: 2 }} />
                                            </>
                                        ) : (
                                            /* Resource View or no demand: Single bar */
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', transition: 'all 0.5s ease-out', height: `${mainHeightPercent}%`, opacity: 0.85, backgroundColor: mainColor, zIndex: 2, mixBlendMode: isProjectView ? 'multiply' : 'normal' }} />
                                        )
                                    )}
                                    {!isOnLeave && !isOOO && isOverloaded && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', backgroundColor: '#ef4444' }} />}
                                    {!isOnLeave && !isOOO && isRamping && <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', backgroundColor: '#f59e0b', borderRadius: '0 0 4px 4px', zIndex: 15 }} />}
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', zIndex: 10, color: isProjectView && Math.abs(bucket.dem - bucket.planned) > 2 ? '#1e293b' : 'inherit' }}>{(isOnLeave || isOOO) ? '' : displayContent}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}, (prev, next) => {
    // Custom Comparator
    const resSame = prev.resource.uniqueKey === next.resource.uniqueKey && prev.resource.metricHash === next.resource.metricHash;
    const datesSame = prev.dates === next.dates || (prev.dates.length === next.dates.length && prev.dates[0]?.dateKey === next.dates[0]?.dateKey);
    const propsSame =
        prev.cellDisplayMode === next.cellDisplayMode &&
        prev.forecastMode === next.forecastMode &&
        prev.todayKey === next.todayKey &&
        prev.viewMode === next.viewMode &&
        prev.highlightProject === next.highlightProject &&
        prev.isPinned === next.isPinned &&
        prev.columnWidth === next.columnWidth &&
        prev.sidebarWidth === next.sidebarWidth &&
        prev.onResourceClick === next.onResourceClick &&
        prev.hoverDateKey === next.hoverDateKey &&
        prev.isSelected === next.isSelected &&
        prev.focusedColIdx === next.focusedColIdx;

    return resSame && datesSame && propsSame;
});

export default ResourceRow;
