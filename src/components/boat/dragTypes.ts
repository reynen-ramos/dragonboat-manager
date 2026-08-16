import type { CrewRole, SeatPosition } from '@/domain/types';

/**
 * What a drag carries and where it can land.
 *
 * Drags are identified by strings because dnd-kit keys everything by id; these
 * helpers keep the encoding in one place so no component parses ids by hand.
 */

/** A paddler being dragged, either from the roster or out of a seat. */
export type DragData =
  | { kind: 'roster'; memberId: string }
  | { kind: 'seat'; assignmentId: string; memberId: string; seat: SeatPosition }
  | { kind: 'crewRole'; assignmentId: string; memberId: string; role: CrewRole };

/** Where a paddler can be dropped. */
export type DropData =
  | { kind: 'seat'; seat: SeatPosition }
  | { kind: 'role'; role: Exclude<CrewRole, 'paddler'> }
  | { kind: 'roster' };

export const seatDroppableId = (seat: SeatPosition) => `seat:${seat.row}:${seat.side}`;
export const roleDroppableId = (role: string) => `role:${role}`;
export const ROSTER_DROPPABLE_ID = 'roster';

export const rosterDraggableId = (memberId: string) => `roster:${memberId}`;
export const assignmentDraggableId = (assignmentId: string) => `assignment:${assignmentId}`;
