/**
 * MonteCarloSimulator - Evaluates optimization robustness under uncertainty
 * Simulates multiple scenarios with perturbed capacity to score plan reliability
 */

/**
 * Run Monte Carlo simulation to evaluate plan robustness
 * @param {Object} params - Simulation parameters
 * @param {Object} params.slotMap - Base slot availability map
 * @param {Array} params.allocations - Current allocation plan
 * @param {Object} params.config - Optimization config (slotProfile, etc.)
 * @param {Object} params.uncertainty - Uncertainty parameters
 * @returns {Object} - { robustnessScore, scenarios, risks }
 */
export function runMonteCarloSimulation({
    slotMap,
    allocations,
    config,
    uncertainty = {}
}) {
    const {
        simulations = 50,           // Number of scenarios to run
        leaveRate = 0.05,           // 5% resource unavailability per period
        scopeCreep = 0.10,          // 10% average effort increase
        pipelineVariance = 0.20,    // 20% variance in pipeline arrivals
        capacityVariance = 0.15    // 15% capacity variance
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
            message: `10th percentile shows ${Math.round(p10 * 100)}% fit rate - plan is volatile`
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
            // Random capacity reduction (leave, illness)
            const leaveImpact = Math.random() < leaveRate ? 0.7 : 1;
            // Random variance
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
 * Generate random number from standard normal distribution (Box-Muller)
 */
function randomNormal() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export default {
    runMonteCarloSimulation
};
