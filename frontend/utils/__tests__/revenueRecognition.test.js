import { describe, it, expect } from 'vitest';
import { safeDate, deriveFyWindow, calculateProjectRevenue } from '../revenueRecognition';

const FY_START = new Date(2025, 4, 1);            // 2025-05-01
const FY_END = new Date(2026, 3, 30, 23, 59, 59); // 2026-04-30

describe('safeDate', () => {
    it('returns null for missing/invalid', () => {
        expect(safeDate(null)).toBeNull();
        expect(safeDate('')).toBeNull();
        expect(safeDate('not-a-date')).toBeNull();
    });
    it('parses valid dates', () => {
        expect(safeDate('2025-07-01')).toBeInstanceOf(Date);
    });
});

describe('deriveFyWindow', () => {
    it('uses the period context when provided', () => {
        const { fyStart, fyEnd } = deriveFyWindow({ start: '2025-05-01', end: '2026-04-30' });
        expect(fyStart.getFullYear()).toBe(2025);
        expect(fyEnd.getFullYear()).toBe(2026);
    });
});

describe('calculateProjectRevenue', () => {
    it('recognises full impl fee + ARR for a non-POC launch inside the FY', () => {
        const r = calculateProjectRevenue({ launch: '2025-07-01', implFee: 1000, arr: 5000 }, FY_START, FY_END);
        expect(r).toEqual({ implFee: 1000, arr: 5000 });
    });

    it('recognises nothing for a launch outside the FY', () => {
        const r = calculateProjectRevenue({ launch: '2024-01-01', implFee: 1000, arr: 5000 }, FY_START, FY_END);
        expect(r).toEqual({ implFee: 0, arr: 0 });
    });

    it('recognises nothing when there is no launch date', () => {
        expect(calculateProjectRevenue({ implFee: 1000, arr: 5000 }, FY_START, FY_END)).toEqual({ implFee: 0, arr: 0 });
    });

    it('recognises POC impl fee proportionally over the FY overlap, ARR in full at launch', () => {
        // KickOff before FY start, launch inside FY → only the in-FY portion of impl fee.
        const r = calculateProjectRevenue(
            { kickOff: '2025-04-01', launch: '2025-06-01', implFee: 1200, arr: 5000, revenueModel: 'POC' },
            FY_START, FY_END
        );
        expect(r.arr).toBe(5000);                  // ARR full at launch (within FY)
        expect(r.implFee).toBeGreaterThan(0);
        expect(r.implFee).toBeLessThan(1200);      // proportional, not full
    });
});
