import { BRAND } from '../design-system';

/**
 * Calculate display metrics for a capacity cell
 * @param {Object} bucket - Data bucket for the cell
 * @param {string} forecastMode - 'default', 'eac', or 'impact'
 * @param {Object} thresholds - Threshold configuration
 * @returns {Object} { util, isOverloaded, heightPercent, barColor, content, textColor, dem, cap }
 */
export const getCellMetrics = (bucket, forecastMode, thresholds) => {
    if (!bucket) return { util: 0, isOverloaded: false, heightPercent: 0, barColor: 'transparent', content: '', textColor: '', dem: 0, cap: 0 };
    let dem = bucket.dem || 0;
    if (forecastMode === 'eac') dem = bucket.dem_eac || 0;
    else if (forecastMode === 'impact') dem = bucket.dem_imp || 0;
    const cap = bucket.cap || 0;

    if (forecastMode === 'impact') {
        const isPositive = dem > 0.1;
        const isNegative = dem < -0.1;
        // barColor is consumed as an inline backgroundColor — must be a raw CSS color,
        // not a Tailwind class (Tailwind JIT does not run in the iframe).
        let barColor = 'transparent';
        if (isPositive) barColor = '#E5554F';
        if (isNegative) barColor = BRAND.success;
        let heightPercent = Math.min(Math.abs(dem) * 10, 100);
        let content = Math.ceil(Math.abs(dem)) !== 0 ? (dem > 0 ? `+${Math.ceil(dem)}` : Math.floor(dem)) : '';
        let textColor = Math.abs(dem) > 5 ? '#ffffff' : (dem === 0 ? 'transparent' : (dem > 0 ? '#E5554F' : BRAND.success));
        return { util: 0, isOverloaded: false, heightPercent, barColor, content, textColor, dem, cap };
    }

    const util = cap > 0 ? dem / cap : 0;
    // Overloaded = severe overcapacity (>120%). The 100-120% band is treated as a "warning"
    // tier with amber/orange shading rather than full red. Band boundaries are currently
    // hardcoded below (green ≤100, amber 100-110, orange 110-120, red >120) and are not
    // driven by the settings thresholds.
    const isOverloaded = util > 1.20;

    // Calculate height, color, and content based on utilization
    let heightPercent, barColor, content;

    if (cap === 0 && dem === 0) {
        // No capacity, no demand - empty cell
        heightPercent = 0;
        barColor = 'transparent';
        content = '';
    } else if (cap > 0 && dem === 0) {
        // Capacity available but no demand - show grey "0" indicator
        heightPercent = 15; // Subtle grey bar
        barColor = '#e2e8f0'; // Slate-200 grey
        content = '0';
    } else if (cap === 0 && dem > 0) {
        // Demand but no capacity - overallocated
        heightPercent = 100;
        barColor = '#E5554F'; // Red
        content = Math.ceil(dem);
    } else {
        // Normal utilization case
        heightPercent = Math.min((dem / cap) * 100, 100);
        // Color ladder:
        //   0–100%   → shades of green (deeper as utilisation rises)
        //   100–110% → amber  (slight overload)
        //   110–120% → orange (significant overload)
        //   >120%    → red    (severe overload)
        if (util > 1.20) barColor = '#dc2626';        // Red (>120%)
        else if (util > 1.10) barColor = '#ea580c';   // Orange (110-120%)
        else if (util > 1.00) barColor = '#FE9922';   // Amber (100-110%)
        else if (util > 0.80) barColor = '#15803d';   // Deep Green (80-100%)
        else if (util > 0.60) barColor = '#00BD00';   // Green (60-80%)
        else if (util > 0.40) barColor = '#86efac';   // Light Green (40-60%)
        else if (util > 0.20) barColor = '#bbf7d0';   // Very Light Green (20-40%)
        else barColor = '#dcfce7';                    // Lightest green (0-20%)
        content = Math.ceil(dem) > 0 ? Math.ceil(dem) : '';
    }

    // Raw CSS color for consistency with the impact branch (BRAND.dark did not exist).
    let textColor = heightPercent > 60 ? '#ffffff' : BRAND.indigo;

    return { util, isOverloaded, heightPercent, barColor, content, textColor, dem, cap };
};
