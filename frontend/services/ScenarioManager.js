import { SETTINGS } from '../constants';

// Simple logger to avoid circular dependency with components/ui
const Logger = {
    log: (...args) => console.log('[ScenarioManager]', ...args),
    debug: (...args) => console.debug('[ScenarioManager]', ...args),
    warn: (...args) => console.warn('[ScenarioManager]', ...args),
    error: (...args) => console.error('[ScenarioManager]', ...args)
};

/**
 * ScenarioManager - Handles all scenario CRUD operations
 * Manages persistence of draft scenarios to Airtable
 */
export class ScenarioManager {
    constructor(base, globalConfig, settings) {
        this.base = base;
        this.globalConfig = globalConfig;
        this.settings = settings;
        this.scenariosTable = null;
    }

    async initialize() {
        try {
            const tableId = this.globalConfig.get(SETTINGS.SCENARIOS_TABLE);
            if (!tableId) {
                Logger.error('Scenarios table not configured');
                return false;
            }
            this.scenariosTable = this.base.getTableById(tableId);
            if (!this.scenariosTable) {
                Logger.error('Scenarios table not found:', tableId);
                return false;
            }
            return true;
        } catch (error) {
            Logger.error('Failed to initialize ScenarioManager:', error);
            return false;
        }
    }

    /**
     * Resolve the overflow Changes JSON fields ("Changes JSON 2" / "Changes JSON 3").
     * Prefers explicitly mapped field IDs from globalConfig, falling back to a robust
     * case-insensitive scan of the table's fields by name.
     * Centralizes logic previously duplicated across load/save/validate.
     * @returns {Array} Array of resolved overflow field objects (0-2 entries)
     */
    _getOverflowFields() {
        if (!this.scenariosTable) return [];
        const changes2FieldId = this.globalConfig?.get('fld_scenario_changes_json_2');
        const changes3FieldId = this.globalConfig?.get('fld_scenario_changes_json_3');
        let of2 = changes2FieldId ? this.scenariosTable.getFieldByIdIfExists(changes2FieldId) : null;
        let of3 = changes3FieldId ? this.scenariosTable.getFieldByIdIfExists(changes3FieldId) : null;

        if ((!of2 || !of3) && this.scenariosTable?.fields) {
            for (const f of this.scenariosTable.fields) {
                const fname = f.name.trim().toLowerCase();
                if (!of2 && fname === 'changes json 2') of2 = f;
                if (!of3 && fname === 'changes json 3') of3 = f;
            }
        }
        return [of2, of3].filter(Boolean);
    }

    parseJSON(str) {
        try {
            const parsed = str ? JSON.parse(str) : {};
            // Auto-expand ultra-compact format back to standard
            if (parsed._compactV === 2) {
                return this._expandCompact(parsed);
            }
            return parsed;
        } catch (e) {
            Logger.warn('Failed to parse JSON:', e);
            return {};
        }
    }

    /**
     * Expand ultra-compact format back to standard format.
     * Short keys: s→start, e→end, t→team, sq→squad
     * Team arrays: ["recXXX"] → [{id: "recXXX"}]
     * Output format matches what all consumers expect: {start, end, team, ...} at top level
     */
    _expandCompact(data) {
        const result = {
            projects: {},
            resources: data.resources || {},
            financialAdjustments: data.financialAdjustments || [],
            programAssignments: data.programAssignments || []
        };

        for (const [id, compact] of Object.entries(data.projects || {})) {
            const expanded = {};
            if (compact.s) expanded.start = compact.s;
            if (compact.e) expanded.end = compact.e;
            if (compact.sq) expanded.squad = compact.sq;
            if (compact.t) {
                expanded.team = {};
                for (const role of ['pm', 'sc', 'pd']) {
                    if (compact.t[role]) {
                        expanded.team[role] = compact.t[role].map(r =>
                            typeof r === 'string' ? { id: r } : r
                        );
                    }
                }
            }
            result.projects[id] = expanded;
        }

        return result;
    }


    async loadAllScenarios() {
        try {
            if (!this.scenariosTable) {
                const initialized = await this.initialize();
                if (!initialized) {
                    Logger.warn('Scenarios table not configured - returning empty list');
                    return [];
                }
            }

            // Check if selectRecordsAsync is available (some SDK versions don't have it)
            if (typeof this.scenariosTable.selectRecordsAsync !== 'function') {
                Logger.warn('selectRecordsAsync not available on table - scenarios feature requires standard SDK');
                return [];
            }

            const nameField = this.scenariosTable.getFieldByName('Name');
            const descField = this.scenariosTable.getFieldByName('Description');
            const isActiveField = this.scenariosTable.getFieldByName('Is Active');
            const statusField = this.scenariosTable.getFieldByName('Status');
            const changesField = this.scenariosTable.getFieldByName('Changes JSON');
            const metadataField = this.scenariosTable.getFieldByName('Metadata JSON');

            // Discover overflow fields explicitly mapped first, fallback to robust scanning
            const overflowFields = this._getOverflowFields();

            // NOTE: Do NOT pass fields option - the SDK throws "reduce is not a function" when
            // any field ID is null or malformed. Fetch all fields and access needed ones below.
            const query = await this.scenariosTable.selectRecordsAsync();

            return query.records.map(record => {
                // Concatenate all Changes JSON fields
                let changesJson = record.getCellValueAsString(changesField?.id) || '';
                for (const overflowField of overflowFields) {
                    const overflow = record.getCellValueAsString(overflowField?.id);
                    if (overflow) changesJson += overflow;
                }

                return {
                    id: record.id,
                    name: record.getCellValueAsString(nameField?.id) || 'Untitled',
                    description: record.getCellValueAsString(descField?.id) || '',
                    isActive: record.getCellValue(isActiveField?.id) || false,
                    status: record.getCellValueAsString(statusField?.id) || 'Draft',
                    changes: this.parseJSON(changesJson),
                    metadata: this.parseJSON(record.getCellValueAsString(metadataField?.id))
                };
            });
        } catch (error) {
            Logger.error('Failed to load scenarios:', error);
            return [];
        }
    }

    async createScenario(name, description) {
        try {
            if (!name?.trim()) throw new Error('Name required');
            if (!this.scenariosTable) await this.initialize();

            const nameField = this.scenariosTable.getFieldByName('Name');
            const descField = this.scenariosTable.getFieldByName('Description');
            const isActiveField = this.scenariosTable.getFieldByName('Is Active');
            const statusField = this.scenariosTable.getFieldByName('Status');
            const changesField = this.scenariosTable.getFieldByName('Changes JSON');
            const metadataField = this.scenariosTable.getFieldByName('Metadata JSON');

            return await this.scenariosTable.createRecordAsync({
                [nameField.id]: name,
                [descField.id]: description || '',
                [isActiveField.id]: false,
                [statusField.id]: { name: 'Draft' },
                [changesField.id]: JSON.stringify({ projects: {}, resources: {}, programAssignments: [] }),
                [metadataField.id]: JSON.stringify({ totalChanges: 0, lastSavedAt: new Date().toISOString() })
            });
        } catch (error) {
            Logger.error('Failed to create scenario:', error);
            throw error;
        }
    }

    /**
     * Create a new scenario with initial changes (e.g. from Drag & Drop)
     * @param {string} name - Scenario name
     * @param {Object} changes - Initial changes object
     * @returns {Promise<string>} The new scenario ID
     */
    async handleAddScenario(name, changes) {
        try {
            // 1. Create the scenario record
            const newId = await this.createScenario(name, 'Created from Planning Board');

            // 2. Save the changes immediately
            const metadata = {
                createdAt: new Date().toISOString(),
                lastSavedAt: new Date().toISOString(),
                totalChanges: Object.keys(changes.projects || {}).length + Object.keys(changes.resources || {}).length
            };

            await this.saveScenarioChanges(newId, changes, metadata);

            // 3. Activate the new scenario so subsequent changes aggregate into it
            await this.activateScenario(newId);

            return newId;
        } catch (error) {
            Logger.error('Failed to handle add scenario:', error);
            throw error;
        }
    }

    async activateScenario(scenarioId) {
        try {
            if (!this.scenariosTable) await this.initialize();
            const isActiveField = this.scenariosTable.getFieldByName('Is Active');

            // Deactivate all first
            const all = await this.loadAllScenarios();
            for (const s of all.filter(x => x.isActive)) {
                await this.scenariosTable.updateRecordAsync(s.id, { [isActiveField.id]: false });
            }

            // Activate selected
            await this.scenariosTable.updateRecordAsync(scenarioId, { [isActiveField.id]: true });
            return true;
        } catch (error) {
            Logger.error('Failed to activate scenario:', error);
            throw error;
        }
    }

    async deactivateScenario(scenarioId) {
        try {
            if (!this.scenariosTable) await this.initialize();
            const isActiveField = this.scenariosTable.getFieldByName('Is Active');
            await this.scenariosTable.updateRecordAsync(scenarioId, { [isActiveField.id]: false });
            return true;
        } catch (error) {
            Logger.error('Failed to deactivate scenario:', error);
            throw error;
        }
    }

    async saveScenarioChanges(scenarioId, changes, metadata, expectedVersion = null) {
        try {
            if (!this.scenariosTable) await this.initialize();
            const changesField = this.scenariosTable.getFieldByName('Changes JSON');
            const metadataField = this.scenariosTable.getFieldByName('Metadata JSON');

            // Preserve existing metadata fields (e.g. type, savedBy) that callers may not include.
            // This prevents optimizer scenarios from losing type:'optimizer' during draft auto-saves.
            //
            // CONCURRENCY LIMITATION (read-then-write, not transactional): the existing version is
            // read here via selectRecordsAsync and the incremented version is written later via
            // updateRecordAsync. Airtable offers no compare-and-swap, so two clients can both read
            // version N and both write N+1, silently losing one save. The `expectedVersion` check
            // below narrows the window but cannot eliminate it. There are no awaits between the read
            // and the write below (compaction is synchronous), keeping the window as small as
            // possible. For stronger guarantees, serialize saves through a single queue in the data
            // layer. See review finding "TOCTOU race across concurrent saves".
            let existingVersion = null;
            try {
                const query = await this.scenariosTable.selectRecordsAsync();
                const record = query.records.find(r => r.id === scenarioId);
                if (record) {
                    const existingMetaStr = record.getCellValueAsString(metadataField?.id);
                    if (existingMetaStr) {
                        const existingMeta = JSON.parse(existingMetaStr);
                        existingVersion = existingMeta._version || 0;

                        // Conflict detection: if caller expects a specific version and
                        // Airtable has a newer one, another user saved in the meantime
                        if (expectedVersion !== null && existingVersion > expectedVersion) {
                            Logger.warn(`Conflict detected: expected version ${expectedVersion}, found ${existingVersion}`);
                            return {
                                conflict: true,
                                currentVersion: existingVersion,
                                savedBy: existingMeta._savedBy || 'unknown',
                                savedAt: existingMeta._savedAt || null
                            };
                        }

                        // Merge: new metadata wins, but existing fields like 'type' are preserved
                        metadata = { ...existingMeta, ...metadata };
                    }
                }
            } catch (e) { Logger.warn('Could not read existing metadata for merge:', e.message); }

            // Discover overflow fields explicitly mapped first, fallback to robust scanning
            const overflowFields = this._getOverflowFields();
            const allFields = [changesField, ...overflowFields];
            const CHUNK_SIZE = ScenarioManager.MAX_CHANGES_JSON_LENGTH;
            const totalCapacity = allFields.length * CHUNK_SIZE;

            // Check size before saving
            let changesJson = JSON.stringify(changes);

            // If too large for total capacity, apply progressive compaction
            if (changesJson.length > totalCapacity) {
                Logger.warn(`Changes JSON (${changesJson.length} chars) exceeds capacity (${totalCapacity}), applying compaction...`);

                // Level 1: standard compaction (flatten, filter nulls)
                let compactedChanges = this._compactChanges(changes);
                changesJson = JSON.stringify(compactedChanges);

                // Level 2: drop 'original' values (we can rebuild from live data)
                if (changesJson.length > totalCapacity) {
                    Logger.warn(`Still ${changesJson.length} chars after L1, stripping original values...`);
                    compactedChanges = this._deepStripFields(compactedChanges, ['original']);
                    changesJson = JSON.stringify(compactedChanges);
                }

                // Level 3: drop names, descriptions, and verbose sub-objects
                if (changesJson.length > totalCapacity) {
                    Logger.warn(`Still ${changesJson.length} chars after L2, stripping names/descriptions...`);
                    compactedChanges = this._deepStripFields(compactedChanges, ['name', 'description', 'reasoning', 'schedulingNote']);
                    changesJson = JSON.stringify(compactedChanges);
                }

                // Level 4: ultra-compact — flatten team arrays to plain ID strings,
                // merge 'modified' into top level, drop empty teams
                if (changesJson.length > totalCapacity) {
                    Logger.warn(`Still ${changesJson.length} chars after L3, applying ultra-compact...`);
                    compactedChanges = this._ultraCompact(compactedChanges);
                    changesJson = JSON.stringify(compactedChanges);
                }

                // If still too large after all compaction, throw descriptive error
                if (changesJson.length > totalCapacity) {
                    const projectCount = Object.keys(compactedChanges.projects || {}).length;
                    const resourceCount = Object.keys(compactedChanges.resources || {}).length;
                    throw new Error(
                        `Scenario changes too large (${changesJson.length.toLocaleString()} chars, capacity: ${totalCapacity.toLocaleString()}). ` +
                        `Contains ${projectCount} projects, ${resourceCount} resources. ` +
                        `Commit some changes to Airtable to reduce draft size.`
                    );
                }
                Logger.log(`Compaction successful: ${changesJson.length} chars (${Math.round(changesJson.length / totalCapacity * 100)}% of capacity)`);
                changes = compactedChanges;
            }

            // Stamp version for conflict detection.
            // Clone rather than mutate: on code paths where no existing record/metadata
            // is found, `metadata` is still the caller-supplied object, so writing
            // _version/_savedAt directly would mutate the caller's object as a side effect.
            const nextVersion = (existingVersion || 0) + 1;
            const finalMetadata = {
                ...metadata,
                _version: nextVersion,
                _savedAt: new Date().toISOString()
            };

            // Split across available fields
            const updateData = {
                [metadataField.id]: JSON.stringify(finalMetadata)
            };
            for (let i = 0; i < allFields.length; i++) {
                const chunk = changesJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                updateData[allFields[i].id] = chunk || ''; // Clear unused overflow fields
            }

            await this.scenariosTable.updateRecordAsync(scenarioId, updateData);
            if (allFields.length > 1) {
                Logger.log(`Saved scenario ${scenarioId}: ${changesJson.length} chars across ${Math.ceil(changesJson.length / CHUNK_SIZE)} of ${allFields.length} field(s)`);
            }
            return true;
        } catch (error) {
            Logger.error('Failed to save scenario changes:', error);
            throw error;
        }
    }

    /**
     * Compact changes object to reduce JSON size
     * Removes 'original' values, flattens structure, filters nulls/empty
     * @param {Object} changes - The changes object to compact
     * @returns {Object} Compacted changes
     */
    _compactChanges(changes) {
        const compacted = {
            projects: {},
            resources: {},
            financialAdjustments: changes.financialAdjustments || [],
            programAssignments: changes.programAssignments || []
        };

        // Compact projects - flatten 'changes', but PRESERVE 'original' for revert capability
        for (const [id, data] of Object.entries(changes.projects || {})) {
            const changedFields = data.changes || data;
            const compact = {};

            for (const [key, val] of Object.entries(changedFields)) {
                // Skip 'original' key (preserved separately below)
                // BUT keep null/empty values — they represent intentional "clear field" operations
                if (key === 'original') continue;
                if (val === undefined) continue;
                compact[key] = val;
            }

            // Preserve name for display
            if (data.name && !compact.name) compact.name = data.name;

            // Preserve original values for revert capability
            if (data.original && Object.keys(data.original).length > 0) {
                compact.original = data.original;
            }

            // Only include if there are actual changes
            if (Object.keys(compact).length > 1 || (Object.keys(compact).length === 1 && !compact.name)) {
                compacted.projects[id] = compact;
            }
        }

        // Compact resources similarly
        for (const [id, data] of Object.entries(changes.resources || {})) {
            const changedFields = data.changes || data;
            const compact = {};

            for (const [key, val] of Object.entries(changedFields)) {
                if (key === 'original') continue;
                if (val === undefined) continue;
                compact[key] = val;
            }

            if (data.name && !compact.name) compact.name = data.name;

            // Preserve original values for revert capability
            if (data.original && Object.keys(data.original).length > 0) {
                compact.original = data.original;
            }

            if (Object.keys(compact).length > 1 || (Object.keys(compact).length === 1 && !compact.name)) {
                compacted.resources[id] = compact;
            }
        }

        // Filter out deleted/zeroed financial adjustments
        compacted.financialAdjustments = compacted.financialAdjustments
            .filter(a => a && a.amount !== 0 && a.value !== 0);

        // Filter out deleted program assignments
        compacted.programAssignments = compacted.programAssignments
            .filter(a => a && !a._deleted);

        return compacted;
    }

    /**
     * Recursively strip specified field keys from a nested object.
     * Used for progressive compaction when standard compaction isn't enough.
     * @param {Object} obj - Object to strip fields from
     * @param {string[]} fieldsToStrip - Array of key names to remove
     * @returns {Object} New object without the specified fields
     */
    _deepStripFields(obj, fieldsToStrip) {
        if (Array.isArray(obj)) {
            return obj.map(item => this._deepStripFields(item, fieldsToStrip));
        }
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, val] of Object.entries(obj)) {
                if (fieldsToStrip.includes(key)) continue;
                result[key] = this._deepStripFields(val, fieldsToStrip);
            }
            return result;
        }
        return obj;
    }

    /**
     * Ultra-compact changes for maximum size reduction.
     * - Flattens 'modified' wrapper into top level
     * - Converts team arrays [{id: "rec..."}] → ["rec..."]
     * - Drops empty team roles and empty objects
     * @param {Object} changes - The changes object
     * @returns {Object} Ultra-compacted changes
     */
    _ultraCompact(changes) {
        const result = {
            projects: {},
            resources: {},
            _compactV: 2 // version flag so loading code knows format
        };

        // Preserve non-project/resource data (financial adjustments, etc)
        if (changes.financialAdjustments?.length > 0) {
            result.financialAdjustments = changes.financialAdjustments;
        }
        if (changes.programAssignments?.length > 0) {
            result.programAssignments = changes.programAssignments;
        }

        for (const [id, data] of Object.entries(changes.projects || {})) {
            // Flatten 'modified' into top level, or 'changes', or use data directly
            const src = data.modified || data.changes || data;
            const compact = {};

            // Copy date fields directly
            if (src.start) compact.s = src.start;
            if (src.end) compact.e = src.end;

            // Flatten team arrays: [{id: "rec...", name: "..."}] → ["rec..."]
            const team = src.team || data.team;
            if (team && typeof team === 'object') {
                const t = {};
                for (const role of ['pm', 'sc', 'pd']) {
                    const arr = team[role];
                    if (Array.isArray(arr) && arr.length > 0) {
                        t[role] = arr.map(r => typeof r === 'string' ? r : (r.id || r.resourceId || ''));
                    }
                }
                if (Object.keys(t).length > 0) compact.t = t;
            }

            // Copy squad if present
            if (src.squad || data.squad) compact.sq = src.squad || data.squad;

            // Only include if there are actual fields
            if (Object.keys(compact).length > 0) {
                result.projects[id] = compact;
            }
        }

        for (const [id, data] of Object.entries(changes.resources || {})) {
            const src = data.modified || data.changes || data;
            const compact = {};
            for (const [key, val] of Object.entries(src)) {
                if (key === 'original' || key === 'name' || key === 'description') continue;
                if (val !== undefined && val !== null) compact[key] = val;
            }
            if (Object.keys(compact).length > 0) {
                result.resources[id] = compact;
            }
        }

        return result;
    }

    /**
     * Update the status of a scenario (e.g., to 'Committed')
     * @param {string} scenarioId - The scenario record ID
     * @param {string} status - The new status value
     * @returns {Promise<boolean>} True if successful
     */
    async updateScenarioStatus(scenarioId, status) {
        try {
            if (!this.scenariosTable) await this.initialize();
            const statusField = this.scenariosTable.getFieldByName('Status');

            await this.scenariosTable.updateRecordAsync(scenarioId, {
                [statusField.id]: { name: status }
            });
            Logger.log(`Scenario ${scenarioId} status updated to: ${status}`);
            return true;
        } catch (error) {
            Logger.error('Failed to update scenario status:', error);
            throw error;
        }
    }

    /**
     * Rename a scenario (update name and optionally description)
     * @param {string} scenarioId - The scenario record ID
     * @param {string} newName - The new name
     * @param {string} [newDescription] - Optional new description
     * @returns {Promise<boolean>} True if successful
     */
    async renameScenario(scenarioId, newName, newDescription) {
        try {
            if (!newName?.trim()) throw new Error('Name required');
            if (!this.scenariosTable) await this.initialize();

            const nameField = this.scenariosTable.getFieldByName('Name');
            const descField = this.scenariosTable.getFieldByName('Description');

            const updates = { [nameField.id]: newName.trim() };
            if (newDescription !== undefined) {
                updates[descField.id] = newDescription;
            }

            await this.scenariosTable.updateRecordAsync(scenarioId, updates);
            Logger.log(`Scenario ${scenarioId} renamed to: ${newName}`);
            return true;
        } catch (error) {
            Logger.error('Failed to rename scenario:', error);
            throw error;
        }
    }

    /**
     * Merge changes from source scenario into target scenario
     * Source changes take priority on conflicts (same project/resource changed in both)
     * @param {string} sourceScenarioId - The scenario to merge FROM
     * @param {string} targetScenarioId - The scenario to merge INTO
     * @param {Array} [allScenarios] - Optional pre-loaded scenarios list to avoid network request
     * @returns {Promise<boolean>} True if successful
     */
    async mergeScenarios(sourceScenarioId, targetScenarioId, allScenarios = null) {
        try {
            if (!this.scenariosTable) await this.initialize();

            // Load both scenarios (use provided list if available, otherwise fetch)
            const scenariosList = allScenarios || await this.loadAllScenarios();
            const source = scenariosList.find(s => s.id === sourceScenarioId);
            const target = scenariosList.find(s => s.id === targetScenarioId);

            if (!source || !target) {
                throw new Error('Source or target scenario not found');
            }

            // Merge changes using smart field-level merge (not shallow spread)
            const mergedChanges = this._smartMergeChanges([
                target.changes || {},
                source.changes || {}
            ]);

            // Merge metadata
            const mergedMetadata = {
                ...target.metadata,
                lastSavedAt: new Date().toISOString(),
                mergedFrom: source.name,
                totalChanges: Object.keys(mergedChanges.projects).length +
                    Object.keys(mergedChanges.resources).length +
                    (mergedChanges.financialAdjustments?.length || 0) +
                    (mergedChanges.programAssignments?.length || 0)
            };

            // Save merged changes to target
            await this.saveScenarioChanges(targetScenarioId, mergedChanges, mergedMetadata);

            Logger.log(`Merged scenario "${source.name}" into "${target.name}"`);
            return true;
        } catch (error) {
            Logger.error('Failed to merge scenarios:', error);
            throw error;
        }
    }

    /**
     * Merge changes from two scenarios into a NEW scenario (leaving originals intact)
     * Uses smart merging with deduplication to minimize JSON size
     * @param {string} scenario1Id - First scenario to merge
     * @param {string} scenario2Id - Second scenario to merge
     * @param {string} [newName] - Optional name for the new merged scenario
     * @param {Array} [allScenarios] - Optional pre-loaded scenarios list
     * @returns {Promise<string>} The new scenario ID
     */
    async mergeScenariosToNew(scenario1Id, scenario2Id, newName, allScenarios = null) {
        // Delegate to the multi-merge function for consistency
        return this.mergeMultipleScenariosToNew([scenario1Id, scenario2Id], newName, allScenarios);
    }

    /**
     * Merge changes from multiple source scenarios into a target scenario
     * Later sources take priority on conflicts
     * Uses smart merging with deduplication to minimize JSON size
     * @param {string[]} sourceScenarioIds - Array of scenario IDs to merge FROM (in order)
     * @param {string} targetScenarioId - The scenario to merge INTO
     * @param {Array} [allScenarios] - Optional pre-loaded scenarios list
     * @returns {Promise<boolean>} True if successful
     */
    async mergeMultipleScenarios(sourceScenarioIds, targetScenarioId, allScenarios = null) {
        try {
            if (!this.scenariosTable) await this.initialize();
            if (!sourceScenarioIds || sourceScenarioIds.length === 0) {
                throw new Error('No source scenarios provided');
            }

            const scenariosList = allScenarios || await this.loadAllScenarios();
            const target = scenariosList.find(s => s.id === targetScenarioId);
            const sources = sourceScenarioIds
                .map(id => scenariosList.find(s => s.id === id))
                .filter(Boolean);

            if (!target) {
                throw new Error('Target scenario not found');
            }
            if (sources.length !== sourceScenarioIds.length) {
                throw new Error('One or more source scenarios not found');
            }

            const sourceNames = sources.map(s => s.name);

            // Use smart merge with deduplication (target first, then sources in order)
            const scenarioChanges = [target.changes || {}, ...sources.map(s => s.changes || {})];
            const mergedChanges = this._smartMergeChanges(scenarioChanges);

            // Validate size before proceeding
            const sizeCheck = this._validateChangesSize(mergedChanges);
            if (!sizeCheck.isValid) {
                const projectCount = Object.keys(mergedChanges.projects).length;
                const resourceCount = Object.keys(mergedChanges.resources).length;
                const programCount = mergedChanges.programAssignments.length;

                throw new Error(
                    `Merged scenario is too large to save (${sizeCheck.size.toLocaleString()} chars, ` +
                    `limit is ${sizeCheck.maxSize.toLocaleString()}). ` +
                    `Contains: ${projectCount} projects, ${resourceCount} resources, ${programCount} program assignments. ` +
                    `Try merging fewer scenarios or committing some drafts first.`
                );
            }

            // Warn if approaching limit (>80%)
            if (sizeCheck.percentUsed > 80) {
                Logger.warn(`Merged scenario is ${sizeCheck.percentUsed}% of maximum size (${sizeCheck.size.toLocaleString()} chars)`);
            }

            const mergedMetadata = {
                ...target.metadata,
                lastSavedAt: new Date().toISOString(),
                mergedFrom: [...(target.metadata?.mergedFrom || []), ...sourceNames],
                totalChanges: Object.keys(mergedChanges.projects).length +
                    Object.keys(mergedChanges.resources).length +
                    mergedChanges.financialAdjustments.length +
                    mergedChanges.programAssignments.length
            };

            await this.saveScenarioChanges(targetScenarioId, mergedChanges, mergedMetadata);

            Logger.log(`Merged ${sources.length} scenarios into "${target.name}": ${sourceNames.join(', ')} (${sizeCheck.percentUsed}% of size limit)`);
            return true;
        } catch (error) {
            Logger.error('Failed to merge multiple scenarios:', error);
            throw error;
        }
    }

    /**
     * Maximum character length for Changes JSON field (Airtable limit)
     */
    static MAX_CHANGES_JSON_LENGTH = 95000; // Airtable Long Text field limit is 100,000 chars; 5k safety margin

    /**
     * Smart merge of changes objects with deduplication and consolidation
     * OPTIMIZED: Drops 'original' values, flattens structure, filters nulls
     * @param {Object[]} scenarioChanges - Array of changes objects to merge
     * @returns {Object} Merged and deduplicated changes (minimal size)
     */
    _smartMergeChanges(scenarioChanges) {
        // For projects and resources: later scenarios take priority on conflicts
        // We consolidate to net effective changes only - NO originals stored
        const mergedProjects = {};
        const mergedResources = {};

        // For program assignments: deduplicate by unique key
        const programAssignmentMap = new Map();

        // For financial adjustments: deduplicate by unique key
        const financialAdjustmentMap = new Map();

        for (const changes of scenarioChanges) {
            // Merge projects - FLATTENED structure, no original
            for (const [projectId, projectData] of Object.entries(changes.projects || {})) {
                // Extract only the changed values (from nested .changes or direct)
                const changedFields = projectData.changes || projectData;

                if (mergedProjects[projectId]) {
                    // Merge with existing - later takes priority
                    Object.assign(mergedProjects[projectId], changedFields);
                } else {
                    // First occurrence - copy only changed fields
                    mergedProjects[projectId] = { ...changedFields };
                }

                // Preserve name if available (needed for display)
                if (projectData.name && !mergedProjects[projectId].name) {
                    mergedProjects[projectId].name = projectData.name;
                }
            }

            // Merge resources - same flattened logic
            for (const [resourceId, resourceData] of Object.entries(changes.resources || {})) {
                const changedFields = resourceData.changes || resourceData;

                if (mergedResources[resourceId]) {
                    Object.assign(mergedResources[resourceId], changedFields);
                } else {
                    mergedResources[resourceId] = { ...changedFields };
                }

                if (resourceData.name && !mergedResources[resourceId].name) {
                    mergedResources[resourceId].name = resourceData.name;
                }
            }

            // Deduplicate program assignments by composite key
            for (const assignment of (changes.programAssignments || [])) {
                const key = `${assignment.customer || ''}_${assignment.workstream || ''}_${assignment.resourceId || assignment.resourceName || ''}`;
                programAssignmentMap.set(key, assignment);
            }

            // Deduplicate financial adjustments by composite key
            for (const adj of (changes.financialAdjustments || [])) {
                const key = `${adj.projectId || ''}_${adj.type || ''}_${adj.period || ''}`;
                financialAdjustmentMap.set(key, adj);
            }
        }

        // CLEANUP: Filter undefined and 'original' keys from projects, but keep null/empty (intentional clears)
        for (const [id, data] of Object.entries(mergedProjects)) {
            for (const key of Object.keys(data)) {
                if (key === 'original' || data[key] === undefined) {
                    delete data[key];
                }
            }
            // If only 'name' remains (no actual changes), remove the project entirely
            if (Object.keys(data).length === 0 || (Object.keys(data).length === 1 && data.name)) {
                delete mergedProjects[id];
            }
        }

        // Same cleanup for resources
        for (const [id, data] of Object.entries(mergedResources)) {
            for (const key of Object.keys(data)) {
                if (key === 'original' || data[key] === undefined) {
                    delete data[key];
                }
            }
            if (Object.keys(data).length === 0 || (Object.keys(data).length === 1 && data.name)) {
                delete mergedResources[id];
            }
        }

        // Filter out program assignments where _deleted is true
        const programAssignments = Array.from(programAssignmentMap.values())
            .filter(a => !a._deleted);

        // Filter out zeroed financial adjustments
        const financialAdjustments = Array.from(financialAdjustmentMap.values())
            .filter(a => a.amount !== 0 && a.value !== 0);

        return {
            projects: mergedProjects,
            resources: mergedResources,
            financialAdjustments,
            programAssignments
        };
    }

    /**
     * Detect conflicts between scenarios being merged
     * Returns detailed info about which projects/resources have conflicting changes
     * Includes team allocation conflicts (PM/SC/PD assignments)
     * @param {Object[]} scenarios - Array of scenario objects with changes
     * @returns {Object} { hasConflicts, projects: {}, resources: {}, teamAllocations: {}, summary }
     */
    detectScenarioMergeConflicts(scenarios) {
        const conflicts = {
            hasConflicts: false,
            projects: {},
            resources: {},
            teamAllocations: {},  // New: track team allocation conflicts separately
            summary: []
        };

        // Build maps of all changes per project/resource across scenarios
        const projectChangesMap = new Map(); // projectId -> [{scenarioName, scenarioIdx, changes}]
        const resourceChangesMap = new Map();

        scenarios.forEach((scenario, idx) => {
            const scenarioName = scenario.name || `Scenario ${idx + 1}`;

            // Track project changes
            for (const [projectId, projectData] of Object.entries(scenario.changes?.projects || {})) {
                if (!projectChangesMap.has(projectId)) {
                    projectChangesMap.set(projectId, []);
                }
                const changes = projectData.changes || projectData;
                projectChangesMap.get(projectId).push({
                    scenarioName,
                    scenarioIdx: idx,
                    projectName: changes.name || projectData.name || projectId,
                    changes
                });
            }

            // Track resource changes  
            for (const [resourceId, resourceData] of Object.entries(scenario.changes?.resources || {})) {
                if (!resourceChangesMap.has(resourceId)) {
                    resourceChangesMap.set(resourceId, []);
                }
                const changes = resourceData.changes || resourceData;
                resourceChangesMap.get(resourceId).push({
                    scenarioName,
                    scenarioIdx: idx,
                    resourceName: changes.name || resourceData.name || resourceId,
                    changes
                });
            }
        });

        // Check for projects with changes from multiple scenarios
        for (const [projectId, changesList] of projectChangesMap.entries()) {
            if (changesList.length < 2) continue;

            // Find field-level conflicts
            const fieldConflicts = {};
            const allFields = new Set();
            changesList.forEach(c => Object.keys(c.changes).forEach(f => allFields.add(f)));

            for (const field of allFields) {
                if (field === 'name') continue; // Skip name field

                const valuesFromScenarios = changesList
                    .filter(c => c.changes[field] !== undefined)
                    .map(c => ({ scenario: c.scenarioName, value: c.changes[field] }));

                if (valuesFromScenarios.length >= 2) {
                    // Check if values differ
                    const uniqueValues = new Set(valuesFromScenarios.map(v => JSON.stringify(v.value)));
                    if (uniqueValues.size > 1) {
                        fieldConflicts[field] = valuesFromScenarios;
                        conflicts.hasConflicts = true;
                    }
                }
            }

            if (Object.keys(fieldConflicts).length > 0) {
                const projectName = changesList[0].projectName;
                conflicts.projects[projectId] = {
                    name: projectName,
                    scenarios: changesList.map(c => c.scenarioName),
                    fields: fieldConflicts
                };
                conflicts.summary.push(`Project "${projectName}" modified by ${changesList.length} scenarios with conflicting values`);
            }

            // Check for team allocation conflicts specifically
            const teamChanges = changesList.filter(c => c.changes.team);
            if (teamChanges.length >= 2) {
                const teamConflicts = this._detectTeamAllocationConflicts(teamChanges);
                if (teamConflicts.hasConflicts) {
                    const projectName = changesList[0].projectName;
                    conflicts.teamAllocations[projectId] = {
                        name: projectName,
                        scenarios: teamChanges.map(c => c.scenarioName),
                        roles: teamConflicts.roles
                    };
                    conflicts.hasConflicts = true;
                    conflicts.summary.push(`Project "${projectName}" has conflicting team allocations across ${teamChanges.length} scenarios`);
                }
            }
        }

        // Check for resources with changes from multiple scenarios
        for (const [resourceId, changesList] of resourceChangesMap.entries()) {
            if (changesList.length < 2) continue;

            const fieldConflicts = {};
            const allFields = new Set();
            changesList.forEach(c => Object.keys(c.changes).forEach(f => allFields.add(f)));

            for (const field of allFields) {
                if (field === 'name') continue;

                const valuesFromScenarios = changesList
                    .filter(c => c.changes[field] !== undefined)
                    .map(c => ({ scenario: c.scenarioName, value: c.changes[field] }));

                if (valuesFromScenarios.length >= 2) {
                    const uniqueValues = new Set(valuesFromScenarios.map(v => JSON.stringify(v.value)));
                    if (uniqueValues.size > 1) {
                        fieldConflicts[field] = valuesFromScenarios;
                        conflicts.hasConflicts = true;
                    }
                }
            }

            if (Object.keys(fieldConflicts).length > 0) {
                const resourceName = changesList[0].resourceName;
                conflicts.resources[resourceId] = {
                    name: resourceName,
                    scenarios: changesList.map(c => c.scenarioName),
                    fields: fieldConflicts
                };
                conflicts.summary.push(`Resource "${resourceName}" modified by ${changesList.length} scenarios with conflicting values`);
            }
        }

        return conflicts;
    }

    /**
     * Helper to detect team allocation conflicts between scenarios
     * @param {Array} teamChanges - Array of {scenarioName, changes: {team: {...}}}
     * @returns {Object} { hasConflicts: boolean, roles: { pm: [], sc: [], pd: [] } }
     */
    _detectTeamAllocationConflicts(teamChanges) {
        const result = { hasConflicts: false, roles: {} };
        const roles = ['pm', 'sc', 'pd'];

        for (const role of roles) {
            const allocationsPerScenario = teamChanges
                .filter(c => c.changes.team?.[role] !== undefined)
                .map(c => ({
                    scenario: c.scenarioName,
                    allocations: c.changes.team[role] || []
                }));

            if (allocationsPerScenario.length >= 2) {
                // Normalize for comparison: sort by resourceId and compare
                const normalized = allocationsPerScenario.map(a => {
                    const sorted = [...a.allocations].sort((x, y) =>
                        (x.resourceId || x.name || '').localeCompare(y.resourceId || y.name || '')
                    );
                    return { scenario: a.scenario, key: JSON.stringify(sorted), allocations: a.allocations };
                });

                const uniqueKeys = new Set(normalized.map(n => n.key));
                if (uniqueKeys.size > 1) {
                    result.hasConflicts = true;
                    result.roles[role] = normalized.map(n => ({
                        scenario: n.scenario,
                        resources: n.allocations.map(a => a.name || a.resourceName || a.resourceId || 'Unknown')
                    }));
                }
            }
        }

        return result;
    }

    /**
     * Check if changes JSON would exceed Airtable's character limit
     * Accounts for multi-field chaining (up to 3 fields)
     * @param {Object} changes - The changes object
     * @returns {{ isValid: boolean, size: number, maxSize: number }} Validation result
     */
    _validateChangesSize(changes) {
        const json = JSON.stringify(changes);
        const size = json.length;
        // Discover how many fields are available
        let fieldCount = 1;

        if (this.scenariosTable) {
            fieldCount += this._getOverflowFields().length;
        }
        const maxSize = ScenarioManager.MAX_CHANGES_JSON_LENGTH * fieldCount;

        return {
            isValid: size <= maxSize,
            size,
            maxSize,
            percentUsed: Math.round((size / maxSize) * 100)
        };
    }

    /**
     * Merge changes from multiple scenarios into a NEW scenario
     * Later scenarios in the array take priority on conflicts
     * Uses smart merging with deduplication to minimize JSON size
     * @param {string[]} scenarioIds - Array of scenario IDs to merge (in order of priority)
     * @param {string} [newName] - Optional name for the new merged scenario
     * @param {Array} [allScenarios] - Optional pre-loaded scenarios list
     * @returns {Promise<string>} The new scenario ID
     */
    async mergeMultipleScenariosToNew(scenarioIds, newName, allScenarios = null) {
        try {
            if (!this.scenariosTable) await this.initialize();
            if (!scenarioIds || scenarioIds.length < 2) {
                throw new Error('Need at least 2 scenarios to merge');
            }

            const scenariosList = allScenarios || await this.loadAllScenarios();
            const scenarios = scenarioIds
                .map(id => scenariosList.find(s => s.id === id))
                .filter(Boolean);

            if (scenarios.length !== scenarioIds.length) {
                throw new Error('One or more scenarios not found');
            }

            const names = scenarios.map(s => s.name);

            // Use smart merge with deduplication
            const scenarioChanges = scenarios.map(s => s.changes || {});
            const mergedChanges = this._smartMergeChanges(scenarioChanges);

            // Validate size before proceeding
            const sizeCheck = this._validateChangesSize(mergedChanges);
            if (!sizeCheck.isValid) {
                const projectCount = Object.keys(mergedChanges.projects).length;
                const resourceCount = Object.keys(mergedChanges.resources).length;
                const programCount = mergedChanges.programAssignments.length;

                throw new Error(
                    `Merged scenario is too large to save (${sizeCheck.size.toLocaleString()} chars, ` +
                    `limit is ${sizeCheck.maxSize.toLocaleString()}). ` +
                    `Contains: ${projectCount} projects, ${resourceCount} resources, ${programCount} program assignments. ` +
                    `Try merging fewer scenarios or committing some drafts first.`
                );
            }

            // Warn if approaching limit (>80%)
            if (sizeCheck.percentUsed > 80) {
                Logger.warn(`Merged scenario is ${sizeCheck.percentUsed}% of maximum size (${sizeCheck.size.toLocaleString()} chars)`);
            }

            // Create new scenario name
            const mergedName = newName || names.join(' + ');

            // Create the new scenario
            const newId = await this.createScenario(mergedName, `Merged from ${names.length} scenarios: ${names.join(', ')}`);

            const mergedMetadata = {
                createdAt: new Date().toISOString(),
                lastSavedAt: new Date().toISOString(),
                mergedFrom: names,
                totalChanges: Object.keys(mergedChanges.projects).length +
                    Object.keys(mergedChanges.resources).length +
                    mergedChanges.financialAdjustments.length +
                    mergedChanges.programAssignments.length
            };

            await this.saveScenarioChanges(newId, mergedChanges, mergedMetadata);

            Logger.log(`Created merged scenario "${mergedName}" from ${names.length} scenarios (${sizeCheck.percentUsed}% of size limit)`);
            return newId;
        } catch (error) {
            Logger.error('Failed to merge multiple scenarios to new:', error);
            throw error;
        }
    }

    async deleteScenario(scenarioId) {
        try {
            if (!this.scenariosTable) await this.initialize();
            await this.scenariosTable.deleteRecordAsync(scenarioId);
            return true;
        } catch (error) {
            Logger.error('Failed to delete scenario:', error);
            throw error;
        }
    }

    /**
     * Detect conflicts between draft scenario changes and current database state
     * @param {Object} draftChanges - The scenario's saved changes { projects: {}, resources: {} }
     * @param {Array} currentProjects - Current project data from Airtable
     * @param {Array} currentResources - Current resource data from Airtable
     * @returns {Object} { projects: {}, resources: {}, hasConflicts: boolean }
     */
    detectConflicts(draftChanges, currentProjects, currentResources) {
        // Enhanced normalize function that handles dates, quotes, and time components
        const normalize = (val) => {
            if (val == null) return '';
            let str = String(val).trim();

            // Try JSON.parse for quoted strings
            try {
                const parsed = JSON.parse(str);
                if (typeof parsed === 'string') str = parsed;
            } catch (e) { /* ignore */ }

            // Strip outer quotes
            while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
                str = str.slice(1, -1);
            }

            // Normalize any date-like string to YYYY-MM-DD (strip time/timezone)
            // Matches: 2026-02-01, 2026-02-01T00:00:00.000Z, 2026-02-01T12:30:00+00:00, etc.
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                return str.substring(0, 10); // Just take YYYY-MM-DD, ignore time
            }
            return str.toLowerCase();
        };
        const conflicts = { projects: {}, resources: {}, hasConflicts: false };

        // Check project conflicts
        for (const [projectId, draftData] of Object.entries(draftChanges.projects || {})) {
            const currentProject = currentProjects.find(p => p.id === projectId);

            if (!currentProject) {
                // Project was deleted from database
                conflicts.projects[projectId] = {
                    deleted: true,
                    name: draftData.name || projectId,
                    fields: {}
                };
                conflicts.hasConflicts = true;
                continue;
            }

            const fieldConflicts = {};
            const original = draftData.original || {};
            const changes = draftData.changes || draftData;

            // Check each field that has an original value captured
            for (const [field, originalValue] of Object.entries(original)) {
                const currentValue = currentProject[field];
                const draftValue = changes[field];

                // Skip if draft value equals current — no real conflict from user's perspective
                if (normalize(currentValue) === normalize(draftValue)) continue;

                // If current database value differs from what we originally captured, there's a conflict
                if (normalize(currentValue) !== normalize(originalValue)) {
                    fieldConflicts[field] = {
                        original: originalValue,
                        current: currentValue,
                        draft: draftValue,
                        resolution: 'current' // Default to keeping current database value
                    };
                    conflicts.hasConflicts = true;
                }
            }

            if (Object.keys(fieldConflicts).length > 0) {
                conflicts.projects[projectId] = {
                    name: currentProject.name || draftData.name,
                    fields: fieldConflicts,
                    allChanges: changes
                };
            }

            // Check team allocation conflicts
            if (changes.team) {
                const teamConflicts = this._detectTeamVsDatabaseConflicts(
                    original.team,
                    currentProject.team,
                    changes.team
                );
                if (teamConflicts.hasConflicts) {
                    if (!conflicts.projects[projectId]) {
                        conflicts.projects[projectId] = {
                            name: currentProject.name || draftData.name,
                            fields: {},
                            allChanges: changes
                        };
                    }
                    conflicts.projects[projectId].teamConflicts = teamConflicts.roles;
                    conflicts.hasConflicts = true;
                }
            }
        }

        // Check resource conflicts
        for (const [resourceId, draftData] of Object.entries(draftChanges.resources || {})) {
            const currentResource = currentResources.find(r => r.id === resourceId);

            if (!currentResource) {
                // Resource was deleted from database
                conflicts.resources[resourceId] = {
                    deleted: true,
                    name: draftData.name || resourceId,
                    fields: {}
                };
                conflicts.hasConflicts = true;
                continue;
            }

            const fieldConflicts = {};
            const original = draftData.original || {};
            const changes = draftData.changes || draftData;

            for (const [field, originalValue] of Object.entries(original)) {
                const currentValue = currentResource[field];
                const draftValue = changes[field];

                // Skip if draft value equals current — no real conflict
                if (normalize(currentValue) === normalize(draftValue)) continue;

                if (normalize(currentValue) !== normalize(originalValue)) {
                    fieldConflicts[field] = {
                        original: originalValue,
                        current: currentValue,
                        draft: draftValue,
                        resolution: 'current'
                    };
                    conflicts.hasConflicts = true;
                }
            }

            if (Object.keys(fieldConflicts).length > 0) {
                conflicts.resources[resourceId] = {
                    name: currentResource.name || draftData.name,
                    fields: fieldConflicts,
                    allChanges: changes
                };
            }
        }

        return conflicts;
    }

    /**
     * Helper to detect team allocation conflicts between draft and current database
     * @param {Object} originalTeam - Team state when draft was created
     * @param {Object} currentTeam - Current team state in database
     * @param {Object} draftTeam - Draft's proposed team changes
     * @returns {Object} { hasConflicts: boolean, roles: {} }
     */
    _detectTeamVsDatabaseConflicts(originalTeam, currentTeam, draftTeam) {
        const result = { hasConflicts: false, roles: {} };
        const roles = ['pm', 'sc', 'pd'];

        const normalizeTeamRole = (arr) => {
            if (!arr || !Array.isArray(arr)) return '[]';
            const sorted = [...arr].sort((a, b) =>
                (a.resourceId || a.name || '').localeCompare(b.resourceId || b.name || '')
            );
            return JSON.stringify(sorted.map(a => ({
                resourceId: a.resourceId || a.id,
                percentage: a.percentage || a.pct || 100
            })));
        };

        for (const role of roles) {
            const originalNorm = normalizeTeamRole(originalTeam?.[role]);
            const currentNorm = normalizeTeamRole(currentTeam?.[role]);
            const draftNorm = normalizeTeamRole(draftTeam?.[role]);

            // Conflict: database changed since draft was created, AND draft also has changes
            // BUT skip if draft matches current — no real conflict
            if (originalNorm !== currentNorm && draftTeam?.[role] !== undefined && draftNorm !== currentNorm) {
                result.hasConflicts = true;
                result.roles[role] = {
                    original: originalTeam?.[role] || [],
                    current: currentTeam?.[role] || [],
                    draft: draftTeam?.[role] || [],
                    resolution: 'current'  // Default to keeping database state
                };
            }
        }

        return result;
    }

    /**
     * Check if a draft scenario is stale (>6 months old)
     * @param {Object} scenario - The scenario object with metadata
     * @returns {boolean} True if stale
     */
    isDraftStale(scenario) {
        const lastSaved = scenario.metadata?.lastSavedAt;
        if (!lastSaved) return false;

        const savedDate = new Date(lastSaved);
        const now = new Date();
        // Use calendar month difference for accurate 6-month check
        const monthDiff = (now.getFullYear() - savedDate.getFullYear()) * 12 + (now.getMonth() - savedDate.getMonth());
        return monthDiff >= 6;
    }

    /**
     * Get a human-readable diff of scenario changes
     * @param {Object} scenario - The scenario with changes
     * @returns {Object} { projects: [], resources: [] }
     */
    getScenarioDiff(scenario) {
        const diff = { projects: [], resources: [], programAssignments: [] };
        if (!scenario?.changes) return diff;

        for (const [projectId, projectData] of Object.entries(scenario.changes.projects || {})) {
            const innerData = projectData.changes || projectData;
            const changes = innerData.changes || innerData;
            const originals = innerData.original || projectData.original || {};
            const projectName = innerData.name || projectData.name || projectId;

            const projectDiff = { id: projectId, name: projectName, changes: [] };
            if (changes.kickOff) projectDiff.changes.push({ field: 'Kick-off', value: changes.kickOff, original: originals.kickOff || null });
            if (changes.launch) projectDiff.changes.push({ field: 'Launch', value: changes.launch, original: originals.launch || null });
            if (changes.status) projectDiff.changes.push({ field: 'Status', value: changes.status, original: originals.status || null });
            if (changes.squad) projectDiff.changes.push({ field: 'Squad', value: changes.squad, original: originals.squad || null });
            if (changes.effortProfile) projectDiff.changes.push({ field: 'Effort Profile', value: changes.effortProfile, original: originals.effortProfile || null });
            if (changes.wave) projectDiff.changes.push({ field: 'Wave', value: changes.wave, original: originals.wave || null });
            if (changes.resourcingOverride !== undefined) projectDiff.changes.push({ field: 'Resourcing Override', value: changes.resourcingOverride, original: originals.resourcingOverride ?? null });
            if (changes.lockLaunch !== undefined) projectDiff.changes.push({ field: 'Lock Launch', value: changes.lockLaunch ? 'Locked' : 'Unlocked', original: originals.lockLaunch ? 'Locked' : 'Unlocked' });
            if (changes.lockSquad !== undefined) projectDiff.changes.push({ field: 'Lock Squad', value: changes.lockSquad ? 'Locked' : 'Unlocked', original: originals.lockSquad ? 'Locked' : 'Unlocked' });
            if (changes.lockResources !== undefined) projectDiff.changes.push({ field: 'Lock Resources', value: changes.lockResources ? 'Locked' : 'Unlocked', original: originals.lockResources ? 'Locked' : 'Unlocked' });
            if (changes.resourcedWithinProgram !== undefined) projectDiff.changes.push({ field: 'Resourced Within Program', value: changes.resourcedWithinProgram ? 'Yes' : 'No', original: originals.resourcedWithinProgram ? 'Yes' : 'No' });

            // Team allocation changes
            if (changes.team) {
                const teamChanges = this._formatTeamChangesForDiff(changes.team, originals.team);
                if (teamChanges.length > 0) {
                    projectDiff.changes.push(...teamChanges);
                }
            }

            if (projectDiff.changes.length > 0) diff.projects.push(projectDiff);
        }

        for (const [resourceId, resourceData] of Object.entries(scenario.changes.resources || {})) {
            const innerData = resourceData.changes || resourceData;
            const changes = innerData.changes || innerData;
            const originals = innerData.original || resourceData.original || {};
            const resourceName = innerData.name || resourceData.name || resourceId;

            const resourceDiff = { id: resourceId, name: resourceName, changes: [] };
            if (changes.startDate) resourceDiff.changes.push({ field: 'Start Date', value: changes.startDate, original: originals.startDate || null });
            if (changes.leaveDate) resourceDiff.changes.push({ field: 'Termination Date', value: changes.leaveDate, original: originals.leaveDate || null });
            if (changes.squad) resourceDiff.changes.push({ field: 'Squad', value: changes.squad, original: originals.squad || null });
            if (changes.rampProfile) resourceDiff.changes.push({ field: 'Ramp Profile', value: changes.rampProfile, original: originals.rampProfile || null });

            if (resourceDiff.changes.length > 0) diff.resources.push(resourceDiff);
        }

        // Program Assignment changes
        for (const assignment of (scenario.changes.programAssignments || [])) {
            if (assignment._deleted) {
                diff.programAssignments.push({
                    type: 'removed',
                    customer: assignment.customer,
                    workstream: assignment.workstream,
                    resourceName: assignment.resourceName || 'Unknown'
                });
            } else if (assignment._isNew) {
                diff.programAssignments.push({
                    type: 'added',
                    customer: assignment.customer,
                    workstream: assignment.workstream,
                    resourceName: assignment.resourceName || 'Unknown',
                    allocationPct: assignment.allocationPct
                });
            } else {
                diff.programAssignments.push({
                    type: 'modified',
                    customer: assignment.customer,
                    workstream: assignment.workstream,
                    resourceName: assignment.resourceName || 'Unknown',
                    changes: assignment
                });
            }
        }

        return diff;
    }

    /**
     * Format team allocation changes for diff display
     * @param {Object} teamChanges - The team changes { pm: [], sc: [], pd: [] }
     * @param {Object} originalTeam - The original team state
     * @returns {Array} Array of change objects for display
     */
    _formatTeamChangesForDiff(teamChanges, originalTeam) {
        const changes = [];
        const roles = ['pm', 'sc', 'pd'];
        const roleLabels = { pm: 'PM Assignments', sc: 'SC Assignments', pd: 'PD Assignments' };

        for (const role of roles) {
            if (teamChanges[role] !== undefined) {
                const newAssignments = teamChanges[role] || [];
                const oldAssignments = originalTeam?.[role] || [];

                const formatAssignment = (a) => {
                    const name = a.name || a.resourceName || 'Unknown';
                    const pct = a.percentage || a.pct || 100;
                    return `${name} (${pct}%)`;
                };

                changes.push({
                    field: roleLabels[role],
                    value: newAssignments.length > 0
                        ? newAssignments.map(formatAssignment).join(', ')
                        : '(none)',
                    original: oldAssignments.length > 0
                        ? oldAssignments.map(formatAssignment).join(', ')
                        : '(none)',
                    isTeamChange: true
                });
            }
        }

        return changes;
    }
}

export default ScenarioManager;
