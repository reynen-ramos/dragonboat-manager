import type { Availability, ClubSettings, Profile, Snapshot } from '@/domain/types';
import { newId } from '@/utils/ids';
import type {
  AdminRepo,
  AssignmentRepo,
  AuthGateway,
  AvailabilityRepo,
  DataAdapter,
  Repo,
  Session,
  SettingsRepo,
} from '../repo';
import { migrateSnapshot, UnreadableSnapshotError } from '../migrate';
import { mutateDb, readDb, resetDb, seedDemoDb, writeDb } from './db';

/**
 * localStorage-backed adapter.
 *
 * This is what runs until Supabase credentials exist, and it stays useful
 * afterwards: end-to-end tests point at it so they are deterministic and need
 * no network.
 */

/** Collections in the snapshot that are plain id-keyed lists. */
type EntityKey = 'members' | 'events' | 'categories' | 'crews' | 'assignments' | 'raceEntries';

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

    async create(input) {
      return mutateDb((db) => {
        const created = { ...input, id: newId() } as T;
        return { db: replace(db, [...(db[key] as T[]), created]), result: created };
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
};

const availabilityRepo: AvailabilityRepo = {
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
 * The mock adapter is always signed in as an admin: with no server there is
 * nothing to authenticate against, and gating the UI behind a fake login would
 * only obstruct review. Real sign-in arrives with the Supabase adapter.
 */
const MOCK_PROFILE: Profile = {
  id: 'mock-admin',
  email: 'demo@dragonboat.local',
  role: 'admin',
  memberId: undefined,
};

const authGateway: AuthGateway = {
  async getSession(): Promise<Session | null> {
    return { profile: MOCK_PROFILE };
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
  onSessionChange(callback) {
    callback({ profile: MOCK_PROFILE });
    return () => {};
  },
  availableProviders: [],
  magicLinkEnabled: false,
};

export const mockAdapter: DataAdapter = {
  name: 'mock',
  members: makeRepo('members'),
  events: makeRepo('events'),
  categories: makeRepo('categories'),
  crews: makeRepo('crews'),
  assignments: assignmentRepo,
  raceEntries: makeRepo('raceEntries'),
  availability: availabilityRepo,
  settings: settingsRepo,
  admin: adminRepo,
  auth: authGateway,
};
