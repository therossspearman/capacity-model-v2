/**
 * AllocationRecommender - Generates prescriptive allocation percentage adjustments
 * Analyzes bottleneck weeks and suggests redistribution to resolve over-capacity
 */

/**
 * Allocation recommendation type
 * @typedef {Object} AllocationRecommendation
 * @property {string} projectId - Project ID to adjust
 * @property {string} projectName - Project name for display
 * @property {string} role - Role to adjust (PM, SC, PD)
 * @property {number} currentPct - Current allocation percentage
 * @property {number} suggestedPct - Recommended allocation percentage
 * @property {string} reason - Explanation for the recommendation
 * @property {number} impactHours - Hours freed up per week
 * @property {string} bottleneckWeek - Week key where bottleneck was detected
 * @property {number} severity - 1-10 severity score
 */

/**
 * Analyze slot utilization and identify bottleneck weeks
 * @param {Object} slotMap - Slot availability map { squad: { week: { score, demand, capacity } } }
 * @param {Array} enabledSquads - List of enabled squad names
 * @returns {Array} - Array of bottleneck weeks sorted by severity
 */
export function detectBottlenecks(slotMap, enabledSquads = []) {
    const bottlenecks = [];

    if (!slotMap) return bottlenecks;

    const squadsToCheck = enabledSquads.length > 0
        ? enabledSquads
        : Object.keys(slotMap);

    squadsToCheck.forEach(squad => {
        const weeks = slotMap[squad];
        if (!weeks) return;

        Object.entries(weeks).forEach(([weekKey, weekData]) => {
            // Calculate utilization for this week
            const demand = weekData.demand || weekData.totalDemand || 0;
            const capacity = weekData.capacity || weekData.totalCapacity || 40; // Default 40hrs/week
            const utilizationPct = capacity > 0 ? (demand / capacity) * 100 : 0;

            // Bottleneck if over 100% utilization
            if (utilizationPct > 100) {
                const overflowHours = demand - capacity;
                const severity = Math.min(10, Math.ceil((utilizationPct - 100) / 10));

                bottlenecks.push({
                    squad,
                    weekKey,
                    utilizationPct: Math.round(utilizationPct),
                    overflowHours: Math.round(overflowHours * 10) / 10,
                    demand: Math.round(demand * 10) / 10,
                    capacity: Math.round(capacity * 10) / 10,
                    severity,
                    projects: weekData.projects || []
                });
            }
        });
    });

    // Sort by severity (highest first), then by week
    return bottlenecks.sort((a, b) => {
        if (b.severity !== a.severity) return b.severity - a.severity;
        return a.weekKey.localeCompare(b.weekKey);
    });
}

/**
 * Generate allocation recommendations to resolve bottlenecks
 * @param {Object} slotMap - Slot availability map
 * @param {Array} projects - All projects with team allocations
 * @param {Array} resources - All resources (for capacity info)
 * @param {Object} config - Configuration options
 * @returns {AllocationRecommendation[]} - List of allocation recommendations
 */
export function generateAllocationRecommendations(slotMap, projects, resources = [], config = {}) {
    const {
        targetUtilization = 85, // Target utilization % after adjustments
        minAllocation = 20,     // Minimum allocation % to suggest
        maxReductions = 5       // Max recommendations to generate
    } = config;

    // Step 1: Detect bottlenecks
    const bottlenecks = detectBottlenecks(slotMap, config.enabledSquads);

    if (bottlenecks.length === 0) {
        return [];
    }

    const recommendations = [];
    // Track projects already recommended so a project active in multiple
    // bottleneck weeks is not recommended (and its hours double-counted) more than once.
    const recommendedProjectIds = new Set();

    // Step 2: For each bottleneck, find projects that could be reduced
    for (const bottleneck of bottlenecks) {
        if (recommendations.length >= maxReductions) break;

        // Find projects active during this week
        const activeProjects = projects.filter(p => {
            if (!p.kickOff && !p.start) return false;
            if (!p.launch && !p.end) return false;

            const pStart = new Date(p.kickOff || p.start);
            const pEnd = new Date(p.launch || p.end);

            // Parse week key to date (assume YYYY-WXX format or ISO date)
            const weekDate = parseWeekKey(bottleneck.weekKey);
            if (!weekDate) return false;

            return pStart <= weekDate && weekDate <= pEnd;
        });

        // Sort by flexibility (prefer projects without locks)
        const sortedProjects = activeProjects.sort((a, b) => {
            // Prefer unlocked projects
            const aLocked = a.lockResources || a.lockLaunch || a.lockSquad;
            const bLocked = b.lockResources || b.lockLaunch || b.lockSquad;
            if (aLocked !== bLocked) return aLocked ? 1 : -1;

            // Prefer lower priority projects
            const aPriority = a.priority || 50;
            const bPriority = b.priority || 50;
            return bPriority - aPriority;
        });

        // Calculate reduction needed
        const reductionNeeded = bottleneck.overflowHours;
        let reductionAchieved = 0;

        for (const project of sortedProjects) {
            if (reductionAchieved >= reductionNeeded) break;
            if (recommendations.length >= maxReductions) break;

            // Skip projects already recommended for an earlier bottleneck
            if (recommendedProjectIds.has(project.id)) continue;

            // Get current allocation (default to 100%)
            const currentPct = project.team?.allocation || 100;

            // Skip if already at minimum
            if (currentPct <= minAllocation) continue;

            // Calculate suggested reduction (aim for 20% reduction max per project)
            const maxReductionPct = Math.min(20, currentPct - minAllocation);
            const hoursPerPctPoint = bottleneck.capacity / 100;
            const pctNeeded = Math.ceil(reductionNeeded / hoursPerPctPoint);
            const suggestedReduction = Math.min(maxReductionPct, pctNeeded);
            const suggestedPct = currentPct - suggestedReduction;

            if (suggestedPct < minAllocation) continue;

            const hoursSaved = suggestedReduction * hoursPerPctPoint;
            reductionAchieved += hoursSaved;
            recommendedProjectIds.add(project.id);

            recommendations.push({
                projectId: project.id,
                projectName: project.name || project.projectName || 'Unknown',
                role: 'All', // Could be role-specific in future
                currentPct,
                suggestedPct: Math.round(suggestedPct),
                reason: `Reduce allocation to relieve bottleneck in week ${formatWeekKey(bottleneck.weekKey)} (${bottleneck.utilizationPct}% utilized)`,
                impactHours: Math.round(hoursSaved * 10) / 10,
                bottleneckWeek: bottleneck.weekKey,
                severity: bottleneck.severity,
                squad: bottleneck.squad
            });
        }
    }

    return recommendations;
}

/**
 * Parse week key to Date object
 * Supports formats: YYYY-WXX, YYYY-MM-DD, ISO week strings
 */
function parseWeekKey(weekKey) {
    if (!weekKey) return null;

    // Try ISO date format first
    const isoDate = new Date(weekKey);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Try YYYY-WXX format
    const weekMatch = weekKey.match(/^(\d{4})-W(\d{1,2})$/);
    if (weekMatch) {
        const year = parseInt(weekMatch[1]);
        const week = parseInt(weekMatch[2]);
        const jan1 = new Date(year, 0, 1);
        const days = (week - 1) * 7;
        return new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000);
    }

    return null;
}

/**
 * Format week key for display
 */
function formatWeekKey(weekKey) {
    const date = parseWeekKey(weekKey);
    if (!date) return weekKey;

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Calculate potential impact of applying all recommendations
 */
export function calculateRecommendationImpact(recommendations) {
    const totalHoursSaved = recommendations.reduce((sum, r) => sum + r.impactHours, 0);
    const uniqueProjects = new Set(recommendations.map(r => r.projectId)).size;
    const avgSeverity = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.severity, 0) / recommendations.length
        : 0;

    return {
        totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
        projectsAffected: uniqueProjects,
        bottlenecksAddressed: [...new Set(recommendations.map(r => r.bottleneckWeek))].length,
        avgSeverity: Math.round(avgSeverity * 10) / 10
    };
}

export default {
    detectBottlenecks,
    generateAllocationRecommendations,
    calculateRecommendationImpact
};
