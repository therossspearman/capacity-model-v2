import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, TOKENS, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';

// SVG Icons for categories
const CategoryIcons = {
    tooling: (
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    process: (
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
    ),
    training: (
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
    ),
    automation: (
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    ),
    hiring: (
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    ),
};

const LightbulbIcon = ({ size = 14 }) => (
    <svg style={{ width: `${size}px`, height: `${size}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

const TrendingUpIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const PlusIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
);

const CATEGORIES = [
    { value: 'tooling', label: 'Tooling' },
    { value: 'process', label: 'Process' },
    { value: 'training', label: 'Training' },
    { value: 'automation', label: 'Automation' },
    { value: 'hiring', label: 'Hiring' },
];

const APPLICATION_MODES = [
    { value: 'all', label: 'All Projects' },
    { value: 'new', label: 'New Projects Only' },
];

const TARGET_TEAMS = [
    { value: 'all', label: 'All Teams' },
    { value: 'pm', label: 'PM Only' },
    { value: 'sc', label: 'SC Only' },
    { value: 'pd', label: 'PD Only' },
];

const emptyInitiative = {
    id: '',
    name: '',
    description: '',
    status: 'planned',
    launchDate: '',
    rampWeeks: 4,
    targetTeams: ['all'],
    targetPlatforms: ['all'],      // ['all'] = every platform; or specific e.g. ['FPS']
    targetProjectTypes: ['all'],   // ['all'] = every type; or specific e.g. ['Renewal']
    efficiencyPct: 10,
    applicationMode: 'all',
    enabled: true,
    category: 'tooling',
    headcountPlan: [] // Virtual headcount entries
};

const emptyHeadcount = {
    id: '',
    count: 1,
    role: 'pm',
    startDate: '',
    squad: '',
    rampProfile: '',       // Name of a profile from storedSettings.rampProfiles; empty = no ramp
    rampWeeks: 0,          // Legacy field — kept in the schema for back-compat but no longer
                           //   surfaced in the UI. The worker now honours `rampProfile` instead.
    weeklyHours: 40
};

const ROLES = [
    { value: 'pm', label: 'PM' },
    { value: 'sc', label: 'SC' },
    { value: 'pd', label: 'PD' }
];

export const InitiativesModal = ({ initiatives = [], onSave, onClose, showInitiativesEffect, onToggleEffect, allSquads = [], rampProfiles = [], availablePlatforms = [], availableProjectTypes = [] }) => {
    const { isDark, colors } = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [editingInitiative, setEditingInitiative] = useState(null);
    const [formData, setFormData] = useState(emptyInitiative);

    // Sidebar tabs
    const tabs = [
        { id: 'overview', label: 'Overview', icon: <LightbulbIcon /> },
        { id: 'manage', label: 'Manage', icon: <TrendingUpIcon /> },
    ];

    // Calculate summary stats
    const stats = useMemo(() => {
        const active = initiatives.filter(i => i.enabled && i.status === 'active');
        const planned = initiatives.filter(i => i.status === 'planned');
        // Multiplicative stacking — must mirror worker logic. Accumulator is a product, not a sum.
        const totalBoost = active.reduce((factor, i) => factor * (1 + (i.efficiencyPct || 0) / 100), 1);
        return {
            activeCount: active.length,
            plannedCount: planned.length,
            totalBoostPct: Math.round((totalBoost - 1) * 100),
            totalCount: initiatives.length
        };
    }, [initiatives]);

    const handleAddNew = () => {
        setFormData({
            ...emptyInitiative,
            id: `init_${Date.now()}`,
            launchDate: new Date().toISOString().split('T')[0]
        });
        setEditingInitiative('new');
    };

    const handleEdit = (init) => {
        setFormData({ ...init });
        setEditingInitiative(init.id);
    };

    const handleSaveForm = () => {
        const updated = editingInitiative === 'new'
            ? [...initiatives, formData]
            : initiatives.map(i => i.id === editingInitiative ? formData : i);
        onSave(updated);
        setEditingInitiative(null);
        setFormData(emptyInitiative);
    };

    const handleDelete = (id) => {
        const target = initiatives.find(i => i.id === id);
        const label = target?.name ? `"${target.name}"` : 'this initiative';
        // Destructive: removing an initiative also drops its entire headcountPlan.
        // Guard against accidental single-click deletion.
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            if (!window.confirm(`Delete ${label}? This also removes its virtual headcount and cannot be undone.`)) {
                return;
            }
        }
        onSave(initiatives.filter(i => i.id !== id));
    };

    const handleToggleEnabled = (id) => {
        onSave(initiatives.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
    };

    const handleCancel = () => {
        setEditingInitiative(null);
        setFormData(emptyInitiative);
    };

    const getCategoryIcon = (cat) => CategoryIcons[cat] || CategoryIcons.tooling;

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return BRAND.benifexGreen;
            case 'planned': return BRAND.benifexPurple;
            case 'archived': return colors.textSecondary;
            default: return colors.textMuted;
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        fontSize: '13px',
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bgAlt,
        color: colors.textPrimary,
        outline: 'none',
        boxSizing: 'border-box'
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

    // Reusable multi-select toggle group for array-valued scope fields (targetTeams,
    // targetPlatforms, targetProjectTypes). The 'all' option is exclusive; selecting a
    // specific value clears 'all', and clearing the last specific value falls back to 'all'.
    const renderScopeToggles = (field, options) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {options.map(opt => {
                const selected = (formData[field] || ['all']).includes(opt.value);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData(prev => {
                            const cur = prev[field] || ['all'];
                            if (opt.value === 'all') return { ...prev, [field]: ['all'] };
                            const isSel = cur.includes(opt.value);
                            let next = isSel ? cur.filter(v => v !== opt.value) : [...cur.filter(v => v !== 'all'), opt.value];
                            if (next.length === 0) next = ['all'];
                            return { ...prev, [field]: next };
                        })}
                        style={{
                            padding: '6px 10px', borderRadius: '8px',
                            border: selected ? '2px solid #7637E3' : '1px solid #e2e8f0',
                            backgroundColor: selected ? '#f3e8ff' : 'white',
                            color: selected ? '#5b21b6' : '#64748b',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );

    const platformOptions = [{ value: 'all', label: 'All Platforms' }, ...availablePlatforms.map(p => ({ value: p, label: p }))];
    const projectTypeOptions = [{ value: 'all', label: 'All Types' }, ...availableProjectTypes.map(t => ({ value: t, label: t }))];

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.bgOverlay,
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
                    height: '600px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: TOKENS.gradients.primary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <LightbulbIcon size={16} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Initiatives</h3>
                            <p style={{ fontSize: '10px', color: colors.textMuted, margin: 0 }}>Efficiency Modeling</p>
                        </div>
                    </div>

                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setEditingInitiative(null); }}
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
                                    color: activeTab === tab.id ? BRAND.benifexPurple : colors.textSecondary,
                                    boxShadow: activeTab === tab.id ? `0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px ${colors.border}` : 'none'
                                }}
                            >
                                <span style={{ opacity: 0.8 }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Sidebar Stats */}
                    <div style={{
                        padding: '16px',
                        backgroundColor: showInitiativesEffect ? BRAND.successLight : colors.bgCard,
                        borderRadius: '10px',
                        border: `1px solid ${showInitiativesEffect ? BRAND.benifexGreen : colors.border}`,
                        marginTop: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Effect</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={showInitiativesEffect}
                                    onChange={(e) => onToggleEffect(e.target.checked)}
                                    style={{ width: '14px', height: '14px', accentColor: BRAND.benifexPurple }}
                                />
                                <span style={{ fontSize: '10px', fontWeight: '600', color: showInitiativesEffect ? BRAND.benifexGreen : colors.textSecondary }}>
                                    {showInitiativesEffect ? 'Active' : 'Off'}
                                </span>
                            </label>
                        </div>
                        {stats.totalBoostPct > 0 ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '28px', fontWeight: '800', color: BRAND.benifexGreen, lineHeight: 1 }}>
                                    +{stats.totalBoostPct}%
                                </div>
                                <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                    Combined Efficiency
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
                                No active initiatives
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: colors.bgModal }}>
                    <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text, margin: 0 }}>
                            {editingInitiative ? (editingInitiative === 'new' ? 'New Initiative' : 'Edit Initiative') : tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <button onClick={onClose} style={{ padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: colors.textMuted }}>
                            {ICONS.CLOSE}
                        </button>
                    </div>

                    <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && !editingInitiative && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Stats Cards - Compact */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                    <div style={{ padding: '12px 16px', backgroundColor: BRAND.successLight, border: `1px solid ${BRAND.benifexGreen}40`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: BRAND.benifexGreen, textTransform: 'uppercase' }}>Active</span>
                                        <span style={{ fontSize: '24px', fontWeight: '800', color: BRAND.benifexGreen }}>{stats.activeCount}</span>
                                    </div>
                                    <div style={{ padding: '12px 16px', backgroundColor: `${BRAND.benifexPurple}10`, border: `1px solid ${BRAND.benifexPurple}30`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: BRAND.benifexPurple, textTransform: 'uppercase' }}>Planned</span>
                                        <span style={{ fontSize: '24px', fontWeight: '800', color: BRAND.benifexPurple }}>{stats.plannedCount}</span>
                                    </div>
                                    <div style={{ padding: '12px 16px', backgroundColor: `${BRAND.indigo}08`, border: `1px solid ${BRAND.indigo}20`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: BRAND.indigo, textTransform: 'uppercase' }}>Total</span>
                                        <span style={{ fontSize: '24px', fontWeight: '800', color: BRAND.indigo }}>{stats.totalCount}</span>
                                    </div>
                                </div>

                                {/* How It Works - Collapsible */}
                                <details style={{ backgroundColor: `${BRAND.benifexPurple}05`, border: `1px solid ${BRAND.benifexPurple}20`, borderRadius: '8px' }}>
                                    <summary style={{
                                        padding: '10px 14px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: BRAND.indigo,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        listStyle: 'none'
                                    }}>
                                        <svg style={{ width: '14px', height: '14px', color: BRAND.benifexPurple }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        How Initiatives Work
                                        <svg style={{ width: '12px', height: '12px', marginLeft: 'auto', color: colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <div style={{ padding: '12px 14px', paddingTop: '0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <h5 style={{ fontSize: '11px', fontWeight: '700', color: BRAND.benifexPurple, marginBottom: '4px' }}>Efficiency Boost</h5>
                                            <p style={{ fontSize: '10px', color: BRAND.indigo, margin: 0, opacity: 0.7 }}>
                                                Each initiative adds a % boost to capacity.
                                            </p>
                                        </div>
                                        <div>
                                            <h5 style={{ fontSize: '11px', fontWeight: '700', color: BRAND.benifexPurple, marginBottom: '4px' }}>Stacking</h5>
                                            <p style={{ fontSize: '10px', color: BRAND.indigo, margin: 0, opacity: 0.7 }}>
                                                Multiple initiatives stack multiplicatively.
                                            </p>
                                        </div>
                                        <div>
                                            <h5 style={{ fontSize: '11px', fontWeight: '700', color: BRAND.benifexPurple, marginBottom: '4px' }}>Ramp Period</h5>
                                            <p style={{ fontSize: '10px', color: BRAND.indigo, margin: 0, opacity: 0.7 }}>
                                                Gradual increase to full effectiveness.
                                            </p>
                                        </div>
                                        <div>
                                            <h5 style={{ fontSize: '11px', fontWeight: '700', color: BRAND.benifexPurple, marginBottom: '4px' }}>Target Teams</h5>
                                            <p style={{ fontSize: '10px', color: BRAND.indigo, margin: 0, opacity: 0.7 }}>
                                                Apply to PM, SC, PD or all teams.
                                            </p>
                                        </div>
                                    </div>
                                </details>

                                {/* Active Initiatives List */}
                                {initiatives.filter(i => i.enabled).length > 0 && (
                                    <div>
                                        <h4 style={{ fontSize: '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '12px' }}>Active Initiatives</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {initiatives.filter(i => i.enabled).map(init => (
                                                <div key={init.id} style={{
                                                    padding: '12px 16px',
                                                    backgroundColor: colors.bgCard,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ color: colors.textSecondary }}>{getCategoryIcon(init.category)}</span>
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>{init.name}</span>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: '700',
                                                            backgroundColor: getStatusColor(init.status),
                                                            color: 'white',
                                                            textTransform: 'uppercase'
                                                        }}>{init.status}</span>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: '700', color: BRAND.benifexGreen }}>+{init.efficiencyPct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manage Tab - List */}
                        {activeTab === 'manage' && !editingInitiative && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Add Button */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={handleAddNew}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                                        }}
                                    >
                                        <PlusIcon /> Add Initiative
                                    </button>
                                </div>

                                {/* Initiatives List */}
                                {initiatives.length === 0 ? (
                                    <div style={{
                                        padding: '48px',
                                        textAlign: 'center',
                                        border: `2px dashed ${colors.gridLine}`,
                                        borderRadius: '10px',
                                        color: colors.textMuted
                                    }}>
                                        <div style={{ marginBottom: '12px', opacity: 0.4 }}>
                                            <LightbulbIcon size={40} />
                                        </div>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>No initiatives yet</p>
                                        <p style={{ margin: '8px 0 0', fontSize: '12px' }}>Create your first initiative to model efficiency improvements</p>
                                    </div>
                                ) : (
                                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: colors.bgAlt, borderBottom: `1px solid ${colors.border}` }}>
                                                <tr>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px', width: '40px' }}></th>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px' }}>Name</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px' }}>Boost</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px' }}>Teams</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', fontSize: '10px', width: '100px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {initiatives.map(init => (
                                                    <tr key={init.id} style={{ borderTop: `1px solid ${colors.border}`, opacity: init.enabled ? 1 : 0.5 }}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={init.enabled}
                                                                onChange={() => handleToggleEnabled(init.id)}
                                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: colors.warning }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <span style={{ color: colors.textSecondary }}>{getCategoryIcon(init.category)}</span>
                                                                <div>
                                                                    <div style={{ fontWeight: '600', color: colors.textPrimary }}>{init.name}</div>
                                                                    <div style={{ fontSize: '10px', color: colors.textMuted }}>{init.description || 'No description'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span style={{
                                                                padding: '3px 10px',
                                                                borderRadius: '4px',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                backgroundColor: getStatusColor(init.status),
                                                                color: 'white',
                                                                textTransform: 'uppercase'
                                                            }}>{init.status}</span>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontWeight: '700', color: BRAND.benifexGreen }}>+{init.efficiencyPct}%</td>
                                                        <td style={{ padding: '12px 16px', color: colors.textSecondary }}>
                                                            {(init.targetTeams || ['all']).includes('all') ? 'All' : (init.targetTeams || []).map(t => t.toUpperCase()).join(', ')}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button
                                                                    onClick={() => handleEdit(init)}
                                                                    style={{
                                                                        padding: '6px 10px',
                                                                        borderRadius: '6px',
                                                                        border: `1px solid ${colors.border}`,
                                                                        backgroundColor: 'transparent',
                                                                        color: colors.textSecondary,
                                                                        fontSize: '11px',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >Edit</button>
                                                                <button
                                                                    onClick={() => handleDelete(init.id)}
                                                                    style={{
                                                                        padding: '6px 10px',
                                                                        borderRadius: '6px',
                                                                        border: 'none',
                                                                        backgroundColor: colors.dangerBg,
                                                                        color: colors.danger,
                                                                        fontSize: '11px',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >Delete</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Edit/Add Form */}
                        {editingInitiative && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Name & Category */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., AI Code Assistant Rollout"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            style={inputStyle}
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label style={labelStyle}>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe the initiative and its expected impact..."
                                        rows={2}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </div>

                                {/* Launch Date, Ramp, Efficiency */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Launch Date</label>
                                        <input
                                            type="date"
                                            value={formData.launchDate}
                                            onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Ramp Period (Weeks)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="52"
                                            value={formData.rampWeeks}
                                            onChange={(e) => setFormData({ ...formData, rampWeeks: Math.min(52, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Efficiency Boost (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.efficiencyPct}
                                            onChange={(e) => setFormData({ ...formData, efficiencyPct: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                {/* Target Teams & Application Mode */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Target Teams</label>
                                        {renderScopeToggles('targetTeams', TARGET_TEAMS)}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Applies To</label>
                                        <select
                                            value={formData.applicationMode}
                                            onChange={(e) => setFormData({ ...formData, applicationMode: e.target.value })}
                                            style={inputStyle}
                                        >
                                            {APPLICATION_MODES.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Platform & Project-Type scoping — when set to specific values the
                                    initiative's efficiency reduces the demand of MATCHING projects
                                    (platform AND type), instead of the global capacity boost. */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Platform</label>
                                        {renderScopeToggles('targetPlatforms', platformOptions)}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Project Type</label>
                                        {renderScopeToggles('targetProjectTypes', projectTypeOptions)}
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <label style={labelStyle}>Status</label>
                                    <div style={{ display: 'flex', backgroundColor: colors.bgAlt, borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
                                        {['planned', 'active', 'archived'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setFormData({ ...formData, status })}
                                                style={{
                                                    padding: '8px 20px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: formData.status === status ? getStatusColor(status) : 'transparent',
                                                    color: formData.status === status ? 'white' : colors.textSecondary,
                                                    textTransform: 'capitalize',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Virtual Headcount Section */}
                                <div style={{
                                    marginTop: '20px',
                                    padding: '16px',
                                    backgroundColor: `${BRAND.benifexPurple}05`,
                                    border: `1px solid ${BRAND.benifexPurple}20`,
                                    borderRadius: '10px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Virtual Headcount</label>
                                        <button
                                            onClick={() => {
                                                const newHc = {
                                                    ...emptyHeadcount,
                                                    id: `hc_${Date.now()}`,
                                                    startDate: formData.launchDate || new Date().toISOString().split('T')[0]
                                                };
                                                setFormData({
                                                    ...formData,
                                                    headcountPlan: [...(formData.headcountPlan || []), newHc]
                                                });
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: BRAND.benifexPurple,
                                                color: 'white',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <PlusIcon /> Add
                                        </button>
                                    </div>

                                    {(!formData.headcountPlan || formData.headcountPlan.length === 0) ? (
                                        <div style={{
                                            padding: '24px',
                                            textAlign: 'center',
                                            color: colors.textMuted,
                                            fontSize: '12px',
                                            border: `2px dashed ${colors.gridLine}`,
                                            borderRadius: '8px'
                                        }}>
                                            No virtual headcount added. Add resources to model future hiring.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {(formData.headcountPlan || []).map((hc, idx) => (
                                                <div key={hc.id} style={{
                                                    display: 'grid',
                                                    // Columns: role | count | startDate | squad | rampProfile | delete
                                                    // The rampProfile column widened from 70px ("wk") to 140px to fit profile names.
                                                    gridTemplateColumns: '80px 60px 130px 1fr 140px 32px',
                                                    gap: '8px',
                                                    alignItems: 'center',
                                                    padding: '10px 12px',
                                                    backgroundColor: colors.bgCard,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '8px'
                                                }}>
                                                    {/* Role */}
                                                    <select
                                                        value={hc.role}
                                                        onChange={(e) => {
                                                            const updated = [...formData.headcountPlan];
                                                            updated[idx] = { ...hc, role: e.target.value };
                                                            setFormData({ ...formData, headcountPlan: updated });
                                                        }}
                                                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                                                    >
                                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                    </select>

                                                    {/* Count */}
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="50"
                                                        value={hc.count}
                                                        onChange={(e) => {
                                                            const updated = [...formData.headcountPlan];
                                                            updated[idx] = { ...hc, count: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) };
                                                            setFormData({ ...formData, headcountPlan: updated });
                                                        }}
                                                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px', textAlign: 'center' }}
                                                        title="Count"
                                                    />

                                                    {/* Start Date */}
                                                    <input
                                                        type="date"
                                                        value={hc.startDate}
                                                        onChange={(e) => {
                                                            const updated = [...formData.headcountPlan];
                                                            updated[idx] = { ...hc, startDate: e.target.value };
                                                            setFormData({ ...formData, headcountPlan: updated });
                                                        }}
                                                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                                                        title="Start Date"
                                                    />

                                                    {/* Squad */}
                                                    <select
                                                        value={hc.squad || ''}
                                                        onChange={(e) => {
                                                            const updated = [...formData.headcountPlan];
                                                            updated[idx] = { ...hc, squad: e.target.value };
                                                            setFormData({ ...formData, headcountPlan: updated });
                                                        }}
                                                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                                                        title="Squad"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {allSquads.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>

                                                    {/* Ramp Profile — same named profiles used by real resources
                                                        (managed in Settings → Ramp Profiles). Ramp applies from
                                                        the row's Start Date; worker multiplies weekly capacity
                                                        by profile.weeks[weekIdx]/100 for the ramp duration.
                                                        Empty = no ramp (hires run at full capacity from day 1). */}
                                                    <select
                                                        value={hc.rampProfile || ''}
                                                        onChange={(e) => {
                                                            const updated = [...formData.headcountPlan];
                                                            updated[idx] = { ...hc, rampProfile: e.target.value };
                                                            setFormData({ ...formData, headcountPlan: updated });
                                                        }}
                                                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                                                        title="Ramp Profile (from Settings → Ramp Profiles). Empty means no ramp."
                                                    >
                                                        <option value="">No ramp</option>
                                                        {rampProfiles.map(p => (
                                                            <option key={p.name} value={p.name}>{p.name}</option>
                                                        ))}
                                                    </select>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                headcountPlan: formData.headcountPlan.filter((_, i) => i !== idx)
                                                            });
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: colors.dangerBg,
                                                            color: colors.danger,
                                                            cursor: 'pointer',
                                                            fontSize: '14px'
                                                        }}
                                                        title="Remove"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Summary */}
                                    {formData.headcountPlan && formData.headcountPlan.length > 0 && (
                                        <div style={{
                                            marginTop: '12px',
                                            padding: '8px 12px',
                                            backgroundColor: BRAND.successLight,
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            color: BRAND.benifexGreen,
                                            fontWeight: '600'
                                        }}>
                                            Total: {formData.headcountPlan.reduce((sum, h) => sum + (Number(h.count) || 0), 0)} virtual resource(s)
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                                    <button
                                        onClick={handleCancel}
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
                                    >Cancel</button>
                                    <button
                                        onClick={handleSaveForm}
                                        disabled={!formData.name || !formData.launchDate}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: TOKENS.gradients.primary,
                                            color: 'white',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: formData.name && formData.launchDate ? 'pointer' : 'not-allowed',
                                            opacity: formData.name && formData.launchDate ? 1 : 0.5,
                                            boxShadow: TOKENS.shadows.md
                                        }}
                                    >Save Initiative</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

InitiativesModal.propTypes = {
    initiatives: PropTypes.array,
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    showInitiativesEffect: PropTypes.bool,
    onToggleEffect: PropTypes.func,
    allSquads: PropTypes.array,
    rampProfiles: PropTypes.array
};

export default InitiativesModal;

