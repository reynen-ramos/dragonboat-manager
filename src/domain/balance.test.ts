import { describe, expect, it } from 'vitest';
import { computeBalance, planBalancedSeating, type SeatedPaddler } from './balance';
import { DEFAULT_CLUB_SETTINGS } from './rules.config';
import { makeSeated } from './testing';
import type { BoatSize, SeatPosition } from './types';

const settings = DEFAULT_CLUB_SETTINGS;

const applyPlan = (seated: SeatedPaddler[], boatSize: BoatSize): SeatedPaddler[] => {
  const plan = new Map(planBalancedSeating(seated, boatSize).map((p) => [p.assignmentId, p.seat]));
  return seated.map((p) => {
    const seat = plan.get(p.assignment.id);
    return seat ? { ...p, assignment: { ...p.assignment, seat } } : p;
  });
};

describe('computeBalance', () => {
  it('reports an even boat as balanced', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { weightKg: 80 }),
      makeSeated({ row: 1, side: 'right' }, { weightKg: 80 }),
      makeSeated({ row: 5, side: 'left' }, { weightKg: 70 }),
      makeSeated({ row: 5, side: 'right' }, { weightKg: 70 }),
    ];
    const report = computeBalance(seated, 20, settings);

    expect(report.leftKg).toBe(150);
    expect(report.rightKg).toBe(150);
    expect(report.sideDeltaKg).toBe(0);
    expect(report.sideWithinTolerance).toBe(true);
    expect(report.totalKg).toBe(300);
    expect(report.seatedCount).toBe(4);
  });

  it('flags a boat that sits down on one side', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { weightKg: 100 }),
      makeSeated({ row: 1, side: 'right' }, { weightKg: 50 }),
    ];
    const report = computeBalance(seated, 20, settings);

    expect(report.sideDeltaKg).toBe(50);
    expect(report.sideDeltaFraction).toBeCloseTo(50 / 150);
    expect(report.sideWithinTolerance).toBe(false);
  });

  it('splits bow and stern at the midpoint of the boat', () => {
    // A 20s boat has 10 rows, so rows 1-5 are the bow half.
    const seated = [
      makeSeated({ row: 5, side: 'left' }, { weightKg: 90 }),
      makeSeated({ row: 6, side: 'right' }, { weightKg: 60 }),
    ];
    const report = computeBalance(seated, 20, settings);

    expect(report.bowKg).toBe(90);
    expect(report.sternKg).toBe(60);
    expect(report.bowSternDeltaKg).toBe(30);
    expect(report.bowSternWithinTolerance).toBe(false);
  });

  it('counts paddlers with no weight instead of guessing one', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { weightKg: 80 }),
      makeSeated({ row: 1, side: 'right' }, {}),
    ];
    const report = computeBalance(seated, 20, settings);

    expect(report.missingWeightCount).toBe(1);
    expect(report.totalKg).toBe(80);
  });

  it('counts paddlers seated against their side preference', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { sidePreference: 'right', weightKg: 80 }),
      makeSeated({ row: 1, side: 'right' }, { sidePreference: 'right', weightKg: 80 }),
      makeSeated({ row: 2, side: 'left' }, { sidePreference: 'both', weightKg: 80 }),
    ];
    expect(computeBalance(seated, 20, settings).sidePreferenceViolations).toBe(1);
  });
});

describe('planBalancedSeating', () => {
  it('evens out the sides using paddlers who can sit either side', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { weightKg: 100, sidePreference: 'both' }),
      makeSeated({ row: 2, side: 'left' }, { weightKg: 95, sidePreference: 'both' }),
      makeSeated({ row: 3, side: 'left' }, { weightKg: 60, sidePreference: 'both' }),
      makeSeated({ row: 4, side: 'left' }, { weightKg: 55, sidePreference: 'both' }),
    ];
    expect(computeBalance(seated, 20, settings).sideDeltaKg).toBe(310);

    const after = computeBalance(applyPlan(seated, 20), 20, settings);
    expect(Math.abs(after.sideDeltaKg)).toBeLessThanOrEqual(10);
    expect(after.totalKg).toBe(310);
  });

  it('keeps paddlers on the side they actually paddle', () => {
    const seated = [
      makeSeated({ row: 1, side: 'left' }, { weightKg: 100, sidePreference: 'left' }),
      makeSeated({ row: 2, side: 'left' }, { weightKg: 90, sidePreference: 'left' }),
      makeSeated({ row: 3, side: 'right' }, { weightKg: 70, sidePreference: 'right' }),
      makeSeated({ row: 4, side: 'right' }, { weightKg: 60, sidePreference: 'both' }),
    ];
    const after = applyPlan(seated, 20);

    for (const p of after) {
      if (p.member.sidePreference !== 'both') {
        expect(p.assignment.seat.side).toBe(p.member.sidePreference);
      }
    }
  });

  it('never moves a pinned paddler', () => {
    const pinnedSeat: SeatPosition = { row: 1, side: 'left' };
    const seated = [
      makeSeated(pinnedSeat, { weightKg: 100, sidePreference: 'both' }, { pinned: true }),
      makeSeated({ row: 2, side: 'left' }, { weightKg: 95, sidePreference: 'both' }),
      makeSeated({ row: 3, side: 'left' }, { weightKg: 90, sidePreference: 'both' }),
      makeSeated({ row: 4, side: 'left' }, { weightKg: 85, sidePreference: 'both' }),
    ];
    const pinnedId = seated[0].assignment.id;

    const plan = planBalancedSeating(seated, 20);
    expect(plan.find((p) => p.assignmentId === pinnedId)).toBeUndefined();

    const after = applyPlan(seated, 20);
    const stillPinned = after.find((p) => p.assignment.id === pinnedId)!;
    expect(stillPinned.assignment.seat).toEqual(pinnedSeat);
  });

  it('does not overfill a side when pinned paddlers use up its seats', () => {
    // A 10s boat has 5 rows per side. Pin all 5 left seats, then the movable
    // "left-preference" paddlers have nowhere to go but the right.
    const seated = [
      ...[1, 2, 3, 4, 5].map((row) =>
        makeSeated({ row, side: 'left' }, { weightKg: 80, sidePreference: 'left' }, { pinned: true }),
      ),
      makeSeated({ row: 1, side: 'right' }, { weightKg: 70, sidePreference: 'left' }),
      makeSeated({ row: 2, side: 'right' }, { weightKg: 65, sidePreference: 'left' }),
    ];
    const after = applyPlan(seated, 10);

    const leftCount = after.filter((p) => p.assignment.seat.side === 'left').length;
    const rightCount = after.filter((p) => p.assignment.seat.side === 'right').length;
    expect(leftCount).toBe(5);
    expect(rightCount).toBe(2);
  });

  it('counts weight already pinned to a side when choosing sides', () => {
    // The whole point of pinning is to lock a core in place and balance around
    // it. With 500kg pinned left and 300kg free to move, every movable paddler
    // belongs on the right — a planner that only weighs the paddlers it may
    // move sees two empty sides and splits them evenly, making the boat worse
    // than leaving it alone.
    const seated = [
      ...[1, 2, 3, 4, 5].map((row) =>
        makeSeated({ row, side: 'left' }, { weightKg: 100, sidePreference: 'both' }, { pinned: true }),
      ),
      ...[1, 2, 3, 4, 5].map((row) =>
        makeSeated({ row, side: 'right' }, { weightKg: 60, sidePreference: 'both' }),
      ),
    ];
    const after = applyPlan(seated, 20);
    const report = computeBalance(after, 20, settings);

    expect(report.leftKg).toBe(500);
    expect(report.rightKg).toBe(300);
  });

  it('adds nobody to a side already pinned beyond its capacity', () => {
    // Six paddlers pinned to a five-row side, doubled up on rows 1-3 — so rows
    // 4 and 5 are still free and the placement pass would happily use them.
    // Capacity is -1 here, and `slice(0, -1)` keeps all but the last paddler
    // instead of none, quietly seating someone on the overloaded side.
    const seated = [
      ...[1, 1, 2, 2, 3, 3].map((row) =>
        makeSeated({ row, side: 'left' }, { weightKg: 80, sidePreference: 'left' }, { pinned: true }),
      ),
      makeSeated({ row: 1, side: 'right' }, { weightKg: 70, sidePreference: 'left' }),
      makeSeated({ row: 2, side: 'right' }, { weightKg: 65, sidePreference: 'left' }),
    ];

    const plan = planBalancedSeating(seated, 10);

    expect(plan.filter((p) => p.seat.side === 'left')).toHaveLength(0);
    expect(plan.filter((p) => p.seat.side === 'right')).toHaveLength(2);
  });

  it('gives every paddler a distinct seat', () => {
    const seated = Array.from({ length: 20 }, (_, i) =>
      makeSeated(
        { row: (i % 10) + 1, side: i < 10 ? 'left' : 'right' },
        { weightKg: 60 + i, sidePreference: 'both' },
      ),
    );
    const after = applyPlan(seated, 20);

    const keys = after.map((p) => `${p.assignment.seat.row}-${p.assignment.seat.side}`);
    expect(new Set(keys).size).toBe(20);
  });

  it('draws the heaviest paddlers toward the engine room', () => {
    const seated = Array.from({ length: 20 }, (_, i) =>
      makeSeated(
        { row: (i % 10) + 1, side: i < 10 ? 'left' : 'right' },
        { weightKg: 50 + i * 3, sidePreference: 'both' },
      ),
    );
    const after = applyPlan(seated, 20);
    const heaviest = after.reduce((a, b) =>
      (a.member.weightKg ?? 0) > (b.member.weightKg ?? 0) ? a : b,
    );

    // Rows 3-8 are the engine room in a 20s boat.
    expect(heaviest.assignment.seat.row).toBeGreaterThanOrEqual(3);
    expect(heaviest.assignment.seat.row).toBeLessThanOrEqual(8);
  });
});

describe('preferred zones', () => {
  it('gives a stated preference its zone even for a light paddler', () => {
    // Rows 1-2 are the stroke pair in a 20s boat. Without the preference the
    // lightest paddler is pushed to the ends by the heaviest-to-centre rule.
    const seated = [
      ...[1, 2, 3, 4, 5].map((row) =>
        makeSeated({ row, side: 'left' }, { weightKg: 90 + row, sidePreference: 'both' }),
      ),
      makeSeated(
        { row: 6, side: 'left' },
        { weightKg: 55, sidePreference: 'both', preferredZones: ['stroke'] },
      ),
    ];
    const after = applyPlan(seated, 20);
    const light = after.find((p) => p.member.weightKg === 55)!;

    expect([1, 2]).toContain(light.assignment.seat.row);
  });

  it('falls back to the general pool when the preferred zone is pinned full', () => {
    const seated = [
      // Both stroke rows pinned.
      makeSeated({ row: 1, side: 'left' }, { weightKg: 80 }, { pinned: true }),
      makeSeated({ row: 2, side: 'left' }, { weightKg: 80 }, { pinned: true }),
      // Fixed to the left, or the planner would simply give them the free
      // stroke pair on the right — which is the preference working, not failing.
      makeSeated(
        { row: 5, side: 'left' },
        { weightKg: 70, sidePreference: 'left', preferredZones: ['stroke'] },
      ),
    ];
    const plan = planBalancedSeating(seated, 20);
    const placed = plan.find((p) => p.seat.side === 'left');

    expect(placed).toBeDefined();
    expect([1, 2]).not.toContain(placed!.seat.row);
  });

  it('keeps drawing unpreferring paddlers toward the engine room', () => {
    const seated = [
      makeSeated(
        { row: 1, side: 'left' },
        { weightKg: 95, sidePreference: 'both', preferredZones: ['rockets'] },
      ),
      makeSeated({ row: 2, side: 'left' }, { weightKg: 90, sidePreference: 'both' }),
    ];
    const after = applyPlan(seated, 20);

    const rockets = after.find((p) => p.member.preferredZones?.length)!;
    const other = after.find((p) => !p.member.preferredZones)!;
    expect(rockets.assignment.seat.row).toBeGreaterThanOrEqual(9);
    // The unpreferring paddler still takes the most central row available.
    expect([5, 6]).toContain(other.assignment.seat.row);
  });
});
