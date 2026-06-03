// Worker code for capacity calculations
// This file is kept separate to maintain its own scope and avoid minification conflicts

// Safe date parsing helper
const safeDate = (val, fallback) => {
    if (!val) return fallback || null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? (fallback || null) : d;
    } catch {
        return fallback || null;
    }
};

const getBucketInfo = (date, granularity, minDate, sprintStartDate) => {
    const d = new Date(date);
    if (granularity === 'sprint') {
        const baseDate = sprintStartDate ? new Date(sprintStartDate) : new Date(minDate);
        const diffTime = d.getTime() - baseDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const sprintNum = Math.floor(diffDays / 21) + 1;
        return { key: `Sprint-${sprintNum}`, label: `Sprint ${sprintNum}`, order: sprintNum, rawDate: d.getTime() };
    }
    if (granularity === 'month') {
        // Use UTC to avoid DST issues
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const firstOfMonth = Date.UTC(year, month, 1);
        const label = new Date(firstOfMonth).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
        const key = new Date(firstOfMonth).toISOString().split('T')[0];
        return { key, label, order: firstOfMonth, rawDate: firstOfMonth };
    }
    // Week granularity - use UTC to avoid DST issues
    // Calculate day of week (0=Sunday in JS)
    const dayOfWeek = d.getUTCDay();
    // Calculate offset to get to Monday (ISO week starts on Monday)
    // Sunday (0) -> -6, Monday (1) -> 0, Tuesday (2) -> -1, etc.
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    // Get the Monday of this week using UTC arithmetic
    const mondayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToMonday);
    const monday = new Date(mondayMs);
    const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const key = monday.toISOString().split('T')[0];
    return { key, label, order: mondayMs, rawDate: mondayMs };
};

// Returns true when a resource shouldn't have demand attributed to them on the
// given bucket date — covers three scenarios:
//   1. Before their employment start date (not yet hired)
//   2. After their employment end / departure date (`leaveDate`)
//   3. Inside a temporary leave range (`leaveStartDate`..`leaveEndDate` — e.g., sabbatical, parental, long-term sick)
// Capacity is already carved out for all three paths by the resource loop, but the
// demand-attribution sites don't know about dates on their own — they just see a
// resource ID and write, so this helper is the gatekeeper.
// Granularity: bucket-level (Monday-aligned).
const isResourceUnavailable = (res, bucketMs) => {
    if (!res) return false;
    // Not yet started
    if (res.startDate) {
        const ss = new Date(res.startDate).getTime();
        if (!isNaN(ss) && bucketMs < ss) return true;
    }
    // Past their departure / employment end (legacy field name: `leaveDate`)
    if (res.leaveDate) {
        const ld = new Date(res.leaveDate).getTime();
        if (!isNaN(ld) && bucketMs > ld) return true;
    }
    // Inside temporary leave range
    if (res.leaveStartDate && res.leaveEndDate) {
        const ls = new Date(res.leaveStartDate).getTime();
        const le = new Date(res.leaveEndDate).getTime();
        if (!isNaN(ls) && !isNaN(le) && le >= ls && bucketMs >= ls && bucketMs <= le) return true;
    }
    return false;
};
// Backward-compat alias — call sites pre-dating the broader check still work.
const isResourceOnLeave = isResourceUnavailable;

// Count business-day overlap (Mon-Fri) between two date ranges, returned as integer 0-5.
// Used by presence-mode capacity calc to figure out how many of a Mon-Fri week are
// covered by a [leaveStart, leaveEnd] range so we can credit the remainder as days present.
// Both ranges treated as inclusive UTC date boundaries.
const businessDayOverlap = (rangeStartMs, rangeEndMs, leaveStartMs, leaveEndMs) => {
    if (leaveStartMs == null || leaveEndMs == null) return 0;
    const oStart = Math.max(rangeStartMs, leaveStartMs);
    const oEnd = Math.min(rangeEndMs, leaveEndMs);
    if (oEnd < oStart) return 0;
    const DAY_MS = 86400000;
    let count = 0;
    // Iterate day-by-day across the overlap; cap at 7 iterations (one week max for our use)
    const maxDays = Math.min(7, Math.floor((oEnd - oStart) / DAY_MS) + 1);
    for (let i = 0; i < maxDays; i++) {
        const day = new Date(oStart + i * DAY_MS);
        const dow = day.getUTCDay(); // 0=Sun, 6=Sat
        if (dow !== 0 && dow !== 6) count++;
    }
    return Math.min(5, count);
};

const processDateRange = (start, end, load, type, pMeta, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDate, todayTime) => {
    if (!start || !end || end < start) return;
    const effectiveStart = start < minDate ? minDate : start;
    const startBucket = getBucketInfo(effectiveStart, config.granularity, minDate, sprintStartDate);
    let curs = new Date(startBucket.rawDate);
    let iterations = 0;
    // Derive the loop guard from the actual span so legitimate long date ranges are
    // not silently truncated (weekly granularity previously capped at 500 ≈ 9.6 years).
    // A hard ceiling still protects against runaway loops.
    const bucketSpanMs = config.granularity === 'month' ? 2419200000 : 604800000;
    const spanMs = Math.max(0, (maxDate.getTime()) - effectiveStart.getTime()) + 604800000;
    const iterationCap = Math.min(10000, Math.max(500, Math.ceil(spanMs / bucketSpanMs) + 10));

    // Create leanMeta once per processDateRange call — it only depends on pMeta, not per-bucket state
    const leanMeta = {
        id: pMeta.id,
        name: pMeta.name,
        projectId: pMeta.projectId,
        status: pMeta.status,
        breakdownCategory: pMeta.breakdownCategory,
        startDate: pMeta.startDate,
        endDate: pMeta.endDate,
        wave: pMeta.wave,
        customer: pMeta.customer,
        company: pMeta.company,
        country: pMeta.country,
        countryFlag: pMeta.countryFlag,
        transactionalBenefits: pMeta.transactionalBenefits,
        nonTransactionalBenefits: pMeta.nonTransactionalBenefits,
        contentOnlyBenefits: pMeta.contentOnlyBenefits,
        languages: pMeta.languages,
        totalPlanned: pMeta.totalPlanned,
        planned: pMeta.totalPlanned,
        actuals: pMeta.actuals,
        eac: pMeta.eac,
        pctComplete: pMeta.pctComplete,
        squads: pMeta.squads,
        effortProfile: pMeta.effortProfile,
        team: pMeta.team,
        resourcedWithinProgram: pMeta.resourcedWithinProgram,
        hoursOriginal: pMeta.hoursOriginal,
        isProgram: pMeta.isProgram
    };

    while (curs.getTime() <= end.getTime() + 604800000 && curs.getTime() <= maxDate.getTime()) {
        if (iterations++ > iterationCap) break;
        const { key, rawDate } = getBucketInfo(curs, config.granularity, minDate, sprintStartDate);

        let bucketEnd;
        if (config.granularity === 'month') {
            const nextMonth = new Date(rawDate); nextMonth.setMonth(nextMonth.getMonth() + 1);
            bucketEnd = nextMonth.getTime();
        } else {
            bucketEnd = rawDate + 604800000;
        }

        const overlapStart = Math.max(start.getTime(), rawDate);
        const overlapEnd = Math.min(end.getTime(), bucketEnd);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);

        if (overlapDuration > 0) {
            const bucketDuration = bucketEnd - rawDate;

            let profileFactor = 1;
            if (pMeta.effortProfile && (!pMeta.resourceId || pMeta.resourceId === pMeta.projectId)) {
                const prof = pMeta.effortProfile.toLowerCase();
                const projDur = end.getTime() - start.getTime();
                if (projDur > 0) {
                    const mid = (overlapStart + overlapEnd) / 2;
                    const prog = Math.max(0, Math.min(1, (mid - start.getTime()) / projDur));
                    const peak = (config.modelParams && config.modelParams.curvePeak) ? Number(config.modelParams.curvePeak) : 2;



                    if (prof.includes('domestic')) {
                        // Benifex Domestic UK: Flat during project, configurable hypercare post go-live
                        // NOTE: 'end' here is effectiveEnd (launch + hypercare extension), so we derive launch time
                        const domesticSettings = (config.modelParams && config.modelParams.domesticProfile) || {};
                        const hcWeeks = domesticSettings.hypercareWeeks ?? 13;
                        const hcHoursPerWeek = domesticSettings.hypercareHoursPerWeek ?? 3;
                        const hypercareDuration = hcWeeks * 7 * 24 * 60 * 60 * 1000;
                        const hypercareEnd = end.getTime();
                        const launchTime = hypercareEnd - hypercareDuration;
                        const bucketMid = (overlapStart + overlapEnd) / 2;

                        if (bucketMid > launchTime && bucketMid <= hypercareEnd) {
                            // Post go-live hypercare: hcHoursPerWeek absolute, split across 3 roles
                            const hoursPerRole = hcHoursPerWeek / 3;
                            profileFactor = load > 0 ? (hoursPerRole / load) : 0;
                        }
                        // During project timeline (bucketMid <= launchTime): profileFactor stays 1 (flat)
                    } else if (prof.includes('role') || prof.includes('benifex')) {
                        // Role-Specific Profile: Apply different curves per role with individual spreads
                        const roleProfiles = (config.modelParams && config.modelParams.roleSpecificProfile) || {};
                        const role = (pMeta.breakdownCategory || '').toLowerCase();
                        let roleProfile = 'flat';
                        let roleSpread = 2.0; // Default spread

                        if (role === 'sc') {
                            roleProfile = roleProfiles.scProfile || 'front';
                            roleSpread = roleProfiles.scSpread ?? 2.0;
                        } else if (role === 'pd') {
                            roleProfile = roleProfiles.pdProfile || 'back';
                            roleSpread = roleProfiles.pdSpread ?? 2.0;
                        } else if (role === 'pm') {
                            roleProfile = roleProfiles.pmProfile || 'flat';
                            roleSpread = roleProfiles.pmSpread ?? 2.0;
                        }



                        // Apply the role's specific curve with its own spread
                        if (roleProfile === 'front') {
                            profileFactor = roleSpread * (1 - prog);
                        } else if (roleProfile === 'back') {
                            profileFactor = roleSpread * prog;
                        } else if (roleProfile === 'bell') {
                            profileFactor = roleSpread * 4 * prog * (1 - prog);
                        }
                        // 'flat' leaves profileFactor at 1
                    } else if (prof.includes('front')) {
                        profileFactor = peak * (1 - prog);
                    } else if (prof.includes('back')) {
                        profileFactor = peak * prog;
                    } else if (prof.includes('bell')) {
                        profileFactor = peak * 4 * prog * (1 - prog);
                    } else if (prof.includes('fps')) {
                        const bucketMid = (overlapStart + overlapEnd) / 2;
                        // FIX: Robustly derive Launch Time from the effective end date
                        const postCloseEnd = end.getTime();
                        const launchTime = postCloseEnd - (6 * 7 * 24 * 60 * 60 * 1000);
                        const uatTime = pMeta.uatStart
                            ? new Date(pMeta.uatStart).getTime()
                            : start.getTime() + (projDur * 0.75);

                        if (bucketMid > launchTime && bucketMid <= postCloseEnd) {
                            const postCloseDur = postCloseEnd - launchTime;
                            profileFactor = 0.05 * (projDur / postCloseDur);
                        } else if (bucketMid >= uatTime && bucketMid <= launchTime) {
                            profileFactor = 1.2;
                        } else if (bucketMid < launchTime) {
                            profileFactor = 0.9;
                        }
                    }
                }
            }

            let valPlan = (overlapDuration / bucketDuration) * load * profileFactor;
            let valEac = valPlan;

            if (type === 'demand' && pMeta.status) {
                const statusLower = pMeta.status.toLowerCase();
                const winRates = config.winRates || {};
                if (winRates[statusLower] !== undefined) {
                    const winRate = winRates[statusLower];
                    valPlan = valPlan * winRate;
                    valEac = valEac * winRate;
                }
            }

            if (type === 'capacity' && pMeta.rampProfile && config.rampProfiles) {
                const profile = config.rampProfiles.find(p => p.name === pMeta.rampProfile);
                if (profile && profile.weeks && profile.weeks.length > 0) {
                    const rampOrigin = pMeta.rampStartDate ? new Date(pMeta.rampStartDate).getTime() : start.getTime();
                    const currentIncrement = config.granularity === 'month' ? 2419200000 : 604800000;
                    if (rawDate + currentIncrement <= rampOrigin) {
                        valPlan = 0;
                    } else {
                        const diffTime = rawDate - rampOrigin;
                        const weekIdx = Math.floor(Math.max(0, diffTime) / 604800000);
                        let pct = 100;
                        if (weekIdx < profile.weeks.length) pct = profile.weeks[weekIdx];
                        else pct = profile.weeks[profile.weeks.length - 1];
                        valPlan = valPlan * (pct / 100);
                    }
                }
                valEac = valPlan;
            }
            else if (type === 'demand') {
                const isFuture = bucketEnd > todayTime;
                if (isFuture && scaleFactor !== undefined && scaleFactor !== null) {
                    valEac = valPlan * scaleFactor;
                }
            }

            // Scoped-initiative demand reduction: a platform/project-type-targeted initiative
            // reduces the effort needed for matching projects, per role, after it launches.
            // Applied to both plan and EAC so utilisation reflects the efficiency consistently.
            if (type === 'demand' && self._initiatives && self._initiatives.length > 0) {
                const projId = pMeta.projectId || pMeta.id;
                const proj = projId ? projectMap[projId] : null;
                if (proj) {
                    const dm = getInitiativeDemandMultiplier(proj, pMeta.breakdownCategory, rawDate, self._initiatives);
                    if (dm !== 1) { valPlan *= dm; valEac *= dm; }
                }
            }

            let valImpact = (bucketEnd > todayTime) ? (valEac - valPlan) : 0;

            if (Math.abs(valPlan) > 0.01 || Math.abs(valEac) > 0.01) {
                if (!dataMap.has(key)) dataMap.set(key, { key, capacity: 0, details: [], unassignedMap: {} });
                const bucket = dataMap.get(key);


                if (type === 'capacity') {
                    // Apply initiative efficiency boost to capacity
                    let boostedCap = valPlan;
                    if (self._initiatives && self._initiatives.length > 0) {
                        // Get role if available, default to 'unknown' for 'all' team targeting
                        const role = (pMeta.resourceId && resourceMap[pMeta.resourceId]?.role?.toLowerCase()) || 'unknown';
                        const initMultiplier = getInitiativeMultiplier(rawDate, role, self._initiatives);
                        boostedCap = valPlan * initMultiplier;
                    }

                    bucket.capacity += boostedCap;
                    if (pMeta.resourceId && resourceMap[pMeta.resourceId]) {
                        const res = resourceMap[pMeta.resourceId];
                        if (!res.buckets[key]) res.buckets[key] = { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0, projects: [] };
                        res.buckets[key].cap += boostedCap;
                        res.totals.cap += boostedCap;
                    }
                } else {
                    bucket[pMeta.status] = (bucket[pMeta.status] || 0) + valPlan;
                    bucket[`${pMeta.status}_eac`] = (bucket[`${pMeta.status}_eac`] || 0) + valEac;
                    bucket[`${pMeta.status}_imp`] = (bucket[`${pMeta.status}_imp`] || 0) + valImpact;
                    bucket[`baseline_${pMeta.status}`] = (bucket[`baseline_${pMeta.status}`] || 0) + valPlan;

                    const detailObj = { ...leanMeta, hours: valPlan, hours_eac: valEac, hours_imp: valImpact };
                    bucket.details.push(detailObj);

                    if (!bucket.unassignedMap[pMeta.name]) bucket.unassignedMap[pMeta.name] = { ...leanMeta, totalNeeded: 0, totalNeeded_eac: 0, assigned: 0, assigned_eac: 0, roleBreakdown: {} };
                    bucket.unassignedMap[pMeta.name].totalNeeded += valPlan;
                    bucket.unassignedMap[pMeta.name].totalNeeded_eac += valEac;

                    const role = (pMeta.breakdownCategory || 'unknown').toUpperCase();
                    if (!bucket.unassignedMap[pMeta.name].roleBreakdown[role]) bucket.unassignedMap[pMeta.name].roleBreakdown[role] = { needed: 0, needed_eac: 0, assigned: 0, assigned_eac: 0 };
                    bucket.unassignedMap[pMeta.name].roleBreakdown[role].needed += valPlan;
                    bucket.unassignedMap[pMeta.name].roleBreakdown[role].needed_eac += valEac;

                    if (pMeta.resourceId && resourceMap[pMeta.resourceId]) {
                        const res = resourceMap[pMeta.resourceId];
                        // Skip per-resource demand attribution while the resource is on long-term leave.
                        // The project's demand still flows into projectMap + unassignedMap below — only
                        // this resource's bucket and totals are bypassed so they don't show phantom hours.
                        if (!isResourceOnLeave(res, rawDate)) {
                            if (!res.buckets[key]) res.buckets[key] = { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0, projects: [] };
                            res.buckets[key].dem += valPlan;
                            res.buckets[key].dem_eac += valEac;
                            res.buckets[key].dem_imp += valImpact;
                            res.buckets[key].projects.push(detailObj);

                            if (res.totals) {
                                res.totals.dem += valPlan;
                                res.totals.dem_eac += valEac;
                                res.totals.dem_imp += valImpact;
                            }
                        }
                    }

                    // Also track hours in project buckets for per-week resourced visualization
                    const projId = pMeta.projectId || pMeta.id;
                    if (projId && projectMap[projId]) {
                        if (!projectMap[projId].buckets[key]) projectMap[projId].buckets[key] = { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0, assigned: 0, assigned_eac: 0, projects: [] };
                        // NOTE: Do NOT add to .assigned here — assigned is only populated when actual team members exist (below)
                        projectMap[projId].buckets[key].dem += valPlan; // Ensure Demand matches the curved components
                        projectMap[projId].buckets[key].projects.push(detailObj); // Fix: Populate projects array for click handler
                    }

                    if (pMeta.team && pMeta.breakdownCategory && pMeta.team[pMeta.breakdownCategory]) {
                        const assignedUsers = pMeta.team[pMeta.breakdownCategory];
                        if (assignedUsers.length > 0) {
                            // Allocation percentages are computed per-bucket in the
                            // activeUsers block below (explicit / implicit / mix cases).

                            // Placeholder detection: these names should NOT count as "resourced"
                            const _placeholderRx = /^(tbd|tbh|tba|unassigned|placeholder|pending|vacant)/i;

                            // Count only non-placeholder users for assigned hours
                            const realUsers = assignedUsers.filter(u => u.name && !_placeholderRx.test(u.name.trim()));
                            const realUserPlanHours = realUsers.length > 0 ? valPlan * (realUsers.length / assignedUsers.length) : 0;
                            const realUserEacHours = realUsers.length > 0 ? valEac * (realUsers.length / assignedUsers.length) : 0;

                            bucket.unassignedMap[pMeta.name].assigned += realUserPlanHours;
                            bucket.unassignedMap[pMeta.name].assigned_eac += realUserEacHours;

                            // Also track assigned hours in project buckets for per-week resourced visualization
                            const projId = pMeta.projectId || pMeta.id;
                            if (projId && projectMap[projId]) {
                                // Initialize bucket if it doesn't exist yet
                                if (!projectMap[projId].buckets[key]) {
                                    projectMap[projId].buckets[key] = { dem: 0, dem_eac: 0, dem_imp: 0, assigned: 0, assigned_eac: 0, projects: [] };
                                }
                                projectMap[projId].buckets[key].assigned = (projectMap[projId].buckets[key].assigned || 0) + realUserPlanHours;
                                projectMap[projId].buckets[key].assigned_eac = (projectMap[projId].buckets[key].assigned_eac || 0) + realUserEacHours;
                            }

                            const assignedRole = pMeta.breakdownCategory.toUpperCase();
                            if (bucket.unassignedMap[pMeta.name].roleBreakdown[assignedRole]) {
                                bucket.unassignedMap[pMeta.name].roleBreakdown[assignedRole].assigned += realUserPlanHours;
                                bucket.unassignedMap[pMeta.name].roleBreakdown[assignedRole].assigned_eac += realUserEacHours;
                            }

                            // SMART ALLOCATION LOGIC: Filter active users for this bucket (week) first
                            const activeUsers = assignedUsers.filter(u => {
                                const memberStart = u.startDate ? new Date(u.startDate).getTime() : start.getTime();
                                const memberEnd = u.endDate ? new Date(u.endDate).getTime() : end.getTime();
                                return rawDate >= memberStart && rawDate < memberEnd;
                            });

                            if (activeUsers.length > 0) {
                                // Allocation split for the active users in this bucket. We
                                // categorise users as either "explicit" (has a real positive %
                                // saved against them) or "implicit" (no entry, OR entry with
                                // pct === 0). Treating pct=0 as implicit matches the UI's
                                // "X% unassigned → split to N" display logic — the modal
                                // shows pct=0 users as deserving a share of the unassigned
                                // remainder, not as people who are deliberately allocated zero.
                                //
                                // Three cases:
                                //   (a) all explicit → use each user's saved pct
                                //   (b) all implicit → smart even split (100% / N)
                                //   (c) MIX           → explicit users get their pct; remaining
                                //                       (100 - sumExplicit) splits evenly across
                                //                       the implicit users
                                //
                                // History: previously pct=0 counted as "explicit zero" which made
                                // implicit-zero users contribute zero demand whenever someone else
                                // on the project had a real explicit pct. This was the silent
                                // cause of "Francesca shows 0h while allocated to GSK" — the
                                // saved JSON had `{pct: 0, startDate: "..."}` for her, which the
                                // UI interpreted as "implicit, get 25% of remainder" but the
                                // worker interpreted as "explicit, get exactly 0%".
                                const isExplicitPositive = (u) =>
                                    u.allocationPct !== undefined && u.allocationPct !== null && u.allocationPct > 0;
                                const usersWithExplicit = activeUsers.filter(isExplicitPositive);
                                const usersImplicit = activeUsers.filter(u => !isExplicitPositive(u));
                                const totalExplicitPct = usersWithExplicit.reduce((sum, u) => sum + (u.allocationPct || 0), 0);

                                // Compute per-user pct based on which case applies.
                                let evenSplitPctForBucket = 0;
                                let implicitPctForBucket = 0;
                                if (usersWithExplicit.length === 0) {
                                    // Case (b): no one has explicit pct → smart even split
                                    evenSplitPctForBucket = 100 / activeUsers.length;
                                } else if (usersImplicit.length > 0) {
                                    // Case (c): mix → split (100 - explicitTotal) across implicit users.
                                    // Clamp at 0 in case explicits already exceed 100 (rare).
                                    const remaining = Math.max(0, 100 - totalExplicitPct);
                                    implicitPctForBucket = remaining / usersImplicit.length;
                                }

                                activeUsers.forEach(u => {
                                    let pct = 0;
                                    const hasExplicit = isExplicitPositive(u);
                                    if (usersWithExplicit.length === 0) {
                                        pct = evenSplitPctForBucket;
                                    } else if (hasExplicit) {
                                        pct = u.allocationPct || 0;
                                    } else {
                                        pct = implicitPctForBucket;
                                    }

                                    const userLoadPlan = valPlan * (pct / 100);
                                    const userLoadEac = valEac * (pct / 100);
                                    const userLoadImp = valImpact * (pct / 100);

                                    if (resourceMap[u.id] && !isResourceOnLeave(resourceMap[u.id], rawDate)) {
                                        const res = resourceMap[u.id];
                                        if (!res.buckets[key]) res.buckets[key] = { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0, projects: [] };
                                        res.buckets[key].dem += userLoadPlan;
                                        res.buckets[key].dem_eac += userLoadEac;
                                        res.buckets[key].dem_imp += userLoadImp;
                                        res.buckets[key].projects.push({
                                            ...leanMeta,
                                            hours: userLoadPlan, hours_eac: userLoadEac, hours_imp: userLoadImp,
                                            baseline: userLoadPlan,
                                            allocationPct: pct,
                                            memberStartDate: u.startDate || null,
                                            memberEndDate: u.endDate || null
                                        });

                                        if (res.totals) {
                                            res.totals.dem += userLoadPlan;
                                            res.totals.dem_eac += userLoadEac;
                                            res.totals.dem_imp += userLoadImp;
                                        }
                                    }
                                });
                            }

                        }
                    }
                }
            }
        }
        if (config.granularity === 'month') curs.setMonth(curs.getMonth() + 1);
        else curs.setTime(curs.getTime() + 604800000);
    }
};

// Calculate initiative efficiency multiplier for a given date and role
const getInitiativeMultiplier = (bucketDate, role, initiatives) => {
    if (!initiatives || initiatives.length === 0) return 1;

    let multiplier = 1.0;
    const bucketTime = new Date(bucketDate).getTime();

    for (const init of initiatives) {
        if (!init.enabled || init.status === 'archived') continue;

        // Scoped initiatives (targeted at specific platforms and/or project types) apply
        // on the DEMAND side (getInitiativeDemandMultiplier) — skip them here so they don't
        // also boost capacity (which would double-count).
        if (isScopedInitiative(init)) continue;

        const launchTime = new Date(init.launchDate).getTime();
        // Initiative takes effect at NEXT bucket after launch
        if (bucketTime < launchTime) continue;

        // Check if this initiative applies to this role
        const targetTeams = init.targetTeams || ['all'];
        if (!targetTeams.includes('all') && !targetTeams.includes(role)) continue;

        // Calculate ramp percentage
        const weeksSinceLaunch = (bucketTime - launchTime) / (7 * 24 * 60 * 60 * 1000);
        const rampWeeks = init.rampWeeks || 0;
        const rampPct = rampWeeks > 0 ? Math.min(1, weeksSinceLaunch / rampWeeks) : 1;

        // Stack multiplicatively
        const boost = (init.efficiencyPct || 0) / 100;
        multiplier *= (1 + boost * rampPct);
    }

    return multiplier;
};

// An initiative is "scoped" when it targets specific platform(s) and/or project type(s)
// (i.e. not the 'all' wildcard). Scoped initiatives reduce the DEMAND of matching projects
// rather than boosting role capacity globally.
const isScopedInitiative = (init) => {
    const plat = init.targetPlatforms || ['all'];
    const types = init.targetProjectTypes || ['all'];
    const platScoped = plat.length > 0 && !plat.includes('all');
    const typeScoped = types.length > 0 && !types.includes('all');
    return platScoped || typeScoped;
};

// Demand-side multiplier for SCOPED initiatives: reduces the effort of a project that
// matches the initiative's platform AND project-type filters (AND logic), for the given
// role, after launch (ramped). Returns a value in [0, 1] (efficiency reduces demand).
const getInitiativeDemandMultiplier = (project, role, bucketDate, initiatives) => {
    if (!project || !initiatives || initiatives.length === 0) return 1;

    let multiplier = 1.0;
    const bucketTime = new Date(bucketDate).getTime();
    const r = (role || '').toLowerCase();

    for (const init of initiatives) {
        if (!init.enabled || init.status === 'archived') continue;
        if (!isScopedInitiative(init)) continue; // unscoped → handled by capacity multiplier

        const launchTime = new Date(init.launchDate).getTime();
        if (bucketTime < launchTime) continue;

        // AND matching: the project must satisfy every ACTIVE filter dimension.
        const plat = init.targetPlatforms || ['all'];
        const types = init.targetProjectTypes || ['all'];
        if (plat.length > 0 && !plat.includes('all') && !plat.includes(project.platform)) continue;
        if (types.length > 0 && !types.includes('all') && !types.includes(project.projectType)) continue;

        // Role filter (same semantics as the capacity multiplier).
        const targetTeams = init.targetTeams || ['all'];
        if (!targetTeams.includes('all') && !targetTeams.includes(r)) continue;

        // Ramp
        const weeksSinceLaunch = (bucketTime - launchTime) / (7 * 24 * 60 * 60 * 1000);
        const rampWeeks = init.rampWeeks || 0;
        const rampPct = rampWeeks > 0 ? Math.min(1, weeksSinceLaunch / rampWeeks) : 1;

        // Efficiency REDUCES required effort: e.g. 10% efficiency → demand × 0.9.
        const boost = (init.efficiencyPct || 0) / 100;
        multiplier *= Math.max(0, 1 - boost * rampPct);
    }

    return multiplier;
};

self.onmessage = (e) => {
    // Performance timing
    const _perfStart = performance.now();



    const { resList = [], projList = [], config, minDateStr, maxDateStr, sprintStartDateStr, modelParams, rampProfiles, winRates, fyStartMonth = 4, initiatives = [], slotProfile = null, roleConfig = { jobs: {}, constraints: {} }, roleMapping = {}, programAssignments = [], programWorkstreamsWithHours = [], programProjectContributions = [], programStartDate = null, programEndDate = null, programBudgets = {}, bauHoursMapping = null, demandCategory = 'all', bauProjectTypes = ['Change Project'] } = e.data;


    // Store initiatives in self so getInitiativeMultiplier can access them
    self._initiatives = initiatives;

    if (config && modelParams) config.modelParams = modelParams;
    if (config && rampProfiles) config.rampProfiles = rampProfiles;
    if (config && winRates) config.winRates = winRates;
    const minDate = new Date(minDateStr);
    const maxDate = new Date(maxDateStr);
    const todayTime = new Date().setHours(0, 0, 0, 0);
    const resourceMap = {};
    const projectMap = {};
    const virtualBAUProjects = []; // Collect virtual BAU projects for grid display
    const dataMap = new Map();
    const rawStatusSet = new Set();

    if (Array.isArray(resList)) resList.forEach(r => {
        resourceMap[r.id] = {
            ...r,
            buckets: {},
            totals: { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0 }
        };
    });
    const activeProjectsSet = new Set();

    let gridCursor = new Date(minDate);
    const initialInfo = getBucketInfo(gridCursor, (config ? config.granularity : 'week'), minDate, sprintStartDateStr);
    gridCursor = new Date(initialInfo.rawDate);
    while (gridCursor.getTime() <= maxDate.getTime()) {
        const info = getBucketInfo(gridCursor, config.granularity, minDate, sprintStartDateStr);
        if (!dataMap.has(info.key)) dataMap.set(info.key, { key: info.key, capacity: 0, label: info.label, rawDate: info.rawDate, details: [], unassignedMap: {} });
        if (config.granularity === 'month') gridCursor.setMonth(gridCursor.getMonth() + 1);
        else gridCursor.setTime(gridCursor.getTime() + 604800000);
    }

    // Capacity utilisation model selector. Two meaningfully different lenses:
    //   'annualised' → flat per-week = workingHours × annualUtilization. Vacation/holidays/sick are
    //                   already baked into the annual % (read from ANNUAL_UTILIZATION field), so we
    //                   do NOT also skip leave weeks — that would double-discount.
    //   'agw'         → Any Given Week. Per-week = daysPresent × dailyHours × weeklyProductivity.
    //                   Leave honoured per-day. Different weeks show different capacity.
    // Legacy values 'field' / 'presence' are accepted for backward compat.
    const rawModel = (config.capacityUtilizationModel || 'annualised').toLowerCase();
    const capacityUtilModel = (rawModel === 'presence') ? 'agw'
        : (rawModel === 'field') ? 'annualised'
        : rawModel;

    if (Array.isArray(resList)) resList.forEach(r => {
        const start = r.startDate ? new Date(r.startDate) : new Date('1970-01-01');
        const end = r.leaveDate ? new Date(r.leaveDate) : new Date('2100-01-01');
        const leaveStart = r.leaveStartDate ? new Date(r.leaveStartDate) : null;
        const leaveEnd = r.leaveEndDate ? new Date(r.leaveEndDate) : null;

        if (capacityUtilModel === 'agw') {
            // Any Given Week: per-week capacity = (5 - daysOnLeaveInWeek) × (workingHours/5) × weeklyProductivity.
            // Leave is honoured at the day level, so a 2-day-leave week gives 3 days × dailyHours × productivity.
            // Ramp profiles are still applied via processDateRange (flat hourly load), which lets the existing
            // ramp logic stack on top — we feed processDateRange a per-week hour value derived from presence.
            const rawHrs = (r.workingHours && r.workingHours > 100) ? r.workingHours / 3600 : (r.workingHours || 40);
            const dailyHours = rawHrs / 5;
            const productivity = (r.weeklyProductivity != null) ? r.weeklyProductivity : (r.targetUtilization ?? 0.8);
            const leaveStartMs = leaveStart ? leaveStart.getTime() : null;
            const leaveEndMs = leaveEnd ? leaveEnd.getTime() : null;
            const startMs = Math.max(start.getTime(), minDate.getTime());
            const endMs = Math.min(end.getTime(), maxDate.getTime());
            if (endMs < startMs) return;

            // Walk Monday-aligned weeks through the [start, end] range; for each week compute
            // present days and emit a 1-week processDateRange call so ramp + bucket aggregation
            // logic still runs unchanged.
            const cursor = new Date(startMs);
            const startBucket = getBucketInfo(cursor, 'week', minDate, sprintStartDateStr);
            let weekStartMs = startBucket.rawDate;
            const WEEK_MS = 604800000;
            const safetyCap = 520; // ~10 years of weeks — guards against runaway loops
            let iterations = 0;

            while (weekStartMs <= endMs && iterations++ < safetyCap) {
                const weekEndMs = weekStartMs + WEEK_MS - 1;
                const daysOff = businessDayOverlap(weekStartMs, weekEndMs, leaveStartMs, leaveEndMs);
                const daysPresent = Math.max(0, 5 - daysOff);
                const weeklyCap = daysPresent * dailyHours * productivity;
                if (weeklyCap > 0) {
                    const weekStart = new Date(weekStartMs);
                    const weekEnd = new Date(Math.min(weekEndMs, endMs));
                    processDateRange(weekStart, weekEnd, weeklyCap, 'capacity', { resourceId: r.id, rampProfile: r.rampProfile, rampStartDate: r.rampStartDate }, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
                }
                weekStartMs += WEEK_MS;
            }
        } else {
            // Annualised mode. Flat per-week capacity = workingHours × annualUtilization.
            // The annual % already absorbs *normal* vacation (~28 d/yr), public holidays, sick days
            // — those are uniform across the year so we don't need date-specific carve-out for them.
            // BUT a temporary leave RANGE (sabbatical, parental, long-term sick) is on top of that
            // budget and must be carved out explicitly — otherwise a 6-month absence shows full
            // capacity in the grid. Mirrors the legacy field-mode carve-out pattern below.
            const rawHrs = (r.workingHours && r.workingHours > 100) ? r.workingHours / 3600 : (r.workingHours || 40);
            const annualPct = (r.annualUtilization != null) ? r.annualUtilization : (r.targetUtilization ?? 0.8);
            const weeklyCap = rawHrs * annualPct;
            const meta = { resourceId: r.id, rampProfile: r.rampProfile, rampStartDate: r.rampStartDate };

            if (leaveStart && leaveEnd && leaveStart.getTime() < leaveEnd.getTime()) {
                // Carve [start, leaveStart-1] and [leaveEnd+1, end]; leave range gets no capacity write.
                if (start.getTime() < leaveStart.getTime()) {
                    const beforeLeaveEnd = new Date(leaveStart.getTime() - 1);
                    processDateRange(start, beforeLeaveEnd, weeklyCap, 'capacity', meta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
                }
                if (leaveEnd.getTime() < end.getTime()) {
                    const afterLeaveStart = new Date(leaveEnd.getTime() + 86400000);
                    processDateRange(afterLeaveStart, end, weeklyCap, 'capacity', meta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
                }
            } else {
                processDateRange(start, end, weeklyCap, 'capacity', meta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
            }
        }
    });

    // Program Resourcing: Add FIXED program demand (matching Modal logic)
    // Uses workstream fixed hours * assignment allocation %
    if (Array.isArray(programAssignments) && programAssignments.length > 0) {
        programAssignments.forEach(assignment => {
            if (!assignment.resourceId || !resourceMap[assignment.resourceId]) return;

            // Determine hours from workstream map
            // FIX: Use Customer-Specific Workstream Hours if available, otherwise fallback to global
            let targetWorkstreams = programWorkstreamsWithHours; // Default Global
            if (assignment.customer && programBudgets && programBudgets[assignment.customer] && programBudgets[assignment.customer].workstreams) {
                targetWorkstreams = programBudgets[assignment.customer].workstreams;
            }

            const wsName = (assignment.workstream || '').trim();
            const ws = targetWorkstreams.find(w => (w.name || '').trim() === wsName);
            const baseHours = ws ? (ws.hours || 0) : 0;

            const pct = (assignment.allocationPct !== undefined ? assignment.allocationPct : 100) / 100;

            // Calculate active assignment dates

            const assignmentStart = assignment.startDate ? new Date(assignment.startDate) : minDate;
            const assignmentEnd = assignment.endDate ? new Date(assignment.endDate) : maxDate;

            // Calculate program duration for this customer to determine weekly distribution
            // (Modal logic mirrors this to calculate "Weekly Load" display)
            let customerDurationWeeks = 52; // Default fallback
            const customerProgram = (programBudgets && assignment.customer) ? programBudgets[assignment.customer] : null;

            if (customerProgram && customerProgram.start && customerProgram.end) {
                const s = new Date(customerProgram.start);
                const e = new Date(customerProgram.end);
                if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
                    customerDurationWeeks = Math.max(1, (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 7));
                }
            } else if (programStartDate && programEndDate) {
                const s = new Date(programStartDate);
                const e = new Date(programEndDate);
                if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
                    customerDurationWeeks = Math.max(1, (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 7));
                }
            }

            // Use assignment duration to spread the TOTAL fixed hours
            let assignmentDurationWeeks = customerDurationWeeks;
            if (assignmentStart && assignmentEnd && assignmentEnd > assignmentStart) {
                assignmentDurationWeeks = Math.max(1, (assignmentEnd.getTime() - assignmentStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
            }

            // Distribute TOTAL hours (baseHours * pct) over the assignment duration
            const weeklyHours = (baseHours * pct) / assignmentDurationWeeks;

            if (weeklyHours <= 0.01) return;

            // Construct meta for display
            const programMeta = {
                id: assignment.id || `prog-${Math.random()}`,
                name: assignment.customer ? `${assignment.customer} Program` : 'Program Governance',
                type: 'program',
                breakdownCategory: 'program_governance',
                isProgram: true, // Flag for modal filtering
                customer: assignment.customer,
                resourceId: assignment.resourceId,
                hours: weeklyHours
            };

            processDateRange(assignmentStart, assignmentEnd, weeklyHours, 'demand', programMeta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
        });
    }

    // ========================================
    // UNASSIGNED PROGRAM DEMAND
    // ========================================
    // Show the gap between total program budget and assigned portions on the graph.
    // Without this, the program discount removed from country projects is invisible
    // when workstream hours aren't fully assigned to resources.
    if (programBudgets && typeof programBudgets === 'object') {
        // 1. Calculate total assigned percentage per customer per workstream
        const assignedByCustomerWs = {};
        (programAssignments || []).forEach(a => {
            if (!a.customer || !a.workstream) return;
            const key = `${a.customer}||${a.workstream}`;
            if (!assignedByCustomerWs[key]) assignedByCustomerWs[key] = 0;
            assignedByCustomerWs[key] += (a.allocationPct !== undefined ? a.allocationPct : 100);
        });

        // 2. For each customer budget, find unassigned workstream hours
        Object.entries(programBudgets).forEach(([customer, budget]) => {
            if (!budget || !budget.workstreams) return;

            // Determine program date range for this customer
            let progStart = budget.start ? new Date(budget.start) : (programStartDate ? new Date(programStartDate) : minDate);
            let progEnd = budget.end ? new Date(budget.end) : (programEndDate ? new Date(programEndDate) : maxDate);
            if (isNaN(progStart.getTime())) progStart = minDate;
            if (isNaN(progEnd.getTime())) progEnd = maxDate;
            if (progEnd <= progStart) return;

            const durationWeeks = Math.max(1, (progEnd.getTime() - progStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

            budget.workstreams.forEach(ws => {
                if (!ws.name || !ws.hours || ws.hours <= 0) return;

                const key = `${customer}||${ws.name}`;
                const totalAssignedPct = assignedByCustomerWs[key] || 0;
                const unassignedPct = Math.max(0, 100 - totalAssignedPct);

                if (unassignedPct <= 0) return; // Fully assigned

                const unassignedHours = ws.hours * (unassignedPct / 100);
                const weeklyUnassigned = unassignedHours / durationWeeks;

                if (weeklyUnassigned <= 0.01) return;

                const unassignedMeta = {
                    id: `prog-unassigned-${customer}-${ws.name}`,
                    name: `${customer} Program`,
                    type: 'program',
                    breakdownCategory: 'program_governance',
                    isProgram: true,
                    customer: customer,
                    workstream: ws.name,
                    resourceId: null, // No specific resource — shows as unassigned demand
                    hours: weeklyUnassigned,
                    isUnassignedProgram: true
                };

                processDateRange(progStart, progEnd, weeklyUnassigned, 'demand', unassignedMeta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
            });
        });
    }


    // Project demand processing:
    // - 'all' mode: process all projects
    // - 'implementation' mode: skip BAU project types (from Settings)
    // - 'bau' mode: ONLY process BAU project types (from Settings)
    // bauProjectTypes is passed from useCapacityData (from user Settings)
    if (Array.isArray(projList)) projList.forEach(p => {
        const projectType = p.projectType || 'Implementation';
        const isBauProjectType = bauProjectTypes.some(t => projectType.toLowerCase().includes(t.toLowerCase()));

        // Filter based on demandCategory
        if (demandCategory === 'implementation' && isBauProjectType) return; // Skip BAU in implementation mode
        if (demandCategory === 'bau' && !isBauProjectType) return; // Skip non-BAU in BAU mode

        if (!projectMap[p.id]) projectMap[p.id] = { ...p, buckets: {}, totals: { cap: 0, dem: 0, dem_eac: 0, dem_imp: 0 } };

        // Skip projects with invalid dates
        const start = safeDate(p.start);
        const end = safeDate(p.end);
        if (!start || !end) return;

        if (end.getTime() === start.getTime()) {
            end.setDate(end.getDate() + 1);
        }

        if (end <= start || end < minDate || start > maxDate) return;
        const bucketLen = config.granularity === 'month' ? 2419200000 : 604800000;
        const units = Math.max(1, (end - start) / bucketLen);

        // Resourcing Override Logic: Scale role hours to match override value
        // FIX: Changed >= 0 to > 0 to prevent override=0 from zeroing out demand
        // When override is 0 or NaN, we should skip the override and use original values
        if (p.resourcingOverride !== undefined && p.resourcingOverride !== null && p.resourcingOverride !== '') {
            const overrideVal = parseFloat(p.resourcingOverride);
            const currentTotal = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);

            // Only apply override if overrideVal is a positive number
            if (overrideVal > 0) {
                if (currentTotal > 0) {
                    const factor = overrideVal / currentTotal;
                    p.pmVal = (p.pmVal || 0) * factor;
                    p.scVal = (p.scVal || 0) * factor;
                    p.pdVal = (p.pdVal || 0) * factor;
                } else {
                    // Fallback: If no underlying role demand, assign all to PM
                    p.pmVal = overrideVal;
                    p.scVal = 0;
                    p.pdVal = 0;
                }
            }
            // If overrideVal is 0 or NaN, don't apply override - keep original values
        }

        let scaleFactor = 1;
        // Coerce inputs defensively: missing/non-numeric actuals or pctComplete must
        // not propagate NaN into totalEstimated / trueEAC below.
        const safeActuals = Number(p.actuals) || 0;
        let safePct = Number(p.pctComplete) || 0;
        if (safePct > 1) safePct = safePct / 100;

        if (safePct > 0 && safePct < 1) {
            const totalEstimated = safeActuals / safePct;
            const remainingHours = Math.max(0, totalEstimated - safeActuals);
            const totalPlanned = p.pmVal + p.scVal + p.pdVal;
            let futureUnits = 0;
            if (end.getTime() > todayTime) {
                const effectiveStart = start.getTime() > todayTime ? start : new Date(todayTime);
                futureUnits = Math.max(0, (end - effectiveStart) / bucketLen);
            }

            if (futureUnits > 0 && totalPlanned > 0) {
                const plannedBurn = totalPlanned / units;
                const futureAlloc = plannedBurn * futureUnits;
                if (futureAlloc > 0.1) scaleFactor = remainingHours / futureAlloc;
                else scaleFactor = 1;
            } else if (remainingHours > 0) {
                scaleFactor = 1;
            } else {
                scaleFactor = 0;
            }
        }

        rawStatusSet.add(p.status);
        activeProjectsSet.add(p.id);
        let trueEAC = p.pmVal + p.scVal + p.pdVal;
        if (safePct > 0 && safePct < 1) trueEAC = safeActuals / safePct;
        else if (safePct >= 1) trueEAC = safeActuals;

        const metaBase = {
            status: p.status,
            name: p.name,
            wave: p.wave,
            startDate: p.start,
            endDate: p.end,
            uatStart: p.uatStart,
            team: p.team,
            id: p.id,
            projectId: p.id,
            totalPlanned: p.pmVal + p.scVal + p.pdVal,
            actuals: p.actuals || 0,
            pctComplete: p.pctComplete || 0,
            eac: trueEAC,
            resourceId: p.id,
            squads: p.squads,
            effortProfile: p.effortProfile,
            customer: p.customer,
            countryFlag: p.countryFlag,
            country: p.country,
            transactionalBenefits: p.transactionalBenefits,
            nonTransactionalBenefits: p.nonTransactionalBenefits,
            contentOnlyBenefits: p.contentOnlyBenefits,
            languages: p.languages,
            // Program Resourcing
            resourcedWithinProgram: p.resourcedWithinProgram,
            hoursOriginal: (p.pmValOriginal || 0) + (p.scValOriginal || 0) + (p.pdValOriginal || 0)
        };

        // For FPS profile, extend the end date to include 6-week post-close period
        const effortProfileLower = (p.effortProfile || '').toLowerCase();
        const isFPS = effortProfileLower.includes('fps');
        const isDomestic = effortProfileLower.includes('domestic');
        // Benifex "Role Specific" — matches either "role" or "benifex" in the name but NOT "domestic" (caught above)
        const isRoleSpecific = !isDomestic && (effortProfileLower.includes('role') || effortProfileLower.includes('benifex'));
        const extensionMs = isFPS ? (6 * 7 * 24 * 60 * 60 * 1000) : 0;
        const effectiveEnd = extensionMs > 0 ? new Date(end.getTime() + extensionMs) : end;
        const effectiveUnits = extensionMs > 0 ? Math.max(1, (effectiveEnd - start) / bucketLen) : units;

        if (isDomestic) {
            // Benifex Domestic UK: Two-phase approach
            // Phase 1: Flat demand during project timeline (original dates, original load)
            const flatMeta = { ...metaBase, effortProfile: 'Flat' }; // Override to prevent domestic logic inside processDateRange
            if (p.pmVal > 0) processDateRange(start, end, p.pmVal / units, 'demand', { ...flatMeta, breakdownCategory: 'pm', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            if (p.scVal > 0) processDateRange(start, end, p.scVal / units, 'demand', { ...flatMeta, breakdownCategory: 'sc', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            if (p.pdVal > 0) processDateRange(start, end, p.pdVal / units, 'demand', { ...flatMeta, breakdownCategory: 'pd', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);

            // Phase 2: Hypercare — fixed hours per role per week after go-live.
            // Mode 'fixed' uses absolute hours/week; mode 'percent' computes hours/week as
            // a percentage of the project's total planned effort (pmVal+scVal+pdVal already in hours).
            const domesticSettings = (config.modelParams && config.modelParams.domesticProfile) || {};
            const hcWeeks = domesticSettings.hypercareWeeks ?? 13;
            const hcMode = domesticSettings.hypercareMode || 'fixed';
            const projectTotalHours = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);
            const hcHoursPerWeek = hcMode === 'percent'
                ? projectTotalHours * ((domesticSettings.hypercarePercentPerWeek ?? 1.25) / 100)
                : (domesticSettings.hypercareHoursPerWeek ?? 3);
            const hcHoursPerRole = hcHoursPerWeek / 3;
            const hcEnd = new Date(end.getTime() + hcWeeks * 7 * 24 * 60 * 60 * 1000);
            const hcMeta = { ...metaBase, effortProfile: 'Flat' }; // Flat distribution for hypercare
            processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'pm', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'sc', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'pd', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
        } else {
            if (p.pmVal > 0) processDateRange(start, effectiveEnd, p.pmVal / effectiveUnits, 'demand', { ...metaBase, breakdownCategory: 'pm', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            if (p.scVal > 0) processDateRange(start, effectiveEnd, p.scVal / effectiveUnits, 'demand', { ...metaBase, breakdownCategory: 'sc', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
            if (p.pdVal > 0) processDateRange(start, effectiveEnd, p.pdVal / effectiveUnits, 'demand', { ...metaBase, breakdownCategory: 'pd', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);

            // Role-Specific Profile (Benifex): layer a hypercare tail AFTER the main role-curve demand.
            // Same shape as Domestic's hypercare (flat hours per role per week after go-live), but the
            // project-timeline phase uses role-specific curves instead of flat.
            // Mode 'fixed' = absolute hours/week. Mode 'percent' = (project total hours) × (% / 100).
            if (isRoleSpecific) {
                const roleSettings = (config.modelParams && config.modelParams.roleSpecificProfile) || {};
                const hcWeeks = roleSettings.hypercareWeeks ?? 13;
                const hcMode = roleSettings.hypercareMode || 'fixed';
                const projectTotalHours = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);
                const hcHoursPerWeek = hcMode === 'percent'
                    ? projectTotalHours * ((roleSettings.hypercarePercentPerWeek ?? 1.25) / 100)
                    : (roleSettings.hypercareHoursPerWeek ?? 3);
                if (hcWeeks > 0 && hcHoursPerWeek > 0) {
                    const hcHoursPerRole = hcHoursPerWeek / 3;
                    const hcEnd = new Date(end.getTime() + hcWeeks * 7 * 24 * 60 * 60 * 1000);
                    const hcMeta = { ...metaBase, effortProfile: 'Flat' };
                    processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'pm', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
                    processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'sc', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
                    processDateRange(end, hcEnd, hcHoursPerRole, 'demand', { ...hcMeta, breakdownCategory: 'pd', resourceId: null }, minDate, maxDate, config, dataMap, resourceMap, projectMap, scaleFactor, sprintStartDateStr, todayTime);
                }
            }
        }

        // Removed separate totalLoad calculation which was bypassing role profiles and caching 'flat' demand.
        // The projectMap totals are now aggregated from the component calls above.
    });

    // ========================================
    // BAU LIVE SITE DEMAND CALCULATION
    // ========================================
    // For BAU and ALL views: Generate synthetic "Customer Change" demand for Implementation projects
    // that have launched (based on launch date being in the past for each bucket).
    // Uses BAU T-Shirt Size to determine annual hours of ongoing support.
    if (demandCategory === 'bau' || demandCategory === 'all') {
        // Default mapping (hours per year) - used when bauHoursMapping not configured
        const defaultMapping = {
            'XXS': 25, 'XS': 50, 'S': 100, 'M': 200, 'L': 400, 'XL': 800, 'XXL': 1600
        };
        const hoursMap = (bauHoursMapping && typeof bauHoursMapping === 'object')
            ? { ...defaultMapping, ...bauHoursMapping }
            : defaultMapping;

        let validCount = 0;
        let dateFilteredCount = 0;
        // Find Implementation projects with BAU t-shirt sizes
        if (Array.isArray(projList)) projList.forEach(p => {
            // Only process Implementation projects (not already BAU project types)
            const isImplementation = !p.projectType || p.projectType === 'Implementation';
            const hasTshirt = p.bauTshirtSize && hoursMap[p.bauTshirtSize];

            if (!isImplementation || !hasTshirt) return;
            validCount++;

            // Use launch date (p.end) to determine when BAU demand starts
            // BAU demand starts from launch date and continues forever
            const launchDate = safeDate(p.end);
            if (!launchDate) {
                dateFilteredCount++;
                return;
            }

            // Calculate weekly hours from annual t-shirt size
            const annualHours = hoursMap[p.bauTshirtSize];
            const weeklyHours = annualHours / 52;

            // Generate BAU demand from launch date to max date (continuing forever within view range)
            // If launch date is in the future, BAU demand starts after launch
            // If launch date is in the past, BAU demand starts from minDate (or launch, whichever is later)
            const bauStart = new Date(Math.max(launchDate.getTime(), minDate.getTime()));
            const bauEnd = maxDate;

            // Only generate if launch date is before maxDate (i.e., BAU has started within view range)
            if (launchDate > maxDate) {
                dateFilteredCount++;
                return;
            }
            if (bauEnd <= bauStart) {
                dateFilteredCount++;
                return;
            }


            const bauMeta = {
                id: `bau-${p.id}`,
                name: `${p.name} (Customer Change)`,
                projectId: p.id,
                status: 'BAU',
                breakdownCategory: 'bau',
                startDate: bauStart.toISOString(),
                endDate: bauEnd.toISOString(),
                customer: p.customer,
                squads: p.squads,
                bauTshirtSize: p.bauTshirtSize,
                hoursPerYear: annualHours,
                isBauDemand: true
            };

            // Collect for grid display
            virtualBAUProjects.push({
                ...bauMeta,
                // Include source project data for display
                countryFlag: p.countryFlag,
                country: p.country,
                // Expose the source project's squad as a string so the grid can group
                // by it and the BAU detail modal can show/edit the current squad.
                // (bauMeta carries only the squads[] array.)
                squad: (Array.isArray(p.squads) && p.squads[0]) || 'Unassigned',
                launch: launchDate.toISOString(), // Use 'launch' to match card expectations
                sourceProjectId: p.id,
                sourceProjectName: p.name
            });

            // Process as demand (distributes across time buckets)
            processDateRange(bauStart, bauEnd, weeklyHours, 'demand', bauMeta, minDate, maxDate, config, dataMap, resourceMap, projectMap, 1, sprintStartDateStr, todayTime);
        });

        // Add BAU to the unique statuses so chart displays it
        if (validCount - dateFilteredCount > 0) {
            rawStatusSet.add('BAU');
        }

        // Debug: Log how many virtual BAU projects were created

    }

    // ========================================
    // REVENUE RECOGNITION CALCULATION
    // ========================================
    // FY start month is configurable (0-indexed: 0=Jan, 4=May, etc.)
    const todayDate = new Date(todayTime);
    const currentYear = todayDate.getFullYear();
    const currentMonth = todayDate.getMonth();
    // If we're before the FY start month, the FY started last year
    const fyStartYear = currentMonth < fyStartMonth ? currentYear - 1 : currentYear;
    const fyStart = new Date(fyStartYear, fyStartMonth, 1); // First day of FY
    // FY ends on the last day of the month before fyStartMonth in the next year
    const fyEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
    const fyEndYear = fyStartMonth === 0 ? fyStartYear : fyStartYear + 1;
    const fyEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59); // Last day of month

    let revRecTotals = {
        implFee: { toDate: 0, fullYear: 0 },
        arr: { toDate: 0, fullYear: 0 },
        total: { toDate: 0, fullYear: 0 }
    };

    // Per-project revenue breakdown for the drawer
    const revRecByProject = [];

    if (Array.isArray(projList)) projList.forEach(p => {
        const launchDate = safeDate(p.end);
        const kickOffDate = safeDate(p.start);
        const implFee = p.implFee || 0;
        const arrVal = p.arr || 0;
        const isPOC = p.revenueModel && p.revenueModel.toLowerCase().includes('poc');

        if (!launchDate) return;

        // Track per-project contribution
        let projectImplFee = 0;
        let projectArr = 0;

        // ARR is ALWAYS recognized at Launch
        if (launchDate >= fyStart && launchDate <= fyEnd) {
            revRecTotals.arr.fullYear += arrVal;
            projectArr = arrVal;
            if (launchDate <= todayDate) {
                revRecTotals.arr.toDate += arrVal;
            }
        }

        // Implementation Fee recognition depends on model
        if (isPOC && kickOffDate && launchDate > kickOffDate) {
            // POC Model: Proportional recognition from KickOff to Launch
            const projectDuration = launchDate - kickOffDate;

            // FY overlap calculation
            const effectiveStart = Math.max(kickOffDate.getTime(), fyStart.getTime());
            const effectiveEnd = Math.min(launchDate.getTime(), fyEnd.getTime());

            if (effectiveEnd > effectiveStart) {
                // Calculate overlap percentage for Full Year
                const overlapDuration = effectiveEnd - effectiveStart;
                const fyImplFee = (overlapDuration / projectDuration) * implFee;
                revRecTotals.implFee.fullYear += fyImplFee;
                projectImplFee = fyImplFee;

                // Calculate To Date (up to today)
                const toDateEnd = Math.min(todayDate.getTime(), effectiveEnd);
                if (toDateEnd > effectiveStart) {
                    const toDateDuration = toDateEnd - effectiveStart;
                    const toDateImplFee = (toDateDuration / projectDuration) * implFee;
                    revRecTotals.implFee.toDate += toDateImplFee;
                }
            }
        } else {
            // Non-POC Model: Full recognition at Launch
            if (launchDate >= fyStart && launchDate <= fyEnd) {
                revRecTotals.implFee.fullYear += implFee;
                projectImplFee = implFee;
                if (launchDate <= todayDate) {
                    revRecTotals.implFee.toDate += implFee;
                }
            }
        }

        // Only include projects with revenue contribution
        if (projectImplFee > 0 || projectArr > 0) {
            revRecByProject.push({
                id: p.id,
                name: p.name,
                status: p.status,
                launchDate: launchDate ? launchDate.toISOString().split('T')[0] : null,
                revenueModel: p.revenueModel || 'Non-POC',
                implFee: projectImplFee,
                arr: projectArr,
                total: projectImplFee + projectArr,
                rawImplFee: implFee, // Original values before FY calculation
                rawArr: arrVal
            });
        }
    });

    // Calculate totals
    revRecTotals.total.toDate = revRecTotals.implFee.toDate + revRecTotals.arr.toDate;
    revRecTotals.total.fullYear = revRecTotals.implFee.fullYear + revRecTotals.arr.fullYear;

    // ========================================
    // SLOT DETECTION ENGINE (Phase 2)
    // ========================================
    // Calculate available delivery slots per squad per time bucket
    // A "slot" is the capacity to deliver a standard project profile
    // Using Primary/Secondary role model for slot recommendations
    let slotMap = {};

    if (slotProfile && slotProfile.pmHours > 0) {
        // Group resources by squad with their role configuration
        const squadResourceMap = {};
        const roleJobs = (roleConfig && roleConfig.jobs) || {};

        if (Array.isArray(resList)) resList.forEach(r => {
            const squads = r.squads || [r.squad || 'Unassigned'];
            const jobTitle = r.adJobTitle || r.role || '';
            const roleKey = jobTitle.toUpperCase();

            // Check if this job title has role configuration
            const jobConf = roleJobs[jobTitle];

            let primaryRole = null;
            let secondaryRoles = [];

            if (jobConf && jobConf.primary) {
                // Use configured primary/secondary roles from roleConfig.jobs
                const normalizePrimary = (val) => {
                    if (!val) return null;
                    const upper = val.toUpperCase();
                    if (upper === 'PM' || upper.includes('PROJECT')) return 'pm';
                    if (upper === 'SC' || upper.includes('SOLUTION') || upper.includes('CONSULT')) return 'sc';
                    if (upper === 'PD' || upper === 'BUILD' || upper.includes('PLATFORM') || upper.includes('DELIV')) return 'build';
                    return null;
                };
                primaryRole = normalizePrimary(jobConf.primary);
                secondaryRoles = (jobConf.secondary || []).map(normalizePrimary).filter(Boolean);
            } else {
                // Fallbacks...
                const mappedRole = roleMapping[jobTitle] || roleMapping[r.role];
                if (mappedRole) {
                    const mappedUpper = mappedRole.toUpperCase();
                    if (mappedUpper === 'PM') primaryRole = 'pm';
                    else if (mappedUpper === 'SC') primaryRole = 'sc';
                    else if (mappedUpper === 'PD' || mappedUpper === 'BUILD') primaryRole = 'build';
                } else {
                    const roleField = (r.role || '').toUpperCase();
                    if (roleField === 'PM' || roleField.includes('PROJECT')) primaryRole = 'pm';
                    else if (roleField === 'SC' || roleField.includes('SOLUTION') || roleField.includes('CONSULTANT')) primaryRole = 'sc';
                    else if (roleField === 'PD' || roleField.includes('BUILD') || roleField.includes('DEVELOP')) primaryRole = 'build';

                    if (!primaryRole) {
                        if (roleKey.includes('PM') || roleKey.includes('PROJECT MANAGER') || roleKey.includes('PROGRAM')) primaryRole = 'pm';
                        else if (roleKey.includes('SC') || roleKey.includes('SOLUTION CONSULTANT') || roleKey.includes('SOLUTION') || roleKey.includes('CONSULT')) primaryRole = 'sc';
                        else if (roleKey.includes('PD') || roleKey.includes('DEVELOPER') || roleKey.includes('BUILD') || roleKey.includes('ENGINEER') || roleKey.includes('TECHNICAL')) primaryRole = 'build';
                    }

                    if (!primaryRole && (roleField !== 'OTHER' && roleField !== '')) {
                        primaryRole = 'build';
                    }
                }
            }

            if (!primaryRole) return;

            squads.forEach(squad => {
                if (!squad || squad === 'Unassigned') return;
                if (!squadResourceMap[squad]) {
                    squadResourceMap[squad] = {
                        pm: { primary: [], secondary: [] },
                        sc: { primary: [], secondary: [] },
                        build: { primary: [], secondary: [] }
                    };
                }

                squadResourceMap[squad][primaryRole].primary.push(r.id);

                secondaryRoles.forEach(secRole => {
                    if (squadResourceMap[squad][secRole]) {
                        squadResourceMap[squad][secRole].secondary.push(r.id);
                    }
                });
            });
        });

        // For each time bucket, calculate slot availability per squad
        const bucketKeys = Array.from(dataMap.keys());

        bucketKeys.forEach(bucketKey => {
            const bucketData = dataMap.get(bucketKey);
            if (!bucketData) return;

            Object.entries(squadResourceMap).forEach(([squad, roleResources]) => {
                let pmCapacity = 0, pmDemand = 0, pmSecondaryCapacity = 0;
                let scCapacity = 0, scDemand = 0, scSecondaryCapacity = 0;
                let buildCapacity = 0, buildDemand = 0, buildSecondaryCapacity = 0;

                roleResources.pm.primary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        pmCapacity += resource.buckets[bucketKey].cap || 0;
                        pmDemand += resource.buckets[bucketKey].dem || 0;
                    }
                });
                roleResources.pm.secondary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        const cap = resource.buckets[bucketKey].cap || 0;
                        const dem = resource.buckets[bucketKey].dem || 0;
                        pmSecondaryCapacity += Math.max(0, cap - dem);
                    }
                });

                roleResources.sc.primary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        scCapacity += resource.buckets[bucketKey].cap || 0;
                        scDemand += resource.buckets[bucketKey].dem || 0;
                    }
                });
                roleResources.sc.secondary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        const cap = resource.buckets[bucketKey].cap || 0;
                        const dem = resource.buckets[bucketKey].dem || 0;
                        scSecondaryCapacity += Math.max(0, cap - dem);
                    }
                });

                roleResources.build.primary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        buildCapacity += resource.buckets[bucketKey].cap || 0;
                        buildDemand += resource.buckets[bucketKey].dem || 0;
                    }
                });
                roleResources.build.secondary.forEach(resId => {
                    const resource = resourceMap[resId];
                    if (resource && resource.buckets[bucketKey]) {
                        const cap = resource.buckets[bucketKey].cap || 0;
                        const dem = resource.buckets[bucketKey].dem || 0;
                        buildSecondaryCapacity += Math.max(0, cap - dem);
                    }
                });

                const pmPrimaryRemaining = Math.max(0, pmCapacity - pmDemand);
                const scPrimaryRemaining = Math.max(0, scCapacity - scDemand);
                const buildPrimaryRemaining = Math.max(0, buildCapacity - buildDemand);

                const pmTotalRemaining = pmPrimaryRemaining + pmSecondaryCapacity;
                const scTotalRemaining = scPrimaryRemaining + scSecondaryCapacity;
                const buildTotalRemaining = buildPrimaryRemaining + buildSecondaryCapacity;

                const weeksPerSlot = slotProfile.durationWeeks || 12;
                const pmPerWeek = slotProfile.pmHours / weeksPerSlot;
                const scPerWeek = slotProfile.scHours / weeksPerSlot;
                const buildPerWeek = slotProfile.buildHours / weeksPerSlot;

                const pmSlots = pmPerWeek > 0 ? pmTotalRemaining / pmPerWeek : Infinity;
                const scSlots = scPerWeek > 0 ? scTotalRemaining / scPerWeek : Infinity;
                const buildSlots = buildPerWeek > 0 ? buildTotalRemaining / buildPerWeek : Infinity;

                const availableSlots = Math.min(pmSlots, scSlots, buildSlots);

                let bottleneck = null;
                if (availableSlots < Infinity) {
                    if (pmSlots <= scSlots && pmSlots <= buildSlots) bottleneck = 'PM';
                    else if (scSlots <= pmSlots && scSlots <= buildSlots) bottleneck = 'SC';
                    else bottleneck = 'Build';
                }

                const score = Math.min(1, availableSlots);

                let state = 'FULL';
                if (score >= 0.8) state = 'OPEN';
                else if (score >= 0.4) state = 'PARTIAL';

                const constraints = roleConfig.constraints || {};
                let constraintWarning = null;

                if (constraints.SC && constraints.SC.requiresPrimaryFor && constraints.SC.requiresPrimaryFor.includes('PM')) {
                    const hasPrimarySC = scPrimaryRemaining > 0;
                    const hasPrimaryPM = pmPrimaryRemaining > 0;
                    const onlySecondaryPM = pmPrimaryRemaining <= 0 && pmSecondaryCapacity > 0;

                    if (hasPrimarySC && onlySecondaryPM) {
                        constraintWarning = 'SC→PM: Primary SC requires Primary PM (only flex PM available)';
                    }
                }

                if (!slotMap[squad]) slotMap[squad] = {};
                slotMap[squad][bucketKey] = {
                    score,
                    state,
                    availableSlots: Math.floor(availableSlots * 10) / 10,
                    bottleneck,
                    constraintWarning,
                    capacity: {
                        pm: { primary: pmPrimaryRemaining, secondary: pmSecondaryCapacity, total: pmTotalRemaining, rawCap: pmCapacity, rawDem: pmDemand },
                        sc: { primary: scPrimaryRemaining, secondary: scSecondaryCapacity, total: scTotalRemaining, rawCap: scCapacity, rawDem: scDemand },
                        build: { primary: buildPrimaryRemaining, secondary: buildSecondaryCapacity, total: buildTotalRemaining, rawCap: buildCapacity, rawDem: buildDemand }
                    },
                    _debug: {
                        pmPri: roleResources.pm.primary.length,
                        pmSec: roleResources.pm.secondary.length,
                        scPri: roleResources.sc.primary.length,
                        scSec: roleResources.sc.secondary.length,
                        bdPri: roleResources.build.primary.length,
                        bdSec: roleResources.build.secondary.length
                    }
                };
            });
        });

        // Pass 2: Rolling Window Availability (Sustainable Slots) & Slot IDs
        const sortedKeys = bucketKeys.sort((a, b) => dataMap.get(a).rawDate - dataMap.get(b).rawDate);
        const durationWeeks = slotProfile.durationWeeks || 20;

        Object.keys(slotMap).forEach(squad => {
            // Slot ID Helpers
            const squadCode = (squad && squad.length >= 2) ? squad.substring(0, 2).toUpperCase() : 'SQ';
            const fyCounters = {};

            sortedKeys.forEach((key, index) => {
                const squadData = slotMap[squad][key];
                if (!squadData) return;

                let minSlots = squadData.availableSlots;
                let limitingKey = null;

                // Look ahead for sustainable capacity
                for (let i = 1; i < durationWeeks; i++) {
                    if (index + i >= sortedKeys.length) break;
                    const nextKey = sortedKeys[index + i];
                    const nextData = slotMap[squad][nextKey];
                    if (nextData) {
                        if (nextData.availableSlots < minSlots) {
                            minSlots = nextData.availableSlots;
                            limitingKey = nextKey;
                        }
                    }
                }

                squadData.availableSlots = minSlots;
                squadData.sustainableScore = Math.min(1, minSlots);

                let sustainableState = 'FULL';
                if (minSlots >= 0.8) sustainableState = 'OPEN';
                else if (minSlots >= 0.4) sustainableState = 'PARTIAL';

                squadData.state = sustainableState;
                squadData.score = squadData.sustainableScore;
                squadData.limitingFactor = limitingKey ? `Limited by capacity in ${dataMap.get(limitingKey).label}` : null;

                // Generate Slot IDs
                const fullSlots = Math.floor(minSlots);
                const slotIds = [];

                if (fullSlots > 0) {
                    const d = new Date(dataMap.get(key).rawDate);
                    let fyYear = d.getFullYear();
                    const m = d.getMonth();
                    if (m >= 4) fyYear += 1;

                    const fyKey = `FY${fyYear.toString().slice(-2)}`;
                    if (!fyCounters[fyKey]) fyCounters[fyKey] = 1;

                    for (let s = 0; s < fullSlots; s++) {
                        const seq = fyCounters[fyKey]++;
                        slotIds.push(`${squadCode}${fyKey}${seq}`);
                    }
                }
                squadData.slotIds = slotIds;
            });
        });
    }

    const dateScaffold = Array.from(dataMap.values()).sort((a, b) => a.rawDate - b.rawDate).map(d => ({
        dateKey: d.label,
        isoKey: d.key,
        rawDate: d.rawDate,
        unassignedMap: d.unassignedMap
    }));

    // Calculate todayKey by finding the bucket that contains today
    let calculatedTodayKey = null;
    const todayBucketInfo = getBucketInfo(new Date(todayTime), config.granularity, minDate, sprintStartDateStr);
    // Find matching bucket in scaffold - use label for display, key for matching
    const todayBucket = dateScaffold.find(d => d.isoKey === todayBucketInfo.key);
    if (todayBucket) {
        calculatedTodayKey = todayBucket.dateKey; // Use dateKey (label) for chart XAxis matching
    }

    // Calculate performance metrics
    const _perfEnd = performance.now();
    const _perfDuration = _perfEnd - _perfStart;
    const _perfMetrics = {
        duration: _perfDuration,
        recordCount: projList.length,
        resourceCount: resList.length,
        bucketCount: dataMap.size
    };

    // Custom status priority order for chart stacking (bottom to top in chart)
    // Lower index = rendered first (at bottom of stack)
    const STATUS_PRIORITY = [
        'contracted',
        'on hold',
        'onboarding',
        'in flight',
        'in hypercare',
        'pipeline - commit',
        'pipeline - best'
    ];

    // Sort statuses by priority (custom order), unknown statuses go to the end
    const sortedStatuses = Array.from(rawStatusSet).sort((a, b) => {
        const aLower = (a || '').toLowerCase().trim();
        const bLower = (b || '').toLowerCase().trim();
        const aIdx = STATUS_PRIORITY.indexOf(aLower);
        const bIdx = STATUS_PRIORITY.indexOf(bLower);
        // If both are in priority list, sort by priority
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        // If only one is in priority list, it comes first
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        // Both unknown, sort alphabetically
        return aLower.localeCompare(bLower);
    });

    self.postMessage({
        uniqueStatuses: sortedStatuses,
        allResources: Object.values(resourceMap),
        allProjects: Object.values(projectMap),
        virtualBAUProjects, // Virtual BAU projects for compact grid
        dateScaffold,
        todayKey: calculatedTodayKey,
        activeProjectsCount: activeProjectsSet.size,
        revRecTotals,
        revRecByProject,
        slotMap,
        _perfMetrics
    });
};
