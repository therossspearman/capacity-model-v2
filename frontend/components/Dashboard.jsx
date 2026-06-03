/**
 * Dashboard Component - Full V2 Implementation
 * Integrates ResourceGrid with capacity calculations via Web Worker
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useRecords, useSession } from '@airtable/blocks/interface/ui';
import { BRAND, TOKENS, Z_INDEX, ZOOM_CONFIG, useTheme } from '../design-system';
import { SETTINGS, DEFAULT_SETTINGS } from '../constants';
import { getSafeCellValue, getStringValue, getDateValue, resolveFieldId, getCellMetrics, getStatusColor, exportCapacityToCSV, exportChartAsPng, getSquadsList, writeSlotSnapshot, readAIRecommendations } from '../utils';
import { transformForecastToWeeklyDemand, calculateFTEImpact } from '../utils/forecastTransformer';
// Direct hook imports (no barrel) — CLAUDE.md rule #5: barrel imports of hooks/
// can cause circular-dependency crashes.
import { useCapacityData } from '../hooks/useCapacityData';
import { useGrouping } from '../hooks/useGrouping';
import { useDebounce } from '../hooks/useDebounce';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDashboardHandlers } from '../hooks/useDashboardHandlers';
// Direct imports to avoid circular dependency through barrel exports
import { ScenarioManager } from '../services/ScenarioManager';
import { AirtableService } from '../services/airtable-service';
import { useScenarioSelection } from '../hooks/useScenarioSelection';
import ResourceGrid from './grid/ResourceGrid';
import BAUProjectGrid from './grid/BAUProjectGrid';
import BAUProjectEditModal from './modals/BAUProjectEditModal';
import { ChartSection, SlotHeatmap, SlotOverlayChart } from './charts';
import { SettingsModal, GuidedTour, KeyboardShortcutsModal, AllocationModal, DetailModal, ResourceProfileModal, DocumentationModal, BatchUpdateModal, ConflictResolutionModal, FinancialBreakdownDrawer, ConfirmModal, InitiativesModal, OptimizationModal, SlotAlignmentModal, ProgramDetailModal, ProgramsManagementModal, AIInsightsModal, InputModal, ViewChangesModal, CommitModal, DiscardModal, ScenarioMergeConflictModal, FinanceForecastModal, ExportModal } from './modals';
import { ForecastImpactPanel } from './modals/ForecastImpactPanel';
import { ScenarioSelector, CreateScenarioModal, DraftModeBanner, ScenarioNotesModal } from './scenario';
import { ScenarioCompareModal } from './scenario/ScenarioCompareModal';
import RevenueImpactDrawer from './RevenueImpactDrawer';
import { ToastContainer, DemandCategoryToggle } from './ui';
import LoadingScreen from './LoadingScreen';
import AuditDrawer from './drawers/AuditDrawer';
import { ViewModeToggle, CellDisplayToggle, ZoomToggle, ExpandCollapseToggle } from './toolbar';
import { DashboardProvider } from '../context';
import { logAuditEvent, AUDIT_EVENTS } from '../utils/AuditLog';
import { saveSnapshot as saveAISnapshot } from '../utils/AIPerformanceTracker';

// Simple Error Boundary
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Dashboard Error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><svg style={{ width: '48px', height: '48px', color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                        Dashboard Error
                    </h2>
                    <p style={{ fontSize: '14px', color: '#ef4444', marginBottom: '16px' }}>
                        {this.state.error?.message || 'Something went wrong'}
                    </p>
                    <details style={{ textAlign: 'left', fontSize: '12px', color: '#64748b' }}>
                        <summary>Error Details</summary>
                        <pre style={{ overflow: 'auto', padding: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginTop: '8px' }}>
                            {this.state.error?.stack}
                        </pre>
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}



// Stat Card - V1 Parity
const StatCard = ({ title, value, icon, color }) => (
    <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '8px 12px',
        minWidth: '100px',
        height: '56px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        transition: 'all 0.2s',
        cursor: 'default'
    }}>
        <span style={{
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#f8fafc',
            flexShrink: 0
        }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
            <div style={{
                fontSize: '9px',
                color: '#94a3b8',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap'
            }}>
                {title}
            </div>
            <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1e293b',
                lineHeight: 1.1
            }}>{value}</div>
        </div>
    </div>
);

/**
 * Main Dashboard Component
 */
export const Dashboard = ({
    resTable,
    projTable,
    settingsTable,
    scenariosTable,
    squadsTable,
    programsTable,
    forecastTable,
    settings,
    base,
    globalConfig
}) => {
    // Theme (Dark Mode Support)
    const { isDark, colors } = useTheme();

    // Current user session for tracking "Currently editing by..."
    const session = useSession ? useSession() : null;
    const currentUserName = session?.currentUser?.name || session?.currentUser?.email || 'Unknown User';

    // Themed styles - computed from colors for dark mode support
    const themedStyles = useMemo(() => ({
        // Header/toolbar background
        headerBg: isDark
            ? `rgba(36, 40, 59, 0.95)`
            : `rgba(255, 255, 255, 0.85)`,
        headerBorder: isDark
            ? `1px solid rgba(59, 61, 79, 0.8)`
            : `1px solid rgba(226, 232, 240, 0.8)`,
        // Dropdown menus
        dropdownBg: colors.bgCard,
        dropdownBorder: `1px solid ${colors.border}`,
        dropdownShadow: colors.shadowLg,
        // Buttons
        buttonBg: colors.bgCard,
        buttonBorder: `1px solid ${colors.border}`,
        buttonText: colors.textSecondary,
        buttonHoverBg: colors.bgHover,
        // Pills/chips
        pillBg: isDark ? colors.bgAccent : 'rgba(248, 250, 252, 0.8)',
        pillBorder: `1px solid ${isDark ? colors.border : 'rgba(226, 232, 240, 0.6)'}`,
        pillActiveBg: isDark ? colors.primary : '#7637E3',
        // Text colors
        textPrimary: colors.text,
        textSecondary: colors.textSecondary,
        textMuted: colors.textMuted,
        // Borders
        divider: isDark
            ? 'linear-gradient(180deg, transparent 0%, #3b3d4f 20%, #3b3d4f 80%, transparent 100%)'
            : 'linear-gradient(180deg, transparent 0%, #e2e8f0 20%, #e2e8f0 80%, transparent 100%)'
    }), [isDark, colors]);

    // State
    const [viewMode, setViewMode] = useState('resources');
    const [timeRange, setTimeRange] = useState('1y');
    const [zoomLevel, setZoomLevel] = useState('comfortable');
    const [squadViewFilter, setSquadViewFilter] = useState([]);
    const [statusViewFilter, setStatusViewFilter] = useState([]);
    const [platformViewFilter, setPlatformViewFilter] = useState([]); // Platform menu filter (resources by squad platform, projects by project platform)
    const [mergeSquads, setMergeSquads] = useState(false); // Squad Merging Experiment
    const [resourceSearch, setResourceSearch] = useState('');
    const [menuCollapsed, setMenuCollapsed] = useState(() => {
        try { return localStorage.getItem('capacityMenuCollapsed') === 'true'; } catch (e) { return false; }
    });
    const [dropdownSearch, setDropdownSearch] = useState('');
    const [forecastMode, setForecastMode] = useState('plan');
    const [cellDisplayMode, setCellDisplayMode] = useState('hours');
    const [storedSettings, setStoredSettings] = useState(DEFAULT_SETTINGS);
    const [settingsRestoredFromBackup, setSettingsRestoredFromBackup] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showTour, setShowTour] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [scenarios, setScenarios] = useState([]);
    // User-local scenario selection (stored in browser, not shared with other users)
    const [activeScenarioId, setActiveScenarioId] = useState(() => {
        try { return localStorage.getItem('capacityActiveScenario') || null; }
        catch (e) { return null; }
    });
    const [activeCell, setActiveCell] = useState(null); // { resourceId, dateKey, metrics }
    const [selectedBucketData, setSelectedBucketData] = useState(null); // V1: DetailModal data
    const [selectedResourceId, setSelectedResourceId] = useState(null); // V1: ResourceProfileModal
    const [showDocs, setShowDocs] = useState(false); // V1: DocumentationModal
    const [showProgramsModal, setShowProgramsModal] = useState(false); // Programs list modal
    const [showSlots, setShowSlots] = useState(false); // Toggle Slot Capacity Overlay
    const [companyFilter, setCompanyFilter] = useState('all'); // Multi-company: 'all' = combined view, or specific company name
    const [selectedProjects, setSelectedProjects] = useState(new Set()); // V1 Parity: Batch update project selection
    const [lastSelectedId, setLastSelectedId] = useState(null); // Shift-select anchor
    const [showBatchModal, setShowBatchModal] = useState(false); // V1 Parity: Batch update modal
    const [isBatchUpdating, setIsBatchUpdating] = useState(false); // V1 Parity: Batch update loading state
    const [showOptimizationModal, setShowOptimizationModal] = useState(false); // Slot Optimization modal
    const [showAuditDrawer, setShowAuditDrawer] = useState(false); // Activity Log drawer
    const [assignmentHistory, setAssignmentHistory] = useState([]); // Undo stack for drag-drop
    const [selectedProgram, setSelectedProgram] = useState(null); // Program Resourcing: Active program modal
    const [assignmentFuture, setAssignmentFuture] = useState([]); // Redo stack for drag-drop
    const [pendingSlotAssignment, setPendingSlotAssignment] = useState(null); // Pending slot assignment with alignment check
    const [selectedEntities, setSelectedEntities] = useState(() => { try { return JSON.parse(localStorage.getItem('capacitySelectedEntities') || '[]'); } catch (e) { return []; } }); // V1 Parity: Entity filter

    // V1 Parity: Additional state for menu consistency
    const [selectedCategory, setSelectedCategory] = useState('All'); // Role filter: All/PM/SC/PD
    const [sortBy, setSortBy] = useState('name'); // Sort: name/availability_asc/availability_desc/overload
    const [groupBy, setGroupBy] = useState('squad'); // Grouping: squad/role/customer
    const [customerSort, setCustomerSort] = useState(true); // Sort customers A-Z in project view
    const [highlightProject, setHighlightProject] = useState(''); // Project highlight search
    const [activeMenu, setActiveMenu] = useState(null); // Active dropdown: 'squad'/'role'/'sort'/null
    // Clear dropdown search when menu closes or changes
    useEffect(() => { setDropdownSearch(''); }, [activeMenu]);
    const [customStartDate, setCustomStartDate] = useState(''); // Custom date range start
    const [customEndDate, setCustomEndDate] = useState(''); // Custom date range end
    const [exceptionsOnly, setExceptionsOnly] = useState(false); // V1 Parity: Show only under/over-utilized resources
    const [showNotesOnly, setShowNotesOnly] = useState(false); // Show only projects with resourcing notes
    const [showCreateScenario, setShowCreateScenario] = useState(false); // Create Scenario Modal
    const [showCompareScenarios, setShowCompareScenarios] = useState(false); // Compare Scenarios Modal
    const [showNotesModal, setShowNotesModal] = useState(false); // Scenario Notes Modal
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false); // Discard scenario confirmation
    const [deleteConfirmScenario, setDeleteConfirmScenario] = useState(null); // Scenario pending deletion
    const [revRecExpanded, setRevRecExpanded] = useState(false); // Revenue Recognition card expanded
    const [pendingUpdates, setPendingUpdates] = useState({}); // Optimistic UI: { projectId: { ...updates } }
    const [pendingResourceUpdates, setPendingResourceUpdates] = useState({}); // Optimistic UI: { resourceId: { ...updates } }
    const [allGroupsExpanded, setAllGroupsExpanded] = useState(true); // V1 Parity: Expand/collapse all groups
    const [showConflictModal, setShowConflictModal] = useState(false); // Conflict Resolution Modal
    const [detectedConflicts, setDetectedConflicts] = useState(null); // Conflicts detected when switching scenarios
    const [pendingScenarioId, setPendingScenarioId] = useState(null); // Scenario ID awaiting conflict resolution
    const [showViewChanges, setShowViewChanges] = useState(false); // View Changes modal
    const [changeToDelete, setChangeToDelete] = useState(null); // { type: 'project'|'resource', id: string, name: string } - For reverting changes
    const [showCommitModal, setShowCommitModal] = useState(false); // Styled commit confirmation modal
    const [showFinancialDrawer, setShowFinancialDrawer] = useState(false); // Financial Breakdown Drawer
    const [financialPeriod, setFinancialPeriod] = useState('fy'); // 'fy' | 'fy_next' | 'fy_next2' | 'cy' | 'cy_next'
    const [revenueScope, setRevenueScope] = useState('filtered'); // 'filtered' | 'all' - toggle for revenue display
    const [showInitiativesModal, setShowInitiativesModal] = useState(false); // Team Initiatives Modal
    const [showInitiativesEffect, setShowInitiativesEffect] = useState(false); // Show initiative effects on graph
    const [showImpactDrawer, setShowImpactDrawer] = useState(false); // Revenue Impact Drawer (Debugging)
    const [showAIModal, setShowAIModal] = useState(false); // AI Insights Modal
    const [demandCategory, setDemandCategory] = useState(() => { try { return localStorage.getItem('capacityDemandCategory') || 'all'; } catch (e) { return 'all'; } }); // BAU Feature: 'all' | 'implementation' | 'bau'
    const [aiLoading, setAiLoading] = useState(false); // AI loading state
    const [aiInsightData, setAiInsightData] = useState(null); // { analysis, recommendations, snapshotTime }
    const [mergeConflictData, setMergeConflictData] = useState(null); // Scenario merge conflict modal: { conflicts, scenarios, newName, onResolve }
    const [showFinanceForecastModal, setShowFinanceForecastModal] = useState(false); // Finance Forecast ARR Modal
    const [showFinanceForecast, setShowFinanceForecast] = useState(false); // Toggle forecast overlay on chart
    const [financeForecastData, setFinanceForecastData] = useState(null); // Stores forecast weekly data for chart
    const [activeForecastRaw, setActiveForecastRaw] = useState(null); // Stores raw forecast data (arrData, parameters, name, fyStartYear) for editing
    const [bauEditProject, setBauEditProject] = useState(null); // BAU project being edited in modal
    const [bauGridExpanded, setBauGridExpanded] = useState(false); // BAU grid collapsed by default
    const [showForecastImpactPanel, setShowForecastImpactPanel] = useState(false); // FTE Impact Panel
    const [forecastFTEImpact, setForecastFTEImpact] = useState(null); // Computed FTE impact data
    const [showExportModal, setShowExportModal] = useState(false); // Export Modal
    const [renameData, setRenameData] = useState({ isOpen: false, scenario: null });

    // Track initial load completion for subtle recalculation overlays
    const hasInitialLoadedRef = useRef(false);

    // Toast notifications
    const [toasts, setToasts] = useState([]);
    // Monotonic counter so two toasts created within the same millisecond get
    // unique IDs (Date.now() alone can collide and drop/duplicate toasts).
    const toastIdRef = useRef(0);
    const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, type, title, message }]);
        if (duration > 0) {
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
        }
    }, []);
    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // QOL: Recently Viewed items (projects/resources) - persisted to localStorage
    const [recentlyViewed, setRecentlyViewed] = useState(() => {
        try { return JSON.parse(localStorage.getItem('capacityRecentlyViewed') || '[]'); }
        catch (e) { return []; }
    });
    const addToRecentlyViewed = useCallback((item) => {
        setRecentlyViewed(prev => {
            const filtered = prev.filter(r => r.id !== item.id);
            const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, 10);
            localStorage.setItem('capacityRecentlyViewed', JSON.stringify(updated));
            return updated;
        });
    }, []);
    const [showRecentlyViewed, setShowRecentlyViewed] = useState(false); // Recently Viewed dropdown

    // QOL: Filter Presets - save/load filter combinations
    const [filterPresets, setFilterPresets] = useState(() => {
        try { return JSON.parse(localStorage.getItem('capacityFilterPresets') || '[]'); }
        catch (e) { return []; }
    });
    const [showFilterPresets, setShowFilterPresets] = useState(false);
    const [presetName, setPresetName] = useState('');

    const saveFilterPreset = useCallback((name) => {
        if (!name.trim()) return;
        const preset = {
            id: Date.now().toString(),
            name: name.trim(),
            filters: {
                squadViewFilter, statusViewFilter, platformViewFilter, selectedCategory, selectedEntities,
                viewMode, groupBy, sortBy, exceptionsOnly
            },
            createdAt: Date.now()
        };
        setFilterPresets(prev => {
            const updated = [...prev, preset];
            localStorage.setItem('capacityFilterPresets', JSON.stringify(updated));
            return updated;
        });
        setPresetName('');
    }, [squadViewFilter, statusViewFilter, platformViewFilter, selectedCategory, selectedEntities, viewMode, groupBy, sortBy, exceptionsOnly]);

    const loadFilterPreset = useCallback((preset) => {
        if (preset.filters.squadViewFilter) setSquadViewFilter(preset.filters.squadViewFilter);
        if (preset.filters.statusViewFilter) setStatusViewFilter(preset.filters.statusViewFilter);
        if (preset.filters.platformViewFilter) setPlatformViewFilter(preset.filters.platformViewFilter);
        // Support legacy presets with old key name
        if (preset.filters.selectedSquads) setSquadViewFilter(preset.filters.selectedSquads);
        if (preset.filters.selectedCategory) setSelectedCategory(preset.filters.selectedCategory);
        if (preset.filters.selectedEntities) setSelectedEntities(preset.filters.selectedEntities);
        if (preset.filters.viewMode) setViewMode(preset.filters.viewMode);
        if (preset.filters.groupBy) setGroupBy(preset.filters.groupBy);
        if (preset.filters.sortBy) setSortBy(preset.filters.sortBy);
        if (preset.filters.exceptionsOnly !== undefined) setExceptionsOnly(preset.filters.exceptionsOnly);
        setShowFilterPresets(false);
    }, []);

    const deleteFilterPreset = useCallback((presetId) => {
        setFilterPresets(prev => {
            const updated = prev.filter(p => p.id !== presetId);
            localStorage.setItem('capacityFilterPresets', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // QOL: Undo/Redo for Scenario Changes
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const MAX_UNDO_STACK = 20;

    const pushToUndoStack = useCallback((action) => {
        setUndoStack(prev => [...prev.slice(-MAX_UNDO_STACK + 1), action]);
        setRedoStack([]); // Clear redo on new action
    }, []);

    const undo = useCallback(() => {
        if (undoStack.length === 0) return;
        const lastAction = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, lastAction]);

        // Revert the action
        if (lastAction.type === 'PROJECT_UPDATE' && lastAction.projectId) {
            setPendingUpdates(prev => {
                const newUpdates = { ...prev };
                if (lastAction.previousState) {
                    newUpdates[lastAction.projectId] = lastAction.previousState;
                } else {
                    delete newUpdates[lastAction.projectId];
                }
                return newUpdates;
            });
        }
    }, [undoStack]);

    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        const action = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, action]);

        // Re-apply the action
        if (action.type === 'PROJECT_UPDATE' && action.projectId) {
            setPendingUpdates(prev => ({
                ...prev,
                [action.projectId]: action.newState
            }));
        }
    }, [redoStack]);

    // V1 Parity: Always switch groupBy to 'customer' when entering projects mode
    React.useEffect(() => {
        if (viewMode === 'projects' && groupBy !== 'customer') {
            // Projects mode: always default to customer (Role is invalid, Squad is suboptimal)
            setGroupBy('customer');
        }
    }, [viewMode]); // Only trigger on viewMode change, not groupBy

    // Persist activeScenarioId to localStorage when it changes
    React.useEffect(() => {
        try {
            if (activeScenarioId) localStorage.setItem('capacityActiveScenario', activeScenarioId);
            else localStorage.removeItem('capacityActiveScenario');
        } catch (e) { /* localStorage unavailable */ }
    }, [activeScenarioId]);

    // Stable settings reference for services
    const stableSettings = useMemo(() => ({
        ...storedSettings,    // User preferences from Settings JSON
        ...settings           // Field IDs from Interface Designer (takes precedence)
    }), [storedSettings, settings]); // Rely on React's shallow comparison or ref stability which is usually fine for Airtable settings


    // Services - memoized to prevent re-creation
    const airtableService = useMemo(() => base ? new AirtableService(base) : null, [base]);
    const scenarioManager = useMemo(() => (base && globalConfig) ? new ScenarioManager(base, globalConfig, stableSettings) : null, [base, globalConfig, stableSettings]);

    // Scenario selection hook
    const { activeScenario, mergeProjects, mergeResources, mergeProgramAssignments } = useScenarioSelection(scenarios, activeScenarioId, stableSettings);

    // Sync scenario changes to pendingUpdates when draft scenario is selected
    // This ensures persisted draft changes are loaded into the UI on page reload
    // Track last scenario ID to detect switching vs updating
    const lastScenarioIdRef = React.useRef(activeScenarioId);

    // Sync scenario changes to pendingUpdates when draft scenario is selected
    // This ensures persisted draft changes are loaded into the UI on page reload
    React.useEffect(() => {
        const isSwitchingScenario = activeScenarioId !== lastScenarioIdRef.current;
        lastScenarioIdRef.current = activeScenarioId;

        if (activeScenario && !activeScenario.isLive && activeScenario.changes?.projects) {
            const draftUpdates = {};
            Object.entries(activeScenario.changes.projects).forEach(([projectId, changes]) => {
                draftUpdates[projectId] = { ...changes, isDraft: true, timestamp: Date.now() };
            });

            // If switching scenarios, REPLACE pending updates to avoid pollution from previous scenario
            // If just updating (same scenario), MERGE (preserve optimistic updates)
            if (isSwitchingScenario) {
                setPendingUpdates(draftUpdates);
                setPendingResourceUpdates({}); // Clear resource updates on switch too
            } else {
                setPendingUpdates(prev => {
                    const next = { ...prev, ...draftUpdates };
                    try {
                        if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
                    } catch (e) {
                        return next;
                    }
                    return next;
                });
            }
        } else if (activeScenario && activeScenario.isLive) {
            // When switching to Live, we generally want to clear draft "overrides" from pending
            // unless they are true pending writes. For now, on switch, let's clear to be safe.
            if (isSwitchingScenario) {
                setPendingUpdates({});
                setPendingResourceUpdates({});
            }
        } else if (!activeScenario && isSwitchingScenario) {
            // Switched to nothing/null? Clear.
            setPendingUpdates({});
            setPendingResourceUpdates({});
        }
    }, [activeScenario, activeScenarioId]);
    // Global Keyboard Shortcuts
    const keyboardShortcuts = useMemo(() => [
        // Escape - close any open modal
        {
            key: 'Escape', action: () => {
                if (isSettingsOpen) setIsSettingsOpen(false);
                else if (selectedBucketData) setSelectedBucketData(null);
                else if (activeCell) setActiveCell(null);
                else if (showCreateScenario) setShowCreateScenario(false);
                else if (showCompareScenarios) setShowCompareScenarios(false);
                else if (showDocs) setShowDocs(false);
                else if (showFinancialDrawer) setShowFinancialDrawer(false);
            }
        },
        // Cmd+S - Save/commit scenario (when in draft mode)
        {
            key: 's', mod: true, action: () => {
                if (activeScenario && !activeScenario.isLive) {
                    setShowCommitModal(true);
                }
            }
        },
        // Cmd+Z - Undo (when in draft mode)
        { key: 'z', mod: true, action: () => { if (activeScenario && !activeScenario.isLive) undo(); } },
        // Cmd+Shift+Z - Redo (when in draft mode)
        { key: 'z', mod: true, shift: true, action: () => { if (activeScenario && !activeScenario.isLive) redo(); } },
        // Cmd+. - Open settings
        { key: '.', mod: true, action: () => setIsSettingsOpen(true) },
        // Cmd+/ - Show keyboard shortcuts
        { key: '/', mod: true, action: () => setShowShortcutsModal(true) },
        // ? - Show help
        { key: '?', shift: true, action: () => setShowDocs(true) },

        // === POWER USER SHORTCUTS ===
        // 1 - Switch to People view
        { key: '1', action: () => setViewMode('resources') },
        // 2 - Switch to Projects view
        { key: '2', action: () => setViewMode('projects') },
        // 3 - Switch to Slots view
        { key: '3', action: () => setViewMode('slots') },
        // G - Toggle graph visibility
        { key: 'g', action: () => setShowGraph(prev => !prev) },
        // F - Focus search box
        {
            key: 'f', action: () => {
                const searchInput = document.querySelector('input[placeholder*="Search"]');
                if (searchInput) searchInput.focus();
            }
        },
        // I - Open initiatives modal
        { key: 'i', action: () => setShowInitiativesModal(true) },
        // E - Toggle exceptions only filter
        { key: 'e', action: () => setExceptionsOnly(prev => !prev) },
        // P - Cycle through Plan/EAC/Impact modes
        {
            key: 'p', action: () => {
                const modes = ['plan', 'eac', 'impact'];
                const currentIdx = modes.indexOf(forecastMode);
                setForecastMode(modes[(currentIdx + 1) % modes.length]);
            }
        },
        // T - Jump to today on timeline
        { key: 't', action: () => setTimeRange('fy') },
        // A - Open Activity Log
        { key: 'a', action: () => setShowAuditDrawer(prev => !prev) },
        // R - Toggle Recently Viewed dropdown
        { key: 'r', action: () => setShowRecentlyViewed(prev => !prev) },
    ], [isSettingsOpen, selectedBucketData, activeCell, showCreateScenario, showCompareScenarios, showDocs, showFinancialDrawer, activeScenario, undo, redo, forecastMode]);

    useKeyboardShortcuts(keyboardShortcuts);

    // State for keyboard shortcuts modal
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════════
    // HANDLERS: Extracted to useDashboardHandlers hook for maintainability
    // See: frontend/hooks/useDashboardHandlers.js
    // Hook is initialized after useCapacityData (around line 1340)
    // ═══════════════════════════════════════════════════════════════════════════

    const debouncedSearch = useDebounce(resourceSearch, 300);
    const debouncedSelectedEntities = useDebounce(selectedEntities, 500); // V1 Parity: Debounce entity filter
    const currentZoom = ZOOM_CONFIG[zoomLevel] || ZOOM_CONFIG.comfortable;

    // V1 Parity: Jump to fiscal quarter (Q1=Apr, Q2=Jul, Q3=Oct, Q4=Jan)
    const jumpToQuarter = (q) => {
        const container = document.querySelector('[data-grid-scroll]');
        if (!container || !processedData?.length) return;
        const monthMap = { 1: 4, 2: 7, 3: 10, 4: 0 }; // Fiscal quarters
        const targetMonth = monthMap[q];
        const idx = processedData.findIndex(d => {
            const date = new Date(d.rawDate);
            return date.getMonth() === targetMonth;
        });
        if (idx !== -1) container.scrollTo({ left: idx * currentZoom.width, behavior: 'smooth' });
    };

    // Keyboard shortcuts handler.
    // The handler is bound once (mount-only) but needs live values for currentZoom,
    // scrollToToday and jumpToQuarter. Read them through a ref that is kept in sync
    // each render so the listener never closes over stale values.
    const kbHandlersRef = useRef({});
    // NOTE: kbHandlersRef.current is populated below (after scrollToToday is
    // defined) to avoid a temporal-dead-zone reference during render.
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const { currentZoom: liveZoom, scrollToToday: liveScrollToToday, jumpToQuarter: liveJumpToQuarter } = kbHandlersRef.current;

            // V1 Parity: Keyboard shortcuts
            if (e.key === '?') {
                e.preventDefault();
                setShowShortcuts(true);
            } else if (e.key === 'Escape') {
                setIsSettingsOpen(false);
                setShowShortcuts(false);
                setShowTour(false);
                setActiveMenu(null);
                setHighlightProject('');
                setSelectedBucketData(null);
                setSelectedResourceId(null);
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                document.querySelector('[data-search-input]')?.focus();
            } else if (e.key === '/') {
                e.preventDefault();
                document.getElementById('resource-search-input')?.focus();
            } else if (e.key === '1') {
                liveJumpToQuarter(1);
            } else if (e.key === '2') {
                liveJumpToQuarter(2);
            } else if (e.key === '3') {
                liveJumpToQuarter(3);
            } else if (e.key === '4') {
                liveJumpToQuarter(4);
            } else if (e.key === 'ArrowRight') {
                const container = document.querySelector('[data-grid-scroll]');
                if (container) container.scrollBy({ left: liveZoom.width * 4, behavior: 'smooth' });
            } else if (e.key === 'ArrowLeft') {
                const container = document.querySelector('[data-grid-scroll]');
                if (container) container.scrollBy({ left: -(liveZoom.width * 4), behavior: 'smooth' });
            } else if (e.key === 't' || e.key === 'T') {
                // Jump to Today shortcut
                liveScrollToToday();
            } else if ((e.metaKey || e.ctrlKey) && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                setMenuCollapsed(prev => {
                    const next = !prev;
                    try { localStorage.setItem('capacityMenuCollapsed', String(next)); } catch (e) { }
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps - scrollToToday is stable callback

    // Click-outside handler to close dropdown menus
    useEffect(() => {
        if (!activeMenu) return;

        const handleClickOutside = (e) => {
            // Check if click is inside a dropdown (has data-dropdown attribute)
            const isInsideDropdown = e.target.closest('[data-dropdown]');
            if (!isInsideDropdown) {
                setActiveMenu(null);
            }
        };

        // Delay to avoid immediate close on the same click that opened it
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenu]);

    // Check if first visit (show tour)
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('capacityModelTourCompleted');
        if (!hasSeenTour) {
            setTimeout(() => setShowTour(true), 1000);
        }
    }, []);

    // Fetch all records
    const resRecords = useRecords(resTable);
    const projRecords = useRecords(projTable);
    const settingsRecords = useRecords(settingsTable || null);
    const scenarioRecords = useRecords(scenariosTable || null);
    const squadRecords = useRecords(squadsTable || null);
    const programRecords = useRecords(programsTable || null);
    const forecastRecords = useRecords(forecastTable || null);


    // Stabilize settings object to prevent infinite loops if SDK returns new reference
    const settingsRef = React.useRef(storedSettings);
    settingsRef.current = storedSettings;

    // Scroll container ref for timeline navigation
    const scrollContainerRef = React.useRef(null);

    // Scroll to today column in the timeline
    const scrollToToday = React.useCallback(() => {
        const container = document.querySelector('[data-grid-scroll]');
        if (!container) return;
        // Try finding today column by data attribute
        const todayColumn = container.querySelector('[data-today="true"]');
        if (todayColumn) {
            todayColumn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            // Fallback: scroll to center of container
            container.scrollTo({ left: container.scrollWidth / 2 - container.clientWidth / 2, behavior: 'smooth' });
        }
    }, []);

    // Keep the mount-only keydown handler reading live values (see kbHandlersRef above).
    kbHandlersRef.current = { currentZoom, scrollToToday, jumpToQuarter };

    // populate scenarios from records - MERGE with existing local state to preserve changes
    useEffect(() => {
        if (scenarioRecords) {
            try {
                setScenarios(prev => {
                    // Build a map of existing scenario data (preserves local changes/metadata)
                    const existingMap = new Map(prev.map(s => [s.id, s]));

                    // Filter out any deleted records to prevent "Record has been deleted" errors
                    const validRecords = scenarioRecords.filter(rec => {
                        try {
                            // If the record is deleted, accessing any property will throw
                            return rec && rec.id && !rec.isDeleted;
                        } catch (e) {
                            return false;
                        }
                    });

                    // Map Airtable records to scenarios, preserving local state
                    const tableScenarios = validRecords.map(rec => {
                        const existing = existingMap.get(rec.id);
                        // Parse changes and metadata from Airtable if available
                        // Field names must match Airtable exactly: 'Changes JSON' and 'Metadata JSON'
                        let changesFromTable = { projects: {}, resources: {} };
                        let metadataFromTable = {};
                        try {
                            // Find overflow field IDs from explicitly mapped extension settings
                            const of2Id = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_2];
                            const of3Id = settings?.[SETTINGS.SCENARIO_CHANGES_JSON_3];

                            // Try both field name patterns (some bases use 'Changes JSON', others 'Changes')
                            let changesStr = '';
                            try { changesStr = rec.getCellValueAsString?.(settings?.[SETTINGS.SCENARIO_CHANGES_JSON] || 'Changes JSON') || ''; } catch { }
                            if (!changesStr) try { changesStr = rec.getCellValueAsString?.('Changes') || ''; } catch { }

                            // Concatenate overflow fields (large scenarios span multiple fields)
                            if (changesStr) {
                                let chunk2 = '';
                                let chunk3 = '';
                                // Try mapped field IDs first, then field names, then table field scan
                                if (of2Id) try { chunk2 = rec.getCellValueAsString?.(of2Id) || ''; } catch { }
                                if (of3Id) try { chunk3 = rec.getCellValueAsString?.(of3Id) || ''; } catch { }
                                if (!chunk2) try { chunk2 = rec.getCellValueAsString?.('Changes JSON 2') || ''; } catch { }
                                if (!chunk3) try { chunk3 = rec.getCellValueAsString?.('Changes JSON 3') || ''; } catch { }
                                if (!chunk2 || !chunk3) {
                                    const parentTbl = rec.parentTable || scenariosTable;
                                    if (parentTbl?.fields) {
                                        for (const f of parentTbl.fields) {
                                            const fn = (f.name || '').trim().toLowerCase();
                                            if (!chunk2 && fn === 'changes json 2') try { chunk2 = rec.getCellValueAsString?.(f.id) || ''; } catch { }
                                            if (!chunk3 && fn === 'changes json 3') try { chunk3 = rec.getCellValueAsString?.(f.id) || ''; } catch { }
                                        }
                                    }
                                }
                                if (chunk2) changesStr += chunk2;
                                if (chunk3) changesStr += chunk3;

                                // Guard: if the final string length is exactly a chunk boundary
                                // (90000) and doesn't end with valid JSON terminators, it's truncated
                                const CHUNK = 90000;
                                const isTruncated = changesStr.length > 0 &&
                                    changesStr.length % CHUNK === 0 &&
                                    !changesStr.trimEnd().endsWith('}');

                                if (isTruncated) {
                                    // Silently skip — this scenario was saved before overflow fields existed
                                    // or the overflow fields aren't accessible in this interface
                                } else {
                                    changesFromTable = JSON.parse(changesStr);
                                }
                            }
                        } catch (e) {
                            // Silently skip corrupt scenario data — do not log on every render
                        }
                        try {
                            let metaStr = rec.getCellValueAsString?.('Metadata JSON');
                            if (!metaStr) metaStr = rec.getCellValueAsString?.('Metadata');
                            if (metaStr) {
                                metadataFromTable = JSON.parse(metaStr);
                            }
                        } catch (e) { console.warn('[SCENARIO-LOAD] Failed to parse Metadata JSON:', e); }

                        // Grace period: if local data was saved in the last 10 seconds, prefer it
                        // This prevents race conditions where useRecords re-fetches before Airtable propagates
                        const localSavedAt = existing?.metadata?.lastSavedAt;
                        const isRecentlySaved = localSavedAt &&
                            (Date.now() - new Date(localSavedAt).getTime()) < 10000;

                        // Prefer local changes if:
                        // 1. Local has actual project changes AND 
                        // 2. Either table is empty OR local was saved recently
                        const localHasChanges = Object.keys(existing?.changes?.projects || {}).length > 0;
                        const tableHasChanges = Object.keys(changesFromTable?.projects || {}).length > 0;
                        const preferLocal = localHasChanges && (!tableHasChanges || isRecentlySaved);

                        return {
                            id: rec.id,
                            name: rec.name || 'Untitled Scenario',
                            isLive: false,
                            isActive: existing?.isActive ?? false,
                            // Read status from Airtable (Committed, Reverted, Draft, etc.)
                            status: rec.getCellValueAsString?.('Status') || existing?.status || 'Draft',
                            // Use local changes if they're recent or table is empty
                            changes: preferLocal ? existing.changes : changesFromTable,
                            // Same logic for metadata
                            metadata: preferLocal ? existing.metadata : metadataFromTable
                        };
                    });

                    // Also preserve any local-only scenarios that aren't in Airtable yet
                    // (e.g., optimistically added scenarios waiting for createRecordAsync to complete)
                    const tableIds = new Set(validRecords.map(r => r.id));
                    const localOnlyScenarios = prev.filter(s =>
                        !tableIds.has(s.id) &&
                        s.metadata?.lastSavedAt &&
                        (Date.now() - new Date(s.metadata.lastSavedAt).getTime()) < 30000 // Keep for 30s
                    );

                    return [...tableScenarios, ...localOnlyScenarios];
                });

                // Don't auto-select a scenario - leave as null/live mode
            } catch (err) {
                console.error('Failed to load scenarios:', err);
            }
        }
    }, [scenarioRecords]);

    // Load settings from table (with multi-field overflow support)
    useEffect(() => {
        if (settingsRecords && settingsRecords.length > 0) {
            const row = settingsRecords[0];
            const fieldId = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD]);
            let jsonStr = getSafeCellValue(row, fieldId) || '';

            // Concatenate overflow fields (registered as separate custom properties)
            const field2Id = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD_2]);
            const field3Id = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD_3]);
            if (field2Id) {
                const v2 = getSafeCellValue(row, field2Id);
                if (v2) jsonStr += v2;
            }
            if (field3Id) {
                const v3 = getSafeCellValue(row, field3Id);
                if (v3) jsonStr += v3;
            }

            try {
                if (jsonStr) {
                    let parsed;
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch (parseErr) {
                        console.warn('Settings JSON parse error:', parseErr.message);
                        return;
                    }

                    // Check if loaded settings appear empty/wiped
                    const looksEmpty = !parsed.activeSquads?.length && !parsed.roleMapping;
                    if (looksEmpty) {
                        // Try restoring from localStorage backup
                        try {
                            const backup = localStorage.getItem('_capacityModelSettingsBackup');
                            if (backup) {
                                const backupData = JSON.parse(backup);
                                if (backupData.settings && backupData.settings.activeSquads?.length) {
                                    console.warn('[Settings] Airtable settings appear empty — restoring from localStorage backup');
                                    setStoredSettings(prev => ({ ...prev, ...backupData.settings }));
                                    setSettingsRestoredFromBackup(true);
                                    // Write backup back to Airtable so it persists
                                    setTimeout(() => {
                                        try {
                                            const writeBack = { ...DEFAULT_SETTINGS, ...backupData.settings };
                                            persistSettingsJSON(writeBack);
                                            console.log('[Settings] Backup written back to Airtable');
                                        } catch (e) { console.warn('[Settings] Backup writeback failed:', e); }
                                    }, 3000);
                                    return; // Don't apply the empty settings
                                }
                            }
                        } catch (backupErr) {
                            console.warn('[Settings] localStorage backup restore failed:', backupErr);
                        }
                    }

                    setStoredSettings(prev => {
                        const next = { ...prev, ...parsed };
                        try {
                            if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
                        } catch (e) {
                            return next;
                        }
                        // Shadow backup: cache valid settings to localStorage
                        if (next.activeSquads?.length || next.roleMapping) {
                            try {
                                localStorage.setItem('_capacityModelSettingsBackup', JSON.stringify({
                                    settings: next,
                                    timestamp: new Date().toISOString()
                                }));
                            } catch (e) { /* localStorage full — silently skip */ }
                        }
                        return next;
                    });
                }
            } catch (err) {
                console.warn('Failed to load settings:', err);
            }
        }
    }, [settingsRecords, stableSettings, resolveFieldId, settingsTable]);

    // Helper: persist settings JSON with multi-field overflow
    const persistSettingsJSON = useCallback((settingsObj) => {
        if (!settingsTable || !settingsRecords || settingsRecords.length === 0) return;
        try {
            const fieldId = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD]);
            if (!fieldId) return;

            // Strip verbose data from JSON before persisting
            const stripped = { ...settingsObj };
            // Remove repriScenarios — these now live in the Scenarios table
            delete stripped.repriScenarios;
            const jsonString = JSON.stringify(stripped);
            const CHUNK_SIZE = 90000;

            // Build list of available field IDs (main + registered overflow)
            const allFieldIds = [fieldId];
            const f2 = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD_2]);
            const f3 = resolveFieldId(stableSettings[SETTINGS.SETTINGS_JSON_FIELD_3]);
            if (f2) allFieldIds.push(f2);
            if (f3) allFieldIds.push(f3);

            const updateData = {};
            for (let i = 0; i < allFieldIds.length; i++) {
                const chunk = jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                updateData[allFieldIds[i]] = chunk || ''; // Clear unused overflow
            }

            if (jsonString.length > allFieldIds.length * CHUNK_SIZE) {
                console.error(`Settings JSON too large (${jsonString.length} chars) even with ${allFieldIds.length} fields. Aborting save to prevent data corruption.`);
                return; // Don't save truncated data — it would corrupt settings on next load
            }

            settingsTable.updateRecordAsync(settingsRecords[0].id, updateData);

            // Shadow backup: also save to localStorage as a safety net
            try {
                localStorage.setItem('_capacityModelSettingsBackup', JSON.stringify({
                    settings: stripped,
                    timestamp: new Date().toISOString()
                }));
            } catch (e) { /* localStorage full — silently skip */ }
        } catch (err) {
            console.error('Failed to persist settings:', err);
        }
    }, [settingsTable, settingsRecords, stableSettings, resolveFieldId]);

    // Settings activeSquads controls data LOADING (excluded squads not fetched)
    // squadViewFilter controls graph DISPLAY (show only selected squads)

    // BAU Feature: Build squad category lookup map from Squads table
    const squadCategoryMap = useMemo(() => {
        if (!squadRecords) return {};
        const map = {};
        squadRecords.forEach(record => {
            const squadName = record.name;
            const fieldId = resolveFieldId(stableSettings[SETTINGS.SQUAD_CATEGORY]);
            const category = getStringValue(record, fieldId) || 'Implementation';
            if (squadName) map[squadName] = category;
        });
        return map;
    }, [squadRecords, stableSettings]);

    // Platform Filter: squad → platform lookup (mirrors squadCategoryMap). Reads the
    // single-select SQUAD_PLATFORM field on the Squads table; unmapped squads => null.
    const squadPlatformMap = useMemo(() => {
        if (!squadRecords) return {};
        const map = {};
        const fieldId = resolveFieldId(stableSettings[SETTINGS.SQUAD_PLATFORM]);
        if (!fieldId) return map;
        // A squad can serve MULTIPLE platforms. Parse the field into a list of platform
        // names, tolerant of how it's encoded: multipleSelects ([{name}]), singleSelect
        // ({name}), or delimited text ("FPS, Benifex" / "FPS/Benifex").
        const toPlatformList = (raw) => {
            if (raw == null) return [];
            if (Array.isArray(raw)) return raw.map(v => (v && typeof v === 'object' ? v.name : v)).filter(Boolean).map(String);
            if (typeof raw === 'object') return raw.name ? [String(raw.name)] : [];
            return String(raw).split(/[,/;|]+/).map(s => s.trim()).filter(Boolean);
        };
        squadRecords.forEach(record => {
            const squadName = record.name;
            const platforms = toPlatformList(getSafeCellValue(record, fieldId));
            if (squadName && platforms.length) map[squadName] = platforms;
        });
        return map;
    }, [squadRecords, stableSettings]);

    // Process resources
    const allResources = useMemo(() => {
        if (!resRecords) return [];
        return resRecords.map(record => {
            const squads = getSquadsList(record, resolveFieldId(stableSettings[SETTINGS.SQUAD]));
            // BAU Feature: Look up squad category from the first squad
            // If resource is in multiple squads, use 'Both' if any squad is different
            let squadCategory = 'Implementation';
            if (squads.length > 0) {
                const categories = squads.map(s => squadCategoryMap[s] || 'Implementation');
                const uniqueCategories = [...new Set(categories)];
                if (uniqueCategories.length === 1) {
                    squadCategory = uniqueCategories[0];
                } else if (uniqueCategories.includes('BAU') && uniqueCategories.includes('Implementation')) {
                    squadCategory = 'Both'; // Resource spans both categories
                } else {
                    squadCategory = uniqueCategories[0];
                }
            }
            // Platform Filter: the distinct platform(s) this resource is aligned to via
            // its squads (empty when no squad has a mapped platform).
            const squadPlatforms = [...new Set(squads.flatMap(s => squadPlatformMap[s] || []))];
            return {
                id: record.id,
                name: record.name,
                squads,
                role: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.FUNCTION])) || 'Unknown',
                workingHours: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.WORKING_HOURS])) || 40,
                targetUtilization: (() => {
                    // No default: a blank/unset field, a 0, or a negative value all resolve to 0%.
                    // (Airtable's SDK reads a 0-valued Percent/Number cell as null, so blank and 0
                    // are indistinguishable here — both intentionally mean 0% now.)
                    const fieldId = resolveFieldId(stableSettings[SETTINGS.TARGET_UTILIZATION]);
                    if (!fieldId) return 0;
                    const rawVal = getSafeCellValue(record, fieldId);
                    if (rawVal === null || rawVal === undefined || rawVal < 0) return 0;
                    return rawVal > 1 ? rawVal / 100 : rawVal;
                })(),
                startDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.START_DATE])),
                leaveDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.LEAVE_DATE])),
                leaveStartDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.LEAVE_START_DATE])),
                leaveEndDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.LEAVE_END_DATE])),
                company: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.COMPANY])) || null,
                country: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.COUNTRY])) || null,
                adJobTitle: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.AD_JOB_TITLE])) || null,
                rampProfile: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.RAMP_UP_PROFILE])) || null,
                rampStartDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.RAMP_START_DATE])) || null,
                headshot: (() => {
                    const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.RESOURCE_HEADSHOT]));
                    if (val && Array.isArray(val) && val.length > 0) return val[0].url || val[0].thumbnails?.large?.url || null;
                    return null;
                })(),
                // V1 Parity: Entity filter - resource's selling entity
                origin: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.RES_ENTITY])) || null,
                // BAU Feature: Squad category derived from squad membership
                squadCategory,
                // Platform Filter: platform(s) the resource's squad(s) are aligned to
                squadPlatforms,
                // Presence-Based Utilisation: annual % from new ANNUAL_UTILIZATION field.
                // Accepts both 0.67 and 67 formats (mirrors targetUtilization handling).
                // Returns null when the field isn't mapped or has no value — annualCapacity
                // will be null in that case, and the UI hides the annual stat.
                annualUtilization: (() => {
                    const fieldId = resolveFieldId(stableSettings[SETTINGS.ANNUAL_UTILIZATION]);
                    if (!fieldId) return null;
                    const raw = getSafeCellValue(record, fieldId);
                    if (raw == null) return null;
                    if (raw < 0) return 0; // sentinel for explicit 0%
                    return raw > 1 ? raw / 100 : raw;
                })(),
                annualCapacity: (() => {
                    const fieldId = resolveFieldId(stableSettings[SETTINGS.ANNUAL_UTILIZATION]);
                    if (!fieldId) return null;
                    const raw = getSafeCellValue(record, fieldId);
                    if (raw == null) return null;
                    const annualUtil = raw < 0 ? 0 : (raw > 1 ? raw / 100 : raw);
                    const rawHrs = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.WORKING_HOURS])) || 40;
                    const hoursPerWeek = rawHrs > 100 ? rawHrs / 3600 : rawHrs;
                    return hoursPerWeek * 52 * annualUtil;
                })()
            };
        });
    }, [resRecords, stableSettings, squadCategoryMap, squadPlatformMap]);

    // Process projects
    const allProjects = useMemo(() => {
        if (!projRecords) return [];
        // Capacity Model selector — 'standard' uses PM/SC/PD effort fields separately,
        // 'alternative' uses a single TOTAL_EFFORT field split by alternativeRoleMix %.
        //
        // alternativeRoleMix supports three shapes (all read here for backward compatibility):
        //   legacy flat:    { pm, sc, pd }                              → treated as default
        //   typed:          { default, byProjectType: { type: mix } }   → migrate to byTypePlatform with platform='*'
        //   typed+platform: { default, byTypePlatform: [ { type, platform, mix } ] } → current preferred
        //
        // Lookup per project: exact (type, platform) → (type, '*') → default
        const activeModel = storedSettings.activeCapacityModel || 'standard';
        const rawMixRoot = storedSettings.alternativeRoleMix || { pm: 30, sc: 30, pd: 40 };
        const hasNested = rawMixRoot && rawMixRoot.default && typeof rawMixRoot.default === 'object';
        const defaultMixRaw = hasNested ? rawMixRoot.default : { pm: rawMixRoot.pm || 0, sc: rawMixRoot.sc || 0, pd: rawMixRoot.pd || 0 };

        // Build a unified list of tuple overrides from any legacy shape
        const overrideList = [];
        if (hasNested) {
            if (Array.isArray(rawMixRoot.byTypePlatform)) {
                for (const entry of rawMixRoot.byTypePlatform) {
                    if (entry && entry.type && entry.mix) {
                        overrideList.push({ type: entry.type, platform: entry.platform || '*', mix: entry.mix });
                    }
                }
            }
            // Migrate any legacy byProjectType entries (treat as (type, any-platform))
            if (rawMixRoot.byProjectType && typeof rawMixRoot.byProjectType === 'object') {
                for (const [type, mix] of Object.entries(rawMixRoot.byProjectType)) {
                    // Only add if no tuple already covers (type, '*')
                    if (!overrideList.some(o => o.type === type && o.platform === '*')) {
                        overrideList.push({ type, platform: '*', mix });
                    }
                }
            }
        }

        // Normalise a raw mix ({pm,sc,pd} in %) to fractions summing to 1.
        const normaliseMix = (raw) => {
            const sum = (raw.pm || 0) + (raw.sc || 0) + (raw.pd || 0);
            if (sum <= 0) return { pm: 1 / 3, sc: 1 / 3, pd: 1 / 3 };
            return { pm: (raw.pm || 0) / sum, sc: (raw.sc || 0) / sum, pd: (raw.pd || 0) / sum };
        };

        const defaultMix = normaliseMix(defaultMixRaw);
        // Pre-compute normalised mixes indexed by "type|platform" for O(1) lookup
        const tupleMix = new Map();   // key: "type|platform"
        const typeOnlyMix = new Map(); // key: "type" — any-platform fallbacks
        for (const { type, platform, mix } of overrideList) {
            const norm = normaliseMix(mix);
            if (platform === '*' || !platform) {
                typeOnlyMix.set(type, norm);
            } else {
                tupleMix.set(`${type}|${platform}`, norm);
            }
        }

        // Hypercare durations per profile — used to surface a "+N wks HC" badge on each project row
        // so users know hypercare is being added even if it extends past the visible grid range.
        const hcWeeksDomestic = (storedSettings.modelParams?.domesticProfile?.hypercareWeeks) ?? 0;
        const hcWeeksRoleSpecific = (storedSettings.modelParams?.roleSpecificProfile?.hypercareWeeks) ?? 0;

        return projRecords.map(record => {
            // Detect hypercare-bearing profiles up front so the row UI can surface a "+N wks HC" badge
            // (matches the worker's detection in workerCodeSource.js for consistency).
            const _effortProfileVal = (getStringValue(record, resolveFieldId(stableSettings[SETTINGS.EFFORT_PROFILE])) || '').toLowerCase();
            const _isDomesticHc = _effortProfileVal.includes('domestic');
            const _isRoleSpecificHc = !_isDomesticHc && (_effortProfileVal.includes('role') || _effortProfileVal.includes('benifex'));
            const _hcWeeks = _isDomesticHc ? hcWeeksDomestic : (_isRoleSpecificHc ? hcWeeksRoleSpecific : 0);

            // Derive per-role effort based on the active capacity model
            let pmEffort, scEffort, pdEffort;
            if (activeModel === 'alternative') {
                const totalEffort = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.TOTAL_EFFORT])) || 0;
                const projectType = getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_TYPE])) || '';
                const platformFieldId = resolveFieldId(stableSettings[SETTINGS.PROJECT_PLATFORM]);
                const platform = (platformFieldId && projTable.getFieldIfExists(platformFieldId))
                    ? (getStringValue(record, platformFieldId) || '')
                    : '';
                // Lookup priority: exact (type, platform) → (type, any-platform) → default
                let mix = defaultMix;
                if (projectType && platform && tupleMix.has(`${projectType}|${platform}`)) {
                    mix = tupleMix.get(`${projectType}|${platform}`);
                } else if (projectType && typeOnlyMix.has(projectType)) {
                    mix = typeOnlyMix.get(projectType);
                }
                pmEffort = totalEffort * mix.pm;
                scEffort = totalEffort * mix.sc;
                pdEffort = totalEffort * mix.pd;
            } else {
                pmEffort = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PM_EFFORT])) || 0;
                scEffort = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.SC_EFFORT])) || 0;
                pdEffort = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PD_EFFORT])) || 0;
            }

            return ({
            id: record.id,
            name: record.name,
            status: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.STATUS])) || 'Unknown',
            squad: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_SQUAD])),
            squads: [getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_SQUAD])) || 'Unassigned'],
            start: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.KICK_OFF])),
            end: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.LAUNCH])),
            kickOff: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.KICK_OFF])),
            launch: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.LAUNCH])),

            pmEffort,
            scEffort,
            pdEffort,
            pmVal: pmEffort / 3600,
            scVal: scEffort / 3600,
            pdVal: pdEffort / 3600,
            transactionalBenefits: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.TRANSACTIONAL_BENEFITS])) || 0,
            nonTransactionalBenefits: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.NON_TRANSACTIONAL_BENEFITS])) || 0,
            contentOnlyBenefits: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.CONTENT_ONLY_BENEFITS])) || 0,
            actuals: (getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.ACTUAL_HOURS])) || 0) / 3600, // Convert seconds to hours
            pctComplete: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PERCENT_COMPLETE])) || 0,
            resourcedWithinProgram: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.RESOURCED_WITHIN_PROGRAM])) || false,
            projectWave: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_WAVE])) || '',
            company: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_COMPANY])) || null,
            customer: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.CUSTOMER])) || null,
            origin: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.SELLING_ENTITY])) || null,
            // BAU Feature: Project type for demand category filtering
            projectType: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_TYPE])) || '',
            bauTshirtSize: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.BAU_TSHIRT_SIZE])) || null,

            country: (() => {
                const fieldId = resolveFieldId(stableSettings[SETTINGS.PROJECT_COUNTRY]);
                return (fieldId && projTable.getFieldIfExists(fieldId)) ? getStringValue(record, fieldId) : null;
            })(),

            platform: (() => {
                const fieldId = resolveFieldId(stableSettings[SETTINGS.PROJECT_PLATFORM]);
                return (fieldId && projTable.getFieldIfExists(fieldId)) ? getStringValue(record, fieldId) : null;
            })(),

            // Extract allocation linked records and build team structure
            pmAlloc: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PM_ALLOCATION])) || [],
            scAlloc: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.SC_ALLOCATION])) || [],
            pdAlloc: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PD_ALLOCATION])) || [],
            // Build team structure from allocation fields + placeholders from TEAM_ALLOCATIONS JSON
            team: (() => {
                const extractTeam = (allocField /* , updateField — no longer read */) => {
                    // Canonical-only read. The proxy *_UPDATE field is no longer used; writes
                    // go directly to canonical, so canonical is the only source of truth.
                    // History (in case it ever needs reverting): we previously read the proxy
                    // first because the legacy write path went there and an automation copied
                    // it through. With direct writes that's flipped — extension and Airtable
                    // edits both write canonical, and reading the proxy just produced stale
                    // snapshots that broke add-via-DB and delete-via-extension flows.
                    const val = getSafeCellValue(record, resolveFieldId(stableSettings[allocField])) || [];
                    return (Array.isArray(val) ? val : []).map(r => {
                        if (!r) return null;
                        const name = r.name || (r.value && r.value.name) || String(r.id || r);
                        return { id: r.id || String(r), name };
                    }).filter(Boolean);
                };

                const baseTeam = {
                    pm: extractTeam(SETTINGS.PM_ALLOCATION, SETTINGS.PM_ALLOC_UPDATE),
                    sc: extractTeam(SETTINGS.SC_ALLOCATION, SETTINGS.SC_ALLOC_UPDATE),
                    pd: extractTeam(SETTINGS.PD_ALLOCATION, SETTINGS.PD_ALLOC_UPDATE)
                };

                // Read team allocations JSON from the canonical field. The legacy proxy
                // (_UPDATE) field is no longer read — writes go directly to canonical, and
                // reading the proxy was producing stale data when the proxy automation
                // hadn't run (or had been disabled), making the UI show old %s after a
                // direct edit completed.
                const allocJsonFieldId = resolveFieldId(stableSettings[SETTINGS.TEAM_ALLOCATIONS]);
                const allocJsonStr = allocJsonFieldId ? getSafeCellValue(record, allocJsonFieldId) : null;

                if (allocJsonStr && typeof allocJsonStr === 'string') {
                    try {
                        const allocData = JSON.parse(allocJsonStr);
                        // Merge allocation percentages and placeholders
                        ['pm', 'sc', 'pd'].forEach(role => {
                            if (allocData[role]) {
                                Object.entries(allocData[role]).forEach(([memberId, allocInfo]) => {
                                    // Check if this is a placeholder (object with isPlaceholder flag)
                                    if (typeof allocInfo === 'object' && allocInfo.isPlaceholder) {
                                        // Add placeholder to team if not already there
                                        if (!baseTeam[role].find(m => m.id === memberId)) {
                                            const placeholder = {
                                                id: memberId,
                                                name: allocInfo.name || 'TBD',
                                                isPlaceholder: true,
                                                allocationPct: allocInfo.pct || 0
                                            };
                                            if (allocInfo.startDate) placeholder.startDate = allocInfo.startDate;
                                            if (allocInfo.endDate) placeholder.endDate = allocInfo.endDate;
                                            baseTeam[role].push(placeholder);
                                        }
                                    } else {
                                        // It's an allocation percentage for an existing member
                                        const member = baseTeam[role].find(m => m.id === memberId);
                                        if (member) {
                                            member.allocationPct = typeof allocInfo === 'number' ? allocInfo : (allocInfo.pct || 0);
                                            // Also extract dates if present
                                            if (typeof allocInfo === 'object') {
                                                if (allocInfo.startDate) member.startDate = allocInfo.startDate;
                                                if (allocInfo.endDate) member.endDate = allocInfo.endDate;
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    } catch (e) {
                        // Invalid JSON, ignore
                    }
                }

                return baseTeam;
            })(),
            wave: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_WAVE])) || null,
            // Effort Profile (FPS, Front-Loaded, Back-Loaded, etc.)
            // Canonical-only read. Was previously checking the proxy first, which made
            // edits to the canonical field invisible to the UI until the proxy
            // automation caught up (or never, if it's disabled).
            effortProfile: (() => {
                const baseId = resolveFieldId(stableSettings[SETTINGS.EFFORT_PROFILE]);
                return baseId ? getStringValue(record, baseId) : null;
            })(),
            // Resourcing Override (number field for effort override value in hours)
            resourcingOverride: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.RESOURCING_OVERRIDE])) || 0,
            // Revenue Recognition (Financial Mode)
            revenueModel: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.REVENUE_MODEL])) || 'Non-POC',
            // Strip commas from thousands separators before parsing (e.g., "1,000" → 1000)
            implFee: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.IMPLEMENTATION_FEE]));
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            })(),
            arr: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.ARR]));
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            })(),
            contractArr: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.CONTRACT_ARR]));
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            })(),
            dealEfficiency: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.DEAL_EFFICIENCY]));
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            })(),
            contractEfficiency: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.CONTRACT_EFFICIENCY]));
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            })(),
            // Slot Lock Flags (for AI Capacity Relief scenario)
            lockLaunch: !!getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.SLOT_LOCK_LAUNCH])),
            lockSquad: !!getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.SLOT_LOCK_SQUAD])),
            lockResources: !!getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.SLOT_LOCK_RESOURCES])),
            // Program Resourcing: Checkbox to enable effort transfer to program

            // Country Flag (attachment field - extract URL)
            countryFlag: (() => {
                const val = getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.PROJECT_COUNTRY_FLAG]));
                if (val && Array.isArray(val) && val.length > 0) return val[0].url || val[0].thumbnails?.large?.url || null;
                return null;
            })(),

            // Portfolio Reprioritization fields
            customerRisk: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.CUSTOMER_RISK])) || null,
            compellingEventDate: getDateValue(record, resolveFieldId(stableSettings[SETTINGS.COMPELLING_EVENT_DATE])),

            // Resourcing Tracking (non-synced, direct write)
            resourcingNotes: getStringValue(record, resolveFieldId(stableSettings[SETTINGS.RESOURCING_NOTES])) || '',
            resourced: !!getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.RESOURCED])),
            // Hypercare metadata for row-sidebar badge (0 if profile has no hypercare phase)
            hcWeeks: _hcWeeks
            });
        });
    }, [projRecords, stableSettings, storedSettings.activeCapacityModel, storedSettings.alternativeRoleMix, storedSettings.modelParams]);

    // Build squad name → ID lookup from linked records in projects and resources
    const squadIdMap = useMemo(() => {
        const map = {};

        // Extract from project squad linked records
        if (projRecords) {
            projRecords.forEach(record => {
                const squadField = resolveFieldId(stableSettings[SETTINGS.PROJECT_SQUAD]);
                const val = squadField ? getSafeCellValue(record, squadField) : null;
                if (val && Array.isArray(val)) {
                    val.forEach(item => {
                        if (item && typeof item === 'object' && item.id && item.name) {
                            map[item.name] = item.id;
                        }
                    });
                } else if (val && typeof val === 'object' && val.id && val.name) {
                    map[val.name] = val.id;
                }
            });
        }

        // Extract from resource squad linked records
        if (resRecords) {
            resRecords.forEach(record => {
                const squadField = resolveFieldId(stableSettings[SETTINGS.SQUAD]);
                const val = squadField ? getSafeCellValue(record, squadField) : null;
                if (val && Array.isArray(val)) {
                    val.forEach(item => {
                        if (item && typeof item === 'object' && item.id && item.name) {
                            map[item.name] = item.id;
                        }
                    });
                } else if (val && typeof val === 'object' && val.id && val.name) {
                    map[val.name] = val.id;
                }
            });
        }

        return map;
    }, [projRecords, resRecords, stableSettings]);

    // ═══════════════════════════════════════════════════════════════════════════
    // EFFECTIVE DATA: Apply overlays for Draft Mode and Optimistic Updates
    // This is the data that should be used for ALL calculations (capacity, demand, etc.)
    // ═══════════════════════════════════════════════════════════════════════════

    // Effective Projects: Base data + scenario changes (draft) + pending updates (live optimistic)
    const rawEffectiveProjects = useMemo(() => {
        // Step 1: Apply scenario changes (draft mode) using mergeProjects from useScenarioSelection
        let projects = mergeProjects(allProjects);

        // Step 2: Apply pending updates (live mode optimistic) - these take priority over scenario changes
        if (Object.keys(pendingUpdates).length > 0) {
            projects = projects.map(proj => {
                const pending = pendingUpdates[proj.id];
                if (!pending) return proj;

                // Merge pending updates onto project, mapping field names correctly
                return {
                    ...proj,
                    status: pending.status ?? proj.status,
                    squad: pending.squad !== undefined ? (pending.squad === 'Unassigned' ? null : pending.squad) : proj.squad,
                    squads: pending.squads !== undefined ? pending.squads : (pending.squad !== undefined ? (pending.squad === 'Unassigned' ? [] : [pending.squad]) : proj.squads),
                    start: pending.start ?? proj.start,
                    end: pending.end ?? proj.end,
                    wave: pending.wave !== undefined ? pending.wave : proj.wave,
                    kickOff: pending.start ?? pending.kickOff ?? proj.kickOff,
                    launch: pending.end ?? pending.launch ?? proj.launch,
                    effortProfile: pending.effortProfile ?? proj.effortProfile,
                    resourcingOverride: pending.resourcingOverride ?? proj.resourcingOverride,
                    transactionalBenefits: pending.transactionalBenefits ?? proj.transactionalBenefits,
                    nonTransactionalBenefits: pending.nonTransactionalBenefits ?? proj.nonTransactionalBenefits,
                    contentOnlyBenefits: pending.contentOnlyBenefits ?? proj.contentOnlyBenefits,
                    // Lock fields for optimistic UI
                    lockLaunch: pending.lockLaunch !== undefined ? pending.lockLaunch : proj.lockLaunch,
                    lockSquad: pending.lockSquad !== undefined ? pending.lockSquad : proj.lockSquad,
                    lockResources: pending.lockResources !== undefined ? pending.lockResources : proj.lockResources,
                    // Program resourcing + "resourced" flag (previously missed — caused batch updates to appear laggy)
                    resourcedWithinProgram: pending.resourcedWithinProgram !== undefined ? pending.resourcedWithinProgram : proj.resourcedWithinProgram,
                    resourced: pending.resourced !== undefined ? pending.resourced : proj.resourced,
                    resourcingNotes: pending.resourcingNotes !== undefined ? pending.resourcingNotes : proj.resourcingNotes,
                    // Merge team changes for instant add/remove/copy
                    // Defensive merge: ensure we don't lose existing team members when pending.team only has partial roles
                    team: (() => {
                        const baseTeam = proj.team || { pm: [], sc: [], pd: [] };
                        if (!pending.team) return baseTeam;
                        // Merge pending team roles onto base team (pending takes priority for roles it has)
                        return {
                            pm: pending.team.pm !== undefined ? pending.team.pm : baseTeam.pm,
                            sc: pending.team.sc !== undefined ? pending.team.sc : baseTeam.sc,
                            pd: pending.team.pd !== undefined ? pending.team.pd : baseTeam.pd
                        };
                    })(),
                    isPending: true, // Mark as pending for UI indication
                    isDraft: pending.isDraft // Pass draft status
                };
            });
        }

        return projects;
    }, [allProjects, mergeProjects, pendingUpdates]);

    // Stabilize effectiveProjects reference — only emit new ref when data actually changes
    const stableEffProjRef = useRef({ hash: '', data: [] });
    const effectiveProjects = useMemo(() => {
        // Lightweight fingerprint: id + status + squad + dates + team + locks. The team
        // sub-key MUST include each member's allocationPct AND per-member start/end
        // dates, not just member IDs — otherwise an edit that only changes a %
        // (same members, different alloc) won't bust the memo, and consumers like
        // the DetailModal team panel see stale data and render "Total: Even split%"
        // even though the JSON has been updated.
        const memberKey = (m) => `${m.id}:${m.allocationPct ?? ''}:${m.startDate || ''}:${m.endDate || ''}`;
        const hash = rawEffectiveProjects.map(p => {
            const t = p.team || {};
            const teamKey = `${(t.pm || []).map(memberKey).join('+')}|${(t.sc || []).map(memberKey).join('+')}|${(t.pd || []).map(memberKey).join('+')}`;
            return `${p.id}|${p.status}|${p.squad}|${p.start}|${p.end}|${p.kickOff}|${p.launch}|${p.effortProfile}|${p.lockLaunch}|${p.lockSquad}|${p.lockResources}|${p.wave}|${teamKey}`;
        }).join(',');
        if (hash === stableEffProjRef.current.hash) return stableEffProjRef.current.data;
        stableEffProjRef.current = { hash, data: rawEffectiveProjects };
        return rawEffectiveProjects;
    }, [rawEffectiveProjects]);

    // Effective Resources: Base data + scenario changes (draft mode) + optimistic updates (live mode)
    const rawEffectiveResources = useMemo(() => {
        // Apply scenario changes using mergeResources from useScenarioSelection
        const merged = mergeResources(allResources);

        // Apply optimistic updates for immediate visual feedback
        if (Object.keys(pendingResourceUpdates).length === 0) return merged;

        return merged.map(r => {
            const pending = pendingResourceUpdates[r.id];
            if (!pending) return r;
            return { ...r, ...pending };
        });
    }, [allResources, mergeResources, pendingResourceUpdates]);

    // Stabilize effectiveResources reference — only emit new ref when data actually changes
    const stableEffResRef = useRef({ hash: '', data: [] });
    const effectiveResources = useMemo(() => {
        const hash = rawEffectiveResources.map(r => `${r.id}|${r.role}|${r.targetUtilization}|${r.workingHours}`).join(',');
        if (hash === stableEffResRef.current.hash) return stableEffResRef.current.data;
        stableEffResRef.current = { hash, data: rawEffectiveResources };
        return rawEffectiveResources;
    }, [rawEffectiveResources]);


    // Program Budgets: Aggregate projects with resourcedWithinProgram by customer
    const programBudgets = useMemo(() => {
        const programs = {};
        effectiveProjects.forEach(p => {
            if (!p.resourcedWithinProgram || !p.customer) return;

            if (!programs[p.customer]) {
                programs[p.customer] = {
                    customer: p.customer,
                    workstreams: [],
                    totalHours: 0,
                    projects: [],
                    programProjects: [], // For displaying contributing projects list
                    start: p.kickOff || p.start,
                    end: p.launch || p.end
                };
            }

            const program = programs[p.customer];
            program.projects.push(p);
            // Store full project data for modal display (hours, countryFlag, etc.)
            program.programProjects.push(p);

            // Calculate hours - Program Budget is a percentage of total project hours
            const programDiscount = storedSettings.programDiscount || 15;
            const pmHours = p.pmValOriginal || p.pmVal || 0;
            const scHours = p.scValOriginal || p.scVal || 0;
            const pdHours = p.pdValOriginal || p.pdVal || 0;

            // Apply discount to each component directly to match useCapacityData logic
            const discountMultiplier = (programDiscount / 100);
            const programHours = (pmHours + scHours + pdHours) * discountMultiplier;

            program.totalHours += programHours;

            // Track date range
            const pStart = p.start ? new Date(p.start) : null;
            const pEnd = p.end ? new Date(p.end) : null;
            if (pStart && (!program.start || pStart < program.start)) program.start = pStart;
            if (pEnd && (!program.end || pEnd > program.end)) program.end = pEnd;
        });

        const workstreams = storedSettings.programWorkstreams || [];
        Object.values(programs).forEach(p => {
            p.workstreams = workstreams.map(ws => ({
                ...ws,
                hours: p.totalHours * (ws.allocationPct / 100)
            }));
        });

        // Note: global Program Budget is computed separately by globalProgramBudget below.

        return programs;
    }, [effectiveProjects, storedSettings.programDiscount, storedSettings.programWorkstreams]);

    // Global Program Budget (Single Item)
    const globalProgramBudget = useMemo(() => {
        if (!storedSettings.programAssignments) return null;

        const workstreamDefs = storedSettings.programWorkstreams || [];
        const programDiscount = storedSettings.programDiscount || 15;

        let totalTransferredHours = 0;
        let minStart = null;
        let maxEnd = null;
        const programProjects = [];
        const projectContributions = []; // Track per-project contributions with dates

        effectiveProjects.forEach(p => {
            if (p.resourcedWithinProgram) {
                const pmHours = p.pmValOriginal || p.pmVal || 0;
                const scHours = p.scValOriginal || p.scVal || 0;
                const pdHours = p.pdValOriginal || p.pdVal || 0;

                const efficiencyFactor = storedSettings?.programEfficiencyFactor || 0;
                const efficiencyMultiplier = 1 - (efficiencyFactor / 100);

                const discountMultiplier = (programDiscount / 100);
                const hours = (pmHours + scHours + pdHours) * efficiencyMultiplier * discountMultiplier;

                totalTransferredHours += hours;
                programProjects.push(p);

                // Store contribution with project date range for worker processing
                projectContributions.push({
                    projectId: p.id,
                    projectName: p.name,
                    hours,
                    start: p.start,
                    end: p.end,
                    effortProfile: p.effortProfile
                });

                const pStart = p.start ? new Date(p.start) : null;
                let pEnd = p.end ? new Date(p.end) : null;

                if (pEnd && p.effortProfile && p.effortProfile.toLowerCase().includes('fps')) {
                    pEnd = new Date(pEnd.getTime() + (6 * 7 * 24 * 60 * 60 * 1000));
                }

                if (pStart && (!minStart || pStart < minStart)) minStart = pStart;
                if (pEnd && (!maxEnd || pEnd > maxEnd)) maxEnd = pEnd;
            }
        });

        const workstreams = workstreamDefs.map(ws => ({
            ...ws,
            hours: totalTransferredHours * (ws.allocationPct / 100)
        }));

        return {
            id: 'global_program',
            customer: 'Program Budget',
            totalHours: totalTransferredHours,
            workstreams,
            programProjects,
            projectContributions, // Include for worker processing
            start: minStart ? minStart.toISOString().split('T')[0] : null,
            end: maxEnd ? maxEnd.toISOString().split('T')[0] : null
        };
    }, [effectiveProjects, storedSettings.programDiscount, storedSettings.programWorkstreams, storedSettings.programAssignments]);


    // Unique squads
    const allSquads = useMemo(() => {
        const squadSet = new Set();
        // V1 Parity: Include active squads from settings if defined
        const activeSquadsSetting = storedSettings.activeSquads || [];

        allResources.forEach(r => {
            // r.squads is an array from getSquadsList
            (r.squads || []).forEach(s => {
                if (s && s !== 'Unassigned') {
                    // Only add if activeSquads is empty (show all) OR squad is explicitly active
                    if (activeSquadsSetting.length === 0 || activeSquadsSetting.includes(s)) {
                        squadSet.add(s);
                    }
                }
            });
        });
        return Array.from(squadSet).sort();
    }, [allResources, storedSettings.activeSquads]);

    // Unfiltered squad list for Settings modal (so user can see ALL squads to toggle them)
    const allSquadsUnfiltered = useMemo(() => {
        const squadSet = new Set();
        allResources.forEach(r => {
            (r.squads || []).forEach(s => {
                if (s && s !== 'Unassigned') {
                    squadSet.add(s);
                }
            });
        });
        return Array.from(squadSet).sort();
    }, [allResources]);

    // Unique companies (for multi-company/merger support)
    const allCompanies = useMemo(() => {
        const companySet = new Set();
        allResources.forEach(r => {
            if (r.company) companySet.add(r.company);
        });
        allProjects.forEach(p => {
            if (p.company) companySet.add(p.company);
        });
        return Array.from(companySet).sort();
    }, [allResources, allProjects]);

    // V1 Parity: Extract unique entities from projects (Selling Entity)
    const allEntities = useMemo(() => {
        const entitySet = new Set();
        allProjects.forEach(p => {
            if (p.origin) entitySet.add(p.origin);
        });
        return Array.from(entitySet).sort();
    }, [allProjects]);

    // V1 Parity: Persist entity filter to localStorage
    React.useEffect(() => {
        localStorage.setItem('capacitySelectedEntities', JSON.stringify(selectedEntities));
    }, [selectedEntities]);

    // Memoize config objects to prevent infinite render loops
    const capacityConfig = useMemo(() => ({
        granularity: 'week',
        ...storedSettings,
        programBudgets, // Pass programBudgets for duration calculations in worker
        // Include computed workstream hours and program dates from globalProgramBudget
        programWorkstreamsWithHours: globalProgramBudget?.workstreams || [],
        programProjectContributions: globalProgramBudget?.projectContributions || [], // Per-project contributions with dates
        programStartDate: globalProgramBudget?.start || null,
        programEndDate: globalProgramBudget?.end || null
    }), [storedSettings, globalProgramBudget, programBudgets]);

    const rampProfiles = useMemo(() => storedSettings.rampProfiles || [], [storedSettings.rampProfiles]);
    const winRates = useMemo(() => storedSettings.winRates || {}, [storedSettings.winRates]);
    const roleMapping = useMemo(() => storedSettings.roleMapping || {}, [storedSettings.roleMapping]);
    const modelParams = useMemo(() => ({
        capacityMultiplier: storedSettings.capacityMultiplier || 1,
        capacityBuffer: storedSettings.capacityBuffer || 10,
        thresholds: storedSettings.thresholds || { greenStart: 0.8, redStart: 1.0 }
    }), [storedSettings.capacityMultiplier, storedSettings.capacityBuffer, storedSettings.thresholds]);
    const sprintStartDate = useMemo(() => storedSettings.sprintStartDate || null, [storedSettings.sprintStartDate]);

    // Capacity Data from Web Worker
    const {
        filteredResources,
        filteredProjects,
        processedData,
        kpiTotals,
        uniqueStatuses,
        todayKey,
        revRecTotals, // Revenue Recognition (Financial Mode)
        revRecByProject, // Per-project revenue breakdown for drawer
        isLoading: isCapacityLoading,
        slotMap, // Slot Optimization: Available slots per squad/week
        virtualBAUProjects: workerVirtualBAUProjects // Virtual BAU projects from worker
    } = useCapacityData({
        resList: effectiveResources, // Use effective data (with draft/optimistic overlays)
        projList: effectiveProjects, // Use effective data (with draft/optimistic overlays)
        config: capacityConfig,
        timeRange,
        customStartDate: customStartDate || null,
        customEndDate: customEndDate || null,
        fiscalYearMode: false,
        modelParams,
        rampProfiles,
        winRates,
        sprintStartDate,
        // Squad filter: if user explicitly selected squads, use those; otherwise fall back to activeSquads from settings
        // This ensures capacity is only calculated from squads defined in Settings > Squads
        enabledSquads: squadViewFilter.length > 0 ? squadViewFilter : (storedSettings.activeSquads || []),
        // Project squad filter: ONLY filter projects when user explicitly selects squads in dropdown
        // This allows showing ALL projects (demand) while limiting capacity to settings-defined squads
        projectSquadFilter: squadViewFilter, // Empty array = show all projects
        platformFilter: platformViewFilter, // Platform filter: resources by squad platform, projects by project platform
        resourceSearch: debouncedSearch,
        selectedCategory,
        sortBy,
        roleMapping,
        roleConfig: storedSettings.roleConfig || { jobs: {}, constraints: {} },  // Primary/secondary roles
        forecastMode,
        selectedEntities: debouncedSelectedEntities, // V1 Parity: Debounced entity filter
        initiatives: storedSettings.initiatives || [],
        showInitiativesEffect,
        slotProfile: storedSettings.slotProfile || null, // Slot Optimization
        demandCategory // BAU Feature: 'all' | 'implementation' | 'bau'
    });

    // Mark initial load as complete when we first get data
    useEffect(() => {
        if (!isCapacityLoading && processedData && processedData.length > 0 && !hasInitialLoadedRef.current) {
            hasInitialLoadedRef.current = true;
        }
    }, [isCapacityLoading, processedData]);

    // Use stable empty arrays to prevent infinite loops
    const EMPTY_ARRAY = useMemo(() => [], []);
    const stableFilteredResources = filteredResources || EMPTY_ARRAY;
    const stableFilteredProjects = filteredProjects || EMPTY_ARRAY;

    // Quick Filter Pills: Collect all active filters for display as removable pills
    const activeFilters = useMemo(() => {
        const filters = [];

        // Squad filters
        squadViewFilter.forEach(squad => {
            filters.push({
                type: 'squad',
                label: squad,
                icon: '👥',
                color: '#3b82f6',
                onRemove: () => setSquadViewFilter(prev => prev.filter(s => s !== squad))
            });
        });

        // Platform filters
        platformViewFilter.forEach(platform => {
            filters.push({
                type: 'platform',
                label: platform,
                icon: '🧩',
                color: '#0ea5e9',
                onRemove: () => setPlatformViewFilter(prev => prev.filter(p => p !== platform))
            });
        });

        // Entity filters
        selectedEntities.forEach(entity => {
            filters.push({
                type: 'entity',
                label: entity,
                icon: '🏢',
                color: '#BD65FF',
                onRemove: () => setSelectedEntities(prev => {
                    const updated = prev.filter(e => e !== entity);
                    try { localStorage.setItem('capacitySelectedEntities', JSON.stringify(updated)); } catch (e) { }
                    return updated;
                })
            });
        });

        // Role filter
        if (selectedCategory !== 'All') {
            filters.push({
                type: 'role',
                label: selectedCategory,
                icon: '🎭',
                color: '#00BD00',
                onRemove: () => setSelectedCategory('All')
            });
        }

        // Exceptions only
        if (exceptionsOnly) {
            filters.push({
                type: 'exceptions',
                label: 'Exceptions Only',
                icon: '⚠️',
                color: '#f59e0b',
                onRemove: () => setExceptionsOnly(false)
            });
        }

        // Status filters
        statusViewFilter.forEach(status => {
            filters.push({
                type: 'status',
                label: status,
                icon: '📋',
                color: '#8b5cf6',
                onRemove: () => setStatusViewFilter(prev => prev.filter(s => s !== status))
            });
        });

        // Project highlight
        if (highlightProject) {
            filters.push({
                type: 'highlight',
                label: highlightProject,
                icon: '✨',
                color: '#f59e0b',
                onRemove: () => setHighlightProject('')
            });
        }

        return filters;
    }, [squadViewFilter, statusViewFilter, platformViewFilter, selectedEntities, selectedCategory, exceptionsOnly, highlightProject]);


    // Grouping
    const { groupedResourceData, groupedProjectData, groupStats } = useGrouping({
        filteredResources: stableFilteredResources,
        filteredProjects: stableFilteredProjects,
        enabledSquads: squadViewFilter,
        statusFilter: statusViewFilter,
        groupBy,
        forecastMode
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD HANDLERS HOOK - Extracted business logic for maintainability
    // Placed after useCapacityData to access filteredProjects
    // ═══════════════════════════════════════════════════════════════════════════
    const dashboardHandlers = useDashboardHandlers({
        projTable,
        resTable,
        scenarioManager,
        activeScenario,
        pendingUpdates,
        pendingResourceUpdates,
        effectiveProjects,
        allProjects,
        allResources,
        storedSettings,
        currentUserName,
        addToast,
        setActiveCell,
        setSelectedBucketData,
        setSelectedProgram,
        setPendingUpdates,
        setPendingResourceUpdates,
        setScenarios,
        filteredProjects: stableFilteredProjects,
        selectedBucketData,
        // Scenario-related deps
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        pendingScenarioId,
        setPendingScenarioId,
        setShowConflictModal,
        setDetectedConflicts,
        // Assignment history deps for undo/redo
        assignmentHistory,
        assignmentFuture,
        setAssignmentHistory,
        setAssignmentFuture,
        // Commit scenario deps
        stableSettings,
        resolveFieldId,
        squadIdMap,
        setShowCommitModal,
        logAuditEvent,
        AUDIT_EVENTS,
        SETTINGS,
        // Apply optimizations dep
        saveAISnapshot,
        // Slot assignment deps
        squadViewFilter,
        pendingSlotAssignment,
        setPendingSlotAssignment,
        // Team Management deps
        squadRecords,
        viewMode,
        // SaveAllocations / BatchApply deps
        activeCell,
        setShowBatchModal,
        setSelectedProjects,
        setIsBatchUpdating,
        // Scenario clone/delete deps
        setDeleteConfirmScenario,
        setRenameData,
        renameData,
        // Scenario create deps
        setShowCreateScenario,
        // Settings save deps
        settingsTable,
        settingsRecords,
        setStoredSettings,
        // Initiatives deps
        setShowInitiativesModal,
        // AI Insights deps
        base,
        setAiLoading,
        setAiInsightData,
        setShowAIModal,
        writeSlotSnapshot,
        readAIRecommendations,
        // Notes deps
        setShowNotesModal,
        // Optimization deps
        setShowOptimizationModal,
        // Merge conflict modal deps
        setMergeConflictData,
        // Delete confirm deps
        deleteConfirmScenario,
        // Program table deps
        programsTable,
        programRecords,
    });

    // NOTE: Undo/redo keyboard shortcuts (Cmd+Z / Cmd+Shift+Z) are handled by
    // useKeyboardShortcuts hook (see keyboardShortcuts array above, line ~494).
    // A duplicate handler was previously registered here — removed to prevent double-fire.

    // V1 Parity: Apply exceptionsOnly filter (show only <50% or >100% utilization)
    // Program Resourcing: Inject virtual "Program Budget" rows per customer
    const groupedProjectDataWithPrograms = useMemo(() => {
        if (viewMode !== 'projects' || groupBy !== 'customer') return groupedProjectData;

        const result = { ...groupedProjectData };
        const programDiscount = storedSettings.programDiscount || 15;
        const workstreams = storedSettings.programWorkstreams || [];

        // For each customer, calculate program budget from resourcedWithinProgram projects
        Object.keys(result).forEach(customer => {
            const customerProjects = Object.values(result[customer] || {}).flat();
            const programProjects = customerProjects.filter(p => p.resourcedWithinProgram);

            if (programProjects.length > 0) {
                // Calculate total discounted hours transferred to program
                let totalTransferredHours = 0;
                let minStart = null;
                let maxEnd = null;

                programProjects.forEach(p => {
                    const totalHours = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);
                    // The discount was already applied in useCapacityData, so we need to calculate what was transferred
                    const originalHours = (p.pmValOriginal || p.pmVal || 0) + (p.scValOriginal || p.scVal || 0) + (p.pdValOriginal || p.pdVal || 0);
                    const transferredHours = originalHours * (programDiscount / 100);
                    totalTransferredHours += transferredHours;

                    // Track date range
                    const pStart = p.start ? new Date(p.start) : null;
                    const pEnd = p.end ? new Date(p.end) : null;
                    if (pStart && (!minStart || pStart < minStart)) minStart = pStart;
                    if (pEnd && (!maxEnd || pEnd > maxEnd)) maxEnd = pEnd;
                });

                // Create virtual program budget row
                if (totalTransferredHours > 0) {
                    const programRow = {
                        id: `program_${customer.replace(/\s+/g, '_').toLowerCase()}`,
                        name: `${customer} Program`,
                        uniqueKey: `program_${customer}`,
                        isProgram: true,
                        customer,
                        status: 'Program',
                        start: minStart ? minStart.toISOString().split('T')[0] : null,
                        end: maxEnd ? maxEnd.toISOString().split('T')[0] : null,
                        totalHours: totalTransferredHours,
                        pmVal: 0, scVal: 0, pdVal: 0, // Demand calculated separately by workstream
                        workstreams: workstreams.map(ws => ({
                            ...ws,
                            hours: totalTransferredHours * (ws.allocationPct / 100)
                        })),
                        programProjects: [...programProjects],
                        buckets: {} // Will be populated by worker in future
                    };

                    // Add to a special "Program" subgroup
                    if (!result[customer]['★ Program']) {
                        result[customer] = { '★ Program': [], ...result[customer] };
                    }
                    result[customer]['★ Program'].push(programRow);
                }
            }
        });

        return result;
    }, [groupedProjectData, viewMode, groupBy, storedSettings.programDiscount, storedSettings.programWorkstreams]);

    const activeGroupedData = viewMode === 'projects' ? groupedProjectDataWithPrograms : groupedResourceData;
    const filteredGroupedData = useMemo(() => {
        if (!exceptionsOnly && !showNotesOnly) return activeGroupedData;
        const result = {};
        Object.entries(activeGroupedData || {}).forEach(([gKey, subGroups]) => {
            const newSubGroups = {};
            let hasData = false;
            Object.entries(subGroups || {}).forEach(([sgKey, resources]) => {
                const filtered = resources.filter(r => {
                    // Exceptions filter: show only <50% or >100% utilization
                    if (exceptionsOnly) {
                        let totalCap = 0, totalDem = 0;
                        Object.values(r.buckets || {}).forEach(b => { totalCap += b.cap || 0; totalDem += b.dem || 0; });
                        const util = totalCap > 0 ? totalDem / totalCap : 0;
                        if (!(util < 0.5 || util > 1.0)) return false;
                    }
                    // Notes filter: show only projects with resourcing notes
                    if (showNotesOnly && !r.resourcingNotes) return false;
                    return true;
                });
                if (filtered.length > 0) {
                    newSubGroups[sgKey] = filtered;
                    hasData = true;
                }
            });
            if (hasData) result[gKey] = newSubGroups;
        });
        return result;
    }, [activeGroupedData, exceptionsOnly, showNotesOnly]);

    // Active projects
    // Filter for active projects in the selected period and squad view
    const activeProjects = useMemo(() => {
        return effectiveProjects.filter(p => !squadViewFilter || !p.squads || p.squads.some(s => squadViewFilter.includes(s)));
    }, [effectiveProjects, squadViewFilter]);

    // BAU Mode Split View
    // - virtualBAUProjects: Come from worker (synthetic bau-xxx entries representing ongoing BAU demand)
    // - renewalCRProjects: Filtered from activeProjects (Renewals, Change Requests)
    const bauProjectTypes = storedSettings.bauProjectTypes || ['Renewal', 'Change Request'];
    const virtualBAUProjects = workerVirtualBAUProjects || [];

    const renewalCRProjects = useMemo(() => {
        return activeProjects.filter(p => {
            const pType = p.projectType || 'Implementation';
            return bauProjectTypes.includes(pType);
        });
    }, [activeProjects, bauProjectTypes]);



    // Available squads for BAU edit modal
    const availableSquads = useMemo(() => {
        const squads = new Set();
        effectiveProjects.forEach(p => {
            if (p.squad) squads.add(p.squad);
            if (p.squads) p.squads.forEach(s => squads.add(s));
        });
        return Array.from(squads).filter(Boolean).sort();
    }, [effectiveProjects]);

    // Financial Summary - Total Benefits from active projects (Transactional + Non-Transactional + Content Only)
    const totalBenefits = useMemo(() => {
        return activeProjects.reduce((sum, p) => sum
            + (p.transactionalBenefits || 0)
            + (p.nonTransactionalBenefits || 0)
            + (p.contentOnlyBenefits || 0), 0);
    }, [activeProjects]);

    // Demand Mix Calculation - Implementation vs BAU split (includes virtual BAU)
    const demandMix = useMemo(() => {
        // When in pure BAU mode, the only demand IS BAU demand
        if (demandCategory === 'bau') {
            return { implDemand: 0, bauDemand: 1, totalDemand: 1, implPct: 0, bauPct: 100 };
        }

        const bauProjectTypes = storedSettings.bauProjectTypes || ['Renewal', 'Change Request', 'Change Project'];
        let implDemand = 0;
        let bauDemand = 0;

        // 1. Sum real project demand from activeProjects
        activeProjects.forEach(p => {
            // Calculate total demand for this project (PM + SC + PD hours)
            const projectDemand = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);
            const projectType = (p.projectType || 'Implementation').toLowerCase();

            // Use partial matching (case-insensitive) like other places in the codebase
            const isBauType = bauProjectTypes.some(t => projectType.includes(t.toLowerCase()));
            if (isBauType) {
                bauDemand += projectDemand;
            } else {
                implDemand += projectDemand;
            }
        });

        // 2. Add virtual BAU demand from processedData (synthesized by worker)
        // Virtual BAU projects have status 'BAU' and IDs starting with 'bau-'
        if (processedData && processedData.length > 0) {
            processedData.forEach(week => {
                if (week.unassignedMap) {
                    Object.values(week.unassignedMap).forEach(item => {
                        // Check if this is a virtual BAU item (synthetic ID)
                        if (item.status === 'BAU' && String(item.id || '').startsWith('bau-')) {
                            bauDemand += (item.hours || 0);
                        }
                    });
                }
            });
        }

        const totalDemand = implDemand + bauDemand;
        const implPct = totalDemand > 0 ? Math.round((implDemand / totalDemand) * 100) : 100;
        const bauPct = totalDemand > 0 ? Math.round((bauDemand / totalDemand) * 100) : 0;

        return { implDemand, bauDemand, totalDemand, implPct, bauPct };
    }, [activeProjects, storedSettings.bauProjectTypes, processedData, demandCategory]);

    // Filtered Revenue Calculation - Respects active filters and period selection
    const filteredRevenue = useMemo(() => {
        // Get period boundaries
        const today = new Date();
        const currentYear = today.getFullYear();
        const fyStartMonth = storedSettings.fyStartMonth ?? 4; // Default: May (0-indexed = 4)

        let periodStart, periodEnd, periodLabel;
        switch (financialPeriod) {
            case 'cy':
                periodStart = new Date(currentYear, 0, 1);
                periodEnd = new Date(currentYear, 11, 31, 23, 59, 59);
                periodLabel = `Calendar Year ${currentYear}`;
                break;
            case 'cy_next':
                periodStart = new Date(currentYear + 1, 0, 1);
                periodEnd = new Date(currentYear + 1, 11, 31, 23, 59, 59);
                periodLabel = `Calendar Year ${currentYear + 1}`;
                break;
            case 'fy':
            default:
                const fyYear = today.getMonth() < fyStartMonth ? currentYear - 1 : currentYear;
                periodStart = new Date(fyYear, fyStartMonth, 1);
                const fyEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
                const fyEndYear = fyStartMonth === 0 ? fyYear : fyYear + 1;
                periodEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59);
                periodLabel = `FY ${fyYear}/${fyYear + 1}`;
                break;
        }

        // Use filtered projects (respects squad, status, entity filters)
        const filteredIds = new Set(stableFilteredProjects.map(p => p.id));
        const projectsInPeriod = [];
        let totals = { implFee: 0, arr: 0, total: 0 };

        // Calculate revenue for each filtered project in the selected period
        stableFilteredProjects.forEach(p => {
            const launchDate = p.end ? new Date(p.end) : null;
            const kickOffDate = p.start ? new Date(p.start) : null;
            const implFee = p.implFee || 0;
            const arrVal = p.arr || 0;
            // Check for POC: must contain 'poc' but NOT be 'non-poc'
            const revenueModelLower = (p.revenueModel || '').toLowerCase();
            const isPOC = revenueModelLower.includes('poc') && !revenueModelLower.includes('non-poc') && !revenueModelLower.includes('non poc');

            if (!launchDate || isNaN(launchDate.getTime())) return;

            let projectImplFee = 0;
            let projectArr = 0;
            let implFeeReason = '';
            let arrReason = '';

            // ARR recognized at launch
            if (launchDate >= periodStart && launchDate <= periodEnd) {
                projectArr = arrVal;
                arrReason = `Launch ${launchDate.toISOString().split('T')[0]} is within period → 100% of £${arrVal.toLocaleString()} ARR`;
            } else if (arrVal > 0) {
                arrReason = `Launch ${launchDate.toISOString().split('T')[0]} outside period (${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]}) → £0`;
            }

            // Impl Fee depends on model
            if (isPOC && kickOffDate && launchDate > kickOffDate) {
                const projectDuration = launchDate - kickOffDate;
                const totalDays = Math.round(projectDuration / (1000 * 60 * 60 * 24));
                const effectiveStart = Math.max(kickOffDate.getTime(), periodStart.getTime());
                const effectiveEnd = Math.min(launchDate.getTime(), periodEnd.getTime());
                if (effectiveEnd > effectiveStart) {
                    const overlapDuration = effectiveEnd - effectiveStart;
                    const overlapDays = Math.round(overlapDuration / (1000 * 60 * 60 * 24));
                    const overlapPct = Math.round((overlapDuration / projectDuration) * 100);
                    projectImplFee = (overlapDuration / projectDuration) * implFee;
                    implFeeReason = `POC: ${overlapDays}/${totalDays} days (${overlapPct}%) in period → ${overlapPct}% of £${implFee.toLocaleString()} = £${Math.round(projectImplFee).toLocaleString()}`;
                } else if (implFee > 0) {
                    implFeeReason = `POC: Project dates (${kickOffDate.toISOString().split('T')[0]} - ${launchDate.toISOString().split('T')[0]}) don't overlap period → £0`;
                }
            } else {
                if (launchDate >= periodStart && launchDate <= periodEnd) {
                    projectImplFee = implFee;
                    implFeeReason = `Non-POC: Launch in period → 100% of £${implFee.toLocaleString()} impl fee`;
                } else if (implFee > 0) {
                    implFeeReason = `Non-POC: Launch ${launchDate.toISOString().split('T')[0]} outside period → £0`;
                }
            }

            if (projectImplFee > 0 || projectArr > 0) {
                projectsInPeriod.push({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    launchDate: launchDate.toISOString().split('T')[0],
                    kickOffDate: kickOffDate ? kickOffDate.toISOString().split('T')[0] : null,
                    revenueModel: p.revenueModel || 'Non-POC',
                    implFee: projectImplFee,
                    arr: projectArr,
                    total: projectImplFee + projectArr,
                    // Debug details
                    debug: {
                        rawImplFee: implFee,
                        rawArr: arrVal,
                        isPOC,
                        implFeeReason,
                        arrReason,
                        periodStart: periodStart.toISOString().split('T')[0],
                        periodEnd: periodEnd.toISOString().split('T')[0]
                    }
                });
                totals.implFee += projectImplFee;
                totals.arr += projectArr;
                totals.total += projectImplFee + projectArr;
            }
        });

        return { projects: projectsInPeriod, totals, periodLabel };
    }, [stableFilteredProjects, financialPeriod, storedSettings.fyStartMonth]);

    // Period Context Calculation - Shared by both Live and Draft revenue
    const periodContext = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const fyStartMonth = storedSettings.fyStartMonth ?? 4;

        let periodStart, periodEnd, periodLabel;
        switch (financialPeriod) {
            case 'cy':
                periodStart = new Date(currentYear, 0, 1);
                periodEnd = new Date(currentYear, 11, 31, 23, 59, 59);
                periodLabel = `Calendar Year ${currentYear}`;
                break;
            case 'cy_next':
                periodStart = new Date(currentYear + 1, 0, 1);
                periodEnd = new Date(currentYear + 1, 11, 31, 23, 59, 59);
                periodLabel = `Calendar Year ${currentYear + 1}`;
                break;
            case 'fy_next': {
                // Next Fiscal Year
                const nextFyYear = today.getMonth() < fyStartMonth ? currentYear : currentYear + 1;
                periodStart = new Date(nextFyYear, fyStartMonth, 1);
                const fyNextEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
                const fyNextEndYear = fyStartMonth === 0 ? nextFyYear : nextFyYear + 1;
                periodEnd = new Date(fyNextEndYear, fyNextEndMonth + 1, 0, 23, 59, 59);
                periodLabel = `FY ${nextFyYear}/${nextFyYear + 1}`;
                break;
            }
            case 'fy_next2': {
                // Fiscal Year after next
                const nextFyYear2 = today.getMonth() < fyStartMonth ? currentYear + 1 : currentYear + 2;
                periodStart = new Date(nextFyYear2, fyStartMonth, 1);
                const fyNext2EndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
                const fyNext2EndYear = fyStartMonth === 0 ? nextFyYear2 : nextFyYear2 + 1;
                periodEnd = new Date(fyNext2EndYear, fyNext2EndMonth + 1, 0, 23, 59, 59);
                periodLabel = `FY ${nextFyYear2}/${nextFyYear2 + 1}`;
                break;
            }
            case 'fy':
            default: {
                const fyYear = today.getMonth() < fyStartMonth ? currentYear - 1 : currentYear;
                periodStart = new Date(fyYear, fyStartMonth, 1);
                const fyEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
                const fyEndYear = fyStartMonth === 0 ? fyYear : fyYear + 1;
                periodEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59);
                periodLabel = `FY ${fyYear}/${fyYear + 1}`;
                break;
            }
        }
        return { start: periodStart, end: periodEnd, label: periodLabel };
    }, [financialPeriod, storedSettings.fyStartMonth]);

    // Shared Revenue Calculation Logic
    const calculatePeriodRevenue = useCallback((projectsList, { start, end, label }) => {
        const projectsInPeriod = [];
        let totals = { implFee: 0, arr: 0, total: 0 };

        projectsList.forEach(p => {
            const launchDate = p.end ? new Date(p.end) : null;
            const kickOffDate = p.start ? new Date(p.start) : null;
            const implFee = p.implFee || 0;
            const arrVal = p.arr || 0;
            const revenueModelLower = (p.revenueModel || '').toLowerCase();
            const isPOC = revenueModelLower.includes('poc') && !revenueModelLower.includes('non-poc') && !revenueModelLower.includes('non poc');

            if (!launchDate || isNaN(launchDate.getTime())) return;

            let projectImplFee = 0;
            let projectArr = 0;
            let implFeeReason = '';
            let arrReason = '';

            // ARR recognized at launch
            if (launchDate >= start && launchDate <= end) {
                projectArr = arrVal;
                arrReason = `Launch ${launchDate.toISOString().split('T')[0]} is within period → 100% of £${arrVal.toLocaleString()} ARR`;
            } else if (arrVal > 0) {
                arrReason = `Launch ${launchDate.toISOString().split('T')[0]} outside period → £0`;
            }

            // Impl Fee depends on model
            if (isPOC && kickOffDate && launchDate > kickOffDate) {
                const projectDuration = launchDate - kickOffDate;
                const totalDays = Math.round(projectDuration / (1000 * 60 * 60 * 24));
                const effectiveStart = Math.max(kickOffDate.getTime(), start.getTime());
                const effectiveEnd = Math.min(launchDate.getTime(), end.getTime());
                if (effectiveEnd > effectiveStart) {
                    const overlapDuration = effectiveEnd - effectiveStart;
                    const overlapDays = Math.round(overlapDuration / (1000 * 60 * 60 * 24));
                    const overlapPct = Math.round((overlapDuration / projectDuration) * 100);
                    projectImplFee = (overlapDuration / projectDuration) * implFee;
                    implFeeReason = `POC: ${overlapDays}/${totalDays} days (${overlapPct}%) in period → £${Math.round(projectImplFee).toLocaleString()}`;
                }
            } else {
                if (launchDate >= start && launchDate <= end) {
                    projectImplFee = implFee;
                    implFeeReason = `Non-POC: Launch in period → 100% of £${implFee.toLocaleString()}`;
                }
            }

            if (projectImplFee > 0 || projectArr > 0) {
                projectsInPeriod.push({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    launchDate: launchDate.toISOString().split('T')[0],
                    kickOffDate: kickOffDate ? kickOffDate.toISOString().split('T')[0] : null,
                    revenueModel: p.revenueModel || 'Non-POC',
                    implFee: projectImplFee,
                    arr: projectArr,
                    total: projectImplFee + projectArr,
                    debug: {
                        rawImplFee: implFee, rawArr: arrVal, isPOC, implFeeReason, arrReason,
                        periodStart: start.toISOString().split('T')[0], periodEnd: end.toISOString().split('T')[0]
                    }
                });
                totals.implFee += projectImplFee;
                totals.arr += projectArr;
                totals.total += projectImplFee + projectArr;
            }
        });

        return { projects: projectsInPeriod, totals, periodLabel: label };
    }, []);

    // 1. LIVE REVENUE (Base from Airtable, no overrides)
    // Calculated client-side for the SELECTED period to ensure consistency with Draft
    const liveProjectsRevenue = useMemo(() => {
        return calculatePeriodRevenue(allProjects || [], periodContext);
    }, [allProjects, periodContext, calculatePeriodRevenue]);

    // 2. DRAFT/EFFECTIVE REVENUE (With overrides)
    // Calculated for the same selected period
    const allProjectsRevenue = useMemo(() => {
        return calculatePeriodRevenue(effectiveProjects || [], periodContext);
    }, [effectiveProjects, periodContext, calculatePeriodRevenue]);

    // V1 Parity: Calculate overloaded resources count
    const overloadedCount = useMemo(() => {
        if (!filteredResources) return 0;
        return filteredResources.filter(r => {
            const cap = r.totals?.cap || 0;
            const dem = forecastMode === 'eac' ? (r.totals?.dem_eac || 0) : (r.totals?.dem || 0);
            return cap > 0 && dem > cap;
        }).length;
    }, [filteredResources, forecastMode]);

    // 3. STATS REVENUE (Composite for UI)
    // Combines Full Year (from allProjectsRevenue) with YTD (calculated dynamically)
    const statsRevenue = useMemo(() => {
        // Calculate YTD (Start of Period -> Today, clamped to End of Period)
        const today = new Date();
        const ytdEnd = new Date(Math.min(today.getTime(), periodContext.end.getTime()));

        // If today is before start of period (e.g. Next FY), YTD is 0
        let ytdTotals = { implFee: 0, arr: 0, total: 0 };

        if (ytdEnd > periodContext.start) {
            const ytdResult = calculatePeriodRevenue(effectiveProjects || [], {
                ...periodContext,
                end: ytdEnd,
                label: 'YTD'
            });
            ytdTotals = ytdResult.totals;
        }

        return {
            implFee: {
                fullYear: allProjectsRevenue.totals.implFee,
                toDate: ytdTotals.implFee
            },
            arr: {
                fullYear: allProjectsRevenue.totals.arr,
                toDate: ytdTotals.arr
            },
            total: {
                fullYear: allProjectsRevenue.totals.total,
                toDate: ytdTotals.total
            }
        };
    }, [allProjectsRevenue, effectiveProjects, periodContext, calculatePeriodRevenue]);

    // Calculate Delta for UI (Draft - Live)
    // We use the same period context for both to ensure apples-to-apples comparison
    const revenueDelta = useMemo(() => {
        if (!statsRevenue || !liveProjectsRevenue) return 0;
        return statsRevenue.total.fullYear - liveProjectsRevenue.totals.total;
    }, [statsRevenue, liveProjectsRevenue]);

    // V1 Parity: Check if any filters are active
    const hasActiveFilters = squadViewFilter.length > 0 || statusViewFilter.length > 0 || platformViewFilter.length > 0 || selectedEntities.length > 0 || selectedCategory !== 'All' || resourceSearch || highlightProject || exceptionsOnly || showNotesOnly;
    const resetFilters = () => {
        setSquadViewFilter([]);
        setStatusViewFilter([]);
        setPlatformViewFilter([]);
        setSelectedEntities([]);
        setSelectedCategory('All');
        setResourceSearch('');
        setHighlightProject('');
        setExceptionsOnly(false);
        setShowNotesOnly(false);
    };

    // Stable callback refs: prevent child grid re-renders on every Dashboard render
    const handleTogglePin = useCallback((id) => {
        setStoredSettings(prev => {
            const current = prev.pinnedResources || [];
            const newPins = current.includes(id)
                ? current.filter(p => p !== id)
                : [...current, id];
            return { ...prev, pinnedResources: newPins };
        });
    }, [setStoredSettings]);

    const handleResourceClick = useCallback((r) => {
        setSelectedResourceId(r.id);
        addToRecentlyViewed({ id: r.id, name: r.name || r.id, type: 'resource' });
    }, [addToRecentlyViewed]);

    const handleToggleSelection = useCallback((id, shiftKey, orderedIds) => {
        // Shift-Select Logic — uses InnerGrid's own render-order-truth list (passed in as orderedIds)
        // so the range matches exactly what the user sees on screen, including collapsed-squad
        // visibility and whatever sort the grid has actually applied.
        if (shiftKey && lastSelectedId && lastSelectedId !== id && Array.isArray(orderedIds) && orderedIds.length > 0) {
            const startIdx = orderedIds.indexOf(lastSelectedId);
            const endIdx = orderedIds.indexOf(id);
            if (startIdx !== -1 && endIdx !== -1) {
                const min = Math.min(startIdx, endIdx);
                const max = Math.max(startIdx, endIdx);
                const rangeIds = orderedIds.slice(min, max + 1);
                setSelectedProjects(prev => {
                    const next = new Set(prev);
                    rangeIds.forEach(rid => next.add(rid));
                    return next;
                });
                setLastSelectedId(id);
                return;
            }
            // orderedIds didn't contain both anchors (e.g., one was collapsed or filtered away).
            // Fall through to a plain toggle rather than silently selecting the wrong range.
        }

        // Standard Toggle
        setSelectedProjects(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setLastSelectedId(id);
    }, [lastSelectedId]);

    // Dashboard context value for extracted components
    const dashboardContextValue = useMemo(() => ({
        // View controls
        viewMode, setViewMode,
        cellDisplayMode, setCellDisplayMode,
        zoomLevel, setZoomLevel,
        allGroupsExpanded, setAllGroupsExpanded,
        groupBy, setGroupBy,
        sortBy, setSortBy,
        // Filters
        selectedCategory, setSelectedCategory,
        activeMenu, setActiveMenu,
        themedStyles,
    }), [
        viewMode, cellDisplayMode, zoomLevel, allGroupsExpanded, groupBy, sortBy,
        selectedCategory, activeMenu, themedStyles
    ]);

    // Loading state — placed AFTER all hooks so every render runs the same hooks
    // in the same order (moving this above the hooks above violated the Rules of
    // Hooks and crashed with "rendered more hooks than during the previous render"
    // once Airtable records resolved asynchronously).
    if (!resRecords || !projRecords) {
        return <LoadingScreen message="Loading Airtable data..." />;
    }

    return (
        <DashboardProvider value={dashboardContextValue}>
            <ErrorBoundary>
                <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                    {/* Settings Restored Banner */}
                    {settingsRestoredFromBackup && (
                        <div style={{
                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                            color: '#78350f',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <span>⚠️ Settings were restored from local backup — please verify your configuration in Settings.</span>
                            <span
                                onClick={() => setSettingsRestoredFromBackup(false)}
                                style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(120,53,15,0.15)', fontSize: '11px' }}
                            >Dismiss</span>
                        </div>
                    )}
                    {/* Draft Mode Banner - Shows when a scenario is active */}
                    {activeScenario && (
                        <DraftModeBanner
                            scenario={activeScenario}
                            onExitDraft={() => setActiveScenarioId(null)}
                            onNotes={() => setShowNotesModal(true)}
                            onViewChanges={() => setShowViewChanges(true)}
                            onCommit={dashboardHandlers.handleCommitScenario}
                            onDiscard={() => setShowDiscardConfirm(true)}
                            revRecTotals={allProjectsRevenue?.totals ? {
                                implFee: { fullYear: allProjectsRevenue.totals.implFee || 0 },
                                arr: { fullYear: allProjectsRevenue.totals.arr || 0 },
                                total: { fullYear: allProjectsRevenue.totals.total || 0 }
                            } : {
                                // Fallback if no revenue calculated yet
                                implFee: { fullYear: 0 }, arr: { fullYear: 0 }, total: { fullYear: 0 }
                            }}
                            // Use LIVE REVENUE calculated for the same period (apples-to-apples comparison)
                            liveRevRecTotals={liveProjectsRevenue?.totals ? {
                                implFee: { fullYear: liveProjectsRevenue.totals.implFee || 0 },
                                arr: { fullYear: liveProjectsRevenue.totals.arr || 0 },
                                total: { fullYear: liveProjectsRevenue.totals.total || 0 }
                            } : {
                                implFee: { fullYear: 0 }, arr: { fullYear: 0 }, total: { fullYear: 0 }
                            }}
                            onAddFinancialAdjustment={dashboardHandlers.handleAddFinancialAdjustment}
                            onRemoveFinancialAdjustment={dashboardHandlers.handleRemoveFinancialAdjustment}
                            data-tour="draft-banner"
                        />
                    )}

                    {/* ENTERPRISE HEADER - Glassmorphism + Premium Feel */}
                    <div style={{
                        flexShrink: 0,
                        background: themedStyles.headerBg,
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderBottom: themedStyles.headerBorder,
                        boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 20px rgba(0, 0, 0, 0.02)',
                        zIndex: 100
                    }}>

                        {/* Collapsible toolbar container */}
                        <div style={{
                            maxHeight: menuCollapsed ? '0px' : '500px',
                            overflow: menuCollapsed ? 'hidden' : 'visible',
                            transition: menuCollapsed ? 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease' : 'none',
                            opacity: menuCollapsed ? 0 : 1,
                        }}>

                            {/* ROW 1: Navigation & Primary Filters */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 20px',
                                borderBottom: '1px solid rgba(241, 245, 249, 0.6)',
                                flexWrap: 'wrap',
                                gap: '8px',
                                position: 'relative',
                                zIndex: 20
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Unified Date Navigator - Combines Today + Custom Range */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        backgroundColor: (customStartDate || customEndDate) ? '#eff6ff' : 'rgba(248, 250, 252, 0.8)',
                                        padding: '3px',
                                        borderRadius: '10px',
                                        border: (customStartDate || customEndDate) ? '1px solid #93c5fd' : '1px solid rgba(226, 232, 240, 0.6)',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                                        position: 'relative'
                                    }}
                                        data-tour="date-nav"
                                    >
                                        <button
                                            onClick={() => document.querySelector('[data-grid-scroll]')?.scrollBy({ left: -600, behavior: 'smooth' })}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title="Scroll left"
                                        >
                                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <button
                                            onClick={scrollToToday}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25), 0 1px 2px rgba(0, 0, 0, 0.1)',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: 'white',
                                                transition: 'all 0.15s ease',
                                                letterSpacing: '0.3px'
                                            }}
                                            title="Jump to today (T)"
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.35), 0 2px 4px rgba(0, 0, 0, 0.15)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.25), 0 1px 2px rgba(0, 0, 0, 0.1)';
                                            }}
                                        >
                                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Today
                                            <span style={{ fontSize: '9px', opacity: 0.7, fontWeight: '500' }}>(T)</span>
                                        </button>
                                        <button
                                            onClick={() => document.querySelector('[data-grid-scroll]')?.scrollBy({ left: 600, behavior: 'smooth' })}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title="Scroll right"
                                        >
                                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>

                                        {/* Date Range Dropdown Toggle */}
                                        <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === 'dateRange' ? null : 'dateRange')}
                                            style={{
                                                padding: '5px 8px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: (customStartDate || customEndDate) ? '#dbeafe' : 'transparent',
                                                cursor: 'pointer',
                                                color: (customStartDate || customEndDate) ? '#2563eb' : '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '10px',
                                                fontWeight: '600',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title="Set custom date range"
                                        >
                                            {(customStartDate || customEndDate) ? (
                                                <>
                                                    <span>{customStartDate ? new Date(customStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '...'}</span>
                                                    <span style={{ color: '#94a3b8' }}>-</span>
                                                    <span>{customEndDate ? new Date(customEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '...'}</span>
                                                </>
                                            ) : (
                                                <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            )}
                                        </button>

                                        {/* Date Range Dropdown */}
                                        {activeMenu === 'dateRange' && (
                                            <div data-dropdown style={{
                                                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                borderRadius: '10px', boxShadow: themedStyles.dropdownShadow,
                                                zIndex: 9999, padding: '12px', minWidth: '260px'
                                            }}>
                                                <div style={{ fontSize: '10px', fontWeight: '700', color: themedStyles.textSecondary, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Custom Date Range</div>
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '500', color: '#94a3b8', marginBottom: '4px' }}>From</label>
                                                        <input
                                                            type="date"
                                                            value={customStartDate}
                                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '500', color: '#94a3b8', marginBottom: '4px' }}>To</label>
                                                        <input
                                                            type="date"
                                                            value={customEndDate}
                                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setActiveMenu(null); }}
                                                        style={{ flex: 1, padding: '7px', fontSize: '11px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}
                                                    >Clear</button>
                                                    <button
                                                        onClick={() => { setTimeRange('Custom'); setActiveMenu(null); }}
                                                        style={{ flex: 1, padding: '7px', fontSize: '11px', fontWeight: '600', border: 'none', borderRadius: '6px', backgroundColor: '#7637E3', color: 'white', cursor: 'pointer' }}
                                                    >Apply</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider - Refined */}
                                    <div style={{ height: '28px', width: '1px', background: 'linear-gradient(180deg, transparent 0%, #e2e8f0 20%, #e2e8f0 80%, transparent 100%)', margin: '0 8px' }}></div>

                                    {/* Forecast Mode Pills - Premium */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '3px',
                                        backgroundColor: 'rgba(248, 250, 252, 0.8)',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(226, 232, 240, 0.6)',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                                    }}>
                                        {[
                                            { key: 'plan', label: 'Plan' },
                                            { key: 'eac', label: 'EAC' },
                                            { key: 'impact', label: 'Impact' }
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => setForecastMode(key)}
                                                style={{
                                                    padding: '6px 14px',
                                                    fontSize: '11px',
                                                    fontWeight: forecastMode === key ? '600' : '500',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    backgroundColor: forecastMode === key ? 'white' : 'transparent',
                                                    color: forecastMode === key ? '#7637E3' : '#64748b',
                                                    boxShadow: forecastMode === key ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    letterSpacing: '-0.01em'
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Capacity Model Toggle - Standard | Alternative */}
                                    <div
                                        title="Capacity Model — Standard uses PM/SC/PD effort fields. Alternative uses a single Total Effort field + role mix from Settings."
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '3px',
                                            backgroundColor: 'rgba(248, 250, 252, 0.8)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(226, 232, 240, 0.6)',
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                                        }}>
                                        {[
                                            { key: 'standard', label: 'Std' },
                                            { key: 'alternative', label: 'Alt' }
                                        ].map(({ key, label }) => {
                                            const active = (storedSettings.activeCapacityModel || 'standard') === key;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        // Validation: warn if alt model is selected without TOTAL_EFFORT mapped
                                                        if (key === 'alternative' && !resolveFieldId(stableSettings[SETTINGS.TOTAL_EFFORT])) {
                                                            addToast?.({ type: 'warning', title: 'Total Effort field not mapped', message: 'Map the "Total Effort (Alt Model)" field in the Interface Designer settings before switching.' });
                                                            return;
                                                        }
                                                        dashboardHandlers.handleSaveSettings({ ...storedSettings, activeCapacityModel: key });
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '11px',
                                                        fontWeight: active ? '600' : '500',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        backgroundColor: active ? 'white' : 'transparent',
                                                        color: active ? '#0284c7' : '#64748b',
                                                        boxShadow: active ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        letterSpacing: '-0.01em'
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Capacity Utilisation Model Toggle - Annualised | AGW */}
                                    <div
                                        title="Capacity Utilisation Model — Annualised uses the 67%-style Annual Utilization field flat per week (exec reporting). AGW (Any Given Week) uses days-present × 80% productivity, varying by week (live staffing)."
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '3px',
                                            backgroundColor: 'rgba(248, 250, 252, 0.8)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(226, 232, 240, 0.6)',
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                                        }}>
                                        {[
                                            { key: 'annualised', label: 'Annualised' },
                                            { key: 'agw', label: 'AGW' }
                                        ].map(({ key, label }) => {
                                            // Backward-compat: old stored 'field' = annualised, old 'presence' = agw.
                                            const rawStored = (storedSettings.capacityUtilizationModel || 'annualised').toLowerCase();
                                            const stored = rawStored === 'presence' ? 'agw' : (rawStored === 'field' ? 'annualised' : rawStored);
                                            const active = stored === key;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        // Warn if Annualised is selected without the 67% field mapped — it will fall back
                                                        // to Target Utilization (80%) and therefore match AGW for full-present weeks.
                                                        if (key === 'annualised' && !resolveFieldId(stableSettings[SETTINGS.ANNUAL_UTILIZATION])) {
                                                            addToast?.({ type: 'warning', title: 'Annual Utilization field not mapped', message: 'Map the "Annual Utilization (Presence Model)" field in the Interface Designer settings. Until mapped, Annualised falls back to Target Utilization and will match AGW for full-present weeks.' });
                                                        }
                                                        dashboardHandlers.handleSaveSettings({ ...storedSettings, capacityUtilizationModel: key });
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '11px',
                                                        fontWeight: active ? '600' : '500',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        backgroundColor: active ? 'white' : 'transparent',
                                                        color: active ? '#059669' : '#64748b',
                                                        boxShadow: active ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        letterSpacing: '-0.01em'
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Demand Category Toggle - BAU Feature */}
                                    <DemandCategoryToggle
                                        value={demandCategory}
                                        onChange={(val) => {
                                            setDemandCategory(val);
                                            try { localStorage.setItem('capacityDemandCategory', val); } catch (e) { }
                                        }}
                                    />

                                    {/* Scenarios Selector - V1 Parity */}
                                    <ScenarioSelector
                                        scenarios={scenarios.filter(s => s.metadata?.type !== 'optimizer' && !(s.name || '').toLowerCase().includes('master settings'))}
                                        activeScenario={activeScenario}
                                        onSelect={dashboardHandlers.handleScenarioSelect}
                                        onCreate={() => setShowCreateScenario(true)}
                                        onClone={dashboardHandlers.handleCloneScenario}
                                        onDelete={dashboardHandlers.handleDeleteScenario}
                                        onRevert={dashboardHandlers.handleRevertScenario}
                                        onRename={dashboardHandlers.handleRenameScenario}
                                        onManage={() => setIsSettingsOpen(true)}
                                        onCompare={() => setShowCompareScenarios(true)}
                                        data-tour="scenario-selector"
                                    />

                                    {/* Divider - Refined */}
                                    <div style={{ height: '28px', width: '1px', background: 'linear-gradient(180deg, transparent 0%, #e2e8f0 20%, #e2e8f0 80%, transparent 100%)', margin: '0 4px' }}></div>

                                    {/* Squads Dropdown - Premium */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === 'squad' ? null : 'squad')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '7px 14px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                border: '1px solid rgba(226, 232, 240, 0.6)',
                                                borderRadius: '10px',
                                                backgroundColor: squadViewFilter.length > 0 ? '#eff6ff' : 'rgba(248, 250, 252, 0.8)',
                                                color: squadViewFilter.length > 0 ? '#3b82f6' : '#475569',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease',
                                                letterSpacing: '-0.01em'
                                            }}
                                        >
                                            <svg style={{ width: '14px', height: '14px', opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            {squadViewFilter.length > 0 ? (
                                                squadViewFilter.length === 1 && squadViewFilter[0] === '__none__'
                                                    ? 'None (Unassigned)'
                                                    : `${squadViewFilter.filter(s => s !== '__none__').length}${squadViewFilter.includes('__none__') ? '+None' : ''} Squads`
                                            ) : 'All Squads'}
                                            <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {activeMenu === 'squad' && (
                                            <div data-dropdown style={{
                                                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                                                zIndex: 9999, minWidth: '220px', maxHeight: '340px', display: 'flex', flexDirection: 'column'
                                            }}>
                                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Squads</span>
                                                    <button
                                                        onClick={() => setSquadViewFilter([])}
                                                        style={{
                                                            padding: '4px 8px', fontSize: '10px', fontWeight: '600',
                                                            border: 'none', borderRadius: '4px', backgroundColor: '#f1f5f9',
                                                            color: '#64748b', cursor: 'pointer'
                                                        }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                {/* Search input */}
                                                <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                                    <input
                                                        type="text"
                                                        value={dropdownSearch}
                                                        onChange={e => setDropdownSearch(e.target.value)}
                                                        placeholder="Search squads..."
                                                        onClick={e => e.stopPropagation()}
                                                        autoFocus
                                                        style={{
                                                            width: '100%', padding: '5px 8px', fontSize: '11px',
                                                            border: '1px solid #e2e8f0', borderRadius: '6px',
                                                            backgroundColor: 'white', color: '#334155',
                                                            outline: 'none', boxSizing: 'border-box'
                                                        }}
                                                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                                    />
                                                </div>
                                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                                    {/* Merged View Toggle (Experiment) */}
                                                    {squadViewFilter.length > 1 && (
                                                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: mergeSquads ? '#f0fdf4' : 'transparent' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <svg style={{ width: '12px', height: '12px', color: mergeSquads ? '#00BD00' : '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                                <span style={{ fontSize: '11px', fontWeight: '500', color: mergeSquads ? '#00BD00' : '#64748b' }}>Merge View</span>
                                                            </div>
                                                            <div
                                                                onClick={(e) => { e.stopPropagation(); setMergeSquads(!mergeSquads); }}
                                                                style={{
                                                                    width: '24px', height: '14px', borderRadius: '10px',
                                                                    backgroundColor: mergeSquads ? '#00BD00' : '#cbd5e1',
                                                                    position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white',
                                                                    position: 'absolute', top: '2px', left: mergeSquads ? '12px' : '2px',
                                                                    transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                                }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* "None" option for projects without a squad */}
                                                    <label
                                                        key="__none__"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSquadViewFilter(prev =>
                                                                prev.includes('__none__')
                                                                    ? prev.filter(s => s !== '__none__')
                                                                    : [...prev, '__none__']
                                                            );
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px',
                                                            padding: '8px 12px', cursor: 'pointer',
                                                            transition: 'background-color 0.1s',
                                                            backgroundColor: squadViewFilter.includes('__none__') ? '#fef3c7' : 'transparent',
                                                            borderBottom: '1px solid #f1f5f9'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = squadViewFilter.includes('__none__') ? '#fef3c7' : '#f8fafc'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = squadViewFilter.includes('__none__') ? '#fef3c7' : 'transparent'}
                                                    >
                                                        <div style={{
                                                            width: '16px', height: '16px', borderRadius: '4px',
                                                            border: squadViewFilter.includes('__none__') ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                                                            backgroundColor: squadViewFilter.includes('__none__') ? '#f59e0b' : 'white',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {squadViewFilter.includes('__none__') && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '500', fontStyle: 'italic' }}>None (Unassigned)</span>
                                                    </label>
                                                    {allSquads.filter(squad => !dropdownSearch || squad.toLowerCase().includes(dropdownSearch.toLowerCase())).map(squad => (
                                                        <label
                                                            key={squad}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSquadViewFilter(prev =>
                                                                    prev.includes(squad)
                                                                        ? prev.filter(s => s !== squad)
                                                                        : [...prev, squad]
                                                                );
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                                padding: '8px 12px', cursor: 'pointer',
                                                                transition: 'background-color 0.1s',
                                                                backgroundColor: squadViewFilter.includes(squad) ? '#eff6ff' : 'transparent'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = squadViewFilter.includes(squad) ? '#eff6ff' : '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = squadViewFilter.includes(squad) ? '#eff6ff' : 'transparent'}
                                                        >
                                                            <div style={{
                                                                width: '16px', height: '16px', borderRadius: '4px',
                                                                border: squadViewFilter.includes(squad) ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                                                                backgroundColor: squadViewFilter.includes(squad) ? '#3b82f6' : 'white',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {squadViewFilter.includes(squad) && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>{squad}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Platform Filter Dropdown — resources by squad platform, projects by project platform */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === 'platform' ? null : 'platform')}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '7px 14px', fontSize: '11px', fontWeight: '600',
                                                border: '1px solid rgba(226, 232, 240, 0.6)', borderRadius: '10px',
                                                backgroundColor: platformViewFilter.length > 0 ? '#eff6ff' : 'rgba(248, 250, 252, 0.8)',
                                                color: platformViewFilter.length > 0 ? '#3b82f6' : '#475569',
                                                cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease', letterSpacing: '-0.01em'
                                            }}
                                        >
                                            <svg style={{ width: '14px', height: '14px', opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            {platformViewFilter.length > 0 ? `${platformViewFilter.length} Platform${platformViewFilter.length > 1 ? 's' : ''}` : 'All Platforms'}
                                            <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {activeMenu === 'platform' && (
                                            <div data-dropdown style={{
                                                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                zIndex: 9999, minWidth: '200px', maxHeight: '320px', display: 'flex', flexDirection: 'column'
                                            }}>
                                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Platform</span>
                                                    <button
                                                        onClick={() => setPlatformViewFilter([])}
                                                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: '600', border: 'none', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                                    {(() => {
                                                        const platforms = [...new Set(Object.values(squadPlatformMap).flat())].filter(Boolean).sort();
                                                        if (platforms.length === 0) {
                                                            return (
                                                                <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                                                                    No squad platforms found. Map the <strong>Squad Platform</strong> field in Settings → field mapping and set it on your squads.
                                                                </div>
                                                            );
                                                        }
                                                        return platforms.map(pl => {
                                                            const checked = platformViewFilter.includes(pl);
                                                            return (
                                                                <label key={pl} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                                                                    <div
                                                                        onClick={(e) => { e.preventDefault(); setPlatformViewFilter(prev => checked ? prev.filter(x => x !== pl) : [...prev, pl]); }}
                                                                        style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${checked ? '#3b82f6' : '#cbd5e1'}`, backgroundColor: checked ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                                    >
                                                                        {checked && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                                    </div>
                                                                    <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>{pl}</span>
                                                                </label>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Project Status Filter Dropdown */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === 'statusFilter' ? null : 'statusFilter')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '7px 14px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                border: '1px solid rgba(226, 232, 240, 0.6)',
                                                borderRadius: '10px',
                                                backgroundColor: statusViewFilter.length > 0 ? '#f5f3ff' : 'rgba(248, 250, 252, 0.8)',
                                                color: statusViewFilter.length > 0 ? '#8b5cf6' : '#475569',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease',
                                                letterSpacing: '-0.01em'
                                            }}
                                        >
                                            <svg style={{ width: '14px', height: '14px', opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {statusViewFilter.length > 0 ? (
                                                `${statusViewFilter.length} Status${statusViewFilter.length > 1 ? 'es' : ''}`
                                            ) : 'All Statuses'}
                                            <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {activeMenu === 'statusFilter' && (
                                            <div data-dropdown style={{
                                                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                                                zIndex: 9999, minWidth: '220px', maxHeight: '340px', display: 'flex', flexDirection: 'column'
                                            }}>
                                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Status</span>
                                                    <button
                                                        onClick={() => setStatusViewFilter([])}
                                                        style={{
                                                            padding: '4px 8px', fontSize: '10px', fontWeight: '600',
                                                            border: 'none', borderRadius: '4px', backgroundColor: '#f1f5f9',
                                                            color: '#64748b', cursor: 'pointer'
                                                        }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                {/* Search input */}
                                                <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                                    <input
                                                        type="text"
                                                        value={dropdownSearch}
                                                        onChange={e => setDropdownSearch(e.target.value)}
                                                        placeholder="Search statuses..."
                                                        onClick={e => e.stopPropagation()}
                                                        autoFocus
                                                        style={{
                                                            width: '100%', padding: '5px 8px', fontSize: '11px',
                                                            border: '1px solid #e2e8f0', borderRadius: '6px',
                                                            backgroundColor: 'white', color: '#334155',
                                                            outline: 'none', boxSizing: 'border-box'
                                                        }}
                                                        onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                                    />
                                                </div>
                                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                                    {(uniqueStatuses || []).filter(status => !dropdownSearch || status.toLowerCase().includes(dropdownSearch.toLowerCase())).map(status => (
                                                        <label
                                                            key={status}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setStatusViewFilter(prev =>
                                                                    prev.includes(status)
                                                                        ? prev.filter(s => s !== status)
                                                                        : [...prev, status]
                                                                );
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                                padding: '8px 12px', cursor: 'pointer',
                                                                transition: 'background-color 0.1s',
                                                                backgroundColor: statusViewFilter.includes(status) ? '#f5f3ff' : 'transparent'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = statusViewFilter.includes(status) ? '#f5f3ff' : '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = statusViewFilter.includes(status) ? '#f5f3ff' : 'transparent'}
                                                        >
                                                            <div style={{
                                                                width: '16px', height: '16px', borderRadius: '4px',
                                                                border: statusViewFilter.includes(status) ? '1px solid #8b5cf6' : '1px solid #cbd5e1',
                                                                backgroundColor: statusViewFilter.includes(status) ? '#8b5cf6' : 'white',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {statusViewFilter.includes(status) && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>{status}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* V1 Parity: Entity Filter Dropdown - Multi-select */}
                                    {allEntities.length > 0 && (
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                onClick={() => setActiveMenu(activeMenu === 'entityFilter' ? null : 'entityFilter')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '7px 14px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    border: '1px solid rgba(226, 232, 240, 0.6)',
                                                    borderRadius: '10px',
                                                    backgroundColor: selectedEntities.length > 0 ? '#fef3c7' : 'rgba(248, 250, 252, 0.8)',
                                                    color: selectedEntities.length > 0 ? '#b45309' : '#475569',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                    transition: 'all 0.15s ease',
                                                    letterSpacing: '-0.01em'
                                                }}
                                            >
                                                <svg style={{ width: '14px', height: '14px', opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                {selectedEntities.length > 0 ? `${selectedEntities.length} Entity` : 'All Entities'}
                                                <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                            {activeMenu === 'entityFilter' && (
                                                <div data-dropdown style={{
                                                    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                    backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                    borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                                                    zIndex: 9999, minWidth: '220px', maxHeight: '340px', display: 'flex', flexDirection: 'column'
                                                }}>
                                                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Entity</span>
                                                        <button
                                                            onClick={() => setSelectedEntities([])}
                                                            style={{
                                                                padding: '4px 8px', fontSize: '10px', fontWeight: '600',
                                                                border: 'none', borderRadius: '4px', backgroundColor: '#f1f5f9',
                                                                color: '#64748b', cursor: 'pointer'
                                                            }}
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                    {/* Search input */}
                                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                                        <input
                                                            type="text"
                                                            value={dropdownSearch}
                                                            onChange={e => setDropdownSearch(e.target.value)}
                                                            placeholder="Search entities..."
                                                            onClick={e => e.stopPropagation()}
                                                            autoFocus
                                                            style={{
                                                                width: '100%', padding: '5px 8px', fontSize: '11px',
                                                                border: '1px solid #e2e8f0', borderRadius: '6px',
                                                                backgroundColor: 'white', color: '#334155',
                                                                outline: 'none', boxSizing: 'border-box'
                                                            }}
                                                            onFocus={e => e.target.style.borderColor = '#b45309'}
                                                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                                        />
                                                    </div>
                                                    <div style={{ overflowY: 'auto', flex: 1 }}>
                                                        {allEntities.filter(entity => !dropdownSearch || entity.toLowerCase().includes(dropdownSearch.toLowerCase())).map(entity => (
                                                            <label
                                                                key={entity}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedEntities(prev =>
                                                                        prev.includes(entity)
                                                                            ? prev.filter(s => s !== entity)
                                                                            : [...prev, entity]
                                                                    );
                                                                }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                                    padding: '8px 12px', cursor: 'pointer',
                                                                    transition: 'background-color 0.1s',
                                                                    backgroundColor: selectedEntities.includes(entity) ? '#fef3c7' : 'transparent'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = selectedEntities.includes(entity) ? '#fef3c7' : '#f8fafc'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = selectedEntities.includes(entity) ? '#fef3c7' : 'transparent'}
                                                            >
                                                                <div style={{
                                                                    width: '16px', height: '16px', borderRadius: '4px',
                                                                    border: selectedEntities.includes(entity) ? '1px solid #b45309' : '1px solid #cbd5e1',
                                                                    backgroundColor: selectedEntities.includes(entity) ? '#f59e0b' : 'white',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {selectedEntities.includes(entity) && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                                </div>
                                                                <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>{entity}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Entity Dropdown - Premium */}
                                    {allCompanies.length > 1 && (
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                onClick={() => setActiveMenu(activeMenu === 'entity' ? null : 'entity')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '7px 14px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    border: '1px solid rgba(226, 232, 240, 0.6)',
                                                    borderRadius: '10px',
                                                    backgroundColor: companyFilter !== 'all' ? '#f0fdf4' : 'rgba(248, 250, 252, 0.8)',
                                                    color: companyFilter !== 'all' ? '#00BD00' : '#475569',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                    transition: 'all 0.15s ease',
                                                    letterSpacing: '-0.01em'
                                                }}
                                            >
                                                <svg style={{ width: '14px', height: '14px', opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                {companyFilter === 'all' ? 'All Entities' : companyFilter}
                                                <svg style={{ width: '10px', height: '10px', opacity: 0.5, marginLeft: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                            {activeMenu === 'entity' && (
                                                <div data-dropdown style={{
                                                    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                    backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                    borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                                                    zIndex: 100, minWidth: '160px', overflow: 'hidden'
                                                }}>
                                                    <button
                                                        onClick={() => { setCompanyFilter('all'); setActiveMenu(null); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px',
                                                            textAlign: 'left', border: 'none', backgroundColor: companyFilter === 'all' ? '#f8fafc' : 'white',
                                                            color: companyFilter === 'all' ? '#7637E3' : '#64748b',
                                                            fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <span>All Entities</span>
                                                        {companyFilter === 'all' && <svg style={{ width: '12px', height: '12px', marginLeft: 'auto' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                    {allCompanies.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => { setCompanyFilter(c); setActiveMenu(null); }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px',
                                                                textAlign: 'left', border: 'none', backgroundColor: companyFilter === c ? '#f8fafc' : 'white',
                                                                color: companyFilter === c ? '#7637E3' : '#64748b',
                                                                fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                                                            }}
                                                        >
                                                            <span>{c}</span>
                                                            {companyFilter === c && <svg style={{ width: '12px', height: '12px', marginLeft: 'auto' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* QOL: Filter Presets */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setShowFilterPresets(!showFilterPresets)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '7px 12px', fontSize: '11px', fontWeight: '600',
                                                border: filterPresets.length > 0 ? '1px solid #c4b5fd' : '1px solid rgba(226, 232, 240, 0.6)',
                                                borderRadius: '10px',
                                                backgroundColor: filterPresets.length > 0 ? '#F7F3ED' : 'rgba(248, 250, 252, 0.8)',
                                                color: filterPresets.length > 0 ? '#7637E3' : '#475569',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            Presets{filterPresets.length > 0 && ` (${filterPresets.length})`}
                                        </button>
                                        {showFilterPresets && (
                                            <div style={{
                                                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                                backgroundColor: 'white', border: '1px solid #e2e8f0',
                                                borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                minWidth: '280px', zIndex: Z_INDEX.DROPDOWN
                                            }}>
                                                <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Save Current Filters</div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Preset name..."
                                                            value={presetName}
                                                            onChange={e => setPresetName(e.target.value)}
                                                            style={{ flex: 1, padding: '6px 10px', fontSize: '11px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                                                            onKeyDown={e => { if (e.key === 'Enter') saveFilterPreset(presetName); }}
                                                        />
                                                        <button
                                                            onClick={() => saveFilterPreset(presetName)}
                                                            disabled={!presetName.trim()}
                                                            style={{
                                                                padding: '6px 12px', fontSize: '11px', fontWeight: '600',
                                                                backgroundColor: presetName.trim() ? '#7637E3' : '#e2e8f0',
                                                                color: presetName.trim() ? 'white' : '#94a3b8',
                                                                border: 'none', borderRadius: '6px', cursor: presetName.trim() ? 'pointer' : 'not-allowed'
                                                            }}
                                                        >Save</button>
                                                    </div>
                                                </div>
                                                {filterPresets.length === 0 ? (
                                                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                                                        No saved presets
                                                    </div>
                                                ) : (
                                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                        {filterPresets.map(preset => (
                                                            <div
                                                                key={preset.id}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    padding: '10px 12px', borderBottom: '1px solid #f8fafc',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                <div
                                                                    onClick={() => loadFilterPreset(preset)}
                                                                    style={{ flex: 1 }}
                                                                >
                                                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{preset.name}</div>
                                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                                        {Object.entries(preset.filters).filter(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true)).length} filters
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); deleteFilterPreset(preset.id); }}
                                                                    style={{ padding: '4px', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                >✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Compact Unified Search */}
                                    <div style={{ position: 'relative' }}>
                                        <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: resourceSearch ? '#7637E3' : '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input
                                            data-tour="search"
                                            type="text"
                                            placeholder="Search..."
                                            value={resourceSearch}
                                            onChange={e => { setResourceSearch(e.target.value); setHighlightProject(e.target.value); }}
                                            onKeyDown={e => { if (e.key === 'Escape') { setResourceSearch(''); setHighlightProject(''); e.target.blur(); } }}
                                            style={{
                                                width: '140px',
                                                padding: '5px 26px 5px 24px',
                                                fontSize: '11px',
                                                border: resourceSearch ? '1px solid #7637E3' : '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                outline: 'none',
                                                backgroundColor: resourceSearch ? '#f5f0ff' : 'white',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease',
                                                letterSpacing: '-0.01em',
                                                color: resourceSearch ? '#5b21b6' : '#1e293b'
                                            }}
                                            onFocus={e => { if (!resourceSearch) { e.target.style.borderColor = '#94a3b8'; e.target.style.boxShadow = '0 0 0 2px rgba(148, 163, 184, 0.1)'; } }}
                                            onBlur={e => { if (!resourceSearch) { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)'; } }}
                                        />
                                        {resourceSearch && (
                                            <button
                                                onClick={() => { setResourceSearch(''); setHighlightProject(''); }}
                                                style={{
                                                    position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                                    color: '#94a3b8', fontSize: '12px', lineHeight: 1, display: 'flex'
                                                }}
                                            >✕</button>
                                        )}
                                    </div>

                                    {/* Active Filter Count Badge + Clear All */}
                                    {activeFilters.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '4px 8px', borderRadius: '12px',
                                                backgroundColor: '#f5f0ff', border: '1px solid #c4b5fd',
                                                fontSize: '10px', fontWeight: '600', color: '#7637E3'
                                            }}>
                                                <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                                </svg>
                                                {activeFilters.length}
                                            </div>
                                            <button
                                                onClick={resetFilters}
                                                title="Clear all filters"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                    border: '1px solid #e2e8f0', backgroundColor: 'white',
                                                    cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#ef4444'; }}
                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
                                            >
                                                <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ROW 2: View Controls & Toolbar - Premium */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', backgroundColor: '#f8fafc', position: 'relative', zIndex: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {/* View Toggle - Premium Pill */}
                                    <ViewModeToggle />

                                    {/* Role Filter - Premium */}
                                    {viewMode === 'resources' && (
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                onClick={() => setActiveMenu(activeMenu === 'role' ? null : 'role')}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 12px', fontSize: '11px', fontWeight: '500',
                                                    border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: '8px',
                                                    backgroundColor: selectedCategory !== 'All' ? '#f0fdf4' : 'white',
                                                    color: selectedCategory !== 'All' ? '#00BD00' : '#475569',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <svg style={{ width: '13px', height: '13px', opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                {selectedCategory === 'All' ? 'All Roles' : selectedCategory}
                                                <svg style={{ width: '10px', height: '10px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                            {activeMenu === 'role' && (
                                                <div data-dropdown style={{
                                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                                                    backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                    borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                    zIndex: 100, minWidth: '130px', overflow: 'hidden'
                                                }}>
                                                    {['All', 'PM', 'SC', 'PD'].map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => { setSelectedCategory(cat); setActiveMenu(null); }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px',
                                                                textAlign: 'left', border: 'none', backgroundColor: selectedCategory === cat ? '#f8fafc' : 'white',
                                                                color: selectedCategory === cat ? '#7637E3' : '#64748b',
                                                                fontSize: '11px', fontWeight: '500', cursor: 'pointer'
                                                            }}
                                                        >
                                                            {cat === 'All' && <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
                                                            {cat !== 'All' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7637E3', opacity: selectedCategory === cat ? 1 : 0.3 }} ></div>}
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* GroupBy Toggle - Premium Segmented */}
                                    <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px', border: '1px solid #e2e8f0' }}>
                                        {[
                                            { key: 'squad', label: 'Squad' },
                                            { key: 'role', label: 'Role', disabledInProjects: true },
                                            ...(viewMode === 'projects' ? [
                                                { key: 'customer', label: 'Customer' },
                                                { key: 'country', label: 'Country' }
                                            ] : [])
                                        ].map(({ key, label, disabledInProjects }) => {
                                            const isDisabled = disabledInProjects && viewMode === 'projects';
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => !isDisabled && setGroupBy(key)}
                                                    disabled={isDisabled}
                                                    title={isDisabled ? 'Role grouping is not available in Projects mode' : ''}
                                                    style={{
                                                        padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                                        borderRadius: '6px', border: 'none',
                                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                        backgroundColor: groupBy === key ? 'white' : 'transparent',
                                                        color: isDisabled ? '#cbd5e1' : (groupBy === key ? '#7637E3' : '#64748b'),
                                                        boxShadow: groupBy === key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                                        opacity: isDisabled ? 0.5 : 1,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Expand/Collapse All Groups */}
                                    <ExpandCollapseToggle />

                                    {/* Sort Dropdown - Premium */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === 'sort' ? null : 'sort')}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '6px 12px', fontSize: '11px', fontWeight: '500',
                                                border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: '8px',
                                                backgroundColor: 'white', color: '#475569', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <svg style={{ width: '13px', height: '13px', opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                                            Sort: {sortBy === 'name' ? 'Name' : sortBy === 'availability_desc' ? 'Available ↓' : sortBy === 'availability_asc' ? 'Available ↑' : 'Overload'}
                                            <svg style={{ width: '10px', height: '10px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {activeMenu === 'sort' && (
                                            <div data-dropdown style={{
                                                position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                                                backgroundColor: themedStyles.dropdownBg, border: themedStyles.dropdownBorder,
                                                borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                zIndex: 100, minWidth: '160px', overflow: 'hidden'
                                            }}>
                                                {[
                                                    { key: 'name', label: 'Name' },
                                                    { key: 'availability_desc', label: 'Available (High→Low)' },
                                                    { key: 'availability_asc', label: 'Available (Low→High)' },
                                                    { key: 'overload', label: 'Overload' },
                                                    ...(viewMode === 'projects' ? [
                                                        { key: 'customer_az', label: 'Customer A-Z' },
                                                        { key: 'country_az', label: 'Country A-Z' }
                                                    ] : [])
                                                ].map(({ key, label }) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => {
                                                            if (key === 'country_az') {
                                                                // Toggle Country Grouping
                                                                setGroupBy(prev => prev === 'country' ? 'squad' : 'country');
                                                                setSortBy('name');
                                                            } else if (key === 'customer_az') {
                                                                setCustomerSort(!customerSort);
                                                                // Ensure groupBy handles customer sort if needed, or if it's just a sort order
                                                            } else {
                                                                setSortBy(key);
                                                                if (groupBy === 'country') setGroupBy('squad'); // Reset country grouping if standard sort picked
                                                            }
                                                            setActiveMenu(null);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', width: '100%', padding: '8px 12px',
                                                            textAlign: 'left', border: 'none',
                                                            backgroundColor: (key === 'country_az' ? groupBy === 'country' : key === 'customer_az' ? customerSort : sortBy === key) ? '#f8fafc' : 'white',
                                                            color: (key === 'country_az' ? groupBy === 'country' : key === 'customer_az' ? customerSort : sortBy === key) ? '#7637E3' : '#64748b',
                                                            fontSize: '11px', fontWeight: '500', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {label}
                                                        {(key === 'country_az' ? groupBy === 'country' : key === 'customer_az' ? customerSort : sortBy === key) && <svg style={{ width: '12px', height: '12px', marginLeft: 'auto', color: '#7637E3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>


                                    {/* Exceptions Toggle - Compact Icon */}
                                    <button
                                        onClick={() => setExceptionsOnly(!exceptionsOnly)}
                                        title={exceptionsOnly ? "Showing exceptions only (E)" : "Show exceptions only (E)"}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '32px', height: '32px',
                                            border: exceptionsOnly ? '1px solid #fdba74' : '1px solid rgba(226, 232, 240, 0.8)',
                                            borderRadius: '8px',
                                            backgroundColor: exceptionsOnly ? '#fff7ed' : 'white',
                                            color: exceptionsOnly ? '#ea580c' : '#475569',
                                            cursor: 'pointer',
                                            boxShadow: exceptionsOnly ? '0 1px 2px rgba(234, 88, 12, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </button>

                                    {/* Has Notes Filter Toggle (Projects View) */}
                                    {viewMode === 'projects' && (
                                        <button
                                            onClick={() => setShowNotesOnly(!showNotesOnly)}
                                            title={showNotesOnly ? 'Showing projects with notes only' : 'Show only projects with resourcing notes'}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                border: showNotesOnly ? '1px solid #c4b5fd' : '1px solid rgba(226, 232, 240, 0.8)',
                                                borderRadius: '8px',
                                                backgroundColor: showNotesOnly ? '#f5f3ff' : 'white',
                                                color: showNotesOnly ? '#7637E3' : '#475569',
                                                cursor: 'pointer',
                                                boxShadow: showNotesOnly ? '0 1px 2px rgba(118, 55, 227, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </button>
                                    )}

                                    {/* Programs Button - Opens list of programs first */}
                                    <button
                                        onClick={() => setShowProgramsModal(true)}
                                        title="Programs"
                                        data-tour="programs-manage"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '32px', height: '32px',
                                            border: '1px solid rgba(226, 232, 240, 0.8)',
                                            borderRadius: '8px',
                                            backgroundColor: 'white',
                                            color: '#00BD00',
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </button>

                                    {/* Overload Indicator - Compact Icon with Badge */}
                                    {overloadedCount > 0 && (
                                        <div
                                            title={`${overloadedCount} resource${overloadedCount !== 1 ? 's' : ''} overloaded (>100% utilization)`}
                                            style={{
                                                position: 'relative',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                backgroundColor: '#fef2f2', borderRadius: '8px',
                                                border: '1px solid #fecaca',
                                                cursor: 'default'
                                            }}
                                        >
                                            <svg style={{ width: '14px', height: '14px', color: '#ef4444' }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                                            {/* Badge */}
                                            <span style={{
                                                position: 'absolute',
                                                top: '-4px', right: '-4px',
                                                minWidth: '16px', height: '16px',
                                                padding: '0 4px',
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                fontSize: '9px',
                                                fontWeight: '700',
                                                borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {overloadedCount}
                                            </span>
                                        </div>
                                    )}


                                    {/* V1 Parity: Select All + Batch Update (Projects View Only) */}
                                    {viewMode === 'projects' && allProjects.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <label style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '6px 12px', backgroundColor: 'white',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                                borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '11px', fontWeight: '500', color: '#64748b',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProjects.size > 0 && selectedProjects.size === allProjects.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedProjects(new Set(allProjects.map(p => p.id)));
                                                        } else {
                                                            setSelectedProjects(new Set());
                                                        }
                                                    }}
                                                    style={{ width: '14px', height: '14px', accentColor: '#7637E3' }}
                                                />
                                                Select All
                                            </label>
                                            {selectedProjects.size > 0 && (
                                                <button
                                                    onClick={() => setShowBatchModal(true)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        padding: '6px 12px',
                                                        background: 'linear-gradient(135deg, #7637E3 0%, #4f46e5 100%)',
                                                        color: 'white', fontSize: '11px', fontWeight: '600',
                                                        borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3), 0 1px 2px rgba(99, 102, 241, 0.2)',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    Batch Update ({selectedProjects.size})
                                                </button>
                                            )}
                                        </div>
                                    )}



                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Cell Display Toggle */}
                                    <CellDisplayToggle />

                                    {/* Zoom - Premium */}
                                    <ZoomToggle />

                                    {/* Actions Group - Premium - Reordered with Settings Far Right */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                                        {/* Export Button */}
                                        <button
                                            onClick={() => setShowExportModal(true)}
                                            title="Export to CSV - Download capacity data"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                                backgroundColor: 'white', color: '#64748b', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>

                                        {/* Download Chart as PNG — for board reports. Captures the rendered
                                            capacity chart (including its date axis) at 2× for retina print. */}
                                        <button
                                            onClick={() => exportChartAsPng({ addToast, dates: processedData, columnWidth: currentZoom.width })}
                                            title="Download capacity chart as PNG (board-ready image)"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                                backgroundColor: 'white', color: '#64748b', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </button>

                                        {/* Team Initiatives Button */}
                                        <button
                                            onClick={() => setShowInitiativesModal(true)}
                                            title="Team Initiatives - Configure efficiency improvements"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px',
                                                border: showInitiativesEffect ? '1px solid #fbbf24' : '1px solid #e2e8f0',
                                                backgroundColor: showInitiativesEffect ? '#fef3c7' : 'white',
                                                color: showInitiativesEffect ? '#d97706' : '#64748b',
                                                cursor: 'pointer',
                                                boxShadow: showInitiativesEffect ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                        </button>

                                        {/* Initiatives Effect Toggle */}
                                        {(storedSettings.initiatives?.length > 0) && (
                                            <label
                                                title={showInitiativesEffect ? "Hide initiatives effect on capacity graph" : "Apply initiatives boost to capacity graph"}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 10px',
                                                    borderRadius: '8px',
                                                    border: showInitiativesEffect ? '1px solid #00BD00' : '1px solid #e2e8f0',
                                                    backgroundColor: showInitiativesEffect ? '#dcfce7' : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={showInitiativesEffect}
                                                    onChange={(e) => setShowInitiativesEffect(e.target.checked)}
                                                    style={{ width: '14px', height: '14px', accentColor: '#00BD00' }}
                                                />
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    color: showInitiativesEffect ? '#00BD00' : '#64748b'
                                                }}>
                                                    +{storedSettings.initiatives.filter(i => i.enabled && i.status === 'active').reduce((sum, i) => sum * (1 + i.efficiencyPct / 100), 1) > 1
                                                        ? Math.round((storedSettings.initiatives.filter(i => i.enabled && i.status === 'active').reduce((sum, i) => sum * (1 + i.efficiencyPct / 100), 1) - 1) * 100)
                                                        : 0}%
                                                </span>
                                            </label>
                                        )}

                                        {/* Finance Forecast Button */}
                                        <button
                                            onClick={() => setShowFinanceForecastModal(true)}
                                            title="Finance Forecast - Model ARR to capacity demand"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px',
                                                border: showFinanceForecast ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                                backgroundColor: showFinanceForecast ? '#dbeafe' : 'white',
                                                color: showFinanceForecast ? '#2563eb' : '#64748b',
                                                cursor: 'pointer',
                                                boxShadow: showFinanceForecast ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>

                                        {/* Forecast Impact Panel Toggle (shows when forecast is active) */}
                                        {showFinanceForecast && (
                                            <button
                                                onClick={() => setShowForecastImpactPanel(true)}
                                                title="View FTE Impact Analysis"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 10px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #3b82f6',
                                                    backgroundColor: '#dbeafe',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                                }}
                                            >
                                                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="#2563eb" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    color: '#2563eb'
                                                }}>
                                                    FTE Impact
                                                </span>
                                            </button>
                                        )}

                                        {/* Help Button */}
                                        <button
                                            data-tour="help"
                                            onClick={() => setShowDocs(true)}
                                            title="Help Guide - View documentation and FAQ"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                                backgroundColor: 'white', color: '#64748b', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>

                                        {/* Tour Button */}
                                        <button
                                            onClick={() => setShowTour(true)}
                                            title="Interactive Tour - Learn how to use the app"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px', border: '1px solid #c4b5fd',
                                                backgroundColor: '#F7F3ED', color: '#7637E3', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>


                                        {/* Recently Viewed Dropdown */}
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                onClick={() => setShowRecentlyViewed(!showRecentlyViewed)}
                                                title="Recently Viewed - Quick access to recent items"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '32px', height: '32px',
                                                    borderRadius: '8px',
                                                    border: showRecentlyViewed ? '1px solid #7637E3' : '1px solid #e2e8f0',
                                                    backgroundColor: showRecentlyViewed ? '#F7F3ED' : 'white',
                                                    color: showRecentlyViewed ? '#7637E3' : '#64748b',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </button>
                                            {showRecentlyViewed && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                                    backgroundColor: 'white', border: '1px solid #e2e8f0',
                                                    borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                    minWidth: '280px', maxHeight: '400px', overflowY: 'auto',
                                                    zIndex: Z_INDEX.DROPDOWN
                                                }}>
                                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Recently Viewed</span>
                                                        {recentlyViewed.length > 0 && (
                                                            <button
                                                                onClick={() => { setRecentlyViewed([]); localStorage.removeItem('capacityRecentlyViewed'); }}
                                                                style={{ fontSize: '10px', color: '#64748b', border: 'none', background: 'none', cursor: 'pointer' }}
                                                            >Clear</button>
                                                        )}
                                                    </div>
                                                    {recentlyViewed.length === 0 ? (
                                                        <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                                            <svg style={{ width: '24px', height: '24px', margin: '0 auto 8px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            No recently viewed items
                                                        </div>
                                                    ) : (
                                                        recentlyViewed.map((item, idx) => {
                                                            const ago = Math.round((Date.now() - item.viewedAt) / 60000);
                                                            const timeAgo = ago < 1 ? 'Just now' : ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
                                                            return (
                                                                <div
                                                                    key={item.id || idx}
                                                                    onClick={() => {
                                                                        setShowRecentlyViewed(false);
                                                                        if (item.type === 'resource') {
                                                                            setSelectedResourceId(item.id);
                                                                        } else if (item.type === 'project') {
                                                                            setSelectedBucketData({ dateKey: item.name, details: [item] });
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '10px 16px',
                                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                                        cursor: 'pointer',
                                                                        borderBottom: idx < recentlyViewed.length - 1 ? '1px solid #f8fafc' : 'none',
                                                                        transition: 'background-color 0.1s'
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                >
                                                                    <div style={{
                                                                        width: '28px', height: '28px', borderRadius: '6px',
                                                                        backgroundColor: item.type === 'resource' ? '#dbeafe' : '#dcfce7',
                                                                        color: item.type === 'resource' ? '#2563eb' : '#00BD00',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        {item.type === 'resource' ? (
                                                                            <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                                                        ) : (
                                                                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {item.name}
                                                                        </div>
                                                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{timeAgo}</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reorg Model Button */}
                                        <button
                                            onClick={() => setShowOptimizationModal(true)}
                                            title="Portfolio Reprioritization — Score, rank, and optimise projects"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #c4b5fd',
                                                background: 'linear-gradient(135deg, #7637E3 0%, #9333ea 100%)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 3px rgba(118, 55, 227, 0.3)',
                                                transition: 'all 0.2s ease',
                                                fontSize: '11px', fontWeight: '600',
                                                letterSpacing: '-0.01em'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(118, 55, 227, 0.4)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(118, 55, 227, 0.3)';
                                            }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                            </svg>
                                            Reorg
                                        </button>

                                        {/* Separator before Settings */}
                                        <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                                        {/* Settings Button - Far Right */}
                                        <button
                                            data-tour="settings"
                                            onClick={() => setIsSettingsOpen(true)}
                                            title="Settings - Configure thresholds, roles, and preferences"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '32px', height: '32px',
                                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                                backgroundColor: 'white', color: '#64748b', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div> {/* End collapsible toolbar container */}

                        {/* Menu Collapse/Expand Toggle Bar */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: menuCollapsed ? 'space-between' : 'center',
                                height: menuCollapsed ? '36px' : '20px',
                                cursor: menuCollapsed ? 'default' : 'pointer',
                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                                borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'}`,
                                transition: 'all 0.2s ease',
                                flexShrink: 0,
                                userSelect: 'none',
                                padding: menuCollapsed ? '0 16px' : '0'
                            }}
                            onClick={menuCollapsed ? undefined : () => {
                                setMenuCollapsed(prev => {
                                    const next = !prev;
                                    try { localStorage.setItem('capacityMenuCollapsed', String(next)); } catch (e) { }
                                    return next;
                                });
                            }}
                            onMouseEnter={e => { if (!menuCollapsed) e.currentTarget.style.backgroundColor = isDark ? 'rgba(51, 65, 85, 0.8)' : '#f1f5f9'; }}
                            onMouseLeave={e => { if (!menuCollapsed) e.currentTarget.style.backgroundColor = isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc'; }}
                            title={menuCollapsed ? undefined : 'Hide toolbar (⌘M)'}
                        >
                            {menuCollapsed ? (
                                <>
                                    {/* Left: Quick Controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* Expand button */}
                                        <button
                                            onClick={() => {
                                                setMenuCollapsed(false);
                                                try { localStorage.setItem('capacityMenuCollapsed', 'false'); } catch (e) { }
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '24px', height: '24px', borderRadius: '6px',
                                                border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'white',
                                                color: isDark ? '#94a3b8' : '#64748b',
                                                cursor: 'pointer', transition: 'all 0.15s ease', padding: 0
                                            }}
                                            title="Show toolbar (⌘M)"
                                        >
                                            <svg style={{ width: '12px', height: '12px', transform: 'rotate(180deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>

                                        {/* Separator */}
                                        <div style={{ width: '1px', height: '18px', backgroundColor: isDark ? '#475569' : '#e2e8f0' }} />

                                        {/* View Mode Mini-Toggle */}
                                        <div style={{ display: 'flex', backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9', borderRadius: '6px', padding: '2px', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                                            {[
                                                { key: 'resources', label: 'People', icon: <svg style={{ width: '11px', height: '11px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
                                                { key: 'projects', label: 'Projects', icon: <svg style={{ width: '11px', height: '11px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
                                            ].map(({ key, label, icon }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setViewMode(key)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        padding: '3px 8px', fontSize: '10px', fontWeight: '600',
                                                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                        backgroundColor: viewMode === key ? (isDark ? '#1e293b' : 'white') : 'transparent',
                                                        color: viewMode === key ? '#7637E3' : (isDark ? '#94a3b8' : '#64748b'),
                                                        boxShadow: viewMode === key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {icon}
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Today Button */}
                                        <button
                                            onClick={scrollToToday}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '3px 10px', fontSize: '10px', fontWeight: '700',
                                                background: 'linear-gradient(135deg, #00BD00 0%, #059669 100%)',
                                                border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                color: 'white', letterSpacing: '0.3px',
                                                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.2)'
                                            }}
                                            title="Jump to today (T)"
                                        >
                                            Today
                                        </button>

                                        {/* Separator */}
                                        <div style={{ width: '1px', height: '18px', backgroundColor: isDark ? '#475569' : '#e2e8f0' }} />

                                        {/* Mini Search */}
                                        <div style={{ position: 'relative' }}>
                                            <svg style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', width: '11px', height: '11px', color: isDark ? '#64748b' : '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="text"
                                                value={resourceSearch}
                                                onChange={e => { setResourceSearch(e.target.value); setHighlightProject(e.target.value); }}
                                                onKeyDown={e => { if (e.key === 'Escape') { setResourceSearch(''); setHighlightProject(''); e.target.blur(); } }}
                                                placeholder="Search..."
                                                data-search-input
                                                style={{
                                                    width: '140px', padding: '4px 8px 4px 22px',
                                                    fontSize: '10px', borderRadius: '6px',
                                                    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                                                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'white',
                                                    color: isDark ? '#e2e8f0' : '#334155',
                                                    outline: 'none', transition: 'border-color 0.15s ease'
                                                }}
                                                onFocus={e => e.target.style.borderColor = '#7637E3'}
                                                onBlur={e => e.target.style.borderColor = isDark ? '#475569' : '#e2e8f0'}
                                            />
                                        </div>
                                    </div>

                                    {/* Right: Active filter badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {activeFilters.length > 0 && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '3px 8px', borderRadius: '10px',
                                                backgroundColor: isDark ? 'rgba(118, 55, 227, 0.2)' : '#f5f3ff',
                                                border: `1px solid ${isDark ? 'rgba(118, 55, 227, 0.4)' : '#c4b5fd'}`,
                                            }}>
                                                <svg style={{ width: '10px', height: '10px', color: '#7637E3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                                </svg>
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#7637E3' }}>
                                                    {activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Expanded: Just the chevron + optional filter badge */}
                                    {activeFilters.length > 0 && (
                                        <div style={{
                                            position: 'absolute', right: '16px',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 6px', borderRadius: '8px',
                                            backgroundColor: isDark ? 'rgba(118, 55, 227, 0.15)' : '#f5f3ff',
                                            border: `1px solid ${isDark ? 'rgba(118, 55, 227, 0.3)' : '#ddd6fe'}`
                                        }}>
                                            <svg style={{ width: '9px', height: '9px', color: '#7637E3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                            </svg>
                                            <span style={{ fontSize: '9px', fontWeight: '600', color: '#7637E3' }}>{activeFilters.length}</span>
                                        </div>
                                    )}
                                    <svg
                                        style={{
                                            width: '14px', height: '14px',
                                            color: isDark ? '#94a3b8' : '#94a3b8',
                                            transition: 'transform 0.3s ease'
                                        }}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                </>
                            )}
                        </div>
                    </div>

                    {/* QUICK FILTER PILLS - Shows active filters above the grid */}
                    {activeFilters.length > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 20px',
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(241, 245, 249, 0.95)',
                            borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'}`,
                            flexWrap: 'wrap',
                            animation: 'fadeIn 0.2s ease',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            backdropFilter: 'blur(8px)'
                        }}>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: isDark ? '#94a3b8' : '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Active Filters:
                            </span>
                            {activeFilters.map((filter, idx) => (
                                <div
                                    key={`${filter.type}-${filter.label}-${idx}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px 4px 10px',
                                        backgroundColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'white',
                                        border: `1px solid ${filter.color}40`,
                                        borderRadius: '16px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        color: isDark ? '#e2e8f0' : '#334155',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ fontSize: '12px' }}>{filter.icon}</span>
                                    <span style={{
                                        maxWidth: '120px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {filter.label}
                                    </span>
                                    <button
                                        onClick={filter.onRemove}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: `${filter.color}20`,
                                            color: filter.color,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.backgroundColor = filter.color;
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.backgroundColor = `${filter.color}20`;
                                            e.currentTarget.style.color = filter.color;
                                        }}
                                        title={`Remove ${filter.label} filter`}
                                    >
                                        <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    setSquadViewFilter([]);
                                    setPlatformViewFilter([]);
                                    setSelectedEntities([]);
                                    setSelectedCategory('All');
                                    setExceptionsOnly(false);
                                    setHighlightProject('');
                                    try { localStorage.setItem('capacitySelectedEntities', JSON.stringify([])); } catch (e) { }
                                }}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9';
                                    e.currentTarget.style.borderColor = isDark ? '#64748b' : '#94a3b8';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = isDark ? '#475569' : '#cbd5e1';
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                    )}



                    {/* GRID CONTAINER - Stats, Chart, and Grid are inside a single scrollable panel like V1 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 0 0 16px', minHeight: 0 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, backgroundColor: 'white', borderRadius: '12px 12px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                            {isCapacityLoading && !hasInitialLoadedRef.current ? (
                                <LoadingScreen message="Calculating capacity model..." />
                            ) : (!processedData || processedData.length === 0) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                    <span style={{ fontSize: '36px', marginBottom: '16px' }}>📭</span>
                                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#475569' }}>No Data Found</h3>
                                    <p style={{ fontSize: '14px' }}>Check your settings or active view filters.</p>
                                </div>
                            ) : viewMode === 'slots' ? (
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                    <SlotHeatmap
                                        slotMap={slotMap}
                                        dateScaffold={processedData}
                                        slotProfile={storedSettings.slotProfile}
                                        enabledSquads={squadViewFilter.length > 0 ? squadViewFilter : (storedSettings.activeSquads || [])}
                                        mergeSquads={mergeSquads} // Squad Merging Experiment
                                        projects={effectiveProjects}
                                        allProjects={allProjects} // Pass full project list for "Copy Resourcing"
                                        resources={filteredResources} // Pass resources for staffing recommendations
                                        slotOptimization={storedSettings.slotOptimization || {}}
                                        roleConfig={storedSettings.roleConfig || { jobs: {}, constraints: {} }}
                                        aiEnabled={storedSettings.aiIntelligence?.enabled && storedSettings.aiIntelligence?.tableId}
                                        allGroupsExpanded={allGroupsExpanded}
                                        onAssignProject={dashboardHandlers.handleAssignProject}
                                        onProjectClick={(project) => {
                                            // Open DetailModal with project data
                                            // DetailModal expects `dateKey` for title and `details` array for content
                                            setSelectedBucketData({
                                                dateKey: project.name, // Use project name as title
                                                details: [{
                                                    id: project.id,
                                                    projectId: project.id,
                                                    name: project.name,
                                                    customer: project.customer,
                                                    status: project.status,
                                                    kickOff: project.kickOff || project.start,
                                                    launch: project.launch || project.end,
                                                    squads: project.squads,
                                                    pmVal: project.pmVal,
                                                    scVal: project.scVal,
                                                    pdVal: project.pdVal,
                                                    hours: ((project.pmVal || 0) + (project.scVal || 0) + (project.pdVal || 0)) / 3600,
                                                    team: project.team,
                                                    wave: project.wave,
                                                    effortProfile: project.effortProfile,
                                                    countryFlag: project.countryFlag,
                                                    country: project.country,
                                                    scope: project.scope // Add scope here
                                                }]
                                            });
                                        }}
                                        onGenerateAIInsights={dashboardHandlers.handleGenerateAIInsights}
                                        onSaveAsDraft={dashboardHandlers.handleSaveAsDraft}
                                        onOptimize={() => setShowOptimizationModal(true)}
                                    />
                                </div>
                            ) : (
                                <>

                                    {/* BAU Mode Section Header for Renewals/CRs */}
                                    {demandCategory === 'bau' && renewalCRProjects.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '12px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.05)',
                                            border: `1px solid ${isDark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.2)'}`
                                        }}>
                                            <span style={{ fontSize: '16px' }}>🔄</span>
                                            <span style={{
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: isDark ? '#fdba74' : '#ea580c'
                                            }}>
                                                Renewals & Change Requests
                                            </span>
                                            <span style={{
                                                fontSize: '12px',
                                                color: isDark ? '#94a3b8' : '#64748b'
                                            }}>
                                                ({renewalCRProjects.length} projects)
                                            </span>
                                        </div>
                                    )}

                                    <ResourceGrid
                                        groupedData={filteredGroupedData}
                                        dates={processedData || []}
                                        onCellClick={dashboardHandlers.handleCellClick}
                                        todayKey={todayKey}
                                        cellDisplayMode={cellDisplayMode}
                                        forecastMode={forecastMode}
                                        toggleShowAll={() => { }}
                                        columnWidth={currentZoom.width}
                                        fontSize={12}
                                        highlightProject={highlightProject}
                                        thresholds={storedSettings.thresholds || DEFAULT_SETTINGS.thresholds}
                                        groupStats={groupStats || {}}
                                        pinnedResources={storedSettings.pinnedResources || []}
                                        onTogglePin={handleTogglePin}
                                        viewMode={viewMode}
                                        onResourceClick={handleResourceClick}
                                        allGroupsExpanded={allGroupsExpanded}
                                        customerSort={customerSort}
                                        selectedProjects={selectedProjects}
                                        onToggleSelection={handleToggleSelection}
                                        footerChildren={viewMode === 'projects' && demandCategory === 'bau' && virtualBAUProjects.length > 0 ? (
                                            <div style={{
                                                marginTop: '16px',
                                                borderRadius: '12px',
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                                                overflow: 'hidden'
                                            }}>
                                                {/* Collapsible Header */}
                                                <div
                                                    onClick={() => setBauGridExpanded(!bauGridExpanded)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '12px 16px',
                                                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        borderBottom: bauGridExpanded ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` : 'none'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{
                                                            fontSize: '12px',
                                                            transform: bauGridExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s ease',
                                                            color: isDark ? '#93c5fd' : '#3b82f6'
                                                        }}>▶</span>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#93c5fd' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 20V10" />
                                                            <path d="M18 20V4" />
                                                            <path d="M6 20v-4" />
                                                        </svg>
                                                        <span style={{
                                                            fontSize: '14px',
                                                            fontWeight: 600,
                                                            color: isDark ? '#93c5fd' : '#3b82f6'
                                                        }}>
                                                            Virtual BAU Projects
                                                        </span>
                                                        <span style={{
                                                            fontSize: '12px',
                                                            color: isDark ? '#64748b' : '#94a3b8'
                                                        }}>
                                                            ({virtualBAUProjects.length} projects)
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        color: isDark ? '#64748b' : '#94a3b8'
                                                    }}>
                                                        {bauGridExpanded ? 'Click to collapse' : 'Click to expand'}
                                                    </span>
                                                </div>
                                                {/* Collapsible Content */}
                                                {bauGridExpanded && (
                                                    <BAUProjectGrid
                                                        projects={virtualBAUProjects}
                                                        onEditProject={setBauEditProject}
                                                        groupBy={groupBy}
                                                    />
                                                )}
                                            </div>
                                        ) : null}
                                    >
                                        {/* V1 Pattern: Stats Row as children of ResourceGrid */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', paddingBottom: '16px', paddingTop: '16px', paddingLeft: '4px', position: 'sticky', left: 0, zIndex: 10, flexWrap: 'nowrap' }}>
                                            {/* V1 Card: Capacity */}
                                            <div style={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                padding: '12px 16px',
                                                minWidth: '140px',
                                                height: '64px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                    Capacity
                                                </div>
                                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b' }}>
                                                    {Math.round(kpiTotals?.cap || 0).toLocaleString()}h
                                                </div>
                                            </div>

                                            {/* V1 Card: Demand */}
                                            <div style={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                padding: '12px 16px',
                                                minWidth: '140px',
                                                height: '64px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                    Demand
                                                </div>
                                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b' }}>
                                                    {Math.round(kpiTotals?.dem || 0).toLocaleString()}h
                                                </div>
                                            </div>

                                            {/* Annual Capacity KPI — shown in Annualised mode (always) and AGW mode (if annualCapacity data exists). Sums per-resource annualCapacity. */}
                                            {(() => {
                                                const raw = (storedSettings.capacityUtilizationModel || 'annualised').toLowerCase();
                                                const utilMode = raw === 'presence' ? 'agw' : (raw === 'field' ? 'annualised' : raw);
                                                // Surface the KPI in either mode when we have the data — it's always a useful reference.
                                                if (utilMode !== 'annualised' && utilMode !== 'agw') return null;
                                                const totalAnnual = (filteredResources || []).reduce((s, r) => s + (r.annualCapacity || 0), 0);
                                                if (totalAnnual <= 0) return null;
                                                return (
                                                    <div style={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #a7f3d0',
                                                        borderRadius: '12px',
                                                        padding: '12px 16px',
                                                        minWidth: '160px',
                                                        height: '64px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }} title="Sum of each resource's Annual Utilization × Working Hours × 52. Excludes leave / holidays / sick (handled upstream in Airtable formula).">
                                                        <div style={{ fontSize: '10px', color: '#047857', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                            Annual Capacity
                                                        </div>
                                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#047857' }}>
                                                            {Math.round(totalAnnual).toLocaleString()}<span style={{ fontSize: '12px', color: '#059669', marginLeft: '3px', fontWeight: '600' }}>h/yr</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* V1 Parity: Utilization Card with Circular Progress */}
                                            {(() => {
                                                const utilizationRate = kpiTotals?.cap > 0 ? Math.round((kpiTotals?.dem / kpiTotals?.cap) * 100) : 0;
                                                const isOverloaded = utilizationRate > 100;
                                                return (
                                                    <div style={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        padding: '12px 16px',
                                                        minWidth: '140px',
                                                        height: '64px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        flexShrink: 0
                                                    }}>
                                                        {/* Circular Progress */}
                                                        <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0 }}>
                                                            <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                                                                <path
                                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                    fill="none"
                                                                    stroke="#f1f5f9"
                                                                    strokeWidth="3"
                                                                />
                                                                <path
                                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                    fill="none"
                                                                    stroke={isOverloaded ? '#ef4444' : '#1e3a5f'}
                                                                    strokeWidth="3"
                                                                    strokeLinecap="round"
                                                                    strokeDasharray={`${Math.min(utilizationRate, 100)}, 100`}
                                                                />
                                                            </svg>
                                                            <div style={{
                                                                position: 'absolute',
                                                                inset: 0,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '10px',
                                                                fontWeight: 'bold',
                                                                color: '#94a3b8'
                                                            }}>%</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                                Utilization
                                                            </div>
                                                            <div style={{
                                                                fontSize: '22px',
                                                                fontWeight: 'bold',
                                                                color: isOverloaded ? '#ef4444' : '#1e293b',
                                                                lineHeight: 1.1
                                                            }}>{utilizationRate}%</div>
                                                        </div>
                                                        {/* Arrow indicator like V1 */}
                                                        <div style={{ color: '#94a3b8', fontSize: '16px', marginLeft: 'auto' }}>›</div>
                                                    </div>
                                                );
                                            })()}

                                            {/* V1 Card: Active Projects */}
                                            <div style={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                padding: '12px 16px',
                                                minWidth: '140px',
                                                height: '64px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                    Active Projects
                                                </div>
                                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b' }}>
                                                    {(demandCategory === 'bau' ? virtualBAUProjects.length : activeProjects.length).toLocaleString()}
                                                </div>
                                            </div>

                                            {/* Implementation vs BAU Mix Dial */}
                                            {(() => {
                                                const implPct = demandMix.implPct;
                                                const bauPct = demandMix.bauPct;
                                                // SVG donut chart with two segments
                                                const radius = 16;
                                                const circumference = 2 * Math.PI * radius;
                                                const implLength = (implPct / 100) * circumference;
                                                const bauOffset = implLength;

                                                return (
                                                    <div style={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        padding: '12px 16px',
                                                        minWidth: '180px',
                                                        height: '64px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '14px',
                                                        flexShrink: 0
                                                    }}>
                                                        {/* Donut Chart */}
                                                        <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                                                            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                                                                {/* Background circle */}
                                                                <circle
                                                                    cx="22" cy="22" r={radius}
                                                                    fill="none"
                                                                    stroke="#f1f5f9"
                                                                    strokeWidth="6"
                                                                />
                                                                {/* Implementation segment (teal) */}
                                                                <circle
                                                                    cx="22" cy="22" r={radius}
                                                                    fill="none"
                                                                    stroke="#0d9488"
                                                                    strokeWidth="6"
                                                                    strokeDasharray={`${implLength} ${circumference}`}
                                                                    strokeDashoffset="0"
                                                                    strokeLinecap="round"
                                                                />
                                                                {/* BAU segment (amber) */}
                                                                {bauPct > 0 && (
                                                                    <circle
                                                                        cx="22" cy="22" r={radius}
                                                                        fill="none"
                                                                        stroke="#f59e0b"
                                                                        strokeWidth="6"
                                                                        strokeDasharray={`${(bauPct / 100) * circumference} ${circumference}`}
                                                                        strokeDashoffset={-implLength}
                                                                        strokeLinecap="round"
                                                                    />
                                                                )}
                                                            </svg>
                                                        </div>
                                                        {/* Labels */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Demand Mix
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#0d9488' }} />
                                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0d9488' }}>{implPct}%</span>
                                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Impl</span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
                                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>{bauPct}%</span>
                                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>BAU</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Revenue Recognition Card (Financial Mode) */}
                                            <div
                                                onClick={() => setRevRecExpanded(!revRecExpanded)}
                                                style={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    padding: '12px 16px',
                                                    minWidth: revRecExpanded ? '280px' : '160px',
                                                    height: revRecExpanded ? 'auto' : '64px',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                                                            Projected Rev (FY)
                                                        </div>
                                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#00BD00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            £{Math.round(statsRevenue?.total?.fullYear || 0).toLocaleString()}

                                                            {/* Revenue Delta Badge */}
                                                            {Math.abs(revenueDelta) > 100 && (
                                                                <span
                                                                    onClick={(e) => { e.stopPropagation(); setShowImpactDrawer(true); }}
                                                                    style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: '600',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: revenueDelta > 0 ? '#dcfce7' : '#fee2e2',
                                                                        color: revenueDelta > 0 ? '#166534' : '#991b1b',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '2px',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                    title="Click to see impact breakdown"
                                                                >
                                                                    {revenueDelta > 0 ? '▲' : '▼'}
                                                                    £{Math.round(Math.abs(revenueDelta)).toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ color: '#94a3b8', fontSize: '16px', transform: revRecExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>›</div>
                                                </div>

                                                {/* Expanded Detail View */}
                                                {revRecExpanded && (
                                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                                        {/* FY To Date */}
                                                        <div style={{ marginBottom: '10px' }}>
                                                            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>FY To Date</div>
                                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>Impl Fees</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0284c7' }}>£{Math.round(statsRevenue?.implFee?.toDate || 0).toLocaleString()}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>ARR</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#7637E3' }}>£{Math.round(statsRevenue?.arr?.toDate || 0).toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Full Year */}
                                                        <div>
                                                            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Full Year Projection</div>
                                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>Impl Fees</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0284c7' }}>£{Math.round(statsRevenue?.implFee?.fullYear || 0).toLocaleString()}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>ARR</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#7637E3' }}>£{Math.round(statsRevenue?.arr?.fullYear || 0).toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* View Breakdown Button */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowFinancialDrawer(true); }}
                                                            style={{
                                                                marginTop: '12px',
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                backgroundColor: '#f0fdf4',
                                                                border: '1px solid #bbf7d0',
                                                                borderRadius: '8px',
                                                                color: '#00BD00',
                                                                fontSize: '12px',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px'
                                                            }}
                                                        >
                                                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            View Project Breakdown
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Spacer */}
                                            <div style={{ flexGrow: 1 }} />

                                            {/* V1 Parity: Q1-Q4 Jump Buttons */}
                                            <div style={{
                                                display: 'flex',
                                                backgroundColor: '#f1f5f9',
                                                borderRadius: '8px',
                                                padding: '2px',
                                                border: '1px solid #e2e8f0',
                                                flexShrink: 0
                                            }}>
                                                {[1, 2, 3, 4].map(q => (
                                                    <button
                                                        key={q}
                                                        onClick={() => jumpToQuarter(q)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            color: '#64748b',
                                                            backgroundColor: 'transparent',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        onMouseOver={(e) => {
                                                            e.target.style.backgroundColor = 'white';
                                                            e.target.style.color = '#7637E3';
                                                        }}
                                                        onMouseOut={(e) => {
                                                            e.target.style.backgroundColor = 'transparent';
                                                            e.target.style.color = '#64748b';
                                                        }}
                                                    >
                                                        Q{q}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Spacer */}
                                            <div style={{ flexGrow: 1 }} />



                                            {/* Toggle Slot Overlay */}
                                            <button
                                                onClick={() => setShowSlots(!showSlots)}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    borderRadius: '8px',
                                                    border: showSlots ? '1px solid #1e293b' : '1px solid #e2e8f0',
                                                    backgroundColor: showSlots ? '#1e293b' : 'white',
                                                    color: showSlots ? 'white' : '#64748b',
                                                    cursor: 'pointer',
                                                    marginLeft: '8px',
                                                    transition: 'all 0.15s',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {showSlots ? 'Hide Slots' : 'Show Slots'}
                                            </button>
                                        </div>
                                        {/* V1 Pattern: ChartSection as children of ResourceGrid */}
                                        <div style={{ position: 'relative' }}>
                                            {/* Loading Overlay */}
                                            {isCapacityLoading && (
                                                <>
                                                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10,
                                                        borderRadius: '12px',
                                                        backdropFilter: 'blur(2px)'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '12px'
                                                        }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                border: `3px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                                                borderTopColor: '#7637E3',
                                                                borderRadius: '50%',
                                                                animation: 'spin 0.8s linear infinite'
                                                            }} />
                                                            <span style={{
                                                                fontSize: '13px',
                                                                fontWeight: 500,
                                                                color: isDark ? '#94a3b8' : '#64748b'
                                                            }}>
                                                                Recalculating...
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            <ChartSection
                                                data={processedData}
                                                statusOrder={uniqueStatuses}
                                                yAxisDomain={null}
                                                slotMap={slotMap}
                                                enabledSquads={squadViewFilter.length > 0 ? squadViewFilter : (storedSettings.activeSquads || [])}
                                                showSlots={showSlots}
                                                onBarClick={(payload) => {
                                                    // Try details array first, then look for projects in other locations
                                                    let projects = payload?.details || [];

                                                    // If details is empty, check unassignedStat.projects
                                                    if (projects.length === 0 && payload?.unassignedStat?.projects) {
                                                        projects = payload.unassignedStat.projects;
                                                    }

                                                    // If still empty, try to build from unassignedMap
                                                    if (projects.length === 0 && payload?.unassignedMap) {
                                                        projects = Object.values(payload.unassignedMap);
                                                    }

                                                    if (projects.length > 0) {
                                                        setSelectedBucketData({
                                                            dateKey: `Portfolio Demand - ${payload.dateKey || ''}`,
                                                            details: projects.map(p => ({
                                                                ...p,
                                                                name: p.name || p.projectName || 'Unknown',
                                                                hours: p.hours || p.totalNeeded || 0,
                                                                status: p.status || 'Active',
                                                                startDate: p.startDate,
                                                                endDate: p.endDate,
                                                                squads: p.squads || [],
                                                                projectId: p.id || p.projectId
                                                            }))
                                                        });
                                                    }
                                                }}
                                                todayKey={todayKey}
                                                forecastMode={forecastMode}
                                                capacityBuffer={10}
                                                columnWidth={currentZoom.width}
                                                showFinanceForecast={showFinanceForecast}
                                                financeForecastData={financeForecastData}
                                            />
                                        </div>

                                        {/* Hybrid Slot Overlay Chart */}
                                        {showSlots && slotMap && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <SlotOverlayChart
                                                    slotMap={slotMap}
                                                    enabledSquads={squadViewFilter.length > 0 ? squadViewFilter : (storedSettings.activeSquads || [])}
                                                    dateScaffold={processedData}
                                                    columnWidth={currentZoom.width}
                                                    slotProfile={storedSettings.slotProfile}
                                                />
                                            </div>
                                        )}
                                    </ResourceGrid>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Floating Keyboard Shortcuts Button */}
                    <button
                        onClick={() => setShowShortcutsModal(true)}
                        title="Keyboard Shortcuts (?)"
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            right: '24px',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: isDark
                                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)'
                                : 'linear-gradient(135deg, #2563eb 0%, #7637E3 100%)',
                            border: 'none',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: Z_INDEX.STICKY,
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5), 0 3px 10px rgba(0, 0, 0, 0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15)';
                        }}
                    >
                        <span style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: 'white',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>?</span>
                    </button>

                    {/* Settings Modal */}
                    {
                        isSettingsOpen && (
                            <SettingsModal
                                storedSettings={storedSettings}
                                saveSettingsToTable={dashboardHandlers.handleSaveSettings}
                                onClose={() => setIsSettingsOpen(false)}
                                allFunctions={[...new Set(allResources.map(r => r.adJobTitle || r.role).filter(Boolean))]}
                                allSquadsFlat={allSquadsUnfiltered}
                                allResources={allResources}
                                allProjects={allProjects}
                                allTables={base ? base.tables : []}
                                altModelFieldMapped={!!resolveFieldId(stableSettings[SETTINGS.TOTAL_EFFORT])}
                                presenceModelFieldMapped={!!resolveFieldId(stableSettings[SETTINGS.ANNUAL_UTILIZATION])}
                            />
                        )
                    }
                    {/* Rename Scenario Modal */}
                    {
                        renameData.isOpen && (
                            <InputModal
                                isOpen={renameData.isOpen}
                                title="Rename Scenario"
                                message={`Enter a new name for "${renameData.scenario?.name}"`}
                                initialValue={renameData.scenario?.name}
                                placeholder="New scenario name..."
                                confirmText="Rename"
                                icon="rename"
                                onConfirm={dashboardHandlers.handleRenameScenarioConfirm}
                                onCancel={() => setRenameData({ isOpen: false, scenario: null })}
                            />
                        )
                    }


                    {/* Initiatives Modal */}
                    {
                        showInitiativesModal && (
                            <InitiativesModal
                                initiatives={storedSettings.initiatives || []}
                                showInitiativesEffect={showInitiativesEffect}
                                onSave={dashboardHandlers.handleSaveInitiatives}
                                onToggleEffect={setShowInitiativesEffect}
                                onClose={() => setShowInitiativesModal(false)}
                                allSquads={allSquads}
                                rampProfiles={rampProfiles}
                                availablePlatforms={[...new Set((effectiveProjects || []).map(p => p.platform).filter(Boolean))].sort()}
                                availableProjectTypes={[...new Set((effectiveProjects || []).map(p => p.projectType).filter(Boolean))].sort()}
                            />
                        )
                    }

                    {/* Optimization Modal */}
                    {
                        showOptimizationModal && (
                            <OptimizationModal
                                isOpen={showOptimizationModal}
                                onClose={() => setShowOptimizationModal(false)}
                                slotMap={slotMap}
                                resources={filteredResources} // Pass resources to enable Staffing Optimization
                                projects={effectiveProjects}
                                unresourcedProjects={effectiveProjects.filter(p => {
                                    // Mirror the logic from SlotHeatmap
                                    const hasSquad = p.squads && p.squads.length > 0 && p.squads[0] !== 'Unassigned';
                                    const isClosed = (p.status || '').toLowerCase().match(/closed|cancelled|completed/);
                                    const hasDates = p.kickOff || p.start || p.launch || p.end;
                                    const hasTeam = p.team && (
                                        (p.team.pm && p.team.pm.length > 0) ||
                                        (p.team.sc && p.team.sc.length > 0) ||
                                        (p.team.pd && p.team.pd.length > 0)
                                    );
                                    const isResourced = hasSquad && (hasDates || hasTeam);
                                    return !isResourced && !isClosed;
                                })}
                                slotProfile={storedSettings.slotProfile}
                                slotOptimization={storedSettings.slotOptimization}
                                fyStartMonth={storedSettings.fyStartMonth}
                                enabledSquads={squadViewFilter.length > 0 ? squadViewFilter : (storedSettings.activeSquads || [])}
                                base={base}
                                aiIntelligence={storedSettings.aiIntelligence}
                                settings={settings}
                                onCreateDraft={dashboardHandlers.handleCreateDraftFromOptimization}
                                onApplyLive={dashboardHandlers.handleApplyOptimizations}
                                roleMapping={storedSettings.roleMapping || {}}
                                onOpenProgramModal={(customer) => {
                                    const customerData = groupedProjectDataWithPrograms?.[customer];
                                    const programGroup = customerData?.['★ Program'];
                                    if (programGroup && programGroup.length > 0) {
                                        setSelectedProgram(programGroup[0]);
                                    } else {
                                        setShowProgramsModal(true);
                                    }
                                }}
                                groupedProgramData={groupedProjectDataWithPrograms}
                                programResources={effectiveResources}
                                programRows={processedData}
                                programsTable={programsTable}
                                programRecords={programRecords}
                                programStoredSettings={{
                                    ...storedSettings,
                                    programAssignments: mergeProgramAssignments(storedSettings?.programAssignments || [])
                                }}
                                scenariosTable={scenariosTable}
                                scenarioRecords={scenarioRecords}
                                scenarios={scenarios}
                            />
                        )
                    }

                    {/* Slot Alignment Modal - shown when dropping project with date mismatch */}
                    {pendingSlotAssignment && (
                        <SlotAlignmentModal
                            isOpen={!!pendingSlotAssignment}
                            onClose={() => setPendingSlotAssignment(null)}
                            slot={pendingSlotAssignment.slot}
                            project={pendingSlotAssignment.project}
                            durationWeeks={pendingSlotAssignment.durationWeeks}
                            onConfirm={dashboardHandlers.handleSlotAlignmentConfirm}
                        />
                    )}

                    {/* Keyboard Shortcuts Modal */}
                    {
                        showShortcutsModal && (
                            <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
                        )
                    }

                    {/* Create Scenario Modal */}
                    {
                        showCreateScenario && (
                            <CreateScenarioModal
                                onClose={() => setShowCreateScenario(false)}
                                onCreate={dashboardHandlers.handleCreateScenario}
                                isLoading={false}
                            />
                        )
                    }

                    {/* Compare Scenarios Modal */}
                    {
                        showCompareScenarios && scenarios.length >= 1 && (
                            <ScenarioCompareModal
                                scenarios={scenarios}
                                activeScenario={activeScenario}
                                revRecTotals={revRecTotals}
                                liveRevenueData={liveProjectsRevenue}
                                periodContext={periodContext}
                                allProjects={allProjects}
                                onClose={() => setShowCompareScenarios(false)}
                                onMerge={(sourceId, targetId) => {
                                    dashboardHandlers.handleMergeScenarios(sourceId, targetId);
                                    setShowCompareScenarios(false);
                                }}
                                onMergeToNew={(id1, id2, newName) => {
                                    dashboardHandlers.handleMergeScenariosToNew(id1, id2, newName);
                                    setShowCompareScenarios(false);
                                }}
                                onMultiMerge={(sourceIds, targetId) => {
                                    dashboardHandlers.handleMultiMergeScenarios(sourceIds, targetId);
                                    setShowCompareScenarios(false);
                                }}
                                onMultiMergeToNew={(scenarioIds, newName) => {
                                    dashboardHandlers.handleMultiMergeScenariosToNew(scenarioIds, newName);
                                    setShowCompareScenarios(false);
                                }}
                            />
                        )
                    }

                    {/* Scenario Notes Modal */}
                    {
                        showNotesModal && activeScenario && (
                            <ScenarioNotesModal
                                scenario={activeScenario}
                                onClose={() => setShowNotesModal(false)}
                                onSave={dashboardHandlers.handleSaveScenarioNotes}
                                isLoading={false}
                            />
                        )
                    }

                    {/* View Changes Modal */}
                    {showViewChanges && activeScenario && (
                        <ViewChangesModal
                            activeScenario={activeScenario}
                            allProjects={allProjects}
                            allResources={allResources}
                            scenarioManager={scenarioManager}
                            setScenarios={setScenarios}
                            onClose={() => setShowViewChanges(false)}
                            addToast={addToast}
                        />
                    )}

                    {/* Commit Confirmation Modal */}
                    {showCommitModal && activeScenario && (
                        <CommitModal
                            activeScenario={activeScenario}
                            allProjects={allProjects}
                            allResources={allResources}
                            onClose={() => setShowCommitModal(false)}
                            onCommit={(selection) => dashboardHandlers.handleCommitScenario(true, selection)}
                        />
                    )}

                    {/* Discard Scenario Confirmation Modal */}
                    {showDiscardConfirm && (
                        <DiscardModal
                            scenarioName={activeScenario?.name || ''}
                            onClose={() => setShowDiscardConfirm(false)}
                            onDiscard={() => {
                                setShowDiscardConfirm(false);
                                setActiveScenarioId(null);
                            }}
                        />
                    )}

                    {
                        activeCell && (
                            <AllocationModal
                                resource={allResources?.find(r => r.id === activeCell.resourceId)}
                                dateKey={activeCell.dateKey}
                                allProjects={allProjects}
                                onClose={() => setActiveCell(null)}
                                onSave={dashboardHandlers.handleSaveAllocations}
                                settings={storedSettings}
                            />
                        )
                    }

                    {/* V1: Detail Modal (Rich Drilldown) */}
                    {
                        selectedBucketData && (
                            <DetailModal
                                data={selectedBucketData}
                                allResources={allResources}
                                allProjects={effectiveProjects}
                                allSquadsFlat={allSquadsUnfiltered}
                                programAssignments={storedSettings?.programAssignments || []}
                                programWorkstreams={globalProgramBudget?.workstreams || []}
                                programBudgets={programBudgets}
                                programDates={{ start: globalProgramBudget?.start, end: globalProgramBudget?.end }}
                                onAssign={dashboardHandlers.handleAssignTeamMember}
                                onUnassign={dashboardHandlers.handleUnassignTeamMember}
                                onUpdateAllocation={dashboardHandlers.handleUpdateAllocation}
                                onCopyToOtherRoles={dashboardHandlers.handleCopyToOtherRoles}
                                onCopyToAllRoles={dashboardHandlers.handleCopyToAllRoles}
                                onUpdateProject={dashboardHandlers.handleUpdateProject}
                                onUpdateResource={null}
                                rampProfiles={storedSettings.rampProfiles || []}
                                onClose={() => setSelectedBucketData(null)}
                                roleMapping={storedSettings.roleMapping || {}}
                                modelParams={storedSettings.modelParams || {}}
                                onNavigate={dashboardHandlers.handleDetailModalNavigate}
                                onClone={dashboardHandlers.handleCloneProject}
                                onManageProgram={(customer) => {
                                    // Close detail modal and find program for this customer
                                    setSelectedBucketData(null);
                                    // Find program data from groupedProjectDataWithPrograms
                                    const customerData = groupedProjectDataWithPrograms?.[customer];
                                    const programGroup = customerData?.['★ Program'];
                                    if (programGroup && programGroup.length > 0) {
                                        setSelectedProgram(programGroup[0]);
                                    }
                                }}
                            />
                        )
                    }

                    {/* V1: Resource Profile Modal */}
                    {
                        selectedResourceId && effectiveResources?.find(r => r.id === selectedResourceId) && (
                            <ResourceProfileModal
                                resource={effectiveResources?.find(r => r.id === selectedResourceId)}
                                rampProfiles={storedSettings.rampProfiles || []}
                                onClose={() => setSelectedResourceId(null)}
                                onUpdate={dashboardHandlers.handleUpdateResource}
                            />
                        )
                    }

                    {/* Program Detail Modal */}
                    {
                        selectedProgram && (
                            <ProgramDetailModal
                                program={selectedProgram}
                                allPrograms={(() => {
                                    // Build flat list of all programs from groupedProjectDataWithPrograms
                                    const programs = [];
                                    Object.values(groupedProjectDataWithPrograms || {}).forEach(customerGroup => {
                                        const programGroup = customerGroup?.['★ Program'];
                                        if (programGroup) programs.push(...programGroup);
                                    });
                                    return programs;
                                })()}
                                onNavigate={(program) => setSelectedProgram(program)}
                                allResources={effectiveResources}
                                allRows={processedData} // Pass capacity data for Smart Resource Picker
                                programsTable={programsTable}
                                programRecords={programRecords}
                                storedSettings={{
                                    ...storedSettings,
                                    programAssignments: mergeProgramAssignments(storedSettings?.programAssignments || [])
                                }}
                                onProjectClick={(project) => {
                                    // Close program modal and open DetailModal with project data
                                    setSelectedProgram(null);
                                    // Use same structure as main grid's onProjectClick
                                    setSelectedBucketData({
                                        dateKey: project.name,
                                        details: [{
                                            id: project.id,
                                            projectId: project.id,
                                            name: project.name,
                                            customer: project.customer,
                                            status: project.status,
                                            kickOff: project.kickOff || project.start,
                                            launch: project.launch || project.end,
                                            squads: project.squads,
                                            pmVal: project.pmVal,
                                            scVal: project.scVal,
                                            pdVal: project.pdVal,
                                            hours: ((project.pmVal || 0) + (project.scVal || 0) + (project.pdVal || 0)),
                                            team: project.team,
                                            wave: project.wave,
                                            effortProfile: project.effortProfile,
                                            countryFlag: project.countryFlag,
                                            country: project.country,
                                            scope: project.scope
                                        }]
                                    });
                                }}
                                onUpdateSettings={(newSettings) => {
                                    // programRecordMap is structural metadata — always persist immediately
                                    if (newSettings.programRecordMap) {
                                        const updatedSettings = {
                                            ...storedSettings,
                                            programRecordMap: newSettings.programRecordMap
                                        };
                                        setStoredSettings(prev => ({ ...prev, programRecordMap: newSettings.programRecordMap }));

                                        // Persist to Airtable settings table
                                        persistSettingsJSON(updatedSettings);

                                        // If this was ONLY a programRecordMap update, we're done
                                        if (!newSettings.programAssignments) return;
                                    }

                                    // If in draft mode, save program changes to scenario
                                    if (activeScenario && !activeScenario.isLive && scenarioManager) {
                                        const currentChanges = activeScenario.changes || { projects: {}, resources: {}, programAssignments: [] };
                                        // Diff program assignments and add to scenario
                                        const baseProgramAssignments = storedSettings?.programAssignments || [];
                                        const newProgramAssignments = newSettings.programAssignments || [];

                                        // Find changes (new, removed, or modified)
                                        const assignmentChanges = [];

                                        // Check for new or modified
                                        newProgramAssignments.forEach(a => {
                                            const base = baseProgramAssignments.find(b => b.id === a.id);
                                            if (!base) {
                                                // New assignment
                                                const resource = effectiveResources?.find(r => r.id === a.resourceId);
                                                assignmentChanges.push({ ...a, _isNew: true, resourceName: resource?.name || 'Unknown' });
                                            } else if (JSON.stringify(base) !== JSON.stringify(a)) {
                                                // Modified assignment
                                                const resource = effectiveResources?.find(r => r.id === a.resourceId);
                                                assignmentChanges.push({ ...a, resourceName: resource?.name || 'Unknown' });
                                            }
                                        });

                                        // Check for removed
                                        baseProgramAssignments.forEach(b => {
                                            const exists = newProgramAssignments.find(a => a.id === b.id);
                                            if (!exists) {
                                                const resource = effectiveResources?.find(r => r.id === b.resourceId);
                                                assignmentChanges.push({ ...b, _deleted: true, resourceName: resource?.name || 'Unknown' });
                                            }
                                        });

                                        const updatedChanges = {
                                            ...currentChanges,
                                            programAssignments: assignmentChanges
                                        };

                                        scenarioManager.saveScenarioChanges(activeScenario.id, updatedChanges, {
                                            lastSavedAt: new Date().toISOString(),
                                            totalChanges: Object.keys(updatedChanges.projects).length +
                                                Object.keys(updatedChanges.resources).length +
                                                assignmentChanges.length
                                        });

                                        // Update local scenario state so CommitModal can see programAssignments
                                        setScenarios(prev => prev.map(s =>
                                            s.id === activeScenario.id
                                                ? { ...s, changes: updatedChanges }
                                                : s
                                        ));

                                        // Update local state with merged assignments
                                        setStoredSettings(prev => ({ ...prev, programAssignments: newSettings.programAssignments }));
                                    } else {
                                        // Live mode: save directly to stored settings AND persist to settings table
                                        const updatedSettings = { ...storedSettings, ...newSettings };
                                        setStoredSettings(updatedSettings);

                                        // Persist to Airtable settings table
                                        persistSettingsJSON(updatedSettings);
                                    }
                                }}
                                onClose={() => setSelectedProgram(null)}
                                isDraftMode={activeScenario && !activeScenario.isLive}
                            />
                        )
                    }

                    {/* V1: Documentation Modal */}
                    {
                        showDocs && (
                            <DocumentationModal onClose={() => setShowDocs(false)} />
                        )
                    }
                    {/* Programs Management Modal - Shows list of programs grouped by customer */}
                    {
                        showProgramsModal && (
                            <ProgramsManagementModal
                                isOpen={showProgramsModal}
                                onClose={() => setShowProgramsModal(false)}
                                programs={Object.values(programBudgets)}
                                allResources={allResources}
                                storedSettings={storedSettings}
                                onUpdateSettings={(newSettings) => {
                                    const updatedSettings = { ...storedSettings, ...newSettings };
                                    setStoredSettings(updatedSettings);
                                    // Persist to Settings Table if in Live Mode (or no active scenario)
                                    // Logic: If activeScenario exists and is NOT live, we are in Draft -> Don't write to Main Settings Table?
                                    // Actually, usually Draft saves to Scenario Record.
                                    // The original code logic was confusing but likely meant "If Live".
                                    // activeScenario?.isLive !== false means "isLive is true or undefined".
                                    // If activeScenario is null, undefined !== false is true. (Live)
                                    // If activeScenario is { isLive: true }, true !== false is true. (Live)
                                    // If activeScenario is { isLive: false }, false !== false is false. (Draft)
                                    const isLiveReference = !activeScenario || activeScenario.isLive;

                                    if (isLiveReference) {
                                        persistSettingsJSON(updatedSettings);
                                    } else if (activeScenario && !activeScenario.isLive) {
                                        // Draft Mode persistence usually handled by ScenarioManager/useDashboardHandlers
                                        // Here we just update local state, and rely on useScenarioSelection/hooks to sync?
                                        // OR we should call handleUpdateSettings which saves to scenario?
                                        // Since we don't have handleUpdateSettings easily available (it was inline), we stick to this.
                                    }
                                }}
                                isDraftMode={activeScenario && !activeScenario.isLive}
                                programsTable={programsTable}
                                programRecords={programRecords}
                                onSelectProgram={(program) => {
                                    setShowProgramsModal(false);
                                    if (program) {
                                        setSelectedProgram(program);
                                    }
                                }}
                            />
                        )
                    }

                    {/* V1 Parity: Batch Update Modal */}
                    {
                        showBatchModal && (
                            <BatchUpdateModal
                                isOpen={showBatchModal}
                                onClose={() => setShowBatchModal(false)}
                                selectedProjects={selectedProjects}
                                allProjects={allProjects}
                                allResources={allResources}
                                allSquads={allSquads}
                                onApply={dashboardHandlers.handleBatchApply}
                                isLoading={isBatchUpdating}
                            />
                        )
                    }

                    {/* Conflict Resolution Modal - V1 Parity */}
                    {
                        showConflictModal && detectedConflicts && (
                            <ConflictResolutionModal
                                conflicts={detectedConflicts}
                                draftName={detectedConflicts.draftName}
                                isStale={detectedConflicts.isStale}
                                onResolve={dashboardHandlers.handleConflictResolve}
                                onCancel={() => {
                                    setShowConflictModal(false);
                                    setDetectedConflicts(null);
                                    setPendingScenarioId(null);
                                }}
                            />
                        )
                    }

                    {/* Scenario Merge Conflict Resolution Modal */}
                    {mergeConflictData && (
                        <ScenarioMergeConflictModal
                            conflicts={mergeConflictData.conflicts}
                            scenarios={mergeConflictData.scenarios}
                            newMergedName={mergeConflictData.newName}
                            onResolve={(resolutions, mergedResult) => {
                                mergeConflictData.onResolve(resolutions, mergedResult);
                                setMergeConflictData(null);
                            }}
                            onCancel={() => setMergeConflictData(null)}
                        />
                    )}

                    {/* Financial Breakdown Drawer */}
                    {showFinancialDrawer && (
                        <FinancialBreakdownDrawer
                            isOpen={showFinancialDrawer}
                            onClose={() => setShowFinancialDrawer(false)}
                            revRecByProject={revenueScope === 'filtered' ? filteredRevenue.projects : allProjectsRevenue.projects}
                            revRecTotals={revenueScope === 'filtered' ? {
                                implFee: { fullYear: filteredRevenue.totals.implFee },
                                arr: { fullYear: filteredRevenue.totals.arr },
                                total: { fullYear: filteredRevenue.totals.total }
                            } : {
                                implFee: { fullYear: allProjectsRevenue.totals.implFee },
                                arr: { fullYear: allProjectsRevenue.totals.arr },
                                total: { fullYear: allProjectsRevenue.totals.total }
                            }}
                            title={`Revenue Breakdown - ${revenueScope === 'filtered' ? filteredRevenue.periodLabel : allProjectsRevenue.periodLabel}`}
                            period={financialPeriod}
                            onPeriodChange={setFinancialPeriod}
                            scope={revenueScope}
                            onScopeChange={setRevenueScope}
                            hasActiveFilters={squadViewFilter?.length > 0 || stableFilteredProjects.length !== effectiveProjects.length}
                        />
                    )}

                    {/* Revenue Impact Drawer (Debugging/Delta View) */}
                    {showImpactDrawer && (
                        <RevenueImpactDrawer
                            isOpen={showImpactDrawer}
                            onClose={() => setShowImpactDrawer(false)}
                            liveRevenue={liveProjectsRevenue}
                            draftRevenue={allProjectsRevenue}
                            periodLabel={financialPeriod.label}
                        />
                    )}

                    {/* Delete Scenario Confirmation Modal */}
                    {deleteConfirmScenario && (
                        <ConfirmModal
                            isOpen={!!deleteConfirmScenario}
                            title="Delete Scenario"
                            message={`Are you sure you want to delete "${deleteConfirmScenario?.name}"? This action cannot be undone.`}
                            confirmText="Delete"
                            cancelText="Cancel"
                            variant="danger"
                            onConfirm={dashboardHandlers.handleDeleteScenarioConfirm}
                            onCancel={() => setDeleteConfirmScenario(null)}
                        />
                    )}

                    {/* Guided Tour */}
                    {
                        showTour && !showBatchModal && (
                            <GuidedTour
                                onComplete={() => {
                                    setShowTour(false);
                                    localStorage.setItem('capacityModelTourCompleted', 'true');
                                }}
                                onSkip={() => {
                                    setShowTour(false);
                                    localStorage.setItem('capacityModelTourCompleted', 'true');
                                }}
                            />
                        )
                    }


                    {/* AI Insights Modal */}
                    <AIInsightsModal
                        isOpen={showAIModal}
                        onClose={() => setShowAIModal(false)}
                        isLoading={aiLoading}
                        insightData={aiInsightData}
                    />

                    {/* Export Modal */}
                    <ExportModal
                        isOpen={showExportModal}
                        onClose={() => setShowExportModal(false)}
                        filteredResources={filteredResources}
                        filteredProjects={filteredProjects}
                        processedData={processedData}
                        addToast={addToast}
                        programAssignments={storedSettings?.programAssignments || []}
                        programBudgets={programBudgets}
                        programWorkstreams={storedSettings?.programWorkstreams || []}
                        allResources={allResources}
                        activeFilters={{
                            squads: squadViewFilter,
                            entities: selectedEntities,
                            search: resourceSearch,
                            demandCategory,
                            statuses: statusViewFilter
                        }}
                    />

                    {/* Finance Forecast Modal */}
                    {showFinanceForecastModal && (
                        <FinanceForecastModal
                            isOpen={showFinanceForecastModal}
                            onClose={() => setShowFinanceForecastModal(false)}
                            initialArrData={activeForecastRaw?.arrData || null}
                            initialParameters={activeForecastRaw?.parameters || null}
                            initialName={activeForecastRaw?.name || ''}
                            initialFY={activeForecastRaw?.fyStartYear || null}
                            savedForecasts={forecastRecords?.map(record => {
                                try {
                                    const nameFieldId = settings[SETTINGS.FORECAST_NAME];
                                    const arrJsonFieldId = settings[SETTINGS.FORECAST_ARR_JSON];
                                    const paramsJsonFieldId = settings[SETTINGS.FORECAST_PARAMETERS_JSON];
                                    return {
                                        id: record.id,
                                        name: record.getCellValueAsString(nameFieldId) || 'Unnamed',
                                        arrData: JSON.parse(record.getCellValueAsString(arrJsonFieldId) || '{}'),
                                        parameters: JSON.parse(record.getCellValueAsString(paramsJsonFieldId) || '{}')
                                    };
                                } catch (e) {
                                    return { id: record.id, name: 'Unnamed', arrData: {}, parameters: {} };
                                }
                            }) || []}
                            onLoad={(forecast) => {
                                // Load saved forecast data into the modal state
                                // Trigger apply with the loaded data
                                if (forecast.arrData && Object.keys(forecast.arrData).length > 0) {
                                    const rawForecastData = {
                                        arrData: forecast.arrData,
                                        parameters: forecast.parameters || {},
                                        name: forecast.name
                                    };
                                    const weeklyDemand = transformForecastToWeeklyDemand(rawForecastData, processedData, storedSettings.fyStartMonth ?? 4);
                                    setShowFinanceForecast(true);
                                    setFinanceForecastData(weeklyDemand);
                                    setShowFinanceForecastModal(false);
                                    addToast({
                                        type: 'success',
                                        title: 'Forecast Loaded',
                                        message: `"${forecast.name}" applied to chart.`
                                    });
                                }
                            }}
                            onSave={async (forecastData) => {
                                // Save forecast to the dedicated Forecast Scenarios table
                                if (!forecastTable) {
                                    addToast({
                                        type: 'error',
                                        title: 'Table not configured',
                                        message: 'Forecast Scenarios table is not mapped in settings.'
                                    });
                                    return;
                                }

                                try {
                                    // Get field references from settings (these are Field objects, not string IDs)
                                    const nameFieldRef = settings[SETTINGS.FORECAST_NAME];
                                    const arrJsonFieldRef = settings[SETTINGS.FORECAST_ARR_JSON];
                                    const paramsJsonFieldRef = settings[SETTINGS.FORECAST_PARAMETERS_JSON];
                                    const fyStartFieldRef = settings[SETTINGS.FORECAST_FY_START];
                                    const isActiveFieldRef = settings[SETTINGS.FORECAST_IS_ACTIVE];

                                    // Helper to extract field ID from Field object or string
                                    const getFieldId = (fieldRef) => {
                                        if (!fieldRef) return null;
                                        // If it's already a string ID, return it
                                        if (typeof fieldRef === 'string') return fieldRef;
                                        // If it's a Field object, extract the ID
                                        if (fieldRef.id) return fieldRef.id;
                                        return null;
                                    };

                                    // Extract field IDs
                                    const nameFieldId = getFieldId(nameFieldRef);
                                    const arrJsonFieldId = getFieldId(arrJsonFieldRef);
                                    const paramsJsonFieldId = getFieldId(paramsJsonFieldRef);
                                    const fyStartFieldId = getFieldId(fyStartFieldRef);
                                    const isActiveFieldId = getFieldId(isActiveFieldRef);



                                    // Calculate FY start date
                                    const today = new Date();
                                    const fyStartMonth = storedSettings.fyStartMonth ?? 4;
                                    const currentMonth = today.getMonth() + 1;
                                    const fyStartYear = currentMonth >= fyStartMonth ? today.getFullYear() : today.getFullYear() - 1;
                                    const fyStartDate = new Date(fyStartYear, fyStartMonth - 1, 1);

                                    // Build record fields using field IDs
                                    const fields = {};
                                    if (nameFieldId) fields[nameFieldId] = forecastData.name;
                                    if (arrJsonFieldId) fields[arrJsonFieldId] = JSON.stringify(forecastData.arrData);
                                    if (paramsJsonFieldId) fields[paramsJsonFieldId] = JSON.stringify(forecastData.parameters);
                                    if (fyStartFieldId) fields[fyStartFieldId] = fyStartDate.toISOString().split('T')[0];
                                    if (isActiveFieldId) fields[isActiveFieldId] = true;

                                    // Check if we have at least the name field
                                    if (!nameFieldId) {
                                        throw new Error('Forecast Name field is not properly mapped. Please check Interface Designer settings.');
                                    }


                                    await forecastTable.createRecordAsync(fields);

                                    addToast({
                                        type: 'success',
                                        title: 'Forecast Saved',
                                        message: `"${forecastData.name}" saved to Forecast Scenarios table`
                                    });
                                } catch (error) {
                                    console.error('Failed to save forecast:', error);
                                    addToast({
                                        type: 'error',
                                        title: 'Save Failed',
                                        message: error.message
                                    });
                                }
                            }}
                            onApplyToChart={(rawForecastData) => {
                                // Transform ARR data to weekly demand format using chart's existing dates
                                const weeklyDemand = transformForecastToWeeklyDemand(rawForecastData, processedData, storedSettings.fyStartMonth ?? 4);

                                // Debug: Log forecast data


                                // Resolve role using the same logic as the worker
                                const resolveRole = (r) => {
                                    const jobTitle = r.adJobTitle || r.role || '';
                                    const roleKey = jobTitle.toUpperCase();
                                    const roleJobs = (storedSettings.roleConfig?.jobs) || {};
                                    const rm = storedSettings.roleMapping || {};
                                    const jobConf = roleJobs[jobTitle];
                                    if (jobConf && jobConf.primary) {
                                        const upper = jobConf.primary.toUpperCase();
                                        if (upper === 'PM' || upper.includes('PROJECT')) return 'pm';
                                        if (upper === 'SC' || upper.includes('SOLUTION') || upper.includes('CONSULT')) return 'sc';
                                        if (upper === 'PD' || upper === 'BUILD' || upper.includes('PLATFORM') || upper.includes('DELIV')) return 'pd';
                                    }
                                    const mapped = rm[jobTitle] || rm[r.role];
                                    if (mapped) {
                                        const mu = mapped.toUpperCase();
                                        if (mu === 'PM') return 'pm';
                                        if (mu === 'SC') return 'sc';
                                        if (mu === 'PD' || mu === 'BUILD') return 'pd';
                                    }
                                    const rf = (r.role || '').toUpperCase();
                                    if (rf === 'PM' || rf.includes('PROJECT')) return 'pm';
                                    if (rf === 'SC' || rf.includes('SOLUTION') || rf.includes('CONSULTANT')) return 'sc';
                                    if (rf === 'PD' || rf.includes('BUILD') || rf.includes('DEVELOP')) return 'pd';
                                    if (roleKey.includes('PM') || roleKey.includes('PROJECT MANAGER') || roleKey.includes('PROGRAM')) return 'pm';
                                    if (roleKey.includes('SC') || roleKey.includes('SOLUTION') || roleKey.includes('CONSULT')) return 'sc';
                                    if (roleKey.includes('PD') || roleKey.includes('DEVELOPER') || roleKey.includes('BUILD') || roleKey.includes('ENGINEER') || roleKey.includes('TECHNICAL')) return 'pd';
                                    return null;
                                };
                                const currentFTECounts = {
                                    pm: allResources.filter(r => resolveRole(r) === 'pm').length,
                                    sc: allResources.filter(r => resolveRole(r) === 'sc').length,
                                    pd: allResources.filter(r => resolveRole(r) === 'pd').length
                                };

                                const fteImpact = calculateFTEImpact({
                                    forecastWeeklyData: weeklyDemand,
                                    processedData,
                                    initiatives: storedSettings.initiatives || [],
                                    currentFTECounts,
                                    avgBillableHoursPerWeek: storedSettings.avgBillableHours || 32
                                });

                                // Enable forecast on chart and store transformed data
                                setShowFinanceForecast(true);
                                setFinanceForecastData(weeklyDemand);
                                setActiveForecastRaw(rawForecastData); // Store raw data for editing
                                setForecastFTEImpact(fteImpact);
                                setShowFinanceForecastModal(false);
                                setShowForecastImpactPanel(true); // Auto-open impact panel

                                addToast({
                                    type: 'success',
                                    title: 'Forecast Applied',
                                    message: `${rawForecastData.name || 'Finance forecast'} is now visible on the chart.`
                                });
                            }}
                            currentFTECounts={(() => {
                                const resolveRole = (r) => {
                                    const jobTitle = r.adJobTitle || r.role || '';
                                    const roleKey = jobTitle.toUpperCase();
                                    const roleJobs = (storedSettings.roleConfig?.jobs) || {};
                                    const rm = storedSettings.roleMapping || {};
                                    const jobConf = roleJobs[jobTitle];
                                    if (jobConf && jobConf.primary) {
                                        const upper = jobConf.primary.toUpperCase();
                                        if (upper === 'PM' || upper.includes('PROJECT')) return 'pm';
                                        if (upper === 'SC' || upper.includes('SOLUTION') || upper.includes('CONSULT')) return 'sc';
                                        if (upper === 'PD' || upper === 'BUILD' || upper.includes('PLATFORM') || upper.includes('DELIV')) return 'pd';
                                    }
                                    const mapped = rm[jobTitle] || rm[r.role];
                                    if (mapped) {
                                        const mu = mapped.toUpperCase();
                                        if (mu === 'PM') return 'pm';
                                        if (mu === 'SC') return 'sc';
                                        if (mu === 'PD' || mu === 'BUILD') return 'pd';
                                    }
                                    const rf = (r.role || '').toUpperCase();
                                    if (rf === 'PM' || rf.includes('PROJECT')) return 'pm';
                                    if (rf === 'SC' || rf.includes('SOLUTION') || rf.includes('CONSULTANT')) return 'sc';
                                    if (rf === 'PD' || rf.includes('BUILD') || rf.includes('DEVELOP')) return 'pd';
                                    if (roleKey.includes('PM') || roleKey.includes('PROJECT MANAGER') || roleKey.includes('PROGRAM')) return 'pm';
                                    if (roleKey.includes('SC') || roleKey.includes('SOLUTION') || roleKey.includes('CONSULT')) return 'sc';
                                    if (roleKey.includes('PD') || roleKey.includes('DEVELOPER') || roleKey.includes('BUILD') || roleKey.includes('ENGINEER') || roleKey.includes('TECHNICAL')) return 'pd';
                                    return null;
                                };
                                return {
                                    pm: allResources.filter(r => resolveRole(r) === 'pm').length,
                                    sc: allResources.filter(r => resolveRole(r) === 'sc').length,
                                    pd: allResources.filter(r => resolveRole(r) === 'pd').length
                                };
                            })()}
                            onDelete={async (forecastId) => {
                                if (!forecastTable) {
                                    addToast({
                                        type: 'error',
                                        title: 'Table not configured',
                                        message: 'Forecast Scenarios table is not mapped in settings.'
                                    });
                                    return;
                                }
                                try {
                                    await forecastTable.deleteRecordAsync(forecastId);
                                    addToast({
                                        type: 'success',
                                        title: 'Forecast Deleted',
                                        message: 'Forecast has been removed.'
                                    });
                                } catch (error) {
                                    console.error('Failed to delete forecast:', error);
                                    addToast({
                                        type: 'error',
                                        title: 'Delete Failed',
                                        message: error.message
                                    });
                                }
                            }}
                        />

                    )}

                    {/* FTE Impact Slide-Out Panel */}
                    <ForecastImpactPanel
                        isOpen={showForecastImpactPanel}
                        onClose={() => setShowForecastImpactPanel(false)}
                        fteImpact={forecastFTEImpact}
                        forecastName={financeForecastData?.name || 'Finance Forecast'}
                    />


                    {/* BAU Project Edit Modal */}
                    {bauEditProject && (
                        <BAUProjectEditModal
                            isOpen={!!bauEditProject}
                            onClose={() => setBauEditProject(null)}
                            project={bauEditProject}
                            squads={availableSquads}
                            onSave={async (projectId, formData) => {
                                // Update the project directly on the table (updateRecord is an
                                // instance method, not static — AirtableService.updateRecord was
                                // undefined and threw on every save).
                                try {
                                    const rawFields = {
                                        [resolveFieldId(stableSettings[SETTINGS.STATUS])]: formData.status || undefined,
                                        [resolveFieldId(stableSettings[SETTINGS.PROJECT_SQUAD])]: formData.squad,
                                        [resolveFieldId(stableSettings[SETTINGS.LAUNCH])]: formData.launch,
                                        [resolveFieldId(stableSettings[SETTINGS.PROJECT_COUNTRY])]: formData.country,
                                        [resolveFieldId(stableSettings[SETTINGS.BAU_TSHIRT_SIZE])]: formData.bauTshirtSize
                                    };
                                    // Strip undefined values (and any unresolved field-id keys) so the
                                    // write only touches fields the user actually provided.
                                    const fields = Object.fromEntries(
                                        Object.entries(rawFields).filter(([k, v]) => k && k !== 'undefined' && v !== undefined)
                                    );
                                    await projTable.updateRecordAsync(projectId, fields);
                                    addToast({ type: 'success', title: 'Project Updated', message: `${formData.name} saved successfully` });
                                } catch (error) {
                                    console.error('Failed to update BAU project:', error);
                                    addToast({ type: 'error', title: 'Update Failed', message: error.message });
                                }
                            }}
                        />
                    )}

                    {/* Activity Log Drawer */}
                    <AuditDrawer
                        isOpen={showAuditDrawer}
                        onClose={() => setShowAuditDrawer(false)}
                    />

                    {/* Toast Notifications */}
                    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
                </div >
            </ErrorBoundary >
        </DashboardProvider >
    );
};

export default Dashboard;

// PropTypes for runtime type validation
Dashboard.propTypes = {
    /** Airtable Table reference for Resources */
    resTable: PropTypes.object.isRequired,
    /** Airtable Table reference for Projects */
    projTable: PropTypes.object.isRequired,
    /** Airtable Table reference for Settings */
    settingsTable: PropTypes.object,
    /** Airtable Table reference for Scenarios */
    scenariosTable: PropTypes.object,
    /** Airtable Table reference for Squads */
    squadsTable: PropTypes.object,
    /** Airtable Table reference for Forecast Scenarios */
    forecastTable: PropTypes.object,
    /** Application settings object */
    settings: PropTypes.shape({
        roleMapping: PropTypes.object,
        rampProfiles: PropTypes.array,
        programAssignments: PropTypes.array,
        slotOptimization: PropTypes.object,
        roleConfig: PropTypes.shape({
            jobs: PropTypes.object,
            constraints: PropTypes.object
        })
    }),
    /** Airtable Base reference */
    base: PropTypes.object.isRequired,
    /** Airtable GlobalConfig for user preferences */
    globalConfig: PropTypes.object.isRequired
};
