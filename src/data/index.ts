import { mockAdapter } from './mock';
import type { DataAdapter } from './repo';

/**
 * Adapter selection.
 *
 * Defaults to the mock adapter so the app runs with no configuration. Setting
 * `VITE_DATA_ADAPTER=supabase` (with `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY`) switches the whole app over to the real backend —
 * no other code changes.
 */
export function createAdapter(): DataAdapter {
  const configured = import.meta.env.VITE_DATA_ADAPTER;

  if (configured === 'supabase') {
    throw new Error(
      'The Supabase adapter is not wired up yet. Unset VITE_DATA_ADAPTER to use local storage.',
    );
  }

  return mockAdapter;
}

export const adapter = createAdapter();

export type { DataAdapter } from './repo';

/**
 * Cross-tab notification and startup read warnings.
 *
 * Re-exported here so `src/queries` never reaches into an adapter's internals.
 * Both are localStorage-shaped today; a Supabase adapter would satisfy the
 * first with a realtime subscription and the second not at all, at which point
 * they belong on `DataAdapter` rather than beside it.
 */
export { subscribeToExternalChanges, takeReadWarnings } from './mock/db';

export { UnreadableSnapshotError } from './migrate';
