/**
 * OptimizationSolver.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Portfolio Optimization Solver
 *
 * PRODUCTION PATH — runGreedyOptimizer (multi-start greedy):
 * 1. Pass 1 (Big Rocks): balance customers across squads.
 * 2. Multi-Start: generate 3 diverse plans with different project orderings
 *    (Priority First, Customer Grouped, ARR Maximized), score each, pick best.
 * 3. Pass 2.5 (Small Rocks): customer micro-moves on the winning plan, then
 *    re-run resource assignment for any moved projects.
 *
 * DORMANT — runOptimizationSolver (Simulated Annealing):
 * The SA path (generateInitialStrategies → simulatedAnnealing → perturb*) and
 * analyzeConstraintBindings are kept for reference/experimentation but are NOT
 * used in production — see the note above runOptimizationSolver. Only
 * runGreedyOptimizer and buildSolverAIPayload are imported elsewhere.
 *
 * @version 1.1.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { generateReprioritizationPlan, assignResources, balanceCustomerSquads, microMoveCustomers, buildRoleMatchers } from './PortfolioReprioritizer.js';

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const SA_CONFIG = {
    initialTemp: 100,
    coolingRate: 0.985,              // Slower cooling for better exploration (was 0.97)
    minTemp: 0.1,
    maxIterations: 500,              // Increased from 200 for deeper search
    perturbationWeights: {
        swapResources: 30,
        shiftProjectDate: 25,
        reassignRole: 25,
        squadRebalance: 15,
        deferUndefer: 5
    },
    // Adaptive weights: early iterations explore more (date shifts),
    // later iterations exploit more (resource swaps)
    earlyWeights: {
        swapResources: 15,
        shiftProjectDate: 35,
        reassignRole: 20,
        squadRebalance: 20,
        deferUndefer: 10
    },
    lateWeights: {
        swapResources: 40,
        shiftProjectDate: 15,
        reassignRole: 30,
        squadRebalance: 10,
        deferUndefer: 5
    }
};

// Objective function weights — higher is better
const OBJECTIVE_WEIGHTS = {
    projectsResourced: 1000,     // Each fully-resourced project
    rolesFilled: 100,            // Each role successfully filled
    totalPriorityScore: 10,      // Sum of scheduled project scores
    squadSpecFit: 50,            // Squad specialization matches
    customerSquadCohesion: 30,   // Customer-squad affinity satisfaction
    shiftPenalty: -20,           // Per week of date shifting
    concurrencyViolation: -500,  // Each concurrent constraint breach
    overallocation: -200,        // Resource >100% utilization
    seededPreserved: 25          // Each preserved existing assignment
};

// ═════════════════════════════════════════════════════════════════════════════
// OBJECTIVE FUNCTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Score a complete solution. Higher is better.
 * 
 * @param {Object} plan - { scheduled, deferred, warnings, stats }
 * @param {Object} config - Engine config for context
 * @returns {{ score: number, breakdown: Object }}
 */
function evaluateSolution(plan, config) {
    const { scheduled, deferred, stats } = plan;
    const breakdown = {};

    // Single-pass evaluation to avoid memory churn from Date objects
    let fullyResourced = 0;
    let totalPriority = 0;
    let specMatches = 0;
    let totalShift = 0;
    let seededKept = 0;
    let overallocation = 0;
    const customerSquads = {};
    const customerTimestamps = {};
    const resourceLoad = {};

    for (let i = 0; i < scheduled.length; i++) {
        const p = scheduled[i];
        const assigns = p.assignments || [];

        // 1. Fully resourced
        if (assigns.length > 0 && assigns.every(a => a.resourceId != null)) fullyResourced++;

        // 3. Priority score
        totalPriority += (p._reprioritization?.score || 0);

        // 6. Date shift
        totalShift += (p.shiftWeeks || 0);

        // Per-assignment metrics
        for (let j = 0; j < assigns.length; j++) {
            const a = assigns[j];
            // 4. Squad spec fit
            if (a.reason && a.reason.includes('specializes in')) specMatches++;
            // 9. Seeded preservation
            if (a.isSeeded) seededKept++;
            // 8. Overallocation — use time-phased check instead of naive allocationPct sum
            if (a.resourceId) {
                if (!resourceLoad[a.resourceId]) {
                    resourceLoad[a.resourceId] = { projects: [], totalPct: 0 };
                }
                const allocPct = (a.allocationPct || 100) / 100;
                // Track project time windows for overlap detection
                resourceLoad[a.resourceId].projects.push({
                    startMs: p._startMs || (p.start ? new Date(p.start).getTime() : 0),
                    endMs: p._endMs || (p.end ? new Date(p.end).getTime() : 0),
                    pct: allocPct
                });
                resourceLoad[a.resourceId].totalPct += allocPct;
            }
            // 5. Customer-squad cohesion
            const customer = p.customer || '';
            if (customer && a.resourceSquads) {
                if (!customerSquads[customer]) customerSquads[customer] = new Set();
                if (Array.isArray(a.resourceSquads)) a.resourceSquads.forEach(s => customerSquads[customer].add(s));
            }
        }

        // 7. Concurrency — use timestamps, NO Date objects
        const customer = p.customer || '';
        if (customer) {
            if (!customerTimestamps[customer]) customerTimestamps[customer] = [];
            const startVal = p.proposedStart || p.start || p.kickOff;
            const endVal = p.proposedEnd || p.end || p.launch;
            // Convert to timestamp without creating Date objects when possible
            const startTs = typeof startVal === 'number' ? startVal : (startVal ? new Date(startVal).getTime() : 0);
            const endTs = typeof endVal === 'number' ? endVal : (endVal ? new Date(endVal).getTime() : 0);
            customerTimestamps[customer].push(startTs, endTs);
        }
    }

    breakdown.projectsResourced = fullyResourced * OBJECTIVE_WEIGHTS.projectsResourced;
    breakdown.rolesFilled = (stats?.rolesFilled || 0) * OBJECTIVE_WEIGHTS.rolesFilled;
    breakdown.totalPriorityScore = totalPriority * OBJECTIVE_WEIGHTS.totalPriorityScore;
    breakdown.squadSpecFit = specMatches * OBJECTIVE_WEIGHTS.squadSpecFit;
    breakdown.shiftPenalty = totalShift * OBJECTIVE_WEIGHTS.shiftPenalty;
    breakdown.seededPreserved = seededKept * OBJECTIVE_WEIGHTS.seededPreserved;

    // 5. Customer-squad cohesion
    const maxSquads = config.maxSquadsPerCustomer || 2;
    let cohesionScore = 0;
    for (const squads of Object.values(customerSquads)) {
        cohesionScore += squads.size <= maxSquads ? 1 : -(squads.size - maxSquads);
    }
    breakdown.customerSquadCohesion = cohesionScore * OBJECTIVE_WEIGHTS.customerSquadCohesion;

    // 7. Concurrency violations (sweep line with raw timestamps)
    let violations = 0;
    for (const [customer, timestamps] of Object.entries(customerTimestamps)) {
        const conc = config.perCustomerOverrides?.[customer] || {};
        const maxC = conc.max || config.maxConcurrentCountries || 10;
        // timestamps array is [start, end, start, end, ...]
        const events = [];
        for (let k = 0; k < timestamps.length; k += 2) {
            events.push({ t: timestamps[k], d: 1 });
            events.push({ t: timestamps[k + 1], d: -1 });
        }
        events.sort((a, b) => a.t - b.t || a.d - b.d);
        let running = 0;
        for (let k = 0; k < events.length; k++) {
            running += events[k].d;
            if (running > maxC) violations++;
        }
    }
    breakdown.concurrencyViolation = violations * OBJECTIVE_WEIGHTS.concurrencyViolation;

    // 8. Overallocation — Fix ENH-9: check concurrent load, not naive sum
    for (const data of Object.values(resourceLoad)) {
        // Quick check: if total non-overlapping sum <= 1.0, skip expensive overlap check
        if (data.totalPct <= 1.0) continue;
        // Check if projects actually overlap in time
        const projs = data.projects;
        if (projs.length <= 1) continue;
        // Use sweep line to find peak concurrent allocation
        const events = [];
        for (const pr of projs) {
            if (pr.startMs && pr.endMs) {
                events.push({ t: pr.startMs, d: pr.pct });
                events.push({ t: pr.endMs, d: -pr.pct });
            }
        }
        if (events.length === 0) {
            // No time data available — fall back to simple sum
            if (data.totalPct > 1.0) overallocation += Math.ceil((data.totalPct - 1.0) * 10);
            continue;
        }
        events.sort((a, b) => a.t - b.t || a.d - b.d);
        let running = 0, peak = 0;
        for (const ev of events) {
            running += ev.d;
            if (running > peak) peak = running;
        }
        if (peak > 1.0) overallocation += Math.ceil((peak - 1.0) * 10);
    }
    breakdown.overallocation = overallocation * OBJECTIVE_WEIGHTS.overallocation;

    const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { score: totalScore, breakdown };
}

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-STRATEGY INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════

// Yield control back to the browser so the UI stays responsive
const yieldToUI = () => new Promise(r => setTimeout(r, 16)); // One frame at 60fps

/**
 * Generate initial solutions using different project ordering strategies.
 * Now async — yields between strategy runs so UI stays responsive.
 * 
 * @param {Array} projects - Eligible projects
 * @param {Object} slotMap - Slot availability map
 * @param {Array} resources - Available resources
 * @param {Object} config - Engine config
 * @param {Function} onProgress - Progress callback (pct, phase)
 * @returns {Array<{ plan: Object, strategy: string, score: number }>}
 */
async function generateInitialStrategies(projects, slotMap, resources, config, onProgress) {
    const strategies = [];

    // Helper: create a scoped progress callback for a strategy
    const makeSubProgress = (basePct, label) => {
        return (subLabel) => {
            if (onProgress) onProgress(basePct, `${label}: ${subLabel}`);
        };
    };

    // Single strategy with autoAssign:false to minimize memory
    // Resource assignment happens once after SA on the final best plan
    if (onProgress) onProgress(5, 'Generating initial plan...');
    await yieldToUI();
    try {
        const lightConfig = { ...config, autoAssign: false };
        const plan1 = await generateReprioritizationPlan(projects, slotMap, resources, lightConfig, makeSubProgress(5, 'Planning'));
        const eval1 = evaluateSolution(plan1, config);
        strategies.push({
            plan: plan1,
            strategy: 'score_ordered',
            label: 'Priority First',
            score: eval1.score,
            breakdown: eval1.breakdown
        });
    } catch (e) {
        console.warn('[SOLVER] Strategy generation failed:', e);
    }

    return strategies;
}

// ═════════════════════════════════════════════════════════════════════════════
// PERTURBATION GENERATORS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Deep clone a plan (scheduled + deferred arrays with assignments).
 */
function clonePlan(plan) {
    return {
        scheduled: plan.scheduled.map(p => ({
            ...p,
            assignments: (p.assignments || []).map(a => ({ ...a })),
            _reprioritization: p._reprioritization ? { ...p._reprioritization } : undefined
        })),
        deferred: plan.deferred.map(p => ({ ...p })),
        excluded: plan.excluded ? plan.excluded.map(p => ({ ...p })) : [],
        warnings: [...(plan.warnings || [])],
        stats: { ...plan.stats }
    };
}

/**
 * Apply a random perturbation to a plan.
 * Returns a modified clone (does not mutate the input).
 * 
 * @param {Object} plan - Current solution
 * @param {Array} resources - Available resources
 * @param {Object} config - Engine config
 * @returns {Object} Modified plan
 */
function perturb(plan, resources, config, progress = 0.5) {
    const neighbour = clonePlan(plan);
    const perturbType = selectPerturbation(progress);

    switch (perturbType) {
        case 'swapResources':
            perturbSwapResources(neighbour);
            break;
        case 'shiftProjectDate':
            perturbShiftDate(neighbour, config);
            break;
        case 'reassignRole':
            perturbReassignRole(neighbour, resources, config);
            break;
        case 'squadRebalance':
            perturbSquadRebalance(neighbour, resources, config);
            break;
        case 'deferUndefer':
            perturbDeferUndefer(neighbour, config);
            break;
    }

    return neighbour;
}

/**
 * Weighted random selection of perturbation type.
 * Adaptive: early iterations favour exploration (date shifts, defer/undefer),
 * later iterations favour exploitation (resource swaps, reassignment).
 */
function selectPerturbation(progress = 0.5) {
    // Blend between early and late weights based on progress (0-1)
    const early = SA_CONFIG.earlyWeights;
    const late = SA_CONFIG.lateWeights;
    const weights = {};
    for (const key of Object.keys(SA_CONFIG.perturbationWeights)) {
        weights[key] = early[key] * (1 - progress) + late[key] * progress;
    }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [type, weight] of Object.entries(weights)) {
        r -= weight;
        if (r <= 0) return type;
    }
    return 'swapResources'; // fallback
}

/**
 * Swap resource assignments between two random projects (same role).
 */
function perturbSwapResources(plan) {
    if (plan.scheduled.length < 2) return;
    const i = Math.floor(Math.random() * plan.scheduled.length);
    let j = Math.floor(Math.random() * (plan.scheduled.length - 1));
    if (j >= i) j++;

    const pA = plan.scheduled[i];
    const pB = plan.scheduled[j];
    const aAssigns = pA.assignments || [];
    const bAssigns = pB.assignments || [];

    // Find a shared role to swap
    const roles = ['PM', 'SC', 'PD'];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const aRole = aAssigns.find(a => a.role === role && a.resourceId && !a.isSeeded);
    const bRole = bAssigns.find(a => a.role === role && a.resourceId && !a.isSeeded);

    if (aRole && bRole) {
        // Swap resource assignments
        const tmpId = aRole.resourceId;
        const tmpName = aRole.resourceName;
        const tmpSquads = aRole.resourceSquads;
        const tmpHeadshot = aRole.resourceHeadshot;

        aRole.resourceId = bRole.resourceId;
        aRole.resourceName = bRole.resourceName;
        aRole.resourceSquads = bRole.resourceSquads;
        aRole.resourceHeadshot = bRole.resourceHeadshot;

        bRole.resourceId = tmpId;
        bRole.resourceName = tmpName;
        bRole.resourceSquads = tmpSquads;
        bRole.resourceHeadshot = tmpHeadshot;
    }
}

/**
 * Shift a random project's dates by ±1-4 weeks.
 */
function perturbShiftDate(plan, config) {
    if (plan.scheduled.length === 0) return;
    const idx = Math.floor(Math.random() * plan.scheduled.length);
    const p = plan.scheduled[idx];

    // Don't shift locked projects
    if (p._reprioritization?.isLaunchLocked) return;

    const maxShift = p._reprioritization?.maxShiftWeeks ?? config.defaultMaxShiftWeeks ?? 26;
    const currentShift = p.shiftWeeks || 0;
    // Random delta: -2 to +4 weeks (bias towards forward)
    const delta = Math.floor(Math.random() * 7) - 2;
    const newShift = Math.max(0, Math.min(maxShift, currentShift + delta));

    if (newShift !== currentShift) {
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const origStart = new Date(p.start || p.kickOff || new Date());
        const origEnd = new Date(p.end || p.launch || new Date());
        const duration = origEnd.getTime() - origStart.getTime();

        const newStart = new Date(origStart.getTime() + newShift * ONE_WEEK_MS);
        const newEnd = new Date(newStart.getTime() + duration);

        p.proposedStart = newStart.toISOString().split('T')[0];
        p.proposedEnd = newEnd.toISOString().split('T')[0];
        p.shiftWeeks = newShift;
    }
}

/**
 * Reassign one random role slot to a different resource.
 */
function perturbReassignRole(plan, resources, config) {
    if (plan.scheduled.length === 0 || resources.length === 0) return;
    const idx = Math.floor(Math.random() * plan.scheduled.length);
    const p = plan.scheduled[idx];
    const assigns = p.assignments || [];
    const fillable = assigns.filter(a => !a.isSeeded);
    if (fillable.length === 0) return;

    const slot = fillable[Math.floor(Math.random() * fillable.length)];
    const ROLE_MATCHERS_SA = buildRoleMatchers(config); // Fix ENH-2: use same role matching as main engine
    const validRes = resources.filter(r => {
        if (!r.name) return false;
        if (r.id === slot.resourceId) return false;
        const baseRole = slot.role.replace(/ \(\d+\/\d+\)/, '');
        const matcher = ROLE_MATCHERS_SA[baseRole];
        return matcher ? matcher(r) : false;
    });

    if (validRes.length > 0) {
        const newRes = validRes[Math.floor(Math.random() * validRes.length)];
        slot.resourceId = newRes.id;
        slot.resourceName = newRes.name;
        slot.resourceSquads = newRes.squads || [];
        slot.resourceHeadshot = newRes.headshot || null;
        slot.reason = 'SA: reassigned for optimization';
    }
}

/**
 * Move a project's resource assignment to prefer a different squad's pool.
 */
function perturbSquadRebalance(plan, resources, config) {
    if (plan.scheduled.length === 0 || resources.length === 0) return;
    const idx = Math.floor(Math.random() * plan.scheduled.length);
    const p = plan.scheduled[idx];
    const assigns = (p.assignments || []).filter(a => a.resourceId && !a.isSeeded);
    if (assigns.length === 0) return;

    // Pick a random assignment and try to find same-role resource from different squad
    const slot = assigns[Math.floor(Math.random() * assigns.length)];
    const currentSquads = new Set(slot.resourceSquads || []);

    const ROLE_MATCHERS_SQ = buildRoleMatchers(config); // Fix ENH-2: use same role matching as main engine
    const diffSquadRes = resources.filter(r => {
        if (!r.name || r.id === slot.resourceId) return false;
        const rSquads = r.squads || [];
        // Must be from a DIFFERENT squad
        if (rSquads.some(s => currentSquads.has(s))) return false;
        const baseRole = slot.role.replace(/ \(\d+\/\d+\)/, '');
        const matcher = ROLE_MATCHERS_SQ[baseRole];
        return matcher ? matcher(r) : false;
    });

    if (diffSquadRes.length > 0) {
        const newRes = diffSquadRes[Math.floor(Math.random() * diffSquadRes.length)];
        slot.resourceId = newRes.id;
        slot.resourceName = newRes.name;
        slot.resourceSquads = newRes.squads || [];
        slot.resourceHeadshot = newRes.headshot || null;
        slot.reason = 'SA: squad rebalance';
    }
}

/**
 * Swap a deferred project with a low-scoring scheduled project.
 */
function perturbDeferUndefer(plan, config) {
    if (plan.deferred.length === 0 || plan.scheduled.length < 2) return;

    // Pick a random deferred project
    const dIdx = Math.floor(Math.random() * plan.deferred.length);
    const defProject = plan.deferred[dIdx];

    // Pick a low-scoring scheduled project (bottom quartile)
    const sorted = [...plan.scheduled].sort((a, b) =>
        (a._reprioritization?.score || 0) - (b._reprioritization?.score || 0)
    );
    const quartile = Math.ceil(sorted.length / 4);
    const candidates = sorted.slice(0, quartile);
    if (candidates.length === 0) return;

    const sIdx = Math.floor(Math.random() * candidates.length);
    const schedProject = candidates[sIdx];

    // Only swap if deferred project has higher score
    const defScore = defProject._reprioritization?.score || 0;
    const schedScore = schedProject._reprioritization?.score || 0;
    if (defScore <= schedScore * 0.8) return; // Must be notably better

    // Swap
    const schedIdx = plan.scheduled.findIndex(p => p.id === schedProject.id);
    if (schedIdx === -1) return;

    plan.scheduled.splice(schedIdx, 1);
    plan.deferred.splice(dIdx, 1);

    // Move deferred → scheduled (inherit the scheduled project's dates as starting point)
    plan.scheduled.push({
        ...defProject,
        proposedStart: defProject.start || defProject.kickOff,
        proposedEnd: defProject.end || defProject.launch,
        shiftWeeks: 0,
        schedulingNote: 'SA: undeferred'
    });

    // Move scheduled → deferred
    plan.deferred.push({
        ...schedProject,
        deferralReason: 'SA: displaced by higher-scoring project',
        schedulingNote: 'SA: deferred for optimization'
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// SIMULATED ANNEALING CORE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Run simulated annealing refinement on the best initial solution.
 * Now async — yields every 50 iterations so UI stays responsive.
 * 
 * @param {Object} initialPlan - Best starting solution
 * @param {Array} resources - Available resources
 * @param {Object} config - Engine config
 * @param {Object} options - SA overrides
 * @param {Function} onProgress - Progress callback (pct, phase)
 * @returns {{ bestPlan: Object, bestScore: number, convergenceHistory: Array, iterations: number }}
 */
async function simulatedAnnealing(initialPlan, resources, config, options = {}, onProgress) {
    const saConfig = { ...SA_CONFIG, ...options };
    const startTime = performance.now();

    let temperature = saConfig.initialTemp;
    let current = clonePlan(initialPlan);
    let currentEval = evaluateSolution(current, config);
    let best = clonePlan(current);
    let bestScore = currentEval.score;
    const convergenceHistory = [{ iteration: 0, score: bestScore, temp: temperature }];

    let accepted = 0;
    let rejected = 0;
    let improved = 0;
    let totalIterations = 0;

    for (let i = 0; i < saConfig.maxIterations && temperature > saConfig.minTemp; i++) {
        totalIterations = i;
        // Generate neighbour
        const neighbour = perturb(current, resources, config, i / saConfig.maxIterations);
        const neighbourEval = evaluateSolution(neighbour, config);
        const delta = neighbourEval.score - currentEval.score;

        // Accept or reject
        if (delta > 0) {
            // Better solution — always accept
            current = neighbour;
            currentEval = neighbourEval;
            accepted++;
            improved++;

            if (neighbourEval.score > bestScore) {
                best = clonePlan(neighbour);
                bestScore = neighbourEval.score;
            }
        } else {
            // Worse solution — accept with probability e^(delta/T)
            const acceptProb = Math.exp(delta / temperature);
            if (Math.random() < acceptProb) {
                current = neighbour;
                currentEval = neighbourEval;
                accepted++;
            } else {
                rejected++;
            }
        }

        // Cool temperature
        temperature *= saConfig.coolingRate;

        // Every 5 iterations: record history + yield to UI
        if (i % 5 === 0) {
            convergenceHistory.push({
                iteration: i,
                score: bestScore,
                temp: temperature,
                accepted,
                rejected
            });
            // Yield to UI and update progress (SA is 30-80% of total)
            const saPct = Math.min(i / saConfig.maxIterations, 1);
            if (onProgress) onProgress(30 + Math.round(saPct * 50), `Refining solution (iteration ${i}/${saConfig.maxIterations})`);
            await yieldToUI();
        }

        // Time guard: don't exceed 4 seconds to allow deeper exploration
        if (performance.now() - startTime > 4000) {
            convergenceHistory.push({ iteration: i, score: bestScore, temp: temperature, timeLimit: true });
            break;
        }
    }

    // Update stats on best plan
    best.stats = {
        ...best.stats,
        projectsScheduled: best.scheduled.length,
        projectsDeferred: best.deferred.length,
        totalArrProtected: best.scheduled.reduce((sum, p) => sum + (p.arr || 0), 0),
        totalArrDeferred: best.deferred.reduce((sum, p) => sum + (p.arr || 0), 0),
        customersServed: new Set(best.scheduled.map(p => p.customer)).size,
        rolesFilled: best.stats.rolesFilled || 0
    };

    return {
        bestPlan: best,
        bestScore,
        convergenceHistory,
        iterations: totalIterations,
        saStats: {
            accepted,
            rejected,
            improved,
            finalTemp: temperature,
            durationMs: Math.round(performance.now() - startTime)
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SOLVER ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Run the full optimization pipeline:
 * 1. Generate multi-strategy initial solutions
 * 2. Select best starting point
 * 3. Run simulated annealing refinement
 * 4. Return best solution with metadata
 * 
 * @param {Object} params
 * @param {Array} params.projects - Eligible projects
 * @param {Object} params.slotMap - Slot availability map
 * @param {Array} params.resources - Available resources
 * @param {Object} params.config - Engine config
 * @param {Object} [params.saOptions] - SA config overrides
 * @returns {Object} { bestPlan, bestScore, strategies, convergence, solverMeta }
 */
export async function runGreedyOptimizer({ projects, slotMap, resources = [], config = {}, onProgress }) {
    const solverStart = performance.now();
    const progress = onProgress || (() => { });

    // Pass 1: Big Rocks — Customer-to-Squad Allocation
    progress(2, 'Balancing customers across squads...');
    let pass1Result = { squadMoves: [], squadUtilization: {} };
    try {
        pass1Result = balanceCustomerSquads(projects, resources, config);
    } catch (e) {
        console.warn('[GREEDY] Pass 1 squad balancing failed:', e);
    }

    // ── Multi-Start: Generate 3 diverse plans with different orderings ──
    const strategyConfigs = [
        { label: 'Priority First', sortOverride: null },
        { label: 'Customer Grouped', sortOverride: 'customer_interleave' },
        { label: 'ARR Maximized', sortOverride: 'arr_descending' }
    ];

    const strategyResults = [];
    const numStrategies = strategyConfigs.length;

    for (let si = 0; si < numStrategies; si++) {
        const strat = strategyConfigs[si];
        const basePct = 5 + Math.round((si / numStrategies) * 60);
        progress(basePct, `Strategy ${si + 1}/${numStrategies}: ${strat.label}...`);
        await yieldToUI();

        try {
            const stratConfig = {
                ...config,
                _sortOverride: strat.sortOverride
            };

            const plan = await generateReprioritizationPlan(projects, slotMap, resources, stratConfig, (subLabel, meta) => {
                const match = subLabel && subLabel.match(/(\d+)\/(\d+)/);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    const pct = basePct + Math.round((current / total) * (60 / numStrategies));
                    progress(pct, `${strat.label}: ${subLabel}`, meta);
                } else {
                    progress(basePct, `${strat.label}: ${subLabel}`, meta);
                }
            });

            if (plan && plan.scheduled) {
                const evaluation = evaluateSolution(plan, config);
                const fillRate = (plan.stats?.rolesFilled || 0) / Math.max(plan.stats?.rolesNeeded || 1, 1);
                strategyResults.push({
                    plan,
                    strategy: strat.sortOverride || 'score_ordered',
                    label: strat.label,
                    score: evaluation.score,
                    breakdown: evaluation.breakdown,
                    fillRate
                });
                console.log(`[SOLVER] Strategy "${strat.label}": score=${evaluation.score}, fillRate=${(fillRate * 100).toFixed(1)}%, scheduled=${plan.scheduled.length}`);
            }
        } catch (e) {
            console.warn(`[SOLVER] Strategy "${strat.label}" failed:`, e);
        }
    }

    if (strategyResults.length === 0) {
        console.error('[SOLVER] All strategies failed');
        return null;
    }

    // ── Pick the best strategy (highest score wins) ──
    strategyResults.sort((a, b) => b.score - a.score);
    const winner = strategyResults[0];
    winner.isWinner = true;
    const plan = winner.plan;
    console.log(`[SOLVER] Winner: "${winner.label}" (score=${winner.score}, fillRate=${(winner.fillRate * 100).toFixed(1)}%)`);

    // Pass 2.5: Small Rocks — Customer Micro-Moves (on winning plan only)
    progress(80, 'Optimizing customer placements...');
    await yieldToUI();
    let pass25Result = { microMoves: [] };
    try {
        pass25Result = microMoveCustomers(plan.scheduled, resources, config);
        // If micro-moves were made, re-run resource assignment for moved projects
        if (pass25Result.microMoves.length > 0 && resources.length > 0) {
            progress(82, `Re-assigning after ${pass25Result.microMoves.length} customer moves...`);
            await yieldToUI();
            // Clear assignments on moved projects so they get re-scored
            plan.scheduled.forEach(p => {
                if (p._microMoved) {
                    p.assignments = (p.assignments || []).filter(a => a.isSeeded); // Keep seeded only
                }
            });
            // Re-run assignment (it will fill new gaps using the new squad bindings)
            const reassignResult = await assignResources(
                plan.scheduled, resources, config, plan.warnings || []
            );
            plan.stats = {
                ...plan.stats,
                rolesFilled: reassignResult.rolesFilled || 0,
                rolesNeeded: reassignResult.rolesNeeded || 0,
                crossSquadCount: reassignResult.crossSquadCount || 0
            };
        }
    } catch (e) {
        console.warn('[GREEDY] Pass 2.5 micro-moves failed:', e);
    }

    progress(90, 'Finalizing results...');
    await yieldToUI();

    const totalDuration = Math.round(performance.now() - solverStart);

    return {
        bestPlan: plan,
        bestScore: winner.score,
        strategies: strategyResults.map(s => ({
            strategy: s.strategy,
            label: s.label,
            score: s.score,
            breakdown: s.breakdown,
            isWinner: s.isWinner || false,
            fillRate: Math.round((s.fillRate || 0) * 100)
        })),
        convergence: [],
        squadMoves: pass1Result.squadMoves || [],
        microMoves: pass25Result.microMoves || [],
        squadUtilization: pass1Result.squadUtilization || {},
        dataQualityWarnings: pass1Result.dataQualityWarnings || [],
        decisionSupport: {
            revenueAtRisk: plan.stats?.revenueAtRisk || 0,
            revenueAtRiskBySquad: plan.stats?.revenueAtRiskBySquad || {},
            hiringGaps: plan.stats?.hiringGaps || {},
            partialProjectsFreed: plan.stats?.partialProjectsFreed || [],
            freedFromPartial: plan.stats?.freedFromPartial || 0,
            optimizerMetrics: plan.stats?.optimizerMetrics || null,
            customerSatisfaction: plan.stats?.customerSatisfaction || null,
            entityRuleStats: plan.stats?.entityRuleStats || null
        },
        solverMeta: {
            startingStrategy: winner.strategy,
            startingScore: winner.score,
            finalScore: winner.score,
            improvementPct: strategyResults.length > 1
                ? Math.round(((winner.score - strategyResults[strategyResults.length - 1].score) / Math.abs(strategyResults[strategyResults.length - 1].score || 1)) * 100)
                : 0,
            iterations: numStrategies,
            accepted: strategyResults.length,
            rejected: numStrategies - strategyResults.length,
            improved: 0,
            totalDurationMs: totalDuration,
            pass1Moves: pass1Result.squadMoves?.length || 0,
            pass25Moves: pass25Result.microMoves?.length || 0,
            crossSquadCount: plan.stats?.crossSquadCount || 0,
            strategiesEvaluated: strategyResults.length
        },
        constraintBindings: null
    };
}

// SA-based solver (kept but not used in production — causes memory exhaustion)
export async function runOptimizationSolver({ projects, slotMap, resources, config, saOptions = {}, onProgress }) {
    const solverStart = performance.now();
    const progress = onProgress || (() => { });

    // Phase 1: Multi-strategy initialization
    progress(2, 'Preparing strategies...');
    await yieldToUI();
    const strategies = await generateInitialStrategies(projects, slotMap, resources, config, progress);

    if (strategies.length === 0) {
        console.error('[SOLVER] All strategies failed');
        return null;
    }

    // Select best starting strategy
    strategies.sort((a, b) => b.score - a.score);
    const bestStrategy = strategies[0];

    // Phase 2: Simulated annealing refinement
    progress(28, 'Starting simulated annealing...');
    await yieldToUI();
    const saResult = await simulatedAnnealing(
        bestStrategy.plan,
        resources,
        config,
        saOptions,
        progress
    );

    // Phase 3: Post-SA resource assignment (since we skipped during strategy gen)
    progress(82, 'Assigning resources to best plan...');
    await yieldToUI();
    if (resources.length > 0) {
        const assignResult = await assignResources(
            saResult.bestPlan.scheduled, resources, config, saResult.bestPlan.warnings || []
        );
        saResult.bestPlan.stats = {
            ...saResult.bestPlan.stats,
            rolesFilled: assignResult.rolesFilled || 0,
            rolesNeeded: assignResult.rolesNeeded || 0,
            programAssignments: assignResult.programAssignments || 0
        };
    }
    await yieldToUI();

    // Phase 4: Post-processing (async with yields to prevent crash)
    progress(88, 'Analyzing concurrency constraints...');
    await yieldToUI();

    // Compute improvement percentage
    const improvement = bestStrategy.score > 0
        ? ((saResult.bestScore - bestStrategy.score) / bestStrategy.score * 100).toFixed(1)
        : 0;

    // Build constraint binding analysis for LLM (async to prevent crash)
    const constraintBindings = await analyzeConstraintBindings(saResult.bestPlan, resources, config, progress);

    progress(95, 'Finalizing results...');
    await yieldToUI();

    return {
        bestPlan: saResult.bestPlan,
        bestScore: saResult.bestScore,
        strategies: strategies.map(s => ({
            strategy: s.strategy,
            label: s.label,
            score: s.score,
            breakdown: s.breakdown,
            isWinner: s.strategy === bestStrategy.strategy
        })),
        convergence: saResult.convergenceHistory,
        solverMeta: {
            startingStrategy: bestStrategy.strategy,
            startingScore: bestStrategy.score,
            finalScore: saResult.bestScore,
            improvementPct: parseFloat(improvement),
            ...saResult.saStats,
            totalDurationMs: Math.round(performance.now() - solverStart)
        },
        constraintBindings
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSTRAINT BINDING ANALYSIS (for LLM integration)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Analyze which constraints are "binding" (at limit) to feed to the LLM
 * for intelligent constraint-relaxation suggestions.
 */
async function analyzeConstraintBindings(plan, resources, config, onProgress) {
    const progress = onProgress || (() => { });
    const bindings = {
        concurrencyAtLimit: [],
        resourcesAtCapacity: [],
        squadAffinityBroken: [],
        deferredHighValue: []
    };

    // 1. Customers at concurrency limit
    progress(89, 'Analyzing concurrency limits...');
    const customerProjects = {};
    plan.scheduled.forEach(p => {
        const c = p.customer || '';
        if (!c) return;
        if (!customerProjects[c]) customerProjects[c] = [];
        customerProjects[c].push({
            start: new Date(p.proposedStart || p.start || p.kickOff),
            end: new Date(p.proposedEnd || p.end || p.launch)
        });
    });

    Object.entries(customerProjects).forEach(([customer, projs]) => {
        const maxC = config.perCustomerOverrides?.[customer]?.max || config.maxConcurrentCountries || 10;
        const events = [];
        projs.forEach(p => {
            events.push({ t: p.start.getTime(), d: 1 });
            events.push({ t: p.end.getTime(), d: -1 });
        });
        events.sort((a, b) => a.t - b.t || a.d - b.d);
        let running = 0, peak = 0;
        events.forEach(e => { running += e.d; if (running > peak) peak = running; });
        if (peak >= maxC) {
            bindings.concurrencyAtLimit.push({
                customer,
                current: peak,
                limit: maxC,
                totalProjects: projs.length
            });
        }
    });

    await yieldToUI();

    // 2. Resources at or near 100%
    progress(91, 'Analyzing resource capacity...');
    const resourceLoad = {};
    plan.scheduled.forEach(p => {
        (p.assignments || []).forEach(a => {
            if (a.resourceId) {
                if (!resourceLoad[a.resourceId]) {
                    resourceLoad[a.resourceId] = {
                        name: a.resourceName,
                        load: 0,
                        projects: []
                    };
                }
                resourceLoad[a.resourceId].load += (a.allocationPct || 100) / 100;
                resourceLoad[a.resourceId].projects.push(p.name);
            }
        });
    });
    Object.entries(resourceLoad).forEach(([id, data]) => {
        if (data.load >= 1.0) {
            bindings.resourcesAtCapacity.push({
                resourceId: id,
                resourceName: data.name,
                load: Math.round(data.load * 100),
                projectCount: data.projects.length
            });
        }
    });

    await yieldToUI();

    // 3. Customer-squad affinity violations
    progress(93, 'Analyzing squad affinity...');
    const customerSquads = {};
    plan.scheduled.forEach(p => {
        const c = p.customer || '';
        if (!c) return;
        if (!customerSquads[c]) customerSquads[c] = new Set();
        (p.assignments || []).forEach(a => {
            if (Array.isArray(a.resourceSquads)) a.resourceSquads.forEach(s => customerSquads[c].add(s));
        });
    });
    const maxSq = config.maxSquadsPerCustomer || 2;
    Object.entries(customerSquads).forEach(([customer, squads]) => {
        if (squads.size > maxSq) {
            bindings.squadAffinityBroken.push({
                customer,
                squads: [...squads],
                limit: maxSq,
                excess: squads.size - maxSq
            });
        }
    });

    await yieldToUI();

    // 4. High-value deferred projects
    progress(94, 'Identifying deferred high-value projects...');
    plan.deferred
        .filter(p => (p._reprioritization?.score || 0) > 50 || (p.arr || 0) > 50000)
        .sort((a, b) => (b._reprioritization?.score || 0) - (a._reprioritization?.score || 0))
        .slice(0, 5)
        .forEach(p => {
            bindings.deferredHighValue.push({
                name: p.name,
                customer: p.customer,
                score: p._reprioritization?.score,
                arr: p.arr,
                reason: p.deferralReason
            });
        });

    return bindings;
}

/**
 * Build enhanced AI payload that includes solver metadata and constraint bindings.
 * This augments the existing buildAIInsightsPayload with solver-specific data.
 */
export function buildSolverAIPayload(solverResult) {
    if (!solverResult) return null;

    const meta = solverResult.solverMeta || {};

    return {
        solver: 'multi_start_greedy',
        strategiesEvaluated: meta.strategiesEvaluated ?? (solverResult.strategies?.length || 0),
        durationMs: meta.totalDurationMs || 0,
        bestScore: solverResult.bestScore,
        improvement: `${meta.improvementPct || 0}%`,
        startingStrategy: meta.startingStrategy,
        strategiesExplored: solverResult.strategies?.map(s => ({
            name: s.label,
            score: s.score,
            isWinner: s.isWinner
        })),
        constraintBindings: solverResult.constraintBindings,
        greedyStats: {
            pass1Moves: meta.pass1Moves || 0,
            pass25Moves: meta.pass25Moves || 0,
            crossSquadCount: meta.crossSquadCount || 0
        }
    };
}
