/**
 * Forecast Transformer
 *
 * Converts quarterly ARR forecast data into weekly demand hours for chart visualization.
 */

import { Logger } from './Logger';

// Default market parameters
const DEFAULT_PARAMETERS = {
    global: { numberOfDeals: 22, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 80, scHoursPerWave: 120, pdHoursPerWave: 40 },
    uk: { numberOfDeals: 15, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 70, scHoursPerWave: 100, pdHoursPerWave: 35 },
    de: { numberOfDeals: 10, avgProjectsPerDeal: 6, avgWavesPerProject: 2, avgWaveLengthWeeks: 26, pmHoursPerWave: 75, scHoursPerWave: 110, pdHoursPerWave: 38 },
    upsell: { numberOfDeals: 10, avgProjectsPerDeal: 3, avgWavesPerProject: 1, avgWaveLengthWeeks: 16, pmHoursPerWave: 40, scHoursPerWave: 60, pdHoursPerWave: 20 }
};

const MARKETS = ['global', 'uk', 'de', 'upsell'];


/**
 * Calculate projected hours from ARR for a given market and parameters
 * 
 * Two models:
 * - Domestic (UK, DE): Simple ARR → projects → hours (direct multiplication)
 * - Global: Deal-based model where:
 *   - Each deal contains X projects (avgProjectsPerDeal)
 * Calculate projected quarterly load (hours) from ARR
 * 
 * Logic:
 * 1. Calculate Total Effort (Hours) required for the ARR volume
 * 2. Calculate Duration (Weeks) of that effort (Waves * Wave Length)
 * 3. Weekly Load = Total Effort / Duration
 * 4. Quarterly Load = Weekly Load * 13 (Standard Quarter)
 * 
 * This ensures that if a deal takes 52 weeks (2 waves of 26), 
 * the effort is spread out, rather than dumping all 1440 hours into Q1.
 */
const calculateQuarterlyLoadFromARR = (arr, params, market = 'global', totalMarketArr = 0) => {
    if (!arr || arr <= 0) return { pm: 0, sc: 0, pd: 0, total: 0 };

    let totalPmHours = 0;
    let totalScHours = 0;
    let totalPdHours = 0;
    let durationWeeks = 13; // Default to 1 quarter

    const deals = params.numberOfDeals || 1;
    const projectsPerDeal = params.avgProjectsPerDeal || 1;

    // Derive avg ARR per project from total market ARR
    const effectiveTotalArr = totalMarketArr > 0 ? totalMarketArr : arr;
    const avgArrPerProject = effectiveTotalArr / deals / projectsPerDeal;

    // Domestic: Simple Project Model
    if (market === 'uk' || market === 'de') {
        const projects = arr / Math.max(1, avgArrPerProject);
        totalPmHours = projects * params.pmHoursPerWave;
        totalScHours = projects * params.scHoursPerWave;
        totalPdHours = projects * params.pdHoursPerWave;

        // Domestic duration: usually shorter, assume 1 wave = wave length
        durationWeeks = Math.max(1, params.avgWaveLengthWeeks);
    }
    // Global: Deal/Wave Model
    else {
        const dealArr = avgArrPerProject * projectsPerDeal;
        const quarterDeals = arr / Math.max(1, dealArr);

        const pmHoursPerDeal = params.pmHoursPerWave * projectsPerDeal;
        const scHoursPerDeal = params.scHoursPerWave * projectsPerDeal;
        const pdHoursPerDeal = params.pdHoursPerWave * projectsPerDeal;

        totalPmHours = quarterDeals * pmHoursPerDeal;
        totalScHours = quarterDeals * scHoursPerDeal;
        totalPdHours = quarterDeals * pdHoursPerDeal;

        // Global duration: Waves * Wave Length
        durationWeeks = Math.max(1, params.avgWavesPerProject * params.avgWaveLengthWeeks);
    }

    // Calculate Weekly Load
    const weeklyPm = totalPmHours / durationWeeks;
    const weeklySc = totalScHours / durationWeeks;
    const weeklyPd = totalPdHours / durationWeeks;

    // Return Quarterly Load (approx 13 weeks)
    const weeksInQuarter = 13;

    return {
        pm: weeklyPm * weeksInQuarter,
        sc: weeklySc * weeksInQuarter,
        pd: weeklyPd * weeksInQuarter,
        total: (weeklyPm + weeklySc + weeklyPd) * weeksInQuarter
    };
};

/**
 * Transform quarterly ARR forecast data into weekly demand hours
 * Uses the existing processedData dates to ensure alignment with chart
 * Only applies forecast to dates within the target FY (from FY start onwards)
 * 
 * @param {Object} forecastData - From FinanceForecastModal: { arrData, parameters, name }
 * @param {Array} processedData - Existing chart data with dateKey entries
 * @param {number} fyStartMonth - Fiscal year start month (0-indexed: 0=Jan, 4=May, etc.)
 * @returns {Array<{dateKey, forecastDemand, forecastPm, forecastSc, forecastPd}>}
 */
export const transformForecastToWeeklyDemand = (forecastData, processedData = [], fyStartMonth = 4) => {
    const { arrData, parameters, fyStartYear: userSelectedFY } = forecastData;

    if (!arrData || !processedData || processedData.length === 0) return [];

    // Calculate FY start date
    // fyStartMonth is 0-indexed (0=Jan, 4=May)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // Use user-selected FY year if provided, otherwise calculate automatically
    const fyStartYear = userSelectedFY || (currentMonth >= fyStartMonth ? currentYear : currentYear - 1);
    const fyStartDate = new Date(fyStartYear, fyStartMonth, 1); // fyStartMonth is already 0-indexed
    const fyEndDate = new Date(fyStartYear + 1, fyStartMonth, 0); // Last day before next FY start

    // Build dynamic quarter-to-month mapping based on fyStartMonth
    // Q1 = first 3 months from FY start, Q2 = next 3, etc.
    const getQuarterForDate = (dateStr) => {
        const date = new Date(dateStr);
        const month = date.getMonth(); // 0-indexed
        const year = date.getFullYear();

        // Calculate months since FY start
        let monthsFromStart = (month - fyStartMonth) + (year - fyStartYear) * 12;
        if (monthsFromStart < 0) monthsFromStart += 12;

        const quarterIndex = Math.floor(monthsFromStart / 3);
        return `Q${Math.min(quarterIndex + 1, 4)}`; // Cap at Q4
    };

    // Check if a date is within the FY
    const isInFY = (dateStr) => {
        const date = new Date(dateStr);
        return date >= fyStartDate && date <= fyEndDate;
    };

    // Debug: Log FY date range
    Logger.debug('=== Forecast FY Debug ===');
    Logger.debug('Selected FY Start Year:', fyStartYear, 'FY Start Month (0-indexed):', fyStartMonth);
    Logger.debug('FY Date Range:', fyStartDate.toISOString(), 'to', fyEndDate.toISOString());
    Logger.debug('ProcessedData date range:', {
        first: processedData[0]?.isoKey,
        last: processedData[processedData.length - 1]?.isoKey
    });

    // Helper to get ISO date from a data point
    const getIsoDate = (d) => d.isoKey || d.dateKey;

    // Filter processedData to only FY dates for week counting
    const fyWeeks = processedData.filter(d => {
        const isoDate = getIsoDate(d);
        return isoDate && isInFY(isoDate);
    });

    Logger.debug('Dates within FY:', fyWeeks.length, 'out of', processedData.length);

    // Count weeks per quarter in the FY
    const weeksPerQuarter = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    fyWeeks.forEach(d => {
        const isoDate = getIsoDate(d);
        if (isoDate) {
            const quarter = getQuarterForDate(isoDate);
            weeksPerQuarter[quarter]++;
        }
    });

    // Ensure minimum of 1 week per quarter to avoid division by zero
    Object.keys(weeksPerQuarter).forEach(q => {
        if (weeksPerQuarter[q] === 0) weeksPerQuarter[q] = 13;
    });

    // Pre-compute total ARR per market for deriving avgArrPerProject
    const marketTotals = {};
    MARKETS.forEach(m => {
        marketTotals[m] = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((sum, q) => sum + (arrData[q]?.[m] || 0), 0);
    });

    // Calculate total hours per quarter across all markets
    const quarterlyHours = {};
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
        let totalPm = 0, totalSc = 0, totalPd = 0;

        MARKETS.forEach(market => {
            const arr = arrData[quarter]?.[market] || 0;
            const params = parameters?.[market] || DEFAULT_PARAMETERS[market];
            const hours = calculateQuarterlyLoadFromARR(arr, params, market, marketTotals[market]);

            totalPm += hours.pm;
            totalSc += hours.sc;
            totalPd += hours.pd;
        });

        quarterlyHours[quarter] = {
            pm: totalPm,
            sc: totalSc,
            pd: totalPd,
            total: totalPm + totalSc + totalPd
        };
    });

    // Map each processedData date to its forecast demand (only for FY dates)
    return processedData.map(d => {
        const isoDate = getIsoDate(d);
        const displayKey = d.dateKey || d.isoKey;
        if (!isoDate) return { dateKey: displayKey || '', forecastDemand: 0, forecastPm: 0, forecastSc: 0, forecastPd: 0 };

        // Only apply forecast to dates within the FY
        if (!isInFY(isoDate)) {
            return { dateKey: displayKey, forecastDemand: 0, forecastPm: 0, forecastSc: 0, forecastPd: 0 };
        }

        const quarter = getQuarterForDate(isoDate);
        const quarterHours = quarterlyHours[quarter] || { pm: 0, sc: 0, pd: 0, total: 0 };
        const weekCount = weeksPerQuarter[quarter];

        return {
            dateKey: displayKey,
            forecastDemand: quarterHours.total / weekCount,
            forecastPm: quarterHours.pm / weekCount,
            forecastSc: quarterHours.sc / weekCount,
            forecastPd: quarterHours.pd / weekCount
        };
    });
};

/**
 * Calculate FTE impact from forecast, considering current demand and initiatives
 * 
 * @param {Object} params
 * @param {Array} forecastWeeklyData - Output of transformForecastToWeeklyDemand
 * @param {Array} processedData - Current capacity data with demand
 * @param {Array} initiatives - Active initiatives from settings
 * @param {Object} currentFTECounts - { pm, sc, pd } current headcount
 * @param {number} avgBillableHoursPerWeek - Hours per FTE per week
 * @returns {Object} Comprehensive FTE impact analysis
 */
export const calculateFTEImpact = ({
    forecastWeeklyData = [],
    processedData = [],
    initiatives = [],
    currentFTECounts = { pm: 0, sc: 0, pd: 0 },
    avgBillableHoursPerWeek = 32
}) => {
    const weeksInFY = 52;
    const hoursPerFtePerYear = avgBillableHoursPerWeek * weeksInFY;

    // 1. Calculate current demand from processedData
    let currentDemandHours = 0;
    let currentCapacityHours = 0;

    // Keys that should NOT be counted as demand
    const excludedKeys = new Set([
        'capacity', 'capacityBuffer', 'dateKey', 'isoKey', 'details', 'unassignedStat',
        'forecastDemand', 'forecastPm', 'forecastSc', 'forecastPd', // Forecast data
        'rawDate' // Timestamp in milliseconds - definitely not demand!
    ]);

    // Debug: Log first week to see structure
    if (processedData.length > 0) {
        Logger.debug('=== FTE Impact Debug ===');
        Logger.debug('First week keys:', Object.keys(processedData[0]));
        Logger.debug('First week data sample:', processedData[0]);
    }

    processedData.forEach((week, idx) => {
        // Sum only status-based demand (not baseline or excluded keys)
        const weekDemand = Object.keys(week).reduce((sum, key) => {
            // Skip excluded keys
            if (excludedKeys.has(key)) return sum;
            // Skip baseline keys (used for EAC comparison display, not current demand)
            if (key.startsWith('baseline_')) return sum;
            // Only count actual positive numbers (status demand values)
            const val = week[key];
            if (typeof val === 'number' && val > 0) {
                if (idx === 0) Logger.debug(`  Counting key: ${key} = ${val}`);
                return sum + val;
            }
            return sum;
        }, 0);
        currentDemandHours += weekDemand;
        currentCapacityHours += week.capacity || 0;
    });

    Logger.debug('Total currentDemandHours:', currentDemandHours);
    Logger.debug('Total currentCapacityHours:', currentCapacityHours);

    // 2. Calculate forecast demand
    const forecastTotalHours = {
        pm: forecastWeeklyData.reduce((sum, w) => sum + (w.forecastPm || 0), 0),
        sc: forecastWeeklyData.reduce((sum, w) => sum + (w.forecastSc || 0), 0),
        pd: forecastWeeklyData.reduce((sum, w) => sum + (w.forecastPd || 0), 0)
    };
    forecastTotalHours.total = forecastTotalHours.pm + forecastTotalHours.sc + forecastTotalHours.pd;

    // 3. Calculate initiative impact
    let initiativeHours = { pm: 0, sc: 0, pd: 0, total: 0 };
    initiatives.forEach(initiative => {
        if (initiative.status === 'active' || initiative.status === 'planned') {
            const hours = initiative.hoursImpact || 0;
            // Distribute initiative hours by typical role distribution (40% SC, 35% PM, 25% PD)
            initiativeHours.pm += hours * 0.35;
            initiativeHours.sc += hours * 0.40;
            initiativeHours.pd += hours * 0.25;
            initiativeHours.total += hours;
        }
    });

    // 4. Combined analysis
    const combinedDemand = {
        pm: forecastTotalHours.pm + initiativeHours.pm,
        sc: forecastTotalHours.sc + initiativeHours.sc,
        pd: forecastTotalHours.pd + initiativeHours.pd,
        total: forecastTotalHours.total + initiativeHours.total + currentDemandHours
    };

    // 5. FTE analysis by role
    const fteAnalysis = {};
    ['pm', 'sc', 'pd'].forEach(role => {
        const additionalHours = forecastTotalHours[role] + initiativeHours[role];
        const fteRequired = additionalHours / hoursPerFtePerYear;
        const currentFte = currentFTECounts[role] || 0;
        const gap = fteRequired; // This is ADDITIONAL FTE needed from forecast

        fteAnalysis[role] = {
            currentFte,
            forecastHours: forecastTotalHours[role],
            initiativeHours: initiativeHours[role],
            totalAdditionalHours: additionalHours,
            additionalFteNeeded: fteRequired,
            recommendedHires: Math.ceil(fteRequired * 10) / 10,
            status: gap > 0.5 ? 'hire' : 'sufficient'
        };
    });

    // Total summary
    const totalFteRequired = (forecastTotalHours.total + initiativeHours.total) / hoursPerFtePerYear;
    const totalCurrentFte = currentFTECounts.pm + currentFTECounts.sc + currentFTECounts.pd;

    // Utilization calculation
    const projectedDemand = currentDemandHours + forecastTotalHours.total + initiativeHours.total;
    const projectedUtilization = currentCapacityHours > 0 ? (projectedDemand / currentCapacityHours) * 100 : 0;

    return {
        current: {
            demandHours: Math.round(currentDemandHours),
            capacityHours: Math.round(currentCapacityHours),
            utilizationPct: currentCapacityHours > 0 ? Math.round((currentDemandHours / currentCapacityHours) * 100) : 0
        },
        forecast: forecastTotalHours,
        initiatives: initiativeHours,
        combined: combinedDemand,
        fteAnalysis,
        summary: {
            totalCurrentFte,
            totalAdditionalFteNeeded: Math.round(totalFteRequired * 10) / 10,
            projectedUtilization: Math.round(projectedUtilization),
            isOverCapacity: projectedUtilization > 100
        },
        recommendations: generateHiringRecommendations(fteAnalysis)
    };
};

/**
 * Generate hiring recommendations based on FTE analysis
 */
const generateHiringRecommendations = (fteAnalysis) => {
    const recommendations = [];

    Object.entries(fteAnalysis).forEach(([role, data]) => {
        if (data.additionalFteNeeded >= 0.5) {
            recommendations.push({
                role: role.toUpperCase(),
                count: Math.ceil(data.additionalFteNeeded),
                priority: data.additionalFteNeeded >= 1 ? 'high' : 'medium',
                reason: `${Math.round(data.totalAdditionalHours).toLocaleString()}h additional demand`
            });
        }
    });

    // Sort by priority and count
    recommendations.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return b.count - a.count;
    });

    return recommendations;
};

export default {
    transformForecastToWeeklyDemand,
    calculateFTEImpact
};
