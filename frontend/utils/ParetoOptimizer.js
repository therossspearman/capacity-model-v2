/**
 * ParetoOptimizer - Generates multiple solutions with different trade-offs
 * Creates a Pareto frontier of non-dominated solutions for user comparison
 */

import { generateBulkAllocationPlan } from './SlotOptimizer';

/**
 * Seedable PRNG (mulberry32). Returns a function producing deterministic
 * pseudo-random floats in [0, 1) for a given integer seed. Used so that the
 * Pareto frontier is reproducible for the same inputs + seed.
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Optimization objectives (to maximize)
 */
const OBJECTIVES = {
    UTILIZATION: 'utilization',    // Maximize slot utilization
    ARR: 'arr',                     // Maximize total ARR placed
    MIN_DELAY: 'minDelay',          // Minimize average delay
    PROJECTS: 'projects',           // Maximize projects placed
    BALANCE: 'balance'              // Balance across squads
};

/**
 * Weight presets for different strategies
 */
export const STRATEGY_PRESETS = {
    balanced: {
        name: 'Balanced',
        description: 'Equal weight to all objectives',
        weights: { utilization: 0.25, arr: 0.25, minDelay: 0.25, projects: 0.25 }
    },
    arrFocused: {
        name: 'ARR Focused',
        description: 'Prioritize high-value projects',
        weights: { utilization: 0.1, arr: 0.6, minDelay: 0.1, projects: 0.2 }
    },
    utilizationMax: {
        name: 'Max Utilization',
        description: 'Fill all available slots',
        weights: { utilization: 0.6, arr: 0.1, minDelay: 0.1, projects: 0.2 }
    },
    onTimeDelivery: {
        name: 'On-Time Delivery',
        description: 'Minimize project delays',
        weights: { utilization: 0.1, arr: 0.2, minDelay: 0.6, projects: 0.1 }
    },
    volumeMax: {
        name: 'Volume Maximizer',
        description: 'Place as many projects as possible',
        weights: { utilization: 0.2, arr: 0.1, minDelay: 0.1, projects: 0.6 }
    }
};

/**
 * Generate Pareto frontier of optimization solutions
 * @param {Object} params - Input parameters
 * @returns {Array} - Array of non-dominated solutions
 */
export function generateParetoFrontier({
    slotMap,
    projects,
    baseConfig,
    strategies = ['balanced', 'arrFocused', 'utilizationMax', 'onTimeDelivery', 'volumeMax'],
    perturbations = 3,  // Number of variants per strategy
    seed = 1            // Seed for deterministic weight perturbations (reproducible frontier)
}) {
    const solutions = [];
    const rand = mulberry32(seed);

    strategies.forEach(strategyKey => {
        const strategy = STRATEGY_PRESETS[strategyKey];
        if (!strategy) return;

        // Generate base solution with this strategy
        const baseSolution = generateSolutionWithWeights({
            slotMap,
            projects,
            baseConfig,
            weights: strategy.weights
        });
        baseSolution.strategy = strategyKey;
        baseSolution.strategyName = strategy.name;
        solutions.push(baseSolution);

        // Generate perturbations for diversity
        for (let i = 0; i < perturbations; i++) {
            const perturbedWeights = perturbWeights(strategy.weights, rand);
            const perturbedSolution = generateSolutionWithWeights({
                slotMap,
                projects,
                baseConfig,
                weights: perturbedWeights
            });
            perturbedSolution.strategy = `${strategyKey}-v${i + 1}`;
            perturbedSolution.strategyName = `${strategy.name} (Variant)`;
            solutions.push(perturbedSolution);
        }
    });

    // Filter to Pareto-optimal solutions only
    const paretoFrontier = filterNonDominated(solutions);

    // Sort by a combined score for display
    paretoFrontier.sort((a, b) => b.combinedScore - a.combinedScore);

    return {
        frontier: paretoFrontier,
        allSolutions: solutions,
        dominatedCount: solutions.length - paretoFrontier.length
    };
}

/**
 * Generate a solution with specific objective weights
 */
function generateSolutionWithWeights({ slotMap, projects, baseConfig, weights }) {
    // Sort projects based on weighted priority
    const sortedProjects = [...projects].sort((a, b) => {
        const scoreA = calculateProjectPriority(a, weights);
        const scoreB = calculateProjectPriority(b, weights);
        return scoreB - scoreA;
    });

    // Run allocation
    const plan = generateBulkAllocationPlan(slotMap, sortedProjects, baseConfig);

    // Calculate metrics for this solution
    const metrics = calculateSolutionMetrics(plan, slotMap, projects);

    return {
        plan,
        metrics,
        weights,
        combinedScore: calculateCombinedScore(metrics, weights)
    };
}

/**
 * Calculate priority score for a project based on weights
 */
function calculateProjectPriority(project, weights) {
    const arr = project.arr || project.transactionalBenefits || 0;
    const slots = project.slotsNeeded || 1;
    const urgency = project.kickOff ? (1 / Math.max(1, daysTilDate(project.kickOff))) : 0.5;

    return (
        (weights.arr || 0) * (arr / 100000) +       // Normalize ARR
        (weights.projects || 0) * (1 / slots) +     // Favor smaller projects for volume
        (weights.minDelay || 0) * urgency +          // Favor urgent projects
        (weights.utilization || 0) * 0.5             // Base score
    );
}

/**
 * Calculate metrics for a solution
 */
function calculateSolutionMetrics(plan, slotMap, allProjects) {
    const placed = plan.stats?.placed || 0;
    const total = allProjects.length;
    const placedArr = (plan.allocations || []).reduce((sum, a) => sum + (a.projectValue || 0), 0);
    const totalArr = allProjects.reduce((sum, p) => sum + (p.arr || p.transactionalBenefits || 0), 0);

    // Calculate average delay
    const delays = (plan.allocations || [])
        .filter(a => a.suggestedKO && a.originalKO)
        .map(a => Math.max(0, daysBetween(a.originalKO, a.suggestedKO) / 7));
    const avgDelay = delays.length > 0 ? delays.reduce((sum, d) => sum + d, 0) / delays.length : 0;

    // Estimate utilization
    const slotsUsed = plan.stats?.slotsUsed || 0;
    const totalSlots = Object.values(slotMap).reduce((sum, squad) =>
        sum + Object.values(squad).reduce((s, w) => s + (w.availableSlots || 0), 0), 0);
    const utilization = totalSlots > 0 ? slotsUsed / totalSlots : 0;

    return {
        projectsPlaced: placed,
        projectsTotal: total,
        placementRate: total > 0 ? placed / total : 0,
        arrPlaced: placedArr,
        arrCaptureRate: totalArr > 0 ? placedArr / totalArr : 0,
        avgDelayWeeks: avgDelay,
        utilization,
        slotsUsed,
        unplaceable: plan.stats?.unplaceable || 0
    };
}

/**
 * Calculate combined score from metrics and weights
 */
function calculateCombinedScore(metrics, weights) {
    // Normalize all metrics to 0-1 scale, where higher is better
    const utilizationScore = metrics.utilization;
    const arrScore = metrics.arrCaptureRate;
    const delayScore = Math.max(0, 1 - metrics.avgDelayWeeks / 8); // 0 delay = 1.0
    const projectsScore = metrics.placementRate;

    return (
        (weights.utilization || 0) * utilizationScore +
        (weights.arr || 0) * arrScore +
        (weights.minDelay || 0) * delayScore +
        (weights.projects || 0) * projectsScore
    );
}

/**
 * Add random perturbation to weights
 * @param {Object} weights - Base objective weights
 * @param {Function} [rand] - PRNG returning [0,1); defaults to Math.random.
 *   Pass a seeded PRNG for reproducible perturbations.
 */
function perturbWeights(weights, rand = Math.random) {
    const perturbed = {};
    let total = 0;

    Object.entries(weights).forEach(([key, value]) => {
        const delta = (rand() - 0.5) * 0.3; // ±15% change
        perturbed[key] = Math.max(0.05, value + delta);
        total += perturbed[key];
    });

    // Normalize to sum to 1
    Object.keys(perturbed).forEach(key => {
        perturbed[key] /= total;
    });

    return perturbed;
}

/**
 * Filter to Pareto-optimal (non-dominated) solutions
 */
function filterNonDominated(solutions) {
    return solutions.filter((solution, idx) => {
        // Solution is dominated if another solution is better in ALL metrics
        return !solutions.some((other, otherIdx) => {
            if (idx === otherIdx) return false;
            return dominates(other.metrics, solution.metrics);
        });
    });
}

/**
 * Check if solution A dominates solution B (A is at least as good in all, strictly better in one)
 */
function dominates(metricsA, metricsB) {
    const betterInAll =
        metricsA.placementRate >= metricsB.placementRate &&
        metricsA.arrCaptureRate >= metricsB.arrCaptureRate &&
        metricsA.avgDelayWeeks <= metricsB.avgDelayWeeks &&
        metricsA.utilization >= metricsB.utilization;

    const strictlyBetterInOne =
        metricsA.placementRate > metricsB.placementRate ||
        metricsA.arrCaptureRate > metricsB.arrCaptureRate ||
        metricsA.avgDelayWeeks < metricsB.avgDelayWeeks ||
        metricsA.utilization > metricsB.utilization;

    return betterInAll && strictlyBetterInOne;
}

/**
 * Helper: Days til a date
 */
function daysTilDate(dateStr) {
    if (!dateStr) return 365;
    const date = new Date(dateStr);
    const now = new Date();
    return Math.max(1, Math.ceil((date - now) / (24 * 60 * 60 * 1000)));
}

/**
 * Helper: Days between two dates
 */
function daysBetween(dateA, dateB) {
    if (!dateA || !dateB) return 0;
    return Math.abs(new Date(dateB) - new Date(dateA)) / (24 * 60 * 60 * 1000);
}


/**
 * Helper: Sort projects based on strategy weights
 */
export function sortProjectsByStrategy(projects, strategyKey) {
    const strategy = STRATEGY_PRESETS[strategyKey] || STRATEGY_PRESETS.balanced;
    const weights = strategy.weights;

    return [...projects].sort((a, b) => {
        const scoreA = calculateProjectPriority(a, weights);
        const scoreB = calculateProjectPriority(b, weights);
        return scoreB - scoreA;
    });
}

export default {
    generateParetoFrontier,
    sortProjectsByStrategy,
    STRATEGY_PRESETS,
    OBJECTIVES
};

