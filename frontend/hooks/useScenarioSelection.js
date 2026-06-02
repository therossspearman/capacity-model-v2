import { useMemo } from 'react';

/**
 * Hook to handle scenario selection and data merging
 * @param {Array} scenarios - List of scenario records
 * @param {string} activeScenarioId - Currently selected scenario ID
 * @param {Object} settings - Global settings (for field IDs)
 * @returns {Object} Merged data functions and active scenario details
 */
export const useScenarioSelection = (scenarios, activeScenarioId, settings) => {

    // Get the Active Scenario Record
    const activeScenarioRecord = useMemo(() => {
        if (!scenarios || !activeScenarioId) return null;
        return scenarios.find(s => s.id === activeScenarioId);
    }, [scenarios, activeScenarioId]);

    // Parse Changes JSON
    const activeScenarioChanges = useMemo(() => {
        if (!activeScenarioRecord) return { projects: {}, resources: {} };
        return activeScenarioRecord.changes || { projects: {}, resources: {} };
    }, [activeScenarioRecord]);

    // Build Active Scenario Object
    const activeScenario = useMemo(() => {
        if (!activeScenarioRecord) return null;

        // Dynamically calculate total changes to ensure accuracy (fix for stale metadata)
        const changes = activeScenarioChanges;
        const projectChanges = Object.keys(changes.projects || {}).length;
        const resourceChanges = Object.keys(changes.resources || {}).length;
        const financialChanges = (changes.financialAdjustments || []).length;
        const programChanges = (changes.programAssignments || []).length;
        const computedTotalChanges = projectChanges + resourceChanges + financialChanges + programChanges;

        return {
            id: activeScenarioRecord.id,
            name: activeScenarioRecord.name,
            description: activeScenarioRecord.description,
            isActive: activeScenarioRecord.isActive,
            status: activeScenarioRecord.status,
            changes: activeScenarioChanges,
            metadata: {
                ...(activeScenarioRecord.metadata || {}),
                totalChanges: computedTotalChanges // Override with computed value
            },
            isLive: activeScenarioId === 'live'
        };
    }, [activeScenarioRecord, activeScenarioChanges, activeScenarioId]);

    // Merge function for Projects
    const mergeProjects = useMemo(() => {
        return (baseProjects) => {
            if (!activeScenario || activeScenario.isLive) return baseProjects;

            const projectChanges = activeScenarioChanges.projects || {};
            return baseProjects.map(proj => {
                const overrides = projectChanges[proj.id];
                if (!overrides) return proj;

                // Build merged result with proper field derivations
                const merged = { ...proj, ...overrides, _hasScenarioOverride: true };

                // Handle squad → squads derivation (UI relies on squads array for rendering)
                // This mirrors the logic in effectiveProjects for pendingUpdates
                if (overrides.squad !== undefined) {
                    const squadValue = overrides.squad;
                    merged.squad = squadValue === 'Unassigned' || squadValue === '' ? null : squadValue;
                    merged.squads = squadValue === 'Unassigned' || squadValue === '' || !squadValue ? [] : [squadValue];
                }

                // Handle start/end → kickOff/launch aliasing
                if (overrides.start !== undefined) {
                    merged.kickOff = overrides.start;
                }
                if (overrides.end !== undefined) {
                    merged.launch = overrides.end;
                }

                return merged;
            });
        };
    }, [activeScenario, activeScenarioChanges]);

    // Merge function for Resources
    const mergeResources = useMemo(() => {
        return (baseResources) => {
            if (!activeScenario || activeScenario.isLive) return baseResources;

            const resourceChanges = activeScenarioChanges.resources || {};
            return baseResources.map(res => {
                const overrides = resourceChanges[res.id];
                if (!overrides) return res;
                return { ...res, ...overrides, _hasScenarioOverride: true };
            });
        };
    }, [activeScenario, activeScenarioChanges]);

    // Merge function for Program Assignments (stored in scenario changes)
    const mergeProgramAssignments = useMemo(() => {
        return (baseAssignments) => {
            if (!activeScenario || activeScenario.isLive) return baseAssignments;

            // Scenario can have programAssignments overrides - merge with base
            const scenarioAssignments = activeScenarioChanges.programAssignments || [];
            if (scenarioAssignments.length === 0) return baseAssignments;

            // Create a map of base assignments by ID for merging
            const baseMap = new Map((baseAssignments || []).map(a => [a.id, a]));

            // Apply scenario changes: updates/additions override base, deletions remove
            scenarioAssignments.forEach(change => {
                if (change._deleted) {
                    // Mark for deletion
                    baseMap.delete(change.id);
                } else {
                    // Add or update
                    baseMap.set(change.id, { ...baseMap.get(change.id), ...change, _hasScenarioOverride: true });
                }
            });

            return Array.from(baseMap.values());
        };
    }, [activeScenario, activeScenarioChanges]);

    return {
        activeScenario,
        mergeProjects,
        mergeResources,
        mergeProgramAssignments
    };
};

export default useScenarioSelection;
