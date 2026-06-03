/**
 * BAUProjectGrid - Compact grid for virtual BAU projects
 * Shows projects grouped by squad with minimal card data
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../design-system';

// T-shirt size configuration
const TSHIRT_CONFIG = {
    XS: { color: '#94a3b8', hours: 40, label: 'XS' },
    S: { color: '#00BD00', hours: 80, label: 'S' },
    M: { color: '#4794FF', hours: 160, label: 'M' },
    L: { color: '#FE9922', hours: 320, label: 'L' },
    XL: { color: '#E5554F', hours: 640, label: 'XL' }
};

// Country flag emoji mapping (common ones)
const countryFlags = {
    'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'GB': '🇬🇧',
    'United States': '🇺🇸', 'USA': '🇺🇸', 'US': '🇺🇸',
    'Germany': '🇩🇪', 'DE': '🇩🇪',
    'France': '🇫🇷', 'FR': '🇫🇷',
    'Netherlands': '🇳🇱', 'NL': '🇳🇱',
    'Spain': '🇪🇸', 'ES': '🇪🇸',
    'Italy': '🇮🇹', 'IT': '🇮🇹',
    'Australia': '🇦🇺', 'AU': '🇦🇺',
    'Canada': '🇨🇦', 'CA': '🇨🇦',
    'Ireland': '🇮🇪', 'IE': '🇮🇪',
    'Sweden': '🇸🇪', 'SE': '🇸🇪',
    'Denmark': '🇩🇰', 'DK': '🇩🇰',
    'Norway': '🇳🇴', 'NO': '🇳🇴',
    'Finland': '🇫🇮', 'FI': '🇫🇮',
    'Belgium': '🇧🇪', 'BE': '🇧🇪',
    'Switzerland': '🇨🇭', 'CH': '🇨🇭',
    'Austria': '🇦🇹', 'AT': '🇦🇹',
    'Poland': '🇵🇱', 'PL': '🇵🇱',
    'Japan': '🇯🇵', 'JP': '🇯🇵',
    'Singapore': '🇸🇬', 'SG': '🇸🇬',
    'Hong Kong': '🇭🇰', 'HK': '🇭🇰',
    'India': '🇮🇳', 'IN': '🇮🇳',
    'Global': '🌍', 'International': '🌍'
};

const getFlag = (country) => countryFlags[country] || '🏳️';

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
};

// Compact Project Card
const ProjectCard = ({ project, onClick, isDark }) => {
    const size = TSHIRT_CONFIG[project.bauTshirtSize] || TSHIRT_CONFIG.M;

    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

    return (
        <div
            onClick={() => onClick(project)}
            style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${borderColor}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '180px',
                flex: '1 1 180px',
                maxWidth: '280px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
            }}
        >
            {/* Header: Flag + Name + T-shirt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {project.countryFlag ? (
                    <img
                        src={project.countryFlag}
                        alt={project.country || ''}
                        style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }}
                    />
                ) : (
                    <span style={{ fontSize: '16px' }}>{getFlag(project.country)}</span>
                )}
                <span style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isDark ? '#f1f5f9' : '#1e293b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {project.name}
                </span>
                <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: size.color,
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700
                }}>
                    {size.label}
                </span>
            </div>
            {/* Footer: Squad + Launch */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: isDark ? '#94a3b8' : '#64748b'
            }}>
                <span>{project.squad || 'Unassigned'}</span>
                <span>{formatDate(project.launch || project.end)}</span>
            </div>
        </div>
    );
};

// Squad Group Accordion
const SquadGroup = ({ squad, projects, onProjectClick, isDark, defaultExpanded = true, groupBy = 'squad' }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const totalHours = useMemo(() => {
        return projects.reduce((sum, p) => {
            const size = TSHIRT_CONFIG[p.bauTshirtSize] || TSHIRT_CONFIG.M;
            return sum + size.hours;
        }, 0);
    }, [projects]);

    // Calculate earliest launch date in this group
    const earliestLaunch = useMemo(() => {
        const dates = projects
            .map(p => p.launch || p.end)
            .filter(d => d)
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);
        return dates.length > 0 ? formatDate(dates[0]) : '—';
    }, [projects]);

    // Get display label with flag for country grouping
    const displayLabel = groupBy === 'country' ? `${getFlag(squad)} ${squad}` : squad;

    return (
        <div style={{
            marginBottom: '16px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        fontSize: '12px',
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}>▶</span>
                    {/* For country grouping, use countryFlag from first project if available */}
                    {groupBy === 'country' && projects[0]?.countryFlag ? (
                        <img
                            src={projects[0].countryFlag}
                            alt={squad}
                            style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover', marginRight: '4px' }}
                        />
                    ) : groupBy === 'country' ? (
                        <span style={{ marginRight: '4px' }}>{getFlag(squad)}</span>
                    ) : null}
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDark ? '#f1f5f9' : '#1e293b'
                    }}>
                        {squad}
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: isDark ? '#64748b' : '#94a3b8',
                        fontWeight: 400
                    }}>
                        ({projects.length} projects • {totalHours.toLocaleString()}h • from {earliestLaunch})
                    </span>
                </div>
            </div>

            {/* Projects Grid */}
            {expanded && (
                <div style={{
                    padding: '12px 16px 16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    {projects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onClick={onProjectClick}
                            isDark={isDark}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * BAUProjectGrid - Main component
 * Displays virtual BAU projects in a compact, grouped grid
 * Supports grouping by squad (default), customer, or country
 */
const BAUProjectGrid = ({ projects = [], onEditProject, groupBy = 'squad' }) => {
    const { isDark, colors } = useTheme();

    // Group projects by the selected field (squad, customer, or country)
    const groupedProjects = useMemo(() => {
        const groups = {};
        projects.forEach(p => {
            let groupKey;
            switch (groupBy) {
                case 'customer':
                    groupKey = p.customer || 'Unknown Customer';
                    break;
                case 'country':
                    groupKey = p.country || 'Unknown Country';
                    break;
                case 'squad':
                default:
                    groupKey = p.squad || 'Unassigned';
                    break;
            }
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(p);
        });
        // Sort groups alphabetically, but put the sentinel "ungrouped" buckets at end.
        // Compare against the exact sentinel values (not startsWith) so a real
        // squad/customer/country name like "Unknown Logistics Ltd" is not misplaced.
        const UNGROUPED = new Set(['Unassigned', 'Unknown Customer', 'Unknown Country']);
        return Object.entries(groups).sort(([a], [b]) => {
            const aIsUnknown = UNGROUPED.has(a);
            const bIsUnknown = UNGROUPED.has(b);
            if (aIsUnknown && !bIsUnknown) return 1;
            if (bIsUnknown && !aIsUnknown) return -1;
            return a.localeCompare(b);
        });
    }, [projects, groupBy]);

    const totalProjects = projects.length;
    const totalHours = useMemo(() => {
        return projects.reduce((sum, p) => {
            const size = TSHIRT_CONFIG[p.bauTshirtSize] || TSHIRT_CONFIG.M;
            return sum + size.hours;
        }, 0);
    }, [projects]);

    if (projects.length === 0) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: colors.textMuted
            }}>
                <p style={{ fontSize: '14px', margin: 0 }}>No virtual BAU projects found</p>
                <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                    Projects with BAU category will appear here
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '16px' }}>
            {/* Groups - respects groupBy (squad/customer/country) */}
            {groupedProjects.map(([groupName, groupProjects]) => (
                <SquadGroup
                    key={groupName}
                    squad={groupName}
                    projects={groupProjects}
                    onProjectClick={onEditProject}
                    isDark={isDark}
                    groupBy={groupBy}
                />
            ))}
        </div>
    );
};

BAUProjectGrid.propTypes = {
    projects: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        squad: PropTypes.string,
        customer: PropTypes.string,
        country: PropTypes.string,
        launch: PropTypes.string,
        bauTshirtSize: PropTypes.string
    })),
    onEditProject: PropTypes.func,
    groupBy: PropTypes.oneOf(['squad', 'customer', 'country'])
};

export default BAUProjectGrid;
