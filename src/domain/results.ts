import type { RaceEntry, RaceStage } from './types';

/**
 * Race results.
 *
 * Placement is derived from the recorded times rather than stored, so it can
 * never drift out of step with them — correcting a mistyped time re-orders the
 * whole heat for free.
 */

export interface RankedEntry {
  entry: RaceEntry;
  /** 1-based, absent until the crew has a time. Ties share a placement. */
  placement?: number;
  /** Milliseconds behind the fastest crew in the same heat. */
  deltaMs?: number;
}

export const STAGE_LABELS: Record<RaceStage, string> = {
  heat: 'Heat',
  semi: 'Semi-final',
  final: 'Final',
};

const STAGE_ORDER: RaceStage[] = ['heat', 'semi', 'final'];

/** Crews only race each other within a stage and heat number. */
export const groupKey = (entry: RaceEntry): string => `${entry.stage}:${entry.heat ?? 1}`;

/**
 * Labels one race within its stage.
 *
 * `count` is how many races that *same* stage holds. It used to be the heat
 * count for every stage, so three heats and one semi rendered "Semi-final 1",
 * and one heat with two semis rendered both as "Semi-final" -- two identical
 * headings for different races.
 *
 * Finals are lettered, as regattas write them: the A final is the one that
 * decides the medals, the B final is for the crews below it.
 */
export function groupLabel(stage: RaceStage, heat: number | undefined, count: number): string {
  if (count <= 1) return STAGE_LABELS[stage];
  const n = heat ?? 1;
  if (stage === "final") {
    const letter = String.fromCharCode(64 + n); // 1 -> A, 2 -> B
    return n <= 26 ? letter + " Final" : "Final " + n;
  }
  return STAGE_LABELS[stage] + " " + n;
}

/** How many distinct races each stage holds, for `groupLabel`. */
export function raceCountsByStage(entries: RaceEntry[]): Record<RaceStage, number> {
  const seen: Record<RaceStage, Set<number>> = { heat: new Set(), semi: new Set(), final: new Set() };
  for (const entry of entries) seen[entry.stage].add(entry.heat ?? 1);
  return { heat: seen.heat.size, semi: seen.semi.size, final: seen.final.size };
}

/**
 * Ranks the entries within each stage and heat.
 *
 * Callers must pass entries from a single category. Grouping is by stage and
 * heat number only, so a 20s Mixed "Heat 1" and a 10s Women's "Heat 1" handed
 * in together would be ranked as though they raced each other.
 *
 * Ties share a placement and the next placement skips, as in every regatta
 * results sheet: two crews tied for 1st are followed by a 3rd, not a 2nd.
 * Crews with no time yet are returned unranked and sorted last.
 */
export function rankEntries(entries: RaceEntry[]): RankedEntry[] {
  const groups = new Map<string, RaceEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const ranked: RankedEntry[] = [];

  for (const group of groups.values()) {
    const timed = group
      // `typeof NaN === 'number'`, so the old check let a NaN time take
      // placement 1 and push the real times down the sheet.
      .filter((e): e is RaceEntry & { timeMs: number } => Number.isFinite(e.timeMs))
      .sort((a, b) => a.timeMs - b.timeMs);
    const untimed = group.filter((e) => !Number.isFinite(e.timeMs));

    const fastest = timed[0]?.timeMs;

    timed.forEach((entry, index) => {
      // Standard competition ranking: equal times share the earlier placement.
      const tiedWithPrevious = index > 0 && entry.timeMs === timed[index - 1].timeMs;
      const placement = tiedWithPrevious
        ? ranked[ranked.length - 1].placement
        : index + 1;
      ranked.push({ entry, placement, deltaMs: entry.timeMs - fastest! });
    });

    for (const entry of untimed) ranked.push({ entry });
  }

  return ranked;
}

/** Sorts groups the way a programme runs: heats, then semis, then finals. */
export function compareGroups(a: RaceEntry, b: RaceEntry): number {
  const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
  return stageDiff !== 0 ? stageDiff : (a.heat ?? 1) - (b.heat ?? 1);
}

/** Formats a gap to the winner, e.g. "+1.42". Empty for the winner. */
export function formatDelta(deltaMs: number | undefined): string {
  if (deltaMs == null || deltaMs === 0) return '';
  return `+${(deltaMs / 1000).toFixed(2)}`;
}
