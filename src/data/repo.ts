import type { SeatingChange } from '@/domain/seating';
import type {
  Assignment,
  Availability,
  Category,
  ClubEvent,
  ClubSettings,
  Crew,
  Member,
  Profile,
  RaceEntry,
  Snapshot,
  TimeTrialResult,
  TimeTrialSession,
} from '@/domain/types';

export type { Snapshot };

/**
 * The storage boundary.
 *
 * Every screen reaches data through these interfaces and never touches a
 * storage engine directly. That is what makes swapping localStorage for
 * Supabase a matter of writing one more adapter rather than editing the UI.
 */

export interface Repo<T extends { id: string }> {
  /** `filter` matches on exact field equality — enough for every query here. */
  list(filter?: Partial<T>): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: Omit<T, 'id'>): Promise<T>;
  /**
   * Inserts many rows as one write, in the order given. Batch operations
   * exist so a CSV import or a recurring series costs one round trip on a
   * network backend, not one per row.
   */
  createMany(inputs: Omit<T, 'id'>[]): Promise<T[]>;
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  remove(id: string): Promise<void>;
  /** Removes many rows as one write. Ids that no longer exist are ignored. */
  removeMany(ids: string[]): Promise<void>;
  /** Applied as one atomic write, so a re-seat never leaves a half-moved crew. */
  bulkUpdate(patches: { id: string; patch: Partial<Omit<T, 'id'>> }[]): Promise<T[]>;
  /**
   * Re-inserts rows exactly as given, ids included, skipping any id that
   * already exists. This is the undo path for cascades: restored rows must
   * keep their identity or everything referencing them dangles, and skipping
   * existing ids makes a second Undo press harmless.
   */
  restoreMany(rows: T[]): Promise<void>;
}

export interface AssignmentRepo extends Repo<Assignment> {
  /**
   * Replaces a crew's entire lineup with the rows given, ids included.
   *
   * Undo needs to restore a previous lineup exactly — same assignment ids, so
   * that a subsequent redo and any in-flight references still line up. Creating
   * fresh rows would break that identity.
   */
  replaceForCrew(crewId: string, assignments: Assignment[]): Promise<Assignment[]>;
  /**
   * Applies a planned set of seating changes as one atomic write — a drop that
   * swaps two paddlers, or a fill that seats twenty, either fully lands or
   * fully doesn't. A half-applied plan would leave a boat no one planned.
   */
  applyChanges(changes: SeatingChange[]): Promise<void>;
}

/** Availability is keyed by (eventId, memberId) rather than an id of its own. */
export interface AvailabilityRepo {
  /** Every answer across every event — the club-wide read reports run on. */
  listAll(): Promise<Availability[]>;
  listByEvent(eventId: string): Promise<Availability[]>;
  listByMember(memberId: string): Promise<Availability[]>;
  set(entry: Availability): Promise<Availability>;
  setMany(entries: Availability[]): Promise<Availability[]>;
  removeByEvent(eventId: string): Promise<void>;
  removeByMember(memberId: string): Promise<void>;
}

export interface SettingsRepo {
  get(): Promise<ClubSettings>;
  save(settings: ClubSettings): Promise<ClubSettings>;
}

/** Whole-database operations: backup, restore, demo seeding. */
export interface AdminRepo {
  exportSnapshot(): Promise<Snapshot>;
  importSnapshot(snapshot: Snapshot): Promise<void>;
  loadDemoClub(): Promise<void>;
  clearAll(): Promise<void>;
}

export type OAuthProvider = 'google' | 'facebook';

export interface Session {
  /** The signed-in email — present even before any club knows this person. */
  email: string;
  /**
   * Null when the email isn't registered with a club yet: the person signed
   * in without an invitation. They can found a club or ask to be invited.
   */
  profile: Profile | null;
}

export interface AuthGateway {
  getSession(): Promise<Session | null>;
  signInWithOAuth(provider: OAuthProvider): Promise<void>;
  signInWithMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Founds a club with this login as its admin, then re-emits the session. */
  createClub(name: string): Promise<void>;
  /** Returns an unsubscribe function. */
  onSessionChange(callback: (session: Session | null) => void): () => void;
  /** Which sign-in buttons to show. Data, so adding a provider is config. */
  availableProviders: OAuthProvider[];
  magicLinkEnabled: boolean;
}

/** One login's standing in the club, as the Access screen manages it. */
export interface ClubAccess {
  profileId: string;
  email: string;
  role: Profile['role'];
  /** The roster member this login is linked to, if any. */
  memberId?: string;
  /** Whether the invited email has actually signed in yet. */
  active: boolean;
}

/** The contact fields a paddler may edit on their own roster row. */
export interface OwnContact {
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/** Admin-only management of who can sign in and as what. */
export interface AccessRepo {
  list(): Promise<ClubAccess[]>;
  invite(email: string, role: Profile['role'], memberId?: string): Promise<void>;
  setRole(profileId: string, role: Profile['role']): Promise<void>;
  linkMember(profileId: string, memberId: string | undefined): Promise<void>;
  revoke(profileId: string): Promise<void>;
}

export interface DataAdapter {
  readonly name: 'mock' | 'supabase';
  /**
   * Notifies when the database changes underneath this app instance — another
   * browser tab for localStorage, another device over realtime for Supabase.
   * `collection` names the query-key root that moved ('members', 'events'…);
   * undefined means "unknown, treat everything as stale". Returns an
   * unsubscribe function.
   */
  subscribeToExternalChanges(callback: (collection?: string) => void): () => void;
  /** Anything the last read had to skip, drained once for startup toasts. */
  takeReadWarnings(): string[];
  members: Repo<Member>;
  events: Repo<ClubEvent>;
  categories: Repo<Category>;
  crews: Repo<Crew>;
  assignments: AssignmentRepo;
  raceEntries: Repo<RaceEntry>;
  timeTrialSessions: Repo<TimeTrialSession>;
  timeTrialResults: Repo<TimeTrialResult>;
  availability: AvailabilityRepo;
  settings: SettingsRepo;
  admin: AdminRepo;
  auth: AuthGateway;
  access: AccessRepo;
  /**
   * The signed-in paddler's one write to the roster: their own contact
   * details. Staff edit members directly; this path exists because paddlers
   * cannot — the backend enforces the column list.
   */
  updateMyContact(contact: OwnContact): Promise<void>;
}
