import { useMemo } from 'react';
import type { SeatedPaddler } from '@/domain/balance';
import { computeBalance } from '@/domain/balance';
import type {
  Assignment,
  Availability,
  AvailabilityStatus,
  Category,
  Member,
} from '@/domain/types';
import { buildMemberHistory } from '@/domain/memberHistory';
import { buildMemberResults } from '@/domain/memberResults';
import { todayIso } from '@/domain/dates';
import { validateCrew, type Issue } from '@/domain/validation';
import {
  useAllAssignments,
  useAllAvailability,
  useAllCategories,
  useAllCrews,
  useAllRaceEntries,
  useAssignments,
  useAvailability,
  useEvents,
  useMemberAssignments,
  useMemberAvailability,
  useMembers,
  useSettings,
} from './hooks';

/**
 * Derived reads that combine several queries.
 *
 * Keeping these here rather than in components means the joins happen in one
 * place, and the pure domain functions get exactly the shape they expect.
 */

export const useMembersById = (): Map<string, Member> => {
  const members = useMembers();
  return useMemo(
    () => new Map((members.data ?? []).map((member) => [member.id, member])),
    [members.data],
  );
};

/** Assignments in a crew, joined to members and split by role. */
export interface CrewLineup {
  assignments: Assignment[];
  membersById: Map<string, Member>;
  seated: SeatedPaddler[];
  /** Seated paddlers keyed by `row-side` for instant seat lookup. */
  bySeat: Map<string, SeatedPaddler>;
  drummer?: { assignment: Assignment; member: Member };
  cox?: { assignment: Assignment; member: Member };
  reserves: { assignment: Assignment; member: Member }[];
  isLoading: boolean;
  /**
   * A failed read must not render as an empty boat: with history active, one
   * drag then records [] as the "before" snapshot, and undo writes it back
   * over the crew's real stored lineup.
   */
  isError: boolean;
  refetch: () => void;
}

export function useCrewLineup(crewId: string | undefined): CrewLineup {
  const assignments = useAssignments(crewId);
  const members = useMembers();
  const membersById = useMembersById();

  return useMemo(() => {
    const rows = assignments.data ?? [];
    const seated: SeatedPaddler[] = [];
    const bySeat = new Map<string, SeatedPaddler>();
    const reserves: { assignment: Assignment; member: Member }[] = [];
    let drummer: CrewLineup['drummer'];
    let cox: CrewLineup['cox'];

    for (const assignment of rows) {
      const member = membersById.get(assignment.memberId);
      if (!member) continue; // Deleted member; the cascade normally prevents this.

      // The `seat` check is redundant against the type but not against storage:
      // an older release or an edited backup can still hold a seatless paddler.
      // `validateCrew` reports those; this loop just declines to seat them.
      if (assignment.role === 'paddler' && assignment.seat) {
        const entry = { assignment, member };
        seated.push(entry);
        bySeat.set(`${assignment.seat.row}-${assignment.seat.side}`, entry);
      } else if (assignment.role === 'drummer') drummer = { assignment, member };
      else if (assignment.role === 'cox') cox = { assignment, member };
      else if (assignment.role === 'reserve') reserves.push({ assignment, member });
    }

    return {
      assignments: rows,
      membersById,
      seated,
      bySeat,
      drummer,
      cox,
      reserves,
      isLoading: assignments.isLoading || members.isLoading,
      isError: assignments.isError || members.isError,
      refetch: () => {
        void assignments.refetch();
        void members.refetch();
      },
    };
  }, [assignments, members, membersById]);
}

export const useAvailabilityByMember = (
  eventId: string | undefined,
): Map<string, AvailabilityStatus> => {
  const availability = useAvailability(eventId);
  return useMemo(
    () =>
      new Map(
        (availability.data ?? []).map((entry: Availability) => [entry.memberId, entry.status]),
      ),
    [availability.data],
  );
};

export function useCrewIssues(
  crewId: string | undefined,
  category: Category | undefined,
  eventId: string | undefined,
  eventDate: string | undefined,
): Issue[] {
  const lineup = useCrewLineup(crewId);
  const settings = useSettings();
  const availability = useAvailabilityByMember(eventId);
  const siblingAssignments = useCategoryCrewAssignments(category?.id);
  const crews = useAllCrews();
  const isVariant = Boolean(crews.data?.find((c) => c.id === crewId)?.variantOf);

  return useMemo(() => {
    if (!category || !crewId) return [];
    return validateCrew({
      category,
      assignments: lineup.assignments,
      members: lineup.membersById,
      settings,
      availability,
      // A variant is a draft of the crew it shadows: sharing paddlers with the
      // real plan is its whole point, so cross-crew clash rules do not apply.
      categoryAssignments: isVariant ? [] : siblingAssignments,
      eventDate,
    });
  }, [
    isVariant,
    category,
    crewId,
    lineup.assignments,
    lineup.membersById,
    settings,
    availability,
    siblingAssignments,
    eventDate,
  ]);
}

/**
 * Assignments across every crew in one category.
 *
 * Fetching all assignments and filtering client-side is fine at club scale — a
 * season is a few thousand rows — and avoids a join the storage interface would
 * otherwise have to expose.
 */
export function useCategoryCrewAssignments(categoryId: string | undefined) {
  const crews = useAllCrews();
  const allAssignments = useAllAssignments();

  return useMemo(() => {
    if (!categoryId) return [];
    const crewIds = new Set(
      (crews.data ?? [])
        // Variants are drafts: their paddlers stay eligible everywhere and
        // clash with nothing, in either direction.
        .filter((c) => c.categoryId === categoryId && !c.variantOf)
        .map((c) => c.id),
    );
    return (allAssignments.data ?? [])
      .filter((a) => crewIds.has(a.crewId))
      // `role` travels with it so validation can tell a seated clash from
      // someone merely listed as a reserve elsewhere.
      .map((a) => ({ crewId: a.crewId, memberId: a.memberId, role: a.role }));
  }, [categoryId, crews.data, allAssignments.data]);
}

export function useCrewBalance(crewId: string | undefined, category: Category | undefined) {
  const lineup = useCrewLineup(crewId);
  const settings = useSettings();

  return useMemo(
    () => (category ? computeBalance(lineup.seated, category.boatSize, settings) : undefined),
    [lineup.seated, category, settings],
  );
}

/**
 * A member's history: every event they were seated at or answered for, split
 * into past and upcoming, with season totals. One pass over four collections
 * instead of the previous three chained queries per row.
 */
export function useMemberHistory(memberId: string | undefined) {
  const events = useEvents();
  const categories = useAllCategories();
  const crews = useAllCrews();
  const assignments = useMemberAssignments(memberId);
  const availability = useMemberAvailability(memberId);
  const settings = useSettings();

  const queries = [events, categories, crews, assignments, availability];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const history = useMemo(
    () =>
      buildMemberHistory({
        today: todayIso(),
        events: events.data ?? [],
        categories: categories.data ?? [],
        crews: crews.data ?? [],
        assignments: assignments.data ?? [],
        availability: availability.data ?? [],
        eventTypes: settings.eventTypes,
      }),
    [events.data, categories.data, crews.data, assignments.data, availability.data, settings.eventTypes],
  );

  return {
    ...history,
    isLoading,
    isError,
    refetch: () => {
      for (const q of queries) void q.refetch();
    },
  };
}

/** A member's race results, ranked against each race's whole field. */
export function useMemberResults(memberId: string | undefined) {
  const events = useEvents();
  const categories = useAllCategories();
  const crews = useAllCrews();
  const assignments = useMemberAssignments(memberId);
  const raceEntries = useAllRaceEntries();

  const queries = [events, categories, crews, assignments, raceEntries];
  return {
    rows: useMemo(
      () =>
        buildMemberResults({
          assignments: assignments.data ?? [],
          events: events.data ?? [],
          categories: categories.data ?? [],
          crews: crews.data ?? [],
          raceEntries: raceEntries.data ?? [],
        }),
      [assignments.data, events.data, categories.data, crews.data, raceEntries.data],
    ),
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

/**
 * Every collection the report builders read, fetched once and rolled up.
 *
 * The page memoises the builder calls; this hook only assembles the superset
 * input object each narrow builder interface is structurally satisfied by.
 */
export function useReportsData() {
  const members = useMembers();
  const events = useEvents();
  const categories = useAllCategories();
  const crews = useAllCrews();
  const assignments = useAllAssignments();
  const availability = useAllAvailability();
  const raceEntries = useAllRaceEntries();
  const settings = useSettings();

  const queries = [members, events, categories, crews, assignments, availability, raceEntries];

  const collections = useMemo(
    () => ({
      members: members.data ?? [],
      events: events.data ?? [],
      categories: categories.data ?? [],
      crews: crews.data ?? [],
      assignments: assignments.data ?? [],
      availability: availability.data ?? [],
      raceEntries: raceEntries.data ?? [],
      eventTypes: settings.eventTypes,
      trainingKinds: settings.trainingKinds,
    }),
    [
      members.data,
      events.data,
      categories.data,
      crews.data,
      assignments.data,
      availability.data,
      raceEntries.data,
      settings.eventTypes,
      settings.trainingKinds,
    ],
  );

  return {
    collections,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => {
      for (const q of queries) void q.refetch();
    },
  };
}
