/**
 * Realtime plumbing: table names → query-key roots, plus the debounce that
 * turns a burst of row events into one invalidation.
 *
 * A batched write — a 20-seat fill, a CSV import — emits one WAL event per
 * row. Invalidating per event would refetch the same collection twenty times
 * in a second; the trailing debounce collapses each collection's burst into
 * a single callback once the burst goes quiet.
 */

/** Postgres table → the app's query-key root. Unmapped tables → undefined. */
export const TABLE_TO_COLLECTION: Record<string, string> = {
  members: 'members',
  events: 'events',
  categories: 'categories',
  crews: 'crews',
  assignments: 'assignments',
  race_entries: 'raceEntries',
  availability: 'availability',
  time_trial_sessions: 'timeTrialSessions',
  time_trial_results: 'timeTrialResults',
  club_settings: 'settings',
};

export interface ChangeFanout {
  /** Feed a raw table-change event in. */
  onTableChange(table: string): void;
  /** Cancel every pending timer (unsubscribe path). */
  dispose(): void;
}

export function makeChangeFanout(
  emit: (collection?: string) => void,
  delayMs = 200,
): ChangeFanout {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    onTableChange(table) {
      const collection = TABLE_TO_COLLECTION[table];
      // An unmapped table (clubs, say) is rare and cheap to over-invalidate.
      const key = collection ?? '*';
      const held = timers.get(key);
      if (held) clearTimeout(held);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          emit(collection);
        }, delayMs),
      );
    },

    dispose() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
