/**
 * BAU T-shirt sizing — single source of truth for the UI.
 *
 * The capacity worker (workerCodeSource.js → BAU demand) derives annual BAU
 * hours from each project's T-shirt size using `bauHoursMapping` (configured in
 * Settings) merged over a default mapping. The grid card badges and the BAU
 * detail modal must show the SAME numbers, so they all read from here instead
 * of hardcoding their own tables.
 *
 * Keep DEFAULT_BAU_HOURS in sync with the worker's `defaultMapping`.
 */

// Default hours/year per size — mirrors workerCodeSource.js getBauDemand.
export const DEFAULT_BAU_HOURS = { XXS: 25, XS: 50, S: 100, M: 200, L: 400, XL: 800, XXL: 1600 };

// Canonical display order for size pickers.
export const BAU_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Shared colour ramp for size badges/chips (smallest → largest).
export const BAU_SIZE_COLORS = {
    XXS: '#cbd5e1', XS: '#94a3b8', S: '#00BD00', M: '#4794FF',
    L: '#FE9922', XL: '#E5554F', XXL: '#b91c1c'
};

// Merge the Settings mapping over the defaults — matches the worker's hoursMap.
export const resolveBauHoursMap = (bauHoursMapping) =>
    (bauHoursMapping && typeof bauHoursMapping === 'object')
        ? { ...DEFAULT_BAU_HOURS, ...bauHoursMapping }
        : { ...DEFAULT_BAU_HOURS };

// Ordered options for a size picker: [{ value, label, hours, color }].
export const getBauSizeOptions = (bauHoursMapping) => {
    const map = resolveBauHoursMap(bauHoursMapping);
    return BAU_SIZE_ORDER
        .filter((sz) => map[sz] != null)
        .map((sz) => ({ value: sz, label: sz, hours: map[sz], color: BAU_SIZE_COLORS[sz] || '#94a3b8' }));
};

// Annual hours for a single size (falls back to M, then 0).
export const getBauHours = (size, bauHoursMapping) => {
    const map = resolveBauHoursMap(bauHoursMapping);
    if (map[size] != null) return map[size];
    return map.M != null ? map.M : 0;
};

// Badge colour for a single size.
export const getBauSizeColor = (size) => BAU_SIZE_COLORS[size] || '#94a3b8';
