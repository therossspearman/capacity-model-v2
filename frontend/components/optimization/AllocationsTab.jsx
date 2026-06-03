/**
 * AllocationsTab - Resource allocation recommendations view
 * Shows bottleneck detection and allocation adjustment suggestions
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { generateAllocationRecommendations, calculateRecommendationImpact } from '../../utils/AllocationRecommender';

const AllocationsTab = ({ slotMap, projects, enabledSquads, isDark }) => {
    // Generate allocation recommendations (memoized — detectBottlenecks over slotMap is
    // expensive and previously re-ran on every render, e.g. theme toggle / tab switch).
    const allocRecs = useMemo(
        () => generateAllocationRecommendations(slotMap, projects, [], { enabledSquads }),
        [slotMap, projects, enabledSquads]
    );
    const impact = useMemo(() => calculateRecommendationImpact(allocRecs), [allocRecs]);

    if (allocRecs.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '48px',
                color: isDark ? '#64748b' : '#94a3b8'
            }}>
                <svg style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No Bottlenecks Detected</h3>
                <p style={{ fontSize: '13px' }}>All weeks are within capacity limits. No allocation adjustments needed.</p>
            </div>
        );
    }

    return (
        <>
            {/* Impact Summary */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                borderRadius: '10px',
                border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fcd34d'}`
            }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
                        {impact.totalHoursSaved}h
                    </div>
                    <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Hours Freed</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                        {impact.projectsAffected}
                    </div>
                    <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Projects</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
                        {impact.bottlenecksAddressed}
                    </div>
                    <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Bottlenecks</div>
                </div>
            </div>

            {/* Recommendations List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allocRecs.map((rec, idx) => (
                    <div
                        key={idx}
                        style={{
                            padding: '16px 20px',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            borderRadius: '16px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                    >
                        {/* Severity indicator */}
                        <div style={{
                            width: '4px',
                            height: '40px',
                            borderRadius: '4px',
                            backgroundColor: rec.severity >= 7 ? '#ef4444' : rec.severity >= 4 ? '#f59e0b' : '#00BD00'
                        }} />

                        {/* Project info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginBottom: '2px'
                            }}>
                                {rec.projectName}
                            </div>
                            <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                {rec.reason}
                            </div>
                        </div>

                        {/* Allocation change */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: isDark ? '#94a3b8' : '#64748b',
                                textDecoration: 'line-through'
                            }}>
                                {rec.currentPct}%
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            <span style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#00BD00'
                            }}>
                                {rec.suggestedPct}%
                            </span>
                        </div>

                        {/* Hours saved badge */}
                        <div style={{
                            padding: '6px 10px',
                            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#166534',
                            minWidth: '56px',
                            textAlign: 'center'
                        }}>
                            +{rec.impactHours}h
                        </div>
                    </div>
                ))}
            </div>

            {/* Note */}
            <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                borderRadius: '8px',
                fontSize: '11px',
                color: isDark ? '#93c5fd' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
                Allocation changes require manual updates to project team assignments.
            </div>
        </>
    );
};

AllocationsTab.propTypes = {
    slotMap: PropTypes.object,
    projects: PropTypes.array,
    enabledSquads: PropTypes.array,
    isDark: PropTypes.bool
};

export default AllocationsTab;
