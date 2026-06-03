/**
 * Forecast Impact Panel
 * 
 * Premium slide-out drawer showing FTE impact analysis
 * considering current demand, finance forecast, and initiatives.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';

// Icons
const TrendingUpIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const UsersIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const ClockIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const AlertIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ChevronRightIcon = () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

// Format hours
const formatHours = (hours) => {
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k`;
    return Math.round(hours).toLocaleString();
};

// Role display names
const ROLE_LABELS = { pm: 'PM', sc: 'SC', pd: 'PD' };
const ROLE_COLORS = { pm: '#BD65FF', sc: '#00BD00', pd: '#7637E3' };

export const ForecastImpactPanel = ({
    isOpen,
    onClose,
    fteImpact,
    forecastName = 'Finance Forecast'
}) => {
    const { isDark, colors } = useTheme();

    // Animation keyframes for slide-in
    const slideKeyframes = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;

    if (!isOpen || !fteImpact) return null;

    const {
        current = {},
        forecast = {},
        initiatives = {},
        summary = {},
        fteAnalysis = {},
        recommendations = []
    } = fteImpact;

    const utilizationColor = summary.projectedUtilization > 100
        ? '#ef4444'
        : summary.projectedUtilization > 80
            ? '#f59e0b'
            : '#00BD00';

    return (
        <>
            <style>{slideKeyframes}</style>

            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(2px)',
                    zIndex: Z_INDEX.MODAL - 1,
                    cursor: 'pointer'
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '420px',
                backgroundColor: colors.bgModal,
                boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
                zIndex: Z_INDEX.MODAL,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideIn 0.25s ease-out forwards'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #BD65FF 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <TrendingUpIcon />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: colors.textPrimary }}>
                                FTE Impact Analysis
                            </h2>
                            <p style={{ margin: 0, fontSize: '11px', color: colors.textMuted }}>
                                {forecastName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: colors.textMuted,
                            transform: 'rotate(0deg)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <ChevronRightIcon />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                    {/* Projected Utilization Hero */}
                    <div style={{
                        padding: '20px',
                        borderRadius: '12px',
                        background: isDark
                            ? `linear-gradient(135deg, ${utilizationColor}15 0%, ${utilizationColor}05 100%)`
                            : `linear-gradient(135deg, ${utilizationColor}10 0%, ${utilizationColor}03 100%)`,
                        border: `1px solid ${utilizationColor}30`,
                        marginBottom: '20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            {summary.isOverCapacity ? <AlertIcon /> : <CheckCircleIcon />}
                            <span style={{ fontSize: '11px', fontWeight: '600', color: utilizationColor, textTransform: 'uppercase' }}>
                                Projected Utilization
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '40px', fontWeight: '800', color: utilizationColor }}>
                                {summary.projectedUtilization}%
                            </span>
                            <span style={{ fontSize: '13px', color: colors.textMuted }}>
                                {summary.isOverCapacity ? 'Over capacity' : 'Within capacity'}
                            </span>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                        marginBottom: '24px'
                    }}>
                        <div style={{
                            padding: '14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                            border: `1px solid ${colors.border}`
                        }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                                Current Team
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: colors.textPrimary }}>
                                {summary.totalCurrentFte} <span style={{ fontSize: '13px', fontWeight: '500', color: colors.textMuted }}>FTE</span>
                            </div>
                        </div>
                        <div style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)',
                            border: '1px solid rgba(59,130,246,0.2)'
                        }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Additional FTE Needed
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#3b82f6' }}>
                                +{summary.totalAdditionalFteNeeded}
                            </div>
                        </div>
                    </div>

                    {/* Demand Breakdown */}
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ClockIcon /> Demand Breakdown
                        </h3>

                        <div style={{
                            borderRadius: '10px',
                            border: `1px solid ${colors.border}`,
                            overflow: 'hidden'
                        }}>
                            {/* Current */}
                            <div style={{
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff'
                            }}>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Current Demand</span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>
                                    {formatHours(current.demandHours)}h
                                </span>
                            </div>

                            {/* Forecast */}
                            <div style={{
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'
                            }}>
                                <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '500' }}>
                                    + Forecast Demand
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>
                                    {formatHours(forecast.total)}h
                                </span>
                            </div>

                            {/* Initiatives */}
                            <div style={{
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)'
                            }}>
                                <span style={{ fontSize: '12px', color: '#BD65FF', fontWeight: '500' }}>
                                    + Initiative Impact
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#BD65FF' }}>
                                    {formatHours(initiatives.total)}h
                                </span>
                            </div>

                            {/* Total vs Capacity */}
                            <div style={{
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.bgAlt
                            }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                                    Total / Capacity
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: utilizationColor }}>
                                    {formatHours(current.demandHours + forecast.total + initiatives.total)}h / {formatHours(current.capacityHours)}h
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Role Breakdown */}
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UsersIcon /> FTE by Role
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {['pm', 'sc', 'pd'].map(role => {
                                const data = fteAnalysis[role] || {};
                                const color = ROLE_COLORS[role];

                                return (
                                    <div key={role} style={{
                                        padding: '14px',
                                        borderRadius: '10px',
                                        border: `1px solid ${colors.border}`,
                                        background: isDark ? 'rgba(255,255,255,0.02)' : '#fff'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: color
                                                }} />
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>
                                                    {ROLE_LABELS[role]}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: data.status === 'hire' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                                color: data.status === 'hire' ? '#ef4444' : '#00BD00'
                                            }}>
                                                {data.status === 'hire' ? `+${data.recommendedHires} needed` : 'Sufficient'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: colors.textMuted }}>
                                            <span>Current: <strong style={{ color: colors.textPrimary }}>{data.currentFte}</strong></span>
                                            <span>Forecast: <strong style={{ color: '#3b82f6' }}>{formatHours(data.forecastHours)}h</strong></span>
                                            {data.initiativeHours > 0 && (
                                                <span>Initiatives: <strong style={{ color: '#BD65FF' }}>{formatHours(data.initiativeHours)}h</strong></span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hiring Recommendations */}
                    {recommendations.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '12px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px' }}>
                                Hiring Recommendations
                            </h3>
                            <div style={{
                                padding: '16px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.05) 100%)',
                                border: '1px solid rgba(245,158,11,0.2)'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {recommendations.map((rec, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)'
                                        }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                backgroundColor: rec.priority === 'high' ? '#ef4444' : '#f59e0b',
                                                color: 'white',
                                                textTransform: 'uppercase'
                                            }}>
                                                {rec.priority}
                                            </span>
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                                                {rec.count} {rec.role}
                                            </span>
                                            <span style={{ fontSize: '11px', color: colors.textMuted }}>
                                                ({rec.reason})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: BRAND.primary,
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </>
    );
};

ForecastImpactPanel.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    fteImpact: PropTypes.shape({
        current: PropTypes.shape({
            demandHours: PropTypes.number,
            capacityHours: PropTypes.number
        }),
        forecast: PropTypes.shape({ total: PropTypes.number }),
        initiatives: PropTypes.shape({ total: PropTypes.number }),
        summary: PropTypes.shape({
            projectedUtilization: PropTypes.number,
            isOverCapacity: PropTypes.bool,
            totalCurrentFte: PropTypes.number,
            totalAdditionalFteNeeded: PropTypes.number
        }),
        fteAnalysis: PropTypes.object,
        recommendations: PropTypes.arrayOf(PropTypes.shape({
            priority: PropTypes.string,
            count: PropTypes.number,
            role: PropTypes.string,
            reason: PropTypes.string
        }))
    }),
    forecastName: PropTypes.string
};

export default ForecastImpactPanel;
