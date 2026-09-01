import { mockAdapter } from './mock';
import type { DataAdapter } from './repo';
import { createSupabaseAdapter } from './supabase/adapter';

/**
 * Adapter selection.
 *
 * Defaults to the mock adapter so the app runs with no configuration. Setting
 * `VITE_DATA_ADAPTER=supabase` (with `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY`) switches the whole app over to Postgres — no
 * other code changes. See supabase/README.md for the backend workflow.
 */
export function createAdapter(): DataAdapter {
  const configured = import.meta.env.VITE_DATA_ADAPTER;

  if (configured === 'supabase') {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        'VITE_DATA_ADAPTER=supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set.',
      );
    }
    return createSupabaseAdapter({ url, anonKey });
  }

  return mockAdapter;
}

export const adapter = createAdapter();

export type { DataAdapter } from './repo';

export { UnreadableSnapshotError } from './migrate';
