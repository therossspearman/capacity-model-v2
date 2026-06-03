/**
 * ScenarioMergeConflictModal - A++++ Premium Enterprise Design
 * Conflict resolution for scenario-to-scenario merges
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, useTheme } from '../../design-system';

// ═══════════════════════════════════════════════════════════════════
// SVG Icon Components
// ═══════════════════════════════════════════════════════════════════
const Icons = {
    Merge: ({ size = 24, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 0 0 9 9" />
        </svg>
    ),
    Rocket: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
    ),
    Target: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </svg>
    ),
    Users: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    Chart: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    ),
    FileText: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    User: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Globe: ({ size = 18, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    ),
    Check: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    Zap: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    Calendar: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    )
};

// Scenario colors for visual distinction
const SCENARIO_COLORS = [
    { bg: '#f0fdf4', border: '#00BD00', text: '#00BD00', dark: { bg: 'rgba(34, 197, 94, 0.15)', border: '#00BD00' } },
    { bg: '#F7F3ED', border: '#7637E3', text: '#7637E3', dark: { bg: 'rgba(124, 58, 237, 0.15)', border: '#7637E3' } },
    { bg: '#fff7ed', border: '#f97316', text: '#ea580c', dark: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316' } },
    { bg: '#f0f9ff', border: '#0ea5e9', text: '#0284c7', dark: { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9' } },
    { bg: '#fdf4ff', border: '#d946ef', text: '#c026d3', dark: { bg: 'rgba(217, 70, 239, 0.15)', border: '#d946ef' } }
];

const ScenarioMergeConflictModal = ({
    conflicts,
    scenarios,
    newMergedName,
    onResolve,
    onCancel
}) => {
    const { isDark } = useTheme();

    // Initialize resolutions: for each conflict, default to last scenario (same as auto behavior)
    const [resolutions, setResolutions] = useState(() => {
        const initial = { projects: {}, resources: {} };

        // Projects
        for (const [projectId, conflictData] of Object.entries(conflicts.projects || {})) {
            initial.projects[projectId] = {};
            for (const [field, fieldData] of Object.entries(conflictData.fields || {})) {
                // Default to last scenario's value
                const lastScenario = fieldData[fieldData.length - 1];
                initial.projects[projectId][field] = lastScenario?.scenario || scenarios[scenarios.length - 1]?.name;
            }
        }

        // Resources
        for (const [resourceId, conflictData] of Object.entries(conflicts.resources || {})) {
            initial.resources[resourceId] = {};
            for (const [field, fieldData] of Object.entries(conflictData.fields || {})) {
                const lastScenario = fieldData[fieldData.length - 1];
                initial.resources[resourceId][field] = lastScenario?.scenario || scenarios[scenarios.length - 1]?.name;
            }
        }

        return initial;
    });

    const [expandedItems, setExpandedItems] = useState(new Set(['projects-0', 'resources-0']));

    // Get scenario color by index
    const getScenarioColor = (scenarioName) => {
        const idx = scenarios.findIndex(s => s.name === scenarioName);
        // Guard against -1 (name not found): SCENARIO_COLORS[-1] would be
        // undefined and break downstream reads of .dark/.bg/.border/.text.
        return SCENARIO_COLORS[(idx < 0 ? 0 : idx) % SCENARIO_COLORS.length];
    };

    const toggleExpand = (key) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setResolution = (type, id, field, scenarioName) => {
        setResolutions(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [id]: {
                    ...prev[type][id],
                    [field]: scenarioName
                }
            }
        }));
    };

    const useAllFromScenario = (scenarioName) => {
        setResolutions(prev => {
            const updated = {};
            for (const type of ['projects', 'resources']) {
                updated[type] = {};
                for (const id of Object.keys(prev[type] || {})) {
                    updated[type][id] = {};
                    for (const field of Object.keys(prev[type][id] || {})) {
                        updated[type][id][field] = scenarioName;
                    }
                }
            }
            return updated;
        });
    };

    // Compute merged result preview
    const mergedResult = useMemo(() => {
        const result = { projects: {}, resources: {} };

        for (const [projectId, conflictData] of Object.entries(conflicts.projects || {})) {
            result.projects[projectId] = {};
            for (const [field, fieldData] of Object.entries(conflictData.fields || {})) {
                const chosenScenario = resolutions.projects[projectId]?.[field];
                const match = fieldData.find(v => v.scenario === chosenScenario);
                result.projects[projectId][field] = match?.value;
            }
        }

        for (const [resourceId, conflictData] of Object.entries(conflicts.resources || {})) {
            result.resources[resourceId] = {};
            for (const [field, fieldData] of Object.entries(conflictData.fields || {})) {
                const chosenScenario = resolutions.resources[resourceId]?.[field];
                const match = fieldData.find(v => v.scenario === chosenScenario);
                result.resources[resourceId][field] = match?.value;
            }
        }

        return result;
    }, [conflicts, resolutions]);

    const projectConflicts = Object.entries(conflicts.projects || {});
    const resourceConflicts = Object.entries(conflicts.resources || {});
    const teamAllocationConflicts = Object.entries(conflicts.teamAllocations || {});
    const totalConflicts = projectConflicts.length + resourceConflicts.length + teamAllocationConflicts.length;

    // Format value for display
    const formatValue = (val) => {
        if (val == null || val === '') {
            return <span style={{ color: isDark ? '#475569' : '#94a3b8', fontStyle: 'italic' }}>—</span>;
        }
        if (typeof val === 'object') {
            if (val instanceof Date) {
                return val.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            // Handle team allocation arrays
            if (Array.isArray(val)) {
                if (val.length === 0) return <span style={{ color: isDark ? '#475569' : '#94a3b8', fontStyle: 'italic' }}>(none)</span>;
                return val.map(a => `${a.name || a.resourceName || 'Unknown'} (${a.percentage || a.pct || 100}%)`).join(', ');
            }
            return JSON.stringify(val);
        }
        let str = String(val).trim();
        // Format dates
        if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
            try {
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch (e) { /* ignore */ }
        }
        return str.length > 40 ? str.substring(0, 37) + '...' : str;
    };

    // Get field display info
    const getFieldInfo = (field) => {
        const lowerField = field.toLowerCase();
        if (lowerField.includes('kick') || lowerField.includes('start')) return { icon: Icons.Rocket, label: 'Kick-Off', color: '#00BD00' };
        if (lowerField.includes('launch') || lowerField.includes('end')) return { icon: Icons.Target, label: 'Launch', color: '#f97316' };
        if (lowerField.includes('squad')) return { icon: Icons.Users, label: 'Squad', color: '#BD65FF' };
        if (lowerField.includes('status')) return { icon: Icons.Chart, label: 'Status', color: '#3b82f6' };
        if (lowerField.includes('priority')) return { icon: Icons.Zap, label: 'Priority', color: '#eab308' };
        if (lowerField.includes('effort')) return { icon: Icons.Chart, label: 'Effort Profile', color: '#06b6d4' };
        // Team allocation fields
        if (lowerField.includes('pm') || lowerField === 'pm') return { icon: Icons.Users, label: 'PM Assignments', color: '#00BD00' };
        if (lowerField.includes('sc') || lowerField === 'sc') return { icon: Icons.Users, label: 'SC Assignments', color: '#f59e0b' };
        if (lowerField.includes('pd') || lowerField === 'pd') return { icon: Icons.Users, label: 'PD Assignments', color: '#7637E3' };
        return { icon: Icons.FileText, label: field.replace(/([A-Z])/g, ' $1').trim(), color: '#64748b' };
    };

    const renderConflictField = (type, id, field, valuesFromScenarios) => {
        const selectedScenario = resolutions[type]?.[id]?.[field];
        const fieldInfo = getFieldInfo(field);

        return (
            <div key={field} style={{
                marginBottom: '16px',
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                backgroundColor: isDark ? '#0f172a' : 'white'
            }}>
                {/* Field Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                        color: fieldInfo.color
                    }}>
                        <fieldInfo.icon size={16} color="currentColor" />
                    </div>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: isDark ? '#f1f5f9' : '#1e293b'
                    }}>
                        {fieldInfo.label}
                    </span>
                </div>

                {/* Value Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {valuesFromScenarios.map((item, idx) => {
                        const isSelected = selectedScenario === item.scenario;
                        const colorScheme = getScenarioColor(item.scenario);
                        const colors = isDark ? colorScheme.dark : colorScheme;

                        return (
                            <div
                                key={idx}
                                onClick={() => setResolution(type, id, field, item.scenario)}
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: `2px solid ${isSelected ? colors.border : 'transparent'}`,
                                    backgroundColor: isSelected ? colors.bg : (isDark ? '#1e293b' : '#f8fafc'),
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Radio indicator */}
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: `2px solid ${isSelected ? colors.border : (isDark ? '#475569' : '#cbd5e1')}`,
                                        backgroundColor: isSelected ? colors.border : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        {isSelected && <Icons.Check size={12} color="white" />}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: colorScheme.text,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '4px'
                                        }}>
                                            {item.scenario}
                                        </div>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: isDark ? '#e2e8f0' : '#1e293b'
                                        }}>
                                            {formatValue(item.value)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderEntityCard = (type, id, data, index) => {
        const key = `${type}-${index}`;
        const isExpanded = expandedItems.has(key);
        const fieldCount = Object.keys(data.fields || {}).length;

        return (
            <div key={id} style={{ marginBottom: '24px' }}>
                {/* Entity Header */}
                <div
                    onClick={() => toggleExpand(key)}
                    style={{
                        padding: '16px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        marginBottom: isExpanded ? '20px' : '0'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            {type === 'projects' ? (
                                <Icons.Globe size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            ) : (
                                <Icons.User size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            )}
                        </div>
                        <div>
                            <div style={{
                                fontWeight: '700',
                                fontSize: '16px',
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                letterSpacing: '-0.01em'
                            }}>
                                {data.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                {fieldCount} conflicting field{fieldCount !== 1 ? 's' : ''} • {data.scenarios?.length || 0} scenarios
                            </div>
                        </div>
                    </div>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#64748b',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>

                {/* Entity Fields */}
                {isExpanded && (
                    <div style={{ paddingTop: '8px' }}>
                        {Object.entries(data.fields || {}).map(([field, fieldData]) =>
                            renderConflictField(type, id, field, fieldData)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: isDark ? '#0f172a' : '#fafafa',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: `1px solid ${isDark ? '#334155' : 'transparent'}`
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px',
                    backgroundColor: isDark ? '#1e293b' : 'white',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '24px'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 12px', borderRadius: '20px',
                            backgroundColor: '#fef3c7', border: '1px solid #fde68a',
                            marginBottom: '16px'
                        }}>
                            <Icons.Merge size={14} color="#d97706" />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Merge Conflicts
                            </span>
                        </div>
                        <h2 style={{
                            margin: '0 0 12px 0',
                            fontSize: '28px',
                            fontWeight: '800',
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            letterSpacing: '-0.02em',
                            lineHeight: '1.1'
                        }}>
                            Resolve Scenario Conflicts
                        </h2>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5', maxWidth: '480px' }}>
                            <strong style={{ color: isDark ? '#e2e8f0' : '#334155' }}>{scenarios.length} scenarios</strong> have conflicting changes.
                            Select which value to keep for each field, or use the quick actions below.
                        </p>
                    </div>
                </div>

                {/* Quick Actions - Use All From Scenario X */}
                <div style={{
                    padding: '16px 32px',
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginRight: '4px' }}>
                        Quick select:
                    </span>
                    {scenarios.map((scenario, idx) => {
                        const colorScheme = SCENARIO_COLORS[idx % SCENARIO_COLORS.length];
                        return (
                            <button
                                key={scenario.id || idx}
                                onClick={() => useAllFromScenario(scenario.name)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: isDark ? 'transparent' : 'white',
                                    color: colorScheme.text,
                                    border: `1px solid ${colorScheme.border}`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={e => { e.target.style.backgroundColor = colorScheme.bg; }}
                                onMouseOut={e => { e.target.style.backgroundColor = isDark ? 'transparent' : 'white'; }}
                            >
                                Use all from "{scenario.name}"
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '32px'
                }}>
                    {/* Projects Section */}
                    {projectConflicts.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '16px'
                            }}>
                                Projects ({projectConflicts.length})
                            </h3>
                            {projectConflicts.map(([id, data], i) => renderEntityCard('projects', id, data, i))}
                        </div>
                    )}

                    {/* Resources Section */}
                    {resourceConflicts.length > 0 && (
                        <div>
                            <h3 style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '16px'
                            }}>
                                Resources ({resourceConflicts.length})
                            </h3>
                            {resourceConflicts.map(([id, data], i) => renderEntityCard('resources', id, data, i + projectConflicts.length))}
                        </div>
                    )}

                    {/* Team Allocations Section */}
                    {teamAllocationConflicts.length > 0 && (
                        <div>
                            <h3 style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#00BD00',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <Icons.Users size={14} color="#00BD00" />
                                Team Allocations ({teamAllocationConflicts.length})
                            </h3>
                            {/*
                              * Team allocations are NOT resolved here directly. A differing team
                              * object also surfaces as a `team` field conflict on the same project
                              * in the Projects section above (ScenarioManager.detectScenarioMergeConflicts
                              * does not skip the `team` field), and THAT picker is what determines the
                              * merged team. This section is a read-only, role-by-role breakdown so the
                              * user can see exactly what differs before choosing in the Projects section.
                              */}
                            <div style={{
                                padding: '12px 16px',
                                marginBottom: '16px',
                                borderRadius: '10px',
                                backgroundColor: isDark ? 'rgba(0, 189, 0, 0.08)' : '#f0fdf4',
                                border: `1px solid ${isDark ? 'rgba(0,189,0,0.3)' : '#bbf7d0'}`,
                                fontSize: '12px',
                                color: isDark ? '#86efac' : '#15803d',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                            }}>
                                <Icons.Check size={14} color={isDark ? '#86efac' : '#15803d'} />
                                <span>
                                    Choose the winning team in the <strong>Projects</strong> section above via each
                                    project&apos;s <strong>“team”</strong> field — your selection there decides the merged
                                    allocation. This breakdown is for reference only.
                                </span>
                            </div>
                            {teamAllocationConflicts.map(([projectId, data], i) => (
                                <div key={projectId} style={{
                                    marginBottom: '20px',
                                    padding: '20px',
                                    borderRadius: '16px',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    backgroundColor: isDark ? '#0f172a' : 'white'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            backgroundColor: '#ecfdf5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Icons.Globe size={16} color="#00BD00" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '15px', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                {data.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                Team assignments differ across {data.scenarios?.length || 0} scenarios
                                            </div>
                                        </div>
                                    </div>
                                    {/* Role-by-role conflicts */}
                                    {Object.entries(data.roles || {}).map(([role, roleData]) => (
                                        <div key={role} style={{
                                            marginBottom: '12px',
                                            padding: '12px',
                                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                            borderRadius: '10px'
                                        }}>
                                            <div style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: role === 'pm' ? '#00BD00' : role === 'sc' ? '#f59e0b' : '#7637E3',
                                                textTransform: 'uppercase',
                                                marginBottom: '8px'
                                            }}>
                                                {role.toUpperCase()} Assignments
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {roleData.map((item, idx) => {
                                                    const colorScheme = getScenarioColor(item.scenario);
                                                    return (
                                                        <div key={idx} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${colorScheme.border}`,
                                                            backgroundColor: isDark ? colorScheme.dark?.bg : colorScheme.bg
                                                        }}>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                color: colorScheme.text,
                                                                textTransform: 'uppercase',
                                                                minWidth: '80px'
                                                            }}>
                                                                {item.scenario}
                                                            </span>
                                                            <span style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                                {item.resources?.length > 0 ? item.resources.join(', ') : <em style={{ color: '#94a3b8' }}>(none)</em>}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '24px 32px',
                    backgroundColor: isDark ? '#1e293b' : 'white',
                    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'transparent',
                            color: '#64748b',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'color 0.2s'
                        }}
                        onMouseOver={e => e.target.style.color = '#334155'}
                        onMouseOut={e => e.target.style.color = '#64748b'}
                    >
                        Cancel Merge
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Merging to: <strong style={{ color: isDark ? '#e2e8f0' : '#334155' }}>{newMergedName}</strong>
                        </span>
                        <button
                            onClick={() => onResolve(resolutions, mergedResult)}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, #7637E3 0%, #7637E3 100%)',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '700',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 20px rgba(124, 58, 237, 0.4)'; }}
                            onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)'; }}
                        >
                            Proceed with Merge
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

ScenarioMergeConflictModal.propTypes = {
    conflicts: PropTypes.shape({
        projects: PropTypes.object,
        resources: PropTypes.object,
        teamAllocations: PropTypes.object,
        hasConflicts: PropTypes.bool,
        summary: PropTypes.array
    }).isRequired,
    scenarios: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        changes: PropTypes.object
    })).isRequired,
    newMergedName: PropTypes.string.isRequired,
    onResolve: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default ScenarioMergeConflictModal;
