/**
 * Finance Forecast Hook
 * 
 * Manages finance forecast data, modeling parameters, and calculations.
 * Converts ARR targets into capacity demand distributed over time.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRecords, useBase } from '@airtable/blocks/interface/ui';
import { SETTINGS } from '../constants';

// Default modeling parameters per market
const DEFAULT_PARAMETERS = {
    global: {
        numberOfDeals: 22,
        avgProjectsPerDeal: 6,
        avgWavesPerProject: 2,
        avgWaveLengthWeeks: 26,
        pmHoursPerWave: 80,
        scHoursPerWave: 120,
        pdHoursPerWave: 40
    },
    uk: {
        numberOfDeals: 15,
        avgProjectsPerDeal: 6,
        avgWavesPerProject: 2,
        avgWaveLengthWeeks: 26,
        pmHoursPerWave: 70,
        scHoursPerWave: 100,
        pdHoursPerWave: 35
    },
    de: {
        numberOfDeals: 10,
        avgProjectsPerDeal: 6,
        avgWavesPerProject: 2,
        avgWaveLengthWeeks: 26,
        pmHoursPerWave: 75,
        scHoursPerWave: 110,
        pdHoursPerWave: 38
    }
};

// Market keys (match Airtable field values)
export const MARKETS = ['global', 'uk', 'de'];
export const MARKET_LABELS = {
    global: 'Global',
    uk: 'Domestic UK',
    de: 'Domestic Germany'
};

// Quarters in a financial year
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Get quarter start date based on FY start month
 */
const getQuarterStartDate = (quarter, fyStartMonth, fyYear) => {
    const quarterIndex = parseInt(quarter.replace('Q', '')) - 1;
    const monthOffset = quarterIndex * 3;
    const month = (fyStartMonth + monthOffset) % 12;
    const year = fyYear + Math.floor((fyStartMonth + monthOffset) / 12);
    return new Date(year, month, 1);
};

/**
 * Get quarter end date (last day of 3rd month)
 */
const getQuarterEndDate = (quarter, fyStartMonth, fyYear) => {
    const start = getQuarterStartDate(quarter, fyStartMonth, fyYear);
    const endMonth = start.getMonth() + 2;
    const endYear = start.getFullYear() + Math.floor(endMonth / 12);
    return new Date(endYear, (endMonth % 12) + 1, 0, 23, 59, 59);
};

/**
 * Calculate projected values from ARR using modeling parameters
    // Calculate projections from ARR
    const calculateProjections = (arr, params, market = 'global', totalMarketArr = 0) => {
        if (!arr || arr <= 0) return { projects: 0, deals: 0, hours: { pm: 0, sc: 0, pd: 0, total: 0 } };

        let totalPmHours = 0;
        let totalScHours = 0;
        let totalPdHours = 0;
        let durationWeeks = 13;
        
        let projects = 0;
        const deals = params.numberOfDeals || 1;
        const projectsPerDeal = params.avgProjectsPerDeal || 1;

        // Derive avg ARR per project from total market ARR
        const effectiveTotalArr = totalMarketArr > 0 ? totalMarketArr : arr;
        const avgArrPerProject = effectiveTotalArr / deals / projectsPerDeal;

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

        // Calculate Quarterly Load
        const weeksInQuarter = 13;
        const pmQuarterly = (totalPmHours / durationWeeks) * weeksInQuarter;
        const scQuarterly = (totalScHours / durationWeeks) * weeksInQuarter;
        const pdQuarterly = (totalPdHours / durationWeeks) * weeksInQuarter;

        return {
            projects: Math.round(projects * 10) / 10,
            deals: Math.round(deals * 10) / 10,
            hours: { 
                pm: pmQuarterly, 
                sc: scQuarterly, 
                pd: pdQuarterly, 
                total: pmQuarterly + scQuarterly + pdQuarterly 
            }
        };
    };

/**
 * Distribute hours across weeks in a quarter
 * Returns Map<dateKey, { pm, sc, pd, total }>
 */
const distributeQuarterHours = (quarterStart, quarterEnd, hours, weeklyDemand) => {
    const startTime = quarterStart.getTime();
    const endTime = quarterEnd.getTime();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    // Calculate weeks in quarter
    const weeksInQuarter = Math.ceil((endTime - startTime) / msPerWeek);
    if (weeksInQuarter <= 0) return;

    // Weekly hours (evenly distributed)
    const weeklyPm = hours.pm / weeksInQuarter;
    const weeklySc = hours.sc / weeksInQuarter;
    const weeklyPd = hours.pd / weeksInQuarter;

    // Iterate through weeks
    let cursor = new Date(quarterStart);
    // Align to Monday
    const day = cursor.getDay();
    const daysToMonday = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
    cursor.setDate(cursor.getDate() + daysToMonday);

    while (cursor.getTime() <= endTime) {
        const dateKey = cursor.toISOString().split('T')[0];

        if (!weeklyDemand.has(dateKey)) {
            weeklyDemand.set(dateKey, { pm: 0, sc: 0, pd: 0, total: 0, byMarket: {} });
        }

        const bucket = weeklyDemand.get(dateKey);
        bucket.pm += weeklyPm;
        bucket.sc += weeklySc;
        bucket.pd += weeklyPd;
        bucket.total += (weeklyPm + weeklySc + weeklyPd);

        cursor.setTime(cursor.getTime() + msPerWeek);
    }
};

// Calculate weekly demand from active forecast
const weeklyDemand = useMemo(() => {
    if (!activeForecast || !showOnChart) return new Map();

    const demand = new Map();
    const { arrData, parameters } = activeForecast;

    // Pre-compute total ARR per market for deriving avgArrPerProject
    const marketTotals = {};
    MARKETS.forEach(m => {
        marketTotals[m] = QUARTERS.reduce((sum, q) => sum + ((arrData[q] || {})[m] || 0), 0);
    });

    QUARTERS.forEach(quarter => {
        const quarterArr = arrData[quarter] || {};

        MARKETS.forEach(market => {
            const arr = quarterArr[market] || 0;
            if (arr <= 0) return;

            const params = parameters[market] || DEFAULT_PARAMETERS[market];
            const projections = calculateProjections(arr, params, market, marketTotals[market]);

            const qStart = getQuarterStartDate(quarter, fyStartMonth, fyDates.fyYear);
            const qEnd = getQuarterEndDate(quarter, fyStartMonth, fyDates.fyYear);

            distributeQuarterHours(qStart, qEnd, projections.hours, demand);
        });
    });

    return demand;
}, [activeForecast, showOnChart, fyStartMonth, fyDates.fyYear]);

// Calculate FTE analysis
const fteAnalysis = useMemo(() => {
    if (!activeForecast) return null;

    const { arrData, parameters } = activeForecast;

    // Sum total hours across all quarters and markets
    let totalPm = 0, totalSc = 0, totalPd = 0;

    // Pre-compute total ARR per market
    const marketTotals = {};
    MARKETS.forEach(m => {
        marketTotals[m] = QUARTERS.reduce((sum, q) => sum + ((arrData[q] || {})[m] || 0), 0);
    });

    QUARTERS.forEach(quarter => {
        const quarterArr = arrData[quarter] || {};

        MARKETS.forEach(market => {
            const arr = quarterArr[market] || 0;
            if (arr <= 0) return;

            const params = parameters[market] || DEFAULT_PARAMETERS[market];
            const projections = calculateProjections(arr, params, market, marketTotals[market]);

            totalPm += projections.hours.pm;
            totalSc += projections.hours.sc;
            totalPd += projections.hours.pd;
        });
    });

    // Calculate FTE required (52 weeks in a year)
    const weeksInFy = 52;
    const hoursPerFtePerYear = avgBillableHoursPerWeek * weeksInFy;

    const pmFteRequired = totalPm / hoursPerFtePerYear;
    const scFteRequired = totalSc / hoursPerFtePerYear;
    const pdFteRequired = totalPd / hoursPerFtePerYear;

    return {
        pm: {
            forecastHours: totalPm,
            fteRequired: pmFteRequired,
            currentFte: currentFTECounts.pm,
            gap: pmFteRequired - currentFTECounts.pm
        },
        sc: {
            forecastHours: totalSc,
            fteRequired: scFteRequired,
            currentFte: currentFTECounts.sc,
            gap: scFteRequired - currentFTECounts.sc
        },
        pd: {
            forecastHours: totalPd,
            fteRequired: pdFteRequired,
            currentFte: currentFTECounts.pd,
            gap: pdFteRequired - currentFTECounts.pd
        },
        total: {
            forecastHours: totalPm + totalSc + totalPd,
            fteRequired: pmFteRequired + scFteRequired + pdFteRequired,
            currentFte: currentFTECounts.pm + currentFTECounts.sc + currentFTECounts.pd,
            gap: (pmFteRequired + scFteRequired + pdFteRequired) -
                (currentFTECounts.pm + currentFTECounts.sc + currentFTECounts.pd)
        },
        assumptions: {
            avgBillableHoursPerWeek,
            weeksInFy,
            hoursPerFtePerYear
        }
    };
}, [activeForecast, currentFTECounts, avgBillableHoursPerWeek]);

// Modal handlers
const openModal = useCallback((forecastId = null) => {
    if (forecastId) {
        const forecast = forecasts.find(f => f.id === forecastId);
        if (forecast) {
            setEditingForecast({ ...forecast.arrData });
            setEditingParameters({ ...forecast.parameters });
        }
    } else {
        // New forecast - empty values
        setEditingForecast({
            Q1: { global: 0, uk: 0, de: 0 },
            Q2: { global: 0, uk: 0, de: 0 },
            Q3: { global: 0, uk: 0, de: 0 },
            Q4: { global: 0, uk: 0, de: 0 }
        });
        setEditingParameters({ ...DEFAULT_PARAMETERS });
    }
    setIsModalOpen(true);
}, [forecasts]);

const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingForecast(null);
}, []);

// Save forecast to Airtable
const saveForecast = useCallback(async (name, setAsActive = false) => {
    if (!forecastTable || !editingForecast) return null;

    try {
        const recordData = {
            fields: {
                [settings[SETTINGS.FORECAST_NAME]]: name,
                [settings[SETTINGS.FORECAST_FY_START]]: fyDates.fyStart.toISOString().split('T')[0],
                [settings[SETTINGS.FORECAST_ARR_JSON]]: JSON.stringify(editingForecast),
                [settings[SETTINGS.FORECAST_PARAMETERS_JSON]]: JSON.stringify(editingParameters),
                [settings[SETTINGS.FORECAST_IS_ACTIVE]]: setAsActive
            }
        };

        const newRecords = await forecastTable.createRecordsAsync([recordData]);

        if (setAsActive && newRecords[0]) {
            setActiveForecastId(newRecords[0]);
            setShowOnChart(true);
        }

        closeModal();
        return newRecords[0];
    } catch (error) {
        console.error('Failed to save forecast:', error);
        return null;
    }
}, [forecastTable, editingForecast, editingParameters, settings, fyDates, closeModal]);

// Convert weekly demand to chart data format
const chartData = useMemo(() => {
    if (!weeklyDemand || weeklyDemand.size === 0) return [];

    return Array.from(weeklyDemand.entries()).map(([dateKey, data]) => ({
        dateKey,
        forecastDemand: data.total,
        forecastPm: data.pm,
        forecastSc: data.sc,
        forecastPd: data.pd
    }));
}, [weeklyDemand]);

return {
    // State
    isModalOpen,
    showOnChart,
    forecasts,
    activeForecast,
    fteAnalysis,
    fyDates,
    weeklyDemand,
    chartData,

    // Editing state (for modal)
    editingForecast,
    editingParameters,
    setEditingForecast,
    setEditingParameters,

    // Actions
    openModal,
    closeModal,
    saveForecast,
    setShowOnChart,
    setActiveForecastId,

    // Constants
    MARKETS,
    MARKET_LABELS,
    QUARTERS,
    DEFAULT_PARAMETERS
};
};

export default useFinanceForecast;
