/**
 * ReprioritizationTab - Unified Reprioritize + Resource View
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Wizard-style interface for configuring and running the portfolio
 * reprioritization engine. After running, results show tiered project
 * cards with INLINE resourcing — expand any project to assign PM/SC/PD
 * resources from merged squad pools. Supports iterative re-optimisation
 * and multi-group squad merging.
 * 
 * @version 2.0.0
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
    scorePortfolio,
    scoreProject,
    generateReprioritizationPlan,
    buildAIInsightsPayload,
    runReprioritizationMonteCarlo,
    runSensitivityAnalysis,
    generateStrategyComparison,
    TIER_CONFIG,
    RISK_CONFIG,
    REPRI_STRATEGY_PRESETS,
    calculateFinancialImpact
} from '../../utils/PortfolioReprioritizer';
import { runGreedyOptimizer, buildSolverAIPayload } from '../../utils/OptimizationSolver';
import { createOptimizationRun } from '../../services/OptimizationRunService';
import { BRAND } from '../../design-system';
import { useSession } from '@airtable/blocks/interface/ui';
import { getCategoryForFunction, formatNumber } from '../../utils';
import { SETTINGS } from '../../constants/settings';

/* ─── Resourcing Sub-Components ─── */
const formatDateShort = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return '—'; }
};
const roleColors = { pm: '#BD65FF', sc: '#3b82f6', pd: '#ec4899' };
const roleLabels = { pm: 'Project Manager', sc: 'Solution Consultant', pd: 'Platform Developer' };

/* ResourceChip — inline resource row inside project expander */
const ResourceChip = ({ member, allResources, onUnassign, onUpdateAllocation, teamLength, isDark }) => {
    const full = allResources?.find(r => r.id === member.id);
    const headshot = member.isPlaceholder ? null : (full?.headshot || member.headshot);
    const initials = member.isPlaceholder ? '?' : (member.name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const [localPct, setLocalPct] = useState(member.allocationPct ?? '');
    useEffect(() => { setLocalPct(member.allocationPct ?? ''); }, [member.allocationPct]);
    const commitPct = () => { let v = parseInt(localPct, 10); if (isNaN(v)) v = 0; v = Math.max(0, Math.min(100, v)); if (v !== member.allocationPct) onUpdateAllocation(member.id, v); };
    const isRamping = full?.rampProfile;
    const targetUtil = full?.targetUtilization ?? 0.8;
    const targetPct = Math.round(targetUtil * 100);
    const leaveDate = full?.leaveDate;
    const hasLeaveDate = leaveDate && new Date(leaveDate) > new Date();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: member.isPlaceholder ? (isDark ? '#2d1b69' : '#faf5ff') : (isDark ? '#0f172a' : '#f8fafc'), border: member.isPlaceholder ? '1px dashed #c084fc' : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', fontSize: '12px' }}>
            {headshot ? <img src={headshot} alt={member.name} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} /> : <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: member.isPlaceholder ? '#e9d5ff' : (isDark ? '#334155' : '#f1f5f9'), color: member.isPlaceholder ? '#7637E3' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', flexShrink: 0 }}>{initials}</div>}
            <div style={{ minWidth: 0, flex: 1 }}>
                <span title={member.name} style={{ fontWeight: '600', color: member.isPlaceholder ? '#7637E3' : (isDark ? '#f1f5f9' : '#1e293b'), display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{member.name}</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                    {full?.squads?.[0] && <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{full.squads[0]}</span>}
                    {isRamping && <span title={`Ramping: ${full.rampProfile}`} style={{ fontSize: '8px', fontWeight: '600', color: '#f59e0b', backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fefce8', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fde68a' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ verticalAlign: 'middle', marginRight: '2px' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>Ramp</span>}
                    {targetPct < 100 && <span title={`Target utilisation: ${targetPct}%`} style={{ fontSize: '8px', fontWeight: '600', color: '#3b82f6', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', padding: '1px 4px', borderRadius: '3px', border: '1px solid #bfdbfe' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '2px' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>{targetPct}%</span>}
                    {hasLeaveDate && <span title={`Leaving: ${formatDateShort(leaveDate)}`} style={{ fontSize: '8px', fontWeight: '600', color: '#ef4444', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fecaca' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '2px' }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>{formatDateShort(leaveDate)}</span>}
                </div>
            </div>
            {teamLength > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px' }}><input type="number" min="0" max="100" value={localPct} placeholder="—" onChange={e => setLocalPct(e.target.value)} onBlur={commitPct} onKeyDown={e => e.key === 'Enter' && e.target.blur()} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ width: '38px', padding: '3px 4px', fontSize: '11px', fontWeight: '600', textAlign: 'center', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`, borderRadius: '4px', backgroundColor: localPct ? (isDark ? 'rgba(0,189,0,0.15)' : '#f0fdf4') : (isDark ? '#0f172a' : 'white'), color: localPct ? '#00BD00' : '#64748b', outline: 'none' }} /><span style={{ fontSize: '10px', color: '#94a3b8' }}>%</span></div>}
            <button onClick={e => { e.stopPropagation(); onUnassign(member.id); }} style={{ color: '#cbd5e1', cursor: 'pointer', border: 'none', background: 'none', padding: '2px', fontSize: '14px' }}>✕</button>
        </div>
    );
};

/* ResourcePicker — inline dropdown for picking a resource */
const ResourcePicker = ({ role, availableResources, projectSquad, roleMapping, onAssign, onClose, isDark }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);
    const targetCategory = role === 'pm' ? 'PM' : role === 'sc' ? 'SC' : 'PD';
    const hasRoleMapping = roleMapping && Object.keys(roleMapping).length > 0 && Object.values(roleMapping).some(v => v && (Array.isArray(v) ? v.length > 0 : true));
    const groups = useMemo(() => {
        const mapped = availableResources.map(r => { const cat = getCategoryForFunction(r.adJobTitle || r.role, roleMapping); return { ...r, matchesRole: hasRoleMapping && cat && cat.toUpperCase() === targetCategory }; });
        const recommended = mapped.filter(r => r.matchesRole); const others = mapped.filter(r => !r.matchesRole);
        const grps = {};
        if (recommended.length > 0) grps['★ Recommended (' + targetCategory + ')'] = recommended.sort((a, b) => a.name.localeCompare(b.name));
        others.forEach(r => { const sq = r.squads?.[0] || 'Unassigned'; if (!grps[sq]) grps[sq] = []; grps[sq].push(r); });
        Object.values(grps).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
        const keys = Object.keys(grps).sort((a, b) => { if (a.startsWith('★')) return -1; if (b.startsWith('★')) return 1; if (a === projectSquad) return -1; if (b === projectSquad) return 1; return a.localeCompare(b); });
        return keys.map(k => ({ squad: k, resources: grps[k], isRecommended: k.startsWith('★'), isProjectSquad: k === projectSquad }));
    }, [availableResources, targetCategory, projectSquad]);
    return (
        <div style={{ position: 'relative', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
            <input ref={inputRef} type="text" placeholder="Search resources…" value={query} onChange={e => setQuery(e.target.value)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onBlur={() => setTimeout(onClose, 200)} style={{ width: '100%', padding: '8px 10px', fontSize: '11px', border: `2px solid ${isDark ? '#7637E3' : '#7637E3'}`, borderRadius: '8px 8px 0 0', backgroundColor: isDark ? '#0f172a' : 'white', color: isDark ? '#f1f5f9' : '#1e293b', outline: 'none' }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: isDark ? '#1e293b' : 'white', border: `2px solid ${isDark ? '#7637E3' : '#7637E3'}`, borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '200px', overflowY: 'auto', zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {/* Placeholder option */}
                <div onClick={e => { e.stopPropagation(); onAssign(`PLACEHOLDER_${Date.now()}`, role, { isPlaceholder: true, name: `TBD ${roleLabels[role] || role}` }); onClose(); }} onMouseDown={e => e.stopPropagation()} style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#7637E3', backgroundColor: isDark ? '#1e1338' : '#faf5ff', borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}` }} onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#2d1b69' : '#f3e8ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = isDark ? '#1e1338' : '#faf5ff'}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e9d5ff', color: '#7637E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>?</div>
                    <span>➕ Add Placeholder (TBD)</span>
                </div>
                {groups.filter(g => g.resources.some(r => r.name.toLowerCase().includes(query.toLowerCase()))).map(g => (
                    <div key={g.squad}>
                        <div style={{ padding: '6px 10px', fontSize: '9px', fontWeight: '700', color: g.isRecommended ? '#7637E3' : '#64748b', backgroundColor: g.isRecommended ? (isDark ? '#1e1338' : '#F7F3ED') : (isDark ? '#0f172a' : '#f8fafc'), textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>{g.squad}</div>
                        {g.resources.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).map(r => {
                            const hs = r.headshot?.[0]?.url || r.headshot?.[0]?.thumbnails?.small?.url; const ini = (r.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);
                            const tp = Math.round((r.targetUtilization ?? 0.8) * 100); const isLeaving = r.leaveDate && new Date(r.leaveDate) > new Date();
                            return (<div key={r.id} onClick={e => { e.stopPropagation(); onAssign(r.id, role); onClose(); }} onMouseDown={e => e.stopPropagation()} style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: isDark ? '#e2e8f0' : '#334155', backgroundColor: isDark ? '#1e293b' : 'white', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : 'white'}>
                                {hs ? <img src={hs} alt={r.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: isDark ? '#334155' : '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>{ini}</div>}
                                <span style={{ fontWeight: '500', flex: 1 }}>{r.name}</span>
                                {r.rampProfile && <span style={{ fontSize: '8px', fontWeight: '600', color: '#f59e0b', backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fefce8', padding: '1px 4px', borderRadius: '3px' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ verticalAlign: 'middle', marginRight: '1px' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>Ramp</span>}
                                {tp < 100 && <span style={{ fontSize: '8px', fontWeight: '600', color: '#3b82f6', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', padding: '1px 4px', borderRadius: '3px' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle', marginRight: '1px' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>{tp}%</span>}
                                {isLeaving && <span style={{ fontSize: '8px', fontWeight: '600', color: '#ef4444', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', padding: '1px 4px', borderRadius: '3px' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>}
                                {r.matchesRole && <span style={{ fontSize: '8px', fontWeight: '600', color: '#7637E3', backgroundColor: isDark ? 'rgba(118,55,227,0.15)' : '#F7F3ED', padding: '2px 4px', borderRadius: '3px' }}>{targetCategory}</span>}
                            </div>);
                        })}
                    </div>
                ))}
                {groups.filter(g => g.resources.some(r => r.name.toLowerCase().includes(query.toLowerCase()))).length === 0 && <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No resources found</div>}
            </div>
        </div>
    );
};

/* ─── MergeIcon SVG ─── */
const MergeIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" /></svg>);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const sectionCard = (isDark) => ({
    padding: '20px',
    borderRadius: '16px',
    backgroundColor: isDark ? '#1e293b' : 'white',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
});

const sectionTitle = (isDark) => ({
    fontSize: '14px',
    fontWeight: '700',
    color: isDark ? '#f1f5f9' : '#1e293b',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
});

const inputStyle = (isDark) => ({
    width: '100%',
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '10px',
    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
    backgroundColor: isDark ? '#0f172a' : '#f9fafb',
    color: isDark ? '#f1f5f9' : '#1e293b',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
});

const chipStyle = (isActive, color, isDark) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: `2px solid ${isActive ? color : (isDark ? '#334155' : '#e2e8f0')}`,
    backgroundColor: isActive ? `${color}18` : 'transparent',
    color: isActive ? color : (isDark ? '#94a3b8' : '#64748b')
});

const numberInputStyle = (isDark) => ({
    width: '100px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '600',
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
    backgroundColor: isDark ? '#0f172a' : '#f9fafb',
    color: isDark ? '#f1f5f9' : '#1e293b',
    textAlign: 'center',
    outline: 'none'
});

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ReprioritizationTab = ({
    projects = [],
    slotMap = {},
    resources = [],
    isDark = false,
    onCreateDraft,
    base,
    settings,
    roleMapping,
    enabledSquads = [],
    onOpenProgramModal,
    onRegisterActions,
    scenariosTable,
    scenarioRecords,
    scenarios = []
}) => {
    // ── Session ──
    const session = useSession();
    const currentUserName = session?.currentUser?.name || session?.currentUser?.email || 'Unknown';
    // ── Configuration State ──
    const [cornerstoneCustomers, setCornerstoneCustomers] = useState([]);
    const [partnerCustomers, setPartnerCustomers] = useState([]);
    const [minCountries, setMinCountries] = useState(1);
    const [maxCountries, setMaxCountries] = useState(10);
    const [minCarr, setMinCarr] = useState(0);
    const [cornerstoneMaxShift, setCornerstoneMaxShift] = useState(8);
    const [defaultMaxShift, setDefaultMaxShift] = useState(26);
    const [inFlightBonus, setInFlightBonus] = useState(5);
    const [inFlightMaxShift, setInFlightMaxShift] = useState(4);
    const [contractArrWeight, setContractArrWeight] = useState(0.3);
    const [newBusinessReserve, setNewBusinessReserve] = useState(0);
    const [cornerstoneShiftExcludeAfter, setCornerstoneShiftExcludeAfter] = useState('');
    const [defaultShiftExcludeAfter, setDefaultShiftExcludeAfter] = useState('');
    const [constraintHorizon, setConstraintHorizon] = useState('2026-12-31');
    const [squadSpecializations, setSquadSpecializations] = useState({});
    const [seedFromCurrent, setSeedFromCurrent] = useState(true);
    const [seedInFlightOnly, setSeedInFlightOnly] = useState(false);
    const [seedFromDraft, setSeedFromDraft] = useState(false);
    const [seedDraftId, setSeedDraftId] = useState('');
    const [customerSquadSeeds, setCustomerSquadSeeds] = useState({});
    const [excludedSquads, setExcludedSquads] = useState([]);
    const [solverResult, setSolverResult] = useState(null);
    const [expandedSpecSquads, setExpandedSpecSquads] = useState(new Set());

    // ── Program Specialist State ──
    const [programSpecialists, setProgramSpecialists] = useState([]);
    const [autoAssign, setAutoAssign] = useState(true);

    // ── Results State ──
    const [results, setResults] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [optimizerProgress, setOptimizerProgress] = useState(0);
    const [optimizerPhase, setOptimizerPhase] = useState('');
    const [projectGrid, setProjectGrid] = useState({}); // { projectId: 'filled'|'partial'|'grey' }
    const peakFilledRef = React.useRef(0);
    const resultsRef = useRef(null);
    const configRef = useRef(null);
    const [shiftIteration, setShiftIteration] = useState(0);
    const [alienPhase, setAlienPhase] = useState('juggling'); // 'juggling' | 'exploding' | 'smoke' | 'ufo' | 'beaming'

    // Alien lifecycle: explode + beam down every 2 minutes
    useEffect(() => {
        if (!isRunning) { setAlienPhase('juggling'); return; }
        const cycle = () => {
            setAlienPhase('exploding');
            setTimeout(() => setAlienPhase('smoke'), 1500);
            setTimeout(() => setAlienPhase('ufo'), 3000);
            setTimeout(() => setAlienPhase('beaming'), 4500);
            setTimeout(() => setAlienPhase('juggling'), 6500);
        };
        const interval = setInterval(cycle, 120000); // Every 2 minutes
        return () => clearInterval(interval);
    }, [isRunning]);
    const [totalProjectCount, setTotalProjectCount] = useState(0);
    const [aiReasoning, setAiReasoning] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [expandedProject, setExpandedProject] = useState(null);
    const [selectedTier, setSelectedTier] = useState(null); // null = show all

    // ── Analytics State ──
    const [monteCarloResult, setMonteCarloResult] = useState(null);
    const [sensitivityResult, setSensitivityResult] = useState(null);
    const [strategyResult, setStrategyResult] = useState(null);
    const [showVolatile, setShowVolatile] = useState(false);
    const [showSensitivity, setShowSensitivity] = useState(false);
    const [showStrategies, setShowStrategies] = useState(false);
    const [financialImpact, setFinancialImpact] = useState(null);
    const [analyticsPhase, setAnalyticsPhase] = useState(null); // null = not running, string = phase label
    const [showFinancialDetail, setShowFinancialDetail] = useState(false);
    const [showChangesPanel, setShowChangesPanel] = useState(false);
    const [changesFilter, setChangesFilter] = useState('all');
    const [showTimeline, setShowTimeline] = useState(false);
    const [ganttGroupBy, setGanttGroupBy] = useState('chronological');
    const [showGantt, setShowGantt] = useState(false);

    // ── What-If Override State ──
    const [projectOverrides, setProjectOverrides] = useState({});
    const [showTierMenu, setShowTierMenu] = useState(null); // projectId or null

    // Priority Review state
    const [priorityOrder, setPriorityOrder] = useState(null); // [{projectId, rank, locked, country, score, tier, tierLabel, reasoning, name, arr}]
    const [showPriorityReview, setShowPriorityReview] = useState(false);
    const [dragPrio, setDragPrio] = useState(null); // {projectId} ──
    const [prioFilterCustomer, setPrioFilterCustomer] = useState('');
    const [prioFilterCountry, setPrioFilterCountry] = useState('');
    const [prioFilterYear, setPrioFilterYear] = useState('');

    // ── Save/Load Scenario State ──
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDrawer, setShowLoadDrawer] = useState(false);
    const [renamingScenarioId, setRenamingScenarioId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [loadedScenarioId, setLoadedScenarioId] = useState(null);

    // ── Load saved scenarios from Airtable Scenarios table (type=optimizer in metadata) ──
    const savedScenarios = useMemo(() => {
        if (!scenarioRecords || scenarioRecords.length === 0) return [];
        try {
            const table = scenariosTable || scenarioRecords[0]?.parentTable;

            // Build a fieldId lookup from table.fields for robust access
            const fieldIdByName = {};
            if (table?.fields) {
                for (const f of table.fields) {
                    fieldIdByName[f.name.trim().toLowerCase()] = f.id;
                }
            }

            // Helper: try multiple strategies to read a cell value
            const readField = (rec, settingsKey, ...nameVariants) => {
                // Strategy 1: mapped settings ID
                const mappedId = settings?.[settingsKey];
                if (mappedId) try { const v = rec.getCellValueAsString?.(mappedId); if (v) return v; } catch { }
                // Strategy 2: field name strings
                for (const name of nameVariants) {
                    try { const v = rec.getCellValueAsString?.(name); if (v) return v; } catch { }
                }
                // Strategy 3: table field scan by name
                for (const name of nameVariants) {
                    const fid = fieldIdByName[name.toLowerCase()];
                    if (fid) try { const v = rec.getCellValueAsString?.(fid); if (v) return v; } catch { }
                }
                return '';
            };

            const filtered = scenarioRecords.filter(r => {
                try {
                    // Primary check: metadata JSON has type=optimizer
                    const metaStr = readField(r, SETTINGS.SCENARIO_METADATA_JSON, 'Metadata JSON', 'Metadata');
                    if (metaStr) {
                        try {
                            const meta = JSON.parse(metaStr);
                            if (meta.type === 'optimizer' || meta.type === 'optimizerSnapshot') return true;
                        } catch { }
                    }
                    // Fallback: check Status column (Airtable may show 'Optimizer')
                    const status = readField(r, null, 'Status');
                    if (status.toLowerCase() === 'optimizer') return true;
                    // Fallback: check if Changes JSON starts with {"config": — optimizer shape
                    const changesPreview = readField(r, SETTINGS.SCENARIO_CHANGES_JSON, 'Changes JSON', 'Changes');
                    if (changesPreview && changesPreview.trimStart().startsWith('{"config":')) return true;
                    return false;
                } catch {
                    return false;
                }
            });

            return filtered
                .map(record => {
                    try {
                        let changesJson = readField(record, SETTINGS.SCENARIO_CHANGES_JSON, 'Changes JSON', 'Changes');
                        // Concatenate overflow fields
                        const chunk2 = readField(record, SETTINGS.SCENARIO_CHANGES_JSON_2, 'Changes JSON 2');
                        const chunk3 = readField(record, SETTINGS.SCENARIO_CHANGES_JSON_3, 'Changes JSON 3');
                        if (chunk2) changesJson += chunk2;
                        if (chunk3) changesJson += chunk3;

                        // Detect truncated JSON — skip silently if at chunk boundary and not valid JSON
                        const CHUNK = 90000;
                        const totalLen = changesJson.length;
                        if (totalLen > 0 && (totalLen % CHUNK === 0) && !changesJson.trimEnd().endsWith('}')) {
                            // Truncated — return metadata-only entry so it shows in the list
                            const metaJson = readField(record, SETTINGS.SCENARIO_METADATA_JSON, 'Metadata JSON', 'Metadata') || '{}';
                            const meta = JSON.parse(metaJson);
                            return {
                                id: record.id,
                                name: record.name || 'Untitled',
                                savedAt: meta.savedAt || meta.lastSavedAt,
                                lastSavedBy: meta.lastSavedBy,
                                config: {},
                                overrides: {},
                                summary: meta.summary || null,
                                _truncated: true
                            };
                        }

                        const metaJson = readField(record, SETTINGS.SCENARIO_METADATA_JSON, 'Metadata JSON', 'Metadata') || '{}';
                        const config = changesJson ? JSON.parse(changesJson) : {};
                        const meta = JSON.parse(metaJson);

                        // Read Results JSON fields (1-6) via settings-mapped field IDs
                        let resultsJsonStr = '';
                        const rjChunks = [
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON, 'Results JSON'),
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON_2, 'Results JSON 2'),
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON_3, 'Results JSON 3'),
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON_4, 'Results JSON 4'),
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON_5, 'Results JSON 5'),
                            readField(record, SETTINGS.SCENARIO_RESULTS_JSON_6, 'Results JSON 6')
                        ];
                        rjChunks.forEach(c => { if (c) resultsJsonStr += c; });
                        let compactResults = null;
                        if (resultsJsonStr) {
                            try { compactResults = JSON.parse(resultsJsonStr); } catch { }
                        }

                        return {
                            id: record.id,
                            name: record.name || 'Untitled',
                            savedAt: meta.savedAt || meta.lastSavedAt,
                            lastSavedBy: meta.lastSavedBy,
                            config: config.config || config,
                            overrides: config.overrides || {},
                            summary: config.summary || meta.summary || null,
                            compactResults
                        };
                    } catch {
                        // Silently skip corrupt/truncated records — no console spam
                        return null;
                    }
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
        } catch (e) {
            console.warn('[RepriTab] Failed to load scenarios from table:', e);
            return [];
        }
    }, [scenarioRecords, scenariosTable]);


    // ── Inline Resourcing State ──
    const [resourceAssignments, setResourceAssignments] = useState({}); // { projectId: { pm: [member], sc: [member], pd: [member] } }
    const [mergeGroups, setMergeGroups] = useState(() => {
        // Default: each squad in its own pool (individual pools)
        const squads = enabledSquads || [];
        return squads.length > 0 ? squads.map(sq => new Set([sq])) : [new Set()];
    }); // Array of Sets — each Set is an independent pool
    const [showMergePanel, setShowMergePanel] = useState(false);
    const [addingRole, setAddingRole] = useState({}); // { [projectId]: 'pm'|'sc'|'pd'|null }
    const [iterationCount, setIterationCount] = useState(0);
    const [scenarioName, setScenarioName] = useState('');
    const [maxSC, setMaxSC] = useState(1);
    const [maxPD, setMaxPD] = useState(1);
    const [maxConcurrentProjects, setMaxConcurrentProjects] = useState(8);
    const [localProgramAssignments, setLocalProgramAssignments] = useState(settings?.programAssignments || []);
    const [entityRoleRules, setEntityRoleRules] = useState([
        { entity: 'FEX', sourceFunction: 'PD', canFill: ['PM', 'SC', 'PD'], maxRoles: 3 }
    ]);
    const [preferCrossEntity, setPreferCrossEntity] = useState(true);
    const [showConfig, setShowConfig] = useState(false); // Toggle config vs results view

    const overrideCount = Object.keys(projectOverrides).length;

    // ── Filter to Implementation / Migration only ──
    const eligibleProjects = useMemo(() => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return projects.filter(p => {
            const pt = (p.projectType || '').toLowerCase();
            if (!pt.includes('implementation') && !pt.includes('migration')) return false;
            // Exclude closed/cancelled/completed projects
            const status = (p.status || '').toLowerCase();
            if (status.match(/closed|cancelled|completed/)) return false;
            // Only include projects with a future launch date (or no launch date set)
            const launchDate = p.launch || p.end;
            if (launchDate && launchDate < today) return false;
            return true;
        });
    }, [projects]);

    // ── Draft scenarios available for seeding ──
    const draftScenarios = useMemo(() => {
        return (scenarios || []).filter(s => s && !s.isLive && s.changes?.projects && Object.keys(s.changes.projects).length > 0);
    }, [scenarios]);

    // ── Draft-adjusted projects: overlay selected draft's changes ──
    const draftAdjustedProjects = useMemo(() => {
        if (!seedFromDraft || !seedDraftId) return eligibleProjects;
        const draft = draftScenarios.find(s => s.id === seedDraftId);
        if (!draft || !draft.changes?.projects) return eligibleProjects;
        const changes = draft.changes.projects;
        return eligibleProjects.map(p => {
            const c = changes[p.id];
            if (!c) return p;
            const merged = { ...p };
            // Overlay date changes
            if (c.kickOff !== undefined) merged.kickOff = c.kickOff;
            if (c.start !== undefined) merged.start = c.start;
            if (c.launch !== undefined) merged.launch = c.launch;
            if (c.end !== undefined) merged.end = c.end;
            // Overlay effort changes
            if (c.pmVal !== undefined) merged.pmVal = c.pmVal;
            if (c.scVal !== undefined) merged.scVal = c.scVal;
            if (c.pdVal !== undefined) merged.pdVal = c.pdVal;
            if (c.pmEffort !== undefined) merged.pmEffort = c.pmEffort;
            if (c.scEffort !== undefined) merged.scEffort = c.scEffort;
            if (c.pdEffort !== undefined) merged.pdEffort = c.pdEffort;
            // Overlay squad/team
            if (c.squad !== undefined) { merged.squad = c.squad; merged.virtualSquad = c.squad; }
            if (c.squads !== undefined) merged.squads = c.squads;
            if (c.team !== undefined) merged.team = c.team;
            // Overlay status, effort profile, etc.
            if (c.status !== undefined) merged.status = c.status;
            if (c.effortProfile !== undefined) merged.effortProfile = c.effortProfile;
            if (c.durationWeeks !== undefined) merged.durationWeeks = c.durationWeeks;
            if (c.arr !== undefined) merged.arr = c.arr;
            return merged;
        });
    }, [eligibleProjects, seedFromDraft, seedDraftId, draftScenarios]);

    // ── Extract unique customers from projects ──
    const uniqueCustomers = useMemo(() => {
        const customerSet = new Set();
        projects.forEach(p => {
            if (p.customer) customerSet.add(p.customer);
        });
        return Array.from(customerSet).sort();
    }, [projects]);

    // ── Extract unique squads from projects + resources ──
    const uniqueSquads = useMemo(() => {
        const squadSet = new Set();
        projects.forEach(p => {
            const sq = p.squad || p.virtualSquad;
            if (sq) squadSet.add(sq);
        });
        resources.forEach(r => {
            (r.squads || []).forEach(sq => squadSet.add(sq));
        });
        return Array.from(squadSet).sort();
    }, [projects, resources]);

    // ── Extract distinct countries and platforms from projects ──
    const distinctCountries = useMemo(() => {
        const s = new Set();
        projects.forEach(p => { if (p.country) s.add(p.country); });
        return Array.from(s).sort();
    }, [projects]);

    const distinctPlatforms = useMemo(() => {
        const s = new Set();
        projects.forEach(p => { if (p.platform) s.add(p.platform); });
        return Array.from(s).sort();
    }, [projects]);

    // ── Auto-suggest cornerstones (BMS, UHG, Adobe, Darwin) ──
    const suggestedCornerstones = useMemo(() => {
        const keywords = ['bms', 'uhg', 'adobe', 'darwin', 'united health'];
        return uniqueCustomers.filter(c =>
            keywords.some(k => c.toLowerCase().includes(k))
        );
    }, [uniqueCustomers]);

    // ── Toggle cornerstone selection ──
    const toggleCornerstone = useCallback((customer) => {
        setCornerstoneCustomers(prev =>
            prev.includes(customer)
                ? prev.filter(c => c !== customer)
                : [...prev, customer]
        );
    }, []);

    // ── Toggle partner selection ──
    const togglePartner = useCallback((customer) => {
        setPartnerCustomers(prev =>
            prev.includes(customer)
                ? prev.filter(c => c !== customer)
                : [...prev, customer]
        );
    }, []);



    // ── Program demand computation (for Phase -1 pre-booking) ──
    const programDemand = useMemo(() => {
        const demand = {};
        const discount = settings?.programDiscount || 15;
        const efficiency = settings?.programEfficiencyFactor || 0;
        const effMultiplier = 1 - (efficiency / 100);
        const workstreamDefs = settings?.programWorkstreams || [];

        // Group program projects by customer
        const byCustomer = {};
        eligibleProjects.forEach(p => {
            if (!p.resourcedWithinProgram || !p.customer) return;
            if (!byCustomer[p.customer]) byCustomer[p.customer] = [];
            byCustomer[p.customer].push(p);
        });

        Object.entries(byCustomer).forEach(([customer, projs]) => {
            let totalHours = 0;
            let minStart = null, maxEnd = null;

            projs.forEach(p => {
                const hrs = ((p.pmValOriginal || p.pmVal || 0) + (p.scValOriginal || p.scVal || 0) + (p.pdValOriginal || p.pdVal || 0)) * effMultiplier * (discount / 100);
                totalHours += hrs;
                const s = p.start ? new Date(p.start) : null;
                const e = p.end ? new Date(p.end) : null;
                if (s && (!minStart || s < minStart)) minStart = s;
                if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
            });

            const totalWeeks = (minStart && maxEnd) ? Math.max(1, Math.round((maxEnd - minStart) / (7 * 86400000))) : 26;
            const workstreams = workstreamDefs.map(ws => ({
                name: ws.name,
                hours: totalHours * (ws.allocationPct / 100),
                allocationPct: ws.allocationPct
            }));

            demand[customer] = { totalHours, totalWeeks, workstreams, projectCount: projs.length };
        });
        return demand;
    }, [eligibleProjects, settings]);

    // Customers with program projects (for program team editor)
    const programCustomers = useMemo(() => Object.keys(programDemand).sort(), [programDemand]);

    // ── Build config (shared between run & rerun) ──
    const buildConfig = useCallback(() => ({
        cornerstoneCustomers,
        partnerCustomers,
        minConcurrentCountries: minCountries,
        maxConcurrentCountries: maxCountries,
        minCarrThreshold: minCarr,
        cornerstoneMaxShiftWeeks: cornerstoneMaxShift,
        defaultMaxShiftWeeks: defaultMaxShift,
        cornerstoneShiftExcludeAfter: cornerstoneShiftExcludeAfter || null,
        defaultShiftExcludeAfter: defaultShiftExcludeAfter || null,
        inFlightMaxShiftWeeks: inFlightMaxShift,
        inFlightScoreBonus: inFlightBonus,
        autoAssign,
        programSpecialistIds: programSpecialists,
        projectOverrides,
        constraintHorizon: constraintHorizon || null,
        squadSpecializations,
        seedFromCurrent,
        seedInFlightOnly,
        customerSquadSeeds,
        excludedSquads,
        programTeamAssignments: localProgramAssignments,
        programDemand,
        contractArrWeight,
        newBusinessReservePct: newBusinessReserve,
        roleMapping,
        roleConfig: settings?.roleConfig || { jobs: {}, constraints: {} },
        mergeGroups: mergeGroups.map(s => [...s]), // Array of Arrays: squads in same group share resource pool
        entityRoleRules,
        preferCrossEntity
    }), [cornerstoneCustomers, partnerCustomers, minCountries, maxCountries, minCarr, cornerstoneMaxShift, defaultMaxShift, inFlightBonus, inFlightMaxShift, contractArrWeight, newBusinessReserve, cornerstoneShiftExcludeAfter, defaultShiftExcludeAfter, autoAssign, programSpecialists, projectOverrides, constraintHorizon, squadSpecializations, seedFromCurrent, seedInFlightOnly, customerSquadSeeds, excludedSquads, localProgramAssignments, programDemand, roleMapping, settings?.roleConfig, mergeGroups, entityRoleRules, preferCrossEntity]);

    // ── Resource Pool: compute available resources per merge group ──
    const resourcePool = useMemo(() => {
        // Flat pool of all resources across all merge groups
        const allSquads = new Set();
        mergeGroups.forEach(group => group.forEach(sq => allSquads.add(sq)));
        return resources.filter(r => {
            // Include if any of resource's squads is in any merge group
            const rSquads = r.squads || [];
            if (rSquads.length === 0) return false;
            // Exclude resources past leave date
            if (r.leaveDate && new Date(r.leaveDate) <= new Date()) return false;
            return rSquads.some(sq => allSquads.has(sq));
        });
    }, [resources, mergeGroups]);

    // ── Get resource pool for a specific project (based on its squad's merge group) ──
    const getPoolForProject = useCallback((project) => {
        const projSquad = project.squad || project.virtualSquad;
        // Find which merge group contains this project's squad
        const matchedGroup = mergeGroups.find(group => group.has(projSquad));
        if (!matchedGroup) return resourcePool; // fallback to full pool
        return resources.filter(r => {
            const rSquads = r.squads || [];
            if (rSquads.length === 0) return false;
            if (r.leaveDate && new Date(r.leaveDate) <= new Date()) return false;
            return rSquads.some(sq => matchedGroup.has(sq));
        });
    }, [resources, mergeGroups, resourcePool]);

    // ── Assignment handlers ──
    const handleAssign = useCallback((projectId, resourceId, role, overrideData) => {
        setResourceAssignments(prev => {
            const next = { ...prev };
            const pa = next[projectId] || { pm: [], sc: [], pd: [] };
            const roleArr = [...(pa[role] || [])];
            if (overrideData?.isPlaceholder) {
                roleArr.push({ id: resourceId, name: overrideData.name, isPlaceholder: true });
            } else {
                const res = resources.find(r => r.id === resourceId);
                if (res && !roleArr.find(m => m.id === resourceId)) {
                    roleArr.push({ id: resourceId, name: res.name, headshot: res.headshot?.[0]?.url || res.headshot?.[0]?.thumbnails?.small?.url });
                }
            }
            pa[role] = roleArr;
            next[projectId] = pa;
            return next;
        });
    }, [resources]);

    const handleUnassign = useCallback((projectId, resourceId, role) => {
        setResourceAssignments(prev => {
            const next = { ...prev };
            const pa = next[projectId] || { pm: [], sc: [], pd: [] };
            pa[role] = (pa[role] || []).filter(m => m.id !== resourceId);
            next[projectId] = pa;
            return next;
        });
    }, []);

    const handleUpdateAllocation = useCallback((projectId, resourceId, role, pct) => {
        setResourceAssignments(prev => {
            const next = { ...prev };
            const pa = next[projectId] || { pm: [], sc: [], pd: [] };
            pa[role] = (pa[role] || []).map(m => m.id === resourceId ? { ...m, allocationPct: pct } : m);
            next[projectId] = pa;
            return next;
        });
    }, []);

    // ── Auto-Resourcing: attempt to assign best-fit resources to all scheduled projects ──
    const autoResourceProjects = useCallback((scheduled) => {
        const assignments = {};
        // Track load per resource: project count and total effort hours
        const resourceProjectCount = {}; // resourceId -> number of projects
        const resourceEffortHours = {};  // resourceId -> total effort hours committed

        for (const project of scheduled) {
            const pool = getPoolForProject(project);
            const pa = { pm: [], sc: [], pd: [] };
            // Get effort hours for this project per role
            const effortByRole = { pm: project.pmEffort || 0, sc: project.scEffort || 0, pd: project.pdEffort || 0 };

            // Try to fill each role
            for (const role of ['pm', 'sc', 'pd']) {
                const targetCat = role.toUpperCase();
                const roleMax = role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD;
                const effortHrs = effortByRole[role];
                // First, check if engine already assigned someone
                const engineAssignment = (project.assignments || []).find(a => a.role?.toLowerCase() === role && a.resourceId);
                if (engineAssignment && (resourceProjectCount[engineAssignment.resourceId] || 0) < maxConcurrentProjects) {
                    const res = resources.find(r => r.id === engineAssignment.resourceId);
                    pa[role] = [{ id: engineAssignment.resourceId, name: engineAssignment.resourceName || res?.name || 'Unknown', headshot: res?.headshot?.[0]?.url || res?.headshot?.[0]?.thumbnails?.small?.url }];
                    resourceProjectCount[engineAssignment.resourceId] = (resourceProjectCount[engineAssignment.resourceId] || 0) + 1;
                    resourceEffortHours[engineAssignment.resourceId] = (resourceEffortHours[engineAssignment.resourceId] || 0) + effortHrs;
                    if (pa[role].length >= roleMax) continue;
                }
                // Auto-match: find best candidates from pool (fill up to roleMax)
                while (pa[role].length < roleMax) {
                    const candidates = pool.filter(r => {
                        if ((resourceProjectCount[r.id] || 0) >= maxConcurrentProjects) return false;
                        const cat = getCategoryForFunction(r.adJobTitle || r.role, roleMapping);
                        return cat && cat.toUpperCase() === targetCat;
                    });
                    if (candidates.length === 0) break;
                    // Prefer: same squad → least effort hours committed → name
                    const projSquad = project.squad || project.virtualSquad;
                    candidates.sort((a, b) => {
                        const aMatch = (a.squads || []).includes(projSquad) ? 0 : 1;
                        const bMatch = (b.squads || []).includes(projSquad) ? 0 : 1;
                        if (aMatch !== bMatch) return aMatch - bMatch;
                        const aHrs = resourceEffortHours[a.id] || 0;
                        const bHrs = resourceEffortHours[b.id] || 0;
                        if (aHrs !== bHrs) return aHrs - bHrs; // prefer least loaded by hours
                        return a.name.localeCompare(b.name);
                    });
                    const best = candidates[0];
                    pa[role].push({ id: best.id, name: best.name, headshot: best.headshot?.[0]?.url || best.headshot?.[0]?.thumbnails?.small?.url });
                    resourceProjectCount[best.id] = (resourceProjectCount[best.id] || 0) + 1;
                    resourceEffortHours[best.id] = (resourceEffortHours[best.id] || 0) + effortHrs;
                }
            }
            assignments[project.id] = pa;
        }
        return { assignments, usedResources: new Set(Object.keys(resourceProjectCount)) };
    }, [resources, roleMapping, getPoolForProject, maxSC, maxPD, maxConcurrentProjects]);

    // ── Run Reprioritization (with iterative resourcing) ──
    // ── Score & Preview (priority review without running the optimizer) ──
    const handleScorePreview = useCallback(() => {
        const config = buildConfig();
        const { scored } = scorePortfolio(eligibleProjects, config);

        // Build flat priority order sorted by score descending
        const sorted = [...scored].sort((a, b) => b._reprioritization.score - a._reprioritization.score);
        const order = sorted.map((p, idx) => {
            const prevEntry = priorityOrder?.find(e => e.projectId === p.id);
            return {
                projectId: p.id,
                name: p.name,
                customer: p.customer,
                country: p.country || 'Unknown',
                rank: idx + 1,
                originalRank: idx + 1,
                score: Math.round(p._reprioritization.score),
                tier: p._reprioritization.tier,
                tierLabel: p._reprioritization.tierLabel,
                reasoning: p._reprioritization.reasoning || [],
                scoreBreakdown: p._reprioritization.scoreBreakdown || null,
                arr: p.arr || p.transactionalBenefits || 0,
                launchYear: p.launch ? new Date(p.launch).getFullYear() : (p.end ? new Date(p.end).getFullYear() : null),
                status: p.status,
                locked: prevEntry?.locked || false,
                // Raw input fields for export
                customerRisk: p.customerRisk || '',
                compellingEventDate: p.compellingEventDate || '',
                kickOff: p.kickOff || '',
                launchDate: p.launch || p.end || '',
                projectType: p.projectType || '',
                squad: p.squads?.[0] || p.squad || '',
                platform: p.platform || '',
                lockLaunch: !!p.lockLaunch,
                lockSquad: !!p.lockSquad,
                lockResources: !!p.lockResources,
                dealEfficiency: p.dealEfficiency || 0,
                contractEfficiency: p.contractEfficiency || 0
            };
        });

        setPriorityOrder(order);
        setShowPriorityReview(true);
    }, [eligibleProjects, buildConfig, priorityOrder]);

    // ── Export Priority Scores as CSV ──
    const handleExportScores = useCallback(() => {
        if (!priorityOrder?.length) return;
        const headers = [
            'Rank', 'Original Rank', 'Moved', 'Project Name', 'Customer', 'Country',
            'Status', 'Project Type', 'Squad', 'Platform',
            'cARR (£)', 'Contract cARR (£)', 'Blended ARR (£)', 'Deal Efficiency', 'Country Efficiency',
            'Customer Risk', 'Compelling Event Date',
            'Kick-Off', 'Launch Date', 'Launch Year',
            'Locked', 'Lock Launch', 'Lock Squad', 'Lock Resources',
            'Tier', 'Tier Label', 'Final Score',
            'Base Score', 'Tier Range', 'Scoring Basis', 'In-Flight Bonus', 'Priority Boost',
            'Reasoning'
        ];
        const csvRows = [headers.join(',')];
        priorityOrder.forEach((item, idx) => {
            const moved = item.originalRank ? (item.originalRank - (idx + 1)) : 0;
            const movedStr = moved > 0 ? `+${moved}` : moved < 0 ? `${moved}` : '0';
            const bd = item.scoreBreakdown || {};
            const row = [
                idx + 1,
                item.originalRank || '',
                movedStr,
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.customer || '').replace(/"/g, '""')}"`,
                item.country || '',
                item.status || '',
                item.projectType || '',
                `"${(item.squad || '').replace(/"/g, '""')}"`,
                item.platform || '',
                item.arr || 0,
                bd.contractArr || 0,
                bd.blendedArr || item.arr || 0,
                item.dealEfficiency || 0,
                item.contractEfficiency || 0,
                item.customerRisk || '',
                item.compellingEventDate || '',
                item.kickOff || '',
                item.launchDate || '',
                item.launchYear || '',
                item.locked ? 'Yes' : 'No',
                item.lockLaunch ? 'Yes' : 'No',
                item.lockSquad ? 'Yes' : 'No',
                item.lockResources ? 'Yes' : 'No',
                item.tier || '',
                item.tierLabel || '',
                bd.finalScore ?? item.score ?? '',
                bd.baseScore ?? '',
                bd.tierRange ? `${bd.tierRange[0]}-${bd.tierRange[1]}` : '',
                bd.scoringBasis || '',
                bd.inFlightBonus || 0,
                bd.priorityBoost || 0,
                `"${(item.reasoning || []).join(' | ').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `priority_scores_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [priorityOrder]);

    const handleRun = useCallback(async () => {
        setIsRunning(true);
        peakFilledRef.current = 0;
        setResults(null);
        setAiReasoning(null);
        setResourceAssignments({});
        setIterationCount(0);
        setSolverResult(null);
        setOptimizerProgress(0);
        setOptimizerPhase('Preparing...');
        setProjectGrid({});
        setShiftIteration(0);
        setTotalProjectCount(0);

        try {
            const config = buildConfig();

            const sourceProjects = draftAdjustedProjects;
            const lightProjects = sourceProjects.map(p => ({
                id: p.id, name: p.name, customer: p.customer, status: p.status,
                squad: p.squad, virtualSquad: p.virtualSquad, country: p.country,
                platform: p.platform, kickOff: p.kickOff, launch: p.launch,
                start: p.start, end: p.end, arr: p.arr, transactionalBenefits: p.transactionalBenefits,
                customerRisk: p.customerRisk, compellingEventDate: p.compellingEventDate,
                projectType: p.projectType, durationWeeks: p.durationWeeks,
                slotsNeeded: p.slotsNeeded, pmEffort: p.pmEffort, scEffort: p.scEffort,
                pdEffort: p.pdEffort, slotMultiplier: p.slotMultiplier,
                slotPriority: p.slotPriority, resourcedWithinProgram: p.resourcedWithinProgram,
                squads: p.squads, lockLaunch: p.lockLaunch, lockSquad: p.lockSquad,
                lockResources: p.lockResources, team: p.team, effortProfile: p.effortProfile
            }));

            const solver = await runGreedyOptimizer({
                projects: lightProjects,
                slotMap,
                resources,
                config,
                onProgress: (pct, phase, meta) => {
                    setOptimizerProgress(pct);
                    setOptimizerPhase(phase);
                    if (meta?.projectStatuses) setProjectGrid(meta.projectStatuses);
                    if (meta?.totalProjects) setTotalProjectCount(meta.totalProjects);
                    if (meta?.iteration !== undefined) setShiftIteration(meta.iteration);
                }
            });

            if (!solver || !solver.bestPlan) {
                console.error('[REPRIORITIZER] Solver returned no result');
                setIsRunning(false);
                return;
            }

            const currentPlan = solver.bestPlan;
            setSolverResult(solver);

            setResults(currentPlan);
            setShowConfig(false);
            setShowTimeline(true);

            // Build resourceAssignments from optimizer's assignment data
            const newAssignments = {};
            [...(currentPlan.scheduled || []), ...(currentPlan.deferred || [])].forEach(p => {
                if (!p.assignments || p.assignments.length === 0) return;
                const pa = { pm: [], sc: [], pd: [] };
                p.assignments.forEach(a => {
                    if (!a.resourceId) return;
                    const baseRole = (a._baseRole || a.role || '').replace(/ \(\d+\/\d+\)/, '').toLowerCase();
                    const roleKey = baseRole === 'pm' ? 'pm' : baseRole === 'sc' ? 'sc' : baseRole === 'pd' ? 'pd' : null;
                    if (!roleKey) return;
                    pa[roleKey].push({
                        id: a.resourceId,
                        name: a.resourceName || 'Unknown',
                        headshot: a.resourceHeadshot || null,
                        allocationPct: a.allocationPct || 25,
                        reason: a.reason || ''
                    });
                });
                if (pa.pm.length > 0 || pa.sc.length > 0 || pa.pd.length > 0) {
                    newAssignments[p.id] = pa;
                }
            });
            setResourceAssignments(newAssignments);
            setIterationCount(solver.solverMeta?.iterations || 1);
            setOptimizerProgress(100);
            setOptimizerPhase('Complete!');
            setIsRunning(false); // Dismiss spinner — results are ready
            // Auto-scroll to results panel
            setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);

            console.log('[SOLVER] Completed:', {
                strategy: solver.solverMeta?.startingStrategy,
                score: solver.bestScore,
                improvement: `${solver.solverMeta?.improvementPct}%`,
                duration: `${solver.solverMeta?.totalDurationMs}ms`,
                accepted: solver.solverMeta?.accepted,
                rejected: solver.solverMeta?.rejected
            });

            // Deferred analytics (lightweight only — heavy analytics disabled)
            setTimeout(async () => {
                try {
                    setAnalyticsPhase('Calculating financial impact...');
                    await new Promise(r => setTimeout(r, 16));
                    setFinancialImpact(calculateFinancialImpact({
                        scheduled: currentPlan.scheduled, deferred: currentPlan.deferred, excluded: currentPlan.excluded
                    }));

                    setAnalyticsPhase('Sensitivity analysis...');
                    await new Promise(r => setTimeout(r, 16));
                    setSensitivityResult(runSensitivityAnalysis(currentPlan));

                    setAnalyticsPhase('Running Monte Carlo simulations...');
                    await new Promise(r => setTimeout(r, 16));
                    const mcResult = await runReprioritizationMonteCarlo({
                        projects, slotMap, resources, config, baseline: currentPlan,
                        uncertainty: { simulations: 10, leaveRate: 0.05, capacityVariance: 0.15, scopeCreep: 0.10 },
                        onProgress: (current, total) => setAnalyticsPhase(`Monte Carlo simulation ${current}/${total}...`)
                    });
                    setMonteCarloResult(mcResult);

                    setAnalyticsPhase(null);
                } catch (analyticsErr) {
                    console.warn('[REPRIORITIZER] Analytics failed:', analyticsErr);
                    setAnalyticsPhase(null);
                }
            }, 100);

            // Send to AI for LLM reasoning with solver metadata
            if (base) {
                setAiLoading(true);
                try {
                    const basePayload = buildAIInsightsPayload(currentPlan);
                    const solverPayload = buildSolverAIPayload(solver);
                    const payload = { ...basePayload, optimization: solverPayload };
                    const runRecord = await createOptimizationRun(base, settings, {
                        runType: 'Portfolio Reprioritization (SA Optimized)',
                        projectsInput: currentPlan.stats.totalProjects,
                        projectsPlaced: currentPlan.stats.projectsScheduled,
                        projectsUnplaceable: currentPlan.stats.projectsDeferred,
                        totalArrAffected: currentPlan.stats.totalArrProtected,
                        metricsJson: JSON.stringify(payload)
                    });
                    if (runRecord) {
                        pollForAiReasoning(base, settings, runRecord.id);
                    }
                } catch (aiErr) {
                    console.warn('[REPRIORITIZER] AI insights failed:', aiErr);
                    setAiLoading(false);
                }
            }
        } catch (err) {
            console.error('[REPRIORITIZER] Run failed:', err);
            setIsRunning(false);
        }
    }, [projects, slotMap, resources, buildConfig, base, settings, autoResourceProjects, draftAdjustedProjects]);

    // ── Re-run with current overrides (quick re-run with iterative resourcing, no AI) ──
    const handleRerunWithOverrides = useCallback(async () => {
        setIsRunning(true);
        setResourceAssignments({});
        setSolverResult(null);
        setOptimizerProgress(0);
        setOptimizerPhase('Preparing...');
        setProjectGrid({});
        setShiftIteration(0);
        setTotalProjectCount(0);
        try {
            const config = buildConfig();

            // Strip projects to only fields needed by optimizer
            const sourceProjects = draftAdjustedProjects;
            const lightProjects = sourceProjects.map(p => ({
                id: p.id, name: p.name, customer: p.customer, status: p.status,
                squad: p.squad, virtualSquad: p.virtualSquad, country: p.country,
                platform: p.platform, kickOff: p.kickOff, launch: p.launch,
                start: p.start, end: p.end, arr: p.arr, transactionalBenefits: p.transactionalBenefits,
                customerRisk: p.customerRisk, compellingEventDate: p.compellingEventDate,
                projectType: p.projectType, durationWeeks: p.durationWeeks,
                slotsNeeded: p.slotsNeeded, pmEffort: p.pmEffort, scEffort: p.scEffort,
                pdEffort: p.pdEffort, slotMultiplier: p.slotMultiplier,
                slotPriority: p.slotPriority, resourcedWithinProgram: p.resourcedWithinProgram,
                squads: p.squads, lockLaunch: p.lockLaunch, lockSquad: p.lockSquad,
                lockResources: p.lockResources, team: p.team, effortProfile: p.effortProfile
            }));

            const solver = await runGreedyOptimizer({
                projects: lightProjects,
                slotMap,
                resources,
                config,
                onProgress: (pct, phase, meta) => {
                    setOptimizerProgress(pct);
                    setOptimizerPhase(phase);
                    if (meta?.projectStatuses) setProjectGrid(meta.projectStatuses);
                    if (meta?.totalProjects) setTotalProjectCount(meta.totalProjects);
                    if (meta?.iteration !== undefined) setShiftIteration(meta.iteration);
                }
            });

            if (!solver || !solver.bestPlan) {
                console.error('[REPRIORITIZER] Solver returned no result');
                setIsRunning(false);
                return;
            }

            const currentPlan = solver.bestPlan;
            setSolverResult(solver);

            setResults(currentPlan);
            setShowConfig(false);
            setShowTimeline(true);

            // Build resourceAssignments from optimizer's assignment data
            const newAssignments = {};
            [...(currentPlan.scheduled || []), ...(currentPlan.deferred || [])].forEach(p => {
                if (!p.assignments || p.assignments.length === 0) return;
                const pa = { pm: [], sc: [], pd: [] };
                p.assignments.forEach(a => {
                    if (!a.resourceId) return;
                    const baseRole = (a._baseRole || a.role || '').replace(/ \(\d+\/\d+\)/, '').toLowerCase();
                    const roleKey = baseRole === 'pm' ? 'pm' : baseRole === 'sc' ? 'sc' : baseRole === 'pd' ? 'pd' : null;
                    if (!roleKey) return;
                    pa[roleKey].push({
                        id: a.resourceId,
                        name: a.resourceName || 'Unknown',
                        headshot: a.resourceHeadshot || null,
                        allocationPct: a.allocationPct || 25,
                        reason: a.reason || ''
                    });
                });
                if (pa.pm.length > 0 || pa.sc.length > 0 || pa.pd.length > 0) {
                    newAssignments[p.id] = pa;
                }
            });
            setResourceAssignments(newAssignments);
            setIterationCount(solver.solverMeta?.iterations || 1);
            setOptimizerProgress(100);
            setOptimizerPhase('Complete!');
            setIsRunning(false); // Dismiss spinner

            // Deferred analytics (lightweight only)
            setTimeout(async () => {
                try {
                    setAnalyticsPhase('Calculating financial impact...');
                    await new Promise(r => setTimeout(r, 16));
                    setFinancialImpact(calculateFinancialImpact({
                        scheduled: currentPlan.scheduled, deferred: currentPlan.deferred, excluded: currentPlan.excluded
                    }));

                    setAnalyticsPhase('Sensitivity analysis...');
                    await new Promise(r => setTimeout(r, 16));
                    setSensitivityResult(runSensitivityAnalysis(currentPlan));

                    setAnalyticsPhase('Running Monte Carlo simulations...');
                    await new Promise(r => setTimeout(r, 16));
                    const mcResult = await runReprioritizationMonteCarlo({
                        projects, slotMap, resources, config, baseline: currentPlan,
                        uncertainty: { simulations: 5, leaveRate: 0.05, capacityVariance: 0.15, scopeCreep: 0.10 }
                    });
                    setMonteCarloResult(mcResult);

                    setAnalyticsPhase(null);
                } catch (e) {
                    setAnalyticsPhase(null);
                }
            }, 100);
        } catch (err) {
            console.error('[REPRIORITIZER] Re-run failed:', err);
            setIsRunning(false);
        }
    }, [projects, slotMap, resources, buildConfig, autoResourceProjects, draftAdjustedProjects]);

    // ── Override helpers ──
    const handleSetOverride = useCallback((projectId, override) => {
        setProjectOverrides(prev => {
            const next = { ...prev };
            const existing = next[projectId] || {};
            next[projectId] = { ...existing, ...override };
            // Clean up no-op overrides
            if (Object.values(next[projectId]).every(v => v === null || v === undefined || v === false)) {
                delete next[projectId];
            }
            return next;
        });
    }, []);

    const handleClearOverrides = useCallback(() => {
        setProjectOverrides({});
    }, []);

    // ── Save scenario to localStorage ──
    const handleSaveScenario = useCallback(async (saveAsNew = false) => {
        if (!scenariosTable) { console.warn('[RepriTab] No scenarios table'); return; }
        const nameToUse = scenarioName.trim() || `Scenario ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        const configData = {
            cornerstoneCustomers, partnerCustomers, minCountries, maxCountries,
            minCarr, cornerstoneMaxShift, defaultMaxShift, inFlightBonus, inFlightMaxShift, contractArrWeight, newBusinessReserve,
            autoAssign, programSpecialists, constraintHorizon,
            squadSpecializations, seedFromCurrent, seedInFlightOnly, customerSquadSeeds, excludedSquads,
            cornerstoneShiftExcludeAfter, defaultShiftExcludeAfter,
            mergeGroups: mergeGroups.map(s => [...s]),
            maxSC, maxPD, maxConcurrentProjects, entityRoleRules, preferCrossEntity,
            // Strip headshot URLs and reason strings to save space
            resourceAssignments: resourceAssignments ? Object.fromEntries(
                Object.entries(resourceAssignments).map(([k, v]) => [k, {
                    pm: (v.pm || []).map(m => ({ id: m.id, name: m.name, allocationPct: m.allocationPct })),
                    sc: (v.sc || []).map(m => ({ id: m.id, name: m.name, allocationPct: m.allocationPct })),
                    pd: (v.pd || []).map(m => ({ id: m.id, name: m.name, allocationPct: m.allocationPct }))
                }])
            ) : null,
            // Strip derivable fields (name, country, tierLabel, arr) — rehydrated on load
            priorityOrder: priorityOrder ? priorityOrder.map(p => ({
                projectId: p.projectId, rank: p.rank, locked: p.locked,
                score: Math.round(p.score || 0), tier: p.tier, originalRank: p.originalRank
            })) : null
        };
        const payload = { config: configData, overrides: projectOverrides };
        const summaryData = results ? {
            scheduled: results.stats.projectsScheduled,
            deferred: results.stats.projectsDeferred,
            arrProtected: results.stats.totalArrProtected,
            robustness: monteCarloResult?.robustnessScore || null
        } : null;
        const meta = { type: 'optimizer', savedAt: new Date().toISOString(), lastSavedBy: currentUserName, summary: summaryData };

        try {
            const changesJson = JSON.stringify(payload);
            const CHUNK = 90000;
            const changesField = scenariosTable.getFieldByName('Changes JSON');
            const metaField = scenariosTable.getFieldByName('Metadata JSON');
            const nameField = scenariosTable.getFieldByName('Name');
            let statusField = null;
            try { statusField = scenariosTable.getFieldByName('Status'); } catch { }
            // Try explicit settings mapping first, fallback to robust name scanning
            const changes2FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_2];
            const changes3FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_3];
            let of2 = changes2FieldId ? scenariosTable.getFieldByIdIfExists(changes2FieldId) : null;
            let of3 = changes3FieldId ? scenariosTable.getFieldByIdIfExists(changes3FieldId) : null;

            if ((!of2 || !of3) && scenariosTable?.fields) {
                for (const f of scenariosTable.fields) {
                    const fname = f.name.trim().toLowerCase();
                    if (!of2 && fname === 'changes json 2') of2 = f;
                    if (!of3 && fname === 'changes json 3') of3 = f;
                }
            }

            const updateData = {
                [changesField.id]: changesJson.slice(0, CHUNK),
                [metaField.id]: JSON.stringify(meta),
            };
            // Set Status to 'Optimizer' so it's visible in Airtable and filterable
            if (statusField) {
                updateData[statusField.id] = { name: 'Optimizer' };
            }
            if (of2) updateData[of2.id] = changesJson.slice(CHUNK, CHUNK * 2) || '';
            if (of3) updateData[of3.id] = changesJson.slice(CHUNK * 2, CHUNK * 3) || '';
            // ── Results JSON: save compact optimizer output ──
            // Try settings-mapped field IDs first, fall back to name scanning
            const RESULTS_KEYS = [
                SETTINGS.SCENARIO_RESULTS_JSON, SETTINGS.SCENARIO_RESULTS_JSON_2,
                SETTINGS.SCENARIO_RESULTS_JSON_3, SETTINGS.SCENARIO_RESULTS_JSON_4,
                SETTINGS.SCENARIO_RESULTS_JSON_5, SETTINGS.SCENARIO_RESULTS_JSON_6
            ];
            let resultsFields = RESULTS_KEYS
                .map(k => { const fid = settings?.[k]; return fid ? scenariosTable.getFieldByIdIfExists(fid) : null; })
                .filter(Boolean);
            console.log('[RepriTab] Results field lookup:', RESULTS_KEYS.map(k => `${k}=${settings?.[k] || 'unmapped'}`).join(', '), '→', resultsFields.length, 'found');

            // Fallback: scan by name if settings not mapped yet
            if (resultsFields.length === 0 && scenariosTable?.fields) {
                const nameMap = [];
                for (const f of scenariosTable.fields) {
                    const fname = f.name.trim().toLowerCase();
                    const m = fname.match(/^results json(\s+(\d+))?$/);
                    if (m) nameMap.push({ field: f, idx: m[2] ? parseInt(m[2]) : 1 });
                }
                nameMap.sort((a, b) => a.idx - b.idx);
                resultsFields = nameMap.map(n => n.field);
                if (resultsFields.length > 0) console.log('[RepriTab] Results fields found by name scan:', resultsFields.length);
            }

            let resultsJson = '';
            if (results && resultsFields.length > 0) {
                // Build compact results snapshot — IDs + outcome data only
                const compactResults = {
                    s: (results.scheduled || []).map(p => ({
                        id: p.id,
                        sc: Math.round(p._reprioritization?.score || 0),
                        t: p._reprioritization?.tier,
                        sw: p.shiftWeeks || 0,
                        ps: p.proposedStart || p.kickOff || null,
                        pe: p.proposedEnd || p.launch || null,
                        sn: p.schedulingNote || '',
                        a: (p.assignments || []).filter(a => a.resourceId).map(a => ({
                            r: a.resourceId,
                            rn: a.resourceName || '',
                            rl: a._baseRole || a.role || '',
                            p: a.allocationPct || 25
                        }))
                    })),
                    d: (results.deferred || []).map(p => ({
                        id: p.id,
                        sc: Math.round(p._reprioritization?.score || 0),
                        t: p._reprioritization?.tier,
                        dr: p.deferralReason || ''
                    })),
                    x: (results.excluded || []).map(p => ({
                        id: p.id,
                        xr: p.exclusionReason || p._reprioritization?.exclusionReason || ''
                    })),
                    st: results.stats || {}
                };
                resultsJson = JSON.stringify(compactResults);
                console.log('[RepriTab] Results JSON size:', resultsJson.length, 'chars across', resultsFields.length, 'fields');
            }

            // Chunk results across Results JSON fields
            resultsFields.forEach((rf, i) => {
                updateData[rf.id] = resultsJson.slice(i * CHUNK, (i + 1) * CHUNK) || '';
            });

            console.log('[RepriTab] Saving chunk sizes:',
                updateData[changesField.id]?.length,
                of2 ? updateData[of2.id]?.length : 'No of2',
                of3 ? updateData[of3.id]?.length : 'No of3',
                resultsFields.length > 0 ? `Results: ${resultsJson.length} chars` : 'No results fields'
            );

            if (loadedScenarioId && !saveAsNew) {
                // Update existing row (preserve name)
                await scenariosTable.updateRecordAsync(loadedScenarioId, updateData);
            } else {
                // Create new row
                const newName = saveAsNew && loadedScenarioId ? `${nameToUse} (Copy)` : nameToUse;
                const newId = await scenariosTable.createRecordAsync({
                    [nameField.id]: newName,
                    ...updateData
                });
                setLoadedScenarioId(newId);
                setScenarioName(newName);
            }
        } catch (e) {
            console.error('[RepriTab] Failed to save scenario:', e);
            alert('Airtable save failed. Check console.');
        }
        setShowSaveDialog(false);
    }, [
        scenariosTable, scenarioName,
        cornerstoneCustomers, partnerCustomers, minCountries, maxCountries,
        minCarr, cornerstoneMaxShift, defaultMaxShift, inFlightBonus, inFlightMaxShift, contractArrWeight, newBusinessReserve,
        autoAssign, programSpecialists, constraintHorizon, squadSpecializations, seedFromCurrent, seedInFlightOnly, customerSquadSeeds, excludedSquads,
        cornerstoneShiftExcludeAfter, defaultShiftExcludeAfter, mergeGroups,
        maxSC, maxPD, maxConcurrentProjects, resourceAssignments, priorityOrder, projectOverrides,
        results, monteCarloResult, currentUserName, loadedScenarioId, settings
    ]);

    // ── Load scenario from saved ──
    const handleLoadScenario = useCallback((scenario) => {
        const c = scenario.config || {};
        if (c.cornerstoneCustomers) setCornerstoneCustomers(c.cornerstoneCustomers);
        if (c.partnerCustomers) setPartnerCustomers(c.partnerCustomers);
        // Legacy: handle old saved scenarios that used partnerInput string
        else if (c.partnerInput) setPartnerCustomers(c.partnerInput.split(',').map(s => s.trim()).filter(Boolean));
        if (c.minCountries !== undefined) setMinCountries(c.minCountries);
        if (c.maxCountries !== undefined) setMaxCountries(c.maxCountries);
        if (c.minCarr !== undefined) setMinCarr(c.minCarr);
        if (c.cornerstoneMaxShift !== undefined) setCornerstoneMaxShift(c.cornerstoneMaxShift);
        if (c.defaultMaxShift !== undefined) setDefaultMaxShift(c.defaultMaxShift);
        if (c.inFlightBonus !== undefined) setInFlightBonus(c.inFlightBonus);
        if (c.inFlightMaxShift !== undefined) setInFlightMaxShift(c.inFlightMaxShift);
        if (c.contractArrWeight !== undefined) setContractArrWeight(c.contractArrWeight);
        if (c.newBusinessReserve !== undefined) setNewBusinessReserve(c.newBusinessReserve);
        if (c.autoAssign !== undefined) setAutoAssign(c.autoAssign);
        if (c.programSpecialists) setProgramSpecialists(c.programSpecialists);
        if (c.constraintHorizon !== undefined) setConstraintHorizon(c.constraintHorizon);
        if (c.squadSpecializations) setSquadSpecializations(c.squadSpecializations);

        if (c.seedFromCurrent !== undefined) setSeedFromCurrent(c.seedFromCurrent);
        if (c.seedInFlightOnly !== undefined) setSeedInFlightOnly(c.seedInFlightOnly);
        if (c.customerSquadSeeds) setCustomerSquadSeeds(c.customerSquadSeeds);
        if (c.excludedSquads) setExcludedSquads(c.excludedSquads);
        if (c.cornerstoneShiftExcludeAfter !== undefined) setCornerstoneShiftExcludeAfter(c.cornerstoneShiftExcludeAfter || '');
        if (c.defaultShiftExcludeAfter !== undefined) setDefaultShiftExcludeAfter(c.defaultShiftExcludeAfter || '');
        if (c.mergeGroups) setMergeGroups(c.mergeGroups.map(arr => new Set(arr)));
        if (c.maxSC !== undefined) setMaxSC(c.maxSC);
        if (c.maxPD !== undefined) setMaxPD(c.maxPD);
        if (c.maxConcurrentProjects !== undefined) setMaxConcurrentProjects(c.maxConcurrentProjects);
        if (c.entityRoleRules) setEntityRoleRules(c.entityRoleRules.map(r => ({ ...r, canFill: r.canFill || [], maxRoles: r.maxRoles || 3 })));
        if (c.preferCrossEntity !== undefined) setPreferCrossEntity(c.preferCrossEntity);
        if (c.resourceAssignments) setResourceAssignments(c.resourceAssignments);
        if (c.priorityOrder) {
            // Rehydrate derivable fields from live project data
            const rehydrated = c.priorityOrder.map(p => {
                const liveProject = (projects || []).find(lp => lp.id === p.projectId);
                return {
                    ...p,
                    name: p.name || liveProject?.customer || liveProject?.clientName || 'Unknown',
                    country: p.country || liveProject?.country || '',
                    arr: p.arr ?? liveProject?.arr ?? 0,
                    tierLabel: p.tierLabel || (p.tier === 1 ? 'Cornerstone' : p.tier === 2 ? 'Partner' : p.tier === 3 ? 'Growth' : 'Standard')
                };
            });
            setPriorityOrder(rehydrated);
            setShowPriorityReview(true);
        }
        setProjectOverrides(scenario.overrides || {});

        // ── Rehydrate saved results if available ──
        if (scenario.compactResults) {
            const cr = scenario.compactResults;
            const projectMap = {};
            (projects || []).forEach(p => { projectMap[p.id] = p; });
            const TIER_LABELS = { 1: 'Cornerstone', 2: 'Protected', 3: 'New + Event', 4: 'Standard', 5: 'Below Threshold' };

            const rehydrateProject = (entry) => {
                const live = projectMap[entry.id] || {};
                return {
                    ...live,
                    id: entry.id,
                    _reprioritization: {
                        score: entry.sc || 0,
                        tier: entry.t,
                        tierLabel: TIER_LABELS[entry.t] || 'Standard',
                        reasoning: live._reprioritization?.reasoning || []
                    }
                };
            };

            const scheduled = (cr.s || []).map(entry => {
                const p = rehydrateProject(entry);
                p.shiftWeeks = entry.sw || 0;
                p.proposedStart = entry.ps || p.kickOff;
                p.proposedEnd = entry.pe || p.launch;
                p.schedulingNote = entry.sn || '';
                p.assignments = (entry.a || []).map(a => ({
                    resourceId: a.r,
                    resourceName: a.rn || '',
                    _baseRole: a.rl,
                    role: a.rl,
                    allocationPct: a.p || 25
                }));
                return p;
            });

            const deferred = (cr.d || []).map(entry => {
                const p = rehydrateProject(entry);
                p.deferralReason = entry.dr || '';
                return p;
            });

            const excluded = (cr.x || []).map(entry => {
                const live = projectMap[entry.id] || {};
                return {
                    ...live,
                    id: entry.id,
                    exclusionReason: entry.xr || '',
                    _reprioritization: { tier: -1, tierLabel: 'Excluded' }
                };
            });

            setResults({
                scheduled,
                deferred,
                excluded,
                stats: cr.st || {
                    projectsScheduled: scheduled.length,
                    projectsDeferred: deferred.length,
                    projectsExcluded: excluded.length,
                    totalArrProtected: scheduled.reduce((s, p) => s + (p.arr || 0), 0),
                    totalArrDeferred: deferred.reduce((s, p) => s + (p.arr || 0), 0)
                },
                warnings: []
            });
            setShowConfig(false);
            console.log('[RepriTab] Restored saved results:', scheduled.length, 'scheduled,', deferred.length, 'deferred');

            // Auto-scroll to results
            setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        } else {
            setResults(null); // No saved results — user must re-run
        }
        setLoadedScenarioId(scenario.id); // Track loaded scenario for save-in-place
        setScenarioName(scenario.name || '');
        setShowLoadDrawer(false);
    }, [projects]);

    // ── Delete saved scenario ──
    const handleDeleteSavedScenario = useCallback(async (scenarioId) => {
        if (!scenariosTable) return;
        try {
            await scenariosTable.deleteRecordAsync(scenarioId);
            if (loadedScenarioId === scenarioId) setLoadedScenarioId(null);
        } catch (e) {
            console.error('[RepriTab] Failed to delete scenario:', e);
        }
    }, [scenariosTable, loadedScenarioId]);

    // ── Rename saved scenario ──
    const handleRenameSavedScenario = useCallback(async (scenarioId, newName) => {
        if (!newName?.trim() || !scenariosTable) return;
        try {
            const nameField = scenariosTable.getFieldByName('Name');
            await scenariosTable.updateRecordAsync(scenarioId, { [nameField.id]: newName.trim() });
            if (loadedScenarioId === scenarioId) setScenarioName(newName.trim());
        } catch (e) {
            console.error('[RepriTab] Failed to rename scenario:', e);
        }
        setRenamingScenarioId(null);
    }, [scenariosTable, loadedScenarioId]);

    // Register save/load actions with parent (OptimizationModal footer)
    // NOTE: Must be placed after handleSaveScenario definition to avoid temporal dead zone
    useEffect(() => {
        if (onRegisterActions) {
            onRegisterActions({
                onSave: () => {
                    if (loadedScenarioId) {
                        // Already loaded — save directly without dialog
                        handleSaveScenario();
                    } else {
                        setShowSaveDialog(true);
                    }
                },
                onSaveAs: () => {
                    if (loadedScenarioId) {
                        handleSaveScenario(true);
                    } else {
                        setShowSaveDialog(true);
                    }
                },
                onLoad: () => setShowLoadDrawer(true),
                savedCount: savedScenarios.length,
                loadedName: loadedScenarioId ? scenarioName : null
            });
        }
    }, [onRegisterActions, savedScenarios.length, loadedScenarioId, handleSaveScenario, scenarioName]);

    // ── Poll for AI Reasoning ──
    const pollForAiReasoning = useCallback(async (base, settings, recordId) => {
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(async () => {
            attempts++;
            try {
                // Check if AI fields are populated
                const table = base.getTableByNameIfExists('Optimization Runs');
                if (!table) { clearInterval(interval); setAiLoading(false); return; }

                const record = await table.selectRecordAsync(recordId);
                if (!record) { clearInterval(interval); setAiLoading(false); return; }

                const insights = record.getCellValueAsString('AI Insights') ||
                    record.getCellValueAsString('fld_opt_ai_insights');

                if (insights && insights.length > 10) {
                    setAiReasoning(insights);
                    setAiLoading(false);
                    clearInterval(interval);
                }
            } catch (e) {
                // Ignore polling errors
            }
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                setAiLoading(false);
            }
        }, 3000);
    }, []);
    // ── Export Optimizer Results as CSV ──
    const handleExportCSV = useCallback(() => {
        if (!results) return;
        const sched = results.scheduled || [];
        const def = results.deferred || [];
        const all = [
            ...sched.map(p => ({ ...p, _section: 'Scheduled' })),
            ...def.map(p => ({ ...p, _section: 'Deferred' }))
        ];

        const esc = (v) => {
            const s = String(v ?? '').replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        };

        const headers = [
            'Section', 'Project Name', 'Customer', 'Country', 'Tier', 'Score',
            'ARR (£)', 'Original Start', 'Original End', 'Proposed Start', 'Proposed End',
            'Shift (weeks)', 'PM', 'SC', 'PD', 'Fill Status', 'Cross-Squad Fills',
            'Scheduling Note', 'Deferral Reason'
        ];

        const rows = all.map(p => {
            const assigns = p.assignments || [];
            const getRole = (role) => assigns
                .filter(a => (a.role || '').replace(/ \(\d+\/\d+\)/, '') === role && a.resourceId)
                .map(a => a.resourceName || 'Unknown').join('; ');
            const crossSquad = assigns.filter(a => a.isCrossSquad).length;
            const filled = assigns.length > 0 && assigns.every(a => a.resourceId) ? 'Fully Resourced'
                : assigns.some(a => a.resourceId) ? 'Partial' : 'Unfilled';

            return [
                p._section,
                esc(p.name || ''),
                esc(p.customer || ''),
                esc(p.country || ''),
                p._reprioritization?.tier || '',
                (p._reprioritization?.score || 0).toFixed(1),
                p.arr || 0,
                p.start || p.kickOff || '',
                p.end || p.launch || '',
                p.proposedStart || '',
                p.proposedEnd || '',
                p.shiftWeeks || 0,
                esc(getRole('PM')),
                esc(getRole('SC')),
                esc(getRole('PD')),
                filled,
                crossSquad,
                esc(p.schedulingNote || ''),
                esc(p.deferralReason || '')
            ].join(',');
        });

        // Add summary rows at the top
        const totalRoles = all.reduce((s, p) => s + (p.assignments || []).length, 0);
        const filledRoles = all.reduce((s, p) => s + (p.assignments || []).filter(a => a.resourceId).length, 0);
        const summaryRows = [
            `# Optimizer Report - ${new Date().toISOString().split('T')[0]}`,
            `# Scheduled: ${sched.length} | Deferred: ${def.length} | Fill Rate: ${totalRoles > 0 ? Math.round(filledRoles / totalRoles * 100) : 0}%`,
            `# ARR Protected: £${sched.reduce((s, p) => s + (p.arr || 0), 0).toLocaleString()}`,
            ''
        ];

        const csv = [...summaryRows, headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `optimizer-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [results]);

    // ── Create Draft from results (combines reprio shifts + manual resource assignments) ──
    const handleCreateDraft = useCallback(() => {
        if (!results || !onCreateDraft) return;

        // Build scenario changes from the scheduled projects
        const changes = {};
        (results.scheduled || []).forEach(p => {
            const hasDateChange = p.shiftWeeks !== 0;
            const manualAssigns = resourceAssignments[p.id];
            const hasManualAssigns = manualAssigns && (manualAssigns.pm?.length > 0 || manualAssigns.sc?.length > 0 || manualAssigns.pd?.length > 0);

            // Helper to detect placeholder resources (TBD PM, TBD SC, etc.)
            const isPlaceholderResource = (m) => {
                if (!m) return true;
                if (m.isPlaceholder) return true;
                const id = m.id || m.resourceId || (typeof m === 'string' ? m : '');
                if (id.startsWith('PLACEHOLDER_')) return true;
                const name = m.name || m.resourceName || '';
                if (name.startsWith('TBD ')) return true;
                return false;
            };

            // Build team changes: prefer manual assignments, fall back to engine assignments
            // Filter out all placeholder resources
            const teamChanges = {};
            ['pm', 'sc', 'pd'].forEach(role => {
                const manual = manualAssigns?.[role] || [];
                if (manual.length > 0) {
                    const real = manual.filter(m => !isPlaceholderResource(m));
                    if (real.length > 0) teamChanges[role] = real.map(m => ({ id: m.id, name: m.name }));
                } else {
                    // Collect ALL engine assignments for this role (not just the first one)
                    const engineAll = (p.assignments || []).filter(a => {
                        const baseRole = (a.role || '').replace(/ \(\d+\/\d+\)/, '').toLowerCase();
                        return baseRole === role && a.resourceId && !isPlaceholderResource(a);
                    });
                    if (engineAll.length > 0) {
                        teamChanges[role] = engineAll.map(a => ({ id: a.resourceId, name: a.resourceName }));
                    }
                }
            });

            // Check if team actually differs from original (also excluding placeholders from originals)
            const rawTeam = p.team || {};
            let hasTeamChange = false;
            let hasPlaceholders = false;
            for (const role of ['pm', 'sc', 'pd']) {
                const origAll = Array.isArray(rawTeam[role]) ? rawTeam[role] : [];
                const origPlaceholders = origAll.filter(r => isPlaceholderResource(r));
                if (origPlaceholders.length > 0) hasPlaceholders = true;
                const origReal = origAll.filter(r => !isPlaceholderResource(r));
                const origIds = origReal.map(r => r.id || r).sort().join(',');
                const newIds = (teamChanges[role] || []).map(r => r.id || r).sort().join(',');
                if (newIds && origIds !== newIds) {
                    hasTeamChange = true;
                    break;
                }
            }

            // If the original team has TBD placeholders, always include a team change
            // to strip them — even if the real resource IDs didn't change
            if (hasPlaceholders && !hasTeamChange) {
                hasTeamChange = true;
            }

            // Only include if there's a real change (date shift or team difference)
            if (hasDateChange || hasTeamChange || hasManualAssigns) {
                const change = {
                    start: p.proposedStart,
                    end: p.proposedEnd,
                    original: {
                        start: p.start || p.kickOff,
                        end: p.end || p.launch
                    }
                };

                // Always include all three roles in team override so the spread
                // fully replaces the base team and doesn't leak TBD placeholders
                if (Object.keys(teamChanges).length > 0 || hasPlaceholders) {
                    const origRealTeam = {
                        pm: (Array.isArray(rawTeam.pm) ? rawTeam.pm : []).filter(r => !isPlaceholderResource(r)),
                        sc: (Array.isArray(rawTeam.sc) ? rawTeam.sc : []).filter(r => !isPlaceholderResource(r)),
                        pd: (Array.isArray(rawTeam.pd) ? rawTeam.pd : []).filter(r => !isPlaceholderResource(r))
                    };
                    // Include all three roles: use teamChanges if present, otherwise keep original real members
                    change.team = {
                        pm: teamChanges.pm || origRealTeam.pm,
                        sc: teamChanges.sc || origRealTeam.sc,
                        pd: teamChanges.pd || origRealTeam.pd
                    };
                    change.original.team = origRealTeam;
                }

                changes[p.id] = change;
            }
        });

        // Count resourced projects
        const totalResourced = Object.values(resourceAssignments).filter(pa =>
            pa.pm?.length > 0 || pa.sc?.length > 0 || pa.pd?.length > 0
        ).length;

        // Compute optimizer stats for the draft metadata
        const sched = results.scheduled || [];
        const totalRoles = sched.reduce((s, p) => s + (p.assignments || []).length, 0);
        const filledRoles = sched.reduce((s, p) => s + (p.assignments || []).filter(a => a.resourceId).length, 0);
        const crossSquadFills = sched.reduce((s, p) => s + (p.assignments || []).filter(a => a.isCrossSquad).length, 0);

        onCreateDraft({
            name: `Replan ${new Date().toLocaleDateString('en-GB')}`,
            description: `Portfolio replan: ${results.stats.projectsScheduled} scheduled, ${results.stats.projectsDeferred} deferred. ${totalResourced} projects resourced. ${iterationCount} iteration${iterationCount !== 1 ? 's' : ''} to converge. £${(results.stats.totalArrProtected / 1000).toFixed(0)}k ARR protected.`,
            changes: { projects: changes, resources: {} },
            optimizerStats: {
                scheduled: sched.length,
                deferred: (results.deferred || []).length,
                fillRate: totalRoles > 0 ? Math.round(filledRoles / totalRoles * 100) : 0,
                filledRoles,
                totalRoles,
                crossSquadFills,
                arrProtected: results.stats?.totalArrProtected || 0,
                arrDeferred: results.stats?.totalArrDeferred || 0,
                strategy: solverResult?.solverMeta?.startingStrategy || 'unknown',
                durationMs: solverResult?.solverMeta?.totalDurationMs || 0,
                strategiesEvaluated: solverResult?.solverMeta?.strategiesEvaluated || 1
            }
        });
    }, [results, onCreateDraft, resourceAssignments, iterationCount]);

    // ── Filtered results by tier ──
    const filteredScheduled = useMemo(() => {
        if (!results) return [];
        if (selectedTier === null) return results.scheduled;
        return results.scheduled.filter(p => p._reprioritization?.tier === selectedTier);
    }, [results, selectedTier]);

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════════

    return (
        <div ref={configRef} style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', position: 'relative' }}>

            {/* ── Running Overlay: Alien Juggler ── */}
            {isRunning && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
                    backgroundColor: isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.96)',
                    backdropFilter: 'blur(10px)', borderRadius: '16px'
                }}>
                    {/* Keyframes */}
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes alienBlink {
                            0%, 90%, 100% { transform: scaleY(1); }
                            95% { transform: scaleY(0.1); }
                        }
                        @keyframes alienBob {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-6px); }
                        }
                        @keyframes alienArmL {
                            0%, 100% { transform: rotate(-15deg); }
                            50% { transform: rotate(-35deg); }
                        }
                        @keyframes alienArmR {
                            0%, 100% { transform: rotate(15deg); }
                            50% { transform: rotate(35deg); }
                        }
                        /* ── Shrug cycle (30s): drop → scatter → look around → shrug → pick up ── */
                        /* Arms: normal juggle 0-60%, drop 60-66%, idle 66-78%, shrug 78-86%, pickup 86-92%, resume 92-100% */
                        @keyframes shrugArmL {
                            0%, 60% { transform: rotate(-15deg); }
                            63% { transform: rotate(-5deg); }
                            66%, 78% { transform: rotate(0deg); }
                            80%, 84% { transform: rotate(-85deg); }
                            88% { transform: rotate(40deg); }
                            92% { transform: rotate(-15deg); }
                            100% { transform: rotate(-15deg); }
                        }
                        @keyframes shrugArmR {
                            0%, 60% { transform: rotate(15deg); }
                            63% { transform: rotate(5deg); }
                            66%, 78% { transform: rotate(0deg); }
                            80%, 84% { transform: rotate(85deg); }
                            88% { transform: rotate(-40deg); }
                            92% { transform: rotate(15deg); }
                            100% { transform: rotate(15deg); }
                        }
                        /* Balls: orbit normally, then drop to floor, scatter, stay, rise back */
                        @keyframes ballDrop {
                            0%, 58% { opacity: 1; transform: translateY(0) scale(1); }
                            62% { opacity: 1; transform: translateY(70px) scale(1); }
                            64% { opacity: 1; transform: translateY(72px) scale(0.9); }
                            66%, 84% { opacity: 1; transform: translateY(72px) scale(0.85); }
                            88% { opacity: 1; transform: translateY(35px) scale(0.9); }
                            93% { opacity: 1; transform: translateY(0) scale(1); }
                            100% { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        /* Individual ball scatter: each ball drifts sideways when dropped */
                        @keyframes ballScatter {
                            0%, 60% { transform: translateX(0); }
                            65%, 85% { transform: translateX(var(--scatter-x, 0px)); }
                            92%, 100% { transform: translateX(0); }
                        }
                        /* Alien tear drops */
                        @keyframes tearFall {
                            0%, 58% { opacity: 0; transform: translateY(0) scaleY(0); }
                            62% { opacity: 0; transform: translateY(0) scaleY(0); }
                            65% { opacity: 0.9; transform: translateY(0) scaleY(1); }
                            76% { opacity: 0.7; transform: translateY(18px) scaleY(1.3); }
                            84% { opacity: 0; transform: translateY(28px) scaleY(0.5); }
                            85%, 100% { opacity: 0; transform: translateY(0) scaleY(0); }
                        }
                        /* Eyes look left and right during the confused phase */
                        @keyframes alienLookAround {
                            0%, 60%, 90%, 100% { transform: translateX(0); }
                            68%, 72% { transform: translateX(-3px); }
                            75%, 79% { transform: translateX(3px); }
                            82%, 86% { transform: translateX(0); }
                        }
                        /* Body bobs to look down at balls then back up */
                        @keyframes alienShrugBob {
                            0%, 60% { transform: translateY(0); }
                            50% { transform: translateY(-6px); }
                            66%, 78% { transform: translateY(0) rotate(0deg); }
                            80%, 84% { transform: translateY(-4px) rotate(0deg); }
                            88%, 90% { transform: translateY(8px) rotate(2deg); }
                            94% { transform: translateY(0); }
                            100% { transform: translateY(0); }
                        }
                        ${Array.from({ length: 25 }, (_, i) => {
                        const angle = (i / 25) * 360;
                        const rx = 55 + (i % 3) * 10;
                        const ry = 28 + (i % 4) * 5;
                        const dur = 1.8 + (i % 5) * 0.3;
                        return `@keyframes ball${i} {
                                0% { transform: rotate(${angle}deg) translateX(${rx}px) translateY(-${ry}px) rotate(-${angle}deg); }
                                100% { transform: rotate(${angle + 360}deg) translateX(${rx}px) translateY(-${ry}px) rotate(-${angle + 360}deg); }
                            }`;
                    }).join('\n')}

                        /* ── Explosion + UFO animations ── */
                        @keyframes explodeFragment {
                            0% { opacity: 1; transform: translate(0, 0) scale(1); }
                            100% { opacity: 0; transform: translate(var(--ex), var(--ey)) scale(0.2) rotate(720deg); }
                        }
                        @keyframes flashBang {
                            0% { opacity: 0; transform: scale(0.5); }
                            30% { opacity: 1; transform: scale(2); }
                            100% { opacity: 0; transform: scale(3); }
                        }
                        @keyframes smokeRise {
                            0% { opacity: 0.8; transform: translateY(0) scale(1); }
                            100% { opacity: 0; transform: translateY(-40px) scale(2); }
                        }
                        @keyframes ufoEnter {
                            0% { opacity: 0; transform: translateX(150px) translateY(-50px) scale(0.3); }
                            60% { opacity: 1; transform: translateX(0) translateY(-10px) scale(1); }
                            100% { opacity: 1; transform: translateX(0) translateY(0) scale(1); }
                        }
                        @keyframes ufoHover {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-4px); }
                        }
                        @keyframes beamDown {
                            0% { opacity: 0; clip-path: polygon(35% 0%, 65% 0%, 65% 0%, 35% 0%); }
                            30% { opacity: 0.9; clip-path: polygon(25% 0%, 75% 0%, 85% 100%, 15% 100%); }
                            100% { opacity: 0.9; clip-path: polygon(25% 0%, 75% 0%, 85% 100%, 15% 100%); }
                        }
                        @keyframes materialize {
                            0% { opacity: 0; transform: translateY(-20px) scale(0.3); filter: brightness(3) blur(4px); }
                            50% { opacity: 0.7; transform: translateY(0) scale(1.1); filter: brightness(2) blur(2px); }
                            100% { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1) blur(0); }
                        }
                        @keyframes ufoLeave {
                            0% { opacity: 1; transform: translateX(0) translateY(0) scale(1); }
                            100% { opacity: 0; transform: translateX(-200px) translateY(-80px) scale(0.2); }
                        }

                        @keyframes logFadeIn {
                            from { opacity: 0; transform: translateY(6px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>

                    {/* Alien + Juggling Balls */}
                    {/* ── Phase-conditional alien container ── */}
                    <div style={{ position: 'relative', width: '180px', height: '200px' }}>

                        {/* UFO (visible during ufo + beaming phases) */}
                        {(alienPhase === 'ufo' || alienPhase === 'beaming') && (
                            <div style={{
                                position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
                                animation: alienPhase === 'ufo' ? 'ufoEnter 1.5s ease-out forwards' : 'ufoHover 1.5s ease-in-out infinite',
                                zIndex: 10
                            }}>
                                <svg viewBox="0 0 100 45" width="80" height="36">
                                    <ellipse cx="50" cy="30" rx="45" ry="12" fill="url(#ufoGrad)" />
                                    <ellipse cx="50" cy="22" rx="22" ry="14" fill="#64748b" />
                                    <ellipse cx="50" cy="22" rx="22" ry="14" fill="url(#ufoGlass)" opacity="0.7" />
                                    {[20, 35, 50, 65, 80].map((x, i) => (
                                        <circle key={i} cx={x} cy="30" r="3" fill="#f59e0b" opacity="0.8">
                                            <animate attributeName="opacity" values="0.3;1;0.3" dur={`${0.4 + i * 0.1}s`} repeatCount="indefinite" />
                                        </circle>
                                    ))}
                                    <defs>
                                        <linearGradient id="ufoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#475569" />
                                            <stop offset="100%" stopColor="#1e293b" />
                                        </linearGradient>
                                        <radialGradient id="ufoGlass" cx="50%" cy="30%">
                                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                                            <stop offset="100%" stopColor="#0e7490" stopOpacity="0.2" />
                                        </radialGradient>
                                    </defs>
                                </svg>
                            </div>
                        )}

                        {/* Tractor beam (beaming phase) */}
                        {alienPhase === 'beaming' && (
                            <div style={{
                                position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)',
                                width: '90px', height: '160px',
                                background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.5), rgba(34, 197, 94, 0.15))',
                                animation: 'beamDown 1s ease-out forwards',
                                zIndex: 3
                            }} />
                        )}

                        {/* Explosion fragments */}
                        {alienPhase === 'exploding' && (
                            <>
                                {/* Flash */}
                                <div style={{
                                    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                                    width: '60px', height: '60px', borderRadius: '50%',
                                    background: 'radial-gradient(circle, #fff 0%, #f59e0b 40%, transparent 70%)',
                                    animation: 'flashBang 0.8s ease-out forwards',
                                    zIndex: 10
                                }} />
                                {/* Fragments */}
                                {Array.from({ length: 16 }, (_, i) => {
                                    const angle = (i / 16) * Math.PI * 2;
                                    const dist = 60 + (i % 3) * 30;
                                    const colors = ['#22c55e', '#06b6d4', '#FF6B35', '#E83F6F', '#f59e0b', '#8b5cf6'];
                                    return (
                                        <div key={i} style={{
                                            position: 'absolute', left: '50%', top: '45%',
                                            width: `${6 + (i % 3) * 3}px`, height: `${6 + (i % 3) * 3}px`,
                                            borderRadius: i % 2 === 0 ? '50%' : '2px',
                                            backgroundColor: colors[i % colors.length],
                                            '--ex': `${Math.cos(angle) * dist}px`,
                                            '--ey': `${Math.sin(angle) * dist}px`,
                                            animation: `explodeFragment ${0.8 + (i % 3) * 0.3}s ease-out forwards`,
                                            zIndex: 5
                                        }} />
                                    );
                                })}
                            </>
                        )}

                        {/* Smoke puffs */}
                        {alienPhase === 'smoke' && (
                            <>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        position: 'absolute',
                                        left: `${35 + i * 15}px`, top: '70px',
                                        width: `${20 + i * 5}px`, height: `${20 + i * 5}px`,
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(148, 163, 184, 0.5)',
                                        animation: `smokeRise ${1.5 + i * 0.3}s ease-out forwards`,
                                        animationDelay: `${i * 0.2}s`,
                                        zIndex: 3
                                    }} />
                                ))}
                            </>
                        )}

                        {/* Alien + Balls (visible during juggling and beaming) */}
                        {(alienPhase === 'juggling' || alienPhase === 'beaming') && (
                            <div style={{
                                position: 'relative', width: '180px', height: '180px',
                                animation: alienPhase === 'beaming'
                                    ? 'materialize 2s ease-out forwards'
                                    : 'alienShrugBob 30s ease-in-out infinite'
                            }}>
                                {/* Juggling balls */}
                                <div style={{ position: 'absolute', inset: 0, animation: alienPhase === 'juggling' ? 'ballDrop 30s ease-in infinite' : 'none' }}>
                                    {Array.from({ length: 25 }, (_, i) => {
                                        const colors = ['#FF6B35', '#E83F6F', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
                                        const dur = 1.8 + (i % 5) * 0.3;
                                        const scatterX = (i % 2 === 0 ? 1 : -1) * (8 + (i % 7) * 5);
                                        return (
                                            <div key={i} style={{
                                                position: 'absolute', left: '50%', top: '40%',
                                                animation: `ballScatter 30s ease-in-out infinite`,
                                                '--scatter-x': `${scatterX}px`
                                            }}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    backgroundColor: colors[i % colors.length],
                                                    boxShadow: `0 0 6px ${colors[i % colors.length]}80`,
                                                    animation: `ball${i} ${dur}s linear infinite`,
                                                    zIndex: 1
                                                }} />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Alien Body */}
                                <svg viewBox="0 0 120 140" width="120" height="140" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}>
                                    <ellipse cx="60" cy="95" rx="22" ry="28" fill="url(#alienGrad)" />
                                    <ellipse cx="60" cy="52" rx="28" ry="24" fill="url(#alienGrad)" />
                                    <g style={{ animation: 'alienBlink 4s ease-in-out infinite', transformOrigin: '42px 48px' }}>
                                        <ellipse cx="42" cy="48" rx="8" ry="9" fill="white" />
                                        <g style={{ animation: 'alienLookAround 30s ease-in-out infinite' }}>
                                            <circle cx="42" cy="48" r="4" fill="#1e293b" />
                                            <circle cx="40" cy="46" r="1.5" fill="white" />
                                        </g>
                                    </g>
                                    <g style={{ animation: 'alienBlink 4s ease-in-out infinite 0.5s', transformOrigin: '60px 42px' }}>
                                        <ellipse cx="60" cy="42" rx="7" ry="8" fill="white" />
                                        <g style={{ animation: 'alienLookAround 30s ease-in-out infinite' }}>
                                            <circle cx="60" cy="42" r="3.5" fill="#1e293b" />
                                            <circle cx="58" cy="40" r="1.3" fill="white" />
                                        </g>
                                    </g>
                                    <g style={{ animation: 'alienBlink 4s ease-in-out infinite 1s', transformOrigin: '78px 48px' }}>
                                        <ellipse cx="78" cy="48" rx="8" ry="9" fill="white" />
                                        <g style={{ animation: 'alienLookAround 30s ease-in-out infinite' }}>
                                            <circle cx="78" cy="48" r="4" fill="#1e293b" />
                                            <circle cx="76" cy="46" r="1.5" fill="white" />
                                        </g>
                                    </g>
                                    <path d="M48 62 Q60 70 72 62" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
                                    {/* Tear drops (visible during drop cycle 60-86%) */}
                                    {[{ cx: 42, cy: 56, d: 0 }, { cx: 60, cy: 50, d: 0.4 }, { cx: 78, cy: 56, d: 0.8 }].map((t, ti) => (
                                        <g key={`tear-${ti}`}>
                                            <ellipse cx={t.cx - 2} cy={t.cy + 2} rx="1.5" ry="2.5" fill="#38bdf8" opacity="0"
                                                style={{ animation: `tearFall 30s ease-in-out infinite ${t.d}s` }} />
                                            <ellipse cx={t.cx + 3} cy={t.cy + 4} rx="1.2" ry="2" fill="#38bdf8" opacity="0"
                                                style={{ animation: `tearFall 30s ease-in-out infinite ${t.d + 1.2}s` }} />
                                        </g>
                                    ))}
                                    <g style={{ animation: 'shrugArmL 30s ease-in-out infinite', transformOrigin: '38px 85px' }}>
                                        <path d="M38 85 L18 65" stroke="url(#alienGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />
                                        <circle cx="18" cy="65" r="4" fill="url(#alienGrad)" />
                                    </g>
                                    <g style={{ animation: 'shrugArmR 30s ease-in-out infinite 0.6s', transformOrigin: '82px 85px' }}>
                                        <path d="M82 85 L102 65" stroke="url(#alienGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />
                                        <circle cx="102" cy="65" r="4" fill="url(#alienGrad)" />
                                    </g>
                                    <path d="M50 120 L45 138" stroke="url(#alienGrad)" strokeWidth="4" strokeLinecap="round" />
                                    <path d="M70 120 L75 138" stroke="url(#alienGrad)" strokeWidth="4" strokeLinecap="round" />
                                    <path d="M48 30 Q40 10 35 8" stroke="url(#alienGrad)" strokeWidth="2" fill="none" />
                                    <circle cx="35" cy="8" r="3" fill="#FF6B35" />
                                    <path d="M72 30 Q80 10 85 8" stroke="url(#alienGrad)" strokeWidth="2" fill="none" />
                                    <circle cx="85" cy="8" r="3" fill="#E83F6F" />
                                    <defs>
                                        <linearGradient id="alienGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#22c55e" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Title + Iteration */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-4px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                            Optimizing Portfolio...
                        </div>
                        {shiftIteration > 0 && (
                            <div style={{
                                fontSize: '11px', fontWeight: '700',
                                padding: '2px 8px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                                color: 'white'
                            }}>
                                Pass {shiftIteration}
                            </div>
                        )}
                    </div>

                    {/* Stage Pipeline Map */}
                    <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        {(() => {
                            const stages = [
                                { label: 'Prep', pct: 2 },
                                { label: 'Score', pct: 5 },
                                { label: 'Assign', pct: 20 },
                                { label: 'Steal', pct: 40 },
                                { label: 'Moves', pct: 55 },
                                { label: '2-opt', pct: 65 },
                                { label: 'Timeline', pct: 75 },
                                { label: 'Relax', pct: 85 },
                                { label: 'Done', pct: 95 }
                            ];
                            const currentPct = optimizerProgress || 0;
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                                    {/* Connecting line */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '8px', right: '8px',
                                        height: '2px', background: isDark ? '#334155' : '#e2e8f0',
                                        transform: 'translateY(-50%)', zIndex: 0
                                    }} />
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '8px',
                                        height: '2px',
                                        background: 'linear-gradient(90deg, #22c55e, #06b6d4, #8b5cf6)',
                                        transform: 'translateY(-50%)', zIndex: 1,
                                        width: `${Math.min(currentPct, 100)}%`,
                                        transition: 'width 0.5s ease'
                                    }} />
                                    {stages.map((s, i) => {
                                        const isActive = currentPct >= s.pct;
                                        const isCurrent = currentPct >= s.pct && (i === stages.length - 1 || currentPct < stages[i + 1].pct);
                                        return (
                                            <div key={s.label} style={{
                                                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative'
                                            }}>
                                                <div style={{
                                                    width: isCurrent ? '12px' : '8px',
                                                    height: isCurrent ? '12px' : '8px',
                                                    borderRadius: '50%',
                                                    background: isActive
                                                        ? 'linear-gradient(135deg, #22c55e, #06b6d4)'
                                                        : (isDark ? '#334155' : '#cbd5e1'),
                                                    border: isCurrent ? '2px solid #22c55e' : 'none',
                                                    boxShadow: isCurrent ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                                                    animation: isCurrent ? 'alienBob 1s ease-in-out infinite' : 'none',
                                                    transition: 'all 0.3s ease'
                                                }} />
                                                <div style={{
                                                    fontSize: '7px', fontWeight: isCurrent ? '700' : '500',
                                                    color: isActive ? (isDark ? '#f1f5f9' : '#1e293b') : (isDark ? '#475569' : '#94a3b8'),
                                                    marginTop: '4px', textAlign: 'center',
                                                    whiteSpace: 'nowrap'
                                                }}>{s.label}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                        {/* Progress bar */}
                        <div style={{
                            width: '100%', height: '6px', borderRadius: '3px',
                            backgroundColor: isDark ? '#1e293b' : '#e2e8f0', overflow: 'hidden',
                            marginTop: '4px'
                        }}>
                            <div style={{
                                height: '100%', borderRadius: '3px',
                                background: 'linear-gradient(90deg, #22c55e, #06b6d4, #8b5cf6)',
                                width: `${optimizerProgress}%`,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{
                            fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b',
                            textAlign: 'center', fontWeight: '500',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '380px', marginTop: '2px'
                        }}>
                            {optimizerPhase || 'Preparing...'} — {optimizerProgress}%
                        </div>
                    </div>

                    {/* Project Grid */}
                    {totalProjectCount > 0 && (() => {
                        const currentFilled = Object.values(projectGrid).filter(s => s === 'filled').length;
                        peakFilledRef.current = Math.max(peakFilledRef.current, currentFilled);
                        const filledCount = peakFilledRef.current;
                        const gridCount = Math.max(totalProjectCount, Object.keys(projectGrid).length);
                        // Create array of project statuses for the grid
                        const gridItems = [];
                        const statusEntries = Object.entries(projectGrid);
                        for (let i = 0; i < gridCount; i++) {
                            if (i < statusEntries.length) {
                                gridItems.push(statusEntries[i][1]);
                            } else {
                                gridItems.push('grey');
                            }
                        }
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
                                    {filledCount}/{gridCount} projects resourced
                                </div>
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: '2px',
                                    maxWidth: '90%', width: '600px', justifyContent: 'center',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(241,245,249,0.8)',
                                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
                                }}>
                                    {gridItems.map((status, i) => (
                                        <div key={i} style={{
                                            width: '8px', height: '8px',
                                            borderRadius: '2px',
                                            backgroundColor: status === 'filled'
                                                ? '#22c55e'
                                                : status === 'partial'
                                                    ? '#f59e0b'
                                                    : isDark ? '#334155' : '#cbd5e1',
                                            transition: 'background-color 0.4s ease, transform 0.3s ease',
                                            transform: status === 'filled' ? 'scale(1.1)' : 'scale(1)',
                                            boxShadow: status === 'filled' ? '0 0 4px rgba(34,197,94,0.5)' : 'none'
                                        }} />
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── Analytics Loading Banner (shown after results while analytics compute) ── */}
            {analyticsPhase && !isRunning && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 16px', margin: '0 0 8px 0',
                    borderRadius: '10px',
                    background: isDark
                        ? 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(232,63,111,0.06))'
                        : 'linear-gradient(135deg, rgba(255,107,53,0.06), rgba(232,63,111,0.04))',
                    border: `1px solid ${isDark ? 'rgba(255,107,53,0.15)' : 'rgba(255,107,53,0.12)'}`,
                }}>
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes analyticsProgress {
                            0% { opacity: 0.4; transform: scaleX(0.3); transform-origin: left; }
                            50% { opacity: 1; transform: scaleX(1); transform-origin: left; }
                            100% { opacity: 0.4; transform: scaleX(0.3); transform-origin: right; }
                        }
                    `}</style>
                    <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        borderTopColor: '#FF6B35',
                        animation: 'spin 0.8s linear infinite',
                        flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: '12px', fontWeight: '600',
                            color: isDark ? '#f1f5f9' : '#334155',
                            marginBottom: '4px'
                        }}>
                            Building analytics...
                        </div>
                        <div style={{
                            width: '100%', height: '3px', borderRadius: '2px',
                            backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%', borderRadius: '2px',
                                background: 'linear-gradient(90deg, #FF6B35, #E83F6F)',
                                width: '100%',
                                animation: 'analyticsProgress 2s ease-in-out infinite'
                            }} />
                        </div>
                        <div style={{
                            fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b',
                            marginTop: '3px'
                        }}>
                            {analyticsPhase}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Configuration Panel (shown when no results) ── */}
            {(!results || showConfig) && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

                    {/* Section 1: Cornerstone Projects */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <span style={{ fontSize: '18px' }}>🏛️</span>
                            Cornerstone Projects
                            <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                Strategic migrations that must be protected
                            </span>
                        </div>

                        {/* Auto-suggested */}
                        {suggestedCornerstones.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '6px' }}>
                                    ✨ Suggested (click to select):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {suggestedCornerstones.map(c => (
                                        <span
                                            key={c}
                                            onClick={() => toggleCornerstone(c)}
                                            style={chipStyle(cornerstoneCustomers.includes(c), '#FF6B35', isDark)}
                                        >
                                            {cornerstoneCustomers.includes(c) ? '✓' : '+'} {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All customers dropdown */}
                        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '6px' }}>
                            All customers:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                            {uniqueCustomers.filter(c => !suggestedCornerstones.includes(c)).map(c => (
                                <span
                                    key={c}
                                    onClick={() => toggleCornerstone(c)}
                                    style={chipStyle(cornerstoneCustomers.includes(c), '#FF6B35', isDark)}
                                >
                                    {cornerstoneCustomers.includes(c) ? '✓' : '+'} {c}
                                </span>
                            ))}
                        </div>

                        {cornerstoneCustomers.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#FF6B35', fontWeight: '600' }}>
                                {cornerstoneCustomers.length} cornerstone{cornerstoneCustomers.length !== 1 ? 's' : ''} selected: {cornerstoneCustomers.join(', ')}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Tier 2 Priorities */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <span style={{ fontSize: '18px' }}>🤝</span>
                            Tier 2 Priorities
                            <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                Partner customers whose projects must be protected
                            </span>
                        </div>

                        {/* All customers as clickable chips */}
                        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '6px' }}>
                            Click to select partners:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                            {uniqueCustomers.map(c => (
                                <span
                                    key={c}
                                    onClick={() => togglePartner(c)}
                                    style={chipStyle(partnerCustomers.includes(c), '#2274A5', isDark)}
                                >
                                    {partnerCustomers.includes(c) ? '✓' : '+'} {c}
                                </span>
                            ))}
                        </div>

                        {partnerCustomers.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#2274A5', fontWeight: '600' }}>
                                {partnerCustomers.length} partner{partnerCustomers.length !== 1 ? 's' : ''} selected: {partnerCustomers.join(', ')}
                            </div>
                        )}
                    </div>

                    {/* Section 3: Concurrency & Constraints */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                            Constraints
                        </div>

                        {/* Current concurrent project counts (excludes cornerstone) */}
                        {(() => {
                            const now = new Date();
                            // Group projects by customer with date ranges
                            const customerProjects = {};
                            const cornerstoneSet = new Set((cornerstoneCustomers || []).map(c => c.toLowerCase().trim()));
                            eligibleProjects.forEach(p => {
                                const c = p.customer || 'Unknown';
                                if (!customerProjects[c]) customerProjects[c] = [];
                                customerProjects[c].push({
                                    start: new Date(p.start || p.kickOff || now),
                                    end: new Date(p.end || p.launch || now)
                                });
                            });

                            // Calculate peak concurrent for each customer
                            const peakConcurrent = {};
                            let totalActive = 0;
                            for (const [customer, projs] of Object.entries(customerProjects)) {
                                // Count projects overlapping with "now" as the active count
                                const activeNow = projs.filter(p => p.start <= now && p.end >= now).length;
                                // Peak: find max overlapping at any point
                                const events = [];
                                projs.forEach(p => {
                                    events.push({ date: p.start.getTime(), delta: 1 });
                                    events.push({ date: p.end.getTime(), delta: -1 });
                                });
                                events.sort((a, b) => a.date - b.date || a.delta - b.delta);
                                let running = 0, peak = 0;
                                events.forEach(e => { running += e.delta; if (running > peak) peak = running; });
                                peakConcurrent[customer] = { peak, active: activeNow, total: projs.length };
                                totalActive += activeNow;
                            }

                            // Split by cornerstone vs non-cornerstone
                            const isCS = (c) => cornerstoneSet.has(c.toLowerCase().trim());
                            const nonCS = Object.entries(peakConcurrent).filter(([c]) => !isCS(c)).sort((a, b) => b[1].peak - a[1].peak);
                            const csEntries = Object.entries(peakConcurrent).filter(([c]) => isCS(c)).sort((a, b) => b[1].peak - a[1].peak);

                            return (
                                <div style={{
                                    marginBottom: '14px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#f0f9ff',
                                    border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe'}`
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        marginBottom: '8px'
                                    }}>
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                            Concurrent Projects
                                            <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px', fontWeight: '400' }}>
                                                (peak overlap / active now)
                                            </span>
                                        </span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: '700',
                                            background: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                                            color: isDark ? '#93c5fd' : '#1d4ed8',
                                            padding: '2px 8px', borderRadius: '6px'
                                        }}>
                                            {totalActive} active now
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {nonCS.map(([customer, { peak, active }]) => (
                                            <span key={customer} style={{
                                                fontSize: '10px', padding: '2px 7px', borderRadius: '6px',
                                                backgroundColor: peak >= (maxCountries || 10)
                                                    ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')
                                                    : (isDark ? 'rgba(148,163,184,0.1)' : '#f1f5f9'),
                                                color: peak >= (maxCountries || 10)
                                                    ? (isDark ? '#fca5a5' : '#dc2626')
                                                    : (isDark ? '#94a3b8' : '#475569'),
                                                border: `1px solid ${peak >= (maxCountries || 10) ? (isDark ? '#7f1d1d' : '#fecaca') : (isDark ? '#334155' : '#e2e8f0')}`,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {customer} <strong>{peak}</strong>
                                                {active > 0 && <span style={{ opacity: 0.6 }}> ({active})</span>}
                                            </span>
                                        ))}
                                    </div>
                                    {csEntries.length > 0 && (
                                        <div style={{ marginTop: '6px' }}>
                                            <span style={{ fontSize: '9px', color: isDark ? '#fbbf24' : '#d97706', fontWeight: '600' }}>
                                                CORNERSTONE (exempt)
                                            </span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                                                {csEntries.map(([customer, { peak, active }]) => (
                                                    <span key={customer} style={{
                                                        fontSize: '10px', padding: '2px 7px', borderRadius: '6px',
                                                        backgroundColor: isDark ? 'rgba(251,191,36,0.08)' : '#fffbeb',
                                                        color: isDark ? '#fbbf24' : '#92400e',
                                                        border: `1px solid ${isDark ? 'rgba(251,191,36,0.2)' : '#fde68a'}`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {customer} <strong>{peak}</strong>
                                                        {active > 0 && <span style={{ opacity: 0.6 }}> ({active})</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Min Countries per Customer
                                </div>
                                <input
                                    type="number"
                                    value={minCountries}
                                    onChange={e => setMinCountries(Math.max(0, parseInt(e.target.value) || 0))}
                                    min={0}
                                    style={numberInputStyle(isDark)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Ideal Max Concurrent Countries
                                </div>
                                <input
                                    type="number"
                                    value={maxCountries}
                                    onChange={e => setMaxCountries(Math.max(1, parseInt(e.target.value) || 1))}
                                    min={1}
                                    style={numberInputStyle(isDark)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Constraint Horizon
                                    <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px' }}>
                                        (limits apply before this date)
                                    </span>
                                </div>
                                <input
                                    type="date"
                                    value={constraintHorizon}
                                    onChange={e => setConstraintHorizon(e.target.value)}
                                    style={{
                                        ...numberInputStyle(isDark),
                                        width: '140px',
                                        fontSize: '11px'
                                    }}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Min cARR Threshold (£)
                                </div>
                                <input
                                    type="number"
                                    value={minCarr}
                                    onChange={e => setMinCarr(Math.max(0, parseInt(e.target.value) || 0))}
                                    min={0}
                                    style={numberInputStyle(isDark)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Cornerstone Shift Limit (weeks)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="number"
                                        value={cornerstoneMaxShift}
                                        onChange={e => setCornerstoneMaxShift(Math.max(0, parseInt(e.target.value) || 0))}
                                        min={0}
                                        style={numberInputStyle(isDark)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>Exclude after</span>
                                        <input
                                            type="date"
                                            value={cornerstoneShiftExcludeAfter}
                                            onChange={e => setCornerstoneShiftExcludeAfter(e.target.value)}
                                            style={{
                                                ...numberInputStyle(isDark),
                                                width: '120px',
                                                fontSize: '10px',
                                                padding: '5px 6px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Default Shift Limit (weeks)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="number"
                                        value={defaultMaxShift}
                                        onChange={e => setDefaultMaxShift(Math.max(0, parseInt(e.target.value) || 0))}
                                        min={0}
                                        style={numberInputStyle(isDark)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>Exclude after</span>
                                        <input
                                            type="date"
                                            value={defaultShiftExcludeAfter}
                                            onChange={e => setDefaultShiftExcludeAfter(e.target.value)}
                                            style={{
                                                ...numberInputStyle(isDark),
                                                width: '120px',
                                                fontSize: '10px',
                                                padding: '5px 6px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Max SC per Project
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="number"
                                        value={maxSC}
                                        onChange={e => setMaxSC(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                                        min={1}
                                        max={5}
                                        style={numberInputStyle(isDark)}
                                    />
                                    {maxSC > 2 && <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: '600' }}>Exception</span>}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Max PD per Project
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="number"
                                        value={maxPD}
                                        onChange={e => setMaxPD(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                                        min={1}
                                        max={5}
                                        style={numberInputStyle(isDark)}
                                    />
                                    {maxPD > 2 && <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: '600' }}>Exception</span>}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    Max Concurrent Projects
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="number"
                                        value={maxConcurrentProjects}
                                        onChange={e => setMaxConcurrentProjects(Math.max(1, Math.min(20, parseInt(e.target.value) || 8)))}
                                        min={1}
                                        max={20}
                                        style={numberInputStyle(isDark)}
                                    />
                                    <span style={{ fontSize: '9px', color: isDark ? '#475569' : '#94a3b8' }}>per person</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4a2: Scoring Tuning */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
                            Scoring Tuning
                            <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                Tier ranges & in-flight protection
                            </span>
                        </div>

                        {/* Tier Score Ranges Reference */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                            gap: '6px',
                            marginBottom: '12px'
                        }}>
                            {[
                                { label: 'Cornerstone', range: '90–100', color: '#ef4444', tier: 1 },
                                { label: 'Tier 2', range: '80–89', color: '#f97316', tier: 2 },
                                { label: 'High Risk', range: '80–88', color: '#f59e0b', tier: 2 },
                                { label: 'Verbal Risk', range: '70–79', color: '#eab308', tier: 2 },
                                { label: 'Medium Risk', range: '65–74', color: '#84cc16', tier: 2 },
                                { label: 'Compelling', range: '80–88', color: '#22c55e', tier: 2 },
                                { label: 'Standard', range: '30–54', color: '#3b82f6', tier: 4 },
                                { label: 'Below Min', range: '0–29', color: '#6b7280', tier: 5 }
                            ].map(t => (
                                <div key={t.label} style={{
                                    padding: '6px 8px',
                                    borderRadius: '8px',
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: t.color, flexShrink: 0
                                    }} />
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#374151' }}>
                                            {t.label}
                                        </div>
                                        <div style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}>
                                            {t.range} pts
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Editable In-Flight Settings */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    In-Flight Score Bonus (pts)
                                </div>
                                <input
                                    type="number"
                                    value={inFlightBonus}
                                    onChange={e => setInFlightBonus(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                                    min={0}
                                    max={20}
                                    style={numberInputStyle(isDark)}
                                />
                                <div style={{ fontSize: '9px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '2px' }}>
                                    Bonus added to projects already in progress
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                    In-Flight Max Shift (weeks)
                                </div>
                                <input
                                    type="number"
                                    value={inFlightMaxShift}
                                    onChange={e => setInFlightMaxShift(Math.max(0, Math.min(26, parseInt(e.target.value) || 0)))}
                                    min={0}
                                    max={26}
                                    style={numberInputStyle(isDark)}
                                />
                                <div style={{ fontSize: '9px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '2px' }}>
                                    Max date shift for in-flight projects
                                </div>
                            </div>
                        </div>

                        {/* Contract ARR Blending */}
                        <div style={{
                            marginTop: '10px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f0f9ff',
                            border: `1px solid ${isDark ? '#1e3a5f' : '#bae6fd'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                    Contract ARR Weight
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'monospace', color: isDark ? '#7dd3fc' : '#0284c7' }}>
                                    {Math.round((1 - contractArrWeight) * 100)}% project / {Math.round(contractArrWeight * 100)}% contract
                                </div>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={50}
                                value={Math.round(contractArrWeight * 100)}
                                onChange={e => setContractArrWeight(parseInt(e.target.value) / 100)}
                                style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#94a3b8', marginTop: '2px' }}>
                                <span>100% project cARR</span>
                                <span>50/50 blend</span>
                            </div>
                            <div style={{ fontSize: '9px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '4px' }}>
                                Blends contract-level ARR into scoring so small-country projects of large contracts are not unfairly deprioritised. Only applies when Contract ARR field is mapped.
                            </div>
                        </div>

                        {/* New Business Reserve */}
                        <div style={{
                            marginTop: '10px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fefce8',
                            border: `1px solid ${isDark ? '#4d3800' : '#fde68a'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                    📦 New Business Reserve
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'monospace', color: isDark ? '#fbbf24' : '#d97706' }}>
                                    {newBusinessReserve}% reserved
                                </div>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={30}
                                value={newBusinessReserve}
                                onChange={e => setNewBusinessReserve(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#d97706', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#94a3b8', marginTop: '2px' }}>
                                <span>0% (all capacity for projects)</span>
                                <span>30% max reserve</span>
                            </div>
                            <div style={{ fontSize: '9px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '4px' }}>
                                Reserves a % of capacity evenly across all squads for unsold new business. Reserved slots are unavailable during reprioritisation.
                            </div>
                        </div>
                    </div>

                    {/* Section 4b: Squad Preferences & Optimization Settings */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <span style={{ fontSize: '18px' }}>🧠</span>
                            Squad Preferences & Optimization
                            <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                Advanced solver configuration
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            {/* Seed from current toggle */}
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={seedFromCurrent}
                                        onChange={e => setSeedFromCurrent(e.target.checked)}
                                        style={{ width: '16px', height: '16px', accentColor: '#FF6B35' }}
                                    />
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                            Seed from Current Assignments
                                        </div>
                                        <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                            Preserve existing PM/SC/PD unless a better fit is found
                                        </div>
                                    </div>
                                </label>
                                {seedFromCurrent && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', paddingLeft: '24px' }}>
                                        <input
                                            type="checkbox"
                                            checked={seedInFlightOnly}
                                            onChange={e => setSeedInFlightOnly(e.target.checked)}
                                            style={{ width: '14px', height: '14px', accentColor: '#FF6B35' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                In-Flight Only
                                            </div>
                                            <div style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                Only preserve allocations on kicked-off projects; future projects planned from scratch
                                            </div>
                                        </div>
                                    </label>
                                )}
                            </div>

                            {/* Seed from Draft toggle */}
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                backgroundColor: seedFromDraft ? (isDark ? '#1e1338' : '#faf5ff') : (isDark ? '#0f172a' : '#f8fafc'),
                                border: `1px solid ${seedFromDraft ? '#7637E3' : (isDark ? '#334155' : '#e2e8f0')}`,
                                transition: 'all 0.2s'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={seedFromDraft}
                                        onChange={e => { setSeedFromDraft(e.target.checked); if (!e.target.checked) setSeedDraftId(''); }}
                                        style={{ width: '16px', height: '16px', accentColor: '#7637E3' }}
                                    />
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                            📋 Seed from Draft Scenario
                                        </div>
                                        <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                            Use a saved draft's dates, effort & squads as the optimizer starting point
                                        </div>
                                    </div>
                                </label>
                                {seedFromDraft && (
                                    <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                                        {draftScenarios.length === 0 ? (
                                            <div style={{ fontSize: '10px', color: '#f59e0b', fontStyle: 'italic' }}>
                                                No draft scenarios with changes found. Create a draft first.
                                            </div>
                                        ) : (
                                            <>
                                                <select
                                                    value={seedDraftId}
                                                    onChange={e => setSeedDraftId(e.target.value)}
                                                    style={{
                                                        ...inputStyle(isDark),
                                                        fontSize: '11px',
                                                        padding: '6px 10px',
                                                        borderColor: seedDraftId ? '#7637E3' : (isDark ? '#475569' : '#d1d5db')
                                                    }}
                                                >
                                                    <option value="">Select a draft scenario…</option>
                                                    {draftScenarios.map(s => {
                                                        const changeCount = Object.keys(s.changes?.projects || {}).length;
                                                        return (
                                                            <option key={s.id} value={s.id}>
                                                                {s.name} ({changeCount} project change{changeCount !== 1 ? 's' : ''})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {seedDraftId && (() => {
                                                    const draft = draftScenarios.find(s => s.id === seedDraftId);
                                                    if (!draft) return null;
                                                    const changes = draft.changes?.projects || {};
                                                    const changeCount = Object.keys(changes).length;
                                                    const dateChanges = Object.values(changes).filter(c => c.kickOff || c.launch || c.start || c.end).length;
                                                    const effortChanges = Object.values(changes).filter(c => c.pmVal !== undefined || c.scVal !== undefined || c.pdVal !== undefined).length;
                                                    const squadChanges = Object.values(changes).filter(c => c.squad || c.squads).length;
                                                    return (
                                                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(118,55,227,0.15)' : '#f3e8ff', color: '#7637E3' }}>
                                                                {changeCount} projects modified
                                                            </span>
                                                            {dateChanges > 0 && <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fefce8', color: '#d97706' }}>📅 {dateChanges} date shifts</span>}
                                                            {effortChanges > 0 && <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: '#3b82f6' }}>⚡ {effortChanges} effort changes</span>}
                                                            {squadChanges > 0 && <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(0,189,0,0.15)' : '#f0fdf4', color: '#00BD00' }}>👥 {squadChanges} squad moves</span>}
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Per-country squad affinity */}
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            marginBottom: '12px'
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '2px' }}>
                                🌍 One Squad per Country
                            </div>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                Each country is delivered by one squad; different countries may use different squads
                            </div>
                        </div>

                        {/* Squad Specialization Configuration */}
                        <div style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '10px' }}>
                                Squad Specializations
                                <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px' }}>— type comma-separated values per squad</span>
                            </div>
                            {(() => {
                                const allSquads = new Set();
                                resources.forEach(r => (r.squads || []).forEach(s => allSquads.add(s)));
                                return [...allSquads].sort().map(squad => {
                                    const spec = squadSpecializations[squad] || {};
                                    const hasData = (spec.countries?.length > 0) || (spec.platforms?.length > 0);
                                    const isExpanded = expandedSpecSquads.has(squad);
                                    const countryCount = (spec.countries || []).length;
                                    const platformCount = (spec.platforms || []).length;
                                    return (
                                        <div key={squad} style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            marginBottom: '6px',
                                            backgroundColor: isDark
                                                ? (hasData ? 'rgba(139,92,246,0.06)' : 'transparent')
                                                : (hasData ? '#faf5ff' : 'transparent'),
                                            border: hasData
                                                ? `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe'}`
                                                : `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                            transition: 'all 0.2s'
                                        }}>
                                            <div
                                                onClick={() => setExpandedSpecSquads(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(squad)) next.delete(squad); else next.add(squad);
                                                    return next;
                                                })}
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: isDark ? '#e2e8f0' : '#334155',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', color: isDark ? '#64748b' : '#94a3b8' }}>▶</span>
                                                {squad}
                                                {hasData && (
                                                    <span style={{
                                                        fontSize: '8px', fontWeight: '600', padding: '1px 5px',
                                                        borderRadius: '4px', backgroundColor: 'rgba(139,92,246,0.12)',
                                                        color: '#8b5cf6'
                                                    }}>configured</span>
                                                )}
                                                {!isExpanded && hasData && (
                                                    <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8', fontWeight: '400', marginLeft: 'auto' }}>
                                                        {countryCount > 0 ? `${countryCount} countries` : ''}{countryCount > 0 && platformCount > 0 ? ' · ' : ''}{platformCount > 0 ? `${platformCount} platforms` : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {isExpanded && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            🌍 Countries
                                                            <span style={{ fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4', color: isDark ? '#86efac' : '#16a34a', border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : '#bbf7d0'}`, textTransform: 'none', letterSpacing: '0' }}>Preference</span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', minHeight: '26px' }}>
                                                            {distinctCountries.length === 0 ? (
                                                                <span style={{ fontSize: '10px', color: isDark ? '#475569' : '#cbd5e1', fontStyle: 'italic' }}>No country data on projects</span>
                                                            ) : distinctCountries.map(c => {
                                                                const selected = (spec.countries || []).includes(c);
                                                                return (
                                                                    <span
                                                                        key={c}
                                                                        onClick={() => setSquadSpecializations(prev => {
                                                                            const cur = prev[squad]?.countries || [];
                                                                            const next = selected ? cur.filter(x => x !== c) : [...cur, c];
                                                                            return { ...prev, [squad]: { ...prev[squad], countries: next } };
                                                                        })}
                                                                        style={{
                                                                            fontSize: '10px', fontWeight: '600',
                                                                            padding: '2px 7px', borderRadius: '4px',
                                                                            cursor: 'pointer', userSelect: 'none',
                                                                            transition: 'all 0.15s',
                                                                            backgroundColor: selected
                                                                                ? (isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe')
                                                                                : (isDark ? '#1e293b' : '#f1f5f9'),
                                                                            color: selected
                                                                                ? (isDark ? '#c4b5fd' : '#7c3aed')
                                                                                : (isDark ? '#64748b' : '#94a3b8'),
                                                                            border: `1px solid ${selected
                                                                                ? (isDark ? 'rgba(139,92,246,0.3)' : '#c4b5fd')
                                                                                : (isDark ? '#334155' : '#e2e8f0')}`
                                                                        }}
                                                                    >{c}</span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            💻 Platforms
                                                            <span style={{ fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : '#fecaca'}`, textTransform: 'none', letterSpacing: '0' }}>Required</span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', minHeight: '26px' }}>
                                                            {distinctPlatforms.length === 0 ? (
                                                                <span style={{ fontSize: '10px', color: isDark ? '#475569' : '#cbd5e1', fontStyle: 'italic' }}>No platform data on projects</span>
                                                            ) : distinctPlatforms.map(p => {
                                                                const selected = (spec.platforms || []).includes(p);
                                                                return (
                                                                    <span
                                                                        key={p}
                                                                        onClick={() => setSquadSpecializations(prev => {
                                                                            const cur = prev[squad]?.platforms || [];
                                                                            const next = selected ? cur.filter(x => x !== p) : [...cur, p];
                                                                            return { ...prev, [squad]: { ...prev[squad], platforms: next } };
                                                                        })}
                                                                        style={{
                                                                            fontSize: '10px', fontWeight: '600',
                                                                            padding: '2px 7px', borderRadius: '4px',
                                                                            cursor: 'pointer', userSelect: 'none',
                                                                            transition: 'all 0.15s',
                                                                            backgroundColor: selected
                                                                                ? (isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe')
                                                                                : (isDark ? '#1e293b' : '#f1f5f9'),
                                                                            color: selected
                                                                                ? (isDark ? '#93c5fd' : '#2563eb')
                                                                                : (isDark ? '#64748b' : '#94a3b8'),
                                                                            border: `1px solid ${selected
                                                                                ? (isDark ? 'rgba(59,130,246,0.3)' : '#93c5fd')
                                                                                : (isDark ? '#334155' : '#e2e8f0')}`
                                                                        }}
                                                                    >{p}</span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Customer → Squad Seed Assignments */}
                        <div style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            marginTop: '12px'
                        }}>
                            <div
                                onClick={() => setExpandedSpecSquads(prev => {
                                    const next = new Set(prev);
                                    if (next.has('__customerSeeds')) next.delete('__customerSeeds'); else next.add('__customerSeeds');
                                    return next;
                                })}
                                style={{
                                    fontSize: '11px', fontWeight: '700',
                                    color: isDark ? '#e2e8f0' : '#334155',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer', userSelect: 'none'
                                }}
                            >
                                <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: expandedSpecSquads.has('__customerSeeds') ? 'rotate(90deg)' : 'rotate(0deg)', color: isDark ? '#64748b' : '#94a3b8' }}>▶</span>
                                🎯 Customer → Squad Seeds
                                {Object.keys(customerSquadSeeds).length > 0 && (
                                    <span style={{ fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                                        {Object.keys(customerSquadSeeds).length} seeded
                                    </span>
                                )}
                                <span style={{ fontSize: '9px', fontWeight: '400', color: isDark ? '#475569' : '#94a3b8', marginLeft: 'auto' }}>
                                    Pre-assign customers to squads
                                </span>
                            </div>
                            {expandedSpecSquads.has('__customerSeeds') && (
                                <div style={{ marginTop: '10px' }}>
                                    {/* Search filter */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search customers..."
                                            id="customer-seed-search"
                                            onChange={e => {
                                                const el = document.getElementById('customer-seed-list');
                                                if (el) el.dataset.filter = e.target.value.toLowerCase();
                                                // Force re-render via a state update
                                                setCustomerSquadSeeds(prev => ({ ...prev }));
                                            }}
                                            style={{
                                                flex: 1, padding: '6px 10px', fontSize: '11px',
                                                borderRadius: '6px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                backgroundColor: isDark ? '#1e293b' : '#fff',
                                                color: isDark ? '#f1f5f9' : '#1e293b',
                                                outline: 'none'
                                            }}
                                        />
                                        {Object.keys(customerSquadSeeds).length > 0 && (
                                            <button
                                                onClick={() => setCustomerSquadSeeds({})}
                                                style={{
                                                    padding: '5px 10px', fontSize: '10px', fontWeight: '600',
                                                    borderRadius: '6px', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
                                                    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                                                    color: isDark ? '#fca5a5' : '#dc2626',
                                                    cursor: 'pointer'
                                                }}
                                            >Clear All</button>
                                        )}
                                    </div>
                                    {/* Customer list */}
                                    <div id="customer-seed-list" data-filter="" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {uniqueCustomers.filter(cust => {
                                            const filterEl = document.getElementById('customer-seed-search');
                                            const filterVal = filterEl?.value?.toLowerCase() || '';
                                            return !filterVal || cust.toLowerCase().includes(filterVal);
                                        }).map(cust => {
                                            const seededSquad = customerSquadSeeds[cust] || '';
                                            return (
                                                <div key={cust} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '4px 8px', borderRadius: '6px',
                                                    backgroundColor: seededSquad
                                                        ? (isDark ? 'rgba(99,102,241,0.06)' : '#eef2ff')
                                                        : 'transparent',
                                                    border: seededSquad
                                                        ? `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : '#c7d2fe'}`
                                                        : '1px solid transparent'
                                                }}>
                                                    <span style={{
                                                        flex: 1, fontSize: '11px', fontWeight: seededSquad ? '600' : '400',
                                                        color: seededSquad ? (isDark ? '#c7d2fe' : '#4338ca') : (isDark ? '#94a3b8' : '#64748b'),
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>{cust}</span>
                                                    <select
                                                        value={seededSquad}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setCustomerSquadSeeds(prev => {
                                                                const next = { ...prev };
                                                                if (val) next[cust] = val;
                                                                else delete next[cust];
                                                                return next;
                                                            });
                                                        }}
                                                        style={{
                                                            padding: '3px 6px', fontSize: '10px', fontWeight: '600',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                            backgroundColor: isDark ? '#1e293b' : '#fff',
                                                            color: seededSquad ? (isDark ? '#a5b4fc' : '#4f46e5') : (isDark ? '#64748b' : '#94a3b8'),
                                                            cursor: 'pointer', minWidth: '120px'
                                                        }}
                                                    >
                                                        <option value="">Auto</option>
                                                        {uniqueSquads.map(sq => (
                                                            <option key={sq} value={sq}>{sq}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Solver Stats Badge */}
                        {solverResult && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: isDark
                                    ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1))'
                                    : 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08))',
                                border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '8px'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>
                                        {solverResult.solverMeta?.startingStrategy === 'score_ordered' ? '●' :
                                            solverResult.solverMeta?.startingStrategy === 'customer_grouped' ? '◆' : '▣'}
                                    </div>
                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                        {solverResult.strategies?.find(s => s.isWinner)?.label || 'Best Strategy'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6' }}>
                                        +{solverResult.solverMeta?.improvementPct || 0}%
                                    </div>
                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>Improvement</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155' }}>
                                        {solverResult.solverMeta?.totalDurationMs || 0}ms
                                    </div>
                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>Duration</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>
                                        {(solverResult.solverMeta?.accepted || 0) + (solverResult.solverMeta?.rejected || 0)}
                                    </div>
                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>Iterations</div>
                                </div>
                            </div>
                        )}

                        {/* ── Optimizer Results Summary Panel ── */}
                        {results && solverResult && (() => {
                            const sched = results.scheduled || [];
                            const def = results.deferred || [];
                            const warns = results.warnings || [];

                            // Fill rate
                            let totalRoles = 0, filledRoles = 0, crossSquadCount = 0;
                            const unfilledByRole = {};
                            sched.forEach(p => {
                                (p.assignments || []).forEach(a => {
                                    totalRoles++;
                                    if (a.resourceId) {
                                        filledRoles++;
                                        if (a.isCrossSquad) crossSquadCount++;
                                    } else {
                                        const r = (a.role || '').replace(/ \(\d+\/\d+\)/, '');
                                        unfilledByRole[r] = (unfilledByRole[r] || 0) + 1;
                                    }
                                });
                            });
                            const fillRate = totalRoles > 0 ? Math.round(filledRoles / totalRoles * 100) : 0;
                            const fullyResourced = sched.filter(p => p.assignments?.length > 0 && p.assignments.every(a => a.resourceId)).length;

                            // Top unfilled roles
                            const topUnfilled = Object.entries(unfilledByRole).sort((a, b) => b[1] - a[1]).slice(0, 3);

                            // Customer impact
                            const custImpact = {};
                            sched.forEach(p => {
                                const c = p.customer || 'Unknown';
                                if (!custImpact[c]) custImpact[c] = { scheduled: 0, arr: 0 };
                                custImpact[c].scheduled++;
                                custImpact[c].arr += (p.arr || 0);
                            });
                            const topCustomers = Object.entries(custImpact)
                                .sort((a, b) => b[1].arr - a[1].arr).slice(0, 5);

                            // Cascade & shift stats
                            const cascaded = sched.filter(p => (p.schedulingNote || '').includes('Cascaded'));
                            const shifted = sched.filter(p => (p.shiftWeeks || 0) > 0);
                            const avgShift = shifted.length > 0
                                ? (shifted.reduce((s, p) => s + (p.shiftWeeks || 0), 0) / shifted.length).toFixed(1)
                                : 0;

                            const statBox = (label, value, color, sub) => (
                                <div style={{ textAlign: 'center', padding: '8px 4px' }}>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color, lineHeight: 1.1 }}>{value}</div>
                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>{label}</div>
                                    {sub && <div style={{ fontSize: '8px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '1px' }}>{sub}</div>}
                                </div>
                            );

                            return (
                                <div style={{
                                    marginTop: '12px', borderRadius: '12px',
                                    background: isDark
                                        ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))'
                                        : 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))',
                                    border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        padding: '10px 14px 6px', fontWeight: '700', fontSize: '12px',
                                        color: isDark ? '#c4b5fd' : '#6366f1',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Results Summary
                                    </div>

                                    {/* Row 1: Key metrics */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '0 10px' }}>
                                        {statBox('Fill Rate', `${fillRate}%`, fillRate >= 80 ? '#22c55e' : fillRate >= 50 ? '#f59e0b' : '#ef4444', `${filledRoles}/${totalRoles} roles`)}
                                        {statBox('Scheduled', sched.length, '#3b82f6', `${fullyResourced} fully resourced`)}
                                        {statBox('Deferred', def.length, def.length > 0 ? '#f59e0b' : '#22c55e')}
                                        {statBox('Cross-Squad', crossSquadCount, '#8b5cf6', crossSquadCount > 0 ? 'fallback fills' : '')}
                                    </div>

                                    {/* Row 2: Shift & Cascade */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '0 10px' }}>
                                        {statBox('Shifted', shifted.length, isDark ? '#e2e8f0' : '#334155', shifted.length > 0 ? `avg +${avgShift}w` : '')}
                                        {statBox('Cascaded', cascaded.length, cascaded.length > 0 ? '#06b6d4' : (isDark ? '#e2e8f0' : '#334155'), cascaded.length > 0 ? 'rollout sequence' : '')}
                                        {statBox('Warnings', warns.length, warns.length > 5 ? '#ef4444' : (isDark ? '#e2e8f0' : '#334155'))}
                                    </div>

                                    {/* Top unfilled roles */}
                                    {topUnfilled.length > 0 && (
                                        <div style={{ padding: '6px 14px 8px', borderTop: `1px solid ${isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'}` }}>
                                            <div style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                                TOP UNFILLED ROLES
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {topUnfilled.map(([role, count]) => (
                                                    <span key={role} style={{
                                                        fontSize: '10px', padding: '2px 8px', borderRadius: '8px',
                                                        background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                                                        color: '#ef4444', fontWeight: '600'
                                                    }}>{role}: {count}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Top customers by ARR */}
                                    {topCustomers.length > 0 && (
                                        <div style={{ padding: '6px 14px 10px', borderTop: `1px solid ${isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'}` }}>
                                            <div style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                                CUSTOMER IMPACT (BY ARR)
                                            </div>
                                            {topCustomers.map(([name, data]) => (
                                                <div key={name} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    fontSize: '10px', padding: '2px 0',
                                                    color: isDark ? '#e2e8f0' : '#334155'
                                                }}>
                                                    <span style={{ fontWeight: '600' }}>{name}</span>
                                                    <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                                                        {data.scheduled} projects · £{(data.arr || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                    </div>

                    {/* Section: Squad Exclusion */}
                    {uniqueSquads.length > 0 && (
                        <div style={sectionCard(isDark)}>
                            <div style={sectionTitle(isDark)}>
                                <span>🚫</span>
                                Exclude Squads from Allocation
                                {excludedSquads.length > 0 && (
                                    <span style={{
                                        fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                                        borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.12)',
                                        color: '#ef4444'
                                    }}>{excludedSquads.length} excluded</span>
                                )}
                            </div>
                            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '10px' }}>
                                Members of excluded squads will not be assigned to any projects by the optimizer.
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {uniqueSquads.map(squad => {
                                    const isExcluded = excludedSquads.includes(squad);
                                    const memberCount = resources.filter(r => (r.squads || []).includes(squad)).length;
                                    return (
                                        <label key={squad} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '11px', fontWeight: '600', transition: 'all 0.2s',
                                            backgroundColor: isExcluded
                                                ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2')
                                                : (isDark ? '#0f172a' : '#f8fafc'),
                                            border: `1px solid ${isExcluded
                                                ? (isDark ? 'rgba(239,68,68,0.3)' : '#fecaca')
                                                : (isDark ? '#334155' : '#e2e8f0')}`,
                                            color: isExcluded ? '#ef4444' : (isDark ? '#e2e8f0' : '#334155')
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={isExcluded}
                                                onChange={() => {
                                                    setExcludedSquads(prev =>
                                                        isExcluded
                                                            ? prev.filter(s => s !== squad)
                                                            : [...prev, squad]
                                                    );
                                                }}
                                                style={{ accentColor: '#ef4444' }}
                                            />
                                            {isExcluded && <span style={{ textDecoration: 'line-through' }}>{squad}</span>}
                                            {!isExcluded && <span>{squad}</span>}
                                            <span style={{
                                                fontSize: '9px', opacity: 0.6, fontWeight: '500'
                                            }}>({memberCount})</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {excludedSquads.length > 0 && (
                                <button
                                    onClick={() => setExcludedSquads([])}
                                    style={{
                                        marginTop: '8px', padding: '4px 10px', fontSize: '10px',
                                        fontWeight: '600', border: 'none', borderRadius: '6px',
                                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >Clear all</button>
                            )}
                        </div>
                    )}

                    {/* Section: Program Teams Pre-Assignment */}
                    {programCustomers.length > 0 && (
                        <div style={sectionCard(isDark)}>
                            <div style={sectionTitle(isDark)}>
                                <span>🏗️</span>
                                Program Teams
                                <span style={{
                                    fontSize: '9px', fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b',
                                    marginLeft: '4px'
                                }}>
                                    — pre-assign senior resources before solver runs
                                </span>
                            </div>

                            {programCustomers.map(customer => {
                                const demand = programDemand[customer];
                                const assignments = localProgramAssignments.filter(a => a.customer === customer);
                                const workstreams = demand?.workstreams || [];

                                return (
                                    <div key={customer} style={{
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        marginBottom: '10px',
                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                    }}>
                                        {/* Customer header — click to open program modal */}
                                        <div
                                            onClick={() => onOpenProgramModal && onOpenProgramModal(customer)}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: onOpenProgramModal ? 'pointer' : 'default', borderRadius: '8px', padding: '4px 6px', margin: '-4px -6px 10px', transition: 'background-color 0.15s' }}
                                            onMouseEnter={e => { if (onOpenProgramModal) e.currentTarget.style.backgroundColor = isDark ? 'rgba(0,189,0,0.08)' : '#f0fdf4'; }}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '13px', fontWeight: '700',
                                                    color: isDark ? '#f1f5f9' : '#1e293b'
                                                }}>{customer}</span>
                                                <span style={{
                                                    fontSize: '9px', fontWeight: '600', padding: '2px 6px',
                                                    borderRadius: '4px', backgroundColor: '#ecfdf5',
                                                    color: '#047857'
                                                }}>Program</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                    {demand?.projectCount || 0} projects
                                                </span>
                                                <span style={{
                                                    fontSize: '12px', fontWeight: '700', color: '#00BD00'
                                                }}>
                                                    {formatNumber(Math.round(demand?.totalHours || 0))}h
                                                </span>
                                            </div>
                                        </div>

                                        {/* Workstream rows */}
                                        {workstreams.filter(ws => ws.hours > 0).map(ws => {
                                            const wsAssignments = assignments.filter(a => a.workstream === ws.name);
                                            const assignedResourceIds = wsAssignments.map(a => a.resourceId);
                                            const availableResources = resources.filter(r => r.name && !assignedResourceIds.includes(r.id));

                                            return (
                                                <div key={ws.name} style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '8px',
                                                    marginBottom: '6px',
                                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                                    border: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`
                                                }}>
                                                    {/* Workstream header */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: wsAssignments.length > 0 ? '6px' : '0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                backgroundColor: '#00BD00', boxShadow: '0 0 0 2px #d1fae5'
                                                            }}></div>
                                                            <span style={{
                                                                fontSize: '11px', fontWeight: '700',
                                                                color: isDark ? '#e2e8f0' : '#334155'
                                                            }}>{ws.name}</span>
                                                            <span style={{
                                                                fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8'
                                                            }}>{Math.round(ws.hours)}h · {ws.allocationPct}%</span>
                                                        </div>

                                                        {/* Assign dropdown */}
                                                        <div style={{ position: 'relative' }}>
                                                            <select
                                                                value=""
                                                                onChange={e => {
                                                                    if (!e.target.value) return;
                                                                    const newAssignment = {
                                                                        id: `pa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                                                        workstream: ws.name,
                                                                        customer,
                                                                        resourceId: e.target.value,
                                                                        startDate: null,
                                                                        endDate: null,
                                                                        allocationPct: 100
                                                                    };
                                                                    setLocalProgramAssignments(prev => [...prev, newAssignment]);
                                                                }}
                                                                style={{
                                                                    appearance: 'none',
                                                                    padding: '4px 22px 4px 8px',
                                                                    borderRadius: '6px',
                                                                    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                                                    backgroundColor: isDark ? '#0f172a' : 'white',
                                                                    fontSize: '10px', fontWeight: '600',
                                                                    color: isDark ? '#94a3b8' : '#64748b',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <option value="">+ Assign</option>
                                                                {(() => {
                                                                    const grouped = {};
                                                                    availableResources.forEach(r => {
                                                                        const squad = (r.squads && r.squads[0]) || 'Unassigned';
                                                                        if (!grouped[squad]) grouped[squad] = [];
                                                                        grouped[squad].push(r);
                                                                    });
                                                                    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([squad, members]) => (
                                                                        <optgroup key={squad} label={squad}>
                                                                            {members.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(r => (
                                                                                <option key={r.id} value={r.id}>{r.name}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ));
                                                                })()}
                                                            </select>
                                                            <span style={{
                                                                position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                                                                fontSize: '8px', color: isDark ? '#64748b' : '#94a3b8', pointerEvents: 'none'
                                                            }}>▼</span>
                                                        </div>
                                                    </div>

                                                    {/* Assigned resources */}
                                                    {wsAssignments.length > 0 && (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {wsAssignments.map(a => {
                                                                const res = resources.find(r => r.id === a.resourceId);
                                                                return (
                                                                    <div key={a.id} style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                        padding: '3px 8px', borderRadius: '6px',
                                                                        backgroundColor: isDark ? 'rgba(0,189,0,0.08)' : '#f0fdf4',
                                                                        border: `1px solid ${isDark ? 'rgba(0,189,0,0.2)' : '#bbf7d0'}`,
                                                                        fontSize: '10px', fontWeight: '600',
                                                                        color: isDark ? '#86efac' : '#166534'
                                                                    }}>
                                                                        {res?.headshot ? (
                                                                            <img src={res.headshot} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                        ) : (
                                                                            <div style={{
                                                                                width: '16px', height: '16px', borderRadius: '50%',
                                                                                backgroundColor: '#d1fae5', color: '#047857',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                fontSize: '8px', fontWeight: '700'
                                                                            }}>{(res?.name || '?')[0]}</div>
                                                                        )}
                                                                        <span>{res?.name || 'Unknown'}</span>
                                                                        {a.allocationPct && a.allocationPct < 100 && (
                                                                            <span style={{ opacity: 0.6 }}>{a.allocationPct}%</span>
                                                                        )}
                                                                        <span
                                                                            onClick={() => setLocalProgramAssignments(prev => prev.filter(x => x.id !== a.id))}
                                                                            style={{
                                                                                cursor: 'pointer', marginLeft: '2px',
                                                                                fontSize: '9px', opacity: 0.5,
                                                                                lineHeight: 1
                                                                            }}
                                                                            title="Remove assignment"
                                                                        >✕</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            <div style={{
                                padding: '10px 12px', borderRadius: '8px',
                                backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#eff6ff',
                                border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe'}`,
                                fontSize: '10px', color: isDark ? '#93c5fd' : '#1d4ed8'
                            }}>
                                💡 Assign or remove resources inline above. Pre-assigned resources' capacity is consumed by program demand first, with remaining capacity available for regular projects.
                            </div>
                        </div>
                    )}
                    {uniqueSquads.length > 0 && (
                        <div style={sectionCard(isDark)}>
                            <div style={sectionTitle(isDark)}>
                                <span style={{ fontSize: '18px' }}><MergeIcon /></span>
                                Squad Merge Pools
                                <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                    Merge squads to create shared resource pools for resourcing
                                </span>
                            </div>

                            {/* Current merge groups */}
                            {mergeGroups.map((group, gi) => (
                                <div key={gi} style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    marginBottom: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {group.size > 0 ? Array.from(group).join(' + ') : `Pool ${gi + 1}`} ({group.size} squad{group.size !== 1 ? 's' : ''})
                                        </span>
                                        {mergeGroups.length > 1 && (
                                            <button
                                                onClick={() => setMergeGroups(prev => prev.filter((_, i) => i !== gi))}
                                                style={{
                                                    padding: '2px 6px', fontSize: '9px', fontWeight: '600',
                                                    borderRadius: '4px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                                    backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✕ Remove
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {uniqueSquads.map(sq => {
                                            const inThisGroup = group.has(sq);
                                            const inOtherGroup = !inThisGroup && mergeGroups.some((g, i) => i !== gi && g.has(sq));
                                            return (
                                                <span
                                                    key={sq}
                                                    onClick={() => {
                                                        if (inOtherGroup) return; // Already in another pool
                                                        setMergeGroups(prev => {
                                                            const next = prev.map((g, i) => {
                                                                if (i !== gi) return g;
                                                                const updated = new Set(g);
                                                                if (inThisGroup) updated.delete(sq);
                                                                else updated.add(sq);
                                                                return updated;
                                                            });
                                                            return next;
                                                        });
                                                    }}
                                                    style={{
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        cursor: inOtherGroup ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s',
                                                        border: `1.5px solid ${inThisGroup ? '#3b82f6' : inOtherGroup ? (isDark ? '#1e293b' : '#f1f5f9') : (isDark ? '#475569' : '#d1d5db')}`,
                                                        backgroundColor: inThisGroup ? 'rgba(59,130,246,0.12)' : 'transparent',
                                                        color: inThisGroup ? '#3b82f6' : inOtherGroup ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#94a3b8' : '#64748b'),
                                                        opacity: inOtherGroup ? 0.4 : 1
                                                    }}
                                                >
                                                    {inThisGroup ? '✓' : '+'} {sq}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Add new pool button */}
                            <button
                                onClick={() => setMergeGroups(prev => [...prev, new Set()])}
                                style={{
                                    padding: '6px 14px', fontSize: '11px', fontWeight: '600',
                                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                    border: `1px dashed ${isDark ? '#475569' : '#cbd5e1'}`,
                                    backgroundColor: 'transparent',
                                    color: isDark ? '#94a3b8' : '#64748b'
                                }}
                            >
                                + Add Another Pool
                            </button>
                        </div>
                    )}


                    {/* ═══ Entity Role Rules ═══ */}
                    <div style={sectionCard(isDark)}>
                        <div style={sectionTitle(isDark)}>
                            <span style={{ fontSize: '18px' }}>🔀</span>
                            Entity Role Rules
                            <span style={{ fontSize: '11px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>
                                Allow resources to fill multiple roles based on entity
                            </span>
                        </div>

                        {(entityRoleRules || []).map((rule, ri) => {
                            const canFill = rule.canFill || [];
                            return (
                                <div key={ri} style={{
                                    padding: '12px 14px', borderRadius: '10px',
                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity</span>
                                            <select value={rule.entity} onChange={e => { const u = [...entityRoleRules]; u[ri] = { ...rule, entity: e.target.value }; setEntityRoleRules(u); }}
                                                style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: isDark ? '#1e293b' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', cursor: 'pointer', minWidth: '80px' }}>
                                                <option value="FEX">FEX</option>
                                                <option value="FY">FY</option>
                                                <option value="ALL">ALL (FEX + FY)</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Role</span>
                                            <select value={rule.sourceFunction} onChange={e => { const u = [...entityRoleRules]; u[ri] = { ...rule, sourceFunction: e.target.value }; setEntityRoleRules(u); }}
                                                style={{ padding: '6px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: isDark ? '#1e293b' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', cursor: 'pointer', minWidth: '60px' }}>
                                                <option value="PM">PM</option>
                                                <option value="SC">SC</option>
                                                <option value="PD">PD</option>
                                            </select>
                                        </div>
                                        <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', alignSelf: 'flex-end', paddingBottom: '8px' }}>→ can fill</span>
                                        {['PM', 'SC', 'PD'].map(role => (
                                            <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: canFill.includes(role) ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#475569' : '#cbd5e1'), alignSelf: 'flex-end', paddingBottom: '6px' }}>
                                                <input type="checkbox" checked={canFill.includes(role)} onChange={() => { const u = [...entityRoleRules]; const cf = canFill.includes(role) ? canFill.filter(r => r !== role) : [...canFill, role]; u[ri] = { ...rule, canFill: cf }; setEntityRoleRules(u); }} style={{ accentColor: '#8b5cf6' }} />
                                                {role}
                                            </label>
                                        ))}
                                        <button onClick={() => setEntityRoleRules(entityRoleRules.filter((_, i) => i !== ri))}
                                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, backgroundColor: 'transparent', color: isDark ? '#f87171' : '#dc2626', cursor: 'pointer', alignSelf: 'flex-end', marginBottom: '4px' }}>
                                            × Remove
                                        </button>
                                    </div>
                                    {/* Remaining-role entity constraints: for each role NOT in canFill, show entity dropdown */}
                                    {(() => {
                                        const remainingRoles = ['PM', 'SC', 'PD'].filter(r => !canFill.includes(r));
                                        if (remainingRoles.length === 0 || canFill.length < 2) return null;
                                        const constraints = rule.remainingConstraints || {};
                                        return (
                                            <div style={{
                                                display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
                                                padding: '8px 10px', borderRadius: '8px',
                                                backgroundColor: isDark ? '#1e1b4b' : '#f0f0ff',
                                                border: `1px dashed ${isDark ? '#4338ca' : '#c7d2fe'}`
                                            }}>
                                                <span style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#818cf8' : '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    When bundled, remaining:
                                                </span>
                                                {remainingRoles.map(role => (
                                                    <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#c7d2fe' : '#4338ca' }}>{role} →</span>
                                                        <select
                                                            value={constraints[role] || 'ALL'}
                                                            onChange={e => {
                                                                const u = [...entityRoleRules];
                                                                const newConstraints = { ...(rule.remainingConstraints || {}) };
                                                                if (e.target.value === 'ALL') { delete newConstraints[role]; } else { newConstraints[role] = e.target.value; }
                                                                u[ri] = { ...rule, remainingConstraints: newConstraints };
                                                                setEntityRoleRules(u);
                                                            }}
                                                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${isDark ? '#4338ca' : '#c7d2fe'}`, backgroundColor: isDark ? '#1e293b' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', cursor: 'pointer', minWidth: '60px' }}
                                                        >
                                                            <option value="ALL">Any</option>
                                                            <option value="FEX">FEX</option>
                                                            <option value="FY">FY</option>
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => setEntityRoleRules([...entityRoleRules, { entity: 'FEX', sourceFunction: 'PD', canFill: ['PD'], maxRoles: 1 }])}
                                style={{ padding: '8px 14px', fontSize: '11px', fontWeight: '600', borderRadius: '8px', border: `1px dashed ${isDark ? '#475569' : '#d1d5db'}`, backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer' }}>
                                + Add Rule
                            </button>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', marginLeft: 'auto' }}>
                                <input type="checkbox" checked={preferCrossEntity} onChange={e => setPreferCrossEntity(e.target.checked)} style={{ accentColor: '#8b5cf6' }} />
                                Prefer cross-entity teams (mix FEX + FY)
                            </label>
                        </div>

                        {/* ── Impact Preview ── */}
                        {(entityRoleRules || []).length > 0 && (() => {
                            // Compute impact preview from current rules + resources
                            const roleMatch = (r, roleKey) => {
                                const t = (r.role || r.adJobTitle || '').toUpperCase();
                                if (roleKey === 'PM') return t === 'PM' || t.includes('PROJECT MANAGER') || t.includes('MANAGER');
                                if (roleKey === 'SC') return t === 'SC' || t.includes('SOLUTION CONSULTANT') || t.includes('CONSULTANT');
                                if (roleKey === 'PD') return t === 'PD' || t.includes('PRODUCT DEVELOPER') || t.includes('DEVELOPER') || t.includes('BUILD') || t.includes('ENGINEER');
                                return false;
                            };
                            const validRes = (resources || []).filter(r => r.name && r.id);
                            let affectedCount = 0;
                            const affectedIds = new Set();
                            const expandedRoles = {}; // role → count of additional candidates from flex
                            const zeroNativeCandidateRoles = new Set();

                            // Count native candidates per role
                            const nativeCounts = { PM: 0, SC: 0, PD: 0 };
                            validRes.forEach(r => {
                                ['PM', 'SC', 'PD'].forEach(role => {
                                    if (roleMatch(r, role)) nativeCounts[role]++;
                                });
                            });

                            for (const rule of entityRoleRules) {
                                const ruleEntity = (rule.entity || '').toUpperCase();
                                const canFill = rule.canFill || [];
                                const srcKey = rule.sourceFunction;

                                // Find matching resources for this rule
                                const matching = validRes.filter(r => {
                                    const resEntity = (r.origin || '').toUpperCase();
                                    if (ruleEntity !== 'ALL' && resEntity !== ruleEntity) return false;
                                    return roleMatch(r, srcKey);
                                });

                                matching.forEach(r => affectedIds.add(r.id));

                                // For each target role in canFill that's NOT the source, count expansion
                                canFill.forEach(targetRole => {
                                    if (targetRole === srcKey) return; // Native match — not a flex
                                    const nativeCount = nativeCounts[targetRole] || 0;
                                    const flexAdded = matching.filter(r => !roleMatch(r, targetRole)).length;
                                    if (flexAdded > 0) {
                                        expandedRoles[targetRole] = (expandedRoles[targetRole] || 0) + flexAdded;
                                    }
                                    if (nativeCount === 0 && flexAdded > 0) {
                                        zeroNativeCandidateRoles.add(targetRole);
                                    }
                                });
                            }
                            affectedCount = affectedIds.size;

                            if (affectedCount === 0) return null;

                            return (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px', marginTop: '8px',
                                    backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#eff6ff',
                                    border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe'}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px' }}>📊</span>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Impact Preview
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                            <span style={{
                                                fontWeight: '800', fontSize: '14px',
                                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                                            }}>{affectedCount}</span>
                                            <span style={{ fontWeight: '600' }}>resource{affectedCount !== 1 ? 's' : ''} affected</span>
                                        </div>
                                        {Object.entries(expandedRoles).map(([role, count]) => (
                                            <div key={role} style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '6px',
                                                backgroundColor: zeroNativeCandidateRoles.has(role)
                                                    ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2')
                                                    : (isDark ? 'rgba(34,197,94,0.08)' : '#f0fdf4'),
                                                color: zeroNativeCandidateRoles.has(role)
                                                    ? (isDark ? '#fca5a5' : '#dc2626')
                                                    : (isDark ? '#86efac' : '#16a34a')
                                            }}>
                                                <span style={{ fontWeight: '700' }}>+{count}</span>
                                                <span style={{ fontWeight: '600' }}>{role} candidate{count !== 1 ? 's' : ''}</span>
                                                {zeroNativeCandidateRoles.has(role) && (
                                                    <span style={{ fontSize: '9px', fontWeight: '600', opacity: 0.8 }}>(0 native!)</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {zeroNativeCandidateRoles.size > 0 && (
                                        <div style={{
                                            marginTop: '6px', fontSize: '10px', fontWeight: '600',
                                            color: isDark ? '#fca5a5' : '#dc2626'
                                        }}>
                                            ⚠ Without {entityRoleRules.length === 1 ? 'this rule' : 'these rules'}, {[...zeroNativeCandidateRoles].join(' & ')} role{zeroNativeCandidateRoles.size > 1 ? 's' : ''} would have 0 eligible candidates
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── Post-Run Entity Rule Stats ── */}
                        {solverResult?.decisionSupport?.entityRuleStats && (() => {
                            const ers = solverResult.decisionSupport.entityRuleStats;
                            const totalActivations = (ers.bundleFills || 0) + (ers.flexFills || 0);
                            if (totalActivations === 0) return (
                                <div style={{
                                    padding: '8px 12px', borderRadius: '8px', marginTop: '8px',
                                    backgroundColor: isDark ? 'rgba(100,116,139,0.08)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', fontStyle: 'italic'
                                }}>
                                    Entity rules were not activated in this run — all roles were filled by native candidates.
                                </div>
                            );
                            return (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px', marginTop: '8px',
                                    backgroundColor: isDark ? 'rgba(34,197,94,0.06)' : '#f0fdf4',
                                    border: `1px solid ${isDark ? 'rgba(34,197,94,0.15)' : '#bbf7d0'}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '11px' }}>✅</span>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#86efac' : '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Last Run: Entity Rules Used
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                        {ers.bundleFills > 0 && (
                                            <div style={{
                                                padding: '4px 10px', borderRadius: '8px',
                                                backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : '#f5f3ff',
                                                border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe'}`,
                                                fontSize: '11px', fontWeight: '600', color: isDark ? '#c4b5fd' : '#7c3aed'
                                            }}>
                                                🔗 {ers.bundleFills} bundle fill{ers.bundleFills !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                        {ers.flexFills > 0 && (
                                            <div style={{
                                                padding: '4px 10px', borderRadius: '8px',
                                                backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                                                border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe'}`,
                                                fontSize: '11px', fontWeight: '600', color: isDark ? '#93c5fd' : '#2563eb'
                                            }}>
                                                🔀 {ers.flexFills} flex fill{ers.flexFills !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                        {ers.freedResources > 0 && (
                                            <div style={{
                                                padding: '4px 10px', borderRadius: '8px',
                                                backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#ecfdf5',
                                                border: `1px solid ${isDark ? 'rgba(34,197,94,0.2)' : '#bbf7d0'}`,
                                                fontSize: '11px', fontWeight: '600', color: isDark ? '#86efac' : '#047857'
                                            }}>
                                                👤 {ers.freedResources} resource{ers.freedResources !== 1 ? 's' : ''} freed
                                            </div>
                                        )}
                                    </div>
                                    {/* Per-rule breakdown */}
                                    {Object.keys(ers.bundlesByRule || {}).length > 0 && (
                                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                            {Object.entries(ers.bundlesByRule).map(([rule, count]) => (
                                                <div key={rule} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                                                    <span style={{ opacity: 0.5 }}>•</span>
                                                    <span style={{ fontWeight: '600' }}>{rule}</span>
                                                    <span>× {count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Per-role flex breakdown */}
                                    {Object.keys(ers.flexByRole || {}).length > 0 && (
                                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                            {Object.entries(ers.flexByRole).map(([role, count]) => (
                                                <div key={role} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                                                    <span style={{ opacity: 0.5 }}>•</span>
                                                    <span>Flex → <span style={{ fontWeight: '600' }}>{role}</span></span>
                                                    <span>× {count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div style={{ padding: '10px 12px', borderRadius: '8px', marginTop: '8px', backgroundColor: isDark ? 'rgba(139,92,246,0.06)' : '#f5f3ff', border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe'}`, fontSize: '10px', color: isDark ? '#a78bfa' : '#6d28d9' }}>
                            💡 Resources matching a rule can fill roles beyond their primary function. Hours are absorbed (combined). With cross-entity preference, the optimizer favours mixing FEX + FY on each project.
                        </div>
                    </div>

                    {/* ═══ Priority Review Panel ═══ */}
                    {showPriorityReview && priorityOrder && (
                        <div style={{
                            marginBottom: '16px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            borderRadius: '14px',
                            backgroundColor: isDark ? '#0f172a' : '#fafbfc',
                            overflow: 'hidden'
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px',
                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                backgroundColor: isDark ? '#1e293b' : '#f8fafc'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7637E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                        Priority Review
                                    </span>
                                    <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                        {priorityOrder.length} projects · {[...new Set(priorityOrder.map(p => p.country))].length} countries
                                    </span>
                                    <span style={{
                                        fontSize: '10px', fontWeight: '600', padding: '2px 8px',
                                        borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6'
                                    }}>
                                        {priorityOrder.filter(p => p.locked).length} locked
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={handleScorePreview}
                                        style={{
                                            padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                            backgroundColor: isDark ? '#1e293b' : 'white',
                                            color: isDark ? '#94a3b8' : '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                        </svg>
                                        Rescore
                                    </button>
                                    <button
                                        onClick={handleExportScores}
                                        style={{
                                            padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                            backgroundColor: isDark ? '#1e293b' : 'white',
                                            color: isDark ? '#94a3b8' : '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Export CSV
                                    </button>
                                    <button
                                        onClick={() => { setShowPriorityReview(false); setPriorityOrder(null); }}
                                        style={{
                                            padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                            backgroundColor: 'transparent',
                                            color: isDark ? '#94a3b8' : '#64748b'
                                        }}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>

                            {/* Filter Bar */}
                            <div style={{
                                display: 'flex', gap: '8px', padding: '8px 16px',
                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc',
                                flexWrap: 'wrap', alignItems: 'center'
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                                <input
                                    type="text"
                                    placeholder="Customer..."
                                    value={prioFilterCustomer}
                                    onChange={e => setPrioFilterCustomer(e.target.value)}
                                    style={{
                                        padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        width: '140px', outline: 'none'
                                    }}
                                />
                                <select
                                    value={prioFilterCountry}
                                    onChange={e => setPrioFilterCountry(e.target.value)}
                                    style={{
                                        padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        outline: 'none', cursor: 'pointer'
                                    }}
                                >
                                    <option value="">All Countries</option>
                                    {[...new Set(priorityOrder.map(p => p.country))].sort().map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <select
                                    value={prioFilterYear}
                                    onChange={e => setPrioFilterYear(e.target.value)}
                                    style={{
                                        padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                                        border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        outline: 'none', cursor: 'pointer'
                                    }}
                                >
                                    <option value="">All Years</option>
                                    {[...new Set(priorityOrder.map(p => p.launchYear).filter(Boolean))].sort().map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                {(prioFilterCustomer || prioFilterCountry || prioFilterYear) && (
                                    <button
                                        onClick={() => { setPrioFilterCustomer(''); setPrioFilterCountry(''); setPrioFilterYear(''); }}
                                        style={{
                                            padding: '3px 8px', fontSize: '10px', fontWeight: '600',
                                            borderRadius: '6px', cursor: 'pointer',
                                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                            backgroundColor: 'transparent',
                                            color: isDark ? '#94a3b8' : '#64748b'
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Score-Ordered List */}
                            <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '8px' }}>
                                {(() => {
                                    const filtered = priorityOrder.filter(item => {
                                        if (prioFilterCustomer && !item.customer?.toLowerCase().includes(prioFilterCustomer.toLowerCase()) && !item.name?.toLowerCase().includes(prioFilterCustomer.toLowerCase())) return false;
                                        if (prioFilterCountry && item.country !== prioFilterCountry) return false;
                                        if (prioFilterYear && item.launchYear !== parseInt(prioFilterYear)) return false;
                                        return true;
                                    });
                                    return filtered.map((item) => {
                                        const idx = priorityOrder.indexOf(item);
                                        const tierCfg = TIER_CONFIG[item.tier] || TIER_CONFIG[4];
                                        return (
                                            <div
                                                key={item.projectId}
                                                draggable={!item.locked}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', item.projectId);
                                                    setDragPrio({ projectId: item.projectId });
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (dragPrio) {
                                                        e.currentTarget.style.borderTop = '2px solid #7637E3';
                                                    }
                                                }}
                                                onDragLeave={(e) => { e.currentTarget.style.borderTop = ''; }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.style.borderTop = '';
                                                    if (!dragPrio) return;
                                                    const fromId = dragPrio.projectId;
                                                    const toId = item.projectId;
                                                    if (fromId === toId || item.locked) return;
                                                    setPriorityOrder(prev => {
                                                        const updated = [...prev];
                                                        const fromIdx = updated.findIndex(p => p.projectId === fromId);
                                                        const toIdx = updated.findIndex(p => p.projectId === toId);
                                                        if (fromIdx === -1 || toIdx === -1) return prev;
                                                        const [moved] = updated.splice(fromIdx, 1);
                                                        updated.splice(toIdx, 0, moved);
                                                        // Update ranks and apply priority boost to scores
                                                        updated.forEach((p, i) => {
                                                            p.rank = i + 1;
                                                            // Calculate priority boost based on position change
                                                            const positionDelta = (p.originalRank || (i + 1)) - (i + 1);
                                                            const priorityBoost = Math.round(positionDelta * 0.5 * 10) / 10; // 0.5 pts per position moved
                                                            if (p.scoreBreakdown) {
                                                                p.scoreBreakdown.priorityBoost = priorityBoost;
                                                                p.scoreBreakdown.finalScore = Math.round(
                                                                    (p.scoreBreakdown.baseScore || 0) +
                                                                    (p.scoreBreakdown.inFlightBonus || 0) +
                                                                    priorityBoost
                                                                );
                                                            }
                                                            p.score = p.scoreBreakdown?.finalScore ?? p.score;
                                                        });
                                                        return updated;
                                                    });
                                                    setDragPrio(null);
                                                }}
                                                onDragEnd={() => setDragPrio(null)}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                                                    padding: '8px 10px', marginBottom: '2px',
                                                    borderRadius: '8px',
                                                    backgroundColor: item.locked
                                                        ? (isDark ? 'rgba(139,92,246,0.08)' : '#faf5ff')
                                                        : (isDark ? '#0f172a' : 'white'),
                                                    border: `1px solid ${item.locked ? (isDark ? '#7637E380' : '#e9d5ff') : (isDark ? '#1e293b' : '#f1f5f9')}`,
                                                    cursor: item.locked ? 'default' : 'grab',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {/* Drag Handle */}
                                                {!item.locked && (
                                                    <div style={{ color: isDark ? '#475569' : '#cbd5e1', cursor: 'grab', flexShrink: 0, marginTop: '2px' }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="20" r="2" /><circle cx="16" cy="20" r="2" /></svg>
                                                    </div>
                                                )}

                                                {/* Rank Badge + Score + Move Indicator */}
                                                <div style={{
                                                    width: '28px', borderRadius: '6px',
                                                    background: `linear-gradient(135deg, ${tierCfg.color}, ${tierCfg.color}cc)`,
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0, marginTop: '1px', padding: '3px 0'
                                                }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', lineHeight: 1 }}>{idx + 1}</span>
                                                    <span style={{ fontSize: '8px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', lineHeight: 1, marginTop: '2px' }}>{item.score}</span>
                                                </div>
                                                {/* Move indicator */}
                                                {item.originalRank && item.originalRank !== (idx + 1) && (() => {
                                                    const delta = item.originalRank - (idx + 1);
                                                    const isUp = delta > 0;
                                                    return (
                                                        <div style={{
                                                            fontSize: '9px', fontWeight: '700',
                                                            color: isUp ? '#22c55e' : '#ef4444',
                                                            display: 'flex', alignItems: 'center', gap: '1px',
                                                            flexShrink: 0, minWidth: '24px', justifyContent: 'center'
                                                        }}>
                                                            {isUp ? '↑' : '↓'}{Math.abs(delta)}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                                        <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: tierCfg.bgColor, color: tierCfg.color, flexShrink: 0 }}>
                                                            {tierCfg.icon} {tierCfg.label}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '2px' }}>
                                                        {item.customer} · £{(item.arr || 0).toLocaleString()} cARR · {item.status} · Score: {item.score}
                                                    </div>
                                                    {/* Reasoning */}
                                                    {item.reasoning?.length > 0 && (
                                                        <div style={{ fontSize: '10px', color: isDark ? '#7c6bc4' : '#7637E3', marginTop: '2px' }}>
                                                            {(item.reasoning || []).map((r, ri) => (
                                                                <div key={ri} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '1px' }}>
                                                                    <span style={{ opacity: 0.5, flexShrink: 0 }}>›</span>
                                                                    <span>{r}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right-side Pills: Country, Contract ARR, Efficiency */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', flexShrink: 0, minWidth: '100px' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '500', padding: '1px 5px', borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                        {item.country}
                                                    </span>
                                                    {item.scoreBreakdown?.contractArr > 0 && (
                                                        <span style={{
                                                            fontSize: '8px', fontWeight: '600', padding: '1px 4px',
                                                            borderRadius: '3px', backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4',
                                                            color: isDark ? '#4ade80' : '#16a34a'
                                                        }}>
                                                            Contract £{item.scoreBreakdown.contractArr.toLocaleString()}
                                                        </span>
                                                    )}
                                                    {item.dealEfficiency > 0 && (
                                                        <span style={{
                                                            fontSize: '8px', fontWeight: '600', padding: '1px 4px',
                                                            borderRadius: '3px', backgroundColor: isDark ? 'rgba(14,165,233,0.15)' : '#e0f2fe',
                                                            color: isDark ? '#38bdf8' : '#0284c7'
                                                        }}>
                                                            Deal £{item.dealEfficiency.toFixed(2)}/cARRhr
                                                        </span>
                                                    )}
                                                    {item.contractEfficiency > 0 && (
                                                        <span style={{
                                                            fontSize: '8px', fontWeight: '600', padding: '1px 4px',
                                                            borderRadius: '3px', backgroundColor: isDark ? 'rgba(168,85,247,0.15)' : '#f3e8ff',
                                                            color: isDark ? '#c084fc' : '#7c3aed'
                                                        }}>
                                                            Country £{item.contractEfficiency.toFixed(2)}/cARRhr
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Score Breakdown Box */}
                                                {item.scoreBreakdown && (
                                                    <div style={{
                                                        flexShrink: 0, minWidth: '110px', maxWidth: '130px',
                                                        padding: '5px 8px', borderRadius: '6px',
                                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#f8fafc',
                                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                        fontSize: '9px', lineHeight: '1.5',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        <div style={{ fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                            Score Math
                                                        </div>
                                                        <div>Tier range: {item.scoreBreakdown.tierRange[0]}–{item.scoreBreakdown.tierRange[1]}</div>
                                                        {item.scoreBreakdown.contractArr > 0 && (
                                                            <div style={{ color: '#0ea5e9' }}>Contract: £{item.scoreBreakdown.contractArr.toLocaleString()} → blended £{item.scoreBreakdown.blendedArr.toLocaleString()}</div>
                                                        )}
                                                        <div>Base ({item.scoreBreakdown.scoringBasis}): {item.scoreBreakdown.baseScore}</div>
                                                        {item.scoreBreakdown.inFlightBonus > 0 && (
                                                            <div style={{ color: '#22c55e' }}>In-flight: +{item.scoreBreakdown.inFlightBonus}</div>
                                                        )}
                                                        {(item.scoreBreakdown.priorityBoost || 0) !== 0 && (
                                                            <div style={{ color: item.scoreBreakdown.priorityBoost > 0 ? '#3b82f6' : '#f59e0b' }}>
                                                                Priority: {item.scoreBreakdown.priorityBoost > 0 ? '+' : ''}{item.scoreBreakdown.priorityBoost}
                                                            </div>
                                                        )}
                                                        <div style={{ fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: '2px', marginTop: '2px' }}>
                                                            Final: {item.scoreBreakdown.finalScore}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Lock Toggle */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPriorityOrder(prev => prev.map(p =>
                                                            p.projectId === item.projectId ? { ...p, locked: !p.locked } : p
                                                        ));
                                                    }}
                                                    style={{
                                                        padding: '4px 8px', fontSize: '10px', fontWeight: '600',
                                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
                                                        border: `1px solid ${item.locked ? '#8b5cf6' : (isDark ? '#475569' : '#d1d5db')}`,
                                                        backgroundColor: item.locked ? (isDark ? 'rgba(139,92,246,0.2)' : '#f3e8ff') : 'transparent',
                                                        color: item.locked ? '#8b5cf6' : (isDark ? '#94a3b8' : '#64748b'),
                                                        flexShrink: 0, marginTop: '2px',
                                                        display: 'flex', alignItems: 'center', gap: '3px'
                                                    }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        {item.locked ? (
                                                            <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
                                                        ) : (
                                                            <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 019.33-2.5" /></>
                                                        )}
                                                    </svg>
                                                    {item.locked ? 'Locked' : 'Lock'}
                                                </button>

                                                {/* Up/Down Arrows */}
                                                {!item.locked && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0, marginTop: '2px' }}>
                                                        <button
                                                            disabled={idx === 0}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPriorityOrder(prev => {
                                                                    const updated = [...prev];
                                                                    const curIdx = updated.findIndex(p => p.projectId === item.projectId);
                                                                    if (curIdx <= 0) return prev;
                                                                    [updated[curIdx - 1], updated[curIdx]] = [updated[curIdx], updated[curIdx - 1]];
                                                                    updated.forEach((p, i) => {
                                                                        p.rank = i + 1;
                                                                        const positionDelta = (p.originalRank || (i + 1)) - (i + 1);
                                                                        const priorityBoost = Math.round(positionDelta * 0.5 * 10) / 10;
                                                                        if (p.scoreBreakdown) {
                                                                            p.scoreBreakdown.priorityBoost = priorityBoost;
                                                                            p.scoreBreakdown.finalScore = Math.round((p.scoreBreakdown.baseScore || 0) + (p.scoreBreakdown.inFlightBonus || 0) + priorityBoost);
                                                                        }
                                                                        p.score = p.scoreBreakdown?.finalScore ?? p.score;
                                                                    });
                                                                    return updated;
                                                                });
                                                            }}
                                                            style={{
                                                                width: '18px', height: '14px', padding: 0, border: 'none',
                                                                borderRadius: '3px 3px 0 0', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                                                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                                color: idx === 0 ? (isDark ? '#334155' : '#d1d5db') : (isDark ? '#94a3b8' : '#64748b'),
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                opacity: idx === 0 ? 0.4 : 1, transition: 'all 0.1s'
                                                            }}
                                                            title="Move up"
                                                        >
                                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                                                        </button>
                                                        <button
                                                            disabled={idx === filtered.length - 1}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPriorityOrder(prev => {
                                                                    const updated = [...prev];
                                                                    const curIdx = updated.findIndex(p => p.projectId === item.projectId);
                                                                    if (curIdx === -1 || curIdx >= updated.length - 1) return prev;
                                                                    [updated[curIdx], updated[curIdx + 1]] = [updated[curIdx + 1], updated[curIdx]];
                                                                    updated.forEach((p, i) => {
                                                                        p.rank = i + 1;
                                                                        const positionDelta = (p.originalRank || (i + 1)) - (i + 1);
                                                                        const priorityBoost = Math.round(positionDelta * 0.5 * 10) / 10;
                                                                        if (p.scoreBreakdown) {
                                                                            p.scoreBreakdown.priorityBoost = priorityBoost;
                                                                            p.scoreBreakdown.finalScore = Math.round((p.scoreBreakdown.baseScore || 0) + (p.scoreBreakdown.inFlightBonus || 0) + priorityBoost);
                                                                        }
                                                                        p.score = p.scoreBreakdown?.finalScore ?? p.score;
                                                                    });
                                                                    return updated;
                                                                });
                                                            }}
                                                            style={{
                                                                width: '18px', height: '14px', padding: 0, border: 'none',
                                                                borderRadius: '0 0 3px 3px', cursor: idx === filtered.length - 1 ? 'not-allowed' : 'pointer',
                                                                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                                color: idx === filtered.length - 1 ? (isDark ? '#334155' : '#d1d5db') : (isDark ? '#94a3b8' : '#64748b'),
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                opacity: idx === filtered.length - 1 ? 0.4 : 1, transition: 'all 0.1s'
                                                            }}
                                                            title="Move down"
                                                        >
                                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}


                    {/* Run Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                        {/* Jump to Results — when results already exist */}
                        {results && showConfig && (
                            <button
                                onClick={() => setShowConfig(false)}
                                style={{
                                    flex: '0 0 auto',
                                    padding: '14px 20px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    border: `2px solid ${isDark ? '#22c55e' : '#22c55e'}`,
                                    backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4',
                                    color: '#22c55e',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                View Results
                            </button>
                        )}
                        {/* Score & Preview Button */}
                        <button
                            onClick={handleScorePreview}
                            disabled={isRunning}
                            style={{
                                flex: 1,
                                padding: '14px 24px',
                                fontSize: '14px',
                                fontWeight: '700',
                                borderRadius: '14px',
                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s',
                                border: `2px solid ${isDark ? '#7637E3' : '#7637E3'}`,
                                backgroundColor: isDark ? 'rgba(118,55,227,0.1)' : '#faf5ff',
                                color: '#7637E3',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: isRunning ? 0.5 : 1
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            Score & Preview
                        </button>

                        {/* Run Optimizer Button */}
                        <button
                            onClick={handleRun}
                            disabled={isRunning}
                            style={{
                                flex: 1,
                                padding: '14px 24px',
                                fontSize: '14px',
                                fontWeight: '700',
                                borderRadius: '14px',
                                border: 'none',
                                cursor: isRunning ? 'wait' : 'pointer',
                                background: isRunning
                                    ? (isDark ? '#334155' : '#e2e8f0')
                                    : 'linear-gradient(135deg, #FF6B35 0%, #E83F6F 100%)',
                                color: isRunning ? (isDark ? '#64748b' : '#94a3b8') : 'white',
                                boxShadow: isRunning ? 'none' : '0 4px 12px rgba(255,107,53,0.3)',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {isRunning ? (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                                    Analyzing Portfolio...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    Run Reprioritization ({eligibleProjects.length} projects)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Results Panel ── */}
            {results && !showConfig && (
                <div ref={resultsRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

                    {/* Override Count Banner */}
                    {overrideCount > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            padding: '8px 14px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
                        }}>
                            <span style={{
                                fontSize: '11px', fontWeight: '600', padding: '4px 10px',
                                borderRadius: '20px', backgroundColor: 'rgba(139,92,246,0.12)',
                                color: '#8b5cf6'
                            }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>{overrideCount} override{overrideCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* Override Summary Banner */}
                    {overrideCount > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '12px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : '#f5f3ff',
                            border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : '#ddd6fe'}`
                        }}>
                            <span style={{ fontSize: '12px', color: isDark ? '#c4b5fd' : '#7c3aed' }}>
                                {overrideCount} what-if override{overrideCount !== 1 ? 's' : ''} active
                            </span>
                            <div style={{ flex: 1 }} />
                            <button
                                onClick={handleRerunWithOverrides}
                                disabled={isRunning}
                                style={{
                                    padding: '5px 12px', fontSize: '11px', fontWeight: '700',
                                    borderRadius: '8px', border: 'none',
                                    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                                    color: 'white', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                ↻ Re-run
                            </button>
                            <button
                                onClick={handleClearOverrides}
                                style={{
                                    padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                                    borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                    backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                ✕ Clear
                            </button>
                        </div>
                    )}

                    {/* Summary Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '12px',
                        marginBottom: '16px'
                    }}>
                        {[
                            { label: 'Scheduled', value: results.stats.projectsScheduled, color: '#22c55e' },
                            { label: 'Deferred', value: results.stats.projectsDeferred, color: '#f59e0b' },
                            { label: 'Roles Filled', value: results.stats.rolesNeeded > 0 ? `${results.stats.rolesFilled}/${results.stats.rolesNeeded}` : '—', color: '#8b5cf6' },
                            { label: 'ARR Protected', value: `£${(results.stats.totalArrProtected / 1000).toFixed(0)}k`, color: '#00BD00' }
                        ].map(stat => (
                            <div key={stat.label} style={{
                                padding: '14px',
                                borderRadius: '14px',
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                textAlign: 'center',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: stat.color }}>
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Optimizer Metrics ── */}
                    {solverResult?.decisionSupport?.optimizerMetrics && (() => {
                        const m = solverResult.decisionSupport.optimizerMetrics;
                        const conf = m.confidence || {};
                        const confTotal = (conf.tight || 0) + (conf.moderate || 0) + (conf.comfortable || 0);
                        const metricCards = [
                            { label: 'Fill Rate', value: `${m.fillRate}%`, color: m.fillRate >= 80 ? '#10b981' : m.fillRate >= 60 ? '#f59e0b' : '#ef4444' },
                            { label: 'ARR Coverage', value: `${m.arrCoverage}%`, color: m.arrCoverage >= 80 ? '#10b981' : m.arrCoverage >= 60 ? '#f59e0b' : '#ef4444' },
                            { label: 'Avg Utilisation', value: `${m.avgUtilisation}%`, color: m.avgUtilisation >= 60 && m.avgUtilisation <= 90 ? '#10b981' : '#f59e0b' },
                            { label: 'Cross-Squad', value: `${m.crossSquadPct}%`, color: m.crossSquadPct <= 10 ? '#10b981' : m.crossSquadPct <= 25 ? '#f59e0b' : '#ef4444' },
                            { label: 'Projects Filled', value: `${m.filledProjects}/${m.totalProjects}`, color: '#3b82f6' },
                            ...(m.relaxedFills > 0 ? [{ label: 'Relaxed Fills', value: `${m.relaxedFills}`, color: '#8b5cf6' }] : [])
                        ];
                        return (
                            <div style={{
                                marginBottom: '16px', padding: '14px', borderRadius: '14px',
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path d="M12 6v6l4 2" /></svg>
                                    Optimizer Metrics
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                                    {metricCards.map(c => (
                                        <div key={c.label} style={{
                                            textAlign: 'center', padding: '8px 6px', borderRadius: '10px',
                                            background: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc',
                                            border: `1px solid ${isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)'}`
                                        }}>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: c.color }}>{c.value}</div>
                                            <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>{c.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {confTotal > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
                                            Assignment Confidence
                                        </div>
                                        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '1px' }}>
                                            {conf.comfortable > 0 && <div style={{ flex: conf.comfortable, background: '#10b981', borderRadius: '3px' }} title={`${conf.comfortable} comfortable`} />}
                                            {conf.moderate > 0 && <div style={{ flex: conf.moderate, background: '#f59e0b', borderRadius: '3px' }} title={`${conf.moderate} moderate`} />}
                                            {conf.tight > 0 && <div style={{ flex: conf.tight, background: '#ef4444', borderRadius: '3px' }} title={`${conf.tight} tight`} />}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                            <span style={{ fontSize: '9px', color: '#10b981' }}>{conf.comfortable || 0} comfortable</span>
                                            <span style={{ fontSize: '9px', color: '#f59e0b' }}>{conf.moderate || 0} moderate</span>
                                            <span style={{ fontSize: '9px', color: '#ef4444' }}>{conf.tight || 0} tight</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Customer Satisfaction ── */}
                    {solverResult?.decisionSupport?.customerSatisfaction && (() => {
                        const cs = solverResult.decisionSupport.customerSatisfaction;
                        const sorted = Object.entries(cs)
                            .filter(([, v]) => v.filled + v.partial + v.deferred > 0)
                            .sort((a, b) => a[1].score - b[1].score)
                            .slice(0, 10);
                        if (sorted.length === 0) return null;
                        return (
                            <div style={{
                                marginBottom: '16px', padding: '14px', borderRadius: '14px',
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                    Customer Satisfaction (Worst 10)
                                </div>
                                {sorted.map(([cust, data]) => {
                                    const scoreColor = data.score >= 80 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444';
                                    return (
                                        <div key={cust} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '5px 10px', borderRadius: '8px', marginBottom: '3px',
                                            background: isDark ? 'rgba(15,23,42,0.4)' : '#f8fafc'
                                        }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                    {data.filled}✔ {data.partial}⚠ {data.deferred}✖
                                                </span>
                                                <span style={{
                                                    fontSize: '12px', fontWeight: '700', color: scoreColor,
                                                    minWidth: '32px', textAlign: 'right'
                                                }}>{data.score}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* ── Squad Utilization + Revenue at Risk + Data Quality ── */}
                    {solverResult?.squadUtilization && Object.keys(solverResult.squadUtilization).length > 0 && (
                        <div style={{
                            marginBottom: '16px', padding: '14px', borderRadius: '14px',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>
                                Squad Utilization
                                <span style={{ fontSize: '9px', fontWeight: '500', color: isDark ? '#64748b' : '#94a3b8', marginLeft: '4px' }}>(avg per person)</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(3, 1fr)', gap: '4px', fontSize: '9px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>
                                <div></div><div style={{ textAlign: 'center' }}>PM</div><div style={{ textAlign: 'center' }}>SC</div><div style={{ textAlign: 'center' }}>PD</div>
                            </div>
                            {Object.entries(solverResult.squadUtilization).map(([squad, util]) => (
                                <div key={squad} style={{ display: 'grid', gridTemplateColumns: '90px repeat(3, 1fr)', gap: '4px', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '18px' }} title={squad}>{squad}</div>
                                    {['pm', 'sc', 'pd'].map(role => {
                                        const r = util[role];
                                        const pool = r?.pool || 0;
                                        const avgPct = pool > 0 ? Math.round((r?.utilPct || 0) / pool) : 0;
                                        const barColor = avgPct > 100 ? '#ef4444' : avgPct > 80 ? '#f59e0b' : avgPct > 50 ? '#22c55e' : '#3b82f6';
                                        return (
                                            <div key={role} style={{ position: 'relative', height: '18px', borderRadius: '5px', background: isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9', overflow: 'hidden' }} title={`${pool} ${role.toUpperCase()}s, ${r?.loadHours || 0}h load / ${r?.hours || 0}h capacity (${avgPct}% avg)`}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(avgPct, 100)}%`, background: barColor, opacity: 0.7, borderRadius: '5px', transition: 'width 0.3s' }} />
                                                <div style={{ position: 'relative', textAlign: 'center', fontSize: '9px', fontWeight: '700', lineHeight: '18px', color: avgPct > 50 ? '#fff' : (isDark ? '#cbd5e1' : '#475569') }}>{pool > 0 ? `${avgPct}%` : '—'}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Revenue at Risk */}
                    {solverResult?.decisionSupport?.revenueAtRisk > 0 && (
                        <div style={{
                            marginBottom: '16px', padding: '14px', borderRadius: '14px',
                            background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(254,226,226,0.4)',
                            border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fecaca'}`,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                Revenue at Risk: £{(solverResult.decisionSupport.revenueAtRisk || 0).toLocaleString()}
                            </div>
                            {Object.entries(solverResult.decisionSupport.hiringGaps || {}).map(([squad, gaps]) => {
                                const totalGaps = (gaps.PM || 0) + (gaps.SC || 0) + (gaps.PD || 0);
                                if (totalGaps === 0) return null;
                                const squadRisk = solverResult.decisionSupport.revenueAtRiskBySquad?.[squad] || 0;
                                return (
                                    <div key={squad} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '11px' }}>
                                        <span style={{ fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569', minWidth: '80px' }}>{squad}</span>
                                        {gaps.PM > 0 && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>+{gaps.PM} PM</span>}
                                        {gaps.SC > 0 && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>+{gaps.SC} SC</span>}
                                        {gaps.PD > 0 && <span style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>+{gaps.PD} PD</span>}
                                        {squadRisk > 0 && <span style={{ color: '#ef4444', fontWeight: '600', marginLeft: 'auto' }}>£{squadRisk.toLocaleString()}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Data Quality Warnings */}
                    {solverResult?.dataQualityWarnings?.length > 0 && (
                        <div style={{
                            marginBottom: '16px', padding: '12px 14px', borderRadius: '14px',
                            background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(254,243,199,0.4)',
                            border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : '#fde68a'}`,
                            fontSize: '11px',
                            color: isDark ? '#fbbf24' : '#92400e'
                        }}>
                            <div style={{ fontWeight: '700', marginBottom: '6px' }}>⚠ Data Quality ({solverResult.dataQualityWarnings.length})</div>
                            {solverResult.dataQualityWarnings.slice(0, 5).map((w, i) => (
                                <div key={i} style={{ marginBottom: '3px' }}>• {w.message}</div>
                            ))}
                            {solverResult.dataQualityWarnings.length > 5 && <div>...and {solverResult.dataQualityWarnings.length - 5} more</div>}
                        </div>
                    )}

                    {/* ── View Changes Panel ── */}
                    {results && (() => {
                        // Compute changes
                        const dateShifts = (results.scheduled || []).filter(p => {
                            if ((p.shiftWeeks || 0) <= 0 && !p._dateNudge && !p._compression) return false;
                            // Filter out false shifts: if dates haven't actually changed, skip
                            const origKO = p.kickOff || '';
                            const newKO = p.proposedStart || '';
                            const origLaunch = p.launch || '';
                            const newLaunch = p.proposedEnd || '';
                            if (newKO && origKO && newKO !== origKO) return true;
                            if (newLaunch && origLaunch && newLaunch !== origLaunch) return true;
                            if (p._dateNudge) return true;
                            if (p._compression) return true;
                            return false; // Same dates = not a real shift
                        }).map(p => ({
                            id: p.id, name: p.name, customer: p.customer,
                            originalStart: p.kickOff, originalEnd: p.launch,
                            newStart: p.proposedStart, newEnd: p.proposedEnd,
                            shiftWeeks: p._compression ? -p._compression : (p.shiftWeeks || p._dateNudge || 0),
                            score: p._reprioritization?.score,
                            isNudge: !!p._dateNudge,
                            isCompression: !!p._compression
                        }));

                        const teamChanges = (results.scheduled || []).filter(p => {
                            const ra = resourceAssignments[p.id];
                            if (!ra) return false;
                            const newRoles = [...(ra.pm || []), ...(ra.sc || []), ...(ra.pd || [])];
                            return newRoles.length > 0;
                        }).map(p => {
                            const ra = resourceAssignments[p.id] || { pm: [], sc: [], pd: [] };
                            const seeded = p._seededAssignments || [];
                            // Build "before" state from seeded assignments + project fields
                            const seededByRole = {};
                            seeded.forEach(s => {
                                const baseRole = s.role.replace(/ \(\d+\/\d+\)/, '');
                                if (!seededByRole[baseRole]) seededByRole[baseRole] = [];
                                if (s.resourceName) seededByRole[baseRole].push(s.resourceName);
                            });
                            const currentPM = seededByRole['PM']?.join(', ') || p.pmName || p.pm || '';
                            const currentSC = seededByRole['SC']?.join(', ') || p.scName || p.sc || '';
                            const currentPD = seededByRole['PD']?.join(', ') || p.pdName || p.pd || '';
                            // New assignments
                            const newPM = ra.pm?.map(r => r.name).join(', ') || '';
                            const newSC = ra.sc?.map(r => r.name).join(', ') || '';
                            const newPD = ra.pd?.map(r => r.name).join(', ') || '';
                            // Only show if something actually changed
                            const pmChanged = newPM && newPM !== currentPM;
                            const scChanged = newSC && newSC !== currentSC;
                            const pdChanged = newPD && newPD !== currentPD;
                            const hasChange = pmChanged || scChanged || pdChanged;
                            return {
                                id: p.id, name: p.name, customer: p.customer,
                                current: { pm: currentPM, sc: currentSC, pd: currentPD },
                                proposed: { pm: newPM || currentPM, sc: newSC || currentSC, pd: newPD || currentPD },
                                hasChange, score: p._reprioritization?.score
                            };
                        }).filter(c => c.hasChange);

                        const deferredProjects = (results.deferred || []).map(p => ({
                            id: p.id, name: p.name, customer: p.customer,
                            reason: p._reprioritization?.reasoning?.slice(-1)[0] || 'Capacity limit exceeded',
                            score: p._reprioritization?.score,
                            tier: p._reprioritization?.tier
                        }));

                        const totalChanges = dateShifts.length + teamChanges.length + deferredProjects.length;
                        if (totalChanges === 0) return null;

                        const filteredDateShifts = changesFilter === 'all' || changesFilter === 'dates' ? dateShifts : [];
                        const filteredTeamChanges = changesFilter === 'all' || changesFilter === 'team' ? teamChanges : [];
                        const filteredDeferred = changesFilter === 'all' || changesFilter === 'deferred' ? deferredProjects : [];

                        const formatDate = d => {
                            if (!d) return '—';
                            try {
                                const dt = new Date(d);
                                return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
                            } catch { return d; }
                        };

                        return (
                            <div style={{
                                ...sectionCard(isDark),
                                marginBottom: '16px'
                            }}>
                                {/* Header */}
                                <div
                                    onClick={() => setShowChangesPanel(!showChangesPanel)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        cursor: 'pointer', userSelect: 'none'
                                    }}
                                >
                                    <span style={{
                                        fontSize: '11px', transition: 'transform 0.2s',
                                        transform: showChangesPanel ? 'rotate(90deg)' : 'rotate(0deg)',
                                        color: isDark ? '#94a3b8' : '#64748b'
                                    }}>▶</span>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg> View Changes
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                                        {dateShifts.length > 0 && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                                                borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.12)',
                                                color: '#3b82f6'
                                            }}>
                                                {dateShifts.length} date shift{dateShifts.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {teamChanges.length > 0 && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                                                borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.12)',
                                                color: '#8b5cf6'
                                            }}>
                                                {teamChanges.length} team change{teamChanges.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {deferredProjects.length > 0 && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                                                borderRadius: '10px', backgroundColor: 'rgba(245,158,11,0.12)',
                                                color: '#f59e0b'
                                            }}>
                                                {deferredProjects.length} deferred
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }} />
                                    {/* Solver badge */}
                                    {solverResult && (
                                        <span style={{
                                            fontSize: '9px', fontWeight: '600', padding: '2px 8px',
                                            borderRadius: '8px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.15))'
                                                : 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1))',
                                            color: isDark ? '#4ade80' : '#16a34a'
                                        }}>
                                            SA +{solverResult.solverMeta?.improvementPct || 0}% · {solverResult.solverMeta?.totalDurationMs || 0}ms
                                        </span>
                                    )}
                                </div>

                                {/* Expanded Content */}
                                {showChangesPanel && (
                                    <div style={{ marginTop: '12px' }}>
                                        {/* Filter Pills */}
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                            {['all', 'dates', 'team', 'deferred'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setChangesFilter(f)}
                                                    style={{
                                                        padding: '4px 12px', fontSize: '10px', fontWeight: '700',
                                                        borderRadius: '20px', border: 'none', cursor: 'pointer',
                                                        textTransform: 'capitalize',
                                                        backgroundColor: changesFilter === f
                                                            ? (isDark ? '#FF6B35' : '#FF6B35')
                                                            : (isDark ? '#1e293b' : '#f1f5f9'),
                                                        color: changesFilter === f ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {f === 'all' ? `All (${totalChanges})` : f === 'dates' ? `Dates (${dateShifts.length})` : f === 'team' ? `Team (${teamChanges.length})` : `Deferred (${deferredProjects.length})`}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Date Shifts */}
                                        {filteredDateShifts.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> Date Shifts
                                                </div>
                                                {filteredDateShifts.map(s => (
                                                    <div key={s.id} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr auto',
                                                        gap: '8px',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        marginBottom: '4px',
                                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                        border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                                {s.name}
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                                                                {s.customer}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                                                                {/* Kick-off dates */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', minWidth: '38px' }}>KO:</span>
                                                                    <span style={{
                                                                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                        backgroundColor: s.originalStart !== s.newStart ? '#fef2f2' : (isDark ? '#1e293b' : '#f1f5f9'),
                                                                        color: s.originalStart !== s.newStart ? '#dc2626' : (isDark ? '#94a3b8' : '#64748b'),
                                                                        textDecoration: s.originalStart !== s.newStart ? 'line-through' : 'none',
                                                                        border: `1px solid ${s.originalStart !== s.newStart ? '#fecaca' : 'transparent'}`
                                                                    }}>
                                                                        {formatDate(s.originalStart)}
                                                                    </span>
                                                                    {s.originalStart !== s.newStart && (
                                                                        <>
                                                                            <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>→</span>
                                                                            <span style={{
                                                                                fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                                backgroundColor: '#f0fdf4', color: '#16a34a',
                                                                                fontWeight: '700', border: '1px solid #bbf7d0'
                                                                            }}>
                                                                                {formatDate(s.newStart)}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {/* Launch dates */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', minWidth: '38px' }}>Launch:</span>
                                                                    <span style={{
                                                                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                        backgroundColor: '#fef2f2', color: '#dc2626',
                                                                        textDecoration: 'line-through', border: '1px solid #fecaca'
                                                                    }}>
                                                                        {formatDate(s.originalEnd)}
                                                                    </span>
                                                                    <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>→</span>
                                                                    <span style={{
                                                                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                        backgroundColor: '#f0fdf4', color: '#16a34a',
                                                                        fontWeight: '700', border: '1px solid #bbf7d0'
                                                                    }}>
                                                                        {formatDate(s.newEnd)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '12px', fontWeight: '800',
                                                            padding: '4px 10px', borderRadius: '8px',
                                                            background: s.isCompression
                                                                ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.05))'
                                                                : s.shiftWeeks <= 4
                                                                    ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.05))'
                                                                    : 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05))',
                                                            color: s.isCompression ? '#8b5cf6' : s.shiftWeeks <= 4 ? '#3b82f6' : '#f59e0b'
                                                        }}>
                                                            {s.shiftWeeks > 0 ? `+${s.shiftWeeks}w` : `${s.shiftWeeks}w`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Team Changes */}
                                        {filteredTeamChanges.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '700', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px', verticalAlign: 'middle' }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>Team Changes
                                                </div>
                                                {filteredTeamChanges.map(c => (
                                                    <div key={c.id} style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        marginBottom: '4px',
                                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                        border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
                                                    }}>
                                                        <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '4px' }}>
                                                            {c.name}
                                                            <span style={{ fontSize: '10px', fontWeight: '400', color: isDark ? '#64748b' : '#94a3b8', marginLeft: '6px' }}>{c.customer}</span>
                                                        </div>
                                                        {['pm', 'sc', 'pd'].map(role => {
                                                            const before = c.current[role];
                                                            const after = c.proposed[role];
                                                            if (!before && !after) return null;
                                                            if (before === after) return null;
                                                            return (
                                                                <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                                                    <span style={{
                                                                        fontSize: '9px', fontWeight: '800', textTransform: 'uppercase',
                                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                                        minWidth: '20px'
                                                                    }}>{role}</span>
                                                                    {before ? (
                                                                        <span style={{
                                                                            fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                            backgroundColor: '#fef2f2', color: '#dc2626',
                                                                            textDecoration: before !== after ? 'line-through' : 'none',
                                                                            border: '1px solid #fecaca'
                                                                        }}>{before}</span>
                                                                    ) : (
                                                                        <span style={{ fontSize: '10px', color: isDark ? '#475569' : '#cbd5e1', fontStyle: 'italic' }}>Empty</span>
                                                                    )}
                                                                    <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>→</span>
                                                                    <span style={{
                                                                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                                                        backgroundColor: '#f0fdf4', color: '#16a34a',
                                                                        fontWeight: '700', border: '1px solid #bbf7d0'
                                                                    }}>
                                                                        {after || '—'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Deferred Projects */}
                                        {filteredDeferred.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '10px', fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Deferred Projects
                                                </div>
                                                {filteredDeferred.map(d => (
                                                    <div key={d.id} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        marginBottom: '3px',
                                                        backgroundColor: isDark ? 'rgba(245,158,11,0.05)' : '#fffbeb',
                                                        border: `1px solid ${isDark ? 'rgba(245,158,11,0.15)' : '#fde68a'}`
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#fbbf24' : '#d97706' }}>
                                                                {d.name}
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginLeft: '6px' }}>
                                                                {d.customer}
                                                            </span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '9px', padding: '2px 8px', borderRadius: '6px',
                                                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                                            color: isDark ? '#94a3b8' : '#64748b',
                                                            maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>
                                                            {d.reason}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '700',
                                                            color: isDark ? '#475569' : '#cbd5e1'
                                                        }}>
                                                            T{d.tier || '?'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Strategy Comparison (from solver) */}
                                        {solverResult?.strategies && solverResult.strategies.length > 1 && (
                                            <div style={{ marginTop: '12px' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" /><path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" /><path d="M8 2h8v7a4 4 0 01-8 0V2z" /></svg> Strategy Comparison
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${solverResult.strategies.length}, 1fr)`, gap: '8px' }}>
                                                    {solverResult.strategies.map(s => (
                                                        <div key={s.strategy} style={{
                                                            padding: '10px',
                                                            borderRadius: '10px',
                                                            backgroundColor: s.isWinner
                                                                ? (isDark ? 'rgba(34,197,94,0.08)' : '#f0fdf4')
                                                                : (isDark ? '#0f172a' : '#f8fafc'),
                                                            border: `2px solid ${s.isWinner ? '#22c55e' : (isDark ? '#1e293b' : '#e2e8f0')}`,
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                                                                {s.strategy === 'score_ordered' ? '●' : s.strategy === 'customer_grouped' ? '◆' : '▣'}
                                                            </div>
                                                            <div style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '2px' }}>
                                                                {s.label}
                                                            </div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: s.isWinner ? '#22c55e' : (isDark ? '#94a3b8' : '#64748b') }}>
                                                                {s.score?.toFixed(0)}
                                                            </div>
                                                            {s.isWinner && (
                                                                <div style={{ fontSize: '9px', fontWeight: '700', color: '#22c55e', marginTop: '2px' }}>✓ Winner</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Project Timeline Button ── */}
                    {results && (results.scheduled?.length > 0 || results.deferred?.length > 0) && (
                        <div style={{
                            ...sectionCard(isDark),
                            marginBottom: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#f1f5f9' : '#1e293b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="6" x2="16" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" />
                                </svg>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>Project Timeline</span>
                                <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                    {(results.scheduled || []).length} scheduled
                                </span>
                                {(results.deferred || []).length > 0 && (
                                    <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                                        {(results.deferred || []).length} deferred
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowGantt(true)}
                                style={{
                                    padding: '6px 16px', fontSize: '11px', fontWeight: '700',
                                    borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    color: 'white', boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Open Gantt View →
                            </button>
                        </div>
                    )}

                    {/* ── Gantt Full-Screen Modal ── */}
                    {showGantt && results && (() => {
                        const allProjects = [
                            ...(results.scheduled || []).map(p => ({ ...p, _status: 'scheduled' })),
                            ...(results.deferred || []).map(p => ({ ...p, _status: 'deferred' }))
                        ];
                        if (allProjects.length === 0) return null;

                        // Compute global date range
                        let minDate = Infinity, maxDate = -Infinity;
                        allProjects.forEach(p => {
                            const dates = [p.kickOff, p.launch, p.proposedStart, p.proposedEnd, p.start, p.end].filter(Boolean);
                            dates.forEach(d => {
                                const t = new Date(d).getTime();
                                if (!isNaN(t)) {
                                    if (t < minDate) minDate = t;
                                    if (t > maxDate) maxDate = t;
                                }
                            });
                        });
                        if (minDate === Infinity) return null;

                        // Add 2 weeks padding on each side
                        const pad = 14 * 86400000;
                        minDate -= pad;
                        maxDate += pad;
                        const totalMs = maxDate - minDate;

                        const toPct = (dateStr) => {
                            if (!dateStr) return null;
                            const t = new Date(dateStr).getTime();
                            if (isNaN(t)) return null;
                            return ((t - minDate) / totalMs) * 100;
                        };

                        // Sort / group logic
                        let grouped = {};
                        if (ganttGroupBy === 'squad') {
                            allProjects.forEach(p => {
                                const key = p.squad || p.squadName || 'Unassigned';
                                if (!grouped[key]) grouped[key] = [];
                                grouped[key].push(p);
                            });
                        } else if (ganttGroupBy === 'customer') {
                            allProjects.forEach(p => {
                                const key = p.customer || 'Unknown';
                                if (!grouped[key]) grouped[key] = [];
                                grouped[key].push(p);
                            });
                        } else {
                            grouped = { '': allProjects };
                        }

                        // Sort within groups by original start date
                        Object.values(grouped).forEach(arr => {
                            arr.sort((a, b) => {
                                const aDate = new Date(a.kickOff || a.start || a.proposedStart || '2099-01-01').getTime();
                                const bDate = new Date(b.kickOff || b.start || b.proposedStart || '2099-01-01').getTime();
                                return aDate - bDate;
                            });
                        });

                        // Sort group keys alphabetically (but "" first for chronological)
                        const groupKeys = Object.keys(grouped).sort((a, b) => {
                            if (a === '') return -1;
                            if (b === '') return 1;
                            return a.localeCompare(b);
                        });

                        // Generate month markers
                        const monthMarkers = [];
                        const startMonth = new Date(minDate);
                        startMonth.setDate(1);
                        startMonth.setHours(0, 0, 0, 0);
                        let cur = new Date(startMonth);
                        while (cur.getTime() <= maxDate) {
                            const pct = ((cur.getTime() - minDate) / totalMs) * 100;
                            if (pct >= 0 && pct <= 100) {
                                monthMarkers.push({
                                    pct,
                                    label: cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                                });
                            }
                            cur.setMonth(cur.getMonth() + 1);
                        }

                        // Today marker
                        const todayPct = ((Date.now() - minDate) / totalMs) * 100;

                        const ROW_HEIGHT = 28;
                        const barColors = {
                            shifted: '#3b82f6',
                            noChange: '#22c55e',
                            deferred: '#ef4444',
                            compressed: '#8b5cf6',
                            nudge: '#f59e0b'
                        };

                        const totalRows = allProjects.length + (ganttGroupBy !== 'chronological' ? groupKeys.length : 0);

                        return (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                zIndex: 9999,
                                backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
                                display: 'flex', flexDirection: 'column',
                                animation: 'fadeIn 0.2s ease'
                            }}
                                onClick={(e) => { if (e.target === e.currentTarget) setShowGantt(false); }}
                            >
                                {/* Modal content */}
                                <div style={{
                                    margin: '20px',
                                    flex: 1,
                                    display: 'flex', flexDirection: 'column',
                                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                    borderRadius: '16px',
                                    boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                                    overflow: 'hidden'
                                }}>
                                    {/* Header bar */}
                                    <div style={{
                                        padding: '16px 20px',
                                        borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        flexShrink: 0
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#f1f5f9' : '#1e293b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="4" y1="6" x2="16" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" />
                                        </svg>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: isDark ? '#f1f5f9' : '#1e293b' }}>Project Timeline</span>
                                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                            {allProjects.filter(p => p._status === 'scheduled').length} scheduled
                                        </span>
                                        {(results.deferred || []).length > 0 && (
                                            <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                                                {(results.deferred || []).length} deferred
                                            </span>
                                        )}

                                        {/* Group-by toggles */}
                                        <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
                                            {['chronological', 'squad', 'customer'].map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setGanttGroupBy(g)}
                                                    style={{
                                                        padding: '4px 12px', fontSize: '10px', fontWeight: '600',
                                                        borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                        textTransform: 'capitalize',
                                                        backgroundColor: ganttGroupBy === g
                                                            ? '#3b82f6'
                                                            : (isDark ? '#1e293b' : '#f1f5f9'),
                                                        color: ganttGroupBy === g ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {g === 'chronological' ? '📅 Chronological' : g === 'squad' ? '👥 By Squad' : '🏢 By Customer'}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Legend */}
                                        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                                            {[
                                                { color: '#94a3b8', label: 'Original', dashed: true },
                                                { color: barColors.noChange, label: 'Unchanged' },
                                                { color: barColors.shifted, label: 'Shifted' },
                                                { color: barColors.compressed, label: 'Compressed' },
                                                { color: barColors.deferred, label: 'Deferred' }
                                            ].map(l => (
                                                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                    <div style={{
                                                        width: '14px', height: '5px', borderRadius: '3px',
                                                        backgroundColor: l.dashed ? 'transparent' : l.color,
                                                        border: l.dashed ? `1.5px dashed ${l.color}` : 'none',
                                                        opacity: l.dashed ? 0.6 : 0.85
                                                    }} />
                                                    {l.label}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Close button */}
                                        <button
                                            onClick={() => setShowGantt(false)}
                                            style={{
                                                marginLeft: '12px',
                                                width: '30px', height: '30px',
                                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                color: isDark ? '#94a3b8' : '#64748b',
                                                fontSize: '16px', fontWeight: '700',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {/* Chart area */}
                                    <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
                                        {/* Left labels */}
                                        <div style={{
                                            minWidth: '200px', maxWidth: '200px', flexShrink: 0,
                                            borderRight: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                            overflowY: 'auto',
                                            paddingTop: '24px'
                                        }}>
                                            {groupKeys.map(groupKey => (
                                                <div key={groupKey || '__chrono'}>
                                                    {groupKey && (
                                                        <div style={{
                                                            height: ROW_HEIGHT,
                                                            display: 'flex', alignItems: 'center',
                                                            padding: '0 12px',
                                                            fontSize: '10px', fontWeight: '800',
                                                            color: isDark ? '#f1f5f9' : '#1e293b',
                                                            textTransform: 'uppercase', letterSpacing: '0.3px',
                                                            backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
                                                            borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                            position: 'sticky', top: 0, zIndex: 1
                                                        }}>
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupKey}</span>
                                                        </div>
                                                    )}
                                                    {grouped[groupKey].map(p => (
                                                        <div key={p.id} style={{
                                                            height: ROW_HEIGHT,
                                                            display: 'flex', alignItems: 'center',
                                                            padding: '0 12px',
                                                            borderBottom: `1px solid ${isDark ? '#1e293b' : '#f8fafc'}`,
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                <span style={{
                                                                    fontSize: '10px', fontWeight: '600',
                                                                    color: p._status === 'deferred' ? '#ef4444' : (isDark ? '#e2e8f0' : '#334155'),
                                                                    textDecoration: p._status === 'deferred' ? 'line-through' : 'none'
                                                                }}>
                                                                    {p.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Right chart area */}
                                        <div style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'auto' }}>
                                            {/* Month header */}
                                            <div style={{
                                                position: 'sticky', top: 0, zIndex: 3,
                                                height: '24px',
                                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                backgroundColor: isDark ? '#0f172a' : '#ffffff'
                                            }}>
                                                {monthMarkers.map((m, i) => (
                                                    <span key={i} style={{
                                                        position: 'absolute',
                                                        left: `${m.pct}%`,
                                                        fontSize: '9px', fontWeight: '700',
                                                        color: isDark ? '#64748b' : '#94a3b8',
                                                        textTransform: 'uppercase', letterSpacing: '0.3px',
                                                        transform: 'translateX(-50%)',
                                                        top: '6px', whiteSpace: 'nowrap'
                                                    }}>
                                                        {m.label}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Grid lines & today */}
                                            {monthMarkers.map((m, i) => (
                                                <div key={`gl-${i}`} style={{
                                                    position: 'absolute', left: `${m.pct}%`, top: '24px', bottom: 0,
                                                    width: '1px',
                                                    backgroundColor: isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.6)'
                                                }} />
                                            ))}
                                            {todayPct >= 0 && todayPct <= 100 && (
                                                <div style={{
                                                    position: 'absolute', left: `${todayPct}%`, top: '24px', bottom: 0,
                                                    width: '2px',
                                                    background: 'linear-gradient(180deg, #FF6B35 0%, rgba(255,107,53,0.2) 100%)',
                                                    zIndex: 2
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', top: '-2px', left: '-8px',
                                                        fontSize: '7px', fontWeight: '800', color: '#FF6B35',
                                                        whiteSpace: 'nowrap'
                                                    }}>TODAY</div>
                                                </div>
                                            )}

                                            {/* Project bars */}
                                            <div style={{ paddingTop: '0px' }}>
                                                {(() => {
                                                    let rowIdx = 0;
                                                    return groupKeys.map(groupKey => (
                                                        <div key={groupKey || '__chrono'}>
                                                            {groupKey && (() => {
                                                                const idx = rowIdx++;
                                                                return (
                                                                    <div style={{
                                                                        position: 'relative',
                                                                        height: ROW_HEIGHT,
                                                                        backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
                                                                        borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`
                                                                    }} />
                                                                );
                                                            })()}
                                                            {grouped[groupKey].map(p => {
                                                                const idx = rowIdx++;
                                                                const origStart = toPct(p.kickOff || p.start);
                                                                const origEnd = toPct(p.launch || p.end);
                                                                const newStart = toPct(p.proposedStart);
                                                                const newEnd = toPct(p.proposedEnd);
                                                                const isDeferred = p._status === 'deferred';
                                                                const hasShift = (p.shiftWeeks || 0) !== 0;
                                                                const isCompressed = !!p._compression;
                                                                const isNudge = !!p._dateNudge;

                                                                let barColor = barColors.noChange;
                                                                if (isDeferred) barColor = barColors.deferred;
                                                                else if (isCompressed) barColor = barColors.compressed;
                                                                else if (isNudge) barColor = barColors.nudge;
                                                                else if (hasShift) barColor = barColors.shifted;

                                                                const showOrigBar = origStart != null && origEnd != null && (hasShift || isCompressed || isNudge);
                                                                const showNewBar = newStart != null && newEnd != null && !isDeferred;
                                                                const showOnlyOrig = (origStart != null && origEnd != null) && !showNewBar;

                                                                return (
                                                                    <div key={p.id} style={{
                                                                        position: 'relative',
                                                                        height: ROW_HEIGHT,
                                                                        borderBottom: `1px solid ${isDark ? '#1e293b' : '#f8fafc'}`
                                                                    }}>
                                                                        {showOrigBar && (
                                                                            <div
                                                                                title={`Original: ${p.kickOff || p.start} → ${p.launch || p.end}`}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    left: `${origStart}%`,
                                                                                    width: `${Math.max(origEnd - origStart, 0.3)}%`,
                                                                                    top: '5px', height: '7px', borderRadius: '3px',
                                                                                    border: `1.5px dashed ${isDark ? '#475569' : '#94a3b8'}`,
                                                                                    opacity: 0.5
                                                                                }}
                                                                            />
                                                                        )}
                                                                        {showNewBar && (
                                                                            <div
                                                                                title={`${p.name}\nProposed: ${p.proposedStart} → ${p.proposedEnd}${hasShift ? `\nShift: ${p.shiftWeeks > 0 ? '+' : ''}${p.shiftWeeks}w` : ''}`}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    left: `${newStart}%`,
                                                                                    width: `${Math.max(newEnd - newStart, 0.3)}%`,
                                                                                    top: showOrigBar ? '14px' : '9px',
                                                                                    height: '9px', borderRadius: '4px',
                                                                                    backgroundColor: barColor,
                                                                                    opacity: 0.85,
                                                                                    transition: 'all 0.3s',
                                                                                    cursor: 'default'
                                                                                }}
                                                                            />
                                                                        )}
                                                                        {isDeferred && origStart != null && origEnd != null && (
                                                                            <div
                                                                                title={`Deferred: ${p.name}`}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    left: `${origStart}%`,
                                                                                    width: `${Math.max(origEnd - origStart, 0.3)}%`,
                                                                                    top: '10px', height: '8px', borderRadius: '4px',
                                                                                    backgroundColor: barColors.deferred,
                                                                                    opacity: 0.3,
                                                                                    backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 5px)'
                                                                                }}
                                                                            />
                                                                        )}
                                                                        {showOnlyOrig && !isDeferred && (
                                                                            <div
                                                                                title={`${p.name}: ${p.kickOff || p.start} → ${p.launch || p.end} (unchanged)`}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    left: `${origStart}%`,
                                                                                    width: `${Math.max(origEnd - origStart, 0.3)}%`,
                                                                                    top: '9px', height: '9px', borderRadius: '4px',
                                                                                    backgroundColor: barColors.noChange,
                                                                                    opacity: 0.65
                                                                                }}
                                                                            />
                                                                        )}
                                                                        {showNewBar && hasShift && newEnd != null && (
                                                                            <span style={{
                                                                                position: 'absolute',
                                                                                left: `${Math.min(newEnd + 0.3, 98)}%`,
                                                                                top: showOrigBar ? '13px' : '8px',
                                                                                fontSize: '8px', fontWeight: '800',
                                                                                color: barColor,
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {p.shiftWeeks > 0 ? '+' : ''}{p.shiftWeeks}w
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── Financial Impact (Multi-FY) ── */}
                    {financialImpact && (
                        <div style={{
                            ...sectionCard(isDark),
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', marginBottom: '14px'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    💷 Financial Impact by FY
                                </div>
                                <div style={{ flex: 1 }} />
                                <button
                                    onClick={() => setShowFinancialDetail(!showFinancialDetail)}
                                    style={{
                                        padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                        borderRadius: '6px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                        backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {showFinancialDetail ? 'Hide Detail' : 'Show Detail'}
                                </button>
                            </div>

                            {/* FY Table */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                Metric
                                            </th>
                                            {financialImpact.fyBreakdown.map(row => (
                                                <th key={row.fy} style={{ textAlign: 'right', padding: '6px 8px', fontSize: '10px', fontWeight: '700', color: row.fy === 'Unscheduled' ? '#ef4444' : (isDark ? '#94a3b8' : '#64748b'), textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, whiteSpace: 'nowrap' }}>
                                                    {row.fy}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Delta Rows (always visible) */}
                                        {[
                                            { label: 'ARR Δ', key: 'arr', icon: '📈' },
                                            { label: 'Impl Fee Δ', key: 'implFee', icon: '🧾' },
                                            { label: 'Total Δ', key: 'total', icon: '💰' }
                                        ].map(metric => (
                                            <tr key={metric.key} style={{ borderBottom: metric.key === 'total' ? `2px solid ${isDark ? '#475569' : '#cbd5e1'}` : 'none' }}>
                                                <td style={{ padding: '8px', fontWeight: metric.key === 'total' ? '800' : '600', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                    {metric.icon} {metric.label}
                                                </td>
                                                {financialImpact.fyBreakdown.map(row => {
                                                    const val = row.delta[metric.key];
                                                    const isZero = Math.abs(val) < 1;
                                                    return (
                                                        <td key={row.fy} style={{
                                                            textAlign: 'right', padding: '8px',
                                                            fontWeight: metric.key === 'total' ? '800' : '600',
                                                            fontVariantNumeric: 'tabular-nums',
                                                            color: isZero
                                                                ? (isDark ? '#475569' : '#cbd5e1')
                                                                : val > 0 ? '#22c55e' : '#ef4444'
                                                        }}>
                                                            {isZero ? '—' : `${val > 0 ? '+' : ''}£${(val / 1000).toFixed(0)}k`}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                        {/* Detailed Baseline / Optimised rows (expandable) */}
                                        {showFinancialDetail && (
                                            <>
                                                <tr><td colSpan={financialImpact.fyBreakdown.length + 1} style={{ padding: '6px 0' }}><div style={{ borderTop: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}` }} /></td></tr>
                                                {[
                                                    { label: 'Baseline ARR', src: 'baseline', key: 'arr' },
                                                    { label: 'Optimised ARR', src: 'optimised', key: 'arr' },
                                                    { label: 'Baseline Impl', src: 'baseline', key: 'implFee' },
                                                    { label: 'Optimised Impl', src: 'optimised', key: 'implFee' },
                                                    { label: 'Baseline Total', src: 'baseline', key: 'total' },
                                                    { label: 'Optimised Total', src: 'optimised', key: 'total' }
                                                ].map(metric => (
                                                    <tr key={`${metric.src}-${metric.key}`} style={{ opacity: 0.7 }}>
                                                        <td style={{ padding: '5px 8px', fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                            {metric.src === 'optimised' ? '↳ ' : ''}{metric.label}
                                                        </td>
                                                        {financialImpact.fyBreakdown.map(row => {
                                                            const val = row[metric.src][metric.key];
                                                            return (
                                                                <td key={row.fy} style={{ textAlign: 'right', padding: '5px 8px', fontSize: '10px', fontVariantNumeric: 'tabular-nums', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                    {val > 0 ? `£${(val / 1000).toFixed(0)}k` : '—'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Grand Totals Bar */}
                            <div style={{
                                display: 'flex', gap: '12px', marginTop: '12px', padding: '10px 14px',
                                borderRadius: '10px',
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
                            }}>
                                {[
                                    { label: 'Total ARR Δ', val: financialImpact.totals.delta.arr },
                                    { label: 'Total Impl Δ', val: financialImpact.totals.delta.implFee },
                                    { label: 'Net Impact', val: financialImpact.totals.delta.total }
                                ].map(t => (
                                    <div key={t.label} style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: '16px', fontWeight: '800',
                                            color: Math.abs(t.val) < 1 ? (isDark ? '#475569' : '#cbd5e1') : t.val > 0 ? '#22c55e' : '#ef4444'
                                        }}>
                                            {Math.abs(t.val) < 1 ? '—' : `${t.val > 0 ? '+' : ''}£${(t.val / 1000).toFixed(0)}k`}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {t.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Reasoning Panel */}
                    {(aiLoading || aiReasoning) && (
                        <div style={{
                            ...sectionCard(isDark),
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(91,33,182,0.15), rgba(139,92,246,0.08))'
                                : 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(168,85,247,0.04))',
                            border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)'}`
                        }}>
                            <div style={sectionTitle(isDark)}>
                                <span style={{ fontSize: '16px' }}>🤖</span>
                                AI Strategic Reasoning
                                {aiLoading && (
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: '400',
                                        color: '#8b5cf6',
                                        marginLeft: '8px',
                                        animation: 'pulse 1.5s ease-in-out infinite'
                                    }}>
                                        Thinking...
                                    </span>
                                )}
                            </div>
                            {aiReasoning ? (
                                <div style={{
                                    fontSize: '13px',
                                    lineHeight: '1.6',
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {aiReasoning}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            flex: 1,
                                            height: '12px',
                                            borderRadius: '6px',
                                            backgroundColor: isDark ? '#334155' : '#e2e8f0',
                                            animation: `pulse 1.5s ease-in-out infinite ${i * 0.3}s`
                                        }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Advanced Analytics Panels ── */}
                    {monteCarloResult && (
                        <div style={{
                            ...sectionCard(isDark),
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.06))'
                                : 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(59,130,246,0.04))',
                            border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.2)'}`
                        }}>
                            <div style={sectionTitle(isDark)}>
                                <span style={{ fontSize: '16px' }}>🎲</span>
                                Plan Robustness (Monte Carlo)
                                <span style={{
                                    marginLeft: 'auto',
                                    fontSize: '10px',
                                    fontWeight: '500',
                                    color: isDark ? '#64748b' : '#94a3b8'
                                }}>
                                    {monteCarloResult.simulations} simulations
                                </span>
                            </div>

                            {/* Robustness score gauge */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
                                {/* Circular gauge */}
                                <div style={{
                                    position: 'relative',
                                    width: '72px',
                                    height: '72px',
                                    flexShrink: 0
                                }}>
                                    <svg width="72" height="72" viewBox="0 0 72 72">
                                        <circle cx="36" cy="36" r="30" fill="none" stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                                        <circle
                                            cx="36" cy="36" r="30" fill="none"
                                            stroke={monteCarloResult.robustnessScore >= 80 ? '#22c55e' : monteCarloResult.robustnessScore >= 60 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="6"
                                            strokeDasharray={`${monteCarloResult.robustnessScore * 1.884} 188.4`}
                                            strokeLinecap="round"
                                            transform="rotate(-90 36 36)"
                                            style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                        />
                                    </svg>
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                        fontSize: '18px', fontWeight: '800',
                                        color: monteCarloResult.robustnessScore >= 80 ? '#22c55e' : monteCarloResult.robustnessScore >= 60 ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {monteCarloResult.robustnessScore}%
                                    </div>
                                </div>

                                {/* Stats + interpretation */}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: '13px', fontWeight: '700',
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        marginBottom: '4px'
                                    }}>
                                        {monteCarloResult.interpretation}
                                    </div>
                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '6px', lineHeight: '1.4' }}>
                                        We randomly varied resource capacity and project scope {monteCarloResult.simulations} times to see how many scheduled projects survive. Higher % = more resilient plan.
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                        <span title="Worst-case (10th percentile) — in 90% of scenarios, at least this many projects survive">P10: <strong>{monteCarloResult.confidence.p10}%</strong></span>
                                        <span title="Median outcome — half of simulations are above, half below">P50: <strong>{monteCarloResult.confidence.p50}%</strong></span>
                                        <span title="Best-case (90th percentile) — only 10% of scenarios do better">P90: <strong>{monteCarloResult.confidence.p90}%</strong></span>
                                    </div>

                                    {/* Risk badges */}
                                    {monteCarloResult.risks.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                            {monteCarloResult.risks.map((r, i) => (
                                                <span key={i} style={{
                                                    fontSize: '10px', fontWeight: '600',
                                                    padding: '3px 8px', borderRadius: '6px',
                                                    backgroundColor: r.severity === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                                    color: r.severity === 'high' ? '#ef4444' : '#f59e0b'
                                                }}>
                                                    {r.severity === 'high' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" style={{ marginRight: '3px', flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" stroke="white" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" /></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ marginRight: '3px', flexShrink: 0 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>} {r.message}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Volatile projects accordion */}
                            {monteCarloResult.volatileProjects?.length > 0 && (
                                <div>
                                    <div
                                        onClick={() => setShowVolatile(!showVolatile)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                                            color: '#f59e0b', padding: '6px 0'
                                        }}
                                    >
                                        <span style={{ transform: showVolatile ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                                        🫧 {monteCarloResult.volatileProjects.length} Bubble Project{monteCarloResult.volatileProjects.length !== 1 ? 's' : ''}
                                    </div>
                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', padding: '0 0 4px 20px', lineHeight: '1.4' }}>
                                        Bubble projects are currently scheduled but were dropped in some simulations when capacity was randomly reduced. A low survival % means the project is likely to slip if even a small resource disruption occurs (e.g. someone leaves or a project overruns).
                                    </div>
                                    {showVolatile && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            {monteCarloResult.volatileProjects.slice(0, 10).map(vp => (
                                                <div key={vp.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                                                    backgroundColor: isDark ? '#1e293b' : '#fefce8',
                                                    border: `1px solid ${isDark ? '#334155' : '#fde68a'}`
                                                }}>
                                                    <div style={{
                                                        width: '32px', height: '6px', borderRadius: '3px',
                                                        backgroundColor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${vp.survivalRate}%`, height: '100%',
                                                            backgroundColor: vp.survivalRate > 50 ? '#f59e0b' : '#ef4444',
                                                            borderRadius: '3px', transition: 'width 0.4s'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontWeight: '700', color: vp.survivalRate > 50 ? '#f59e0b' : '#ef4444' }}>
                                                        {vp.survivalRate}%
                                                    </span>
                                                    <span style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>{vp.name}</span>
                                                    <span style={{ color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto' }}>{vp.customer}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sensitivity Analysis */}
                    {sensitivityResult && sensitivityResult.length > 0 && (
                        <div style={{
                            ...sectionCard(isDark),
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(234,88,12,0.06))'
                                : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(234,88,12,0.04))',
                            border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)'}`
                        }}>
                            <div
                                onClick={() => setShowSensitivity(!showSensitivity)}
                                style={{ ...sectionTitle(isDark), cursor: 'pointer' }}
                            >
                                <span style={{ fontSize: '16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg></span>
                                Sensitivity Analysis
                                <span style={{
                                    marginLeft: '8px',
                                    fontSize: '10px', fontWeight: '600',
                                    padding: '2px 8px', borderRadius: '10px',
                                    backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b'
                                }}>
                                    {sensitivityResult.length} sensitive project{sensitivityResult.length !== 1 ? 's' : ''}
                                </span>
                                <span style={{
                                    marginLeft: 'auto',
                                    transform: showSensitivity ? 'rotate(90deg)' : 'rotate(0)',
                                    transition: 'transform 0.2s', display: 'inline-block', fontSize: '12px'
                                }}>▶</span>
                            </div>
                            {showSensitivity && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', padding: '2px 0 6px 0', lineHeight: '1.4' }}>
                                        Sensitivity measures how close a project is to being deferred. A higher % means the project is on the edge — a small scoring change could push it out. Tier shifts (e.g. T4→T5) show the tier a project would drop to with a 10% score reduction.
                                    </div>
                                    {sensitivityResult.slice(0, 8).map(sp => (
                                        <div key={sp.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                                            backgroundColor: isDark ? '#1e293b' : '#fffbeb',
                                            border: `1px solid ${isDark ? '#334155' : '#fde68a'}`
                                        }}>
                                            <span style={{
                                                fontWeight: '800', fontSize: '12px', minWidth: '28px',
                                                color: sp.sensitivity >= 80 ? '#ef4444' : sp.sensitivity >= 50 ? '#f59e0b' : '#94a3b8'
                                            }}>
                                                {sp.sensitivity}%
                                            </span>
                                            <span style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>{sp.name}</span>
                                            {sp.tierChange && (
                                                <span style={{
                                                    fontSize: '9px', fontWeight: '600', padding: '1px 6px',
                                                    borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444'
                                                }}>
                                                    T{sp.tierChange.from}→T{sp.tierChange.to}
                                                </span>
                                            )}
                                            {sp.nearDeferral && (
                                                <span style={{
                                                    fontSize: '9px', fontWeight: '600', padding: '1px 6px',
                                                    borderRadius: '4px', backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b'
                                                }}>
                                                    Near deferral
                                                </span>
                                            )}
                                            <span style={{ color: isDark ? '#64748b' : '#94a3b8', marginLeft: 'auto', fontSize: '10px' }}>
                                                Score: {sp.score} · Gap: {sp.distToDefer}pts
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Strategy Comparison (Pareto-style) */}
                    {strategyResult && (
                        <div style={{
                            ...sectionCard(isDark),
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))'
                                : 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.04))',
                            border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)'}`
                        }}>
                            <div
                                onClick={() => setShowStrategies(!showStrategies)}
                                style={{ ...sectionTitle(isDark), cursor: 'pointer' }}
                            >
                                <span style={{ fontSize: '16px' }}>⚖️</span>
                                Strategy Trade-offs
                                <span style={{
                                    marginLeft: '8px',
                                    fontSize: '10px', fontWeight: '600',
                                    padding: '2px 8px', borderRadius: '10px',
                                    backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6'
                                }}>
                                    {strategyResult.strategies.length} strategies compared
                                </span>
                                <span style={{
                                    marginLeft: 'auto',
                                    transform: showStrategies ? 'rotate(90deg)' : 'rotate(0)',
                                    transition: 'transform 0.2s', display: 'inline-block', fontSize: '12px'
                                }}>▶</span>
                            </div>
                            {showStrategies && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {strategyResult.strategies.map(s => {
                                        const badges = [];
                                        if (strategyResult.bestByMetric.mostProjects === s.key) badges.push('Most Projects');
                                        if (strategyResult.bestByMetric.highestArr === s.key) badges.push('Highest ARR');
                                        if (strategyResult.bestByMetric.leastDelay === s.key) badges.push('Least Delay');
                                        if (strategyResult.bestByMetric.fewestWarnings === s.key) badges.push('Fewest Warnings');
                                        return (
                                            <div key={s.key} style={{
                                                padding: '12px', borderRadius: '12px',
                                                backgroundColor: isDark ? '#1e293b' : 'white',
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '16px' }}>{s.icon}</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: s.color }}>{s.name}</span>
                                                </div>
                                                <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                                                    {s.description}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                                                    <div>
                                                        <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Scheduled </span>
                                                        <strong style={{ color: '#22c55e' }}>{s.stats.projectsScheduled}</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Deferred </span>
                                                        <strong style={{ color: '#f59e0b' }}>{s.stats.projectsDeferred}</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>ARR </span>
                                                        <strong style={{ color: '#00BD00' }}>£{(s.stats.totalArrProtected / 1000).toFixed(0)}k</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Avg Shift </span>
                                                        <strong>{s.stats.avgShiftWeeks}w</strong>
                                                    </div>
                                                </div>
                                                {badges.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                        {badges.map(b => (
                                                            <span key={b} style={{
                                                                fontSize: '9px', fontWeight: '700',
                                                                padding: '2px 6px', borderRadius: '6px',
                                                                backgroundColor: `${s.color}18`,
                                                                color: s.color
                                                            }}>
                                                                {b}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Iteration Convergence + Squad Merge Toolbar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '14px', flexWrap: 'wrap'
                    }}>
                        {iterationCount > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '8px',
                                backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : '#faf5ff',
                                border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : '#e9d5ff'}`,
                                fontSize: '11px', fontWeight: '600', color: '#7637E3'
                            }}>
                                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg></span>
                                Converged in {iterationCount} iteration{iterationCount !== 1 ? 's' : ''}
                            </div>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMergePanel(!showMergePanel); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '8px',
                                fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                backgroundColor: showMergePanel ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'transparent',
                                color: showMergePanel ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b'),
                                transition: 'all 0.2s'
                            }}
                        >
                            <MergeIcon /> Squad Merge ({mergeGroups.length} group{mergeGroups.length !== 1 ? 's' : ''})
                        </button>
                        {/* Resourced count */}
                        {Object.keys(resourceAssignments).length > 0 && (
                            <span style={{
                                fontSize: '11px', fontWeight: '600', color: '#22c55e',
                                padding: '6px 12px', borderRadius: '8px',
                                backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4',
                                border: `1px solid ${isDark ? 'rgba(34,197,94,0.2)' : '#bbf7d0'}`
                            }}>
                                ✅ {Object.values(resourceAssignments).filter(pa => pa.pm?.length > 0 || pa.sc?.length > 0 || pa.pd?.length > 0).length} / {results?.scheduled?.length || 0} resourced
                            </span>
                        )}
                    </div>

                    {/* Squad Merge Panel */}
                    {showMergePanel && (
                        <div style={{
                            padding: '14px', borderRadius: '12px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            marginBottom: '14px'
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '8px' }}>
                                🔗 Squad Merge Groups
                                <span style={{ fontWeight: '400', fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                                    Squads in the same group share a resource pool
                                </span>
                            </div>
                            {mergeGroups.map((group, gi) => (
                                <div key={gi} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 10px', borderRadius: '8px',
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    marginBottom: '6px', flexWrap: 'wrap'
                                }}>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', minWidth: '50px' }}>{group.size > 0 ? Array.from(group).join(' + ') : `Pool ${gi + 1}`}</span>
                                    {Array.from(group).map(sq => (
                                        <span
                                            key={sq}
                                            onClick={() => {
                                                setMergeGroups(prev => {
                                                    const next = prev.map((g, i) => {
                                                        if (i === gi) { const ns = new Set(g); ns.delete(sq); return ns; }
                                                        return g;
                                                    }).filter(g => g.size > 0);
                                                    return next.length > 0 ? next : [new Set()];
                                                });
                                            }}
                                            style={{
                                                padding: '3px 8px', borderRadius: '6px', fontSize: '10px',
                                                fontWeight: '600', cursor: 'pointer',
                                                backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                                                color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)'
                                            }}
                                        >
                                            {sq} ✕
                                        </span>
                                    ))}
                                    {/* Add squad button */}
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const sq = e.target.value;
                                            if (!sq) return;
                                            setMergeGroups(prev => {
                                                // Remove sq from any existing group first
                                                const cleaned = prev.map(g => { const ns = new Set(g); ns.delete(sq); return ns; }).filter(g => g.size > 0);
                                                // Add to this group
                                                if (cleaned[gi]) {
                                                    cleaned[gi] = new Set([...cleaned[gi], sq]);
                                                } else {
                                                    cleaned.push(new Set([sq]));
                                                }
                                                return cleaned;
                                            });
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            padding: '3px 6px', fontSize: '10px', borderRadius: '4px',
                                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                            backgroundColor: isDark ? '#0f172a' : 'white',
                                            color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">+ Add Squad</option>
                                        {(enabledSquads || []).filter(s => !group.has(s)).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                            <button
                                onClick={() => setMergeGroups(prev => [...prev, new Set()])}
                                style={{
                                    padding: '5px 10px', fontSize: '10px', fontWeight: '600',
                                    borderRadius: '6px', border: `1px dashed ${isDark ? '#475569' : '#d1d5db'}`,
                                    backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer', marginTop: '4px'
                                }}
                            >
                                + New Pool
                            </button>
                        </div>
                    )}

                    {/* Tier Filter Chips */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <span
                            onClick={() => setSelectedTier(null)}
                            style={chipStyle(selectedTier === null, isDark ? '#94a3b8' : '#64748b', isDark)}
                        >
                            All ({results.scheduled.length})
                        </span>
                        {Object.entries(TIER_CONFIG).filter(([k]) => k !== '-1').map(([tierNum, cfg]) => {
                            const count = results.scheduled.filter(p => p._reprioritization?.tier === parseInt(tierNum)).length;
                            if (count === 0) return null;
                            return (
                                <span
                                    key={tierNum}
                                    onClick={() => setSelectedTier(parseInt(tierNum))}
                                    style={chipStyle(selectedTier === parseInt(tierNum), cfg.color, isDark)}
                                >
                                    {cfg.icon} {cfg.label} ({count})
                                </span>
                            );
                        })}
                    </div>

                    {/* Warnings */}
                    {results.warnings.length > 0 && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                            border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fcd34d'}`,
                            marginBottom: '14px',
                            fontSize: '12px',
                            color: isDark ? '#fcd34d' : '#b45309'
                        }}>
                            <strong><svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" stroke="white" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" /></svg> {results.warnings.length} Warning{results.warnings.length !== 1 ? 's' : ''}:</strong>
                            <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                                {results.warnings.slice(0, 5).map((w, i) => (
                                    <li key={i}>{w.message}</li>
                                ))}
                            </ul>
                        </div>
                    )
                    }

                    {/* Project Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredScheduled.map((project, idx) => {
                            const rep = project._reprioritization || {};
                            const tierCfg = TIER_CONFIG[rep.tier] || TIER_CONFIG[4];
                            const riskCfg = project.customerRisk ? RISK_CONFIG[project.customerRisk.toLowerCase()] : null;
                            const isExpanded = expandedProject === project.id;

                            return (
                                <div
                                    key={project.id}
                                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                                    style={{
                                        padding: '14px 18px',
                                        borderRadius: '14px',
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isExpanded ? `0 0 0 2px ${tierCfg.color}40, 0 4px 12px rgba(0,0,0,0.08)` : '0 1px 4px rgba(0,0,0,0.04)'
                                    }}
                                >
                                    {/* Main Row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Score Badge */}
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '12px',
                                            background: `linear-gradient(135deg, ${tierCfg.color}, ${tierCfg.color}cc)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <span style={{ fontSize: '15px', fontWeight: '800', color: 'white' }}>
                                                {Math.round(rep.score)}
                                            </span>
                                        </div>

                                        {/* Project Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginBottom: '2px'
                                            }}>
                                                <span style={{
                                                    fontSize: '13px',
                                                    fontWeight: '700',
                                                    color: isDark ? '#f1f5f9' : '#1e293b',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {project.name}
                                                </span>
                                                {/* Tier Chip */}
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    backgroundColor: tierCfg.bgColor,
                                                    color: tierCfg.color,
                                                    flexShrink: 0
                                                }}>
                                                    {tierCfg.icon} {tierCfg.label}
                                                </span>
                                                {/* Risk Badge */}
                                                {riskCfg && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: `${riskCfg.color}18`,
                                                        color: riskCfg.color,
                                                        flexShrink: 0
                                                    }}>
                                                        {riskCfg.icon} {riskCfg.label}
                                                    </span>
                                                )}
                                                {/* Lock Badges */}
                                                {(rep.isLaunchLocked || rep.isSquadLocked || rep.isResourcesLocked) && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7',
                                                        color: '#b45309',
                                                        flexShrink: 0
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg> {[
                                                            rep.isLaunchLocked && 'Date',
                                                            rep.isSquadLocked && 'Squad',
                                                            rep.isResourcesLocked && 'Resources'
                                                        ].filter(Boolean).join('+')}
                                                    </span>
                                                )}
                                                {/* Override badge */}
                                                {projectOverrides[project.id] && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '600', padding: '2px 6px',
                                                        borderRadius: '4px', backgroundColor: 'rgba(139,92,246,0.12)',
                                                        color: '#8b5cf6', flexShrink: 0
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> Override
                                                    </span>
                                                )}
                                                {/* Timeline strategy badges */}
                                                {project._compression > 0 && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '700', padding: '2px 6px',
                                                        borderRadius: '4px', backgroundColor: 'rgba(139,92,246,0.12)',
                                                        color: '#8b5cf6', flexShrink: 0
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: '2px', verticalAlign: 'middle' }}><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                                                        -{project._compression}w
                                                    </span>
                                                )}
                                                {project._dateNudge > 0 && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '700', padding: '2px 6px',
                                                        borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.12)',
                                                        color: '#3b82f6', flexShrink: 0
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: '2px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                        +{project._dateNudge}w
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: isDark ? '#64748b' : '#94a3b8'
                                            }}>
                                                {project.customer || 'Unknown'} · £{(project.arr || 0).toLocaleString()} cARR · {project.status}
                                            </div>

                                            {/* Dates Row */}
                                            {(() => {
                                                const origKO = project.start || project.kickOff;
                                                const origLaunch = project.end || project.launch;
                                                const newKO = project.proposedStart;
                                                const newLaunch = project.proposedEnd;
                                                const shift = project.shiftWeeks || 0;
                                                const hasShift = shift !== 0;
                                                const shiftColor = shift > 0 ? '#f59e0b' : '#22c55e';
                                                const shiftLabel = shift > 0 ? `+${shift}w` : `${shift}w`;

                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        marginTop: '4px',
                                                        fontSize: '10px',
                                                        color: isDark ? '#64748b' : '#94a3b8'
                                                    }}>
                                                        {/* Kick-off */}
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            <span style={{ fontWeight: '600' }}>KO:</span>
                                                            {hasShift && origKO ? (
                                                                <>
                                                                    <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{formatDateShort(origKO)}</span>
                                                                    <span style={{ color: shiftColor }}>→</span>
                                                                    <span style={{ fontWeight: '600', color: shiftColor }}>{formatDateShort(newKO || origKO)}</span>
                                                                </>
                                                            ) : (
                                                                <span>{formatDateShort(origKO)}</span>
                                                            )}
                                                        </span>

                                                        <span style={{ opacity: 0.3 }}>|</span>

                                                        {/* Launch */}
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            <span style={{ fontWeight: '600' }}>Launch:</span>
                                                            {hasShift && origLaunch ? (
                                                                <>
                                                                    <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{formatDateShort(origLaunch)}</span>
                                                                    <span style={{ color: shiftColor }}>→</span>
                                                                    <span style={{ fontWeight: '600', color: shiftColor }}>{formatDateShort(newLaunch || origLaunch)}</span>
                                                                </>
                                                            ) : (
                                                                <span>{formatDateShort(origLaunch)}</span>
                                                            )}
                                                        </span>

                                                        {/* Shift badge */}
                                                        {hasShift && (
                                                            <span style={{
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '9px',
                                                                fontWeight: '700',
                                                                backgroundColor: `${shiftColor}18`,
                                                                color: shiftColor,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '2px',
                                                                border: `1px solid ${shiftColor}30`
                                                            }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    {shift > 0
                                                                        ? <><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></>
                                                                        : <><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></>
                                                                    }
                                                                </svg>
                                                                {shiftLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Assignment Chips */}
                                            {project.assignments && project.assignments.length > 0 && (
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                    {project.assignments.map(a => {
                                                        const isAssigned = !!a.resourceId;
                                                        const utilColor = a.newUtil > 100 ? '#ef4444' : a.newUtil > 85 ? '#f59e0b' : '#22c55e';
                                                        return (
                                                            <span
                                                                key={a.role}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '10px',
                                                                    fontWeight: '600',
                                                                    backgroundColor: isAssigned
                                                                        ? (a.isProgramSpecialist ? 'rgba(139,92,246,0.12)' : (isDark ? '#0f172a' : '#f0fdf4'))
                                                                        : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'),
                                                                    color: isAssigned
                                                                        ? (a.isProgramSpecialist ? '#8b5cf6' : (isDark ? '#86efac' : '#16a34a'))
                                                                        : '#ef4444',
                                                                    border: `1px solid ${isAssigned
                                                                        ? (a.isProgramSpecialist ? 'rgba(139,92,246,0.3)' : (isDark ? 'rgba(34,197,94,0.2)' : '#bbf7d0'))
                                                                        : (isDark ? 'rgba(239,68,68,0.2)' : '#fecaca')
                                                                        }`
                                                                }}
                                                            >
                                                                <strong>{a.role}:</strong>
                                                                {isAssigned ? (
                                                                    <>
                                                                        {a.resourceName}
                                                                        {a.isCrossSquad && <span title={`Cross-squad: ${(a.resourceSquads || []).join(', ')} → project squad`} style={{ color: '#f59e0b', marginLeft: '2px', cursor: 'help' }}>⚠</span>}
                                                                        <span style={{ color: utilColor, fontSize: '9px' }}>
                                                                            ({a.currentUtil}%→{a.newUtil}%)
                                                                        </span>
                                                                        {a.isProgramSpecialist && <span title="Program Specialist"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg></span>}
                                                                    </>
                                                                ) : (
                                                                    <span><svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" style={{ marginRight: '2px', verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" stroke="white" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" /></svg> No match</span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Position indicator */}
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: isDark ? '#64748b' : '#94a3b8',
                                            textAlign: 'right',
                                            flexShrink: 0
                                        }}>
                                            #{idx + 1}
                                        </div>

                                        {/* Expand arrow */}
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke={isDark ? '#64748b' : '#94a3b8'}
                                            strokeWidth="2"
                                            style={{
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s',
                                                flexShrink: 0
                                            }}
                                        >
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div style={{
                                            marginTop: '12px',
                                            paddingTop: '12px',
                                            borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                        }}>
                                            {/* What-If Override Controls */}
                                            <div style={{
                                                display: 'flex',
                                                gap: '6px',
                                                marginBottom: '10px',
                                                flexWrap: 'wrap'
                                            }}>
                                                {/* Pin Tier */}
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowTierMenu(showTierMenu === project.id ? null : project.id); }}
                                                        style={{
                                                            padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                                            borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                            border: `1px solid ${projectOverrides[project.id]?.pinTier ? '#8b5cf6' : (isDark ? '#475569' : '#d1d5db')}`,
                                                            backgroundColor: projectOverrides[project.id]?.pinTier ? 'rgba(139,92,246,0.12)' : 'transparent',
                                                            color: projectOverrides[project.id]?.pinTier ? '#8b5cf6' : (isDark ? '#94a3b8' : '#64748b')
                                                        }}
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '3px' }}><line x1="12" y1="17" x2="12" y2="3" /><path d="M5 12l7 7 7-7" /></svg> {projectOverrides[project.id]?.pinTier ? `Pinned T${projectOverrides[project.id].pinTier}` : 'Pin Tier'}
                                                    </button>
                                                    {showTierMenu === project.id && (
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                                                                marginTop: '4px', padding: '4px',
                                                                borderRadius: '8px', minWidth: '120px',
                                                                backgroundColor: isDark ? '#1e293b' : 'white',
                                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                                                            }}
                                                        >
                                                            {[1, 2, 3, 4].map(t => (
                                                                <div
                                                                    key={t}
                                                                    onClick={() => {
                                                                        handleSetOverride(project.id, { pinTier: projectOverrides[project.id]?.pinTier === t ? null : t });
                                                                        setShowTierMenu(null);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 10px', fontSize: '11px', cursor: 'pointer',
                                                                        borderRadius: '6px', fontWeight: '600',
                                                                        backgroundColor: projectOverrides[project.id]?.pinTier === t ? `${TIER_CONFIG[t].color}18` : 'transparent',
                                                                        color: projectOverrides[project.id]?.pinTier === t ? TIER_CONFIG[t].color : (isDark ? '#cbd5e1' : '#475569'),
                                                                        transition: 'background-color 0.15s'
                                                                    }}
                                                                >
                                                                    {TIER_CONFIG[t].icon} Tier {t}: {TIER_CONFIG[t].label}
                                                                </div>
                                                            ))}
                                                            {projectOverrides[project.id]?.pinTier && (
                                                                <div
                                                                    onClick={() => { handleSetOverride(project.id, { pinTier: null }); setShowTierMenu(null); }}
                                                                    style={{
                                                                        padding: '6px 10px', fontSize: '11px', cursor: 'pointer',
                                                                        borderRadius: '6px', fontWeight: '600', marginTop: '2px',
                                                                        borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                        color: '#ef4444'
                                                                    }}
                                                                >
                                                                    ✕ Remove Pin
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Defer Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSetOverride(project.id, { forceDefer: true }); }}
                                                    style={{
                                                        padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                        border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                                        backgroundColor: 'transparent',
                                                        color: '#f59e0b'
                                                    }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Defer
                                                </button>

                                                {/* Lock Date Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSetOverride(project.id, { lockDate: !projectOverrides[project.id]?.lockDate });
                                                    }}
                                                    style={{
                                                        padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                        border: `1px solid ${projectOverrides[project.id]?.lockDate ? '#22c55e' : (isDark ? '#475569' : '#d1d5db')}`,
                                                        backgroundColor: projectOverrides[project.id]?.lockDate ? 'rgba(34,197,94,0.12)' : 'transparent',
                                                        color: projectOverrides[project.id]?.lockDate ? '#22c55e' : (isDark ? '#94a3b8' : '#64748b')
                                                    }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg> {projectOverrides[project.id]?.lockDate ? 'Date Locked' : 'Lock Date'}
                                                </button>
                                            </div>

                                            {/* Reasoning */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    Scoring Reasoning
                                                </div>
                                                <ul style={{
                                                    margin: '0',
                                                    paddingLeft: '16px',
                                                    fontSize: '12px',
                                                    lineHeight: '1.6',
                                                    color: isDark ? '#cbd5e1' : '#475569'
                                                }}>
                                                    {(rep.reasoning || []).map((r, i) => (
                                                        <li key={i}>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Meta grid */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '8px',
                                                fontSize: '11px'
                                            }}>
                                                <div style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc'
                                                }}>
                                                    <div style={{ fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8' }}>Max Shift</div>
                                                    <div style={{ fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>±{rep.maxShiftWeeks}w</div>
                                                </div>
                                                {project.compellingEventDate && (
                                                    <div style={{
                                                        padding: '8px 10px',
                                                        borderRadius: '8px',
                                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc'
                                                    }}>
                                                        <div style={{ fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8' }}>Event Date</div>
                                                        <div style={{ fontWeight: '700', color: '#E83F6F' }}>
                                                            {new Date(project.compellingEventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                        </div>
                                                    </div>
                                                )}
                                                <div style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc'
                                                }}>
                                                    <div style={{ fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8' }}>Countries</div>
                                                    <div style={{ fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>{project.country || '—'}</div>
                                                </div>
                                            </div>

                                            {/* ── INLINE RESOURCING ── */}
                                            <div style={{
                                                marginTop: '12px',
                                                paddingTop: '12px',
                                                borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Team Assignment
                                                    </span>
                                                    {(project.squad || project.virtualSquad) && (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '10px',
                                                            fontWeight: '600',
                                                            backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff',
                                                            color: '#3b82f6',
                                                            border: `1px solid ${isDark ? 'rgba(59,130,246,0.25)' : '#bfdbfe'}`,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px'
                                                        }}>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                                                                <path d="M9 22v-4h6v4" />
                                                                <line x1="8" y1="6" x2="8" y2="6.01" />
                                                                <line x1="16" y1="6" x2="16" y2="6.01" />
                                                                <line x1="8" y1="10" x2="8" y2="10.01" />
                                                                <line x1="16" y1="10" x2="16" y2="10.01" />
                                                                <line x1="8" y1="14" x2="8" y2="14.01" />
                                                                <line x1="16" y1="14" x2="16" y2="14.01" />
                                                            </svg>
                                                            {project.squad || project.virtualSquad}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                                    gap: '10px'
                                                }}>
                                                    {['pm', 'sc', 'pd'].map(role => {
                                                        const pa = resourceAssignments[project.id] || { pm: [], sc: [], pd: [] };
                                                        const members = pa[role] || [];
                                                        const isAdding = addingRole[project.id] === role;
                                                        const pool = getPoolForProject(project);
                                                        // Filter out already-assigned resources
                                                        const allAssignedIds = new Set();
                                                        Object.values(resourceAssignments).forEach(pAssign => {
                                                            ['pm', 'sc', 'pd'].forEach(r => (pAssign[r] || []).forEach(m => allAssignedIds.add(m.id)));
                                                        });
                                                        const available = pool.filter(r => !allAssignedIds.has(r.id));

                                                        return (
                                                            <div key={role} style={{
                                                                padding: '10px',
                                                                borderRadius: '10px',
                                                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                                            }}>
                                                                <div style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    marginBottom: '8px'
                                                                }}>
                                                                    <span style={{
                                                                        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                                                        color: roleColors[role], letterSpacing: '0.05em'
                                                                    }}>
                                                                        {roleLabels[role]}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAddingRole(prev => ({
                                                                                ...prev,
                                                                                [project.id]: prev[project.id] === role ? null : role
                                                                            }));
                                                                        }}
                                                                        disabled={members.length >= (role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD)}
                                                                        style={{
                                                                            width: '20px', height: '20px', borderRadius: '50%',
                                                                            border: `1.5px solid ${members.length >= (role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD) ? (isDark ? '#475569' : '#d1d5db') : roleColors[role]}`,
                                                                            backgroundColor: 'transparent',
                                                                            color: members.length >= (role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD) ? (isDark ? '#475569' : '#d1d5db') : roleColors[role],
                                                                            fontSize: '14px',
                                                                            cursor: members.length >= (role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD) ? 'not-allowed' : 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center', justifyContent: 'center',
                                                                            lineHeight: 1, padding: 0,
                                                                            opacity: members.length >= (role === 'pm' ? 1 : role === 'sc' ? maxSC : maxPD) ? 0.4 : 1
                                                                        }}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                {/* Assigned resources */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    {members.length === 0 && (
                                                                        <div style={{
                                                                            padding: '8px', textAlign: 'center',
                                                                            fontSize: '10px', color: '#94a3b8',
                                                                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                                            borderRadius: '6px', fontStyle: 'italic'
                                                                        }}>
                                                                            No {role.toUpperCase()} assigned
                                                                        </div>
                                                                    )}
                                                                    {members.map(member => (
                                                                        <ResourceChip
                                                                            key={member.id}
                                                                            member={member}
                                                                            allResources={resources}
                                                                            teamLength={members.length}
                                                                            isDark={isDark}
                                                                            onUnassign={(rid) => handleUnassign(project.id, rid, role)}
                                                                            onUpdateAllocation={(rid, pct) => handleUpdateAllocation(project.id, rid, role, pct)}
                                                                        />
                                                                    ))}
                                                                </div>

                                                                {/* Resource Picker */}
                                                                {isAdding && (
                                                                    <ResourcePicker
                                                                        role={role}
                                                                        availableResources={available}
                                                                        projectSquad={project.squad || project.virtualSquad}
                                                                        roleMapping={roleMapping}
                                                                        isDark={isDark}
                                                                        onAssign={(rid, rl, overrideData) => handleAssign(project.id, rid, rl, overrideData)}
                                                                        onClose={() => setAddingRole(prev => ({ ...prev, [project.id]: null }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Deferred Projects */}
                    {
                        results.deferred.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <div style={sectionTitle(isDark)}>
                                    <span style={{ fontSize: '16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg></span>
                                    Deferred Projects ({results.deferred.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {results.deferred.map(p => (
                                        <div key={p.id} style={{
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : '#fffbeb',
                                            border: `1px solid ${isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            fontSize: '12px'
                                        }}>
                                            <span style={{ fontWeight: '700', color: isDark ? '#fcd34d' : '#b45309', minWidth: '30px', textAlign: 'center' }}>
                                                {Math.round(p._reprioritization?.score || 0)}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                    {p.name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                    {p.deferralReason}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
                                                £{(p.arr || 0).toLocaleString()}
                                            </div>
                                            {/* Force Include Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSetOverride(p.id, { forceInclude: true, forceDefer: null });
                                                }}
                                                title="Force include in scheduling"
                                                style={{
                                                    padding: '3px 8px', fontSize: '10px', fontWeight: '600',
                                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                                    backgroundColor: projectOverrides[p.id]?.forceInclude ? 'rgba(34,197,94,0.12)' : 'transparent',
                                                    color: projectOverrides[p.id]?.forceInclude ? '#22c55e' : (isDark ? '#94a3b8' : '#64748b'),
                                                    flexShrink: 0
                                                }}
                                            >
                                                ➕ Include
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginTop: '20px',
                        paddingTop: '16px',
                        borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => {
                                setShowConfig(true);
                                // Also scroll to top of container
                                let el = configRef.current;
                                while (el) {
                                    if (el.scrollHeight > el.clientHeight + 10) { el.scrollTop = 0; break; }
                                    el = el.parentElement;
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                backgroundColor: 'transparent',
                                color: isDark ? '#94a3b8' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            ← Reconfigure
                        </button>
                        {/* Re-Optimize with Overrides */}
                        {Object.keys(projectOverrides).length > 0 && (
                            <button
                                onClick={handleRun}
                                style={{
                                    padding: '12px 20px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                                title="Re-run optimization keeping your overrides (pinned tiers, locked dates, force defer/include)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                                Re-Optimize ({Object.keys(projectOverrides).length} override{Object.keys(projectOverrides).length !== 1 ? 's' : ''})
                            </button>
                        )}
                        {/* Save / Load Snapshot to Airtable */}
                        <button
                            onClick={async () => {
                                if (!results || !base || !settings) {
                                    alert('⚠️ Missing base or settings');
                                    return;
                                }
                                try {
                                    const tableId = settings.scenariosTableId || settings[Object.keys(settings).find(k => k.toLowerCase().includes('scenario'))];
                                    if (!tableId) { alert('⚠️ Scenarios table not configured'); return; }
                                    const table = base.getTableById(tableId);
                                    if (!table) { alert('⚠️ Scenarios table not found'); return; }

                                    // Compact results for storage (strip verbose data)
                                    const compactProject = (p) => ({
                                        id: p.id, name: p.name, customer: p.customer, country: p.country,
                                        arr: p.arr || 0, status: p.status,
                                        tier: p._reprioritization?.tier, score: Math.round(p._reprioritization?.score || 0),
                                        start: p.start || p.kickOff, end: p.end || p.launch,
                                        proposedStart: p.proposedStart, proposedEnd: p.proposedEnd,
                                        shiftWeeks: p.shiftWeeks || 0,
                                        assignments: (p.assignments || []).map(a => ({
                                            role: a.role, resourceId: a.resourceId, resourceName: a.resourceName,
                                            isCrossSquad: a.isCrossSquad || false
                                        })),
                                        deferralReason: p.deferralReason,
                                        schedulingNote: p.schedulingNote
                                    });

                                    const snapshot = {
                                        _type: 'optimizerSnapshot',
                                        results: {
                                            scheduled: (results.scheduled || []).map(compactProject),
                                            deferred: (results.deferred || []).map(compactProject),
                                            warnings: (results.warnings || []).slice(0, 20),
                                            stats: results.stats
                                        },
                                        resourceAssignments,
                                        projectOverrides,
                                        iterationCount,
                                        solverMeta: solverResult?.solverMeta || null,
                                        savedAt: Date.now(),
                                        savedBy: session?.currentUser?.name || session?.currentUser?.email || 'Unknown'
                                    };

                                    const snapshotJson = JSON.stringify(snapshot);
                                    if (snapshotJson.length > 95000) {
                                        // Further compact: strip assignment names, scheduling notes
                                        snapshot.results.scheduled = snapshot.results.scheduled.map(p => ({
                                            ...p,
                                            assignments: (p.assignments || []).map(a => ({ r: a.role, id: a.resourceId, x: a.isCrossSquad || undefined })),
                                            schedulingNote: undefined
                                        }));
                                        snapshot.results.deferred = snapshot.results.deferred.map(p => ({
                                            ...p,
                                            assignments: [],
                                            schedulingNote: undefined
                                        }));
                                    }

                                    const nameField = table.getFieldByName('Name');
                                    const descField = table.getFieldByName('Description');
                                    const statusField = table.getFieldByName('Status');
                                    const changesField = table.getFieldByName('Changes JSON');
                                    const metadataField = table.getFieldByName('Metadata JSON');

                                    // Try to get overflow fields for large snapshots robustly
                                    const changes2FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_2];
                                    const changes3FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_3];
                                    let of2 = changes2FieldId ? table.getFieldByIdIfExists(changes2FieldId) : null;
                                    let of3 = changes3FieldId ? table.getFieldByIdIfExists(changes3FieldId) : null;

                                    // Fallback to name search if missing from explicit config mapping
                                    if ((!of2 || !of3) && table.fields) {
                                        for (const f of table.fields) {
                                            const fname = f.name.trim().toLowerCase();
                                            if (!of2 && fname === 'changes json 2') of2 = f;
                                            if (!of3 && fname === 'changes json 3') of3 = f;
                                        }
                                    }
                                    const overflowFields = [of2, of3].filter(Boolean);
                                    const allFields = [changesField, ...overflowFields]; // up to 3 fields

                                    const sched = results.scheduled || [];
                                    const def = results.deferred || [];
                                    const totalRoles = sched.reduce((s, p) => s + (p.assignments || []).length, 0);
                                    const filledRoles = sched.reduce((s, p) => s + (p.assignments || []).filter(a => a.resourceId).length, 0);
                                    const fillRate = totalRoles > 0 ? Math.round(filledRoles / totalRoles * 100) : 0;

                                    const snapName = `Optimizer Run ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
                                    const snapDesc = `${sched.length} scheduled, ${def.length} deferred, ${fillRate}% fill rate, £${((results.stats?.totalArrProtected || 0) / 1000).toFixed(0)}k ARR`;

                                    const fullJson = JSON.stringify(snapshot);
                                    const CHUNK_SIZE = 90000;
                                    const maxCapacity = allFields.length * CHUNK_SIZE;

                                    const recordData = {
                                        [nameField.id]: snapName,
                                        [descField.id]: snapDesc,
                                        [statusField.id]: { name: 'Snapshot' },
                                        [metadataField.id]: JSON.stringify({
                                            type: 'optimizerSnapshot',
                                            savedBy: snapshot.savedBy,
                                            savedAt: new Date().toISOString(),
                                            fillRate,
                                            scheduled: sched.length,
                                            deferred: def.length,
                                            chunks: Math.ceil(fullJson.length / CHUNK_SIZE)
                                        })
                                    };

                                    if (fullJson.length <= maxCapacity) {
                                        // Split across available fields
                                        for (let i = 0; i < allFields.length; i++) {
                                            const chunk = fullJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                                            if (chunk) recordData[allFields[i].id] = chunk;
                                        }
                                    } else {
                                        // Too large even for all fields — compact and retry
                                        snapshot.results.scheduled = snapshot.results.scheduled.map(p => ({
                                            ...p,
                                            assignments: (p.assignments || []).map(a => ({ r: a.role, id: a.resourceId, x: a.isCrossSquad || undefined })),
                                            schedulingNote: undefined
                                        }));
                                        snapshot.results.deferred = snapshot.results.deferred.map(p => ({
                                            ...p, assignments: [], schedulingNote: undefined, deferralReason: (p.deferralReason || '').slice(0, 50)
                                        }));
                                        const compactJson = JSON.stringify(snapshot);
                                        if (compactJson.length > maxCapacity) {
                                            throw new Error(`Snapshot too large (${compactJson.length} chars, capacity: ${maxCapacity}). Add more "Changes JSON" Long Text fields.`);
                                        }
                                        for (let i = 0; i < allFields.length; i++) {
                                            const chunk = compactJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                                            if (chunk) recordData[allFields[i].id] = chunk;
                                        }
                                    }

                                    await table.createRecordAsync(recordData);

                                    // Also keep localStorage as backup
                                    try { localStorage.setItem('_optimizerSnapshot', JSON.stringify(snapshot)); } catch (e) { }

                                    alert(`✅ Saved to Airtable: "${snapName}"`);
                                } catch (e) {
                                    console.error('Failed to save snapshot to Airtable:', e);
                                    // Fallback to localStorage
                                    try {
                                        const snapshot = { results, resourceAssignments, projectOverrides, iterationCount, savedAt: Date.now() };
                                        localStorage.setItem('_optimizerSnapshot', JSON.stringify(snapshot));
                                        alert('⚠️ Airtable save failed — saved locally instead\n' + e.message);
                                    } catch (e2) {
                                        alert('⚠️ Save failed: ' + e.message);
                                    }
                                }
                            }}
                            style={{
                                padding: '12px 16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)',
                                color: '#22c55e',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            title="Save optimizer results to Airtable (shared with all users)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                            Save
                        </button>
                        {/* Load Snapshot from Airtable */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={async () => {
                                    if (!base || !settings) return;
                                    try {
                                        const tableId = settings.scenariosTableId || settings[Object.keys(settings).find(k => k.toLowerCase().includes('scenario'))];
                                        if (!tableId) return;
                                        const table = base.getTableById(tableId);
                                        if (!table) return;

                                        // Query snapshots
                                        const query = await table.selectRecordsAsync({ fields: table.fields });
                                        const nameField = table.getFieldByName('Name');
                                        const statusField = table.getFieldByName('Status');
                                        const changesField = table.getFieldByName('Changes JSON');
                                        const metadataField = table.getFieldByName('Metadata JSON');
                                        const descField = table.getFieldByName('Description');

                                        const snapshots = query.records
                                            .filter(r => {
                                                const status = r.getCellValue(statusField);
                                                return status?.name === 'Snapshot';
                                            })
                                            .map(r => {
                                                let meta = {};
                                                try { meta = JSON.parse(r.getCellValueAsString(metadataField) || '{}'); } catch (e) { }
                                                return {
                                                    id: r.id,
                                                    name: r.getCellValueAsString(nameField),
                                                    description: r.getCellValueAsString(descField),
                                                    savedBy: meta.savedBy || 'Unknown',
                                                    savedAt: meta.savedAt,
                                                    fillRate: meta.fillRate,
                                                    scheduled: meta.scheduled,
                                                    deferred: meta.deferred,
                                                    _changesField: changesField
                                                };
                                            })
                                            .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
                                            .slice(0, 10);

                                        if (snapshots.length === 0) {
                                            // Try localStorage fallback
                                            try {
                                                const snap = JSON.parse(localStorage.getItem('_optimizerSnapshot'));
                                                if (snap?.results) {
                                                    const r = snap.results;
                                                    r.scheduled = (r.scheduled || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                    r.deferred = (r.deferred || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                    setResults(r);
                                                    if (snap.resourceAssignments) setResourceAssignments(snap.resourceAssignments);
                                                    if (snap.projectOverrides) setProjectOverrides(snap.projectOverrides);
                                                    if (snap.iterationCount) setIterationCount(snap.iterationCount);
                                                    alert('✅ Loaded from local storage (no Airtable snapshots found)');
                                                } else {
                                                    alert('No saved optimizer runs found');
                                                }
                                            } catch (e) {
                                                alert('No saved optimizer runs found');
                                            }
                                            query.unloadData();
                                            return;
                                        }

                                        // Show picker
                                        const choices = snapshots.map((s, i) =>
                                            `${i + 1}. ${s.name} — ${s.description || ''} (by ${s.savedBy})`
                                        ).join('\n');
                                        const pick = prompt(`Load which optimizer run?\n\n${choices}\n\nEnter number (1-${snapshots.length}):`);

                                        if (pick) {
                                            const idx = parseInt(pick) - 1;
                                            if (idx >= 0 && idx < snapshots.length) {
                                                const selected = snapshots[idx];
                                                const record = query.records.find(r => r.id === selected.id);
                                                let changesJson = record.getCellValueAsString(selected._changesField);
                                                // Try to get overflow fields for large snapshots robustly
                                                const changes2FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_2];
                                                const changes3FieldId = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_3];
                                                let of2 = changes2FieldId ? table.getFieldByIdIfExists(changes2FieldId) : null;
                                                let of3 = changes3FieldId ? table.getFieldByIdIfExists(changes3FieldId) : null;

                                                if ((!of2 || !of3) && table.fields) {
                                                    for (const f of table.fields) {
                                                        const fname = f.name.trim().toLowerCase();
                                                        if (!of2 && fname === 'changes json 2') of2 = f;
                                                        if (!of3 && fname === 'changes json 3') of3 = f;
                                                    }
                                                }
                                                const overflowFields = [of2, of3].filter(Boolean);
                                                for (const cf of overflowFields) {
                                                    const overflow = record.getCellValueAsString(cf);
                                                    if (overflow) changesJson += overflow;
                                                }
                                                const snapshot = JSON.parse(changesJson);

                                                if (snapshot?.results) {
                                                    const r = snapshot.results;
                                                    r.scheduled = (r.scheduled || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                    r.deferred = (r.deferred || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                    setResults(r);
                                                    if (snapshot.resourceAssignments) setResourceAssignments(snapshot.resourceAssignments);
                                                    if (snapshot.projectOverrides) setProjectOverrides(snapshot.projectOverrides);
                                                    if (snapshot.iterationCount) setIterationCount(snapshot.iterationCount);
                                                    if (snapshot.solverMeta) {
                                                        setSolverResult(prev => ({
                                                            ...prev,
                                                            solverMeta: snapshot.solverMeta
                                                        }));
                                                    }
                                                    alert(`✅ Loaded: "${selected.name}"`);
                                                }
                                            }
                                        }
                                        query.unloadData();
                                    } catch (e) {
                                        console.error('Failed to load snapshots:', e);
                                        // Fallback to localStorage
                                        try {
                                            const snap = JSON.parse(localStorage.getItem('_optimizerSnapshot'));
                                            if (snap?.results) {
                                                const r = snap.results;
                                                r.scheduled = (r.scheduled || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                r.deferred = (r.deferred || []).map(p => ({ ...p, assignments: p.assignments || [] }));
                                                setResults(r);
                                                if (snap.resourceAssignments) setResourceAssignments(snap.resourceAssignments);
                                                if (snap.projectOverrides) setProjectOverrides(snap.projectOverrides);
                                                if (snap.iterationCount) setIterationCount(snap.iterationCount);
                                                alert('⚠️ Airtable load failed — loaded from local storage\n' + e.message);
                                            }
                                        } catch (e2) {
                                            alert('⚠️ Load failed: ' + e.message);
                                        }
                                    }
                                }}
                                style={{
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                    backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
                                    color: '#3b82f6',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                                title="Load a saved optimizer run from Airtable"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                Load
                            </button>
                        </div>
                        {/* Export CSV */}
                        <button
                            onClick={handleExportCSV}
                            style={{
                                padding: '12px 16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)',
                                color: '#6366f1',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            CSV
                        </button>
                        {onCreateDraft && (
                            <button
                                onClick={handleCreateDraft}
                                style={{
                                    flex: 2,
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #FF6B35 0%, #E83F6F 100%)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Create Draft Scenario
                            </button>
                        )}
                    </div>
                </div >
            )
            }

            {/* Save Scenario Dialog */}
            {
                showSaveDialog && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 200,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        borderRadius: '16px'
                    }}>
                        <div style={{
                            width: '340px', padding: '24px', borderRadius: '16px',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '16px' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg> Save Scenario
                            </div>
                            <input
                                value={scenarioName}
                                onChange={(e) => setScenarioName(e.target.value)}
                                placeholder={`Scenario ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                                style={{
                                    ...inputStyle(isDark),
                                    marginBottom: '16px'
                                }}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveScenario(); }}
                            />
                            {overrideCount > 0 && (
                                <div style={{ fontSize: '11px', color: '#8b5cf6', marginBottom: '12px' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>{overrideCount} override{overrideCount !== 1 ? 's' : ''} will be saved
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => { setShowSaveDialog(false); setScenarioName(''); }}
                                    style={{
                                        flex: 1, padding: '10px', fontSize: '12px', fontWeight: '600',
                                        borderRadius: '10px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                        backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveScenario}
                                    style={{
                                        flex: 2, padding: '10px', fontSize: '12px', fontWeight: '700',
                                        borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                                        color: 'white', cursor: 'pointer'
                                    }}
                                >
                                    Save Scenario
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Load Scenario Drawer */}
            {
                showLoadDrawer && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 200,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'stretch', justifyContent: 'flex-end',
                        borderRadius: '16px'
                    }}>
                        <div style={{
                            width: '360px', padding: '20px',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            borderLeft: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', flex: 1 }}>
                                    📂 Saved Scenarios
                                </div>
                                <button
                                    onClick={() => setShowLoadDrawer(false)}
                                    style={{
                                        padding: '4px 8px', fontSize: '14px', border: 'none',
                                        backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {savedScenarios.length === 0 ? (
                                <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
                                    No saved scenarios yet. Run a reprioritization and click Save.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {savedScenarios.map(s => (
                                        <div key={s.id} style={{
                                            padding: '12px 14px', borderRadius: '12px',
                                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                            border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                            transition: 'all 0.2s'
                                        }}>
                                            {renamingScenarioId === s.id ? (
                                                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                                    <input
                                                        autoFocus
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameSavedScenario(s.id, renameValue);
                                                            if (e.key === 'Escape') setRenamingScenarioId(null);
                                                        }}
                                                        style={{
                                                            flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: '700',
                                                            borderRadius: '6px', border: `1px solid ${isDark ? '#6366f1' : '#8b5cf6'}`,
                                                            backgroundColor: isDark ? '#0f172a' : 'white',
                                                            color: isDark ? '#f1f5f9' : '#1e293b',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => handleRenameSavedScenario(s.id, renameValue)}
                                                        style={{
                                                            padding: '4px 8px', fontSize: '11px', fontWeight: '600',
                                                            borderRadius: '6px', border: 'none',
                                                            background: '#22c55e', color: 'white', cursor: 'pointer'
                                                        }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => setRenamingScenarioId(null)}
                                                        style={{
                                                            padding: '4px 8px', fontSize: '11px', fontWeight: '600',
                                                            borderRadius: '6px', border: 'none',
                                                            background: isDark ? '#374151' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer'
                                                        }}
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', flex: 1 }}>
                                                        {s.name}
                                                    </div>
                                                    <button
                                                        onClick={() => { setRenamingScenarioId(s.id); setRenameValue(s.name); }}
                                                        title="Rename"
                                                        style={{
                                                            padding: '2px 5px', fontSize: '11px', border: 'none',
                                                            backgroundColor: 'transparent', color: isDark ? '#64748b' : '#94a3b8',
                                                            cursor: 'pointer', borderRadius: '4px', lineHeight: 1
                                                        }}
                                                    ><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                                                </div>
                                            )}
                                            <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '8px' }}>
                                                {new Date(s.savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                {s.lastSavedBy && ` · by ${s.lastSavedBy}`}
                                                {s.summary && ` · ${s.summary.scheduled} scheduled · £${((s.summary.arrProtected || 0) / 1000).toFixed(0)}k ARR`}
                                                {s.overrides && Object.keys(s.overrides).length > 0 && ` · ${Object.keys(s.overrides).length} overrides`}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleLoadScenario(s)}
                                                    style={{
                                                        flex: 2, padding: '6px', fontSize: '11px', fontWeight: '600',
                                                        borderRadius: '8px', border: 'none',
                                                        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                                                        color: 'white', cursor: 'pointer'
                                                    }}
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSavedScenario(s.id)}
                                                    style={{
                                                        flex: 1, padding: '6px', fontSize: '11px', fontWeight: '600',
                                                        borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                                                        backgroundColor: 'transparent', color: '#ef4444',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

        </div >
    );
};

ReprioritizationTab.propTypes = {
    projects: PropTypes.array,
    slotMap: PropTypes.object,
    resources: PropTypes.array,
    isDark: PropTypes.bool,
    onCreateDraft: PropTypes.func,
    base: PropTypes.object,
    settings: PropTypes.object,
    onOpenProgramModal: PropTypes.func,
    scenarios: PropTypes.array
};

export default ReprioritizationTab;
