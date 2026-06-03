/**
 * ResourceHoverCard - Quick availability preview on hover
 * Shows utilization sparkline, projects, and next available slot
 */
import React from 'react';
import { BRAND, useTheme } from '../../design-system';

const ResourceHoverCard = ({ resource, buckets, position }) => {
    const { colors } = useTheme();

    if (!resource) return null;

    // Calculate 12-week utilization from buckets.
    // When a week has no capacity (cap <= 0: PTO, not yet onboarded, etc.) we
    // record null rather than fabricating a denominator of 1, which would
    // otherwise report misleading ratios (e.g. capped 150% or a fake 0%).
    const bucketKeys = Object.keys(buckets || {}).slice(0, 12);
    const utilData = bucketKeys.map(key => {
        const b = buckets[key];
        const cap = b?.cap || 0;
        const dem = b?.dem || 0;
        if (cap <= 0) return null;
        return Math.min(150, Math.round((dem / cap) * 100));
    });

    // Weeks that actually have capacity (exclude null/no-capacity weeks).
    const validUtil = utilData.filter(u => u != null);

    // Current/Average utilization (over weeks with capacity only)
    const currentUtil = utilData[0] != null ? utilData[0] : 0;
    const avgUtil = validUtil.length > 0
        ? Math.round(validUtil.reduce((a, b) => a + b, 0) / validUtil.length)
        : 0;

    // Find next available week (has capacity and utilization < 80%).
    // No-capacity weeks (null) are not "available", so they are skipped.
    const nextAvailable = utilData.findIndex(u => u != null && u < 80);
    const nextAvailableText = nextAvailable === 0
        ? 'Available now'
        : nextAvailable > 0
            ? `Available in ${nextAvailable} week${nextAvailable > 1 ? 's' : ''}`
            : 'Fully booked (12 wks)';

    // Get active projects count
    // If not on resource, calculate from buckets (unique projects with demand > 0 in next 12 weeks)
    const projectCount = resource.projectCount || resource.projects?.length || (() => {
        const uniqueProjects = new Set();
        bucketKeys.forEach(key => {
            const b = buckets[key];
            if (b && b.projects) {
                b.projects.forEach(p => {
                    if (Math.abs(p.hours || 0) > 0.1) uniqueProjects.add(p.projectId || p.id);
                });
            }
        });
        return uniqueProjects.size;
    })() || 0;

    // Sparkline path
    const sparkWidth = 100;
    const sparkHeight = 24;
    const points = utilData.map((u, i) => {
        // Skip no-capacity weeks (null) so the sparkline doesn't draw to NaN.
        if (u == null) return null;
        const x = (i / Math.max(utilData.length - 1, 1)) * sparkWidth;
        const y = sparkHeight - (Math.min(u, 100) / 100) * sparkHeight;
        return `${x},${y}`;
    }).filter(Boolean).join(' ');

    return (
        <div style={{
            position: 'fixed',
            top: position.y + 10,
            left: position.x,
            zIndex: 9999,
            backgroundColor: colors.bgModal,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: colors.shadowLg,
            width: '220px',
            pointerEvents: 'none'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {resource.headshot ? (
                    <img
                        src={resource.headshot}
                        alt={resource.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: BRAND.benifexPurple + '20',
                        color: BRAND.benifexPurple,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700'
                    }}>
                        {(resource.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                )}
                <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: colors.text }}>{resource.name}</div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>{resource.role || resource.adJobTitle || 'Team Member'}</div>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: currentUtil > 100 ? BRAND.danger : currentUtil > 80 ? '#f59e0b' : BRAND.benifexGreen
                    }}>
                        {currentUtil}%
                    </div>
                    <div style={{ fontSize: '9px', color: colors.textMuted, textTransform: 'uppercase' }}>Current</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: avgUtil > 100 ? BRAND.danger : avgUtil > 80 ? '#f59e0b' : colors.text
                    }}>
                        {avgUtil}%
                    </div>
                    <div style={{ fontSize: '9px', color: colors.textMuted, textTransform: 'uppercase' }}>Avg (12wk)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: BRAND.benifexPurple }}>
                        {projectCount}
                    </div>
                    <div style={{ fontSize: '9px', color: colors.textMuted, textTransform: 'uppercase' }}>Projects</div>
                </div>
            </div>

            {/* Sparkline */}
            <div style={{
                backgroundColor: colors.bgAlt,
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '8px'
            }}>
                <svg width={sparkWidth} height={sparkHeight} style={{ display: 'block', margin: '0 auto' }}>
                    {/* 100% line */}
                    <line x1="0" y1={sparkHeight * 0} x2={sparkWidth} y2={sparkHeight * 0}
                        stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
                    {/* 80% line */}
                    <line x1="0" y1={sparkHeight * 0.2} x2={sparkWidth} y2={sparkHeight * 0.2}
                        stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" opacity="0.3" />
                    {/* Utilization line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={BRAND.benifexPurple}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <div style={{ fontSize: '9px', color: colors.textMuted, textAlign: 'center', marginTop: '4px' }}>
                    12-Week Utilization
                </div>
            </div>

            {/* Availability */}
            <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: nextAvailable === 0 ? BRAND.benifexGreen : nextAvailable > 0 ? '#f59e0b' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: nextAvailable === 0 ? BRAND.benifexGreen : nextAvailable > 0 ? '#f59e0b' : '#ef4444'
                }} />
                {nextAvailableText}
            </div>

            {/* Annual capacity (Presence Mode only) — null when ANNUAL_UTILIZATION isn't mapped or set */}
            {resource.annualCapacity != null && (
                <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px'
                }}>
                    <span style={{ color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', fontSize: '9px', letterSpacing: '0.04em' }}>Annual</span>
                    <span style={{ fontWeight: '700', color: BRAND.benifexGreen, fontFamily: 'monospace' }}>
                        {Math.round(resource.annualCapacity).toLocaleString()} h/yr
                        {resource.annualUtilization != null && (
                            <span style={{ marginLeft: '6px', fontSize: '9px', color: colors.textMuted, fontWeight: '500' }}>
                                ({Math.round(resource.annualUtilization * 100)}%)
                            </span>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ResourceHoverCard;
