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
 * Pure helper: return a new project object with a single what-if change applied.
 * Used by BOTH applyWhatIfChange and the undo rebuild so they can never drift —
 * previously the undo path re-applied only a subset (no resource add/remove, no
 * start/end dates, no project.squad), silently losing changes on undo. Does not
 * mutate the input project or its nested team arrays.
 */
const applyChangeToProject = (project, type, payload) => {
    const next = { ...project };
    switch (type) {
        case WHATIF_CHANGES.MOVE_PROJECT:
        case WHATIF_CHANGES.CHANGE_DATES:
            if (payload.kickOff !== undefined) next.kickOff = payload.kickOff;
            if (payload.start !== undefined) next.start = payload.start;
            if (payload.launch !== undefined) next.launch = payload.launch;
            if (payload.end !== undefined) next.end = payload.end;
            break;

        case WHATIF_CHANGES.CHANGE_SQUAD:
            next.squads = [payload.newSquad];
            next.squad = payload.newSquad;
            break;

        case WHATIF_CHANGES.ADD_RESOURCE: {
            const team = next.team ? { ...next.team } : { pm: [], sc: [], pd: [] };
            const roleArr = team[payload.role] ? [...team[payload.role]] : [];
            team[payload.role] = [...roleArr, { id: payload.resourceId, name: payload.resourceName }];
            next.team = team;
            break;
        }

        case WHATIF_CHANGES.REMOVE_RESOURCE:
            if (next.team?.[payload.role]) {
                next.team = {
                    ...next.team,
                    [payload.role]: next.team[payload.role].filter(r => r.id !== payload.resourceId)
                };
            }
            break;

        default:
            break;
    }
    return next;
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

            updated[projectIdx] = applyChangeToProject(updated[projectIdx], type, payload);
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
                // Same shared helper as applyWhatIfChange — guarantees undo parity.
                rebuilt[idx] = applyChangeToProject(rebuilt[idx], change.type, change.payload);
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
