import { describe, expect, it } from 'vitest';
import { DEFAULT_CLUB_SETTINGS } from './rules.config';
import { makeMember } from './testing';
import type {
  Assignment,
  AvailabilityStatus,
  BoatSize,
  Category,
  GenderClass,
  Member,
} from './types';
import { validateCrew, type Issue, type ValidationInput } from './validation';

const settings = DEFAULT_CLUB_SETTINGS;

const category = (
  boatSize: BoatSize,
  genderClass: GenderClass,
  extra: Partial<Category> = {},
): Category => ({
  id: 'cat-1',
  eventId: 'event-1',
  boatSize,
  genderClass,
  ...extra,
});

/**
 * Builds a full, legal crew: N paddlers seated, one drummer, one cox.
 *
 * Paddlers get a weight by default so the baseline crew is completely clean —
 * tests that care about missing weights pass `weightKg: undefined` explicitly.
 */
function fullCrew(
  boatSize: BoatSize,
  memberFor: (index: number) => Partial<Member> = () => ({}),
): { assignments: Assignment[]; members: Map<string, Member> } {
  const members = new Map<string, Member>();
  const assignments: Assignment[] = [];
  const rows = boatSize / 2;

  for (let i = 0; i < boatSize; i++) {
    const member = makeMember({ id: `p${i}`, weightKg: 75, ...memberFor(i) });
    members.set(member.id, member);
    assignments.push({
      id: `a${i}`,
      crewId: 'crew-1',
      memberId: member.id,
      role: 'paddler',
      seat: { row: (i % rows) + 1, side: i < rows ? 'left' : 'right' },
    });
  }

  for (const role of ['drummer', 'cox'] as const) {
    // Qualified, so the baseline crew really is clean — validateCrew warns
    // about a drummer who is not recorded as able to drum.
    const member = makeMember({
      id: role,
      canDrum: role === 'drummer',
      canSteer: role === 'cox',
    });
    members.set(member.id, member);
    assignments.push({ id: `a-${role}`, crewId: 'crew-1', memberId: member.id, role });
  }

  return { assignments, members };
}

const run = (input: Partial<ValidationInput> & Pick<ValidationInput, 'category'>): Issue[] =>
  validateCrew({ assignments: [], members: new Map(), settings, ...input });

const codes = (issues: Issue[]) => issues.map((i) => i.code);

describe('seat counts', () => {
  it('passes a full 20s crew', () => {
    const { assignments, members } = fullCrew(20);
    expect(codes(run({ category: category(20, 'open'), assignments, members }))).toEqual([]);
  });

  it('passes a full 10s crew', () => {
    const { assignments, members } = fullCrew(10);
    expect(codes(run({ category: category(10, 'open'), assignments, members }))).toEqual([]);
  });

  it('errors when seats are empty, naming how many', () => {
    const { assignments, members } = fullCrew(20);
    const short = assignments.filter((a) => a.id !== 'a0');
    const issues = run({ category: category(20, 'open'), assignments: short, members });

    expect(codes(issues)).toContain('SEAT_COUNT_SHORT');
    expect(issues.find((i) => i.code === 'SEAT_COUNT_SHORT')?.message).toContain('19 of 20');
  });

  it('errors when the boat is over-filled', () => {
    const { assignments, members } = fullCrew(10);
    const extra = makeMember({ id: 'extra' });
    members.set(extra.id, extra);
    const issues = run({
      category: category(10, 'open'),
      assignments: [
        ...assignments,
        { id: 'a-extra', crewId: 'crew-1', memberId: extra.id, role: 'paddler', seat: { row: 1, side: 'left' } },
      ],
      members,
    });

    expect(codes(issues)).toContain('SEAT_COUNT_OVER');
    expect(codes(issues)).toContain('DUPLICATE_SEAT');
  });

  it('does not count a paddler with no seat toward the seat count', () => {
    // A crew can hold a paddler who was never given a seat — the boat has an
    // empty bench, but nothing in the roster shows it. Counting them as seated
    // certifies a short crew as ready to race.
    const { assignments, members } = fullCrew(10);
    const withUnseated = assignments.map((a) =>
      a.id === 'a0' ? { ...a, seat: undefined } : a,
    );
    const issues = run({ category: category(10, 'open'), assignments: withUnseated, members });

    expect(codes(issues)).toContain('SEAT_COUNT_SHORT');
    expect(issues.find((i) => i.code === 'SEAT_COUNT_SHORT')?.message).toContain('9 of 10');
  });

  it('names each paddler left without a seat', () => {
    const { assignments, members } = fullCrew(10);
    const withUnseated = assignments.map((a) =>
      a.id === 'a0' || a.id === 'a1' ? { ...a, seat: undefined } : a,
    );
    const issues = run({ category: category(10, 'open'), assignments: withUnseated, members });

    const unseated = issues.filter((i) => i.code === 'PADDLER_NOT_SEATED');
    expect(unseated).toHaveLength(2);
    expect(unseated[0].level).toBe('error');
    expect(unseated.map((i) => i.memberId)).toEqual(['p0', 'p1']);
  });
});

describe('drummer and cox', () => {
  it('warns when the drummer is missing', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments: assignments.filter((a) => a.role !== 'drummer'),
      members,
    });

    const issue = issues.find((i) => i.code === 'NO_DRUMMER');
    expect(issue?.level).toBe('warning');
  });

  it('warns when the cox is missing', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments: assignments.filter((a) => a.role !== 'cox'),
      members,
    });

    expect(issues.find((i) => i.code === 'NO_COX')?.level).toBe('warning');
  });

  it('errors on a second drummer', () => {
    const { assignments, members } = fullCrew(20);
    const second = makeMember({ id: 'drummer2' });
    members.set(second.id, second);
    const issues = run({
      category: category(20, 'open'),
      assignments: [...assignments, { id: 'a-d2', crewId: 'crew-1', memberId: second.id, role: 'drummer' }],
      members,
    });

    expect(issues.find((i) => i.code === 'MULTIPLE_DRUMMERS')?.level).toBe('error');
  });
});

describe('gender class', () => {
  it("errors for a man seated in a women's crew", () => {
    const { assignments, members } = fullCrew(20, (i) => ({
      gender: i === 0 ? 'male' : 'female',
    }));
    const issues = run({ category: category(20, 'women'), assignments, members });

    const issue = issues.find((i) => i.code === 'WOMEN_ONLY_VIOLATION');
    expect(issue?.level).toBe('error');
    expect(issue?.memberId).toBe('p0');
  });

  it("passes an all-female women's crew", () => {
    const { assignments, members } = fullCrew(20, () => ({ gender: 'female' }));
    expect(codes(run({ category: category(20, 'women'), assignments, members }))).toEqual([]);
  });

  it('errors when a mixed 20s crew has fewer than 8 women', () => {
    const { assignments, members } = fullCrew(20, (i) => ({
      gender: i < 7 ? 'female' : 'male',
    }));
    const issues = run({ category: category(20, 'mixed'), assignments, members });

    const issue = issues.find((i) => i.code === 'MIXED_MIN_WOMEN');
    expect(issue?.level).toBe('error');
    expect(issue?.message).toContain('at least 8 women');
    expect(issue?.message).toContain('has 7');
  });

  it('clears once the eighth woman is seated', () => {
    const { assignments, members } = fullCrew(20, (i) => ({
      gender: i < 8 ? 'female' : 'male',
    }));
    expect(codes(run({ category: category(20, 'mixed'), assignments, members }))).not.toContain(
      'MIXED_MIN_WOMEN',
    );
  });

  it('requires only 4 women in a mixed 10s crew', () => {
    const { assignments, members } = fullCrew(10, (i) => ({
      gender: i < 4 ? 'female' : 'male',
    }));
    expect(codes(run({ category: category(10, 'mixed'), assignments, members }))).not.toContain(
      'MIXED_MIN_WOMEN',
    );
  });

  it('honours a club-specific minimum rather than the default', () => {
    const { assignments, members } = fullCrew(20, (i) => ({
      gender: i < 8 ? 'female' : 'male',
    }));
    const issues = validateCrew({
      category: category(20, 'mixed'),
      assignments,
      members,
      settings: { ...settings, minWomenMixed: { 10: 5, 20: 10 } },
    });

    expect(codes(issues)).toContain('MIXED_MIN_WOMEN');
  });

  it('places no gender constraint on an open crew', () => {
    const { assignments, members } = fullCrew(20, () => ({ gender: 'male' }));
    expect(codes(run({ category: category(20, 'open'), assignments, members }))).toEqual([]);
  });
});

describe('cross-crew and availability checks', () => {
  it('errors when a paddler is also racing in another crew in the same category', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      categoryAssignments: [{ crewId: 'crew-2', memberId: 'p3', role: 'paddler' }],
    });

    const issue = issues.find((i) => i.code === 'DOUBLE_BOOKED');
    expect(issue?.level).toBe('error');
    expect(issue?.memberId).toBe('p3');
  });

  it('ignores the crew being validated when checking for double booking', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      categoryAssignments: assignments.map((a) => ({
        crewId: a.crewId,
        memberId: a.memberId,
        role: a.role,
      })),
    });

    expect(codes(issues)).not.toContain('DOUBLE_BOOKED');
  });

  it('warns when a seated paddler said they were out', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      availability: new Map([['p5', 'out']]),
    });

    const issue = issues.find((i) => i.code === 'UNAVAILABLE');
    expect(issue?.level).toBe('warning');
    expect(issue?.memberId).toBe('p5');
  });

  it('does not warn about paddlers signed up In or Maybe', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      availability: new Map<string, AvailabilityStatus>(
        assignments.map((a) => [a.memberId, a.memberId === 'p2' ? 'maybe' : 'in']),
      ),
    });

    expect(codes(issues)).not.toContain('UNAVAILABLE');
    expect(codes(issues)).not.toContain('NOT_SIGNED_UP');
  });

  it('warns when a seated paddler has not signed up', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      availability: new Map<string, AvailabilityStatus>(
        assignments.filter((a) => a.memberId !== 'p7').map((a) => [a.memberId, 'in']),
      ),
    });

    const unsigned = issues.filter((i) => i.code === 'NOT_SIGNED_UP');
    expect(unsigned).toHaveLength(1);
    expect(unsigned[0]).toMatchObject({
      level: 'warning',
      memberId: 'p7',
      seat: { row: 8, side: 'left' },
    });
  });

  it('stays silent about sign-ups when nobody has signed up at all', () => {
    // An event where sign-ups are simply not in use must not warn per seat.
    const { assignments, members } = fullCrew(20);
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      availability: new Map(),
    });

    expect(codes(issues)).not.toContain('NOT_SIGNED_UP');
  });

  it('stays silent about sign-ups when no availability is supplied', () => {
    const { assignments, members } = fullCrew(20);
    const issues = run({ category: category(20, 'open'), assignments, members });

    expect(codes(issues)).not.toContain('NOT_SIGNED_UP');
  });

  it('does not ask reserves to sign up', () => {
    const { assignments, members } = fullCrew(20);
    members.set('r1', makeMember({ id: 'r1' }));
    assignments.push({ id: 'a-r1', crewId: 'crew-1', memberId: 'r1', role: 'reserve' });
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      availability: new Map<string, AvailabilityStatus>(
        assignments.filter((a) => a.role !== 'reserve').map((a) => [a.memberId, 'in']),
      ),
    });

    expect(codes(issues)).not.toContain('NOT_SIGNED_UP');
  });
});

describe('age divisions', () => {
  it('warns when a paddler is too young for a senior division', () => {
    const { assignments, members } = fullCrew(20, (i) =>
      i === 0 ? { dateOfBirth: '2000-06-01' } : { dateOfBirth: '1970-06-01' },
    );
    const issues = run({
      category: category(20, 'open', { ageDivision: 'seniorA' }),
      assignments,
      members,
      eventDate: '2026-08-01',
    });

    const issue = issues.find((i) => i.code === 'AGE_DIVISION');
    expect(issue?.level).toBe('warning');
    expect(issue?.memberId).toBe('p0');
  });

  it('warns when a paddler is too old for a junior division', () => {
    const { assignments, members } = fullCrew(20, (i) =>
      i === 0 ? { dateOfBirth: '1990-01-01' } : { dateOfBirth: '2012-01-01' },
    );
    const issues = run({
      category: category(20, 'open', { ageDivision: 'junior' }),
      assignments,
      members,
      eventDate: '2026-08-01',
    });

    expect(issues.find((i) => i.code === 'AGE_DIVISION')?.memberId).toBe('p0');
  });

  it('stays quiet when no age division is set', () => {
    const { assignments, members } = fullCrew(20, () => ({ dateOfBirth: '2000-06-01' }));
    const issues = run({
      category: category(20, 'open'),
      assignments,
      members,
      eventDate: '2026-08-01',
    });

    expect(codes(issues)).not.toContain('AGE_DIVISION');
  });
});

describe('missing data', () => {
  it('reports missing weights as info, not an error', () => {
    const { assignments, members } = fullCrew(20, (i) =>
      i < 3 ? { weightKg: undefined } : { weightKg: 75 },
    );
    const issue = run({ category: category(20, 'open'), assignments, members }).find(
      (i) => i.code === 'MISSING_WEIGHT',
    );

    expect(issue?.level).toBe('info');
    expect(issue?.message).toContain('3 seated paddlers');
  });

  it('warns per paddler seated against their side preference', () => {
    const { assignments, members } = fullCrew(20, (i) =>
      i === 0 ? { sidePreference: 'right' } : { sidePreference: 'both' },
    );
    // p0 is seated row 1 left by fullCrew, but only paddles right.
    const issues = run({ category: category(20, 'open'), assignments, members });

    const issue = issues.find((i) => i.code === 'SIDE_PREFERENCE');
    expect(issue?.level).toBe('warning');
    expect(issue?.memberId).toBe('p0');
  });
});

describe('drummer and cox qualifications', () => {
  it('warns about a cox not recorded as able to steer', () => {
    // canSteer is collected on the member form and shown on member cards,
    // and until now nothing ever checked it.
    const { assignments, members } = fullCrew(10);
    members.set('cox', makeMember({ id: 'cox', canSteer: false }));

    const issues = run({ category: category(10, 'open'), assignments, members });
    const issue = issues.find((i) => i.code === 'UNQUALIFIED_COX');

    expect(issue?.level).toBe('warning');
    expect(issue?.memberId).toBe('cox');
  });

  it('warns about a drummer not recorded as able to drum', () => {
    const { assignments, members } = fullCrew(10);
    members.set('drummer', makeMember({ id: 'drummer', canDrum: false }));

    expect(codes(run({ category: category(10, 'open'), assignments, members }))).toContain(
      'UNQUALIFIED_DRUMMER',
    );
  });

  it('says nothing when both are qualified', () => {
    const { assignments, members } = fullCrew(10);

    expect(codes(run({ category: category(10, 'open'), assignments, members }))).toEqual([]);
  });
});

describe('reserves in another crew', () => {
  it('are not a double booking', () => {
    // Being a spare for the other boat in the same category is normal.
    // Reserves were excluded on this side of the comparison but not the
    // other, so it was reported as a blocking error.
    const { assignments, members } = fullCrew(10);
    const issues = run({
      category: category(10, 'open'),
      assignments,
      members,
      categoryAssignments: [{ crewId: 'crew-2', memberId: 'p3', role: 'reserve' }],
    });

    expect(codes(issues)).not.toContain('DOUBLE_BOOKED');
  });

  it('still flags someone actually seated in the other crew', () => {
    const { assignments, members } = fullCrew(10);
    const issues = run({
      category: category(10, 'open'),
      assignments,
      members,
      categoryAssignments: [{ crewId: 'crew-2', memberId: 'p3', role: 'paddler' }],
    });

    expect(codes(issues)).toContain('DOUBLE_BOOKED');
  });
});
