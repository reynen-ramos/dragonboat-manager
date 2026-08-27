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

/** What advancing the fastest crews into the next stage would create. */
export interface AdvancementPlan {
  entries: Omit<RaceEntry, 'id'>[];
  advancingCrewIds: string[];
  /** Crews in the source stage with no finite time — they cannot be ranked. */
  excludedUntimed: string[];
}

export type AdvancementBlocked = {
  blocked: 'TARGET_HAS_ENTRIES' | 'NO_TIMED_ENTRIES';
};

/**
 * Proposes the next stage's entries from a finished one.
 *
 * Ranking is by time across all races of the source stage — the dragon boat
 * convention, where lanes and draws vary too much for place-per-heat to be
 * fair. Two refinements a plain top-N would get wrong:
 *
 *  - A tie exactly at the cut advances both crews rather than letting sort
 *    order pick a loser.
 *  - A crew somehow holding two source entries advances once, on its best.
 *
 * Multiple target races are seeded snake-style (1st to race A, 2nd and 3rd to
 * race B, 4th back to A …) so the two semis are of comparable strength.
 * Lanes are assigned in seed order within each race; a coach can re-lane by
 * hand where the draw says otherwise.
 */
export function planAdvancement(
  all: RaceEntry[],
  from: RaceStage,
  to: RaceStage,
  opts: { advancing: number; races: number },
): AdvancementPlan | AdvancementBlocked {
  if (all.some((e) => e.stage === to)) return { blocked: 'TARGET_HAS_ENTRIES' };

  const source = all.filter((e) => e.stage === from);
  const timed = source.filter((e): e is RaceEntry & { timeMs: number } =>
    Number.isFinite(e.timeMs),
  );
  if (timed.length === 0) return { blocked: 'NO_TIMED_ENTRIES' };

  const excludedUntimed = [
    ...new Set(
      source
        .filter((e) => !Number.isFinite(e.timeMs))
        .map((e) => e.crewId)
        .filter((id) => !timed.some((t) => t.crewId === id)),
    ),
  ];

  // Best time per crew, fastest first.
  const bestByCrew = new Map<string, RaceEntry & { timeMs: number }>();
  for (const entry of timed) {
    const held = bestByCrew.get(entry.crewId);
    if (!held || entry.timeMs < held.timeMs) bestByCrew.set(entry.crewId, entry);
  }
  const ranked = [...bestByCrew.values()].sort((a, b) => a.timeMs - b.timeMs);

  let cut = Math.min(Math.max(1, opts.advancing), ranked.length);
  while (cut < ranked.length && ranked[cut].timeMs === ranked[cut - 1].timeMs) cut++;
  const advancing = ranked.slice(0, cut);

  const races = Math.max(1, Math.min(opts.races, advancing.length));
  const snake = (seed: number): number => {
    const cycle = seed % (2 * races);
    return cycle < races ? cycle : 2 * races - 1 - cycle;
  };

  const laneCount = Array.from({ length: races }, () => 0);
  const entries = advancing.map((entry, seed) => {
    const race = snake(seed);
    laneCount[race] += 1;
    return { crewId: entry.crewId, stage: to, heat: race + 1, lane: laneCount[race] };
  });

  return { entries, advancingCrewIds: advancing.map((e) => e.crewId), excludedUntimed };
}
