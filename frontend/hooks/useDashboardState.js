import { useReducer, useCallback } from 'react';
import { dashboardReducer, getInitialState, ACTIONS, MODALS } from '../state';

/**
 * Custom hook for Dashboard state management
 * Provides centralized state and dispatch with helper functions
 */
export const useDashboardState = () => {
    const [state, dispatch] = useReducer(dashboardReducer, undefined, getInitialState);

    // Toast Management
    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        dispatch({ type: ACTIONS.ADD_TOAST, payload: { message, type } });
        setTimeout(() => {
            dispatch({ type: ACTIONS.REMOVE_TOAST, payload: id });
        }, 3000);
    }, []);

    // Modal Management
    const showModal = useCallback((modalName) => {
        dispatch({ type: ACTIONS.SHOW_MODAL, payload: modalName });
    }, []);

    const hideModal = useCallback((modalName) => {
        dispatch({ type: ACTIONS.HIDE_MODAL, payload: modalName });
    }, []);

    const hideAllModals = useCallback(() => {
        dispatch({ type: ACTIONS.HIDE_ALL_MODALS });
    }, []);

    // View Controls
    const setViewMode = useCallback((mode) => {
        dispatch({ type: ACTIONS.SET_VIEW_MODE, payload: mode });
    }, []);

    const setViewKey = useCallback((key) => {
        dispatch({ type: ACTIONS.SET_VIEW_KEY, payload: key });
    }, []);

    const setTimeRange = useCallback((range) => {
        dispatch({ type: ACTIONS.SET_TIME_RANGE, payload: range });
    }, []);

    const setSelectedSquads = useCallback((squads) => {
        dispatch({ type: ACTIONS.SET_SELECTED_SQUADS, payload: squads });
    }, []);

    const setForecastMode = useCallback((mode) => {
        dispatch({ type: ACTIONS.SET_FORECAST_MODE, payload: mode });
    }, []);

    const setCellDisplayMode = useCallback((mode) => {
        dispatch({ type: ACTIONS.SET_CELL_DISPLAY_MODE, payload: mode });
    }, []);

    const setZoomLevel = useCallback((level) => {
        dispatch({ type: ACTIONS.SET_ZOOM_LEVEL, payload: level });
    }, []);

    const setResourceSearch = useCallback((search) => {
        dispatch({ type: ACTIONS.SET_RESOURCE_SEARCH, payload: search });
    }, []);

    // Selection Management
    const setSelectedBucket = useCallback((bucket) => {
        dispatch({ type: ACTIONS.SET_SELECTED_BUCKET, payload: bucket });
    }, []);

    const setSelectedResource = useCallback((resourceId) => {
        dispatch({ type: ACTIONS.SET_SELECTED_RESOURCE, payload: resourceId });
    }, []);

    const toggleProjectSelection = useCallback((projectId) => {
        dispatch({ type: ACTIONS.TOGGLE_PROJECT_SELECTION, payload: projectId });
    }, []);

    const clearProjectSelection = useCallback(() => {
        dispatch({ type: ACTIONS.CLEAR_PROJECT_SELECTION });
    }, []);

    // Scenario Management
    const setScenarios = useCallback((scenarios) => {
        dispatch({ type: ACTIONS.SET_SCENARIOS, payload: scenarios });
    }, []);

    const setActiveScenario = useCallback((scenario) => {
        dispatch({ type: ACTIONS.SET_ACTIVE_SCENARIO, payload: scenario });
    }, []);

    const setLoadingScenario = useCallback((loading) => {
        dispatch({ type: ACTIONS.SET_LOADING_SCENARIO, payload: loading });
    }, []);

    // Pending Updates (Optimistic UI)
    const addPendingUpdate = useCallback((id, updates) => {
        dispatch({ type: ACTIONS.ADD_PENDING_UPDATE, payload: { id, updates } });
        // Auto-expire after 2 minutes
        setTimeout(() => {
            dispatch({ type: ACTIONS.REMOVE_PENDING_UPDATE, payload: id });
        }, 120000);
    }, []);

    // Settings
    const setStoredSettings = useCallback((settings) => {
        dispatch({ type: ACTIONS.SET_STORED_SETTINGS, payload: settings });
    }, []);

    return {
        state,
        dispatch,
        ACTIONS,
        MODALS,
        // Toast
        addToast,
        // Modals
        showModal,
        hideModal,
        hideAllModals,
        isModalOpen: (name) => !!state.modals[name],
        // View Controls
        setViewMode,
        setViewKey,
        setTimeRange,
        setSelectedSquads,
        setForecastMode,
        setCellDisplayMode,
        setZoomLevel,
        setResourceSearch,
        // Selection
        setSelectedBucket,
        setSelectedResource,
        toggleProjectSelection,
        clearProjectSelection,
        // Scenarios
        setScenarios,
        setActiveScenario,
        setLoadingScenario,
        // Pending Updates
        addPendingUpdate,
        // Settings
        setStoredSettings,
    };
};

export default useDashboardState;
