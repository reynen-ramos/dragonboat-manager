import { getBoatLayout } from './boat';
import type {
  Availability,
  AvailabilityStatus,
  Category,
  ClubEvent,
  Crew,
  CrewRole,
  SeatPosition,
  SeatZone,
  Side,
  StoredAssignment,
} from './types';

/**
 * One member's story, read backwards out of data the app already keeps.
 *
 * Every event accumulates assignments and availability answers, and until now
 * nothing ever read them in reverse: who has this paddler been, across the
 * season? The function is pure — the caller supplies the collections — and
 * deliberately honest about what the club actually knows. There is no
 * attendance register here: what exists are answers given and seats held, so
 * that is what is reported, in those words.
 *
 * Variant crews are drafts and appear nowhere: a Plan B that never raced is a
 * coach's scratchpad, not a line in someone's history.
 */

export interface MemberParticipation {
  crew: Crew;
  category: Category;
  role: CrewRole;
  seat?: SeatPosition;
}

export interface MemberHistoryRow {
  event: ClubEvent;
  /** What they answered, when asked. */
  status?: AvailabilityStatus;
  participations: MemberParticipation[];
}

export interface MemberHistorySummary {
  /** Past race events where they held a non-reserve place in a real crew. */
  racesCrewed: number;
  practicesCrewed: number;
  /** Availability answers on past events: how often asked, how often In. */
  asked: number;
  saidIn: number;
  /** The seat they most often actually held, if they have paddled at all. */
  usualSpot?: { side: Side; zone: SeatZone };
}

export interface MemberHistoryInput {
  /** ISO date; events strictly before it are history, the rest upcoming. */
  today: string;
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  /** Already scoped to the member. */
  assignments: StoredAssignment[];
  availability: Availability[];
}

export interface MemberHistory {
  upcoming: MemberHistoryRow[];
  past: MemberHistoryRow[];
  summary: MemberHistorySummary;
}

const mode = <T>(counts: Map<T, number>): T | undefined => {
  let best: T | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

export function buildMemberHistory(input: MemberHistoryInput): MemberHistory {
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]));
  const crewsById = new Map(input.crews.map((c) => [c.id, c]));
  const eventsById = new Map(input.events.map((e) => [e.id, e]));

  // Participations per event, walking assignment → crew → category → event.
  // A broken link means the cascade was interrupted somewhere; the row is
  // skipped here the way the lineup view skips it, and validation owns
  // reporting it.
  const byEvent = new Map<string, MemberParticipation[]>();
  for (const assignment of input.assignments) {
    const crew = crewsById.get(assignment.crewId);
    if (!crew || crew.variantOf) continue;
    const category = categoriesById.get(crew.categoryId);
    if (!category) continue;
    if (!eventsById.has(category.eventId)) continue;

    const participation: MemberParticipation = {
      crew,
      category,
      role: assignment.role,
      seat: assignment.seat,
    };
    byEvent.set(category.eventId, [...(byEvent.get(category.eventId) ?? []), participation]);
  }

  const statusByEvent = new Map(input.availability.map((a) => [a.eventId, a.status]));

  const involvedEventIds = new Set([...byEvent.keys(), ...statusByEvent.keys()]);
  const rows: MemberHistoryRow[] = [];
  for (const eventId of involvedEventIds) {
    const event = eventsById.get(eventId);
    if (!event) continue;
    rows.push({
      event,
      status: statusByEvent.get(eventId),
      participations: byEvent.get(eventId) ?? [],
    });
  }

  const isPast = (event: ClubEvent) => (event.endDate ?? event.startDate) < input.today;
  const past = rows
    .filter((row) => isPast(row.event))
    .sort((a, b) => b.event.startDate.localeCompare(a.event.startDate));
  const upcoming = rows
    .filter((row) => !isPast(row.event))
    .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate));

  // --- Summary, from the past only: next week's entry is not history yet. ---
  const crewed = (row: MemberHistoryRow) =>
    row.participations.some((p) => p.role !== 'reserve');

  const answered = past.filter((row) => row.status !== undefined);

  const sideCounts = new Map<Side, number>();
  const zoneCounts = new Map<SeatZone, number>();
  for (const row of past) {
    for (const p of row.participations) {
      if (p.role !== 'paddler' || !p.seat) continue;
      sideCounts.set(p.seat.side, (sideCounts.get(p.seat.side) ?? 0) + 1);
      const zone = getBoatLayout(p.category.boatSize).zoneForRow(p.seat.row);
      zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
    }
  }
  const side = mode(sideCounts);
  const zone = mode(zoneCounts);

  return {
    upcoming,
    past,
    summary: {
      racesCrewed: past.filter((row) => row.event.type === 'race' && crewed(row)).length,
      practicesCrewed: past.filter((row) => row.event.type === 'practice' && crewed(row)).length,
      asked: answered.length,
      saidIn: answered.filter((row) => row.status === 'in').length,
      usualSpot: side !== undefined && zone !== undefined ? { side, zone } : undefined,
    },
  };
}
