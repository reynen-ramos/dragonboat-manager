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

export type EventType = 'race' | 'practice';

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
  type: EventType;
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
}

/**
 * One person's place in one crew.
 *
 * `seat` is set only for `paddler`; drummer, cox, and reserve have no seat
 * coordinates. Keeping them in the same table means "who is in this crew" is a
 * single query.
 */
export interface Assignment {
  id: string;
  crewId: string;
  memberId: string;
  role: CrewRole;
  seat?: SeatPosition;
  /** Pinned paddlers are never moved by auto-balance. */
  pinned?: boolean;
}

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

/** Links a signed-in auth user to a roster member and an app role. */
export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  /** Null until an admin links this login to a roster member. */
  memberId?: string;
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
}
