import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS, FY_START_MONTH } from '../../constants';

/**
 * Financial Breakdown Drawer - Premium Design
 * Shows per-project revenue contributions with glassmorphism and premium data visualization
 */
export const FinancialBreakdownDrawer = ({
    isOpen,
    onClose,
    revRecByProject = [],
    revRecTotals = {},
    title = 'Revenue Breakdown by Project',
    period = 'fy',
    onPeriodChange,
    scope = 'filtered',
    onScopeChange,
    hasActiveFilters = false
}) => {
    const { isDark, colors } = useTheme();
    const [sortBy, setSortBy] = useState('total'); // total, implFee, arr, name
    const [sortDir, setSortDir] = useState('desc');
    const [filter, setFilter] = useState('');
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Sort and filter projects
    const displayProjects = useMemo(() => {
        let projects = [...revRecByProject];

        // Filter by name/status
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            projects = projects.filter(p =>
                p.name?.toLowerCase().includes(lowerFilter) ||
                p.status?.toLowerCase().includes(lowerFilter)
            );
        }

        // Sort
        projects.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name') {
                aVal = a.name || '';
                bVal = b.name || '';
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            aVal = a[sortBy] || 0;
            bVal = b[sortBy] || 0;
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return projects;
    }, [revRecByProject, sortBy, sortDir, filter]);

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }) => (
        <span style={{ marginLeft: '4px', opacity: sortBy === field ? 1 : 0.3, fontSize: '10px' }}>
            {sortBy === field ? (sortDir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
    );

    const currentYear = new Date().getFullYear();
    // Fiscal-year start month (0-indexed; 4 = May). Single source of truth shared
    // with the worker / forecast logic — keep in settings.js, do not hardcode here.
    const fyStartMonth = FY_START_MONTH;
    const currentFyEndYear = new Date().getMonth() < fyStartMonth ? currentYear : currentYear + 1;
    const periodOptions = [
        { id: 'fy', label: `FY${String(currentFyEndYear).slice(-2)}`, color: '#00BD00' },
        { id: 'fy_next', label: `FY${String(currentFyEndYear + 1).slice(-2)}`, color: '#059669' },
        { id: 'fy_next2', label: `FY${String(currentFyEndYear + 2).slice(-2)}`, color: '#047857' },
        { id: 'cy', label: `CY ${currentYear}`, color: '#0284c7' },
        { id: 'cy_next', label: `CY ${currentYear + 1}`, color: '#7637E3' }
    ];

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    zIndex: Z_INDEX.MODAL_BACKDROP,
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />

            {/* Premium Drawer */}
            <div style={{
                position: 'fixed',
                top: '12px', right: '12px', bottom: '12px',
                width: '640px',
                maxWidth: '96vw',
                backgroundColor: colors.bgModal || '#ffffff',
                boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.25)',
                borderRadius: '24px',
                zIndex: Z_INDEX.MODAL,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                border: '1px solid rgba(255, 255, 255, 0.5)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 32px 160px 32px', // Extra bottom padding for overlap
                    background: 'linear-gradient(135deg, #00BD00 0%, #047857 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="white" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{title}</h2>
                                <p style={{ fontSize: '13px', margin: '4px 0 0', opacity: 0.9, fontWeight: '500' }}>
                                    {displayProjects.length} project{displayProjects.length !== 1 ? 's' : ''} contributors
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width: '36px', height: '36px',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                border: 'none', borderRadius: '50%',
                                cursor: 'pointer', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                                backdropFilter: 'blur(4px)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                        >{ICONS.CLOSE}</button>
                    </div>

                    {/* Metric Cards - Floating Overlap */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-40px', left: '32px', right: '32px',
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'
                    }}>
                        <div style={{
                            backgroundColor: 'white', borderRadius: '16px', padding: '16px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px' }}>Impl Fees</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7', letterSpacing: '-0.03em' }}>
                                £{Math.round(revRecTotals?.implFee?.fullYear || 0).toLocaleString()}
                            </div>
                        </div>
                        <div style={{
                            backgroundColor: 'white', borderRadius: '16px', padding: '16px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#7637E3', textTransform: 'uppercase', marginBottom: '8px' }}>ARR</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#7637E3', letterSpacing: '-0.03em' }}>
                                £{Math.round(revRecTotals?.arr?.fullYear || 0).toLocaleString()}
                            </div>
                        </div>
                        <div style={{
                            backgroundColor: '#ecfdf5', borderRadius: '16px', padding: '16px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            border: '1px solid #a7f3d0'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '8px' }}>Total</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', letterSpacing: '-0.03em' }}>
                                £{Math.round(revRecTotals?.total?.fullYear || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls Area (with Spacer for overlap) */}
                <div style={{ paddingTop: '64px', paddingBottom: '16px', paddingLeft: '32px', paddingRight: '32px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Period Toggle - Pill Shape */}
                        {onPeriodChange && (
                            <div style={{
                                display: 'inline-flex', padding: '4px', borderRadius: '12px',
                                backgroundColor: '#f1f5f9', gap: '2px'
                            }}>
                                {periodOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => onPeriodChange(opt.id)}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: period === opt.id ? 'white' : 'transparent',
                                            color: period === opt.id ? opt.color : '#64748b',
                                            fontSize: '12px',
                                            fontWeight: period === opt.id ? '700' : '600',
                                            cursor: 'pointer',
                                            boxShadow: period === opt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {onScopeChange && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>View:</span>
                                <select
                                    value={(!hasActiveFilters && scope === 'filtered') ? 'all' : scope}
                                    onChange={(e) => onScopeChange(e.target.value)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                        fontSize: '12px', fontWeight: '600', color: '#334155', backgroundColor: 'white',
                                        cursor: 'pointer', outline: 'none'
                                    }}
                                >
                                    <option value="filtered" disabled={!hasActiveFilters}>Filtered Selection</option>
                                    <option value="all">All Projects</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Search Field */}
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search financial records..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 12px 10px 36px',
                                    border: '1px solid #e2e8f0', borderRadius: '12px',
                                    fontSize: '13px', backgroundColor: '#f8fafc',
                                    outline: 'none', transition: 'all 0.2s'
                                }}
                                onFocus={e => { e.target.style.backgroundColor = 'white'; e.target.style.borderColor = '#94a3b8'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
                                onBlur={e => { e.target.style.backgroundColor = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fafafa' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th onClick={() => handleSort('name')} style={{ padding: '16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', cursor: 'pointer' }}>PROJECT<SortIcon field="name" /></th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>STATUS</th>
                                <th onClick={() => handleSort('implFee')} style={{ padding: '16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', cursor: 'pointer' }}>IMPL FEE<SortIcon field="implFee" /></th>
                                <th onClick={() => handleSort('arr')} style={{ padding: '16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#7637E3', textTransform: 'uppercase', cursor: 'pointer' }}>ARR<SortIcon field="arr" /></th>
                                <th onClick={() => handleSort('total')} style={{ padding: '16px 24px 16px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#00BD00', textTransform: 'uppercase', cursor: 'pointer' }}>TOTAL<SortIcon field="total" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayProjects.map((project, idx) => {
                                const isExpanded = expandedRows.has(project.id);
                                return (
                                    <React.Fragment key={project.id}>
                                        <tr
                                            onClick={() => toggleRow(project.id)}
                                            style={{
                                                backgroundColor: isExpanded ? '#f8fafc' : 'white',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'all 0.1s'
                                            }}
                                            onMouseEnter={e => !isExpanded && (e.currentTarget.style.backgroundColor = '#fafafa')}
                                            onMouseLeave={e => !isExpanded && (e.currentTarget.style.backgroundColor = 'white')}
                                        >
                                            <td style={{ padding: '0 0 0 16px', textAlign: 'center' }}>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#f1f5f9',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#94a3b8', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'all 0.2s'
                                                }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{project.name}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                    {project.revenueModel || 'Standard'} • {project.kickOffDate || '?'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '12px',
                                                    backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em'
                                                }}>
                                                    {project.status || 'Active'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: '500', color: '#0369a1' }}>
                                                £{Math.round(project.implFee || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: '500', color: '#7637E3' }}>
                                                £{Math.round(project.arr || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '16px 24px 16px 16px', textAlign: 'right', fontWeight: '700', color: '#15803d', fontSize: '14px' }}>
                                                £{Math.round(project.total || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                        {/* EXPANDED DETAILS */}
                                        {isExpanded && project.debug && (
                                            <tr style={{ backgroundColor: '#f8fafc', boxShadow: 'inset 0 4px 6px -4px rgba(0,0,0,0.05)' }}>
                                                <td colSpan={6} style={{ padding: '0 24px 24px 64px' }}>
                                                    <div style={{
                                                        padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
                                                        display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 2fr', gap: '24px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Calculation Basis</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                                    <span style={{ color: '#64748b' }}>Raw Impl Fee:</span>
                                                                    <span style={{ fontWeight: '600', color: '#334155' }}>£{project.debug.rawImplFee?.toLocaleString() || '0'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                                    <span style={{ color: '#64748b' }}>Raw ARR:</span>
                                                                    <span style={{ fontWeight: '600', color: '#334155' }}>£{project.debug.rawArr?.toLocaleString() || '0'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                                    <span style={{ color: '#64748b' }}>Period Clamped:</span>
                                                                    <span style={{ fontWeight: '600', color: '#334155' }}>{project.debug.periodStart} → {project.debug.periodEnd}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Recognition Logic</div>
                                                            {project.debug.implFeeReason && (
                                                                <div style={{ marginBottom: '6px', fontSize: '12px', color: '#0369a1', padding: '6px', backgroundColor: '#e0f2fe', borderRadius: '6px', display: 'flex', gap: '6px' }}>
                                                                    <span style={{ fontWeight: '700' }}>Impl:</span> {project.debug.implFeeReason}
                                                                </div>
                                                            )}
                                                            {project.debug.arrReason && (
                                                                <div style={{ fontSize: '12px', color: '#7637E3', padding: '6px', backgroundColor: '#efe9fd', borderRadius: '6px', display: 'flex', gap: '6px' }}>
                                                                    <span style={{ fontWeight: '700' }}>ARR:</span> {project.debug.arrReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayProjects.length === 0 && (
                        <div style={{ padding: '64px', textAlign: 'center', color: '#94a3b8' }}>
                            No projects match the current filters.
                        </div>
                    )}
                </div>

                {/* Footer Fade */}
                <div style={{
                    height: '24px', background: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))',
                    pointerEvents: 'none', position: 'absolute', bottom: 0, left: 0, right: 0
                }} />
            </div>

            {/* Animation styles */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default FinancialBreakdownDrawer;

FinancialBreakdownDrawer.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    revRecByProject: PropTypes.array,
    revRecTotals: PropTypes.object,
    title: PropTypes.string,
    period: PropTypes.string,
    onPeriodChange: PropTypes.func,
    scope: PropTypes.string,
    onScopeChange: PropTypes.func,
    hasActiveFilters: PropTypes.bool
};
