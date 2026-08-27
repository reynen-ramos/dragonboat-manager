import { DEFAULT_CLUB_SETTINGS, SNAPSHOT_VERSION } from '@/domain/rules.config';
import type { Snapshot } from '@/domain/types';

/**
 * Reading a stored snapshot written by some other version of this app.
 *
 * `version` was written from the first release and read by nothing, so until
 * now a newer build would load an older database blindly and produce rows that
 * violate their own types — wrong seats rather than an error.
 *
 * Two callers, two policies, because the risks differ:
 *
 *   Startup   — best effort. Refusing to open the club over three bad rows is
 *               worse than opening it and saying three rows could not be read.
 *   Import    — refuse. The user explicitly chose a file, so a clear "this is
 *               not readable" beats silently installing a damaged club.
 */

/** Bump `SNAPSHOT_VERSION` when a shape change needs a migration step below. */
export const CURRENT_VERSION = SNAPSHOT_VERSION;

export interface MigrationResult {
  snapshot: Snapshot;
  /** Human-readable notes about anything dropped, for the caller to surface. */
  dropped: string[];
}

export class UnreadableSnapshotError extends Error {}

const COLLECTIONS = [
  'members',
  'events',
  'categories',
  'crews',
  'assignments',
  'availability',
  'raceEntries',
] as const;

export function emptySnapshot(): Snapshot {
  return {
    version: CURRENT_VERSION,
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A row is keepable only if it is an object carrying a usable string id. */
const hasId = (row: unknown): row is Record<string, unknown> & { id: string } =>
  isRecord(row) && typeof row.id === 'string' && row.id.length > 0;

/**
 * Coerces stored data into a snapshot, reporting what it had to discard.
 *
 * Throws `UnreadableSnapshotError` only for input no policy can rescue: not an
 * object at all, or written by a future version whose shape this build cannot
 * know. Everything else degrades to a note in `dropped`.
 */
export function migrateSnapshot(raw: unknown): MigrationResult {
  if (!isRecord(raw)) {
    throw new UnreadableSnapshotError('This file is not a Dragonboat Manager backup.');
  }

  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (version > CURRENT_VERSION) {
    throw new UnreadableSnapshotError(
      `This backup was made by a newer version of the app (format ${version}). ` +
        'Update the app, then open it again.',
    );
  }

  // Migration steps land here as `if (version < N) …`, each rewriting rows in
  // place. There are none yet — v1 is the only format that has ever shipped.

  const base = emptySnapshot();
  const dropped: string[] = [];

  for (const key of COLLECTIONS) {
    const value = raw[key];
    if (value === undefined) continue; // Collection added after this was written.
    if (!Array.isArray(value)) {
      dropped.push(`${key}: not a list, ignored`);
      continue;
    }
    const kept = value.filter(hasId);
    if (kept.length < value.length) {
      dropped.push(`${key}: ${value.length - kept.length} unreadable row(s) skipped`);
    }
    // Cast is the boundary itself: rows are shape-checked as far as an id, and
    // `validateCrew` reports what survives but is still wrong.
    (base[key] as unknown[]) = kept;
  }

  if (isRecord(raw.settings)) {
    base.settings = { ...DEFAULT_CLUB_SETTINGS, ...raw.settings } as Snapshot['settings'];
  } else if (raw.settings !== undefined) {
    dropped.push('settings: unreadable, defaults used');
  }

  if (typeof raw.exportedAt === 'string') base.exportedAt = raw.exportedAt;
  base.version = CURRENT_VERSION;

  return { snapshot: base, dropped };
}
