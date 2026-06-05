import { useState, useEffect, useRef, useMemo } from 'react';
import { workerCode } from '../worker/workerCode_v4';
import { trackWorkerCycle } from '../utils/PerformanceMonitor';

/**
 * Custom hook to handle high-performance capacity calculations using a Web Worker.
 * 
 * @param {Object} params Configuration and data parameters
 * @returns {Object} Processed data and states
 */
export const useCapacityData = ({
    resList,
    projList,
    config,
    timeRange,
    customStartDate,
    customEndDate,
    fiscalYearMode,
    modelParams,
    rampProfiles,
    winRates,
    sprintStartDate,

    // Filtering params
    enabledSquads = [],        // For filtering RESOURCES (capacity)
    projectSquadFilter = [],   // For filtering PROJECTS (demand) - separate from resource filter
    resourceSearch,
    selectedCategory,
    sortBy,
    roleMapping,
    roleConfig = { jobs: {}, constraints: {} },  // Primary/secondary roles for slot detection
    forecastMode,
    selectedEntities = [], // V1 Parity: Entity filter
    initiatives = [],      // Team Efficiency Initiatives
    showInitiativesEffect = false, // Toggle for applying initiatives
    slotProfile = null,    // Slot Optimization: Standard project profile
    demandCategory = 'all', // BAU Feature: 'all' | 'implementation' | 'bau'
    platformFilter = []    // Platform Filter: [] = all; else resources by squadPlatforms, projects by p.platform
}) => {
    // State
    const [workerResult, setWorkerResult] = useState({
        processedData: [],
        uniqueStatuses: [],
        groupedResourceData: {},
        groupedProjectData: {},
        kpiTotals: { cap: 0, dem: 0, activeProjects: 0 },
        auditLog: [],
        todayKey: null,
        allResources: [],
        groupStats: {},
        dateScaffold: []
    });

    const [rawResult, setRawResult] = useState(null); // RAW WORKER OUTPUT
    const [isProcessing, setIsProcessing] = useState(false); // Track worker processing state
    const workerRef = useRef(null);

    // 1. Initialize Worker
    const workerUrlRef = useRef(null);

    useEffect(() => {
        // Decode base64 worker code at runtime (prevents bundler minification)
        const codeStr = atob(workerCode);
        const blob = new Blob([codeStr], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        workerUrlRef.current = blobUrl;
        workerRef.current = new Worker(blobUrl);

        workerRef.current.onmessage = (e) => {
            setRawResult(e.data); // Store Raw Data
            setIsProcessing(false); // Worker finished processing

            // Track performance metrics if available
            if (e.data._perfMetrics) {
                trackWorkerCycle(e.data._perfMetrics);
            }
        };

        workerRef.current.onerror = (err) => {
            console.error('[CapacityWorker] Uncaught error:', err?.message || err);
            setIsProcessing(false); // Unblock UI — keep last good result
        };

        return () => {
            workerRef.current.terminate();
            // Revoke blob URL to prevent memory leak
            if (workerUrlRef.current) {
                URL.revokeObjectURL(workerUrlRef.current);
            }
        };
    }, []);

    // 2. Post Config to Worker (Only when Data/TimeRange changes)
    // We use a ref to track the last payload string to prevent infinite loops
    // caused by unstable object references from upstream hooks (useRecords)
    const lastPayloadRef = useRef(null);

    useEffect(() => {
        if (!workerRef.current) return;

        // Guard against undefined input arrays
        if (!resList || !projList) return;

        // Helper to safely create date
        const safeDate = (val) => {
            if (!val) return null;
            try {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            } catch {
                return null;
            }
        };

        // Helper to normalize squads
        const normalizeSquads = (p) => {
            if (Array.isArray(p.squads)) return p.squads;
            if (typeof p.squad === 'string') return [p.squad];
            return ['Unassigned'];
        };

        const today = new Date();
        let minDate, maxDate;

        if (timeRange === 'Custom' && customStartDate && customEndDate) {
            minDate = safeDate(customStartDate);
            maxDate = safeDate(customEndDate);
            if (!minDate || !maxDate) {
                const currentYear = today.getFullYear();
                minDate = new Date(currentYear, 0, 1);
                maxDate = new Date(currentYear + 1, 0, 1);
            } else {
                maxDate.setHours(23, 59, 59, 999);
            }
        } else if (timeRange === '1y' || timeRange === '2y') {
            const currentYear = today.getFullYear();
            minDate = new Date(currentYear, 0, 1);
            maxDate = new Date(minDate);
            maxDate.setFullYear(maxDate.getFullYear() + (timeRange === '2y' ? 2 : 1));
        } else {
            let currentYear = today.getFullYear();
            if (fiscalYearMode && today.getMonth() < 4) currentYear--;
            const startMonth = fiscalYearMode ? 4 : 0;
            minDate = new Date(currentYear, startMonth, 1);
            maxDate = new Date(minDate);
            maxDate.setFullYear(maxDate.getFullYear() + 1);
        }

        // Filter by Entity (Origin) BEFORE sending to worker
        // This ensures Slot Mode (which uses worker data directly) respects the filter
        const safeSelectedEntities = Array.isArray(selectedEntities) ? selectedEntities : [];
        const safePlatformFilter = Array.isArray(platformFilter) ? platformFilter : [];

        const filteredProjList = (projList || []).filter(p => {
            if (safeSelectedEntities.length > 0 && !(p.origin && safeSelectedEntities.includes(p.origin))) return false;
            // Platform Filter: projects matched by their OWN Platform field.
            if (safePlatformFilter.length > 0 && !safePlatformFilter.includes(p.platform)) return false;
            return true;
        });

        const filteredResList = (resList || []).filter(r => {
            if (safeSelectedEntities.length > 0 && (!r.origin || !safeSelectedEntities.includes(r.origin))) return false;

            // Platform Filter: resources matched if any of their squads' platforms is selected.
            if (safePlatformFilter.length > 0 && !(Array.isArray(r.squadPlatforms) && r.squadPlatforms.some(pl => safePlatformFilter.includes(pl)))) return false;

            // BAU Feature: Filter resources by squad category BEFORE worker processing
            // This ensures capacity is only computed for matching squads
            // Use case-insensitive matching for flexibility with Airtable field values
            const squadCategoryLower = (r.squadCategory || 'implementation').toLowerCase();

            if (demandCategory === 'implementation') {
                if (squadCategoryLower !== 'implementation' && squadCategoryLower !== 'both') return false;
            } else if (demandCategory === 'bau') {
                if (squadCategoryLower !== 'bau' && squadCategoryLower !== 'both') return false;
            }
            // 'all' = no squad category filtering

            return true;
        });

        // Clean project list for worker (display fields not needed)
        const programDiscount = config.programDiscount || 15; // Default 15%
        const discountMultiplier = 1 - (programDiscount / 100);

        const efficiencyFactor = config.programEfficiencyFactor || 0; // Default 0%
        const efficiencyMultiplier = 1 - (efficiencyFactor / 100);

        const projListForWorker = filteredProjList.map(p => {
            // Calculate base effort values (convert from seconds to hours)
            let pmVal = (p.pmEffort || 0) / 3600;
            let scVal = (p.scEffort || 0) / 3600;
            let pdVal = (p.pdEffort || 0) / 3600;

            // Apply program discount if project is resourced within program
            const isResourcedWithinProgram = p.resourcedWithinProgram;
            if (isResourcedWithinProgram) {
                // 1. Efficiency Gain: Reduce total effort required (for both project and program)
                pmVal = pmVal * efficiencyMultiplier;
                scVal = scVal * efficiencyMultiplier;
                pdVal = pdVal * efficiencyMultiplier;

                // 2. Program Transfer: Move portion to program team (remove from project team)
                pmVal = pmVal * discountMultiplier;
                scVal = scVal * discountMultiplier;
                pdVal = pdVal * discountMultiplier;
            }

            return {
                id: p.id,
                name: p.name,
                start: p.kickOff || p.start, // Handle kickOff mapping
                end: p.launch || p.end,     // Handle launch mapping
                uatStart: p.uatStart,
                status: p.status,
                wave: p.wave,
                effortProfile: p.effortProfile,
                squads: normalizeSquads(p), // Helper to ensure array
                // Effort values (with program discount applied if applicable)
                pmVal,
                scVal,
                pdVal,
                // Store original values for UI display (before discount)
                pmValOriginal: (p.pmEffort || 0) / 3600,
                scValOriginal: (p.scEffort || 0) / 3600,
                pdValOriginal: (p.pdEffort || 0) / 3600,
                resourcedWithinProgram: isResourcedWithinProgram,
                pmAlloc: p.pmAlloc, // Pass allocations
                scAlloc: p.scAlloc,
                pdAlloc: p.pdAlloc,
                actuals: p.actuals,
                pctComplete: p.pctComplete,
                team: p.team, // Ensure team structure is passed if available

                // Pass through meta for details
                customer: p.customer,
                country: p.country,
                countryFlag: p.countryFlag,
                transactionalBenefits: p.transactionalBenefits,
                nonTransactionalBenefits: p.nonTransactionalBenefits,
                contentOnlyBenefits: p.contentOnlyBenefits,
                languages: p.languages,
                company: p.company, // Support for company fallback
                origin: p.origin, // V1 Parity: Entity filter
                projectType: p.projectType, // BAU Feature: Preserve project type through worker
                platform: p.platform, // Initiatives: needed for platform-scoped efficiency targeting
                bauTshirtSize: p.bauTshirtSize, // BAU Feature: T-shirt size for virtual demand calculation
                // Revenue Recognition (Financial Mode)
                revenueModel: p.revenueModel || 'Non-POC',
                implFee: p.implFee || 0,
                arr: p.arr || 0,
                resourcingOverride: p.resourcingOverride, // Pass override value
                // Portfolio Reprioritization fields
                customerRisk: p.customerRisk || null,
                compellingEventDate: p.compellingEventDate || null,
                // Resourcing Tracking (non-synced)
                resourcingNotes: p.resourcingNotes || '',
                resourced: p.resourced || false
            };
        });

        // Clean resource list - include ALL fields needed for UI display and grouping
        const resListForWorker = filteredResList.map(r => ({
            id: r.id,
            name: r.name,
            squads: r.squads || [r.squad || 'Unassigned'],  // Essential for grouping
            role: r.role || 'Unknown',  // Essential for subgrouping
            // workingHours from Airtable is in SECONDS - convert to hours (3600 sec/hr)
            // targetUtilization is already a decimal from Dashboard (e.g. 0.8 = 80%, 0.01 = 1%)
            effectiveHours: (() => {
                // workingHours from Airtable could be in seconds (144000) or hours (40)
                // If it's > 100, assume it's in seconds and convert
                let hoursPerWeek = 40; // default
                if (r.workingHours) {
                    hoursPerWeek = r.workingHours > 100 ? r.workingHours / 3600 : r.workingHours;
                }
                // Use nullish coalescing to preserve explicit 0% utilization
                const util = r.targetUtilization ?? 0.8;
                return hoursPerWeek * util;
            })(),
            workingHours: r.workingHours || 144000,  // Keep raw for modal display (which will convert)
            // Pass through targetUtilization as-is (already a decimal from Dashboard)
            targetUtilization: r.targetUtilization ?? 0.8,
            // Presence-Based Utilisation: per-resource weekly productivity %.
            // Defaults to existing TARGET_UTILIZATION (already decimal). Worker only reads
            // this in 'presence' mode; ignored in 'field' mode.
            weeklyProductivity: r.targetUtilization ?? ((config.modelParams?.presenceModel?.weeklyProductivityDefault ?? 80) / 100),
            annualUtilization: r.annualUtilization,
            annualCapacity: r.annualCapacity,
            startDate: r.startDate,
            leaveDate: r.leaveDate,
            leaveStartDate: r.leaveStartDate,
            leaveEndDate: r.leaveEndDate,
            leavePeriods: r.leavePeriods || [],
            rampProfile: r.rampProfile,
            rampStartDate: r.rampStartDate,
            headshot: r.headshot,  // For UI avatar
            country: r.country,
            countryFlag: r.countryFlag,
            adJobTitle: r.adJobTitle,  // For role mapping
            origin: r.origin, // V1 Parity: Entity filter
            squadCategory: r.squadCategory // BAU Feature: Preserve squad category through worker
        }));

        // Virtual Headcount Injection: Add synthetic resources from active initiatives
        if (showInitiativesEffect && initiatives && initiatives.length > 0) {
            const activeInitiatives = initiatives.filter(init => init.enabled && init.status === 'active');

            activeInitiatives.forEach(init => {
                if (!init.headcountPlan || init.headcountPlan.length === 0) return;

                init.headcountPlan.forEach(hc => {
                    // Create virtual resources for this headcount entry
                    for (let i = 0; i < hc.count; i++) {
                        const virtualId = `virtual_${init.id}_${hc.id}_${i}`;
                        const roleLabel = (hc.role || 'pm').toUpperCase();

                        resListForWorker.push({
                            id: virtualId,
                            name: `${init.name} (${roleLabel} ${i + 1})`,
                            squads: hc.squad ? [hc.squad] : ['Unassigned'],
                            role: roleLabel,
                            effectiveHours: (hc.weeklyHours || 40) * 0.8, // Default 80% utilization
                            workingHours: (hc.weeklyHours || 40) * 3600, // Convert to seconds
                            targetUtilization: 0.8,
                            startDate: hc.startDate,
                            leaveDate: null,
                            leaveStartDate: null,
                            leaveEndDate: null,
                            leavePeriods: [],
                            // Named ramp profile from Settings → Ramp Profiles. If unset, no
                            // ramp is applied and virtual hires run at full capacity from
                            // their startDate. Legacy `rampWeeks` on the entry is ignored —
                            // the worker keys off `rampProfile` name only.
                            rampProfile: hc.rampProfile || null,
                            rampStartDate: hc.startDate,
                            headshot: null,
                            country: null,
                            countryFlag: null,
                            adJobTitle: roleLabel,
                            origin: null,
                            isVirtual: true, // Flag for UI styling
                            initiativeId: init.id,
                            initiativeName: init.name
                        });
                    }
                });
            });
        }

        const payload = {
            resList: resListForWorker,
            projList: projListForWorker,
            config,
            minDateStr: minDate.toISOString(),
            maxDateStr: maxDate.toISOString(),
            sprintStartDateStr: sprintStartDate,
            modelParams,
            rampProfiles,
            winRates,
            fyStartMonth: config.fyStartMonth ?? 4, // Financial Year start month (0-indexed, default May)
            initiatives: showInitiativesEffect ? initiatives : [], // Only pass initiatives when effect is enabled
            slotProfile, // Slot Optimization: Pass standard project profile
            roleConfig, // Role Configuration: Primary/secondary roles for slot detection
            roleMapping, // Job title to role mapping (PM/SC/PD/Other)
            roleCapabilities: roleConfig?.jobs || {}, // Secondary role capabilities from roleConfig
            programAssignments: config.programAssignments || [], // Program Resourcing: Resource assignments
            programWorkstreamsWithHours: config.programWorkstreamsWithHours || [], // Program workstreams with computed hours
            programProjectContributions: config.programProjectContributions || [], // Per-project contributions with date ranges
            programStartDate: config.programStartDate || null,
            programEndDate: config.programEndDate || null,
            programBudgets: config.programBudgets || {},
            // BAU Feature: Pass demand category, hours mapping, and project types for live site demand
            demandCategory,
            bauHoursMapping: config.bauHoursMapping || null,
            bauProjectTypes: config.bauProjectTypes || ['Change Project'] // Use settings-configured types
        };

        // Detect duplicates using a lightweight composite hash instead of JSON.stringify
        // JSON.stringify on the full payload (~100KB+) blocks the main thread for 50-100ms per cycle.
        // This composite key captures all meaningful change vectors in O(n) time.
        try {
            const hashParts = [
                resListForWorker.length,
                projListForWorker.length,
                minDate.getTime(),
                maxDate.getTime(),
                sprintStartDate || '',
                JSON.stringify(modelParams),
                demandCategory,
                JSON.stringify(winRates),
                // Fingerprint initiative CONTENT (not just count) so editing an initiative's
                // efficiency / target teams / platform / project-type re-runs the worker.
                showInitiativesEffect ? JSON.stringify(initiatives || []) : 0,
                slotProfile ? JSON.stringify(slotProfile) : '',
                JSON.stringify(roleMapping || {}),
                config.programAssignments?.length || 0,
                config.programWorkstreamsWithHours?.length || 0,
                config.programStartDate || '',
                config.programEndDate || '',
                config.fyStartMonth ?? 4,
                // Content fingerprint: aggregate IDs, statuses, and key numeric values
                // This catches individual record edits (name change, status change, effort change)
                projListForWorker.reduce((h, p) => h + (p.id || '') + ',' + (p.status || '') + ',' + (p.start || '') + ',' + (p.end || '') + ',' + (p.pmVal || 0) + ',' + (p.scVal || 0) + ',' + (p.pdVal || 0) + ',' + (p.resourcingOverride || 0) + ';', ''),
                resListForWorker.reduce((h, r) => h + (r.id || '') + ',' + (r.effectiveHours || 0) + ',' + (r.squads?.join(',') || '') + ',' + (r.targetUtilization ?? '') + ',' + (r.weeklyProductivity ?? '') + ',' + (r.startDate || '') + ',' + (r.leaveDate || '') + ',' + ((r.leavePeriods || []).map(p => p.start + '|' + p.end).join('~')) + ',' + (r.rampProfile || '') + ',' + (r.rampStartDate || '') + ';', ''),
                // Role config fingerprint
                JSON.stringify(roleConfig?.jobs || {}),
                config.bauHoursMapping ? JSON.stringify(config.bauHoursMapping) : '',
                JSON.stringify(config.bauProjectTypes || []),
                // Entity filter fingerprint: ensures hash changes when entity selection changes
                safeSelectedEntities.join(','),
                safePlatformFilter.join(','), // Platform filter changes must re-run the worker
                // Capacity utilisation model fingerprint — toggling Field/Presence or the productivity default re-runs the worker.
                config.capacityUtilizationModel || 'field',
                config.modelParams?.presenceModel?.weeklyProductivityDefault ?? 80,
                // IMPORTANT: every input included in `payload` above must also be
                // fingerprinted here, or an edit re-fires the effect, computes an
                // identical hash, hits the early return, and the worker is never
                // re-posted (the change silently has no effect). These were missing:
                JSON.stringify(rampProfiles || {}),                          // named ramp profile edits
                JSON.stringify(config.programBudgets || {}),                 // program budget edits
                JSON.stringify(config.programProjectContributions || [])     // per-project contribution edits
            ];
            const currentHash = hashParts.join('|');

            if (lastPayloadRef.current === currentHash) {
                return;
            }
            lastPayloadRef.current = currentHash;

            setIsProcessing(true); // Worker starting to process
            workerRef.current.postMessage(payload);
        } catch (err) {
            console.error("Worker PostMessage Error:", err);
        }
    }, [resList, projList, timeRange, fiscalYearMode, customStartDate, customEndDate, config, sprintStartDate, modelParams, rampProfiles, winRates, initiatives, showInitiativesEffect, slotProfile, roleMapping, roleConfig, demandCategory, selectedEntities, platformFilter]);

    // 3. Client-Side Filtering & Aggregation
    const result = useMemo(() => {
        if (!rawResult) return { filteredResources: [], filteredProjects: [], processedData: [], kpiTotals: { cap: 0, dem: 0, activeProjects: 0 }, uniqueStatuses: [], todayKey: null };

        // Guard against undefined properties from rawResult
        const allResources = rawResult.allResources || [];
        const allProjects = rawResult.allProjects || [];
        const dateScaffold = rawResult.dateScaffold || [];
        const uniqueStatuses = rawResult.uniqueStatuses || [];
        // SAFETY: Ensure filter arrays are always arrays
        const safeEnabledSquads = Array.isArray(enabledSquads) ? enabledSquads : [];
        const safeProjectSquadFilter = Array.isArray(projectSquadFilter) ? projectSquadFilter : [];
        const safeSelectedEntities = Array.isArray(selectedEntities) ? selectedEntities : [];

        // A. FILTER RESOURCES
        const fRes = (allResources || []).filter(r => {
            if (!r) return false;
            const rSquads = Array.isArray(r.squads) ? r.squads : (r.squads ? [r.squads] : []);

            // Resources without a squad should NOT show in grid
            if (rSquads.length === 0) return false;

            // Resources whose only squad is 'Unassigned' should NOT show (they have no real squad)
            const hasRealSquad = rSquads.some(s => s && s !== 'Unassigned');
            if (!hasRealSquad) return false;

            // Squad filter
            if (safeEnabledSquads.length > 0 && !rSquads.some(s => safeEnabledSquads.includes(s))) return false;

            // Handle squad from hook params (Dashboard logic might pass specific strings)
            if (resourceSearch && !r.name.toLowerCase().includes(resourceSearch.toLowerCase())) return false;

            // Role Mapping Logic - use adJobTitle if available, fallback to role
            const roleKey = r.adJobTitle || r.role || '';
            const roleUpper = roleKey.toUpperCase();
            const myCategory = (roleKey && roleMapping && roleMapping[roleKey]) ? roleMapping[roleKey] : (['PM', 'SC', 'PD'].includes(roleUpper) ? roleUpper : 'Other');

            if (selectedCategory && selectedCategory !== 'All' && myCategory !== selectedCategory) return false;

            // EXCLUDE 'OTHER' FROM CALCULATIONS as per user request
            if (myCategory === 'Other' || myCategory === 'OTHER') return false;

            // V1 Parity: Entity filter - filter by origin field
            // This is the authoritative display filter; pre-worker filter is a perf optimization
            if (safeSelectedEntities.length > 0 && (!r.origin || !safeSelectedEntities.includes(r.origin))) return false;

            // BAU Feature: Filter by squad category (case-insensitive)
            const squadCategoryLower = (r.squadCategory || 'implementation').toLowerCase();
            if (demandCategory === 'implementation') {
                // Only show squads that are Implementation or Both
                if (squadCategoryLower !== 'implementation' && squadCategoryLower !== 'both') return false;
            } else if (demandCategory === 'bau') {
                // Only show squads that are BAU or Both
                if (squadCategoryLower !== 'bau' && squadCategoryLower !== 'both') return false;
            }
            // 'all' = no squad category filtering

            return true;
        });

        // SORTING LOGIC
        fRes.sort((a, b) => {
            if (sortBy === 'name') {
                const squadA = (a.squads && a.squads[0]) || '';
                const squadB = (b.squads && b.squads[0]) || '';
                if (squadA !== squadB) return squadA.localeCompare(squadB);
                return a.name.localeCompare(b.name);
            }
            const getMetric = (r) => {
                const cap = r.totals ? r.totals.cap : 0;
                let dem = 0;
                if (r.totals) {
                    if (forecastMode === 'eac') dem = r.totals.dem_eac;
                    else if (forecastMode === 'impact') dem = r.totals.dem_imp;
                    else dem = r.totals.dem;
                }
                if (cap === 0) return dem > 0 ? 999 : 0;
                return dem / cap;
            };
            const utilA = getMetric(a);
            const utilB = getMetric(b);

            if (sortBy === 'overload') {
                const isOverA = utilA > 1 ? 1 : 0;
                const isOverB = utilB > 1 ? 1 : 0;
                if (isOverA !== isOverB) return isOverB - isOverA;
                return utilB - utilA;
            }
            if (sortBy === 'availability_desc') return utilA - utilB;
            if (sortBy === 'availability_asc') return utilB - utilA;
            return 0;
        });

        // B. FILTER PROJECTS
        // Uses separate projectSquadFilter - allows filtering resources differently from projects
        // When project squad filter is active: only show that squad's projects
        // Special "__none__" filter shows projects WITHOUT a squad assigned
        // When NO project squad filter: show ALL projects including unassigned
        const excludedStatuses = ['closed', 'cancelled', 'canceled']; // 'on hold' allowed in list

        // Check if "__none__" filter is active (show unassigned projects)
        const showUnassigned = safeProjectSquadFilter.includes('__none__');
        // Get actual squad filters (exclude the special "__none__" value)
        const actualSquadFilters = safeProjectSquadFilter.filter(s => s !== '__none__');



        const fProj = allProjects.filter(p => {
            // Squad filter logic - uses projectSquadFilter, NOT enabledSquads
            if (safeProjectSquadFilter.length > 0) {
                const rawSquads = p.squads || (p.squad ? [p.squad] : []);
                const pSquads = Array.isArray(rawSquads) ? rawSquads : [rawSquads];
                const isUnassigned = pSquads.length === 0 || pSquads.every(s => !s || s === 'Unassigned');

                // If showing unassigned and this project is unassigned, include it
                if (showUnassigned && isUnassigned) return true;

                // If we have actual squad filters, check if project matches any of them
                if (actualSquadFilters.length > 0) {
                    if (!pSquads.some(s => actualSquadFilters.includes(s))) return false;
                } else if (!showUnassigned) {
                    // No actual squad filters and not showing unassigned = show nothing
                    return false;
                } else {
                    // Only "__none__" is selected, and this project has a squad = exclude it
                    if (!isUnassigned) return false;
                }
            }
            // When no squad filter: ALL projects pass (including unassigned)

            if (resourceSearch && !p.name.toLowerCase().includes(resourceSearch.toLowerCase())) return false;
            if (p.status && excludedStatuses.some(s => p.status.toLowerCase().includes(s))) return false;

            // V1 Parity: Entity filter - filter by origin field
            if (safeSelectedEntities.length > 0 && (!p.origin || !safeSelectedEntities.includes(p.origin))) return false;

            // BAU Feature: Filter by project type (configurable in Settings)
            // bauProjectTypes defaults to ['Change Project'] if not configured
            const bauProjectTypes = config?.bauProjectTypes || ['Change Project'];
            const projectType = p.projectType || 'Implementation';



            if (demandCategory === 'implementation') {
                // Only show Implementation projects (exclude BAU types) - use partial matching
                const isBauType = bauProjectTypes.some(t => projectType.toLowerCase().includes(t.toLowerCase()));
                if (isBauType) return false;
            } else if (demandCategory === 'bau') {
                // Show:
                // 1. Projects whose type partially matches any bauProjectTypes (Renewals/CRs)
                // 2. Implementation projects with bauTshirtSize set (virtual BAU projects)
                const isVirtualBAU = projectType === 'Implementation' && p.bauTshirtSize;
                const isBauType = bauProjectTypes.some(t => projectType.toLowerCase().includes(t.toLowerCase()));
                if (!isVirtualBAU && !isBauType) return false;
            }
            // 'all' = no project type filtering

            return true;
        });

        // C. AGGREGATE TIMELINE
        let totalCap = 0, totalDem = 0;

        const processedData = dateScaffold.map(d => {
            const row = { ...d, capacity: 0, capacityBuffer: 0, unassignedStat: { val: 0, projects: [] }, details: [] };
            uniqueStatuses.forEach(s => { row[s] = 0; row[`baseline_${s}`] = 0; });

            // Sum Resources
            fRes.forEach(r => {
                const b = r.buckets[d.isoKey];
                if (b) {
                    row.capacity += b.cap;
                    totalCap += b.cap;
                }
            });

            // Sum Projects (Demand)
            // Note: worker returns unassignedMap natively for projects, we can use that for direct stacking
            // OR use the resource bucket logic if resources are assigned.

            // For Global Stacked Chart, we use the pre-calculated unassignedMap from the worker
            // But we must filter it based on our Project Filters

            if (d.unassignedMap) {
                let uVal = 0;
                const uProjs = [];

                // ROLE FILTER: When a specific role is selected (e.g. SC), only show
                // that role's slice of demand on the chart to match capacity filtering.
                const activeRoleFilter = selectedCategory && selectedCategory !== 'All' ? selectedCategory.toUpperCase() : null;

                Object.values(d.unassignedMap).forEach(pItem => {
                    // Check if this project is in our filtered list
                    // Note: Unassigned items should generally show if they match other filters (status, text)
                    // even if they don't match the squad filter (since they have no squad)
                    // But here we rely on fProj which implements that logic (unassigned always included unless filtered by other means)
                    // BAU FEATURE: Virtual BAU projects have synthetic IDs (bau-xxx) that won't match real projects
                    // They should always be visible in BAU mode
                    const isBauItem = pItem.id && String(pItem.id).startsWith('bau-');
                    const isVisible = isBauItem || fProj.some(fp => fp.id === pItem.id);

                    // GRAPH VISIBILITY RULE: Exclude 'On Hold' from graph even if they are in the list
                    const isOnHold = pItem.status && pItem.status.toLowerCase().includes('on hold');

                    if (isVisible && !isOnHold) {
                        // Role filter: if a specific role is active, use only that role's
                        // roleBreakdown slice for demand. Fall back to full totalNeeded if no breakdown exists.
                        let totalNeeded, assigned;
                        if (activeRoleFilter && pItem.roleBreakdown && pItem.roleBreakdown[activeRoleFilter]) {
                            const rb = pItem.roleBreakdown[activeRoleFilter];
                            totalNeeded = forecastMode === 'eac' ? (rb.needed_eac || rb.needed || 0) : (rb.needed || 0);
                            assigned = forecastMode === 'eac' ? (rb.assigned_eac || rb.assigned || 0) : (rb.assigned || 0);
                        } else if (activeRoleFilter && pItem.roleBreakdown && !pItem.roleBreakdown[activeRoleFilter]) {
                            // This project has no demand for the selected role — skip it entirely
                            return;
                        } else {
                            totalNeeded = forecastMode === 'eac' ? (pItem.totalNeeded_eac || 0) : (pItem.totalNeeded || 0);
                            assigned = forecastMode === 'eac' ? (pItem.assigned_eac || 0) : (pItem.assigned || 0);
                        }

                        let val = totalNeeded;

                        if (forecastMode === 'eac' && !activeRoleFilter) {
                            // Populate baseline for comparison (dashed lines) — only in full (non-role-filtered) mode
                            row[`baseline_${pItem.status}`] = (row[`baseline_${pItem.status}`] || 0) + (pItem.totalNeeded || 0);
                        } else if (forecastMode === 'impact') {
                            // Derive impact from EAC - Plan
                            let totalPlan, totalEac;
                            if (activeRoleFilter && pItem.roleBreakdown?.[activeRoleFilter]) {
                                const rb = pItem.roleBreakdown[activeRoleFilter];
                                totalPlan = rb.needed || 0;
                                totalEac = rb.needed_eac || rb.needed || 0;
                            } else {
                                totalPlan = pItem.totalNeeded || 0;
                                totalEac = pItem.totalNeeded_eac || 0;
                            }
                            val = totalEac - totalPlan;
                        }

                        // Add to main totals if configured to do so (Stacking)
                        row[pItem.status] = (row[pItem.status] || 0) + val;
                        row.details.push(pItem);
                        totalDem += val;

                        // Add to Unassigned Stat (GAP only)
                        let gap = Math.max(0, totalNeeded - assigned);

                        if (forecastMode === 'impact') {
                            let gapPlan, gapEac;
                            if (activeRoleFilter && pItem.roleBreakdown?.[activeRoleFilter]) {
                                const rb = pItem.roleBreakdown[activeRoleFilter];
                                gapPlan = Math.max(0, (rb.needed || 0) - (rb.assigned || 0));
                                gapEac = Math.max(0, (rb.needed_eac || rb.needed || 0) - (rb.assigned_eac || rb.assigned || 0));
                            } else {
                                gapPlan = Math.max(0, (pItem.totalNeeded || 0) - (pItem.assigned || 0));
                                gapEac = Math.max(0, (pItem.totalNeeded_eac || 0) - (pItem.assigned_eac || 0));
                            }
                            gap = gapEac - gapPlan;
                        }

                        if (Math.abs(gap) > 0.1) {
                            uVal += gap;
                            uProjs.push({ ...pItem, hours: gap });
                        }
                    }
                });

                // Assign calculated unassigned stats to the row!
                row.unassignedStat = { val: uVal, projects: uProjs };
            }

            // Calculate capacity buffer line (capacity + buffer%)
            const bufferPercent = modelParams?.capacityBuffer ?? 10;
            row.capacityBuffer = row.capacity * (1 + bufferPercent / 100);

            return row;
        });

        return {
            filteredResources: fRes,
            filteredProjects: fProj,
            processedData,
            kpiTotals: {
                cap: totalCap,
                dem: totalDem,
                activeProjects: fProj.length
            },
            uniqueStatuses,
            todayKey: rawResult.todayKey,
            revRecTotals: rawResult.revRecTotals || { implFee: { toDate: 0, fullYear: 0 }, arr: { toDate: 0, fullYear: 0 }, total: { toDate: 0, fullYear: 0 } },
            revRecByProject: rawResult.revRecByProject || [],
            slotMap: rawResult.slotMap || {}, // Slot Optimization: Available slots per squad/week
            virtualBAUProjects: rawResult.virtualBAUProjects || [] // Virtual BAU projects for compact grid
        };

    }, [rawResult, enabledSquads, projectSquadFilter, resourceSearch, selectedCategory, sortBy, roleMapping, roleConfig, forecastMode, selectedEntities, demandCategory]);

    return {
        ...result,
        isLoading: !rawResult || isProcessing,
        _perfMetrics: rawResult?._perfMetrics || null
    };
};
