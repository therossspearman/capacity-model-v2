import { FieldType } from '@airtable/blocks/interface/models';
import { TIME_CONSTANTS } from '../constants';

/**
 * Resolves a field ID from a settings value
 * @param {string|Object|null} settingVal - Field setting value
 * @returns {string|null} Resolved field ID
 */
export const resolveFieldId = (settingVal) => {
    if (!settingVal) return null;
    if (typeof settingVal === 'object') return settingVal?.id || null;
    return settingVal;
};

/**
 * @typedef {Object} CellValueOptions
 * @property {'safe'|'string'|'number'|'date'|'squads'} type - Value type
 * @property {Object} [table] - Airtable table reference
 * @property {boolean} [isTimeField] - Whether field is time-based
 * @property {*} [defaultValue] - Default value if null
 */

/**
 * Unified cell value helper for Airtable records
 * @param {Object} record - Airtable record
 * @param {string} fieldId - Field ID
 * @param {CellValueOptions} options - Options
 * @returns {*} Extracted value
 */
export const getCellValue = (record, fieldId, options = {}) => {
    const {
        type = 'safe',
        table = null,
        isTimeField = false,
        defaultValue = null
    } = options;

    if (!record || !fieldId) return defaultValue;

    const safeId = resolveFieldId(fieldId);
    if (!safeId) return defaultValue;

    const rawValue = type === 'string'
        ? record.getCellValueAsString(safeId)
        : record.getCellValue(safeId);

    if (rawValue === null || rawValue === undefined) return defaultValue;

    switch (type) {
        case 'string':
            return rawValue;

        case 'date': {
            const val = Array.isArray(rawValue) ? rawValue[0] : rawValue;
            return val ? new Date(val) : defaultValue;
        }

        case 'number': {
            let numValue = Array.isArray(rawValue)
                ? rawValue.reduce((acc, v) => acc + (Number(v) || 0), 0)
                : Number(rawValue) || 0;

            if (isNaN(numValue)) return 0;

            if (isTimeField) return numValue / TIME_CONSTANTS.SECONDS_PER_HOUR;

            // Table is only required to detect DURATION fields; without it,
            // return the plain numeric value rather than short-circuiting to 0.
            if (table) {
                const field = table.getFieldByIdIfExists(safeId);
                if (field && (field.type === FieldType.DURATION || field.options?.result?.type === FieldType.DURATION)) {
                    return numValue / TIME_CONSTANTS.SECONDS_PER_HOUR;
                }
            }

            return numValue;
        }

        case 'squads': {
            if (!rawValue) return ['Unassigned'];

            let rawList = [];
            if (Array.isArray(rawValue)) {
                rawList = rawValue.map(item => (typeof item === 'object' && item.name) ? item.name : item);
            } else if (typeof rawValue === 'string') {
                rawList = rawValue.split(',');
            } else if (typeof rawValue === 'object') {
                rawList = [rawValue.name || 'Unassigned'];
            }

            const cleaned = rawList.filter(Boolean).map(s => String(s).trim()).filter(s => s !== '');
            return cleaned.length > 0 ? cleaned : ['Unassigned'];
        }

        case 'safe':
        default:
            return rawValue;
    }
};

// Legacy compatibility wrappers
export const getSafeCellValue = (record, fieldId) => getCellValue(record, fieldId, { type: 'safe' });
export const getStringValue = (record, fieldId) => getCellValue(record, fieldId, { type: 'string' });
export const getDateValue = (record, fieldId) => getCellValue(record, fieldId, { type: 'date' });
export const getNumericValue = (record, fieldId, table, options = {}) => getCellValue(record, fieldId, { type: 'number', table, ...options });
export const getSquadsList = (record, fieldId) => getCellValue(record, fieldId, { type: 'squads', defaultValue: ['Unassigned'] });

/**
 * Read a date-bearing field that may hold MULTIPLE values (e.g. a lookup/rollup of
 * absence records from the HR sync) and return a flat list of raw date values.
 * Single-value fields return a 1-element list; empty returns [].
 * Each element is normalised to a primitive the caller can pass to `new Date(...)`.
 */
export const getDateList = (record, fieldId) => {
    const safeId = resolveFieldId(fieldId);
    if (!record || !safeId) return [];
    const raw = record.getCellValue(safeId);
    if (raw === null || raw === undefined) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
        .map(v => {
            if (v === null || v === undefined) return null;
            // Lookup values can arrive as { value } / { name }; dates as ISO strings or numbers.
            if (typeof v === 'object') return v.value ?? v.name ?? null;
            return v;
        })
        .filter(v => v !== null && v !== undefined);
};

/**
 * Parse paired multi-value leave start/end fields into discrete leave periods.
 * The two lookups can return values in different orders, so both lists are sorted
 * ascending and zipped — valid for the non-overlapping, chronological leave windows
 * the HR system produces. Returns [{ start: ISO, end: ISO }, ...] (end >= start).
 */
export const parseLeavePeriods = (record, startFieldId, endFieldId) => {
    const toMs = (d) => { const t = new Date(d).getTime(); return isNaN(t) ? null : t; };
    const starts = getDateList(record, startFieldId).map(toMs).filter(x => x !== null).sort((a, b) => a - b);
    const ends = getDateList(record, endFieldId).map(toMs).filter(x => x !== null).sort((a, b) => a - b);
    const n = Math.min(starts.length, ends.length);
    const periods = [];
    for (let i = 0; i < n; i++) {
        if (ends[i] >= starts[i]) {
            periods.push({ start: new Date(starts[i]).toISOString(), end: new Date(ends[i]).toISOString() });
        }
    }
    return periods;
};
