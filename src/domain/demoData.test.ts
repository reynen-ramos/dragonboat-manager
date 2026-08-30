import { describe, expect, it } from 'vitest';
import { seatKey } from './boat';
import { buildDemoSnapshot } from './demoData';
import { diffLineups } from './lineupDiff';
import { planAdvancement, rankEntries } from './results';
import { DEFAULT_CLUB_SETTINGS } from './rules.config';
import { validateCrew } from './validation';

/**
 * The demo is the first thing anyone sees, and it exercises every feature —
 * so it is tested like the product surface it is. The audit found the old
 * demo had quietly drifted (double-booked officials, fields nothing set);
 * these tests keep the new one honest as the app grows.
 */

const TODAY = '2026-08-27';
const snap = buildDemoSnapshot(TODAY);

const membersById = new Map(snap.members.map((m) => [m.id, m]));
const crewsById = new Map(snap.crews.map((c) => [c.id, c]));
const categoriesById = new Map(snap.categories.map((c) => [c.id, c]));
const eventsById = new Map(snap.events.map((e) => [e.id, e]));

const crewByName = (eventName: string, crewName: string) => {
  const event = snap.events.find((e) => e.name === eventName)!;
  return snap.crews.find((c) => {
    const category = categoriesById.get(c.categoryId);
    return category?.eventId === event.id && c.name === crewName;
  })!;
};

const assignmentsOf = (crewId: string) => snap.assignments.filter((a) => a.crewId === crewId);

describe('referential integrity', () => {
  it('every link resolves', () => {
    for (const c of snap.categories) expect(eventsById.has(c.eventId)).toBe(true);
    for (const c of snap.crews) {
      expect(categoriesById.has(c.categoryId)).toBe(true);
      if (c.variantOf) {
        const primary = crewsById.get(c.variantOf);
        expect(primary).toBeDefined();
        expect(primary!.categoryId).toBe(c.categoryId);
      }
    }
    for (const a of snap.assignments) {
      expect(crewsById.has(a.crewId)).toBe(true);
      expect(membersById.has(a.memberId)).toBe(true);
    }
    for (const av of snap.availability) {
      expect(eventsById.has(av.eventId)).toBe(true);
      expect(membersById.has(av.memberId)).toBe(true);
    }
    for (const r of snap.raceEntries) expect(crewsById.has(r.crewId)).toBe(true);
  });

  it('no crew seats two people in one seat, or one person twice', () => {
    for (const crew of snap.crews) {
      const rows = assignmentsOf(crew.id);
      const seats = rows.filter((a) => a.seat).map((a) => seatKey(a.seat!));
      expect(new Set(seats).size).toBe(seats.length);
      const people = rows.map((a) => a.memberId);
      expect(new Set(people).size).toBe(people.length);
    }
  });

  it('no member races in two real crews of one category', () => {
    for (const category of snap.categories) {
      const real = snap.crews.filter((c) => c.categoryId === category.id && !c.variantOf);
      const seen = new Map<string, string>();
      for (const crew of real) {
        for (const a of assignmentsOf(crew.id).filter((x) => x.role !== 'reserve')) {
          expect(seen.get(a.memberId), `${a.memberId} in ${seen.get(a.memberId)} and ${crew.id}`).toBeUndefined();
          seen.set(a.memberId, crew.id);
        }
      }
    }
  });
});

describe('the season spans time', () => {
  it('has finished events, a race today, and events ahead', () => {
    const starts = snap.events.map((e) => e.startDate);
    expect(starts.some((d) => d < TODAY)).toBe(true);
    expect(starts.some((d) => d > TODAY)).toBe(true);
    expect(snap.events.filter((e) => e.startDate === TODAY)).toHaveLength(1);
    expect(snap.events.some((e) => e.type === 'practice' && e.startDate < TODAY)).toBe(true);
  });

  it('covers all three event kinds, so the calendar shows every colour', () => {
    const kinds = new Set(snap.events.map((e) => e.type));
    expect(kinds).toEqual(new Set(['race', 'practice', 'other']));
  });
});

describe('each feature has something to show', () => {
  it("today's heats are timed and waiting to be advanced", () => {
    const a = crewByName('Harbour Sprint Cup', 'A Crew');
    const b = crewByName('Harbour Sprint Cup', 'B Crew');
    const entries = snap.raceEntries.filter((e) => [a.id, b.id].includes(e.crewId));

    const plan = planAdvancement(entries, 'heat', 'final', { advancing: 2, races: 1 });
    expect('blocked' in plan).toBe(false);
    if (!('blocked' in plan)) expect(plan.advancingCrewIds).toHaveLength(2);
  });

  it('the finished regatta reads like a results sheet', () => {
    const a = crewByName('Autumn Sprints', 'A Crew');
    const ranked = rankEntries(snap.raceEntries.filter((e) => e.crewId === a.id || crewsById.get(e.crewId)?.categoryId === a.categoryId));
    const final = ranked.filter((r) => r.entry.stage === 'final');
    expect(final.map((r) => r.placement).sort()).toEqual([1, 2]);
  });

  it('the championship crew has real problems for the issues panel', () => {
    const crewA = crewByName('Summer Regatta', 'A Crew');
    const issues = validateCrew({
      category: categoriesById.get(crewA.categoryId)!,
      assignments: assignmentsOf(crewA.id),
      members: membersById,
      settings: DEFAULT_CLUB_SETTINGS,
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('SEAT_COUNT_SHORT');
    expect(codes).toContain('MIXED_MIN_WOMEN');
    expect(codes).not.toContain('UNQUALIFIED_COX');
  });

  it('and the women’s crew shows what race-ready looks like', () => {
    const women = crewByName('Summer Regatta', 'Women A');
    const issues = validateCrew({
      category: categoriesById.get(women.categoryId)!,
      assignments: assignmentsOf(women.id),
      members: membersById,
      settings: DEFAULT_CLUB_SETTINGS,
    });
    expect(issues).toEqual([]);
  });

  it('the Plan B differs enough for the comparison to say something', () => {
    const planB = snap.crews.find((c) => c.variantOf)!;
    const diff = diffLineups(assignmentsOf(planB.variantOf!), assignmentsOf(planB.id));
    const kinds = new Set(diff.rows.map((r) => r.kind));
    expect(diff.rows.length).toBeGreaterThanOrEqual(4);
    expect(kinds).toContain('moved');
    expect(kinds).toContain('only-a');
    expect(kinds).toContain('only-b');
  });

  it('the championship exercises every sign-up state', () => {
    const upcoming = snap.events.find((e) => e.name === 'Summer Regatta')!;
    const byMember = new Map(
      snap.availability.filter((a) => a.eventId === upcoming.id).map((a) => [a.memberId, a.status]),
    );
    const statuses = new Set(byMember.values());
    expect(statuses).toContain('in');
    expect(statuses).toContain('maybe');
    expect(statuses).toContain('out');
    const unanswered = snap.members.filter((m) => m.status === 'active' && !byMember.has(m.id));
    expect(unanswered.length).toBeGreaterThanOrEqual(3);
  });

  it('a member history has a past worth reading', () => {
    // Asserted from the raw ingredients rather than buildMemberHistory, which
    // lives in the parallel #17 branch: Maria raced the finished regatta in
    // two boats and answered for the practices, so once both PRs land her
    // page opens with several lines of past and a stroke-side usual spot.
    const maria = snap.members[0];
    const pastRaceEvents = snap.events.filter((e) => e.type === 'race' && e.startDate < TODAY);
    const mariasPastRaceCrews = snap.assignments.filter((a) => {
      if (a.memberId !== maria.id) return false;
      const crew = crewsById.get(a.crewId);
      const category = crew && categoriesById.get(crew.categoryId);
      return Boolean(category && pastRaceEvents.some((e) => e.id === category.eventId));
    });
    expect(mariasPastRaceCrews.length).toBeGreaterThanOrEqual(2);
    expect(mariasPastRaceCrews.every((a) => a.seat?.side === 'left' && a.seat.row === 1)).toBe(true);

    const pastAnswers = snap.availability.filter(
      (a) => a.memberId === maria.id && (eventsById.get(a.eventId)?.startDate ?? '') < TODAY,
    );
    expect(pastAnswers.length).toBeGreaterThanOrEqual(3);
  });

  it('some members declare preferred zones', () => {
    expect(snap.members.filter((m) => m.preferredZones?.length).length).toBeGreaterThanOrEqual(5);
  });
});
