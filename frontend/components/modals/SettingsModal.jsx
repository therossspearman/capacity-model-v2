import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { DEFAULT_SETTINGS, ICONS, SETTINGS, APP_VERSION } from '../../constants';
import { Button } from '../ui';
import { getRollingMetrics, clearHistory } from '../../utils/AIPerformanceTracker';
import { ConfirmModal } from './ConfirmModal';

/**
 * Settings Modal - Full configuration for the capacity model
 */
export const SettingsModal = ({
    storedSettings,
    saveSettingsToTable,
    onClose,
    allFunctions,
    allSquadsFlat,
    allResources,
    allProjects = [],
    allTables = [],
    altModelFieldMapped = true,
    presenceModelFieldMapped = true
}) => {
    const { isDark, colors } = useTheme();
    const [activeTab, setActiveTab] = useState('general');
    const {
        roleMapping = DEFAULT_SETTINGS.roleMapping,
        roleConfig = DEFAULT_SETTINGS.roleConfig || { jobs: {}, constraints: {} },
        activeSquads = DEFAULT_SETTINGS.activeSquads,
        thresholds = DEFAULT_SETTINGS.thresholds,
        rampProfiles = DEFAULT_SETTINGS.rampProfiles,
        winRates = DEFAULT_SETTINGS.winRates,
        slotProfile = DEFAULT_SETTINGS.slotProfile,
        slotOptimization = DEFAULT_SETTINGS.slotOptimization,
        aiIntelligence = { tableId: null, enabled: false, autoSync: false, lastSyncTime: null }
    } = storedSettings;

    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileStr, setNewProfileStr] = useState('0, 25, 50, 75, 100');
    const [showClearAIConfirm, setShowClearAIConfirm] = useState(false);

    const functionCounts = useMemo(() => {
        const counts = {};
        allResources.forEach(r => {
            const key = r.adJobTitle || r.role;
            if (key) counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [allResources]);

    // SVG Icons for tabs - using inline styles (Tailwind classes don't work in Airtable)
    const TabIcons = {
        general: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        roles: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        squads: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        logic: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
        winrates: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        ramp: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
        slots: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
        roleConfig: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        ai: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        programs: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        altModel: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-3M9 14l2 2 4-4" /></svg>,
        utilization: <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    };

    const tabs = [
        { id: 'general', label: 'General', icon: TabIcons.general },
        { id: 'utilization', label: 'Utilization Model', icon: TabIcons.utilization },
        { id: 'altModel', label: 'Alternative Model', icon: TabIcons.altModel },
        { id: 'roles', label: 'Role Mapping', icon: TabIcons.roles },
        { id: 'roleConfig', label: 'Role Config', icon: TabIcons.roleConfig },
        { id: 'squads', label: 'Squads', icon: TabIcons.squads },
        { id: 'logic', label: 'Model Logic', icon: TabIcons.logic },
        { id: 'winrates', label: 'Win Rates', icon: TabIcons.winrates },
        { id: 'ramp', label: 'Ramp Up', icon: TabIcons.ramp },
        { id: 'slots', label: 'Delivery Slots', icon: TabIcons.slots },
        { id: 'programs', label: 'Programs', icon: TabIcons.programs },
        { id: 'ai', label: 'AI Intelligence', icon: TabIcons.ai }
    ];

    const handleAddProfile = () => {
        if (!newProfileName) return;
        const weeks = newProfileStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const newProfiles = [...rampProfiles, { name: newProfileName, weeks }];
        saveSettingsToTable({ ...storedSettings, rampProfiles: newProfiles });
        setNewProfileName('');
        setNewProfileStr('0, 25, 50, 75, 100');
    };

    const handleDeleteProfile = (idx) => {
        const newProfiles = [...rampProfiles];
        newProfiles.splice(idx, 1);
        saveSettingsToTable({ ...storedSettings, rampProfiles: newProfiles });
    };

    // Editing state for ramp profiles
    const [editingProfileIdx, setEditingProfileIdx] = useState(null);
    const [editProfileName, setEditProfileName] = useState('');
    const [editProfileWeeks, setEditProfileWeeks] = useState('');

    const handleStartEdit = (idx) => {
        const profile = rampProfiles[idx];
        setEditingProfileIdx(idx);
        setEditProfileName(profile.name);
        setEditProfileWeeks(profile.weeks.join(', '));
    };

    const handleSaveEdit = () => {
        if (editingProfileIdx === null) return;
        const weeks = editProfileWeeks.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const newProfiles = [...rampProfiles];
        newProfiles[editingProfileIdx] = { name: editProfileName, weeks };
        saveSettingsToTable({ ...storedSettings, rampProfiles: newProfiles });
        setEditingProfileIdx(null);
    };

    const handleCancelEdit = () => {
        setEditingProfileIdx(null);
    };

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
                        height: '600px',
                        display: 'flex',
                        overflow: 'hidden',
                        zIndex: Z_INDEX.MODAL
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Sidebar */}
                    <div style={{
                        width: '250px',
                        minWidth: '250px',
                        backgroundColor: colors.bgAlt,
                        borderRight: `1px solid ${colors.border}`,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        <h3 style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: colors.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '16px',
                            paddingLeft: '8px'
                        }}>Settings</h3>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        backgroundColor: activeTab === tab.id ? colors.bgCard : 'transparent',
                                        color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                                        boxShadow: activeTab === tab.id ? `0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px ${colors.border}` : 'none'
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </nav>

                        {/* Version Info */}
                        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: colors.textMuted,
                                fontFamily: 'monospace',
                                opacity: 0.7
                            }}>
                                Capacity Model v{APP_VERSION}
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: colors.bgModal }}>
                        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text }}>
                                {activeTab === 'roles' ? 'Unify Job Titles' : tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                            <button
                                onClick={onClose}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = colors.bgAccent;
                                    e.currentTarget.style.color = colors.text;
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = colors.textMuted;
                                }}
                                style={{
                                    padding: '8px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                    color: colors.textMuted,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {ICONS.CLOSE}
                            </button>
                        </div>

                        <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
                            {activeTab === 'general' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Direct Field Writes toggle removed — the codebase now writes directly to
                                        canonical Airtable fields exclusively. The legacy proxy (*_UPDATE) field
                                        pattern was retired because (a) Airtable now allows direct writes to synced
                                        fields and (b) the dual-source pattern caused stale-read bugs. */}

                                    {/* Capacity Thresholds Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                                                : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                            borderBottom: `1px solid ${isDark ? '#4c1d95' : '#fcd34d'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20V10" />
                                                    <path d="M18 20V4" />
                                                    <path d="M6 20v-4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#fde68a' : '#92400e', margin: 0 }}>
                                                    Capacity Thresholds
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#fcd34d' : '#b45309', margin: 0 }}>
                                                    Define when capacity becomes a warning or overload
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* Warning Threshold */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#fbbf24',
                                                            boxShadow: '0 0 8px rgba(251,191,36,0.5)'
                                                        }} />
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                            Warning Level
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '14px',
                                                        fontWeight: '700',
                                                        fontFamily: 'monospace',
                                                        color: '#f59e0b',
                                                        backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.1)',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {Math.round(thresholds.greenStart * 100)}%
                                                    </span>
                                                </div>
                                                <div style={{
                                                    position: 'relative',
                                                    height: '8px',
                                                    borderRadius: '4px',
                                                    background: isDark ? '#334155' : '#e2e8f0',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: `${((thresholds.greenStart - 0.5) / 0.5) * 100}%`,
                                                        background: 'linear-gradient(90deg, #00BD00 0%, #fbbf24 100%)',
                                                        borderRadius: '4px'
                                                    }} />
                                                </div>
                                                <input
                                                    type="range" min="0.5" max="1.0" step="0.05"
                                                    value={thresholds.greenStart}
                                                    onChange={e => saveSettingsToTable({ ...storedSettings, thresholds: { ...thresholds, greenStart: Number(e.target.value) } })}
                                                    style={{
                                                        width: '100%',
                                                        height: '24px',
                                                        cursor: 'pointer',
                                                        accentColor: '#fbbf24',
                                                        marginTop: '-4px',
                                                        opacity: 0.01,
                                                        position: 'relative',
                                                        zIndex: 1
                                                    }}
                                                />
                                            </div>
                                            {/* Overload Threshold */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#ef4444',
                                                            boxShadow: '0 0 8px rgba(239,68,68,0.5)'
                                                        }} />
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                            Overload Level
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '14px',
                                                        fontWeight: '700',
                                                        fontFamily: 'monospace',
                                                        color: '#ef4444',
                                                        backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {Math.round(thresholds.redStart * 100)}%
                                                    </span>
                                                </div>
                                                <div style={{
                                                    position: 'relative',
                                                    height: '8px',
                                                    borderRadius: '4px',
                                                    background: isDark ? '#334155' : '#e2e8f0',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: `${((thresholds.redStart - 0.8) / 0.7) * 100}%`,
                                                        background: 'linear-gradient(90deg, #fbbf24 0%, #ef4444 100%)',
                                                        borderRadius: '4px'
                                                    }} />
                                                </div>
                                                <input
                                                    type="range" min="0.8" max="1.5" step="0.05"
                                                    value={thresholds.redStart}
                                                    onChange={e => saveSettingsToTable({ ...storedSettings, thresholds: { ...thresholds, redStart: Number(e.target.value) } })}
                                                    style={{
                                                        width: '100%',
                                                        height: '24px',
                                                        cursor: 'pointer',
                                                        accentColor: '#ef4444',
                                                        marginTop: '-4px',
                                                        opacity: 0.01,
                                                        position: 'relative',
                                                        zIndex: 1
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capacity Buffer Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #312e81 0%, #4c1d95 100%)'
                                                : 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                            borderBottom: `1px solid ${isDark ? '#7637E3' : '#c4b5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #BD65FF 0%, #BD65FF 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#e9d5ff' : '#6b21a8', margin: 0 }}>
                                                    Capacity Buffer
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#c4b5fd' : '#7637E3', margin: 0 }}>
                                                    Overhead buffer shown as dotted line on charts
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                    Buffer Above Capacity
                                                </span>
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: '700',
                                                    fontFamily: 'monospace',
                                                    color: '#BD65FF',
                                                    backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.1)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {storedSettings.capacityBuffer ?? 10}%
                                                </span>
                                            </div>
                                            <input
                                                type="range" min="0" max="50" step="5"
                                                value={storedSettings.capacityBuffer ?? 10}
                                                onChange={e => saveSettingsToTable({ ...storedSettings, capacityBuffer: Number(e.target.value) })}
                                                style={{ width: '100%', height: '6px', cursor: 'pointer', accentColor: '#BD65FF' }}
                                            />
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Set to 0% to hide the buffer line from charts
                                            </p>
                                        </div>
                                    </div>

                                    {/* Financial Year Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #164e63 0%, #155e75 100%)'
                                                : 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
                                            borderBottom: `1px solid ${isDark ? '#22d3ee' : '#67e8f9'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(6,182,212,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#a5f3fc' : '#155e75', margin: 0 }}>
                                                    Financial Year
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#67e8f9' : '#0891b2', margin: 0 }}>
                                                    Configure your organization's fiscal calendar
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <select
                                                    value={storedSettings.fyStartMonth ?? 4}
                                                    onChange={e => saveSettingsToTable({ ...storedSettings, fyStartMonth: Number(e.target.value) })}
                                                    style={{
                                                        padding: '10px 16px',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        borderRadius: '10px',
                                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                                        cursor: 'pointer',
                                                        minWidth: '150px',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    <option value={0}>January</option>
                                                    <option value={1}>February</option>
                                                    <option value={2}>March</option>
                                                    <option value={3}>April</option>
                                                    <option value={4}>May</option>
                                                    <option value={5}>June</option>
                                                    <option value={6}>July</option>
                                                    <option value={7}>August</option>
                                                    <option value={8}>September</option>
                                                    <option value={9}>October</option>
                                                    <option value={10}>November</option>
                                                    <option value={11}>December</option>
                                                </select>
                                                <div style={{
                                                    padding: '10px 16px',
                                                    backgroundColor: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.1)',
                                                    borderRadius: '10px',
                                                    border: `1px solid ${isDark ? 'rgba(34,211,238,0.3)' : 'rgba(6,182,212,0.3)'}`,
                                                }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#22d3ee' : '#0891b2' }}>
                                                        FY runs {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][storedSettings.fyStartMonth ?? 4]} 1 → {['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][(storedSettings.fyStartMonth ?? 4)]} {((storedSettings.fyStartMonth ?? 4) === 0) ? '' : '(next year)'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Used for revenue recognition and fiscal period calculations
                                            </p>
                                        </div>
                                    </div>

                                    {/* BAU Project Types Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)',
                                        marginBottom: '16px'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #164e63 100%)'
                                                : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                            borderBottom: `1px solid ${isDark ? '#0891b2' : '#f59e0b'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M9 11l3 3L22 4" />
                                                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#fbbf24' : '#92400e', margin: 0 }}>
                                                    BAU Project Types
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#fcd34d' : '#b45309', margin: 0 }}>
                                                    Select project types that count as BAU demand
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {['Change Project', 'Programme', 'Renewal'].map(type => {
                                                    const bauProjectTypes = storedSettings.bauProjectTypes || ['Change Project'];
                                                    const isChecked = bauProjectTypes.includes(type);
                                                    return (
                                                        <label key={type} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            padding: '12px 16px',
                                                            borderRadius: '10px',
                                                            backgroundColor: isChecked
                                                                ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)')
                                                                : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                                                            border: `1px solid ${isChecked
                                                                ? (isDark ? '#f59e0b' : '#fbbf24')
                                                                : (isDark ? '#334155' : '#e2e8f0')}`,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    const current = storedSettings.bauProjectTypes || ['Change Project'];
                                                                    const newTypes = isChecked
                                                                        ? current.filter(t => t !== type)
                                                                        : [...current, type];
                                                                    saveSettingsToTable({
                                                                        ...storedSettings,
                                                                        bauProjectTypes: newTypes
                                                                    });
                                                                }}
                                                                style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    accentColor: '#f59e0b',
                                                                    cursor: 'pointer'
                                                                }}
                                                            />
                                                            <span style={{
                                                                fontSize: '13px',
                                                                fontWeight: isChecked ? '600' : '500',
                                                                color: isChecked
                                                                    ? (isDark ? '#fbbf24' : '#92400e')
                                                                    : (isDark ? '#94a3b8' : '#64748b')
                                                            }}>
                                                                {type}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Projects with these types will appear as demand in BAU view
                                            </p>
                                        </div>
                                    </div>

                                    {/* BAU Hours Mapping Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #164e63 100%)'
                                                : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                            borderBottom: `1px solid ${isDark ? '#0891b2' : '#6ee7b7'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #34d399 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2v20M2 12h20" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#6ee7b7' : '#065f46', margin: 0 }}>
                                                    BAU Hours Mapping
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#34d399' : '#059669', margin: 0 }}>
                                                    Hours per year for live site support by size
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                                {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => {
                                                    const bauMapping = storedSettings.bauHoursMapping || {};
                                                    const defaults = { XXS: 25, XS: 50, S: 100, M: 200, L: 400, XL: 800, XXL: 1600 };
                                                    const value = bauMapping[size] ?? defaults[size];
                                                    return (
                                                        <div key={size} style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '6px'
                                                        }}>
                                                            <label style={{
                                                                fontSize: '11px',
                                                                fontWeight: '700',
                                                                color: isDark ? '#94a3b8' : '#64748b',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em'
                                                            }}>
                                                                {size}
                                                            </label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="25"
                                                                    value={value}
                                                                    onChange={e => {
                                                                        const newVal = parseInt(e.target.value) || 0;
                                                                        saveSettingsToTable({
                                                                            ...storedSettings,
                                                                            bauHoursMapping: {
                                                                                ...bauMapping,
                                                                                [size]: newVal
                                                                            }
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        width: '70px',
                                                                        padding: '8px 10px',
                                                                        fontSize: '13px',
                                                                        fontWeight: '600',
                                                                        fontFamily: 'monospace',
                                                                        borderRadius: '8px',
                                                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                                                        textAlign: 'right'
                                                                    }}
                                                                />
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    color: isDark ? '#64748b' : '#94a3b8',
                                                                    fontWeight: '500'
                                                                }}>hrs/yr</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Launched sites generate BAU demand based on their T-Shirt Size
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'utilization' && (() => {
                                // Normalise legacy values so 'field' reads as 'annualised' and 'presence' reads as 'agw'.
                                const rawUtilModel = (storedSettings.capacityUtilizationModel || 'annualised').toLowerCase();
                                const activeUtilModel = rawUtilModel === 'presence' ? 'agw'
                                    : (rawUtilModel === 'field' ? 'annualised' : rawUtilModel);
                                const presence = storedSettings.modelParams?.presenceModel || {};
                                const productivityDefault = presence.weeklyProductivityDefault ?? 80;
                                const setUtilModel = (model) => saveSettingsToTable({ ...storedSettings, capacityUtilizationModel: model });
                                const setProductivityDefault = (val) => saveSettingsToTable({
                                    ...storedSettings,
                                    modelParams: {
                                        ...storedSettings.modelParams,
                                        presenceModel: { ...presence, weeklyProductivityDefault: val }
                                    }
                                });
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Active Utilisation Model card */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)' }}>
                                            <div style={{ padding: '16px 20px', background: isDark ? 'linear-gradient(135deg, #064e3b 0%, #059669 100%)' : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderBottom: `1px solid ${isDark ? '#059669' : '#6ee7b7'}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDark ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#6ee7b7' : '#047857'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8v8m-4-5v5m-4-2v2" /><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#d1fae5' : '#064e3b' }}>Active Utilisation Model</h4>
                                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: isDark ? '#a7f3d0' : '#047857' }}>Choose how weekly capacity is computed and how the annual KPI is derived.</p>
                                                </div>
                                            </div>
                                            <div style={{ padding: '20px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {[
                                                        { key: 'annualised', label: 'Annualised (67%)', desc: 'Flat per-week = workingHours × Annual Utilization. Vacation / holidays / sick already baked into the annual %. Use for exec reporting, hiring plans, deal capacity.' },
                                                        { key: 'agw', label: 'AGW (80%)', desc: 'Any Given Week. Per-week = days present × dailyHours × productivity (80%). Varies by leave. Use for live staffing, weekly allocation, sprint planning.' }
                                                    ].map(({ key, label, desc }) => {
                                                        // Annualised degrades gracefully without the field (falls back to Target Utilization).
                                                        // AGW always works. So we don't hard-disable either button — just warn when the
                                                        // annual field is unmapped.
                                                        return (
                                                            <button key={key}
                                                                onClick={() => setUtilModel(key)}
                                                                style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: `2px solid ${activeUtilModel === key ? '#059669' : (isDark ? '#334155' : '#e2e8f0')}`, backgroundColor: activeUtilModel === key ? (isDark ? 'rgba(5,150,105,0.2)' : '#d1fae5') : (isDark ? 'transparent' : 'white'), color: activeUtilModel === key ? '#047857' : (isDark ? '#e2e8f0' : '#1e293b'), cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease' }}
                                                            >
                                                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{label}</div>
                                                                <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '4px', lineHeight: 1.4 }}>{desc}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {!presenceModelFieldMapped && (
                                                    <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(245,158,11,0.4)' : '#fcd34d'}`, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                        <svg style={{ width: '14px', height: '14px', color: '#d97706', flexShrink: 0, marginTop: '1px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        <span style={{ fontSize: '11px', color: isDark ? '#fde68a' : '#92400e', lineHeight: 1.4 }}>
                                                            <strong>Annual Utilization field not mapped.</strong> Annualised mode will fall back to the Target Utilization field (80%) and therefore match AGW for full-present weeks. Map the &quot;Annual Utilization (Presence Model)&quot; field on Resources to unlock the 67%-style annualised view.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Default Weekly Productivity card — only applied in AGW mode */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', opacity: activeUtilModel === 'agw' ? 1 : 0.6 }}>
                                            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>Default Weekly Productivity</h4>
                                                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Used when a resource has no value in their Target Utilization field. Per-resource values still take precedence.</p>
                                                </div>
                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669', fontFamily: 'monospace', padding: '6px 14px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                    {productivityDefault}%
                                                </span>
                                            </div>
                                            <div style={{ padding: '16px 20px' }}>
                                                <input type="range" min="50" max="100" step="1"
                                                    value={productivityDefault}
                                                    onChange={e => setProductivityDefault(Number(e.target.value))}
                                                    style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#059669' }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1', marginTop: '4px' }}>
                                                    <span>50%</span><span>100%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* How the two modes differ — info banner */}
                                        <div style={{ padding: '14px 16px', backgroundColor: isDark ? 'rgba(5,150,105,0.08)' : '#ecfdf5', border: `1px solid ${isDark ? '#064e3b' : '#a7f3d0'}`, borderRadius: '10px' }}>
                                            <h5 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: isDark ? '#a7f3d0' : '#047857' }}>How the two modes differ</h5>
                                            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: isDark ? '#bbf7d0' : '#065f46', lineHeight: 1.6 }}>
                                                <li><strong>Annualised (67%)</strong> — weekly cell = <em>workingHours × Annual Utilization</em> (flat, same every week). Example: 40h × 67% = <strong>26.8h/week</strong>. Vacation/holidays/sick are already discounted inside the 67%, so leave weeks are <em>not</em> re-skipped. Use for hiring plans and exec reporting where the yearly average is the right lens.</li>
                                                <li><strong>AGW (80%)</strong> — weekly cell = <em>daysPresent × (workingHours ÷ 5) × weekly productivity</em>. Full week = 40h × 80% = <strong>32h</strong>. 2-day-leave week = 3 × 8 × 80% = <strong>19.2h</strong>. Use for live staffing and sprint planning where "who is actually here this week" matters.</li>
                                                <li><strong>Weekly productivity</strong> comes from the existing <em>Target Utilization</em> field — 80% for standard implementers, 70% senior/lead, 50% player-coach.</li>
                                                <li>Both reconcile across the year: sum of AGW weeks ≈ Annualised × 52 when the Airtable formula for Annual Utilization matches the leave/holiday/sick assumptions.</li>
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })()}

                            {activeTab === 'altModel' && (() => {
                                const activeModel = storedSettings.activeCapacityModel || 'standard';
                                const rawMix = storedSettings.alternativeRoleMix || { pm: 30, sc: 30, pd: 40 };
                                // Read all three storage shapes and normalise to { default, overrides: [{type,platform,mix}] }
                                const hasNested = rawMix && rawMix.default && typeof rawMix.default === 'object';
                                const defaultMix = hasNested ? rawMix.default : { pm: rawMix.pm || 0, sc: rawMix.sc || 0, pd: rawMix.pd || 0 };
                                // Build overrides array — merge byTypePlatform (new) and byProjectType (legacy) into a single list
                                const overrides = [];
                                if (hasNested) {
                                    if (Array.isArray(rawMix.byTypePlatform)) {
                                        for (const entry of rawMix.byTypePlatform) {
                                            if (entry && entry.type && entry.mix) {
                                                overrides.push({ type: entry.type, platform: entry.platform || '*', mix: entry.mix });
                                            }
                                        }
                                    }
                                    if (rawMix.byProjectType && typeof rawMix.byProjectType === 'object') {
                                        for (const [type, mix] of Object.entries(rawMix.byProjectType)) {
                                            if (!overrides.some(o => o.type === type && o.platform === '*')) {
                                                overrides.push({ type, platform: '*', mix });
                                            }
                                        }
                                    }
                                }

                                // Discover project types + platforms from loaded projects.
                                const knownTypes = ['Implementation', 'Renewal', 'Global Program Initiation', 'Change Request', 'Change Project', 'BAU'];
                                const knownPlatforms = ['FPS', 'Benifex'];
                                const loadedTypes = Array.from(new Set((allProjects || []).map(p => p.projectType).filter(Boolean)));
                                const loadedPlatforms = Array.from(new Set((allProjects || []).map(p => p.platform).filter(Boolean)));
                                const availableTypes = Array.from(new Set([...loadedTypes, ...knownTypes])).sort();
                                const availablePlatforms = Array.from(new Set([...loadedPlatforms, ...knownPlatforms])).sort();
                                // Platform options for dropdown — '*' is a special "Any platform" entry that appears first.
                                const platformOptions = ['*', ...availablePlatforms];

                                // Serialise to canonical storage shape (drops legacy byProjectType on write)
                                const commit = (nextDefault, nextOverrides) => {
                                    saveSettingsToTable({
                                        ...storedSettings,
                                        alternativeRoleMix: {
                                            default: nextDefault,
                                            byTypePlatform: nextOverrides.map(o => ({ type: o.type, platform: o.platform, mix: o.mix }))
                                        }
                                    });
                                };
                                const setModel = (model) => saveSettingsToTable({ ...storedSettings, activeCapacityModel: model });
                                const updateDefault = (next) => commit(next, overrides);
                                const updateOverrideAt = (idx, patch) => {
                                    const nextList = overrides.map((o, i) => i === idx ? { ...o, ...patch } : o);
                                    commit(defaultMix, nextList);
                                };
                                const removeOverrideAt = (idx) => {
                                    commit(defaultMix, overrides.filter((_, i) => i !== idx));
                                };
                                const addOverride = () => {
                                    // Find a (type, platform) tuple not already taken
                                    const taken = new Set(overrides.map(o => `${o.type}|${o.platform}`));
                                    let chosenType = '', chosenPlatform = '*';
                                    outer: for (const type of availableTypes) {
                                        for (const platform of platformOptions) {
                                            if (!taken.has(`${type}|${platform}`)) {
                                                chosenType = type;
                                                chosenPlatform = platform;
                                                break outer;
                                            }
                                        }
                                    }
                                    if (!chosenType) return; // all combinations taken
                                    commit(defaultMix, [...overrides, { type: chosenType, platform: chosenPlatform, mix: { ...defaultMix } }]);
                                };
                                // Used by the per-row type/platform dropdowns to disable tuples already taken elsewhere
                                const takenByOther = (idx) => {
                                    const taken = new Set();
                                    overrides.forEach((o, i) => { if (i !== idx) taken.add(`${o.type}|${o.platform}`); });
                                    return taken;
                                };

                                // Render helper (not a React component) — avoids remounting inputs on parent re-render
                                const renderMixRow = (mix, onChange, compact = false) => {
                                    const sum = (mix.pm || 0) + (mix.sc || 0) + (mix.pd || 0);
                                    return (
                                        <div>
                                            {[
                                                { key: 'pm', label: 'PM', color: '#0284c7' },
                                                { key: 'sc', label: 'SC', color: '#7637E3' },
                                                { key: 'pd', label: 'Build / PD', color: '#f59e0b' }
                                            ].map(({ key, label, color }) => (
                                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: compact ? '6px' : '10px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', color, minWidth: '72px' }}>{label}</span>
                                                    <input type="range" min="0" max="100" step="1" value={mix[key] || 0}
                                                        onChange={e => onChange({ ...mix, [key]: Number(e.target.value) })}
                                                        style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: color, borderRadius: '3px' }}
                                                    />
                                                    <input type="number" min="0" max="100" step="1" value={mix[key] || 0}
                                                        onChange={e => onChange({ ...mix, [key]: Number(e.target.value) })}
                                                        style={{ width: '56px', padding: '6px 8px', fontSize: '12px', fontWeight: '600', border: `2px solid ${color}40`, borderRadius: '6px', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                                                    />
                                                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', minWidth: '14px' }}>%</span>
                                                </div>
                                            ))}
                                            <div style={{ textAlign: 'right', marginTop: '4px' }}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px',
                                                    color: Math.abs(sum - 100) < 0.5 ? '#059669' : '#dc2626',
                                                    backgroundColor: Math.abs(sum - 100) < 0.5 ? '#d1fae5' : '#fee2e2',
                                                    border: `1px solid ${Math.abs(sum - 100) < 0.5 ? '#6ee7b7' : '#fca5a5'}`
                                                }}>Sum: {sum.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Active Model Card */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)' }}>
                                            <div style={{ padding: '16px 20px', background: isDark ? 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)' : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', borderBottom: `1px solid ${isDark ? '#0284c7' : '#7dd3fc'}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#7dd3fc' : '#0284c7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-3" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#e0f2fe' : '#0c4a6e' }}>Active Capacity Model</h4>
                                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: isDark ? '#bae6fd' : '#0369a1' }}>Switch between the standard (PM/SC/PD fields) and alternative (Total Effort × mix) models</p>
                                                </div>
                                            </div>
                                            <div style={{ padding: '20px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {[
                                                        { key: 'standard', label: 'Standard', desc: 'PM / SC / PD fields on each project' },
                                                        { key: 'alternative', label: 'Alternative', desc: 'Total Effort field split by role %' }
                                                    ].map(({ key, label, desc }) => {
                                                        // Disable Alternative if the TOTAL_EFFORT field hasn't been mapped via the gear icon yet.
                                                        const disabled = key === 'alternative' && !altModelFieldMapped;
                                                        return (
                                                            <button key={key}
                                                                onClick={() => { if (!disabled) setModel(key); }}
                                                                disabled={disabled}
                                                                title={disabled ? 'Map the Total Effort (Alt Model) field in the Interface Designer settings before switching to Alternative.' : ''}
                                                                style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: `2px solid ${activeModel === key ? '#0284c7' : (isDark ? '#334155' : '#e2e8f0')}`, backgroundColor: activeModel === key ? (isDark ? 'rgba(2,132,199,0.2)' : '#e0f2fe') : (isDark ? 'transparent' : 'white'), color: activeModel === key ? '#0284c7' : (isDark ? '#e2e8f0' : '#1e293b'), cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.15s ease', opacity: disabled ? 0.5 : 1 }}
                                                            >
                                                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{label}</div>
                                                                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{desc}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {/* Inline warning banner if Alt is unavailable due to unmapped field */}
                                                {!altModelFieldMapped && (
                                                    <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(245,158,11,0.4)' : '#fcd34d'}`, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                        <svg style={{ width: '14px', height: '14px', color: '#d97706', flexShrink: 0, marginTop: '1px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        <span style={{ fontSize: '11px', color: isDark ? '#fde68a' : '#92400e', lineHeight: 1.4 }}>
                                                            <strong>Alternative model requires Total Effort field.</strong> Open the gear icon (Interface Designer settings) and map the &quot;Total Effort (Alt Model)&quot; field to your Airtable column.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Default Mix Card */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', opacity: activeModel === 'alternative' ? 1 : 0.6 }}>
                                            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>Default Role Mix</h4>
                                                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Applied to any project without a per-type override</p>
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px' }}>
                                                {renderMixRow(defaultMix, updateDefault)}
                                            </div>
                                        </div>

                                        {/* Project Type × Platform Overrides Card */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', opacity: activeModel === 'alternative' ? 1 : 0.6 }}>
                                            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>Project Type × Platform Overrides</h4>
                                                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Override the default mix for specific combinations (e.g., Implementation on FPS vs Benifex). Lookup priority: exact match → same type on Any platform → default.</p>
                                                </div>
                                                <button onClick={addOverride}
                                                    style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '600', color: 'white', background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(2,132,199,0.3)' }}
                                                >+ Add Override</button>
                                            </div>
                                            <div style={{ padding: '16px 20px' }}>
                                                {overrides.length === 0 ? (
                                                    <p style={{ margin: 0, fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>No overrides — every project uses the default mix above.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                        {overrides.map((o, idx) => {
                                                            const taken = takenByOther(idx);
                                                            const typeOptions = Array.from(new Set([o.type, ...availableTypes])).sort();
                                                            const platformOpts = Array.from(new Set([o.platform, ...platformOptions]));
                                                            // Keep '*' first, then sorted rest
                                                            platformOpts.sort((a, b) => a === '*' ? -1 : b === '*' ? 1 : a.localeCompare(b));
                                                            return (
                                                                <div key={idx} style={{ padding: '14px', borderRadius: '10px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Project Type</div>
                                                                            <select value={o.type}
                                                                                onChange={e => updateOverrideAt(idx, { type: e.target.value })}
                                                                                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: '600', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, borderRadius: '6px', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}
                                                                            >
                                                                                {typeOptions.map(t => {
                                                                                    const isTaken = taken.has(`${t}|${o.platform}`);
                                                                                    return <option key={t} value={t} disabled={isTaken}>{t}{isTaken ? ' (taken)' : ''}</option>;
                                                                                })}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Platform</div>
                                                                            <select value={o.platform}
                                                                                onChange={e => updateOverrideAt(idx, { platform: e.target.value })}
                                                                                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: '600', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, borderRadius: '6px', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}
                                                                            >
                                                                                {platformOpts.map(p => {
                                                                                    const isTaken = taken.has(`${o.type}|${p}`);
                                                                                    const label = p === '*' ? 'Any platform' : p;
                                                                                    return <option key={p} value={p} disabled={isTaken}>{label}{isTaken ? ' (taken)' : ''}</option>;
                                                                                })}
                                                                            </select>
                                                                        </div>
                                                                        <div style={{ alignSelf: 'end' }}>
                                                                            <button onClick={() => removeOverrideAt(idx)}
                                                                                title="Remove this override"
                                                                                style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '600', color: '#dc2626', background: 'transparent', border: `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}`, borderRadius: '6px', cursor: 'pointer' }}
                                                                            >Remove</button>
                                                                        </div>
                                                                    </div>
                                                                    {renderMixRow(o.mix, (next) => updateOverrideAt(idx, { mix: next }), true)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Helpful note */}
                                        <div style={{ padding: '12px 16px', backgroundColor: isDark ? 'rgba(14,165,233,0.08)' : '#eff6ff', border: `1px solid ${isDark ? '#0c4a6e' : '#bfdbfe'}`, borderRadius: '10px' }}>
                                            <p style={{ margin: 0, fontSize: '11px', color: isDark ? '#bae6fd' : '#0369a1', lineHeight: 1.5 }}>
                                                <strong>How this is used:</strong> When the Alternative model is active, each project&apos;s Total Effort is split across PM / SC / Build. Lookup order: exact (project type, platform) match → same type with &quot;Any platform&quot; → default mix. Mixes that don&apos;t sum to exactly 100% are normalised at runtime.
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {activeTab === 'roles' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Primary Role Mapping Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)'
                                                : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#4338ca' : '#a5b4fc'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#818cf8' : '#4f46e5'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#e0e7ff' : '#3730a3' }}>
                                                    Primary Role Mapping
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(224, 231, 255, 0.7)' : '#4338ca', marginTop: '2px' }}>
                                                    Map job titles to their primary role for basic capacity calculations
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '0' }}>
                                            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                <thead style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                    <tr>
                                                        <th style={{ padding: '12px 20px', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Job Title</th>
                                                        <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Count</th>
                                                        <th style={{ padding: '12px 20px', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Primary Role</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(functionCounts).map(([funcName, count], idx) => (
                                                        <tr key={funcName} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
                                                            <td style={{ padding: '16px 20px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>{funcName}</td>
                                                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '2px 8px',
                                                                    borderRadius: '10px',
                                                                    backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9',
                                                                    color: isDark ? '#94a3b8' : '#64748b',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600'
                                                                }}>
                                                                    {count}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '16px 20px' }}>
                                                                <div style={{ display: 'flex', gap: '4px', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#f1f5f9', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
                                                                    {['PM', 'SC', 'PD', 'Other'].map(role => {
                                                                        const isActive = (roleMapping[funcName] || 'Other') === role;
                                                                        return (
                                                                            <button
                                                                                key={role}
                                                                                onClick={() => saveSettingsToTable({
                                                                                    ...storedSettings,
                                                                                    roleMapping: { ...roleMapping, [funcName]: role }
                                                                                })}
                                                                                style={{
                                                                                    padding: '6px 12px',
                                                                                    borderRadius: '6px',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: isActive ? '700' : '500',
                                                                                    border: 'none',
                                                                                    cursor: 'pointer',
                                                                                    backgroundColor: isActive ? (isDark ? '#4f46e5' : 'white') : 'transparent',
                                                                                    color: isActive ? (isDark ? 'white' : '#4f46e5') : (isDark ? '#94a3b8' : '#64748b'),
                                                                                    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                                                    transition: 'all 0.2s',
                                                                                }}
                                                                            >
                                                                                {role}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Link to Role Config */}
                                    <div style={{
                                        padding: '20px',
                                        background: isDark
                                            ? 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)'
                                            : 'linear-gradient(135deg, #E8E1D9 0%, #ddd6fe 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#4c1d95' : '#c4b5fd'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s',
                                        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(124, 58, 237, 0.05)'
                                    }}
                                        onClick={() => setActiveTab('roleConfig')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '12px',
                                                background: 'linear-gradient(135deg, #BD65FF 0%, #7637E3 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                                            }}>
                                                <svg style={{ width: '22px', height: '22px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '15px', fontWeight: '800', color: isDark ? '#ddd6fe' : '#5b21b6', margin: 0 }}>Advanced Role Configuration</h4>
                                                <p style={{ fontSize: '12px', color: isDark ? '#a78bfa' : '#7637E3', margin: '2px 0 0 0' }}>
                                                    Configure <strong>Secondary Roles</strong> and complex constraints
                                                </p>
                                            </div>
                                        </div>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a78bfa' : '#7637E3'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14" />
                                            <path d="m12 5 7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            )}

                            {/* ROLE CONFIG TAB - Primary/Secondary Roles */}
                            {activeTab === 'roleConfig' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Job Title Role Configuration Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #4c1d95 0%, #7637E3 100%)'
                                                : 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                            borderBottom: `1px solid ${isDark ? '#7637E3' : '#c4b5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px',
                                                borderRadius: '10px',
                                                background: isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a78bfa' : '#7637E3'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#f3e8ff' : '#581c87' }}>
                                                    Job Title Role Configuration
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(243, 232, 255, 0.7)' : '#7637E3', marginTop: '2px' }}>
                                                    Define primary and secondary roles for slot capacity modeling
                                                </p>
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {Object.entries(functionCounts).map(([jobTitle, count]) => {
                                                const jobConfig = roleConfig.jobs[jobTitle] || { primary: null, secondary: [] };
                                                const ROLES = ['PM', 'SC', 'Build'];

                                                return (
                                                    <div key={jobTitle} style={{
                                                        padding: '16px 20px',
                                                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                        borderRadius: '12px',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                                            <div style={{ flex: 1, minWidth: '180px' }}>
                                                                <div style={{ fontWeight: '600', fontSize: '14px', color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '6px' }}>
                                                                    {jobTitle}
                                                                </div>
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '3px 10px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '700',
                                                                    color: '#ffffff',
                                                                    background: 'linear-gradient(135deg, #f97316 0%, #84cc16 100%)',
                                                                    borderRadius: '12px',
                                                                    boxShadow: '0 2px 4px rgba(249, 115, 22, 0.3)'
                                                                }}>
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                                    </svg>
                                                                    {count}
                                                                </span>
                                                            </div>

                                                            {/* Primary Role Dropdown */}
                                                            <div style={{ minWidth: '140px' }}>
                                                                <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    Primary
                                                                </div>
                                                                <select
                                                                    value={jobConfig.primary || ''}
                                                                    onChange={(e) => {
                                                                        const newJobs = {
                                                                            ...roleConfig.jobs,
                                                                            [jobTitle]: { ...jobConfig, primary: e.target.value || null }
                                                                        };
                                                                        saveSettingsToTable({ ...storedSettings, roleConfig: { ...roleConfig, jobs: newJobs } });
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '36px',
                                                                        padding: '0 12px',
                                                                        borderRadius: '8px',
                                                                        border: isDark ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid #cbd5e1',
                                                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#f8fafc',
                                                                        color: isDark ? '#e2e8f0' : '#1e293b',
                                                                        fontSize: '13px',
                                                                        fontWeight: '500',
                                                                        cursor: 'pointer',
                                                                        appearance: 'none',
                                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                                                        backgroundRepeat: 'no-repeat',
                                                                        backgroundPosition: 'right 8px center',
                                                                        backgroundSize: '16px',
                                                                        paddingRight: '32px'
                                                                    }}
                                                                >
                                                                    <option value="">-- Select --</option>
                                                                    {ROLES.map(role => (
                                                                        <option key={role} value={role}>{role}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Secondary Role Checkboxes */}
                                                            <div style={{ minWidth: '180px' }}>
                                                                <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    Secondary (Flex)
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                    {ROLES.filter(r => r !== jobConfig.primary).map(role => {
                                                                        const isSecondary = (jobConfig.secondary || []).includes(role);
                                                                        return (
                                                                            <label key={role} style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '6px',
                                                                                padding: '6px 10px',
                                                                                borderRadius: '6px',
                                                                                backgroundColor: isSecondary
                                                                                    ? (isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)')
                                                                                    : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9'),
                                                                                border: isSecondary
                                                                                    ? '1px solid rgba(124, 58, 237, 0.5)'
                                                                                    : (isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #e2e8f0'),
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.15s ease'
                                                                            }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSecondary}
                                                                                    onChange={(e) => {
                                                                                        const newSecondary = e.target.checked
                                                                                            ? [...(jobConfig.secondary || []), role]
                                                                                            : (jobConfig.secondary || []).filter(r => r !== role);
                                                                                        const newJobs = {
                                                                                            ...roleConfig.jobs,
                                                                                            [jobTitle]: { ...jobConfig, secondary: newSecondary }
                                                                                        };
                                                                                        saveSettingsToTable({ ...storedSettings, roleConfig: { ...roleConfig, jobs: newJobs } });
                                                                                    }}
                                                                                    style={{ display: 'none' }}
                                                                                />
                                                                                <span style={{
                                                                                    fontSize: '12px',
                                                                                    fontWeight: isSecondary ? '600' : '500',
                                                                                    color: isSecondary
                                                                                        ? (isDark ? '#c4b5fd' : '#7637E3')
                                                                                        : (isDark ? '#94a3b8' : '#64748b')
                                                                                }}>
                                                                                    {role}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Role Linking Constraints Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #be185d 0%, #db2777 100%)'
                                                : 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                                            borderBottom: `1px solid ${isDark ? '#be185d' : '#f9a8d4'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(244, 114, 182, 0.2)' : 'rgba(236, 72, 153, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#f472b6' : '#db2777'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#fce7f3' : '#be185d' }}>
                                                    Role Linking Constraints
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(252, 231, 243, 0.7)' : '#db2777', marginTop: '2px' }}>
                                                    Advanced role dependencies for complex slot interactions
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '20px' }}>
                                            <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                                                These constraints enforce specific team composition rules. For example, requiring a senior PM when a senior SC is assigned.
                                            </p>

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '16px',
                                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                                                borderRadius: '12px',
                                                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', width: '100%' }}>
                                                    <div style={{ position: 'relative', width: '40px', height: '20px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={(roleConfig.constraints?.SC?.requiresPrimaryFor || []).includes('PM')}
                                                            onChange={(e) => {
                                                                const newConstraints = {
                                                                    ...roleConfig.constraints,
                                                                    SC: {
                                                                        ...roleConfig.constraints?.SC,
                                                                        requiresPrimaryFor: e.target.checked ? ['PM'] : []
                                                                    }
                                                                };
                                                                saveSettingsToTable({ ...storedSettings, roleConfig: { ...roleConfig, constraints: newConstraints } });
                                                            }}
                                                            style={{ opacity: 0, width: 0, height: 0 }}
                                                        />
                                                        <div style={{
                                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                            backgroundColor: (roleConfig.constraints?.SC?.requiresPrimaryFor || []).includes('PM') ? '#db2777' : (isDark ? '#334155' : '#cbd5e1'),
                                                            borderRadius: '20px', transition: '0.3s'
                                                        }}>
                                                            <div style={{
                                                                position: 'absolute', content: '""', height: '16px', width: '16px', left: '2px', bottom: '2px',
                                                                backgroundColor: 'white', borderRadius: '50%', transition: '0.3s',
                                                                transform: (roleConfig.constraints?.SC?.requiresPrimaryFor || []).includes('PM') ? 'translateX(20px)' : 'translateX(0)'
                                                            }} />
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                        If <strong style={{ color: '#00BD00' }}>primary-SC</strong> fills SC slot → <strong style={{ color: '#3b82f6' }}>primary-PM</strong> required for PM slot
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'squads' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Squad Selection Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)'
                                                : 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)',
                                            borderBottom: `1px solid ${isDark ? '#0f766e' : '#5eead4'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '10px',
                                                    background: isDark ? 'rgba(45, 212, 191, 0.2)' : 'rgba(20, 184, 166, 0.15)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#2dd4bf' : '#0d9488'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                        <circle cx="9" cy="7" r="4" />
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#ccfbf1' : '#0f766e' }}>
                                                        Capacity Source Squads
                                                    </h4>
                                                    <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(204, 251, 241, 0.7)' : '#0d9488', marginTop: '2px' }}>
                                                        Select which squads contribute to capacity calculations
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                color: isDark ? '#ccfbf1' : '#0f766e'
                                            }}>
                                                {activeSquads.length} Selected
                                            </div>
                                        </div>

                                        <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '400px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                                {allSquadsFlat.map(squad => {
                                                    const isChecked = (activeSquads || []).includes(squad);
                                                    return (
                                                        <div
                                                            key={squad}
                                                            onClick={() => {
                                                                const newSquads = isChecked
                                                                    ? activeSquads.filter(s => s !== squad)
                                                                    : [...activeSquads, squad];
                                                                saveSettingsToTable({ ...storedSettings, activeSquads: newSquads });
                                                            }}
                                                            style={{
                                                                padding: '12px 16px',
                                                                borderRadius: '10px',
                                                                border: isChecked
                                                                    ? `1px solid ${isDark ? '#2dd4bf' : '#0d9488'}`
                                                                    : `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                                fontSize: '13px',
                                                                fontWeight: isChecked ? '600' : '500',
                                                                cursor: 'pointer',
                                                                backgroundColor: isChecked
                                                                    ? (isDark ? 'rgba(45, 212, 191, 0.1)' : '#f0fdfa')
                                                                    : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff'),
                                                                color: isChecked
                                                                    ? (isDark ? '#5eead4' : '#0f766e')
                                                                    : (isDark ? '#cbd5e1' : '#64748b'),
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: isChecked ? '0 2px 4px rgba(13, 148, 136, 0.1)' : 'none'
                                                            }}
                                                        >
                                                            {squad}
                                                            <div style={{
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                border: isChecked
                                                                    ? `1px solid ${isDark ? '#2dd4bf' : '#0d9488'}`
                                                                    : `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                                backgroundColor: isChecked ? (isDark ? '#2dd4bf' : '#0d9488') : 'transparent',
                                                                color: isChecked ? (isDark ? '#0f172a' : 'white') : 'transparent',
                                                                fontSize: '10px',
                                                                transition: 'all 0.2s ease'
                                                            }}>
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'winrates' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Pipeline Win Rates Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)'
                                                : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                            borderBottom: `1px solid ${isDark ? '#9a3412' : '#fcd34d'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px',
                                                borderRadius: '10px',
                                                background: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#fbbf24' : '#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#fef3c7' : '#78350f' }}>
                                                    Pipeline Win Rates
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(254, 243, 199, 0.7)' : '#92400e', marginTop: '2px' }}>
                                                    Set probability multipliers for capacity counting
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                            {[
                                                { key: 'pipeline - best', label: 'Pipeline - Best Case', default: 0.5, color: '#f59e0b', desc: 'Lower probability deals - reduced capacity impact' },
                                                { key: 'pipeline - commit', label: 'Pipeline - Commit', default: 1.0, color: '#00BD00', desc: 'Higher probability deals - full capacity impact' }
                                            ].map(({ key, label, default: def, color, desc }) => (
                                                <div key={key} style={{
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div>
                                                            <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>{label}</span>
                                                            <p style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', margin: '2px 0 0' }}>{desc}</p>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '14px',
                                                            fontWeight: '700',
                                                            color: color,
                                                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white',
                                                            padding: '6px 14px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                        }}>
                                                            {Math.round((winRates[key] ?? def) * 100)}%
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="1" step="0.05"
                                                        value={winRates[key] ?? def}
                                                        onChange={e => saveSettingsToTable({
                                                            ...storedSettings,
                                                            winRates: { ...winRates, [key]: Number(e.target.value) }
                                                        })}
                                                        style={{
                                                            width: '100%', height: '6px', cursor: 'pointer',
                                                            accentColor: color,
                                                            borderRadius: '3px'
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            {/* Max Forward Weeks */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                            Max Forward Weeks
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                            Maximum weeks a future slot can start after the initial slot to be included
                                                        </div>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '14px', fontWeight: '700',
                                                        color: '#7637E3',
                                                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#eff6ff',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {slotOptimization?.maxForwardWeeks || 4} weeks
                                                    </span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="24" step="1"
                                                    value={slotOptimization?.maxForwardWeeks !== undefined ? slotOptimization.maxForwardWeeks : 4}
                                                    onChange={e => saveSettingsToTable({
                                                        ...storedSettings,
                                                        slotOptimization: { ...slotOptimization, maxForwardWeeks: Number(e.target.value) }
                                                    })}
                                                    style={{ width: '100%', accentColor: '#7637E3', height: '6px', cursor: 'pointer' }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '4px' }}>
                                                    <span>0 weeks</span>
                                                    <span>24 weeks</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* How Win Rates Work - Info Card */}
                                    <div style={{
                                        padding: '20px',
                                        background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                        border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0'}`,
                                        borderRadius: '12px'
                                    }}>
                                        <h5 style={{
                                            fontSize: '12px', fontWeight: '700',
                                            color: isDark ? '#00BD00' : '#166534',
                                            marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <path d="M12 16v-4M12 8h.01" />
                                            </svg>
                                            How Win Rates Work
                                        </h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                            {[
                                                { pct: '100%', desc: 'Guaranteed', color: '#00BD00' },
                                                { pct: '75%', desc: 'High confidence', color: '#84cc16' },
                                                { pct: '50%', desc: 'Medium', color: '#f59e0b' },
                                                { pct: '25%', desc: 'Low', color: '#f97316' },
                                                { pct: '0%', desc: 'Excluded', color: '#ef4444' }
                                            ].map(({ pct, desc, color }) => (
                                                <div key={pct} style={{
                                                    textAlign: 'center',
                                                    padding: '10px 6px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'white',
                                                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : '#e2e8f0'}`
                                                }}>
                                                    <div style={{ fontSize: '16px', fontWeight: '700', color }}>{pct}</div>
                                                    <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>{desc}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'ramp' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Create New Profile Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)'
                                                : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#1e40af' : '#93c5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px',
                                                borderRadius: '10px',
                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#dbeafe' : '#1e3a8a' }}>
                                                    Create Ramp-Up Profile
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(219, 234, 254, 0.7)' : '#3b82f6', marginTop: '2px' }}>
                                                    Define capacity percentages for new hire onboarding
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>Profile Name</label>
                                                <input
                                                    type="text" placeholder="e.g. Junior Hire"
                                                    value={newProfileName}
                                                    onChange={e => setNewProfileName(e.target.value)}
                                                    style={{
                                                        width: '100%', fontSize: '13px', height: '40px',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#e2e8f0'}`,
                                                        borderRadius: '8px', padding: '0 12px', outline: 'none',
                                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
                                                        color: isDark ? '#e2e8f0' : '#1e293b'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ flex: 2 }}>
                                                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>Weekly % (Comma Separated)</label>
                                                <input
                                                    type="text" placeholder="0, 25, 50, 75, 100"
                                                    value={newProfileStr}
                                                    onChange={e => setNewProfileStr(e.target.value)}
                                                    style={{
                                                        width: '100%', fontSize: '13px', height: '40px',
                                                        fontFamily: 'monospace',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#e2e8f0'}`,
                                                        borderRadius: '8px', padding: '0 12px', outline: 'none',
                                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'white',
                                                        color: isDark ? '#e2e8f0' : '#1e293b'
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddProfile}
                                                disabled={!newProfileName}
                                                style={{
                                                    height: '40px', padding: '0 20px',
                                                    fontSize: '12px', fontWeight: '600',
                                                    background: newProfileName ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#e2e8f0',
                                                    color: newProfileName ? 'white' : '#94a3b8',
                                                    border: 'none', borderRadius: '8px',
                                                    cursor: newProfileName ? 'pointer' : 'not-allowed',
                                                    boxShadow: newProfileName ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14M5 12h14" />
                                                </svg>
                                                Add Profile
                                            </button>
                                        </div>
                                    </div>

                                    {/* Existing Profiles */}
                                    <div>
                                        <h4 style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 3v18h18" />
                                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                                            </svg>
                                            Existing Profiles
                                        </h4>
                                        {rampProfiles.length === 0 ? (
                                            <div style={{
                                                padding: '40px', textAlign: 'center',
                                                border: `2px dashed ${isDark ? '#334155' : '#e2e8f0'}`,
                                                borderRadius: '12px',
                                                color: isDark ? '#64748b' : '#94a3b8',
                                                fontSize: '13px'
                                            }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                </svg>
                                                <div>No ramp-up profiles defined yet</div>
                                                <div style={{ fontSize: '11px', marginTop: '4px' }}>Create your first profile above</div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {rampProfiles.map((p, idx) => (
                                                    <div key={idx} style={{
                                                        padding: '16px 20px',
                                                        backgroundColor: editingProfileIdx === idx
                                                            ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4')
                                                            : (isDark ? 'rgba(30, 41, 59, 0.5)' : 'white'),
                                                        border: `1px solid ${editingProfileIdx === idx
                                                            ? (isDark ? 'rgba(34, 197, 94, 0.5)' : '#86efac')
                                                            : (isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0')}`,
                                                        borderRadius: '12px',
                                                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                                                    }}>
                                                        {editingProfileIdx === idx ? (
                                                            /* Edit Mode */
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#00BD00', marginBottom: '6px' }}>Name</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editProfileName}
                                                                            onChange={e => setEditProfileName(e.target.value)}
                                                                            style={{
                                                                                width: '100%', fontSize: '13px', height: '36px',
                                                                                border: '1px solid #86efac', borderRadius: '8px',
                                                                                padding: '0 12px', outline: 'none',
                                                                                backgroundColor: 'white', color: '#1e293b'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div style={{ flex: 2 }}>
                                                                        <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#00BD00', marginBottom: '6px' }}>Weekly % (Comma Separated)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editProfileWeeks}
                                                                            onChange={e => setEditProfileWeeks(e.target.value)}
                                                                            style={{
                                                                                width: '100%', fontSize: '13px', height: '36px',
                                                                                fontFamily: 'monospace',
                                                                                border: '1px solid #86efac', borderRadius: '8px',
                                                                                padding: '0 12px', outline: 'none',
                                                                                backgroundColor: 'white', color: '#1e293b'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={handleCancelEdit}
                                                                        style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}
                                                                    >Cancel</button>
                                                                    <button
                                                                        onClick={handleSaveEdit}
                                                                        style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '600', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)', color: 'white', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)' }}
                                                                    >Save Changes</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* View Mode */
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div>
                                                                    <h5 style={{ fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b', fontSize: '14px', marginBottom: '10px' }}>{p.name}</h5>
                                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                                                                        {p.weeks.map((val, i) => (
                                                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '24px' }}>
                                                                                <div style={{ width: '8px', backgroundColor: isDark ? '#334155' : '#e2e8f0', height: '36px', borderRadius: '999px', position: 'relative', overflow: 'hidden' }}>
                                                                                    <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'linear-gradient(180deg, #3b82f6 0%, #7637E3 100%)', borderRadius: '999px', height: `${val}%` }} />
                                                                                </div>
                                                                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: isDark ? '#94a3b8' : '#64748b' }}>{val}</span>
                                                                            </div>
                                                                        ))}
                                                                        <div style={{ marginLeft: '8px', fontSize: '11px', color: '#00BD00', fontWeight: '600' }}>→ {p.weeks[p.weeks.length - 1]}%</div>
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <button
                                                                        onClick={() => handleStartEdit(idx)}
                                                                        style={{ padding: '8px', color: isDark ? '#94a3b8' : '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', borderRadius: '6px' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                        title="Edit profile"
                                                                    >
                                                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteProfile(idx)}
                                                                        style={{ padding: '8px', color: '#cbd5e1', cursor: 'pointer', background: 'none', border: 'none', borderRadius: '6px' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                        title="Delete profile"
                                                                    >
                                                                        {ICONS.CLOSE}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'logic' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                                    {/* Capacity Engine Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)'
                                                : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#1e40af' : '#93c5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#dbeafe' : '#1e3a8a' }}>Capacity Engine</h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(219, 234, 254, 0.7)' : '#3b82f6', marginTop: '2px' }}>
                                                    Core calculation parameters
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{
                                                padding: '12px 16px',
                                                borderRadius: '10px',
                                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                fontFamily: 'monospace',
                                                fontSize: '11px',
                                                color: isDark ? '#94a3b8' : '#475569'
                                            }}>
                                                Effective Capacity = Working Hours × Target Utilization × Global Multiplier
                                            </div>
                                            <div style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <label style={{ fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', fontSize: '13px' }}>Global Capacity Multiplier</label>
                                                    <span style={{
                                                        fontSize: '14px', fontWeight: '700', color: '#3b82f6',
                                                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white',
                                                        padding: '6px 14px', borderRadius: '8px',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                    }}>
                                                        {(storedSettings.modelParams?.capacityMultiplier || 1).toFixed(2)}x
                                                    </span>
                                                </div>
                                                <input
                                                    type="range" min="0.5" max="1.5" step="0.05"
                                                    value={storedSettings.modelParams?.capacityMultiplier || 1}
                                                    onChange={e => saveSettingsToTable({
                                                        ...storedSettings,
                                                        modelParams: { ...storedSettings.modelParams, capacityMultiplier: Number(e.target.value) }
                                                    })}
                                                    style={{ width: '100%', height: '6px', cursor: 'pointer', accentColor: '#3b82f6', borderRadius: '3px' }}
                                                />
                                                <p style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '8px', marginBottom: 0 }}>
                                                    Adjusts total capacity availability (1.0 = 100%, 0.9 = 90%)
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Effort Profiles Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #581c87 0%, #7637E3 100%)'
                                                : 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                            borderBottom: `1px solid ${isDark ? '#7637E3' : '#c4b5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a78bfa' : '#7637E3'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 3v18h18" />
                                                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#f3e8ff' : '#581c87' }}>Effort Profiles</h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(243, 232, 255, 0.7)' : '#7637E3', marginTop: '2px' }}>
                                                    How effort is distributed across project duration
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <label style={{ fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', fontSize: '13px' }}>Curve Aggressiveness (Peak Factor)</label>
                                                    <span style={{
                                                        fontSize: '14px', fontWeight: '700', color: '#BD65FF',
                                                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white',
                                                        padding: '6px 14px', borderRadius: '8px',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                    }}>
                                                        {(storedSettings.modelParams?.curvePeak || 2).toFixed(1)}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range" min="1.0" max="3.0" step="0.1"
                                                    value={storedSettings.modelParams?.curvePeak || 2}
                                                    onChange={e => saveSettingsToTable({
                                                        ...storedSettings,
                                                        modelParams: { ...storedSettings.modelParams, curvePeak: Number(e.target.value) }
                                                    })}
                                                    style={{ width: '100%', height: '6px', cursor: 'pointer', accentColor: '#BD65FF', borderRadius: '3px' }}
                                                />
                                                <p style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '8px', marginBottom: 0 }}>
                                                    Controls the steepness of Front/Back loaded curves. Higher = more dramatic shift.
                                                </p>
                                            </div>

                                            {/* Curve Visualizations */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                                                {[
                                                    { label: 'Front Loaded', desc: 'Peak Start', color: '#BD65FF', path: (peak) => `M0 ${100 - peak * 50} L100 100`, fill: 'M0 0 L100 100 L100 100 L0 100 Z' },
                                                    { label: 'Back Loaded', desc: 'Peak End', color: '#BD65FF', path: (peak) => `M0 100 L100 ${100 - peak * 50}`, fill: 'M0 100 L100 0 L100 100 L0 100 Z' },
                                                    { label: 'Bell Curve', desc: 'Peak Middle', color: '#00BD00', path: () => 'M0 100 Q25 100 50 10 Q75 100 100 100', fill: 'M0 100 Q25 100 50 10 Q75 100 100 100 L100 100 L0 100 Z' },
                                                    { label: 'FPS 3-Stage', desc: 'Impl→UAT→Close', color: '#f59e0b', path: () => 'M0 20 L40 20 L40 50 L70 50 L70 70 L100 70', fill: null, rects: true },
                                                    { label: 'Domestic UK', desc: 'Flat + Hypercare', color: '#3b82f6', path: () => 'M0 35 L70 35 L70 35 L70 70 L100 70', fill: null, domestic: true }
                                                ].map(({ label, desc, color, path, fill, rects, domestic }) => (
                                                    <div key={label} style={{
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'white',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                    }}>
                                                        <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '2px' }}>{label}</div>
                                                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '8px' }}>{desc}</div>
                                                        <div style={{ height: '40px', width: '100%', backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: '6px', overflow: 'hidden' }}>
                                                            <svg style={{ width: '100%', height: '100%', color }} viewBox="0 0 100 100" preserveAspectRatio="none">
                                                                {domestic ? (
                                                                    <>
                                                                        <rect x="0" y="35" width="70" height="65" fill={color} fillOpacity="0.1" />
                                                                        <rect x="70" y="70" width="30" height="30" fill="#f59e0b" fillOpacity="0.2" />
                                                                        <path d="M0 35 L70 35" stroke={color} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                                                                        <path d="M70 70 L100 70" stroke="#f59e0b" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />
                                                                        <line x1="70" y1="35" x2="70" y2="100" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                                                                    </>
                                                                ) : rects ? (
                                                                    <>
                                                                        <rect x="0" y="20" width="40" height="80" fill={color} fillOpacity="0.2" />
                                                                        <rect x="40" y="50" width="30" height="50" fill={color} fillOpacity="0.15" />
                                                                        <rect x="70" y="70" width="30" height="30" fill={color} fillOpacity="0.1" />
                                                                        <path d={path()} stroke={color} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <path d={fill} fill={color} fillOpacity="0.1" />
                                                                        <path d={path(storedSettings.modelParams?.curvePeak || 2)} stroke={color} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                                                                    </>
                                                                )}
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role-Specific Profile (Benifex) Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #047857 100%)'
                                                : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                            borderBottom: `1px solid ${isDark ? '#047857' : '#6ee7b7'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#6ee7b7' : '#047857'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#d1fae5' : '#065f46' }}>Role-Specific Profile (Benifex)</h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(209, 250, 229, 0.7)' : '#00BD00', marginTop: '2px' }}>
                                                    Configure different effort curves for each role
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                                                When a project uses the "Benifex - Role Specific" effort profile, these settings control the curve applied to each role. After go-live, a fixed hypercare effort is applied for the configured duration.
                                            </p>

                                            {/* Hypercare Settings Grid — shared storage key with roleSpecificProfile */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                                {/* Hypercare Duration */}
                                                <div style={{
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                                        <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>Hypercare Duration</span>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '10px' }}>Weeks of support after go-live</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>Weeks</span>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', fontFamily: 'monospace' }}>
                                                            {storedSettings.modelParams?.roleSpecificProfile?.hypercareWeeks ?? 13}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="4"
                                                        max="26"
                                                        step="1"
                                                        value={storedSettings.modelParams?.roleSpecificProfile?.hypercareWeeks ?? 13}
                                                        onChange={e => {
                                                            const newRoleProfiles = {
                                                                ...(storedSettings.modelParams?.roleSpecificProfile || {}),
                                                                hypercareWeeks: Number(e.target.value)
                                                            };
                                                            saveSettingsToTable({
                                                                ...storedSettings,
                                                                modelParams: {
                                                                    ...storedSettings.modelParams,
                                                                    roleSpecificProfile: newRoleProfiles
                                                                }
                                                            });
                                                        }}
                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#f59e0b' }}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                        <span>4 wks</span>
                                                        <span>26 wks</span>
                                                    </div>
                                                </div>

                                                {/* Hypercare Hours — supports two modes: 'fixed' hrs/week, or 'percent' of project effort */}
                                                {(() => {
                                                    const rp = storedSettings.modelParams?.roleSpecificProfile || {};
                                                    const mode = rp.hypercareMode || 'fixed';
                                                    const fixedHrs = rp.hypercareHoursPerWeek ?? 3;
                                                    const pctValue = rp.hypercarePercentPerWeek ?? 1.25;
                                                    const writeRP = (patch) => saveSettingsToTable({
                                                        ...storedSettings,
                                                        modelParams: {
                                                            ...storedSettings.modelParams,
                                                            roleSpecificProfile: { ...rp, ...patch }
                                                        }
                                                    });
                                                    return (
                                                        <div style={{
                                                            padding: '16px',
                                                            borderRadius: '12px',
                                                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>Hypercare Hours</span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}` }}>
                                                                    {[
                                                                        { key: 'fixed', label: 'Fixed' },
                                                                        { key: 'percent', label: '% of effort' }
                                                                    ].map(({ key, label }) => (
                                                                        <button key={key}
                                                                            onClick={() => writeRP({ hypercareMode: key })}
                                                                            style={{
                                                                                padding: '3px 10px', fontSize: '10px', fontWeight: '600',
                                                                                border: 'none', cursor: 'pointer',
                                                                                backgroundColor: mode === key ? '#3b82f6' : (isDark ? 'transparent' : 'white'),
                                                                                color: mode === key ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                        >{label}</button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '10px' }}>
                                                                {mode === 'fixed'
                                                                    ? 'Total hours per week (split across PM/SC/PD)'
                                                                    : 'Per-week hours = total project effort × this %'}
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>{mode === 'fixed' ? 'hrs/week' : '% per week'}</span>
                                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>
                                                                    {mode === 'fixed' ? `${fixedHrs}h` : `${pctValue.toFixed(2)}%`}
                                                                </span>
                                                            </div>
                                                            {mode === 'fixed' ? (
                                                                <>
                                                                    <input type="range" min="1" max="15" step="1"
                                                                        value={fixedHrs}
                                                                        onChange={e => writeRP({ hypercareHoursPerWeek: Number(e.target.value) })}
                                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                                    />
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                                        <span>1 hr</span><span>15 hrs</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <input type="range" min="0.25" max="5" step="0.25"
                                                                        value={pctValue}
                                                                        onChange={e => writeRP({ hypercarePercentPerWeek: Number(e.target.value) })}
                                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                                    />
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                                        <span>0.25%</span><span>5%</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Role Curve Selectors */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                                {[
                                                    { role: 'sc', label: 'SC (Consulting)', defaultVal: 'front', color: '#3b82f6', desc: 'Solution Consulting' },
                                                    { role: 'pd', label: 'PD (Build)', defaultVal: 'back', color: '#00BD00', desc: 'Development' },
                                                    { role: 'pm', label: 'PM', defaultVal: 'flat', color: '#BD65FF', desc: 'Project Management' }
                                                ].map(({ role, label, defaultVal, color, desc }) => {
                                                    const currentValue = storedSettings.modelParams?.roleSpecificProfile?.[`${role}Profile`] || defaultVal;
                                                    return (
                                                        <div key={role} style={{
                                                            padding: '16px',
                                                            borderRadius: '12px',
                                                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <div style={{
                                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                                    backgroundColor: color
                                                                }} />
                                                                <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>{label}</span>
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '10px' }}>{desc}</div>
                                                            <select
                                                                value={currentValue}
                                                                onChange={e => {
                                                                    const newRoleProfiles = {
                                                                        ...(storedSettings.modelParams?.roleSpecificProfile || {}),
                                                                        [`${role}Profile`]: e.target.value
                                                                    };
                                                                    saveSettingsToTable({
                                                                        ...storedSettings,
                                                                        modelParams: {
                                                                            ...storedSettings.modelParams,
                                                                            roleSpecificProfile: newRoleProfiles
                                                                        }
                                                                    });
                                                                }}
                                                                style={{
                                                                    width: '100%', padding: '10px', fontSize: '12px', fontWeight: '600',
                                                                    borderRadius: '8px',
                                                                    border: `2px solid ${color}40`,
                                                                    backgroundColor: isDark ? '#0f172a' : 'white',
                                                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                                                    cursor: 'pointer',
                                                                    outline: 'none'
                                                                }}
                                                            >
                                                                <option value="flat">— Flat (Even)</option>
                                                                <option value="front">↘ Front Loaded</option>
                                                                <option value="back">↗ Back Loaded</option>
                                                                <option value="bell">∩ Bell Curve</option>
                                                            </select>
                                                            {/* Spread Control - only show for front/back/bell */}
                                                            {currentValue !== 'flat' && (() => {
                                                                const spreadKey = `${role}Spread`;
                                                                const currentSpread = storedSettings.modelParams?.roleSpecificProfile?.[spreadKey] ?? 2.0;
                                                                return (
                                                                    <div style={{ marginTop: '10px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                            <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>Spread</span>
                                                                            <span style={{ fontSize: '10px', fontWeight: '700', color, fontFamily: 'monospace' }}>{currentSpread.toFixed(1)}x</span>
                                                                        </div>
                                                                        <input
                                                                            type="range"
                                                                            min="1"
                                                                            max="3"
                                                                            step="0.1"
                                                                            value={currentSpread}
                                                                            onChange={e => {
                                                                                const newSpread = parseFloat(e.target.value);
                                                                                const newRoleProfiles = {
                                                                                    ...(storedSettings.modelParams?.roleSpecificProfile || {}),
                                                                                    [spreadKey]: newSpread
                                                                                };
                                                                                saveSettingsToTable({
                                                                                    ...storedSettings,
                                                                                    modelParams: {
                                                                                        ...storedSettings.modelParams,
                                                                                        roleSpecificProfile: newRoleProfiles
                                                                                    }
                                                                                });
                                                                            }}
                                                                            style={{
                                                                                width: '100%',
                                                                                height: '6px',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                accentColor: color
                                                                            }}
                                                                        />
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                                            <span>Linear</span>
                                                                            <span>Steep</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {/* Mini curve visualization - now uses spread value */}
                                                            {(() => {
                                                                const spreadKey = `${role}Spread`;
                                                                const spread = storedSettings.modelParams?.roleSpecificProfile?.[spreadKey] ?? 2.0;
                                                                // Generate curve path based on spread
                                                                const generatePath = () => {
                                                                    if (currentValue === 'flat') return 'M0 15 L100 15';
                                                                    const points = [];
                                                                    for (let i = 0; i <= 10; i++) {
                                                                        const x = i * 10;
                                                                        const prog = i / 10;
                                                                        let y;
                                                                        if (currentValue === 'front') {
                                                                            y = 25 - (spread * (1 - prog) * 10);
                                                                        } else if (currentValue === 'back') {
                                                                            y = 25 - (spread * prog * 10);
                                                                        } else if (currentValue === 'bell') {
                                                                            y = 25 - (spread * 4 * prog * (1 - prog) * 7.5);
                                                                        }
                                                                        y = Math.max(2, Math.min(28, y));
                                                                        points.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
                                                                    }
                                                                    return points.join(' ');
                                                                };
                                                                return (
                                                                    <div style={{ marginTop: '10px', height: '24px', backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                                        <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 100 30" preserveAspectRatio="none">
                                                                            <path d={generatePath()} stroke={color} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                                                                        </svg>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Benifex Domestic UK Profile Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)'
                                                : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#1d4ed8' : '#93c5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#93c5fd' : '#1d4ed8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                    <polyline points="9 22 9 12 15 12 15 22" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#dbeafe' : '#1e3a8a' }}>Benifex Domestic UK</h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(219, 234, 254, 0.7)' : '#3b82f6', marginTop: '2px' }}>
                                                    Flat demand + post go-live hypercare
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                                                When a project uses "Benifex Domestic UK", demand is flat during the project timeline. After go-live, a fixed hypercare effort is applied for the configured duration.
                                            </p>

                                            {/* Hypercare Settings Grid */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                                {/* Hypercare Duration */}
                                                <div style={{
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                                        <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>Hypercare Duration</span>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '10px' }}>Weeks of support after go-live</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>Weeks</span>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', fontFamily: 'monospace' }}>
                                                            {storedSettings.modelParams?.domesticProfile?.hypercareWeeks ?? 13}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="4"
                                                        max="26"
                                                        step="1"
                                                        value={storedSettings.modelParams?.domesticProfile?.hypercareWeeks ?? 13}
                                                        onChange={e => {
                                                            const newDomestic = {
                                                                ...(storedSettings.modelParams?.domesticProfile || {}),
                                                                hypercareWeeks: Number(e.target.value)
                                                            };
                                                            saveSettingsToTable({
                                                                ...storedSettings,
                                                                modelParams: {
                                                                    ...storedSettings.modelParams,
                                                                    domesticProfile: newDomestic
                                                                }
                                                            });
                                                        }}
                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#f59e0b' }}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                        <span>4 wks</span>
                                                        <span>26 wks</span>
                                                    </div>
                                                </div>

                                                {/* Hypercare Hours — supports two modes: 'fixed' hrs/week, or 'percent' of project effort */}
                                                {(() => {
                                                    const dp = storedSettings.modelParams?.domesticProfile || {};
                                                    const mode = dp.hypercareMode || 'fixed';
                                                    const fixedHrs = dp.hypercareHoursPerWeek ?? 3;
                                                    const pctValue = dp.hypercarePercentPerWeek ?? 1.25;
                                                    const writeDomestic = (patch) => saveSettingsToTable({
                                                        ...storedSettings,
                                                        modelParams: {
                                                            ...storedSettings.modelParams,
                                                            domesticProfile: { ...dp, ...patch }
                                                        }
                                                    });
                                                    return (
                                                        <div style={{
                                                            padding: '16px',
                                                            borderRadius: '12px',
                                                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>Hypercare Hours</span>
                                                                </div>
                                                                {/* Mode pills */}
                                                                <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}` }}>
                                                                    {[
                                                                        { key: 'fixed', label: 'Fixed' },
                                                                        { key: 'percent', label: '% of effort' }
                                                                    ].map(({ key, label }) => (
                                                                        <button key={key}
                                                                            onClick={() => writeDomestic({ hypercareMode: key })}
                                                                            style={{
                                                                                padding: '3px 10px', fontSize: '10px', fontWeight: '600',
                                                                                border: 'none', cursor: 'pointer',
                                                                                backgroundColor: mode === key ? '#3b82f6' : (isDark ? 'transparent' : 'white'),
                                                                                color: mode === key ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                        >{label}</button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '10px' }}>
                                                                {mode === 'fixed'
                                                                    ? 'Total hours per week (split across PM/SC/PD)'
                                                                    : 'Per-week hours = total project effort × this %'}
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>{mode === 'fixed' ? 'hrs/week' : '% per week'}</span>
                                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>
                                                                    {mode === 'fixed' ? `${fixedHrs}h` : `${pctValue.toFixed(2)}%`}
                                                                </span>
                                                            </div>
                                                            {mode === 'fixed' ? (
                                                                <>
                                                                    <input type="range" min="1" max="15" step="1"
                                                                        value={fixedHrs}
                                                                        onChange={e => writeDomestic({ hypercareHoursPerWeek: Number(e.target.value) })}
                                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                                    />
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                                        <span>1 hr</span><span>15 hrs</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <input type="range" min="0.25" max="5" step="0.25"
                                                                        value={pctValue}
                                                                        onChange={e => writeDomestic({ hypercarePercentPerWeek: Number(e.target.value) })}
                                                                        style={{ width: '100%', height: '6px', borderRadius: '3px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                                    />
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: isDark ? '#475569' : '#cbd5e1' }}>
                                                                        <span>0.25%</span><span>5%</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Visualization */}
                                            {(() => {
                                                const hcWeeks = storedSettings.modelParams?.domesticProfile?.hypercareWeeks ?? 13;
                                                const hcHours = storedSettings.modelParams?.domesticProfile?.hypercareHoursPerWeek ?? 3;
                                                const hcPct = Math.round((hcWeeks / 26) * 30);
                                                const flatWidth = 100 - hcPct;
                                                return (
                                                    <div style={{
                                                        padding: '16px',
                                                        borderRadius: '12px',
                                                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                    }}>
                                                        <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                            Profile Shape Preview
                                                        </div>
                                                        <div style={{ height: '50px', width: '100%', backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                                                            <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                                                                <rect x="0" y="30" width={flatWidth} height="70" fill="#3b82f6" fillOpacity="0.1" />
                                                                <rect x={flatWidth} y="70" width={hcPct} height="30" fill="#f59e0b" fillOpacity="0.2" />
                                                                <path d={`M0 30 L${flatWidth} 30`} stroke="#3b82f6" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke" />
                                                                <path d={`M${flatWidth} 70 L100 70`} stroke="#f59e0b" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />
                                                                <line x1={flatWidth} y1="20" x2={flatWidth} y2="100" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                                                            </svg>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '9px', fontFamily: 'monospace' }}>
                                                            <span style={{ color: '#3b82f6', fontWeight: '600' }}>◼ Flat (project)</span>
                                                            <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>│ Go-Live</span>
                                                            <span style={{ color: '#f59e0b', fontWeight: '600' }}>◼ Hypercare ({hcWeeks}w × {hcHours}h)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'slots' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* Hero Section - Standard Project Profile */}
                                    <div style={{
                                        padding: '28px',
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)'
                                            : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)',
                                        borderRadius: '20px',
                                        border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                                        boxShadow: isDark
                                            ? '0 8px 32px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
                                            : '0 8px 32px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Background decoration */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '-50%',
                                            right: '-10%',
                                            width: '300px',
                                            height: '300px',
                                            background: isDark
                                                ? 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)'
                                                : 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
                                            pointerEvents: 'none'
                                        }} />

                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                                            <div style={{
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '16px',
                                                background: 'linear-gradient(135deg, #7637E3 0%, #BD65FF 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                                            }}>
                                                <svg style={{ width: '26px', height: '26px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 style={{
                                                    fontSize: '20px',
                                                    fontWeight: '800',
                                                    color: isDark ? '#e0e7ff' : '#1e40af',
                                                    margin: 0,
                                                    letterSpacing: '-0.02em'
                                                }}>Standard Project Profile</h3>
                                                <p style={{ fontSize: '13px', color: isDark ? '#a5b4fc' : '#3b82f6', margin: '4px 0 0 0' }}>
                                                    Define what "1 slot" means for capacity planning
                                                </p>
                                            </div>
                                            <div style={{
                                                marginLeft: 'auto',
                                                padding: '6px 14px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                color: 'white',
                                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                                            }}>
                                                1x SLOT
                                            </div>
                                        </div>

                                        {/* Effort Cards - Premium Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                                            {[
                                                {
                                                    key: 'pmHours',
                                                    label: 'PM',
                                                    fullLabel: 'Project Management',
                                                    color: '#BD65FF',
                                                    gradient: 'linear-gradient(135deg, #BD65FF 0%, #a78bfa 100%)',
                                                    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
                                                },
                                                {
                                                    key: 'scHours',
                                                    label: 'SC',
                                                    fullLabel: 'Solution Consulting',
                                                    color: '#3b82f6',
                                                    gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                                                    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                                                },
                                                {
                                                    key: 'buildHours',
                                                    label: 'Build',
                                                    fullLabel: 'Development',
                                                    color: '#00BD00',
                                                    gradient: 'linear-gradient(135deg, #00BD00 0%, #34d399 100%)',
                                                    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                                                }
                                            ].map(({ key, label, fullLabel, color, gradient, icon }) => (
                                                <div key={key} style={{
                                                    padding: '20px',
                                                    background: isDark
                                                        ? 'rgba(255,255,255,0.03)'
                                                        : 'rgba(255,255,255,0.8)',
                                                    backdropFilter: 'blur(8px)',
                                                    borderRadius: '16px',
                                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'}`,
                                                    boxShadow: isDark
                                                        ? '0 4px 16px rgba(0,0,0,0.2)'
                                                        : '0 4px 16px rgba(0,0,0,0.05)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Accent bar */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '4px',
                                                        background: gradient,
                                                        borderRadius: '16px 16px 0 0'
                                                    }} />

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                                        <div style={{ color: color }}>{icon}</div>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: '800', color: color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                                                            <div style={{ fontSize: '10px', color: isDark ? '#6b7280' : '#94a3b8' }}>{fullLabel}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                        <input
                                                            type="number"
                                                            value={slotProfile[key]}
                                                            onChange={e => saveSettingsToTable({
                                                                ...storedSettings,
                                                                slotProfile: { ...slotProfile, [key]: Number(e.target.value) || 0 }
                                                            })}
                                                            style={{
                                                                width: '90px',
                                                                padding: '14px 16px',
                                                                fontSize: '28px',
                                                                fontWeight: '800',
                                                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                                                borderRadius: '12px',
                                                                border: `2px solid ${isDark ? '#374151' : '#e2e8f0'}`,
                                                                backgroundColor: isDark ? '#1f2937' : '#f8fafc',
                                                                color: isDark ? '#f1f5f9' : '#1e293b',
                                                                textAlign: 'center',
                                                                outline: 'none',
                                                                transition: 'border-color 0.2s, box-shadow 0.2s'
                                                            }}
                                                            onFocus={(e) => {
                                                                e.target.style.borderColor = color;
                                                                e.target.style.boxShadow = `0 0 0 4px ${color}20`;
                                                            }}
                                                            onBlur={(e) => {
                                                                e.target.style.borderColor = isDark ? '#374151' : '#e2e8f0';
                                                                e.target.style.boxShadow = 'none';
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#6b7280' : '#94a3b8' }}>hrs</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Duration and Assignees - Inline */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '24px',
                                            padding: '16px 20px',
                                            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
                                            borderRadius: '12px',
                                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</label>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                        <input
                                                            type="number"
                                                            value={slotProfile.durationWeeks}
                                                            onChange={e => saveSettingsToTable({
                                                                ...storedSettings,
                                                                slotProfile: { ...slotProfile, durationWeeks: Number(e.target.value) || 12 }
                                                            })}
                                                            style={{
                                                                width: '70px',
                                                                padding: '6px 10px',
                                                                fontSize: '18px',
                                                                fontWeight: '700',
                                                                borderRadius: '8px',
                                                                border: `1px solid ${isDark ? '#374151' : '#e2e8f0'}`,
                                                                backgroundColor: isDark ? '#1f2937' : 'white',
                                                                color: isDark ? '#f1f5f9' : '#1e293b',
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '12px', color: isDark ? '#6b7280' : '#94a3b8' }}>weeks</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ width: '1px', backgroundColor: isDark ? '#374151' : '#e2e8f0' }} />

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max per Role</label>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="5"
                                                            value={slotProfile.maxAssigneesPerRole}
                                                            onChange={e => saveSettingsToTable({
                                                                ...storedSettings,
                                                                slotProfile: { ...slotProfile, maxAssigneesPerRole: Number(e.target.value) || 2 }
                                                            })}
                                                            style={{
                                                                width: '70px',
                                                                padding: '6px 10px',
                                                                fontSize: '18px',
                                                                fontWeight: '700',
                                                                borderRadius: '8px',
                                                                border: `1px solid ${isDark ? '#374151' : '#e2e8f0'}`,
                                                                backgroundColor: isDark ? '#1f2937' : 'white',
                                                                color: isDark ? '#f1f5f9' : '#1e293b',
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '12px', color: isDark ? '#6b7280' : '#94a3b8' }}>people</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Slot Field Locks - New Configuration Card */}
                                        <div style={{
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                                : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                            borderRadius: '16px',
                                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                            overflow: 'hidden',
                                            boxShadow: isDark
                                                ? '0 4px 24px rgba(0,0,0,0.3)'
                                                : '0 4px 24px rgba(0,0,0,0.06)'
                                        }}>
                                            {/* Card Header */}
                                            <div style={{
                                                padding: '16px 20px',
                                                background: isDark
                                                    ? 'linear-gradient(135deg, #374151 0%, #1f2937 100%)'
                                                    : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                                borderBottom: `1px solid ${isDark ? '#4b5563' : '#cbd5e1'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px'
                                            }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 8px rgba(100,116,139,0.3)'
                                                }}>
                                                    <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155', margin: 0 }}>
                                                        Slot Field Locks
                                                    </h4>
                                                    <p style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#64748b', margin: 0 }}>
                                                        Map Airtable fields to control optimization constraints
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Card Body */}
                                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {(() => {
                                                    const projectsTable = (allTables || []).find(t => t.id === storedSettings[SETTINGS.PROJECTS_TABLE] || t.name === storedSettings[SETTINGS.PROJECTS_TABLE]);
                                                    const fields = projectsTable ? projectsTable.fields : [];

                                                    const renderFieldSelect = (label, settingKey, description) => (
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                                <label style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>{label}</label>
                                                            </div>
                                                            <select
                                                                value={storedSettings[settingKey] || ''}
                                                                onChange={e => saveSettingsToTable({ ...storedSettings, [settingKey]: e.target.value })}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '10px',
                                                                    fontSize: '13px',
                                                                    borderRadius: '8px',
                                                                    border: `1px solid ${isDark ? '#4b5563' : '#cbd5e1'}`,
                                                                    backgroundColor: isDark ? '#1f2937' : 'white',
                                                                    color: isDark ? '#f3f4f6' : '#1e293b'
                                                                }}
                                                            >
                                                                <option value="">Select a field...</option>
                                                                {fields.map(f => (
                                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                                ))}
                                                            </select>
                                                            <p style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#64748b', marginTop: '4px' }}>{description}</p>
                                                        </div>
                                                    );

                                                    return (
                                                        <>
                                                            {renderFieldSelect('Launch Date Lock', SETTINGS.SLOT_LOCK_LAUNCH, 'Checkbox or Single Select field to prevent moving launch dates')}
                                                            {renderFieldSelect('Squad Lock', SETTINGS.SLOT_LOCK_SQUAD, 'Checkbox or Single Select field to prevent reassigning squads')}
                                                            {renderFieldSelect('Resource Lock', SETTINGS.SLOT_LOCK_RESOURCES, 'Checkbox or Single Select field to prevent changing resource allocations')}
                                                            <div style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: '16px', marginTop: '8px' }}>
                                                                <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                                                    Optimizer Field Mappings
                                                                </div>
                                                                {renderFieldSelect('Platform', SETTINGS.PROJECT_PLATFORM, 'Hard constraint — squads can only be assigned projects matching their supported platforms')}
                                                                {renderFieldSelect('Country', SETTINGS.PROJECT_COUNTRY, 'Soft preference — country-matching squads get a score bonus but are not required')}
                                                                {renderFieldSelect('Customer Risk', SETTINGS.CUSTOMER_RISK, 'Single Select field for customer risk level (e.g. High, Medium, Low)')}
                                                                {renderFieldSelect('Compelling Event Date', SETTINGS.COMPELLING_EVENT_DATE, 'Date field for the deadline by which project must be live')}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Field Mappings - Now via Custom Properties */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #7637E3 0%, #7637E3 100%)'
                                                : 'linear-gradient(135deg, #E8E1D9 0%, #ddd6fe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#BD65FF' : '#c4b5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #BD65FF 0%, #7637E3 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                                            }}>
                                                <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#E8E1D9' : '#5b21b6', margin: 0 }}>
                                                    AI & Metrics Field Mappings
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#c4b5fd' : '#7637E3', margin: 0 }}>
                                                    Configured via Airtable custom properties
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{
                                                padding: '16px',
                                                borderRadius: '10px',
                                                background: isDark ? 'rgba(139,92,246,0.1)' : '#F7F3ED',
                                                border: `1px solid ${isDark ? '#7637E3' : '#ddd6fe'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px'
                                            }}>
                                                <span style={{ fontSize: '24px' }}>⚙️</span>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '4px' }}>
                                                        Configure in Interface Designer
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                                                        AI field mappings (AI Insights, Risk Level, Next Actions, AI Confidence, Impact Summary, ARR Affected, Delay Weeks, Bottleneck Role) are now configured in the Airtable custom properties panel. Click the gear icon on this element in Interface Designer to map fields.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {/* Card Header */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                                                : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                                            borderBottom: `1px solid ${isDark ? '#991b1b' : '#fca5a5'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                                            }}>
                                                <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#fecaca' : '#991b1b', margin: 0 }}>
                                                    Optimization Constraints
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#f87171' : '#dc2626', margin: 0 }}>
                                                    Set safety limits for bulk allocation
                                                </p>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                    Max Concurrent Projects
                                                </span>
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: '700',
                                                    fontFamily: 'monospace',
                                                    color: '#ef4444',
                                                    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {slotOptimization.programConcurrency || 2}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <input
                                                    type="range" min="1" max="5" step="1"
                                                    value={slotOptimization.programConcurrency || 2}
                                                    onChange={e => saveSettingsToTable({
                                                        ...storedSettings,
                                                        slotOptimization: { ...slotOptimization, programConcurrency: Number(e.target.value) }
                                                    })}
                                                    style={{ flexGrow: 1, height: '6px', cursor: 'pointer', accentColor: '#ef4444' }}
                                                />
                                            </div>
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Limit how many projects from the same Program can run in parallel
                                            </p>
                                        </div>
                                    </div>

                                    {/* Multiplier Preview - Premium Cards */}
                                    <div style={{
                                        padding: '20px',
                                        background: isDark
                                            ? 'linear-gradient(135deg, #052e16 0%, #14532d 100%)'
                                            : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#166534' : '#86efac'}`,
                                        boxShadow: isDark ? '0 4px 16px rgba(34, 197, 94, 0.1)' : '0 4px 16px rgba(34, 197, 94, 0.08)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#86efac' : '#166534', margin: 0 }}>Project Size Multipliers</h4>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                            {[
                                                { mult: 0.5, label: 'Small', desc: 'Quick wins, simple scope' },
                                                { mult: 1, label: 'Standard', desc: 'Typical project delivery' },
                                                { mult: 2, label: 'Large', desc: 'Complex, multi-phase' },
                                                { mult: 5, label: 'Enterprise', desc: 'Major transformation' }
                                            ].map(({ mult, label, desc }) => (
                                                <div key={mult} style={{
                                                    padding: '16px',
                                                    background: isDark ? 'rgba(0,0,0,0.3)' : 'white',
                                                    borderRadius: '12px',
                                                    border: mult === 1
                                                        ? `3px solid ${isDark ? '#00BD00' : '#00BD00'}`
                                                        : `1px solid ${isDark ? '#374151' : '#d1fae5'}`,
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s',
                                                    cursor: 'default',
                                                    boxShadow: mult === 1 ? `0 4px 12px ${isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}` : 'none'
                                                }}>
                                                    <div style={{
                                                        fontSize: '24px',
                                                        fontWeight: '900',
                                                        color: mult === 1 ? (isDark ? '#00BD00' : '#00BD00') : (isDark ? '#6b7280' : '#64748b'),
                                                        marginBottom: '4px'
                                                    }}>{mult}x</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#9ca3af' : '#475569', marginBottom: '2px' }}>{label}</div>
                                                    <div style={{
                                                        fontSize: '13px',
                                                        fontFamily: 'monospace',
                                                        fontWeight: '600',
                                                        color: isDark ? '#00BD00' : '#15803d',
                                                        marginBottom: '4px',
                                                        padding: '4px 8px',
                                                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)',
                                                        borderRadius: '6px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {Math.round(slotProfile.pmHours * mult)}/{Math.round(slotProfile.scHours * mult)}/{Math.round(slotProfile.buildHours * mult)}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: isDark ? '#6b7280' : '#9ca3af' }}>{desc}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Optimization Engine - Moved to Run Modal */}
                                    {/* Previously contained Priority Dial, Constraints etc. */}
                                    {/* See OptimizationModal.jsx for per-run definitions */}
                                </div>
                            )}

                            {/* Programs Tab - Program Resourcing Feature */}
                            {activeTab === 'programs' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Program Discount Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                                                : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                            borderBottom: `1px solid ${isDark ? '#00BD00' : '#6ee7b7'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#a7f3d0' : '#065f46', margin: 0 }}>
                                                    Program Effort Transfer
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#6ee7b7' : '#047857', margin: 0 }}>
                                                    Percentage of project effort transferred to program budget
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                    Program Discount
                                                </span>
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: '700',
                                                    fontFamily: 'monospace',
                                                    color: '#00BD00',
                                                    backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.1)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {storedSettings.programDiscount ?? 15}%
                                                </span>
                                            </div>
                                            <input
                                                type="range" min="0" max="50" step="5"
                                                value={storedSettings.programDiscount ?? 15}
                                                onChange={e => saveSettingsToTable({ ...storedSettings, programDiscount: Number(e.target.value) })}
                                                style={{ width: '100%', height: '6px', cursor: 'pointer', accentColor: '#00BD00' }}
                                            />
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Projects with "Resourced Within Program" will transfer this % to program workstreams
                                            </p>
                                        </div>
                                    </div>

                                    {/* Efficiency Factor Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)'
                                                : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#7637E3' : '#a5b4fc'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #7637E3 0%, #4f46e5 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#c7d2fe' : '#3730a3', margin: 0 }}>
                                                    Efficiency Factor
                                                </h4>
                                                <p style={{ fontSize: '11px', color: isDark ? '#a5b4fc' : '#4338ca', margin: 0 }}>
                                                    Program efficiency gain (reduces transferred effort)
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                    Efficiency Gain
                                                </span>
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: '700',
                                                    fontFamily: 'monospace',
                                                    color: '#7637E3',
                                                    backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.1)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {storedSettings.programEfficiencyFactor || 0}%
                                                </span>
                                            </div>
                                            <input
                                                type="range" min="0" max="50" step="5"
                                                value={storedSettings.programEfficiencyFactor || 0}
                                                onChange={e => saveSettingsToTable({ ...storedSettings, programEfficiencyFactor: Number(e.target.value) })}
                                                style={{ width: '100%', height: '6px', cursor: 'pointer', accentColor: '#7637E3' }}
                                            />
                                            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 16v-4" />
                                                    <path d="M12 8h.01" />
                                                </svg>
                                                Future feature: reduces program workstream demand by this percentage
                                            </p>
                                        </div>
                                    </div>

                                    {/* Workstreams Configuration Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                                                : 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
                                            borderBottom: `1px solid ${isDark ? '#f97316' : '#fdba74'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 2px 8px rgba(249,115,22,0.3)'
                                                }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#fed7aa' : '#9a3412', margin: 0 }}>
                                                        Program Workstreams
                                                    </h4>
                                                    <p style={{ fontSize: '11px', color: isDark ? '#fdba74' : '#c2410c', margin: 0 }}>
                                                        Define how program effort is distributed across workstreams
                                                    </p>
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: isDark ? '#fed7aa' : '#9a3412',
                                                backgroundColor: isDark ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)',
                                                padding: '4px 10px',
                                                borderRadius: '12px'
                                            }}>
                                                Total: {(storedSettings.programWorkstreams || []).reduce((sum, ws) => sum + (ws.allocationPct || 0), 0)}%
                                            </span>
                                        </div>
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {(storedSettings.programWorkstreams || []).map((ws, idx) => (
                                                    <div key={idx} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px 16px',
                                                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                        borderRadius: '10px',
                                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                                    }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <input
                                                                type="text"
                                                                value={ws.name}
                                                                onChange={e => {
                                                                    const updated = [...(storedSettings.programWorkstreams || [])];
                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                    saveSettingsToTable({ ...storedSettings, programWorkstreams: updated });
                                                                }}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '6px 10px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '600',
                                                                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                                    borderRadius: '6px',
                                                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                                                    color: isDark ? '#f1f5f9' : '#1e293b'
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={ws.allocationPct}
                                                                onChange={e => {
                                                                    const updated = [...(storedSettings.programWorkstreams || [])];
                                                                    updated[idx] = { ...updated[idx], allocationPct: Number(e.target.value) };
                                                                    saveSettingsToTable({ ...storedSettings, programWorkstreams: updated });
                                                                }}
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '6px 10px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '700',
                                                                    textAlign: 'center',
                                                                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                                    borderRadius: '6px',
                                                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                                                    color: isDark ? '#f97316' : '#ea580c'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>%</span>
                                                            <button
                                                                onClick={() => {
                                                                    const updated = (storedSettings.programWorkstreams || []).filter((_, i) => i !== idx);
                                                                    saveSettingsToTable({ ...storedSettings, programWorkstreams: updated });
                                                                }}
                                                                style={{
                                                                    padding: '6px',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Add Workstream Button */}
                                            <button
                                                onClick={() => {
                                                    const updated = [...(storedSettings.programWorkstreams || []), { name: 'New Workstream', allocationPct: 0 }];
                                                    saveSettingsToTable({ ...storedSettings, programWorkstreams: updated });
                                                }}
                                                style={{
                                                    width: '100%',
                                                    marginTop: '12px',
                                                    padding: '10px 16px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    border: `2px dashed ${isDark ? '#475569' : '#cbd5e1'}`,
                                                    borderRadius: '10px',
                                                    backgroundColor: 'transparent',
                                                    color: isDark ? '#94a3b8' : '#64748b',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 5v14M5 12h14" />
                                                </svg>
                                                Add Workstream
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Intelligence Tab */}
                            {activeTab === 'ai' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* AI Configuration Card */}
                                    <div style={{
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            padding: '16px 20px',
                                            background: isDark
                                                ? 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'
                                                : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                            borderBottom: `1px solid ${isDark ? '#1d4ed8' : '#93c5fd'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                                                    <path d="M12 12 2.1 10.5" />
                                                    <path d="M12 12 12 21.9" />
                                                    <path d="M12 12 21.9 12" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDark ? '#dbeafe' : '#1e40af' }}>
                                                    AI Intelligence
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '11px', color: isDark ? 'rgba(219, 234, 254, 0.7)' : '#2563eb', marginTop: '2px' }}>
                                                    Configure Airtable AI fields for capacity recommendations
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* Intro Text */}
                                            <div style={{
                                                padding: '16px',
                                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                borderRadius: '12px',
                                                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
                                            }}>
                                                <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', lineHeight: '1.6' }}>
                                                    Connect to your Slot Intelligence table to enable AI-powered capacity analysis.
                                                    The extension will write slot snapshots to Airtable, where AI fields generate recommendations for squad optimization and timeline adjustments.
                                                </p>
                                            </div>

                                            {/* Table Selection */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '8px' }}>
                                                    Slot Intelligence Table
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={aiIntelligence.tableId || ''}
                                                        onChange={(e) => saveSettingsToTable({
                                                            ...storedSettings,
                                                            aiIntelligence: { ...aiIntelligence, tableId: e.target.value || null }
                                                        })}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            borderRadius: '10px',
                                                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                                            backgroundColor: isDark ? '#1e293b' : 'white',
                                                            color: isDark ? '#f1f5f9' : '#0f172a',
                                                            fontSize: '14px',
                                                            appearance: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="">Select a table...</option>
                                                        {allTables.map(table => (
                                                            <option key={table.id} value={table.id}>{table.name}</option>
                                                        ))}
                                                    </select>
                                                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="m6 9 6 6 6-6" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {!aiIntelligence.tableId && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                        <span style={{ fontSize: '14px' }}>⚠️</span>
                                                        <p style={{ margin: 0, fontSize: '12px', color: '#f59e0b' }}>
                                                            Please select a table to enable AI features
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Enable Toggle + Status */}
                                            {aiIntelligence.tableId && (
                                                <div style={{
                                                    padding: '16px',
                                                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
                                                    borderRadius: '12px',
                                                    border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : '#e2e8f0'}`,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <div style={{
                                                            width: '32px', height: '32px', borderRadius: '8px',
                                                            backgroundColor: aiIntelligence.enabled ? (isDark ? '#1e40af' : '#dbeafe') : (isDark ? '#334155' : '#f1f5f9'),
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: aiIntelligence.enabled ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#94a3b8' : '#94a3b8')
                                                        }}>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                                Enable AI Analysis
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                {aiIntelligence.lastSyncTime
                                                                    ? `Last synced: ${new Date(aiIntelligence.lastSyncTime).toLocaleDateString()} ${new Date(aiIntelligence.lastSyncTime).toLocaleTimeString()}`
                                                                    : 'Ready to sync snapshots'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div
                                                        onClick={() => saveSettingsToTable({
                                                            ...storedSettings,
                                                            aiIntelligence: { ...aiIntelligence, enabled: !aiIntelligence.enabled }
                                                        })}
                                                        style={{
                                                            width: '44px',
                                                            height: '24px',
                                                            borderRadius: '12px',
                                                            backgroundColor: aiIntelligence.enabled ? '#3b82f6' : (isDark ? '#475569' : '#cbd5e1'),
                                                            padding: '2px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: 'white',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                                            transform: aiIntelligence.enabled ? 'translateX(20px)' : 'translateX(0)',
                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* How it Works Card */}
                                    <div style={{
                                        padding: '20px',
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>ℹ️</span> How it works
                                        </h4>
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            {[
                                                { step: 1, text: 'Click "Generate AI Insights" in the Delivery Slots view' },
                                                { step: 2, text: 'Current slot data is snapshotted to your Airtable table' },
                                                { step: 3, text: 'AI fields analyze the snapshot for capacity & constraints' },
                                                { step: 4, text: 'Recommendations appear in the Role Intelligence panel' }
                                            ].map(item => (
                                                <div key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                    <div style={{
                                                        minWidth: '20px', height: '20px', borderRadius: '50%',
                                                        backgroundColor: isDark ? '#334155' : '#e2e8f0',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        fontSize: '11px', fontWeight: '700',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {item.step}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', paddingTop: '1px' }}>
                                                        {item.text}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Optimization Runs Field Explorer */}
                                    {(() => {
                                        const optimizationRunsTable = (allTables || []).find(t => t.name === 'Optimization Runs');
                                        const expectedFields = [
                                            'Run ID', 'Run Type', 'Run Date', 'Date Range Start', 'Date Range End',
                                            'Projects Input', 'Projects Placed', 'Projects Unplaceable',
                                            'Avg Delay Weeks', 'Total ARR Affected', 'Bottleneck Role',
                                            'Run Metrics JSON', 'Status', 'AI Insights', 'Risk Level', 'Next Actions'
                                        ];

                                        if (!optimizationRunsTable) return null;

                                        const tableFields = optimizationRunsTable.fields || [];
                                        const fieldNames = tableFields.map(f => f.name.trim());

                                        return (
                                            <div style={{
                                                padding: '20px',
                                                background: isDark
                                                    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                                borderRadius: '16px',
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                boxShadow: isDark
                                                    ? '0 4px 24px rgba(0,0,0,0.3)'
                                                    : '0 4px 24px rgba(0,0,0,0.06)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <h4 style={{
                                                        margin: 0,
                                                        fontSize: '14px',
                                                        fontWeight: '700',
                                                        color: isDark ? '#e2e8f0' : '#334155',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#3b82f6'} strokeWidth="2">
                                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                            <line x1="16" y1="13" x2="8" y2="13" />
                                                            <line x1="16" y1="17" x2="8" y2="17" />
                                                        </svg>
                                                        Optimization Runs - Field Explorer
                                                    </h4>
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        borderRadius: '12px',
                                                        backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                                        color: isDark ? '#94a3b8' : '#64748b'
                                                    }}>
                                                        {tableFields.length} fields detected
                                                    </span>
                                                </div>

                                                {/* Field mapping status */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                                    gap: '8px',
                                                    marginBottom: '16px'
                                                }}>
                                                    {expectedFields.map(fieldName => {
                                                        const found = fieldNames.some(fn => fn.toLowerCase() === fieldName.toLowerCase());
                                                        return (
                                                            <div key={fieldName} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                backgroundColor: found
                                                                    ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4')
                                                                    : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'),
                                                                border: `1px solid ${found
                                                                    ? (isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0')
                                                                    : (isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca')}`
                                                            }}>
                                                                {found ? (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00BD00" strokeWidth="3">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                                    </svg>
                                                                )}
                                                                <span style={{
                                                                    fontSize: '12px',
                                                                    fontWeight: '500',
                                                                    color: found
                                                                        ? (isDark ? '#00BD00' : '#00BD00')
                                                                        : (isDark ? '#f87171' : '#dc2626')
                                                                }}>
                                                                    {fieldName}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Raw fields from Airtable */}
                                                <details style={{ marginTop: '12px' }}>
                                                    <summary style={{
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        cursor: 'pointer',
                                                        padding: '8px 0'
                                                    }}>
                                                        View raw field names from Airtable ({fieldNames.length})
                                                    </summary>
                                                    <div style={{
                                                        marginTop: '8px',
                                                        padding: '12px',
                                                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
                                                        borderRadius: '8px',
                                                        fontFamily: 'monospace',
                                                        fontSize: '11px',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        {tableFields.map((f, i) => (
                                                            <div key={i} style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                padding: '4px 0',
                                                                borderBottom: i < tableFields.length - 1 ? `1px solid ${isDark ? '#334155' : '#e2e8f0'}` : 'none'
                                                            }}>
                                                                <span>"{f.name}"</span>
                                                                <span style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{f.type}</span>
                                                            </div>
                                                        ))}
                                                        {tableFields.length === 0 && (
                                                            <div style={{ color: '#f59e0b', padding: '8px' }}>
                                                                ⚠️ No fields returned from Airtable. This may indicate a permissions issue or stale table reference.
                                                            </div>
                                                        )}
                                                    </div>
                                                </details>
                                            </div>
                                        );
                                    })()}

                                    {/* AI Performance Tracking Card */}
                                    <div style={{
                                        padding: '20px',
                                        background: isDark
                                            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        boxShadow: isDark
                                            ? '0 4px 24px rgba(0,0,0,0.3)'
                                            : '0 4px 24px rgba(0,0,0,0.06)'
                                    }}>
                                        {(() => {
                                            const metrics = getRollingMetrics(allProjects || []);
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                        <h4 style={{
                                                            margin: 0,
                                                            fontSize: '14px',
                                                            fontWeight: '700',
                                                            color: isDark ? '#e2e8f0' : '#334155',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a78bfa' : '#BD65FF'} strokeWidth="2">
                                                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                                            </svg>
                                                            AI Performance Tracking
                                                        </h4>
                                                        <button
                                                            onClick={() => setShowClearAIConfirm(true)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                                                color: isDark ? '#94a3b8' : '#64748b'
                                                            }}
                                                        >
                                                            Clear History
                                                        </button>
                                                    </div>

                                                    {metrics.snapshotCount === 0 ? (
                                                        <div style={{
                                                            textAlign: 'center',
                                                            padding: '24px',
                                                            color: isDark ? '#64748b' : '#94a3b8'
                                                        }}>
                                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                                                                <circle cx="12" cy="12" r="10" />
                                                                <path d="M12 16v-4M12 8h.01" />
                                                            </svg>
                                                            <p style={{ margin: 0, fontSize: '13px' }}>No performance data yet. Apply AI recommendations to start tracking.</p>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                                            {/* Accuracy */}
                                                            <div style={{
                                                                padding: '16px',
                                                                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
                                                                borderRadius: '12px',
                                                                textAlign: 'center'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '28px',
                                                                    fontWeight: '800',
                                                                    color: '#00BD00',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    {metrics.rollingAccuracy}%
                                                                </div>
                                                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#6b7280' : '#94a3b8' }}>Accuracy</div>
                                                                <div style={{ fontSize: '10px', color: isDark ? '#4b5563' : '#cbd5e1', marginTop: '2px' }}>Last 30 days</div>
                                                            </div>

                                                            {/* Average Drift */}
                                                            <div style={{
                                                                padding: '16px',
                                                                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                                                                borderRadius: '12px',
                                                                textAlign: 'center'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '28px',
                                                                    fontWeight: '800',
                                                                    color: '#f59e0b',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    {metrics.avgDrift}w
                                                                </div>
                                                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#6b7280' : '#94a3b8' }}>Avg Drift</div>
                                                                <div style={{ fontSize: '10px', color: isDark ? '#4b5563' : '#cbd5e1', marginTop: '2px' }}>Weeks off prediction</div>
                                                            </div>

                                                            {/* Trend */}
                                                            <div style={{
                                                                padding: '16px',
                                                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                                                                borderRadius: '12px',
                                                                textAlign: 'center'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '28px',
                                                                    fontWeight: '800',
                                                                    color: metrics.trend === 'improving' ? '#00BD00' : metrics.trend === 'declining' ? '#ef4444' : '#3b82f6',
                                                                    marginBottom: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px'
                                                                }}>
                                                                    {metrics.trend === 'improving' && (
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                            <path d="M7 17l5-5 5 5" />
                                                                        </svg>
                                                                    )}
                                                                    {metrics.trend === 'declining' && (
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                            <path d="M7 7l5 5 5-5" />
                                                                        </svg>
                                                                    )}
                                                                    {metrics.trend === 'stable' && '—'}
                                                                    {metrics.trend !== 'stable' && metrics.trend.charAt(0).toUpperCase() + metrics.trend.slice(1)}
                                                                </div>
                                                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#6b7280' : '#94a3b8' }}>Trend</div>
                                                                <div style={{ fontSize: '10px', color: isDark ? '#4b5563' : '#cbd5e1', marginTop: '2px' }}>{metrics.snapshotCount} snapshots</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Advanced tab removed per user request */}
                        </div>
                    </div>

                </div>
            </div>

            <ConfirmModal
                isOpen={showClearAIConfirm}
                variant="danger"
                title="Clear AI Performance History"
                message="Clear all AI performance history? This cannot be undone. The page will reload."
                confirmText="Clear History"
                cancelText="Cancel"
                onConfirm={() => { clearHistory(); setShowClearAIConfirm(false); window.location.reload(); }}
                onCancel={() => setShowClearAIConfirm(false)}
            />
        </>
    );
};

export default SettingsModal;

// PropTypes for runtime type validation
SettingsModal.propTypes = {
    /** Current stored settings object */
    storedSettings: PropTypes.object.isRequired,
    /** Handler to save settings to Airtable */
    saveSettingsToTable: PropTypes.func.isRequired,
    /** Close modal handler */
    onClose: PropTypes.func.isRequired,
    /** All unique function/job titles */
    allFunctions: PropTypes.array,
    /** Flattened squads list */
    allSquadsFlat: PropTypes.array,
    /** All resources for counts */
    allResources: PropTypes.array,
    /** All loaded projects (used for discovering project types in the Alt Model tab) */
    allProjects: PropTypes.array,
    /** All tables in base for dropdown */
    allTables: PropTypes.array,
    /** Whether the TOTAL_EFFORT field has been mapped via Interface Designer settings */
    altModelFieldMapped: PropTypes.bool,
    /** Whether the ANNUAL_UTILIZATION field has been mapped via Interface Designer settings */
    presenceModelFieldMapped: PropTypes.bool
};
