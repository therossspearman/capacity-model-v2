// Simple logger to avoid circular dependency with components/ui
const Logger = {
    log: (...args) => console.log('[AirtableService]', ...args),
    debug: (...args) => console.debug('[AirtableService]', ...args),
    warn: (...args) => console.warn('[AirtableService]', ...args),
    error: (...args) => console.error('[AirtableService]', ...args)
};

/**
 * AirtableService - Handles direct data mutations to Airtable
 */
export class AirtableService {
    constructor(base) {
        this.base = base;
    }

    // Resolve a table by name OR id. Uses the non-throwing *IfExists SDK
    // variants — base.getTable/getTableById THROW when not found, which would
    // prevent the name->id fallback and make the "Table not found" guard below
    // unreachable.
    _resolveTable(tableIdOrName) {
        const table = this.base.getTableIfExists(tableIdOrName)
            || this.base.getTableByIdIfExists(tableIdOrName);
        if (!table) throw new Error(`Table not found: ${tableIdOrName}`);
        return table;
    }

    async updateRecord(tableIdOrName, recordId, fields) {
        try {
            const table = this._resolveTable(tableIdOrName);
            await table.updateRecordAsync(recordId, fields);
            return true;
        } catch (error) {
            Logger.error('updateRecord failed:', error);
            throw error;
        }
    }

    async batchUpdateRecords(tableIdOrName, updates) {
        try {
            const table = this._resolveTable(tableIdOrName);

            const BATCH_SIZE = 50;
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const batch = updates.slice(i, i + BATCH_SIZE);
                await table.updateRecordsAsync(batch);
            }
            return true;
        } catch (error) {
            Logger.error('batchUpdateRecords failed:', error);
            throw error;
        }
    }

    async createRecord(tableIdOrName, fields) {
        try {
            const table = this._resolveTable(tableIdOrName);
            return await table.createRecordAsync(fields);
        } catch (error) {
            Logger.error('createRecord failed:', error);
            throw error;
        }
    }

    async deleteRecord(tableIdOrName, recordId) {
        try {
            const table = this._resolveTable(tableIdOrName);
            await table.deleteRecordAsync(recordId);
            return true;
        } catch (error) {
            Logger.error('deleteRecord failed:', error);
            throw error;
        }
    }
}

export default AirtableService;
