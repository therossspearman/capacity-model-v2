import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX } from '../../design-system';
import InnerGrid from './InnerGrid';
import { ResourceHoverCard } from '../ui';

const ResourceGrid = React.memo(({ groupedData, dates, onCellClick, todayKey, cellDisplayMode, forecastMode, toggleShowAll, columnWidth, fontSize, highlightProject, thresholds, groupStats, pinnedResources, onTogglePin, viewMode, children, footerChildren, onResourceClick, selectedProjects, onToggleSelection, allGroupsExpanded, customerSort }) => {
    const [hoverInfo, setHoverInfo] = useState(null);
    const [resourceHoverInfo, setResourceHoverInfo] = useState(null);
    const hoverDateKey = hoverInfo ? hoverInfo.data.dateKey : null;

    // Debounce hover updates to prevent judder
    const hoverTimeoutRef = useRef(null);
    const lastHoverRef = useRef(null);
    const resourceHoverTimeoutRef = useRef(null);

    const handleHover = useCallback((info) => {
        // Clear any pending timeout
        if (hoverTimeoutRef.current) {
            cancelAnimationFrame(hoverTimeoutRef.current);
        }

        // If clearing hover, do it immediately
        if (!info) {
            lastHoverRef.current = null;
            setHoverInfo(null);
            return;
        }

        // Skip if same cell
        if (lastHoverRef.current === info.data.dateKey) {
            return;
        }

        // Debounce new hover with requestAnimationFrame
        hoverTimeoutRef.current = requestAnimationFrame(() => {
            lastHoverRef.current = info.data.dateKey;
            setHoverInfo(info);
        });
    }, []);

    // Resource hover handler with debouncing
    const handleResourceHover = useCallback((info) => {
        if (resourceHoverTimeoutRef.current) {
            clearTimeout(resourceHoverTimeoutRef.current);
        }

        if (!info) {
            // Delay clearing to allow moving to card
            resourceHoverTimeoutRef.current = setTimeout(() => {
                setResourceHoverInfo(null);
            }, 100);
            return;
        }

        // Small delay before showing
        resourceHoverTimeoutRef.current = setTimeout(() => {
            setResourceHoverInfo(info);
        }, 150);
    }, []);

    const GridTooltip = ({ x, y, data }) => (
        <div
            style={{
                position: 'fixed',
                zIndex: Z_INDEX.TOOLTIP,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                color: 'white',
                fontSize: '12px',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                pointerEvents: 'none',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(100, 116, 139, 0.5)',
                minWidth: '140px',
                left: x,
                top: y,
                transform: 'translate(-50%, -110%)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                <span style={{ fontWeight: '700', color: 'white' }}>{data.dateKey}</span>
                {data.isOverloaded && <span style={{ fontSize: '9px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0 4px', borderRadius: '4px' }}>OVERLOAD</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Capacity:</span><span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{Math.round(data.cap)}h</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Demand:</span><span style={{ fontFamily: 'monospace', fontWeight: '700', color: data.isOverloaded ? '#ef4444' : BRAND.success }}>{Math.round(data.dem)}h</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}><span style={{ color: '#94a3b8' }}>Utilization:</span><span style={{ fontFamily: 'monospace' }}>{data.cap > 0 ? Math.round((data.dem / data.cap) * 100) : (data.dem > 0 ? '∞' : '0')}%</span></div>
            </div>
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {hoverInfo && <GridTooltip {...hoverInfo} />}
            {resourceHoverInfo && viewMode !== 'projects' && (
                <ResourceHoverCard
                    resource={resourceHoverInfo.resource}
                    buckets={resourceHoverInfo.resource.buckets}
                    position={resourceHoverInfo.position}
                />
            )}
            <InnerGrid
                groupedData={groupedData}
                dates={dates}
                onCellClick={onCellClick}
                onHover={handleHover}
                todayKey={todayKey}
                cellDisplayMode={cellDisplayMode}
                forecastMode={forecastMode}
                toggleShowAll={toggleShowAll}
                columnWidth={columnWidth}
                fontSize={fontSize}
                highlightProject={highlightProject}
                thresholds={thresholds}
                groupStats={groupStats}
                pinnedResources={pinnedResources}
                onTogglePin={onTogglePin}
                viewMode={viewMode}
                onResourceClick={onResourceClick}
                selectedProjects={selectedProjects}
                onToggleSelection={onToggleSelection}
                allGroupsExpanded={allGroupsExpanded}
                customerSort={customerSort}
                onResourceHover={handleResourceHover}
                footerChildren={footerChildren}
            >
                {children}
            </InnerGrid>
        </div>
    );
});

export default ResourceGrid;

// PropTypes for runtime type validation
ResourceGrid.propTypes = {
    /** Grouped resource/project data by squad */
    groupedData: PropTypes.object.isRequired,
    /** Array of date objects for columns */
    dates: PropTypes.array.isRequired,
    /** Cell click handler */
    onCellClick: PropTypes.func,
    /** Today's date key for highlighting */
    todayKey: PropTypes.string,
    /** Display mode: 'hours', 'percent', 'heatmap' */
    cellDisplayMode: PropTypes.oneOf(['hours', 'percent', 'heatmap']),
    /** Forecast mode: 'plan', 'eac', 'impact' */
    forecastMode: PropTypes.oneOf(['plan', 'eac', 'impact']),
    /** Toggle show all handler */
    toggleShowAll: PropTypes.func,
    /** Column width in pixels */
    columnWidth: PropTypes.number,
    /** Font size in pixels */
    fontSize: PropTypes.number,
    /** Project ID to highlight */
    highlightProject: PropTypes.string,
    /** Threshold settings for coloring */
    thresholds: PropTypes.object,
    /** Stats per group (capacity, demand, utilization) */
    groupStats: PropTypes.object,
    /** Set of pinned resource IDs */
    pinnedResources: PropTypes.instanceOf(Set),
    /** Toggle pin handler */
    onTogglePin: PropTypes.func,
    /** View mode: 'resources' or 'projects' */
    viewMode: PropTypes.oneOf(['resources', 'projects']),
    /** Children elements */
    children: PropTypes.node,
    /** Resource click handler */
    onResourceClick: PropTypes.func,
    /** Set of selected project IDs */
    selectedProjects: PropTypes.instanceOf(Set),
    /** Toggle selection handler */
    onToggleSelection: PropTypes.func,
    /** Whether all groups are expanded */
    allGroupsExpanded: PropTypes.bool,
    /** Customer sort order */
    customerSort: PropTypes.string
};
