import { describe, expect, it } from 'vitest';
import { BUILTIN_EVENT_TYPES } from './eventTypes';
import {
  buildAttendanceReport,
  buildBenchReport,
  buildCompositionReport,
  buildResultsReport,
} from './reports';
import { makeMember } from './testing';
import type {
  Availability,
  Category,
  ClubEvent,
  Crew,
  CrewRole,
  RaceEntry,
  StoredAssignment,
} from './types';

const RANGE = { from: '2026-01-01', to: '2026-08-30' };

const event = (id: string, startDate: string, over: Partial<ClubEvent> = {}): ClubEvent => ({
  id,
  name: `Event ${id}`,
  type: 'race',
  startDate,
  ...over,
});

const category = (id: string, eventId: string): Category => ({
  id,
  eventId,
  boatSize: 10,
  genderClass: 'open',
});

const crew = (id: string, categoryId: string, over: Partial<Crew> = {}): Crew => ({
  id,
  categoryId,
  name: `Crew ${id}`,
  ...over,
});

let assignmentN = 0;
const seat = (crewId: string, memberId: string, role: CrewRole = 'paddler'): StoredAssignment => ({
  id: `a-${++assignmentN}`,
  crewId,
  memberId,
  role,
  ...(role === 'paddler' ? { seat: { row: 1, side: 'left' as const } } : {}),
});

const answer = (eventId: string, memberId: string, status: Availability['status']): Availability => ({
  eventId,
  memberId,
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

let entryN = 0;
const entry = (crewId: string, over: Partial<RaceEntry> = {}): RaceEntry => ({
  id: `e-${++entryN}`,
  crewId,
  stage: 'heat',
  heat: 1,
  ...over,
});

const ana = makeMember({ id: 'ana', firstName: 'Ana', lastName: 'Aquino' });
const ben = makeMember({ id: 'ben', firstName: 'Ben', lastName: 'Bautista' });

/** One training, one race, one social; Ana answers both, Ben stays silent. */
const season = () => ({
  range: RANGE,
  members: [ana, ben],
  events: [
    event('t1', '2026-05-01', { type: 'practice' }),
    event('r1', '2026-06-01'),
    event('o1', '2026-06-15', { type: 'other' }),
  ],
  categories: [category('ct', 't1'), category('cr', 'r1')],
  crews: [crew('kt', 'ct'), crew('kr', 'cr')],
  assignments: [] as StoredAssignment[],
  availability: [] as Availability[],
  eventTypes: BUILTIN_EVENT_TYPES,
});

describe('buildAttendanceReport', () => {
  it('counts answers per kind, with silence as unanswered', () => {
    const report = buildAttendanceReport({
      ...season(),
      assignments: [seat('kt', 'ana')],
      availability: [answer('t1', 'ana', 'in'), answer('r1', 'ana', 'maybe')],
    });

    expect(report.trainingCount).toBe(1);
    expect(report.raceCount).toBe(1);
    const [rowAna, rowBen] = report.rows;
    expect(rowAna.member.id).toBe('ana');
    expect(rowAna.trainings).toEqual({ saidIn: 1, saidMaybe: 0, saidOut: 0, unanswered: 0, seated: 1 });
    expect(rowAna.races).toEqual({ saidIn: 0, saidMaybe: 1, saidOut: 0, unanswered: 0, seated: 0 });
    expect(rowBen.trainings.unanswered).toBe(1);
    expect(rowBen.races.unanswered).toBe(1);
  });

  it('never counts a reserve row or a Plan B seat as seated', () => {
    const report = buildAttendanceReport({
      ...season(),
      crews: [crew('kt', 'ct'), crew('kr', 'cr'), crew('kr-b', 'cr', { variantOf: 'kr' })],
      assignments: [seat('kr', 'ana', 'reserve'), seat('kr-b', 'ben')],
    });

    expect(report.rows[0].races.seated).toBe(0); // Ana: reserve only
    expect(report.rows[1].races.seated).toBe(0); // Ben: variant only
  });

  it('groups a custom type by its behaviour, and other-base events nowhere', () => {
    const report = buildAttendanceReport({
      ...season(),
      events: [event('gym1', '2026-05-05', { type: 'gym' }), event('o1', '2026-06-15', { type: 'other' })],
      availability: [answer('o1', 'ana', 'in')],
      eventTypes: [...BUILTIN_EVENT_TYPES, { id: 'gym', label: 'Gym', base: 'practice' }],
    });

    expect(report.trainingCount).toBe(1);
    expect(report.raceCount).toBe(0);
    // The social's answer counts nowhere — no kind claims the event.
    expect(report.rows[0].trainings.saidIn).toBe(0);
    expect(report.rows[0].races.saidIn).toBe(0);
  });

  it('treats the range as inclusive, judged on the event’s effective end date', () => {
    const report = buildAttendanceReport({
      ...season(),
      events: [
        event('on-from', RANGE.from, { type: 'practice' }),
        event('on-to', RANGE.to, { type: 'practice' }),
        event('after', '2026-08-31', { type: 'practice' }),
        // Starts before the range but ends inside it: counted.
        event('spans-in', '2025-12-30', { type: 'practice', endDate: '2026-01-02' }),
        // Starts inside but ends after: its effective date is outside.
        event('spans-out', '2026-08-29', { type: 'practice', endDate: '2026-09-01' }),
      ],
      categories: [],
      crews: [],
    });

    expect(report.trainingCount).toBe(3);
  });

  it('skips assignments whose crew→category chain is broken', () => {
    const report = buildAttendanceReport({
      ...season(),
      crews: [crew('orphan', 'no-such-category')],
      assignments: [seat('orphan', 'ana'), seat('no-such-crew', 'ana')],
    });

    expect(report.rows[0].trainings.seated).toBe(0);
    expect(report.rows[0].races.seated).toBe(0);
  });

  it('sorts rows by name regardless of input order', () => {
    const report = buildAttendanceReport({ ...season(), members: [ben, ana] });
    expect(report.rows.map((r) => r.member.id)).toEqual(['ana', 'ben']);
  });
});

describe('buildResultsReport', () => {
  const resultsInput = (over: Partial<Parameters<typeof buildResultsReport>[0]> = {}) => ({
    range: RANGE,
    events: [event('r1', '2026-06-01')],
    categories: [category('cr', 'r1')],
    crews: [crew('ka', 'cr'), crew('kb', 'cr')],
    raceEntries: [] as RaceEntry[],
    eventTypes: BUILTIN_EVENT_TYPES,
    ...over,
  });

  it('ranks per category, never across categories', () => {
    const report = buildResultsReport(
      resultsInput({
        categories: [category('c1', 'r1'), category('c2', 'r1')],
        crews: [crew('k1', 'c1'), crew('k2', 'c2')],
        raceEntries: [entry('k1', { timeMs: 70_000 }), entry('k2', { timeMs: 60_000 })],
      }),
    );

    const [block] = report.events;
    expect(block.categories).toHaveLength(2);
    // Both crews are 1st in their own category — the slower one was never
    // ranked against the faster one's "Heat 1".
    for (const categoryBlock of block.categories) {
      expect(categoryBlock.groups[0].rows[0].placement).toBe(1);
    }
  });

  it('labels races count-aware and orders them like a programme', () => {
    const report = buildResultsReport(
      resultsInput({
        raceEntries: [
          entry('ka', { stage: 'final', heat: 2, timeMs: 66_000 }),
          entry('ka', { stage: 'heat', timeMs: 65_000 }),
          entry('kb', { stage: 'final', heat: 1, timeMs: 64_000 }),
        ],
      }),
    );

    const labels = report.events[0].categories[0].groups.map((g) => g.label);
    expect(labels).toEqual(['Heat', 'A Final', 'B Final']);
    expect(report.raceCount).toBe(3);
  });

  it('shares tied placements and leaves the untimed unranked at the end', () => {
    const report = buildResultsReport(
      resultsInput({
        crews: [crew('ka', 'cr'), crew('kb', 'cr'), crew('kc', 'cr')],
        raceEntries: [
          entry('ka', { timeMs: 60_000 }),
          entry('kb', { timeMs: 60_000 }),
          entry('kc'),
        ],
      }),
    );

    const rows = report.events[0].categories[0].groups[0].rows;
    expect(rows.map((r) => r.placement)).toEqual([1, 1, undefined]);
    expect(rows[2].timeMs).toBeUndefined();
  });

  it('includes only race-base events inside the range that hold entries', () => {
    const report = buildResultsReport(
      resultsInput({
        events: [
          event('r1', '2026-06-01'),
          event('r-out', '2025-01-01'),
          event('t1', '2026-05-01', { type: 'practice' }),
          event('r-empty', '2026-07-01'),
        ],
        categories: [category('cr', 'r1'), category('c-out', 'r-out'), category('c-t', 't1')],
        crews: [crew('ka', 'cr'), crew('k-out', 'c-out'), crew('k-t', 'c-t')],
        raceEntries: [
          entry('ka', { timeMs: 60_000 }),
          entry('k-out', { timeMs: 61_000 }),
          entry('k-t', { timeMs: 62_000 }),
        ],
      }),
    );

    expect(report.events.map((b) => b.event.id)).toEqual(['r1']);
    expect(report.eventCount).toBe(1);
    expect(report.entryCount).toBe(1);
  });

  it('drops entries pointing at variant or missing crews', () => {
    const report = buildResultsReport(
      resultsInput({
        crews: [crew('ka', 'cr'), crew('ka-b', 'cr', { variantOf: 'ka' })],
        raceEntries: [
          entry('ka', { timeMs: 60_000 }),
          entry('ka-b', { timeMs: 59_000 }),
          entry('gone', { timeMs: 58_000 }),
        ],
      }),
    );

    expect(report.entryCount).toBe(1);
    expect(report.events[0].categories[0].groups[0].rows).toHaveLength(1);
  });

  it('orders events by date', () => {
    const report = buildResultsReport(
      resultsInput({
        events: [event('late', '2026-07-01'), event('early', '2026-02-01')],
        categories: [category('cl', 'late'), category('ce', 'early')],
        crews: [crew('kl', 'cl'), crew('ke', 'ce')],
        raceEntries: [entry('kl', { timeMs: 60_000 }), entry('ke', { timeMs: 60_000 })],
      }),
    );

    expect(report.events.map((b) => b.event.id)).toEqual(['early', 'late']);
  });
});

describe('buildCompositionReport', () => {
  const TODAY = '2026-08-30';
  const aged = (id: string, age: number) =>
    makeMember({ id, dateOfBirth: `${2026 - age}-01-01` });

  it('lands the division edge ages in the right bands', () => {
    const report = buildCompositionReport({
      today: TODAY,
      members: [18, 19, 23, 24, 39, 40, 49, 50, 59, 60].map((age) => aged(`m${age}`, age)),
    });

    const byKey = Object.fromEntries(report.ageBands.map((b) => [b.key, b.count]));
    expect(byKey).toEqual({ junior: 1, u24: 2, premier: 2, '40s': 2, '50s': 2, '60plus': 1, unknown: 0 });
  });

  it('buckets weights half-open and files the unknowns honestly', () => {
    const report = buildCompositionReport({
      today: TODAY,
      members: [
        makeMember({ id: 'w1', weightKg: 59.5 }),
        makeMember({ id: 'w2', weightKg: 60 }),
        makeMember({ id: 'w3' }), // no weight
        makeMember({ id: 'w4' }), // no dob either
      ],
    });

    const weights = Object.fromEntries(report.weightBands.map((b) => [b.key, b.count]));
    expect(weights.under60).toBe(1);
    expect(weights['60s']).toBe(1);
    expect(weights.unknown).toBe(2);
    expect(report.ageBands.find((b) => b.key === 'unknown')?.count).toBe(4);
  });

  it('keeps zero-count buckets so the table shape never shifts', () => {
    const report = buildCompositionReport({ today: TODAY, members: [] });
    expect(report.total).toBe(0);
    expect(report.ageBands).toHaveLength(7);
    expect(report.weightBands).toHaveLength(6);
    expect(report.status.map((b) => b.count)).toEqual([0, 0, 0]);
  });

  it('splits officials into four exclusive buckets that sum to the total', () => {
    const report = buildCompositionReport({
      today: TODAY,
      members: [
        makeMember({ id: 'd', canDrum: true }),
        makeMember({ id: 's', canSteer: true }),
        makeMember({ id: 'ds', canDrum: true, canSteer: true }),
        makeMember({ id: 'n' }),
      ],
    });

    expect(report.officials).toEqual({ canDrum: 1, canSteer: 1, both: 1, neither: 1 });
  });
});

describe('buildBenchReport', () => {
  it('benches the signed-in and unseated, and counts the fully seated', () => {
    const report = buildBenchReport({
      ...season(),
      assignments: [seat('kr', 'ben')],
      availability: [answer('r1', 'ana', 'in'), answer('r1', 'ben', 'in')],
    });

    expect(report.consideredEvents).toBe(1); // only r1 has a lineup
    expect(report.fullySeatedCount).toBe(1); // Ben
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ saidIn: 1, seated: 0, benched: 1 });
    expect(report.rows[0].member.id).toBe('ana');
    expect(report.rows[0].benchedEvents[0].reserveOnly).toBe(false);
  });

  it('flags the reserve-only as benched but listed', () => {
    const report = buildBenchReport({
      ...season(),
      assignments: [seat('kr', 'ben'), seat('kr', 'ana', 'reserve')],
      availability: [answer('r1', 'ana', 'in')],
    });

    expect(report.rows[0].benchedEvents[0].reserveOnly).toBe(true);
  });

  it('a Plan B seat does not rescue anyone from the bench', () => {
    const report = buildBenchReport({
      ...season(),
      crews: [crew('kt', 'ct'), crew('kr', 'cr'), crew('kr-b', 'cr', { variantOf: 'kr' })],
      assignments: [seat('kr', 'ben'), seat('kr-b', 'ana')],
      availability: [answer('r1', 'ana', 'in')],
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].member.id).toBe('ana');
  });

  it('never benches a maybe, an out, or the silent', () => {
    const report = buildBenchReport({
      ...season(),
      assignments: [seat('kr', 'ben')],
      availability: [answer('r1', 'ana', 'maybe'), answer('t1', 'ana', 'out')],
    });

    expect(report.rows).toHaveLength(0);
    expect(report.fullySeatedCount).toBe(0);
  });

  it('an event with no lineup built benches nobody', () => {
    const report = buildBenchReport({
      ...season(),
      availability: [answer('t1', 'ana', 'in'), answer('r1', 'ana', 'in')],
    });

    expect(report.consideredEvents).toBe(0);
    expect(report.rows).toHaveLength(0);
  });

  it('sorts the most benched first', () => {
    const base = season();
    const report = buildBenchReport({
      ...base,
      assignments: [seat('kt', 'ben'), seat('kr', 'ben')],
      availability: [
        answer('t1', 'ana', 'in'),
        answer('r1', 'ana', 'in'),
        answer('t1', 'ben', 'in'),
        // Ben is seated everywhere; a third member benched once sorts after Ana.
        answer('r1', 'cai', 'in'),
      ],
      members: [...base.members, makeMember({ id: 'cai', firstName: 'Cai', lastName: 'Cruz' })],
    });

    expect(report.rows.map((r) => [r.member.id, r.benched])).toEqual([
      ['ana', 2],
      ['cai', 1],
    ]);
  });
});
