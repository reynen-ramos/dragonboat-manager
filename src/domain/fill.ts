import { planBalancedSeating, type SeatedPaddler } from './balance';
import { allSeats, getBoatLayout, seatKey } from './boat';
import type { SeatingChange } from './seating';
import type {
  AvailabilityStatus,
  Category,
  ClubSettings,
  Member,
  PaddlerAssignment,
  Side,
  StoredAssignment,
} from './types';

/**
 * Fill the empty seats of one crew from the people who can actually take them.
 *
 * This composes what already exists — the availability answers, the crew
 * rules, the balance planner — into the question a coach is really asking at
 * 6am: "who goes in the boat?". It proposes; nothing is written until the
 * caller applies the returned changes, and applying them through the normal
 * seating pipeline makes the whole fill one undo step.
 *
 * The pool is opt-in: sign-ups (the availability answers) decide who may be
 * seated. Eligibility, in priority order:
 *
 *   1. The crew's own reserves — being attached to the crew is an explicit
 *      coach action, stronger than any answer, so an unanswered reserve still
 *      counts. A reserve marked Out never does.
 *   2. Members signed up In for the event.
 *   3. Members signed up Maybe.
 *
 * Nobody else. Never anyone marked Out, never anyone who has not signed up,
 * never anyone seated in another crew of the same category (a *reserve*
 * elsewhere is fine — being a spare for the other boat is normal), and never
 * someone already in this crew in another role. The drummer and cox come from
 * the leftover signed-up bench under the same rule.
 *
 * Within a tier, members with a recorded weight come first — the balance
 * planner treats a missing weight as 0kg, so an unweighed paddler placed by
 * it degrades the trim for everyone. Name order breaks the remaining ties so
 * the proposal is deterministic.
 */

export type FillTier = 'reserve' | 'in' | 'maybe';

export interface FillPick {
  memberId: string;
  tier: FillTier;
}

export interface FillReport {
  emptySeatsBefore: number;
  seated: FillPick[];
  /** Seats left empty because the eligible pool ran out. */
  stillEmpty: number;
  /** Women still missing against the mixed-crew minimum after seating everyone available. */
  womenShortfall: number;
  drummerAddedId?: string;
  drummerStillMissing: boolean;
  coxAddedId?: string;
  coxStillMissing: boolean;
}

export interface FillInput {
  category: Category;
  crewId: string;
  /** This crew's assignments. */
  assignments: StoredAssignment[];
  /** The whole roster; inactive members are filtered here. */
  members: Member[];
  availability: Map<string, AvailabilityStatus>;
  /** Assignments across the category, this crew's included. */
  categoryAssignments: Pick<StoredAssignment, 'crewId' | 'memberId' | 'role'>[];
  settings: ClubSettings;
}

export function planCrewFill(input: FillInput): { changes: SeatingChange[]; report: FillReport } {
  const { category, crewId, assignments, members, availability, settings } = input;
  const { rows } = getBoatLayout(category.boatSize);
  const membersById = new Map(members.map((m) => [m.id, m]));

  const seatedNow = assignments.filter(
    (a): a is StoredAssignment & { seat: NonNullable<StoredAssignment['seat']> } =>
      a.role === 'paddler' && a.seat != null,
  );
  const occupied = new Set(seatedNow.map((a) => seatKey(a.seat)));
  const emptySeats = allSeats(category.boatSize).filter((s) => !occupied.has(seatKey(s)));

  const report: FillReport = {
    emptySeatsBefore: emptySeats.length,
    seated: [],
    stillEmpty: 0,
    womenShortfall: 0,
    drummerAddedId: undefined,
    drummerStillMissing: false,
    coxAddedId: undefined,
    coxStillMissing: false,
  };

  // --- Who may be considered at all ----------------------------------------
  const inThisCrew = new Set(assignments.map((a) => a.memberId));
  const seatedElsewhere = new Set(
    input.categoryAssignments
      .filter((a) => a.crewId !== crewId && a.role !== 'reserve')
      .map((a) => a.memberId),
  );

  /** Only called for eligible outsiders, who are always in or maybe. */
  const tierOf = (memberId: string): FillTier =>
    availability.get(memberId) === 'in' ? 'in' : 'maybe';

  const baseEligible = (m: Member): boolean =>
    m.status === 'active' &&
    !seatedElsewhere.has(m.id) &&
    (category.genderClass !== 'women' || m.gender === 'female');

  // A reserve is already with the crew, so only an explicit Out excludes
  // them; an outsider must have actually signed up (In or Maybe).
  const eligibleAsReserve = (m: Member): boolean =>
    baseEligible(m) && availability.get(m.id) !== 'out';

  const eligibleAsOutsider = (m: Member): boolean => {
    const status = availability.get(m.id);
    return baseEligible(m) && (status === 'in' || status === 'maybe');
  };

  const TIER_RANK: Record<FillTier, number> = { reserve: 0, in: 1, maybe: 2 };
  const byPriority = (a: { member: Member; tier: FillTier }, b: typeof a) =>
    TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
    Number(b.member.weightKg != null) - Number(a.member.weightKg != null) ||
    a.member.lastName.localeCompare(b.member.lastName) ||
    a.member.firstName.localeCompare(b.member.firstName);

  const ownReserves = assignments
    .filter((a) => a.role === 'reserve')
    .map((a) => ({ member: membersById.get(a.memberId), assignmentId: a.id }))
    .filter((r): r is { member: Member; assignmentId: string } => r.member != null)
    .filter((r) => eligibleAsReserve(r.member))
    .map((r) => ({ ...r, tier: 'reserve' as const }));

  const outsiders = members
    .filter((m) => !inThisCrew.has(m.id) && eligibleAsOutsider(m))
    .map((member) => ({ member, tier: tierOf(member.id), assignmentId: undefined }));

  const pool = [...ownReserves, ...outsiders].sort(byPriority);

  // --- Pick paddlers ---------------------------------------------------------
  const requiredWomen =
    category.genderClass === 'mixed' ? settings.minWomenMixed[category.boatSize] : 0;
  let femaleCount = seatedNow.filter(
    (a) => membersById.get(a.memberId)?.gender === 'female',
  ).length;

  // A side is full once its rows are spoken for by fixed-side paddlers; a
  // left-only paddler picked past that point could only sit on the wrong side.
  const fixedOn: Record<Side, number> = { left: 0, right: 0 };
  for (const a of seatedNow) {
    const pref = membersById.get(a.memberId)?.sidePreference;
    if (pref === 'left' || pref === 'right') fixedOn[pref] += 1;
  }

  const picks: { member: Member; tier: FillTier; assignmentId?: string }[] = [];
  const remainingPool = [...pool];

  while (picks.length < emptySeats.length) {
    const seatsLeft = emptySeats.length - picks.length;
    const womenNeeded = Math.max(0, requiredWomen - femaleCount);
    const mustBeWoman = womenNeeded >= seatsLeft;

    const index = remainingPool.findIndex(({ member }) => {
      if (mustBeWoman && member.gender !== 'female') return false;
      const pref = member.sidePreference;
      if ((pref === 'left' || pref === 'right') && fixedOn[pref] >= rows) return false;
      return true;
    });
    if (index === -1) break;

    const [pick] = remainingPool.splice(index, 1);
    picks.push(pick);
    if (pick.member.gender === 'female') femaleCount += 1;
    const pref = pick.member.sidePreference;
    if (pref === 'left' || pref === 'right') fixedOn[pref] += 1;
  }

  report.seated = picks.map(({ member, tier }) => ({ memberId: member.id, tier }));
  report.stillEmpty = emptySeats.length - picks.length;
  report.womenShortfall = Math.max(0, requiredWomen - femaleCount);

  // --- Seat them -------------------------------------------------------------
  // The balance planner does placement. Existing paddlers ride along pinned so
  // a fill never reshuffles anyone already placed — that is what the separate
  // Balance sides button is for.
  const pinnedExisting: SeatedPaddler[] = seatedNow.map((a) => ({
    assignment: { ...(a as PaddlerAssignment), pinned: true },
    // A seated row can outlive its member record. The ghost keeps the seat
    // counted in the planner's capacity — dropping the row instead would let
    // a newcomer be planned onto an occupied seat. Its weight reads as
    // unknown, which the balance maths already treats as 0kg.
    member:
      membersById.get(a.memberId) ??
      ({
        id: a.memberId,
        firstName: 'Unknown',
        lastName: '',
        gender: 'other',
        sidePreference: 'both',
        canDrum: false,
        canSteer: false,
        status: 'inactive',
      } satisfies Member),
  }));
  const tempOf = (i: number) => `fill-temp-${i}`;
  const newcomers: SeatedPaddler[] = picks.map((pick, i) => ({
    assignment: {
      id: tempOf(i),
      crewId,
      memberId: pick.member.id,
      role: 'paddler',
      seat: emptySeats[i],
    },
    member: pick.member,
  }));

  const plan = new Map(
    planBalancedSeating([...pinnedExisting, ...newcomers], category.boatSize).map((p) => [
      p.assignmentId,
      p.seat,
    ]),
  );

  const changes: SeatingChange[] = picks.map((pick, i) => {
    const seat = plan.get(tempOf(i)) ?? emptySeats[i];
    return pick.assignmentId !== undefined
      ? { op: 'update', id: pick.assignmentId, patch: { role: 'paddler', seat } }
      : {
          op: 'create',
          assignment: { crewId, memberId: pick.member.id, role: 'paddler', seat },
        };
  });

  // --- Drummer and cox -------------------------------------------------------
  const pickedIds = new Set(picks.map((p) => p.member.id));
  const bench = remainingPool
    .filter(({ member }) => !pickedIds.has(member.id))
    .filter(({ assignmentId }) => assignmentId === undefined); // reserves stay reserves here

  for (const [role, flag] of [
    ['drummer', 'canDrum'],
    ['cox', 'canSteer'],
  ] as const) {
    if (assignments.some((a) => a.role === role)) continue;
    const candidate = bench.find(({ member }) => member[flag]);
    if (!candidate) {
      if (role === 'drummer') report.drummerStillMissing = true;
      else report.coxStillMissing = true;
      continue;
    }
    bench.splice(bench.indexOf(candidate), 1);
    changes.push({
      op: 'create',
      assignment: { crewId, memberId: candidate.member.id, role },
    });
    if (role === 'drummer') report.drummerAddedId = candidate.member.id;
    else report.coxAddedId = candidate.member.id;
  }

  return { changes, report };
}
