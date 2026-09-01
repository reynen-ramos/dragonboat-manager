import { describe, expect, it } from 'vitest';
import {
  disciplineLabel,
  personalBests,
  progressSeries,
  rankSession,
} from './timeTrials';
import type { TimeTrialResult, TimeTrialSession } from './types';

const session = (
  id: string,
  date: string,
  distanceM = 200,
  discipline: string | undefined = 'oc1',
): TimeTrialSession => ({ id, date, distanceM, discipline });

let n = 0;
const result = (sessionId: string, memberId: string, timeMs?: number): TimeTrialResult => ({
  id: `r${++n}`,
  sessionId,
  memberId,
  timeMs,
});

describe('rankSession', () => {
  it('ranks by time with shared placements for ties and the untimed last', () => {
    const ranked = rankSession([
      result('s1', 'slow', 70_000),
      result('s1', 'fast-a', 65_000),
      result('s1', 'fast-b', 65_000),
      result('s1', 'unraced'),
      result('s1', 'nan', NaN),
    ]);

    expect(ranked.map((r) => [r.row.memberId, r.placement])).toEqual([
      ['fast-a', 1],
      ['fast-b', 1],
      ['slow', 3], // after a shared 1st comes 3rd, as on any results sheet
      ['unraced', undefined],
      ['nan', undefined], // NaN is untimed, never fastest
    ]);
    expect(ranked[2].deltaMs).toBe(5_000);
  });
});

describe('personalBests', () => {
  it('keeps the best time per member per kind of trial, never across kinds', () => {
    const sessions = [
      session('early', '2026-03-01'),
      session('late', '2026-05-01'),
      session('erg', '2026-04-01', 500, 'erg'),
    ];
    const results = [
      result('early', 'm1', 68_000),
      result('late', 'm1', 66_000), // improved — this is the PB
      result('erg', 'm1', 110_000), // a different kind: its own PB
      result('early', 'm2', 70_000),
      result('late', 'm2'), // untimed — cannot beat anything
    ];

    const bests = personalBests(sessions, results);
    const m1oc1 = bests.find((b) => b.memberId === 'm1' && b.discipline === 'oc1');
    expect(m1oc1).toMatchObject({ timeMs: 66_000, sessionId: 'late', distanceM: 200 });
    expect(bests.find((b) => b.memberId === 'm1' && b.discipline === 'erg')?.timeMs).toBe(110_000);
    expect(bests.find((b) => b.memberId === 'm2')?.timeMs).toBe(70_000);
    expect(bests).toHaveLength(3);
  });

  it('dates a best from when it was first set, and skips broken session links', () => {
    const sessions = [session('early', '2026-03-01'), session('late', '2026-05-01')];
    const results = [
      result('early', 'm1', 66_000),
      result('late', 'm1', 66_000), // equalled, not beaten — the date stands
      result('gone', 'm1', 1_000), // session no longer exists
    ];

    const [best] = personalBests(sessions, results);
    expect(best).toMatchObject({ timeMs: 66_000, date: '2026-03-01', sessionId: 'early' });
  });
});

describe('progressSeries', () => {
  it('groups one member’s timed runs per kind, oldest first', () => {
    const sessions = [
      session('late', '2026-05-01'),
      session('early', '2026-03-01'),
      session('erg', '2026-04-01', 500, 'erg'),
    ];
    const results = [
      result('late', 'm1', 66_000),
      result('early', 'm1', 68_000),
      result('erg', 'm1', 110_000),
      result('late', 'm1'), // m1 listed untimed elsewhere — not a data point
      result('early', 'm2', 60_000), // someone else — not in m1's series
    ];

    const series = progressSeries('m1', sessions, results);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ distanceM: 200, discipline: 'oc1' });
    expect(series[0].points.map((p) => p.timeMs)).toEqual([68_000, 66_000]);
    expect(series[0].points.map((p) => p.date)).toEqual(['2026-03-01', '2026-05-01']);
    expect(series[1]).toMatchObject({ distanceM: 500, discipline: 'erg' });
  });

  it('separates equal distances on different disciplines', () => {
    const sessions = [session('a', '2026-03-01', 200, 'oc1'), session('b', '2026-03-08', 200, 'erg')];
    const results = [result('a', 'm1', 66_000), result('b', 'm1', 50_000)];

    expect(progressSeries('m1', sessions, results)).toHaveLength(2);
  });
});

describe('disciplineLabel', () => {
  it('resolves settings first, then built-ins, then the raw id', () => {
    const custom = [{ id: 'oc1', label: 'Outrigger' }];
    expect(disciplineLabel('oc1', custom)).toBe('Outrigger');
    expect(disciplineLabel('erg', custom)).toBe('Erg');
    expect(disciplineLabel('mystery', custom)).toBe('mystery');
  });
});
