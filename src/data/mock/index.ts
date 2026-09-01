import type { Assignment, Availability, ClubSettings, Profile, Snapshot } from '@/domain/types';
import { newId } from '@/utils/ids';
import type {
  AccessRepo,
  AdminRepo,
  AssignmentRepo,
  AuthGateway,
  AvailabilityRepo,
  ClubAccess,
  DataAdapter,
  Repo,
  Session,
  SettingsRepo,
} from '../repo';
import { migrateSnapshot, UnreadableSnapshotError } from '../migrate';
import {
  mutateDb,
  readDb,
  resetDb,
  seedDemoDb,
  subscribeToExternalChanges,
  takeReadWarnings,
  writeDb,
} from './db';

/**
 * localStorage-backed adapter.
 *
 * This is what runs until Supabase credentials exist, and it stays useful
 * afterwards: end-to-end tests point at it so they are deterministic and need
 * no network.
 */

/** Collections in the snapshot that are plain id-keyed lists. */
type EntityKey =
  | 'members'
  | 'events'
  | 'categories'
  | 'crews'
  | 'assignments'
  | 'raceEntries'
  | 'timeTrialSessions'
  | 'timeTrialResults';

function matches<T>(item: T, filter?: Partial<T>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(
    ([key, value]) => value === undefined || item[key as keyof T] === value,
  );
}

function makeRepo<K extends EntityKey>(key: K): Repo<Snapshot[K][number]> {
  type T = Snapshot[K][number];

  const rows = (): T[] => readDb()[key] as T[];

  const replace = (db: Snapshot, next: T[]): Snapshot => ({ ...db, [key]: next });

  return {
    async list(filter) {
      return rows().filter((row) => matches(row, filter));
    },

    async get(id) {
      return rows().find((row) => row.id === id);
    },

    async restoreMany(rowsToRestore) {
      if (rowsToRestore.length === 0) return;
      mutateDb((db) => {
        const existing = new Set((db[key] as T[]).map((row) => row.id));
        const fresh = rowsToRestore.filter((row) => !existing.has(row.id));
        return { db: replace(db, [...(db[key] as T[]), ...fresh]), result: undefined };
      });
    },

    async create(input) {
      return mutateDb((db) => {
        const created = { ...input, id: newId() } as T;
        return { db: replace(db, [...(db[key] as T[]), created]), result: created };
      });
    },

    async createMany(inputs) {
      if (inputs.length === 0) return [];
      return mutateDb((db) => {
        const created = inputs.map((input) => ({ ...input, id: newId() }) as T);
        return { db: replace(db, [...(db[key] as T[]), ...created]), result: created };
      });
    },

    async update(id, patch) {
      return mutateDb((db) => {
        const current = (db[key] as T[]).find((row) => row.id === id);
        if (!current) throw new Error(`No ${key} with id ${id}`);
        const updated = { ...current, ...patch } as T;
        return {
          db: replace(
            db,
            (db[key] as T[]).map((row) => (row.id === id ? updated : row)),
          ),
          result: updated,
        };
      });
    },

    async remove(id) {
      mutateDb((db) => ({
        db: replace(
          db,
          (db[key] as T[]).filter((row) => row.id !== id),
        ),
        result: undefined,
      }));
    },

    async removeMany(ids) {
      if (ids.length === 0) return;
      const gone = new Set(ids);
      mutateDb((db) => ({
        db: replace(
          db,
          (db[key] as T[]).filter((row) => !gone.has(row.id)),
        ),
        result: undefined,
      }));
    },

    async bulkUpdate(patches) {
      return mutateDb((db) => {
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        const updated: T[] = [];
        const next = (db[key] as T[]).map((row) => {
          const patch = byId.get(row.id);
          if (!patch) return row;
          const merged = { ...row, ...patch } as T;
          updated.push(merged);
          return merged;
        });
        return { db: replace(db, next), result: updated };
      });
    },
  };
}

const assignmentRepo: AssignmentRepo = {
  ...makeRepo('assignments'),

  async replaceForCrew(crewId, assignments) {
    return mutateDb((db) => ({
      db: {
        ...db,
        assignments: [...db.assignments.filter((a) => a.crewId !== crewId), ...assignments],
      },
      result: assignments,
    }));
  },

  async applyChanges(changes) {
    if (changes.length === 0) return;
    mutateDb((db) => {
      let next = db.assignments.slice();
      for (const change of changes) {
        if (change.op === 'create') {
          next.push({ ...change.assignment, id: newId() } as Assignment);
        } else if (change.op === 'update') {
          const index = next.findIndex((a) => a.id === change.id);
          // Throwing before the write keeps the whole plan unapplied — a
          // half-moved crew is worse than a failed drop.
          if (index === -1) throw new Error(`No assignments with id ${change.id}`);
          next[index] = { ...next[index], ...change.patch } as Assignment;
        } else {
          next = next.filter((a) => a.id !== change.id);
        }
      }
      return { db: { ...db, assignments: next }, result: undefined };
    });
  },
};

const availabilityRepo: AvailabilityRepo = {
  async listAll() {
    return readDb().availability;
  },

  async listByEvent(eventId) {
    return readDb().availability.filter((a) => a.eventId === eventId);
  },

  async listByMember(memberId) {
    return readDb().availability.filter((a) => a.memberId === memberId);
  },

  async set(entry) {
    return (await availabilityRepo.setMany([entry]))[0];
  },

  async setMany(entries) {
    return mutateDb((db) => {
      const keyOf = (a: Availability) => `${a.eventId}:${a.memberId}`;
      const incoming = new Map(entries.map((entry) => [keyOf(entry), entry]));
      const kept = db.availability.filter((a) => !incoming.has(keyOf(a)));
      return {
        db: { ...db, availability: [...kept, ...entries] },
        result: entries,
      };
    });
  },

  async removeByEvent(eventId) {
    mutateDb((db) => ({
      db: { ...db, availability: db.availability.filter((a) => a.eventId !== eventId) },
      result: undefined,
    }));
  },

  async removeByMember(memberId) {
    mutateDb((db) => ({
      db: { ...db, availability: db.availability.filter((a) => a.memberId !== memberId) },
      result: undefined,
    }));
  },
};

const settingsRepo: SettingsRepo = {
  async get() {
    return readDb().settings;
  },
  async save(settings: ClubSettings) {
    return mutateDb((db) => ({ db: { ...db, settings }, result: settings }));
  },
};

const adminRepo: AdminRepo = {
  async exportSnapshot() {
    return { ...readDb(), exportedAt: new Date().toISOString() };
  },
  async importSnapshot(snapshot) {
    // Refuses rather than best-effort: the user picked this file deliberately,
    // so a clear rejection beats silently installing a damaged club over a
    // good one. That includes partial damage — discarding the dropped notes
    // here used to install a backup minus its unreadable rows in silence,
    // which is precisely the policy this comment claims to refuse.
    const { snapshot: migrated, dropped } = migrateSnapshot(snapshot);
    if (dropped.length > 0) {
      throw new UnreadableSnapshotError(
        `This backup has damaged rows, so nothing was imported. (${dropped.join('; ')}.)`,
      );
    }
    writeDb(migrated);
  },
  async loadDemoClub() {
    seedDemoDb();
  },
  async clearAll() {
    resetDb();
  },
};

/**
 * Stand-in auth.
 *
 * The mock adapter is always signed in: with no server there is nothing to
 * authenticate against, and gating the UI behind a fake login would only
 * obstruct review. What IS real is the role — a dev switcher in Settings
 * writes it here, which is how paddler-facing UI is built and tested without
 * a backend. Switching to paddler borrows the first active roster member as
 * "you".
 */
const DEV_ROLE_KEY = 'dragonboat:dev-role';

export function devRole(): Profile['role'] {
  try {
    const stored = localStorage.getItem(DEV_ROLE_KEY);
    return stored === 'coach' || stored === 'paddler' ? stored : 'admin';
  } catch {
    return 'admin';
  }
}

export function setDevRole(role: Profile['role']): void {
  localStorage.setItem(DEV_ROLE_KEY, role);
}

function mockSession(): Session {
  const role = devRole();
  const memberId =
    role === 'paddler'
      ? readDb().members.find((m) => m.status === 'active')?.id
      : undefined;
  return {
    email: 'demo@dragonboat.local',
    profile: { id: 'mock-user', email: 'demo@dragonboat.local', role, memberId },
  };
}

const authGateway: AuthGateway = {
  async getSession(): Promise<Session | null> {
    return mockSession();
  },
  async signInWithOAuth() {
    /* Always signed in. */
  },
  async signInWithMagicLink() {
    /* Always signed in. */
  },
  async signOut() {
    /* Always signed in. */
  },
  async createClub() {
    /* The mock is its own club. */
  },
  onSessionChange(callback) {
    callback(mockSession());
    return () => {};
  },
  availableProviders: [],
  magicLinkEnabled: false,
};

/**
 * In-memory access list, so the admin Access screen is buildable and testable
 * against the mock. Deliberately not persisted: access control is meaningless
 * without a real backend, and stale fake logins would only confuse.
 */
function makeMockAccess(): AccessRepo {
  let rows: ClubAccess[] = [
    { profileId: 'mock-user', email: 'demo@dragonboat.local', role: 'admin', active: true },
  ];
  return {
    async list() {
      return rows.map((row) => ({ ...row }));
    },
    async invite(email, role, memberId) {
      const normalised = email.trim().toLowerCase();
      if (rows.some((r) => r.email === normalised)) {
        throw new Error('That email is already invited.');
      }
      rows.push({ profileId: newId(), email: normalised, role, memberId, active: false });
    },
    async setRole(profileId, role) {
      rows = rows.map((r) => (r.profileId === profileId ? { ...r, role } : r));
    },
    async linkMember(profileId, memberId) {
      rows = rows.map((r) => (r.profileId === profileId ? { ...r, memberId } : r));
    },
    async revoke(profileId) {
      rows = rows.filter((r) => r.profileId !== profileId);
    },
  };
}

export const mockAdapter: DataAdapter = {
  name: 'mock',
  subscribeToExternalChanges,
  takeReadWarnings,
  members: makeRepo('members'),
  events: makeRepo('events'),
  categories: makeRepo('categories'),
  crews: makeRepo('crews'),
  assignments: assignmentRepo,
  raceEntries: makeRepo('raceEntries'),
  timeTrialSessions: makeRepo('timeTrialSessions'),
  timeTrialResults: makeRepo('timeTrialResults'),
  availability: availabilityRepo,
  settings: settingsRepo,
  admin: adminRepo,
  auth: authGateway,
  access: makeMockAccess(),
};
