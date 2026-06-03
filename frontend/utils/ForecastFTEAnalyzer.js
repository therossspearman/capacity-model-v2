/**
 * Forecast FTE Analyzer
 *
 * Utility functions for calculating headcount requirements from forecast demand.
 */

// Shared constants used across FTE/gap calculations
const ROLES = ['pm', 'sc', 'pd'];
const UNDERSTAFFED_THRESHOLD = 0.5; // gap above this => understaffed
const OVERSTAFFED_THRESHOLD = -0.5; // gap below this => overstaffed
const HIGH_PRIORITY_GAP = 1; // gap above this is high priority

const gapStatus = (gap) =>
    gap > UNDERSTAFFED_THRESHOLD
        ? 'understaffed'
        : (gap < OVERSTAFFED_THRESHOLD ? 'overstaffed' : 'balanced');

/**
 * Calculate FTE requirements from forecast hours
 * 
 * @param {Object} params
 * @param {number} params.forecastHours - Total hours forecasted per role
 * @param {number} params.avgBillableHoursPerWeek - Average billable hours per FTE per week
 * @param {number} params.weeks - Number of weeks in the forecast period
 * @returns {Object} FTE calculation result
 */
export const calculateFTEFromHours = ({
    forecastHours,
    avgBillableHoursPerWeek = 32,
    weeks = 52
}) => {
    const hoursPerFtePerPeriod = avgBillableHoursPerWeek * weeks;
    const fteRequired = hoursPerFtePerPeriod > 0 ? forecastHours / hoursPerFtePerPeriod : 0;

    return {
        fteRequired,
        hoursPerFte: hoursPerFtePerPeriod,
        fteRounded: Math.ceil(fteRequired * 10) / 10 // Round to 1 decimal
    };
};

/**
 * Calculate gap analysis between forecast and current capacity
 * 
 * @param {Object} params
 * @param {Object} params.forecastByRole - { pm: hours, sc: hours, pd: hours }
 * @param {Object} params.currentFTECounts - { pm: count, sc: count, pd: count }
 * @param {number} params.avgBillableHoursPerWeek - Average billable hours per FTE per week
 * @param {number} params.weeks - Weeks in forecast period
 * @returns {Object} Gap analysis by role
 */
export const analyzeCapacityGap = ({
    forecastByRole = {},
    currentFTECounts = {},
    avgBillableHoursPerWeek = 32,
    weeks = 52
}) => {
    const hoursPerFte = avgBillableHoursPerWeek * weeks;

    const analysis = {};

    let totalForecastHours = 0;
    let totalFteRequired = 0;
    let totalCurrentFte = 0;

    ROLES.forEach(role => {
        const forecastHours = forecastByRole[role] || 0;
        const currentFte = currentFTECounts[role] || 0;
        const { fteRequired } = calculateFTEFromHours({ forecastHours, avgBillableHoursPerWeek, weeks });
        const gap = fteRequired - currentFte;

        analysis[role] = {
            forecastHours,
            fteRequired,
            currentFte,
            gap,
            gapPercent: currentFte > 0 ? (gap / currentFte) * 100 : (fteRequired > 0 ? 100 : 0),
            status: gapStatus(gap)
        };

        totalForecastHours += forecastHours;
        totalFteRequired += fteRequired;
        totalCurrentFte += currentFte;
    });

    const totalGap = totalFteRequired - totalCurrentFte;

    analysis.total = {
        forecastHours: totalForecastHours,
        fteRequired: totalFteRequired,
        currentFte: totalCurrentFte,
        gap: totalGap,
        gapPercent: totalCurrentFte > 0 ? (totalGap / totalCurrentFte) * 100 : (totalFteRequired > 0 ? 100 : 0),
        status: gapStatus(totalGap)
    };

    // Generate recommendation
    analysis.recommendation = generateRecommendation(analysis);
    analysis.assumptions = {
        avgBillableHoursPerWeek,
        weeks,
        hoursPerFte
    };

    return analysis;
};

/**
 * Generate hiring recommendations based on gap analysis
 */
const generateRecommendation = (analysis) => {
    const gaps = [];

    ROLES.forEach(role => {
        const roleData = analysis[role];
        if (roleData.gap > UNDERSTAFFED_THRESHOLD) {
            gaps.push({
                role: role.toUpperCase(),
                gap: roleData.gap,
                priority: roleData.gap > HIGH_PRIORITY_GAP ? 'high' : 'medium'
            });
        }
    });

    if (gaps.length === 0) {
        return {
            message: 'Current headcount is sufficient for forecast demand.',
            severity: 'success',
            hires: []
        };
    }

    // Sort by gap size (highest first)
    gaps.sort((a, b) => b.gap - a.gap);

    const hiresNeeded = gaps.map(g => ({
        role: g.role,
        count: Math.ceil(g.gap),
        priority: g.priority
    }));

    const totalHires = hiresNeeded.reduce((sum, h) => sum + h.count, 0);
    const primaryRole = gaps[0].role;

    return {
        message: `Consider hiring ${totalHires} additional FTE${totalHires > 1 ? 's' : ''}, prioritizing ${primaryRole}.`,
        severity: 'warning',
        hires: hiresNeeded
    };
};

/**
 * Format currency for display
 */
export const formatCurrency = (value, currency = '£') => {
    if (value >= 1000000) {
        return `${currency}${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `${currency}${(value / 1000).toFixed(0)}k`;
    }
    return `${currency}${value.toLocaleString()}`;
};

/**
 * Format hours for display
 */
export const formatHours = (hours) => {
    if (hours >= 1000) {
        return `${(hours / 1000).toFixed(1)}k`;
    }
    return Math.round(hours).toLocaleString();
};

export default {
    calculateFTEFromHours,
    analyzeCapacityGap,
    formatCurrency,
    formatHours
};
