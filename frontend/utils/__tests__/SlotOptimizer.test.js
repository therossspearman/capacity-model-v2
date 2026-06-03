import { describe, it, expect } from 'vitest';
import { generateBulkAllocationPlan } from '../SlotOptimizer';

describe('generateBulkAllocationPlan', () => {
    it('returns the empty shape for empty input', () => {
        const result = generateBulkAllocationPlan(null, []);
        expect(result).toEqual({ allocations: [], unplaceable: [], warnings: [], stats: {} });
    });

    // Regression guard for the critical bug where allocations/unplaceable/warnings
    // were never declared → ReferenceError on the first push for ANY non-empty input.
    it('does not throw on a non-empty input and returns arrays', () => {
        const slotMap = {
            Alpha: {
                '2026-07-06': { availableSlots: 5 },
                '2026-07-13': { availableSlots: 5 },
                '2026-07-20': { availableSlots: 5 },
                '2026-07-27': { availableSlots: 5 },
            },
        };
        const projects = [
            { id: 'p1', name: 'Project One', squads: ['Alpha'], kickOff: '2026-07-06', arr: 100 },
        ];
        const config = { slotProfile: { durationWeeks: 2, pmHours: 40, scHours: 120, buildHours: 80 } };

        let result;
        expect(() => { result = generateBulkAllocationPlan(slotMap, projects, config); }).not.toThrow();
        expect(Array.isArray(result.allocations)).toBe(true);
        expect(Array.isArray(result.unplaceable)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
        // Every project must be accounted for as either placed or unplaceable.
        expect(result.allocations.length + result.unplaceable.length).toBe(projects.length);
    });
});
