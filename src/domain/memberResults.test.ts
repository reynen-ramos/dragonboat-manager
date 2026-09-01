import { describe, expect, it } from 'vitest';
import { buildMemberResults, type MemberResultsInput } from './memberResults';
import type { RaceEntry, StoredAssignment } from './types';

const event = (id: string, startDate: string) => ({ id, name: id, type: 'race', startDate });
const category = (id: string, eventId: string) => ({
  id,
  eventId,
  boatSize: 10 as const,
  genderClass: 'open' as const,
});
const crew = (id: string, categoryId: string, variantOf?: string) => ({
  id,
  categoryId,
  name: id,
  ...(variantOf ? { variantOf } : {}),
});
let n = 0;
const entry = (crewId: string, stage: RaceEntry['stage'], heat: number, timeMs?: number): RaceEntry => ({
  id: `e${++n}`,
  crewId,
  stage,
  heat,
  timeMs,
});
const seat = (crewId: string, role: StoredAssignment['role'] = 'paddler'): StoredAssignment => ({
  id: `a${++n}`,
  crewId,
  memberId: 'me',
  role,
  ...(role === 'paddler' ? { seat: { row: 1, side: 'left' as const } } : {}),
});

const base = (): MemberResultsInput => ({
  assignments: [seat('mine')],
  events: [event('regatta', '2026-06-01')],
  categories: [category('cat', 'regatta')],
  crews: [crew('mine', 'cat'), crew('rival', 'cat')],
  raceEntries: [],
});

describe('buildMemberResults', () => {
  it('ranks the crew against its whole category, not alone', () => {
    const input = base();
    input.raceEntries = [
      entry('mine', 'heat', 1, 70_000),
      entry('rival', 'heat', 1, 65_000), // the rival was faster
    ];

    const [row] = buildMemberResults(input);
    expect(row.placement).toBe(2); // second of two, not first-of-my-own-sheet
    expect(row.fieldSize).toBe(2);
    expect(row.deltaMs).toBe(5_000);
    expect(row.raceLabel).toBe('Heat');
  });

  it('labels races count-aware and orders newest event first, programme order within', () => {
    const input = base();
    input.events.push(event('older', '2026-03-01'));
    input.categories.push(category('oldcat', 'older'));
    input.crews.push(crew('oldcrew', 'oldcat'));
    input.assignments.push(seat('oldcrew', 'drummer')); // a drummer raced too
    input.raceEntries = [
      entry('mine', 'final', 1, 64_000),
      entry('mine', 'heat', 2, 66_000),
      entry('mine', 'heat', 1, 65_000),
      entry('oldcrew', 'heat', 1, 70_000),
    ];

    const rows = buildMemberResults(input);
    expect(rows.map((r) => [r.event.id, r.raceLabel])).toEqual([
      ['regatta', 'Heat 1'], // two heats → numbered
      ['regatta', 'Heat 2'],
      ['regatta', 'Final'], // a single final → bare
      ['older', 'Heat'],
    ]);
  });

  it('excludes reserves, variant crews, and untimed runs stay unplaced', () => {
    const input = base();
    input.crews.push(crew('plan-b', 'cat', 'mine'));
    input.assignments = [
      seat('mine', 'reserve'), // cover, not crew
      seat('plan-b'), // a draft counts nowhere
    ];
    input.raceEntries = [entry('mine', 'heat', 1, 65_000)];
    expect(buildMemberResults(input)).toEqual([]);

    input.assignments = [seat('mine')];
    input.raceEntries = [entry('mine', 'heat', 1, undefined)];
    const [row] = buildMemberResults(input);
    expect(row.placement).toBeUndefined();
    expect(row.timeMs).toBeUndefined();
  });

  it('skips broken links silently', () => {
    const input = base();
    input.assignments.push(seat('gone-crew'));
    input.raceEntries = [entry('mine', 'heat', 1, 65_000), entry('ghost-crew', 'heat', 1, 60_000)];

    const rows = buildMemberResults(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].placement).toBe(1); // the ghost entry never joined the field
  });
});
