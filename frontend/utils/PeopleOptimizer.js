/**
 * PeopleOptimizer - Generates resource assignment recommendations
 * Matches projects to specific people based on role, capacity, and skills
 * Enhanced for AI Optimiser with priority and buffer awareness
 */

/**
 * People assignment recommendation type
 * @typedef {Object} AssignmentRecommendation
 * @property {string} projectId - Project ID
 * @property {string} projectName - Project name
 * @property {string} role - Role needed (PM, SC, PD)
 * @property {string} resourceId - Recommended resource ID
 * @property {string} resourceName - Recommended resource name
 * @property {number} allocationPct - Suggested allocation %
 * @property {number} hoursPerWeek - Estimated hours/week
 * @property {number} currentLoad - Current utilization % of resource
 * @property {number} resultLoad - Utilization % after assignment
 * @property {string} reason - Logic for selection
 * @property {number} score - Fit score (0-100)
 */

/**
 * Generate people assignment recommendations
 * @param {Array} projects - Projects needing resources
 * @param {Array} resources - Available resources with capacity data
 * @param {Object} config - Configuration options matching OptimizationModal
 * @returns {AssignmentRecommendation[]} - List of recommendations
 */
export const generatePeopleAssignments = (projects, resources, config = {}) => {
    const {
        paramRole = null,
        matchSquad = true,
        // AI Optimiser Parameters
        priorityDial = 50,      // 0=Max Util, 100=Stability/Schedule
        capacityBuffer = 0,     // e.g. 20% buffer means max util target is 80%
        allowSquadMoves = true  // Cross-squad allowed
    } = config;

    // Derived Targets based on Priority Dial
    // High Priority (Schedule) -> Willing to overwork slightly or find BEST person regardless of load? 
    // Actually: High Schedule Priority usually means "Get it done", so we might accept higher util.
    // Low Priority (Max Util) -> Pack them full.

    // Target Utilization Calculation:
    // Base is 100%. Buffer reduces it.
    // Example: Buffer 20% -> Target Max 0.8
    const effectiveMaxUtil = 1.0 - (capacityBuffer / 100);

    // "Sweet Spot" Target:
    // If Priority is "Max Util" (0), aim for effectiveMaxUtil (pack tight).
    // If Priority is "Balanced" (50), aim for 85% of effectiveMaxUtil (comfortable).
    // If Priority is "Stability" (100), aim for 75% (slack).
    const sweetnessFactor = 1.0 - (priorityDial / 200); // 0->1.0, 50->0.75, 100->0.5 (Too aggressive, let's tune)
    // 0 -> 0.95, 50 -> 0.85, 100 -> 0.75
    const targetSweetSpot = effectiveMaxUtil * (0.95 - (priorityDial / 400));

    const recommendations = [];

    // Filter projects that start in the future or are active
    const activeProjects = projects.filter(p => !p.status?.toLowerCase().includes('closed'));

    // Filter resources - be more lenient (accept resources without effectiveHours)
    const validResources = resources.filter(r => r.name && (r.effectiveHours > 0 || r.effectiveHours === undefined));

    activeProjects.forEach(project => {
        // Determine needed roles
        const neededRoles = determineNeededRoles(project);

        neededRoles.forEach(req => {
            const roleRecs = findBestResource(
                project,
                req.role,
                req.pct,
                validResources,
                {
                    matchSquad,
                    enableCrossSquad: allowSquadMoves,
                    maxUtilization: effectiveMaxUtil,
                    targetUtil: targetSweetSpot,
                    priorityDial
                }
            );

            if (roleRecs) {
                recommendations.push(roleRecs);
                // Temporarily "book" this resource
                roleRecs.resource._tempBooked = (roleRecs.resource._tempBooked || 0) + req.pct;
            }
        });
    });

    return recommendations;
};

/**
 * Helper to identify role gaps - simplified to suggest for any missing assignment
 */
const determineNeededRoles = (project) => {
    const needed = [];
    const roles = ['PM', 'SC', 'PD'];

    roles.forEach(role => {
        const key = role.toLowerCase();

        // Check multiple possible field names for assignments
        const assignmentFields = [
            project.team?.[key],
            project[`${key}Allocation`],
            project[`${key}Assignment`],
            project[key]
        ];

        // Check if any assignment field has a valid value
        const hasAssignment = assignmentFields.some(field => {
            if (!field) return false;
            if (Array.isArray(field)) return field.length > 0 && !field.some(a =>
                a.name === 'Unassigned' || a.id?.includes('unassigned') || a.name === 'TBC'
            );
            return field !== 'Unassigned' && field !== 'TBC';
        });

        if (!hasAssignment) {
            needed.push({ role, pct: 100 });
        }
    });
    return needed;
};

/**
 * Find best resource for a specific project requirement
 */
const findBestResource = (project, role, pctNeeded, resources, options) => {
    // 1. Filter by Role match
    const roleCandidates = resources.filter(r => {
        const rRole = (r.role || r.adJobTitle || '').toUpperCase();
        // Loose matching
        if (role === 'PM') return rRole.includes('MANAGER') || rRole.includes('PM');
        if (role === 'SC') return rRole.includes('CONSULTANT') || rRole.includes('SC') || rRole.includes('LIBRARY');
        if (role === 'PD') return rRole.includes('DIRECTOR') || rRole.includes('PD');
        return false;
    });

    if (roleCandidates.length === 0) return null;

    // 2. Score candidates
    const scored = roleCandidates.map(r => {
        let score = 0;
        const currentUtil = (r.details?.utilization || 0) + (r._tempBooked ? r._tempBooked / 100 : 0);
        const loadToAdd = pctNeeded / 100;
        const newUtil = currentUtil + loadToAdd;

        // Hard Constraint: Absolute Max Capacity (including buffer)
        // If Priority is "Max Slots" (0), we might allow slight overage (110%)?
        // Let's strict limit at 1.0 baseline unless overstaff explicitly allowed (not passed here yet)
        if (newUtil > 1.2) return null; // Hard cap at 120% always
        if (newUtil > options.maxUtilization && options.priorityDial > 20) return null; // Respect buffer unless aggressive

        // Factor 1: Squad Match (Weighted by Priority)
        // If Stability (High Dial) -> Squad Match is Critical
        // If Max Slots (Low Dial) -> Squad Match is nice but secondary to utilization
        const pSquads = project.squads || [];
        const rSquads = r.squads || [];
        const inSquad = pSquads.some(ps => rSquads.includes(ps));

        const squadWeight = 50 + (options.priorityDial / 2); // 50 to 100 pts
        if (inSquad) {
            score += squadWeight;
        } else {
            if (!options.enableCrossSquad) return null;
            // Cross-squad penalty
            score -= 20;
        }

        // Factor 2: Utilization Fit ("Sweet Spot")
        const distToTarget = Math.abs(options.targetUtil - newUtil);
        // Closer to target is better.
        // If Priority = Max Utilization, we want newUtil to be HIGH.
        // If Priority = Stability, we want newUtil to be LOW/Safe.

        let utilScore = (1 - distToTarget) * 40; // Base 40 pts
        score += utilScore;

        // Factor 3: Skills / Seniority (Stubbed)
        // Future: Check skill overlap

        return {
            resource: r,
            score,
            currentUtil,
            newUtil
        };
    }).filter(x => x !== null);

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
        const best = scored[0];
        return {
            projectId: project.id,
            projectName: project.name,
            role: role,
            resourceId: best.resource.id,
            resourceName: best.resource.name,
            allocationPct: pctNeeded,
            hoursPerWeek: 40 * (pctNeeded / 100),
            currentLoad: Math.round(best.currentUtil * 100),
            resultLoad: Math.round(best.newUtil * 100),
            reason: `Best fit (Sc: ${Math.round(best.score)}) - ${best.resource.squads?.[0] || 'Pool'}`,
            score: Math.round(best.score),
            resource: best.resource
        };
    }

    return null;
};

export default { generatePeopleAssignments };
