import { describe, expect, it } from 'vitest';
import { planCrewFill, type FillInput } from './fill';
import { DEFAULT_CLUB_SETTINGS } from './rules.config';
import { makeMember } from './testing';
import type {
  AvailabilityStatus,
  Category,
  Member,
  StoredAssignment,
} from './types';

const category = (over: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  eventId: 'event-1',
  boatSize: 10,
  genderClass: 'open',
  ...over,
});

const seated = (
  memberId: string,
  row: number,
  side: 'left' | 'right',
): StoredAssignment => ({
  id: `a-${memberId}`,
  crewId: 'crew-1',
  memberId,
  role: 'paddler',
  seat: { row, side },
});

const reserve = (memberId: string): StoredAssignment => ({
  id: `a-${memberId}`,
  crewId: 'crew-1',
  memberId,
  role: 'reserve',
});

/** N members with weights, plus whatever the test needs layered on. */
const roster = (n: number, over: (i: number) => Partial<Member> = () => ({})): Member[] =>
  Array.from({ length: n }, (_, i) =>
    makeMember({ id: `m${i}`, lastName: `M${String(i).padStart(2, '0')}`, weightKg: 75, ...over(i) }),
  );

const fill = (over: Partial<FillInput>) =>
  planCrewFill({
    category: category(),
    crewId: 'crew-1',
    assignments: [],
    members: [],
    // The pool is opt-in: an outsider must be signed up to be seatable. Tests
    // that are not about sign-ups get their whole roster marked In by default,
    // so an empty map here can never make an exclusion test pass vacuously.
    availability: new Map<string, AvailabilityStatus>(
      (over.members ?? []).map((m) => [m.id, 'in']),
    ),
    categoryAssignments: [],
    settings: DEFAULT_CLUB_SETTINGS,
    ...over,
  });

const avail = (pairs: [string, AvailabilityStatus][]) => new Map(pairs);

describe('who gets seated', () => {
  it('seats the crew’s own reserves before anyone else', () => {
    const members = roster(12);
    const { report } = fill({
      members,
      assignments: [reserve('m0'), reserve('m1')],
      availability: avail([
        ['m2', 'in'],
        ['m3', 'in'],
      ]),
    });

    expect(report.seated.slice(0, 2).map((p) => p.memberId).sort()).toEqual(['m0', 'm1']);
    expect(report.seated.slice(0, 2).every((p) => p.tier === 'reserve')).toBe(true);
  });

  it('prefers In over Maybe, and never seats Out or the unsigned', () => {
    const members = roster(4);
    const { report } = fill({
      category: category({ boatSize: 10 }),
      members,
      availability: avail([
        ['m0', 'out'],
        ['m1', 'maybe'],
        ['m2', 'in'],
        // m3 never signed up.
      ]),
    });

    const order = report.seated.map((p) => p.memberId);
    expect(order.indexOf('m2')).toBeLessThan(order.indexOf('m1'));
    expect(report.seated.find((p) => p.memberId === 'm2')?.tier).toBe('in');
    expect(report.seated.find((p) => p.memberId === 'm1')?.tier).toBe('maybe');
    expect(order).not.toContain('m0');
    expect(order).not.toContain('m3');
  });

  it('seats an unanswered reserve — being named a reserve outranks silence', () => {
    const members = roster(3);
    const { report } = fill({
      members,
      assignments: [reserve('m0')],
      availability: avail([['m1', 'in']]),
    });

    const m0 = report.seated.find((p) => p.memberId === 'm0');
    expect(m0?.tier).toBe('reserve');
    // …but the same silence keeps the outsider m2 on the shore.
    expect(report.seated.map((p) => p.memberId)).not.toContain('m2');
  });

  it('excludes a reserve who is marked Out', () => {
    const members = roster(3);
    const { report } = fill({
      members,
      assignments: [reserve('m0')],
      availability: avail([
        ['m0', 'out'],
        ['m1', 'in'],
      ]),
    });

    expect(report.seated.map((p) => p.memberId)).not.toContain('m0');
  });

  it('skips members seated in another crew of the category, but not its reserves', () => {
    const members = roster(12);
    const { report } = fill({
      members,
      categoryAssignments: [
        { crewId: 'crew-2', memberId: 'm0', role: 'paddler' },
        { crewId: 'crew-2', memberId: 'm1', role: 'reserve' },
      ],
    });

    const ids = report.seated.map((p) => p.memberId);
    expect(ids).not.toContain('m0');
    expect(ids).toContain('m1');
  });

  it('leaves seats empty rather than inventing paddlers', () => {
    const { report, changes } = fill({ members: roster(3) });

    expect(report.seated).toHaveLength(3);
    expect(report.stillEmpty).toBe(7);
    expect(changes.filter((c) => c.op === 'create')).toHaveLength(3);
  });
});

describe('crew rules', () => {
  it('meets the mixed-crew women minimum when enough women are available', () => {
    // 10s mixed needs women; make most of the pool men so a naive
    // strongest-first pick would fall short.
    const members = roster(14, (i) => ({ gender: i < 4 ? 'female' : 'male' }));
    const { report } = fill({ category: category({ genderClass: 'mixed' }), members });

    const women = report.seated.filter(
      (p) => members.find((m) => m.id === p.memberId)?.gender === 'female',
    );
    expect(women.length).toBeGreaterThanOrEqual(DEFAULT_CLUB_SETTINGS.minWomenMixed[10]);
    expect(report.womenShortfall).toBe(0);
  });

  it('reports the shortfall when the women simply are not there', () => {
    const members = roster(12, (i) => ({ gender: i === 0 ? 'female' : 'male' }));
    const { report } = fill({ category: category({ genderClass: 'mixed' }), members });

    expect(report.womenShortfall).toBe(DEFAULT_CLUB_SETTINGS.minWomenMixed[10] - 1);
  });

  it('considers only women for a women’s crew', () => {
    const members = roster(12, (i) => ({ gender: i % 2 === 0 ? 'female' : 'male' }));
    const { report } = fill({ category: category({ genderClass: 'women' }), members });

    for (const pick of report.seated) {
      expect(members.find((m) => m.id === pick.memberId)?.gender).toBe('female');
    }
  });

  it('stops picking a fixed side once its rows are spoken for', () => {
    // Five rows a side. Six left-only paddlers signed up In, five both-siders
    // only Maybe: a naive tier order would take all six lefts.
    const members = [
      ...roster(6, () => ({ sidePreference: 'left' })),
      ...roster(5, (i) => ({ id: `b${i}`, lastName: `B${i}`, sidePreference: 'both' })).map(
        (m, i) => ({ ...m, id: `b${i}` }),
      ),
    ];
    const { report } = fill({
      members,
      availability: avail(
        members.map((m) => [m.id, m.id.startsWith('m') ? 'in' : 'maybe']),
      ),
    });

    const lefts = report.seated.filter((p) => p.memberId.startsWith('m'));
    expect(lefts).toHaveLength(5);
    expect(report.stillEmpty).toBe(0);
  });
});

describe('the changes produced', () => {
  it('updates own reserves in place and creates rows for newcomers', () => {
    const members = roster(3);
    const { changes } = fill({
      category: category(),
      members,
      assignments: [reserve('m0')],
      availability: avail([['m1', 'in']]),
    });

    const update = changes.find((c) => c.op === 'update');
    expect(update).toMatchObject({ id: 'a-m0', patch: { role: 'paddler' } });
    expect(changes.filter((c) => c.op === 'create').length).toBeGreaterThan(0);
  });

  it('gives every proposed paddler a distinct empty seat', () => {
    const members = roster(12);
    const { changes } = fill({
      members,
      assignments: [seated('x1', 1, 'left'), seated('x2', 1, 'right')],
    });

    const seats = changes
      .filter((c) => c.op !== 'delete')
      .map((c) => (c.op === 'create' ? c.assignment.seat : c.patch.seat))
      .filter((s): s is NonNullable<typeof s> => s != null);

    const keys = seats.map((s) => `${s.row}-${s.side}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('1-left');
    expect(keys).not.toContain('1-right');
  });

  it('never moves a paddler who is already seated', () => {
    const members = roster(12);
    const { changes } = fill({
      members,
      assignments: [seated('x1', 3, 'left')],
    });

    expect(changes.some((c) => c.op === 'update' && c.id === 'a-x1')).toBe(false);
  });
});

describe('drummer and cox', () => {
  it('adds a qualified drummer and cox from the leftover pool', () => {
    const members = roster(14, (i) => ({
      canDrum: i === 12,
      canSteer: i === 13,
    }));
    const { changes, report } = fill({ members });

    expect(report.drummerAddedId).toBe('m12');
    expect(report.coxAddedId).toBe('m13');
    expect(changes.filter((c) => c.op === 'create' && c.assignment.role === 'drummer')).toHaveLength(1);
  });

  it('reports when nobody qualified is left', () => {
    const { report } = fill({ members: roster(4) });

    expect(report.drummerStillMissing).toBe(true);
    expect(report.coxStillMissing).toBe(true);
  });

  it('does not spend a needed paddler on the drum', () => {
    // Exactly ten paddlers for ten seats; one of them can drum. Seats win.
    const members = roster(10, (i) => ({ canDrum: i === 0 }));
    const { report } = fill({ members });

    expect(report.stillEmpty).toBe(0);
    expect(report.drummerAddedId).toBeUndefined();
    expect(report.drummerStillMissing).toBe(true);
  });

  it('fills the drum and steering only from the signed-up bench', () => {
    // The only qualified drummer and cox never signed up.
    const members = roster(12, (i) => ({ canDrum: i === 10, canSteer: i === 11 }));
    const { report } = fill({
      members,
      availability: avail(members.slice(0, 10).map((m) => [m.id, 'in'])),
    });

    expect(report.drummerAddedId).toBeUndefined();
    expect(report.coxAddedId).toBeUndefined();
    expect(report.drummerStillMissing).toBe(true);
    expect(report.coxStillMissing).toBe(true);
  });
});
