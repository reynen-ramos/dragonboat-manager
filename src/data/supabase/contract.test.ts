import { describe, it } from 'vitest';
import { describeAdapterContract } from '../adapterContract';
import { createSupabaseAdapter } from './adapter';

/**
 * The same contract the mock passes, against a real Postgres.
 *
 * Gated: runs only when SUPABASE_TEST_URL (and SUPABASE_TEST_ANON_KEY) point
 * at a disposable database — the Supabase CLI local stack is the intended
 * target (see supabase/README.md):
 *
 *   supabase start
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_ANON_KEY=<anon key from `supabase status`> \
 *   npx vitest run src/data/supabase/contract.test.ts
 *
 * Every test starts with clearAll(), so never point this at data you love.
 *
 * A plain `if`, not describe.skipIf: a skipped describe's body still runs at
 * collection time, and constructing a client from an unset URL throws.
 */
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;

if (url && anonKey) {
  const adapter = createSupabaseAdapter({ url, anonKey });
  describeAdapterContract('supabase', () => adapter, () => adapter.admin.clearAll());
} else {
  describe('supabase adapter contract', () => {
    it.skip('set SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY to run against a local stack', () => {});
  });
}
