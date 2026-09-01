import type { QueryKey } from '@tanstack/react-query';
import { applyChanges, type SeatingChange } from '@/domain/seating';
import type { Assignment, Availability } from '@/domain/types';

/**
 * Pure cache-patch rules for the two optimistic mutations — the sign-up tap
 * and the seating change, the places where waiting a network round trip is
 * felt in the hand.
 *
 * Query keys carry their filter as the second element (['availability',
 * { eventId }]), and every filter field is also a field on the row, so one
 * rule covers the whole family: patch the list, keep only rows the key's
 * filter still matches. The optimistic view only has to be right enough to
 * paint; the awaited invalidation replaces it with the stored truth either
 * way, and a failure rolls the snapshot back.
 */

const filterOf = (key: QueryKey): Record<string, unknown> | undefined =>
  typeof key[1] === 'object' && key[1] !== null ? (key[1] as Record<string, unknown>) : undefined;

const matchesKey = (key: QueryKey, row: Record<string, unknown>): boolean => {
  const filter = filterOf(key);
  return !filter || Object.entries(filter).every(([field, value]) => row[field] === value);
};

/** Upserts the written entries into one cached availability list. */
export function patchAvailabilityCache(
  key: QueryKey,
  cached: Availability[] | undefined,
  entries: Availability[],
): Availability[] | undefined {
  if (!cached) return cached;
  const relevant = entries.filter((e) => matchesKey(key, e as unknown as Record<string, unknown>));
  if (relevant.length === 0) return cached;
  const incoming = new Map(relevant.map((e) => [`${e.eventId}:${e.memberId}`, e]));
  return [...cached.filter((a) => !incoming.has(`${a.eventId}:${a.memberId}`)), ...relevant];
}

/** Applies a seating plan to one cached assignment list. */
export function patchAssignmentsCache(
  key: QueryKey,
  cached: Assignment[] | undefined,
  changes: SeatingChange[],
): Assignment[] | undefined {
  if (!cached) return cached;
  // The domain's own applyChanges — the same rules undo snapshots use —
  // then re-apply the key's filter, since an update can move a row out of
  // a byCrew slice.
  return applyChanges(cached, changes).filter((a) =>
    matchesKey(key, a as unknown as Record<string, unknown>),
  );
}
