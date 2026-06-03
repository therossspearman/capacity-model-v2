/**
 * OptimizationModal - Interactive slot optimization with selectable recommendations
 * Enhanced with: KO/Launch dates, duration indicator, click-to-detail, GitHub summary, flags, reasoning toggle
 */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRecords } from '@airtable/blocks/interface/ui';
import { useTheme } from '../../design-system';
import { generateRecommendations, getSlotUtilizationSummary, generateBulkAllocationPlan } from '../../utils/SlotOptimizer';
import { generatePeopleAssignments } from '../../utils/PeopleOptimizer';
import { runBulkAllocationAsync, terminateWorker } from '../../worker/BulkAllocationWorker';
import { createOptimizationRun, hasOptimizationRunsTable } from '../../services/OptimizationRunService';
import { runMonteCarloSimulation } from '../../utils/MonteCarloSimulator';
import { runMonteCarloAsync, terminateMonteCarloWorker } from '../../worker/MonteCarloWorker';
import { STRATEGY_PRESETS, sortProjectsByStrategy } from '../../utils/ParetoOptimizer';
import { SETTINGS } from '../../constants';
import { Button } from '../ui';
import ProgramDetailModal from './ProgramDetailModal';
import { AllocationsTab, ReprioritizationTab, CountryFlag, formatDate, weeksDiff, AI_TARGETS, PRESET_PARAMS } from '../optimization';
// ResourcingTab removed — resourcing is now inline within ReprioritizationTab

export const OptimizationModal = ({
    isOpen,
    onClose,
    slotMap,
    resources = [], // Default to empty array
    projects,
    unresourcedProjects = [],  // For bulk allocation mode
    slotProfile,
    slotOptimization,
    enabledSquads,
    onCreateDraft,
    onApplyLive,  // NEW: Callback for applying directly to Airtable
    onProjectClick,
    initialMode = 'optimize',  // 'optimize' or 'bulk'
    base,  // Airtable base for AI Field Agent integration
    aiIntelligence,  // AI settings: { enabled, tableId }
    settings, // Custom properties for field mapping
    activeSquads, // Pass active squads from parent if needed
    roleMapping, // Role mapping for resource categorisation
    onOpenProgramModal, // Callback to open Programs Management Modal
    // Program data props for rendering ProgramDetailModal inside this stacking context
    groupedProgramData,
    programResources,
    programRows,
    programsTable,
    programRecords,
    programStoredSettings,
    onProgramProjectClick,
    scenariosTable,
    scenarioRecords,
    scenarios
}) => {
    const { isDark, colors } = useTheme();
    const [mode, setMode] = useState(initialMode);  // 'optimize', 'bulk', 'allocations', 'ai_optimiser', 'reprioritize'
    const [internalProgram, setInternalProgram] = useState(null); // Program modal rendered inside this stacking context

    // Squad Scope Filtering
    const [scopeSquads, setScopeSquads] = useState(new Set(enabledSquads || []));

    // Sync scope with enabledSquads (initial load or parent change)
    useEffect(() => {
        if (enabledSquads && enabledSquads.length > 0) {
            setScopeSquads(new Set(enabledSquads));
        }
    }, [enabledSquads]);

    // Tear down the bulk-allocation and Monte Carlo Web Workers (and their Blob URLs)
    // when the modal unmounts — they were spun up lazily but never terminated, leaking
    // worker threads for the lifetime of the iframe.
    useEffect(() => () => {
        try { terminateWorker(); } catch { /* no-op */ }
        try { terminateMonteCarloWorker(); } catch { /* no-op */ }
    }, []);

    // Reprioritization action handlers (save/load) passed up from ReprioritizationTab
    const [repriActions, setRepriActions] = useState(null);

    // Derived scoped slot map - Only include squads in scope
    const scopedSlotMap = useMemo(() => {
        if (!slotMap) return {};
        const scoped = {};
        if (scopeSquads.size === 0) return slotMap; // Fallback to all if none selected (or maybe empty?)

        scopeSquads.forEach(squad => {
            if (slotMap[squad]) scoped[squad] = slotMap[squad];
        });
        return scoped;
    }, [slotMap, scopeSquads]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isCreating, setIsCreating] = useState(false);
    const [expandedReasoning, setExpandedReasoning] = useState(new Set());
    // Track last clicked ID for shift-select range
    const [lastClickedId, setLastClickedId] = useState(null);

    // Apply to Live confirmation state
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Scenario-Native AI state
    const [selectedAITarget, setSelectedAITarget] = useState(null);
    const [showAIPanel, setShowAIPanel] = useState(false);

    // AI Field Agent Insights panel state
    const [showAIInsights, setShowAIInsights] = useState(false);

    // Bulk Mode Progress State
    const [bulkProgress, setBulkProgress] = useState(0);
    const [bulkStatusMessage, setBulkStatusMessage] = useState('');

    // Bulk allocation state
    const [bulkSelectedIds, setBulkSelectedIds] = useState(new Set());
    const [selectedBulkStrategy, setSelectedBulkStrategy] = useState('balanced');
    const [reserveSlotsPerMonth, setReserveSlotsPerMonth] = useState(0);

    // Per-run Optimization Parameters (migrated from Settings)
    const [runParams, setRunParams] = useState({
        priorityDial: 50,
        maxCompression: 4,
        maxExpansion: 8,
        capacityBuffer: 0,
        allowSquadMoves: true,
        allowResourceSwaps: false,
        suggestResources: false, // Opt-in toggle for resource suggestions
        reserveEnabled: false,
        reservePerMonth: 2,
        reserveStartOffset: 0,
        reserveProtectedMonths: 3
    });

    // Initialize runParams from stored settings when they load
    useEffect(() => {
        if (settings?.slotOptimization) {
            setRunParams(prev => ({ ...prev, ...settings.slotOptimization }));
        }
    }, [settings?.slotOptimization]);
    const [allowCrossSquad, setAllowCrossSquad] = useState(true);
    const [allowOverstaff, setAllowOverstaff] = useState(false);
    // NEW: Text to opt-in for global unallocated projects when scoped to a squad
    const [includeGlobalBacklog, setIncludeGlobalBacklog] = useState(false);
    // Performance: Search filter
    const [bulkSearchQuery, setBulkSearchQuery] = useState('');
    // Performance: Only compute bulk plan when explicitly requested
    const [bulkPlan, setBulkPlan] = useState(null);
    const [isComputingPlan, setIsComputingPlan] = useState(false);
    // Scenario Comparison State
    const [scenarioA, setScenarioA] = useState(null);
    const [scenarioB, setScenarioB] = useState(null);
    const [comparisonMode, setComparisonMode] = useState(false);
    // Comparison Helpers
    const saveScenario = (slot) => {
        const scenarioData = {
            id: slot,
            plan: capacityReliefPlan,
            monteCarlo: monteCarloResult,
            params: { ...runParams },
            strategy: selectedStrategy,
            timestamp: new Date()
        };
        if (slot === 'A') setScenarioA(scenarioData);
        if (slot === 'B') setScenarioB(scenarioData);
    };

    // Date range filter state
    const today = new Date();
    const defaultStartDate = today.toISOString().split('T')[0];
    const defaultEndDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [dateRangeStart, setDateRangeStart] = useState(defaultStartDate);
    const [dateRangeEnd, setDateRangeEnd] = useState(defaultEndDate);

    // Capacity Relief modal state (Total Optimization)
    const [showCapacityReliefModal, setShowCapacityReliefModal] = useState(false);
    const [capacityReliefPlan, setCapacityReliefPlan] = useState(null);
    const [isComputingRelief, setIsComputingRelief] = useState(false);
    const [reliefProgress, setReliefProgress] = useState(0);

    // AI Insights state (from Airtable AI field agent for Capacity Relief)
    const [reliefAiInsights, setReliefAiInsights] = useState(null);
    const [reliefAiRiskLevel, setReliefAiRiskLevel] = useState(null);
    const [reliefAiNextActions, setReliefAiNextActions] = useState(null);
    const [reliefAiConfidence, setReliefAiConfidence] = useState(null);
    const [reliefAiImpactSummary, setReliefAiImpactSummary] = useState(null);

    // Key metrics state (from Airtable fields)
    const [reliefArrAffected, setReliefArrAffected] = useState(null);
    const [reliefAvgDelay, setReliefAvgDelay] = useState(null);
    const [reliefBottleneck, setReliefBottleneck] = useState(null);

    const [reliefAiLoading, setReliefAiLoading] = useState(false);
    const [reliefAiError, setReliefAiError] = useState(null);
    const [reliefStatusMessage, setReliefStatusMessage] = useState('Initializing...');

    // Monte Carlo robustness state
    // Monte Carlo robustness state
    const [monteCarloResult, setMonteCarloResult] = useState(null);

    // Track current Optimization Run ID for async AI updates
    const [currentRunId, setCurrentRunId] = useState(null);

    // Polling counter to force re-evaluation of AI records every few seconds
    const [aiPollTick, setAiPollTick] = useState(0);

    // Pareto strategy state
    const [selectedStrategy, setSelectedStrategy] = useState('balanced');

    // AI Field Agent: Real-time recommendations from Airtable AI fields
    const aiTable = useMemo(() => {
        if (!base) return null;

        // Priority 1: Custom Properties (Interface Designer) - may be a Table object
        const mappedTableSetting = settings?.[SETTINGS.OPTIMIZATION_RUNS_TABLE];
        if (mappedTableSetting) {
            const tableId = typeof mappedTableSetting === 'object' && mappedTableSetting.id
                ? mappedTableSetting.id
                : mappedTableSetting;
            const t = base.getTableByIdIfExists(tableId);
            if (t) return t;
        }

        // Priority 2: Global Config (aiIntelligence from Settings Modal)
        if (aiIntelligence?.tableId) {
            const t = base.getTableByIdIfExists(aiIntelligence.tableId);
            if (t) return t;
        }

        // Priority 3: Name fallback
        return base.getTableIfExists('Optimization Runs');
    }, [base, aiIntelligence?.tableId, settings]);



    // Real-time watch of AI recommendations (auto-updates when Airtable AI processes)
    // NOTE: Do NOT pass sorts option - the SDK throws "reduce is not a function" when the field doesn't exist.
    // Sort client-side in the useMemo below instead.
    const aiRecords = useRecords(aiTable);

    // Parse AI recommendations from records
    const aiInsights = useMemo(() => {
        if (!aiRecords?.length) return { latestAnalysis: null, recommendations: [] };

        // Sort client-side by Run Date (descending) - SDK sorting removed due to "reduce is not a function" errors
        const sortedRecords = [...aiRecords].sort((a, b) => {
            try {
                const dateA = a.getCellValue('Run Date');
                const dateB = b.getCellValue('Run Date');
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return new Date(dateB) - new Date(dateA);
            } catch {
                return 0; // Field doesn't exist, maintain original order
            }
        });

        // Get the most recent records with AI analysis
        const recentRecords = sortedRecords.slice(0, 5);
        let latestAnalysis = null;
        const allRecommendations = [];

        recentRecords.forEach(record => {
            try {
                const analysis = record.getCellValueAsString('AI Analysis');
                const recs = record.getCellValueAsString('AI Recommendations');
                const snapshotTime = record.getCellValueAsString('Snapshot Time');

                if (analysis && !latestAnalysis) {
                    latestAnalysis = {
                        recordId: record.id,
                        snapshotTime,
                        text: analysis
                    };
                }

                if (recs) {
                    allRecommendations.push({
                        recordId: record.id,
                        snapshotTime,
                        text: recs
                    });
                }
            } catch (e) {
                // Field not found, skip
            }
        });

        return { latestAnalysis, recommendations: allRecommendations };
    }, [aiRecords]);

    // Effect: Poll for AI updates every 3 seconds while loading
    useEffect(() => {
        if (!reliefAiLoading || !currentRunId) return;

        const pollInterval = setInterval(() => {
            setAiPollTick(t => t + 1);
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [reliefAiLoading, currentRunId]);

    // Effect: Watch for AI result updates for the current run (triggered by poll tick)
    useEffect(() => {
        if (!currentRunId || !aiRecords || !reliefAiLoading) return;

        const runRecord = aiRecords.find(r => r.id === currentRunId);
        if (runRecord) {

            // Helper to try multiple field names/IDs
            const tryGetField = (record, ...attempts) => {
                for (const fieldNameOrId of attempts) {
                    if (!fieldNameOrId) continue;
                    try {
                        const val = record.getCellValueAsString(fieldNameOrId);
                        if (val) return val;
                    } catch (e) {
                        // Field doesn't exist with this name/ID
                    }
                }
                return null;
            };

            // Helper to extract field ID from Settings value (could be Field object or string)
            const getFieldId = (settingValue) => {
                if (!settingValue) return null;
                // If it's a Field object, get its id; otherwise use as-is
                return typeof settingValue === 'object' && settingValue.id
                    ? settingValue.id
                    : settingValue;
            };

            // Get field IDs from aiIntelligence config first, then settings (as Field objects), then fallback names
            const analysis = tryGetField(runRecord,
                aiIntelligence?.aiInsightsFieldId,
                getFieldId(settings?.[SETTINGS.OPT_AI_INSIGHTS]),
                'AI Insights', 'AI Analysis', 'AI Summary', 'Analysis'
            );

            const risk = tryGetField(runRecord,
                getFieldId(settings?.[SETTINGS.OPT_RISK_LEVEL]),
                'Risk Level', 'Risk'
            );

            const next = tryGetField(runRecord,
                getFieldId(settings?.[SETTINGS.OPT_NEXT_ACTIONS]),
                'Next Actions', 'Recommended Actions', 'Actions'
            );

            const confidence = tryGetField(runRecord,
                getFieldId(settings?.[SETTINGS.OPT_AI_CONFIDENCE]),
                'AI Confidence', 'Confidence'
            );

            const impact = tryGetField(runRecord,
                getFieldId(settings?.[SETTINGS.OPT_IMPACT_SUMMARY]),
                'Impact Summary', 'Summary'
            );

            // Read key metrics
            let arrAffected = null;
            try { arrAffected = runRecord.getCellValue(settings?.[SETTINGS.OPT_TOTAL_ARR_AFFECTED] || 'Total ARR Affected'); } catch (e) { }

            let avgDelay = null;
            try { avgDelay = runRecord.getCellValue(settings?.[SETTINGS.OPT_AVG_DELAY_WEEKS] || 'Avg Delay Weeks'); } catch (e) { }

            let bottleneck = null;
            try { bottleneck = runRecord.getCellValueAsString(settings?.[SETTINGS.OPT_BOTTLENECK_ROLE] || 'Bottleneck Role'); } catch (e) { }


            // Update metrics state (these can be set even if AI fields aren't ready)
            if (arrAffected !== null) setReliefArrAffected(arrAffected);
            if (avgDelay !== null) setReliefAvgDelay(avgDelay);
            if (bottleneck) setReliefBottleneck(bottleneck);

            // If we have data, update state and stop loading
            if (analysis || risk || next || confidence || impact) {
                setReliefAiInsights(analysis);
                setReliefAiRiskLevel(risk);
                setReliefAiNextActions(next);
                setReliefAiConfidence(confidence);
                setReliefAiImpactSummary(impact);
                setReliefAiLoading(false);
                setCurrentRunId(null); // Stop watching this ID
            }
        }
    }, [aiRecords, currentRunId, reliefAiLoading, settings, aiPollTick]);

    // Effect: Simulate AI "Thinking" statuses during async wait (Technical Context)
    useEffect(() => {
        if (!currentRunId || !reliefAiLoading) return;

        const thinkingSteps = [
            'Analyzing resource availability & hard constraints...',
            'Running Monte Carlo robustness simulations...',
            'Evaluating Pareto optimal trade-offs (Delay vs. Revenue)...',
            'Resolving cross-squad dependencies...',
            'Synthesizing strategic AI recommendations...',
            'Finalizing optimization plan...'
        ];

        let stepIndex = 0;
        const interval = setInterval(() => {
            stepIndex = (stepIndex + 1) % thinkingSteps.length;
            setReliefStatusMessage(thinkingSteps[stepIndex]);
        }, 2200);

        return () => clearInterval(interval);
    }, [currentRunId, reliefAiLoading]);

    // Safety Timeout: If loading takes too long (>45s), stop spinning
    useEffect(() => {
        if (!reliefAiLoading) return;

        const timeout = setTimeout(() => {
            console.warn('[CapacityRelief] AI generation timed out');
            setReliefAiLoading(false);
            if (!reliefAiInsights) {
                setReliefAiError('AI generation timed out. Please check "Optimization Runs" table.');
            }
        }, 45000);

        return () => clearTimeout(timeout);
    }, [reliefAiLoading, reliefAiInsights]);

    // Generate recommendations with enhanced settings
    const recommendations = useMemo(() => {
        if (!scopedSlotMap || !projects?.length || !slotProfile) return [];

        return generateRecommendations(scopedSlotMap, projects, {
            priorityDial: runParams.priorityDial ?? 50,
            reserveEnabled: runParams.reserveEnabled ?? false,
            reservePerMonth: runParams.reservePerMonth ?? 1,
            maxCompression: runParams.maxCompression ?? 4,
            maxExpansion: runParams.maxExpansion ?? 8,
            capacityBuffer: runParams.capacityBuffer ?? 0,
            allowSquadMoves: runParams.allowSquadMoves ?? true,
            slotProfile
        });
        // Depend on scopedSlotMap (what the body actually reads), not the raw slotMap —
        // otherwise changing the squad scope did not recompute recommendations.
    }, [scopedSlotMap, projects, slotProfile, runParams]);

    // Enrich recommendations with project data for dates
    const enrichedRecs = useMemo(() => {
        return recommendations.map(rec => {
            const project = projects?.find(p => p.id === rec.projectId);
            return {
                ...rec,
                project,
                currentKickOff: project?.kickOff || project?.start,
                currentLaunch: project?.launch || project?.end,
                customer: project?.customer,
                country: project?.country,
                countryFlag: project?.countryFlag
            };
        });
    }, [recommendations, projects]);

    // Apply date range filter and exclude projects already started
    const filteredRecs = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        return enrichedRecs.filter(rec => {
            // Exclude projects that have already started (kickOff/start date in the past)
            const startDate = rec.currentKickOff ? new Date(rec.currentKickOff) : null;
            if (startDate && startDate < today) return false;

            // Apply date range filter
            const weekDate = new Date(rec.suggestedWeek || rec.currentWeek);
            if (isNaN(weekDate.getTime())) return true; // Keep if no valid date
            if (dateRangeStart && weekDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && weekDate > new Date(dateRangeEnd)) return false;
            return true;
        });
    }, [enrichedRecs, dateRangeStart, dateRangeEnd]);

    // Get utilization summary
    const summary = useMemo(() =>
        getSlotUtilizationSummary(slotMap, enabledSquads),
        [slotMap, enabledSquads]
    );

    // Filter unresourced projects by search query
    const filteredUnresourcedProjects = useMemo(() => {
        let projects = unresourcedProjects;

        // Squad Scope Logic:
        // If we are scoped to specific squads (e.g. "Squad A"), we by default ONLY show backlog items 
        // explicitly tagged for that squad.
        // Projects with NO squad (Global Backlog) are excluded unless `includeGlobalBacklog` is checked.
        if (scopeSquads.size > 0 && !includeGlobalBacklog) {
            projects = projects.filter(p => p.squad && scopeSquads.has(p.squad));
        }

        if (!bulkSearchQuery.trim()) return projects;
        const q = bulkSearchQuery.toLowerCase();
        return projects.filter(p =>
            p.name?.toLowerCase().includes(q) ||
            p.customer?.toLowerCase().includes(q) ||
            p.country?.toLowerCase().includes(q)
        );
    }, [unresourcedProjects, bulkSearchQuery, scopeSquads, includeGlobalBacklog]);

    // Compute bulk plan on demand using Web Worker (non-blocking)
    const computeBulkPlan = async () => {
        if (bulkSelectedIds.size === 0) {
            setBulkPlan(null);
            return;
        }
        setIsComputingPlan(true);
        setBulkProgress(0);
        setBulkStatusMessage('Analyzing selection...');

        try {
            // Apply Pareto Strategy: Sort projects based on selected strategy weights
            setBulkProgress(20);
            setBulkStatusMessage(`Applying ${STRATEGY_PRESETS[selectedBulkStrategy]?.name || 'Strategy'} logic...`);
            await new Promise(r => setTimeout(r, 400)); // Visual delay

            let selectedProjects = unresourcedProjects.filter(p => bulkSelectedIds.has(p.id));
            if (selectedBulkStrategy !== 'balanced') {
                selectedProjects = sortProjectsByStrategy(selectedProjects, selectedBulkStrategy);
            }

            // Configure based on strategy
            setBulkProgress(40);
            setBulkStatusMessage('Configuring optimization engine...');
            const strategyDelayMap = {
                'onTimeDelivery': 4,
                'minDelay': 4,
                'balanced': 8,
                'arrFocused': 8,
                'utilizationMax': 12,
                'volumeMax': 12
            };
            const maxDelay = strategyDelayMap[selectedBulkStrategy] || runParams.maxExpansion || 8;

            const config = {
                reservedSlotsPerMonth: reserveSlotsPerMonth,
                maxDelayWeeks: maxDelay,
                allowCrossSquad,
                allowOverstaff,
                bufferPercent: runParams.capacityBuffer || 20,
                programConcurrency: settings?.slotOptimization?.programConcurrency || 2,
                slotProfile
            };

            setBulkProgress(60);
            setBulkStatusMessage('Allocating slots (Worker)...');

            // Try Web Worker first, fallback to sync if it fails
            let plan;
            try {
                plan = await runBulkAllocationAsync(scopedSlotMap, selectedProjects, config);
            } catch (workerError) {
                console.warn('[OptimizationModal] Worker failed, falling back to sync:', workerError);
                plan = generateBulkAllocationPlan(scopedSlotMap, selectedProjects, config);
            }

            setBulkProgress(90);
            setBulkStatusMessage('Finalizing plan...');
            await new Promise(r => setTimeout(r, 300)); // Visual delay before showing results

            setBulkPlan(plan);
            setBulkProgress(100);

            // Run Monte Carlo robustness simulation for bulk mode
            let mcResultLocal = null;
            try {
                const mcResult = runMonteCarloSimulation({
                    slotMap: scopedSlotMap,
                    allocations: plan?.allocations || [],
                    config: { slotProfile },
                    uncertainty: { simulations: 50, leaveRate: 0.05, scopeCreep: 0.10, capacityVariance: 0.15 }
                });
                mcResultLocal = mcResult;
                setMonteCarloResult(mcResult);
            } catch (err) {
                console.warn('[BulkAllocate] Monte Carlo failed:', err);
            }

            // Get AI insights for bulk mode
            if (base && hasOptimizationRunsTable(base, settings)) {
                setReliefAiLoading(true);
                try {
                    const totalArr = selectedProjects.reduce((sum, p) => sum + (p.arr || 0), 0);
                    const aiResult = await createOptimizationRun(base, {
                        runType: 'Bulk Allocate',
                        projectsInput: selectedProjects.length,
                        projectsPlaced: plan?.stats?.placed || 0,
                        projectsUnplaceable: plan?.stats?.unplaceable || 0,
                        avgDelayWeeks: 0,
                        totalArrAffected: totalArr,
                        bottleneckRole: 'None',
                        // Monte Carlo metrics
                        assignedCount: plan?.stats?.placed || 0,
                        shiftedCount: 0, // Bulk allocate doesn't shift existing
                        robustnessScore: mcResultLocal?.robustnessScore ?? null,
                        p10: mcResultLocal?.confidence?.p10 ?? null,
                        p50: mcResultLocal?.confidence?.p50 ?? null,
                        p90: mcResultLocal?.confidence?.p90 ?? null,
                        metricsJson: {
                            ...(plan?.stats || {}),
                            strategy: selectedBulkStrategy,
                            config: config,
                            monteCarlo: mcResultLocal || null
                        }
                    }, { ...settings, aiIntelligence });

                    if (aiResult.hasAiData) {
                        setReliefAiInsights(aiResult.aiInsights);
                        setReliefAiRiskLevel(aiResult.riskLevel);
                        setReliefAiNextActions(aiResult.nextActions);
                        setReliefAiLoading(false);
                    } else if (aiResult.runId) {
                        // Async mode: wait for useEffect to pick up changes
                        setCurrentRunId(aiResult.runId);
                        // Do NOT set loading to false yet
                    } else {
                        setReliefAiLoading(false);
                    }
                } catch (err) {
                    console.warn('[BulkAllocate] AI failed:', err);
                    setReliefAiLoading(false);
                }
                // Finally block removed to allow async loading state to persist for AI
            }
        } catch (error) {
            console.error('[OptimizationModal] Bulk plan computation failed:', error);
            setBulkPlan(null);
        } finally {
            setIsComputingPlan(false);
        }
    };

    // Toggle bulk project selection with Shift+Click support
    const toggleBulkSelection = (id, e) => {
        // Handle Range Selection (Shift+Click)
        if (e && e.shiftKey && lastClickedId) {
            const allIds = filteredUnresourcedProjects.map(p => p.id);
            const startIndex = allIds.indexOf(lastClickedId);
            const endIndex = allIds.indexOf(id);

            if (startIndex !== -1 && endIndex !== -1) {
                const start = Math.min(startIndex, endIndex);
                const end = Math.max(startIndex, endIndex);
                const rangeIds = allIds.slice(start, end + 1);

                setBulkSelectedIds(prev => {
                    const next = new Set(prev);
                    // If the item we clicked is already selected, we might be deseleting? 
                    // Standard behavior: Select the range (additive).
                    rangeIds.forEach(rangeId => next.add(rangeId));
                    return next;
                });
                setLastClickedId(id); // Update last clicked
                return;
            }
        }

        // Standard Toggle
        setLastClickedId(id);
        setBulkSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllBulk = () => {
        if (bulkSelectedIds.size === unresourcedProjects.length) {
            setBulkSelectedIds(new Set());
        } else {
            setBulkSelectedIds(new Set(unresourcedProjects.map(p => p.id)));
        }
    };

    // Create draft from bulk allocation
    const handleBulkCreateDraft = async () => {
        if (!bulkPlan?.allocations?.length) return;
        setIsCreating(true);
        try {
            // Convert allocations to the format onCreateDraft expects
            const changes = bulkPlan.allocations.map(a => ({
                projectId: a.projectId,
                projectName: a.projectName,
                suggestedSquad: a.suggestedSquad,
                suggestedWeek: a.suggestedKO,
                currentWeek: null, // Must be null for bulk allocation to set kickOff/launch correctly
                type: 'bulk_allocate'
            }));
            await onCreateDraft(changes);
            onClose();
        } finally {
            setIsCreating(false);
        }
    };

    // Toggle selection
    const toggleSelection = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Toggle reasoning expansion
    const toggleReasoning = (id, e) => {
        e.stopPropagation();
        setExpandedReasoning(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select/deselect all
    const toggleAll = () => {
        if (selectedIds.size === filteredRecs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecs.map((_, i) => i)));
        }
    };

    // Create draft from selected
    const handleCreateDraft = async () => {
        const selected = filteredRecs.filter((_, i) => selectedIds.has(i));
        if (selected.length === 0) return;

        setIsCreating(true);
        try {
            await onCreateDraft(selected);
            onClose();
        } finally {
            setIsCreating(false);
        }
    };

    // Apply recommendations directly to Airtable (no draft)
    const handleApplyLive = async () => {
        const selected = filteredRecs.filter((_, i) => selectedIds.has(i));
        if (selected.length === 0 || !onApplyLive) return;

        setIsApplying(true);
        try {
            await onApplyLive(selected);
            setShowApplyConfirm(false);
            onClose();
        } finally {
            setIsApplying(false);
        }
    };

    // Generate AI Scenario based on selected target preset
    const handleGenerateAIScenario = async (targetKey) => {
        const target = AI_TARGETS[targetKey];
        if (!target) return;

        // NEW: Staffing Mode Switch
        if (target.isStaffing) {
            setMode('staffing');
            setSelectedAITarget(targetKey);
            setShowAIPanel(false);
            return;
        }

        // Create mapping from AI Target keys to Strategy Presets
        const strategyMap = {
            'maxUtilization': 'utilizationMax',
            'minDelays': 'onTimeDelivery',
            'balanced': 'balanced',
            'capacityRelief': 'balanced' // Default to balanced for general relief
        };

        const strategyKey = strategyMap[targetKey] || 'balanced';
        setSelectedStrategy(strategyKey);

        // Apply preset params from the strategy if available
        // Note: The UI controls (tuning options) already update runParams directly.
        // If we want the BUTTON to force a strategy, we should update runParams here.
        // But the user might have just tuned them. 
        // Let's NOT overwrite runParams if the user is in 'ai_optimiser' mode (tuning manually).

        setShowCapacityReliefModal(true);
        setShowAIPanel(false);

        // Pass the strategy explicitly — relying on the setSelectedStrategy state
        // update to land before a setTimeout'd call was a stale-closure bug.
        handleCapacityRelief(strategyKey);
    };

    // Capacity Relief: Combined bulk allocation + schedule optimization
    // Accepts an optional strategy override so callers that have just called
    // setSelectedStrategy can pass the new value directly — React state updates do
    // not re-bind this closure, so reading selectedStrategy here would be stale.
    const handleCapacityRelief = async (strategyOverride) => {
        const activeStrategy = strategyOverride || selectedStrategy;
        setIsComputingRelief(true);
        setReliefProgress(0);
        setReliefStatusMessage('Identifying unallocated projects in range...');

        try {
            // Step 1: Get all unallocated projects in date range
            setReliefProgress(10);
            const unallocatedInRange = sortProjectsByStrategy(unresourcedProjects.filter(p => {
                const projectDate = new Date(p.kickOff || p.launch || p.start);
                if (isNaN(projectDate.getTime())) return true; // Include if no date
                const start = new Date(dateRangeStart);
                const end = new Date(dateRangeEnd);
                return projectDate >= start && projectDate <= end;
            }), activeStrategy);

            // Step 2: Run bulk allocation to assign squads (async worker to prevent UI freeze)
            setReliefProgress(30);
            setReliefStatusMessage('Running bulk allocation algorithm (Worker)...');
            // generateBulkAllocationPlan / runBulkAllocationAsync take (slotMap, projects, config).
            // Build a config with the exact keys the engine reads — slotProfile lives inside config.
            const reliefConfig = {
                reservedSlotsPerMonth: runParams.reservePerMonth || 0,
                maxDelayWeeks: runParams.maxExpansion || 8,
                allowCrossSquad: runParams.allowSquadMoves,
                allowOverstaff: runParams.capacityBuffer > 0, // Simplified map
                bufferPercent: runParams.capacityBuffer || 20,
                slotProfile
            };
            let bulkAllocations;
            try {
                bulkAllocations = await runBulkAllocationAsync(scopedSlotMap, unallocatedInRange, reliefConfig);
            } catch (workerErr) {
                console.warn('[CapacityRelief] Worker failed, falling back to sync:', workerErr);
                bulkAllocations = generateBulkAllocationPlan(scopedSlotMap, unallocatedInRange, reliefConfig);
            }

            // Artificial delay to let user see the completion of bulk allocation
            await new Promise(r => setTimeout(r, 800));

            // Step 3: Get existing projects that might need to shift
            setReliefProgress(50);
            const existingProjectsInRange = projects.filter(p => {
                if (!p.squad) return false; // Skip unallocated
                const projectDate = new Date(p.kickOff || p.launch || p.start);
                if (isNaN(projectDate.getTime())) return false;
                const start = new Date(dateRangeStart);
                const end = new Date(dateRangeEnd);
                return projectDate >= start && projectDate <= end;
            });

            // Step 4: Get optimization recommendations for existing projects
            setReliefProgress(65);
            setReliefStatusMessage('Optimizing existing schedule shifts...');
            const optimizationRecs = enrichedRecs.filter(rec => {
                // Skip locked projects
                if (rec.project?.lockLaunch) return false;
                // Include all that could be shifted
                return rec.slotGain > 0 || (rec.suggestedWeek && rec.suggestedWeek !== rec.currentWeek);
            });

            // Allow UI to update
            await new Promise(r => setTimeout(r, 800));

            // Step 5: Combine into unified plan
            setReliefProgress(80);

            // Step 5.5: Run People Assignment (Only if toggle enabled)
            let peopleAssignments = [];
            if (runParams.suggestResources) {
                setReliefStatusMessage('Suggesting resource assignments...');
                const projectsForStaffing = [...unallocatedInRange, ...existingProjectsInRange];

                // Adjust project dates based on optimization before staffing
                const optimizedProjects = projectsForStaffing.map(p => {
                    const opt = optimizationRecs.find(r => r.projectId === p.id);
                    if (opt && opt.suggestedWeek) {
                        return { ...p };
                    }
                    return p;
                });

                peopleAssignments = generatePeopleAssignments(optimizedProjects, resources || [], {
                    matchSquad: true,
                    enableCrossSquad: runParams.allowSquadMoves,
                    priorityDial: runParams.priorityDial,
                    capacityBuffer: runParams.capacityBuffer
                });

            }

            setReliefProgress(90);
            const plan = {
                allocations: bulkAllocations?.allocations || [],
                optimizations: optimizationRecs,
                peopleAssignments: peopleAssignments, // Only populated if toggle enabled
                stats: {
                    unallocatedAssigned: bulkAllocations?.stats?.placed || 0,
                    unallocatedUnplaceable: bulkAllocations?.stats?.unplaceable || 0,
                    existingAssigned: existingProjectsInRange.length,
                    existingDelayed: optimizationRecs.length,
                    peopleAssigned: peopleAssignments.length,
                    totalProjects: unallocatedInRange.length + existingProjectsInRange.length,
                    dateRange: { start: dateRangeStart, end: dateRangeEnd }
                }
            };

            setCapacityReliefPlan(plan);
            setReliefProgress(85);
            setReliefStatusMessage('Running Monte Carlo confidence checks...');

            // Step 5.5: Run Monte Carlo robustness simulation (async worker)
            let mcResultLocal = null;
            try {
                const mcResult = await runMonteCarloAsync({
                    slotMap,
                    allocations: bulkAllocations?.allocations || [],
                    config: { slotProfile, ...runParams },
                    uncertainty: {
                        simulations: 500, // Increased for accuracy
                        leaveRate: 0.05,
                        scopeCreep: 0.10,
                        capacityVariance: 0.15
                    }
                });
                mcResultLocal = mcResult;
                setMonteCarloResult(mcResult);
            } catch (mcErr) {
                console.warn('[CapacityRelief] Monte Carlo failed:', mcErr);
            }

            // Brief pause before AI handoff
            await new Promise(r => setTimeout(r, 500));

            // Step 6: Get AI insights from Airtable AI field agent
            if (base && hasOptimizationRunsTable(base, settings)) {
                setReliefAiLoading(true);
                setReliefAiError(null);
                try {
                    // Calculate additional metrics for AI
                    const totalArr = [...unallocatedInRange, ...existingProjectsInRange]
                        .reduce((sum, p) => sum + (p.arr || 0), 0);
                    const avgDelay = optimizationRecs.length > 0
                        ? optimizationRecs.reduce((sum, r) => {
                            const shift = r.suggestedWeek && r.currentWeek
                                ? (new Date(r.suggestedWeek) - new Date(r.currentWeek)) / (7 * 24 * 60 * 60 * 1000)
                                : 0;
                            return sum + Math.max(0, shift);
                        }, 0) / optimizationRecs.length
                        : 0;

                    // Calculate bottleneck role from slot map (find most constrained)
                    let bottleneckCounts = {};
                    Object.values(scopedSlotMap || {}).forEach(squadSlots => {
                        Object.values(squadSlots || {}).forEach(bucket => {
                            if (bucket.bottleneck && bucket.score < 0.5) {
                                bottleneckCounts[bucket.bottleneck] = (bottleneckCounts[bucket.bottleneck] || 0) + 1;
                            }
                        });
                    });
                    const topBottleneck = Object.entries(bottleneckCounts)
                        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

                    // Count shifted projects (those with a date change recommendation)
                    const shiftedProjectCount = optimizationRecs.filter(r =>
                        r.suggestedWeek && r.currentWeek && r.suggestedWeek !== r.currentWeek
                    ).length;

                    const aiResult = await createOptimizationRun(base, {
                        runType: 'Capacity Relief',
                        dateRangeStart,
                        dateRangeEnd,
                        projectsInput: unallocatedInRange.length + existingProjectsInRange.length,
                        projectsPlaced: plan.stats.unallocatedAssigned,
                        projectsUnplaceable: plan.stats.unallocatedUnplaceable,
                        avgDelayWeeks: Math.round(avgDelay * 10) / 10,
                        totalArrAffected: totalArr,
                        bottleneckRole: topBottleneck,
                        // Monte Carlo metrics
                        assignedCount: plan.stats.unallocatedAssigned + plan.stats.existingAssigned,
                        shiftedCount: shiftedProjectCount,
                        robustnessScore: mcResultLocal?.robustnessScore ?? null,
                        p10: mcResultLocal?.confidence?.p10 ?? null,
                        p50: mcResultLocal?.confidence?.p50 ?? null,
                        p90: mcResultLocal?.confidence?.p90 ?? null,
                        metricsJson: {
                            ...plan.stats,
                            localSearchRescued: bulkAllocations?.stats?.localSearchRescued || 0,
                            crossSquadCount: bulkAllocations?.stats?.crossSquadCount || 0,
                            optimizationRecs: optimizationRecs.length,
                            monteCarlo: mcResultLocal || null,
                            bottleneckBreakdown: bottleneckCounts
                        }
                    }, { ...settings, aiIntelligence });

                    if (aiResult.hasAiData) {
                        setReliefAiInsights(aiResult.aiInsights);
                        setReliefAiRiskLevel(aiResult.riskLevel);
                        setReliefAiNextActions(aiResult.nextActions);
                        setReliefAiLoading(false);
                    } else if (aiResult.runId) {
                        setCurrentRunId(aiResult.runId);
                        setReliefStatusMessage('Consulting AI Field Agent (Async)...');
                        setReliefProgress(92);
                        // Do NOT set loading to false yet
                    } else if (aiResult.error) {
                        setReliefAiError('AI table exists but insights not available');
                        setReliefAiLoading(false);
                    } else {
                        setReliefAiLoading(false);
                    }
                } catch (aiErr) {
                    console.warn('[CapacityRelief] AI integration failed:', aiErr);
                    setReliefAiError('Could not fetch AI insights');
                    setReliefAiLoading(false);
                }
                // Finally block removed for AI loading state persistence
            }
        } catch (error) {
            console.error('[CapacityRelief] Failed:', error);
        } finally {
            setIsComputingRelief(false);
        }
    };

    // Create draft from Capacity Relief plan
    const handleCapacityReliefCreateDraft = async () => {
        if (!capacityReliefPlan || !onCreateDraft) return;

        setIsCreating(true);
        try {
            // Combine all recommendations
            const allRecs = [
                // Bulk allocations: convert to rec format
                ...capacityReliefPlan.allocations.map(a => ({
                    projectId: a.projectId,
                    projectName: a.projectName,
                    suggestedSquad: a.suggestedSquad,
                    currentSquad: null, // No current squad for new allocations
                    suggestedWeek: a.suggestedKO,
                    currentWeek: null, // Bulk allocation = no current week
                    type: 'bulk_allocate',
                    aiGenerated: true,
                    aiTarget: 'capacityRelief'
                })),
                // Optimization recs - ensure currentWeek is passed
                ...capacityReliefPlan.optimizations.map(rec => ({
                    projectId: rec.projectId,
                    projectName: rec.projectName,
                    suggestedSquad: rec.suggestedSquad,
                    currentSquad: rec.currentSquad,
                    suggestedWeek: rec.suggestedWeek,
                    currentWeek: rec.currentWeek,
                    currentKickOff: rec.currentKickOff,
                    slotGain: rec.slotGain,
                    type: rec.type || 'date',
                    aiGenerated: true,
                    aiTarget: 'capacityRelief'
                })),
                // People Assignment recs - staffing optimization
                ...(capacityReliefPlan.peopleAssignments || []).map(rec => ({
                    projectId: rec.projectId,
                    projectName: rec.projectName,
                    resourceId: rec.resourceId,
                    resourceName: rec.resourceName,
                    role: rec.role,
                    allocationPct: rec.allocationPct,
                    type: 'staffing', // New type for staffing assignments
                    aiGenerated: true,
                    aiTarget: 'capacityRelief'
                }))
            ];


            await onCreateDraft(allRecs);
            setShowCapacityReliefModal(false);
            setCapacityReliefPlan(null);
            onClose();
        } finally {
            setIsCreating(false);
        }
    };

    // Calculate totals from selected
    const totals = useMemo(() => {
        const selected = filteredRecs.filter((_, i) => selectedIds.has(i));
        const slotGain = selected.reduce((sum, rec) => sum + (rec.slotGain || 0), 0);

        // Calculate total schedule shift (positive = delayed, negative = pulled in)
        let totalWeeksShift = 0;
        selected.forEach(rec => {
            if (rec.type === 'date' && rec.currentKickOff && rec.suggestedWeek) {
                totalWeeksShift += weeksDiff(rec.currentKickOff, rec.suggestedWeek);
            }
        });

        // Calculate financial values
        const implFeeTotal = selected.reduce((sum, rec) => sum + (rec.project?.implFee || 0), 0);
        const arrTotal = selected.reduce((sum, rec) => sum + (rec.project?.arr || 0), 0);

        // Calculate ARR IMPACT based on shift:
        // Delays reduce revenue timing value, pull-ins increase it
        // Use ~0.5% ARR impact per week as simplified model
        const arrImpact = selected.reduce((sum, rec) => {
            if (rec.type === 'date' && rec.currentKickOff && rec.suggestedWeek) {
                const shift = weeksDiff(rec.currentKickOff, rec.suggestedWeek);
                const projectArr = rec.project?.arr || 0;
                // Negative shift = pulled in = positive impact
                // Positive shift = delayed = negative impact
                return sum - (shift * 0.005 * projectArr);
            }
            return sum;
        }, 0);

        return {
            slotGain,
            weeksSaved: totalWeeksShift,
            implFeeTotal,
            arrTotal,
            arrImpact,
            financialImpact: implFeeTotal + arrTotal,
            count: selected.length
        };
    }, [filteredRecs, selectedIds]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(8px)'
        }}>
            {/* iframe has no Tailwind JIT — define the 'spin' keyframe inline so
                spinners using animation:'spin ...' actually rotate. */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
                width: '98vw',
                height: '96vh',
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: `1px solid ${isDark ? '#334155' : 'transparent'}`
            }}>
                {/* Premium Header */}
                <div style={{
                    padding: '32px 32px 24px 32px',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    background: isDark ? '#1e293b' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '6px 12px', borderRadius: '20px',
                                backgroundColor: mode === 'optimize' ? '#f0fdf4' : (mode === 'bulk' ? '#F5EDE1' : (mode === 'reprioritize' ? '#fff5f0' : '#fffbeb')),
                                border: `1px solid ${mode === 'optimize' ? '#dcfce7' : (mode === 'bulk' ? '#E8E1D9' : (mode === 'reprioritize' ? '#fed7aa' : '#fcd34d'))}`,
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    backgroundColor: mode === 'optimize' ? '#00BD00' : (mode === 'bulk' ? '#082F24' : (mode === 'reprioritize' ? '#FF6B35' : '#FE9922')),
                                    boxShadow: `0 0 0 2px ${mode === 'optimize' ? 'rgba(34, 197, 94, 0.2)' : (mode === 'bulk' ? 'rgba(8, 47, 36, 0.2)' : (mode === 'reprioritize' ? 'rgba(255,107,53,0.2)' : 'rgba(245, 158, 11, 0.2)'))}`
                                }}></div>
                                <span style={{
                                    fontSize: '11px', fontWeight: '700',
                                    color: mode === 'optimize' ? '#166534' : (mode === 'bulk' ? '#082F24' : '#b45309'),
                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}>
                                    {mode === 'optimize' ? 'Optimization Engine' : (mode === 'bulk' ? 'Bulk Scheduling' : (mode === 'ai_optimiser' ? 'AI Strategic Advisor' : (mode === 'reprioritize' ? 'Portfolio Reprioritization' : 'Allocation Review')))}
                                </span>
                            </div>
                            <h2 style={{
                                margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800',
                                color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.02em', lineHeight: '1.1'
                            }}>
                                {mode === 'optimize' ? 'Slot Optimization' : (mode === 'bulk' ? 'Bulk Allocation Plan' : (mode === 'ai_optimiser' ? 'AI Optimization Engine' : (mode === 'reprioritize' ? 'Portfolio Reprioritization' : 'Resource Allocations')))}
                            </h2>
                            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.5', maxWidth: '500px' }}>
                                {mode === 'optimize'
                                    ? `${enrichedRecs.length} optimization opportunities found to improve utilization from ${Math.round(summary?.utilizationPct || 0)}%.`
                                    : (mode === 'bulk'
                                        ? `Auto-assign slots for ${unresourcedProjects.length} backlog projects based on capacity and constraints.`
                                        : (mode === 'ai_optimiser'
                                            ? 'Configure strategic parameters to generate an optimized capacity scenario.'
                                            : (mode === 'reprioritize'
                                                ? 'Score, reprioritize, and resource projects in one unified loop. Assign teams inline.'
                                                : 'Review and resolve resource bottlenecks across the portfolio.')
                                        )
                                    )
                                }
                            </p>
                        </div>

                        {/* Mode Toggle Tabs */}
                        <div style={{
                            display: 'flex', padding: '4px', borderRadius: '12px',
                            backgroundColor: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <button
                                onClick={() => setMode('optimize')}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: mode === 'optimize' ? (isDark ? '#00BD00' : '#00BD00') : 'transparent',
                                    color: mode === 'optimize' ? 'white' : (isDark ? '#94a3b8' : '#64748b')
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                Optimize
                            </button>
                            <button
                                onClick={() => setMode('bulk')}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: mode === 'bulk' ? (isDark ? '#FF8EFB' : '#FF8EFB') : 'transparent',
                                    color: mode === 'bulk' ? 'white' : (isDark ? '#94a3b8' : '#64748b')
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                                Allocate
                            </button>
                            <button
                                onClick={() => setMode('allocations')}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: mode === 'allocations' ? (isDark ? '#FE9922' : '#FE9922') : 'transparent',
                                    color: mode === 'allocations' ? 'white' : (isDark ? '#94a3b8' : '#64748b')
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                Allocations
                            </button>
                            <button
                                onClick={() => setMode('ai_optimiser')}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: mode === 'ai_optimiser' ? '#082F24' : 'transparent',
                                    color: mode === 'ai_optimiser' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                    marginLeft: '4px',
                                    boxShadow: mode === 'ai_optimiser' ? '0 2px 4px rgba(8, 47, 36, 0.3)' : 'none'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                    <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                                AI Optimiser
                            </button>
                            <button
                                onClick={() => setMode('reprioritize')}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: mode === 'reprioritize' ? '#FF6B35' : 'transparent',
                                    color: mode === 'reprioritize' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                    marginLeft: '4px',
                                    boxShadow: mode === 'reprioritize' ? '0 2px 4px rgba(255,107,53,0.3)' : 'none'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                    <polyline points="17 1 21 5 17 9" />
                                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                    <polyline points="7 23 3 19 7 15" />
                                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                                Reprioritize
                            </button>
                            {/* Resourcing tab removed — now inline within Reprioritize */}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                color: isDark ? '#94a3b8' : '#64748b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    {/* GitHub-style Summary Stats */}
                    {selectedIds.size > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            marginTop: '16px',
                            padding: '12px 16px',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? '#334155' : '#dcfce7'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#00BD00' }}>
                                    +{totals.slotGain}
                                </span>
                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    Slots Gained
                                </span>
                            </div>
                            <div style={{ width: '1px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: totals.weeksSaved >= 0 ? '#FE9922' : '#00BD00' }}>
                                    {totals.weeksSaved >= 0 ? '+' : ''}{totals.weeksSaved}w
                                </span>
                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    Schedule Shift
                                </span>
                            </div>
                            <div style={{ width: '1px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                            {/* Implementation Fee */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#FF8EFB' }}>
                                    +£{(totals.implFeeTotal / 1000).toFixed(0)}k
                                </span>
                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    Impl Fee
                                </span>
                            </div>
                            <div style={{ width: '1px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                            {/* ARR Impact */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: totals.arrImpact >= 0 ? '#00BD00' : '#dc2626' }}>
                                    {totals.arrImpact >= 0 ? '+' : ''}£{(totals.arrImpact / 1000).toFixed(0)}k
                                </span>
                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    ARR Impact
                                </span>
                            </div>
                        </div>
                    )}

                    {/* AI Optimiser Unified Interface */}
                    {mode === 'ai_optimiser' && (
                        <div style={{
                            marginTop: '20px',
                            padding: '24px',
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(8, 47, 36, 0.1) 0%, rgba(8, 47, 36, 0.4) 100%)'
                                : 'linear-gradient(135deg, #fff0fe 0%, #f0fdf4 100%)',
                            borderRadius: '16px',
                            border: `1px solid ${isDark ? '#082F24' : '#dcfce7'}`,
                            boxShadow: '0 10px 30px -5px rgba(8, 47, 36, 0.15)'
                        }}>
                            {/* Top: Tuning Options */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '16px',
                                marginBottom: '24px'
                            }}>
                                {/* Priority Dial */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', marginBottom: '6px' }}>
                                        Optimization Priority
                                    </label>
                                    <select
                                        value={runParams.priorityDial >= 75 ? 'schedule' : (runParams.priorityDial <= 25 ? 'utilization' : 'balanced')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setRunParams(prev => ({
                                                ...prev,
                                                priorityDial: val === 'schedule' ? 85 : (val === 'utilization' ? 15 : 50)
                                            }));
                                        }}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: '8px',
                                            border: '1px solid #082F24', backgroundColor: isDark ? '#1e1b4b' : 'white',
                                            color: isDark ? 'white' : '#082F24', fontSize: '12px'
                                        }}
                                    >
                                        <option value="balanced">Balanced Approach</option>
                                        <option value="schedule">Maximize On-Time</option>
                                        <option value="utilization">Maximize Utilization</option>
                                    </select>
                                </div>

                                {/* Compression */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', marginBottom: '6px' }}>
                                        Max Compression
                                    </label>
                                    <select
                                        value={runParams.maxCompression}
                                        onChange={(e) => setRunParams(prev => ({ ...prev, maxCompression: Number(e.target.value) }))}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: '8px',
                                            border: '1px solid #082F24', backgroundColor: isDark ? '#1e1b4b' : 'white',
                                            color: isDark ? 'white' : '#082F24', fontSize: '12px'
                                        }}
                                    >
                                        <option value={0}>None</option>
                                        <option value={2}>2 Weeks</option>
                                        <option value={4}>4 Weeks</option>
                                        <option value={8}>8 Weeks</option>
                                    </select>
                                </div>

                                {/* Expansion/Delay */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', marginBottom: '6px' }}>
                                        Max Delay
                                    </label>
                                    <select
                                        value={runParams.maxExpansion}
                                        onChange={(e) => setRunParams(prev => ({ ...prev, maxExpansion: Number(e.target.value) }))}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: '8px',
                                            border: '1px solid #082F24', backgroundColor: isDark ? '#1e1b4b' : 'white',
                                            color: isDark ? 'white' : '#082F24', fontSize: '12px'
                                        }}
                                    >
                                        <option value={2}>2 Weeks</option>
                                        <option value={4}>4 Weeks</option>
                                        <option value={8}>8 Weeks</option>
                                        <option value={12}>12 Weeks</option>
                                        <option value={26}>6 Months</option>
                                    </select>
                                </div>

                                {/* Buffer */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', marginBottom: '6px' }}>
                                        Capacity Buffer
                                    </label>
                                    <select
                                        value={runParams.capacityBuffer}
                                        onChange={(e) => setRunParams(prev => ({ ...prev, capacityBuffer: Number(e.target.value) }))}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: '8px',
                                            border: '1px solid #082F24', backgroundColor: isDark ? '#1e1b4b' : 'white',
                                            color: isDark ? 'white' : '#082F24', fontSize: '12px'
                                        }}
                                    >
                                        <option value={0}>0% (Max Efficiency)</option>
                                        <option value={10}>10% (Safe)</option>
                                        <option value={20}>20% (Conservative)</option>
                                    </select>
                                </div>

                                {/* Squad Moves */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', marginBottom: '6px' }}>
                                        Cross-Squad
                                    </label>
                                    <select
                                        value={runParams.allowSquadMoves ? 'yes' : 'no'}
                                        onChange={(e) => setRunParams(prev => ({ ...prev, allowSquadMoves: e.target.value === 'yes' }))}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: '8px',
                                            border: '1px solid #082F24', backgroundColor: isDark ? '#1e1b4b' : 'white',
                                            color: isDark ? 'white' : '#082F24', fontSize: '12px'
                                        }}
                                    >
                                        <option value="yes">Allowed</option>
                                        <option value="no">Restricted</option>
                                    </select>
                                </div>
                            </div>

                            {/* Date Range Selector */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '24px',
                                padding: '12px 16px',
                                backgroundColor: isDark ? 'rgba(8, 47, 36, 0.05)' : 'rgba(255, 255, 255, 0.5)',
                                borderRadius: '10px',
                                border: `1px solid ${isDark ? '#082F24' : '#dcfce7'}`
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', minWidth: '80px' }}>
                                    Date Range
                                </span>
                                <input
                                    type="date"
                                    value={dateRangeStart}
                                    onChange={(e) => setDateRangeStart(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        border: '1px solid #082F24',
                                        borderRadius: '8px',
                                        backgroundColor: isDark ? '#1e1b4b' : 'white',
                                        color: isDark ? 'white' : '#082F24'
                                    }}
                                />
                                <span style={{ color: isDark ? '#86efac' : '#082F24' }}>→</span>
                                <input
                                    type="date"
                                    value={dateRangeEnd}
                                    onChange={(e) => setDateRangeEnd(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        border: '1px solid #082F24',
                                        borderRadius: '8px',
                                        backgroundColor: isDark ? '#1e1b4b' : 'white',
                                        color: isDark ? 'white' : '#082F24'
                                    }}
                                />
                            </div>

                            {/* Natural Language Summary */}
                            <div style={{
                                padding: '16px',
                                backgroundColor: isDark ? 'rgba(8, 47, 36, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                                borderRadius: '12px',
                                border: '1px dashed #082F24',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px'
                            }}>
                                <div style={{
                                    fontSize: '24px',
                                    paddingTop: '2px'
                                }}>🪄</div>
                                <div>
                                    <h4 style={{
                                        margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700',
                                        color: isDark ? '#dcfce7' : '#061f18'
                                    }}>
                                        Projected Optimization Outcome
                                    </h4>
                                    <p style={{
                                        margin: 0, fontSize: '13px', lineHeight: '1.6',
                                        color: isDark ? '#bbf7d0' : '#061f18'
                                    }}>
                                        The AI will strategy will
                                        <strong> {runParams.priorityDial >= 75 ? ' prioritize meeting deadlines' : (runParams.priorityDial <= 25 ? ' aggressively pack slots to maximize utilization' : ' balance efficiency with schedule adherence')} </strong>.
                                        It has permission to shift projects by up to <strong>{runParams.maxExpansion} weeks</strong>
                                        {runParams.maxCompression > 0 ? ` and pull them forward by up to ${runParams.maxCompression} weeks` : ''}
                                        to find the best fit.
                                        {runParams.capacityBuffer > 0 ? ` A ${runParams.capacityBuffer}% capacity buffer will be preserved for resilience.` : ' Capacity will be used fully.'}
                                        {runParams.allowSquadMoves ? ' Work can be moved between compatible squads to resolve bottlenecks.' : ' Projects will remain in their assigned squads.'}
                                    </p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* Suggest Resources Toggle */}
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: isDark ? '#bbf7d0' : '#061f18'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={runParams.suggestResources}
                                        onChange={(e) => setRunParams(prev => ({ ...prev, suggestResources: e.target.checked }))}
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            accentColor: '#082F24',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <span style={{ fontWeight: '600' }}>Suggest Resource Assignments</span>
                                </label>
                                <button
                                    onClick={() => handleGenerateAIScenario('balanced')} // Defaults to balanced trigger but uses current runParams in logic
                                    style={{
                                        padding: '10px 24px',
                                        backgroundColor: '#082F24',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(8, 47, 36, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2v20M2 12h20" />
                                    </svg>
                                    Run Optimization Strategy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Settings Summary - Hide in AI Optimiser and Reprioritize modes */}
                    {mode !== 'ai_optimiser' && mode !== 'reprioritize' && (
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '12px',
                            flexWrap: 'wrap'
                        }}>
                            {[
                                { label: 'Priority', value: slotOptimization?.priorityDial >= 50 ? 'Stability' : 'Max Slots' },
                                { label: 'Compress', value: `≤${slotOptimization?.maxCompression || 4}w` },
                                { label: 'Delay', value: `≤${slotOptimization?.maxExpansion || 8}w` },
                                { label: 'Buffer', value: `${(slotOptimization?.capacityBuffer || 0) >= 0 ? '+' : ''}${slotOptimization?.capacityBuffer || 0}%` },
                                { label: 'Squad Moves', value: slotOptimization?.allowSquadMoves ? 'On' : 'Off' }
                            ].map(({ label, value }) => (
                                <span key={label} style={{
                                    padding: '4px 10px',
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    color: isDark ? '#94a3b8' : '#64748b'
                                }}>
                                    <strong>{label}:</strong> {value}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Date Range Filter */}
                    {mode === 'optimize' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginTop: '12px',
                            padding: '10px 14px',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
                            borderRadius: '10px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: isDark ? '#94a3b8' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Time Window:
                            </span>
                            <input
                                type="date"
                                value={dateRangeStart}
                                onChange={(e) => setDateRangeStart(e.target.value)}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '11px',
                                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                    borderRadius: '6px',
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    color: isDark ? '#f1f5f9' : '#1e293b',
                                    outline: 'none'
                                }}
                            />
                            <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>to</span>
                            <input
                                type="date"
                                value={dateRangeEnd}
                                onChange={(e) => setDateRangeEnd(e.target.value)}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '11px',
                                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                    borderRadius: '6px',
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    color: isDark ? '#f1f5f9' : '#1e293b',
                                    outline: 'none'
                                }}
                            />
                            {(dateRangeStart !== defaultStartDate || dateRangeEnd !== defaultEndDate) && (
                                <button
                                    onClick={() => {
                                        setDateRangeStart(defaultStartDate);
                                        setDateRangeEnd(defaultEndDate);
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '10px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: isDark ? '#475569' : '#e2e8f0',
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reset
                                </button>
                            )}
                            <span style={{
                                fontSize: '10px',
                                color: isDark ? '#64748b' : '#94a3b8',
                                marginLeft: 'auto'
                            }}>
                                {filteredRecs.length} of {enrichedRecs.length} recommendations
                            </span>
                        </div>
                    )}

                    {/* AI Insights Panel - Optimize Mode */}
                    {mode === 'optimize' && aiInsights.latestAnalysis && (
                        <div style={{
                            marginTop: '12px',
                            padding: '12px 14px',
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(71, 148, 255, 0.15) 0%, rgba(8, 47, 36, 0.1) 100%)'
                                : 'linear-gradient(135deg, rgba(71, 148, 255, 0.1) 0%, rgba(8, 47, 36, 0.05) 100%)',
                            borderRadius: '10px',
                            border: `1px solid ${isDark ? 'rgba(71, 148, 255, 0.3)' : 'rgba(71, 148, 255, 0.2)'}`
                        }}>
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: isDark ? '#60a5fa' : '#2563eb',
                                    marginBottom: showAIInsights ? '10px' : '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setShowAIInsights(!showAIInsights)}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                </svg>
                                AI Analysis
                                <svg
                                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    style={{ marginLeft: 'auto', transform: showAIInsights ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                >
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                                {aiInsights.latestAnalysis.snapshotTime && (
                                    <span style={{ fontWeight: '400', fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                        {aiInsights.latestAnalysis.snapshotTime}
                                    </span>
                                )}
                            </div>
                            {showAIInsights && (
                                <div style={{ fontSize: '11px', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.6' }}>
                                    {aiInsights.latestAnalysis.text}
                                    {aiInsights.recommendations.length > 0 && (
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${isDark ? 'rgba(71, 148, 255, 0.2)' : 'rgba(71, 148, 255, 0.15)'}` }}>
                                            <div style={{ fontWeight: '600', marginBottom: '6px', color: isDark ? '#93c5fd' : '#4794FF' }}>
                                                Recommendations:
                                            </div>
                                            {aiInsights.recommendations.slice(0, 3).map((rec, idx) => (
                                                <div key={idx} style={{ marginBottom: '4px', paddingLeft: '12px', borderLeft: `2px solid ${isDark ? '#4794FF' : '#93c5fd'}` }}>
                                                    {rec.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Content Area - Mode Conditional */}
                {mode === 'bulk' ? (
                    /* ==================== BULK ALLOCATION MODE ==================== */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', gap: '16px' }}>
                        {/* Left: Project Selection */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Controls */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                marginBottom: '16px',
                                padding: '12px',
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                borderRadius: '10px'
                            }}>
                                {/* Basic Options Row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                        <span>Reserve for Sales:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={reserveSlotsPerMonth}
                                            onChange={(e) => setReserveSlotsPerMonth(Number(e.target.value))}
                                            style={{ width: '50px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#f1f5f9' : '#1e293b' }}
                                        />
                                        <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>slots/month</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={allowCrossSquad} onChange={(e) => setAllowCrossSquad(e.target.checked)} style={{ accentColor: '#00BD00' }} />
                                        <span style={{ color: isDark ? '#e2e8f0' : '#334155' }}>Allow cross-squad</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={allowOverstaff} onChange={(e) => setAllowOverstaff(e.target.checked)} style={{ accentColor: '#00BD00' }} />
                                        <span style={{ color: isDark ? '#e2e8f0' : '#334155' }}>Allow overstaff</span>
                                    </label>
                                </div>

                                {/* Fine Tuning Section */}
                                <div style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>Fine Tuning</span>
                                        <div style={{ height: '1px', flex: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                                    </div>

                                    {/* Priority + Delay + Buffer Row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                                        {/* Priority Dial */}
                                        <div style={{ minWidth: '100px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280' }}>Priority</label>
                                                <span style={{ fontSize: '9px', fontWeight: '700', color: '#FF8EFB' }}>
                                                    {runParams.priorityDial <= 33 ? 'Max Slots' : runParams.priorityDial >= 67 ? 'Stability' : 'Balanced'}
                                                </span>
                                            </div>
                                            <input
                                                type="range" min="0" max="100" step="5"
                                                value={runParams.priorityDial}
                                                onChange={e => setRunParams(prev => ({ ...prev, priorityDial: Number(e.target.value) }))}
                                                style={{ width: '100%', accentColor: '#FF8EFB', height: '3px' }}
                                            />
                                        </div>

                                        {/* Max Delay */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Max Delay</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="number" min="0" max="24"
                                                    value={runParams.maxExpansion}
                                                    onChange={e => setRunParams(prev => ({ ...prev, maxExpansion: Number(e.target.value) }))}
                                                    style={{ width: '50px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: `1px solid ${isDark ? '#4b5563' : '#d1d5db'}`, backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#f1f5f9' : '#1e293b' }}
                                                />
                                                <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>wks</span>
                                            </div>
                                        </div>

                                        {/* Buffer */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Buffer</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="number" min="0" max="50"
                                                    value={runParams.capacityBuffer}
                                                    onChange={e => setRunParams(prev => ({ ...prev, capacityBuffer: Number(e.target.value) }))}
                                                    style={{ width: '50px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: `1px solid ${isDark ? '#4b5563' : '#d1d5db'}`, backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#f1f5f9' : '#1e293b' }}
                                                />
                                                <span style={{ fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8' }}>%</span>
                                            </div>
                                        </div>

                                        {/* Squad Moves Toggle */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                            <input
                                                type="checkbox"
                                                checked={runParams.allowSquadMoves}
                                                onChange={e => setRunParams(prev => ({ ...prev, allowSquadMoves: e.target.checked }))}
                                                style={{ accentColor: '#00BD00' }}
                                            />
                                            Squad Moves
                                        </label>

                                        {/* Global Backlog Toggle (Only if Scoped) */}
                                        {scopeSquads.size > 0 && (
                                            <div style={{ marginLeft: 'auto' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={includeGlobalBacklog}
                                                        onChange={e => setIncludeGlobalBacklog(e.target.checked)}
                                                        style={{ accentColor: '#FF8EFB' }}
                                                    />
                                                    Include Unassigned Backlog
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Search input with Icon */}
                            <div style={{ marginBottom: '16px', position: 'relative' }}>
                                <svg
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="2"
                                    style={{ position: 'absolute', left: '12px', top: '10px' }}
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search backlog projects..."
                                    value={bulkSearchQuery}
                                    onChange={(e) => { setBulkSearchQuery(e.target.value); }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: '12px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: isDark ? '#e2e8f0' : '#1e293b',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                />
                            </div>

                            {/* Select All Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px',
                                padding: '12px 16px',
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '5px',
                                        border: `2px solid ${bulkSelectedIds.size === filteredUnresourcedProjects.length && filteredUnresourcedProjects.length > 0 ? '#FF8EFB' : (isDark ? '#475569' : '#cbd5e1')}`,
                                        backgroundColor: bulkSelectedIds.size === filteredUnresourcedProjects.length && filteredUnresourcedProjects.length > 0 ? '#FF8EFB' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}>
                                        {bulkSelectedIds.size === filteredUnresourcedProjects.length && filteredUnresourcedProjects.length > 0 && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={bulkSelectedIds.size === filteredUnresourcedProjects.length && filteredUnresourcedProjects.length > 0}
                                        onChange={() => {
                                            if (bulkSelectedIds.size === filteredUnresourcedProjects.length) {
                                                setBulkSelectedIds(new Set());
                                            } else {
                                                setBulkSelectedIds(new Set(filteredUnresourcedProjects.map(p => p.id)));
                                            }
                                        }}
                                        style={{ display: 'none' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                                        Select All ({filteredUnresourcedProjects.length})
                                    </span>
                                </label>
                                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    {bulkSelectedIds.size} selected
                                </span>
                            </div>

                            {/* Project List - ALL PROJECTS */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                                {filteredUnresourcedProjects.map(project => {
                                    const value = (project.transactionalBenefits || 0) + (project.arr || project.estimatedArr || 0);
                                    const launchDate = project.launch || project.end;
                                    const isSelected = bulkSelectedIds.has(project.id);

                                    return (
                                        <div
                                            key={project.id}
                                            onClick={(e) => toggleBulkSelection(project.id, e)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                backgroundColor: isSelected
                                                    ? (isDark ? 'rgba(0,189,0,0.15)' : '#F5EDE1')
                                                    : (isDark ? '#0f172a' : 'white'),
                                                border: `1px solid ${isSelected ? '#FF8EFB' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                boxShadow: isSelected ? '0 2px 8px rgba(0, 189, 0, 0.1)' : 'none'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '5px',
                                                border: `2px solid ${isSelected ? '#FF8EFB' : (isDark ? '#475569' : '#cbd5e1')}`,
                                                backgroundColor: isSelected ? '#FF8EFB' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {isSelected && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => { }}
                                                style={{ display: 'none' }}
                                            />

                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '8px',
                                                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '16px'
                                            }}>
                                                <CountryFlag flagUrl={project.countryFlag} country={project.country} size={16} />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                                                    {project.name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{project.customer || 'No customer'}</span>
                                                    {value > 0 && (
                                                        <>
                                                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                                                            <span>£{((value / 1000).toFixed(0))}k</span>
                                                        </>
                                                    )}
                                                    {launchDate && (
                                                        <>
                                                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                                                            <span>Target: {formatDate(launchDate)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Slot equivalent badge */}
                                            <span style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#dcfce7',
                                                color: '#166534',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                minWidth: '36px'
                                            }}>
                                                {Math.max(0.25, Math.ceil(((project.pmVal || 0) + (project.scVal || 0) + (project.pdVal || 0)) / 3600 / 240 * 4) / 4)}x
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '12px', padding: '0 8px', fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Showing {filteredUnresourcedProjects.length} projects</span>
                                <span>Total Value: £{((filteredUnresourcedProjects.reduce((sum, p) => sum + ((p.transactionalBenefits || 0) + (p.arr || p.estimatedArr || 0)), 0)) / 1000).toFixed(0)}k</span>
                            </div>
                        </div>

                        {/* Right: Allocation Results */}
                        <div style={{ width: '320px', flexShrink: 0 }}>
                            <div style={{
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                borderRadius: '12px',
                                padding: '16px',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                                    Allocation Preview
                                </h3>

                                {/* Strategy Picker using STRATEGY_PRESETS */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>
                                        Strategy
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                                        {Object.entries(STRATEGY_PRESETS).map(([key, strat]) => (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedBulkStrategy(key)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${selectedBulkStrategy === key ? '#FF8EFB' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                    backgroundColor: selectedBulkStrategy === key ? (isDark ? 'rgba(0, 189, 0, 0.2)' : '#F5EDE1') : 'transparent',
                                                    color: selectedBulkStrategy === key ? '#FF8EFB' : (isDark ? '#94a3b8' : '#64748b'),
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={strat.description}
                                            >
                                                {strat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>


                                {!bulkPlan ? (
                                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                        <p style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '12px' }}>
                                            {bulkSelectedIds.size === 0
                                                ? 'Select projects to optimize'
                                                : `${bulkSelectedIds.size} project${bulkSelectedIds.size !== 1 ? 's' : ''} selected`
                                            }
                                        </p>
                                        <button
                                            onClick={computeBulkPlan}
                                            disabled={bulkSelectedIds.size === 0 || isComputingPlan}
                                            style={{
                                                padding: '12px 24px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: isComputingPlan
                                                    ? 'linear-gradient(135deg, #082F24, #FF8EFB, #FF8EFB)'
                                                    : bulkSelectedIds.size === 0
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #082F24, #FF8EFB)',
                                                color: 'white',
                                                fontSize: '13px',
                                                fontWeight: '700',
                                                cursor: bulkSelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                margin: '0 auto',
                                                minWidth: '180px',
                                                boxShadow: isComputingPlan
                                                    ? '0 0 20px rgba(0, 189, 0, 0.6), 0 0 40px rgba(0, 189, 0, 0.3)'
                                                    : '0 4px 12px rgba(0, 189, 0, 0.3)',
                                                animation: isComputingPlan ? 'pulseAlive 1.5s ease-in-out infinite' : 'none',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <style>{`
                                                @keyframes pulseAlive {
                                                    0%, 100% { 
                                                        transform: scale(1);
                                                        box-shadow: 0 0 20px rgba(0, 189, 0, 0.6), 0 0 40px rgba(0, 189, 0, 0.3);
                                                    }
                                                    50% { 
                                                        transform: scale(1.03);
                                                        box-shadow: 0 0 30px rgba(0, 189, 0, 0.8), 0 0 60px rgba(0, 189, 0, 0.5);
                                                    }
                                                }
                                                @keyframes brainPulse {
                                                    0%, 100% { opacity: 0.7; }
                                                    50% { opacity: 1; }
                                                }
                                                @keyframes neuronFire {
                                                    0% { stroke-dashoffset: 100; }
                                                    100% { stroke-dashoffset: 0; }
                                                }
                                            `}</style>
                                            {isComputingPlan ? (
                                                <div style={{ width: '100%', padding: '0 8px' }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        color: '#f8fafc'
                                                    }}>
                                                        <span>{bulkStatusMessage || 'Processing...'}</span>
                                                        <span>{bulkProgress}%</span>
                                                    </div>
                                                    <div style={{
                                                        width: '100%',
                                                        height: '6px',
                                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${bulkProgress}%`,
                                                            height: '100%',
                                                            backgroundColor: '#ffffff',
                                                            borderRadius: '3px',
                                                            transition: 'width 0.3s ease-out',
                                                            boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                                                        }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                    Compute Plan
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Stats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                            <div style={{ padding: '10px', backgroundColor: '#dcfce7', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '800', color: '#166534' }}>{bulkPlan.stats.placed}</div>
                                                <div style={{ fontSize: '9px', color: '#15803d' }}>Placed</div>
                                            </div>
                                            <div style={{ padding: '10px', backgroundColor: bulkPlan.stats.unplaceable > 0 ? '#fef2f2' : '#f1f5f9', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '800', color: bulkPlan.stats.unplaceable > 0 ? '#dc2626' : '#64748b' }}>{bulkPlan.stats.unplaceable}</div>
                                                <div style={{ fontSize: '9px', color: bulkPlan.stats.unplaceable > 0 ? '#b91c1c' : '#94a3b8' }}>Unplaceable</div>
                                            </div>
                                        </div>

                                        {/* Monte Carlo Stats (Bulk) */}
                                        {monteCarloResult && (
                                            <div style={{ padding: '10px', backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: '8px', marginBottom: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px', color: isDark ? '#e2e8f0' : '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Robustness (50 Runs)</span>
                                                    <span style={{ color: monteCarloResult.confidence.p90 > 80 ? '#00BD00' : '#FE9922' }}>
                                                        {monteCarloResult.confidence.p50}% Reliable
                                                    </span>
                                                </div>

                                                {reliefAiRiskLevel && (
                                                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <span style={{
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                backgroundColor: reliefAiRiskLevel === 'High' ? '#fee2e2' : reliefAiRiskLevel === 'Medium' ? '#fef3c7' : '#dcfce7',
                                                                color: reliefAiRiskLevel === 'High' ? '#dc2626' : reliefAiRiskLevel === 'Medium' ? '#d97706' : '#00BD00'
                                                            }}>
                                                                AI Risk: {reliefAiRiskLevel}
                                                            </span>
                                                            {reliefAiNextActions && (
                                                                <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                    Check logs
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                setReliefAiLoading(true);
                                                                // Force re-check logic by clearing runId briefly or just re-triggering simulation
                                                                await new Promise(r => setTimeout(r, 500));
                                                                if (currentRunId) {
                                                                    // Re-trigger useEffect
                                                                    const temp = currentRunId;
                                                                    setCurrentRunId(null);
                                                                    setTimeout(() => setCurrentRunId(temp), 100);
                                                                }
                                                                setReliefAiLoading(false);
                                                            }}
                                                            title="Refresh AI Status"
                                                            style={{
                                                                border: 'none',
                                                                background: 'none',
                                                                padding: '2px',
                                                                cursor: 'pointer',
                                                                color: isDark ? '#94a3b8' : '#64748b'
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                    <span>P10: {monteCarloResult.confidence.p10}%</span>
                                                    <span>P90: {monteCarloResult.confidence.p90}%</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Insights Panel - Bulk Mode */}
                                        {reliefAiInsights && (
                                            <div style={{
                                                padding: '10px',
                                                background: isDark
                                                    ? 'linear-gradient(135deg, rgba(71, 148, 255, 0.1) 0%, rgba(8, 47, 36, 0.05) 100%)'
                                                    : 'linear-gradient(135deg, rgba(71, 148, 255, 0.08) 0%, rgba(8, 47, 36, 0.03) 100%)',
                                                borderRadius: '8px',
                                                marginBottom: '12px',
                                                border: `1px solid ${isDark ? 'rgba(71, 148, 255, 0.2)' : 'rgba(71, 148, 255, 0.15)'}`
                                            }}>
                                                <div
                                                    style={{
                                                        fontSize: '10px',
                                                        fontWeight: '700',
                                                        color: isDark ? '#60a5fa' : '#2563eb',
                                                        marginBottom: showAIInsights ? '8px' : '0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setShowAIInsights(!showAIInsights)}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="3" />
                                                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                                    </svg>
                                                    AI Insights
                                                    <svg
                                                        width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                        style={{ marginLeft: 'auto', transform: showAIInsights ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                                    >
                                                        <path d="M6 9l6 6 6-6" />
                                                    </svg>
                                                </div>
                                                {showAIInsights && (
                                                    <div style={{ fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.5' }}>
                                                        {reliefAiInsights}
                                                        {reliefAiNextActions && (
                                                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${isDark ? 'rgba(71, 148, 255, 0.15)' : 'rgba(71, 148, 255, 0.1)'}` }}>
                                                                <div style={{ fontWeight: '600', color: isDark ? '#93c5fd' : '#4794FF', marginBottom: '4px' }}>Next Actions:</div>
                                                                {reliefAiNextActions}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {bulkPlan.stats.crossSquadCount > 0 && (
                                            <div style={{ padding: '8px', backgroundColor: '#fef3c7', borderRadius: '6px', marginBottom: '8px', fontSize: '10px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                {bulkPlan.stats.crossSquadCount} project(s) require cross-squad staffing
                                            </div>
                                        )}

                                        {/* Allocations */}
                                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            {bulkPlan.allocations.map((a, i) => (
                                                <div key={i} style={{
                                                    padding: '8px 10px',
                                                    marginBottom: '6px',
                                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                                    borderRadius: '6px',
                                                    border: `1px solid ${a.crossSquad ? '#fbbf24' : (isDark ? '#334155' : '#e2e8f0')}`
                                                }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                                        {a.projectName}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                                                        {(() => {
                                                            const p = unresourcedProjects.find(up => up.id === a.projectId);
                                                            // Default to 12 weeks if no duration found
                                                            const durationMs = (p?.launch && p?.kickOff)
                                                                ? (new Date(p.launch) - new Date(p.kickOff))
                                                                : 12 * 7 * 24 * 60 * 60 * 1000;
                                                            const launchDate = new Date(new Date(a.suggestedKO).getTime() + durationMs);
                                                            return (
                                                                <>
                                                                    → {a.suggestedSquad} • KO: {formatDate(a.suggestedKO)} • Launch: {formatDate(launchDate.toISOString())}
                                                                    {a.crossSquad && <span style={{ color: '#FE9922' }}> • Cross-squad</span>}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ))}

                                            {bulkPlan.unplaceable.map((u, i) => (
                                                <div key={`unp-${i}`} style={{
                                                    padding: '8px 10px',
                                                    marginBottom: '6px',
                                                    backgroundColor: '#fef2f2',
                                                    borderRadius: '6px',
                                                    border: '1px solid #fecaca'
                                                }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                                        {u.projectName}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}>
                                                        {u.reason}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : mode === 'staffing' ? (
                    /* ==================== STAFFING MODE ==================== */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                        {(() => {
                            const staffingRecs = generatePeopleAssignments(projects, resources, {
                                matchSquad: true,
                                enableCrossSquad: true
                            });

                            if (staffingRecs.length === 0) {
                                return (
                                    <div style={{ padding: '48px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                                        <h3>No Staffing Recommendations Found</h3>
                                        <p>All projects appear to be fully resourced or no suitable candidates found.</p>
                                    </div>
                                );
                            }

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
                                        border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`,
                                        borderRadius: '8px',
                                        marginBottom: '16px'
                                    }}>
                                        <strong style={{ color: isDark ? '#00BD00' : '#00BD00' }}>AI Analysis:</strong> Found {staffingRecs.length} resource assignments to balance the portfolio.
                                    </div>
                                    {staffingRecs.map((rec, idx) => (
                                        <div key={idx} style={{
                                            padding: '16px',
                                            backgroundColor: isDark ? '#1e293b' : 'white',
                                            borderRadius: '12px',
                                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px'
                                        }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '18px'
                                            }}>
                                                👤
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                                    Assign {rec.resourceName} to {rec.projectName}
                                                </div>
                                                <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                    {rec.role} • {rec.allocationPct}% Allocation • {rec.reason}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '600', color: rec.resultLoad > 100 ? '#E5554F' : '#00BD00' }}>
                                                    {rec.currentLoad}% → {rec.resultLoad}% Load
                                                </div>
                                                <button style={{
                                                    marginTop: '4px',
                                                    padding: '4px 12px',
                                                    fontSize: '11px',
                                                    backgroundColor: '#00BD00',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}>
                                                    Assign
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                ) : mode === 'allocations' ? (
                    /* ==================== ALLOCATIONS MODE ==================== */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                        <AllocationsTab
                            slotMap={slotMap}
                            projects={projects}
                            enabledSquads={enabledSquads}
                            isDark={isDark}
                        />
                    </div>
                ) : mode === 'reprioritize' ? (
                    /* ==================== REPRIORITIZE MODE ==================== */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                        <ReprioritizationTab
                            projects={projects}
                            slotMap={slotMap}
                            resources={resources}
                            enabledSquads={enabledSquads}
                            roleMapping={roleMapping}
                            isDark={isDark}
                            onCreateDraft={onCreateDraft}
                            base={base}
                            settings={settings}
                            onOpenProgramModal={(customer) => {
                                // Always render internally — external handler renders behind this stacking context
                                // First check groupedProgramData for full program objects
                                const customerData = groupedProgramData?.[customer];
                                const programGroup = customerData?.['★ Program'];
                                if (programGroup && programGroup.length > 0) {
                                    setInternalProgram(programGroup[0]);
                                } else {
                                    // Build program from raw projects array (works regardless of groupBy)
                                    const customerProjects = (projects || []).filter(p =>
                                        p.customer === customer || p.clientName === customer
                                    );
                                    const programProjects = customerProjects.filter(p => p.resourcedWithinProgram);
                                    const programDiscount = programStoredSettings?.programDiscount || 15;
                                    const workstreamConfigs = programStoredSettings?.programWorkstreams || [];

                                    let totalTransferredHours = 0;
                                    programProjects.forEach(p => {
                                        const originalHours = (p.pmValOriginal || p.pmVal || 0) +
                                            (p.scValOriginal || p.scVal || 0) + (p.pdValOriginal || p.pdVal || 0);
                                        totalTransferredHours += originalHours * (programDiscount / 100);
                                    });

                                    setInternalProgram({
                                        id: `program_${(customer || '').replace(/\s+/g, '_').toLowerCase()}`,
                                        customer,
                                        name: `${customer} Program`,
                                        isProgram: true,
                                        totalHours: totalTransferredHours,
                                        workstreams: workstreamConfigs.map(ws => ({
                                            ...ws,
                                            hours: totalTransferredHours * ((ws.allocationPct || 0) / 100)
                                        })),
                                        programProjects: customerProjects,
                                    });
                                }
                            }}
                            onRegisterActions={setRepriActions}
                            scenariosTable={scenariosTable}
                            scenarioRecords={scenarioRecords}
                            scenarios={scenarios}
                        />
                    </div>
                ) : (
                    /* ==================== OPTIMIZE MODE ==================== */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                        {filteredRecs.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '48px',
                                color: isDark ? '#64748b' : '#94a3b8'
                            }}>
                                <svg style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Already Optimized</h3>
                                <p style={{ fontSize: '13px' }}>No further optimizations available with current settings.</p>
                            </div>
                        ) : (
                            <>
                                {/* Select All Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '20px',
                                    padding: '16px 20px',
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    borderRadius: '16px',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                        <div style={{
                                            width: '20px', height: '20px', borderRadius: '6px',
                                            border: `2px solid ${selectedIds.size === filteredRecs.length ? '#00BD00' : (isDark ? '#475569' : '#cbd5e1')}`,
                                            backgroundColor: selectedIds.size === filteredRecs.length ? '#00BD00' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}>
                                            {selectedIds.size === filteredRecs.length && (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredRecs.length}
                                            onChange={toggleAll}
                                            style={{ display: 'none' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                                                Select All Recommendations
                                            </div>
                                            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                                {selectedIds.size} selected • +{(totals.slotGain * 100).toFixed(0)}% total capacity gain
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Recommendations Grid */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {filteredRecs.map((rec, idx) => {
                                        const isExpanded = expandedReasoning.has(idx);
                                        const isSelected = selectedIds.has(idx);
                                        // FIX: Use currentKickOff (not undefined currentWeek) vs suggestedWeek
                                        const durationChange = rec.type === 'date' && rec.currentKickOff && rec.suggestedWeek
                                            ? weeksDiff(rec.currentKickOff, rec.suggestedWeek)
                                            : 0;
                                        const isShift = durationChange !== 0 && Math.abs(durationChange) < 4;

                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '20px',
                                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                                    borderRadius: '16px',
                                                    border: isSelected
                                                        ? `2px solid #00BD00`
                                                        : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(34, 197, 94, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                                                    position: 'relative'
                                                }}
                                                onClick={() => toggleSelection(idx)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                                    {/* Custom Checkbox */}
                                                    <div style={{
                                                        marginTop: '4px',
                                                        width: '24px', height: '24px', borderRadius: '8px',
                                                        border: `2px solid ${isSelected ? '#00BD00' : (isDark ? '#475569' : '#cbd5e1')}`,
                                                        backgroundColor: isSelected ? '#00BD00' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        flexShrink: 0
                                                    }}>
                                                        {isSelected && (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {/* Header Row */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                            <div
                                                                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (onProjectClick && rec.project) onProjectClick(rec.project);
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '40px', height: '40px', borderRadius: '10px',
                                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '20px'
                                                                }}>
                                                                    <CountryFlag flagUrl={rec.countryFlag} country={rec.country} size={20} />
                                                                </div>
                                                                <div>
                                                                    <div style={{
                                                                        fontSize: '16px', fontWeight: '700',
                                                                        color: isDark ? '#f1f5f9' : '#0f172a',
                                                                        letterSpacing: '-0.01em', marginBottom: '2px'
                                                                    }}>
                                                                        {rec.projectName}
                                                                        {onProjectClick && (
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '6px', opacity: 0.5 }}>
                                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                        {rec.customer || 'Internal Project'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <span style={{
                                                                padding: '6px 12px',
                                                                backgroundColor: rec.slotGain > 0.3 ? '#dcfce7' : '#f1f5f9',
                                                                color: rec.slotGain > 0.3 ? '#166534' : '#64748b',
                                                                borderRadius: '20px',
                                                                fontSize: '11px', fontWeight: '700', letterSpacing: '0.02em',
                                                                display: 'flex', alignItems: 'center', gap: '6px'
                                                            }}>
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                                </svg>
                                                                +{(rec.slotGain * 100).toFixed(0)}% Capacity Gain
                                                            </span>
                                                        </div>

                                                        {/* Comparison Grid */}
                                                        {rec.type === 'date' && (
                                                            <div style={{
                                                                display: 'grid', gridTemplateColumns: '1fr 32px 1fr', gap: '0',
                                                                marginBottom: '16px', alignItems: 'stretch'
                                                            }}>
                                                                {/* Current State */}
                                                                <div style={{
                                                                    padding: '16px', borderRadius: '12px',
                                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                                    border: `1px solid ${isDark ? '#334155' : 'transparent'}`
                                                                }}>
                                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                        Current Schedule
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '4px' }}>
                                                                        <span style={{ color: '#FE9922', fontWeight: '600' }}>KO:</span> {formatDate(rec.currentKickOff)}
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                                        <span style={{ color: '#FF8EFB', fontWeight: '600' }}>Launch:</span> {formatDate(rec.currentLaunch)}
                                                                    </div>
                                                                </div>

                                                                {/* Arrow */}
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <div style={{
                                                                        width: '24px', height: '24px', borderRadius: '50%',
                                                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        color: '#94a3b8', zIndex: 1
                                                                    }}>→</div>
                                                                </div>

                                                                {/* New State */}
                                                                <div style={{
                                                                    padding: '16px', borderRadius: '12px',
                                                                    backgroundColor: '#f0fdf4',
                                                                    border: '1px solid #dcfce7'
                                                                }}>
                                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#166534', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>Optimized Schedule</span>
                                                                        <span style={{
                                                                            padding: '2px 6px', borderRadius: '4px',
                                                                            backgroundColor: isShift ? '#dbeafe' : '#fef3c7',
                                                                            color: isShift ? '#1e40af' : '#92400e'
                                                                        }}>
                                                                            {isShift ? '↔ Shift' : durationChange > 0 ? '→ Delayed' : '← Pulled In'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', color: '#166534', marginBottom: '4px' }}>
                                                                        <span style={{ fontWeight: '700' }}>KO:</span> {formatDate(rec.suggestedWeek)}
                                                                    </div>
                                                                    <div style={{ fontSize: '13px', color: '#166534' }}>
                                                                        <span style={{ fontWeight: '700' }}>Launch:</span> {formatDate(new Date(new Date(rec.suggestedWeek).getTime() + (rec.currentLaunch && rec.currentKickOff ? new Date(rec.currentLaunch) - new Date(rec.currentKickOff) : 12 * 7 * 24 * 60 * 60 * 1000)).toISOString())}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {rec.type === 'squad' && (
                                                            <div style={{
                                                                padding: '16px', borderRadius: '12px',
                                                                backgroundColor: '#f0fdf4', border: '1px solid #dcfce7',
                                                                marginBottom: '16px'
                                                            }}>
                                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                                                    Recommended Squad Transfer: {rec.currentSquad} → <strong>{rec.suggestedSquad}</strong>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Reasoning Toggle */}
                                                        <div>
                                                            <button
                                                                onClick={(e) => toggleReasoning(idx, e)}
                                                                style={{
                                                                    background: 'none', border: 'none', padding: 0,
                                                                    cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                                                                    color: isDark ? '#94a3b8' : '#64748b',
                                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                                    backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                                        <polyline points="6 9 12 15 18 9" />
                                                                    </svg>
                                                                </div>
                                                                {isExpanded ? 'Hide Analysis' : 'Show AI Reasoning'}
                                                            </button>
                                                            {isExpanded && (
                                                                <div style={{
                                                                    margin: '12px 0 0', padding: '16px',
                                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                                    borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                    fontSize: '13px', lineHeight: '1.6', color: isDark ? '#e2e8f0' : '#334155'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#082F24', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z" /><path d="M12 6v6l4 2" /></svg>
                                                                        Optimization Logic
                                                                    </div>
                                                                    {rec.reason || `This optimization moves the project to reduce congestion and improve delivery slot availability. The change creates ${(rec.slotGain * 100).toFixed(0)}% additional capacity by moving from a congested period to an open one.`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Premium Footer */}
                <div style={{
                    padding: '20px 32px',
                    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#1e293b' : 'white',
                    borderBottomLeftRadius: '24px',
                    borderBottomRightRadius: '24px',
                    zIndex: 10
                }}>
                    {/* Left: Action Summary */}
                    <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
                        {mode === 'bulk' ? (
                            bulkPlan && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: isDark ? 'rgba(0, 189, 0, 0.2)' : '#dcfce7', color: '#FF8EFB', fontWeight: '700' }}>
                                        {bulkPlan.stats.placed} Placed
                                    </span>
                                    <span>
                                        of {bulkSelectedIds.size} selected
                                    </span>
                                    {bulkPlan.stats.crossSquadCount > 0 && (
                                        <span style={{ color: '#FE9922', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /></svg>
                                            {bulkPlan.stats.crossSquadCount} cross-squad
                                        </span>
                                    )}
                                </div>
                            )
                        ) : (
                            selectedIds.size > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00BD00', boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2)' }} />
                                        <span style={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: '600' }}>{selectedIds.size} Changes</span>
                                    </div>
                                    <span style={{ color: isDark ? '#334155' : '#cbd5e1' }}>|</span>
                                    <span style={{ color: '#00BD00', fontWeight: '600' }}>
                                        +{(totals.slotGain * 100).toFixed(0)}% Capacity
                                    </span>
                                    <span style={{ color: isDark ? '#334155' : '#cbd5e1' }}>|</span>
                                    <span style={{ color: '#FF8EFB', fontWeight: '600' }}>
                                        £{(totals.financialImpact / 1000).toFixed(0)}k ARR
                                    </span>
                                </div>
                            ) : (
                                <span style={{ opacity: 0.7 }}>Select recommendations to apply changes</span>
                            )
                        )}
                    </div>
                    {/* Right: Actions */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {mode === 'reprioritize' && repriActions && (
                            <>
                                <button
                                    onClick={repriActions.onSave}
                                    style={{
                                        padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                                        borderRadius: '10px', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                        backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'; e.currentTarget.style.color = isDark ? '#f1f5f9' : '#1e293b'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b'; }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg> {repriActions.loadedName ? `Save "${repriActions.loadedName}"` : 'Save'}
                                </button>
                                {repriActions.loadedName && (
                                    <button
                                        onClick={repriActions.onSaveAs}
                                        style={{
                                            padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                                            borderRadius: '10px', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                            backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
                                        }}
                                        title="Save as a new scenario instead of overwriting"
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'; e.currentTarget.style.color = isDark ? '#f1f5f9' : '#1e293b'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b'; }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8" /></svg> Save As
                                    </button>
                                )}
                                <button
                                    onClick={repriActions.onLoad}
                                    style={{
                                        padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                                        borderRadius: '10px', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                        backgroundColor: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'; e.currentTarget.style.color = isDark ? '#f1f5f9' : '#1e293b'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b'; }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg> Load {repriActions.savedCount > 0 && <span style={{ fontSize: '10px', opacity: 0.6 }}>({repriActions.savedCount})</span>}
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                fontSize: '13px',
                                fontWeight: '600',
                                border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                borderRadius: '10px',
                                backgroundColor: 'transparent',
                                color: isDark ? '#94a3b8' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9';
                                e.currentTarget.style.color = isDark ? '#f1f5f9' : '#1e293b';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                            }}
                        >
                            Cancel
                        </button>

                        {mode === 'bulk' ? (
                            <>
                                {bulkPlan && (
                                    <button
                                        onClick={() => setBulkPlan(null)}
                                        style={{
                                            padding: '10px 16px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                            borderRadius: '10px',
                                            backgroundColor: isDark ? '#0f172a' : 'white',
                                            color: isDark ? '#94a3b8' : '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="23 4 23 10 17 10" />
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                        </svg>
                                        Recompute
                                    </button>
                                )}
                                <button
                                    onClick={handleBulkCreateDraft}
                                    disabled={!bulkPlan?.allocations?.length || isCreating}
                                    style={{
                                        padding: '10px 24px',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        border: 'none',
                                        borderRadius: '10px',
                                        background: !bulkPlan?.allocations?.length
                                            ? (isDark ? '#334155' : '#e2e8f0')
                                            : 'linear-gradient(135deg, #FF8EFB 0%, #082F24 100%)',
                                        color: !bulkPlan?.allocations?.length
                                            ? (isDark ? '#64748b' : '#94a3b8')
                                            : 'white',
                                        cursor: !bulkPlan?.allocations?.length ? 'not-allowed' : 'pointer',
                                        boxShadow: !bulkPlan?.allocations?.length ? 'none' : '0 4px 12px rgba(0, 189, 0, 0.3)',
                                        opacity: isCreating ? 0.7 : 1,
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(!bulkPlan?.allocations?.length) ? undefined : e => {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 189, 0, 0.4)';
                                    }}
                                    onMouseLeave={(!bulkPlan?.allocations?.length) ? undefined : e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 189, 0, 0.3)';
                                    }}
                                >
                                    {isCreating ? 'Saving...' : 'Save Bulk Draft'}
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleCreateDraft}
                                    disabled={selectedIds.size === 0 || isCreating}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                        borderRadius: '10px',
                                        backgroundColor: isDark ? '#0f172a' : 'white',
                                        color: selectedIds.size === 0 ? (isDark ? '#475569' : '#cbd5e1') : (isDark ? '#f1f5f9' : '#334155'),
                                        cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    Save Draft
                                </button>
                                {onApplyLive && (
                                    <button
                                        onClick={() => setShowApplyConfirm(true)}
                                        disabled={selectedIds.size === 0 || isApplying}
                                        style={{
                                            padding: '10px 24px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            border: 'none',
                                            borderRadius: '10px',
                                            background: selectedIds.size === 0
                                                ? (isDark ? '#334155' : '#e2e8f0')
                                                : 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)',
                                            color: selectedIds.size === 0
                                                ? (isDark ? '#64748b' : '#94a3b8')
                                                : 'white',
                                            cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                                            boxShadow: selectedIds.size === 0
                                                ? 'none'
                                                : '0 4px 14px rgba(34, 197, 94, 0.4)',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(selectedIds.size === 0) ? undefined : e => {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.5)';
                                        }}
                                        onMouseLeave={(selectedIds.size === 0) ? undefined : e => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 14px rgba(34, 197, 94, 0.4)';
                                        }}
                                    >
                                        Apply to Live
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Apply Confirmation Modal */}
            {showApplyConfirm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        backgroundColor: isDark ? '#1e293b' : 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        maxWidth: '480px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #FE9922 0%, #d97706 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    Apply Changes to Live Data
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    This will update Airtable records directly
                                </p>
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '8px' }}>
                                <strong>{selectedIds.size}</strong> project{selectedIds.size !== 1 ? 's' : ''} will be updated:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                {enrichedRecs.filter((_, i) => selectedIds.has(i)).some(r => r.suggestedSquad) && (
                                    <li>Squad assignments will change</li>
                                )}
                                {enrichedRecs.filter((_, i) => selectedIds.has(i)).some(r => r.suggestedWeek) && (
                                    <li>Kick-off dates will be updated</li>
                                )}
                                <li>Launch dates will be recalculated</li>
                            </ul>
                        </div>

                        {/* Warning */}
                        <div style={{
                            padding: '10px 14px',
                            backgroundColor: '#fef3c7',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '11px',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>This action cannot be easily undone. Consider creating a draft first if you want to review the changes.</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowApplyConfirm(false)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                    backgroundColor: isDark ? '#0f172a' : 'white',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc';
                                    e.currentTarget.style.borderColor = isDark ? '#64748b' : '#cbd5e1';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = isDark ? '#0f172a' : 'white';
                                    e.currentTarget.style.borderColor = isDark ? '#475569' : '#e2e8f0';
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyLive}
                                disabled={isApplying}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: 'white',
                                    cursor: isApplying ? 'not-allowed' : 'pointer',
                                    opacity: isApplying ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={!isApplying ? e => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.45)';
                                } : undefined}
                                onMouseLeave={!isApplying ? e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(34, 197, 94, 0.35)';
                                } : undefined}
                            >
                                {isApplying ? (
                                    <>
                                        <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.3"></circle>
                                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Capacity Relief Total Optimization Modal */}
            {showCapacityReliefModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        backgroundColor: isDark ? '#1e293b' : 'white',
                        borderRadius: '20px',
                        padding: '28px',
                        maxWidth: '520px',
                        width: '90%',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px'
                            }}>
                                🚀
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    {mode === 'ai_optimiser' ? 'AI Strategic Plan' : 'Capacity Relief — Total Optimization'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    {mode === 'ai_optimiser' ? 'Optimized outcome based on your strategic inputs' : 'Assign all unallocated + optimize schedule'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCapacityReliefModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9';
                                    e.currentTarget.style.color = isDark ? '#f1f5f9' : '#1e293b';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Date Range */}
                        <div style={{
                            padding: '16px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '10px' }}>
                                Optimization Date Range
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="date"
                                    value={dateRangeStart}
                                    onChange={(e) => setDateRangeStart(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        fontSize: '13px',
                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                        borderRadius: '8px',
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b'
                                    }}
                                />
                                <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>→</span>
                                <input
                                    type="date"
                                    value={dateRangeEnd}
                                    onChange={(e) => setDateRangeEnd(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        fontSize: '13px',
                                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                        borderRadius: '8px',
                                        backgroundColor: isDark ? '#1e293b' : 'white',
                                        color: isDark ? '#f1f5f9' : '#1e293b'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Optimization Strategy Picker */}
                        {!capacityReliefPlan && !isComputingRelief && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '14px',
                                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}>
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    Optimization Strategy
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                }}>
                                    {Object.entries(STRATEGY_PRESETS).map(([key, preset]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setSelectedStrategy(key);
                                                // Apply preset params if defined
                                                const params = PRESET_PARAMS[key];
                                                if (params) {
                                                    setRunParams(prev => ({ ...prev, ...params }));
                                                }
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                fontSize: '10px',
                                                fontWeight: selectedStrategy === key ? '700' : '500',
                                                border: `1px solid ${selectedStrategy === key
                                                    ? (isDark ? '#FF8EFB' : '#082F24')
                                                    : (isDark ? '#475569' : '#cbd5e1')}`,
                                                borderRadius: '6px',
                                                backgroundColor: selectedStrategy === key
                                                    ? (isDark ? '#061f18' : '#E8E1D9')
                                                    : (isDark ? '#0f172a' : 'white'),
                                                color: selectedStrategy === key
                                                    ? (isDark ? '#bbf7d0' : '#082F24')
                                                    : (isDark ? '#94a3b8' : '#64748b'),
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '10px',
                                    color: isDark ? '#64748b' : '#94a3b8',
                                    fontStyle: 'italic',
                                    marginBottom: '16px'
                                }}>
                                    {STRATEGY_PRESETS[selectedStrategy]?.description || ''}
                                </div>

                                {/* Granular Controls (Advanced) */}
                                <div style={{
                                    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    paddingTop: '16px',
                                    marginTop: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155' }}>Fine Tuning</span>
                                        <div style={{ height: '1px', flex: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                                    </div>

                                    {/* Priority Dial - Slider */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280' }}>Optimization Priority</label>
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#FF8EFB' }}>
                                                {runParams.priorityDial <= 33 ? 'Max Slots' : runParams.priorityDial >= 67 ? 'Stability' : 'Balanced'}
                                            </span>
                                        </div>
                                        <input
                                            type="range" min="0" max="100" step="5"
                                            value={runParams.priorityDial}
                                            onChange={e => setRunParams(prev => ({ ...prev, priorityDial: Number(e.target.value) }))}
                                            style={{ width: '100%', accentColor: '#FF8EFB', height: '4px' }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '4px' }}>
                                            <span>Slots</span>
                                            <span>Stability</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Compression */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Max Compression</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="number" min="0" max="12"
                                                    value={runParams.maxCompression}
                                                    onChange={e => setRunParams(prev => ({ ...prev, maxCompression: Number(e.target.value) }))}
                                                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '6px', border: `1px solid ${isDark ? '#4b5563' : '#d1d5db'}`, backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#f1f5f9' : '#1e293b' }}
                                                />
                                                <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>wks</span>
                                            </div>
                                        </div>
                                        {/* Expansion */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Max Delay</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="number" min="0" max="24"
                                                    value={runParams.maxExpansion}
                                                    onChange={e => setRunParams(prev => ({ ...prev, maxExpansion: Number(e.target.value) }))}
                                                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '6px', border: `1px solid ${isDark ? '#4b5563' : '#d1d5db'}`, backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#f1f5f9' : '#1e293b' }}
                                                />
                                                <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>wks</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Squad Scope Filter */}
                                    <div style={{ marginTop: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '8px' }}>
                                            Scope ({scopeSquads.size} squads)
                                        </label>
                                        <div style={{
                                            maxHeight: '120px',
                                            overflowY: 'auto',
                                            border: `1px solid ${isDark ? '#4b5563' : '#e2e8f0'}`,
                                            borderRadius: '6px',
                                            padding: '8px',
                                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                            gap: '8px'
                                        }}>
                                            {enabledSquads && enabledSquads.map(squad => (
                                                <label key={squad} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={scopeSquads.has(squad)}
                                                        onChange={e => {
                                                            const newSet = new Set(scopeSquads);
                                                            if (e.target.checked) newSet.add(squad);
                                                            else newSet.delete(squad);
                                                            setScopeSquads(newSet);
                                                        }}
                                                        style={{ accentColor: '#4794FF' }}
                                                    />
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={squad}>
                                                        {squad}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                            <input
                                                type="checkbox"
                                                checked={runParams.allowSquadMoves}
                                                onChange={e => setRunParams(prev => ({ ...prev, allowSquadMoves: e.target.checked }))}
                                                style={{ accentColor: '#00BD00' }}
                                            />
                                            Squad Moves
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155' }}>
                                            <input
                                                type="checkbox"
                                                checked={runParams.allowResourceSwaps}
                                                onChange={e => setRunParams(prev => ({ ...prev, allowResourceSwaps: e.target.checked }))}
                                                style={{ accentColor: '#00BD00' }}
                                            />
                                            Res. Swaps
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Computing State */}
                        {isComputingRelief && (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                marginBottom: '20px'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: isDark ? '#334155' : '#e2e8f0',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{
                                        width: `${reliefProgress}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #f97316, #ea580c)',
                                        borderRadius: '4px',
                                        transition: 'width 0.3s ease-out'
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{reliefStatusMessage}</span>
                                    <span style={{ opacity: 0.7 }}>({reliefProgress}%)</span>
                                </div>
                            </div>
                        )}

                        {/* Preview Results */}
                        {capacityReliefPlan && !isComputingRelief && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '12px' }}>
                                    Optimization Preview
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#dcfce7',
                                        borderRadius: '10px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#166534' }}>
                                            {capacityReliefPlan.stats.unallocatedAssigned}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#15803d' }}>Unallocated → Assigned</div>
                                    </div>
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#fef3c7',
                                        borderRadius: '10px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#92400e' }}>
                                            {capacityReliefPlan.stats.existingDelayed}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#b45309' }}>Existing Shifted</div>
                                    </div>
                                </div>
                                {capacityReliefPlan.stats.unallocatedUnplaceable > 0 && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '10px',
                                        backgroundColor: '#fef2f2',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        color: '#dc2626',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        {capacityReliefPlan.stats.unallocatedUnplaceable} projects could not be placed
                                    </div>
                                )}

                                {/* AI Insights Panel */}
                                {(reliefAiLoading || reliefAiInsights || reliefAiError) && (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '14px',
                                        backgroundColor: isDark ? '#0c1322' : '#f8fafc',
                                        borderRadius: '10px',
                                        border: `1px solid ${isDark ? '#1e3a5f' : '#dbeafe'}`
                                    }}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            color: isDark ? '#60a5fa' : '#2563eb',
                                            marginBottom: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                                                <path d="M12 16v-4" />
                                                <path d="M12 8h.01" />
                                            </svg>
                                            AI Analysis
                                            {reliefAiRiskLevel && (
                                                <span style={{
                                                    marginLeft: 'auto',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    backgroundColor: reliefAiRiskLevel === 'Critical' ? '#dc2626'
                                                        : reliefAiRiskLevel === 'High' ? '#f97316'
                                                            : reliefAiRiskLevel === 'Medium' ? '#eab308'
                                                                : '#00BD00',
                                                    color: 'white'
                                                }}>
                                                    {reliefAiRiskLevel} Risk
                                                </span>
                                            )}
                                        </div>

                                        {reliefAiLoading ? (
                                            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                                Generating AI insights...
                                            </div>
                                        ) : reliefAiError ? (
                                            <div style={{ fontSize: '11px', color: '#f97316' }}>
                                                ⚠️ {reliefAiError}
                                            </div>
                                        ) : (
                                            <>
                                                {/* AI Confidence Badge */}
                                                {reliefAiConfidence && (
                                                    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            backgroundColor: reliefAiConfidence === 'High' ? '#dcfce7'
                                                                : reliefAiConfidence === 'Medium' ? '#fef9c3'
                                                                    : '#fee2e2',
                                                            color: reliefAiConfidence === 'High' ? '#166534'
                                                                : reliefAiConfidence === 'Medium' ? '#854d0e'
                                                                    : '#991b1b',
                                                            border: `1px solid ${reliefAiConfidence === 'High' ? '#86efac' : reliefAiConfidence === 'Medium' ? '#fde047' : '#fca5a5'}`
                                                        }}>
                                                            {reliefAiConfidence === 'High' ? '✓' : reliefAiConfidence === 'Medium' ? '~' : '!'} {reliefAiConfidence} Confidence
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Key Metrics Grid */}
                                                {(reliefArrAffected || reliefAvgDelay || reliefBottleneck) && (
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                                        gap: '8px',
                                                        marginBottom: '12px'
                                                    }}>
                                                        {/* ARR at Risk */}
                                                        <div style={{
                                                            padding: '10px 12px',
                                                            background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`
                                                        }}>
                                                            <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#fca5a5' : '#991b1b', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                ARR at Risk
                                                            </div>
                                                            <div style={{ fontSize: '16px', fontWeight: '800', color: isDark ? '#f87171' : '#dc2626' }}>
                                                                {reliefArrAffected ? `£${(reliefArrAffected / 1000).toFixed(0)}k` : '—'}
                                                            </div>
                                                        </div>

                                                        {/* Avg Delay */}
                                                        <div style={{
                                                            padding: '10px 12px',
                                                            background: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isDark ? '#78350f' : '#fde68a'}`
                                                        }}>
                                                            <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#fcd34d' : '#92400e', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                Avg Delay
                                                            </div>
                                                            <div style={{ fontSize: '16px', fontWeight: '800', color: isDark ? '#fbbf24' : '#d97706' }}>
                                                                {reliefAvgDelay ? `${reliefAvgDelay.toFixed(1)} wks` : '—'}
                                                            </div>
                                                        </div>

                                                        {/* Bottleneck */}
                                                        <div style={{
                                                            padding: '10px 12px',
                                                            background: isDark ? 'rgba(0, 189, 0, 0.1)' : '#F5EDE1',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isDark ? '#082F24' : '#bbf7d0'}`
                                                        }}>
                                                            <div style={{ fontSize: '9px', fontWeight: '600', color: isDark ? '#bbf7d0' : '#082F24', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                Bottleneck
                                                            </div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: isDark ? '#86efac' : '#082F24' }}>
                                                                {reliefBottleneck || '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Impact Summary - Executive One-liner */}
                                                {reliefAiImpactSummary && (
                                                    <div style={{
                                                        marginBottom: '12px',
                                                        padding: '10px 12px',
                                                        backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
                                                        borderRadius: '8px',
                                                        borderLeft: '3px solid #4794FF',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: isDark ? '#93c5fd' : '#1e40af'
                                                    }}>
                                                        💡 {reliefAiImpactSummary}
                                                    </div>
                                                )}

                                                {reliefAiInsights && (
                                                    <div style={{ fontSize: '11px', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.5', marginBottom: '10px' }}>
                                                        {reliefAiInsights}
                                                    </div>
                                                )}
                                                {reliefAiNextActions && (
                                                    <div style={{
                                                        fontSize: '10px',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        padding: '8px',
                                                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                        borderRadius: '6px',
                                                        whiteSpace: 'pre-line'
                                                    }}>
                                                        <strong>Next Actions:</strong>
                                                        <br />
                                                        {reliefAiNextActions}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Monte Carlo Robustness Score */}
                        {monteCarloResult && capacityReliefPlan && !isComputingRelief && (
                            <div style={{
                                marginBottom: '16px',
                                padding: '14px',
                                backgroundColor: isDark ? '#0f172a' : '#f0f9ff',
                                borderRadius: '10px',
                                border: `1px solid ${isDark ? '#1e3a5f' : '#bae6fd'}`
                            }}>
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: isDark ? '#38bdf8' : '#0284c7',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </svg>
                                    Plan Robustness (Monte Carlo)
                                </div>

                                {/* Robustness Gauge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                    <div style={{
                                        fontSize: '32px',
                                        fontWeight: '800',
                                        color: monteCarloResult.robustnessScore >= 80 ? '#00BD00'
                                            : monteCarloResult.robustnessScore >= 60 ? '#eab308'
                                                : '#f97316'
                                    }}>
                                        {monteCarloResult.robustnessScore}%
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            height: '8px',
                                            backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                                            borderRadius: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${monteCarloResult.robustnessScore}%`,
                                                height: '100%',
                                                background: monteCarloResult.robustnessScore >= 80
                                                    ? 'linear-gradient(90deg, #00BD00, #86efac)'
                                                    : monteCarloResult.robustnessScore >= 60
                                                        ? 'linear-gradient(90deg, #eab308, #fde047)'
                                                        : 'linear-gradient(90deg, #f97316, #fdba74)'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
                                            {monteCarloResult.interpretation}
                                        </div>
                                    </div>
                                </div>

                                {/* Confidence Percentiles */}
                                {monteCarloResult.confidence && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '12px',
                                        fontSize: '10px',
                                        padding: '8px',
                                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                        borderRadius: '6px',
                                        marginBottom: monteCarloResult.risks?.length > 0 ? '10px' : 0
                                    }}>
                                        <div>
                                            <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>10th %ile:</span>
                                            <span style={{ fontWeight: '600', marginLeft: '4px', color: isDark ? '#e2e8f0' : '#334155' }}>{monteCarloResult.confidence.p10}%</span>
                                        </div>
                                        <div>
                                            <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>50th %ile:</span>
                                            <span style={{ fontWeight: '600', marginLeft: '4px', color: isDark ? '#e2e8f0' : '#334155' }}>{monteCarloResult.confidence.p50}%</span>
                                        </div>
                                        <div>
                                            <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>90th %ile:</span>
                                            <span style={{ fontWeight: '600', marginLeft: '4px', color: isDark ? '#e2e8f0' : '#334155' }}>{monteCarloResult.confidence.p90}%</span>
                                        </div>
                                    </div>
                                )}

                                {/* Risk Badges */}
                                {monteCarloResult.risks?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {monteCarloResult.risks.map((risk, idx) => (
                                            <span key={idx} style={{
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                fontSize: '9px',
                                                fontWeight: '600',
                                                backgroundColor: risk.severity === 'high' ? (isDark ? '#7f1d1d' : '#fee2e2') : (isDark ? '#78350f' : '#fef3c7'),
                                                color: risk.severity === 'high' ? '#E5554F' : '#d97706'
                                            }}>
                                                {risk.message}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Comparison View */}
                        {comparisonMode && scenarioA && scenarioB ? (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    Scenario Comparison
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {[scenarioA, scenarioB].map((scen, idx) => (
                                        <div key={idx} style={{
                                            padding: '16px', borderRadius: '12px',
                                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                            border: `2px solid ${idx === 0 ? '#4794FF' : '#FF8EFB'}`
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: idx === 0 ? '#4794FF' : '#FF8EFB', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Scenario {idx === 0 ? 'A' : 'B'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '12px' }}>
                                                Strategy: <strong>{STRATEGY_PRESETS[scen.strategy]?.name || 'Custom'}</strong>
                                            </div>

                                            {/* Key Metrics */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Robustness</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: scen.monteCarlo.robustnessScore >= 80 ? '#00BD00' : '#FE9922' }}>
                                                        {scen.monteCarlo.robustnessScore}%
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>ARR Impact</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                                        ${(scen.plan.allocations.reduce((s, a) => s + (a.projectValue || 0), 0) / 1000).toFixed(0)}k
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Delays</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: scen.plan.optimizations.filter(o => o.suggestedWeek !== o.currentWeek).length > 5 ? '#E5554F' : '#00BD00' }}>
                                                        {scen.plan.optimizations.filter(o => o.suggestedWeek !== o.currentWeek).length} projects
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>Unplaceable</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: scen.plan.stats.unallocatedUnplaceable > 0 ? '#E5554F' : '#00BD00' }}>
                                                        {scen.plan.stats.unallocatedUnplaceable} projects
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <button
                                                onClick={() => {
                                                    setCapacityReliefPlan(scen.plan);
                                                    setMonteCarloResult(scen.monteCarlo);
                                                    setComparisonMode(false);
                                                }}
                                                style={{
                                                    marginTop: '16px', width: '100%', padding: '8px',
                                                    fontSize: '11px', fontWeight: '600',
                                                    border: 'none', borderRadius: '6px',
                                                    backgroundColor: idx === 0 ? '#4794FF' : '#FF8EFB',
                                                    color: 'white', cursor: 'pointer'
                                                }}
                                            >
                                                Select Scenario {idx === 0 ? 'A' : 'B'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Normal Detail View */
                            capacityReliefPlan && !isComputingRelief && (capacityReliefPlan.allocations?.length > 0 || capacityReliefPlan.optimizations?.length > 0) && (
                                <div style={{
                                    marginBottom: '20px',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    borderRadius: '10px'
                                }}>
                                    {/* Allocations Section */}
                                    {capacityReliefPlan.allocations?.length > 0 && (
                                        <div>
                                            <div style={{
                                                padding: '10px 12px',
                                                backgroundColor: isDark ? '#0f172a' : '#f0fdf4',
                                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#00BD00',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="8.5" cy="7" r="4" />
                                                    <line x1="20" y1="8" x2="20" y2="14" />
                                                    <line x1="23" y1="11" x2="17" y2="11" />
                                                </svg>
                                                Squad Assignments ({capacityReliefPlan.allocations.length})
                                            </div>
                                            {capacityReliefPlan.allocations.map((a, idx) => (
                                                <div key={idx} style={{
                                                    padding: '8px 12px',
                                                    borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                    fontSize: '11px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: '500' }}>
                                                        {a.projectName?.slice(0, 30)}{a.projectName?.length > 30 ? '...' : ''}
                                                        {a.suggestedKO && (
                                                            <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7, fontWeight: 'normal' }}>
                                                                KO: {new Date(a.suggestedKO).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                                {' '}→ Launch: {(() => {
                                                                    // Calculate launch based on duration
                                                                    const durationMs = a.durationWeeks ? a.durationWeeks * 7 * 24 * 60 * 60 * 1000 : 12 * 7 * 24 * 60 * 60 * 1000;
                                                                    const launchDate = new Date(new Date(a.suggestedKO).getTime() + durationMs);
                                                                    return launchDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                                                                })()}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span style={{
                                                        backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        color: isDark ? '#60a5fa' : '#1d4ed8',
                                                        fontWeight: '600'
                                                    }}>
                                                        → {a.suggestedSquad}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Optimizations Section */}
                                    {capacityReliefPlan.optimizations?.length > 0 && (
                                        <div>
                                            <div style={{
                                                padding: '10px 12px',
                                                backgroundColor: isDark ? '#0f172a' : '#fefce8',
                                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#ca8a04',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                Schedule Shifts ({capacityReliefPlan.optimizations.length})
                                            </div>
                                            {capacityReliefPlan.optimizations.map((rec, idx) => {
                                                const shift = rec.suggestedWeek && rec.currentWeek
                                                    ? weeksDiff(rec.currentWeek, rec.suggestedWeek)
                                                    : 0;

                                                // Calculate current and new launch dates
                                                const durationMs = rec.durationWeeks ? rec.durationWeeks * 7 * 24 * 60 * 60 * 1000 : 12 * 7 * 24 * 60 * 60 * 1000;
                                                const currentLaunch = rec.currentWeek ? new Date(new Date(rec.currentWeek).getTime() + durationMs) : null;
                                                const newLaunch = rec.suggestedWeek ? new Date(new Date(rec.suggestedWeek).getTime() + durationMs) : null;

                                                return (
                                                    <div key={idx} style={{
                                                        padding: '10px 12px',
                                                        borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                        fontSize: '11px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start'
                                                    }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: '600' }}>
                                                                {rec.projectName}
                                                            </span>

                                                            {/* Kick-off Changes */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                <span style={{ minWidth: '45px', fontWeight: '500' }}>Kick-off:</span>
                                                                <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                                                                    {new Date(rec.currentWeek).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                                </span>
                                                                <span>→</span>
                                                                <span style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: '600' }}>
                                                                    {new Date(rec.suggestedWeek).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </div>

                                                            {/* Launch Changes */}
                                                            {currentLaunch && newLaunch && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                                    <span style={{ minWidth: '45px', fontWeight: '500' }}>Launch:</span>
                                                                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                                                                        {currentLaunch.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                    <span>→</span>
                                                                    <span style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: '600' }}>
                                                                        {newLaunch.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <span style={{
                                                            backgroundColor: shift > 0 ? (isDark ? '#422006' : '#fef3c7') : (isDark ? '#052e16' : '#dcfce7'),
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            color: shift > 0 ? '#ca8a04' : '#00BD00',
                                                            fontWeight: '600',
                                                            minWidth: '40px',
                                                            textAlign: 'center',
                                                            fontSize: '10px',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {shift > 0 ? `+${shift} wks` : shift < 0 ? `${shift} wks` : '→'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Resource Suggestions Section */}
                                    {capacityReliefPlan.peopleAssignments?.length > 0 && (
                                        <div>
                                            <div style={{
                                                padding: '10px 12px',
                                                backgroundColor: isDark ? '#0f172a' : '#f0fdf4',
                                                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#00BD00',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                                Resource Suggestions ({capacityReliefPlan.peopleAssignments.length})
                                            </div>
                                            {capacityReliefPlan.peopleAssignments.map((rec, idx) => (
                                                <div key={idx} style={{
                                                    padding: '10px 12px',
                                                    borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                    fontSize: '11px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: '600' }}>
                                                            {rec.projectName}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                                            {rec.role}: {rec.resourceName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            backgroundColor: isDark ? '#052e16' : '#dcfce7',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            color: '#00BD00',
                                                            fontWeight: '600',
                                                            fontSize: '10px'
                                                        }}>
                                                            {rec.score}% fit
                                                        </span>
                                                        <span style={{
                                                            backgroundColor: rec.resultLoad > 90 ? (isDark ? '#422006' : '#fef3c7') : (isDark ? '#0c4a6e' : '#e0f2fe'),
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            color: rec.resultLoad > 90 ? '#ca8a04' : '#0369a1',
                                                            fontWeight: '600',
                                                            fontSize: '10px'
                                                        }}>
                                                            {rec.resultLoad}% load
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* Executive Summary */}
                        {capacityReliefPlan && !isComputingRelief && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '16px',
                                backgroundColor: isDark ? '#0c1322' : '#fafafa',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#1e3a5f' : '#e5e5e5'}`
                            }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: isDark ? '#f1f5f9' : '#1e293b',
                                    marginBottom: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 17H7a5 5 0 0 1 0-10h2" />
                                        <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                    Executive Summary
                                </div>

                                {/* ARR Impact */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '10px',
                                    marginBottom: '14px'
                                }}>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: isDark ? '#052e16' : '#ecfdf5',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}>
                                        <div>
                                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#00BD00' }}>
                                                +${((capacityReliefPlan.allocations || []).reduce((sum, a) => sum + (a.projectValue || 0), 0) / 1000).toFixed(0)}k
                                            </span>
                                            <span style={{ fontSize: '9px', color: '#00BD00', marginLeft: '4px' }}>ARR</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#15803d' }}>
                                                +${((capacityReliefPlan.allocations || []).reduce((sum, a) => sum + (a.implFee || 0), 0) / 1000).toFixed(0)}k
                                            </span>
                                            <span style={{ fontSize: '9px', color: '#00BD00', marginLeft: '4px' }}>Impl</span>
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: isDark ? '#422006' : '#fef3c7',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#ca8a04' }}>
                                            {(capacityReliefPlan.optimizations || []).filter(o => {
                                                const shift = o.suggestedWeek && o.currentWeek
                                                    ? (new Date(o.suggestedWeek) - new Date(o.currentWeek)) / (7 * 24 * 60 * 60 * 1000)
                                                    : 0;
                                                return shift > 0;
                                            }).length}
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#d97706' }}>Delayed</div>
                                    </div>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '16px', fontWeight: '800', color: isDark ? '#e2e8f0' : '#334155' }}>
                                            {capacityReliefPlan.stats?.totalProjects || 0}
                                        </div>
                                        <div style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>Total Processed</div>
                                    </div>
                                </div>

                                {/* Squad Distribution */}
                                {capacityReliefPlan.allocations?.length > 0 && (() => {
                                    const squadCounts = {};
                                    (capacityReliefPlan.allocations || []).forEach(a => {
                                        const squad = a.suggestedSquad || 'Unassigned';
                                        squadCounts[squad] = (squadCounts[squad] || 0) + 1;
                                    });
                                    const sorted = Object.entries(squadCounts).sort((a, b) => b[1] - a[1]);
                                    return (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                                                Squad Distribution
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {sorted.slice(0, 6).map(([squad, count], idx) => (
                                                    <div key={squad} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                                    }}>
                                                        <span style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: ['#00BD00', '#4794FF', '#FF8EFB', '#FE9922', '#E5554F', '#06b6d4'][idx % 6]
                                                        }} />
                                                        <span style={{ fontSize: '10px', color: isDark ? '#e2e8f0' : '#334155', fontWeight: '500' }}>
                                                            {squad.length > 12 ? squad.slice(0, 12) + '...' : squad}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '700' }}>
                                                            {count}
                                                        </span>
                                                    </div>
                                                ))}
                                                {sorted.length > 6 && (
                                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', padding: '4px 8px' }}>
                                                        +{sorted.length - 6} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* What's Changing Summary */}
                                <div style={{
                                    padding: '10px 12px',
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    borderRadius: '8px',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    fontSize: '10px',
                                    lineHeight: '1.6'
                                }}>
                                    <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '6px' }}>
                                        📋 What Will Change
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '16px', color: isDark ? '#cbd5e1' : '#475569' }}>
                                        {(capacityReliefPlan.allocations?.length || 0) > 0 && (
                                            <li><strong>{capacityReliefPlan.allocations.length}</strong> unassigned projects will be assigned to squads</li>
                                        )}
                                        {(capacityReliefPlan.optimizations?.length || 0) > 0 && (
                                            <li><strong>{capacityReliefPlan.optimizations.length}</strong> existing projects will have schedule adjustments</li>
                                        )}
                                        {(capacityReliefPlan.stats?.unallocatedUnplaceable || 0) > 0 && (
                                            <li style={{ color: '#f97316' }}><strong>{capacityReliefPlan.stats.unallocatedUnplaceable}</strong> projects could not be placed (capacity constraints)</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {!capacityReliefPlan ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setShowCapacityReliefModal(false);
                                            setCapacityReliefPlan(null);
                                        }}
                                        style={{
                                            flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600',
                                            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`, borderRadius: '10px',
                                            backgroundColor: isDark ? '#1e293b' : 'white', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCapacityRelief}
                                        disabled={isComputingRelief}
                                        style={{
                                            flex: 2, padding: '12px', fontSize: '13px', fontWeight: '700',
                                            border: 'none', borderRadius: '10px',
                                            background: isComputingRelief ? (isDark ? '#475569' : '#cbd5e1') : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                            color: 'white', cursor: isComputingRelief ? 'wait' : 'pointer',
                                            boxShadow: isComputingRelief ? 'none' : '0 4px 14px rgba(249, 115, 22, 0.4)'
                                        }}
                                    >
                                        {isComputingRelief ? 'Computing...' : 'Run Total Optimization'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Scenario Saving Controls */}
                                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                        <button
                                            onClick={() => saveScenario('A')}
                                            style={{
                                                flex: 1, padding: '10px', fontSize: '11px', fontWeight: '600',
                                                border: `1px solid ${scenarioA ? '#00BD00' : (isDark ? '#475569' : '#e2e8f0')}`,
                                                borderRadius: '8px',
                                                backgroundColor: scenarioA ? (isDark ? '#064e3b' : '#dcfce7') : 'transparent',
                                                color: scenarioA ? '#00BD00' : (isDark ? '#94a3b8' : '#64748b'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {scenarioA ? 'Update Scen A' : 'Save as Scen A'}
                                        </button>
                                        <button
                                            onClick={() => saveScenario('B')}
                                            style={{
                                                flex: 1, padding: '10px', fontSize: '11px', fontWeight: '600',
                                                border: `1px solid ${scenarioB ? '#00BD00' : (isDark ? '#475569' : '#e2e8f0')}`,
                                                borderRadius: '8px',
                                                backgroundColor: scenarioB ? (isDark ? '#064e3b' : '#dcfce7') : 'transparent',
                                                color: scenarioB ? '#00BD00' : (isDark ? '#94a3b8' : '#64748b'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {scenarioB ? 'Update Scen B' : 'Save as Scen B'}
                                        </button>
                                    </div>

                                    {/* Comparison Trigger */}
                                    {scenarioA && scenarioB && (
                                        <button
                                            onClick={() => setComparisonMode(!comparisonMode)}
                                            style={{
                                                padding: '12px', fontSize: '13px', fontWeight: '700',
                                                border: 'none', borderRadius: '10px',
                                                background: '#FF8EFB', color: 'white', cursor: 'pointer'
                                            }}
                                        >
                                            {comparisonMode ? 'Exit Compare' : 'Compare A vs B'}
                                        </button>
                                    )}

                                    <button
                                        onClick={handleCapacityReliefCreateDraft}
                                        disabled={isCreating}
                                        style={{
                                            flex: 2, padding: '12px', fontSize: '13px', fontWeight: '700',
                                            border: 'none', borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)',
                                            color: 'white', cursor: isCreating ? 'wait' : 'pointer',
                                            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                                        }}
                                    >
                                        {isCreating ? 'Creating...' : 'Create Draft Scenario'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Program Detail Modal - rendered inside OptimizationModal stacking context */}
            {internalProgram && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 10005,
                    isolation: 'isolate'
                }}>
                    <ProgramDetailModal
                        program={internalProgram}
                        allPrograms={(() => {
                            const programs = [];
                            Object.values(groupedProgramData || {}).forEach(customerGroup => {
                                const pg = customerGroup?.['★ Program'];
                                if (pg) programs.push(...pg);
                            });
                            return programs;
                        })()}
                        onNavigate={(p) => setInternalProgram(p)}
                        allResources={programResources || resources}
                        allRows={programRows}
                        programsTable={programsTable}
                        programRecords={programRecords}
                        storedSettings={programStoredSettings}
                        onClose={() => setInternalProgram(null)}
                        onProjectClick={onProgramProjectClick}
                    />
                </div>
            )}
        </div>
    );
};

export default OptimizationModal;

// PropTypes for runtime type validation
OptimizationModal.propTypes = {
    /** Whether the modal is open */
    isOpen: PropTypes.bool.isRequired,
    /** Close handler */
    onClose: PropTypes.func.isRequired,
    /** Slot map with capacity data per squad/week */
    slotMap: PropTypes.object,
    /** Array of all resources */
    resources: PropTypes.array,
    /** Array of all projects */
    projects: PropTypes.array,
    /** Projects that have no squad assigned */
    unresourcedProjects: PropTypes.array,
    /** Standard project profile for slot calculations */
    slotProfile: PropTypes.object,
    /** Slot optimization settings */
    slotOptimization: PropTypes.object,
    /** Array of enabled squad names */
    enabledSquads: PropTypes.array,
    /** Handler for creating a draft with recommendations */
    onCreateDraft: PropTypes.func,
    /** Handler for applying changes directly to Airtable */
    onApplyLive: PropTypes.func,
    /** Handler for clicking a project (opens DetailModal) */
    onProjectClick: PropTypes.func,
    /** Initial mode: 'optimize' or 'bulk' */
    initialMode: PropTypes.oneOf(['optimize', 'bulk', 'capacity-relief', 'people', 'capacity', 'pareto', 'staffing']),
    /** Airtable base reference for AI integration */
    base: PropTypes.object,
    /** AI intelligence settings */
    aiIntelligence: PropTypes.shape({
        enabled: PropTypes.bool,
        tableId: PropTypes.string
    }),
    /** Application settings object */
    settings: PropTypes.object,
    /** Active squad filter */
    activeSquads: PropTypes.array
};
