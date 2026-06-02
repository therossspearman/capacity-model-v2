/**
 * AIPerformanceTracker - Tracks AI prediction accuracy over time
 * Compares predicted outcomes vs actual execution to measure drift
 */

const STORAGE_PREFIX = 'ai_perf_';
const MAX_SNAPSHOTS = 50; // Keep last 50 snapshots

/**
 * Prediction snapshot structure
 * @typedef {Object} PredictionSnapshot
 * @property {string} scenarioId - Associated scenario ID
 * @property {number} timestamp - When prediction was made
 * @property {string} targetType - AI target type (maxUtilization, minDelays, balanced)
 * @property {Array} predictions - Array of { projectId, predictedKO, predictedLaunch, expectedSlotGain }
 */

/**
 * Save a prediction snapshot when recommendations are applied
 * @param {string} scenarioId - Scenario or session identifier
 * @param {Array} recommendations - Applied recommendations
 * @param {string} targetType - AI target type used
 */
export function saveSnapshot(scenarioId, recommendations, targetType = 'manual') {
    const snapshot = {
        scenarioId,
        timestamp: Date.now(),
        targetType,
        predictions: recommendations.map(rec => ({
            projectId: rec.projectId,
            projectName: rec.projectName,
            predictedKO: rec.suggestedWeek || rec.currentKickOff,
            originalKO: rec.currentKickOff,
            predictedLaunch: rec.suggestedLaunch || rec.currentLaunch,
            expectedSlotGain: rec.slotGain || 0,
            suggestedSquad: rec.suggestedSquad || null
        }))
    };

    try {
        // Get existing snapshots
        const existing = getAllSnapshots();

        // Add new snapshot
        existing.push(snapshot);

        // Trim to max size
        while (existing.length > MAX_SNAPSHOTS) {
            existing.shift();
        }

        localStorage.setItem(`${STORAGE_PREFIX}snapshots`, JSON.stringify(existing));

        return snapshot;
    } catch (err) {
        console.error('[AIPerformanceTracker] Failed to save snapshot:', err);
        return null;
    }
}

/**
 * Get all stored snapshots
 * @returns {PredictionSnapshot[]}
 */
export function getAllSnapshots() {
    try {
        const data = localStorage.getItem(`${STORAGE_PREFIX}snapshots`);
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error('[AIPerformanceTracker] Failed to load snapshots:', err);
        return [];
    }
}

/**
 * Calculate drift between predictions and actual outcomes
 * @param {string} scenarioId - Scenario to check
 * @param {Array} currentProjects - Current project data to compare against
 * @returns {Object} - { accuracyPct, avgDriftWeeks, matchedProjects, driftDetails }
 */
export function calculateDrift(scenarioId, currentProjects) {
    const snapshots = getAllSnapshots();
    const snapshot = snapshots.find(s => s.scenarioId === scenarioId);

    if (!snapshot || !snapshot.predictions || snapshot.predictions.length === 0) {
        return {
            found: false,
            accuracyPct: null,
            avgDriftWeeks: null,
            matchedProjects: 0,
            driftDetails: []
        };
    }

    const driftDetails = [];
    let totalDriftDays = 0;
    let matchedCount = 0;
    let accurateCount = 0;

    for (const prediction of snapshot.predictions) {
        const currentProject = currentProjects.find(p => p.id === prediction.projectId);
        if (!currentProject) continue;

        matchedCount++;

        const actualKO = currentProject.kickOff || currentProject.start;
        const predictedKO = prediction.predictedKO;

        if (!actualKO || !predictedKO) continue;

        const actualDate = new Date(actualKO);
        const predictedDate = new Date(predictedKO);
        const driftDays = Math.round((actualDate - predictedDate) / (1000 * 60 * 60 * 24));
        const driftWeeks = Math.round(driftDays / 7);

        totalDriftDays += Math.abs(driftDays);

        // Consider "accurate" if within 1 week
        const isAccurate = Math.abs(driftWeeks) <= 1;
        if (isAccurate) accurateCount++;

        driftDetails.push({
            projectId: prediction.projectId,
            projectName: prediction.projectName,
            predictedKO,
            actualKO,
            driftDays,
            driftWeeks,
            isAccurate
        });
    }

    const accuracyPct = matchedCount > 0 ? Math.round((accurateCount / matchedCount) * 100) : null;
    const avgDriftWeeks = matchedCount > 0 ? Math.round((totalDriftDays / matchedCount / 7) * 10) / 10 : null;

    return {
        found: true,
        scenarioId: snapshot.scenarioId,
        timestamp: snapshot.timestamp,
        targetType: snapshot.targetType,
        accuracyPct,
        avgDriftWeeks,
        matchedProjects: matchedCount,
        totalPredictions: snapshot.predictions.length,
        driftDetails
    };
}

/**
 * Get rolling performance metrics over recent snapshots
 * @param {Array} currentProjects - Current project data
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Object} - { rollingAccuracy, avgDrift, snapshotCount, trend }
 */
export function getRollingMetrics(currentProjects, days = 30) {
    const snapshots = getAllSnapshots();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const recentSnapshots = snapshots.filter(s => s.timestamp >= cutoff);

    if (recentSnapshots.length === 0) {
        return {
            rollingAccuracy: null,
            avgDrift: null,
            snapshotCount: 0,
            trend: 'neutral'
        };
    }

    // Calculate drift for each snapshot
    const driftResults = recentSnapshots.map(s => calculateDrift(s.scenarioId, currentProjects));
    const validResults = driftResults.filter(r => r.found && r.accuracyPct !== null);

    if (validResults.length === 0) {
        return {
            rollingAccuracy: null,
            avgDrift: null,
            snapshotCount: recentSnapshots.length,
            trend: 'unknown'
        };
    }

    const totalAccuracy = validResults.reduce((sum, r) => sum + r.accuracyPct, 0);
    const totalDrift = validResults.reduce((sum, r) => sum + (r.avgDriftWeeks || 0), 0);

    const rollingAccuracy = Math.round(totalAccuracy / validResults.length);
    const avgDrift = Math.round((totalDrift / validResults.length) * 10) / 10;

    // Calculate trend (compare first half vs second half)
    let trend = 'stable';
    if (validResults.length >= 4) {
        const midpoint = Math.floor(validResults.length / 2);
        const firstHalf = validResults.slice(0, midpoint);
        const secondHalf = validResults.slice(midpoint);

        const firstAvg = firstHalf.reduce((s, r) => s + r.accuracyPct, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, r) => s + r.accuracyPct, 0) / secondHalf.length;

        if (secondAvg > firstAvg + 5) trend = 'improving';
        else if (secondAvg < firstAvg - 5) trend = 'declining';
    }

    return {
        rollingAccuracy,
        avgDrift,
        snapshotCount: recentSnapshots.length,
        validSnapshots: validResults.length,
        trend
    };
}

/**
 * Clear all stored snapshots
 */
export function clearHistory() {
    try {
        localStorage.removeItem(`${STORAGE_PREFIX}snapshots`);
        return true;
    } catch (err) {
        console.error('[AIPerformanceTracker] Failed to clear history:', err);
        return false;
    }
}

export default {
    saveSnapshot,
    getAllSnapshots,
    calculateDrift,
    getRollingMetrics,
    clearHistory
};
