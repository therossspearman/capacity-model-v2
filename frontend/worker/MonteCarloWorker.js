/**
 * MonteCarloWorker - Web Worker for non-blocking robust simulation
 * Uses inline worker pattern (Blob URL) for Airtable compatibility
 */

const workerCode = `
/**
 * Run Monte Carlo simulation to evaluate plan robustness
 */
function runMonteCarloSimulation({
    slotMap,
    allocations,
    config,
    uncertainty = {}
}) {
    const {
        simulations = 500,          // Default increased for worker
        leaveRate = 0.05,
        scopeCreep = 0.10,
        capacityVariance = 0.15
    } = uncertainty;

    const results = [];
    const riskBreakdown = {
        capacityShortfall: 0,
        scopeOverrun: 0,
        resourceGap: 0
    };

    for (let i = 0; i < simulations; i++) {
        // Perturb capacity
        const perturbedSlotMap = perturbCapacity(slotMap, {
            leaveRate,
            capacityVariance
        });

        // Perturb project effort (scope creep)
        const perturbedAllocations = allocations.map(a => ({
            ...a,
            adjustedSlots: Math.ceil(a.slotsNeeded * (1 + randomNormal() * scopeCreep))
        }));

        // Check how many allocations still fit
        let stillFit = 0;
        let capacityIssues = 0;
        let scopeIssues = 0;

        perturbedAllocations.forEach(alloc => {
            const canFit = checkFit(perturbedSlotMap, alloc);
            if (canFit) {
                stillFit++;
            } else if (alloc.adjustedSlots > alloc.slotsNeeded) {
                scopeIssues++;
                riskBreakdown.scopeOverrun++;
            } else {
                capacityIssues++;
                riskBreakdown.capacityShortfall++;
            }
        });

        results.push({
            stillFit,
            total: allocations.length,
            fitRate: allocations.length > 0 ? stillFit / allocations.length : 1,
            capacityIssues,
            scopeIssues
        });
    }

    // Calculate robustness score (0-100)
    const avgFitRate = results.reduce((sum, r) => sum + r.fitRate, 0) / results.length;
    const robustnessScore = Math.round(avgFitRate * 100);

    // Calculate percentiles
    const fitRates = results.map(r => r.fitRate).sort((a, b) => a - b);
    const p10 = fitRates[Math.floor(simulations * 0.1)];
    const p50 = fitRates[Math.floor(simulations * 0.5)];
    const p90 = fitRates[Math.floor(simulations * 0.9)];

    // Identify key risks
    const risks = [];
    if (riskBreakdown.scopeOverrun > simulations * 0.3) {
        risks.push({
            type: 'scope',
            severity: 'high',
            message: 'High risk of scope creep impacting schedule'
        });
    }
    if (riskBreakdown.capacityShortfall > simulations * 0.4) {
        risks.push({
            type: 'capacity',
            severity: 'high',
            message: 'Capacity buffer may be insufficient'
        });
    }
    if (p10 < 0.7) {
        risks.push({
            type: 'volatility',
            severity: 'medium',
            // Fix: p10 is a number 0-1, so multiply by 100
            message: '10th percentile shows ' + Math.round(p10 * 100) + '% fit rate - plan is volatile'
        });
    }

    return {
        robustnessScore,
        confidence: {
            p10: Math.round(p10 * 100),
            p50: Math.round(p50 * 100),
            p90: Math.round(p90 * 100)
        },
        simulations,
        risks,
        interpretation: robustnessScore >= 90 ? 'Highly robust'
            : robustnessScore >= 75 ? 'Reasonably robust'
                : robustnessScore >= 60 ? 'Moderate risk'
                    : 'High uncertainty - consider buffers'
    };
}

/**
 * Perturb slot capacity with random variance
 */
function perturbCapacity(slotMap, { leaveRate, capacityVariance }) {
    const perturbed = {};

    Object.keys(slotMap).forEach(squad => {
        perturbed[squad] = {};
        Object.entries(slotMap[squad] || {}).forEach(([week, bucket]) => {
            const leaveImpact = Math.random() < leaveRate ? 0.7 : 1;
            const variance = 1 + randomNormal() * capacityVariance;

            perturbed[squad][week] = {
                ...bucket,
                availableSlots: Math.max(0, Math.round(
                    (bucket.availableSlots || 0) * leaveImpact * variance
                )),
                remaining: Math.max(0, Math.round(
                    (bucket.remaining || bucket.availableSlots || 0) * leaveImpact * variance
                ))
            };
        });
    });

    return perturbed;
}

/**
 * Check if allocation still fits in perturbed capacity
 */
function checkFit(slotMap, alloc) {
    if (!alloc.slotAssignments?.length) return true;

    let available = 0;
    alloc.slotAssignments.forEach(({ squad, week }) => {
        available += slotMap[squad]?.[week]?.remaining || 0;
    });

    return available >= (alloc.adjustedSlots || alloc.slotsNeeded);
}

/**
 * Generate random number from standard normal distribution
 */
function randomNormal() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Worker Message Handler
self.onmessage = function(e) {
    const { slotMap, allocations, config, uncertainty } = e.data;
    try {
        const result = runMonteCarloSimulation({ slotMap, allocations, config, uncertainty });
        self.postMessage({ success: true, result });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
`;

// Create worker instance
let workerInstance = null;
let workerUrl = null;

const getWorker = () => {
    if (!workerInstance) {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        workerInstance = new Worker(workerUrl);
    }
    return workerInstance;
};

/**
 * Run Monte Carlo simulation in Web Worker
 */
export const runMonteCarloAsync = (params) => {
    return new Promise((resolve, reject) => {
        try {
            const worker = getWorker();

            const handleMessage = (e) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);

                if (e.data.success) {
                    resolve(e.data.result);
                } else {
                    reject(new Error(e.data.error || 'Worker computation failed'));
                }
            };

            const handleError = (e) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(e.message || 'Worker error'));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            worker.postMessage(params);
        } catch (error) {
            reject(error);
        }
    });
};

export const terminateMonteCarloWorker = () => {
    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
    }
    if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
        workerUrl = null;
    }
};

export default {
    runMonteCarloAsync,
    terminateMonteCarloWorker
};
