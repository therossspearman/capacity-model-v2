import { describe, it, expect } from 'vitest';
import { generatePeopleAssignments } from '../PeopleOptimizer';

const makeResource = () => ({
    id: 'r1',
    name: 'Alice',
    role: 'PM',
    squads: ['Alpha'],
    effectiveHours: 40,
    details: { utilization: 0 },
});

const makeProject = () => ({
    id: 'p1',
    name: 'Project One',
    squads: ['Alpha'],
    status: 'Active',
    team: { pm: [], sc: [], pd: [] }, // empty → PM/SC/PD gaps
});

describe('generatePeopleAssignments', () => {
    it('returns an array', () => {
        expect(Array.isArray(generatePeopleAssignments([], [], {}))).toBe(true);
    });

    // Regression guard: the optimizer must NOT write _tempBooked onto the live
    // upstream resource objects (it previously mutated them, so stale bookings
    // leaked across runs and inflated utilisation).
    it('does not mutate the input resource objects', () => {
        const resource = makeResource();
        generatePeopleAssignments([makeProject()], [resource], {});
        expect('_tempBooked' in resource).toBe(false);
    });

    it('produces identical recommendations across repeated runs (no cross-run state leak)', () => {
        const resources = [makeResource()];
        const projects = [makeProject()];
        const first = generatePeopleAssignments(projects, resources, {});
        const second = generatePeopleAssignments(projects, resources, {});
        expect(second.length).toBe(first.length);
        // Same resource is offered with the same resulting load both times.
        expect(second.map(r => r.resultLoad)).toEqual(first.map(r => r.resultLoad));
    });
});
