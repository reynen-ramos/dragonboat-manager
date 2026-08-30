import { describe, expect, it } from 'vitest';
import { BUILTIN_EVENT_TYPES } from './eventTypes';
import { buildMemberHistory, type MemberHistoryInput } from './memberHistory';
import type {
  Availability,
  Category,
  ClubEvent,
  Crew,
  StoredAssignment,
} from './types';

const TODAY = '2026-08-27';

const event = (id: string, startDate: string, over: Partial<ClubEvent> = {}): ClubEvent => ({
  id,
  name: `Event ${id}`,
  type: 'race',
  startDate,
  ...over,
});

const category = (id: string, eventId: string, over: Partial<Category> = {}): Category => ({
  id,
  eventId,
  boatSize: 20,
  genderClass: 'open',
  ...over,
});

const crew = (id: string, categoryId: string, over: Partial<Crew> = {}): Crew => ({
  id,
  categoryId,
  name: `Crew ${id}`,
  ...over,
});

const seat = (
  crewId: string,
  row: number,
  side: 'left' | 'right' = 'left',
): StoredAssignment => ({
  id: `a-${crewId}-${row}-${side}`,
  crewId,
  memberId: 'me',
  role: 'paddler',
  seat: { row, side },
});

const answer = (eventId: string, status: Availability['status']): Availability => ({
  eventId,
  memberId: 'me',
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const history = (over: Partial<MemberHistoryInput>) =>
  buildMemberHistory({
    today: TODAY,
    events: [],
    categories: [],
    crews: [],
    assignments: [],
    availability: [],
    eventTypes: BUILTIN_EVENT_TYPES,
    ...over,
  });

describe('grouping', () => {
  it('collects several crews at one event into one row', () => {
    // Racing the Mixed and the Open at one regatta is normal.
    const result = history({
      events: [event('e1', '2026-05-01')],
      categories: [category('c1', 'e1'), category('c2', 'e1', { genderClass: 'mixed' })],
      crews: [crew('k1', 'c1'), crew('k2', 'c2')],
      assignments: [seat('k1', 1), seat('k2', 4, 'right')],
    });

    expect(result.past).toHaveLength(1);
    expect(result.past[0].participations).toHaveLength(2);
  });

  it('includes an event they answered but were never seated at', () => {
    // An Out answer is history too — it is the difference between
    // "never asked" and "asked and could not make it".
    const result = history({
      events: [event('e1', '2026-05-01')],
      availability: [answer('e1', 'out')],
    });

    expect(result.past).toHaveLength(1);
    expect(result.past[0].status).toBe('out');
    expect(result.past[0].participations).toEqual([]);
  });

  it('skips assignments whose crew, category, or event is gone', () => {
    const result = history({
      events: [event('e1', '2026-05-01')],
      categories: [category('c1', 'e-deleted')],
      crews: [crew('k1', 'c1'), crew('k-orphan', 'c-deleted')],
      assignments: [seat('k1', 1), seat('k-orphan', 2), seat('k-deleted', 3)],
    });

    expect(result.past).toEqual([]);
    expect(result.upcoming).toEqual([]);
  });
});

describe('drafts are not history', () => {
  it('excludes participations in variant crews from rows and stats', () => {
    const result = history({
      events: [event('e1', '2026-05-01')],
      categories: [category('c1', 'e1')],
      crews: [crew('k1', 'c1'), crew('k2', 'c1', { variantOf: 'k1' })],
      assignments: [seat('k2', 1)],
    });

    expect(result.past).toEqual([]);
    expect(result.summary.racesCrewed).toBe(0);
  });
});

describe('past and upcoming', () => {
  it('splits on today, honouring a multi-day event end date', () => {
    const result = history({
      events: [
        event('gone', '2026-05-01'),
        event('running', '2026-08-25', { endDate: '2026-08-30' }),
        event('ahead', '2026-09-10'),
      ],
      availability: [answer('gone', 'in'), answer('running', 'in'), answer('ahead', 'maybe')],
    });

    expect(result.past.map((r) => r.event.id)).toEqual(['gone']);
    expect(result.upcoming.map((r) => r.event.id)).toEqual(['running', 'ahead']);
  });

  it('orders history newest first and upcoming soonest first', () => {
    const result = history({
      events: [
        event('a', '2026-03-01'),
        event('b', '2026-06-01'),
        event('c', '2026-09-01'),
        event('d', '2026-10-01'),
      ],
      availability: (['a', 'b', 'c', 'd'] as const).map((id) => answer(id, 'in')),
    });

    expect(result.past.map((r) => r.event.id)).toEqual(['b', 'a']);
    expect(result.upcoming.map((r) => r.event.id)).toEqual(['c', 'd']);
  });
});

describe('summary', () => {
  it('counts races and practices they actually crewed, reserve rides excluded', () => {
    const reserveRow: StoredAssignment = {
      id: 'a-res',
      crewId: 'k3',
      memberId: 'me',
      role: 'reserve',
    };
    const result = history({
      events: [
        event('race1', '2026-05-01'),
        event('prac1', '2026-05-08', { type: 'practice' }),
        event('race2', '2026-05-15'),
      ],
      categories: [category('c1', 'race1'), category('c2', 'prac1'), category('c3', 'race2')],
      crews: [crew('k1', 'c1'), crew('k2', 'c2'), crew('k3', 'c3')],
      assignments: [seat('k1', 1), seat('k2', 2), reserveRow],
    });

    expect(result.summary.racesCrewed).toBe(1);
    expect(result.summary.practicesCrewed).toBe(1);
  });

  it('counts custom types by the behaviour they declare, not their id', () => {
    const result = history({
      events: [
        event('tt', '2026-05-01', { type: 'time-trial' }),
        event('gym', '2026-05-08', { type: 'gym-session' }),
      ],
      categories: [category('c1', 'tt'), category('c2', 'gym')],
      crews: [crew('k1', 'c1'), crew('k2', 'c2')],
      assignments: [seat('k1', 1), seat('k2', 2)],
      eventTypes: [
        ...BUILTIN_EVENT_TYPES,
        { id: 'time-trial', label: 'Time trial', base: 'race' },
        { id: 'gym-session', label: 'Gym session', base: 'practice' },
      ],
    });

    expect(result.summary.racesCrewed).toBe(1);
    expect(result.summary.practicesCrewed).toBe(1);
  });

  it('counts answers on past events only — next week is not history yet', () => {
    const result = history({
      events: [event('gone', '2026-05-01'), event('ahead', '2026-09-10')],
      availability: [answer('gone', 'in'), answer('ahead', 'in')],
    });

    expect(result.summary.asked).toBe(1);
    expect(result.summary.saidIn).toBe(1);
  });

  it('finds the seat they usually hold, per that boat size’s zones', () => {
    // Row 2 is stroke in a 20s but engine in a 10s — zone follows the boat.
    const result = history({
      events: [event('e1', '2026-05-01'), event('e2', '2026-05-08'), event('e3', '2026-05-15')],
      categories: [
        category('c1', 'e1'),
        category('c2', 'e2'),
        category('c3', 'e3', { boatSize: 10 }),
      ],
      crews: [crew('k1', 'c1'), crew('k2', 'c2'), crew('k3', 'c3')],
      assignments: [seat('k1', 1), seat('k2', 2), seat('k3', 2)],
    });

    expect(result.summary.usualSpot).toEqual({ side: 'left', zone: 'stroke' });
  });

  it('claims no usual spot for someone who has never held a seat', () => {
    const result = history({
      events: [event('e1', '2026-05-01')],
      availability: [answer('e1', 'in')],
    });

    expect(result.summary.usualSpot).toBeUndefined();
  });
});
