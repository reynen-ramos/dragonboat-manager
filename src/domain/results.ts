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

export function groupLabel(stage: RaceStage, heat: number | undefined, heatCount: number): string {
  // "Heat 2" is only meaningful when there is more than one heat.
  if (stage === 'heat' && heatCount > 1) return `Heat ${heat ?? 1}`;
  if (stage === 'semi' && heatCount > 1) return `Semi-final ${heat ?? 1}`;
  return STAGE_LABELS[stage];
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
      .filter((e): e is RaceEntry & { timeMs: number } => typeof e.timeMs === 'number')
      .sort((a, b) => a.timeMs - b.timeMs);
    const untimed = group.filter((e) => typeof e.timeMs !== 'number');

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
