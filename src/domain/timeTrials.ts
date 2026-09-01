import { rankTimes, type RankedTime } from './results';
import type { DisciplineDef, TimeTrialResult, TimeTrialSession } from './types';

/**
 * Individual time trials.
 *
 * A trial times paddlers, not boats: everyone covers the same distance in the
 * same kind of craft, and the sheet answers "who is fast, and who is getting
 * faster". Comparisons only ever happen within one kind of trial — a 200m OC1
 * time says nothing about a 500m erg time — so everything here groups by
 * (distance, discipline) first.
 */

export const BUILTIN_DISCIPLINES: DisciplineDef[] = [
  { id: 'oc1', label: 'OC1' },
  { id: 'erg', label: 'Erg' },
  { id: 'small-boat', label: 'Small boat' },
];

/** The display label for a discipline id; the raw id when unknown. */
export function disciplineLabel(id: string, disciplines: DisciplineDef[]): string {
  return (
    disciplines.find((d) => d.id === id)?.label ??
    BUILTIN_DISCIPLINES.find((d) => d.id === id)?.label ??
    id
  );
}

/** "Selection Trial II" when named; "200m OC1 trial" when not. */
export function sessionTitle(
  session: Pick<TimeTrialSession, 'name' | 'distanceM' | 'discipline'>,
  disciplines: DisciplineDef[],
): string {
  if (session.name?.trim()) return session.name;
  const craft = session.discipline ? ` ${disciplineLabel(session.discipline, disciplines)}` : '';
  return `${session.distanceM}m${craft} trial`;
}

/** What a session tests. Times never compare across different keys. */
export const trialKey = (s: Pick<TimeTrialSession, 'distanceM' | 'discipline'>): string =>
  `${s.distanceM}:${s.discipline ?? ''}`;

/** Ranks one session's results — ties share a placement, untimed sort last. */
export const rankSession = (results: TimeTrialResult[]): RankedTime<TimeTrialResult>[] =>
  rankTimes(results);

export interface PersonalBest {
  memberId: string;
  distanceM: number;
  discipline?: string;
  timeMs: number;
  sessionId: string;
  /** The date the best was first set — a later equal time doesn't move it. */
  date: string;
}

/**
 * Each member's best time per kind of trial, across every session given.
 *
 * Results whose session no longer exists are skipped, the same policy every
 * broken link gets in this codebase.
 */
export function personalBests(
  sessions: TimeTrialSession[],
  results: TimeTrialResult[],
): PersonalBest[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const best = new Map<string, PersonalBest>();

  for (const result of results) {
    if (!Number.isFinite(result.timeMs)) continue;
    const session = sessionById.get(result.sessionId);
    if (!session) continue;

    const key = `${result.memberId}|${trialKey(session)}`;
    const held = best.get(key);
    const beats =
      !held ||
      result.timeMs! < held.timeMs ||
      (result.timeMs === held.timeMs && session.date < held.date);
    if (beats) {
      best.set(key, {
        memberId: result.memberId,
        distanceM: session.distanceM,
        discipline: session.discipline,
        timeMs: result.timeMs!,
        sessionId: session.id,
        date: session.date,
      });
    }
  }

  return [...best.values()];
}

export interface ProgressPoint {
  date: string;
  timeMs: number;
  sessionId: string;
}

export interface ProgressSeries {
  distanceM: number;
  discipline?: string;
  points: ProgressPoint[];
}

/**
 * One member's timed runs, grouped per kind of trial and sorted oldest first —
 * the shape a progress view draws directly. Untimed listings don't appear:
 * being on the sheet without a time is not a data point.
 */
export function progressSeries(
  memberId: string,
  sessions: TimeTrialSession[],
  results: TimeTrialResult[],
): ProgressSeries[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byKind = new Map<string, ProgressSeries>();

  for (const result of results) {
    if (result.memberId !== memberId || !Number.isFinite(result.timeMs)) continue;
    const session = sessionById.get(result.sessionId);
    if (!session) continue;

    const key = trialKey(session);
    const series =
      byKind.get(key) ??
      ({ distanceM: session.distanceM, discipline: session.discipline, points: [] } as ProgressSeries);
    series.points.push({ date: session.date, timeMs: result.timeMs!, sessionId: session.id });
    byKind.set(key, series);
  }

  const list = [...byKind.values()];
  for (const series of list) {
    series.points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  list.sort(
    (a, b) => a.distanceM - b.distanceM || (a.discipline ?? '').localeCompare(b.discipline ?? ''),
  );
  return list;
}
