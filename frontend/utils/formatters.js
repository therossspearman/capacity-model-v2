/**
 * Format a number with locale-aware comma separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
    const n = num || 0;
    const rounded = n >= 0 ? Math.ceil(n) : Math.floor(n);
    return new Intl.NumberFormat('en-US').format(rounded);
};

/**
 * Format Y-axis ticks for charts (e.g., 1000 -> 1.0k)
 * @param {number} tick - Tick value
 * @returns {string|number} Formatted tick
 */
export const formatYAxis = (tick) => tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick;

/**
 * Extract string value from potentially nested object
 * @param {string|Object|null} val - Value to extract
 * @returns {string|null} Extracted string
 */
export const extractFieldValue = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object' && val.name) return String(val.name).trim();
    return null;
};
