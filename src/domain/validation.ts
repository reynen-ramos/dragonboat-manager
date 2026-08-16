import { getBoatLayout, seatKey, seatLabel } from './boat';
import { ageOn } from './dates';
import { AGE_DIVISION_BOUNDS } from './rules.config';
import type {
  Assignment,
  AvailabilityStatus,
  Category,
  ClubSettings,
  Member,
  SeatPosition,
} from './types';

/**
 * Crew legality and sanity checks.
 *
 * Errors mean the crew as configured could not race. Warnings mean it could,
 * but something is probably wrong. Info means data is missing that makes other
 * features (chiefly balance) less useful.
 */

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  memberId?: string;
  seat?: SeatPosition;
}

export interface ValidationInput {
  category: Category;
  assignments: Assignment[];
  /** Roster lookup for everyone referenced by `assignments`. */
  members: Map<string, Member>;
  settings: ClubSettings;
  /**
   * Assignments in the *other crews of this same category*.
   *
   * Scoped to the category rather than the event on purpose: a paddler racing
   * both the Mixed and the Women's category at one regatta is entirely normal.
   * Two crews within one category race each other, so that is the real clash.
   */
  categoryAssignments?: Pick<Assignment, 'crewId' | 'memberId'>[];
  /** Availability for this event, keyed by member id. */
  availability?: Map<string, AvailabilityStatus>;
  /** Event date, needed for age-division checks. */
  eventDate?: string;
}

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`.trim();

export function validateCrew(input: ValidationInput): Issue[] {
  const { category, assignments, members, settings } = input;
  const issues: Issue[] = [];

  const paddlers = assignments.filter((a) => a.role === 'paddler');
  const drummers = assignments.filter((a) => a.role === 'drummer');
  const coxes = assignments.filter((a) => a.role === 'cox');

  const { boatSize } = getBoatLayout(category.boatSize);

  // --- Seat count -----------------------------------------------------------
  if (paddlers.length < boatSize) {
    issues.push({
      level: 'error',
      code: 'SEAT_COUNT_SHORT',
      message: `${paddlers.length} of ${boatSize} paddlers seated — ${
        boatSize - paddlers.length
      } seat${boatSize - paddlers.length === 1 ? '' : 's'} still empty.`,
    });
  } else if (paddlers.length > boatSize) {
    issues.push({
      level: 'error',
      code: 'SEAT_COUNT_OVER',
      message: `${paddlers.length} paddlers seated but a ${boatSize}s boat holds ${boatSize}.`,
    });
  }

  // Two people in one seat: possible through concurrent edits, so worth catching.
  const seatOccupants = new Map<string, string[]>();
  for (const a of paddlers) {
    if (!a.seat) continue;
    const key = seatKey(a.seat);
    seatOccupants.set(key, [...(seatOccupants.get(key) ?? []), a.memberId]);
  }
  for (const [key, occupants] of seatOccupants) {
    if (occupants.length > 1) {
      const [row, side] = key.split('-');
      issues.push({
        level: 'error',
        code: 'DUPLICATE_SEAT',
        message: `${occupants.length} paddlers assigned to ${seatLabel({
          row: Number(row),
          side: side as SeatPosition['side'],
        })}.`,
      });
    }
  }

  // --- Drummer and cox ------------------------------------------------------
  if (drummers.length === 0) {
    issues.push({ level: 'warning', code: 'NO_DRUMMER', message: 'No drummer assigned.' });
  } else if (drummers.length > 1) {
    issues.push({
      level: 'error',
      code: 'MULTIPLE_DRUMMERS',
      message: `${drummers.length} drummers assigned — a crew carries one.`,
    });
  }

  if (coxes.length === 0) {
    issues.push({ level: 'warning', code: 'NO_COX', message: 'No coxswain assigned.' });
  } else if (coxes.length > 1) {
    issues.push({
      level: 'error',
      code: 'MULTIPLE_COXES',
      message: `${coxes.length} coxswains assigned — a crew carries one.`,
    });
  }

  // --- Gender class ---------------------------------------------------------
  const paddlerMembers = paddlers
    .map((a) => members.get(a.memberId))
    .filter((m): m is Member => Boolean(m));
  const womenCount = paddlerMembers.filter((m) => m.gender === 'female').length;

  if (category.genderClass === 'women') {
    for (const a of paddlers) {
      const member = members.get(a.memberId);
      if (member && member.gender !== 'female') {
        issues.push({
          level: 'error',
          code: 'WOMEN_ONLY_VIOLATION',
          message: `${fullName(member)} is seated in a women's crew.`,
          memberId: member.id,
          seat: a.seat,
        });
      }
    }
  }

  if (category.genderClass === 'mixed') {
    const required = settings.minWomenMixed[category.boatSize];
    if (womenCount < required) {
      issues.push({
        level: 'error',
        code: 'MIXED_MIN_WOMEN',
        message: `Mixed ${category.boatSize}s needs at least ${required} women; this crew has ${womenCount}.`,
      });
    }
  }

  // --- Double booking within the category -----------------------------------
  if (input.categoryAssignments) {
    const crewIds = new Set(assignments.map((a) => a.crewId));
    const seatedHere = new Set(
      assignments.filter((a) => a.role !== 'reserve').map((a) => a.memberId),
    );
    const clashing = new Set<string>();
    for (const other of input.categoryAssignments) {
      if (crewIds.has(other.crewId)) continue;
      if (seatedHere.has(other.memberId)) clashing.add(other.memberId);
    }
    for (const memberId of clashing) {
      const member = members.get(memberId);
      issues.push({
        level: 'error',
        code: 'DOUBLE_BOOKED',
        message: `${
          member ? fullName(member) : 'A paddler'
        } is in another crew in this same category.`,
        memberId,
      });
    }
  }

  // --- Availability ---------------------------------------------------------
  if (input.availability) {
    for (const a of assignments) {
      if (a.role === 'reserve') continue;
      const status = input.availability.get(a.memberId);
      if (status === 'out') {
        const member = members.get(a.memberId);
        issues.push({
          level: 'warning',
          code: 'UNAVAILABLE',
          message: `${member ? fullName(member) : 'A paddler'} is marked unavailable for this event.`,
          memberId: a.memberId,
          seat: a.seat,
        });
      }
    }
  }

  // --- Age division ---------------------------------------------------------
  if (category.ageDivision && input.eventDate) {
    const bounds = AGE_DIVISION_BOUNDS[category.ageDivision];
    for (const a of assignments) {
      if (a.role === 'reserve') continue;
      const member = members.get(a.memberId);
      if (!member?.dateOfBirth) continue;
      const age = ageOn(member.dateOfBirth, input.eventDate);
      if (age === undefined) continue;
      if ((bounds.min != null && age < bounds.min) || (bounds.max != null && age > bounds.max)) {
        issues.push({
          level: 'warning',
          code: 'AGE_DIVISION',
          message: `${fullName(member)} is ${age} — outside ${bounds.label}.`,
          memberId: member.id,
          seat: a.seat,
        });
      }
    }
  }

  // --- Missing data ---------------------------------------------------------
  const missingWeight = paddlerMembers.filter((m) => m.weightKg == null);
  if (missingWeight.length > 0) {
    issues.push({
      level: 'info',
      code: 'MISSING_WEIGHT',
      message: `${missingWeight.length} seated paddler${
        missingWeight.length === 1 ? ' has' : 's have'
      } no recorded weight, so balance figures are understated.`,
    });
  }

  for (const a of paddlers) {
    const member = members.get(a.memberId);
    if (!member || !a.seat) continue;
    if (member.sidePreference !== 'both' && member.sidePreference !== a.seat.side) {
      issues.push({
        level: 'warning',
        code: 'SIDE_PREFERENCE',
        message: `${fullName(member)} paddles ${member.sidePreference} but is seated ${a.seat.side}.`,
        memberId: member.id,
        seat: a.seat,
      });
    }
  }

  return issues;
}

export function countByLevel(issues: Issue[]): Record<IssueLevel, number> {
  return issues.reduce(
    (acc, issue) => ({ ...acc, [issue.level]: acc[issue.level] + 1 }),
    { error: 0, warning: 0, info: 0 } as Record<IssueLevel, number>,
  );
}
