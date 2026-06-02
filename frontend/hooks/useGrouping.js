import { useMemo } from 'react';

export const useGrouping = ({ filteredResources, filteredProjects, enabledSquads, statusFilter, groupBy, forecastMode }) => {
    return useMemo(() => {
        const groupedResourceData = {};
        const groupStats = {};

        // Guard against undefined arrays
        const resources = filteredResources || [];
        const projects = filteredProjects || [];
        const squads = enabledSquads || [];
        const activeStatuses = statusFilter || [];

        // Resource Grouping
        resources.forEach(r => {
            // Guard against undefined squads
            const rSquads = r.squads || [r.squad || 'Unassigned'];

            // Compute this resource's total cap/dem once (doesn't change per squad).
            let rCap = r.totals ? r.totals.cap : 0;
            let rDem = 0;
            if (r.totals) {
                if (forecastMode === 'eac') rDem = r.totals.dem_eac;
                else if (forecastMode === 'impact') rDem = r.totals.dem_imp;
                else rDem = r.totals.dem;
            }
            if (r.totals === undefined && r.buckets) {
                Object.values(r.buckets).forEach(b => {
                    if (!b) return;
                    rCap += b.cap || 0;
                    if (forecastMode === 'eac') rDem += (b.dem_eac || 0);
                    else if (forecastMode === 'impact') rDem += (b.dem_imp || 0);
                    else rDem += (b.dem || 0);
                });
            }

            // Count how many DISTINCT groups this resource belongs to after the squad filter.
            // Someone in two squads appears once in each squad's list (that's right — operational
            // view) but their capacity/demand totals are split pro-rata across those groups so
            // summing the squad headers equals the actual team capacity, not 2× the person.
            const groupKeysForResource = new Set();
            rSquads.forEach(squad => {
                if (squads.length === 0 || squads.includes(squad)) {
                    const groupKey = groupBy === 'role' ? (r.role || 'Unassigned') : squad;
                    groupKeysForResource.add(groupKey);
                }
            });
            const groupCount = groupKeysForResource.size || 1;
            const capShare = rCap / groupCount;
            const demShare = rDem / groupCount;

            rSquads.forEach(squad => {
                if (squads.length === 0 || squads.includes(squad)) {
                    const groupKey = groupBy === 'role' ? (r.role || 'Unassigned') : squad;
                    const subGroupKey = groupBy === 'role' ? squad : (r.role || 'Unassigned');

                    if (!groupedResourceData[groupKey]) groupedResourceData[groupKey] = {};
                    if (!groupedResourceData[groupKey][subGroupKey]) groupedResourceData[groupKey][subGroupKey] = [];

                    groupedResourceData[groupKey][subGroupKey].push({
                        ...r,
                        uniqueKey: `${squad}-${r.id}`,
                        // Share of this resource's capacity attributed to THIS group — the
                        // squad-level weekly util row multiplies by it so dual-squad people
                        // don't double-count in the per-week aggregate either. Individual
                        // resource rows ignore _groupShare and show the full bucket values.
                        _groupShare: 1 / groupCount,
                        metricHash: `${Math.round(rCap)}_${Math.round(rDem)}_${r.name}_${r.status || ''}`
                    });

                    if (!groupStats[groupKey]) groupStats[groupKey] = { cap: 0, dem: 0, count: 0 };
                    groupStats[groupKey].count++;
                    groupStats[groupKey].cap += capShare;
                    groupStats[groupKey].dem += demShare;
                }
            });
        });

        // Project Grouping
        const groupedProjectData = {};
        projects.forEach(p => {
            // Filter out closed/cancelled/completed projects from all views
            const statusLower = (p.status || '').toLowerCase();
            if (statusLower === 'closed' || statusLower === 'cancelled' || statusLower === 'completed') return;

            // Apply status view filter (if any statuses are selected, only show matching)
            if (activeStatuses.length > 0 && !activeStatuses.includes(p.status)) return;

            let groupKey;

            if (groupBy === 'country') {
                groupKey = p.country || 'Unknown';
                const subGroupKey = 'Projects';
                if (!groupedProjectData[groupKey]) groupedProjectData[groupKey] = {};
                if (!groupedProjectData[groupKey][subGroupKey]) groupedProjectData[groupKey][subGroupKey] = [];
                groupedProjectData[groupKey][subGroupKey].push({ ...p, uniqueKey: p.id });

                // Track Stats
                if (!groupStats[groupKey]) groupStats[groupKey] = { cap: 0, dem: 0, count: 0 };
                groupStats[groupKey].count++;

            } else if (groupBy === 'customer') {
                groupKey = p.customer || 'No Customer';
                const subGroupKey = p.wave || 'No Wave';
                if (!groupedProjectData[groupKey]) groupedProjectData[groupKey] = {};
                if (!groupedProjectData[groupKey][subGroupKey]) groupedProjectData[groupKey][subGroupKey] = [];
                groupedProjectData[groupKey][subGroupKey].push({ ...p, uniqueKey: p.id });

                // Track Stats
                if (!groupStats[groupKey]) groupStats[groupKey] = { cap: 0, dem: 0, count: 0 };
                groupStats[groupKey].count++;

            } else {
                if (p.squads && p.squads.length > 0) {
                    p.squads.forEach(squad => {
                        if (enabledSquads.length === 0 || enabledSquads.includes(squad)) {
                            if (!groupedProjectData[squad]) groupedProjectData[squad] = {};
                            const statusGroup = p.status || 'Active';
                            if (!groupedProjectData[squad][statusGroup]) groupedProjectData[squad][statusGroup] = [];
                            groupedProjectData[squad][statusGroup].push({ ...p, uniqueKey: `${p.id}-${squad}` });

                            // Track Stats
                            if (!groupStats[squad]) groupStats[squad] = { cap: 0, dem: 0, count: 0 };
                            groupStats[squad].count++;
                        }
                    });
                } else {
                    const noSquadKey = 'No Squad';
                    // Filter out closed projects from No Squad view
                    const statusGroup = p.status || 'Active';
                    if (statusGroup.toLowerCase() === 'closed') return;

                    if (enabledSquads.length === 0 || enabledSquads.includes(noSquadKey)) {
                        if (!groupedProjectData[noSquadKey]) groupedProjectData[noSquadKey] = {};
                        if (!groupedProjectData[noSquadKey][statusGroup]) groupedProjectData[noSquadKey][statusGroup] = [];
                        groupedProjectData[noSquadKey][statusGroup].push({ ...p, uniqueKey: `${p.id}-nosquad` });

                        // Track Stats
                        if (!groupStats[noSquadKey]) groupStats[noSquadKey] = { cap: 0, dem: 0, count: 0 };
                        groupStats[noSquadKey].count++;
                    }
                }
            }
        });

        return { groupedResourceData, groupedProjectData, groupStats };

    }, [filteredResources, filteredProjects, enabledSquads, statusFilter, groupBy, forecastMode]);
};
