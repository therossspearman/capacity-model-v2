import { STATUS_COLOR_MAP, MODERN_COLORS } from '../constants';

/**
 * Get category for a function name based on role mapping
 * @param {string} funcName - Function name
 * @param {Object} mapping - Role mapping configuration
 * @returns {string} Category (pm, sc, pd, or unknown)
 */
export const getCategoryForFunction = (funcName, mapping) => {
    if (!funcName) return 'unknown';
    const lower = funcName.toLowerCase();

    // 1. Check User Mapping
    if (mapping && Object.keys(mapping).length > 0) {
        for (const [cat, names] of Object.entries(mapping)) {
            const safeNames = Array.isArray(names) ? names : (names ? [names] : []);
            if (safeNames.some(n => typeof n === 'string' && lower.includes(n.toLowerCase()))) return cat;
        }
    }

    // 2. Default Fallbacks (Smart Auto-detection)
    if (lower.includes('product manager') || lower.includes('pm') || lower.includes('project manager')) return 'PM';
    if (lower.includes('solution consultant') || lower.includes('sc') || lower.includes('consultant')) return 'SC';
    if (lower.includes('product designer') || lower.includes('pd') || lower.includes('designer') || lower.includes('creative') || lower.includes('platform delivery') || lower.includes('delivery') || lower.includes('developer') || lower.includes('engineer') || lower.includes('application') || lower.includes('configuration') || lower.includes('specialist')) return 'PD';

    return 'unknown';
};

/**
 * Get relative time string from a date
 * @param {Date} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Get color for a status
 * @param {string} status - Status string
 * @param {number} index - Fallback index for color
 * @returns {string} Hex color
 */
export const getStatusColor = (status, index) => {
    if (!status) return MODERN_COLORS[index % MODERN_COLORS.length];
    const key = status.toLowerCase();
    return STATUS_COLOR_MAP[key] || MODERN_COLORS[index % MODERN_COLORS.length];
};

/**
 * Get squads list from a record's linked record field
 * Handles arrays of linked records, comma-separated strings, and single objects
 * @param {Object} record - Airtable record
 * @param {string} fieldId - Field ID for squads
 * @param {Function} getSafeCellValue - Function to extract cell value
 * @returns {string[]} Array of squad names
 */
export const getSquadsList = (record, fieldId, getSafeCellValue) => {
    const val = getSafeCellValue(record, fieldId);
    if (!val) return ['Unassigned'];

    let rawList = [];
    if (Array.isArray(val)) {
        // Linked record array - each item has a .name property
        rawList = val.map(item => (typeof item === 'object' && item.name) ? item.name : item);
    } else if (typeof val === 'string') {
        // Comma-separated string
        rawList = val.split(',');
    } else if (typeof val === 'object') {
        // Single linked record
        rawList = [val.name || 'Unassigned'];
    }

    const cleaned = rawList.filter(Boolean).map(s => String(s).trim()).filter(s => s !== '');
    return cleaned.length > 0 ? cleaned : ['Unassigned'];
};
