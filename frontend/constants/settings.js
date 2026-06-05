// App Version - Update this on every release
// AGENT NOTE: Always increment version when deploying changes
export const APP_VERSION = '2.99.020';

// Airtable Field Mappings
export const SETTINGS = {
    RESOURCES_TABLE: 'tbl_res_v8',
    PROJECTS_TABLE: 'tbl_proj_v8',
    TASKS_TABLE: 'tbl_tasks_v8',
    WORKING_HOURS: 'fld_hours_v8',
    TARGET_UTILIZATION: 'fld_util_v8',
    SQUAD: 'fld_squad_v8',
    FUNCTION: 'fld_func_v8',
    START_DATE: 'fld_start_v8',
    LEAVE_DATE: 'fld_leave_v8',
    LEAVE_START_DATE: 'fld_leave_start_v8',
    LEAVE_END_DATE: 'fld_leave_end_v8',
    KICK_OFF: 'fld_kick_v8',
    LAUNCH: 'fld_launch_v8',
    UAT_START: 'fld_uat_start',
    STATUS: 'fld_status_v8',
    PROJECT_SQUAD: 'fld_proj_squad_config',
    PM_EFFORT: 'fld_pm_v8',
    SC_EFFORT: 'fld_sc_v8',
    PD_EFFORT: 'fld_pd_v8',
    ACTUAL_HOURS: 'fld_proj_actuals',
    PERCENT_COMPLETE: 'fld_proj_pct_complete',
    PROJECT_WAVE: 'fld_project_wave',
    SPRINT_START: 'setting_sprint_start',
    PM_ALLOCATION: 'fld_pm_alloc',
    SC_ALLOCATION: 'fld_sc_alloc',
    PD_ALLOCATION: 'fld_pd_alloc',
    PM_ROLE: 'str_pm_role_v8',
    SC_ROLE: 'str_sc_role_v8',
    PD_ROLE: 'str_pd_role_v8',
    PROJECT_LEAD: 'fld_proj_lead_v8',
    TASK_PROJECT: 'fld_task_proj_v8',
    TASK_FUNCTION: 'fld_task_func_v8',
    TASK_ASSIGNEE: 'fld_task_user_v8',
    SETTINGS_TABLE: 'tbl_settings_storage',
    SETTINGS_JSON_FIELD: 'fld_settings_json',
    SETTINGS_JSON_FIELD_2: 'fld_settings_json_2',
    SETTINGS_JSON_FIELD_3: 'fld_settings_json_3',
    RESOURCE_HEADSHOT: 'fld_res_headshot_v8',
    RAMP_UP_PROFILE: 'fld_ramp_profile',
    RAMP_START_DATE: 'fld_ramp_start_date',
    EFFORT_PROFILE: 'fld_effort_profile',
    COUNTRY: 'fld_country',
    AD_JOB_TITLE: 'fld_ad_job_title',
    CUSTOMER: 'fld_customer',
    PROJECT_COUNTRY_FLAG: 'fld_project_country_flag',
    TRANSACTIONAL_BENEFITS: 'fld_transactional_benefits',
    NON_TRANSACTIONAL_BENEFITS: 'fld_non_transactional_benefits',
    CONTENT_ONLY_BENEFITS: 'fld_content_only_benefits',
    TOTAL_EFFORT: 'fld_total_effort',                           // Alternative Capacity Model: single total effort (hours × 3600)
    ANNUAL_UTILIZATION: 'fld_annual_utilization',               // Presence-Based Utilisation: annual % (e.g. 0.67 / 67) per resource — used for annual KPI
    LANGUAGES: 'fld_languages',

    // Multi-Company Support (Merger Planning)
    COMPANY: 'fld_company_of_origin',           // Resource's company of origin
    PROJECT_COMPANY: 'fld_project_company',      // Project's company of origin
    PROJECT_COUNTRY: 'fld_project_country',      // Project's Country (Text/Select)
    PROJECT_PLATFORM: 'fld_project_platform',    // Project's Platform (e.g. FPS, Benifex)

    // Entity Filter (V1 Parity)
    SELLING_ENTITY: 'fld_selling_entity',        // Project Field - "Selling Entity"
    RES_ENTITY: 'fld_res_entity',                // Resource Field - "Entity"

    // Revenue Recognition (Financial Mode)
    REVENUE_MODEL: 'fld_revenue_model',          // Project Field - "POC" or "Non-POC"
    IMPLEMENTATION_FEE: 'fld_impl_fee',          // Project Field - Implementation Fee (£)
    ARR: 'fld_arr',                              // Project Field - Annual Recurring Revenue (£)
    CONTRACT_ARR: 'fld_contract_arr',             // Project Field - Contract-level ARR (£) for blended scoring
    DEAL_EFFICIENCY: 'fld_deal_efficiency',        // Project Field - Deal Efficiency (£/hr)
    CONTRACT_EFFICIENCY: 'fld_contract_efficiency', // Project Field - Country Efficiency (£/hr)

    // Squads Table
    SQUADS_TABLE: 'tbl_squads',
    SQUAD_NAME: 'fld_squad_name',

    // Scenarios Table
    SCENARIOS_TABLE: 'tbl_scenarios',
    SCENARIO_NAME: 'fld_scenario_name',
    SCENARIO_DESCRIPTION: 'fld_scenario_description',
    SCENARIO_CREATED_BY: 'fld_scenario_created_by',
    SCENARIO_IS_ACTIVE: 'fld_scenario_is_active',
    SCENARIO_CHANGES_JSON: 'fld_scenario_changes_json',
    SCENARIO_CHANGES_JSON_2: 'fld_scenario_changes_json_2',
    SCENARIO_CHANGES_JSON_3: 'fld_scenario_changes_json_3',
    SCENARIO_METADATA_JSON: 'fld_scenario_metadata_json',
    SCENARIO_STATUS: 'fld_scenario_status',

    // Scenario Results JSON (optimizer output, chunked across 6 fields)
    SCENARIO_RESULTS_JSON: 'fld_scenario_results_json',
    SCENARIO_RESULTS_JSON_2: 'fld_scenario_results_json_2',
    SCENARIO_RESULTS_JSON_3: 'fld_scenario_results_json_3',
    SCENARIO_RESULTS_JSON_4: 'fld_scenario_results_json_4',
    SCENARIO_RESULTS_JSON_5: 'fld_scenario_results_json_5',
    SCENARIO_RESULTS_JSON_6: 'fld_scenario_results_json_6',

    // Programs Table (Program Resourcing Feature)
    PROGRAMS_TABLE: 'tbl_programs',
    PROGRAM_NAME: 'fld_program_name',
    PROGRAM_CUSTOMER: 'fld_program_customer',
    PROGRAM_MANAGER: 'fld_program_manager',
    PROGRAM_PROJECTS: 'fld_program_projects',            // Linked records to Projects

    // Program Workstream Fields (Linked Records to Resources)
    PROGRAM_WS_INTEGRATIONS: 'fld_program_integrations',
    PROGRAM_WS_PAYROLL: 'fld_program_payroll',
    PROGRAM_WS_CONSULTING: 'fld_program_consulting',
    PROGRAM_WS_BEST_PRACTICE: 'fld_program_best_practice',
    PROGRAM_WS_COMMS: 'fld_program_comms',
    PROGRAM_WS_HOME: 'fld_program_home',
    PROGRAM_WS_GOVERNANCE: 'fld_program_governance',

    // Program Workstream Proxy Updates (Text fields for automation)
    PROGRAM_WS_INTEGRATIONS_UPDATE: 'fld_program_integrations_update',
    PROGRAM_WS_PAYROLL_UPDATE: 'fld_program_payroll_update',
    PROGRAM_WS_CONSULTING_UPDATE: 'fld_program_consulting_update',
    PROGRAM_WS_BEST_PRACTICE_UPDATE: 'fld_program_best_practice_update',
    PROGRAM_WS_COMMS_UPDATE: 'fld_program_comms_update',
    PROGRAM_WS_HOME_UPDATE: 'fld_program_home_update',
    PROGRAM_WS_GOVERNANCE_UPDATE: 'fld_program_governance_update',

    // Project → Program Mapping
    RESOURCED_WITHIN_PROGRAM: 'fld_resourced_within_program',  // Checkbox on Projects table

    // Indirect Write-Back (Proxy Fields)
    KICK_OFF_UPDATE: 'fld_kick_update',
    LAUNCH_UPDATE: 'fld_launch_update',
    STATUS_UPDATE: 'fld_status_update',
    PM_ALLOC_UPDATE: 'fld_pm_alloc_update',
    SC_ALLOC_UPDATE: 'fld_sc_alloc_update',
    PD_ALLOC_UPDATE: 'fld_pd_alloc_update',
    PROJECT_SQUAD_UPDATE: 'fld_proj_squad_update_proxy',
    EFFORT_PROFILE_UPDATE: 'fld_effort_profile_update',
    UAT_START_UPDATE: 'fld_uat_start_update',
    WAVE_UPDATE: 'fld_wave_update',
    RAMP_PROFILE_UPDATE: 'fld_ramp_profile_update',
    START_DATE_UPDATE: 'fld_start_update',
    LEAVE_DATE_UPDATE: 'fld_leave_update_proxy',
    RAMP_START_DATE_UPDATE: 'fld_ramp_start_update',

    // Team Allocation Percentages (JSON text field)
    TEAM_ALLOCATIONS: 'fld_team_allocations',
    TEAM_ALLOCATIONS_UPDATE: 'fld_team_allocations_update',

    // Resourcing Override (overrides calculated effort values)
    RESOURCING_OVERRIDE: 'fld_resourcing_override',
    RESOURCING_OVERRIDE_UPDATE: 'fld_resourcing_override_update',

    // Slot Optimization Fields (Project Table)
    SLOT_MULTIPLIER: 'fld_slot_multiplier',          // Number: Project size as multiple of standard (1x, 2x, 5x)
    SLOT_LOCK_LAUNCH: 'fld_slot_lock_launch',        // Single Select: Fixed, Flexible
    SLOT_LOCK_SQUAD: 'fld_slot_lock_squad',          // Single Select: Fixed, Flexible
    SLOT_LOCK_RESOURCES: 'fld_slot_lock_resources',  // Single Select: Fixed, Flexible
    SLOT_PRIORITY: 'fld_slot_priority',              // Number: 1-10, higher = less movable
    SLOT_REGION_AFFINITY: 'fld_slot_region',         // Single Select: APAC, EMEA, AMER, Global

    // Lock Proxy Update Fields
    SLOT_LOCK_LAUNCH_UPDATE: 'fld_slot_lock_launch_update',
    SLOT_LOCK_SQUAD_UPDATE: 'fld_slot_lock_squad_update',
    SLOT_LOCK_RESOURCES_UPDATE: 'fld_slot_lock_resources_update',

    // Slot Intelligence Table (AI Field Agents)
    SLOT_INTELLIGENCE_TABLE: 'tbl_slot_intelligence',
    SLOT_INTEL_SNAPSHOT_TIME: 'fld_slot_intel_snapshot_time',  // Date/Time
    SLOT_INTEL_SQUAD_COUNT: 'fld_slot_intel_squad_count',      // Number
    SLOT_INTEL_TOTAL_SLOTS: 'fld_slot_intel_total_slots',      // Number
    SLOT_INTEL_OPEN_SLOTS: 'fld_slot_intel_open_slots',        // Number
    SLOT_INTEL_UTILIZATION_PCT: 'fld_slot_intel_util_pct',     // Number (percentage)
    SLOT_INTEL_BOTTLENECK: 'fld_slot_intel_bottleneck',        // Text
    SLOT_INTEL_HAS_CONSTRAINTS: 'fld_slot_intel_constraints',  // Checkbox
    SLOT_INTEL_SLOT_DATA: 'fld_slot_intel_slot_data',          // Long Text (JSON)
    SLOT_INTEL_SUMMARY: 'fld_slot_intel_summary',              // Long Text (JSON)
    SLOT_INTEL_INSIGHTS: 'fld_slot_intel_insights',            // Long Text (JSON)
    SLOT_INTEL_AI_ANALYSIS: 'fld_slot_intel_ai_analysis',      // AI Field (Text)
    SLOT_INTEL_AI_RECOMMENDATIONS: 'fld_slot_intel_ai_recs',   // AI Field (Text)

    // Optimization Runs Table (AI-Powered Capacity Recommendations)
    OPTIMIZATION_RUNS_TABLE: 'tbl_optimization_runs',
    OPT_RUN_TYPE: 'fld_opt_run_type',                          // Single Select: Capacity Relief, Scenario Planning
    OPT_RUN_DATE: 'fld_opt_run_date',                          // Date/Time
    OPT_DATE_RANGE_START: 'fld_opt_date_range_start',          // Date
    OPT_DATE_RANGE_END: 'fld_opt_date_range_end',              // Date
    OPT_PROJECTS_INPUT: 'fld_opt_projects_input',              // Number
    OPT_PROJECTS_PLACED: 'fld_opt_projects_placed',            // Number
    OPT_PROJECTS_UNPLACEABLE: 'fld_opt_projects_unplaceable',  // Number
    OPT_AVG_DELAY_WEEKS: 'fld_opt_avg_delay',                  // Number
    OPT_TOTAL_ARR_AFFECTED: 'fld_opt_arr_affected',            // Currency
    OPT_BOTTLENECK_ROLE: 'fld_opt_bottleneck_role',            // Single Select
    OPT_RUN_METRICS_JSON: 'fld_opt_metrics_json',              // Long Text (JSON)
    OPT_STATUS: 'fld_opt_status',                              // Single Select: Pending, Complete
    OPT_AI_INSIGHTS: 'fld_opt_ai_insights',                    // AI Field (Text)
    OPT_RISK_LEVEL: 'fld_opt_risk_level',                      // AI Field (Single Select)
    OPT_NEXT_ACTIONS: 'fld_opt_next_actions',                  // AI Field (Text)
    OPT_AI_CONFIDENCE: 'fld_opt_ai_confidence',                // AI Field (Text) - High/Medium/Low
    OPT_IMPACT_SUMMARY: 'fld_opt_impact_summary',              // AI Field (Text) - Executive one-liner

    // Monte Carlo Simulation Metrics
    OPT_ASSIGNED_COUNT: 'fld_opt_assigned_count',              // Number - Projects successfully assigned
    OPT_SHIFTED_COUNT: 'fld_opt_shifted_count',                // Number - Projects with date shifts
    OPT_ROBUSTNESS_SCORE: 'fld_opt_robustness_score',          // Number - Schedule robustness (0-100)
    OPT_P10: 'fld_opt_p10',                                    // Number - 10th percentile completion
    OPT_P50: 'fld_opt_p50',                                    // Number - Median (50th percentile)
    OPT_P90: 'fld_opt_p90',                                    // Number - 90th percentile completion

    // BAU (Business As Usual) Capacity Planning
    PROJECT_TYPE: 'fld_project_type',                          // Single Select: Implementation, Change Request
    BAU_TSHIRT_SIZE: 'fld_bau_tshirt_size',                    // Single Select: XXS, XS, S, M, L, XL, XXL
    SQUAD_CATEGORY: 'fld_squad_category',                      // Single Select: Implementation, BAU, Both
    SQUAD_PLATFORM: 'fld_squad_platform',                      // Single Select on the Squad table: platform the squad is aligned to (e.g. Benifex, FPS)
    BAU_HOURS_MAPPING: 'fld_bau_hours_mapping',                // Long Text (JSON) - Maps T-shirt sizes to hours/year
    BAU_POD: 'fld_bau_pod',                                    // Linked record (Projects → Pods): the BAU pod a project's ongoing support is assigned to

    // Portfolio Reprioritization Fields (Project Table)
    CUSTOMER_RISK: 'fld_customer_risk',                        // Single Select: High, Medium, Low, Served Notice, Verbal
    COMPELLING_EVENT_DATE: 'fld_compelling_event_date',         // Date: Deadline by which project must be live

    // Resourcing Tracking (non-synced, direct write)
    RESOURCING_NOTES: 'fld_resourcing_notes',                  // Project Field - Rich text resourcing notes
    RESOURCED: 'fld_resourced',                                // Project Field - Checkbox (is project resourced?)

    // Finance Forecast Table (Sales → Capacity Planning)
    FINANCE_FORECAST_TABLE: 'tbl_finance_forecasts',
    FORECAST_NAME: 'fld_forecast_name',                        // Text: Scenario name (e.g., "FY27 Budget V1")
    FORECAST_FY_START: 'fld_forecast_fy_start',                // Date: First day of financial year
    FORECAST_ARR_JSON: 'fld_forecast_arr_json',                // Long Text (JSON): { Q1: { global: X, uk: Y, de: Z }, ... }
    FORECAST_PARAMETERS_JSON: 'fld_forecast_params_json',      // Long Text (JSON): Modeling params per market
    FORECAST_IS_ACTIVE: 'fld_forecast_is_active',              // Checkbox: Display on chart
    FORECAST_CREATED_BY: 'fld_forecast_created_by',            // Collaborator
    FORECAST_MARKET_FIELD: 'fld_market'                        // Project field: Market segmentation (Global/UK/Germany)
};

// View Configuration
export const VIEW_CONFIG = {
    weekly: { label: 'Weekly', monthsBack: 1, monthsForward: 3, granularity: 'week' },
    sprint: { label: 'Sprint', monthsBack: 1, monthsForward: 4, granularity: 'sprint' },
    monthly: { label: 'Monthly', monthsBack: 2, monthsForward: 8, granularity: 'month' },
    custom: { label: 'Custom', monthsBack: 0, monthsForward: 0, granularity: 'week' },
};

// Layout Constants
export const FY_START_MONTH = 4; // 0-indexed JS month (0=Jan..4=May). Compare against Date.getMonth() / pass to new Date(y, FY_START_MONTH, 1).
export const SIDEBAR_WIDTH = 260;
export const ROW_HEIGHT = 42;
export const BUFFER = 10;

// Time Constants
export const TIME_CONSTANTS = {
    SECONDS_PER_HOUR: 3600
};
