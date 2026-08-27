import { buildDemoSnapshot } from '@/domain/demoData';
import type { Snapshot } from '@/domain/types';
import { emptySnapshot, migrateSnapshot, UnreadableSnapshotError } from '../migrate';

/**
 * The mock adapter's backing store: one JSON snapshot in localStorage.
 *
 * A club's entire database is a few hundred kilobytes at most, so reading and
 * writing the whole thing per operation is simpler than maintaining indexes and
 * fast enough to be imperceptible.
 *
 * Writing the whole snapshot is also what makes a stale cache dangerous rather
 * than merely wrong: a second tab holding an old copy does not lose the one row
 * it edited, it overwrites every collection the first tab touched. Hence the
 * `storage` listener below — the cache is only valid until another tab writes.
 */

const STORAGE_KEY = 'dragonboat:db:v1';

export { emptySnapshot };

let cache: Snapshot | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Notified when another tab replaces the database.
 *
 * The store cannot refetch anything itself; the app wires this to React Query
 * so the screens reload rather than sitting on data that no longer exists.
 */
export function subscribeToExternalChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // `key === null` is a whole-store clear, which counts too.
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = null;
    for (const listener of listeners) listener();
  });
}

/** Notes from the last read, for the app to surface once at startup. */
let lastReadWarnings: string[] = [];

export function takeReadWarnings(): string[] {
  const warnings = lastReadWarnings;
  lastReadWarnings = [];
  return warnings;
}

export function readDb(): Snapshot {
  if (cache) return cache;

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Private-mode browsers can throw on access alone. Run from memory.
    console.warn('Storage is unavailable; changes will not persist.', error);
    cache = emptySnapshot();
    return cache;
  }

  if (!raw) {
    cache = emptySnapshot();
    return cache;
  }

  try {
    const { snapshot, dropped } = migrateSnapshot(JSON.parse(raw));
    if (dropped.length > 0) lastReadWarnings = dropped;
    cache = snapshot;
    return cache;
  } catch (error) {
    // Keep the unreadable blob rather than letting the next write erase it:
    // it is the only copy of whatever the user had, and a support question
    // ("my club is empty") is answerable only while the evidence survives.
    quarantine(raw, error);
    lastReadWarnings = [
      'Your stored club data could not be read and has been set aside. ' +
        'Nothing was deleted — restore a backup, or ask for help before making changes.',
    ];
    cache = emptySnapshot();
    return cache;
  }
}

function quarantine(raw: string, error: unknown) {
  console.error('Stored club data could not be read.', error);
  try {
    localStorage.setItem(`${STORAGE_KEY}:unreadable:${Date.now()}`, raw);
  } catch {
    // Nothing useful to do — the copy is best effort.
  }
}

export function writeDb(next: Snapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Most likely the storage quota. The cache is deliberately left untouched
    // so memory still matches disk; updating it first would leave the UI
    // showing an edit that was never saved.
    console.error('Could not save club data.', error);
    throw new Error('Could not save — browser storage is full or unavailable.');
  }
  cache = next;
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

export { UnreadableSnapshotError };
