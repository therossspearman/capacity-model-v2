/**
 * Finance Forecast Modal
 * 
 * Premium modal for inputting ARR forecasts, configuring modeling parameters,
 * and viewing FTE analysis.
 */
import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BRAND, TOKENS, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { ConfirmModal } from './ConfirmModal';
import { analyzeCapacityGap, formatCurrency, formatHours } from '../../utils/ForecastFTEAnalyzer';

// Market configuration
const MARKETS = ['global', 'uk', 'de', 'upsell'];
const MARKET_LABELS = {
    global: 'Global',
    uk: 'Domestic UK',
    de: 'Domestic Germany',
    upsell: 'Upsell'
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Default parameters per market
const DEFAULT_PARAMETERS = {
    global: { numberOfDeals: 22, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 80, scHoursPerWave: 120, pdHoursPerWave: 40 },
    uk: { numberOfDeals: 15, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 70, scHoursPerWave: 100, pdHoursPerWave: 35 },
    de: { numberOfDeals: 10, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 75, scHoursPerWave: 110, pdHoursPerWave: 38 },
    upsell: { numberOfDeals: 10, avgProjectsPerDeal: 3, avgWavesPerProject: 1, avgWaveLengthWeeks: 16, pmHoursPerWave: 40, scHoursPerWave: 60, pdHoursPerWave: 20 }
};

// Icons
const ChartIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const SettingsIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const UsersIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const CurrencyIcon = () => (
    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const FinanceForecastModal = ({
    isOpen,
    onClose,
    onSave,
    onApplyToChart,
    onLoad,
    onDelete,
    savedForecasts = [],
    initialArrData = null,
    initialParameters = null,
    initialName = '',
    initialFY = null,
    fyDates = {},
    currentFTECounts = { pm: 0, sc: 0, pd: 0 },
    avgBillableHoursPerWeek = 32
}) => {
    const { isDark, colors } = useTheme();
    const [activeTab, setActiveTab] = useState('arr');
    const [selectedMarket, setSelectedMarket] = useState('global');
    const [forecastName, setForecastName] = useState(initialName || '');
    const [showLoadDropdown, setShowLoadDropdown] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // forecast to confirm delete
    const [maxProjectsPerPerson, setMaxProjectsPerPerson] = useState(5);

    // FY selection - determines when forecast starts on chart
    const currentYear = new Date().getFullYear();
    const fyOptions = [
        { value: currentYear, label: `FY ${currentYear}/${(currentYear + 1).toString().slice(-2)}` },
        { value: currentYear + 1, label: `FY ${currentYear + 1}/${(currentYear + 2).toString().slice(-2)}` },
        { value: currentYear + 2, label: `FY ${currentYear + 2}/${(currentYear + 3).toString().slice(-2)}` }
    ];
    const [selectedFY, setSelectedFY] = useState(initialFY || currentYear); // Default to current/upcoming FY

    // ARR input state
    const [arrData, setArrData] = useState(initialArrData || {
        Q1: { global: 0, uk: 0, de: 0, upsell: 0 },
        Q2: { global: 0, uk: 0, de: 0, upsell: 0 },
        Q3: { global: 0, uk: 0, de: 0, upsell: 0 },
        Q4: { global: 0, uk: 0, de: 0, upsell: 0 }
    });

    // Parameters state
    const [parameters, setParameters] = useState(initialParameters || DEFAULT_PARAMETERS);

    // Tabs configuration
    const tabs = [
        { id: 'arr', label: 'ARR Input', icon: <ChartIcon /> },
        { id: 'params', label: 'Parameters', icon: <SettingsIcon /> },
        { id: 'fte', label: 'FTE Analysis', icon: <UsersIcon /> }
    ];

    // Calculate projections from ARR
    // Logic:
    // 1. Calculate Total Effort (Hours) required for the ARR volume
    // 2. Calculate Duration (Weeks) of that effort (Waves * Wave Length)
    // 3. Weekly Load = Total Effort / Duration
    // 4. Quarterly Load = Weekly Load * 13
    const calculateProjections = useCallback((arr, params, market = 'global', totalMarketArr = 0) => {
        if (!arr || arr <= 0) return { projects: 0, deals: 0, avgArrPerProject: 0, hours: { pm: 0, sc: 0, pd: 0, total: 0 }, totalHours: { pm: 0, sc: 0, pd: 0, total: 0 } };

        let totalPmHours = 0;
        let totalScHours = 0;
        let totalPdHours = 0;
        let durationWeeks = 13;

        let projects = 0;
        let deals = params.numberOfDeals || 1;
        const projectsPerDeal = params.avgProjectsPerDeal || 1;

        // Derive avg ARR per project from total market ARR
        const effectiveTotalArr = totalMarketArr > 0 ? totalMarketArr : arr;
        const avgArrPerProject = effectiveTotalArr / deals / projectsPerDeal;

        // Domestic markets: Direct projects × hours per project
        if (market === 'uk' || market === 'de') {
            projects = arr / Math.max(1, avgArrPerProject);
            totalPmHours = projects * params.pmHoursPerWave;
            totalScHours = projects * params.scHoursPerWave;
            totalPdHours = projects * params.pdHoursPerWave;

            durationWeeks = Math.max(1, params.avgWaveLengthWeeks);
        } else {
            // Global market: Deal-based model
            const dealArr = avgArrPerProject * projectsPerDeal;
            const quarterDeals = arr / Math.max(1, dealArr);
            projects = quarterDeals * projectsPerDeal;

            const pmHoursPerDeal = params.pmHoursPerWave * projectsPerDeal;
            const scHoursPerDeal = params.scHoursPerWave * projectsPerDeal;
            const pdHoursPerDeal = params.pdHoursPerWave * projectsPerDeal;

            totalPmHours = quarterDeals * pmHoursPerDeal;
            totalScHours = quarterDeals * scHoursPerDeal;
            totalPdHours = quarterDeals * pdHoursPerDeal;

            durationWeeks = Math.max(1, params.avgWavesPerProject * params.avgWaveLengthWeeks);
        }

        // Quarterly rate (for chart demand spreading)
        const weeksInQuarter = 13;
        const pmQuarterly = (totalPmHours / durationWeeks) * weeksInQuarter;
        const scQuarterly = (totalScHours / durationWeeks) * weeksInQuarter;
        const pdQuarterly = (totalPdHours / durationWeeks) * weeksInQuarter;

        return {
            projects: Math.round(projects * 10) / 10,
            deals: Math.round((market === 'global' ? (arr / Math.max(1, avgArrPerProject * projectsPerDeal)) : projects) * 10) / 10,
            avgArrPerProject: Math.round(avgArrPerProject),
            // Quarterly rate hours (used for chart demand spreading)
            hours: {
                pm: pmQuarterly,
                sc: scQuarterly,
                pd: pdQuarterly,
                total: pmQuarterly + scQuarterly + pdQuarterly
            },
            // Absolute total hours (used for summary display)
            totalHours: {
                pm: totalPmHours,
                sc: totalScHours,
                pd: totalPdHours,
                total: totalPmHours + totalScHours + totalPdHours
            }
        };
    }, []);

    // Calculate totals
    const totals = useMemo(() => {
        let totalArr = 0;
        let totalPm = 0, totalSc = 0, totalPd = 0;
        let totalAbsPm = 0, totalAbsSc = 0, totalAbsPd = 0;
        let totalProjects = 0;

        // Pre-compute total ARR per market for deriving avgArrPerProject
        const marketTotals = {};
        MARKETS.forEach(m => {
            marketTotals[m] = QUARTERS.reduce((sum, q) => sum + (arrData[q]?.[m] || 0), 0);
        });

        // Count total deals across all markets
        let totalDeals = 0;
        MARKETS.forEach(m => {
            const params = parameters[m] || DEFAULT_PARAMETERS[m];
            totalDeals += params.numberOfDeals || 0;
        });

        QUARTERS.forEach(q => {
            MARKETS.forEach(m => {
                const arr = arrData[q]?.[m] || 0;
                totalArr += arr;

                const params = parameters[m] || DEFAULT_PARAMETERS[m];
                const proj = calculateProjections(arr, params, m, marketTotals[m]);

                totalPm += proj.hours.pm;
                totalSc += proj.hours.sc;
                totalPd += proj.hours.pd;
                totalAbsPm += proj.totalHours.pm;
                totalAbsSc += proj.totalHours.sc;
                totalAbsPd += proj.totalHours.pd;
                totalProjects += proj.projects;
            });
        });

        return {
            arr: totalArr,
            hours: { pm: totalPm, sc: totalSc, pd: totalPd, total: totalPm + totalSc + totalPd },
            totalHours: { pm: totalAbsPm, sc: totalAbsSc, pd: totalAbsPd, total: totalAbsPm + totalAbsSc + totalAbsPd },
            projects: totalProjects,
            deals: totalDeals,
            marketTotals
        };
    }, [arrData, parameters, calculateProjections]);

    // FTE Analysis
    const fteAnalysis = useMemo(() => {
        return analyzeCapacityGap({
            forecastByRole: totals.hours,
            currentFTECounts,
            avgBillableHoursPerWeek,
            weeks: 52
        });
    }, [totals.hours, currentFTECounts, avgBillableHoursPerWeek]);

    // Quarterly breakdown for display
    const quarterlyBreakdown = useMemo(() => {
        return QUARTERS.map(q => {
            let qDeals = 0, qProjects = 0, qHours = 0;
            const byMarket = {};

            MARKETS.forEach(m => {
                const arr = arrData[q]?.[m] || 0;
                const params = parameters[m] || DEFAULT_PARAMETERS[m];
                const proj = calculateProjections(arr, params, m, totals.marketTotals?.[m] || 0);

                byMarket[m] = {
                    arr,
                    deals: proj.deals,
                    projects: proj.projects,
                    hours: proj.totalHours.total
                };

                qDeals += proj.deals;
                qProjects += proj.projects;
                qHours += proj.totalHours.total;
            });

            return { quarter: q, deals: qDeals, projects: qProjects, hours: qHours, byMarket };
        });
    }, [arrData, parameters, calculateProjections, totals.marketTotals]);

    // Update ARR value
    const updateArr = useCallback((quarter, market, value) => {
        setArrData(prev => ({
            ...prev,
            [quarter]: {
                ...prev[quarter],
                [market]: parseFloat(value) || 0
            }
        }));
    }, []);

    // Update parameter
    const updateParam = useCallback((market, key, value) => {
        setParameters(prev => ({
            ...prev,
            [market]: {
                ...prev[market],
                [key]: parseFloat(value) || 0
            }
        }));
    }, []);

    // Styles
    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        fontSize: '13px',
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bgAlt,
        color: colors.textPrimary,
        outline: 'none',
        textAlign: 'right'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '10px',
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '6px'
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    zIndex: Z_INDEX.MODAL_BACKDROP
                }}
                onClick={onClose}
            >
                <div
                    style={{
                        backgroundColor: colors.bgModal,
                        borderRadius: '12px',
                        boxShadow: colors.shadowXl,
                        border: `1px solid ${colors.border}`,
                        width: '100%',
                        maxWidth: '900px',
                        height: '620px',
                        display: 'flex',
                        overflow: 'hidden',
                        zIndex: Z_INDEX.MODAL
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Sidebar */}
                    <div style={{
                        width: '220px',
                        minWidth: '220px',
                        backgroundColor: colors.bgAlt,
                        borderRight: `1px solid ${colors.border}`,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '8px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white'
                            }}>
                                <CurrencyIcon />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Finance Forecast</h3>
                                <p style={{ fontSize: '10px', color: colors.textMuted, margin: 0 }}>{fyDates.fyLabel || 'FY 2026/27'}</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        backgroundColor: activeTab === tab.id ? colors.bgCard : 'transparent',
                                        color: activeTab === tab.id ? '#3b82f6' : colors.textSecondary,
                                        boxShadow: activeTab === tab.id ? `0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px ${colors.border}` : 'none'
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </nav>

                        {/* Summary Card */}
                        <div style={{
                            padding: '16px',
                            backgroundColor: 'rgba(59, 130, 246, 0.05)',
                            borderRadius: '10px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            marginTop: '16px'
                        }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px' }}>Summary</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6', lineHeight: 1 }}>
                                {formatCurrency(totals.arr)}
                            </div>
                            <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>Total FY ARR</div>
                            <div style={{ marginTop: '12px', fontSize: '11px', color: colors.textSecondary }}>
                                <div>~{Math.round(totals.projects)} projects</div>
                                <div>~{formatHours(totals.totalHours.total)} hours</div>
                                <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                    {totals.deals} deals across all markets
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: colors.bgModal }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text, margin: 0 }}>
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                            <button onClick={onClose} style={{ padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: colors.textMuted }}>
                                {ICONS.CLOSE}
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
                            {/* ARR Input Tab */}
                            {activeTab === 'arr' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Forecast Name + FY Selection Row */}
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={labelStyle}>Forecast Name</label>
                                            <input
                                                type="text"
                                                value={forecastName}
                                                onChange={(e) => setForecastName(e.target.value)}
                                                placeholder="e.g., FY27 Budget V1"
                                                style={{ ...inputStyle, textAlign: 'left' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>Fiscal Year</label>
                                            <select
                                                value={selectedFY}
                                                onChange={(e) => setSelectedFY(parseInt(e.target.value))}
                                                style={{
                                                    ...inputStyle,
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    appearance: 'none',
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                                                    backgroundPosition: 'right 10px center',
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundSize: '16px',
                                                    paddingRight: '32px'
                                                }}
                                            >
                                                {fyOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* ARR Grid */}
                                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: colors.bgAlt }}>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', width: '140px' }}>Market</th>
                                                    {QUARTERS.map(q => (
                                                        <th key={q} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>{q}</th>
                                                    ))}
                                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {MARKETS.map(market => {
                                                    const marketTotal = QUARTERS.reduce((sum, q) => sum + (arrData[q]?.[market] || 0), 0);
                                                    return (
                                                        <tr key={market} style={{ borderTop: `1px solid ${colors.border}` }}>
                                                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>{MARKET_LABELS[market]}</td>
                                                            {QUARTERS.map(q => (
                                                                <td key={q} style={{ padding: '8px 12px' }}>
                                                                    <div style={{ position: 'relative' }}>
                                                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: '12px' }}>£</span>
                                                                        <input
                                                                            type="number"
                                                                            value={arrData[q]?.[market] || ''}
                                                                            onChange={(e) => updateArr(q, market, e.target.value)}
                                                                            placeholder="0"
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '8px 10px 8px 24px',
                                                                                fontSize: '13px',
                                                                                fontFamily: 'monospace',
                                                                                borderRadius: '6px',
                                                                                border: `1px solid ${colors.border}`,
                                                                                backgroundColor: colors.bgCard,
                                                                                color: colors.textPrimary,
                                                                                textAlign: 'right'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: '#3b82f6' }}>
                                                                {formatCurrency(marketTotal)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderTop: `2px solid ${colors.border}` }}>
                                                    <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Total</td>
                                                    {QUARTERS.map(q => {
                                                        const qTotal = MARKETS.reduce((sum, m) => sum + (arrData[q]?.[m] || 0), 0);
                                                        return (
                                                            <td key={q} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: '#3b82f6' }}>
                                                                {formatCurrency(qTotal)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '800', fontFamily: 'monospace', color: '#3b82f6' }}>
                                                        {formatCurrency(totals.arr)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Quarterly Breakdown: Deals & Hours by Quarter */}
                                    {totals.totalHours.total > 0 && (
                                        <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: colors.bgAlt }}>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', width: '140px' }}>Quarter</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Deals</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Projects</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Total Hours</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {quarterlyBreakdown.map(qb => (
                                                        <tr key={qb.quarter} style={{ borderTop: `1px solid ${colors.border}` }}>
                                                            <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>{qb.quarter}</td>
                                                            <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', color: colors.textSecondary }}>{Math.round(qb.deals * 10) / 10}</td>
                                                            <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', color: colors.textSecondary }}>{Math.round(qb.projects)}</td>
                                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', fontFamily: 'monospace', color: colors.textPrimary }}>{formatHours(qb.hours)}h</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderTop: `2px solid ${colors.border}` }}>
                                                        <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Total</td>
                                                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: '#3b82f6' }}>{Math.round(quarterlyBreakdown.reduce((s, q) => s + q.deals, 0) * 10) / 10}</td>
                                                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: '#3b82f6' }}>{Math.round(totals.projects)}</td>
                                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '800', fontFamily: 'monospace', color: '#3b82f6' }}>{formatHours(totals.totalHours.total)}h</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Parameters Tab */}
                            {activeTab === 'params' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Market Selector */}
                                    <div style={{ display: 'flex', backgroundColor: colors.bgAlt, borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
                                        {MARKETS.map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setSelectedMarket(m)}
                                                style={{
                                                    padding: '8px 20px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedMarket === m ? '#3b82f6' : 'transparent',
                                                    color: selectedMarket === m ? 'white' : colors.textSecondary,
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {MARKET_LABELS[m]}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Parameters Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        {/* Deal → Project Conversion */}
                                        <div style={{ padding: '16px', backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                                            <h4 style={{ fontSize: '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '16px' }}>Deal → Project Conversion</h4>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={labelStyle}>Number of Deals</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.numberOfDeals || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'numberOfDeals', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={labelStyle}>Avg Projects per Deal</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={parameters[selectedMarket]?.avgProjectsPerDeal || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'avgProjectsPerDeal', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>

                                            {/* Derived avg ARR per project */}
                                            {(() => {
                                                const p = parameters[selectedMarket] || DEFAULT_PARAMETERS[selectedMarket];
                                                const marketArr = totals.marketTotals?.[selectedMarket] || 0;
                                                const deals = p.numberOfDeals || 1;
                                                const ppd = p.avgProjectsPerDeal || 1;
                                                const derivedArr = marketArr / deals / ppd;
                                                return (
                                                    <div style={{
                                                        padding: '8px 12px',
                                                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                                        borderRadius: '6px',
                                                        border: '1px solid rgba(59, 130, 246, 0.15)'
                                                    }}>
                                                        <div style={{ fontSize: '9px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '2px' }}>Derived Avg ARR per Project</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>
                                                            {marketArr > 0 ? formatCurrency(derivedArr) : '—'}
                                                        </div>
                                                        {marketArr > 0 && (
                                                            <div style={{ fontSize: '9px', color: colors.textMuted, marginTop: '2px' }}>
                                                                {formatCurrency(marketArr)} ÷ {deals} deals ÷ {ppd} projects
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Project → Effort Distribution */}
                                        <div style={{ padding: '16px', backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                                            <h4 style={{ fontSize: '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '16px' }}>Project → Effort Distribution</h4>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={labelStyle}>Avg Waves per Deal</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.avgWavesPerProject || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'avgWavesPerProject', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>

                                            <div>
                                                <label style={labelStyle}>Avg Wave Length (weeks)</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.avgWaveLengthWeeks || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'avgWaveLengthWeeks', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hours per Project */}
                                    <div style={{ padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px' }}>
                                        <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '16px' }}>Hours per Project (by Role)</h4>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>PM Hours</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.pmHoursPerWave || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'pmHoursPerWave', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>SC Hours</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.scHoursPerWave || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'scHoursPerWave', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>PD Hours</label>
                                                <input
                                                    type="number"
                                                    value={parameters[selectedMarket]?.pdHoursPerWave || 0}
                                                    onChange={(e) => updateParam(selectedMarket, 'pdHoursPerWave', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FTE Analysis Tab */}
                            {activeTab === 'fte' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Assumptions */}
                                    <div style={{ padding: '16px', backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                                        <h4 style={{ fontSize: '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>⚡</span> Assumptions
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', fontSize: '12px', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ color: colors.textMuted }}>Billable hours/week:</span>
                                                <span style={{ fontWeight: '600', marginLeft: '8px' }}>{avgBillableHoursPerWeek}h</span>
                                            </div>
                                            <div>
                                                <span style={{ color: colors.textMuted }}>Weeks in FY:</span>
                                                <span style={{ fontWeight: '600', marginLeft: '8px' }}>52</span>
                                            </div>
                                            <div>
                                                <span style={{ color: colors.textMuted }}>Hours/FTE/year:</span>
                                                <span style={{ fontWeight: '600', marginLeft: '8px' }}>{formatHours(avgBillableHoursPerWeek * 52)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ color: colors.textMuted }}>Max projects/person:</span>
                                                <input
                                                    type="number"
                                                    value={maxProjectsPerPerson}
                                                    onChange={(e) => setMaxProjectsPerPerson(Math.max(1, parseInt(e.target.value) || 1))}
                                                    style={{
                                                        width: '48px',
                                                        padding: '4px 6px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        borderRadius: '4px',
                                                        border: `1px solid ${colors.border}`,
                                                        backgroundColor: colors.bgAlt,
                                                        color: colors.textPrimary,
                                                        textAlign: 'center'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project-Based FTE Check */}
                                    {(() => {
                                        // Calculate peak concurrent projects
                                        // For each quarter, sum projects across all markets
                                        const peakProjects = Math.max(...quarterlyBreakdown.map(q => q.projects), 0);
                                        const projectBasedFte = Math.ceil(peakProjects / maxProjectsPerPerson * 10) / 10;
                                        const hourBasedFte = fteAnalysis.total.fteRequired;
                                        const effectiveFte = Math.max(projectBasedFte, hourBasedFte);
                                        const binding = projectBasedFte > hourBasedFte ? 'projects' : 'hours';

                                        return (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                                <div style={{ padding: '16px', backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Hours-Based FTE</div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: binding === 'hours' ? '#3b82f6' : colors.textSecondary }}>{hourBasedFte.toFixed(1)}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>{formatHours(fteAnalysis.total.forecastHours)}h ÷ {formatHours(avgBillableHoursPerWeek * 52)}h/FTE</div>
                                                </div>
                                                <div style={{ padding: '16px', backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Project-Based FTE</div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: binding === 'projects' ? '#3b82f6' : colors.textSecondary }}>{projectBasedFte.toFixed(1)}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>{Math.round(peakProjects)} peak projects ÷ {maxProjectsPerPerson}/person</div>
                                                </div>
                                                <div style={{ padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px' }}>Effective FTE Needed</div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#3b82f6' }}>{effectiveFte.toFixed(1)}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>Constrained by {binding}</div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* FTE Table */}
                                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: colors.bgAlt }}>
                                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Role</th>
                                                    <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Forecast Hours</th>
                                                    <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>FTE Required</th>
                                                    <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Current FTE</th>
                                                    <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Gap</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {['pm', 'sc', 'pd'].map(role => {
                                                    const data = fteAnalysis[role];
                                                    const gapColor = data.gap > 0.5 ? '#ef4444' : (data.gap < -0.5 ? BRAND.benifexGreen : colors.textSecondary);
                                                    const gapIcon = data.gap > 0.5 ? '⚠️' : (data.gap < -0.5 ? '✓' : '');

                                                    return (
                                                        <tr key={role} style={{ borderTop: `1px solid ${colors.border}` }}>
                                                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', color: colors.textPrimary }}>{role.toUpperCase()}</td>
                                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: colors.textSecondary }}>{formatHours(data.forecastHours)}h</td>
                                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', fontFamily: 'monospace', color: colors.textPrimary }}>{data.fteRequired.toFixed(1)}</td>
                                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: colors.textSecondary }}>{data.currentFte}</td>
                                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: gapColor }}>
                                                                {data.gap > 0 ? '+' : ''}{data.gap.toFixed(1)} {gapIcon}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderTop: `2px solid ${colors.border}` }}>
                                                    <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Total</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', fontFamily: 'monospace', color: '#3b82f6' }}>{formatHours(fteAnalysis.total.forecastHours)}h</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', color: '#3b82f6' }}>{fteAnalysis.total.fteRequired.toFixed(1)}</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: colors.textSecondary }}>{fteAnalysis.total.currentFte}</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', color: fteAnalysis.total.gap > 0.5 ? '#ef4444' : BRAND.benifexGreen }}>
                                                        {fteAnalysis.total.gap > 0 ? '+' : ''}{fteAnalysis.total.gap.toFixed(1)} {fteAnalysis.total.gap > 0.5 ? '⚠️' : '✓'}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Recommendation */}
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: fteAnalysis.recommendation?.severity === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                                        border: `1px solid ${fteAnalysis.recommendation?.severity === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <span style={{ fontSize: '20px' }}>{fteAnalysis.recommendation?.severity === 'warning' ? '💡' : '✅'}</span>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>{fteAnalysis.recommendation?.message}</div>
                                            {fteAnalysis.recommendation?.hires?.length > 0 && (
                                                <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px' }}>
                                                    {fteAnalysis.recommendation.hires.map(h => `${h.count} ${h.role}`).join(', ')}
                                                </div>
                                            )}
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
                            justifyContent: 'flex-end',
                            gap: '12px',
                            alignItems: 'center'
                        }}>
                            {/* Cancel Button */}
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: `1px solid ${colors.border}`,
                                    backgroundColor: 'transparent',
                                    color: colors.textSecondary,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>

                            {/* Load Saved Forecast Dropdown */}
                            {savedForecasts.length > 0 && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowLoadDropdown(!showLoadDropdown)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: `1px solid ${colors.border}`,
                                            backgroundColor: colors.bgAlt,
                                            color: colors.text,
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Load
                                    </button>
                                    {showLoadDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            marginBottom: '4px',
                                            backgroundColor: colors.bg,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            minWidth: '200px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 1000
                                        }}>
                                            {savedForecasts.map((forecast, idx) => (
                                                <div
                                                    key={forecast.id || idx}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px 12px',
                                                        borderBottom: idx < savedForecasts.length - 1 ? `1px solid ${colors.border}` : 'none'
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            // Populate modal form with loaded forecast data
                                                            if (forecast.arrData) setArrData(forecast.arrData);
                                                            if (forecast.parameters) setParameters(forecast.parameters);
                                                            if (forecast.name) setForecastName(forecast.name);
                                                            if (forecast.fyStartYear) setSelectedFY(forecast.fyStartYear);
                                                            setShowLoadDropdown(false);
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            padding: '4px 8px',
                                                            textAlign: 'left',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: colors.text,
                                                            fontSize: '13px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onMouseOver={e => e.target.style.backgroundColor = colors.bgAlt}
                                                        onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        {forecast.name || `Forecast ${idx + 1}`}
                                                    </button>
                                                    {onDelete && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteConfirm(forecast);
                                                            }}
                                                            style={{
                                                                padding: '4px 6px',
                                                                border: 'none',
                                                                backgroundColor: 'transparent',
                                                                color: '#ef4444',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                            onMouseOver={e => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                                            onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                                            title="Delete forecast"
                                                        >
                                                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Apply & Save Button (merged) */}
                            <button
                                onClick={async () => {
                                    if (onApplyToChart) onApplyToChart({ arrData, parameters, name: forecastName, fyStartYear: selectedFY });
                                    if (onSave && forecastName) onSave({ arrData, parameters, name: forecastName, fyStartYear: selectedFY });
                                }}
                                disabled={!forecastName}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: forecastName ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : colors.bgAlt,
                                    color: forecastName ? 'white' : colors.textMuted,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: forecastName ? 'pointer' : 'not-allowed',
                                    boxShadow: forecastName ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {forecastName ? 'Apply & Save' : 'Enter name to save'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={!!deleteConfirm}
                variant="danger"
                title={`Delete "${deleteConfirm?.name || 'Forecast'}"?`}
                message="This forecast will be permanently removed. This cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => { onDelete(deleteConfirm.id); setDeleteConfirm(null); }}
                onCancel={() => setDeleteConfirm(null)}
            />
        </>
    );
};

FinanceForecastModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func,
    onApplyToChart: PropTypes.func,
    onLoad: PropTypes.func,
    savedForecasts: PropTypes.array,
    initialArrData: PropTypes.object,
    initialParameters: PropTypes.object,
    fyDates: PropTypes.object,
    currentFTECounts: PropTypes.object,
    avgBillableHoursPerWeek: PropTypes.number
};

export default FinanceForecastModal;
