import { sameSeat, seatLabel } from './boat';
import type { Member, StoredAssignment } from './types';

/**
 * What changes between two lineups of the same category.
 *
 * Built for comparing a crew with its Plan B: the answer a coach wants is not
 * two full seating charts but the delta — who moved, who is only in one plan,
 * who changed jobs. Reads the storage shape, since a draft is allowed to be
 * half-built.
 */

export type LineupDiffKind = 'moved' | 'only-a' | 'only-b' | 'role-changed';

export interface LineupDiffRow {
  memberId: string;
  kind: LineupDiffKind;
  /** Human descriptions of each side, e.g. "Row 3 Left" or "drummer". */
  a?: string;
  b?: string;
}

const describe = (assignment: StoredAssignment): string =>
  assignment.role === 'paddler'
    ? assignment.seat
      ? seatLabel(assignment.seat)
      : 'paddler, no seat'
    : assignment.role;

export function diffLineups(
  a: StoredAssignment[],
  b: StoredAssignment[],
): { unchanged: number; rows: LineupDiffRow[] } {
  const byMemberA = new Map(a.map((row) => [row.memberId, row]));
  const byMemberB = new Map(b.map((row) => [row.memberId, row]));

  const rows: LineupDiffRow[] = [];
  let unchanged = 0;

  for (const [memberId, inA] of byMemberA) {
    const inB = byMemberB.get(memberId);
    if (!inB) {
      rows.push({ memberId, kind: 'only-a', a: describe(inA) });
      continue;
    }
    if (inA.role !== inB.role) {
      rows.push({ memberId, kind: 'role-changed', a: describe(inA), b: describe(inB) });
    } else if (inA.role === 'paddler' && !sameSeat(inA.seat, inB.seat)) {
      rows.push({ memberId, kind: 'moved', a: describe(inA), b: describe(inB) });
    } else {
      unchanged += 1;
    }
  }

  for (const [memberId, inB] of byMemberB) {
    if (!byMemberA.has(memberId)) rows.push({ memberId, kind: 'only-b', b: describe(inB) });
  }

  return { unchanged, rows };
}

/** Sorts diff rows for display: changes of place first, then departures. */
export function sortDiffRows(rows: LineupDiffRow[], members: Map<string, Member>): LineupDiffRow[] {
  const KIND_ORDER: Record<LineupDiffKind, number> = {
    moved: 0,
    'role-changed': 1,
    'only-b': 2,
    'only-a': 3,
  };
  return [...rows].sort(
    (x, y) =>
      KIND_ORDER[x.kind] - KIND_ORDER[y.kind] ||
      (members.get(x.memberId)?.lastName ?? '').localeCompare(
        members.get(y.memberId)?.lastName ?? '',
      ),
  );
}
