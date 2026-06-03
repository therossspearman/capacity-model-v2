/**
 * PerformanceMonitor - Web Worker efficiency tracking utility
 * Tracks computation cycles, identifies slow operations, and provides performance reports
 */

const PERF_STORAGE_KEY = 'capacity_model_performance_log';
// Capped low: trackWorkerCycle parses + stringifies the entire log via
// localStorage on every worker cycle (a hot path). All readers use at most the
// most recent 100 entries (getPerformanceReport default), so a smaller cap
// keeps the per-cycle parse/stringify cost low without affecting any reports.
const MAX_ENTRIES = 200;
const SLOW_THRESHOLD_MS = 500;

// Active timers for nested timing
const activeTimers = {};

/**
 * Start a high-resolution timer
 * @param {string} label - Timer identifier
 */
export function startTimer(label) {
    activeTimers[label] = performance.now();
}

/**
 * End a timer and return duration
 * @param {string} label - Timer identifier
 * @returns {number} Duration in milliseconds
 */
export function endTimer(label) {
    if (!activeTimers[label]) return 0;
    const duration = performance.now() - activeTimers[label];
    delete activeTimers[label];
    return duration;
}

/**
 * Track a worker computation cycle
 * @param {Object} metrics - Cycle metrics
 * @param {number} metrics.duration - Cycle duration in ms
 * @param {number} metrics.recordCount - Number of records processed
 * @param {number} metrics.bucketCount - Number of time buckets generated
 * @param {number} metrics.resourceCount - Number of resources processed
 * @param {string} [metrics.phase] - Optional phase identifier
 */
export function trackWorkerCycle(metrics) {
    try {
        const entries = getPerformanceLog();

        const entry = {
            timestamp: Date.now(),
            duration: Math.round(metrics.duration * 100) / 100,
            recordCount: metrics.recordCount || 0,
            bucketCount: metrics.bucketCount || 0,
            resourceCount: metrics.resourceCount || 0,
            phase: metrics.phase || 'full-cycle',
            throughput: metrics.recordCount > 0
                ? Math.round((metrics.recordCount / metrics.duration) * 1000)
                : 0, // records per second
            isSlow: metrics.duration > SLOW_THRESHOLD_MS
        };

        entries.unshift(entry);

        if (entries.length > MAX_ENTRIES) {
            entries.splice(MAX_ENTRIES);
        }

        localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(entries));

        // Console warning for slow cycles
        if (entry.isSlow) {
            console.warn(
                `[PERF] Slow worker cycle: ${entry.duration}ms ` +
                `(${entry.recordCount} records, ${entry.resourceCount} resources, ${entry.bucketCount} buckets)`
            );
        }

        return entry;
    } catch (e) {
        console.error('Failed to track performance:', e);
        return null;
    }
}

/**
 * Get raw performance log
 * @returns {Array} Performance entries
 */
export function getPerformanceLog() {
    try {
        const data = localStorage.getItem(PERF_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Generate performance report with aggregated statistics
 * @param {number} [lastN=100] - Number of recent entries to analyze
 * @returns {Object} Performance report
 */
export function getPerformanceReport(lastN = 100) {
    const entries = getPerformanceLog().slice(0, lastN);

    if (entries.length === 0) {
        return {
            sampleSize: 0,
            avg: 0,
            min: 0,
            max: 0,
            p50: 0,
            p95: 0,
            slowCount: 0,
            slowRate: 0,
            avgThroughput: 0,
            trend: 'stable'
        };
    }

    const durations = entries.map(e => e.duration).sort((a, b) => a - b);
    const slowCount = entries.filter(e => e.isSlow).length;
    const throughputs = entries.map(e => e.throughput).filter(t => t > 0);

    // Calculate percentiles
    const percentile = (arr, p) => {
        const idx = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, idx)];
    };

    // Calculate trend (comparing first half vs second half).
    // Needs at least 4 samples for both halves to be non-empty and meaningful;
    // smaller samples stay 'stable' to avoid dividing by zero (NaN) below.
    let trend = 'stable';
    if (entries.length >= 4) {
        const halfIdx = Math.floor(entries.length / 2);
        const recentAvg = entries.slice(0, halfIdx).reduce((s, e) => s + e.duration, 0) / halfIdx;
        const olderAvg = entries.slice(halfIdx).reduce((s, e) => s + e.duration, 0) / (entries.length - halfIdx);

        if (recentAvg > olderAvg * 1.2) trend = 'degrading';
        else if (recentAvg < olderAvg * 0.8) trend = 'improving';
    }

    return {
        sampleSize: entries.length,
        avg: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
        min: Math.round(durations[0]),
        max: Math.round(durations[durations.length - 1]),
        p50: Math.round(percentile(durations, 50)),
        p95: Math.round(percentile(durations, 95)),
        slowCount,
        slowRate: Math.round((slowCount / entries.length) * 100),
        avgThroughput: throughputs.length > 0
            ? Math.round(throughputs.reduce((s, t) => s + t, 0) / throughputs.length)
            : 0,
        trend,
        lastCycle: entries[0] || null
    };
}

/**
 * Check if performance needs attention
 * @param {number} [threshold=SLOW_THRESHOLD_MS] - Threshold in ms
 * @returns {Object} Warning status
 */
export function shouldWarn(threshold = SLOW_THRESHOLD_MS) {
    const report = getPerformanceReport(20);

    return {
        warn: report.slowRate > 10 || report.p95 > threshold,
        message: report.slowRate > 10
            ? `${report.slowRate}% of cycles are slow (>${threshold}ms)`
            : report.p95 > threshold
                ? `P95 latency (${report.p95}ms) exceeds threshold`
                : null,
        report
    };
}

/**
 * Clear performance log
 */
export function clearPerformanceLog() {
    localStorage.removeItem(PERF_STORAGE_KEY);
}

/**
 * Get formatted last cycle time for display
 * @returns {string} Formatted duration or null
 */
export function getLastCycleDisplay() {
    const entries = getPerformanceLog();
    if (entries.length === 0) return null;

    const last = entries[0];
    const duration = last.duration;

    if (duration < 1000) return `${Math.round(duration)}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
}

export default {
    startTimer,
    endTimer,
    trackWorkerCycle,
    getPerformanceLog,
    getPerformanceReport,
    shouldWarn,
    clearPerformanceLog,
    getLastCycleDisplay,
    SLOW_THRESHOLD_MS
};
