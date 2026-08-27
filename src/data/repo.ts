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
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  remove(id: string): Promise<void>;
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
}

/** Availability is keyed by (eventId, memberId) rather than an id of its own. */
export interface AvailabilityRepo {
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
  profile: Profile;
}

export interface AuthGateway {
  getSession(): Promise<Session | null>;
  signInWithOAuth(provider: OAuthProvider): Promise<void>;
  signInWithMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Returns an unsubscribe function. */
  onSessionChange(callback: (session: Session | null) => void): () => void;
  /** Which sign-in buttons to show. Data, so adding a provider is config. */
  availableProviders: OAuthProvider[];
  magicLinkEnabled: boolean;
}

export interface DataAdapter {
  readonly name: 'mock' | 'supabase';
  members: Repo<Member>;
  events: Repo<ClubEvent>;
  categories: Repo<Category>;
  crews: Repo<Crew>;
  assignments: AssignmentRepo;
  raceEntries: Repo<RaceEntry>;
  availability: AvailabilityRepo;
  settings: SettingsRepo;
  admin: AdminRepo;
  auth: AuthGateway;
}
