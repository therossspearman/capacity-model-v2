/**
 * ViewControls - View toggle and display mode controls
 * Extracted from Dashboard toolbar section
 */
import React from 'react';
import { useDashboardContext } from '../../context';

/**
 * View mode toggle (People/Projects/Slots)
 */
export const ViewModeToggle = () => {
    const { viewMode, setViewMode } = useDashboardContext();

    const views = [
        { key: 'resources', label: 'People', icon: <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
        { key: 'projects', label: 'Projects', icon: <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg> },
        { key: 'slots', label: 'Slots', icon: <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg> }
    ];

    return (
        <div style={{
            display: 'flex',
            backgroundColor: 'rgba(241, 245, 249, 0.8)',
            borderRadius: '10px',
            padding: '3px',
            border: '1px solid rgba(226, 232, 240, 0.6)',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
        }}>
            {views.map(({ key, label, icon }) => (
                <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    data-tour={key === 'slots' ? 'slots-view' : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: viewMode === key ? '600' : '500',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: viewMode === key ? 'white' : 'transparent',
                        color: viewMode === key ? '#7637E3' : '#64748b',
                        boxShadow: viewMode === key ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        letterSpacing: '-0.01em'
                    }}
                >
                    {icon}
                    {label}
                </button>
            ))}
        </div>
    );
};

/**
 * Cell display mode toggle (Hours/Percent/Heatmap)
 */
export const CellDisplayToggle = () => {
    const { cellDisplayMode, setCellDisplayMode } = useDashboardContext();

    const modes = [
        { key: 'hours', label: '12h' },
        { key: 'percent', label: '%' },
        { key: 'heatmap', label: null, icon: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg> }
    ];

    return (
        <div style={{
            display: 'flex', backgroundColor: 'rgba(241, 245, 249, 0.8)',
            borderRadius: '10px', padding: '3px',
            border: '1px solid rgba(226, 232, 240, 0.6)',
            marginRight: '16px',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
        }}>
            {modes.map(({ key, label, icon }) => (
                <button
                    key={key}
                    onClick={() => setCellDisplayMode(key)}
                    title={`Display mode: ${key}`}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '4px 10px', fontSize: '11px', fontWeight: '600',
                        borderRadius: '8px', border: 'none', cursor: 'pointer',
                        backgroundColor: cellDisplayMode === key ? 'white' : 'transparent',
                        color: cellDisplayMode === key ? '#7637E3' : '#64748b',
                        boxShadow: cellDisplayMode === key ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {icon || label}
                </button>
            ))}
        </div>
    );
};

/**
 * Zoom level toggle (Compact/Comfortable/Spacious)
 */
export const ZoomToggle = () => {
    const { zoomLevel, setZoomLevel } = useDashboardContext();

    return (
        <div style={{
            display: 'flex', backgroundColor: 'rgba(241, 245, 249, 0.8)',
            borderRadius: '10px', padding: '3px',
            border: '1px solid rgba(226, 232, 240, 0.6)',
            marginRight: '16px',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
        }}>
            {['compact', 'comfortable', 'spacious'].map(level => {
                const isActive = zoomLevel === level;
                return (
                    <button
                        key={level}
                        onClick={() => setZoomLevel(level)}
                        title={`${level.charAt(0).toUpperCase() + level.slice(1)} density`}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '4px 8px', fontSize: '12px',
                            borderRadius: '8px', border: 'none', cursor: 'pointer',
                            backgroundColor: isActive ? 'white' : 'transparent',
                            color: isActive ? '#7637E3' : '#64748b',
                            boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {level === 'compact' && <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
                        {level === 'comfortable' && <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
                        {level === 'spacious' && <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>}
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Group expand/collapse toggle
 */
export const ExpandCollapseToggle = () => {
    // NOTE: `allGroupsExpanded` reflects only the last bulk action (Expand all /
    // Collapse all), not the derived per-group state. In a mixed state (some
    // groups expanded, some collapsed) the highlight intentionally tracks the
    // last bulk action rather than computing a true tri-state.
    const { allGroupsExpanded, setAllGroupsExpanded } = useDashboardContext();

    return (
        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px', border: '1px solid #e2e8f0' }}>
            <button
                onClick={() => setAllGroupsExpanded(true)}
                title="Expand all groups"
                style={{
                    padding: '4px 8px', fontSize: '12px', fontWeight: '600',
                    borderRadius: '6px', border: 'none', cursor: 'pointer',
                    backgroundColor: allGroupsExpanded ? 'white' : 'transparent',
                    color: allGroupsExpanded ? '#7637E3' : '#64748b',
                    boxShadow: allGroupsExpanded ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                }}
            >+</button>
            <button
                onClick={() => setAllGroupsExpanded(false)}
                title="Collapse all groups"
                style={{
                    padding: '4px 8px', fontSize: '12px', fontWeight: '600',
                    borderRadius: '6px', border: 'none', cursor: 'pointer',
                    backgroundColor: !allGroupsExpanded ? 'white' : 'transparent',
                    color: !allGroupsExpanded ? '#7637E3' : '#64748b',
                    boxShadow: !allGroupsExpanded ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                }}
            >−</button>
        </div>
    );
};

export default {
    ViewModeToggle,
    CellDisplayToggle,
    ZoomToggle,
    ExpandCollapseToggle
};
