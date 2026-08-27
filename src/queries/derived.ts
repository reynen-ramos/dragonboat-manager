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
import { validateCrew, type Issue } from '@/domain/validation';
import {
  useAllAssignments,
  useAllCrews,
  useAssignments,
  useAvailability,
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
    };
  }, [assignments.data, assignments.isLoading, members.isLoading, membersById]);
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

  return useMemo(() => {
    if (!category || !crewId) return [];
    return validateCrew({
      category,
      assignments: lineup.assignments,
      members: lineup.membersById,
      settings,
      availability,
      categoryAssignments: siblingAssignments,
      eventDate,
    });
  }, [
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
      (crews.data ?? []).filter((c) => c.categoryId === categoryId).map((c) => c.id),
    );
    return (allAssignments.data ?? [])
      .filter((a) => crewIds.has(a.crewId))
      .map((a) => ({ crewId: a.crewId, memberId: a.memberId }));
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
