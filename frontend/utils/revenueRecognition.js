/**
 * Revenue-recognition math (main thread).
 *
 * ⚠️ SOURCE OF TRUTH: the CANONICAL revenue-recognition algorithm lives in the Web
 * Worker (frontend/worker/workerCodeSource.js, ~lines 1081-1173) and drives the
 * capacity pipeline. This module is a deliberately-identical copy for the scenario
 * COMPARISON view (ScenarioCompareModal), which needs to recompute revenue for
 * many hypothetical scenarios on the main thread without round-tripping the worker.
 * If you change the rules (FY window, POC proportional recognition, fyStartMonth),
 * change BOTH places and keep them in lockstep. Covered by unit tests in
 * utils/__tests__/revenueRecognition.test.js.
 */

/** Parse a date-ish value, returning null for missing/invalid. */
export const safeDate = (val) => {
    if (!val) return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
};

/**
 * Derive the financial-year window. Uses the passed period context when present,
 * otherwise falls back to the current FY with fyStartMonth = 4 (May, 0-indexed).
 * @returns {{fyStart: Date, fyEnd: Date}}
 */
export const deriveFyWindow = (periodContext) => {
    if (periodContext && periodContext.start && periodContext.end) {
        return { fyStart: new Date(periodContext.start), fyEnd: new Date(periodContext.end) };
    }
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const currentYear = todayDate.getFullYear();
    const currentMonth = todayDate.getMonth();
    const fyStartMonth = 4; // May (0-indexed)
    const fyStartYear = currentMonth < fyStartMonth ? currentYear - 1 : currentYear;
    const fyStart = new Date(fyStartYear, fyStartMonth, 1);
    const fyEndMonth = fyStartMonth === 0 ? 11 : fyStartMonth - 1;
    const fyEndYear = fyStartMonth === 0 ? fyStartYear : fyStartYear + 1;
    const fyEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59);
    return { fyStart, fyEnd };
};

/**
 * Recognise implementation fee + ARR for a single project within [fyStart, fyEnd].
 * - ARR is recognised in full at Launch if Launch falls within the FY.
 * - Impl fee: POC model = proportional over KickOff→Launch overlapping the FY;
 *   non-POC = recognised in full at Launch if within the FY.
 * @returns {{implFee: number, arr: number}}
 */
export const calculateProjectRevenue = (p, fyStart, fyEnd) => {
    const launchDate = safeDate(p.launch || p.end);
    const kickOffDate = safeDate(p.kickOff || p.start);
    const implFee = p.implFee || 0;
    const arrVal = p.arr || 0;
    const isPOC = p.revenueModel && p.revenueModel.toLowerCase().includes('poc');

    if (!launchDate) return { implFee: 0, arr: 0 };

    let projectImplFee = 0;
    let projectArr = 0;

    // ARR is ALWAYS recognised at Launch (if within FY)
    if (launchDate >= fyStart && launchDate <= fyEnd) {
        projectArr = arrVal;
    }

    if (isPOC && kickOffDate && launchDate > kickOffDate) {
        // POC Model: proportional recognition from KickOff to Launch
        const projectDuration = launchDate - kickOffDate;
        const effectiveStart = Math.max(kickOffDate.getTime(), fyStart.getTime());
        const effectiveEnd = Math.min(launchDate.getTime(), fyEnd.getTime());
        if (effectiveEnd > effectiveStart) {
            const overlapDuration = effectiveEnd - effectiveStart;
            projectImplFee = (overlapDuration / projectDuration) * implFee;
        }
    } else if (launchDate >= fyStart && launchDate <= fyEnd) {
        // Non-POC Model: full recognition at Launch
        projectImplFee = implFee;
    }

    return { implFee: projectImplFee, arr: projectArr };
};
