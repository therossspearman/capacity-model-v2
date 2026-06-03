/**
 * Capacity Model v2 - Entry Point
 * 
 * Refactored modular architecture for Airtable Interface Extension
 */
import { initializeBlock, useBase, useGlobalConfig, useCustomProperties } from '@airtable/blocks/interface/ui';
import React, { useCallback } from 'react';

// Import Global Styles
import './style.css';

// Constants
import { SETTINGS } from './constants';

// Components
import { Dashboard, ErrorBoundary } from './components';

// Theme System
import { ThemeProvider } from './design-system';

/**
 * Main Application Component
 * Uses useCustomProperties to receive configuration from Interface Designer
 */
function CapacityApp() {
    const base = useBase();
    const globalConfig = useGlobalConfig();

    // Get tables from global config first (needed to build properties)
    const resTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.RESOURCES_TABLE));
    const projTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.PROJECTS_TABLE));
    const settingsTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.SETTINGS_TABLE));
    const scenariosTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.SCENARIOS_TABLE));
    const squadsTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.SQUADS_TABLE));
    const optRunsTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.OPTIMIZATION_RUNS_TABLE));
    const programsTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.PROGRAMS_TABLE));
    const financeForecastTable = base.getTableByIdIfExists(globalConfig.get(SETTINGS.FINANCE_FORECAST_TABLE));

    // Register custom properties with Interface Designer
    const { customPropertyValueByKey } = useCustomProperties(useCallback(() => {
        const props = [
            { key: SETTINGS.RESOURCES_TABLE, label: 'Resources', type: 'table' },
            { key: SETTINGS.PROJECTS_TABLE, label: 'Projects', type: 'table' },
            { key: SETTINGS.SETTINGS_TABLE, label: 'Settings', type: 'table' },
            { key: SETTINGS.SCENARIOS_TABLE, label: 'Scenarios', type: 'table' },
            { key: SETTINGS.SQUADS_TABLE, label: 'Squads', type: 'table' },
            { key: SETTINGS.OPTIMIZATION_RUNS_TABLE, label: 'Optimization Runs', type: 'table' },
            { key: SETTINGS.PROGRAMS_TABLE, label: 'Programs', type: 'table' },
            { key: SETTINGS.FINANCE_FORECAST_TABLE, label: 'Finance Forecasts', type: 'table' }
        ];

        // Resource table fields - ONLY add if table exists
        if (resTable) {
            props.push(
                { key: SETTINGS.WORKING_HOURS, label: 'Hours', type: 'field', table: resTable },
                { key: SETTINGS.TARGET_UTILIZATION, label: 'Utilization', type: 'field', table: resTable },
                { key: SETTINGS.START_DATE, label: 'Start', type: 'field', table: resTable },
                { key: SETTINGS.LEAVE_DATE, label: 'End', type: 'field', table: resTable },
                { key: SETTINGS.LEAVE_START_DATE, label: 'Leave Start Date', type: 'field', table: resTable },
                { key: SETTINGS.LEAVE_END_DATE, label: 'Leave End Date', type: 'field', table: resTable },
                { key: SETTINGS.SQUAD, label: 'Squad', type: 'field', table: resTable },
                { key: SETTINGS.FUNCTION, label: 'Function', type: 'field', table: resTable },
                { key: SETTINGS.RESOURCE_HEADSHOT, label: 'Headshot', type: 'field', table: resTable },
                { key: SETTINGS.RAMP_UP_PROFILE, label: 'Ramp Up Profile', type: 'field', table: resTable },
                { key: SETTINGS.RAMP_START_DATE, label: 'Ramp Start', type: 'field', table: resTable },
                { key: SETTINGS.COUNTRY, label: 'Country', type: 'field', table: resTable },
                { key: SETTINGS.AD_JOB_TITLE, label: 'AD Job Title', type: 'field', table: resTable },
                { key: SETTINGS.RAMP_PROFILE_UPDATE, label: 'Update Ramp Profile', type: 'field', table: resTable },
                { key: SETTINGS.RAMP_START_DATE_UPDATE, label: 'Update Ramp Start Date', type: 'field', table: resTable },
                { key: SETTINGS.RES_ENTITY, label: 'Resource Entity', type: 'field', table: resTable },
                { key: SETTINGS.ANNUAL_UTILIZATION, label: 'Annual Utilization (Presence Model)', type: 'field', table: resTable }
            );
        }

        // Project table fields - ONLY add if table exists
        if (projTable) {
            props.push(
                { key: SETTINGS.KICK_OFF, label: 'Kickoff', type: 'field', table: projTable },
                { key: SETTINGS.LAUNCH, label: 'Launch', type: 'field', table: projTable },
                { key: SETTINGS.UAT_START, label: 'UAT Start', type: 'field', table: projTable },
                { key: SETTINGS.STATUS, label: 'Status', type: 'field', table: projTable },
                { key: SETTINGS.PM_EFFORT, label: 'PM Effort', type: 'field', table: projTable },
                { key: SETTINGS.SC_EFFORT, label: 'SC Effort', type: 'field', table: projTable },
                { key: SETTINGS.PD_EFFORT, label: 'PD Effort', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_SQUAD, label: 'Proj Squad', type: 'field', table: projTable },
                { key: SETTINGS.PM_ALLOCATION, label: 'PM Alloc', type: 'field', table: projTable },
                { key: SETTINGS.SC_ALLOCATION, label: 'SC Alloc', type: 'field', table: projTable },
                { key: SETTINGS.PD_ALLOCATION, label: 'PD Alloc', type: 'field', table: projTable },
                { key: SETTINGS.ACTUAL_HOURS, label: 'Actuals', type: 'field', table: projTable },
                { key: SETTINGS.PERCENT_COMPLETE, label: '% Complete', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_WAVE, label: 'Wave', type: 'field', table: projTable },
                { key: SETTINGS.EFFORT_PROFILE, label: 'Effort Profile', type: 'field', table: projTable },
                { key: SETTINGS.CUSTOMER, label: 'Customer', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_COUNTRY, label: 'Project Country', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_COUNTRY_FLAG, label: 'Project Country Flag', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_PLATFORM, label: 'Project Platform', type: 'field', table: projTable },
                { key: SETTINGS.CUSTOMER_RISK, label: 'Customer Risk', type: 'field', table: projTable },
                { key: SETTINGS.COMPELLING_EVENT_DATE, label: 'Compelling Event Date', type: 'field', table: projTable },
                { key: SETTINGS.TRANSACTIONAL_BENEFITS, label: 'Transactional Benefits', type: 'field', table: projTable },
                { key: SETTINGS.NON_TRANSACTIONAL_BENEFITS, label: 'Non-Transactional Benefits', type: 'field', table: projTable },
                { key: SETTINGS.CONTENT_ONLY_BENEFITS, label: 'Content Only Benefits', type: 'field', table: projTable },
                { key: SETTINGS.TOTAL_EFFORT, label: 'Total Effort (Alt Model)', type: 'field', table: projTable },
                { key: SETTINGS.LANGUAGES, label: 'Languages', type: 'field', table: projTable },
                { key: SETTINGS.KICK_OFF_UPDATE, label: 'Update Kickoff', type: 'field', table: projTable },
                { key: SETTINGS.LAUNCH_UPDATE, label: 'Update Launch', type: 'field', table: projTable },
                { key: SETTINGS.STATUS_UPDATE, label: 'Update Status', type: 'field', table: projTable },
                { key: SETTINGS.PM_ALLOC_UPDATE, label: 'Update PM Alloc', type: 'field', table: projTable },
                { key: SETTINGS.SC_ALLOC_UPDATE, label: 'Update SC Alloc', type: 'field', table: projTable },
                { key: SETTINGS.PD_ALLOC_UPDATE, label: 'Update PD Alloc', type: 'field', table: projTable },
                { key: SETTINGS.PROJECT_SQUAD_UPDATE, label: 'Update Proj Squad', type: 'field', table: projTable },
                { key: SETTINGS.EFFORT_PROFILE_UPDATE, label: 'Update Effort Profile', type: 'field', table: projTable },
                { key: SETTINGS.UAT_START_UPDATE, label: 'Update UAT Start', type: 'field', table: projTable },
                { key: SETTINGS.WAVE_UPDATE, label: 'Update Wave (Proxy)', type: 'field', table: projTable },
                { key: SETTINGS.SELLING_ENTITY, label: 'Selling Entity', type: 'field', table: projTable },
                // Revenue Recognition (Financial Mode)
                { key: SETTINGS.REVENUE_MODEL, label: 'Revenue Model', type: 'field', table: projTable },
                { key: SETTINGS.IMPLEMENTATION_FEE, label: 'Implementation Fee (£)', type: 'field', table: projTable },
                { key: SETTINGS.ARR, label: 'ARR (£)', type: 'field', table: projTable },
                { key: SETTINGS.CONTRACT_ARR, label: 'Contract ARR (£)', type: 'field', table: projTable },
                { key: SETTINGS.DEAL_EFFICIENCY, label: 'Deal Efficiency (£/hr)', type: 'field', table: projTable },
                { key: SETTINGS.CONTRACT_EFFICIENCY, label: 'Country Efficiency (£/hr)', type: 'field', table: projTable },
                // Team Allocation Percentages (JSON text field)
                { key: SETTINGS.TEAM_ALLOCATIONS, label: 'Team Allocations', type: 'field', table: projTable },
                { key: SETTINGS.TEAM_ALLOCATIONS_UPDATE, label: 'Update Team Allocations', type: 'field', table: projTable },
                // Resourcing Override (number field)
                { key: SETTINGS.RESOURCING_OVERRIDE, label: 'Resourcing Override', type: 'field', table: projTable },
                { key: SETTINGS.RESOURCING_OVERRIDE_UPDATE, label: 'Update Resourcing Override', type: 'field', table: projTable },

                // Slot Optimization Fields
                { key: SETTINGS.SLOT_MULTIPLIER, label: 'Slot Multiplier', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_PRIORITY, label: 'Slot Priority', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_REGION_AFFINITY, label: 'Region Affinity', type: 'field', table: projTable },

                // Slot Lock Fields
                { key: SETTINGS.SLOT_LOCK_LAUNCH, label: 'Lock Launch', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_LOCK_SQUAD, label: 'Lock Squad', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_LOCK_RESOURCES, label: 'Lock Resources', type: 'field', table: projTable },

                // Slot Lock Update Proxies (Critical for Optimistic UI)
                { key: SETTINGS.SLOT_LOCK_LAUNCH_UPDATE, label: 'Update Lock Launch', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_LOCK_SQUAD_UPDATE, label: 'Update Lock Squad', type: 'field', table: projTable },
                { key: SETTINGS.SLOT_LOCK_RESOURCES_UPDATE, label: 'Update Lock Resources', type: 'field', table: projTable },

                // Program Resourcing
                { key: SETTINGS.RESOURCED_WITHIN_PROGRAM, label: 'Resourced Within Program', type: 'field', table: projTable },

                // BAU Feature: Project type and t-shirt sizing
                { key: SETTINGS.PROJECT_TYPE, label: 'Project Type', type: 'field', table: projTable },
                { key: SETTINGS.BAU_TSHIRT_SIZE, label: 'BAU T-Shirt Size', type: 'field', table: projTable },
                { key: SETTINGS.BAU_POD, label: 'BAU POD', type: 'field', table: projTable },

                // Resourcing Tracking (non-synced, direct write)
                { key: SETTINGS.RESOURCING_NOTES, label: 'Resourcing Notes', type: 'field', table: projTable },
                { key: SETTINGS.RESOURCED, label: 'Resourced', type: 'field', table: projTable }
            );
        }

        // Settings table fields - ONLY add if table exists
        if (settingsTable) {
            props.push(
                { key: SETTINGS.SETTINGS_JSON_FIELD, label: 'JSON Field', type: 'field', table: settingsTable },
                { key: SETTINGS.SETTINGS_JSON_FIELD_2, label: 'JSON Field 2', type: 'field', table: settingsTable },
                { key: SETTINGS.SETTINGS_JSON_FIELD_3, label: 'JSON Field 3', type: 'field', table: settingsTable }
            );
        }

        // Scenarios table fields - ONLY add if table exists
        if (scenariosTable) {
            props.push(
                { key: SETTINGS.SCENARIO_NAME, label: 'Scenario Name', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_DESCRIPTION, label: 'Scenario Description', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_CREATED_BY, label: 'Scenario Created By', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_IS_ACTIVE, label: 'Scenario Is Active', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_CHANGES_JSON, label: 'Scenario Changes JSON', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_CHANGES_JSON_2, label: 'Scenario Changes JSON 2', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_CHANGES_JSON_3, label: 'Scenario Changes JSON 3', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_METADATA_JSON, label: 'Scenario Metadata JSON', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_STATUS, label: 'Scenario Status', type: 'field', table: scenariosTable },
                // Results JSON fields (optimizer output, chunked across 6 fields)
                { key: SETTINGS.SCENARIO_RESULTS_JSON, label: 'Results JSON', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_RESULTS_JSON_2, label: 'Results JSON 2', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_RESULTS_JSON_3, label: 'Results JSON 3', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_RESULTS_JSON_4, label: 'Results JSON 4', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_RESULTS_JSON_5, label: 'Results JSON 5', type: 'field', table: scenariosTable },
                { key: SETTINGS.SCENARIO_RESULTS_JSON_6, label: 'Results JSON 6', type: 'field', table: scenariosTable }
            );
        }

        // Optimization Runs table fields - ONLY add if table exists
        if (optRunsTable) {
            props.push(
                { key: SETTINGS.OPT_RUN_TYPE, label: 'Run Type', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_RUN_DATE, label: 'Run Date', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_DATE_RANGE_START, label: 'Date Range Start', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_DATE_RANGE_END, label: 'Date Range End', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_PROJECTS_INPUT, label: 'Projects Input', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_PROJECTS_PLACED, label: 'Projects Placed', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_PROJECTS_UNPLACEABLE, label: 'Projects Unplaceable', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_AVG_DELAY_WEEKS, label: 'Avg Delay Weeks', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_TOTAL_ARR_AFFECTED, label: 'Total ARR Affected', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_BOTTLENECK_ROLE, label: 'Bottleneck Role', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_RUN_METRICS_JSON, label: 'Run Metrics JSON', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_STATUS, label: 'Opt Status', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_AI_INSIGHTS, label: 'AI Insights', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_RISK_LEVEL, label: 'Risk Level', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_NEXT_ACTIONS, label: 'Next Actions', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_AI_CONFIDENCE, label: 'AI Confidence', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_IMPACT_SUMMARY, label: 'Impact Summary', type: 'field', table: optRunsTable },
                // Monte Carlo Simulation Metrics
                { key: SETTINGS.OPT_ASSIGNED_COUNT, label: 'Assigned Count', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_SHIFTED_COUNT, label: 'Shifted Count', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_ROBUSTNESS_SCORE, label: 'Robustness Score', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_P10, label: 'P10', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_P50, label: 'P50', type: 'field', table: optRunsTable },
                { key: SETTINGS.OPT_P90, label: 'P90', type: 'field', table: optRunsTable }
            );
        }

        // Programs table fields - ONLY add if table exists
        if (programsTable) {
            props.push(
                { key: SETTINGS.PROGRAM_NAME, label: 'Program Name', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_CUSTOMER, label: 'Program Customer', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_MANAGER, label: 'Program Manager', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_PROJECTS, label: 'Program Projects', type: 'field', table: programsTable },

                // Workstream Resource Fields
                { key: SETTINGS.PROGRAM_WS_INTEGRATIONS, label: 'WS: Integrations', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_PAYROLL, label: 'WS: Payroll', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_CONSULTING, label: 'WS: Consulting', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_BEST_PRACTICE, label: 'WS: Best Practice', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_COMMS, label: 'WS: Comms', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_HOME, label: 'WS: Home', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_GOVERNANCE, label: 'WS: Governance', type: 'field', table: programsTable },

                // Workstream Proxy Update Fields
                { key: SETTINGS.PROGRAM_WS_INTEGRATIONS_UPDATE, label: 'WS Update: Integrations', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_PAYROLL_UPDATE, label: 'WS Update: Payroll', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_CONSULTING_UPDATE, label: 'WS Update: Consulting', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_BEST_PRACTICE_UPDATE, label: 'WS Update: Best Practice', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_COMMS_UPDATE, label: 'WS Update: Comms', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_HOME_UPDATE, label: 'WS Update: Home', type: 'field', table: programsTable },
                { key: SETTINGS.PROGRAM_WS_GOVERNANCE_UPDATE, label: 'WS Update: Governance', type: 'field', table: programsTable }
            );
        }

        // Finance Forecast table fields - ONLY add if table exists
        if (financeForecastTable) {
            props.push(
                { key: SETTINGS.FORECAST_NAME, label: 'Forecast Name', type: 'field', table: financeForecastTable },
                { key: SETTINGS.FORECAST_FY_START, label: 'FY Start Date', type: 'field', table: financeForecastTable },
                { key: SETTINGS.FORECAST_ARR_JSON, label: 'ARR JSON', type: 'field', table: financeForecastTable },
                { key: SETTINGS.FORECAST_PARAMETERS_JSON, label: 'Parameters JSON', type: 'field', table: financeForecastTable },
                { key: SETTINGS.FORECAST_IS_ACTIVE, label: 'Is Active', type: 'field', table: financeForecastTable },
                { key: SETTINGS.FORECAST_CREATED_BY, label: 'Created By', type: 'field', table: financeForecastTable }
            );
        }

        // Squads table fields - ONLY add if table exists
        if (squadsTable) {
            props.push(
                // BAU Feature: Squad category for capacity filtering
                { key: SETTINGS.SQUAD_CATEGORY, label: 'Squad Category', type: 'field', table: squadsTable },
                // Platform the squad is aligned to (drives the Platform menu filter)
                { key: SETTINGS.SQUAD_PLATFORM, label: 'Squad Platform', type: 'field', table: squadsTable }
            );
        }

        return props;
    }, [base, resTable, projTable, settingsTable, scenariosTable, squadsTable, optRunsTable, programsTable, financeForecastTable]));

    // Check if configured - require tables and at least the STATUS field
    if (!resTable || !projTable || !customPropertyValueByKey[SETTINGS.STATUS]) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
                <div style={{ textAlign: 'center', padding: '32px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxWidth: '400px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                        Configure Extension
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                        Please configure the tables and fields in the Interface Designer settings panel.
                    </p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Click the gear icon on this element to configure Resources, Projects, and required fields.
                    </p>
                </div>
            </div>
        );
    }

    // Main Dashboard
    return (
        <ErrorBoundary componentName="Dashboard">
            <Dashboard
                resTable={resTable}
                projTable={projTable}
                settingsTable={settingsTable}
                scenariosTable={scenariosTable}
                squadsTable={squadsTable}
                programsTable={programsTable}
                forecastTable={financeForecastTable}
                settings={customPropertyValueByKey}
                base={base}
                globalConfig={globalConfig}
            />
        </ErrorBoundary>
    );
}

// Initialize the Airtable Interface Extension
initializeBlock({
    interface: () => (
        <ThemeProvider>
            <ErrorBoundary componentName="Capacity Model">
                <CapacityApp />
            </ErrorBoundary>
        </ThemeProvider>
    )
});
