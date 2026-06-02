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

    async updateRecord(tableIdOrName, recordId, fields) {
        try {
            const table = this.base.getTable(tableIdOrName) || this.base.getTableById(tableIdOrName);
            if (!table) throw new Error(`Table not found: ${tableIdOrName}`);
            await table.updateRecordAsync(recordId, fields);
            return true;
        } catch (error) {
            Logger.error('updateRecord failed:', error);
            throw error;
        }
    }

    async batchUpdateRecords(tableIdOrName, updates) {
        try {
            const table = this.base.getTable(tableIdOrName) || this.base.getTableById(tableIdOrName);
            if (!table) throw new Error(`Table not found: ${tableIdOrName}`);

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
            const table = this.base.getTable(tableIdOrName) || this.base.getTableById(tableIdOrName);
            if (!table) throw new Error(`Table not found: ${tableIdOrName}`);
            return await table.createRecordAsync(fields);
        } catch (error) {
            Logger.error('createRecord failed:', error);
            throw error;
        }
    }

    async deleteRecord(tableIdOrName, recordId) {
        try {
            const table = this.base.getTable(tableIdOrName) || this.base.getTableById(tableIdOrName);
            if (!table) throw new Error(`Table not found: ${tableIdOrName}`);
            await table.deleteRecordAsync(recordId);
            return true;
        } catch (error) {
            Logger.error('deleteRecord failed:', error);
            throw error;
        }
    }
}

export default AirtableService;
