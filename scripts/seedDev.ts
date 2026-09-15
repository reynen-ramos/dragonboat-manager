/**
 * Seeds a Supabase project with ready-made demo logins and a full demo club:
 *
 *   admin@demo.local   — admin of "Demo Club"
 *   coach@demo.local   — coach
 *   paddler@demo.local — paddler, linked to Maria Santos on the roster
 *
 * All three share one password (SEED_PASSWORD, default 'demo-password') and
 * can equally sign in through the app's magic-link flow — on the local stack
 * the emails land in Mailpit (http://127.0.0.1:54324).
 *
 * Defaults target the CLI local stack (`supabase start`); point it elsewhere
 * with SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY. Because it
 * creates accounts with a known password, it refuses non-local URLs unless
 * SEED_ALLOW_REMOTE=1.
 *
 * Rerunnable: existing users and invitations are kept, the club's data is
 * replaced with a fresh demo season, and the paddler's roster link is
 * re-established (the import cycle severs it by design).
 *
 *   npm run seed:dev
 */
import { createClient } from '@supabase/supabase-js';
import { buildDemoSnapshot } from '../src/domain/demoData';
import { createSupabaseAdapter } from '../src/data/supabase/adapter';

// The Supabase CLI's fixed local demo keys — not secrets.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const url = process.env.SUPABASE_URL ?? LOCAL_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? LOCAL_ANON;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? LOCAL_SERVICE;
const password = process.env.SEED_PASSWORD ?? 'demo-password';

const ADMIN = 'admin@demo.local';
const COACH = 'coach@demo.local';
const PADDLER = 'paddler@demo.local';
const CLUB_NAME = 'Demo Club';
const PADDLER_MEMBER = 'demo-member-1'; // Maria Santos, the demo's first paddler

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== '1') {
  console.error(
    `Refusing to seed ${url}: this creates logins with a known password.\n` +
      'Set SEED_ALLOW_REMOTE=1 (and a strong SEED_PASSWORD) if you mean it.',
  );
  process.exit(1);
}

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const admin = createClient(url, anonKey, { auth: { persistSession: false } });

async function main() {
  // 1. The three logins. "Already registered" means a rerun — keep them.
  for (const email of [ADMIN, COACH, PADDLER]) {
    const { error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error && !/already/i.test(error.message)) throw new Error(`${email}: ${error.message}`);
    console.log(error ? `= ${email} (already exists)` : `+ ${email}`);
  }

  // 2. Sign in as the admin; found the club, or reuse the one they run.
  const signIn = await admin.auth.signInWithPassword({ email: ADMIN, password });
  if (signIn.error) {
    throw new Error(
      `${ADMIN} sign-in failed (${signIn.error.message}) — ` +
        'a rerun with a different SEED_PASSWORD than the first run?',
    );
  }
  const held = await admin.from('club_members').select('club_id').limit(1).maybeSingle();
  if (held.error) throw new Error(held.error.message);
  let clubId = (held.data as { club_id: string } | null)?.club_id;
  if (clubId) {
    console.log(`= club (${clubId})`);
  } else {
    const created = await admin.rpc('create_club', { p_name: CLUB_NAME });
    if (created.error) throw new Error(created.error.message);
    clubId = created.data as string;
    console.log(`+ club "${CLUB_NAME}" (${clubId})`);
  }

  // 3. The demo season, through the app's own import — same snapshot the
  //    "Load demo club" button uses. Replaces whatever the club held.
  const adapter = createSupabaseAdapter({ url, anonKey: serviceKey, clubId });
  await adapter.admin.importSnapshot(buildDemoSnapshot());
  console.log('+ demo season imported (80 members, trainings, races, time trials)');

  // 4. Coach and paddler join the club. An existing membership is kept.
  const invite = async (email: string, role: 'coach' | 'paddler') => {
    const result = await admin.rpc('invite_member', {
      p_club: clubId,
      p_email: email,
      p_role: role,
      p_member_id: null,
    });
    if (result.error && !/duplicate|already/i.test(result.error.message)) {
      throw new Error(`${email}: ${result.error.message}`);
    }
    console.log(result.error ? `= ${email} (already invited)` : `+ ${email} invited as ${role}`);
  };
  await invite(COACH, 'coach');
  await invite(PADDLER, 'paddler');

  // 5. (Re)link the paddler login to Maria Santos. Done after the import on
  //    purpose: replacing the roster severs the link (FK set-null), so a
  //    rerun must restore it.
  const profile = await admin.from('profiles').select('id').eq('email', PADDLER).single();
  if (profile.error) throw new Error(profile.error.message);
  const linked = await admin
    .from('club_members')
    .update({ member_id: PADDLER_MEMBER })
    .eq('club_id', clubId)
    .eq('profile_id', (profile.data as { id: string }).id);
  if (linked.error) throw new Error(linked.error.message);
  console.log(`+ ${PADDLER} linked to roster member ${PADDLER_MEMBER} (Maria Santos)`);

  // 6. Smoke check: the paddler can sign in and sees the filtered roster.
  const paddler = createClient(url, anonKey, { auth: { persistSession: false } });
  const paddlerIn = await paddler.auth.signInWithPassword({ email: PADDLER, password });
  if (paddlerIn.error) throw new Error(paddlerIn.error.message);
  const directory = await paddler
    .from('member_directory')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId);
  if (directory.error) throw new Error(directory.error.message);
  console.log(`✓ paddler sign-in works; sees ${directory.count} roster members`);

  console.log('\nSeeded. Sign in at the app with:');
  for (const [email, role] of [
    [ADMIN, 'admin'],
    [COACH, 'coach'],
    [PADDLER, 'paddler (Maria Santos)'],
  ]) {
    console.log(`  ${email}  —  ${role}`);
  }
  console.log(
    `  password: ${password}\n` +
      '  (password sign-in is for tools; the app itself uses magic links — ' +
      'on the local stack they arrive in Mailpit at http://127.0.0.1:54324)',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
