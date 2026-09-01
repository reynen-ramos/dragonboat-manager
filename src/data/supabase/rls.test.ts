import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The policy matrix, exercised by real signed-in users.
 *
 * Gated like the contract suite, plus the anon key (user clients must go
 * through row-level security, which the service key bypasses):
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_KEY=<service_role key> \
 *   SUPABASE_TEST_ANON_KEY=<anon key> \
 *   npx vitest run src/data/supabase/rls.test.ts
 *
 * Each run builds its own club with unique emails, so it can re-run against
 * the same stack without cleanup.
 */
const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;

if (url && serviceKey && anonKey) {
  describe('row-level security', () => {
    const run = Date.now();
    const adminEmail = `rls-admin-${run}@example.com`;
    const paddlerEmail = `rls-paddler-${run}@example.com`;
    const password = 'rls-test-password-123';

    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const admin = createClient(url, anonKey, { auth: { persistSession: false } });
    const paddler = createClient(url, anonKey, { auth: { persistSession: false } });
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    let clubId: string;
    let anaId: string; // the member the paddler login is linked to
    let benId: string; // a clubmate
    let eventId: string;

    const must = <T>(result: { data: T | null; error: { message: string } | null }): T => {
      if (result.error) throw new Error(result.error.message);
      return result.data as T;
    };

    const makeUser = async (client: SupabaseClient, email: string) => {
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) throw new Error(created.error.message);
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error(signedIn.error.message);
    };

    beforeAll(async () => {
      // Founder signs up cold and creates the club (also creates their profile).
      await makeUser(admin, adminEmail);
      clubId = must(await admin.rpc('create_club', { p_name: `RLS Test Club ${run}` })) as string;

      // Admin builds a two-person roster; staff writes must simply work.
      const rows = must(
        await admin
          .from('members')
          .insert([
            { club_id: clubId, first_name: 'Ana', last_name: 'Reyes', gender: 'female', side_preference: 'left', can_drum: false, can_steer: false, status: 'active', phone: '+63 917 000 0001' },
            { club_id: clubId, first_name: 'Ben', last_name: 'Cruz', gender: 'male', side_preference: 'right', can_drum: false, can_steer: false, status: 'active', phone: '+63 917 000 0002' },
          ])
          .select('id, first_name'),
      ) as { id: string; first_name: string }[];
      anaId = rows.find((r) => r.first_name === 'Ana')!.id;
      benId = rows.find((r) => r.first_name === 'Ben')!.id;

      eventId = (
        must(
          await admin
            .from('events')
            .insert({ club_id: clubId, name: 'Test Training', type: 'practice', start_date: '2026-09-05' })
            .select('id')
            .single(),
        ) as { id: string }
      ).id;

      // Invite the paddler linked to Ana; their first sign-in links the login.
      must(
        await admin.rpc('invite_member', {
          p_club: clubId,
          p_email: paddlerEmail,
          p_role: 'paddler',
          p_member_id: anaId,
        }),
      );
      await makeUser(paddler, paddlerEmail);
    }, 60_000);

    it('a paddler cannot read the members table, but sees the directory with private fields nulled', async () => {
      const direct = must(await paddler.from('members').select('id'));
      expect(direct).toHaveLength(0); // RLS filters silently — no rows, no error

      const directory = must(
        await paddler.from('member_directory').select('id, first_name, phone').eq('club_id', clubId),
      ) as { id: string; first_name: string; phone: string | null }[];
      expect(directory).toHaveLength(2); // the whole roster is visible…
      expect(directory.find((r) => r.id === anaId)?.phone).toBe('+63 917 000 0001'); // own row: full
      expect(directory.find((r) => r.id === benId)?.phone).toBeNull(); // clubmate: private
    });

    it('a paddler answers their own sign-up and nobody else’s', async () => {
      const own = await paddler.from('availability').upsert(
        { club_id: clubId, event_id: eventId, member_id: anaId, status: 'in' },
        { onConflict: 'event_id,member_id' },
      );
      expect(own.error).toBeNull();

      const other = await paddler.from('availability').upsert(
        { club_id: clubId, event_id: eventId, member_id: benId, status: 'out' },
        { onConflict: 'event_id,member_id' },
      );
      expect(other.error).not.toBeNull(); // the with-check policy refuses

      // The staff sheet sees the honest answer.
      const sheet = must(
        await admin.from('availability').select('member_id, status').eq('event_id', eventId),
      ) as { member_id: string }[];
      expect(sheet).toHaveLength(1);
      expect(sheet[0].member_id).toBe(anaId);
    });

    it('a paddler cannot write club data or promote themself', async () => {
      const event = await paddler
        .from('events')
        .insert({ club_id: clubId, name: 'Rogue Event', type: 'race', start_date: '2026-09-06' });
      expect(event.error).not.toBeNull();

      // Update through RLS misses every row rather than erroring.
      await paddler.from('club_members').update({ role: 'admin' }).eq('club_id', clubId);
      const membership = must(
        await paddler.from('club_members').select('role').eq('club_id', clubId),
      ) as { role: string }[];
      expect(membership).toEqual([{ role: 'paddler' }]); // own row only, unchanged
    });

    it('the anon key alone reads nothing', async () => {
      expect(must(await anon.from('events').select('id'))).toHaveLength(0);
      expect(must(await anon.from('member_directory').select('id'))).toHaveLength(0);
      expect(must(await anon.from('clubs').select('id'))).toHaveLength(0);
    });

    it('staff still see everything, private fields included', async () => {
      const directory = must(
        await admin.from('member_directory').select('id, phone').eq('club_id', clubId),
      ) as { id: string; phone: string | null }[];
      expect(directory.find((r) => r.id === benId)?.phone).toBe('+63 917 000 0002');
    });
  });
} else {
  describe('row-level security', () => {
    it.skip('set SUPABASE_TEST_URL, SUPABASE_TEST_KEY and SUPABASE_TEST_ANON_KEY to run', () => {});
  });
}
