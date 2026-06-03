/**
 * PortfolioReprioritizer.js
 * ═══════════════════════════════════════════════════════════════════════════
 * AI Portfolio Reprioritization Engine
 * 
 * Tiered scoring and scheduling engine for portfolio replanning.
 * 
 * Guiding Principles:
 * 1. Protect cornerstone projects (strategic migrations)
 * 2. Protect partner deals
 * 3. Distribute work proportionally across customers
 * 4. Minimize pausing in-flight projects
 * 5. Prioritize by cARR, compelling events, and customer risk
 * 
 * Scoring Tiers (0-100):
 *   Tier 1: Cornerstone (90-100) - User-selected strategic accounts
 *   Tier 2a: Partner Deals (80-89)
 *   Tier 2b: High Risk (80-88)
 *   Tier 2d: Verbal Risk (70-79)
 *   Tier 2e: Medium Risk (65-74)
 *   Tier 2f: Compelling Event (80-88) - Urgency-scaled, same range as High Risk
 *   Tier 2f: New Customer w/ Event (80-88) - same as existing compelling
 *   Tier 4: Net New / Upsells (30-54) - cARR-scaled
 *   Excluded: Served Notice (score = 0)
 *   Below Threshold: < configurable min cARR (0-29)
 * 
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Yield control back to the browser so the UI stays responsive
const yieldToUI = () => new Promise(r => setTimeout(r, 16)); // One frame at 60fps — prevents Chrome from killing the extension

// ─────────────────────────────────────────────────────────────────────────────
// Hours-based demand: compute average profile factor and weekly demand hours
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Average demand multiplier for an effort profile over the full project duration.
 * Front/back/bell curves integrate to the same total hours — they only shift *when*
 * hours are consumed, so the average is ~1. FPS is lower because post-close demand
 * drops to near-zero for 6 weeks.
 */
function getAverageProfileFactor(effortProfile) {
    if (!effortProfile) return 1;
    const prof = effortProfile.toLowerCase();
    if (prof.includes('fps')) return 0.85;
    // front, back, bell, role-specific, domestic, flat — all average to ~1
    return 1;
}

/**
 * Peak demand multiplier for effort profiles.
 * Front-loaded profiles consume significantly more hours in early weeks,
 * so we need to check capacity against peak (not average) demand.
 * This prevents scheduling front-loaded projects into already-busy windows.
 */
function getPeakProfileFactor(effortProfile) {
    if (!effortProfile) return 1;
    const prof = effortProfile.toLowerCase();
    if (prof.includes('front')) return 1.6;  // 60% above average during peak
    if (prof.includes('bell')) return 1.3;   // 30% above average during peak
    if (prof.includes('fps')) return 1.4;    // FPS has intense early phase
    if (prof.includes('back')) return 1.2;   // Back-loaded has mild early, steep late
    return 1; // Flat or unknown
}

/**
 * Build a squad→groupId lookup from mergeGroups config.
 * Squads in the same merge group share the same groupId, meaning
 * they're treated as one pool for resourcing and NOT considered cross-squad.
 *
 * @param {Array<Array<string>>} mergeGroups - Array of squad name arrays
 * @returns {{ lookup: Object, areInSameGroup: Function }}
 */
function buildMergeLookup(mergeGroups) {
    const lookup = {}; // squadName → groupId
    if (mergeGroups && Array.isArray(mergeGroups)) {
        mergeGroups.forEach((group, idx) => {
            const members = Array.isArray(group) ? group : [...group];
            members.forEach(sq => { lookup[sq] = `mg_${idx}`; });
        });
    }
    return {
        lookup,
        /** Check if two squad arrays share a merge group (or direct overlap) */
        areInSameGroup: (squadsA, squadsB) => {
            if (!squadsA?.length || !squadsB?.length) return false;
            // Direct overlap
            if (squadsA.some(s => squadsB.includes(s))) return true;
            // Merge group overlap
            for (const sA of squadsA) {
                const gA = lookup[sA];
                if (!gA) continue;
                for (const sB of squadsB) {
                    if (lookup[sB] === gA) return true;
                }
            }
            return false;
        }
    };
}

/**
 * Calculate average weekly demand in hours for a project+role.
 * Uses real effort data (pmEffort/scEffort/pdEffort) and effort profile.
 * Returns hours/week that this role consumes on average.
 */
const _demandCache = new Map(); // Memoization: "projectId::role" → hours
function calculateWeeklyDemandHours(project, role) {
    const cacheKey = `${project.id}::${role}`;
    if (_demandCache.has(cacheKey)) return _demandCache.get(cacheKey);

    const effortKey = `${role.toLowerCase()}Effort`; // pmEffort, scEffort, pdEffort
    const rawEffort = project[effortKey] || 0;
    // Airtable stores effort in SECONDS — convert to hours
    // Use duration-based heuristic: if rawEffort / durationWeeks > 80h/wk, it's likely seconds
    const durationWeeksEst = project.durationWeeks || 26;
    const asHoursPerWeek = rawEffort / durationWeeksEst;
    const totalHours = asHoursPerWeek > 80 ? rawEffort / 3600 : rawEffort;
    if (totalHours <= 0) { _demandCache.set(cacheKey, 0); return 0; }

    const durationWeeks = project.durationWeeks || (() => {
        const s = project.start || project.kickOff;
        const e = project.end || project.launch;
        if (s && e) return Math.max(1, Math.round((new Date(e) - new Date(s)) / (7 * 24 * 60 * 60 * 1000)));
        return 26; // default ~6 months
    })();

    const profileFactor = getAverageProfileFactor(project.effortProfile);
    const result = (totalHours / durationWeeks) * profileFactor;
    _demandCache.set(cacheKey, result);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status filter: statuses that exclude a project from reprioritization scope
// ─────────────────────────────────────────────────────────────────────────────
const EXCLUDED_STATUSES = [
    'closed',
    'cancelled',
    'in hypercare',
    'on hold'
];

// ─────────────────────────────────────────────────────────────────────────────
// In-flight statuses that get protection bonus and reduced shift allowance
// ─────────────────────────────────────────────────────────────────────────────
const IN_FLIGHT_STATUSES = [
    'in progress',
    'in flight',
    'kick off',
    'kicked off',
    'build',
    'uat',
    'parallel run'
];

// ─────────────────────────────────────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    cornerstoneCustomers: [],        // Array of customer names (case-insensitive match)
    partnerCustomers: [],            // Array of partner customer names
    minConcurrentCountries: 1,       // Min distinct countries per customer running concurrently
    maxConcurrentCountries: 10,      // Ideal max distinct countries per customer running concurrently
    minCarrThreshold: 0,             // Minimum cARR (£) — below this = deprioritized
    cornerstoneMaxShiftWeeks: 8,     // Cornerstone projects: max date shift (±weeks)
    defaultMaxShiftWeeks: 26,         // Non-inflight projects: generous shift allowance
    inFlightMaxShiftWeeks: 4,        // In-flight projects: tight shift (separate from default)
    inFlightScoreBonus: 5,           // Bonus score points for in-flight projects
    perCustomerOverrides: {},        // { customerName: { min: N, max: M } }
    constraintHorizon: null,         // ISO date string — concurrency limits only apply before this date
    cascadeOverlapWeeks: 0           // Weeks of allowed overlap between sequential countries (0 = strict sequential)
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: days between two dates
// ─────────────────────────────────────────────────────────────────────────────
function daysBetween(dateA, dateB) {
    if (!dateA || !dateB) return Infinity;
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.round((b - a) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: clamp value between min and max
// ─────────────────────────────────────────────────────────────────────────────
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: normalize a value to a range
// ─────────────────────────────────────────────────────────────────────────────
function normalize(val, minVal, maxVal, outMin, outMax) {
    if (maxVal === minVal) return (outMin + outMax) / 2;
    const pct = clamp((val - minVal) / (maxVal - minVal), 0, 1);
    return outMin + pct * (outMax - outMin);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: case-insensitive customer name match (exact match, not substring)
// ─────────────────────────────────────────────────────────────────────────────
function customerMatch(projectCustomer, customerList) {
    if (!projectCustomer || !customerList?.length) return false;
    const lower = projectCustomer.toLowerCase().trim();
    return customerList.some(c => lower === c.toLowerCase().trim());
}

// ═════════════════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Score a single project based on the tiered prioritization system.
 * Returns { score, tier, tierLabel, reasoning }
 */
export function scoreProject(project, config, stats) {
    const { cornerstoneCustomers, partnerCustomers, minCarrThreshold } = config;
    const arr = project.arr || project.transactionalBenefits || 0;
    const contractArr = project.contractArr || 0;
    const contractArrWeight = config.contractArrWeight ?? 0.3;
    const projectArrWeight = 1 - contractArrWeight;
    // Blended ARR: weight project cARR more than contract cARR
    // Falls back to 100% project cARR when contractArr is 0
    const blendedArr = contractArr > 0
        ? (arr * projectArrWeight + contractArr * contractArrWeight)
        : arr;
    const risk = (project.customerRisk || '').toLowerCase().trim();
    const hasCompellingEvent = !!project.compellingEventDate;
    const status = (project.status || '').toLowerCase().trim();
    const isInFlight = IN_FLIGHT_STATUSES.some(s => status.includes(s));
    const customer = project.customer || '';

    // Lock fields (consistent with SlotOptimizer.js and OptimizationModal.jsx)
    const isLaunchLocked = !!project.lockLaunch;
    const isSquadLocked = !!project.lockSquad;
    const isResourcesLocked = !!project.lockResources;
    const isFullyLocked = isLaunchLocked && isSquadLocked;

    let score = 0;
    let tier = 5;
    let tierLabel = 'Unscored';
    let reasoning = [];
    let baseScore = 0;
    let tierRange = [0, 0];
    let inFlightBonus = 0;
    let scoringBasis = 'cARR';

    // ── Tier check: Served Notice → Excluded ──
    if (risk === 'served notice') {
        return {
            score: 0,
            tier: -1,
            tierLabel: 'Excluded (Served Notice)',
            reasoning: ['Customer has served notice — project excluded from reprioritization scope.'],
            isExcluded: true,
            maxShiftWeeks: 0
        };
    }

    // ── Tier 1: Cornerstone ──
    if (customerMatch(customer, cornerstoneCustomers)) {
        score = normalize(blendedArr, 0, stats.maxBlendedArr, 90, 100);
        baseScore = score;
        tierRange = [90, 100];
        tier = 1;
        tierLabel = 'Cornerstone';
        reasoning.push(`Strategic account: "${customer}".`);
        reasoning.push(`cARR £${arr.toLocaleString()}${contractArr > 0 ? ` (contract £${contractArr.toLocaleString()}, blended £${Math.round(blendedArr).toLocaleString()})` : ''} scales score within tier.`);
    }
    // ── Tier 2a: Partner Deals ──
    else if (customerMatch(customer, partnerCustomers)) {
        score = normalize(blendedArr, 0, stats.maxBlendedArr, 80, 89);
        baseScore = score;
        tierRange = [80, 89];
        tier = 2;
        tierLabel = 'Partner Deal';
        reasoning.push(`Partner deal: "${customer}".`);
        reasoning.push(`Protected to maintain strategic partnership.${contractArr > 0 ? ` Contract cARR £${contractArr.toLocaleString()}.` : ''}`);
    }
    // ── Tier 2b: High Risk ──
    else if (risk === 'high') {
        score = normalize(blendedArr, 0, stats.maxBlendedArr, 80, 88);
        baseScore = score;
        tierRange = [80, 88];
        tier = 2;
        tierLabel = 'High Risk';
        reasoning.push(`Customer flagged as HIGH risk.`);
        reasoning.push(`Elevated priority to mitigate churn risk.${contractArr > 0 ? ` Contract cARR £${contractArr.toLocaleString()}.` : ''}`);
    }
    // ── Tier 2d: Verbal Risk ──
    else if (risk === 'verbal') {
        score = normalize(blendedArr, 0, stats.maxBlendedArr, 70, 79);
        baseScore = score;
        tierRange = [70, 79];
        tier = 2;
        tierLabel = 'Verbal Risk';
        reasoning.push(`Verbal churn signal received.`);
        reasoning.push(`Prioritized to address proactively before formal notice.${contractArr > 0 ? ` Contract cARR £${contractArr.toLocaleString()}.` : ''}`);
    }
    // ── Tier 2e: Medium Risk ──
    else if (risk === 'medium') {
        score = normalize(blendedArr, 0, stats.maxBlendedArr, 65, 74);
        baseScore = score;
        tierRange = [65, 74];
        tier = 2;
        tierLabel = 'Medium Risk';
        reasoning.push(`Customer flagged as MEDIUM risk.`);
        reasoning.push(`Moderate elevation to prevent escalation.${contractArr > 0 ? ` Contract cARR £${contractArr.toLocaleString()}.` : ''}`);
    }
    // ── Tier 2f / 3: Compelling Event ──
    else if (hasCompellingEvent) {
        const daysToEvent = daysBetween(new Date(), project.compellingEventDate);
        const urgency = clamp(1 - (daysToEvent / 365), 0, 1); // 0 = far away, 1 = imminent

        // Determine if this is an existing customer (has other projects) or new
        const isExistingCustomer = stats.customerProjectCounts[customer] > 1;

        if (isExistingCustomer) {
            // Tier 2f: Existing customer with compelling event — same range as High Risk
            score = normalize(urgency, 0, 1, 80, 88);
            baseScore = score;
            tierRange = [80, 88];
            scoringBasis = 'urgency';
            tier = 2;
            tierLabel = 'Compelling Event (Existing)';
            reasoning.push(`Compelling event: ${new Date(project.compellingEventDate).toLocaleDateString('en-GB')}.`);
            reasoning.push(`${daysToEvent} days remaining — urgency factor ${(urgency * 100).toFixed(0)}%.`);
        } else {
            // Tier 2f: New customer with compelling event — same range as High Risk
            score = normalize(urgency, 0, 1, 80, 88);
            baseScore = score;
            tierRange = [80, 88];
            scoringBasis = 'urgency';
            tier = 3;
            tierLabel = 'New Customer (Compelling Event)';
            reasoning.push(`New customer with compelling event: ${new Date(project.compellingEventDate).toLocaleDateString('en-GB')}.`);
            reasoning.push(`${daysToEvent} days remaining.`);
        }
    }
    // ── Tier 4: Net New / Upsells (cARR-scaled) ──
    else if (arr >= minCarrThreshold && minCarrThreshold > 0) {
        score = normalize(blendedArr, minCarrThreshold, stats.maxBlendedArr, 30, 54);
        baseScore = score;
        tierRange = [30, 54];
        tier = 4;
        tierLabel = risk === 'low' ? 'Low Risk (cARR)' : 'Net New / Upsell';
        reasoning.push(`cARR £${arr.toLocaleString()}${contractArr > 0 ? ` (contract £${contractArr.toLocaleString()}, blended £${Math.round(blendedArr).toLocaleString()})` : ''} (${((blendedArr / stats.maxBlendedArr) * 100).toFixed(0)}% of max).`);
        if (risk === 'low') reasoning.push(`Low risk — handled within standard cARR flow.`);
    }
    // ── Below threshold ──
    else if (minCarrThreshold > 0 && arr < minCarrThreshold) {
        score = normalize(arr, 0, minCarrThreshold, 0, 29);
        baseScore = score;
        tierRange = [0, 29];
        tier = 5;
        tierLabel = 'Below Threshold';
        reasoning.push(`cARR £${arr.toLocaleString()} is below minimum threshold of £${minCarrThreshold.toLocaleString()}.`);
        reasoning.push(`Candidate for deferral or descoping.`);
    }
    // ── Fallback: No risk, no event, no threshold set ──
    else {
        score = normalize(blendedArr, 0, stats.maxBlendedArr || 1, 30, 54);
        baseScore = score;
        tierRange = [30, 54];
        tier = 4;
        tierLabel = risk === 'low' ? 'Low Risk (cARR)' : 'Standard';
        reasoning.push(`Standard prioritization by cARR (£${arr.toLocaleString()}${contractArr > 0 ? `, contract £${contractArr.toLocaleString()}, blended £${Math.round(blendedArr).toLocaleString()}` : ''}).`);
    }

    // ── In-flight bonus ──
    if (isInFlight) {
        inFlightBonus = config.inFlightScoreBonus;
        score = Math.min(100, score + inFlightBonus);
        reasoning.push(`In-flight bonus (+${config.inFlightScoreBonus}pts): status "${project.status}".`);
    }

    // ── Determine max shift allowance (respecting lock fields) ──
    let maxShiftWeeks = config.defaultMaxShiftWeeks;

    // Exclusion date logic: projects after the exclusion date bypass the shift limit
    const projectLaunchDate = project.launch || project.start || project.end;
    const projectLaunchMs = projectLaunchDate ? new Date(projectLaunchDate).getTime() : 0;

    // Lock fields take precedence over all other shift rules
    if (isLaunchLocked) {
        maxShiftWeeks = 0;
        reasoning.push(`🔒 Launch date locked — project dates cannot be moved.`);
        if (isSquadLocked) reasoning.push(`🔒 Squad locked — assignment cannot change.`);
        if (isResourcesLocked) reasoning.push(`🔒 Resources locked — allocations cannot change.`);
    } else if (tier === 1) {
        // Check cornerstone exclusion date
        const csExcludeAfter = config.cornerstoneShiftExcludeAfter;
        if (csExcludeAfter && projectLaunchMs > new Date(csExcludeAfter).getTime()) {
            maxShiftWeeks = 52; // Effectively uncapped
            reasoning.push(`Cornerstone shift limit waived — project launches after exclusion date.`);
        } else {
            maxShiftWeeks = config.cornerstoneMaxShiftWeeks;
            reasoning.push(`Movement limited to ±${maxShiftWeeks} weeks (cornerstone protection).`);
        }
    } else if (isInFlight) {
        maxShiftWeeks = config.inFlightMaxShiftWeeks;
        reasoning.push(`Movement limited to ±${maxShiftWeeks} weeks (in-flight protection).`);
    } else {
        // Check default shift exclusion date
        const defExcludeAfter = config.defaultShiftExcludeAfter;
        if (defExcludeAfter && projectLaunchMs > new Date(defExcludeAfter).getTime()) {
            maxShiftWeeks = 52;
            reasoning.push(`Default shift limit waived — project launches after exclusion date.`);
        } else {
            reasoning.push(`Movement limited to ±${maxShiftWeeks} weeks.`);
        }
    }
    if (hasCompellingEvent) {
        // Compelling event constrains the end date, but start can shift
        const daysToEvent = daysBetween(project.launch || project.end, project.compellingEventDate);
        if (daysToEvent < 0) {
            reasoning.push(`⚠ Project currently scheduled AFTER compelling event date.`);
        }
    }

    // Non-launch locks: annotate but allow date shifts
    if (!isLaunchLocked) {
        if (isSquadLocked) reasoning.push(`🔒 Squad locked — assignment preserved.`);
        if (isResourcesLocked) reasoning.push(`🔒 Resources locked — allocations preserved.`);
    }

    return {
        score: Math.round(score * 10) / 10,
        tier,
        tierLabel,
        reasoning,
        scoreBreakdown: {
            baseScore: Math.round(baseScore * 10) / 10,
            tierRange,
            inFlightBonus,
            priorityBoost: 0,
            scoringBasis,
            contractArr: contractArr || 0,
            blendedArr: Math.round(blendedArr),
            finalScore: Math.round(score * 10) / 10
        },
        isExcluded: false,
        maxShiftWeeks,
        isInFlight,
        isLaunchLocked,
        isSquadLocked,
        isResourcesLocked,
        isFullyLocked
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// PORTFOLIO SCORING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Score the entire project portfolio.
 * 
 * @param {Array} projects - All projects from the data pipeline
 * @param {Object} config - Reprioritization configuration (merged with defaults)
 * @returns {Object} { scored, excluded, stats }
 */
export function scorePortfolio(projects, config = {}) {
    _demandCache.clear(); // Fix BUG-1: prevent stale cache from prior runs
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // ── Filter eligible projects ──
    const eligible = projects.filter(p => {
        const status = (p.status || '').toLowerCase().trim();
        return !EXCLUDED_STATUSES.some(s => status.includes(s));
    });

    const excluded = projects.filter(p => {
        const status = (p.status || '').toLowerCase().trim();
        return EXCLUDED_STATUSES.some(s => status.includes(s));
    });

    // ── Compute portfolio statistics for normalization ──
    const arrValues = eligible.map(p => p.arr || p.transactionalBenefits || 0).filter(v => v > 0);
    // Compute blended ARR values for normalization
    const contractArrWeight = config.contractArrWeight ?? 0.3;
    const projectArrWeight = 1 - contractArrWeight;
    const blendedArrValues = eligible.map(p => {
        const pArr = p.arr || p.transactionalBenefits || 0;
        const cArr = p.contractArr || 0;
        return cArr > 0 ? (pArr * projectArrWeight + cArr * contractArrWeight) : pArr;
    }).filter(v => v > 0);
    const customerProjectCounts = {};
    eligible.forEach(p => {
        const c = p.customer || 'Unknown';
        customerProjectCounts[c] = (customerProjectCounts[c] || 0) + 1;
    });

    const stats = {
        maxArr: Math.max(...arrValues, 1),
        maxBlendedArr: Math.max(...blendedArrValues, 1),
        minArr: Math.min(...arrValues, 0),
        avgArr: arrValues.length ? arrValues.reduce((a, b) => a + b, 0) / arrValues.length : 0,
        totalProjects: eligible.length,
        customerProjectCounts,
        uniqueCustomers: Object.keys(customerProjectCounts).length,
        totalArr: arrValues.reduce((a, b) => a + b, 0)
    };

    // ── Score each project ──
    const scored = eligible.map(project => {
        const result = scoreProject(project, cfg, stats);
        return {
            ...project,
            _reprioritization: result
        };
    });

    // Separate scored and served-notice excluded
    const servedNotice = scored.filter(p => p._reprioritization.isExcluded);
    const active = scored.filter(p => !p._reprioritization.isExcluded);

    // Sort by score descending
    active.sort((a, b) => b._reprioritization.score - a._reprioritization.score);

    return {
        scored: active,
        excluded: [...excluded.map(p => ({
            ...p,
            _reprioritization: {
                score: 0,
                tier: -1,
                tierLabel: `Excluded (${p.status})`,
                reasoning: [`Status "${p.status}" excludes project from reprioritization scope.`],
                isExcluded: true
            }
        })), ...servedNotice],
        stats: {
            ...stats,
            tierCounts: {
                cornerstone: active.filter(p => p._reprioritization.tier === 1).length,
                partnerAndRisk: active.filter(p => p._reprioritization.tier === 2).length,
                newWithEvent: active.filter(p => p._reprioritization.tier === 3).length,
                standard: active.filter(p => p._reprioritization.tier === 4).length,
                belowThreshold: active.filter(p => p._reprioritization.tier === 5).length,
                excluded: excluded.length + servedNotice.length
            }
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// RESOURCE ASSIGNMENT ENGINE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build role matchers that check roleMapping (primary + secondary/flex roles).
 * If a resource's job title maps to a primary role OR has the target role
 * as a secondary/flex role, they are eligible.
 */
export function buildRoleMatchers(config) {
    const mapping = config?.roleMapping || {};
    const roleConfig = config?.roleConfig || {};
    const hasMapping = mapping && Object.keys(mapping).length > 0;

    /**
     * Get all roles a resource can fill (primary + secondary).
     * roleMapping format: { 'Job Title': 'PM' | 'SC' | 'PD' | 'Other' }
     * roleConfig.jobs format: { 'Job Title': { primary: 'PM', secondary: ['SC'] } }
     */
    const getResourceRoles = (resource) => {
        const roles = new Set();
        const roleKey = resource.adJobTitle || resource.role || '';
        const roleUpper = roleKey.toUpperCase();

        // 1. Primary role from roleMapping (mirrors the role-mapping logic in useCapacityData.js)
        if (hasMapping && mapping) {
            const mapped = mapping[roleKey];
            if (mapped) {
                roles.add(mapped.toUpperCase());
            }
        }

        // 2. Primary + secondary from roleConfig.jobs
        if (roleConfig.jobs) {
            const jobEntry = roleConfig.jobs[roleKey] || roleConfig.jobs[resource.role] || roleConfig.jobs[resource.adJobTitle];
            if (jobEntry) {
                if (jobEntry.primary) roles.add(jobEntry.primary.toUpperCase());
                if (jobEntry.secondary) {
                    jobEntry.secondary.forEach(sr => roles.add(sr.toUpperCase()));
                }
            }
        }

        // 3. Fallback: if role field itself is PM/SC/PD, use that
        if (roles.size === 0) {
            if (['PM', 'SC', 'PD'].includes(roleUpper)) {
                roles.add(roleUpper);
            }
        }

        return roles;
    };

    return {
        PM: r => {
            const roles = getResourceRoles(r);
            if (roles.has('PM')) return true;
            // Last-resort string fallback
            const t = (r.role || r.adJobTitle || '').toUpperCase();
            return t === 'PM' || t.includes('PROJECT MANAGER');
        },
        SC: r => {
            const roles = getResourceRoles(r);
            if (roles.has('SC')) return true;
            const t = (r.role || r.adJobTitle || '').toUpperCase();
            return t === 'SC' || t.includes('SOLUTION CONSULTANT');
        },
        PD: r => {
            const roles = getResourceRoles(r);
            if (roles.has('PD') || roles.has('BUILD')) return true;
            const t = (r.role || r.adJobTitle || '').toUpperCase();
            return t === 'PD' || t.includes('PRODUCT DEVELOPER') || t === 'BUILD';
        }
    };
}

/**
 * Determine which roles are missing for a project.
 * @returns {Array<{role:string, pct:number}>}
 */
function determineProjectRoleGaps(project) {
    const gaps = [];
    const durationWeeks = project.durationWeeks || (() => {
        const s = project.start || project.kickOff;
        const e = project.end || project.launch;
        if (s && e) {
            const ms = new Date(e) - new Date(s);
            return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
        }
        return 26; // default ~6 months
    })();

    ['PM', 'SC', 'PD'].forEach(role => {
        const key = role.toLowerCase();
        const team = project.team?.[key];
        const hasAssignment = team && Array.isArray(team) && team.length > 0 &&
            !team.every(a => a.name === 'Unassigned' || a.name === 'TBC' || a.id?.includes('unassigned'));
        if (!hasAssignment) {
            // Calculate allocation from actual project effort hours
            const effortKey = `${key}Effort`; // pmEffort, scEffort, pdEffort
            const rawEffort = project[effortKey] || 0;
            // Airtable stores effort in SECONDS — convert to hours
            // Use duration-based heuristic (aligned with calculateWeeklyDemandHours)
            const durationWeeksEstGap = durationWeeks || 26;
            const asHpwGap = rawEffort / durationWeeksEstGap;
            const effortHours = asHpwGap > 80 ? rawEffort / 3600 : rawEffort;
            let totalPct;
            if (effortHours > 0 && durationWeeks > 0) {
                const weeklyHours = effortHours / durationWeeks;
                totalPct = Math.round((weeklyHours / 40) * 100); // 40hr standard week
                totalPct = Math.max(5, Math.min(200, totalPct)); // Clamp 5-200%
            } else {
                // Fallback if no effort data
                totalPct = role === 'SC' ? 35 : role === 'PM' ? 25 : 20;
            }

            // Fix #3: Multi-person roles — if allocation > 100%, split across multiple people
            const MAX_PER_PERSON = 100; // Max % a single person should take on one role
            if (totalPct > MAX_PER_PERSON) {
                const numPeople = Math.ceil(totalPct / MAX_PER_PERSON);
                const perPersonPct = Math.round(totalPct / numPeople);
                for (let i = 0; i < numPeople; i++) {
                    gaps.push({ role: `${role}${numPeople > 1 ? ` (${i + 1}/${numPeople})` : ''}`, pct: perPersonPct, _baseRole: role });
                }
            } else {
                gaps.push({ role, pct: totalPct, _baseRole: role });
            }
        }
    });
    return gaps;
}

/**
 * Score a candidate resource for a specific project+role assignment.
 * 
 * Scoring factors:
 *   - Role match (filtered before scoring, so always true)
 *   - Squad affinity: +50pts if resource shares squad with project
 *   - Utilization fit: up to +40pts based on proximity to 80% target
 *   - Customer-squad cohesion: +30pts if resource already works for this customer
 *   - Program specialist affinity:
 *       specialist + program project = +60pts (strong match)
 *       specialist + normal project  = -40pts (reserve them)
 *       non-specialist + program     = -10pts (fallback OK)
 *   - Program specialists are exempt from squad-mismatch penalty on program projects
 */
function scoreCandidateForRole(resource, project, config) {
    const programSpecialistIds = config.programSpecialistIds || [];
    const isSpecialist = programSpecialistIds.includes(resource.id);
    const isProgramProject = !!project.resourcedWithinProgram;
    const customerBookings = config._customerResourceMap || {};

    let score = 0;
    const reasons = [];

    // ── Leave date check (uses pre-computed timestamps from assignResources) ──
    const leaveDateMs = resource._leaveDateMs;
    if (leaveDateMs) {
        const nowMs = config._nowMs || Date.now();
        // Already departed — hard block
        if (leaveDateMs < nowMs) return null;

        // Check project timeline overlap
        const projEndMs = project._endMs || 0;
        const projStartMs = project._startMs || nowMs;
        if (projEndMs && leaveDateMs < projEndMs) {
            // Resource leaves before project ends
            const projDurationMs = projEndMs - projStartMs;
            const availableMs = leaveDateMs - projStartMs;
            if (projDurationMs > 0) {
                const overlapRatio = Math.max(0, availableMs / projDurationMs);
                if (overlapRatio < 0.25) {
                    // Less than 25% overlap — hard reject
                    return null;
                }
                // Partial overlap — penalty proportional to gap
                const leavePenalty = Math.round((1 - overlapRatio) * -60);
                score += leavePenalty;
                reasons.push(`Leave overlap ${Math.round(overlapRatio * 100)}%`);
            }
        }
    }

    // ── Ramp-up check ──
    const rampProfile = resource.rampProfile;
    if (rampProfile) {
        // Ramping resources are at reduced effective capacity
        score -= 25;
        reasons.push(`Ramping up (${rampProfile})`);
    }

    // ── Utilization check (hours-based) ──
    // Engine bookings are now in hours/week. Compare against real capacity.
    const resCap = resource.effectiveHours || 32; // Weekly capacity in hours
    const engineBookedHours = resource._tempBooked || 0; // hours/week already booked (window average)
    const peakBookedHours = resource._tempPeakBooked ?? engineBookedHours; // peak week in window
    const demandHours = config._demandHoursPerWeek || 8; // hours/week this role needs
    const newBookedHours = engineBookedHours + demandHours;

    // Hard cap: use PEAK week booking — don't block when average is high but specific weeks have slack
    // Increased to 120% to allow more flexibility
    const peakNewBooked = peakBookedHours + demandHours;
    if (peakNewBooked > resCap * 1.2) return null;

    // Utilization as a ratio for scoring
    const currentUtil = engineBookedHours / resCap;
    const newUtil = newBookedHours / resCap;

    // ── Squad affinity ──
    const projSquads = project.squads || [];
    const resSquads = resource.squads || [];
    const inSquad = projSquads.some(ps => resSquads.includes(ps));

    if (inSquad) {
        score += 50;
        reasons.push('Same squad');
    } else if (isProgramProject && isSpecialist) {
        score += 10;
        reasons.push('Program specialist (cross-squad OK)');
    } else {
        score -= 10;
        reasons.push('Cross-squad');
    }

    // ── Utilization fit — LOAD BALANCING ──
    // Fix #4+#5: Continuous scoring relative to per-resource targetUtil (no cliff edges).
    // Resources below target get bonus proportional to headroom; above target get exponential penalty.
    // _loadBalanceWeight (0-2): multiplier for utilisation signals. Default 1.0.
    const lbw = config._loadBalanceWeight ?? 1.0;
    const peakFactor = getPeakProfileFactor(project.effortProfile);
    const peakDemandHpw = (config._demandHoursPerWeek || 8) * peakFactor;
    const peakUtil = currentUtil + (peakDemandHpw / (resource.effectiveHours || 32));
    const targetUtil = resource.targetUtilization ?? 0.8;

    // Continuous curve: +80 at 0% → 0 at targetUtil → UNCAPPED exponential penalty above
    if (currentUtil <= targetUtil) {
        // Below target: linear bonus scaled by headroom (0% = +80, targetUtil = 0)
        const headroom = 1 - (currentUtil / Math.max(targetUtil, 0.01));
        const utilBonus = Math.round(80 * headroom * lbw);
        score += utilBonus;
        if (utilBonus >= 20) reasons.push(`${Math.round(currentUtil * 100)}% util (+${utilBonus})`);
    } else {
        // Above target: exponential penalty — steeper curve so overload dominates affinity
        const overRatio = (currentUtil - targetUtil) / Math.max(1 - targetUtil, 0.1);
        const overPenalty = Math.round(overRatio * overRatio * 120 * lbw); // Fix D2: was 80, now 120
        score -= overPenalty;
        reasons.push(`Over target ${Math.round(currentUtil * 100)}/${Math.round(targetUtil * 100)}% (-${overPenalty})`);
    }

    // Fix D2: Hard penalty above 90% util — no combination of affinity bonuses
    // should push a heavily-loaded resource over a lightly-loaded one
    if (currentUtil > 0.9) {
        const hardPenalty = Math.round((currentUtil - 0.9) * 300 * lbw);
        score -= hardPenalty;
        reasons.push(`Heavy load floor (-${hardPenalty})`);
    }

    // Extra penalty if peak demand causes overallocation
    if (peakUtil > 1.0) {
        const overPct = Math.round((peakUtil - 1.0) * 100);
        score -= Math.round(overPct * 2 * lbw);
        reasons.push(`Peak ${Math.round(peakUtil * 100)}% (-${Math.round(overPct * 2 * lbw)})`);
    }

    // ── Total booking penalty — prefer resources with lower overall load ──
    // Penalise resources that are heavily booked globally, not just in this project window
    const totalBookedHpw = resource._tempBookedTotal || 0;
    const totalUtil = totalBookedHpw / resCap;
    if (totalUtil > 0.6) {
        const globalOverPenalty = Math.round((totalUtil - 0.6) * 40 * lbw);
        score -= globalOverPenalty;
        if (globalOverPenalty >= 10) reasons.push(`Global load ${Math.round(totalUtil * 100)}% (-${globalOverPenalty})`);
    }

    // ── Fix #5: Priority weighting ──
    // Higher-priority projects get a scoring boost to help compete for scarce resources
    const projectPriority = project._reprioritization?.score || 0;
    const priorityBonus = Math.round((projectPriority / 100) * 25); // 0-25 points
    score += priorityBonus;
    if (priorityBonus > 10) reasons.push(`High-priority project (+${priorityBonus})`);

    // ── Customer-squad cohesion ──
    const customer = project.customer || '';
    const resourceCustomers = customerBookings[resource.id] || [];
    if (customer && resourceCustomers.includes(customer)) {
        // Fix R3-F: Cap customer continuity bonus with diminishing returns
        const custCount = resourceCustomers.filter(c => c === customer).length;
        const cappedBonus = Math.min(3, custCount) * 10; // 10/20/30 max, not unbounded
        score += cappedBonus;
        reasons.push(`Already works with ${customer} (${custCount}x, +${cappedBonus})`);

        // Pool consolidation bonus: prefer resources already serving this customer
        // when their utilisation is still manageable — reduces fragmentation
        if (newUtil < 0.85 && custCount >= 2) {
            score += 20;
            reasons.push('Pool candidate (+20)');
        }
    }

    // ── Program specialist affinity ──
    if (isSpecialist && isProgramProject) {
        score += 60;
        reasons.push('Program specialist → program project');
    } else if (isSpecialist && !isProgramProject) {
        score -= 40;
        reasons.push('Program specialist reserved for program work');
    } else if (!isSpecialist && isProgramProject) {
        score -= 10;
        reasons.push('Non-specialist on program project (fallback)');
    }

    // ── Cross-entity team diversity bonus ──
    if (config.preferCrossEntity && resource.origin) {
        const teamEntities = config._teamEntities || [];
        const resEntity = (resource.origin || '').toUpperCase();
        if (teamEntities.length > 0) {
            // Fix R2-2: Bonus for adding a genuinely new entity, not just being different from some
            const candidateIsNewEntity = !teamEntities.includes(resEntity);
            if (candidateIsNewEntity && resEntity) {
                // Resource adds a new entity to the team — diversity bonus
                score += 35;
                reasons.push(`New entity ${resEntity} (+35)`);
            } else if (teamEntities.length >= 2 && teamEntities.every(e => e === resEntity)) {
                // All same entity — slight penalty to encourage mixing
                score -= 10;
                reasons.push(`Same entity as team (-10)`);
            }
        }
    }

    // ── Squad specialization match ──
    const specializations = config.squadSpecializations || {};
    const projectCountry = project.country || project.customer || '';
    const projectPlatform = project.platform || '';
    let countryMatched = false;  // Fix BUG-2: track country and platform matches separately
    let platformMatched = false;
    let platformBlocked = false;
    resSquads.forEach(sq => {
        const spec = specializations[sq];
        if (!spec) return;

        // Country = soft preference (score bonus, strengthened to dominate affinity)
        // Fix ENH-10: Use exact case-insensitive match instead of substring includes
        if (spec.countries?.length && spec.countries.some(c =>
            projectCountry.toLowerCase().trim() === c.toLowerCase().trim())) {
            score += 60;
            reasons.push(`Squad ${sq} specializes in ${projectCountry}`);
            countryMatched = true;
        }

        // Platform = HARD CONSTRAINT
        // If a squad lists specific platforms, resource can ONLY work on those platforms
        if (spec.platforms?.length) {
            if (projectPlatform) {
                const platMatch = spec.platforms.some(p =>
                    projectPlatform.toLowerCase().includes(p.toLowerCase()));
                if (platMatch) {
                    score += 35;
                    reasons.push(`Squad ${sq} supports ${projectPlatform}`);
                    platformMatched = true;
                } else {
                    platformBlocked = true;
                    reasons.push(`Squad ${sq} does not support ${projectPlatform}`);
                }
            }
            // If project has no platform set, any squad can work on it
        }
    });

    // Hard-block ONLY if resource's squad explicitly lists platforms and NONE match
    // Fix BUG-2: Check platformMatched (not countryMatched) — country match doesn't override platform block
    if (platformBlocked && !platformMatched) {
        return null; // True hard constraint — not a score penalty, just ineligible
    }
    const specMatched = countryMatched || platformMatched; // Unified flag for downstream use

    // ── Per-country squad affinity (one squad per country within a customer) ──
    const countrySquadMap = config._countrySquadMap || {};
    if (customer && projectCountry && !specMatched) {
        const countryKey = `${customer}::${projectCountry}`;
        const existingSquadForCountry = countrySquadMap[countryKey];
        if (existingSquadForCountry) {
            // A squad is already assigned to this customer+country
            const resourceInSameSquad = resSquads.some(s => s === existingSquadForCountry);
            if (resourceInSameSquad) {
                score += 20;
                reasons.push(`Same squad (${existingSquadForCountry}) serving ${projectCountry}`);
            } else {
                score -= 20; // Soft preference: prefer same squad per customer/country
                reasons.push(`Different squad for ${customer} / ${projectCountry} (prefer: ${existingSquadForCountry})`);
            }
        }
    }

    // ── Excluded squad — HARD BLOCK ──
    // Resources whose squads are ALL in the excluded list cannot be assigned
    const excludedSquads = config._excludedSquads || config.excludedSquads || [];
    if (excludedSquads.length > 0 && resSquads.length > 0) {
        const allExcluded = resSquads.every(s => excludedSquads.includes(s));
        if (allExcluded) return null;
    }

    // ── Revenue efficiency: higher-ARR projects attract better resources ──
    // Fix #10: Wider ARR bonus range (was +5 to +20, now +5 to +40)
    const projArr = project.arr || 0;
    if (projArr > 0) {
        // Log-scaled bonus: £10k=+8, £100k=+16, £1M=+24, £10M=+32, £100M=+40
        const arrBonus = Math.min(40, Math.round(Math.log10(Math.max(projArr, 1000)) * 8) - 16);
        if (arrBonus > 0) {
            score += arrBonus;
            reasons.push(`Revenue weight (+${arrBonus})`);
        }
    }

    // ── Staggered timeline: bonus for resources finishing other work around project start ──
    const projStartMs = project._startMs || 0;
    const _bookings = config._bookings;
    if (projStartMs > 0 && _bookings) {
        const resBookings = _bookings[resource.id] || [];
        const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
        for (const b of resBookings) {
            // If a booking ends within 4 weeks before this project starts → great natural transition
            const gap = projStartMs - b.endMs;
            if (gap > 0 && gap <= FOUR_WEEKS_MS) {
                const gapWeeks = gap / (7 * 24 * 60 * 60 * 1000);
                let staggerBonus = Math.round(25 * (1 - gapWeeks / 4)); // +25 at 0 gap, +0 at 4 weeks

                // Effort profile awareness: FPS (front-loaded) projects drop demand after ~6 weeks
                // If the ending booking is FPS and has been running 6+ weeks, resource is nearly free
                const projProfile = (project.effortProfile || '').toLowerCase();
                if (projProfile.includes('fps') || projProfile.includes('front')) {
                    staggerBonus = Math.round(staggerBonus * 1.3); // 30% bonus for FPS timeline fit
                }

                score += staggerBonus;
                reasons.push(`Finishing soon (+${staggerBonus})`);
                break; // Only count best transition
            }
        }
    }

    // ── Customer continuity: prefer pairing with existing team on same project ──
    const existingAssignments = project.assignments || [];
    if (existingAssignments.length > 0) {
        const hasTeamFromSameSquad = existingAssignments.some(a =>
            a.resourceId && a.resourceId !== resource.id &&
            a.resourceSquads?.some(s => resSquads.includes(s))
        );
        if (hasTeamFromSameSquad) {
            score += 15;
            reasons.push('Team continuity');
        }
    }

    // ── Workload smoothing: penalize utilization spikes ──
    // Fix #6: Weight variance by booking duration (longer bookings matter more)
    const _bk = config._bookings;
    if (_bk && _bk[resource.id]?.length > 1) {
        const entries = _bk[resource.id];
        const totalDuration = entries.reduce((s, e) => s + Math.max(1, (e.endMs || 0) - (e.startMs || 0)), 0);
        // Duration-weighted average utilisation
        const weightedAvgUtil = entries.reduce((s, e) => {
            const w = Math.max(1, (e.endMs || 0) - (e.startMs || 0)) / totalDuration;
            return s + (e.hpw / resCap) * w;
        }, 0);
        // Duration-weighted variance
        const weightedVariance = entries.reduce((s, e) => {
            const w = Math.max(1, (e.endMs || 0) - (e.startMs || 0)) / totalDuration;
            return s + Math.pow((e.hpw / resCap) - weightedAvgUtil, 2) * w;
        }, 0);
        const stdDev = Math.sqrt(weightedVariance);
        if (stdDev > 0.10) {
            const smoothPenalty = Math.min(40, Math.round(stdDev * 60));
            score -= smoothPenalty;
            reasons.push(`Load variance (-${smoothPenalty})`);
        }
    }

    return {
        resource,
        score,
        currentUtil,
        newUtil,
        reasons
    };
}

/**
 * Pass 1: Big Rocks — Customer-to-Squad Allocation
 * Before individual resourcing, ensure each customer::country is in the
 * squad with the best capacity fit. Multi-country customers may span squads.
 *
 * @param {Array} projects - Scored, scheduled projects
 * @param {Array} resources - All resources
 * @param {Object} config - Optimizer config
 * @returns {{ squadMoves: Array, squadUtilization: Object }}
 */
export function balanceCustomerSquads(projects, resources, config) {
    _demandCache.clear(); // Fix: prevent stale cache from prior runs
    const ROLE_MATCHERS = buildRoleMatchers(config);
    const nowMs = Date.now();

    // ── 1. Build squad capacity profiles ──
    const validResources = resources.filter(r => {
        if (!r.name) return false;
        if (r.leaveDate && new Date(r.leaveDate).getTime() < nowMs) return false;
        return true;
    });

    const squadCapacity = {}; // squadName → { pm, sc, pd, pmHours, scHours, pdHours, totalHours }
    const dataQualityWarnings = [];
    validResources.forEach(r => {
        const squads = r.squads || [];
        // Data quality: orphan detection
        if (squads.length === 0) {
            dataQualityWarnings.push({ type: 'orphan', resourceName: r.name, resourceId: r.id, message: `${r.name} has no squad assignment` });
            return;
        }
        // Data quality: ambiguous squad membership
        if (squads.length >= 3) {
            dataQualityWarnings.push({ type: 'ambiguous_squad', resourceName: r.name, resourceId: r.id, squads, message: `${r.name} is in ${squads.length} squads — may confuse optimizer` });
        }
        const resHours = r.effectiveHours || 32;
        squads.forEach(sq => {
            if (!squadCapacity[sq]) squadCapacity[sq] = { pm: 0, sc: 0, pd: 0, pmHours: 0, scHours: 0, pdHours: 0, totalHours: 0, load: { pm: 0, sc: 0, pd: 0 } };
            if (ROLE_MATCHERS['PM']?.(r)) { squadCapacity[sq].pm++; squadCapacity[sq].pmHours += resHours; }
            if (ROLE_MATCHERS['SC']?.(r)) { squadCapacity[sq].sc++; squadCapacity[sq].scHours += resHours; }
            if (ROLE_MATCHERS['PD']?.(r)) { squadCapacity[sq].pd++; squadCapacity[sq].pdHours += resHours; }
            squadCapacity[sq].totalHours += resHours;
        });
    });
    const allSquads = Object.keys(squadCapacity);
    if (allSquads.length <= 1) {
        // Only one squad — no rebalancing possible
        return { squadMoves: [], squadUtilization: squadCapacity };
    }

    // ── 2. Aggregate customer demand by customer::country ──
    const customerGroups = {}; // "customer::country" → { projects, demand, currentSquad, tier, score, locked }
    projects.forEach(p => {
        const customer = p.customer || '';
        const country = p.country || '';
        if (!customer) return;
        const key = `${customer}::${country}`;
        if (!customerGroups[key]) {
            customerGroups[key] = {
                customer, country, key,
                projects: [],
                demand: { pm: 0, sc: 0, pd: 0 },
                currentSquad: null,
                locked: false,
                tier: Infinity,
                maxScore: 0,
                totalArr: 0
            };
        }
        const g = customerGroups[key];
        g.projects.push(p);
        g.totalArr += (p.arr || 0);

        // Track highest priority
        const tier = p._reprioritization?.tier || 99;
        const score = p._reprioritization?.score || 0;
        if (tier < g.tier) g.tier = tier;
        if (score > g.maxScore) g.maxScore = score;

        // Locked?
        if (p.lockSquad || p._reprioritization?.isSquadLocked) g.locked = true;

        // Determine current squad (from project.squad or project.squads)
        const pSquads = p.squads || (p.squad ? [p.squad] : []);
        if (pSquads.length > 0 && !g.currentSquad) {
            g.currentSquad = pSquads[0];
        }

        // Aggregate demand (each project needs 1 PM, 1 SC, 1 PD worth of capacity)
        const pmH = calculateWeeklyDemandHours(p, 'PM') || 8;
        const scH = calculateWeeklyDemandHours(p, 'SC') || 8;
        const pdH = calculateWeeklyDemandHours(p, 'PD') || 8;
        g.demand.pm += pmH;
        g.demand.sc += scH;
        g.demand.pd += pdH;
    });

    // ── 3. Determine current squad bindings from seeded assignments ──
    projects.forEach(p => {
        const customer = p.customer || '';
        const country = p.country || '';
        if (!customer) return;
        const key = `${customer}::${country}`;
        const g = customerGroups[key];
        if (!g || g.currentSquad) return;

        // Check team assignments for squad binding
        const team = p.team || {};
        ['pm', 'sc', 'pd'].forEach(role => {
            const members = Array.isArray(team[role]) ? team[role] : [];
            members.forEach(m => {
                if (g.currentSquad) return;
                const resId = m.id || m.resourceId;
                if (!resId) return;
                const res = validResources.find(r => r.id === resId);
                if (res?.squads?.[0]) {
                    g.currentSquad = res.squads[0];
                }
            });
        });
    });

    // ── 4a. Apply customer squad seeds ──
    // Manual pre-assignments: lock customers into user-specified squads
    const customerSquadSeeds = config.customerSquadSeeds || {};
    Object.values(customerGroups).forEach(g => {
        const seedSquad = customerSquadSeeds[g.customer];
        if (seedSquad && squadCapacity[seedSquad]) {
            // Un-load from old squad if already pre-loaded
            if (g.currentSquad && squadCapacity[g.currentSquad] && g._preLoaded) {
                const oldCap = squadCapacity[g.currentSquad];
                oldCap.load.pm -= g.demand.pm;
                oldCap.load.sc -= g.demand.sc;
                oldCap.load.pd -= g.demand.pd;
            }
            g.currentSquad = seedSquad;
            g.locked = true; // Treat seeded customers as locked
            g.projects.forEach(p => {
                p.squads = [seedSquad];
                p.squad = seedSquad;
                p._squadSeeded = true;
            });
        }
    });

    // ── 4b. Pre-load squad demand from locked/already-bound customers ──
    Object.values(customerGroups).forEach(g => {
        if (!g.currentSquad || !squadCapacity[g.currentSquad]) return;
        const cap = squadCapacity[g.currentSquad];
        cap.load.pm += g.demand.pm;
        cap.load.sc += g.demand.sc;
        cap.load.pd += g.demand.pd;
        g._preLoaded = true; // Fix #17: Mark as pre-loaded to avoid double-counting
    });

    // ── 5. Score and rebalance ──
    // Sort: cornerstone first (lowest tier), then highest score, then largest demand
    const sortedGroups = Object.values(customerGroups)
        .filter(g => !g.locked) // Don't move locked customers
        .sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier; // Lower tier = higher priority
            if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
            return (b.demand.pm + b.demand.sc + b.demand.pd) - (a.demand.pm + a.demand.sc + a.demand.pd);
        });

    const squadMoves = [];
    const specializations = config.squadSpecializations || {};

    for (const group of sortedGroups) {
        let bestSquad = group.currentSquad;
        let bestFitScore = -Infinity;

        for (const sq of allSquads) {
            const cap = squadCapacity[sq];
            if (!cap) continue;

            let fitScore = 0;

            // Capacity fit: use actual effectiveHours per role, not fixed 32h
            const pmSpare = cap.pmHours - cap.load.pm;
            const scSpare = cap.scHours - cap.load.sc;
            const pdSpare = cap.pdHours - cap.load.pd;

            // Can this squad absorb this customer's demand?
            const canAbsorb = pmSpare >= group.demand.pm && scSpare >= group.demand.sc && pdSpare >= group.demand.pd;
            if (!canAbsorb && sq !== group.currentSquad) continue;

            fitScore += Math.min(pmSpare - group.demand.pm, 100);
            fitScore += Math.min(scSpare - group.demand.sc, 100);
            fitScore += Math.min(pdSpare - group.demand.pd, 100);

            // Diminishing returns: penalize squads already above 80% utilization
            const pmUtil = cap.pmHours > 0 ? cap.load.pm / cap.pmHours : 0;
            const scUtil = cap.scHours > 0 ? cap.load.sc / cap.scHours : 0;
            const pdUtil = cap.pdHours > 0 ? cap.load.pd / cap.pdHours : 0;
            const maxUtil = Math.max(pmUtil, scUtil, pdUtil);
            if (maxUtil > 0.8) {
                fitScore -= Math.round((maxUtil - 0.8) * 200); // -40 at 100%, -80 at 120%
            }

            // Revenue-weighted gravity: higher-ARR customers get stronger placement
            const arrFactor = group.totalArr > 0 ? Math.min(Math.log10(group.totalArr / 1000), 5) : 0;

            // Specialization bonus
            const spec = specializations[sq];
            if (spec) {
                if (spec.countries && group.country && spec.countries.some(c => c.toLowerCase() === group.country.toLowerCase())) {
                    fitScore += 50 + (arrFactor * 5); // Country match, amplified by ARR
                }
            }

            // Stability bonus: prefer keeping customer where they are
            if (sq === group.currentSquad) {
                fitScore += 30;
            }

            if (fitScore > bestFitScore) {
                bestFitScore = fitScore;
                bestSquad = sq;
            }
        }

        // Apply move if better squad found
        if (bestSquad && bestSquad !== group.currentSquad && group.currentSquad) {
            // Un-load from old squad
            const oldCap = squadCapacity[group.currentSquad];
            if (oldCap) {
                oldCap.load.pm -= group.demand.pm;
                oldCap.load.sc -= group.demand.sc;
                oldCap.load.pd -= group.demand.pd;
            }

            squadMoves.push({
                customer: group.customer,
                country: group.country,
                fromSquad: group.currentSquad,
                toSquad: bestSquad,
                projectCount: group.projects.length,
                arrImpact: group.totalArr,
                tier: group.tier,
                reason: `Better capacity fit in ${bestSquad}`
            });

            // Update project squads
            group.projects.forEach(p => {
                p.squads = [bestSquad];
                p.squad = bestSquad;
                p._squadRebalanced = true;
                p._squadRebalancedFrom = group.currentSquad;
            });

            group.currentSquad = bestSquad;
        }

        // Assign to squad if unbound
        if (!group.currentSquad && bestSquad) {
            group.currentSquad = bestSquad;
            group.projects.forEach(p => {
                p.squads = [bestSquad];
                p.squad = bestSquad;
            });
        }

        // Load onto target squad
        // Fix #17: Only load if not already pre-loaded in Step 4
        if (group.currentSquad && squadCapacity[group.currentSquad] && !group._preLoaded) {
            const cap = squadCapacity[group.currentSquad];
            cap.load.pm += group.demand.pm;
            cap.load.sc += group.demand.sc;
            cap.load.pd += group.demand.pd;
        }
        // After first pass, mark as loaded regardless
        group._preLoaded = true;
    }

    // ── 6. Capacity spillover — fill underloaded squads with platform-matching overflow ──
    // Country is a PREFERENCE not a hard filter: if a squad has lots of spare capacity
    // and its platform spec matches, it should absorb work from overloaded squads.
    const spilloverMoves = [];
    const UNDERLOAD_THRESHOLD = 0.60; // Squad must be below 60% util to receive spillover
    const OVERLOAD_THRESHOLD = 0.80;  // Source squad must be above 80% util

    for (const underSquad of allSquads) {
        const uCap = squadCapacity[underSquad];
        if (!uCap || uCap.totalHours === 0) continue;
        const uUtil = (uCap.load.pm + uCap.load.sc + uCap.load.pd) / (uCap.totalHours * 3);
        if (uUtil >= UNDERLOAD_THRESHOLD) continue;

        const underSpec = specializations[underSquad];
        if (!underSpec?.platforms?.length) continue; // Only squads with platform specs absorb

        // Find groups in overloaded squads whose platform matches the underloaded squad
        for (const group of Object.values(customerGroups)) {
            if (group.locked) continue; // Don't move locked/seeded customers
            if (group.currentSquad === underSquad) continue;
            if (!group.currentSquad) continue;

            // Check source squad is overloaded
            const oCap = squadCapacity[group.currentSquad];
            if (!oCap) continue;
            const oUtil = (oCap.load.pm + oCap.load.sc + oCap.load.pd) / (oCap.totalHours * 3);
            if (oUtil < OVERLOAD_THRESHOLD) continue;

            // Check platform match — project platform must match underloaded squad's platforms
            const projPlatforms = [...new Set(group.projects.map(p => (p.platform || '').toLowerCase()).filter(Boolean))];
            if (projPlatforms.length === 0) continue; // No platform data
            const platformOk = projPlatforms.every(pp =>
                underSpec.platforms.some(sp => pp.includes(sp.toLowerCase())));
            if (!platformOk) continue;

            // Check capacity: can the underloaded squad absorb this group?
            const canAbsorb = (uCap.pmHours - uCap.load.pm) >= group.demand.pm
                && (uCap.scHours - uCap.load.sc) >= group.demand.sc
                && (uCap.pdHours - uCap.load.pd) >= group.demand.pd;
            if (!canAbsorb) continue;

            // Move!
            oCap.load.pm -= group.demand.pm;
            oCap.load.sc -= group.demand.sc;
            oCap.load.pd -= group.demand.pd;

            uCap.load.pm += group.demand.pm;
            uCap.load.sc += group.demand.sc;
            uCap.load.pd += group.demand.pd;

            spilloverMoves.push({
                customer: group.customer,
                country: group.country,
                fromSquad: group.currentSquad,
                toSquad: underSquad,
                projectCount: group.projects.length,
                reason: `Capacity spillover: ${underSquad} underloaded, platform matches`
            });

            group.projects.forEach(p => {
                p.squads = [underSquad];
                p.squad = underSquad;
                p._squadSpillover = true;
                p._squadSpilloverFrom = group.currentSquad;
            });
            group.currentSquad = underSquad;

            // Re-check utilisation — stop if no longer underloaded
            const newUUtil = (uCap.load.pm + uCap.load.sc + uCap.load.pd) / (uCap.totalHours * 3);
            if (newUUtil >= UNDERLOAD_THRESHOLD) break;
        }
    }

    squadMoves.push(...spilloverMoves);

    // ── 7. Compute utilization stats ──
    const squadUtilization = {};
    allSquads.forEach(sq => {
        const cap = squadCapacity[sq];
        squadUtilization[sq] = {
            pm: { pool: cap.pm, hours: cap.pmHours, loadHours: Math.round(cap.load.pm), utilPct: cap.pmHours > 0 ? Math.round((cap.load.pm / cap.pmHours) * 100) : 0 },
            sc: { pool: cap.sc, hours: cap.scHours, loadHours: Math.round(cap.load.sc), utilPct: cap.scHours > 0 ? Math.round((cap.load.sc / cap.scHours) * 100) : 0 },
            pd: { pool: cap.pd, hours: cap.pdHours, loadHours: Math.round(cap.load.pd), utilPct: cap.pdHours > 0 ? Math.round((cap.load.pd / cap.pdHours) * 100) : 0 }
        };
    });

    if (squadMoves.length > 0) {
        console.log(`[Optimizer] Pass 1: ${squadMoves.length} customer-squad moves suggested`);
        squadMoves.forEach(m => console.log(`  → ${m.customer} (${m.country}): ${m.fromSquad} → ${m.toSquad} (${m.projectCount} projects, £${m.arrImpact?.toLocaleString() || 'n/a'} ARR)`));
    }
    if (spilloverMoves.length > 0) {
        console.log(`[Optimizer] Spillover: ${spilloverMoves.length} groups moved to underloaded squads`);
    }

    return { squadMoves, squadUtilization, dataQualityWarnings };
}

/**
 * Assign resources to scheduled projects in priority order.
 * Modifies the scheduled array in-place, adding `assignments` to each project.
 * 
 * @param {Array} scheduled - Projects (already sorted by score, highest first)
 * @param {Array} resources - All available resources
 * @param {Object} config - { programSpecialistIds, preferProgramContinuity, ... }
 * @param {Array} warnings - Warnings array to append to
 * @returns {Object} { rolesNeeded, rolesFilled, programAssignments }
 */
export async function assignResources(scheduled, resources, config, warnings, onProgressCb) {
    // Fix #15: Clear demand cache at start of each optimizer run to avoid stale values
    _demandCache.clear();
    const ROLE_MATCHERS = buildRoleMatchers(config);
    const programSpecialistIds = config.programSpecialistIds || [];
    const seedFromCurrent = config.seedFromCurrent !== false; // default true
    const seedInFlightOnly = config.seedInFlightOnly || false;
    const excludedSquads = config.excludedSquads || [];
    const mergeLookup = buildMergeLookup(config.mergeGroups); // Merge-group awareness

    // Build lookup of valid resources (has name, not closed/departed, not already left)
    const nowMs = Date.now();
    const validResources = resources.filter(r => {
        if (!r.name) return false;
        if (r.leaveDate && new Date(r.leaveDate).getTime() < nowMs) return false;
        return true;
    });
    // Pre-compute leave date timestamps to avoid hot-path Date construction
    validResources.forEach(r => {
        r._leaveDateMs = r.leaveDate ? new Date(r.leaveDate).getTime() : 0;
    });
    // Pre-compute role matcher flags per resource (avoids repeated string matching)
    validResources.forEach(r => {
        r._matchesPM = ROLE_MATCHERS['PM']?.(r) || false;
        r._matchesSC = ROLE_MATCHERS['SC']?.(r) || false;
        r._matchesPD = ROLE_MATCHERS['PD']?.(r) || false;
    });

    // Entity role rules — used in bundle pre-pass per project (not flag expansion)
    const entityRoleRules = config.entityRoleRules || [];
    // Entity rule activation tracking
    const entityRuleStats = {
        bundleFills: 0,          // Roles filled via bundle pre-pass
        flexFills: 0,            // Roles filled via entity flex expansion
        bundlesByRule: {},       // Per-rule bundle activation count
        flexByRole: {},          // Per target-role flex activation count
        freedResources: 0        // Resources freed by not needing separate per-role assignment
    };
    const bundledResources = new Set(); // Track unique resources used in bundles

    // ── Diagnostic: log entity distribution across resources ──
    if (entityRoleRules.length > 0) {
        const entityDist = {};
        validResources.forEach(r => {
            const e = r.origin || '(none)';
            entityDist[e] = (entityDist[e] || 0) + 1;
        });
        console.log(`[Optimizer] Entity distribution:`, entityDist);
        console.log(`[Optimizer] Entity rules:`, entityRoleRules.map(r => {
            const base = `${r.entity} ${r.sourceFunction} → ${(r.canFill || []).join('+')}`;
            const rc = r.remainingConstraints && Object.keys(r.remainingConstraints).length > 0
                ? ` (remaining: ${Object.entries(r.remainingConstraints).map(([k, v]) => `${k}→${v}`).join(', ')})`
                : '';
            return base + rc;
        }));
        // Log PD counts per entity
        const pdByEntity = {};
        validResources.filter(r => r._matchesPD).forEach(r => {
            const e = r.origin || '(none)';
            pdByEntity[e] = (pdByEntity[e] || 0) + 1;
        });
        console.log(`[Optimizer] PDs by entity:`, pdByEntity);
    }

    const resourceById = {};
    validResources.forEach(r => { resourceById[r.id] = r; });

    // Pre-compute project date timestamps
    // (duplicate _demandCache.clear() removed — already cleared above)
    scheduled.forEach(p => {
        p._startMs = p.startDate ? new Date(p.startDate).getTime() : (p.kickOff ? new Date(p.kickOff).getTime() : 0);
        p._endMs = p.endDate ? new Date(p.endDate).getTime() : (p.launch ? new Date(p.launch).getTime() : 0);
    });

    // Track time-phased bookings: resourceId → [{ startMs, endMs, hpw }]
    // hpw = hours per week booked on this project
    // This allows resources finishing one project to become available for later ones.
    const bookings = {};

    // Helper: get entities of resources already assigned to a project
    function getTeamEntities(project) {
        if (!project.assignments) return [];
        return project.assignments
            .filter(a => a.resourceId)
            .map(a => {
                const res = resourceById[a.resourceId];
                return res ? (res.origin || '').toUpperCase() : '';
            })
            .filter(Boolean);
    }

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    /**
     * Get total booked hours/week for a resource during a specific time window.
     * Only counts bookings that overlap the given window.
     */
    function getBookingInWindow(resId, windowStartMs, windowEndMs) {
        const entries = bookings[resId] || [];
        if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) {
            return entries.reduce((sum, e) => sum + e.hpw, 0);
        }
        // Fix R3-1: Sample per-week and return AVERAGE hpw across the window.
        // HPW is a rate (hours per week), not a total — it should not be scaled
        // by overlap ratio. A booking at 16 hpw means 16 hpw in every week it covers.
        let totalWeeklySum = 0;
        let weekCount = 0;
        for (let t = windowStartMs; t < windowEndMs; t += WEEK_MS) {
            const weekEnd = Math.min(t + WEEK_MS, windowEndMs);
            let weekTotal = 0;
            for (const entry of entries) {
                if (entry.endMs > t && entry.startMs < weekEnd) {
                    weekTotal += entry.hpw;
                }
            }
            totalWeeklySum += weekTotal;
            weekCount++;
        }
        return weekCount > 0 ? totalWeeklySum / weekCount : 0;
    }

    /**
     * Peak booking: sample at weekly intervals across the window and
     * return the maximum hours/week in any single week.
     */
    function getPeakBookingInWindow(resId, windowStartMs, windowEndMs) {
        const entries = bookings[resId] || [];
        if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) {
            return entries.reduce((sum, e) => sum + e.hpw, 0);
        }
        let peak = 0;
        // Sample every week within the window
        for (let t = windowStartMs; t < windowEndMs; t += WEEK_MS) {
            const weekEnd = Math.min(t + WEEK_MS, windowEndMs);
            let weekTotal = 0;
            for (const entry of entries) {
                // Does this booking overlap with this week?
                if (entry.endMs > t && entry.startMs < weekEnd) {
                    weekTotal += entry.hpw;
                }
            }
            if (weekTotal > peak) peak = weekTotal;
        }
        return peak;
    }

    /**
     * Find the earliest week (as ms timestamp) where a resource's booking
     * drops below a given threshold. Used for staggered shifting.
     */
    function findEarliestAvailableWeek(resId, searchStartMs, maxSearchMs, thresholdHpw) {
        const entries = bookings[resId] || [];
        for (let t = searchStartMs; t < maxSearchMs; t += WEEK_MS) {
            const weekEnd = t + WEEK_MS;
            let weekTotal = 0;
            for (const entry of entries) {
                if (entry.endMs > t && entry.startMs < weekEnd) {
                    weekTotal += entry.hpw;
                }
            }
            if (weekTotal < thresholdHpw) return t;
        }
        return null; // No availability found within search range
    }

    // PERF-2: Cache for getTotalBooking — invalidated per resource when addBooking is called
    const _totalBookingCache = {};

    function addBooking(resId, startMs, endMs, hoursPerWeek) {
        if (!bookings[resId]) bookings[resId] = [];
        // Fix R3-2: Cap fallback end at 26 weeks (not 365 days) to prevent over-inflation
        bookings[resId].push({ startMs: startMs || nowMs, endMs: endMs || (nowMs + 26 * 7 * 24 * 60 * 60 * 1000), hpw: hoursPerWeek });
        delete _totalBookingCache[resId]; // Invalidate cache for this resource
    }

    // Fix R3-7: getTotalBooking now returns the MAX concurrent hpw across all weeks
    // (not naive sum of all entries which double-counts sequential bookings).
    function getTotalBooking(resId) {
        // PERF-2: Return cached value if available
        if (_totalBookingCache[resId] !== undefined) return _totalBookingCache[resId];
        const entries = bookings[resId] || [];
        if (entries.length === 0) { _totalBookingCache[resId] = 0; return 0; }
        if (entries.length === 1) { _totalBookingCache[resId] = entries[0].hpw; return entries[0].hpw; }
        // Find actual peak concurrent booking by sampling key boundary weeks
        const timestamps = new Set();
        for (const e of entries) { timestamps.add(e.startMs); timestamps.add(e.endMs); }
        const sorted = [...timestamps].sort((a, b) => a - b);
        let maxHpw = 0;
        for (const t of sorted) {
            let weekTotal = 0;
            const weekEnd = t + WEEK_MS;
            for (const entry of entries) {
                if (entry.endMs > t && entry.startMs < weekEnd) {
                    weekTotal += entry.hpw;
                }
            }
            if (weekTotal > maxHpw) maxHpw = weekTotal;
        }
        _totalBookingCache[resId] = maxHpw;
        return maxHpw;
    }
    // Track customer-resource mapping: resourceId → [customer names]
    const customerResourceMap = {};
    // Track customer+country → squadName for per-country affinity constraint
    const countrySquadMap = {};

    let rolesNeeded = 0;
    let rolesFilled = 0;
    let programAssignments = 0;
    let programPreAssignedCount = 0;
    let seededCount = 0;

    // ── Phase -1: Pre-book program team assignments ──
    // These are manually assigned senior resources for program workstreams.
    // Their capacity is consumed proportional to program demand, with remaining
    // capacity available for regular project allocation.
    const programTeamAssignments = config.programTeamAssignments || [];
    const programDemand = config.programDemand || {};

    if (programTeamAssignments.length > 0) {
        programTeamAssignments.forEach(assignment => {
            const resId = assignment.resourceId;
            if (!resId) return;
            const res = resourceById[resId];
            if (!res) return; // Resource not in valid pool (possibly excluded squad)

            const customer = assignment.customer || '';
            const wsName = assignment.workstream || '';
            const allocPct = assignment.allocationPct || 100;

            // Calculate how much capacity (in hours/week) this resource needs for program work
            const customerDemand = programDemand[customer];
            let programHoursPerWeek = 0;

            if (customerDemand) {
                const wsDemand = (customerDemand.workstreams || []).find(ws => ws.name === wsName);
                const wsHours = wsDemand ? wsDemand.hours : 0;

                if (wsHours > 0 && customerDemand.totalWeeks > 0) {
                    const wsSharers = programTeamAssignments.filter(a =>
                        a.customer === customer && a.workstream === wsName
                    ).length;
                    const perResourceHours = wsHours / Math.max(wsSharers, 1);
                    programHoursPerWeek = (perResourceHours / customerDemand.totalWeeks) * (allocPct / 100);
                }
            }

            // Fallback: if no demand data, use allocPct of resource's capacity
            if (programHoursPerWeek === 0 && allocPct > 0) {
                const resCap = res.effectiveHours || 32;
                programHoursPerWeek = resCap * (allocPct / 100);
            }

            addBooking(resId, nowMs, nowMs + 52 * 7 * 24 * 60 * 60 * 1000, programHoursPerWeek);
            programPreAssignedCount++;

            // Track customer-resource and customer-squad mappings
            if (customer) {
                if (!customerResourceMap[resId]) customerResourceMap[resId] = [];
                if (!customerResourceMap[resId].includes(customer)) {
                    customerResourceMap[resId].push(customer);
                }
                const projCountry = assignment.country || '';
                if (projCountry && res.squads?.[0]) {
                    const ck = `${customer}::${projCountry}`;
                    if (!countrySquadMap[ck]) countrySquadMap[ck] = res.squads[0];
                }
            }
        });
    }

    // ── Phase 0: Seed from current assignments (warm start) ──
    if (seedFromCurrent) {
        scheduled.forEach(project => {
            // When seedInFlightOnly is on, skip projects that are not in-flight
            if (seedInFlightOnly) {
                const status = (project.status || '').toLowerCase();
                const isInFlight = IN_FLIGHT_STATUSES.some(s => status.includes(s));
                if (!isInFlight) return;
            }
            const team = project.team || {};
            const customer = project.customer || '';
            const seeded = [];
            const failedSeedRoles = new Set(); // Track roles where seeding was expected but failed

            ['pm', 'sc', 'pd'].forEach(role => {
                const existing = Array.isArray(team[role]) ? team[role] : [];
                let anySeeded = false;
                let hadRealMember = false;
                existing.forEach(assignment => {
                    const resId = assignment.id || assignment.resourceId;
                    if (!resId) return;
                    // Don't seed unassigned/TBC placeholders
                    if (assignment.name === 'Unassigned' || assignment.name === 'TBC') return;
                    if (resId.includes('unassigned')) return;
                    hadRealMember = true;
                    const res = resourceById[resId];
                    if (!res) return; // Resource not in valid pool
                    // Don't double-book beyond 120% of weekly capacity
                    const resCap = res.effectiveHours || 32;
                    if (getTotalBooking(resId) >= resCap * 1.2) return;

                    // Calculate real hours/week from allocation percentage
                    const seedAllocPct = (assignment.allocationPct && assignment.allocationPct > 0)
                        ? assignment.allocationPct : 25;
                    const seedHoursPerWeek = resCap * (seedAllocPct / 100);
                    addBooking(resId, project._startMs, project._endMs, seedHoursPerWeek);
                    seeded.push({ role: role.toUpperCase(), resourceId: resId, resourceName: res.name, hoursPerWeek: seedHoursPerWeek });
                    seededCount++;
                    anySeeded = true;

                    // Track customer-resource mapping
                    if (customer) {
                        if (!customerResourceMap[resId]) customerResourceMap[resId] = [];
                        if (!customerResourceMap[resId].includes(customer)) {
                            customerResourceMap[resId].push(customer);
                        }
                    }

                    // Track customer-squad mapping
                    if (customer) {
                        const seedCountry = project.country || '';
                        if (seedCountry && res.squads?.[0]) {
                            const ck = `${customer}::${seedCountry}`;
                            if (!countrySquadMap[ck]) countrySquadMap[ck] = res.squads[0];
                        }
                    }
                });
                // If there were real team members but none could be seeded, register as failed
                if (hadRealMember && !anySeeded) {
                    failedSeedRoles.add(role.toUpperCase());
                }
            });

            project._seededAssignments = seeded;
            project._failedSeedRoles = failedSeedRoles; // Used to inject fallback gaps
        });
    }

    // ── Phase 0.5: Pre-book resources from locked assignments (Fix #2) ──
    // When re-running after shift passes, fully-resourced projects have
    // _lockedAssignment = true. Pre-book their resources so they can't be stolen.
    scheduled.forEach(project => {
        if (!project._lockedAssignment || !project.assignments?.length) return;
        const customer = project.customer || '';
        project.assignments.forEach(a => {
            if (!a.resourceId) return;
            const res = resourceById[a.resourceId];
            if (!res) return;
            addBooking(a.resourceId, project._startMs, project._endMs,
                a._demandHpw || ((a.allocationPct || 25) / 100) * (res.effectiveHours || 32));
            // Track customer-resource mapping
            if (customer) {
                if (!customerResourceMap[a.resourceId]) customerResourceMap[a.resourceId] = [];
                if (!customerResourceMap[a.resourceId].includes(customer)) {
                    customerResourceMap[a.resourceId].push(customer);
                }
            }
            rolesNeeded++;
            rolesFilled++;
        });
    });

    // ── Compute set of currently-resourced projects (have at least one real team member) ──
    const alreadyResourcedIds = new Set();
    scheduled.forEach(p => {
        const team = p.team || {};
        const hasRealMember = ['pm', 'sc', 'pd'].some(role => {
            const members = Array.isArray(team[role]) ? team[role] : [];
            return members.some(a => {
                const name = (a.name || '').trim();
                if (!name || name === 'Unassigned' || name === 'TBC') return false;
                const id = a.id || a.resourceId || '';
                if (id.includes('unassigned')) return false;
                return true; // Has a real person assigned
            });
        });
        if (hasRealMember) alreadyResourcedIds.add(p.id);
    });

    // Also consider projects that were successfully seeded in Phase 0
    scheduled.forEach(p => {
        if (alreadyResourcedIds.has(p.id)) return;
        if (p._seededAssignments && p._seededAssignments.length > 0) {
            alreadyResourcedIds.add(p.id);
        }
    });

    // ── Emit initial grid status: show currently-resourced projects as green ──
    if (onProgressCb) {
        const initialStatuses = {};
        alreadyResourcedIds.forEach(id => { initialStatuses[id] = 'filled'; });
        onProgressCb(`Seeded ${seededCount} assignments · ${alreadyResourcedIds.size} currently resourced`, {
            projectStatuses: initialStatuses,
            totalProjects: scheduled.length
        });
    }

    // ── Phase 1: Fill remaining gaps (greedy assignment by priority) ──
    // ── Diagnostics: resource pool stats ──
    // PERF-5: Pre-compute role pools once — reused across all phases
    const rolePools = {
        PM: validResources.filter(r => ROLE_MATCHERS['PM']?.(r)),
        SC: validResources.filter(r => ROLE_MATCHERS['SC']?.(r)),
        PD: validResources.filter(r => ROLE_MATCHERS['PD']?.(r))
    };
    try {
        const avgCap = validResources.reduce((s, r) => s + (r.effectiveHours || 0), 0) / (validResources.length || 1);
        console.log(`[Optimizer] Pool: ${validResources.length} resources (PM=${rolePools.PM.length}, SC=${rolePools.SC.length}, PD=${rolePools.PD.length}), avg=${avgCap.toFixed(1)}h/wk | ${scheduled.length} projects, ${alreadyResourcedIds.size} pre-resourced`);
    } catch (e) { console.warn('[Optimizer] Diagnostics failed:', e.message); }
    // Pre-build persistent status map instead of rescanning every time
    const projectStatuses = {};
    alreadyResourcedIds.forEach(id => { projectStatuses[id] = 'filled'; });
    scheduled.forEach(p => { if (p._lockedAssignment) projectStatuses[p.id] = 'filled'; });
    let filledCount = Object.values(projectStatuses).filter(s => s === 'filled').length;

    // ── Phase 1: Fill remaining gaps ──
    // Improvement #1: Constrained-first ordering — projects with fewer viable
    // candidates get priority to prevent scarce resources being consumed by
    // projects with many alternatives.
    const projectAssignmentOrder = [...scheduled.keys()].filter(i => !scheduled[i]._lockedAssignment);

    // Fix #18: Removed redundant project-level viability scan.
    // Per-role scarcity sort (Fix #9) inside the project loop handles this more precisely.

    for (let _oi = 0; _oi < projectAssignmentOrder.length; _oi++) {
        const _pi = projectAssignmentOrder[_oi];

        // Yield every 10 processed projects to avoid killing the extension.
        // Throttle on the loop counter (_oi), not the sparse source index (_pi):
        // _pi skips locked projects and is non-contiguous, so gating on it would
        // make yields/progress fire irregularly (or not at all) for small runs.
        if (_oi > 0 && _oi % 10 === 0) {
            await yieldToUI();
        }
        // Emit status less frequently (every 20) to reduce UI thrashing
        if (_oi > 0 && _oi % 20 === 0 && onProgressCb) {
            const p = scheduled[_pi];
            const pName = (p.customer || p.name || '').substring(0, 30);
            onProgressCb(
                `Assigning ${_oi}/${projectAssignmentOrder.length} · ${pName} — ${Math.round(filledCount / scheduled.length * 100)}%`,
                { projectStatuses: { ...projectStatuses }, totalProjects: scheduled.length }
            );
        }
        const project = scheduled[_pi];
        const gaps = determineProjectRoleGaps(project);
        // Inject fallback gaps for roles where seeding was expected but failed
        // (the team had real members but they couldn't be booked)
        const failedRoles = project._failedSeedRoles;
        if (failedRoles && failedRoles.size > 0) {
            failedRoles.forEach(role => {
                const alreadyHasGap = gaps.some(g => (g._baseRole || g.role) === role);
                if (!alreadyHasGap) {
                    const fallbackPct = role === 'SC' ? 35 : role === 'PM' ? 25 : 20;
                    gaps.push({ role, pct: fallbackPct, _baseRole: role });
                }
            });
        }
        const assignments = [];
        const seeded = project._seededAssignments || [];

        // First, add seeded assignments as pre-filled
        seeded.forEach(({ role, resourceId, resourceName, hoursPerWeek: hpw }) => {
            const res = resourceById[resourceId];
            const safeHpw = hpw || 8; // fallback 8h/wk if not set
            rolesNeeded++;
            rolesFilled++;
            const projSquads = project.squads || [];
            const resSquads = res?.squads || [];
            const crossSquad = projSquads.length > 0 && resSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, resSquads);
            // Compute actual utilization for seeded assignments
            const resCap = res?.effectiveHours || 32;
            const bookedBefore = getBookingInWindow(resourceId, project._startMs, project._endMs) - safeHpw; // subtract self-booking (already booked above)
            const currentUtilPct = Math.max(0, Math.round((bookedBefore / resCap) * 100));
            const newUtilPct = Math.round(((bookedBefore + safeHpw) / resCap) * 100);
            assignments.push({
                role,
                resourceId,
                resourceName,
                resourceHeadshot: res?.headshot || null,
                resourceSquads: resSquads,
                allocationPct: Math.round((safeHpw / resCap) * 100),
                score: 200, // High score — seeded from current
                currentUtil: currentUtilPct,
                newUtil: newUtilPct,
                reason: `Seeded from current (${safeHpw.toFixed(1)}h/wk)`,
                isProgramSpecialist: programSpecialistIds.includes(resourceId),
                isSeeded: true,
                isCrossSquad: crossSquad
            });
        });

        // Then fill gaps that weren't seeded
        const seededRoles = new Set(seeded.map(s => s.role));
        const assignedResourceIds = new Set(); // Track assigned resources within this project

        // ── Entity Role Bundle Pre-pass ──
        // Assign one resource to ALL canFill roles simultaneously (all-or-nothing bundling)
        if (entityRoleRules.length > 0) {
            const unfilledBaseRoles = new Set(
                gaps.filter(g => !seededRoles.has(g.role)).map(g => g._baseRole || g.role)
            );

            for (const rule of entityRoleRules) {
                const canFill = rule.canFill || [];
                if (canFill.length < 2) continue; // Bundling only makes sense for 2+ roles

                // Check which canFill roles are still unfilled on this project
                const matchingGaps = gaps.filter(g => {
                    const baseRole = g._baseRole || g.role;
                    return !seededRoles.has(g.role) && canFill.includes(baseRole);
                });

                // Allow partial bundles: need at least 2 matching unfilled roles
                const matchingBaseRoles = [...new Set(matchingGaps.map(g => g._baseRole || g.role))];
                if (matchingBaseRoles.length < 2) continue;

                // Find candidate resources that match this rule's entity + sourceFunction
                const ruleEntity = (rule.entity || '').toUpperCase();
                const srcKey = rule.sourceFunction;
                // FPS projects: only FY resources allowed
                const isFPS = (project.platform || '').toUpperCase().includes('FPS');

                const bundleCandidates = validResources.filter(r => {
                    if (assignedResourceIds.has(r.id)) return false;
                    const resEntity = (r.origin || '').toUpperCase();
                    // 'ALL' matches any entity; otherwise require exact match
                    if (ruleEntity !== 'ALL' && resEntity !== ruleEntity) return false;
                    // FPS constraint: only FY resources on FPS projects
                    if (isFPS && resEntity !== 'FY') return false;
                    // Must match source function natively
                    const srcMatch = srcKey === 'PM' ? r._matchesPM
                        : srcKey === 'SC' ? r._matchesSC
                            : srcKey === 'PD' ? r._matchesPD : false;
                    return srcMatch;
                });

                if (bundleCandidates.length === 0) continue;

                // Score candidates using the first role's demand as representative
                const combinedDemandHpw = matchingGaps.reduce((sum, g) => {
                    return sum + (calculateWeeklyDemandHours(project, g._baseRole || g.role) || (g.pct / 100) * 32);
                }, 0);

                const scored = bundleCandidates.map(r => {
                    r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempBookedTotal = getTotalBooking(r.id);
                    return scoreCandidateForRole(r, project, {
                        ...config,
                        _customerResourceMap: customerResourceMap,
                        _countrySquadMap: countrySquadMap,
                        _excludedSquads: excludedSquads,
                        _nowMs: nowMs,
                        _demandHoursPerWeek: combinedDemandHpw, // Combined demand for capacity check
                        _bookings: bookings,
                        _teamEntities: getTeamEntities(project)
                    });
                }).filter(Boolean);

                if (scored.length === 0) continue;
                scored.sort((a, b) => b.score - a.score);

                const best = scored[0];
                assignedResourceIds.add(best.resource.id);

                // Book the combined hours
                addBooking(best.resource.id, project._startMs, project._endMs, combinedDemandHpw);

                // Customer tracking
                const customer = project.customer || '';
                if (customer) {
                    if (!customerResourceMap[best.resource.id]) customerResourceMap[best.resource.id] = [];
                    if (!customerResourceMap[best.resource.id].includes(customer)) {
                        customerResourceMap[best.resource.id].push(customer);
                    }
                }

                const bestResSquads = best.resource.squads || [];
                const bestProjSquads = project.squads || [];
                const bestCrossSquad = bestProjSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(bestProjSquads, bestResSquads);

                // Assign to ALL canFill roles at once
                const bundledRoleNames = [];
                matchingGaps.forEach(g => {
                    const baseRole = g._baseRole || g.role;
                    if (!canFill.includes(baseRole)) return;

                    seededRoles.add(g.role); // Mark as filled so per-role loop skips it
                    rolesFilled++;
                    rolesNeeded++;
                    bundledRoleNames.push(g.role);

                    const roleDemandHpw = calculateWeeklyDemandHours(project, baseRole) || (g.pct / 100) * 32;
                    assignments.push({
                        role: g.role,
                        resourceId: best.resource.id,
                        resourceName: best.resource.name,
                        resourceHeadshot: best.resource.headshot || null,
                        resourceSquads: bestResSquads,
                        allocationPct: Math.round((roleDemandHpw / (best.resource.effectiveHours || 32)) * 100),
                        _demandHpw: roleDemandHpw,
                        score: Math.round(best.score),
                        currentUtil: Math.round(best.currentUtil * 100),
                        newUtil: Math.round(best.newUtil * 100),
                        reason: `Bundle: ${canFill.join('+')} (${rule.entity} ${rule.sourceFunction})`,
                        isProgramSpecialist: programSpecialistIds.includes(best.resource.id),
                        isSeeded: false,
                        isCrossSquad: bestCrossSquad,
                        isBundled: true,
                        bundleRule: `${rule.entity} ${rule.sourceFunction} → ${canFill.join('+')}`,
                        confidence: {
                            alternatives: scored.length - 1,
                            margin: scored.length > 1 ? Math.round(best.score - scored[1].score) : 0,
                            level: scored.length <= 2 ? 'tight' : scored.length <= 5 ? 'moderate' : 'comfortable'
                        }
                    });
                });

                if (bundledRoleNames.length > 0) {
                    // Track entity rule stats
                    entityRuleStats.bundleFills += bundledRoleNames.length;
                    const ruleKey = `${rule.entity} ${rule.sourceFunction} → ${canFill.join('+')}`;
                    entityRuleStats.bundlesByRule[ruleKey] = (entityRuleStats.bundlesByRule[ruleKey] || 0) + bundledRoleNames.length;
                    bundledResources.add(best.resource.id);
                    // Each bundle saves (bundledRoles - 1) resources vs individual assignment
                    entityRuleStats.freedResources += (bundledRoleNames.length - 1);
                    console.log(`[Optimizer] Bundle assigned: ${best.resource.name} → ${bundledRoleNames.join('+')} on ${project.name || project.customer} (${combinedDemandHpw.toFixed(1)} h/wk combined)`);

                    // Store remaining-role entity constraints from this rule
                    // e.g. { SC: 'FY' } means the unfilled SC must come from FY
                    if (rule.remainingConstraints && Object.keys(rule.remainingConstraints).length > 0) {
                        project._remainingEntityConstraints = {
                            ...(project._remainingEntityConstraints || {}),
                            ...rule.remainingConstraints
                        };
                        const constraintStr = Object.entries(rule.remainingConstraints).map(([r, e]) => `${r}→${e}`).join(', ');
                        console.log(`[Optimizer]   Remaining constraints: ${constraintStr}`);
                    }
                }
            }
        }

        // Fix #9: Sort roles by candidate scarcity (fewest viable candidates first)
        // This prevents burning scarce PD resources on projects that have many PD options
        const unseededGaps = gaps.filter(g => !seededRoles.has(g.role));
        const gapCandidateCounts = unseededGaps.map(g => {
            const matcherKey = g._baseRole || g.role;
            const matcher = ROLE_MATCHERS[matcherKey];
            const count = matcher ? validResources.filter(r => matcher(r)).length : 0;
            return { ...g, _candidateCount: count };
        });
        gapCandidateCounts.sort((a, b) => a._candidateCount - b._candidateCount);

        gapCandidateCounts.forEach(({ role, pct, _baseRole }) => {
            rolesNeeded++;

            // Calculate real demand hours/week for this role
            const demandHoursPerWeek = calculateWeeklyDemandHours(project, _baseRole || role);
            // Fallback: if no effort data, derive from pct (legacy compatibility)
            const effectiveDemandHpw = demandHoursPerWeek > 0 ? demandHoursPerWeek : (pct / 100) * 32;

            // Use _baseRole for matcher (multi-person roles have names like "SC (1/2)")
            const matcherKey = _baseRole || role;
            const matcher = ROLE_MATCHERS[matcherKey];
            if (!matcher) return;
            // FPS projects: only FY resources allowed
            const isFPS = (project.platform || '').toUpperCase().includes('FPS');
            // Exclude resources already assigned to another slot of this same role
            // Check remaining-role entity constraints from bundle rules
            const remainingConstraints = project._remainingEntityConstraints || {};
            const requiredEntity = remainingConstraints[matcherKey];
            const candidates = validResources.filter(r => {
                if (assignedResourceIds.has(r.id)) return false;
                if (isFPS && (r.origin || '').toUpperCase() !== 'FY') return false;
                // Enforce remaining-role entity constraint from bundle rule
                if (requiredEntity && requiredEntity !== 'ALL') {
                    if ((r.origin || '').toUpperCase() !== requiredEntity.toUpperCase()) return false;
                }
                // Primary role match OR entity-rule canFill match (Improvement F: permissive)
                if (matcher(r)) return true;
                // Check if any entityRoleRule allows this resource to fill this role
                if (entityRoleRules.length > 0) {
                    const resEntity = (r.origin || '').toUpperCase();
                    for (const rule of entityRoleRules) {
                        const ruleEntity = (rule.entity || '').toUpperCase();
                        if (ruleEntity !== 'ALL' && resEntity !== ruleEntity) continue;
                        const srcKey = rule.sourceFunction;
                        const srcMatch = srcKey === 'PM' ? r._matchesPM
                            : srcKey === 'SC' ? r._matchesSC
                                : srcKey === 'PD' ? r._matchesPD : false;
                        if (!srcMatch) continue;
                        if ((rule.canFill || []).includes(matcherKey)) {
                            r._entityFlexRole = true; // Mark for scoring penalty
                            return true;
                        }
                    }
                }
                return false;
            });

            const scored = candidates.map(r => {
                r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempBookedTotal = getTotalBooking(r.id);
                const result = scoreCandidateForRole(r, project, {
                    ...config,
                    _customerResourceMap: customerResourceMap,
                    _countrySquadMap: countrySquadMap,
                    _excludedSquads: excludedSquads,
                    _nowMs: nowMs,
                    _demandHoursPerWeek: effectiveDemandHpw,
                    _bookings: bookings,
                    _teamEntities: getTeamEntities(project),
                    _loadBalanceWeight: config._loadBalanceWeight
                });
                // Improvement F: Penalise entity-flex candidates vs primary matches
                if (result && r._entityFlexRole) {
                    result.score -= 15;
                    result.reasons.push(`Entity flex fill (-15)`);
                    result._isEntityFlex = true; // Track for stats
                    result._flexTargetRole = matcherKey; // Track which role was flexed into
                    delete r._entityFlexRole; // Clean up
                }
                return result;
            }).filter(Boolean);

            scored.sort((a, b) => b.score - a.score);

            // ── Greedy look-ahead: don't burn scarce resources on lower-priority projects ──
            // Check if the top candidate is the ONLY viable option for a higher-priority project
            if (scored.length > 0 && scored.length <= 3) {
                const topCandidate = scored[0];
                const projIdx = _pi; // Fix R2-5: Use loop index directly instead of O(n) indexOf
                // Scan next 5 higher-priority unfilled projects
                let isSoleCandidate = false;
                // Fix BUG-3: Scan forward (upcoming projects) not backward (already assigned)
                for (let fwd = projIdx + 1; fwd < Math.min(projIdx + 6, scheduled.length); fwd++) {
                    const futureProj = scheduled[fwd];
                    if (!futureProj) continue;
                    const futureScore = futureProj._reprioritization?.score || 0;
                    if (futureScore <= (project._reprioritization?.score || 0)) continue;
                    // Check if future project needs this role and this resource is the only candidate
                    const futureGaps = (futureProj.assignments || futureProj._gaps || []).filter(a =>
                        !a.resourceId && a.role.replace(/ \(\d+\/\d+\)/, '') === matcherKey
                    );
                    if (futureGaps.length > 0) {
                        const futureViable = validResources.filter(r =>
                            matcher(r) && r.id !== topCandidate.resource.id &&
                            ((getBookingInWindow(r.id, futureProj._startMs, futureProj._endMs) + effectiveDemandHpw) / (r.effectiveHours || 32)) <= 1.2
                        ).length;
                        if (futureViable === 0) {
                            // Top candidate is the ONLY option for a higher-priority project—skip
                            isSoleCandidate = true;
                            break;
                        }
                    }
                }
                if (isSoleCandidate && scored.length > 1) {
                    scored.shift(); // Remove top candidate, use second-best
                }
            }

            if (scored.length > 0) {
                // Fix D4: Close-score load-balance tiebreaker
                // When top candidates are within 25 pts, prefer the one with lower utilisation
                if (scored.length >= 2 && (scored[0].score - scored[1].score) < 25) {
                    // Find lowest-util candidate among those within 25pts of top
                    const threshold = scored[0].score - 25;
                    const closeGroup = scored.filter(s => s.score >= threshold);
                    closeGroup.sort((a, b) => (a.currentUtil || 0) - (b.currentUtil || 0));
                    scored.splice(0, scored.length, ...closeGroup, ...scored.filter(s => s.score < threshold));
                }
                const best = scored[0];
                rolesFilled++;
                assignedResourceIds.add(best.resource.id);

                // Track entity flex fill stats
                if (best._isEntityFlex) {
                    entityRuleStats.flexFills++;
                    const targetRole = best._flexTargetRole || matcherKey;
                    entityRuleStats.flexByRole[targetRole] = (entityRuleStats.flexByRole[targetRole] || 0) + 1;
                }

                bookings[best.resource.id] = bookings[best.resource.id] || [];
                addBooking(best.resource.id, project._startMs, project._endMs, effectiveDemandHpw);

                const customer = project.customer || '';
                if (customer) {
                    if (!customerResourceMap[best.resource.id]) customerResourceMap[best.resource.id] = [];
                    if (!customerResourceMap[best.resource.id].includes(customer)) {
                        customerResourceMap[best.resource.id].push(customer);
                    }
                    // Update customer-squad tracking
                    const bestCountry = project.country || '';
                    if (bestCountry && best.resource.squads?.[0]) {
                        const ck = `${customer}::${bestCountry}`;
                        if (!countrySquadMap[ck]) countrySquadMap[ck] = best.resource.squads[0];
                    }
                }

                if (project.resourcedWithinProgram && programSpecialistIds.includes(best.resource.id)) {
                    programAssignments++;
                }

                const bestResSquads = best.resource.squads || [];
                const bestProjSquads = project.squads || [];
                const bestCrossSquad = bestProjSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(bestProjSquads, bestResSquads);
                assignments.push({
                    role,
                    resourceId: best.resource.id,
                    resourceName: best.resource.name,
                    resourceHeadshot: best.resource.headshot || null,
                    resourceSquads: bestResSquads,
                    allocationPct: Math.round((effectiveDemandHpw / (best.resource.effectiveHours || 32)) * 100),
                    _demandHpw: effectiveDemandHpw, // Fix #12: Store real demand for load-levelling
                    score: Math.round(best.score),
                    currentUtil: Math.round(best.currentUtil * 100),
                    newUtil: Math.round(best.newUtil * 100),
                    reason: best.reasons.join(', '),
                    isProgramSpecialist: programSpecialistIds.includes(best.resource.id),
                    isSeeded: false,
                    isCrossSquad: bestCrossSquad,
                    confidence: {
                        alternatives: scored.length - 1,
                        margin: scored.length > 1 ? Math.round(best.score - scored[1].score) : 0,
                        level: scored.length <= 2 || (scored.length > 1 && best.score - scored[1].score <= 10)
                            ? 'tight' : scored.length <= 5 ? 'moderate' : 'comfortable'
                    }
                });
            } else {
                assignments.push({
                    role,
                    resourceId: null,
                    resourceName: null,
                    allocationPct: pct,
                    score: 0,
                    currentUtil: 0,
                    newUtil: 0,
                    reason: 'No matching resource available',
                    isProgramSpecialist: false,
                    isSeeded: false,
                    isCrossSquad: false
                });

                warnings.push({
                    projectId: project.id,
                    projectName: project.name,
                    type: 'no_resource_match',
                    message: `No ${role} available for "${project.name}" (${project.customer || 'unknown customer'}).`
                });
            }
        });

        project.assignments = assignments;

        // Incrementally update status map
        const allFilled = assignments.length > 0 && assignments.every(a => a.resourceId !== null);
        const newStatus = allFilled ? 'filled' : 'partial';
        if (newStatus === 'filled' && projectStatuses[project.id] !== 'filled') filledCount++;
        projectStatuses[project.id] = newStatus;
    }

    // ── Phase 1.5: Completeness check — defer partial projects, free their resources ──
    // If a project has some roles assigned but not all, those resources are wasted
    // (the project can't proceed without a full team). Free them for projects that
    // CAN be fully resourced. Exception: cornerstone (tier 1) keeps partial assignments.
    let freedFromPartial = 0;
    const partialProjectsFreed = [];
    for (const project of scheduled) {
        if (projectStatuses[project.id] !== 'partial') continue;
        // Don't free cornerstone or in-flight protected projects
        const tier = project._reprioritization?.tier || 99;
        if (tier <= 1) continue; // Cornerstone keeps partial
        if (project._lockedAssignment) continue;

        const assigns = project.assignments || [];
        const filledAssigns = assigns.filter(a => a.resourceId !== null && !a.isSeeded);
        if (filledAssigns.length === 0) continue; // Nothing to free

        // Un-book all non-seeded assignments
        let freedCount = 0;
        filledAssigns.forEach(a => {
            const freedResId = a.resourceId; // Capture before clearing
            const resBookings = bookings[freedResId];
            if (resBookings) {
                // Fix #2: Match the specific booking for this project, not just any nonzero booking
                const idx = resBookings.findIndex(b =>
                    b.startMs === project._startMs && b.endMs === project._endMs
                );
                // Fix BUG-4: Fallback matches on demand hpw to avoid removing wrong booking
                const expectedHpw = a._demandHpw || ((a.allocationPct || 25) / 100) * (resourceById[freedResId]?.effectiveHours || 32);
                const fallbackIdx = idx >= 0 ? idx : resBookings.findIndex(b => Math.abs(b.hpw - expectedHpw) < 2);
                if (fallbackIdx >= 0) {
                    const removedHpw = resBookings[fallbackIdx].hpw;
                    resBookings.splice(fallbackIdx, 1);
                    const res = resourceById[freedResId];
                    if (res) res._tempBooked = Math.max(0, (res._tempBooked || 0) - removedHpw);
                }
            }
            a.resourceId = null;
            a.resourceName = null;
            a.resourceHeadshot = null;
            a.resourceSquads = [];
            a.score = 0;
            a.reason = 'Freed — project not fully resourceable';
            a.isCrossSquad = false;
            rolesFilled--;
            freedCount++;
        });

        freedFromPartial += freedCount;
        partialProjectsFreed.push({ id: project.id, name: project.name, customer: project.customer, freedRoles: freedCount });
    }

    if (freedFromPartial > 0) {
        console.log(`[Optimizer] Phase 1.5: Freed ${freedFromPartial} resources from ${partialProjectsFreed.length} partial projects`);

        // ── Phase 1.5b: Re-assignment pass ──
        // Freed resources are now available. Re-run greedy fill for all projects
        // with unfilled roles, highest score first. This means freed projects
        // re-enter the flow if their score warrants it.
        const reAssignProjects = [...scheduled]
            .filter(p => p.assignments?.some(a => a.resourceId === null))
            .sort((a, b) => (b._reprioritization?.score || 0) - (a._reprioritization?.score || 0));

        let reAssignFills = 0;
        for (const project of reAssignProjects) {
            const gaps = project.assignments.filter(a => a.resourceId === null);
            const projSquads = project.squads || [];
            // Fix R2-6: Track resources already assigned on THIS project to prevent double-booking one person
            const assignedOnProjectRepass = new Set(
                (project.assignments || []).filter(a => a.resourceId).map(a => a.resourceId)
            );
            for (const gap of gaps) {
                const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
                const matcher = ROLE_MATCHERS[neededRole];
                if (!matcher) continue;

                const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;

                // Score all available candidates (same logic as Phase 1)
                const candidates = validResources.filter(r => matcher(r) && !assignedOnProjectRepass.has(r.id));
                const scored = candidates.map(r => {
                    r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempBookedTotal = getTotalBooking(r.id);
                    return scoreCandidateForRole(r, project, {
                        ...config,
                        _customerResourceMap: customerResourceMap,
                        _countrySquadMap: countrySquadMap,
                        _excludedSquads: excludedSquads,
                        _nowMs: nowMs,
                        _demandHoursPerWeek: demandHpw,
                        _bookings: bookings,
                        _teamEntities: getTeamEntities(project)
                    });
                }).filter(Boolean);
                scored.sort((a, b) => b.score - a.score);

                if (scored.length > 0) {
                    const best = scored[0];
                    // Verify the resource isn't already over-booked
                    if (best.newUtil <= 1.1) { // Allow up to 110%
                        addBooking(best.resource.id, project._startMs, project._endMs, demandHpw);
                        best.resource._tempBooked = (best.resource._tempBooked || 0) + demandHpw;
                        assignedOnProjectRepass.add(best.resource.id); // Fix R2-6: prevent reuse on same project

                        const bestResSquads = best.resource.squads || [];
                        const bestCrossSquad = projSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, bestResSquads);

                        gap.resourceId = best.resource.id;
                        gap.resourceName = best.resource.name;
                        gap.resourceHeadshot = best.resource.headshot || null;
                        gap.resourceSquads = bestResSquads;
                        gap.allocationPct = Math.round((demandHpw / (best.resource.effectiveHours || 32)) * 100);
                        gap.score = Math.round(best.score);
                        gap.currentUtil = Math.round(best.currentUtil * 100);
                        gap.newUtil = Math.round(best.newUtil * 100);
                        gap.reason = `Re-assigned after completeness optimization`;
                        gap.isCrossSquad = bestCrossSquad;
                        rolesFilled++;
                        reAssignFills++;
                    }
                }
            }

            // Update project status
            const allFilled = project.assignments.every(a => a.resourceId !== null);
            projectStatuses[project.id] = allFilled ? 'filled' : 'partial';
        }

        if (reAssignFills > 0) {
            console.log(`[Optimizer] Phase 1.5b: Re-assigned ${reAssignFills} roles after freeing partial resources`);
        }

        filledCount = Object.values(projectStatuses).filter(s => s === 'filled').length;
    }

    // ── Phase 1.7: Cross-squad fallback pass ──
    // For any still-unfilled roles, explicitly try cross-squad candidates
    // with relaxed utilization threshold. This is the "try harder" pass.
    let crossSquadFallbackFills = 0;
    const unfilledAfterPhase1 = scheduled.filter(p =>
        p.assignments?.some(a => a.resourceId === null) && !p._lockedAssignment
    ).sort((a, b) => (b._reprioritization?.score || 0) - (a._reprioritization?.score || 0));

    for (const project of unfilledAfterPhase1) {
        const gaps = project.assignments.filter(a => a.resourceId === null);
        const projSquads = project.squads || [];

        for (const gap of gaps) {
            const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
            const matcher = ROLE_MATCHERS[neededRole];
            if (!matcher) continue;
            const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;

            // Find cross-squad candidates specifically
            const crossSquadCandidates = validResources.filter(r => {
                if (!matcher(r)) return false;
                const resSquads = r.squads || [];
                // Must be from a different squad
                if (projSquads.length > 0 && resSquads.length > 0 && mergeLookup.areInSameGroup(projSquads, resSquads)) return false;
                // Relaxed utilization: up to 110% (Fix #13: aligned with main pipeline)
                const booked = getBookingInWindow(r.id, project._startMs, project._endMs);
                return (booked + demandHpw) / (r.effectiveHours || 32) <= 1.10;
            });

            if (crossSquadCandidates.length === 0) continue;

            const scored = crossSquadCandidates.map(r => {
                r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempBookedTotal = getTotalBooking(r.id);
                return scoreCandidateForRole(r, project, {
                    ...config,
                    _customerResourceMap: customerResourceMap,
                    _countrySquadMap: countrySquadMap,
                    _excludedSquads: excludedSquads,
                    _nowMs: nowMs,
                    _demandHoursPerWeek: demandHpw,
                    _bookings: bookings,
                    _teamEntities: getTeamEntities(project)
                });
            }).filter(Boolean);
            scored.sort((a, b) => b.score - a.score);

            if (scored.length > 0) {
                const best = scored[0];
                addBooking(best.resource.id, project._startMs, project._endMs, demandHpw);

                gap.resourceId = best.resource.id;
                gap.resourceName = best.resource.name;
                gap.resourceHeadshot = best.resource.headshot || null;
                gap.resourceSquads = best.resource.squads || [];
                gap.allocationPct = Math.round((demandHpw / (best.resource.effectiveHours || 32)) * 100);
                gap.score = Math.round(best.score);
                gap.currentUtil = Math.round(best.currentUtil * 100);
                gap.newUtil = Math.round(best.newUtil * 100);
                gap.reason = `Cross-squad fallback (${(best.resource.squads || []).join(',')})`;
                gap.isCrossSquad = projSquads.length > 0 && gap.resourceSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, gap.resourceSquads);
                rolesFilled++;
                crossSquadFallbackFills++;
            }
        }

        const allFilled = project.assignments.every(a => a.resourceId !== null);
        projectStatuses[project.id] = allFilled ? 'filled' : 'partial';
    }

    if (crossSquadFallbackFills > 0) {
        console.log(`[Optimizer] Phase 1.7: Filled ${crossSquadFallbackFills} roles via cross-squad fallback`);
        filledCount = Object.values(projectStatuses).filter(s => s === 'filled').length;
    }

    // ── Phase 1.8: Secondary role fallback ──
    // For remaining unfilled roles, try resources whose SECONDARY role matches.
    // E.g. a PD with secondary:'SC' can fill an SC gap (with a scoring penalty).
    // This prevents deferrals when one role type is scarce but another has surplus.
    const SECONDARY_ROLE_MAP = {
        PM: 'SC',  // For PM gaps, try SC resources as fallback
        SC: 'PD',  // For SC gaps, try PD resources as fallback
        PD: 'SC',  // For PD gaps, try SC resources as fallback (less common)
    };
    let secondaryFills = 0;
    for (const project of scheduled) {
        if (projectStatuses[project.id] === 'filled') continue;
        const unfilled = (project.assignments || []).filter(a => a.resourceId === null);
        if (unfilled.length === 0) continue;
        const projSquads = project.squads || [];

        for (const gap of unfilled) {
            const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
            const secondarySource = SECONDARY_ROLE_MAP[neededRole];
            if (!secondarySource) continue; // No secondary for PM

            const secondaryMatcher = ROLE_MATCHERS[secondarySource];
            if (!secondaryMatcher) continue;

            const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;

            // Find resources whose PRIMARY role is the secondary source
            const candidates = validResources.filter(r => {
                if (!secondaryMatcher(r)) return false;
                // Must have capacity
                const booked = getBookingInWindow(r.id, project._startMs, project._endMs);
                return (booked + demandHpw) / (r.effectiveHours || 32) <= 1.10;
            });

            const scored = candidates.map(r => {
                r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                r._tempBookedTotal = getTotalBooking(r.id);
                const result = scoreCandidateForRole(r, project, {
                    ...config,
                    _customerResourceMap: customerResourceMap,
                    _countrySquadMap: countrySquadMap,
                    _excludedSquads: excludedSquads,
                    _nowMs: nowMs,
                    _demandHoursPerWeek: demandHpw,
                    _bookings: bookings,
                    _teamEntities: getTeamEntities(project)
                });
                if (!result) return null;
                // Penalty for secondary role fill (prefer primary matches)
                result.score -= 20;
                result.reasons.push(`Secondary role (${secondarySource}→${neededRole})`);
                return result;
            }).filter(Boolean);
            scored.sort((a, b) => b.score - a.score);

            if (scored.length > 0 && scored[0].score > -50) {
                const best = scored[0];
                addBooking(best.resource.id, project._startMs, project._endMs, demandHpw);
                best.resource._tempBooked = (best.resource._tempBooked || 0) + demandHpw;

                const bestResSquads = best.resource.squads || [];
                gap.resourceId = best.resource.id;
                gap.resourceName = best.resource.name;
                gap.resourceHeadshot = best.resource.headshot || null;
                gap.resourceSquads = bestResSquads;
                gap.allocationPct = Math.round((demandHpw / (best.resource.effectiveHours || 32)) * 100);
                gap.score = Math.round(best.score);
                gap.currentUtil = Math.round(best.currentUtil * 100);
                gap.newUtil = Math.round(best.newUtil * 100);
                gap.reason = `Secondary role fill: ${secondarySource}→${neededRole} (${best.resource.name})`;
                gap.isCrossSquad = projSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, bestResSquads);
                gap.isSecondaryRole = true;
                rolesFilled++;
                secondaryFills++;
            }
        }

        const allFilled = project.assignments.every(a => a.resourceId !== null);
        projectStatuses[project.id] = allFilled ? 'filled' : 'partial';
    }
    if (secondaryFills > 0) {
        console.log(`[Optimizer] Phase 1.8: Filled ${secondaryFills} roles via secondary role fallback`);
        filledCount = Object.values(projectStatuses).filter(s => s === 'filled').length;
    }

    // ── Phase 1.9: Fractional Resource Pooling ──
    // When a customer has multiple projects needing the same role at low allocation,
    // consolidate: assign one resource to cover all of them instead of N different ones.
    // This reduces context-switching, improves customer familiarity, and frees resources.
    let poolConsolidations = 0;
    {
        // Group assignments by customer + role + resource to find pool candidates
        const customerRoleAssignments = {}; // "customer::role" → [{ project, assignment, idx }]
        scheduled.forEach(p => {
            const customer = p.customer || '';
            if (!customer) return;
            (p.assignments || []).forEach((a, idx) => {
                if (!a.resourceId) return;
                const baseRole = (a.role || '').replace(/ \(\d+\/\d+\)/, '');
                const key = `${customer}::${baseRole}`;
                if (!customerRoleAssignments[key]) customerRoleAssignments[key] = [];
                customerRoleAssignments[key].push({ project: p, assignment: a, idx, resourceId: a.resourceId });
            });
        });

        // For each customer+role group, check if different resources are each doing <40%
        for (const [key, entries] of Object.entries(customerRoleAssignments)) {
            if (entries.length < 3) continue; // Need at least 3 projects to be worth pooling

            // Group by resource within this customer+role
            const byResource = {};
            entries.forEach(e => {
                if (!byResource[e.resourceId]) byResource[e.resourceId] = [];
                byResource[e.resourceId].push(e);
            });

            // Count how many DIFFERENT resources are used
            const uniqueResources = Object.keys(byResource);
            if (uniqueResources.length < 2) continue; // Already pooled — one resource covers all

            // Find resources assigned at low utilisation (<40% per project)
            const lowUtilResources = uniqueResources.filter(resId => {
                const resEntries = byResource[resId];
                return resEntries.every(e => (e.assignment.allocationPct || 25) < 40);
            });

            if (lowUtilResources.length < 2) continue; // Not enough low-util fragmentation

            // Pick the resource with lowest TOTAL booking as the pool anchor
            let bestAnchor = null;
            let bestAnchorTotal = Infinity;
            for (const resId of lowUtilResources) {
                const total = getTotalBooking(resId);
                if (total < bestAnchorTotal) {
                    bestAnchorTotal = total;
                    bestAnchor = resId;
                }
            }
            if (!bestAnchor) continue;

            const anchorRes = resourceById[bestAnchor];
            if (!anchorRes) continue;
            const anchorCap = anchorRes.effectiveHours || 32;

            // Try to absorb other resources' assignments into the anchor
            for (const otherResId of lowUtilResources) {
                if (otherResId === bestAnchor) continue;
                const otherEntries = byResource[otherResId];
                if (!otherEntries || otherEntries.length === 0) continue;

                // Check: would absorbing these push the anchor above 85%?
                let additionalHpw = 0;
                for (const e of otherEntries) {
                    const demandHpw = calculateWeeklyDemandHours(e.project, (e.assignment.role || '').replace(/ \(\d+\/\d+\)/, '')) || 8;
                    additionalHpw += demandHpw;
                }

                const anchorCurrentTotal = getTotalBooking(bestAnchor);
                if ((anchorCurrentTotal + additionalHpw) / anchorCap > 0.85) continue; // Would overload

                // Execute the consolidation
                for (const e of otherEntries) {
                    const baseRole = (e.assignment.role || '').replace(/ \(\d+\/\d+\)/, '');
                    const demandHpw = calculateWeeklyDemandHours(e.project, baseRole) || 8;

                    // Remove old booking for the other resource
                    const oldBookings = bookings[otherResId] || [];
                    for (let bi = oldBookings.length - 1; bi >= 0; bi--) {
                        if (oldBookings[bi].startMs === e.project._startMs && oldBookings[bi].endMs === e.project._endMs) {
                            oldBookings.splice(bi, 1);
                            break;
                        }
                    }

                    // Add booking for anchor
                    addBooking(bestAnchor, e.project._startMs, e.project._endMs, demandHpw);

                    // Update the assignment to point to anchor
                    e.assignment.resourceId = bestAnchor;
                    e.assignment.resourceName = anchorRes.name;
                    e.assignment.resourceHeadshot = anchorRes.headshot || null;
                    e.assignment.resourceSquads = anchorRes.squads || [];
                    e.assignment.reason = `Pool consolidation: ${anchorRes.name} covers ${key.split('::')[0]} ${baseRole} across ${otherEntries.length + (byResource[bestAnchor]?.length || 0)} projects`;
                    e.assignment.isPooled = true;
                    poolConsolidations++;
                }
            }
        }
    }
    if (poolConsolidations > 0) {
        console.log(`[Optimizer] Phase 1.9: ${poolConsolidations} assignments consolidated via resource pooling`);
    }

    // ── Phase 2: Cascading priority resource rebalancing ──
    // Iterate projects in priority order (highest score first).
    // For each unfilled role, steal from lowest-score project — same-squad first.
    // Locked projects (lockSquad/lockResources) are protected from stealing.
    const projectsByScoreDesc = [...scheduled].sort((a, b) =>
        (b._reprioritization?.score || 0) - (a._reprioritization?.score || 0)
    );

    let stealsPerformed = 0;
    let crossSquadSteals = 0;
    const MAX_STEALS = 200; // Safety cap

    for (const project of projectsByScoreDesc) {
        if (stealsPerformed >= MAX_STEALS) break;
        const unfilled = project.assignments?.filter(a => a.resourceId === null) || [];
        if (unfilled.length === 0) continue;

        const projScore = project._reprioritization?.score || 0;
        const projSquads = project.squads || [];

        for (const gap of unfilled) {
            if (stealsPerformed >= MAX_STEALS) break;
            const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');

            // Two-pass donor search: 1) same-squad first, 2) cross-squad fallback
            let bestDonor = null;
            let bestDonorAssignment = null;
            let bestDonorScore = Infinity;
            let isCrossSquadSteal = false;

            for (let pass = 0; pass < 2; pass++) {
                if (bestDonor) break; // Found in first pass
                bestDonorScore = Infinity;

                for (const candidate of scheduled) {
                    if (candidate.id === project.id) continue;
                    // Protected: locked projects can't be stolen from
                    if (candidate.lockSquad || candidate.lockResources || candidate._lockedAssignment) continue;
                    const candScore = candidate._reprioritization?.score || 0;
                    if (candScore >= projScore) continue;
                    if (candScore >= bestDonorScore) continue;

                    // Pass 0: same-squad/merge-group only. Pass 1: any squad.
                    if (pass === 0 && projSquads.length > 0) {
                        const candSquads = candidate.squads || [];
                        if (!mergeLookup.areInSameGroup(projSquads, candSquads)) continue;
                    }

                    const match = candidate.assignments?.find(a =>
                        a.resourceId !== null &&
                        !a.isSeeded &&
                        a.role.replace(/ \(\d+\/\d+\)/, '') === neededRole
                    );
                    if (match) {
                        // Smart donor selection: count replacement options for this donor's project+role
                        const donorResId = match.resourceId;
                        const replacementCount = validResources.filter(r =>
                            r.id !== donorResId &&
                            ROLE_MATCHERS[neededRole]?.(r) &&
                            (getTotalBooking(r.id) / (r.effectiveHours || 32)) < 0.9
                        ).length;

                        // Skip donors that have NO replacement options (only possible match)
                        if (replacementCount === 0) continue;

                        // Prefer donors with MORE replacement options (adjust effective score)
                        // More replacements = lower effective score = better steal target
                        const adjustedScore = candScore - Math.min(10, replacementCount * 2);
                        if (adjustedScore >= bestDonorScore) continue;

                        bestDonor = candidate;
                        bestDonorAssignment = match;
                        bestDonorScore = adjustedScore;
                        isCrossSquadSteal = pass === 1;
                    }
                }
            }

            if (!bestDonor || !bestDonorAssignment) continue;

            const stolenRes = resourceById[bestDonorAssignment.resourceId];
            if (!stolenRes) continue;
            if (!ROLE_MATCHERS[neededRole]?.(stolenRes)) continue;

            // Un-book from donor — match by donor project's time window
            const donorBookings = bookings[bestDonorAssignment.resourceId];
            if (donorBookings) {
                const idx = donorBookings.findIndex(b =>
                    b.startMs === bestDonor._startMs && b.endMs === bestDonor._endMs
                );
                // Fix BUG-4: Fallback matches on demand hpw to avoid removing wrong booking
                const expectedHpw = bestDonorAssignment._demandHpw || ((bestDonorAssignment.allocationPct || 25) / 100) * (stolenRes.effectiveHours || 32);
                const fallbackIdx = idx >= 0 ? idx : donorBookings.findIndex(b => Math.abs(b.hpw - expectedHpw) < 2);
                if (fallbackIdx >= 0) {
                    const removedHpw = donorBookings[fallbackIdx].hpw;
                    donorBookings.splice(fallbackIdx, 1);
                    stolenRes._tempBooked = Math.max(0, (stolenRes._tempBooked || 0) - removedHpw);
                }
            }

            // Book onto higher-priority project
            const demandHpw = calculateWeeklyDemandHours(project, neededRole) ||
                ((gap.allocationPct || 25) / 100) * (stolenRes.effectiveHours || 32);
            addBooking(bestDonorAssignment.resourceId, project._startMs, project._endMs, demandHpw);
            stolenRes._tempBooked = (stolenRes._tempBooked || 0) + demandHpw;

            // Determine cross-squad status
            const stolenResSquads = stolenRes.squads || [];
            const actualCrossSquad = projSquads.length > 0 && stolenResSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, stolenResSquads);

            // Transfer assignment
            gap.resourceId = bestDonorAssignment.resourceId;
            gap.resourceName = bestDonorAssignment.resourceName;
            gap.resourceHeadshot = stolenRes.headshot || null;
            gap.resourceSquads = stolenResSquads;
            gap.allocationPct = Math.round((demandHpw / (stolenRes.effectiveHours || 32)) * 100);
            gap.score = 250;
            gap.reason = `Priority rebalance from "${(bestDonor.customer || bestDonor.name || '').substring(0, 25)}" (score ${Math.round(bestDonorScore)})${actualCrossSquad ? ' ⚠️ cross-squad' : ''}`;
            gap.isSeeded = false;
            gap.isCrossSquad = actualCrossSquad;

            // Vacate donor
            bestDonorAssignment.resourceId = null;
            bestDonorAssignment.resourceName = null;
            bestDonorAssignment.resourceHeadshot = null;
            bestDonorAssignment.resourceSquads = [];
            bestDonorAssignment.score = 0;
            bestDonorAssignment.reason = `Reassigned to higher-priority "${(project.customer || project.name || '').substring(0, 25)}" (score ${Math.round(projScore)})`;
            bestDonorAssignment.isCrossSquad = false;

            // Update statuses
            projectStatuses[project.id] = project.assignments.every(a => a.resourceId !== null) ? 'filled' : 'partial';
            projectStatuses[bestDonor.id] = bestDonor.assignments.every(a => a.resourceId !== null) ? 'filled' : 'partial';
            stealsPerformed++;
            if (actualCrossSquad) crossSquadSteals++;
        }
    }

    if (stealsPerformed > 0) {
        console.log(`[Optimizer] Phase 2: ${stealsPerformed} priority rebalances (${crossSquadSteals} cross-squad)`);
        filledCount = Object.values(projectStatuses).filter(s => s === 'filled').length;
    }

    // ── Phase 2.5: Post-steal completeness check ──
    // Phase 2 steals can create NEW partial projects (the donors that got stolen from).
    // Run completeness check again to free wasted resources from those donors.
    let postStealFreed = 0;
    for (const project of scheduled) {
        if (projectStatuses[project.id] !== 'partial') continue;
        const tier = project._reprioritization?.tier || 99;
        if (tier <= 1) continue;
        if (project._lockedAssignment) continue;

        const assigns = project.assignments || [];
        const filledAssigns = assigns.filter(a => a.resourceId !== null && !a.isSeeded);
        if (filledAssigns.length === 0) continue;
        // Only free if MORE than half the roles are unfilled (don't be too aggressive)
        const unfilledCount = assigns.filter(a => a.resourceId === null).length;
        if (unfilledCount <= filledAssigns.length) continue; // More filled than unfilled — keep

        filledAssigns.forEach(a => {
            const freedResId = a.resourceId;
            const resBookings = bookings[freedResId];
            if (resBookings) {
                // Match booking by project time window
                const idx = resBookings.findIndex(b =>
                    b.startMs === project._startMs && b.endMs === project._endMs
                );
                // Fix BUG-4: Fallback matches on demand hpw to avoid removing wrong booking
                const expectedHpw = a._demandHpw || ((a.allocationPct || 25) / 100) * (resourceById[freedResId]?.effectiveHours || 32);
                const fallbackIdx = idx >= 0 ? idx : resBookings.findIndex(b => Math.abs(b.hpw - expectedHpw) < 2);
                if (fallbackIdx >= 0) {
                    const removedHpw = resBookings[fallbackIdx].hpw;
                    resBookings.splice(fallbackIdx, 1);
                    // Fix R2-4: Restore _tempBooked on freed resource
                    const res = resourceById[freedResId];
                    if (res) res._tempBooked = Math.max(0, (res._tempBooked || 0) - removedHpw);
                }
            }
            a.resourceId = null;
            a.resourceName = null;
            a.resourceHeadshot = null;
            a.resourceSquads = [];
            a.score = 0;
            a.reason = 'Freed — donor now partial after steal';
            a.isCrossSquad = false;
            rolesFilled--;
            postStealFreed++;
        });
    }
    if (postStealFreed > 0) {
        console.log(`[Optimizer] Phase 2.5: Freed ${postStealFreed} resources from post-steal partial donors`);
    }

    // ── Phase 3: 2-opt swap optimization ──
    // Try pairwise resource swaps between projects. If swapping improves
    // total squad-affinity score for both projects, execute the swap.
    let swapsPerformed = 0;
    const MAX_SWAPS = 100;
    const MAX_SWAP_ITERATIONS = 3;

    for (let swapIter = 0; swapIter < MAX_SWAP_ITERATIONS; swapIter++) {
        let swapsThisRound = 0;
        const allAssigned = [];
        scheduled.forEach(p => {
            (p.assignments || []).forEach((a, idx) => {
                if (a.resourceId && !a.isSeeded) {
                    allAssigned.push({ project: p, assignment: a, idx });
                }
            });
        });

        for (let i = 0; i < allAssigned.length && swapsPerformed < MAX_SWAPS; i++) {
            const entryA = allAssigned[i];
            const roleA = entryA.assignment.role.replace(/ \(\d+\/\d+\)/, '');

            for (let j = i + 1; j < allAssigned.length && swapsPerformed < MAX_SWAPS; j++) {
                const entryB = allAssigned[j];
                const roleB = entryB.assignment.role.replace(/ \(\d+\/\d+\)/, '');
                if (roleA !== roleB) continue; // Only swap same-role assignments
                if (entryA.project.id === entryB.project.id) continue;

                const resA = resourceById[entryA.assignment.resourceId];
                const resB = resourceById[entryB.assignment.resourceId];
                if (!resA || !resB) continue;

                // Score A on project B, and B on project A
                const squadsA = resA.squads || [];
                const squadsB = resB.squads || [];
                const projSquadsA = entryA.project.squads || [];
                const projSquadsB = entryB.project.squads || [];

                const currentAffinityA = mergeLookup.areInSameGroup(squadsA, projSquadsA) ? 50 : -20;
                const currentAffinityB = mergeLookup.areInSameGroup(squadsB, projSquadsB) ? 50 : -20;
                const swappedAffinityA = mergeLookup.areInSameGroup(squadsB, projSquadsA) ? 50 : -20; // B on project A
                const swappedAffinityB = mergeLookup.areInSameGroup(squadsA, projSquadsB) ? 50 : -20; // A on project B

                const currentTotal = currentAffinityA + currentAffinityB;
                const swappedTotal = swappedAffinityA + swappedAffinityB;

                if (swappedTotal > currentTotal) {
                    // Execute swap
                    const tmpId = entryA.assignment.resourceId;
                    const tmpName = entryA.assignment.resourceName;
                    const tmpHead = entryA.assignment.resourceHeadshot;
                    const tmpSquads = entryA.assignment.resourceSquads;

                    entryA.assignment.resourceId = entryB.assignment.resourceId;
                    entryA.assignment.resourceName = entryB.assignment.resourceName;
                    entryA.assignment.resourceHeadshot = entryB.assignment.resourceHeadshot;
                    entryA.assignment.resourceSquads = entryB.assignment.resourceSquads;
                    entryA.assignment.isCrossSquad = !mergeLookup.areInSameGroup(squadsB, projSquadsA);
                    entryA.assignment.reason = '2-opt swap';

                    entryB.assignment.resourceId = tmpId;
                    entryB.assignment.resourceName = tmpName;
                    entryB.assignment.resourceHeadshot = tmpHead;
                    entryB.assignment.resourceSquads = tmpSquads;
                    entryB.assignment.isCrossSquad = !mergeLookup.areInSameGroup(squadsA, projSquadsB);
                    entryB.assignment.reason = '2-opt swap';

                    swapsPerformed++;
                    swapsThisRound++;

                    // Update bookings: swap booking entries between the two resources
                    const resAId = tmpId; // original A resource
                    const resBId = entryA.assignment.resourceId; // original B resource (now on A)
                    const projAStart = entryA.project._startMs, projAEnd = entryA.project._endMs;
                    const projBStart = entryB.project._startMs, projBEnd = entryB.project._endMs;
                    // Remove A's booking on project A
                    const bkA = bookings[resAId] || [];
                    const idxA = bkA.findIndex(b => b.startMs === projAStart && b.endMs === projAEnd);
                    const hpwA = idxA >= 0 ? bkA.splice(idxA, 1)[0].hpw : 0;
                    // Remove B's booking on project B
                    const bkB = bookings[resBId] || [];
                    const idxB = bkB.findIndex(b => b.startMs === projBStart && b.endMs === projBEnd);
                    const hpwB = idxB >= 0 ? bkB.splice(idxB, 1)[0].hpw : 0;
                    // Add A's new booking on project B, B's new booking on project A
                    if (hpwA > 0) addBooking(resAId, projBStart, projBEnd, hpwA);
                    if (hpwB > 0) addBooking(resBId, projAStart, projAEnd, hpwB);
                }
            }
        }
        if (swapsThisRound === 0) break; // Converged
    }
    if (swapsPerformed > 0) {
        console.log(`[Optimizer] Phase 3: ${swapsPerformed} resource swaps improved squad affinity`);
    }

    // ── Phase 3b: 3-opt chain swaps (triangular rotation) ──
    // Test A→B, B→C, C→A rotations for same-role assignments across 3 projects.
    // This unlocks improvements that pairwise swaps can't reach.
    let chainSwaps = 0;
    const MAX_CHAIN_SWAPS = 50;
    {
        // Group all assignments by base role
        const byRole = {};
        scheduled.forEach(p => {
            (p.assignments || []).forEach((a, idx) => {
                if (a.resourceId && !a.isSeeded) {
                    const role = (a.role || '').replace(/ \(\d+\/\d+\)/, '');
                    if (!byRole[role]) byRole[role] = [];
                    byRole[role].push({ project: p, assignment: a, idx });
                }
            });
        });

        for (const [role, entries] of Object.entries(byRole)) {
            if (entries.length < 3 || chainSwaps >= MAX_CHAIN_SWAPS) break;

            // Test triples — limit to first 60 entries per role for performance
            const subset = entries.slice(0, 60);
            for (let i = 0; i < subset.length - 2 && chainSwaps < MAX_CHAIN_SWAPS; i++) {
                for (let j = i + 1; j < subset.length - 1 && chainSwaps < MAX_CHAIN_SWAPS; j++) {
                    for (let k = j + 1; k < subset.length && chainSwaps < MAX_CHAIN_SWAPS; k++) {
                        const eA = subset[i], eB = subset[j], eC = subset[k];
                        if (eA.project.id === eB.project.id || eB.project.id === eC.project.id || eA.project.id === eC.project.id) continue;

                        const rA = resourceById[eA.assignment.resourceId];
                        const rB = resourceById[eB.assignment.resourceId];
                        const rC = resourceById[eC.assignment.resourceId];
                        if (!rA || !rB || !rC) continue;

                        const sA = rA.squads || [], sB = rB.squads || [], sC = rC.squads || [];
                        const pA = eA.project.squads || [], pB = eB.project.squads || [], pC = eC.project.squads || [];

                        const affinityScore = (resSquads, projSquads) => mergeLookup.areInSameGroup(resSquads, projSquads) ? 50 : -20;

                        const current = affinityScore(sA, pA) + affinityScore(sB, pB) + affinityScore(sC, pC);

                        // Clockwise: A→projB, B→projC, C→projA
                        const cw = affinityScore(sA, pB) + affinityScore(sB, pC) + affinityScore(sC, pA);
                        // Counter-clockwise: A→projC, C→projB, B→projA
                        const ccw = affinityScore(sA, pC) + affinityScore(sC, pB) + affinityScore(sB, pA);

                        const bestRotation = cw >= ccw ? cw : ccw;
                        if (bestRotation <= current) continue;

                        // Execute the better rotation
                        const isClockwise = cw >= ccw;
                        const tmpA = { id: eA.assignment.resourceId, name: eA.assignment.resourceName, head: eA.assignment.resourceHeadshot, squads: eA.assignment.resourceSquads };
                        const tmpB = { id: eB.assignment.resourceId, name: eB.assignment.resourceName, head: eB.assignment.resourceHeadshot, squads: eB.assignment.resourceSquads };
                        const tmpC = { id: eC.assignment.resourceId, name: eC.assignment.resourceName, head: eC.assignment.resourceHeadshot, squads: eC.assignment.resourceSquads };

                        if (isClockwise) {
                            // A→B, B→C, C→A
                            Object.assign(eA.assignment, { resourceId: tmpC.id, resourceName: tmpC.name, resourceHeadshot: tmpC.head, resourceSquads: tmpC.squads, reason: '3-opt chain swap' });
                            Object.assign(eB.assignment, { resourceId: tmpA.id, resourceName: tmpA.name, resourceHeadshot: tmpA.head, resourceSquads: tmpA.squads, reason: '3-opt chain swap' });
                            Object.assign(eC.assignment, { resourceId: tmpB.id, resourceName: tmpB.name, resourceHeadshot: tmpB.head, resourceSquads: tmpB.squads, reason: '3-opt chain swap' });
                        } else {
                            // A→C, C→B, B→A
                            Object.assign(eA.assignment, { resourceId: tmpB.id, resourceName: tmpB.name, resourceHeadshot: tmpB.head, resourceSquads: tmpB.squads, reason: '3-opt chain swap' });
                            Object.assign(eB.assignment, { resourceId: tmpC.id, resourceName: tmpC.name, resourceHeadshot: tmpC.head, resourceSquads: tmpC.squads, reason: '3-opt chain swap' });
                            Object.assign(eC.assignment, { resourceId: tmpA.id, resourceName: tmpA.name, resourceHeadshot: tmpA.head, resourceSquads: tmpA.squads, reason: '3-opt chain swap' });
                        }
                        // Fix R2-3: Update bookings for 3-opt chain swaps
                        const pAStart = eA.project._startMs, pAEnd = eA.project._endMs;
                        const pBStart = eB.project._startMs, pBEnd = eB.project._endMs;
                        const pCStart = eC.project._startMs, pCEnd = eC.project._endMs;
                        // Remove old bookings
                        const bkRA = bookings[tmpA.id] || [];
                        const bkRB = bookings[tmpB.id] || [];
                        const bkRC = bookings[tmpC.id] || [];
                        const removeBooking = (bk, startMs, endMs) => { const i = bk.findIndex(b => b.startMs === startMs && b.endMs === endMs); return i >= 0 ? bk.splice(i, 1)[0].hpw : 0; };
                        const hA = removeBooking(bkRA, pAStart, pAEnd);
                        const hB = removeBooking(bkRB, pBStart, pBEnd);
                        const hC = removeBooking(bkRC, pCStart, pCEnd);
                        // Fix BUG-6: Use project-specific demand for new bookings, not the removed hpw
                        const demandA = calculateWeeklyDemandHours(eA.project, role) || hA || 8;
                        const demandB = calculateWeeklyDemandHours(eB.project, role) || hB || 8;
                        const demandC = calculateWeeklyDemandHours(eC.project, role) || hC || 8;
                        // Add new bookings based on rotation (resource→new project gets that project's demand)
                        if (isClockwise) {
                            // C→projA, A→projB, B→projC
                            if (demandA > 0) addBooking(tmpC.id, pAStart, pAEnd, demandA);
                            if (demandB > 0) addBooking(tmpA.id, pBStart, pBEnd, demandB);
                            if (demandC > 0) addBooking(tmpB.id, pCStart, pCEnd, demandC);
                        } else {
                            // B→projA, C→projB, A→projC
                            if (demandA > 0) addBooking(tmpB.id, pAStart, pAEnd, demandA);
                            if (demandB > 0) addBooking(tmpC.id, pBStart, pBEnd, demandB);
                            if (demandC > 0) addBooking(tmpA.id, pCStart, pCEnd, demandC);
                        }
                        chainSwaps++;
                    }
                }
            }
        }
    }
    if (chainSwaps > 0) {
        console.log(`[Optimizer] Phase 3b: ${chainSwaps} chain swaps (3-opt) improved squad affinity`);
    }

    // ── Phase 3.5: Unified Timeline Optimization ──
    // For unfilled projects, evaluate three strategies and pick the best:
    // 1. Nudge: shift start/end later by +1/+2 weeks
    // 2. Compress: shorten duration by -2/-4/-6 weeks (end date earlier)
    // 3. Both: nudge + compress combined
    // Respects locked dates and compelling events for compression.
    let timelineChanges = 0;
    let timelineFills = 0;
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const MIN_DURATION_MS = 6 * ONE_WEEK_MS; // Don't compress below 6 weeks

    for (const project of scheduled) {
        if (project.lockLaunch) continue;
        const unfilled = (project.assignments || []).filter(a => a.resourceId === null);
        if (unfilled.length === 0) continue;

        const origStartMs = project._startMs || 0;
        const origEndMs = project._endMs || 0;
        if (!origStartMs || !origEndMs) continue;
        const durationMs = origEndMs - origStartMs;
        const canCompress = !project.compellingEvent && !project._lockedAssignment && durationMs > MIN_DURATION_MS;

        // Helper: count fillable roles at a given window
        const countFillable = (testStart, testEnd) => {
            let count = 0;
            for (const gap of unfilled) {
                const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
                const matcher = ROLE_MATCHERS[neededRole];
                if (!matcher) continue;
                const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;
                // Fix R2-B: Use peak booking and 120% threshold (aligned with Phase 1 hard cap)
                const available = validResources.some(r => {
                    if (!matcher(r)) return false;
                    const peakBooked = getPeakBookingInWindow(r.id, testStart, testEnd);
                    return (peakBooked + demandHpw) / (r.effectiveHours || 32) <= 1.2;
                });
                if (available) count++;
            }
            return count;
        };

        let bestStrategy = null; // { type, nudgeWeeks, compressWeeks, fillCount, startMs, endMs }

        // Strategy 1: Nudge only (+1, +2 weeks)
        for (const nudge of [1, 2]) {
            const testStart = origStartMs + nudge * ONE_WEEK_MS;
            const testEnd = origEndMs + nudge * ONE_WEEK_MS;
            const fills = countFillable(testStart, testEnd);
            if (fills > 0 && (!bestStrategy || fills > bestStrategy.fillCount)) {
                bestStrategy = { type: 'nudge', nudgeWeeks: nudge, compressWeeks: 0, fillCount: fills, startMs: testStart, endMs: testEnd };
            }
        }

        // Strategy 2: Compress only (-2, -4, -6 weeks)
        if (canCompress) {
            for (const compress of [2, 4, 6]) {
                const testEnd = origEndMs - compress * ONE_WEEK_MS;
                if (testEnd - origStartMs < MIN_DURATION_MS) continue;
                const fills = countFillable(origStartMs, testEnd);
                // Prefer compress over nudge at equal fill count (no delivery delay)
                if (fills > 0 && (!bestStrategy || fills > bestStrategy.fillCount || (fills === bestStrategy.fillCount && bestStrategy.type === 'nudge'))) {
                    bestStrategy = { type: 'compress', nudgeWeeks: 0, compressWeeks: compress, fillCount: fills, startMs: origStartMs, endMs: testEnd };
                }
            }
        }

        // Strategy 3: Both (nudge + compress)
        if (canCompress) {
            for (const nudge of [1, 2]) {
                for (const compress of [2, 4]) {
                    const testStart = origStartMs + nudge * ONE_WEEK_MS;
                    const testEnd = origEndMs + nudge * ONE_WEEK_MS - compress * ONE_WEEK_MS;
                    if (testEnd - testStart < MIN_DURATION_MS) continue;
                    const fills = countFillable(testStart, testEnd);
                    if (fills > 0 && (!bestStrategy || fills > bestStrategy.fillCount)) {
                        bestStrategy = { type: 'both', nudgeWeeks: nudge, compressWeeks: compress, fillCount: fills, startMs: testStart, endMs: testEnd };
                    }
                }
            }
        }

        // Apply best strategy
        if (bestStrategy && bestStrategy.fillCount > 0) {
            project._startMs = bestStrategy.startMs;
            project._endMs = bestStrategy.endMs;

            if (bestStrategy.nudgeWeeks > 0) project._dateNudge = bestStrategy.nudgeWeeks;
            if (bestStrategy.compressWeeks > 0) project._compression = bestStrategy.compressWeeks;
            project._timelineStrategy = bestStrategy.type;

            // Update date fields
            if (project.startDate) project.startDate = new Date(project._startMs).toISOString();
            if (project.kickOff) project.kickOff = new Date(project._startMs).toISOString().split('T')[0];
            if (project.endDate) project.endDate = new Date(project._endMs).toISOString();
            if (project.launch) project.launch = new Date(project._endMs).toISOString().split('T')[0];

            // Fill gaps at the new timeline
            const projSquads = project.squads || [];
            for (const gap of unfilled) {
                const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
                const matcher = ROLE_MATCHERS[neededRole];
                if (!matcher) continue;
                const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;

                const candidates = validResources.filter(r => matcher(r));
                const scored = candidates.map(r => {
                    r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempBookedTotal = getTotalBooking(r.id);
                    return scoreCandidateForRole(r, project, {
                        ...config,
                        _customerResourceMap: customerResourceMap,
                        _countrySquadMap: countrySquadMap,
                        _excludedSquads: excludedSquads,
                        _nowMs: nowMs,
                        _demandHoursPerWeek: demandHpw,
                        _bookings: bookings,
                        _teamEntities: getTeamEntities(project)
                    });
                }).filter(Boolean);
                scored.sort((a, b) => b.score - a.score);

                if (scored.length > 0 && scored[0].newUtil <= 1.0) {
                    const best = scored[0];
                    addBooking(best.resource.id, project._startMs, project._endMs, demandHpw);

                    const bestResSquads = best.resource.squads || [];
                    gap.resourceId = best.resource.id;
                    gap.resourceName = best.resource.name;
                    gap.resourceHeadshot = best.resource.headshot || null;
                    gap.resourceSquads = bestResSquads;
                    gap.allocationPct = Math.round((demandHpw / (best.resource.effectiveHours || 32)) * 100);
                    gap.score = Math.round(best.score);
                    const parts = [];
                    if (bestStrategy.nudgeWeeks > 0) parts.push(`+${bestStrategy.nudgeWeeks}w nudge`);
                    if (bestStrategy.compressWeeks > 0) parts.push(`-${bestStrategy.compressWeeks}w compress`);
                    gap.reason = `Filled after ${parts.join(' & ')}`;
                    gap.isCrossSquad = projSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, bestResSquads);
                    rolesFilled++;
                    timelineFills++;
                }
            }

            projectStatuses[project.id] = project.assignments.every(a => a.resourceId !== null) ? 'filled' : 'partial';
            timelineChanges++;
        }
    }
    if (timelineChanges > 0) {
        console.log(`[Optimizer] Phase 3.5: Timeline optimized ${timelineChanges} projects, filled ${timelineFills} roles`);
    }

    // Count total cross-squad assignments
    let crossSquadCount = 0;
    scheduled.forEach(p => {
        (p.assignments || []).forEach(a => { if (a.isCrossSquad) crossSquadCount++; });
    });

    // ── Decision Support: Revenue-at-risk + Hiring gaps ──
    let revenueAtRisk = 0;
    const revenueAtRiskBySquad = {};
    const hiringGaps = {}; // squad → { PM: n, SC: n, PD: n }

    scheduled.forEach(p => {
        const assigns = p.assignments || [];
        const unfilled = assigns.filter(a => a.resourceId === null);
        if (unfilled.length === 0) return;

        const arr = p.arr || 0;
        revenueAtRisk += arr;

        const sqName = p.squads?.[0] || p.squad || 'Unassigned';
        if (!revenueAtRiskBySquad[sqName]) revenueAtRiskBySquad[sqName] = 0;
        revenueAtRiskBySquad[sqName] += arr;

        if (!hiringGaps[sqName]) hiringGaps[sqName] = { PM: 0, SC: 0, PD: 0 };
        unfilled.forEach(a => {
            const baseRole = a.role.replace(/ \(\d+\/\d+\)/, '');
            if (hiringGaps[sqName][baseRole] !== undefined) hiringGaps[sqName][baseRole]++;
        });
    });

    if (revenueAtRisk > 0) {
        console.log(`[Optimizer] Revenue at risk: £${revenueAtRisk.toLocaleString()} across ${Object.keys(revenueAtRiskBySquad).length} squads`);
    }

    // ── Phase 4: Constraint Relaxation ──
    // For remaining unfilled roles, try with relaxed constraints:
    // - Util cap raised to 130% (from 120%)
    // - Cross-squad penalty removed
    let relaxedFills = 0;
    // Fix R2-D: Sort by priority so higher-score projects get first pick of relaxed resources
    const scheduledByPriority4 = [...scheduled].sort((a, b) => (b._reprioritization?.score || 0) - (a._reprioritization?.score || 0));
    for (const project of scheduledByPriority4) {
        const unfilled = (project.assignments || []).filter(a => a.resourceId === null);
        if (unfilled.length === 0) continue;

        const projSquads = project.squads || [];
        for (const gap of unfilled) {
            const neededRole = gap.role.replace(/ \(\d+\/\d+\)/, '');
            const matcher = ROLE_MATCHERS[neededRole];
            if (!matcher) continue;

            const demandHpw = calculateWeeklyDemandHours(project, neededRole) || 8;
            // Relaxed search: any resource that matches role, with 130% util cap
            const candidates = validResources.filter(r => {
                if (!matcher(r)) return false;
                const booked = getBookingInWindow(r.id, project._startMs, project._endMs);
                return (booked + demandHpw) / (r.effectiveHours || 32) <= 1.3;
            });

            if (candidates.length > 0) {
                // Score with relaxed config (no squad penalty)
                const scored = candidates.map(r => {
                    r._tempBooked = getBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempPeakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                    r._tempBookedTotal = getTotalBooking(r.id);
                    return scoreCandidateForRole(r, project, {
                        ...config,
                        _customerResourceMap: customerResourceMap,
                        _countrySquadMap: countrySquadMap,
                        _excludedSquads: [], // Remove exclusions
                        _nowMs: nowMs,
                        _demandHoursPerWeek: demandHpw,
                        _bookings: bookings,
                        _teamEntities: getTeamEntities(project)
                    });
                }).filter(Boolean);

                scored.sort((a, b) => b.score - a.score);
                if (scored.length > 0) {
                    const best = scored[0];
                    addBooking(best.resource.id, project._startMs, project._endMs, demandHpw);

                    const bestResSquads = best.resource.squads || [];
                    gap.resourceId = best.resource.id;
                    gap.resourceName = best.resource.name;
                    gap.resourceHeadshot = best.resource.headshot || null;
                    gap.resourceSquads = bestResSquads;
                    gap.allocationPct = Math.round((demandHpw / (best.resource.effectiveHours || 32)) * 100);
                    gap.score = Math.round(best.score);
                    gap.reason = 'Filled with relaxed constraints (130% util cap)';
                    gap.isCrossSquad = projSquads.length > 0 && bestResSquads.length > 0 && !mergeLookup.areInSameGroup(projSquads, bestResSquads);
                    gap.isRelaxed = true;
                    rolesFilled++;
                    relaxedFills++;
                }
            }
        }
        projectStatuses[project.id] = project.assignments.every(a => a.resourceId !== null) ? 'filled' : 'partial';
    }
    if (relaxedFills > 0) {
        console.log(`[Optimizer] Phase 4: Filled ${relaxedFills} roles with relaxed constraints`);
    }

    // ── Phase 4b: Role Splitting ──
    // For roles still unfilled after all passes, try splitting across two
    // partial-availability resources. Each gets a fractional assignment.
    let splitFills = 0;
    for (const project of scheduled) {
        const stillUnfilled = (project.assignments || []).filter(a => a.resourceId === null);
        if (stillUnfilled.length === 0) continue;

        for (const gap of stillUnfilled) {
            const baseRole = (gap.role || '').replace(/ \(\d+\/\d+\)/, '');
            const matcher = ROLE_MATCHERS[baseRole];
            if (!matcher) continue;

            const demandHpw = calculateWeeklyDemandHours(project, baseRole) || 8;
            const assignedOnProject = new Set((project.assignments || []).filter(a => a.resourceId).map(a => a.resourceId));

            // Find resources with partial availability (can't do full role, but have some hours)
            const partials = validResources
                .filter(r => matcher(r) && !assignedOnProject.has(r.id))
                .map(r => {
                    const booked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                    const cap = r.effectiveHours || 32;
                    const freeHours = Math.max(0, cap * 1.0 - booked); // Up to 100% for splits
                    return { resource: r, freeHours, booked };
                })
                .filter(p => p.freeHours >= 2) // At least 2h/wk free
                .sort((a, b) => b.freeHours - a.freeHours);

            if (partials.length < 2) continue;

            // Find best pair that covers the demand
            let bestPair = null;
            for (let i = 0; i < Math.min(partials.length, 10); i++) {
                for (let j = i + 1; j < Math.min(partials.length, 10); j++) {
                    const combined = partials[i].freeHours + partials[j].freeHours;
                    if (combined >= demandHpw) {
                        bestPair = [partials[i], partials[j]];
                        break;
                    }
                }
                if (bestPair) break;
            }

            if (!bestPair) continue;

            // Allocate proportionally
            const totalFree = bestPair[0].freeHours + bestPair[1].freeHours;
            const shareA = Math.min(bestPair[0].freeHours, demandHpw * (bestPair[0].freeHours / totalFree));
            const shareB = demandHpw - shareA;

            // Replace the null assignment with the first resource
            gap.resourceId = bestPair[0].resource.id;
            gap.resourceName = bestPair[0].resource.name;
            gap.resourceHeadshot = bestPair[0].resource.headshot || null;
            gap.resourceSquads = bestPair[0].resource.squads || [];
            gap.allocationPct = Math.round((shareA / (bestPair[0].resource.effectiveHours || 32)) * 100);
            gap._demandHpw = shareA;
            gap.reason = `Split role (${shareA.toFixed(1)}h/${demandHpw}h)`;
            gap.isSplit = true;
            gap.isSeeded = false;

            // Add second resource as a new assignment
            project.assignments.push({
                role: gap.role + ' (split)',
                resourceId: bestPair[1].resource.id,
                resourceName: bestPair[1].resource.name,
                resourceHeadshot: bestPair[1].resource.headshot || null,
                resourceSquads: bestPair[1].resource.squads || [],
                allocationPct: Math.round((shareB / (bestPair[1].resource.effectiveHours || 32)) * 100),
                _demandHpw: shareB,
                score: 0,
                reason: `Split role (${shareB.toFixed(1)}h/${demandHpw}h)`,
                isSplit: true,
                isSeeded: false,
                isCrossSquad: false
            });

            // Book both
            addBooking(bestPair[0].resource.id, project._startMs, project._endMs, shareA);
            addBooking(bestPair[1].resource.id, project._startMs, project._endMs, shareB);

            rolesFilled++;
            splitFills++;
            console.log(`[Optimizer] Split ${gap.role}: ${bestPair[0].resource.name} (${shareA.toFixed(1)}h) + ${bestPair[1].resource.name} (${shareB.toFixed(1)}h) on ${project.name || project.customer}`);
        }
    }
    if (splitFills > 0) {
        console.log(`[Optimizer] Phase 4b: Split ${splitFills} roles across multiple resources`);
    }

    // ── Phase 5: Cross-Squad Reassignment Trial ──
    // For unfilled projects, hypothetically try every squad's resources
    // to surface recommendations: "Customer X could fill N more roles if moved to Squad Y"
    const squadRecommendations = [];
    {
        const stillUnfilled = scheduled.filter(p =>
            (p.assignments || []).some(a => a.resourceId === null)
        );

        // Collect all unique squads from resources
        const allSquads = [...new Set(validResources.flatMap(r => r.squads || []))];

        for (const project of stillUnfilled) {
            const unfilledGaps = (project.assignments || []).filter(a => a.resourceId === null);
            if (unfilledGaps.length === 0) continue;

            const projSquads = project.squads || [];
            const currentSquad = projSquads[0] || '(no squad)';
            let bestSquad = null;
            let bestFillCount = 0;

            for (const trialSquad of allSquads) {
                if (projSquads.includes(trialSquad)) continue; // Skip current squad

                // Count how many unfilled roles could be filled by this squad's resources
                let fillableCount = 0;
                const squadResources = validResources.filter(r => (r.squads || []).includes(trialSquad));

                for (const gap of unfilledGaps) {
                    const baseRole = (gap.role || '').replace(/ \(\d+\/\d+\)/, '');
                    const matcher = ROLE_MATCHERS[baseRole];
                    if (!matcher) continue;

                    const hasCandidate = squadResources.some(r => {
                        if (!matcher(r)) return false;
                        const peakBooked = getPeakBookingInWindow(r.id, project._startMs, project._endMs);
                        const cap = r.effectiveHours || 32;
                        return (peakBooked + 8) <= cap * 1.2; // Can fit at least 8h more
                    });

                    if (hasCandidate) fillableCount++;
                }

                if (fillableCount > bestFillCount) {
                    bestFillCount = fillableCount;
                    bestSquad = trialSquad;
                }
            }

            if (bestSquad && bestFillCount > 0) {
                const rec = {
                    projectId: project.id,
                    projectName: project.name || project.customer,
                    customer: project.customer,
                    currentSquad,
                    suggestedSquad: bestSquad,
                    additionalRoles: bestFillCount,
                    totalUnfilled: unfilledGaps.length
                };
                squadRecommendations.push(rec);
                console.log(`[Optimizer] Phase 5: ${rec.projectName} (${rec.customer}) — could fill ${bestFillCount}/${unfilledGaps.length} unfilled roles if moved from ${currentSquad} to ${bestSquad}`);
            }
        }
    }
    if (squadRecommendations.length > 0) {
        console.log(`[Optimizer] Phase 5: ${squadRecommendations.length} cross-squad recommendations found`);
        warnings.push({
            type: 'squad_recommendations',
            message: `${squadRecommendations.length} projects could fill more roles if moved to different squads`,
            recommendations: squadRecommendations
        });
    }

    // ── Phase 5b: Backfill Pass — Low-Utilisation Resource Assignment ──
    // Find resources below 30% util and proactively assign them to unfilled roles,
    // ignoring squad constraints. This is a last-resort gap-filler.
    let backfills = 0;
    {
        // Build a list of under-utilised resources
        const underUtilised = validResources
            .map(r => {
                const totalBooked = getTotalBooking(r.id);
                const cap = r.effectiveHours || 32;
                return { resource: r, util: totalBooked / cap, freeHours: cap - totalBooked };
            })
            .filter(u => u.util < 0.5 && u.freeHours >= 4) // Fix D5: relaxed from 30% to 50%
            .sort((a, b) => a.util - b.util); // Least utilised first

        if (underUtilised.length > 0) {
            console.log(`[Optimizer] Phase 5b: Found ${underUtilised.length} resources below 50% util`);

            for (const project of scheduled) {
                const unfilledGaps = (project.assignments || []).filter(a => a.resourceId === null);
                if (unfilledGaps.length === 0) continue;

                const assignedOnProject = new Set(
                    (project.assignments || []).filter(a => a.resourceId).map(a => a.resourceId)
                );

                for (const gap of unfilledGaps) {
                    const baseRole = (gap.role || '').replace(/ \(\d+\/\d+\)/, '');
                    const matcher = ROLE_MATCHERS[baseRole];
                    if (!matcher) continue;

                    const demandHpw = calculateWeeklyDemandHours(project, baseRole) || 8;

                    // Find the best under-utilised resource for this role
                    let bestMatch = null;
                    for (const u of underUtilised) {
                        if (!matcher(u.resource)) continue;
                        if (assignedOnProject.has(u.resource.id)) continue;
                        // Fix: re-check util threshold after prior backfills updated this entry
                        if (u.util >= 0.5 || u.freeHours < 4) continue; // Fix BUG-7: align with initial filter (was 0.3, should be 0.5)

                        const peakBooked = getPeakBookingInWindow(u.resource.id, project._startMs, project._endMs);
                        const cap = u.resource.effectiveHours || 32;
                        if (peakBooked + demandHpw > cap * 1.2) continue;

                        bestMatch = u;
                        break; // Take the least-utilised valid resource
                    }

                    if (!bestMatch) continue;

                    const r = bestMatch.resource;
                    const resSquads = r.squads || [];
                    const projSquads = project.squads || [];

                    gap.resourceId = r.id;
                    gap.resourceName = r.name;
                    gap.resourceHeadshot = r.headshot || null;
                    gap.resourceSquads = resSquads;
                    gap.allocationPct = Math.round((demandHpw / (r.effectiveHours || 32)) * 100);
                    gap._demandHpw = demandHpw;
                    gap.score = 0;
                    gap.reason = `Backfill (was ${Math.round(bestMatch.util * 100)}% util)`;
                    gap.isSeeded = false;
                    gap.isCrossSquad = projSquads.length > 0 && resSquads.length > 0 &&
                        !mergeLookup.areInSameGroup(projSquads, resSquads);
                    gap.isBackfill = true;

                    addBooking(r.id, project._startMs, project._endMs, demandHpw);
                    assignedOnProject.add(r.id);

                    // Fix R4-2: Cache getTotalBooking to avoid double O(n·k) call
                    const postFillTotal = getTotalBooking(r.id);
                    bestMatch.util = postFillTotal / (r.effectiveHours || 32);
                    bestMatch.freeHours = (r.effectiveHours || 32) - postFillTotal;

                    rolesFilled++;
                    backfills++;
                    console.log(`[Optimizer] Backfill: ${r.name} (${Math.round(bestMatch.util * 100)}% util) → ${gap.role} on ${project.name || project.customer}`);
                }
            }

            // Re-sort underUtilised list isn't needed since we update in-place
        }
    }
    if (backfills > 0) {
        console.log(`[Optimizer] Phase 5b: Backfilled ${backfills} roles from under-utilised resources`);
    }

    // ── Before/After Metrics ──
    const totalRoles = scheduled.reduce((sum, p) => sum + (p.assignments?.length || 0), 0);
    const filledRoles = scheduled.reduce((sum, p) => sum + (p.assignments?.filter(a => a.resourceId !== null).length || 0), 0);
    const afterFillRate = totalRoles > 0 ? Math.round((filledRoles / totalRoles) * 100) : 0;
    const afterCrossSquad = scheduled.reduce((sum, p) => sum + (p.assignments?.filter(a => a.isCrossSquad).length || 0), 0);
    const totalArr = scheduled.reduce((sum, p) => sum + (p.arr || 0), 0);
    const coveredArr = scheduled.filter(p => p.assignments?.every(a => a.resourceId !== null)).reduce((sum, p) => sum + (p.arr || 0), 0);
    const afterArrCoverage = totalArr > 0 ? Math.round((coveredArr / totalArr) * 100) : 0;

    // Average utilization of assigned resources (capped at 100% per resource)
    const assignedResIds = new Set();
    scheduled.forEach(p => (p.assignments || []).forEach(a => { if (a.resourceId) assignedResIds.add(a.resourceId); }));
    const avgUtil = assignedResIds.size > 0
        ? Math.round(([...assignedResIds].reduce((sum, id) => {
            const cap = resourceById[id]?.effectiveHours || 32;
            const booked = getBookingInWindow(id, nowMs, nowMs + 52 * 7 * 24 * 60 * 60 * 1000);
            return sum + Math.min(booked / cap, 1.3); // Cap at 130% to match relaxation ceiling
        }, 0) / assignedResIds.size) * 100)
        : 0;

    // ── Customer Satisfaction Scoring ──
    const customerSatisfaction = {};
    scheduled.forEach(p => {
        const cust = p.customer || 'Unknown';
        if (!customerSatisfaction[cust]) {
            customerSatisfaction[cust] = { filled: 0, partial: 0, deferred: 0, totalArr: 0, coveredArr: 0 };
        }
        const cs = customerSatisfaction[cust];
        cs.totalArr += (p.arr || 0);
        const status = projectStatuses[p.id];
        if (status === 'filled') {
            cs.filled++;
            cs.coveredArr += (p.arr || 0);
        } else {
            cs.partial++;
        }
    });
    // Add deferred projects
    (config._deferredProjects || []).forEach(p => {
        const cust = p.customer || 'Unknown';
        if (!customerSatisfaction[cust]) {
            customerSatisfaction[cust] = { filled: 0, partial: 0, deferred: 0, totalArr: 0, coveredArr: 0 };
        }
        customerSatisfaction[cust].deferred++;
        customerSatisfaction[cust].totalArr += (p.arr || 0);
    });
    // Compute satisfaction score per customer (0-100)
    Object.keys(customerSatisfaction).forEach(cust => {
        const cs = customerSatisfaction[cust];
        const total = cs.filled + cs.partial + cs.deferred;
        // Score: filled=100%, partial=40%, deferred=0%
        cs.score = total > 0 ? Math.round(((cs.filled * 100 + cs.partial * 40) / total)) : 0;
    });

    // Assignment confidence summary
    let tightCount = 0, moderateCount = 0, comfortableCount = 0;
    scheduled.forEach(p => (p.assignments || []).forEach(a => {
        if (!a.confidence) return;
        if (a.confidence.level === 'tight') tightCount++;
        else if (a.confidence.level === 'moderate') moderateCount++;
        else comfortableCount++;
    }));

    const optimizerMetrics = {
        fillRate: afterFillRate,
        crossSquadPct: totalRoles > 0 ? Math.round((afterCrossSquad / totalRoles) * 100) : 0,
        arrCoverage: afterArrCoverage,
        avgUtilisation: avgUtil,
        totalProjects: scheduled.length,
        filledProjects: Object.values(projectStatuses).filter(s => s === 'filled').length,
        relaxedFills,
        totalRoles,
        filledRoles,
        confidence: { tight: tightCount, moderate: moderateCount, comfortable: comfortableCount }
    };
    console.log(`[Optimizer] Metrics: ${afterFillRate}% fill, ${afterArrCoverage}% ARR covered, ${avgUtil}% avg util`);
    console.log(`[Optimizer] Confidence: ${tightCount} tight, ${moderateCount} moderate, ${comfortableCount} comfortable`);

    return {
        rolesNeeded, rolesFilled, programAssignments, programPreAssignedCount,
        seededCount, countrySquadMap, crossSquadCount,
        partialProjectsFreed, freedFromPartial,
        revenueAtRisk, revenueAtRiskBySquad, hiringGaps,
        optimizerMetrics, customerSatisfaction,
        entityRuleStats,
        _bookings: bookings, _addBooking: addBooking
    };
}

/**
 * Pass 2.5: Small Rocks — Single-Country Customer Micro-Moves
 * After individual assignment, find customer-countries with unfilled roles
 * that could be fully resourced in a different squad.
 *
 * @param {Array} scheduled - Projects with assignments
 * @param {Array} resources - All resources
 * @param {Object} config - Optimizer config
 * @returns {{ microMoves: Array }}
 */
export function microMoveCustomers(scheduled, resources, config) {
    _demandCache.clear(); // Fix: prevent stale cache from prior runs
    const ROLE_MATCHERS = buildRoleMatchers(config);
    const nowMs = Date.now();
    const microMoves = [];

    // Build resource lookup
    const validResources = resources.filter(r => {
        if (!r.name) return false;
        if (r.leaveDate && new Date(r.leaveDate).getTime() < nowMs) return false;
        return true;
    });

    // Build squad → resource pools
    const squadPools = {}; // squad → { PM: [resources], SC: [...], PD: [...] }
    validResources.forEach(r => {
        (r.squads || []).forEach(sq => {
            if (!squadPools[sq]) squadPools[sq] = { PM: [], SC: [], PD: [] };
            if (ROLE_MATCHERS['PM']?.(r)) squadPools[sq].PM.push(r);
            if (ROLE_MATCHERS['SC']?.(r)) squadPools[sq].SC.push(r);
            if (ROLE_MATCHERS['PD']?.(r)) squadPools[sq].PD.push(r);
        });
    });

    const allSquads = Object.keys(squadPools);
    if (allSquads.length <= 1) return { microMoves };

    // Group projects by customer::country
    const groups = {};
    scheduled.forEach(p => {
        const customer = p.customer || '';
        const country = p.country || '';
        if (!customer) return;
        const key = `${customer}::${country}`;
        if (!groups[key]) groups[key] = { customer, country, projects: [], currentSquad: null, locked: false, score: 0 };
        groups[key].projects.push(p);
        groups[key].score = Math.max(groups[key].score, p._reprioritization?.score || 0);
        if (p.lockSquad || p._reprioritization?.isSquadLocked) groups[key].locked = true;
        if (!groups[key].currentSquad) {
            const sq = p.squads?.[0] || p.squad;
            if (sq) groups[key].currentSquad = sq;
        }
    });

    // Find underserved groups: have any unfilled role
    const underserved = Object.values(groups).filter(g =>
        !g.locked &&
        g.currentSquad &&
        g.projects.some(p =>
            p.assignments?.some(a => a.resourceId === null)
        )
    );

    // Sort smallest first (fewest projects)
    underserved.sort((a, b) => a.projects.length - b.projects.length);

    // Track resources already assigned (by ID) to avoid double-counting
    const assignedResourceIds = new Set();
    scheduled.forEach(p => {
        (p.assignments || []).forEach(a => {
            if (a.resourceId) assignedResourceIds.add(a.resourceId);
        });
    });

    // Max 3 rounds to prevent cascading
    const MAX_ROUNDS = 3;
    const movedKeys = new Set();

    for (let round = 0; round < MAX_ROUNDS; round++) {
        let movesThisRound = 0;

        for (const group of underserved) {
            if (movedKeys.has(group.customer + '::' + group.country)) continue;

            // Count unfilled roles across this group
            const unfilledRoles = { PM: 0, SC: 0, PD: 0 };
            group.projects.forEach(p => {
                (p.assignments || []).forEach(a => {
                    if (a.resourceId === null) {
                        const baseRole = a.role.replace(/ \(\d+\/\d+\)/, '');
                        if (unfilledRoles[baseRole] !== undefined) unfilledRoles[baseRole]++;
                    }
                });
            });

            // Try each squad to see if it can fill ALL the gaps
            let bestTargetSquad = null;
            let bestAvailability = -1;

            for (const sq of allSquads) {
                if (sq === group.currentSquad) continue;
                const pool = squadPools[sq];
                if (!pool) continue;

                // Check: does this squad have enough FREE resources for each role?
                const pmFree = pool.PM.filter(r => !assignedResourceIds.has(r.id)).length;
                const scFree = pool.SC.filter(r => !assignedResourceIds.has(r.id)).length;
                const pdFree = pool.PD.filter(r => !assignedResourceIds.has(r.id)).length;

                if (pmFree >= unfilledRoles.PM && scFree >= unfilledRoles.SC && pdFree >= unfilledRoles.PD) {
                    const totalFree = pmFree + scFree + pdFree;
                    if (totalFree > bestAvailability) {
                        bestAvailability = totalFree;
                        bestTargetSquad = sq;
                    }
                }
            }

            if (!bestTargetSquad) continue;

            // Move: update project squads, clear unfilled assignments (they'll be re-scored)
            microMoves.push({
                customer: group.customer,
                country: group.country,
                fromSquad: group.currentSquad,
                toSquad: bestTargetSquad,
                projectCount: group.projects.length,
                unfilledRoles: { ...unfilledRoles },
                reason: `Squad ${bestTargetSquad} has capacity to fully resource`
            });

            group.projects.forEach(p => {
                p.squads = [bestTargetSquad];
                p.squad = bestTargetSquad;
                p._microMoved = true;
                p._microMovedFrom = group.currentSquad;
            });

            movedKeys.add(group.customer + '::' + group.country);
            movesThisRound++;
        }

        if (movesThisRound === 0) break;
    }

    if (microMoves.length > 0) {
        console.log(`[Optimizer] Pass 2.5: ${microMoves.length} customer micro-moves`);
        microMoves.forEach(m => console.log(`  → ${m.customer} (${m.country}): ${m.fromSquad} → ${m.toSquad}`));
    }

    return { microMoves };
}

// ═════════════════════════════════════════════════════════════════════════════
// SCHEDULING ENGINE
// ═════════════════════════════════════════════════════════════════════════════


/**
 * Generate a reprioritization plan with proposed date adjustments.
 * Uses the slot map to check capacity availability and enforces
 * concurrency, compelling event, and shift constraints.
 * 
 * @param {Array} projects - Full project list (unscored)
 * @param {Object} slotMap - Slot availability map { 'YYYY-MM': { squad: { available, total } } }
 * @param {Object} config - Reprioritization configuration
 * @param {Array} resources - Available resources for assignment
 * @returns {Object} { scheduled, deferred, warnings, stats }
 */
export async function generateReprioritizationPlan(projects, slotMap, resources = [], config = {}, onProgress) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const progress = onProgress || (() => { });

    // ── Step 0: Apply New Business Reserve to slot map ──
    // Reduce available capacity evenly across all squads by the configured percentage
    const reservePct = cfg.newBusinessReservePct || 0;
    if (reservePct > 0 && slotMap) {
        Object.values(slotMap).forEach(squads => {
            Object.values(squads).forEach(bucket => {
                if (bucket && typeof bucket.available === 'number') {
                    const reserved = Math.ceil(bucket.available * (reservePct / 100));
                    bucket.available = Math.max(0, bucket.available - reserved);
                }
            });
        });
    }

    // ── Step 1: Score portfolio ──
    progress('Scoring projects...');
    const { scored: rawScored, excluded, stats } = scorePortfolio(projects, cfg);

    // ── Step 1b: Apply project-level overrides (what-if modeling) ──
    const overrides = cfg.projectOverrides || {};
    const forceDeferredIds = new Set();
    const forceIncludedIds = new Set();

    // Apply overrides to scored projects
    const scored = rawScored.map(p => {
        const ov = overrides[p.id];
        if (!ov) return p;

        // Force defer — will be pulled out before scheduling
        if (ov.forceDefer) {
            forceDeferredIds.add(p.id);
            return p;
        }

        // Pin to specific tier — override score to place in that tier
        if (ov.pinTier != null) {
            const tierScores = { 1: 95, 2: 82, 3: 62, 4: 42, 5: 15 };
            const pinnedScore = tierScores[ov.pinTier] || p._reprioritization.score;
            return {
                ...p,
                _reprioritization: {
                    ...p._reprioritization,
                    score: pinnedScore,
                    tier: ov.pinTier,
                    reasoning: [
                        ...p._reprioritization.reasoning,
                        `⊕ Manually pinned to Tier ${ov.pinTier} (what-if override).`
                    ]
                }
            };
        }

        // Lock date — flag for scheduling to preserve dates
        if (ov.lockDate) {
            return {
                ...p,
                _reprioritization: {
                    ...p._reprioritization,
                    maxShiftWeeks: 0,
                    reasoning: [
                        ...p._reprioritization.reasoning,
                        `⊕ Date locked (what-if override).`
                    ]
                }
            };
        }

        return p;
    });

    // Re-sort by score after overrides (pinTier may have changed ordering)
    scored.sort((a, b) => b._reprioritization.score - a._reprioritization.score);

    // ── Improvement #6: Programme-level cohesive scheduling ──
    // Groups projects that share the same programme so they are scheduled
    // adjacently, which improves resource continuity and team stability.
    // Within the same programme, projects retain their score ordering.
    const programmeGroups = new Map();
    scored.forEach((p, idx) => {
        const pgm = p.programme || p.program || '';
        if (pgm) {
            if (!programmeGroups.has(pgm)) programmeGroups.set(pgm, { avgScore: 0, count: 0, indices: [] });
            const g = programmeGroups.get(pgm);
            g.avgScore += p._reprioritization.score;
            g.count++;
            g.indices.push(idx);
        }
    });
    // Only re-sort if there are programmes with multiple projects
    let hasProgrammeGroups = false;
    programmeGroups.forEach(g => {
        g.avgScore /= g.count;
        if (g.count > 1) hasProgrammeGroups = true;
    });
    if (hasProgrammeGroups) {
        // Stable sort: projects in same programme cluster around the programme's
        // average score, maintaining their internal order
        scored.sort((a, b) => {
            const pgmA = a.programme || a.program || '';
            const pgmB = b.programme || b.program || '';
            // Use programme average score (or project score if no programme)
            const scoreA = pgmA && programmeGroups.has(pgmA) ? programmeGroups.get(pgmA).avgScore : a._reprioritization.score;
            const scoreB = pgmB && programmeGroups.has(pgmB) ? programmeGroups.get(pgmB).avgScore : b._reprioritization.score;
            // Primary: by effective score (descending)
            if (Math.abs(scoreA - scoreB) > 5) return scoreB - scoreA;
            // Secondary: same programme clusters together
            if (pgmA && pgmA === pgmB) return a._reprioritization.score - b._reprioritization.score;
            // Tertiary: by individual score
            return b._reprioritization.score - a._reprioritization.score;
        });
    }

    // Apply alternate sort strategies for multi-strategy solver
    if (cfg._sortOverride === 'customer_interleave') {
        // Round-robin interleave by customer for balanced distribution
        const byCustomer = {};
        scored.forEach(p => {
            const c = p.customer || 'Unknown';
            if (!byCustomer[c]) byCustomer[c] = [];
            byCustomer[c].push(p);
        });
        const queues = Object.values(byCustomer);
        const interleaved = [];
        let idx = 0;
        while (interleaved.length < scored.length) {
            let added = false;
            for (const q of queues) {
                if (idx < q.length) {
                    interleaved.push(q[idx]);
                    added = true;
                }
            }
            if (!added) break;
            idx++;
        }
        scored.splice(0, scored.length, ...interleaved);
    } else if (cfg._sortOverride === 'squad_specialization') {
        // Boost projects that match squad specializations
        const specs = cfg.squadSpecializations || {};
        const specCountries = new Set();
        const specPlatforms = new Set();
        Object.values(specs).forEach(s => {
            (s.countries || []).forEach(c => specCountries.add(c.toLowerCase()));
            (s.platforms || []).forEach(p => specPlatforms.add(p.toLowerCase()));
        });
        scored.sort((a, b) => {
            const aCountry = (a.country || a.customer || '').toLowerCase();
            const aPlatform = (a.platform || '').toLowerCase();
            const bCountry = (b.country || b.customer || '').toLowerCase();
            const bPlatform = (b.platform || '').toLowerCase();
            const aMatch = [...specCountries].some(c => aCountry.includes(c)) || [...specPlatforms].some(p => aPlatform.includes(p));
            const bMatch = [...specCountries].some(c => bCountry.includes(c)) || [...specPlatforms].some(p => bPlatform.includes(p));
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return b._reprioritization.score - a._reprioritization.score;
        });
    } else if (cfg._sortOverride === 'arr_descending') {
        // Sort by ARR descending — prioritize revenue protection
        scored.sort((a, b) => {
            const arrDiff = (b.arr || 0) - (a.arr || 0);
            if (arrDiff !== 0) return arrDiff;
            return b._reprioritization.score - a._reprioritization.score;
        });
    }

    // Handle forceInclude — pull projects from excluded back into scored pool
    Object.entries(overrides).forEach(([projectId, ov]) => {
        if (!ov.forceInclude) return;
        forceIncludedIds.add(projectId);
        // Check if it's in excluded or was below threshold
        const fromExcluded = excluded.find(p => p.id === projectId);
        const fromRawScored = rawScored.find(p => p.id === projectId);
        const source = fromExcluded || fromRawScored;
        if (source && !scored.find(p => p.id === projectId)) {
            scored.push({
                ...source,
                _reprioritization: {
                    ...(source._reprioritization || { score: 40, tier: 4, reasoning: [] }),
                    reasoning: [
                        ...(source._reprioritization?.reasoning || []),
                        `⊕ Force-included (what-if override).`
                    ]
                }
            });
        }
    });

    // ── Step 2: Build customer concurrency tracker (counts distinct countries, not projects) ──
    const customerConcurrency = {};
    const customerScheduled = {};

    // Initialize from config
    Object.keys(stats.customerProjectCounts).forEach(customer => {
        const override = cfg.perCustomerOverrides[customer];
        customerConcurrency[customer] = {
            min: override?.min ?? cfg.minConcurrentCountries,
            max: override?.max ?? cfg.maxConcurrentCountries,
            current: 0
        };
        customerScheduled[customer] = []; // Each entry: { id, start: Date, end: Date, country: string }
    });

    // ── Helper: count distinct countries among scheduled projects that overlap a given date range ──
    const countOverlappingCountries = (customer, proposedStart, proposedEnd) => {
        const entries = customerScheduled[customer] || [];
        const overlapping = entries.filter(e => e.start < proposedEnd && e.end > proposedStart);
        const distinctCountries = new Set(overlapping.map(e => (e.country || '').toLowerCase()));
        return distinctCountries.size;
    };

    // ── Step 3: Schedule projects in priority order ──
    let scheduled = [];
    const deferred = [];
    const warnings = [];

    // Pre-populate deferred with force-deferred projects
    scored.forEach(p => {
        if (forceDeferredIds.has(p.id)) {
            deferred.push({
                ...p,
                deferralReason: 'Manually deferred (what-if override).',
                schedulingNote: 'Force-deferred by user override',
                _isOverridden: true
            });
        }
    });

    // First pass: ensure every customer gets their minimum allocation
    const customerQueues = {};
    scored.forEach(p => {
        const c = p.customer || 'Unknown';
        if (!customerQueues[c]) customerQueues[c] = [];
        customerQueues[c].push(p);
    });

    // Round-robin to guarantee minimums
    const guaranteedSet = new Set();
    let minRound = 0;
    let progressed = true;

    while (progressed) {
        progressed = false;
        for (const [customer, queue] of Object.entries(customerQueues)) {
            const conc = customerConcurrency[customer];
            if (!conc) continue;
            const minCountries = new Set((customerScheduled[customer] || []).map(e => (e.country || '').toLowerCase()));
            if (minCountries.size >= conc.min) continue;
            if (minRound >= queue.length) continue;

            const project = queue[minRound];
            if (project && !guaranteedSet.has(project.id) && !forceDeferredIds.has(project.id)) {
                guaranteedSet.add(project.id);
                const pStart = new Date(project.start || project.kickOff || new Date());
                const pEnd = new Date(project.end || project.launch || new Date());
                scheduled.push({
                    ...project,
                    _reprioritization: {
                        ...project._reprioritization,
                        reasoning: [
                            ...project._reprioritization.reasoning,
                            `Guaranteed allocation: minimum ${conc.min} country/ies for "${customer}".`
                        ]
                    },
                    proposedStart: project.start || project.kickOff,
                    proposedEnd: project.end || project.launch,
                    shiftWeeks: 0,
                    schedulingNote: 'Guaranteed minimum allocation'
                });
                if (!customerScheduled[customer]) customerScheduled[customer] = [];
                customerScheduled[customer].push({ id: project.id, start: pStart, end: pEnd, origStart: pStart, country: project.country || project.customer || '' });
                progressed = true;
            }
        }
        minRound++;
    }

    // Second pass: schedule remaining by score (all at original dates — concurrency deferred to post-resourcing)
    for (let _si = 0; _si < scored.length; _si++) {
        // Yield every 5 projects so Chrome doesn't kill the extension
        if (_si > 0 && _si % 5 === 0) {
            await yieldToUI();
            progress(`Scheduling projects... ${_si}/${scored.length}`);
        }

        const project = scored[_si];
        if (guaranteedSet.has(project.id)) continue;
        if (forceDeferredIds.has(project.id)) continue;

        const customer = project.customer || 'Unknown';
        const maxShift = project._reprioritization.maxShiftWeeks ?? cfg.defaultMaxShiftWeeks;

        const origStart = new Date(project.start || project.kickOff || new Date());
        const origEnd = new Date(project.end || project.launch || new Date());

        // Schedule at original dates — no upfront concurrency shifting
        const bestShift = { weeks: 0, start: origStart, end: origEnd };

        // Check compelling event constraint
        if (project.compellingEventDate) {
            const eventDate = new Date(project.compellingEventDate);
            if (bestShift.end > eventDate) {
                warnings.push({
                    projectId: project.id,
                    projectName: project.name,
                    type: 'compelling_event_conflict',
                    message: `Project "${project.name}" ends ${daysBetween(eventDate, bestShift.end)} days after compelling event.`
                });
            }
        }

        // Format proposed dates as ISO strings
        const proposedStartStr = bestShift.start.toISOString().split('T')[0];
        const proposedEndStr = bestShift.end.toISOString().split('T')[0];

        // Schedule the project
        scheduled.push({
            ...project,
            proposedStart: proposedStartStr,
            proposedEnd: proposedEndStr,
            shiftWeeks: 0,
            maxAllowedShift: maxShift,
            schedulingNote: `Scheduled at priority ${project._reprioritization.score.toFixed(1)}`
        });

        if (!customerScheduled[customer]) customerScheduled[customer] = [];
        customerScheduled[customer].push({ id: project.id, start: bestShift.start, end: bestShift.end, origStart: origStart, country: project.country || project.customer || '' });
    }

    // ── Step 3b: Cascade country rollouts ──
    // Within each customer, enforce chronological ordering of country rollouts.
    // If an earlier country (by original start date) has been shifted later,
    // subsequent countries cascade forward to maintain the planned sequence.
    // Strict sequential: 0 overlap — next country starts after previous ends.
    progress('Enforcing rollout sequences...');
    const cascadeOverlapMs = (cfg.cascadeOverlapWeeks || 0) * 7 * 24 * 60 * 60 * 1000;
    let totalCascades = 0;

    for (const customer of Object.keys(customerScheduled)) {
        const entries = customerScheduled[customer];
        if (entries.length < 2) continue;

        // Determine country order by earliest ORIGINAL start date per country
        const countryEarliestOrig = {};
        entries.forEach(e => {
            const c = (e.country || '').toLowerCase();
            if (!countryEarliestOrig[c] || e.origStart < countryEarliestOrig[c]) {
                countryEarliestOrig[c] = e.origStart;
            }
        });

        // Sort countries by their original planned start
        const orderedCountries = Object.entries(countryEarliestOrig)
            .sort((a, b) => a[1] - b[1])
            .map(([country]) => country);

        if (orderedCountries.length < 2) continue;

        // Walk country sequence: if prev country's latest proposed end
        // is after next country's earliest proposed start, cascade next forward
        let prevCountryLatestEnd = null;

        for (const country of orderedCountries) {
            // Get all entries (scheduled projects) for this country
            const countryEntries = entries.filter(e => (e.country || '').toLowerCase() === country);
            if (countryEntries.length === 0) continue;

            if (prevCountryLatestEnd) {
                const minStart = new Date(prevCountryLatestEnd.getTime() - cascadeOverlapMs);

                countryEntries.forEach(ce => {
                    if (ce.start < minStart) {
                        const shiftMs = minStart.getTime() - ce.start.getTime();
                        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
                        const shiftWeeks = Math.ceil(shiftMs / ONE_WEEK_MS);

                        // Find the corresponding scheduled project
                        const sp = scheduled.find(p => p.id === ce.id);

                        // Respect per-project max shift — don't cascade beyond it
                        const projectMaxShift = sp?._reprioritization?.maxShiftWeeks ?? cfg.defaultMaxShiftWeeks;
                        const currentShift = sp?.shiftWeeks || 0;
                        if (currentShift + shiftWeeks > projectMaxShift) {
                            warnings.push({
                                projectId: ce.id,
                                projectName: sp?.name || ce.id,
                                type: 'cascade_blocked',
                                message: `"${sp?.name || ce.id}" cascade blocked: would exceed max shift (${currentShift}w + ${shiftWeeks}w > ${projectMaxShift}w limit).`
                            });
                            return; // Skip this cascade — project's shift limit would be exceeded
                        }

                        // Update the customerScheduled entry
                        ce.start = new Date(ce.start.getTime() + shiftMs);
                        ce.end = new Date(ce.end.getTime() + shiftMs);

                        // Update the scheduled project
                        if (sp) {
                            sp.proposedStart = ce.start.toISOString().split('T')[0];
                            sp.proposedEnd = ce.end.toISOString().split('T')[0];
                            sp.shiftWeeks = (sp.shiftWeeks || 0) + shiftWeeks;
                            sp.schedulingNote = (sp.schedulingNote || '') + ` | Cascaded +${shiftWeeks}w: prior country in ${customer} rollout shifted`;
                            totalCascades++;
                        }
                    }
                });
            }

            // Track the latest end for this country (for next country's check)
            const latestEnd = countryEntries.reduce((max, e) => e.end > max ? e.end : max, countryEntries[0].end);
            if (!prevCountryLatestEnd || latestEnd > prevCountryLatestEnd) {
                prevCountryLatestEnd = latestEnd;
            }
        }
    }

    if (totalCascades > 0) {
        console.log(`[Optimizer] Cascaded ${totalCascades} project(s) to maintain rollout sequences`);
    }

    // ── Step 4: Assign resources (multi-pass weight sweep) ──
    // Try multiple load-balance weight profiles and pick the best result.
    // Each profile trades off squad cohesion vs workload evenness differently.
    let assignmentStats = { rolesNeeded: 0, rolesFilled: 0, programAssignments: 0 };
    if (resources.length > 0 && cfg.autoAssign !== false) {
        const WEIGHT_PROFILES = [
            { weight: 0.3, label: 'Strong squad bias' },
            { weight: 0.6, label: 'Squad-leaning' },
            { weight: 0.8, label: 'Slight squad bias' },
            { weight: 1.0, label: 'Balanced' },
            { weight: 1.3, label: 'Slight util bias' },
            { weight: 1.6, label: 'Even workload' },
            { weight: 2.0, label: 'Max load-balance' },
        ];

        // Fitness function: higher = better
        // Fix #3: Use real bookings data instead of naive allocationPct sums
        function scoreFitness(sched, stats) {
            const fillRate = stats.rolesFilled / Math.max(stats.rolesNeeded, 1);
            // Fix R3-5: Only compute utilisation for resources with PROJECT assignments,
            // not program-only pre-bookings which skew the variance calculation.
            const bk = stats._bookings || {};
            const resLookup = {};
            resources.forEach(r => { if (r.id) resLookup[r.id] = r; });
            const assignedResIds = new Set();
            sched.forEach(p => (p.assignments || []).forEach(a => { if (a.resourceId) assignedResIds.add(a.resourceId); }));
            const resUtils = {};
            for (const [resId, entries] of Object.entries(bk)) {
                if (!assignedResIds.has(resId)) continue; // Skip program-only resources
                const totalHpw = entries.reduce((s, e) => s + e.hpw, 0);
                const res = resLookup[resId];
                const cap = res?.effectiveHours || 32;
                resUtils[resId] = totalHpw / cap;
            }
            const utils = Object.values(resUtils);
            const avgUtil = utils.length > 0 ? utils.reduce((s, u) => s + u, 0) / utils.length : 0;
            const variance = utils.length > 1
                ? utils.reduce((s, u) => s + Math.pow(u - avgUtil, 2), 0) / utils.length
                : 0;
            const evenness = 1 / (1 + variance * 10); // 0-1, higher = more even
            const unfilledCount = sched.filter(p => (p.assignments || []).some(a => !a.resourceId)).length;
            const unfilledPenalty = unfilledCount / Math.max(sched.length, 1);
            // Fix #11: Penalize customer concentration (same resource on >3 projects for same customer)
            let concentrationPenalty = 0;
            const resCustomerCounts = {};
            for (const p of sched) {
                const cust = p.customer || '';
                if (!cust) continue;
                for (const a of (p.assignments || [])) {
                    if (!a.resourceId) continue;
                    const key = `${a.resourceId}::${cust}`;
                    resCustomerCounts[key] = (resCustomerCounts[key] || 0) + 1;
                }
            }
            const overConcentrated = Object.values(resCustomerCounts).filter(c => c > 3).length;
            concentrationPenalty = overConcentrated * 2;
            return (fillRate * 50) + (evenness * 30) - (unfilledPenalty * 20) - concentrationPenalty;
        }

        // Save original assignments to restore between trials
        const origAssignments = scheduled.map(p => ({
            id: p.id,
            assignments: p.assignments ? JSON.parse(JSON.stringify(p.assignments)) : undefined,
            _seededAssignments: p._seededAssignments ? JSON.parse(JSON.stringify(p._seededAssignments)) : undefined,
            _lockedAssignment: p._lockedAssignment
        }));

        let bestFitness = -Infinity;
        let bestStats = null;
        let bestAssignments = null;
        let bestWeight = 1.0;
        let bestBookings = {};
        let bestLabel = 'Balanced';
        let bestWarnings = [];

        for (let pi = 0; pi < WEIGHT_PROFILES.length; pi++) {
            const profile = WEIGHT_PROFILES[pi];
            progress(`Optimising resources · trial ${pi + 1}/${WEIGHT_PROFILES.length}: ${profile.label} (weight ${profile.weight})...`);

            // Fix #1: Reset _tempBooked on all resources to prevent state leaking between trials
            resources.forEach(r => { r._tempBooked = 0; r._tempBookedTotal = 0; });

            // Restore clean state for each trial
            scheduled.forEach((p, idx) => {
                const orig = origAssignments[idx];
                p.assignments = orig.assignments ? JSON.parse(JSON.stringify(orig.assignments)) : undefined;
                p._seededAssignments = orig._seededAssignments ? JSON.parse(JSON.stringify(orig._seededAssignments)) : undefined;
                p._lockedAssignment = orig._lockedAssignment;
            });

            const trialCfg = { ...cfg, _loadBalanceWeight: profile.weight };
            // Fix #7: Use trial-local warnings to avoid accumulating phantom warnings
            const trialWarnings = [];
            // Suppress per-project progress on non-final trials to keep UI clean
            const trialProgress = pi < WEIGHT_PROFILES.length - 1 ? () => { } : progress;
            const trialStats = await assignResources(scheduled, resources, trialCfg, trialWarnings, trialProgress);
            const fitness = scoreFitness(scheduled, trialStats);

            const filled = trialStats.rolesFilled;
            const needed = trialStats.rolesNeeded;
            const pct = needed > 0 ? Math.round(filled / needed * 100) : 100;
            console.log(`[Optimizer] Trial ${pi + 1} (${profile.label}, w=${profile.weight}): ${pct}% fill (${filled}/${needed}), fitness=${fitness.toFixed(1)}`);

            if (fitness > bestFitness) {
                bestFitness = fitness;
                bestStats = trialStats;
                bestAssignments = scheduled.map(p => ({
                    id: p.id,
                    assignments: p.assignments ? JSON.parse(JSON.stringify(p.assignments)) : undefined
                }));
                bestWeight = profile.weight;
                bestBookings = trialStats._bookings || {};
                bestLabel = profile.label;
                bestWarnings = trialWarnings; // Keep warnings from best trial only
            }

            // Fix #22: Early termination if fitness is near-perfect
            if (pct >= 99 && fitness > 75) {
                console.log(`[Optimizer] Early stop: Trial ${pi + 1} achieved ${pct}% fill, fitness=${fitness.toFixed(1)}`);
                break;
            }
        }

        // Apply best result
        scheduled.forEach((p, idx) => {
            p.assignments = bestAssignments[idx]?.assignments;
        });
        assignmentStats = bestStats;
        // Fix #7: Apply only the best trial's warnings
        bestWarnings.forEach(w => warnings.push(w));
        progress(`Best profile: "${bestLabel}" (weight ${bestWeight}) · ${Math.round(bestStats.rolesFilled / Math.max(bestStats.rolesNeeded, 1) * 100)}% fill · fitness ${bestFitness.toFixed(1)}`);

        // Extract bookings from best run for load-levelling pass
        const bookings = bestBookings;
        // Fix #23: Outer-scope addBooking also updates resource._tempBooked
        const resourceById_outer = {};
        resources.forEach(r => { if (r.id) resourceById_outer[r.id] = r; });
        const addBooking = bestStats._addBooking || ((resId, startMs, endMs, hpw) => {
            if (!bookings[resId]) bookings[resId] = [];
            bookings[resId].push({ startMs, endMs, hpw });
            const res = resourceById_outer[resId];
            if (res) res._tempBooked = (res._tempBooked || 0) + hpw;
        });

        // ── Step 4a: Resource Rebalancing (iterative) ──
        // Take resources from low-priority projects and give to unfilled high-priority ones.
        // Only swap when the priority difference is significant (tier gap ≥ 2).
        // Never unassign from in-flight or locked projects.
        const MAX_REBALANCE_PASSES = 5;
        let totalSwaps = 0;

        for (let rebalIter = 0; rebalIter < MAX_REBALANCE_PASSES; rebalIter++) {
            let swapsThisPass = 0;

            // Find unfilled high-priority roles (sorted by project priority, highest first)
            const unfilledRoles = [];
            scheduled.forEach(p => {
                if (p._reprioritization?.isInFlight) return; // Don't benefit from swaps if it causes disruption
                (p.assignments || []).forEach((a, idx) => {
                    if (a.resourceId === null) {
                        unfilledRoles.push({
                            project: p,
                            assignmentIdx: idx,
                            role: a.role,
                            pct: a.allocationPct || 25,
                            tier: p._reprioritization?.tier || 5,
                            score: p._reprioritization?.score || 0,
                            _baseRole: a._baseRole || a.role.replace(/ \(\d+\/\d+\)/, '')
                        });
                    }
                });
            });

            // Sort: highest priority first
            unfilledRoles.sort((a, b) => b.score - a.score);
            if (unfilledRoles.length === 0) break;

            // Find donor candidates: filled roles on low-priority, non-protected projects
            for (const need of unfilledRoles) {
                // Look for a donor from a lower-tier project
                let bestDonor = null;
                let bestDonorScore = Infinity;

                for (const donor of scheduled) {
                    // Skip same project
                    if (donor.id === need.project.id) continue;
                    // Never steal from in-flight, locked, or higher-tier projects
                    const donorTier = donor._reprioritization?.tier || 5;
                    const donorScore = donor._reprioritization?.score || 0;
                    if (donor._reprioritization?.isInFlight) continue;
                    if (donor._reprioritization?.isFullyLocked) continue;
                    if (donor._reprioritization?.isResourcesLocked) continue;
                    // Require significant tier gap (≥ 2 tiers lower priority)
                    if (donorTier - need.tier < 2) continue;

                    // Look for a matching filled role on this donor
                    (donor.assignments || []).forEach((da, dIdx) => {
                        if (da.resourceId === null) return;
                        // Seeded assignments CAN be swapped if a higher-priority project needs them
                        const daBaseRole = da._baseRole || da.role.replace(/ \(\d+\/\d+\)/, '');
                        if (daBaseRole !== need._baseRole) return;

                        // This is a viable swap: lower score = better donor (we take from worst first)
                        if (donorScore < bestDonorScore) {
                            bestDonor = { project: donor, assignment: da, assignmentIdx: dIdx };
                            bestDonorScore = donorScore;
                        }
                    });
                }

                if (bestDonor) {
                    // Execute the swap
                    const swappedResource = bestDonor.assignment;
                    const donorName = (bestDonor.project.customer || bestDonor.project.name || '').substring(0, 25);
                    const recipientName = (need.project.customer || need.project.name || '').substring(0, 25);

                    // Move resource to the high-priority project
                    need.project.assignments[need.assignmentIdx] = {
                        ...swappedResource,
                        role: need.role,
                        allocationPct: need.pct,
                        reason: `Rebalanced from "${donorName}" (tier ${bestDonor.project._reprioritization?.tier}) → "${recipientName}" (tier ${need.tier})`,
                        isSeeded: false
                    };

                    // Remove from donor (mark as unfilled)
                    bestDonor.project.assignments[bestDonor.assignmentIdx] = {
                        ...bestDonor.assignment,
                        resourceId: null,
                        resourceName: null,
                        resourceHeadshot: null,
                        score: 0,
                        reason: `Resource rebalanced to higher-priority "${recipientName}" (tier ${need.tier})`,
                        isSeeded: false
                    };

                    swapsThisPass++;
                    totalSwaps++;

                    // Fix #8: Update bookings to reflect the swap
                    const swapResId = swappedResource.resourceId;
                    const demandHpw = calculateWeeklyDemandHours(need.project, need._baseRole) || ((need.pct / 100) * 32);
                    // Fix R3-4: Remove any existing booking for this resource on recipient project first
                    const recipientBookings = bookings[swapResId] || [];
                    for (let bi = recipientBookings.length - 1; bi >= 0; bi--) {
                        if (recipientBookings[bi].startMs === need.project._startMs &&
                            recipientBookings[bi].endMs === need.project._endMs) {
                            recipientBookings.splice(bi, 1);
                            break;
                        }
                    }
                    // Add booking for recipient project
                    addBooking(swapResId, need.project._startMs, need.project._endMs, demandHpw);
                    // Remove booking from donor project
                    const donorBookings = bookings[swapResId] || [];
                    for (let bi = donorBookings.length - 1; bi >= 0; bi--) {
                        if (donorBookings[bi].startMs === bestDonor.project._startMs &&
                            donorBookings[bi].endMs === bestDonor.project._endMs) {
                            donorBookings.splice(bi, 1);
                            break;
                        }
                    }
                }
            }

            await yieldToUI();
            progress(`Rebalancing pass ${rebalIter + 1} · ${swapsThisPass} swaps`, {
                iteration: rebalIter + 1
            });

            if (swapsThisPass === 0) break; // No more viable swaps
        }

        if (totalSwaps > 0) {
            warnings.push({
                type: 'rebalancing_summary',
                message: `Resource rebalancing: ${totalSwaps} assignments moved from low-priority to high-priority projects across ${Math.min(MAX_REBALANCE_PASSES, totalSwaps)} passes.`
            });
        }

        // ── Step 4c: Load-Levelling Pass ──
        // Actively redistribute assignments from overloaded resources (>85% util)
        // to underloaded resources (<50% util) of the same role type.
        // IMPORTANT: Respects program assignments — program specialists are excluded
        // as replacement targets since their 'idle' capacity is consumed by programs.
        // This runs BEFORE shift-then-defer so freed capacity prevents needless deferring.
        const MAX_LEVEL_PASSES = 5; // Fix D3: increased from 3
        let totalLevelSwaps = 0;
        const ROLE_MATCHERS_LEVEL = buildRoleMatchers(cfg);
        const mergeLookupLevel = buildMergeLookup(cfg.mergeGroups);
        const programSpecIds = new Set(cfg.programSpecialistIds || []);
        const programTeamResIds = new Set((cfg.programTeamAssignments || []).map(a => a.resourceId).filter(Boolean));

        for (let levelIter = 0; levelIter < MAX_LEVEL_PASSES; levelIter++) {
            let swapsThisPass = 0;

            // Build per-resource utilisation snapshot
            // Fix D1: Use peak-concurrent hpw (same logic as getTotalBooking inside assignResources)
            // getTotalBooking is scoped to assignResources, so we inline the logic here.
            const _peakBookedHpw = (resId) => {
                const entries = bookings[resId] || [];
                if (entries.length === 0) return 0;
                if (entries.length === 1) return entries[0].hpw;
                const timestamps = new Set();
                for (const e of entries) { timestamps.add(e.startMs); timestamps.add(e.endMs); }
                const sorted = [...timestamps].sort((a, b) => a - b);
                const wk = 7 * 24 * 60 * 60 * 1000;
                let maxHpw = 0;
                for (const t of sorted) {
                    let weekTotal = 0;
                    const weekEnd = t + wk;
                    for (const entry of entries) {
                        if (entry.endMs > t && entry.startMs < weekEnd) {
                            weekTotal += entry.hpw;
                        }
                    }
                    if (weekTotal > maxHpw) maxHpw = weekTotal;
                }
                return maxHpw;
            };
            const resUtilMap = {};
            for (const res of resources) {
                if (!res.name || !res.id) continue;
                const cap = res.effectiveHours || 32;
                const booked = _peakBookedHpw(res.id);
                resUtilMap[res.id] = { util: booked / cap, booked, cap, res };
            }

            // Fix #24: Use per-resource targetUtil for thresholds instead of hardcoded values
            const overloaded = Object.entries(resUtilMap).filter(([, v]) => {
                const target = v.res?.targetUtilization ?? 0.8;
                return v.util > target * 1.05; // 5% above target = overloaded
            });
            if (overloaded.length === 0) break;

            // Find underloaded resources (below 60% of their target)
            // Exclude program specialists/team — their low project-util is because programs consume capacity
            const underloaded = Object.entries(resUtilMap).filter(([id, v]) => {
                const target = v.res?.targetUtilization ?? 0.8;
                return v.util < target * 0.6 && !programSpecIds.has(id) && !programTeamResIds.has(id);
            });
            if (underloaded.length === 0) break;

            // For each overloaded resource, try to move one assignment to an underloaded one
            for (const [overResId, overData] of overloaded) {
                // Find projects assigned to this overloaded resource
                for (const project of scheduled) {
                    if (project._reprioritization?.isInFlight) continue;
                    if (project._reprioritization?.isFullyLocked) continue;
                    // Don't move program project assignments — they need specialist resources
                    if (project.resourcedWithinProgram) continue;
                    const assignments = project.assignments || [];

                    for (let ai = 0; ai < assignments.length; ai++) {
                        const a = assignments[ai];
                        if (a.resourceId !== overResId) continue;
                        if (a.isSeeded && project._reprioritization?.tier <= 2) continue; // Don't unseed cornerstone

                        // Determine the base role for matching
                        const baseRole = (a._baseRole || a.role || '').replace(/ \(\d+\/\d+\)/, '');
                        const matcher = ROLE_MATCHERS_LEVEL[baseRole];
                        if (!matcher) continue;

                        // Find a viable underloaded replacement
                        let bestReplacement = null;
                        let bestUtil = 1.0;

                        for (const [underResId, underData] of underloaded) {
                            if (underResId === overResId) continue;
                            const underRes = underData.res;
                            if (!matcher(underRes)) continue;

                            // Check squad compatibility (same merge group or cross-squad OK)
                            const projSquads = project.squads || [];
                            const underSquads = underRes.squads || [];
                            const sameGroup = mergeLookupLevel.areInSameGroup(projSquads, underSquads);
                            if (projSquads.length > 0 && underSquads.length > 0 && !sameGroup) continue;

                            // Check leave date overlap
                            if (underRes.leaveDate) {
                                const ldMs = new Date(underRes.leaveDate).getTime();
                                if (ldMs < (project._endMs || 0)) continue;
                            }

                            // Check if taking this assignment would still keep them below 75%
                            // Fix #12: Use real demand hours stored on assignment, not allocationPct
                            const demandHpw = a._demandHpw || ((a.allocationPct || 25) / 100 * (underData.cap));
                            const newUtil = (underData.booked + demandHpw) / underData.cap;
                            if (newUtil > 0.75) continue;

                            if (newUtil < bestUtil) {
                                bestUtil = newUtil;
                                bestReplacement = { resId: underResId, res: underRes, demandHpw };
                            }
                        }

                        if (bestReplacement) {
                            const demandHpw = bestReplacement.demandHpw;
                            // Execute the swap
                            assignments[ai] = {
                                ...a,
                                resourceId: bestReplacement.resId,
                                resourceName: bestReplacement.res.name,
                                resourceHeadshot: bestReplacement.res.headshot || null,
                                resourceSquads: bestReplacement.res.squads || [],
                                reason: `Load-levelled from ${overData.res?.name || overResId} (${Math.round(overData.util * 100)}%) → ${bestReplacement.res.name} (${Math.round(bestUtil * 100)}%)`,
                                isSeeded: false
                            };

                            // Update bookings
                            addBooking(bestReplacement.resId, project._startMs, project._endMs, demandHpw);
                            // Fix R3-3: Match by project window (startMs+endMs), not hpw proximity
                            const oldEntries = bookings[overResId] || [];
                            for (let bi = oldEntries.length - 1; bi >= 0; bi--) {
                                if (oldEntries[bi].startMs === project._startMs && oldEntries[bi].endMs === project._endMs) {
                                    oldEntries.splice(bi, 1);
                                    break;
                                }
                            }

                            swapsThisPass++;
                            totalLevelSwaps++;
                            break; // Only move one assignment per project per pass
                        }
                    }
                    if (swapsThisPass > 40) break; // Fix D3: increased from 20
                }
            }

            await yieldToUI();
            progress(`Load-levelling pass ${levelIter + 1} · ${swapsThisPass} moves`, {
                iteration: levelIter + 1
            });

            if (swapsThisPass === 0) break;
        }

        if (totalLevelSwaps > 0) {
            console.log(`[Optimizer] Load-levelling: ${totalLevelSwaps} assignments redistributed from overloaded to underloaded resources`);
            warnings.push({
                type: 'load_levelling_summary',
                message: `Load levelling: ${totalLevelSwaps} assignments moved from overloaded (>85%) to underloaded (<50%) resources.`
            });
        }

        // ── Step 4b: Shift-then-defer loop ──
        // Instead of immediately deferring unfilled projects, shift their dates
        // forward by SHIFT_WEEKS. With time-phased bookings, resources finishing
        // earlier projects become available for the shifted ones.
        // Only defer if a project has been shifted beyond MAX_SHIFT_WEEKS.
        const SHIFT_WEEKS = 4;
        const MAX_SHIFT_WEEKS = cfg.defaultMaxShiftWeeks || 26;
        const SHIFT_MS = SHIFT_WEEKS * 7 * 24 * 60 * 60 * 1000;
        const MAX_SHIFT_PASSES = Math.ceil(MAX_SHIFT_WEEKS / SHIFT_WEEKS) + 2;
        const WEEK_MS_SHIFT = 7 * 24 * 60 * 60 * 1000;
        const nowMsShift = Date.now();

        // Build valid resource list for staggered shifting (same filter as assignResources)
        const validResourcesShift = resources.filter(r => {
            if (!r.name) return false;
            if (r.leaveDate && new Date(r.leaveDate).getTime() < nowMsShift) return false;
            return true;
        });

        // Local findEarliestAvailableWeek using outer-scope bookings
        function findEarliestAvailableWeekShift(resId, searchStartMs, maxSearchMs, thresholdHpw) {
            const entries = bookings[resId] || [];
            for (let t = searchStartMs; t < maxSearchMs; t += WEEK_MS_SHIFT) {
                const weekEnd = t + WEEK_MS_SHIFT;
                let weekTotal = 0;
                for (const entry of entries) {
                    if (entry.endMs > t && entry.startMs < weekEnd) {
                        weekTotal += entry.hpw;
                    }
                }
                if (weekTotal < thresholdHpw) return t;
            }
            return null;
        }

        let prevUnfilledCount = Infinity; // Track convergence

        for (let shiftIter = 0; shiftIter < MAX_SHIFT_PASSES; shiftIter++) {
            // Find projects with unfilled roles
            const unfilled = scheduled.filter(p =>
                (p.assignments || []).some(a => a.resourceId === null)
            );
            if (unfilled.length === 0) break; // All roles filled — done

            // ── Convergence check: if no improvement after shifting, stop ──
            if (unfilled.length >= prevUnfilledCount) {
                console.log(`[Optimizer] Shift pass ${shiftIter + 1}: no improvement (${unfilled.length} still unfilled), stopping`);
                break;
            }
            prevUnfilledCount = unfilled.length;

            // Separate into shiftable vs must-defer
            const shiftable = [];
            const mustDefer = [];
            unfilled.forEach(p => {
                const totalShifted = p._totalShiftWeeks || 0;
                // Use per-project max shift, not global default — respects in-flight/cornerstone limits
                const projectMaxShift = p._reprioritization?.maxShiftWeeks ?? MAX_SHIFT_WEEKS;
                if (totalShifted >= projectMaxShift) {
                    mustDefer.push(p);
                } else {
                    shiftable.push(p);
                }
            });

            // Defer projects that have exceeded max shift
            if (mustDefer.length > 0) {
                const deferIds = new Set(mustDefer.map(p => p.id));
                mustDefer.forEach(p => {
                    p.deferralReason = `Resource unavailable — shifted ${p._totalShiftWeeks || 0}w, max ${MAX_SHIFT_WEEKS}w reached`;
                    p.schedulingNote = `Deferred after ${p._totalShiftWeeks || 0} weeks of date shifting`;
                    deferred.push(p);
                });
                scheduled = scheduled.filter(p => !deferIds.has(p.id));
            }

            // If nothing left to shift, stop
            if (shiftable.length === 0) break;

            // ── Staggered shifting: calculate per-project optimal shift ──
            // Instead of fixed 4-week shifts, find when the first viable resource
            // becomes available for each unfilled project
            const shiftedIds = new Set(shiftable.map(p => p.id));
            shiftable.forEach(p => {
                // Find unfilled roles and their matchers
                const unfilledRoles = (p.assignments || []).filter(a => a.resourceId === null);
                let minShiftWeeks = SHIFT_WEEKS; // Default fallback

                // For each unfilled role, find earliest resource availability
                for (const assignment of unfilledRoles) {
                    const baseRole = (assignment.role || '').replace(/ \(\d+\/\d+\)/, '');
                    const matcher = ROLE_MATCHERS_LEVEL[baseRole];
                    if (!matcher) continue;

                    const candidates = validResourcesShift.filter(r => matcher(r));
                    let earliestAvail = null;

                    for (const r of candidates) {
                        const resCap = r.effectiveHours || 32;
                        const threshold = resCap * 0.8; // Available when below 80% peak
                        const searchStart = p._startMs || nowMsShift;
                        const maxSearch = searchStart + MAX_SHIFT_WEEKS * WEEK_MS_SHIFT;
                        const avail = findEarliestAvailableWeekShift(r.id, searchStart, maxSearch, threshold);
                        if (avail !== null) {
                            if (earliestAvail === null || avail < earliestAvail) {
                                earliestAvail = avail;
                            }
                        }
                    }

                    if (earliestAvail !== null) {
                        const weeksUntilAvail = Math.max(1, Math.ceil((earliestAvail - (p._startMs || nowMsShift)) / WEEK_MS_SHIFT));
                        minShiftWeeks = Math.min(minShiftWeeks, weeksUntilAvail);
                    }
                }

                // Clamp to at least 1 week, at most remaining shift budget
                const projectMaxShift = p._reprioritization?.maxShiftWeeks ?? MAX_SHIFT_WEEKS;
                const remaining = projectMaxShift - (p._totalShiftWeeks || 0);
                const actualShift = Math.min(Math.max(1, minShiftWeeks), remaining);
                const shiftMs = actualShift * WEEK_MS_SHIFT;

                p._totalShiftWeeks = (p._totalShiftWeeks || 0) + actualShift;
                // Shift all date fields
                if (p.proposedStart) p.proposedStart = new Date(new Date(p.proposedStart).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.proposedEnd) p.proposedEnd = new Date(new Date(p.proposedEnd).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.kickOff) p.kickOff = new Date(new Date(p.kickOff).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.launch) p.launch = new Date(new Date(p.launch).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.start) p.start = new Date(new Date(p.start).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.end) p.end = new Date(new Date(p.end).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.startDate) p.startDate = new Date(new Date(p.startDate).getTime() + shiftMs).toISOString().split('T')[0];
                if (p.endDate) p.endDate = new Date(new Date(p.endDate).getTime() + shiftMs).toISOString().split('T')[0];
                // Update computed timestamps
                p._startMs = (p._startMs || 0) + shiftMs;
                p._endMs = (p._endMs || 0) + shiftMs;
                p.shiftWeeks = (p.shiftWeeks || 0) + actualShift;
                p.schedulingNote = `Shifted +${p._totalShiftWeeks}w for resource availability`;
            });

            // Fix #1: Only clear assignments for shifted/unfilled projects (not all)
            // Fix #2: Mark fully-resourced projects as locked so their resources
            //         are pre-booked in the next pass and can't be stolen
            scheduled.forEach(p => {
                if (shiftedIds.has(p.id)) {
                    // Fix #19: Only clear unfilled assignments — preserve filled roles
                    p.assignments = (p.assignments || []).filter(a => a.resourceId !== null);
                    p._seededAssignments = undefined;
                } else {
                    // Fully resourced: lock assignments so they get pre-booked
                    p._lockedAssignment = true;
                }
            });
            progress(`Shift pass ${shiftIter + 1} · ${shiftable.length} shifted +${SHIFT_WEEKS}w · ${mustDefer.length} deferred`, {
                iteration: shiftIter + 1,
                shifted: shiftable.length,
                deferred: deferred.length,
                scheduled: scheduled.length
            });
            // Fix #16: Use the best weight profile from the multi-pass sweep
            const shiftCfg = { ...cfg, _loadBalanceWeight: bestWeight };
            assignmentStats = await assignResources(scheduled, resources, shiftCfg, warnings, progress);

            await yieldToUI();
        }
    }

    // ── Step 5: Build summary stats ──
    const planStats = {
        ...stats,
        projectsScheduled: scheduled.length,
        projectsDeferred: deferred.length,
        projectsExcluded: excluded.length,
        totalArrProtected: scheduled.reduce((sum, p) => sum + (p.arr || 0), 0),
        totalArrDeferred: deferred.reduce((sum, p) => sum + (p.arr || 0), 0),
        customersServed: new Set(scheduled.map(p => p.customer)).size,
        warningCount: warnings.length,
        tierBreakdown: {
            cornerstone: scheduled.filter(p => p._reprioritization?.tier === 1).length,
            partnerAndRisk: scheduled.filter(p => p._reprioritization?.tier === 2).length,
            newWithEvent: scheduled.filter(p => p._reprioritization?.tier === 3).length,
            standard: scheduled.filter(p => p._reprioritization?.tier === 4).length,
            belowThreshold: scheduled.filter(p => p._reprioritization?.tier === 5).length
        },
        ...assignmentStats
    };

    return {
        scheduled,
        deferred,
        excluded,
        warnings,
        stats: planStats
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// AI INSIGHTS PAYLOAD BUILDER
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build a payload for the OptimizationRunService to generate LLM reasoning.
 * This creates a summary snapshot that Airtable AI can analyze.
 */
export function buildAIInsightsPayload(plan) {
    const { scheduled, deferred, stats } = plan;

    // Build concise project summaries for AI consumption
    const projectSummaries = scheduled.slice(0, 50).map(p => ({
        name: p.name,
        customer: p.customer,
        score: p._reprioritization?.score,
        tier: p._reprioritization?.tierLabel,
        arr: p.arr || 0,
        risk: p.customerRisk || 'None',
        compellingEvent: p.compellingEventDate || null,
        platform: p.platform || null,
        status: p.status,
        reasoning: p._reprioritization?.reasoning?.join(' ')
    }));

    const deferredSummaries = deferred.slice(0, 20).map(p => ({
        name: p.name,
        customer: p.customer,
        score: p._reprioritization?.score,
        arr: p.arr || 0,
        reason: p.deferralReason
    }));

    return {
        runType: 'Portfolio Reprioritization',
        timestamp: new Date().toISOString(),
        projectsInput: stats.totalProjects,
        projectsScheduled: stats.projectsScheduled,
        projectsDeferred: stats.projectsDeferred,
        projectsExcluded: stats.projectsExcluded,
        totalArrProtected: stats.totalArrProtected,
        totalArrDeferred: stats.totalArrDeferred,
        customersServed: stats.customersServed,
        tierBreakdown: stats.tierBreakdown,
        topProjects: projectSummaries,
        deferredProjects: deferredSummaries,
        warnings: plan.warnings.slice(0, 10).map(w => w.message)
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// MONTE CARLO ROBUSTNESS — Reprioritization Edition
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Random number from standard normal distribution (Box-Muller).
 * Replicates MonteCarloSimulator.randomNormal() inline to avoid circular deps.
 */
function randomNormal() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Perturb slot-map capacity to simulate resource uncertainty.
 * Each month-squad bucket gets a random leave impact & variance jitter.
 */
function perturbSlotMap(slotMap, { leaveRate = 0.05, capacityVariance = 0.15 } = {}) {
    const perturbed = {};
    Object.entries(slotMap).forEach(([month, squads]) => {
        perturbed[month] = {};
        Object.entries(squads).forEach(([squad, bucket]) => {
            const leaveImpact = Math.random() < leaveRate ? 0.7 : 1;
            const variance = 1 + randomNormal() * capacityVariance;
            const factor = Math.max(0.3, leaveImpact * variance); // never wipe out entirely
            perturbed[month][squad] = {
                ...bucket,
                available: Math.max(0, Math.round((bucket.available || 0) * factor)),
                total: bucket.total
            };
        });
    });
    return perturbed;
}

/**
 * Run Monte Carlo robustness simulation for a reprioritization plan.
 * Perturbs capacity N times, re-runs scheduling each time, and measures
 * what fraction of the originally scheduled projects still get placed.
 *
 * @param {Object} params
 * @param {Array}  params.projects   - Full project list (unscored)
 * @param {Object} params.slotMap    - Original slot map
 * @param {Array}  params.resources  - Resource pool (for assignment step)
 * @param {Object} params.config     - Reprioritization config
 * @param {Object} params.baseline   - Baseline plan result (from generateReprioritizationPlan)
 * @param {Object} params.uncertainty - Monte Carlo parameters
 * @returns {Object} { robustnessScore, confidence, simulations, risks, interpretation, volatileProjects }
 */
export async function runReprioritizationMonteCarlo({
    projects,
    slotMap,
    resources = [],
    config = {},
    baseline,
    uncertainty = {},
    onProgress = null
}) {
    const {
        simulations = 40,
        leaveRate = 0.05,
        capacityVariance = 0.15,
        scopeCreep = 0.10
    } = uncertainty;

    const baselineIds = new Set((baseline?.scheduled || []).map(p => p.id));
    const baselineCount = baselineIds.size;

    // Track per-simulation results
    const results = [];
    // Track per-project survival rates
    const projectSurvival = {};
    baselineIds.forEach(id => { projectSurvival[id] = 0; });

    const riskBreakdown = { capacityShortfall: 0, scopeOverrun: 0 };
    const mcStartTime = performance.now();
    const MC_TIME_LIMIT_MS = 120000; // 2 minute timeout for all simulations

    for (let i = 0; i < simulations; i++) {
        // Time guard: stop early if exceeding time limit
        if (i > 0 && performance.now() - mcStartTime > MC_TIME_LIMIT_MS) {
            console.warn(`[MONTE CARLO] Time limit reached after ${i}/${simulations} simulations (${Math.round(performance.now() - mcStartTime)}ms)`);
            break;
        }
        // Report progress to UI
        if (onProgress) onProgress(i + 1, simulations);
        // Yield every simulation so Chrome doesn't kill the extension
        if (i > 0) await yieldToUI();
        // Perturb capacity
        const perturbedSlotMap = perturbSlotMap(slotMap, { leaveRate, capacityVariance });

        // Optionally perturb project effort (scope creep → increase slot demands)
        // Fix R3-6: Also scale effort fields so demand/week increases (not decreases)
        const perturbedProjects = projects.map(p => {
            if (!p.slotsNeeded && !p.durationWeeks && !p.pmEffort && !p.scEffort && !p.pdEffort) return p;
            const creepFactor = 1 + randomNormal() * scopeCreep;
            return {
                ...p,
                durationWeeks: p.durationWeeks ? Math.ceil(p.durationWeeks * creepFactor) : p.durationWeeks,
                slotsNeeded: p.slotsNeeded ? Math.ceil(p.slotsNeeded * creepFactor) : p.slotsNeeded,
                pmEffort: p.pmEffort ? Math.ceil(p.pmEffort * creepFactor) : p.pmEffort,
                scEffort: p.scEffort ? Math.ceil(p.scEffort * creepFactor) : p.scEffort,
                pdEffort: p.pdEffort ? Math.ceil(p.pdEffort * creepFactor) : p.pdEffort
            };
        });

        // Re-run scheduling (skip resource assignment for speed)
        const perturbedConfig = { ...config, autoAssign: false };
        const perturbedPlan = await generateReprioritizationPlan(perturbedProjects, perturbedSlotMap, [], perturbedConfig);

        const perturbedIds = new Set((perturbedPlan.scheduled || []).map(p => p.id));

        // How many baseline projects survived?
        let survived = 0;
        let capacityLost = 0;
        baselineIds.forEach(id => {
            if (perturbedIds.has(id)) {
                survived++;
                projectSurvival[id]++;
            } else {
                capacityLost++;
            }
        });

        const fitRate = baselineCount > 0 ? survived / baselineCount : 1;
        results.push({ survived, total: baselineCount, fitRate, capacityLost });

        if (capacityLost > 0) riskBreakdown.capacityShortfall++;
    }

    // Compute robustness score
    const avgFitRate = results.reduce((s, r) => s + r.fitRate, 0) / results.length;
    const robustnessScore = Math.round(avgFitRate * 100);

    // Percentiles
    const actualRuns = results.length;
    const fitRates = results.map(r => r.fitRate).sort((a, b) => a - b);
    const p10 = fitRates[Math.floor(actualRuns * 0.1)] || 0;
    const p50 = fitRates[Math.floor(actualRuns * 0.5)] || 0;
    const p90 = fitRates[Math.floor(actualRuns * 0.9)] || 0;

    // Identify risks
    const risks = [];
    if (riskBreakdown.capacityShortfall > actualRuns * 0.5) {
        risks.push({ type: 'capacity', severity: 'high', message: 'Over half of simulations show capacity shortfall — plan is fragile' });
    }
    if (p10 < 0.7) {
        risks.push({ type: 'volatility', severity: 'medium', message: `Worst-case (p10) shows only ${Math.round(p10 * 100)}% of projects placed — high variance` });
    }
    if (avgFitRate < 0.8) {
        risks.push({ type: 'overall', severity: 'high', message: `Only ${robustnessScore}% average survival — consider adding capacity buffers` });
    }

    // Identify volatile (bubble) projects — survived < 70% of simulations
    const actualSimCount = results.length; // Use actual completed count, not requested
    const volatileProjects = Object.entries(projectSurvival)
        .filter(([, count]) => count / actualSimCount < 0.7)
        .map(([id, count]) => {
            const proj = baseline.scheduled.find(p => p.id === id);
            return {
                id,
                name: proj?.name || id,
                customer: proj?.customer,
                survivalRate: Math.round((count / actualSimCount) * 100),
                tier: proj?._reprioritization?.tier,
                score: proj?._reprioritization?.score
            };
        })
        .sort((a, b) => a.survivalRate - b.survivalRate);

    return {
        robustnessScore,
        confidence: {
            p10: Math.round(p10 * 100),
            p50: Math.round(p50 * 100),
            p90: Math.round(p90 * 100)
        },
        simulations,
        risks,
        volatileProjects,
        interpretation: robustnessScore >= 90 ? 'Highly robust'
            : robustnessScore >= 75 ? 'Reasonably robust'
                : robustnessScore >= 60 ? 'Moderate risk'
                    : 'High uncertainty — consider capacity buffers'
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SENSITIVITY ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Run sensitivity analysis: for each scheduled project, perturb its score
 * slightly and see whether it would change tiers or become deferred.
 *
 * @param {Object} baseline - Result from generateReprioritizationPlan
 * @returns {Array} Array of { id, name, sensitivity, direction, currentTier, wouldBecome }
 */
export function runSensitivityAnalysis(baseline) {
    if (!baseline?.scheduled) return [];

    const scheduled = baseline.scheduled;
    const deferred = baseline.deferred || [];

    // Find the lowest score that still got scheduled
    const lowestScheduledScore = scheduled.length > 0
        ? Math.min(...scheduled.map(p => p._reprioritization?.score || 0))
        : 0;
    // Find the highest deferred score
    const highestDeferredScore = deferred.length > 0
        ? Math.max(...deferred.map(p => p._reprioritization?.score || 0))
        : 0;

    // Score gap — how close are the boundary projects?
    const boundaryGap = lowestScheduledScore - highestDeferredScore;

    const sensitiveProjects = [];

    scheduled.forEach(p => {
        const score = p._reprioritization?.score || 0;
        const tier = p._reprioritization?.tier;

        // Distance to deferral boundary
        const distToDefer = score - highestDeferredScore;
        const sensitivity = distToDefer > 0 ? Math.round((1 / distToDefer) * 100) : 100;

        // Check if small score change would affect tier
        const scoreForPrevTier = score * 0.9; // 10% drop
        let wouldBecomeTier = tier;
        if (scoreForPrevTier < 40) wouldBecomeTier = 5;
        else if (scoreForPrevTier < 55) wouldBecomeTier = 4;
        else if (scoreForPrevTier < 70) wouldBecomeTier = 3;

        const tierChange = wouldBecomeTier !== tier;
        const nearDefer = distToDefer < boundaryGap * 0.25;

        if (tierChange || nearDefer || sensitivity > 50) {
            sensitiveProjects.push({
                id: p.id,
                name: p.name,
                customer: p.customer,
                score: Math.round(score),
                tier,
                sensitivity: Math.min(100, sensitivity),
                tierChange: tierChange ? { from: tier, to: wouldBecomeTier } : null,
                nearDeferral: nearDefer,
                distToDefer: Math.round(distToDefer)
            });
        }
    });

    // Sort by sensitivity (highest first)
    sensitiveProjects.sort((a, b) => b.sensitivity - a.sensitivity);

    return sensitiveProjects;
}

// ═════════════════════════════════════════════════════════════════════════════
// STRATEGY COMPARISON (Pareto-style)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Strategy presets for reprioritization — different philosophies for ordering
 * the portfolio. Each has multipliers applied to the scoring factors.
 */
export const REPRI_STRATEGY_PRESETS = {
    balanced: {
        name: 'Balanced',
        icon: '⚖️',
        description: 'Equal weight to all scoring factors',
        color: '#00BD00',
        overrides: {} // Use default weights
    },
    arrMax: {
        name: 'Revenue Maximiser',
        icon: '💰',
        description: 'Prioritise highest-ARR projects first',
        color: '#22c55e',
        overrides: {
            arrWeight: 2.0,           // Double ARR importance
            statusWeight: 0.5,       // Halve status weighting
            eventWeight: 0.5         // Halve event weighting
        }
    },
    onTime: {
        name: 'On-Time Delivery',
        icon: '⏰',
        description: 'Prioritise projects with compelling events and imminent launches',
        color: '#FE9922',
        overrides: {
            arrWeight: 0.5,
            eventWeight: 2.0,         // Double compelling event importance
            statusWeight: 2.0         // Double status importance (in-flight gets bigger boost)
        }
    },
    volumeMax: {
        name: 'Volume Maximiser',
        icon: '📈',
        description: 'Schedule as many projects as possible, even if ARR is lower',
        color: '#4794FF',
        overrides: {
            defaultMaxShiftWeeks: 52,  // Allow much more flexibility
            cornerstoneMaxShiftWeeks: 16,
            arrWeight: 0.3
        }
    },

    bauRealloc10: {
        name: 'BAU Realloc 10%',
        icon: '🔄',
        description: 'Model taking 10% capacity from BAU teams to increase project throughput',
        color: '#06b6d4',
        overrides: {
            maxConcurrentCountries: 14,   // ~10% more headroom (base 10 → 14 to model freed slots)
            defaultMaxShiftWeeks: 30,     // Slightly more schedule flexibility
            capacityBoostPct: 10          // Metadata: 10% boost (for display)
        }
    },
    bauRealloc20: {
        name: 'BAU Realloc 20%',
        icon: '🔄',
        description: 'Model taking 20% capacity from BAU teams — aggressive throughput increase',
        color: '#0891b2',
        overrides: {
            maxConcurrentCountries: 18,   // ~20% more headroom
            defaultMaxShiftWeeks: 35,     // Even more schedule flexibility
            cornerstoneMaxShiftWeeks: 10, // Slightly relax cornerstone constraints
            capacityBoostPct: 20          // Metadata: 20% boost (for display)
        }
    }
};

/**
 * Generate multiple reprioritization plans using different strategies.
 * Returns a comparison table the user can examine to understand trade-offs.
 *
 * @param {Array}  projects  - Full project list
 * @param {Object} slotMap   - Slot availability map
 * @param {Array}  resources - Resource pool
 * @param {Object} baseConfig - Base configuration
 * @returns {Object} { strategies: [{ key, name, icon, description, stats, highlights }], bestByMetric }
 */
export async function generateStrategyComparison(projects, slotMap, resources = [], baseConfig = {}) {
    const strategies = [];

    // Run strategies SEQUENTIALLY (not parallel) to avoid crashing Chrome
    for (const [key, preset] of Object.entries(REPRI_STRATEGY_PRESETS)) {
        await yieldToUI();
        try {
            const strategyConfig = { ...baseConfig, ...preset.overrides, autoAssign: false };
            const plan = await generateReprioritizationPlan(projects, slotMap, resources, strategyConfig);
            const stats = plan.stats || {};
            strategies.push({
                key,
                name: preset.name,
                icon: preset.icon,
                color: preset.color,
                description: preset.description,
                stats: {
                    projectsScheduled: stats.projectsScheduled || 0,
                    projectsDeferred: stats.projectsDeferred || 0,
                    totalArrProtected: stats.totalArrProtected || 0,
                    customersServed: stats.customersServed || 0,
                    avgShiftWeeks: plan.scheduled?.length > 0
                        ? (plan.scheduled.reduce((s, p) => s + Math.abs(p.shiftWeeks || 0), 0) / plan.scheduled.length).toFixed(1)
                        : '0',
                    warningCount: (plan.warnings || []).length
                },
                scheduled: plan.scheduled || [],
                deferred: plan.deferred || []
            });
        } catch (e) {
            console.warn(`[STRATEGY] ${key} failed:`, e);
        }
    }

    if (strategies.length === 0) return { strategies: [], bestByMetric: {} };

    // Determine best strategy per metric
    const bestByMetric = {
        mostProjects: strategies.reduce((best, s) => s.stats.projectsScheduled > best.stats.projectsScheduled ? s : best, strategies[0]).key,
        highestArr: strategies.reduce((best, s) => s.stats.totalArrProtected > best.stats.totalArrProtected ? s : best, strategies[0]).key,
        leastDelay: strategies.reduce((best, s) => parseFloat(s.stats.avgShiftWeeks) < parseFloat(best.stats.avgShiftWeeks) ? s : best, strategies[0]).key,
        fewestWarnings: strategies.reduce((best, s) => s.stats.warningCount < best.stats.warningCount ? s : best, strategies[0]).key
    };

    return { strategies, bestByMetric };
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER DISPLAY HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/** Label and colour for each tier — for use in the UI */
export const TIER_CONFIG = {
    1: { label: 'Cornerstone', color: '#FF6B35', bgColor: 'rgba(255,107,53,0.12)', icon: '◆' },
    2: { label: 'Protected', color: '#E83F6F', bgColor: 'rgba(232,63,111,0.12)', icon: '●' },
    3: { label: 'New + Event', color: '#2274A5', bgColor: 'rgba(34,116,165,0.12)', icon: '▲' },
    4: { label: 'Standard', color: '#32936F', bgColor: 'rgba(50,147,111,0.12)', icon: '■' },
    5: { label: 'Below Threshold', color: '#95A5A6', bgColor: 'rgba(149,165,166,0.12)', icon: '▼' },
    '-1': { label: 'Excluded', color: '#7F8C8D', bgColor: 'rgba(127,140,141,0.08)', icon: '✕' }
};

/** Risk level display config */
export const RISK_CONFIG = {
    'high': { label: 'High', color: '#E74C3C', icon: '●' },
    'medium': { label: 'Medium', color: '#F39C12', icon: '●' },
    'low': { label: 'Low', color: '#27AE60', icon: '●' },
    'verbal': { label: 'Verbal', color: '#E67E22', icon: '●' },
    'served notice': { label: 'Served Notice', color: '#7F8C8D', icon: '✕' }
};

// ═════════════════════════════════════════════════════════════════════════════
// FINANCIAL IMPACT ANALYSIS — Multi-FY Revenue Comparison
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Determine which FY label a date falls into (e.g. "FY25/26").
 * Returns null if the date is invalid.
 *
 * @param {Date} date
 * @param {number} fyStartMonth - 0-indexed month (default 4 = May)
 * @returns {string|null} FY label like "FY25/26"
 */
function getFYLabel(date, fyStartMonth = 4) {
    if (!date || isNaN(date.getTime())) return null;
    const month = date.getMonth();
    const year = date.getFullYear();
    // If before FY start month, we're in the previous FY
    const fyStartYear = month < fyStartMonth ? year - 1 : year;
    const fyEndYear = fyStartYear + 1;
    return `FY${String(fyStartYear).slice(-2)}/${String(fyEndYear).slice(-2)}`;
}

/**
 * Get the FY start and end dates for a given FY start year.
 */
function getFYBounds(fyStartYear, fyStartMonth = 4) {
    const fyStart = new Date(fyStartYear, fyStartMonth, 1);
    const fyEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
    const fyEndYear = fyStartMonth === 0 ? fyStartYear : fyStartYear + 1;
    const fyEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59);
    return { fyStart, fyEnd };
}

/**
 * Calculate implementation fee recognised within an FY boundary.
 * POC model: pro-rated across kickoff→launch overlapping with FY.
 * Non-POC: full recognition at launch.
 */
function calcImplFeeInFY(implFee, kickOff, launch, fyStart, fyEnd, isPOC) {
    if (!launch || implFee <= 0) return 0;

    if (isPOC && kickOff && launch > kickOff) {
        const projectDuration = launch.getTime() - kickOff.getTime();
        const effectiveStart = Math.max(kickOff.getTime(), fyStart.getTime());
        const effectiveEnd = Math.min(launch.getTime(), fyEnd.getTime());
        if (effectiveEnd > effectiveStart) {
            return ((effectiveEnd - effectiveStart) / projectDuration) * implFee;
        }
        return 0;
    }

    // Non-POC: full at launch
    return (launch >= fyStart && launch <= fyEnd) ? implFee : 0;
}

/**
 * Calculate financial impact of a reprioritization plan by comparing
 * baseline dates (original project schedule) vs optimised dates
 * (reprioritized schedule) across multiple financial years.
 *
 * @param {Object} params
 * @param {Array}  params.scheduled - Scheduled projects from reprioritization
 * @param {Array}  params.deferred  - Deferred projects from reprioritization
 * @param {Array}  params.excluded  - Excluded projects from reprioritization
 * @param {number} params.fyStartMonth - FY start month (0-indexed, default 4 = May)
 * @param {number} params.fyCount      - Number of FYs to show (default 5)
 * @returns {Object} { fyBreakdown: [...], totals, projectBreakdown: [...] }
 */
export function calculateFinancialImpact({
    scheduled = [],
    deferred = [],
    excluded = [],
    fyStartMonth = 4,
    fyCount = 5
} = {}) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentFYStart = currentMonth < fyStartMonth ? currentYear - 1 : currentYear;

    // Build FY labels for the range
    const fyLabels = [];
    for (let i = 0; i < fyCount; i++) {
        const startYr = currentFYStart + i;
        fyLabels.push(`FY${String(startYr).slice(-2)}/${String(startYr + 1).slice(-2)}`);
    }

    // Initialize accumulators: one per FY + "Unscheduled"
    const allBuckets = [...fyLabels, 'Unscheduled'];
    const emptyBucket = () => ({ arr: 0, implFee: 0, total: 0 });
    const baseline = {};
    const optimised = {};
    allBuckets.forEach(b => { baseline[b] = emptyBucket(); optimised[b] = emptyBucket(); });

    // Per-project breakdown for drill-down
    const projectBreakdown = [];

    // Helper to safely parse date
    const safeDate = (v) => {
        if (!v) return null;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d;
    };

    // Process all projects (scheduled + deferred + excluded)
    const allProjects = [
        ...scheduled.map(p => ({ ...p, _repriStatus: 'scheduled' })),
        ...deferred.map(p => ({ ...p, _repriStatus: 'deferred' })),
        ...excluded.map(p => ({ ...p, _repriStatus: 'excluded' }))
    ];

    allProjects.forEach(project => {
        const arrVal = project.arr || project.transactionalBenefits || 0;
        const implFee = project.implFee || 0;
        if (arrVal <= 0 && implFee <= 0) return; // No financial data

        const isPOC = project.revenueModel && project.revenueModel.toLowerCase().includes('poc');

        // Baseline dates (original project schedule)
        const baselineLaunch = safeDate(project.end || project.launch);
        const baselineKickOff = safeDate(project.start || project.kickOff);

        // Optimised dates (reprioritized schedule)
        const isDeferred = project._repriStatus === 'deferred';
        const isExcluded = project._repriStatus === 'excluded';
        const optimisedLaunch = (isDeferred || isExcluded)
            ? null  // Revenue not scheduled
            : safeDate(project.proposedEnd || project.end || project.launch);
        const optimisedKickOff = (isDeferred || isExcluded)
            ? null
            : safeDate(project.proposedStart || project.start || project.kickOff);

        // Track per-project
        const projectEntry = {
            id: project.id,
            name: project.name,
            customer: project.customer,
            status: project._repriStatus,
            tier: project._reprioritization?.tier,
            arr: arrVal,
            implFee: implFee,
            revenueModel: isPOC ? 'POC' : 'Non-POC',
            baselineLaunch: baselineLaunch?.toISOString?.()?.split('T')[0] || null,
            optimisedLaunch: optimisedLaunch?.toISOString?.()?.split('T')[0] || null,
            baselineFY: null,
            optimisedFY: null,
            delta: { arr: 0, implFee: 0, total: 0 }
        };

        // ── Baseline allocation ──
        if (baselineLaunch) {
            const fy = getFYLabel(baselineLaunch, fyStartMonth);
            projectEntry.baselineFY = fy;

            if (fy && baseline[fy]) {
                // ARR at launch
                baseline[fy].arr += arrVal;
                // Impl fee
                for (let i = 0; i < fyCount; i++) {
                    const { fyStart, fyEnd } = getFYBounds(currentFYStart + i, fyStartMonth);
                    const fee = calcImplFeeInFY(implFee, baselineKickOff, baselineLaunch, fyStart, fyEnd, isPOC);
                    if (fee > 0) baseline[fyLabels[i]].implFee += fee;
                }
            } else {
                // Falls outside our FY range — still baseline but outside window
                // We skip these (pre-current-FY projects have already been recognised)
            }
        }

        // ── Optimised allocation ──
        if (optimisedLaunch) {
            const fy = getFYLabel(optimisedLaunch, fyStartMonth);
            projectEntry.optimisedFY = fy;

            if (fy && optimised[fy]) {
                optimised[fy].arr += arrVal;
                for (let i = 0; i < fyCount; i++) {
                    const { fyStart, fyEnd } = getFYBounds(currentFYStart + i, fyStartMonth);
                    const fee = calcImplFeeInFY(implFee, optimisedKickOff, optimisedLaunch, fyStart, fyEnd, isPOC);
                    if (fee > 0) optimised[fyLabels[i]].implFee += fee;
                }
            }
        } else if (isDeferred || isExcluded) {
            // Revenue unscheduled
            optimised['Unscheduled'].arr += arrVal;
            optimised['Unscheduled'].implFee += implFee;
        }

        // Calculate project-level delta
        const baseTotal = arrVal + implFee;
        const optTotal = (isDeferred || isExcluded) ? 0 : (arrVal + implFee);
        projectEntry.delta = {
            arr: (isDeferred || isExcluded) ? -arrVal : 0,
            implFee: (isDeferred || isExcluded) ? -implFee : 0,
            total: optTotal - baseTotal
        };

        projectBreakdown.push(projectEntry);
    });

    // Calculate totals for each bucket
    allBuckets.forEach(b => {
        baseline[b].total = baseline[b].arr + baseline[b].implFee;
        optimised[b].total = optimised[b].arr + optimised[b].implFee;
    });

    // Build per-FY breakdown with deltas
    const fyBreakdown = allBuckets.map(fy => ({
        fy,
        baseline: { ...baseline[fy] },
        optimised: { ...optimised[fy] },
        delta: {
            arr: optimised[fy].arr - baseline[fy].arr,
            implFee: optimised[fy].implFee - baseline[fy].implFee,
            total: optimised[fy].total - baseline[fy].total
        }
    }));

    // Grand totals
    const grandBaseline = emptyBucket();
    const grandOptimised = emptyBucket();
    fyLabels.forEach(fy => {
        grandBaseline.arr += baseline[fy].arr;
        grandBaseline.implFee += baseline[fy].implFee;
        grandBaseline.total += baseline[fy].total;
        grandOptimised.arr += optimised[fy].arr;
        grandOptimised.implFee += optimised[fy].implFee;
        grandOptimised.total += optimised[fy].total;
    });

    return {
        fyBreakdown,
        totals: {
            baseline: grandBaseline,
            optimised: grandOptimised,
            delta: {
                arr: grandOptimised.arr - grandBaseline.arr,
                implFee: grandOptimised.implFee - grandBaseline.implFee,
                total: grandOptimised.total - grandBaseline.total
            }
        },
        projectBreakdown: projectBreakdown.filter(p => p.arr > 0 || p.implFee > 0),
        fyLabels,
        fyStartMonth
    };
}
