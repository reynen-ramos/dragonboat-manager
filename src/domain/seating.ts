import { sameSeat } from './boat';
import type { Assignment, CrewRole, SeatPosition } from './types';

/**
 * What a drag-and-drop gesture does to a crew.
 *
 * Kept pure and separate from the UI because the rules are where the subtlety
 * lives — dropping onto an occupied seat swaps, dropping someone who is already
 * in the crew moves them rather than duplicating them, and nobody is ever
 * silently removed from the boat.
 */

export type SeatingChange =
  | { op: 'create'; assignment: Omit<Assignment, 'id'> }
  | { op: 'update'; id: string; patch: Partial<Omit<Assignment, 'id'>> }
  | { op: 'delete'; id: string };

/** Where a paddler is being dropped. */
export type DropTarget =
  | { kind: 'seat'; seat: SeatPosition }
  | { kind: 'role'; role: Exclude<CrewRole, 'paddler'> }
  /** Out of the crew entirely. */
  | { kind: 'remove' };

export interface DragSource {
  memberId: string;
  /** Present when the paddler is already in this crew. */
  assignmentId?: string;
}

const findByMember = (assignments: Assignment[], memberId: string) =>
  assignments.find((a) => a.memberId === memberId);

const occupantOf = (assignments: Assignment[], seat: SeatPosition) =>
  assignments.find((a) => a.role === 'paddler' && sameSeat(a.seat, seat));

/** Bumped paddlers become reserves rather than vanishing from the crew. */
const toReserve = (id: string): SeatingChange => ({
  op: 'update',
  id,
  patch: { role: 'reserve', seat: undefined, pinned: undefined },
});

export function planDrop(
  crewId: string,
  assignments: Assignment[],
  source: DragSource,
  target: DropTarget,
): SeatingChange[] {
  const mover =
    (source.assignmentId ? assignments.find((a) => a.id === source.assignmentId) : undefined) ??
    findByMember(assignments, source.memberId);

  if (target.kind === 'remove') {
    return mover ? [{ op: 'delete', id: mover.id }] : [];
  }

  if (target.kind === 'seat') {
    const occupant = occupantOf(assignments, target.seat);

    // Dropped back onto their own seat.
    if (occupant && mover && occupant.id === mover.id) return [];

    const changes: SeatingChange[] = [];

    if (occupant) {
      // A seated paddler trades places; anyone else displaces the occupant to
      // the reserves, where they stay available rather than being dropped.
      changes.push(
        mover?.seat
          ? { op: 'update', id: occupant.id, patch: { seat: mover.seat } }
          : toReserve(occupant.id),
      );
    }

    changes.push(
      mover
        ? { op: 'update', id: mover.id, patch: { role: 'paddler', seat: target.seat } }
        : {
            op: 'create',
            assignment: { crewId, memberId: source.memberId, role: 'paddler', seat: target.seat },
          },
    );

    return changes;
  }

  // Dropping onto the drummer, cox, or reserves slot.
  const changes: SeatingChange[] = [];

  if (target.role !== 'reserve') {
    // A crew carries one drummer and one cox, so the incumbent steps aside.
    const holder = assignments.find((a) => a.role === target.role);
    if (holder && holder.id !== mover?.id) changes.push(toReserve(holder.id));
  }

  changes.push(
    mover
      ? { op: 'update', id: mover.id, patch: { role: target.role, seat: undefined, pinned: undefined } }
      : {
          op: 'create',
          assignment: { crewId, memberId: source.memberId, role: target.role },
        },
  );

  return changes;
}

/** Applies changes in memory — used for undo snapshots and by the tests. */
export function applyChanges(assignments: Assignment[], changes: SeatingChange[]): Assignment[] {
  let next = assignments.slice();
  for (const change of changes) {
    if (change.op === 'delete') {
      next = next.filter((a) => a.id !== change.id);
    } else if (change.op === 'update') {
      next = next.map((a) => (a.id === change.id ? { ...a, ...change.patch } : a));
    } else {
      next = [...next, { id: `new-${next.length}`, ...change.assignment }];
    }
  }
  return next;
}
