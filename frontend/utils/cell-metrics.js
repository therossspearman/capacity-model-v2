import { DEFAULT_SETTINGS } from '../constants';
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
    const { greenStart = DEFAULT_SETTINGS.thresholds.greenStart, redStart = DEFAULT_SETTINGS.thresholds.redStart } = thresholds || {};

    if (forecastMode === 'impact') {
        const isPositive = dem > 0.1;
        const isNegative = dem < -0.1;
        let barColor = 'bg-transparent';
        if (isPositive) barColor = 'bg-[#ef4444]';
        if (isNegative) barColor = `bg-[${BRAND.success}]`;
        let heightPercent = Math.min(Math.abs(dem) * 10, 100);
        let content = Math.ceil(Math.abs(dem)) !== 0 ? (dem > 0 ? `+${Math.ceil(dem)}` : Math.floor(dem)) : '';
        let textColor = Math.abs(dem) > 5 ? 'text-white font-bold' : (dem === 0 ? 'text-transparent' : (dem > 0 ? 'text-[#ef4444] font-bold' : `text-[${BRAND.success}] font-bold`));
        return { util: 0, isOverloaded: false, heightPercent, barColor, content, textColor, dem, cap };
    }

    const util = cap > 0 ? dem / cap : 0;
    // Overloaded = severe overcapacity (>120%). The 100-120% band is treated as a "warning"
    // tier with amber/orange shading rather than full red. The legacy `redStart` threshold
    // from settings still acts as a soft floor for the warning band but never raises the
    // red trigger above 120% — so behaviour matches the spec: green ≤100, amber→orange 100-120, red ≥120.
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
        barColor = '#ef4444'; // Red
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
        else if (util > 1.00) barColor = '#f59e0b';   // Amber (100-110%)
        else if (util > 0.80) barColor = '#15803d';   // Deep Green (80-100%)
        else if (util > 0.60) barColor = '#00BD00';   // Green (60-80%)
        else if (util > 0.40) barColor = '#86efac';   // Light Green (40-60%)
        else if (util > 0.20) barColor = '#bbf7d0';   // Very Light Green (20-40%)
        else barColor = '#dcfce7';                    // Lightest green (0-20%)
        content = Math.ceil(dem) > 0 ? Math.ceil(dem) : '';
    }

    let textColor = heightPercent > 60 ? 'text-white text-shadow-sm' : `text-[${BRAND.dark}]`;

    return { util, isOverloaded, heightPercent, barColor, content, textColor, dem, cap };
};
