import { getBoatLayout, isBowHalf } from './boat';
import type {
  Assignment,
  BoatSize,
  ClubSettings,
  Member,
  SeatPosition,
  Side,
} from './types';

/**
 * Weight and side balance for a seated crew.
 *
 * A dragon boat that sits down on one side loses speed and, in a hard turn,
 * ships water. Coaches balance left/right weight and fore/aft trim by hand
 * today; this module does the arithmetic and proposes a seating that improves
 * it.
 *
 * Paddlers with no recorded weight count as 0kg in the totals. That understates
 * the true weight rather than inventing a number, and `missingWeightCount` is
 * reported alongside so the figures are never read as more precise than they
 * are.
 */

/** A paddler occupying a seat. Only `role: 'paddler'` assignments qualify. */
export interface SeatedPaddler {
  assignment: Assignment & { seat: SeatPosition };
  member: Member;
}

export interface BalanceReport {
  leftKg: number;
  rightKg: number;
  /** Positive means the left side is heavier. */
  sideDeltaKg: number;
  /** `sideDeltaKg` as a fraction of total seated weight. 0 when nothing seated. */
  sideDeltaFraction: number;
  sideWithinTolerance: boolean;

  bowKg: number;
  sternKg: number;
  /** Positive means the bow half is heavier. */
  bowSternDeltaKg: number;
  bowSternDeltaFraction: number;
  bowSternWithinTolerance: boolean;

  totalKg: number;
  seatedCount: number;
  missingWeightCount: number;
  /** Paddlers sitting on a side they did not ask for. */
  sidePreferenceViolations: number;
}

/** A proposed seat change; `null` seat means the paddler could not be placed. */
export interface SeatPlan {
  assignmentId: string;
  seat: SeatPosition;
}

const weightOf = (p: SeatedPaddler): number => p.member.weightKg ?? 0;

export function violatesSidePreference(p: SeatedPaddler): boolean {
  const pref = p.member.sidePreference;
  return pref !== 'both' && pref !== p.assignment.seat.side;
}

export function computeBalance(
  seated: SeatedPaddler[],
  boatSize: BoatSize,
  settings: ClubSettings,
): BalanceReport {
  let leftKg = 0;
  let rightKg = 0;
  let bowKg = 0;
  let sternKg = 0;
  let missingWeightCount = 0;
  let sidePreferenceViolations = 0;

  for (const p of seated) {
    const kg = weightOf(p);
    if (p.member.weightKg == null) missingWeightCount++;
    if (violatesSidePreference(p)) sidePreferenceViolations++;

    if (p.assignment.seat.side === 'left') leftKg += kg;
    else rightKg += kg;

    if (isBowHalf(p.assignment.seat.row, boatSize)) bowKg += kg;
    else sternKg += kg;
  }

  const totalKg = leftKg + rightKg;
  const sideDeltaKg = leftKg - rightKg;
  const bowSternDeltaKg = bowKg - sternKg;
  const fraction = (delta: number) => (totalKg === 0 ? 0 : Math.abs(delta) / totalKg);

  const sideDeltaFraction = fraction(sideDeltaKg);
  const bowSternDeltaFraction = fraction(bowSternDeltaKg);

  return {
    leftKg,
    rightKg,
    sideDeltaKg,
    sideDeltaFraction,
    sideWithinTolerance: sideDeltaFraction <= settings.sideBalanceTolerance,
    bowKg,
    sternKg,
    bowSternDeltaKg,
    bowSternDeltaFraction,
    bowSternWithinTolerance:
      bowSternDeltaFraction <= settings.bowSternBalanceTolerance,
    totalKg,
    seatedCount: seated.length,
    missingWeightCount,
    sidePreferenceViolations,
  };
}

/**
 * Propose a seating that evens out left/right weight.
 *
 * Rules, in order of precedence:
 *  1. Pinned paddlers never move.
 *  2. A paddler who paddles only left or only right keeps that side. If more
 *     people want a side than it has seats, the lightest are moved across —
 *     they cost the least to displace — and the result is reported as a side
 *     preference violation rather than silently hidden.
 *  3. Paddlers who can do either side fill the remaining seats largest-first,
 *     always going to whichever side is currently lighter.
 *  4. Within a side, heavier paddlers are drawn toward the middle rows (the
 *     engine room), which also flattens fore/aft trim.
 *
 * Returns the full seating for every movable paddler, not just the changes.
 */
export function planBalancedSeating(
  seated: SeatedPaddler[],
  boatSize: BoatSize,
): SeatPlan[] {
  const { rows } = getBoatLayout(boatSize);

  const pinned = seated.filter((p) => p.assignment.pinned);
  const movable = seated.filter((p) => !p.assignment.pinned);

  const capacity: Record<Side, number> = {
    left: rows - pinned.filter((p) => p.assignment.seat.side === 'left').length,
    right: rows - pinned.filter((p) => p.assignment.seat.side === 'right').length,
  };

  const byWeightDesc = (a: SeatedPaddler, b: SeatedPaddler) =>
    weightOf(b) - weightOf(a);

  const chosen: Record<Side, SeatedPaddler[]> = { left: [], right: [] };
  const displaced: SeatedPaddler[] = [];

  // 2. Honour fixed side preferences, heaviest first — the lightest overflow.
  for (const side of ['left', 'right'] as Side[]) {
    const wanting = movable
      .filter((p) => p.member.sidePreference === side)
      .sort(byWeightDesc);
    chosen[side] = wanting.slice(0, capacity[side]);
    displaced.push(...wanting.slice(capacity[side]));
  }

  // 3. Everyone else fills the remaining seats, largest-first to the lighter side.
  const flexible = movable
    .filter((p) => p.member.sidePreference === 'both')
    .concat(displaced)
    .sort(byWeightDesc);

  const weightOn = (side: Side) =>
    chosen[side].reduce((sum, p) => sum + weightOf(p), 0);

  for (const paddler of flexible) {
    const leftHasRoom = chosen.left.length < capacity.left;
    const rightHasRoom = chosen.right.length < capacity.right;
    let side: Side;
    if (leftHasRoom && rightHasRoom) side = weightOn('left') <= weightOn('right') ? 'left' : 'right';
    else if (leftHasRoom) side = 'left';
    else if (rightHasRoom) side = 'right';
    else break; // No seats left; remaining paddlers keep their current seat.
    chosen[side].push(paddler);
  }

  // 4. Place each side's paddlers into its free rows, heaviest toward the middle.
  const plan: SeatPlan[] = [];
  const centre = (rows + 1) / 2;

  for (const side of ['left', 'right'] as Side[]) {
    const takenRows = new Set(
      pinned
        .filter((p) => p.assignment.seat.side === side)
        .map((p) => p.assignment.seat.row),
    );
    const freeRows = Array.from({ length: rows }, (_, i) => i + 1)
      .filter((row) => !takenRows.has(row))
      .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));

    chosen[side]
      .slice()
      .sort(byWeightDesc)
      .forEach((paddler, i) => {
        const row = freeRows[i];
        if (row === undefined) return;
        plan.push({ assignmentId: paddler.assignment.id, seat: { row, side } });
      });
  }

  return plan;
}
