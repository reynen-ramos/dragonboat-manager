/**
 * Core domain entities.
 *
 * This module — and everything else in `src/domain` — must stay free of React,
 * Supabase, and browser APIs. It is the part of the app that would port
 * unchanged to a native client.
 */

export type Side = 'left' | 'right';
export type SidePreference = 'left' | 'right' | 'both';
export type Gender = 'male' | 'female' | 'other';
export type MemberStatus = 'active' | 'inactive' | 'alumni';

/** Where along the boat a paddler sits. Zones are advisory, not enforced. */
export type SeatZone = 'stroke' | 'engine' | 'rockets';

/** Everyone in a crew occupies one of these roles. */
export type CrewRole = 'paddler' | 'drummer' | 'cox' | 'reserve';

/** Small boat (10 paddlers) or standard boat (20 paddlers). */
export type BoatSize = 10 | 20;

export type GenderClass = 'open' | 'mixed' | 'women';

export type AgeDivision =
  | 'junior'
  | 'u24'
  | 'premier'
  | 'seniorA'
  | 'seniorB'
  | 'seniorC';

export type AppRole = 'admin' | 'coach' | 'paddler';

export type AvailabilityStatus = 'in' | 'out' | 'maybe';

export type RaceStage = 'heat' | 'semi' | 'final';

/**
 * The behaviour an event type inherits: 'race' gets race day, results, and
 * history counts; 'practice' gets training kinds; 'other' gets neither.
 * The types themselves are club-maintained (`ClubSettings.eventTypes`) —
 * every custom type declares which of these three it behaves like.
 */
export type EventBase = 'race' | 'practice' | 'other';

/** A club-defined event type. Built-ins use ids 'race', 'practice', 'other'. */
export interface EventTypeDef {
  id: string;
  label: string;
  base: EventBase;
}

/** A club-defined kind of training session. A pure label — no behaviour. */
export interface TrainingKindDef {
  id: string;
  label: string;
}

/** A club-defined time-trial discipline — the craft or machine paddled. */
export interface DisciplineDef {
  id: string;
  label: string;
}

/** A physical seat position in the boat. Rows run bow (1) to stern (N). */
export interface SeatPosition {
  row: number;
  side: Side;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  /** ISO date (YYYY-MM-DD). Used to derive age for age-division checks. */
  dateOfBirth?: string;
  weightKg?: number;
  sidePreference: SidePreference;
  canDrum: boolean;
  canSteer: boolean;
  preferredZones?: SeatZone[];
  status: MemberStatus;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  /** ISO date the member joined the club. */
  joinedAt?: string;
}

export interface ClubEvent {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  endDate?: string;
  location?: string;
  /** Id of a `ClubSettings.eventTypes` entry. */
  type: string;
  /** Id of a `ClubSettings.trainingKinds` entry — only meaningful when the
   *  event's type behaves like a practice. */
  trainingKind?: string;
  notes?: string;
}

export interface Category {
  id: string;
  eventId: string;
  boatSize: BoatSize;
  genderClass: GenderClass;
  /** All three below are optional; unset keeps the category minimal. */
  ageDivision?: AgeDivision;
  distanceM?: number;
  label?: string;
}

export interface Crew {
  id: string;
  categoryId: string;
  name: string;
  notes?: string;
  /**
   * Set when this crew is an alternative lineup for another crew ("Plan B").
   * A variant is a draft: it never races, never counts toward double-booking,
   * and its paddlers stay eligible for every real crew. Optional and additive,
   * so a v1 snapshot loads unchanged.
   */
  variantOf?: string;
}

interface AssignmentBase {
  id: string;
  crewId: string;
  memberId: string;
}

/**
 * A paddler in a seat. The seat is what puts them in the boat, so it is
 * required — a paddler without one is not a lighter kind of paddler, it is a
 * corrupt row, and `validateCrew` reports it as such.
 */
export interface PaddlerAssignment extends AssignmentBase {
  role: 'paddler';
  seat: SeatPosition;
  /** Pinned paddlers are never moved by auto-balance. */
  pinned?: boolean;
}

/** Someone in the crew who occupies no seat. */
export interface CrewMemberAssignment extends AssignmentBase {
  role: 'drummer' | 'cox' | 'reserve';
  seat?: undefined;
  pinned?: undefined;
}

/**
 * One person's place in one crew.
 *
 * Keeping every role in the same table means "who is in this crew" is a single
 * query. The union is what stops a seatless paddler or a seated cox from being
 * written in the first place; see `StoredAssignment` for the shape that crosses
 * the storage boundary, where neither guarantee holds yet.
 */
export type Assignment = PaddlerAssignment | CrewMemberAssignment;

/**
 * An assignment as it arrives from storage, before anything has checked it.
 *
 * localStorage and any future backend hand back whatever was written by an
 * older release or a hand-edited backup, so the fields the domain requires are
 * optional here. `validateCrew` is the boundary that reports the difference.
 */
export interface StoredAssignment extends AssignmentBase {
  role: CrewRole;
  seat?: SeatPosition;
  pinned?: boolean;
}

/**
 * `Omit` collapses a union into its common keys, which would turn `Assignment`
 * back into the loose shape this file exists to replace. These distribute.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A new assignment, before storage has given it an id. */
export type AssignmentInput = DistributiveOmit<Assignment, 'id'>;

/** A partial update to one assignment. */
export type AssignmentPatch = DistributiveOmit<Partial<Assignment>, 'id'>;

export interface Availability {
  eventId: string;
  memberId: string;
  status: AvailabilityStatus;
  note?: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export interface RaceEntry {
  id: string;
  crewId: string;
  stage: RaceStage;
  heat?: number;
  lane?: number;
  /** Finish time in milliseconds. Absent until the crew has raced. */
  timeMs?: number;
  placement?: number;
}

/**
 * One sitting of individual time trials: a date, a distance, a discipline.
 *
 * Trials are member-scoped where races are crew-scoped — the point of a trial
 * is comparing and tracking paddlers, not boats, so results hang off members
 * directly instead of borrowing the crew machinery.
 */
export interface TimeTrialSession {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  name?: string;
  distanceM: number;
  /** Id of a `ClubSettings.disciplines` entry. */
  discipline?: string;
  notes?: string;
}

/** One paddler's run in a time-trial session. */
export interface TimeTrialResult {
  id: string;
  sessionId: string;
  memberId: string;
  /** Time in milliseconds. Absent until the paddler has been timed. */
  timeMs?: number;
  note?: string;
}

/** Links a signed-in auth user to a roster member and an app role. */
export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  /** Null until an admin links this login to a roster member. */
  memberId?: string;
}

/**
 * The whole database in one object — used for JSON backup, restore, demo
 * seeding, and as the migration path off local-only storage.
 */
export interface Snapshot {
  version: number;
  exportedAt: string;
  members: Member[];
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  assignments: Assignment[];
  availability: Availability[];
  raceEntries: RaceEntry[];
  timeTrialSessions: TimeTrialSession[];
  timeTrialResults: TimeTrialResult[];
  settings: ClubSettings;
}

/** Club-wide tunables that differ between federations and regattas. */
export interface ClubSettings {
  /** Minimum women among paddlers in a mixed crew, per boat size. */
  minWomenMixed: Record<BoatSize, number>;
  /** Left/right weight delta tolerated before the balance bar goes amber, as a
   *  fraction of total seated weight. */
  sideBalanceTolerance: number;
  /** Same, for bow-half vs stern-half weight. */
  bowSternBalanceTolerance: number;
  /** The club's event types. Seeded with the three built-ins. */
  eventTypes: EventTypeDef[];
  /** The club's kinds of training session. Seeded with water/land/supplementary. */
  trainingKinds: TrainingKindDef[];
  /** The club's time-trial disciplines. Seeded with OC1/erg/small boat. */
  disciplines: DisciplineDef[];
}
