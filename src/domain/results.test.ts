import { describe, expect, it } from 'vitest';
import { formatRaceTime, parseRaceTime } from './dates';
import { compareGroups, formatDelta, groupLabel, raceCountsByStage, rankEntries } from './results';
import type { RaceEntry, RaceStage } from './types';

let n = 0;
const entry = (
  timeMs: number | undefined,
  stage: RaceStage = 'heat',
  heat = 1,
  crewId = `crew-${++n}`,
): RaceEntry => ({
  id: `entry-${n}`,
  crewId,
  stage,
  heat,
  ...(timeMs === undefined ? {} : { timeMs }),
});

const placements = (entries: RaceEntry[]) =>
  rankEntries(entries)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
    .map((r) => r.placement);

describe('rankEntries', () => {
  it('places the fastest crew first', () => {
    const ranked = rankEntries([entry(125_000), entry(121_500), entry(130_000)]);
    const first = ranked.find((r) => r.placement === 1);
    expect(first?.entry.timeMs).toBe(121_500);
  });

  it('reports each crew\'s gap to the winner', () => {
    const ranked = rankEntries([entry(121_500), entry(123_000)]);
    expect(ranked.find((r) => r.placement === 1)?.deltaMs).toBe(0);
    expect(ranked.find((r) => r.placement === 2)?.deltaMs).toBe(1_500);
  });

  it('ranks each heat separately', () => {
    const ranked = rankEntries([
      entry(130_000, 'heat', 1),
      entry(125_000, 'heat', 2),
      entry(140_000, 'heat', 2),
    ]);
    // The 130s crew wins heat 1 despite being slower than heat 2's winner.
    expect(ranked.filter((r) => r.placement === 1)).toHaveLength(2);
  });

  it('keeps heats, semis, and finals apart', () => {
    const ranked = rankEntries([entry(130_000, 'heat'), entry(128_000, 'final')]);
    expect(ranked.every((r) => r.placement === 1)).toBe(true);
  });

  it('shares a placement on a tie and skips the next, as results sheets do', () => {
    expect(placements([entry(120_000), entry(120_000), entry(125_000)])).toEqual([1, 1, 3]);
  });

  it('leaves crews without a time unranked', () => {
    const ranked = rankEntries([entry(120_000), entry(undefined)]);
    const unranked = ranked.filter((r) => r.placement === undefined);
    expect(unranked).toHaveLength(1);
    expect(unranked[0].deltaMs).toBeUndefined();
  });

  it('returns every entry it was given', () => {
    const entries = [entry(120_000), entry(undefined), entry(119_000, 'final')];
    expect(rankEntries(entries)).toHaveLength(3);
  });

  it('treats a missing heat number as heat 1', () => {
    const withHeat: RaceEntry = { id: 'a', crewId: 'c1', stage: 'heat', heat: 1, timeMs: 120_000 };
    const withoutHeat: RaceEntry = { id: 'b', crewId: 'c2', stage: 'heat', timeMs: 130_000 };
    expect(placements([withHeat, withoutHeat])).toEqual([1, 2]);
  });
});

describe('compareGroups', () => {
  it('runs heats, then semis, then finals', () => {
    const order = [entry(0, 'final'), entry(0, 'heat'), entry(0, 'semi')]
      .sort(compareGroups)
      .map((e) => e.stage);
    expect(order).toEqual(['heat', 'semi', 'final']);
  });

  it('orders heats by number', () => {
    const order = [entry(0, 'heat', 3), entry(0, 'heat', 1), entry(0, 'heat', 2)]
      .sort(compareGroups)
      .map((e) => e.heat);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe('formatDelta', () => {
  it('is blank for the winner and for crews with no time', () => {
    expect(formatDelta(0)).toBe('');
    expect(formatDelta(undefined)).toBe('');
  });

  it('shows hundredths behind the winner', () => {
    expect(formatDelta(1_420)).toBe('+1.42');
  });
});

describe('race time parsing and formatting', () => {
  it('round-trips a typical 500m time', () => {
    const ms = parseRaceTime('2:05.42');
    expect(ms).toBe(125_420);
    expect(formatRaceTime(ms!)).toBe('2:05.420');
  });

  it('accepts seconds alone', () => {
    expect(parseRaceTime('48.9')).toBe(48_900);
  });

  it('rejects nonsense rather than storing a wrong time', () => {
    expect(parseRaceTime('abc')).toBeUndefined();
    expect(parseRaceTime('')).toBeUndefined();
    expect(parseRaceTime('1:2:3')).toBeUndefined();
  });
});

describe('a NaN finish time', () => {
  const entry = (id: string, timeMs?: number): RaceEntry => ({
    id,
    crewId: id,

    stage: 'heat',
    heat: 1,
    timeMs,
  });

  it('does not take the win', () => {
    // `typeof NaN === 'number'`, so the old guard let it sort to the front
    // and pushed the crew that actually won down to second.
    const ranked = rankEntries([entry('bad', NaN), entry('real', 120_000)]);

    const winner = ranked.find((r) => r.placement === 1);
    expect(winner?.entry.id).toBe('real');
  });

  it('is treated as no time at all', () => {
    const ranked = rankEntries([entry('bad', NaN), entry('real', 120_000)]);

    expect(ranked.find((r) => r.entry.id === 'bad')?.placement).toBeUndefined();
  });
});

describe('groupLabel', () => {
  it('leaves a lone race unnumbered', () => {
    expect(groupLabel('heat', 1, 1)).toBe('Heat');
    expect(groupLabel('semi', 1, 1)).toBe('Semi-final');
    expect(groupLabel('final', 1, 1)).toBe('Final');
  });

  it('numbers semi-finals by how many semis there are', () => {
    // Passing the heat count meant one heat plus two semis rendered both
    // semis as "Semi-final" — two identical headings for different races.
    expect(groupLabel('semi', 1, 2)).toBe('Semi-final 1');
    expect(groupLabel('semi', 2, 2)).toBe('Semi-final 2');
  });

  it('letters the finals, as a regatta writes them', () => {
    expect(groupLabel('final', 1, 2)).toBe('A Final');
    expect(groupLabel('final', 2, 2)).toBe('B Final');
  });
});

describe('raceCountsByStage', () => {
  it('counts each stage separately', () => {
    const e = (stage: RaceEntry['stage'], heat: number): RaceEntry => ({
      id: `${stage}${heat}`,
      crewId: 'c',

      stage,
      heat,
    });

    const counts = raceCountsByStage([e('heat', 1), e('heat', 2), e('heat', 3), e('semi', 1)]);

    expect(counts).toEqual({ heat: 3, semi: 1, final: 0 });
  });
});
