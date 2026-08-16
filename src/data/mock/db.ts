import { buildDemoSnapshot } from '@/domain/demoData';
import { DEFAULT_CLUB_SETTINGS } from '@/domain/rules.config';
import type { Snapshot } from '@/domain/types';

/**
 * The mock adapter's backing store: one JSON snapshot in localStorage.
 *
 * A club's entire database is a few hundred kilobytes at most, so reading and
 * writing the whole thing per operation is simpler than maintaining indexes and
 * fast enough to be imperceptible.
 */

const STORAGE_KEY = 'dragonboat:db:v1';

export function emptySnapshot(): Snapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    members: [],
    events: [],
    categories: [],
    crews: [],
    assignments: [],
    availability: [],
    raceEntries: [],
    settings: DEFAULT_CLUB_SETTINGS,
  };
}

let cache: Snapshot | null = null;

export function readDb(): Snapshot {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge over an empty snapshot so a database written by an older version
      // gains any newly added collections instead of crashing on undefined.
      cache = { ...emptySnapshot(), ...(JSON.parse(raw) as Partial<Snapshot>) };
      return cache;
    }
  } catch (error) {
    console.warn('Stored club data could not be read; starting empty.', error);
  }

  cache = emptySnapshot();
  return cache;
}

export function writeDb(next: Snapshot): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Most likely the storage quota. Surface it rather than losing edits quietly.
    console.error('Could not save club data.', error);
    throw new Error('Could not save — browser storage is full or unavailable.');
  }
}

/** Applies a change to the database and persists it. */
export function mutateDb<T>(fn: (db: Snapshot) => { db: Snapshot; result: T }): T {
  const { db, result } = fn(readDb());
  writeDb(db);
  return result;
}

export function resetDb(): void {
  writeDb(emptySnapshot());
}

export function seedDemoDb(): void {
  writeDb(buildDemoSnapshot());
}

/** Test seam: drops the in-memory cache so a fresh read hits storage. */
export function invalidateCache(): void {
  cache = null;
}
