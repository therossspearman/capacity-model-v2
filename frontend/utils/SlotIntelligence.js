/**
 * SlotIntelligence - Airtable AI Field Agent Integration
 * Writes slot data to Airtable table for AI-powered analysis
 */

/**
 * Write slot snapshot to Airtable for AI analysis
 * @param {Object} base - Airtable base object
 * @param {string} tableId - Target table ID
 * @param {Object} slotMap - Current slot availability data
 * @param {Object} summary - Utilization summary from getSlotUtilizationSummary
 * @param {Array} insights - Role insights from generateRoleInsights
 * @param {Object} roleConfig - Current role configuration
 * @returns {Promise<Object>} Created record
 */
export const writeSlotSnapshot = async (base, tableId, { slotMap, summary, insights, roleConfig }) => {
    if (!base || !tableId || !slotMap) {
        console.warn('[SlotIntelligence] Missing required parameters:', { base: !!base, tableId, slotMap: !!slotMap });
        return null;
    }

    try {
        const table = base.getTable(tableId);

        // Prepare snapshot data
        const snapshotData = {
            timestamp: new Date().toISOString(),
            squadCount: Object.keys(slotMap).length,
            totalSlots: summary?.totalSlots || 0,
            openSlots: summary?.openSlots || 0,
            partialSlots: summary?.partialSlots || 0,
            fullSlots: summary?.fullSlots || 0,
            utilizationPct: summary?.utilizationPct || 0,
            primaryBottleneck: summary?.primaryBottleneck || 'None',
            hasConstraintIssues: summary?.hasConstraintIssues || false,
            constraintWarnings: (summary?.constraintWarnings || []).map(w => w.warning).join('; '),
            primaryCapacity: summary?.primaryCapacity || {},
            secondaryCapacity: summary?.secondaryCapacity || {},
            flexRatio: summary?.flexRatio || {},
            insightCount: insights?.length || 0,
            roleConfigured: Object.keys(roleConfig?.jobs || {}).length > 0
        };

        // Prepare slot details for AI analysis (limit to next 12 weeks to stay under 100KB)
        const slotDetails = [];
        const maxWeeks = 12; // Limit to avoid hitting 100KB limit

        // Normalize the cutoff to the Monday of the current week so the in-progress
        // week (whose start date is in the past) is still included. Week keys are
        // Monday ISO date strings (e.g. "2026-06-01") which parse as UTC midnight,
        // and SlotOptimizer.getWeekKey builds them with UTC methods — so the cutoff
        // MUST use UTC too, or in negative-offset zones (the Americas) the current
        // week's UTC-midnight key would sort before a local-midnight cutoff and be
        // wrongly excluded.
        const cutoff = new Date();
        const day = cutoff.getUTCDay();
        cutoff.setUTCDate(cutoff.getUTCDate() - day + (day === 0 ? -6 : 1));
        cutoff.setUTCHours(0, 0, 0, 0);

        Object.entries(slotMap).forEach(([squad, weeks]) => {
            // Sort weeks and take only the next 12
            const sortedWeeks = Object.entries(weeks)
                .filter(([week]) => {
                    const wd = new Date(week);
                    return !isNaN(wd.getTime()) && wd >= cutoff;
                })
                .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                .slice(0, maxWeeks);

            sortedWeeks.forEach(([week, data]) => {
                slotDetails.push({
                    sq: squad,              // Abbreviated keys to save space
                    wk: week,
                    sc: Math.round((data.score || 0) * 100) / 100,
                    st: data.state,
                    av: data.availableSlots,
                    bn: data.bottleneck,
                    cw: data.constraintWarning ? 1 : 0,  // Boolean as 1/0
                    pm: Math.round((data.capacity?.pm?.total || 0) * 10) / 10,
                    scc: Math.round((data.capacity?.sc?.total || 0) * 10) / 10,
                    bd: Math.round((data.capacity?.build?.total || 0) * 10) / 10,
                    // Debug: raw capacity and demand
                    pmCap: Math.round((data.capacity?.pm?.rawCap || 0) * 10) / 10,
                    pmDem: Math.round((data.capacity?.pm?.rawDem || 0) * 10) / 10,
                    bdCap: Math.round((data.capacity?.build?.rawCap || 0) * 10) / 10,
                    bdDem: Math.round((data.capacity?.build?.rawDem || 0) * 10) / 10,
                    // Debug: resource counts
                    dbg: data._debug || {}
                });
            });
        });

        // Stringify and truncate if still too large (max ~90KB to be safe)
        let slotDataJson = JSON.stringify(slotDetails);
        if (slotDataJson.length > 90000 && slotDetails.length > 10) {
            // Estimate how many entries fit using the average serialized size, then
            // slice once and stringify once instead of re-serializing the whole
            // array on every loop iteration (avoids O(n^2) work on the main thread).
            const targetSize = 80000;
            const avgEntrySize = slotDataJson.length / slotDetails.length;
            let keepCount = Math.max(10, Math.floor(targetSize / avgEntrySize));
            keepCount = Math.min(keepCount, slotDetails.length);
            let truncated = slotDetails.slice(0, keepCount);
            slotDataJson = JSON.stringify(truncated);
            // The estimate can overshoot; shrink in a few bounded steps if needed.
            while (slotDataJson.length > targetSize && truncated.length > 10) {
                truncated = truncated.slice(0, Math.floor(truncated.length * 0.8));
                slotDataJson = JSON.stringify(truncated);
            }
        }

        // Get available fields from the table
        const availableFields = table.fields.map(f => f.name);

        // Build record dynamically based on available fields
        const recordFields = {};

        // Map our data to field names (try common variations)
        const fieldMappings = {
            'Snapshot Time': snapshotData.timestamp,
            'SnapshotTime': snapshotData.timestamp,
            'Squad Count': snapshotData.squadCount,
            'SquadCount': snapshotData.squadCount,
            'Total Slots': snapshotData.totalSlots,
            'TotalSlots': snapshotData.totalSlots,
            'Open Slots': snapshotData.openSlots,
            'OpenSlots': snapshotData.openSlots,
            'Utilization %': snapshotData.utilizationPct,
            'Utilization': snapshotData.utilizationPct,
            'Primary Bottleneck': snapshotData.primaryBottleneck,
            'Bottleneck': snapshotData.primaryBottleneck,
            'Has Constraints': snapshotData.hasConstraintIssues,
            'Slot Data': slotDataJson,
            'SlotData': slotDataJson,
            'Summary': JSON.stringify(snapshotData),
            'Insights': JSON.stringify(insights || [])
        };

        // Only include fields that exist in the table
        Object.entries(fieldMappings).forEach(([fieldName, value]) => {
            if (availableFields.includes(fieldName)) {
                recordFields[fieldName] = value;
            }
        });


        if (Object.keys(recordFields).length === 0) {
            throw new Error(`No matching fields found. Table has: ${availableFields.join(', ')}`);
        }

        // Write to Airtable - use record creation
        const recordId = await table.createRecordAsync(recordFields);

        return { recordId, snapshotData };
    } catch (error) {
        console.error('[SlotIntelligence] Failed to write snapshot:', error?.message || error);
        console.error('[SlotIntelligence] Error details:', error);
        throw error;
    }
};

/**
 * Read AI recommendations from Airtable
 * @param {Object} base - Airtable base object
 * @param {string} tableId - Source table ID
 * @param {number} limit - Max records to fetch
 * @returns {Promise<Array>} AI-generated recommendations
 */
export const readAIRecommendations = async (base, tableId, limit = 5) => {
    if (!base || !tableId) {
        console.warn('[SlotIntelligence] Missing required parameters');
        return [];
    }

    try {
        const table = base.getTable(tableId);
        // NOTE: Do NOT pass sorts option - the SDK throws "reduce is not a function" when
        // the sort field doesn't exist. Sort client-side instead.
        const query = await table.selectRecordsAsync();

        const recommendations = [];
        // Sort client-side by Snapshot Time (descending)
        const sortedRecords = [...query.records].sort((a, b) => {
            try {
                const dateA = a.getCellValue('Snapshot Time');
                const dateB = b.getCellValue('Snapshot Time');
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return new Date(dateB) - new Date(dateA);
            } catch {
                return 0; // Field doesn't exist
            }
        });
        const records = sortedRecords.slice(0, limit);

        records.forEach(record => {
            // Read AI field values (these are populated by Airtable AI). Guard each
            // read so a missing optional field degrades to '' for that field rather
            // than throwing and aborting the whole read.
            let aiAnalysis = '';
            let aiRecommendations = '';
            let snapshotTime = '';
            try { aiAnalysis = record.getCellValueAsString?.('AI Analysis') || ''; } catch { }
            try { aiRecommendations = record.getCellValueAsString?.('AI Recommendations') || ''; } catch { }
            try { snapshotTime = record.getCellValueAsString?.('Snapshot Time') || ''; } catch { }

            if (aiAnalysis || aiRecommendations) {
                recommendations.push({
                    recordId: record.id,
                    snapshotTime,
                    analysis: aiAnalysis,
                    recommendations: aiRecommendations
                });
            }
        });

        return recommendations;
    } catch (error) {
        console.error('[SlotIntelligence] Failed to read recommendations:', error);
        return [];
    }
};

/**
 * Generate prompt for Airtable AI field
 * Call this to get the prompt text to configure in Airtable
 */
export const getAIFieldPrompts = () => {
    return {
        analysis: `Analyze this capacity slot data:
{Slot Data}

Current summary:
{Summary}

Identify:
1. Which squads have the most open capacity
2. Primary bottleneck roles (PM, SC, or Build)
3. Any constraint violations or team composition issues
4. Trends in capacity utilization
5. Risk areas where capacity is critically low`,

        recommendations: `Based on this analysis:
{AI Analysis}

And these insights:
{Insights}

Provide 3-5 specific, actionable recommendations for:
1. Optimizing team assignments and project scheduling
2. Addressing bottleneck roles (suggest hiring, training, or rebalancing)
3. Resolving constraint violations
4. Improving overall capacity utilization
5. Risk mitigation for overloaded periods

Format each recommendation as a numbered list with clear action items.`
    };
};

export default {
    writeSlotSnapshot,
    readAIRecommendations,
    getAIFieldPrompts
};
