/**
 * OptimizationRunService - Manages optimization run records with Airtable AI integration
 * Creates records for each optimization run, reads AI insights after processing
 * 
 * Field names are now configurable via Custom Properties in Interface Designer
 */

import { SETTINGS } from '../constants';

/**
 * Create an optimization run record and get AI insights
 * @param {Object} base - Airtable base instance
 * @param {Object} runData - Optimization run data
 * @param {Object} settings - Custom property settings from Interface Designer
 * @returns {Promise<Object>} - { runId, aiInsights, riskLevel, nextActions }
 */
export async function createOptimizationRun(base, runData, settings = {}) {
    const {
        runType = 'Capacity Relief',
        dateRangeStart,
        dateRangeEnd,
        projectsInput = 0,
        projectsPlaced = 0,
        projectsUnplaceable = 0,
        avgDelayWeeks = 0,
        totalArrAffected = 0,
        bottleneckRole = 'None',
        metricsJson = {},
        // Monte Carlo metrics
        assignedCount = 0,
        shiftedCount = 0,
        robustnessScore = null,
        p10 = null,
        p50 = null,
        p90 = null
    } = runData;

    try {
        // Priority order (Custom Properties FIRST, then Settings Modal):
        // 1. settings[SETTINGS.OPTIMIZATION_RUNS_TABLE] (Interface Designer - Custom Properties)
        // 2. aiIntelligence.tableId (Global Config - Settings Modal)
        // 3. Fallback to name 'Optimization Runs'
        let table;

        // Check if aiIntelligence was passed in settings or as a property of settings
        const aiConfig = settings?.aiIntelligence || {};

        // Custom Properties table setting might be a Table object - extract ID
        const mappedTableSetting = settings?.[SETTINGS.OPTIMIZATION_RUNS_TABLE];
        const mappedTableId = mappedTableSetting && typeof mappedTableSetting === 'object' && mappedTableSetting.id
            ? mappedTableSetting.id
            : mappedTableSetting;

        // Priority 1: Custom Properties (Interface Designer)
        if (mappedTableId) {
            table = base.getTableByIdIfExists(mappedTableId);
        }

        // Priority 2: aiIntelligence from Settings Modal
        if (!table && aiConfig.tableId) {
            table = base.getTableByIdIfExists(aiConfig.tableId);
        }

        if (!table) {
            // Fallback: try to get by name
            table = base.getTableIfExists('Optimization Runs');
        }

        if (!table) {
            console.warn('[OptimizationRun] Table not found. Configure "Optimization Runs" in Custom Properties.');
            return {
                runId: null,
                aiInsights: null,
                riskLevel: null,
                nextActions: null,
                hasAiData: false,
                error: 'Optimization Runs table not configured'
            };
        }

        // Create a map of trimmed field names to actual field names (handles whitespace issues)
        const fieldMap = {};
        table.fields.forEach(f => {
            fieldMap[f.name.trim()] = f.name;  // Map trimmed -> actual
        });
        const availableFields = Object.keys(fieldMap);


        // Get mapped field names from settings - fallback to defaults if not configured
        const getFieldName = (settingKey, defaultName) => {
            const settingValue = settings[settingKey];
            if (settingValue) {
                // Settings might contain Field objects (from Custom Properties) - extract ID
                const fieldId = typeof settingValue === 'object' && settingValue.id
                    ? settingValue.id
                    : settingValue;
                // Find field by ID
                const field = table.fields.find(f => f.id === fieldId);
                return field?.name || defaultName;
            }
            return defaultName;
        };

        // Field name mappings (from settings or defaults)
        const FIELD_NAMES = {
            runType: getFieldName(SETTINGS.OPT_RUN_TYPE, 'Run Type'),
            runDate: getFieldName(SETTINGS.OPT_RUN_DATE, 'Run Date'),
            dateRangeStart: getFieldName(SETTINGS.OPT_DATE_RANGE_START, 'Date Range Start'),
            dateRangeEnd: getFieldName(SETTINGS.OPT_DATE_RANGE_END, 'Date Range End'),
            projectsInput: getFieldName(SETTINGS.OPT_PROJECTS_INPUT, 'Projects Input'),
            projectsPlaced: getFieldName(SETTINGS.OPT_PROJECTS_PLACED, 'Projects Placed'),
            projectsUnplaceable: getFieldName(SETTINGS.OPT_PROJECTS_UNPLACEABLE, 'Projects Unplaceable'),
            avgDelay: getFieldName(SETTINGS.OPT_AVG_DELAY_WEEKS, 'Avg Delay Weeks'),
            arrAffected: getFieldName(SETTINGS.OPT_TOTAL_ARR_AFFECTED, 'Total ARR Affected'),
            bottleneckRole: getFieldName(SETTINGS.OPT_BOTTLENECK_ROLE, 'Bottleneck Role'),
            metricsJson: getFieldName(SETTINGS.OPT_RUN_METRICS_JSON, 'Run Metrics JSON'),
            status: getFieldName(SETTINGS.OPT_STATUS, 'Status'),
            aiInsights: getFieldName(SETTINGS.OPT_AI_INSIGHTS, 'AI Insights'),
            riskLevel: getFieldName(SETTINGS.OPT_RISK_LEVEL, 'Risk Level'),
            nextActions: getFieldName(SETTINGS.OPT_NEXT_ACTIONS, 'Next Actions'),
            // Monte Carlo metrics
            assignedCount: getFieldName(SETTINGS.OPT_ASSIGNED_COUNT, 'Assigned Count'),
            shiftedCount: getFieldName(SETTINGS.OPT_SHIFTED_COUNT, 'Shifted Count'),
            robustnessScore: getFieldName(SETTINGS.OPT_ROBUSTNESS_SCORE, 'Robustness Score'),
            p10: getFieldName(SETTINGS.OPT_P10, 'P10'),
            p50: getFieldName(SETTINGS.OPT_P50, 'P50'),
            p90: getFieldName(SETTINGS.OPT_P90, 'P90')
        };


        // Build record dynamically based on available fields
        const recordData = {};

        // Helper to add field if it exists (uses fuzzy matching with trim)
        const addField = (name, value) => {
            const actualFieldName = fieldMap[name.trim()];  // Look up actual name
            const hasValue = value !== undefined && value !== null;
            if (actualFieldName && hasValue) {
                recordData[actualFieldName] = value;  // Use actual field name from Airtable
            }
        };

        // Add fields that exist using mapped names
        addField(FIELD_NAMES.runType, runType ? { name: runType } : null);
        addField(FIELD_NAMES.dateRangeStart, dateRangeStart ? new Date(dateRangeStart) : null);
        addField(FIELD_NAMES.dateRangeEnd, dateRangeEnd ? new Date(dateRangeEnd) : null);
        addField(FIELD_NAMES.projectsInput, projectsInput);
        addField(FIELD_NAMES.projectsPlaced, projectsPlaced);
        addField(FIELD_NAMES.projectsUnplaceable, projectsUnplaceable);
        addField(FIELD_NAMES.avgDelay, avgDelayWeeks);
        addField(FIELD_NAMES.arrAffected, totalArrAffected);
        addField(FIELD_NAMES.bottleneckRole, bottleneckRole && bottleneckRole !== 'None' ? { name: bottleneckRole } : null);
        addField(FIELD_NAMES.metricsJson, JSON.stringify(metricsJson, null, 2));
        addField(FIELD_NAMES.status, { name: 'Complete' });
        addField(FIELD_NAMES.runDate, new Date());
        // Monte Carlo metrics
        addField(FIELD_NAMES.assignedCount, assignedCount);
        addField(FIELD_NAMES.shiftedCount, shiftedCount);
        addField(FIELD_NAMES.robustnessScore, robustnessScore);
        addField(FIELD_NAMES.p10, p10);
        addField(FIELD_NAMES.p50, p50);
        addField(FIELD_NAMES.p90, p90);
        // Create record with available fields
        const recordId = await table.createRecordAsync(recordData);


        // Return immediately - UI will update via useRecords hook when AI fields populate
        return {
            runId: recordId,
            aiInsights: null,
            riskLevel: null,
            nextActions: null,
            hasAiData: false, // UI handles loading state via useRecords
            recordCreated: true
        };
    } catch (error) {
        console.error('[OptimizationRun] Failed to create/read:', error);
        return {
            runId: null,
            aiInsights: null,
            riskLevel: null,
            nextActions: null,
            hasAiData: false,
            error: error.message
        };
    }
}

/**
 * Check if Optimization Runs table exists
 * @param {Object} base - Airtable base instance
 * @param {Object} settings - Custom property settings (optional)
 * @returns {boolean}
 */
export function hasOptimizationRunsTable(base, settings = {}) {
    try {
        // First check if table is mapped in settings.
        // Custom Properties may deliver a Table OBJECT (not a string id) - extract the id.
        const mappedTableSetting = settings[SETTINGS.OPTIMIZATION_RUNS_TABLE];
        const mappedTableId = mappedTableSetting && typeof mappedTableSetting === 'object' && mappedTableSetting.id
            ? mappedTableSetting.id
            : mappedTableSetting;
        if (mappedTableId) {
            const table = base.getTableByIdIfExists(mappedTableId);
            if (table) return true;
        }

        // Fallback: check by name
        const tables = base.tables.map(t => t.name);
        return tables.includes('Optimization Runs');
    } catch {
        return false;
    }
}

/**
 * Get the Optimization Runs table reference
 * @param {Object} base - Airtable base instance
 * @param {Object} settings - Custom property settings (optional)
 * @returns {Object|null} - Table reference or null
 */
export function getOptimizationRunsTable(base, settings = {}) {
    try {
        // First check if table is mapped in settings.
        // Custom Properties may deliver a Table OBJECT (not a string id) - extract the id.
        const mappedTableSetting = settings[SETTINGS.OPTIMIZATION_RUNS_TABLE];
        const mappedTableId = mappedTableSetting && typeof mappedTableSetting === 'object' && mappedTableSetting.id
            ? mappedTableSetting.id
            : mappedTableSetting;
        if (mappedTableId) {
            const table = base.getTableByIdIfExists(mappedTableId);
            if (table) return table;
        }

        // Fallback: get by name
        return base.getTableIfExists('Optimization Runs');
    } catch {
        return null;
    }
}
