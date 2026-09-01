import { groupLabel, raceCountsByStage, rankEntries } from './results';
import type {
  Category,
  ClubEvent,
  Crew,
  RaceEntry,
  RaceStage,
  StoredAssignment,
} from './types';

/**
 * One member's race results: every race a crew of theirs recorded, with the
 * placement that crew took in it.
 *
 * A sibling of buildMemberHistory rather than an extension — history answers
 * "where were they", this answers "how did it go", and the two have different
 * consumers. The ranking rule is CrewResults' hoisted into the domain: rank
 * against the whole category (a crew ranked alone is first in everything;
 * ranked across categories, two unrelated "Heat 1"s merge into one race),
 * then pick this member's crews out of the sheet.
 *
 * Reserves are excluded — being listed as cover is not racing — and variant
 * crews count nowhere, as always.
 */

export interface MemberResultRow {
  event: ClubEvent;
  category: Category;
  crew: Crew;
  stage: RaceStage;
  heat?: number;
  /** "Heat 2", "A Final" — count-aware, ready to render. */
  raceLabel: string;
  timeMs?: number;
  placement?: number;
  deltaMs?: number;
  /** How many crews were in the same race. */
  fieldSize: number;
}

export interface MemberResultsInput {
  /** Already scoped to the member, as useMemberAssignments returns them. */
  assignments: StoredAssignment[];
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  raceEntries: RaceEntry[];
}

const STAGE_ORDER: Record<RaceStage, number> = { heat: 0, semi: 1, final: 2 };

export function buildMemberResults(input: MemberResultsInput): MemberResultRow[] {
  const eventById = new Map(input.events.map((e) => [e.id, e]));
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const crewById = new Map(input.crews.map((c) => [c.id, c]));

  // The member's real crews: non-reserve role, never a variant, links intact.
  const myCrewIds = new Set<string>();
  for (const a of input.assignments) {
    if (a.role === 'reserve') continue;
    const crew = crewById.get(a.crewId);
    if (!crew || crew.variantOf) continue;
    if (!categoryById.has(crew.categoryId)) continue;
    myCrewIds.add(crew.id);
  }
  if (myCrewIds.size === 0) return [];

  // Group every entry by category, so ranking happens in the right field.
  const entriesByCategory = new Map<string, RaceEntry[]>();
  for (const entry of input.raceEntries) {
    const crew = crewById.get(entry.crewId);
    if (!crew || crew.variantOf) continue;
    const category = categoryById.get(crew.categoryId);
    if (!category || !eventById.has(category.eventId)) continue;
    entriesByCategory.set(crew.categoryId, [
      ...(entriesByCategory.get(crew.categoryId) ?? []),
      entry,
    ]);
  }

  const rows: MemberResultRow[] = [];
  for (const [categoryId, entries] of entriesByCategory) {
    const category = categoryById.get(categoryId)!;
    const event = eventById.get(category.eventId)!;
    const counts = raceCountsByStage(entries);

    const fieldSizes = new Map<string, number>();
    for (const entry of entries) {
      const key = `${entry.stage}:${entry.heat ?? 1}`;
      fieldSizes.set(key, (fieldSizes.get(key) ?? 0) + 1);
    }

    for (const ranked of rankEntries(entries)) {
      const { entry, placement, deltaMs } = ranked;
      if (!myCrewIds.has(entry.crewId)) continue;
      rows.push({
        event,
        category,
        crew: crewById.get(entry.crewId)!,
        stage: entry.stage,
        heat: entry.heat,
        raceLabel: groupLabel(entry.stage, entry.heat, counts[entry.stage]),
        timeMs: entry.timeMs,
        placement,
        deltaMs,
        fieldSize: fieldSizes.get(`${entry.stage}:${entry.heat ?? 1}`) ?? 1,
      });
    }
  }

  // Newest event first; within an event, programme order.
  rows.sort(
    (a, b) =>
      b.event.startDate.localeCompare(a.event.startDate) ||
      STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
      (a.heat ?? 1) - (b.heat ?? 1),
  );
  return rows;
}
