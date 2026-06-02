/**
 * ConflictResolutionModal - A++++ Premium Enterprise Design
 * Luxurious conflict resolution with stunning visual polish
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';

// ═══════════════════════════════════════════════════════════════════
// SVG Icon Components - Brand Compliant
// ═══════════════════════════════════════════════════════════════════
const Icons = {
    Alert: ({ size = 24, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
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
    Zap: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    Clipboard: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
    ),
    Edit: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    Database: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
    ),
    Clock: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    Check: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    FileText: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
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
    Repeat: ({ size = 16, color = 'currentColor' }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
    )
};

// Country Flag SVGs for common markets
const countryFlags = {
    'ae': '🇦🇪', // UAE - keep as emoji since flag SVGs are complex
    'uae': '🇦🇪',
    'uk': '🇬🇧',
    'gb': '🇬🇧',
    'us': '🇺🇸',
    'usa': '🇺🇸',
    'de': '🇩🇪',
    'fr': '🇫🇷',
    'au': '🇦🇺',
    'ca': '🇨🇦',
    'jp': '🇯🇵',
    'cn': '🇨🇳',
    'in': '🇮🇳',
    'br': '🇧🇷',
    'mx': '🇲🇽',
    'es': '🇪🇸',
    'it': '🇮🇹',
    'nl': '🇳🇱',
    'se': '🇸🇪',
    'ch': '🇨🇭',
    'sg': '🇸🇬',
    'hk': '🇭🇰',
    'kr': '🇰🇷',
    'za': '🇿🇦',
    'nz': '🇳🇿',
    'ie': '🇮🇪',
    'at': '🇦🇹',
    'be': '🇧🇪',
    'dk': '🇩🇰',
    'fi': '🇫🇮',
    'no': '🇳🇴',
    'pl': '🇵🇱',
    'pt': '🇵🇹',
    'ru': '🇷🇺',
    'tr': '🇹🇷',
    'sa': '🇸🇦',
    'eg': '🇪🇬',
    'il': '🇮🇱',
    'th': '🇹🇭',
    'my': '🇲🇾',
    'id': '🇮🇩',
    'ph': '🇵🇭',
    'vn': '🇻🇳',
    'ar': '🇦🇷',
    'cl': '🇨🇱',
    'co': '🇨🇴',
    'pe': '🇵🇪'
};

const countryNames = {
    'united arab emirates': 'ae',
    'uae': 'ae',
    'united kingdom': 'gb',
    'uk': 'gb',
    'great britain': 'gb',
    'england': 'gb',
    'united states': 'us',
    'usa': 'us',
    'america': 'us',
    'germany': 'de',
    'france': 'fr',
    'australia': 'au',
    'canada': 'ca',
    'japan': 'jp',
    'china': 'cn',
    'india': 'in',
    'brazil': 'br',
    'mexico': 'mx',
    'spain': 'es',
    'italy': 'it',
    'netherlands': 'nl',
    'sweden': 'se',
    'switzerland': 'ch',
    'singapore': 'sg',
    'hong kong': 'hk',
    'south korea': 'kr',
    'korea': 'kr',
    'south africa': 'za',
    'new zealand': 'nz',
    'ireland': 'ie',
    'austria': 'at',
    'belgium': 'be',
    'denmark': 'dk',
    'finland': 'fi',
    'norway': 'no',
    'poland': 'pl',
    'portugal': 'pt',
    'russia': 'ru',
    'turkey': 'tr',
    'saudi arabia': 'sa',
    'egypt': 'eg',
    'israel': 'il',
    'thailand': 'th',
    'malaysia': 'my',
    'indonesia': 'id',
    'philippines': 'ph',
    'vietnam': 'vn',
    'argentina': 'ar',
    'chile': 'cl',
    'colombia': 'co',
    'peru': 'pe'
};

// Helper to get flag from project name
const getCountryFlag = (name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    for (const [country, code] of Object.entries(countryNames)) {
        if (lowerName.includes(country)) {
            return countryFlags[code] || null;
        }
    }
    return null;
};


const ConflictResolutionModal = ({ conflicts, draftName, isStale, onResolve, onCancel }) => {
    const { isDark, colors } = useTheme();
    const [localConflicts, setLocalConflicts] = useState(conflicts);
    const [expandedItems, setExpandedItems] = useState(new Set());

    const toggleExpand = (key) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleResolution = (type, id, field) => {
        setLocalConflicts(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [id]: {
                    ...prev[type][id],
                    fields: {
                        ...prev[type][id].fields,
                        [field]: {
                            ...prev[type][id].fields[field],
                            resolution: prev[type][id].fields[field].resolution === 'current' ? 'draft' : 'current'
                        }
                    }
                }
            }
        }));
    };

    const useAllCurrent = () => {
        const updated = JSON.parse(JSON.stringify(localConflicts));
        for (const type of ['projects', 'resources']) {
            for (const id of Object.keys(updated[type] || {})) {
                if (updated[type][id].fields) {
                    for (const field of Object.keys(updated[type][id].fields)) {
                        updated[type][id].fields[field].resolution = 'current';
                    }
                }
            }
        }
        setLocalConflicts(updated);
    };

    const useAllDraft = () => {
        const updated = JSON.parse(JSON.stringify(localConflicts));
        for (const type of ['projects', 'resources']) {
            for (const id of Object.keys(updated[type] || {})) {
                if (updated[type][id].fields) {
                    for (const field of Object.keys(updated[type][id].fields)) {
                        updated[type][id].fields[field].resolution = 'draft';
                    }
                }
            }
        }
        setLocalConflicts(updated);
    };

    const projectConflicts = Object.entries(localConflicts.projects || {});
    const resourceConflicts = Object.entries(localConflicts.resources || {});
    const totalConflicts = projectConflicts.length + resourceConflicts.length;

    // Calculate total field conflicts
    const totalFieldConflicts = [...projectConflicts, ...resourceConflicts].reduce((acc, [, data]) => {
        return acc + Object.keys(data.fields || {}).length;
    }, 0);

    // Clean date formatting
    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return String(dateStr); }
    };

    // Premium value formatting
    // Safe date parsing helper
    const parseDateSafe = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

    // Premium value formatting
    const formatValue = (val) => {
        if (val == null || val === '') {
            return <span style={{ color: isDark ? '#475569' : '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>—</span>;
        }
        if (typeof val === 'object') {
            // Handle Date objects directly
            if (val instanceof Date && !isNaN(val.getTime())) {
                return val.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{JSON.stringify(val)}</span>;
        }

        let str = String(val).trim();

        // Try direct JSON.parse first (handles '"2026-01-01T00:00:00.000Z"')
        try {
            const parsed = JSON.parse(str);
            if (typeof parsed === 'string') {
                str = parsed;
            }
        } catch (e) {
            // Not valid JSON, continue
        }

        // Aggressively strip ALL outer quotes (handles multiple layers)
        while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            str = str.slice(1, -1);
        }

        // Format dates beautifully - check for ISO date pattern
        if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
            const date = parseDateSafe(str);
            if (date) {
                return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
        }

        // Truncate very long strings
        if (str.length > 50) {
            return str.substring(0, 47) + '...';
        }

        return str;
    };

    // Check if values are actually different - normalize for proper comparison
    const normalizeForComparison = (val) => {
        if (val == null || val === '') return '';
        let str = String(val).trim();

        // Try JSON.parse for quoted strings
        try {
            const parsed = JSON.parse(str);
            if (typeof parsed === 'string') str = parsed;
        } catch (e) { /* ignore */ }

        // Aggressively strip ALL outer quotes
        while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            str = str.slice(1, -1);
        }

        // Normalize any date-like string to YYYY-MM-DD (strip time/timezone)
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.substring(0, 10); // Just YYYY-MM-DD, ignore time
        }
        return str.toLowerCase();
    };

    // Get field display info - using SVG icons
    const getFieldInfo = (field) => {
        const lowerField = field.toLowerCase();
        if (lowerField.includes('kick') || lowerField.includes('start')) return { icon: Icons.Rocket, label: 'Kick-Off', color: '#00BD00' };
        if (lowerField.includes('launch') || lowerField.includes('end')) return { icon: Icons.Target, label: 'Launch', color: '#f97316' };
        if (lowerField.includes('squad')) return { icon: Icons.Users, label: 'Squad', color: '#BD65FF' };
        if (lowerField.includes('status')) return { icon: Icons.Chart, label: 'Status', color: '#3b82f6' };
        if (lowerField.includes('priority')) return { icon: Icons.Zap, label: 'Priority', color: '#eab308' };
        if (lowerField.includes('allocation') || lowerField.includes('assign')) return { icon: Icons.Clipboard, label: 'Allocation', color: '#06b6d4' };
        return { icon: Icons.FileText, label: field.replace(/([A-Z])/g, ' $1').trim(), color: '#64748b' };
    };

    const renderConflictField = (type, id, field, data) => {
        const { original, current, draft, resolution } = data;
        const hasConflict = normalizeForComparison(original) !== normalizeForComparison(current);
        const isUsingDraft = resolution === 'draft';
        const fieldInfo = getFieldInfo(field);

        // Calculate if Original is same as Current (no change happened before this draft modification)
        // If Original == Current, we just show Current -> Draft
        // If Original != Current, it means the DB changed since we loaded. This is the TRUE conflict.

        // Actually, the conflict is specifically that Current != Draft (which is why we are here)
        // AND usually that Current != Original (meaning the DB updated in background).
        // Let's focus on the Current vs Draft comparison as the primary action.

        return (
            <div key={field} style={{
                marginBottom: '16px',
                padding: '20px',
                borderRadius: '16px',
                border: isUsingDraft
                    ? `1px solid ${BRAND.benifexPurple}`
                    : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                backgroundColor: isDark ? '#0f172a' : 'white',
                boxShadow: isUsingDraft
                    ? `0 0 0 1px ${BRAND.benifexPurple}, 0 4px 12px rgba(124, 58, 237, 0.1)`
                    : '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease'
            }}>
                {/* Field Label Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                </div>

                {/* Comparison Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 32px 1fr',
                    gap: '0',
                    alignItems: 'stretch',
                    marginBottom: '20px'
                }}>
                    {/* Current Side */}
                    <div
                        onClick={() => toggleResolution(type, id, field)}
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            backgroundColor: !isUsingDraft ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#ecfdf5') : (isDark ? '#1e293b' : '#f8fafc'),
                            border: `2px solid ${!isUsingDraft ? '#00BD00' : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#00BD00', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Current (Database)
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                            {formatValue(current)}
                        </div>
                        {/* Checkmark overlay */}
                        {!isUsingDraft && (
                            <div style={{ position: 'absolute', top: '12px', right: '12px', color: '#00BD00' }}>
                                <Icons.Check size={18} />
                            </div>
                        )}
                    </div>

                    {/* Arrow Center */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '24px', height: '2px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }}></div>
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginLeft: '-12px',
                            color: '#94a3b8',
                            zIndex: 10
                        }}>→</div>
                    </div>

                    {/* Draft Side */}
                    <div
                        onClick={() => toggleResolution(type, id, field)}
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            backgroundColor: isUsingDraft ? (isDark ? 'rgba(124, 58, 237, 0.15)' : '#F7F3ED') : (isDark ? '#1e293b' : '#f8fafc'),
                            border: `2px solid ${isUsingDraft ? '#7637E3' : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#7637E3', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Your Draft Change
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                            {formatValue(draft)}
                        </div>
                        {/* Checkmark overlay */}
                        {isUsingDraft && (
                            <div style={{ position: 'absolute', top: '12px', right: '12px', color: '#7637E3' }}>
                                <Icons.Check size={18} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Original Value Footnote (Subtle) */}
                {normalizeForComparison(original) !== normalizeForComparison(current) && (
                    <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 4px',
                        fontStyle: 'italic'
                    }}>
                        <span>Previous value was:</span>
                        <span style={{ fontFamily: 'monospace' }}>{formatValue(original)}</span>
                    </div>
                )}
            </div>
        );
    };

    const renderEntityCard = (type, id, data, index) => {
        const isExpanded = expandedItems.has(`${type}-${id}`) || index === 0;
        const fieldCount = Object.keys(data.fields || {}).length;

        return (
            <div key={id} style={{
                marginBottom: '24px',
                backgroundColor: 'transparent'
            }}>
                {/* Entity Header - Clean & Minimal */}
                <div
                    onClick={() => toggleExpand(`${type}-${id}`)}
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
                            fontSize: '20px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            {type === 'projects' ? (
                                getCountryFlag(data.name) || <Icons.Globe size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            ) : (
                                <Icons.User size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            )}
                        </div>
                        <div>
                            <div style={{
                                fontWeight: '700',
                                fontSize: '16px',
                                color: data.deleted ? '#ef4444' : (isDark ? '#f1f5f9' : '#1e293b'),
                                letterSpacing: '-0.01em'
                            }}>
                                {data.name}
                                {data.deleted && (
                                    <span style={{
                                        marginLeft: '8px',
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        backgroundColor: '#fee2e2',
                                        color: '#dc2626',
                                        borderRadius: '4px',
                                        fontWeight: '600'
                                    }}>DELETED</span>
                                )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                Resolving {fieldCount} conflict{fieldCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                {isExpanded && !data.deleted && (
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
            backgroundColor: 'rgba(15, 23, 42, 0.75)', // Darker, cleaner backdrop
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: isDark ? '#0f172a' : '#fafafa', // Light grey background for content contrast
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
                {/* Premium Header - Clean & Professional */}
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
                            backgroundColor: '#fef2f2', border: '1px solid #fee2e2',
                            marginBottom: '16px'
                        }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conflict Detected</span>
                        </div>
                        <h2 style={{
                            margin: '0 0 12px 0',
                            fontSize: '28px',
                            fontWeight: '800',
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            letterSpacing: '-0.02em',
                            lineHeight: '1.1'
                        }}>
                            Resolve Database Conflicts
                        </h2>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5', maxWidth: '480px' }}>
                            Changes to the draft <strong style={{ color: isDark ? '#e2e8f0' : '#334155' }}>"{draftName}"</strong> conflict with recent updates in the live database. Review and select which version to keep.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '32px',
                }}>
                    {projectConflicts.map(([id, data], i) => renderEntityCard('projects', id, data, i))}
                    {resourceConflicts.map(([id, data], i) => renderEntityCard('resources', id, data, i + projectConflicts.length))}
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
                            transition: 'color 0.2s',
                        }}
                        onMouseOver={e => e.target.style.color = '#334155'}
                        onMouseOut={e => e.target.style.color = '#64748b'}
                    >
                        Cancel
                    </button>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={useAllCurrent}
                            style={{
                                padding: '12px 20px',
                                backgroundColor: isDark ? '#0f172a' : 'white',
                                color: '#00BD00',
                                border: '1px solid #dcfce7',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.target.style.backgroundColor = '#f0fdf4'; e.target.style.transform = 'translateY(-1px)'; }}
                            onMouseOut={e => { e.target.style.backgroundColor = isDark ? '#0f172a' : 'white'; e.target.style.transform = 'translateY(0)'; }}
                        >
                            Take All Current
                        </button>
                        <button
                            onClick={useAllDraft}
                            style={{
                                padding: '12px 20px',
                                backgroundColor: isDark ? '#0f172a' : 'white',
                                color: BRAND.benifexPurple,
                                border: '1px solid #f3e8ff',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.target.style.backgroundColor = '#faf5ff'; e.target.style.transform = 'translateY(-1px)'; }}
                            onMouseOut={e => { e.target.style.backgroundColor = isDark ? '#0f172a' : 'white'; e.target.style.transform = 'translateY(0)'; }}
                        >
                            Take All Draft
                        </button>
                        <button
                            onClick={onResolve}
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
                                transition: 'all 0.2s',
                                marginLeft: '12px'
                            }}
                            onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 20px rgba(124, 58, 237, 0.4)'; }}
                            onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)'; }}
                        >
                            Apply Resolutions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConflictResolutionModal;

ConflictResolutionModal.propTypes = {
    conflicts: PropTypes.shape({
        projects: PropTypes.object,
        resources: PropTypes.object
    }).isRequired,
    draftName: PropTypes.string.isRequired,
    isStale: PropTypes.bool,
    onResolve: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};
