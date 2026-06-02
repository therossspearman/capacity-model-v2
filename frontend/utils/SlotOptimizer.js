/**
 * SlotOptimizer - Generates optimization recommendations
 * Uses slot availability data to suggest project movements
 */

/**
 * Movement recommendation type
 * @typedef {Object} Recommendation
 * @property {string} projectId - Project ID
 * @property {string} projectName - Project name
 * @property {string} currentSquad - Current squad
 * @property {string} suggestedSquad - Suggested destination squad
 * @property {string} currentWeek - Current launch week
 * @property {string} suggestedWeek - Suggested launch week
 * @property {number} slotGain - Net slot gain from this move
 * @property {string} reason - Human-readable reason
 * @property {'date'|'squad'|'both'} type - Type of movement
 * @property {number} priority - 0-100 priority score
 * @property {boolean} isBlocked - Whether locks prevent this move
 */

/**
 * Optimization configuration
 * @typedef {Object} OptimizationConfig
 * @property {number} priorityDial - 0-100 (0=Max Slots, 100=Min Disruption)
 * @property {boolean} reserveEnabled - Whether to reserve slots for pipeline
 * @property {number} reservePerMonth - How many slots to reserve
 * @property {Object} slotProfile - Standard project profile
 */

/**
 * Generate optimization recommendations
 * @param {Object} slotMap - Slot availability map { squad: { week: { score, bottleneck, ... } } }
 * @param {Array} projects - All projects with dates and locks
 * @param {OptimizationConfig} config - Optimization settings
 * @returns {Recommendation[]} - List of recommendations sorted by priority
 */
export const generateRecommendations = (slotMap, projects, config) => {
    const recommendations = [];
    const {
        priorityDial = 50,
        reserveEnabled = false,
        reservePerMonth = 1,
        slotProfile
    } = config || {};

    if (!slotMap || !projects || !slotProfile) {
        return [];
    }

    // Priority dial controls how aggressive we are
    // 0 = aggressive (maximize slots, accept disruption)
    // 100 = conservative (minimize disruption, fewer recommendations)
    const aggressiveness = (100 - priorityDial) / 100;

    // Get all squads and weeks from slotMap
    const squads = Object.keys(slotMap);
    const allWeeks = new Set();
    squads.forEach(squad => {
        Object.keys(slotMap[squad] || {}).forEach(week => allWeeks.add(week));
    });
    const weeks = Array.from(allWeeks).sort();

    // Filter movable projects (not locked or immovable)
    const movableProjects = projects.filter(p => {
        // Skip if marked as immovable (priority lock)
        if (p.immovable || p.priorityLock) return false;
        // Skip if fully locked
        if (p.lockLaunch && p.lockSquad) return false;
        // Skip closed/cancelled
        const status = (p.status || '').toLowerCase();
        if (status.includes('closed') || status.includes('cancelled')) return false;
        // Skip past projects
        const end = new Date(p.end || p.launch);
        if (end < new Date()) return false;
        return true;
    });

    // Build customer commitment map (earliest allowed KO per customer)
    const customerCommitments = {};
    projects.forEach(p => {
        if (!p.customer) return;
        // Use contractedKO or commitmentDate if available
        const commitDate = p.contractedKickOff || p.commitmentDate || p.kickOff || p.start;
        if (commitDate) {
            const d = new Date(commitDate);
            if (!customerCommitments[p.customer] || d < customerCommitments[p.customer]) {
                customerCommitments[p.customer] = d;
            }
        }
    });

    // Build customer project groups for dependency awareness
    const customerProjects = {};
    projects.forEach(p => {
        if (!p.customer) return;
        if (!customerProjects[p.customer]) customerProjects[p.customer] = [];
        customerProjects[p.customer].push(p);
    });
    // Sort each customer's projects by KO date
    Object.values(customerProjects).forEach(list => {
        list.sort((a, b) => new Date(a.kickOff || a.start || 0) - new Date(b.kickOff || b.start || 0));
    });

    // Build program project groups for program-level dependency awareness
    // Projects in the same program should maintain sequence order
    const programProjects = {};
    projects.forEach(p => {
        // Program can be explicit field or derived from customer + workstream combination
        const programKey = p.program || (p.customer && p.workstream ? `${p.customer}::${p.workstream}` : null);
        if (!programKey) return;
        if (!programProjects[programKey]) programProjects[programKey] = [];
        programProjects[programKey].push(p);
    });
    // Sort each program's projects by sequence number (if available) or KO date
    Object.values(programProjects).forEach(list => {
        list.sort((a, b) => {
            // First by explicit sequence/phase number
            const seqA = a.programSequence || a.phaseNumber || 999;
            const seqB = b.programSequence || b.phaseNumber || 999;
            if (seqA !== seqB) return seqA - seqB;
            // Fallback to KO date
            return new Date(a.kickOff || a.start || 0) - new Date(b.kickOff || b.start || 0);
        });
    });

    // For each movable project, check if moving it would improve slots
    movableProjects.forEach(project => {
        const currentSquad = project.squads?.[0] || project.squad;
        const currentWeek = project.end || project.launch;

        if (!currentSquad || !currentWeek) return;

        // Find current week's slot state
        const currentWeekKey = getWeekKey(currentWeek);
        const currentSlotData = slotMap[currentSquad]?.[currentWeekKey];

        // If current position is congested (score < 0.8), look for better options
        if (currentSlotData && currentSlotData.score < 0.8) {
            // Strategy 1: Move to different week in same squad (if not date-locked)
            if (!project.lockLaunch) {
                weeks.forEach(weekKey => {
                    const currentWeekKey = getWeekKey(project.end || project.launch);
                    if (weekKey === currentWeekKey) return;
                    const targetSlot = slotMap[currentSquad]?.[weekKey];
                    if (!targetSlot) return;

                    // CHECK: Started Project Constraint
                    // If the project has already LAUNCHED (end/launch < today), we cannot move it.
                    // But if it has just started (KO < today but launch >= today), we CAN still shift.
                    const projectLaunch = new Date(project.launch || project.end);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (projectLaunch < today) {
                        // Project has already launched - cannot shift
                        return;
                    }

                    // Check customer commitment constraint
                    if (project.customer && customerCommitments[project.customer]) {
                        const targetDate = new Date(weekKey);
                        const commitDate = customerCommitments[project.customer];
                        // Don't suggest moving before the commitment date
                        if (targetDate < commitDate) return;
                    }

                    // Check customer project sequence (don't break dependencies)
                    if (project.customer && customerProjects[project.customer]) {
                        const siblings = customerProjects[project.customer];
                        const myIndex = siblings.findIndex(p => p.id === project.id);
                        if (myIndex > 0) {
                            // This project has a predecessor - don't move before it
                            const predecessor = siblings[myIndex - 1];
                            const predEnd = new Date(predecessor.launch || predecessor.end || 0);
                            const targetDate = new Date(weekKey);
                            if (targetDate < predEnd) return; // Would break sequence
                        }
                    }

                    // Check program project sequence (don't break program dependencies)
                    const programKey = project.program || (project.customer && project.workstream ? `${project.customer}::${project.workstream}` : null);
                    if (programKey && programProjects[programKey]) {
                        const siblings = programProjects[programKey];
                        const myIndex = siblings.findIndex(p => p.id === project.id);
                        if (myIndex > 0) {
                            // This project has a predecessor in the program - don't move before it
                            const predecessor = siblings[myIndex - 1];
                            const predEnd = new Date(predecessor.launch || predecessor.end || 0);
                            const targetDate = new Date(weekKey);
                            if (targetDate < predEnd) return; // Would break program sequence
                        }
                    }

                    // Only suggest if target week has significantly better slots
                    if (targetSlot.score > currentSlotData.score + 0.2) {
                        const slotGain = targetSlot.score - currentSlotData.score;
                        const disruptionCost = getDateMovementCost(currentWeek, weekKey);

                        // Apply priority dial: high dial = require more gain per disruption
                        // Advanced Cost Function
                        // Priority Dial > 50 (Schedule Focus): Exponential penalty for date moves
                        // Priority Dial < 50 (Util Focus): Linear, lower penalty

                        let disruptionPenalty = 0;
                        if (priorityDial > 60) {
                            // High priority on schedule: moving dates is very expensive
                            disruptionPenalty = Math.pow(Math.abs(getDateMovementCost(currentWeek, weekKey)), 1.5) * (priorityDial / 50);
                        } else {
                            // Utilization focus: moving dates is cheap if it gains slots
                            disruptionPenalty = getDateMovementCost(currentWeek, weekKey) * (priorityDial / 100);
                        }

                        const effectiveGain = slotGain - disruptionPenalty;

                        // Buffer Awareness: If buffer is set (e.g. 20%), we require HIGHER gain to justify a move 
                        // unless we are moving OUT of a bottleneck zone (score < 0.5)
                        const bufferFactor = config.capacityBuffer ? (config.capacityBuffer / 100) : 0;
                        const strictness = 0.1 + (priorityDial / 100) * 0.3 + bufferFactor;

                        if (effectiveGain > strictness * aggressiveness) {
                            // Check if this is a sequence-aware move (note in reason)
                            const isCustomerSequence = project.customer && customerProjects[project.customer]?.length > 1;
                            const isProgramSequence = programKey && programProjects[programKey]?.length > 1;
                            const sequenceTags = [];
                            if (isCustomerSequence) sequenceTags.push('customer-safe');
                            if (isProgramSequence) sequenceTags.push('program-safe');
                            const sequenceNote = sequenceTags.length > 0 ? ` [${sequenceTags.join(', ')}]` : '';

                            recommendations.push({
                                projectId: project.id,
                                projectName: project.name,
                                currentSquad,
                                suggestedSquad: currentSquad,
                                currentWeek: currentWeekKey,
                                suggestedWeek: weekKey,
                                slotGain: Math.round(slotGain * 100) / 100,
                                reason: `Move from congested week (${Math.round(currentSlotData.score * 100)}%) to open week (${Math.round(targetSlot.score * 100)}%)${sequenceNote}`,
                                type: 'date',
                                priority: Math.round(effectiveGain * 100),
                                isBlocked: false,
                                customer: project.customer,
                                program: programKey
                            });
                        }
                    }
                });
            }

            // Strategy 2: Move to different squad (if not squad-locked)
            if (!project.lockSquad) {
                squads.forEach(targetSquad => {
                    if (targetSquad === currentSquad) return;
                    const targetSlot = slotMap[targetSquad]?.[currentWeekKey];
                    if (!targetSlot) return;

                    // Only suggest if target squad has better capacity
                    if (targetSlot.score > currentSlotData.score + 0.15) {
                        // Check resource compatibility? (Simplified: assume if resources aren't locked, we can move)
                        if (project.lockResources) {
                            // If resources are locked, we can only move if target squad has capacity for THOSE resources.
                            // For now, let's penalize or block squad moves for locked resources pending deeper skill check.
                            // We'll proceed but mark as potentially risky or lower priority?
                            // Better safe: don't suggest squad moves if resources are locked (assuming resources are tied to squad)
                            // Actually, lockResources usually means "don't change the assigned people". 
                            // If we move squad, we might lose those people. 
                            // Let's BLOCk squad moves if lockResources is true.
                            return;
                        }

                        const slotGain = targetSlot.score - currentSlotData.score;
                        const disruptionCost = 0.3; // Squad moves are more disruptive

                        const effectiveGain = slotGain - (disruptionCost * (priorityDial / 100));
                        const threshold = 0.15 + (priorityDial / 100) * 0.2;

                        if (effectiveGain > threshold * aggressiveness) {
                            recommendations.push({
                                projectId: project.id,
                                projectName: project.name,
                                currentSquad,
                                suggestedSquad: targetSquad,
                                currentWeek: currentWeekKey,
                                suggestedWeek: currentWeekKey,
                                slotGain: Math.round(slotGain * 100) / 100,
                                reason: `${currentSquad} is ${currentSlotData.bottleneck}-constrained; ${targetSquad} has capacity`,
                                type: 'squad',
                                priority: Math.round(effectiveGain * 100),
                                isBlocked: false,
                                customer: project.customer
                            });
                        }
                    }
                });
            }
        }
    });

    // Apply slot reservation (reduce recommendations if we're over-optimizing)
    if (reserveEnabled && reservePerMonth > 0) {
        // Group recommendations by month and cap them
        const byMonth = {};
        recommendations.forEach(rec => {
            const month = rec.suggestedWeek?.substring(0, 7) || 'unknown';
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(rec);
        });

        // Mark lower-priority recommendations as "blocked" if over quota
        Object.values(byMonth).forEach(monthRecs => {
            monthRecs.sort((a, b) => b.priority - a.priority);
            monthRecs.forEach((rec, idx) => {
                if (idx >= reservePerMonth * 2) { // Allow 2x reserve as buffer
                    rec.isBlocked = true;
                    rec.reason += ' (blocked: slot reservation)';
                }
            });
        });
    }

    // Sort by priority (highest first) and filter blocked if dial is high
    return recommendations
        .filter(r => priorityDial < 80 || !r.isBlocked)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 20); // Cap at 20 recommendations
};

/**
 * Generate bulk allocation plan for unallocated projects
 * @param {Object} slotMap - Slot availability map { squad: { week: { score, availableSlots, bottleneck } } }
 * @param {Array} projects - Unallocated projects to place
 * @param {Object} config - Configuration options
 * @returns {Object} - { allocations: [], unplaceable: [], warnings: [], stats: {} }
 */
export const generateBulkAllocationPlan = (slotMap, projects, config = {}) => {
    const {
        reservedSlotsPerMonth = 0,      // Option A: reserve N slots per month for sales
        protectedSlots = [],             // Option B: specific {squad, week} pairs to protect
        maxDelayWeeks = 8,               // Max weeks to delay from preferred date
        allowCrossSquad = true,          // Allow multi-slot to span squads as last resort
        allowOverstaff = false,          // Allow going over capacity using buffer
        bufferPercent = 20,              // Buffer percentage for overstaffing
        slotProfile                      // Standard slot profile for duration
    } = config;

    if (!slotMap || !projects?.length) {
        return { allocations: [], unplaceable: [], warnings: [], stats: {} };
    }

    const durationWeeks = slotProfile?.durationWeeks || 12;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const squads = Object.keys(slotMap);

    // Build availability matrix: track remaining slots per squad/week
    const availability = {};
    const allWeeks = new Set();

    squads.forEach(squad => {
        availability[squad] = {};
        Object.entries(slotMap[squad] || {}).forEach(([week, bucket]) => {
            allWeeks.add(week);
            const baseSlots = bucket.availableSlots || 0;
            const isProtected = protectedSlots.some(p => p.squad === squad && p.week === week);
            availability[squad][week] = {
                base: baseSlots,
                remaining: isProtected ? 0 : baseSlots,
                protected: isProtected,
                bottleneck: bucket.bottleneck,
                score: bucket.score || 0
            };
        });
    });

    const weeks = Array.from(allWeeks).sort();
    const todayMs = new Date().setHours(0, 0, 0, 0);

    // Apply monthly reservation (Option A)
    if (reservedSlotsPerMonth > 0) {
        const monthCounts = {};
        weeks.forEach(week => {
            const dateMs = new Date(week).getTime();
            if (dateMs < todayMs) return; // Skip past
            const month = week.substring(0, 7);
            if (!monthCounts[month]) monthCounts[month] = { reserved: 0, weeks: [] };
            monthCounts[month].weeks.push(week);
        });

        // Reserve slots from end of each month (latest weeks)
        Object.values(monthCounts).forEach(m => {
            m.weeks.sort().reverse();
            let toReserve = reservedSlotsPerMonth;
            for (const week of m.weeks) {
                if (toReserve <= 0) break;
                for (const squad of squads) {
                    if (toReserve <= 0) break;
                    if (availability[squad][week]?.remaining > 0) {
                        const take = Math.min(availability[squad][week].remaining, toReserve);
                        availability[squad][week].remaining -= take;
                        availability[squad][week].reserved = (availability[squad][week].reserved || 0) + take;
                        toReserve -= take;
                    }
                }
            }
        });
    }

    // Build dependency graph and process queue
    // Projects in the same program/customer should effectively be sequential if they overlap significantly
    // But we strictly enforce sequence based on dates/numbers
    const projectDeps = {
        successors: {},   // projectId -> [successorIds]
        predecessors: {}, // projectId -> [predecessorIds]
        counts: {}        // projectId -> pendingPredecessorCount
    };

    const programUsage = {}; // Track concurrent projects per program: { programId: { week: count } }
    const placedProjects = {}; // Map of projectId -> { endWeek }

    // Helper: Identify program key
    const getProgramKey = (p) => p.program || (p.customer && p.workstream ? `${p.customer}::${p.workstream}` : `Customer::${p.customer}`);

    // Groups for dependencies
    const grouped = {};
    projects.forEach(p => {
        const key = getProgramKey(p);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
        projectDeps.successors[p.id] = [];
        projectDeps.predecessors[p.id] = [];
        projectDeps.counts[p.id] = 0;
    });

    // Build graph within groups
    Object.values(grouped).forEach(group => {
        // Sort by sequence or date
        group.sort((a, b) => {
            const seqA = a.programSequence || a.phaseNumber || 999;
            const seqB = b.programSequence || b.phaseNumber || 999;
            if (seqA !== seqB) return seqA - seqB;
            return new Date(a.kickOff || a.start || 0) - new Date(b.kickOff || b.start || 0);
        });

        // Link sequential dependencies
        for (let i = 0; i < group.length - 1; i++) {
            const pred = group[i];
            const succ = group[i + 1];
            projectDeps.successors[pred.id].push(succ.id);
            projectDeps.predecessors[succ.id].push(pred.id);
            projectDeps.counts[succ.id]++;
        }
    });

    const queue = []; // Projects ready to be placed (0 predecessor count)
    const allIds = new Set(projects.map(p => p.id));

    // Initialize queue
    projects.forEach(p => {
        if (projectDeps.counts[p.id] === 0) {
            queue.push(p);
        }
    });

    let loopSafety = 0;
    while (queue.length > 0) {
        if (loopSafety++ > 10000) break; // Emergency break

        // Sort queue by Value (Highest first) to prioritize important work among available
        queue.sort((a, b) => {
            const aValue = (a.transactionalBenefits || 0) + (a.arr || 0);
            const bValue = (b.transactionalBenefits || 0) + (b.arr || 0);
            return bValue - aValue;
        });

        // Pop highest value project
        const project = queue.shift();

        // ---------------------------------------------------------
        // Determine Constraints
        // ---------------------------------------------------------

        // 1. Min Start Date based on predecessors
        let minStartMs = todayMs;
        const preds = projectDeps.predecessors[project.id];
        if (preds.length > 0) {
            preds.forEach(predId => {
                const placed = placedProjects[predId];
                if (placed && placed.endWeek) {
                    // Start AFTER predecessor ends (sequential shift)
                    const predEndMs = new Date(placed.endWeek).getTime();
                    // Optional: Add a gap? For now 0 gap.
                    if (predEndMs > minStartMs) minStartMs = predEndMs;
                }
            });
        }

        const slotsNeeded = calculateSlotsRequired(project, slotProfile);
        const preferredSquad = project.squads?.[0] !== 'Unassigned' ? project.squads?.[0] : null;
        let preferredWeek = project.kickOff || project.start;

        // Adjust preferred week if predecessors push it out
        if (preferredWeek) {
            const prefMs = new Date(preferredWeek).getTime();
            if (prefMs < minStartMs) {
                preferredWeek = new Date(minStartMs).toISOString().split('T')[0];
            }
        } else {
            preferredWeek = new Date(minStartMs).toISOString().split('T')[0];
        }

        const programKey = getProgramKey(project);
        const MAX_CONCURRENCY = config.programConcurrency || 2; // Default limit for "stacking" within a program

        // Try to find placement
        const placement = findPlacement({
            project,
            slotsNeeded,
            preferredSquad,
            preferredWeek,
            squads,
            weeks,
            availability,
            durationWeeks,
            maxDelayWeeks,
            allowCrossSquad,
            allowOverstaff,
            bufferPercent,
            todayMs,
            // Custom Constraints:
            programKey,
            programUsage,
            maxConcurrency: MAX_CONCURRENCY
        });

        if (placement) {
            allocations.push({
                projectId: project.id,
                projectName: project.name,
                projectValue: (project.transactionalBenefits || 0) + (project.arr || 0),
                slotsNeeded,
                ...placement
            });

            // Update Availability
            placement.slotAssignments.forEach(({ squad, week }) => {
                if (availability[squad]?.[week]) {
                    availability[squad][week].remaining -= 1;
                }

                // Track Program Concurrency
                if (!programUsage[programKey]) programUsage[programKey] = {};
                if (!programUsage[programKey][week]) programUsage[programKey][week] = 0;
                programUsage[programKey][week] += 1;
            });

            // Record placement for dependencies
            // For now assume contiguous single block for end date calc
            let maxWeek = placement.suggestedKO;
            placement.slotAssignments.forEach(sa => {
                if (sa.week > maxWeek) maxWeek = sa.week;
            });
            // End date is approx maxWeek + 1 week (duration unit)
            // Or better: Max Week + 7 days
            const endMs = new Date(maxWeek).getTime() + weekMs;
            const endWeekStr = new Date(endMs).toISOString().split('T')[0];

            placedProjects[project.id] = { startWeek: placement.suggestedKO, endWeek: endWeekStr };

            // Unlock Successors
            const successors = projectDeps.successors[project.id];
            successors.forEach(succId => {
                projectDeps.counts[succId]--;
                if (projectDeps.counts[succId] === 0) {
                    const succProject = projects.find(p => p.id === succId);
                    if (succProject) queue.push(succProject);
                }
            });

        } else {
            unplaceable.push({
                projectId: project.id,
                projectName: project.name,
                slotsNeeded,
                reason: 'No available slots within constraints'
            });
            // NOTE: If a parent fails, children are effectively blocked/unplaceable too 
            // unless we relax constraints. For now, they stay stuck in dependency counts > 0.
            // We should auto-fail them to report "Blocked by predecessor failure"
            const failQueue = [...projectDeps.successors[project.id]];
            while (failQueue.length > 0) {
                const fid = failQueue.shift();
                // Ensure we don't duplicate fail
                if (!unplaceable.some(u => u.projectId === fid)) {
                    const fp = projects.find(p => p.id === fid);
                    unplaceable.push({
                        projectId: fid,
                        projectName: fp?.name || fid,
                        slotsNeeded: 0,
                        reason: 'Predecessor could not be placed'
                    });
                    if (projectDeps.successors[fid]) failQueue.push(...projectDeps.successors[fid]);
                }
            }
        }
    }


    // ========== LOCAL SEARCH OPTIMIZATION ==========
    // Try to improve greedy solution by swapping/shifting
    const LOCAL_SEARCH_ITERATIONS = 3;

    for (let iter = 0; iter < LOCAL_SEARCH_ITERATIONS; iter++) {
        let improved = false;

        // Strategy 1: Bump-up - Replace low-value placed with high-value unplaceable
        for (let u = 0; u < unplaceable.length; u++) {
            const unplacedProject = unplaceable[u];
            const unplacedValue = projects.find(p => p.id === unplacedProject.projectId)?.arr || 0;

            for (let a = allocations.length - 1; a >= 0; a--) {
                const placedValue = allocations[a].projectValue || 0;

                // If unplaceable has higher value, try to swap
                if (unplacedValue > placedValue * 1.2) { // 20% higher value threshold
                    const placedAlloc = allocations[a];

                    // Restore slots from placed project
                    placedAlloc.slotAssignments?.forEach(({ squad, week }) => {
                        if (availability[squad]?.[week]) {
                            availability[squad][week].remaining += 1;
                        }
                    });

                    // Try to place the higher-value project
                    const originalProject = projects.find(p => p.id === unplacedProject.projectId);
                    const newPlacement = findPlacement({
                        project: originalProject,
                        slotsNeeded: unplacedProject.slotsNeeded,
                        preferredSquad: originalProject?.squads?.[0],
                        preferredWeek: originalProject?.kickOff || originalProject?.start,
                        squads,
                        weeks,
                        availability,
                        durationWeeks,
                        maxDelayWeeks,
                        allowCrossSquad,
                        allowOverstaff,
                        bufferPercent,
                        todayMs
                    });

                    if (newPlacement) {
                        // Swap successful
                        allocations.splice(a, 1);
                        unplaceable.push({
                            projectId: placedAlloc.projectId,
                            projectName: placedAlloc.projectName,
                            slotsNeeded: placedAlloc.slotsNeeded,
                            reason: 'Bumped for higher-value project'
                        });

                        allocations.push({
                            projectId: originalProject.id,
                            projectName: originalProject.name,
                            projectValue: unplacedValue,
                            slotsNeeded: unplacedProject.slotsNeeded,
                            ...newPlacement
                        });

                        // Consume new slots
                        newPlacement.slotAssignments?.forEach(({ squad, week }) => {
                            if (availability[squad]?.[week]) {
                                availability[squad][week].remaining -= 1;
                            }
                        });

                        unplaceable.splice(u, 1);
                        improved = true;
                        break;
                    } else {
                        // Restore original placement
                        placedAlloc.slotAssignments?.forEach(({ squad, week }) => {
                            if (availability[squad]?.[week]) {
                                availability[squad][week].remaining -= 1;
                            }
                        });
                    }
                }
            }
            if (improved) break;
        }

        // Strategy 2: Shift cascade - Delay one project by 1 week to fit another
        if (!improved && unplaceable.length > 0) {
            for (const unplacedItem of unplaceable.slice(0, 3)) { // Try top 3 unplaceable
                const unplacedProject = projects.find(p => p.id === unplacedItem.projectId);
                if (!unplacedProject) continue;

                // Find an allocation that could shift by 1 week
                for (const alloc of allocations) {
                    if (alloc.slotAssignments?.length !== 1) continue; // Only single-slot for simplicity

                    const { squad, week } = alloc.slotAssignments[0];
                    const weekMs = new Date(week).getTime();
                    const nextWeek = new Date(weekMs + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    // Can this project shift to next week?
                    if (availability[squad]?.[nextWeek]?.remaining > 0) {
                        // Temporarily shift it
                        availability[squad][week].remaining += 1;
                        availability[squad][nextWeek].remaining -= 1;
                        alloc.slotAssignments = [{ squad, week: nextWeek }];
                        alloc.suggestedKO = nextWeek;
                        alloc.shifted = true;

                        // Now try to place the unplaceable
                        const newPlacement = findPlacement({
                            project: unplacedProject,
                            slotsNeeded: unplacedItem.slotsNeeded,
                            preferredSquad: unplacedProject.squads?.[0],
                            preferredWeek: unplacedProject.kickOff || unplacedProject.start,
                            squads,
                            weeks,
                            availability,
                            durationWeeks,
                            maxDelayWeeks,
                            allowCrossSquad,
                            allowOverstaff,
                            bufferPercent,
                            todayMs
                        });

                        if (newPlacement) {
                            // Success! Add the new allocation
                            allocations.push({
                                projectId: unplacedProject.id,
                                projectName: unplacedProject.name,
                                projectValue: unplacedProject.arr || 0,
                                slotsNeeded: unplacedItem.slotsNeeded,
                                ...newPlacement,
                                rescuedBy: 'shift_cascade'
                            });

                            newPlacement.slotAssignments?.forEach(({ squad: s, week: w }) => {
                                if (availability[s]?.[w]) {
                                    availability[s][w].remaining -= 1;
                                }
                            });

                            // Remove from unplaceable
                            const idx = unplaceable.findIndex(x => x.projectId === unplacedProject.id);
                            if (idx >= 0) unplaceable.splice(idx, 1);

                            improved = true;
                            break;
                        } else {
                            // Revert the shift
                            availability[squad][week].remaining -= 1;
                            availability[squad][nextWeek].remaining += 1;
                            alloc.slotAssignments = [{ squad, week }];
                            alloc.suggestedKO = week;
                            delete alloc.shifted;
                        }
                    }
                }
                if (improved) break;
            }
        }

        if (!improved) break; // No more improvements possible
    }

    // Calculate stats
    const stats = {
        totalProjects: projects.length,
        placed: allocations.length,
        unplaceable: unplaceable.length,
        slotsUsed: allocations.reduce((sum, a) => sum + a.slotsNeeded, 0),
        crossSquadCount: allocations.filter(a => a.crossSquad).length,
        overstaffCount: allocations.filter(a => a.overstaff).length,
        localSearchRescued: allocations.filter(a => a.rescuedBy).length,
        localSearchBumped: unplaceable.filter(u => u.reason?.includes('Bumped')).length,
        lookaheadDelayed: allocations.filter(a => a.lookaheadDelayed).length
    };

    return { allocations, unplaceable, warnings, stats };
};

/**
 * Calculate slots required for a project
 */
const calculateSlotsRequired = (project, slotProfile) => {
    const pmVal = Number(project.pmVal) || 0;
    const scVal = Number(project.scVal) || 0;
    const pdVal = Number(project.pdVal) || 0;
    const totalEffort = pmVal + scVal + pdVal;

    const slotTotal = slotProfile
        ? (Number(slotProfile.pmHours) || 40) + (Number(slotProfile.scHours) || 120) + (Number(slotProfile.buildHours) || 80)
        : 240;

    const rawSlots = slotTotal > 0 ? totalEffort / slotTotal : 1;
    return Math.max(1, Math.ceil(rawSlots));
};

/**
 * Find placement for a project
 */
const findPlacement = ({
    project, slotsNeeded, preferredSquad, preferredWeek,
    squads, weeks, availability, durationWeeks, maxDelayWeeks,
    allowCrossSquad, allowOverstaff, bufferPercent, todayMs,
    // New Constraints
    programKey, programUsage, maxConcurrency
}) => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const preferredMs = preferredWeek ? new Date(preferredWeek).getTime() : todayMs;
    const maxDelayMs = maxDelayWeeks * weekMs;

    // Filter valid start weeks (future, within delay limit)
    const validWeeks = weeks.filter(w => {
        const wMs = new Date(w).getTime();
        if (wMs < todayMs) return false; // Must be future
        if (preferredWeek && wMs < preferredMs) return false; // Cannot start before preferred (predecessor constraint)
        if (preferredWeek && wMs > preferredMs + maxDelayMs) return false; // Cannot delay too much
        return true;
    });

    // Try preferred squad first, then others
    const orderedSquads = preferredSquad
        ? [preferredSquad, ...squads.filter(s => s !== preferredSquad)]
        : squads;

    // Strategy 1: Find contiguous slots in single squad
    for (const squad of orderedSquads) {
        for (const startWeek of validWeeks) {
            const slotAssignments = [];
            let found = 0;

            // Check if we have enough slots in this squad starting here
            let checkWeek = startWeek;
            let concurrencyFail = false;

            for (let i = 0; i < slotsNeeded && found < slotsNeeded; i++) {
                // Concurrency Check
                if (programKey && programUsage && maxConcurrency) {
                    const currentUsage = programUsage[programKey]?.[checkWeek] || 0;
                    if (currentUsage >= maxConcurrency) {
                        concurrencyFail = true;
                        break;
                    }
                }

                const weekAvail = availability[squad]?.[checkWeek];
                if (weekAvail && weekAvail.remaining > 0) {
                    slotAssignments.push({ squad, week: checkWeek });
                    found++;
                } else if (allowOverstaff) {
                    // Check buffer...
                    // Simplified for brevity, assume strict slot for now unless overstaff buffer logic was here
                    // If previously existed, keep it. 
                    // Re-adding simple check:
                    if (weekAvail) { // Even if 0 remaining, if overstaff allow?
                        // Let's stick to strict avail for consistency with original code block
                    }
                }

                // Move to next week
                const nextDate = new Date(new Date(checkWeek).getTime() + weekMs);
                checkWeek = nextDate.toISOString().split('T')[0];
            }

            if (concurrencyFail) continue; // Try next start week

            if (found === slotsNeeded) {
                return {
                    slotAssignments,
                    suggestedKO: startWeek,
                    suggestedSquad: squad,
                    score: 1.0 // Perfect fit
                };
            }
        }
    }



    // Strategy 2: Cross-squad allocation (if allowed and multi-slot)
    if (allowCrossSquad && slotsNeeded > 1) {
        for (const startWeek of validWeeks) {
            const slotAssignments = [];

            // Greedily find slots across any squad
            let remaining = slotsNeeded;
            let checkWeek = startWeek;

            for (let i = 0; i < slotsNeeded * 2 && remaining > 0; i++) {
                for (const squad of orderedSquads) {
                    if (remaining <= 0) break;
                    const weekAvail = availability[squad]?.[checkWeek];
                    if (weekAvail && weekAvail.remaining > 0) {
                        slotAssignments.push({ squad, week: checkWeek });
                        remaining--;
                    }
                }
                const nextMs = new Date(checkWeek).getTime() + weekMs;
                checkWeek = new Date(nextMs).toISOString().split('T')[0];
            }

            if (remaining <= 0) {
                return {
                    suggestedSquad: slotAssignments[0]?.squad,
                    suggestedKO: startWeek,
                    suggestedLaunch: slotAssignments[slotAssignments.length - 1]?.week,
                    slotAssignments,
                    crossSquad: true,
                    overstaff: false,
                    crossSquadNote: `Spans ${new Set(slotAssignments.map(s => s.squad)).size} squads`
                };
            }
        }
    }

    // Strategy 3: Overstaff (if allowed)
    if (allowOverstaff) {
        // Find week with highest score even if no remaining
        for (const squad of orderedSquads) {
            for (const startWeek of validWeeks) {
                return {
                    suggestedSquad: squad,
                    suggestedKO: startWeek,
                    suggestedLaunch: startWeek,
                    slotAssignments: [{ squad, week: startWeek }],
                    crossSquad: false,
                    overstaff: true,
                    overstaffNote: `Will exceed capacity by ~${bufferPercent}%`
                };
            }
        }
    }

    return null; // Cannot place
};

/**
 * Get ISO week key from date
 */
const getWeekKey = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    // Get Monday of the week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

/**
 * Calculate disruption cost of moving dates
 */
const getDateMovementCost = (from, to) => {
    try {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const daysDiff = Math.abs(toDate - fromDate) / (1000 * 60 * 60 * 24);
        // 1 week = 0.1 cost, 1 month = 0.4 cost
        return Math.min(1, daysDiff / 30 * 0.4);
    } catch {
        return 0.5;
    }
};

/**
 * Calculate slot utilization summary with role-aware capacity
 */
export const getSlotUtilizationSummary = (slotMap, enabledSquads = []) => {
    const squads = enabledSquads.length > 0
        ? enabledSquads
        : Object.keys(slotMap || {});

    let totalSlots = 0;
    let openSlots = 0;
    let partialSlots = 0;
    let fullSlots = 0;
    const bottleneckCounts = { PM: 0, SC: 0, Build: 0 };

    // Role-aware capacity tracking
    let totalPrimaryCapacity = { pm: 0, sc: 0, build: 0 };
    let totalSecondaryCapacity = { pm: 0, sc: 0, build: 0 };
    let constraintWarnings = [];

    squads.forEach(squad => {
        const squadData = slotMap[squad] || {};
        Object.entries(squadData).forEach(([week, bucket]) => {
            totalSlots++;
            if (bucket.state === 'OPEN') openSlots++;
            else if (bucket.state === 'PARTIAL') partialSlots++;
            else fullSlots++;

            if (bucket.bottleneck) {
                bottleneckCounts[bucket.bottleneck]++;
            }

            // Aggregate capacity if available
            if (bucket.capacity) {
                ['pm', 'sc', 'build'].forEach(role => {
                    if (bucket.capacity[role]) {
                        totalPrimaryCapacity[role] += bucket.capacity[role].primary || 0;
                        totalSecondaryCapacity[role] += bucket.capacity[role].secondary || 0;
                    }
                });
            }

            // Collect constraint warnings
            if (bucket.constraintWarning) {
                constraintWarnings.push({
                    squad,
                    week,
                    warning: bucket.constraintWarning
                });
            }
        });
    });

    const primaryBottleneck = Object.entries(bottleneckCounts)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Calculate flex ratio (secondary as % of primary)
    const flexRatio = {
        pm: totalPrimaryCapacity.pm > 0 ? Math.round(totalSecondaryCapacity.pm / totalPrimaryCapacity.pm * 100) : 0,
        sc: totalPrimaryCapacity.sc > 0 ? Math.round(totalSecondaryCapacity.sc / totalPrimaryCapacity.sc * 100) : 0,
        build: totalPrimaryCapacity.build > 0 ? Math.round(totalSecondaryCapacity.build / totalPrimaryCapacity.build * 100) : 0
    };

    return {
        totalSlots,
        openSlots,
        partialSlots,
        fullSlots,
        utilizationPct: totalSlots > 0 ? Math.round((1 - openSlots / totalSlots) * 100) : 0,
        primaryBottleneck,
        bottleneckCounts,
        // Role-aware fields
        primaryCapacity: totalPrimaryCapacity,
        secondaryCapacity: totalSecondaryCapacity,
        flexRatio,
        constraintWarnings,
        hasConstraintIssues: constraintWarnings.length > 0
    };
};

/**
 * Generate role-aware insights and recommendations
 * Analyzes primary/secondary capacity utilization and constraint issues
 */
export const generateRoleInsights = (slotMap, roleConfig, enabledSquads = []) => {
    const insights = [];
    const summary = getSlotUtilizationSummary(slotMap, enabledSquads);

    // Insight 1: Flex capacity utilization
    const roles = ['pm', 'sc', 'build'];
    roles.forEach(role => {
        const primary = summary.primaryCapacity[role] || 0;
        const secondary = summary.secondaryCapacity[role] || 0;
        const flex = summary.flexRatio[role] || 0;

        if (secondary > 0 && flex > 20) {
            insights.push({
                type: 'flex_opportunity',
                role: role.toUpperCase(),
                message: `${role.toUpperCase()} has ${flex}% flex capacity — ${Math.round(secondary)}h of secondary availability`,
                severity: 'info',
                actionable: true
            });
        }

        if (primary === 0 && secondary > 0) {
            insights.push({
                type: 'capacity_gap',
                role: role.toUpperCase(),
                message: `No primary ${role.toUpperCase()} capacity — relying entirely on flex resources`,
                severity: 'warning',
                actionable: true
            });
        }
    });

    // Insight 2: Bottleneck analysis
    if (summary.primaryBottleneck) {
        const role = summary.primaryBottleneck.toLowerCase();
        const flexAvailable = summary.secondaryCapacity[role] > 0;

        insights.push({
            type: 'bottleneck',
            role: summary.primaryBottleneck,
            message: flexAvailable
                ? `${summary.primaryBottleneck} is the primary bottleneck — flex capacity available to help`
                : `${summary.primaryBottleneck} is the primary bottleneck — no flex capacity configured`,
            severity: flexAvailable ? 'info' : 'warning',
            actionable: !flexAvailable
        });
    }

    // Insight 3: Constraint violations
    if (summary.hasConstraintIssues) {
        const grouped = {};
        summary.constraintWarnings.forEach(w => {
            const key = w.warning;
            if (!grouped[key]) grouped[key] = { count: 0, squads: [] };
            grouped[key].count++;
            if (!grouped[key].squads.includes(w.squad)) {
                grouped[key].squads.push(w.squad);
            }
        });

        Object.entries(grouped).forEach(([warning, data]) => {
            insights.push({
                type: 'constraint',
                message: `${warning} — affects ${data.count} time periods in ${data.squads.join(', ')}`,
                severity: 'warning',
                actionable: true,
                squads: data.squads
            });
        });
    }

    // Insight 4: Role configuration gaps
    const configuredJobs = Object.keys(roleConfig?.jobs || {});
    if (configuredJobs.length === 0) {
        insights.push({
            type: 'config',
            message: 'No role configuration set — using default job title inference',
            severity: 'info',
            actionable: true
        });
    } else {
        const withSecondary = configuredJobs.filter(j =>
            (roleConfig.jobs[j].secondary || []).length > 0
        ).length;

        if (withSecondary > 0) {
            insights.push({
                type: 'config',
                message: `${withSecondary} job titles have secondary roles configured for flex capacity`,
                severity: 'success',
                actionable: false
            });
        }
    }

    return insights;
};

export default {
    generateRecommendations,
    generateBulkAllocationPlan,
    getSlotUtilizationSummary,
    generateRoleInsights
};
