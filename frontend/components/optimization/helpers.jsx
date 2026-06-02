/**
 * Shared helpers for Optimization components
 */
import React from 'react';

// Country text to emoji mapping (fallback when image not available)
export const countryEmojis = {
    'india': '🇮🇳', 'malaysia': '🇲🇾', 'brunei': '🇧🇳', 'indonesia': '🇮🇩',
    'thailand': '🇹🇭', 'singapore': '🇸🇬', 'philippines': '🇵🇭', 'vietnam': '🇻🇳',
    'australia': '🇦🇺', 'new zealand': '🇳🇿', 'japan': '🇯🇵', 'korea': '🇰🇷',
    'china': '🇨🇳', 'hong kong': '🇭🇰', 'taiwan': '🇹🇼', 'uk': '🇬🇧',
    'united kingdom': '🇬🇧', 'usa': '🇺🇸', 'united states': '🇺🇸', 'canada': '🇨🇦',
    'germany': '🇩🇪', 'france': '🇫🇷', 'italy': '🇮🇹', 'spain': '🇪🇸',
    'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'switzerland': '🇨🇭', 'austria': '🇦🇹',
    'poland': '🇵🇱', 'sweden': '🇸🇪', 'norway': '🇳🇴', 'denmark': '🇩🇰',
    'finland': '🇫🇮', 'ireland': '🇮🇪', 'portugal': '🇵🇹', 'brazil': '🇧🇷',
    'mexico': '🇲🇽', 'argentina': '🇦🇷', 'chile': '🇨🇱', 'colombia': '🇨🇴',
    'south africa': '🇿🇦', 'uae': '🇦🇪', 'saudi': '🇸🇦', 'qatar': '🇶🇦',
    'egypt': '🇪🇬', 'turkey': '🇹🇷', 'greece': '🇬🇷', 'czech': '🇨🇿',
    'romania': '🇷🇴', 'hungary': '🇭🇺', 'iceland': '🇮🇸', 'apac': '🌏', 'emea': '🌍', 'amer': '🌎'
};

/**
 * Country Flag component - renders image if URL, else emoji fallback
 */
export const CountryFlag = ({ flagUrl, country, size = 16 }) => {
    // If we have an image URL, render it
    if (flagUrl && typeof flagUrl === 'string' && (flagUrl.startsWith('http') || flagUrl.startsWith('/'))) {
        return (
            <img
                src={flagUrl}
                alt={country || 'flag'}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '2px',
                    objectFit: 'cover'
                }}
            />
        );
    }
    // Fallback to emoji based on country text
    if (country) {
        const lower = country.toLowerCase();
        for (const [key, emoji] of Object.entries(countryEmojis)) {
            if (lower.includes(key)) return <span style={{ fontSize: `${size}px` }}>{emoji}</span>;
        }
    }
    return <span style={{ fontSize: `${size}px` }}>🌐</span>;
};

/**
 * Format date helper
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Calculate weeks difference
 */
export const weeksDiff = (from, to) => {
    if (!from || !to) return 0;
    const d1 = new Date(from);
    const d2 = new Date(to);
    return Math.round((d2 - d1) / (7 * 24 * 60 * 60 * 1000));
};

// AI Optimization Target Presets (Scenario-Native AI)
export const AI_TARGETS = {
    maxUtilization: {
        id: 'maxUtilization',
        label: 'Maximize Utilization',
        description: 'Pack slots as tightly as possible',
        icon: '📈',
        priorityDial: 25,
        maxExpansion: 12,
        allowSquadMoves: true
    },
    minDelays: {
        id: 'minDelays',
        label: 'Minimize Delays',
        description: 'Prioritize schedule adherence',
        icon: '⏱️',
        priorityDial: 75,
        maxExpansion: 4,
        allowSquadMoves: false
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced Approach',
        description: 'Balance utilization and timing',
        icon: '⚖️',
        priorityDial: 50,
        maxExpansion: 8,
        allowSquadMoves: true
    },
    capacityRelief: {
        id: 'capacityRelief',
        label: 'Capacity Relief',
        description: 'Unblock logjam • Prioritize ARR • Respect locks',
        icon: '🚀',
        priorityDial: 60,
        maxExpansion: 16,
        allowSquadMoves: true,
        prioritizeARR: true,
        respectLocks: true,
        targetUtilization: 85,
        allowScopeReduction: true
    },
    staffingOptimization: {
        id: 'staffingOptimization',
        label: 'Total Portfolio Optimization',
        description: 'Assign people to projects • Match Skills • Balance Load',
        icon: '👥',
        priorityDial: 50,
        maxExpansion: 4,
        allowSquadMoves: false,
        isStaffing: true
    }
};

// Strategy Presets Mapping to Granular Params
export const PRESET_PARAMS = {
    balanced: { priorityDial: 50, maxCompression: 4, maxExpansion: 8, allowSquadMoves: true },
    arrFocused: { priorityDial: 35, maxCompression: 4, maxExpansion: 12, allowSquadMoves: true },
    utilizationMax: { priorityDial: 0, maxCompression: 6, maxExpansion: 12, allowSquadMoves: true },
    onTimeDelivery: { priorityDial: 85, maxCompression: 2, maxExpansion: 4, allowSquadMoves: false },
    volumeMax: { priorityDial: 15, maxCompression: 6, maxExpansion: 8, allowSquadMoves: true }
};
