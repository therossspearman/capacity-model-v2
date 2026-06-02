import { DEFAULT_SETTINGS } from '../constants';

/**
 * Dashboard state action types
 */
export const ACTIONS = {
    // UI State
    SET_VIEW_KEY: 'SET_VIEW_KEY',
    SET_VIEW_MODE: 'SET_VIEW_MODE',
    SET_TIME_RANGE: 'SET_TIME_RANGE',
    SET_CUSTOM_DATES: 'SET_CUSTOM_DATES',
    SET_SELECTED_SQUADS: 'SET_SELECTED_SQUADS',
    SET_SELECTED_CATEGORY: 'SET_SELECTED_CATEGORY',
    SET_FORECAST_MODE: 'SET_FORECAST_MODE',
    SET_CELL_DISPLAY_MODE: 'SET_CELL_DISPLAY_MODE',
    SET_ZOOM_LEVEL: 'SET_ZOOM_LEVEL',
    SET_GROUP_BY: 'SET_GROUP_BY',
    SET_SORT_BY: 'SET_SORT_BY',
    SET_RESOURCE_SEARCH: 'SET_RESOURCE_SEARCH',
    SET_HIGHLIGHT_PROJECT: 'SET_HIGHLIGHT_PROJECT',
    SET_EXCEPTIONS_ONLY: 'SET_EXCEPTIONS_ONLY',
    SET_FISCAL_YEAR_MODE: 'SET_FISCAL_YEAR_MODE',
    SET_DEMAND_CATEGORY: 'SET_DEMAND_CATEGORY',

    // Modal State
    SHOW_MODAL: 'SHOW_MODAL',
    HIDE_MODAL: 'HIDE_MODAL',
    HIDE_ALL_MODALS: 'HIDE_ALL_MODALS',

    // Selected Items
    SET_SELECTED_BUCKET: 'SET_SELECTED_BUCKET',
    SET_SELECTED_RESOURCE: 'SET_SELECTED_RESOURCE',
    SET_SELECTED_PROJECTS: 'SET_SELECTED_PROJECTS',
    TOGGLE_PROJECT_SELECTION: 'TOGGLE_PROJECT_SELECTION',
    CLEAR_PROJECT_SELECTION: 'CLEAR_PROJECT_SELECTION',

    // Scenario State
    SET_SCENARIOS: 'SET_SCENARIOS',
    SET_ACTIVE_SCENARIO: 'SET_ACTIVE_SCENARIO',
    SET_LOADING_SCENARIO: 'SET_LOADING_SCENARIO',
    SET_CONFLICT_DATA: 'SET_CONFLICT_DATA',
    SET_PENDING_SCENARIO_ID: 'SET_PENDING_SCENARIO_ID',

    // Settings
    SET_STORED_SETTINGS: 'SET_STORED_SETTINGS',

    // Pending Updates (optimistic UI)
    ADD_PENDING_UPDATE: 'ADD_PENDING_UPDATE',
    REMOVE_PENDING_UPDATE: 'REMOVE_PENDING_UPDATE',

    // Toasts
    ADD_TOAST: 'ADD_TOAST',
    REMOVE_TOAST: 'REMOVE_TOAST',
};

/**
 * Modal types
 */
export const MODALS = {
    SETTINGS: 'settings',
    SHORTCUTS: 'shortcuts',
    DOCS: 'docs',
    TOUR: 'tour',
    CREATE_SCENARIO: 'createScenario',
    COMMIT_SCENARIO: 'commitScenario',
    NOTES: 'notes',
    COPY_SCENARIO: 'copyScenario',
    COMPARE_SCENARIOS: 'compareScenarios',
    DISCARD_SCENARIO: 'discardScenario',
    SCENARIO_LIST: 'scenarioList',
    BATCH_UPDATE: 'batchUpdate',
    AUDITOR: 'auditor',
    UTIL_BREAKDOWN: 'utilBreakdown',
};

/**
 * Get initial state with localStorage persistence
 */
const getInitialState = () => {
    const getLocal = (key, fallback) => {
        try {
            const stored = localStorage.getItem(key);
            return stored !== null ? JSON.parse(stored) : fallback;
        } catch (err) {
            console.warn(`Failed to read ${key} from localStorage:`, err);
            return fallback;
        }
    };

    const getLocalString = (key, fallback) => {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (err) {
            console.warn(`Failed to read ${key} from localStorage:`, err);
            return fallback;
        }
    };

    return {
        // View Settings
        viewKey: 'weekly',
        viewMode: getLocalString('capacityViewMode', 'resources'),
        timeRange: getLocalString('capacityTimeRange', '1y'),
        customStartDate: getLocalString('customStartDate', ''),
        customEndDate: getLocalString('customEndDate', ''),
        selectedSquads: getLocal('capacitySelectedSquads', []),
        selectedCategory: getLocalString('capacitySelectedCategory', 'All'),
        forecastMode: getLocalString('capacityForecastMode', 'allocation'),
        cellDisplayMode: getLocalString('capacityCellDisplayMode', 'hours'),
        zoomLevel: 'comfortable',
        groupBy: 'squad',
        sortBy: 'name',
        resourceSearch: '',
        highlightProject: '',
        exceptionsOnly: false,
        fiscalYearMode: false,
        demandCategory: getLocalString('capacityDemandCategory', 'all'), // 'all' | 'implementation' | 'bau'

        // Modal State (object to track which modals are open)
        modals: {},

        // Selected Items
        selectedBucket: null,
        selectedResourceId: null,
        selectedProjects: new Set(),

        // Scenario State
        scenarios: [],
        activeScenario: null,
        isLoadingScenario: false,
        conflictData: null,
        pendingScenarioId: null,
        copySource: null,
        deleteScenarioId: null,

        // Settings
        storedSettings: DEFAULT_SETTINGS,

        // Pending Updates (optimistic UI)
        pendingUpdates: {},

        // Toasts
        toasts: [],

        // Status Order (for chart)
        statusOrder: [],
    };
};

/**
 * Dashboard state reducer
 */
export const dashboardReducer = (state, action) => {
    switch (action.type) {
        // View Settings
        case ACTIONS.SET_VIEW_KEY:
            return { ...state, viewKey: action.payload };
        case ACTIONS.SET_VIEW_MODE:
            localStorage.setItem('capacityViewMode', action.payload);
            return { ...state, viewMode: action.payload };
        case ACTIONS.SET_TIME_RANGE:
            localStorage.setItem('capacityTimeRange', action.payload);
            return { ...state, timeRange: action.payload };
        case ACTIONS.SET_CUSTOM_DATES:
            if (action.payload.start !== undefined) {
                localStorage.setItem('customStartDate', action.payload.start);
            }
            if (action.payload.end !== undefined) {
                localStorage.setItem('customEndDate', action.payload.end);
            }
            return {
                ...state,
                customStartDate: action.payload.start ?? state.customStartDate,
                customEndDate: action.payload.end ?? state.customEndDate,
            };
        case ACTIONS.SET_SELECTED_SQUADS:
            localStorage.setItem('capacitySelectedSquads', JSON.stringify(action.payload));
            return { ...state, selectedSquads: action.payload };
        case ACTIONS.SET_SELECTED_CATEGORY:
            localStorage.setItem('capacitySelectedCategory', action.payload);
            return { ...state, selectedCategory: action.payload };
        case ACTIONS.SET_FORECAST_MODE:
            localStorage.setItem('capacityForecastMode', action.payload);
            return { ...state, forecastMode: action.payload };
        case ACTIONS.SET_CELL_DISPLAY_MODE:
            localStorage.setItem('capacityCellDisplayMode', action.payload);
            return { ...state, cellDisplayMode: action.payload };
        case ACTIONS.SET_ZOOM_LEVEL:
            return { ...state, zoomLevel: action.payload };
        case ACTIONS.SET_GROUP_BY:
            return { ...state, groupBy: action.payload };
        case ACTIONS.SET_SORT_BY:
            return { ...state, sortBy: action.payload };
        case ACTIONS.SET_RESOURCE_SEARCH:
            return { ...state, resourceSearch: action.payload };
        case ACTIONS.SET_HIGHLIGHT_PROJECT:
            return { ...state, highlightProject: action.payload };
        case ACTIONS.SET_EXCEPTIONS_ONLY:
            return { ...state, exceptionsOnly: action.payload };
        case ACTIONS.SET_FISCAL_YEAR_MODE:
            return { ...state, fiscalYearMode: action.payload };
        case ACTIONS.SET_DEMAND_CATEGORY:
            localStorage.setItem('capacityDemandCategory', action.payload);
            return { ...state, demandCategory: action.payload };

        // Modal State
        case ACTIONS.SHOW_MODAL:
            return { ...state, modals: { ...state.modals, [action.payload]: true } };
        case ACTIONS.HIDE_MODAL:
            return { ...state, modals: { ...state.modals, [action.payload]: false } };
        case ACTIONS.HIDE_ALL_MODALS:
            return { ...state, modals: {} };

        // Selected Items
        case ACTIONS.SET_SELECTED_BUCKET:
            return { ...state, selectedBucket: action.payload };
        case ACTIONS.SET_SELECTED_RESOURCE:
            return { ...state, selectedResourceId: action.payload };
        case ACTIONS.SET_SELECTED_PROJECTS:
            return { ...state, selectedProjects: action.payload };
        case ACTIONS.TOGGLE_PROJECT_SELECTION: {
            const newSet = new Set(state.selectedProjects);
            if (newSet.has(action.payload)) {
                newSet.delete(action.payload);
            } else {
                newSet.add(action.payload);
            }
            return { ...state, selectedProjects: newSet };
        }
        case ACTIONS.CLEAR_PROJECT_SELECTION:
            return { ...state, selectedProjects: new Set() };

        // Scenario State
        case ACTIONS.SET_SCENARIOS:
            return { ...state, scenarios: action.payload };
        case ACTIONS.SET_ACTIVE_SCENARIO:
            return { ...state, activeScenario: action.payload };
        case ACTIONS.SET_LOADING_SCENARIO:
            return { ...state, isLoadingScenario: action.payload };
        case ACTIONS.SET_CONFLICT_DATA:
            return { ...state, conflictData: action.payload };
        case ACTIONS.SET_PENDING_SCENARIO_ID:
            return { ...state, pendingScenarioId: action.payload };

        // Settings
        case ACTIONS.SET_STORED_SETTINGS:
            return { ...state, storedSettings: action.payload };

        // Pending Updates
        case ACTIONS.ADD_PENDING_UPDATE:
            return {
                ...state,
                pendingUpdates: {
                    ...state.pendingUpdates,
                    [action.payload.id]: {
                        ...(state.pendingUpdates[action.payload.id] || {}),
                        ...action.payload.updates,
                        timestamp: Date.now()
                    }
                }
            };
        case ACTIONS.REMOVE_PENDING_UPDATE: {
            const { [action.payload]: removed, ...remaining } = state.pendingUpdates;
            return { ...state, pendingUpdates: remaining };
        }

        // Toasts
        case ACTIONS.ADD_TOAST:
            return {
                ...state,
                toasts: [...state.toasts, { id: Date.now(), ...action.payload }]
            };
        case ACTIONS.REMOVE_TOAST:
            return {
                ...state,
                toasts: state.toasts.filter(t => t.id !== action.payload)
            };

        default:
            return state;
    }
};

export { getInitialState };
export default dashboardReducer;
