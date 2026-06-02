/**
 * useWhatIfMode - Hook for What-If Analysis sandbox mode
 * Allows testing hypothetical project changes without affecting live data
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * What-If change types
 */
export const WHATIF_CHANGES = {
    MOVE_PROJECT: 'MOVE_PROJECT',
    CHANGE_SQUAD: 'CHANGE_SQUAD',
    CHANGE_DATES: 'CHANGE_DATES',
    ADD_RESOURCE: 'ADD_RESOURCE',
    REMOVE_RESOURCE: 'REMOVE_RESOURCE'
};

/**
 * Hook for managing What-If sandbox state
 * @param {Object} options
 * @param {Array} options.baseProjects - Original project data
 * @param {Object} options.baseSlotMap - Original slot map
 */
export const useWhatIfMode = ({ baseProjects = [], baseSlotMap = {}, slotProfile }) => {
    const [isWhatIfMode, setIsWhatIfMode] = useState(false);
    const [whatIfChanges, setWhatIfChanges] = useState([]); // Array of changes
    const [whatIfProjects, setWhatIfProjects] = useState(null); // Modified projects (null = use base)

    /**
     * Enter What-If sandbox mode
     */
    const enterWhatIfMode = useCallback(() => {
        setIsWhatIfMode(true);
        setWhatIfChanges([]);
        setWhatIfProjects([...baseProjects]); // Clone base projects
    }, [baseProjects]);

    /**
     * Exit What-If mode without applying changes
     */
    const discardWhatIfChanges = useCallback(() => {
        setIsWhatIfMode(false);
        setWhatIfChanges([]);
        setWhatIfProjects(null);
    }, []);

    /**
     * Apply a What-If change
     * @param {string} type - Change type from WHATIF_CHANGES
     * @param {Object} payload - Change details
     */
    const applyWhatIfChange = useCallback((type, payload) => {
        if (!isWhatIfMode || !whatIfProjects) return;

        const change = {
            id: `wif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            type,
            payload,
            timestamp: new Date().toISOString()
        };

        setWhatIfChanges(prev => [...prev, change]);

        // Apply change to whatIfProjects
        setWhatIfProjects(prev => {
            const updated = [...prev];
            const projectIdx = updated.findIndex(p => p.id === payload.projectId);

            if (projectIdx === -1) return prev;

            const project = { ...updated[projectIdx] };

            switch (type) {
                case WHATIF_CHANGES.MOVE_PROJECT:
                case WHATIF_CHANGES.CHANGE_DATES:
                    if (payload.kickOff !== undefined) project.kickOff = payload.kickOff;
                    if (payload.start !== undefined) project.start = payload.start;
                    if (payload.launch !== undefined) project.launch = payload.launch;
                    if (payload.end !== undefined) project.end = payload.end;
                    break;

                case WHATIF_CHANGES.CHANGE_SQUAD:
                    project.squads = [payload.newSquad];
                    project.squad = payload.newSquad;
                    break;

                case WHATIF_CHANGES.ADD_RESOURCE:
                    if (!project.team) project.team = { pm: [], sc: [], pd: [] };
                    if (!project.team[payload.role]) project.team[payload.role] = [];
                    project.team[payload.role] = [
                        ...project.team[payload.role],
                        { id: payload.resourceId, name: payload.resourceName }
                    ];
                    break;

                case WHATIF_CHANGES.REMOVE_RESOURCE:
                    if (project.team?.[payload.role]) {
                        project.team[payload.role] = project.team[payload.role]
                            .filter(r => r.id !== payload.resourceId);
                    }
                    break;

                default:
                    break;
            }

            updated[projectIdx] = project;
            return updated;
        });
    }, [isWhatIfMode, whatIfProjects]);

    /**
     * Undo the last What-If change
     */
    const undoWhatIfChange = useCallback(() => {
        if (whatIfChanges.length === 0) return;

        // Remove last change and rebuild from base
        setWhatIfChanges(prev => {
            const newChanges = prev.slice(0, -1);

            // Rebuild whatIfProjects from base + remaining changes
            let rebuilt = [...baseProjects];
            newChanges.forEach(change => {
                const idx = rebuilt.findIndex(p => p.id === change.payload.projectId);
                if (idx === -1) return;

                const project = { ...rebuilt[idx] };
                // Apply same logic as applyWhatIfChange
                switch (change.type) {
                    case WHATIF_CHANGES.MOVE_PROJECT:
                    case WHATIF_CHANGES.CHANGE_DATES:
                        if (change.payload.kickOff !== undefined) project.kickOff = change.payload.kickOff;
                        if (change.payload.launch !== undefined) project.launch = change.payload.launch;
                        break;
                    case WHATIF_CHANGES.CHANGE_SQUAD:
                        project.squads = [change.payload.newSquad];
                        break;
                    default:
                        break;
                }
                rebuilt[idx] = project;
            });

            setWhatIfProjects(rebuilt);
            return newChanges;
        });
    }, [whatIfChanges, baseProjects]);

    /**
     * Calculate impact summary comparing base vs what-if state
     */
    const impactSummary = useMemo(() => {
        if (!isWhatIfMode || !whatIfProjects) {
            return null;
        }

        const summary = {
            totalChanges: whatIfChanges.length,
            projectsModified: new Set(whatIfChanges.map(c => c.payload.projectId)).size,
            datesMoved: whatIfChanges.filter(c =>
                c.type === WHATIF_CHANGES.MOVE_PROJECT || c.type === WHATIF_CHANGES.CHANGE_DATES
            ).length,
            squadChanges: whatIfChanges.filter(c => c.type === WHATIF_CHANGES.CHANGE_SQUAD).length,
            resourceChanges: whatIfChanges.filter(c =>
                c.type === WHATIF_CHANGES.ADD_RESOURCE || c.type === WHATIF_CHANGES.REMOVE_RESOURCE
            ).length,
            // Slot impact would require recalculating slotMap - simplified for now
            changes: whatIfChanges
        };

        return summary;
    }, [isWhatIfMode, whatIfProjects, whatIfChanges]);

    /**
     * Get the effective projects (what-if or base)
     */
    const effectiveProjects = useMemo(() => {
        return isWhatIfMode && whatIfProjects ? whatIfProjects : baseProjects;
    }, [isWhatIfMode, whatIfProjects, baseProjects]);

    /**
     * Generate change list for display
     */
    const changeList = useMemo(() => {
        return whatIfChanges.map(change => {
            const project = baseProjects?.find(p => p.id === change.payload.projectId);
            const projectName = project?.name || 'Unknown';

            let description = '';
            switch (change.type) {
                case WHATIF_CHANGES.MOVE_PROJECT:
                    description = `Move "${projectName}" to ${change.payload.launch || change.payload.kickOff}`;
                    break;
                case WHATIF_CHANGES.CHANGE_SQUAD:
                    description = `Change "${projectName}" squad to ${change.payload.newSquad}`;
                    break;
                case WHATIF_CHANGES.CHANGE_DATES:
                    description = `Change "${projectName}" dates`;
                    break;
                case WHATIF_CHANGES.ADD_RESOURCE:
                    description = `Add ${change.payload.resourceName} to "${projectName}" as ${change.payload.role.toUpperCase()}`;
                    break;
                case WHATIF_CHANGES.REMOVE_RESOURCE:
                    description = `Remove ${change.payload.resourceName} from "${projectName}"`;
                    break;
                default:
                    description = change.type;
            }

            return {
                ...change,
                projectName,
                description
            };
        });
    }, [whatIfChanges, baseProjects]);

    return {
        // State
        isWhatIfMode,
        whatIfChanges,
        effectiveProjects,
        impactSummary,
        changeList,

        // Actions
        enterWhatIfMode,
        discardWhatIfChanges,
        applyWhatIfChange,
        undoWhatIfChange,

        // Helpers
        canUndo: whatIfChanges.length > 0
    };
};

export default useWhatIfMode;
