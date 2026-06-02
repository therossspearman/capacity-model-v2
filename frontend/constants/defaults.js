// Default Settings Configuration
export const DEFAULT_SETTINGS = {
    roleMapping: {},
    activeSquads: [],
    sprintStartDate: null,
    thresholds: { greenStart: 0.8, redStart: 1.0 },
    capacityBuffer: 10,
    pinnedResources: [],
    rampProfiles: [],
    winRates: {
        'pipeline - best': 0.25,
        'pipeline - commit': 0.75
    },
    // Role Configuration System - Primary/Secondary roles for slot modeling
    // jobs: { "Job Title": { primary: "PM"|"SC"|"Build", secondary: ["SC", "Build"] } }
    // constraints: { "SC": { requiresPrimaryFor: ["PM"] } }
    roleConfig: {
        jobs: {},
        constraints: {}
    },
    // Slot Optimization Profile (Phase 1)
    slotProfile: {
        pmHours: 40,        // PM hours for 1x standard project
        scHours: 120,       // SC hours for 1x standard project
        buildHours: 80,     // Build/PD hours for 1x standard project
        durationWeeks: 12,  // Typical project duration
        maxAssigneesPerRole: 2  // Max people per role to fulfill
    },
    // Slot Optimization Settings
    slotOptimization: {
        priorityDial: 50,           // 0 = Max Slots, 100 = Min Disruption
        reserveEnabled: false,
        reservePerMonth: 2,
        reserveStartOffset: 2,      // Start reserving X months ahead
        reserveProtectedMonths: 6,  // Protect next 6 months
        // Enhanced optimization settings
        maxCompression: 4,          // Max weeks a project can be pulled earlier
        maxExpansion: 8,            // Max weeks a project can be delayed
        capacityBuffer: 0,          // -10 to +10 (under/over capacity target %)
        allowSquadMoves: true,      // Allow cross-squad suggestions
        allowResourceSwaps: false,   // Allow resource rebalancing suggestions
        maxForwardWeeks: 4          // Max weeks to extend forward before extending backward
    },
    // AI Intelligence Settings (Airtable Field Agents)
    aiIntelligence: {
        tableId: null,              // Target table for slot snapshots
        enabled: false,             // Enable AI analysis
        autoSync: false,            // Auto-sync on data change
        lastSyncTime: null          // Last snapshot timestamp
    },

    // Program Resourcing Settings
    programDiscount: 15,            // % of effort transferred to program (default 15%)
    programEfficiencyFactor: 0,     // Efficiency gain % (default 0%, future use)
    programWorkstreams: [
        { name: 'Program Governance', allocationPct: 15 },
        { name: 'Integrations', allocationPct: 10 },
        { name: 'Payroll', allocationPct: 10 },
        { name: 'Consulting', allocationPct: 25 },
        { name: 'Best Practice', allocationPct: 25 },
        { name: 'Comms & Branding', allocationPct: 5 },
        { name: 'Homepage', allocationPct: 5 }
    ],
    programAssignments: [],         // { programId, resourceId, workstream, startDate, endDate, allocationPct }

    // Alternative Capacity Model
    // 'standard'    → reads PM_EFFORT, SC_EFFORT, PD_EFFORT as separate per-role fields
    // 'alternative' → reads TOTAL_EFFORT and splits it using alternativeRoleMix below
    //
    // alternativeRoleMix supports three storage shapes (all backward compatible):
    //   1. Legacy flat   : { pm, sc, pd }                              ← treated as default mix
    //   2. Typed         : { default, byProjectType: { type: mix } }   ← old type-only overrides
    //   3. Typed+platform: { default, byTypePlatform: [ { type, platform, mix }, ... ] } ← current
    //
    // Lookup priority at runtime: exact (type, platform) → (type, '*' = any platform) → default.
    activeCapacityModel: 'standard',
    alternativeRoleMix: { pm: 30, sc: 30, pd: 40 },

    // Capacity Utilisation Model
    // 'annualised' → flat per-week cap = workingHours × annualUtilization (the 67%-style number
    //                from ANNUAL_UTILIZATION field — vacation/holidays/sick already folded in).
    //                No leave-week skipping (vacation is already discounted at the annual %).
    // 'agw'         → Any Given Week. Per-week cap = daysPresent × (workingHours/5) × weeklyProductivity
    //                 (the 80% productivity × days actually at work). Leave honoured per-day.
    //
    // Legacy values 'field' and 'presence' are accepted as aliases of 'annualised' and 'agw' respectively.
    capacityUtilizationModel: 'annualised',

    // ── Hypercare config lives under modelParams.{domesticProfile|roleSpecificProfile}.
    // Two modes (mode-default = 'fixed' for backward compat with existing data):
    //   { hypercareMode: 'fixed',   hypercareWeeks, hypercareHoursPerWeek }       → flat hrs/week regardless of project size
    //   { hypercareMode: 'percent', hypercareWeeks, hypercarePercentPerWeek }     → hrs/week = totalProjectEffort × pct/100
    // The worker reads the active mode and computes the per-week hypercare hours accordingly.
    //
    // ── Presence-mode tunables live under modelParams.presenceModel:
    //   { weeklyProductivityDefault: 80 }  → fallback % when a resource has no TARGET_UTILIZATION value
    //
    // ── Direct field writes (Airtable API now supports writing synced fields directly).
    //   true  → write to canonical fields (LAUNCH, STATUS, PROJECT_SQUAD, …) — no automation latency
    //   false → legacy: write to *_UPDATE proxy fields, rely on Airtable Automation to copy through
    // Toggle to false in Settings if a write breaks — gives instant rollback without redeploy.
    useDirectFieldWrites: true
};
