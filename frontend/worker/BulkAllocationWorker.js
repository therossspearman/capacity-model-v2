/**
 * BulkAllocationWorker - Web Worker for non-blocking bulk allocation computation
 * Uses inline worker pattern (Blob URL) for Airtable compatibility
 */

// Worker code as a string (will be converted to Blob)
const workerCode = `
// Calculate slots required for a project
function calculateSlotsRequired(project, slotProfile) {
    const pmVal = Number(project.pmVal) || 0;
    const scVal = Number(project.scVal) || 0;
    const pdVal = Number(project.pdVal) || 0;
    const totalEffort = pmVal + scVal + pdVal;

    const slotTotal = slotProfile
        ? (Number(slotProfile.pmHours) || 40) + (Number(slotProfile.scHours) || 120) + (Number(slotProfile.buildHours) || 80)
        : 240;

    const rawSlots = slotTotal > 0 ? totalEffort / slotTotal : 1;
    return Math.max(1, Math.ceil(rawSlots));
}

// Find placement for a project
function findPlacement({
    project, slotsNeeded, preferredSquad, preferredWeek,
    squads, weeks, availability, durationWeeks, maxDelayWeeks,
    allowCrossSquad, allowOverstaff, bufferPercent, todayMs
}) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const preferredMs = preferredWeek ? new Date(preferredWeek).getTime() : todayMs;
    const maxDelayMs = maxDelayWeeks * weekMs;

    // Filter valid start weeks
    const validWeeks = weeks.filter(w => {
        const wMs = new Date(w).getTime();
        if (wMs < todayMs) return false;
        if (preferredWeek && wMs > preferredMs + maxDelayMs) return false;
        return true;
    });

    const orderedSquads = preferredSquad
        ? [preferredSquad, ...squads.filter(s => s !== preferredSquad)]
        : squads;

    // Strategy 1: Find contiguous slots in single squad
    for (const squad of orderedSquads) {
        for (const startWeek of validWeeks) {
            const slotAssignments = [];
            let found = 0;
            let checkWeek = startWeek;

            for (let i = 0; i < slotsNeeded && found < slotsNeeded; i++) {
                const weekAvail = availability[squad]?.[checkWeek];
                if (weekAvail && weekAvail.remaining > 0) {
                    slotAssignments.push({ squad, week: checkWeek });
                    found++;
                }
                const nextMs = new Date(checkWeek).getTime() + weekMs;
                checkWeek = new Date(nextMs).toISOString().split('T')[0];
            }

            if (found >= slotsNeeded) {
                return {
                    suggestedSquad: squad,
                    suggestedKO: startWeek,
                    suggestedLaunch: slotAssignments[slotAssignments.length - 1]?.week,
                    slotAssignments,
                    crossSquad: false,
                    overstaff: false
                };
            }
        }
    }

    // Strategy 2: Cross-squad allocation
    if (allowCrossSquad && slotsNeeded > 1) {
        for (const startWeek of validWeeks) {
            const slotAssignments = [];
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
                    crossSquadNote: 'Spans ' + new Set(slotAssignments.map(s => s.squad)).size + ' squads'
                };
            }
        }
    }

    // Strategy 3: Overstaff
    // Place into the preferred squad (first in orderedSquads) at the earliest
    // valid week, even if no slots remain there.
    if (allowOverstaff && orderedSquads.length > 0 && validWeeks.length > 0) {
        const squad = orderedSquads[0];
        const startWeek = validWeeks[0];
        return {
            suggestedSquad: squad,
            suggestedKO: startWeek,
            suggestedLaunch: startWeek,
            slotAssignments: [{ squad, week: startWeek }],
            crossSquad: false,
            overstaff: true,
            overstaffNote: 'Will exceed capacity by ~' + bufferPercent + '%'
        };
    }

    return null;
}

// Main bulk allocation plan generator
function generateBulkAllocationPlan(slotMap, projects, config) {
    const {
        reservedSlotsPerMonth = 0,
        protectedSlots = [],
        maxDelayWeeks = 8,
        allowCrossSquad = true,
        allowOverstaff = false,
        bufferPercent = 20,
        slotProfile
    } = config || {};

    if (!slotMap || !projects?.length) {
        return { allocations: [], unplaceable: [], warnings: [], stats: {} };
    }

    const durationWeeks = slotProfile?.durationWeeks || 12;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const squads = Object.keys(slotMap);

    // Build availability matrix
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

    // Apply monthly reservation
    if (reservedSlotsPerMonth > 0) {
        const monthCounts = {};
        weeks.forEach(week => {
            const dateMs = new Date(week).getTime();
            if (dateMs < todayMs) return;
            const month = week.substring(0, 7);
            if (!monthCounts[month]) monthCounts[month] = { reserved: 0, weeks: [] };
            monthCounts[month].weeks.push(week);
        });

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

    // Sort projects by value
    const sortedProjects = [...projects].sort((a, b) => {
        const aValue = (a.transactionalBenefits || 0) + (a.arr || 0);
        const bValue = (b.transactionalBenefits || 0) + (b.arr || 0);
        if (bValue !== aValue) return bValue - aValue;
        const aSlots = calculateSlotsRequired(a, slotProfile);
        const bSlots = calculateSlotsRequired(b, slotProfile);
        return aSlots - bSlots;
    });

    const allocations = [];
    const unplaceable = [];
    const warnings = [];

    // Greedy allocation
    sortedProjects.forEach(project => {
        const slotsNeeded = calculateSlotsRequired(project, slotProfile);
        const preferredSquad = project.squads?.[0] !== 'Unassigned' ? project.squads?.[0] : null;
        const preferredWeek = project.kickOff || project.start;

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
            todayMs
        });

        if (placement) {
            allocations.push({
                projectId: project.id,
                projectName: project.name,
                projectValue: (project.transactionalBenefits || 0) + (project.arr || 0),
                slotsNeeded,
                ...placement
            });

            // Consume slots
            placement.slotAssignments.forEach(({ squad, week }) => {
                if (availability[squad]?.[week]) {
                    availability[squad][week].remaining -= 1;
                }
            });
        } else {
            unplaceable.push({
                projectId: project.id,
                projectName: project.name,
                slotsNeeded,
                reason: 'No available slots within constraints'
            });
        }
    });

    // Calculate stats
    const stats = {
        totalProjects: projects.length,
        placed: allocations.length,
        unplaceable: unplaceable.length,
        slotsUsed: allocations.reduce((sum, a) => sum + a.slotsNeeded, 0),
        crossSquadCount: allocations.filter(a => a.crossSquad).length,
        overstaffCount: allocations.filter(a => a.overstaff).length
    };

    return { allocations, unplaceable, warnings, stats };
}

// Worker message handler
self.onmessage = function(e) {
    const { slotMap, projects, config } = e.data;
    try {
        const result = generateBulkAllocationPlan(slotMap, projects, config);
        self.postMessage({ success: true, result });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message,
            errorDetail: { message: error.message, stack: error.stack, name: error.name }
        });
    }
};
`;

// Create worker instance
let workerInstance = null;
let workerUrl = null;

/**
 * Initialize or get the worker instance
 */
const getWorker = () => {
    if (!workerInstance) {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        workerInstance = new Worker(workerUrl);
    }
    return workerInstance;
};

/**
 * Run bulk allocation in Web Worker
 * @param {Object} slotMap - Slot availability map
 * @param {Array} projects - Projects to allocate
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} - Allocation result
 */
export const runBulkAllocationAsync = (slotMap, projects, config) => {
    return new Promise((resolve, reject) => {
        try {
            const worker = getWorker();

            const handleMessage = (e) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);

                if (e.data.success) {
                    resolve(e.data.result);
                } else {
                    const detail = e.data.errorDetail || {};
                    const err = new Error(detail.message || e.data.error || 'Worker computation failed');
                    if (detail.name) err.name = detail.name;
                    if (detail.stack) err.workerStack = detail.stack;
                    console.error('[BulkAllocationWorker] computation failed:', detail.message || e.data.error, detail.stack || '');
                    reject(err);
                }
            };

            const handleError = (e) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(e.message || 'Worker error'));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            // Send data to worker
            worker.postMessage({ slotMap, projects, config });
        } catch (error) {
            // Fallback: if worker fails, reject with error
            reject(error);
        }
    });
};

/**
 * Clean up worker resources
 */
export const terminateWorker = () => {
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
    runBulkAllocationAsync,
    terminateWorker
};
