import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildDemoSnapshot } from '@/domain/demoData';
import { DEFAULT_CLUB_SETTINGS, SNAPSHOT_VERSION } from '@/domain/rules.config';
import type {
  Assignment,
  Availability,
  ClubSettings,
  Profile,
  Snapshot,
  StoredAssignment,
} from '@/domain/types';
import { newId } from '@/utils/ids';
import { migrateSnapshot, UnreadableSnapshotError } from '../migrate';
import type {
  AccessRepo,
  AdminRepo,
  AssignmentRepo,
  AuthGateway,
  AvailabilityRepo,
  DataAdapter,
  Session,
  SettingsRepo,
} from '../repo';
import {
  assignmentMapper,
  availabilityFromRow,
  availabilityToRow,
  categoryMapper,
  crewMapper,
  eventMapper,
  memberMapper,
  raceEntryMapper,
  timeTrialResultMapper,
  timeTrialSessionMapper,
} from './mapping';
import { makeSupabaseRepo, unwrap } from './repo';

/**
 * The Postgres-backed adapter.
 *
 * Feature parity with the mock, no auth yet: sign-in and real row-level
 * security arrive in the auth phase, and until that migration lands this
 * adapter must only ever point at a local or staging project — the schema's
 * temporary policies say so in capital letters.
 *
 * The schema is multi-club; this phase pins the app to one club, fetched or
 * created on first touch. The auth phase replaces `ensureClub` with the
 * signed-in user's membership.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** PostgREST caps request bodies; imports insert in slabs rather than one shot. */
const CHUNK = 500;

const chunked = <T>(rows: T[]): T[][] => {
  const slabs: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) slabs.push(rows.slice(i, i + CHUNK));
  return slabs;
};

export function createSupabaseAdapter(config: SupabaseConfig): DataAdapter {
  const client: SupabaseClient = createClient(config.url, config.anonKey);

  /** The signed-in user's profile row + first club membership, if any. */
  const fetchStanding = async (): Promise<
    { profileId: string; email: string; clubId: string; role: Profile['role']; memberId?: string } | undefined
  > => {
    const { data } = await client.auth.getUser();
    if (!data.user) return undefined;
    const profile = unwrap(
      await client.from('profiles').select('id, email').eq('user_id', data.user.id).maybeSingle(),
    ) as { id: string; email: string } | null;
    if (!profile) return undefined;
    const membership = unwrap(
      await client
        .from('club_members')
        .select('club_id, role, member_id')
        .eq('profile_id', profile.id)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
    ) as { club_id: string; role: Profile['role']; member_id: string | null } | null;
    if (!membership) return undefined;
    return {
      profileId: profile.id,
      email: profile.email,
      clubId: membership.club_id,
      role: membership.role,
      memberId: membership.member_id ?? undefined,
    };
  };

  // The active club, resolved once per identity. A failed resolution is not
  // cached, so a transient network error doesn't wedge the app until reload;
  // sign-in and sign-out drop the cache because they change the answer.
  let clubPromise: Promise<string> | undefined;
  const clubId = (): Promise<string> => {
    clubPromise ??= (async () => {
      const standing = await fetchStanding();
      if (standing) return standing.clubId;

      const { data } = await client.auth.getSession();
      if (data.session) {
        // Signed in but not registered anywhere — the shell shows the
        // create-a-club screen instead of pages, so nothing should get here.
        throw new Error('This login is not registered with a club yet.');
      }
      // No auth session at all: only a key that bypasses row security gets
      // data access without one (the contract suite's service key, or a
      // staging project still on the pre-auth policies). Pin the first club.
      const existing = unwrap(
        await client.from('clubs').select('id').order('created_at').limit(1),
      ) as { id: string }[];
      if (existing.length > 0) return existing[0].id;
      const created = unwrap(
        await client.from('clubs').insert({ name: 'My Club' }).select('id').single(),
      ) as { id: string };
      return created.id;
    })();
    clubPromise.catch(() => {
      clubPromise = undefined;
    });
    return clubPromise;
  };
  client.auth.onAuthStateChange(() => {
    clubPromise = undefined;
  });

  const members = makeSupabaseRepo(client, clubId, memberMapper, {
    readFrom: 'member_directory',
  });
  const events = makeSupabaseRepo(client, clubId, eventMapper);
  const categories = makeSupabaseRepo(client, clubId, categoryMapper);
  const crews = makeSupabaseRepo(client, clubId, crewMapper);
  const raceEntries = makeSupabaseRepo(client, clubId, raceEntryMapper);
  const timeTrialSessions = makeSupabaseRepo(client, clubId, timeTrialSessionMapper);
  const timeTrialResults = makeSupabaseRepo(client, clubId, timeTrialResultMapper);
  const baseAssignments = makeSupabaseRepo(client, clubId, assignmentMapper);

  /** SeatingChange rows in the wire shape the two RPCs read. */
  const seatingRow = (a: Partial<StoredAssignment> & { id?: string }) => {
    const row: Record<string, unknown> = {};
    if (a.id !== undefined) row.id = a.id;
    if (a.crewId !== undefined) row.crewId = a.crewId;
    if (a.memberId !== undefined) row.memberId = a.memberId;
    if (a.role !== undefined) row.role = a.role;
    // Key presence is meaning: `seat` present-but-undefined clears the seat.
    if ('seat' in a) {
      row.seatRow = a.seat?.row ?? null;
      row.seatSide = a.seat?.side ?? null;
    }
    if ('pinned' in a) row.pinned = a.pinned ?? null;
    return row;
  };

  const assignments: AssignmentRepo = {
    ...baseAssignments,

    async replaceForCrew(crewId, rows) {
      const cid = await clubId();
      unwrap(
        await client.rpc('replace_for_crew', {
          p_club_id: cid,
          p_crew_id: crewId,
          p_rows: rows.map((a) => ({
            id: a.id,
            crewId: a.crewId,
            memberId: a.memberId,
            role: a.role,
            seatRow: a.seat?.row ?? null,
            seatSide: a.seat?.side ?? null,
            pinned: a.pinned ?? null,
          })),
        }),
      );
      return rows;
    },

    async applyChanges(changes) {
      if (changes.length === 0) return;
      const cid = await clubId();
      unwrap(
        await client.rpc('apply_seating_changes', {
          p_club_id: cid,
          p_changes: changes.map((change) =>
            change.op === 'create'
              ? { op: 'create', ...seatingRow({ ...change.assignment, id: newId() }) }
              : change.op === 'update'
                ? { op: 'update', id: change.id, ...seatingRow(change.patch) }
                : { op: 'delete', id: change.id },
          ),
        }),
      );
    },
  };

  const availability: AvailabilityRepo = {
    async listAll() {
      const cid = await clubId();
      const rows = unwrap(await client.from('availability').select('*').eq('club_id', cid));
      return (rows as Record<string, unknown>[]).map(availabilityFromRow);
    },

    async listByEvent(eventId) {
      const cid = await clubId();
      const rows = unwrap(
        await client.from('availability').select('*').eq('club_id', cid).eq('event_id', eventId),
      );
      return (rows as Record<string, unknown>[]).map(availabilityFromRow);
    },

    async listByMember(memberId) {
      const cid = await clubId();
      const rows = unwrap(
        await client.from('availability').select('*').eq('club_id', cid).eq('member_id', memberId),
      );
      return (rows as Record<string, unknown>[]).map(availabilityFromRow);
    },

    async set(entry) {
      return (await this.setMany([entry]))[0];
    },

    async setMany(entries) {
      if (entries.length === 0) return [];
      const cid = await clubId();
      for (const slab of chunked(entries.map((e) => availabilityToRow(e, cid)))) {
        unwrap(
          await client.from('availability').upsert(slab, { onConflict: 'event_id,member_id' }),
        );
      }
      return entries;
    },

    async removeByEvent(eventId) {
      const cid = await clubId();
      unwrap(await client.from('availability').delete().eq('club_id', cid).eq('event_id', eventId));
    },

    async removeByMember(memberId) {
      const cid = await clubId();
      unwrap(
        await client.from('availability').delete().eq('club_id', cid).eq('member_id', memberId),
      );
    },
  };

  const settings: SettingsRepo = {
    async get() {
      const cid = await clubId();
      const row = unwrap(
        await client.from('club_settings').select('data').eq('club_id', cid).maybeSingle(),
      ) as { data: ClubSettings } | null;
      return row?.data ?? DEFAULT_CLUB_SETTINGS;
    },

    async save(value) {
      const cid = await clubId();
      unwrap(await client.from('club_settings').upsert({ club_id: cid, data: value }));
      return value;
    },
  };

  const admin: AdminRepo = {
    async exportSnapshot(): Promise<Snapshot> {
      const [
        memberRows,
        eventRows,
        categoryRows,
        crewRows,
        assignmentRows,
        availabilityRows,
        raceEntryRows,
        sessionRows,
        resultRows,
        settingsValue,
      ] = await Promise.all([
        members.list(),
        events.list(),
        categories.list(),
        crews.list(),
        assignments.list(),
        availability.listAll(),
        raceEntries.list(),
        timeTrialSessions.list(),
        timeTrialResults.list(),
        settings.get(),
      ]);
      return {
        version: SNAPSHOT_VERSION,
        exportedAt: new Date().toISOString(),
        members: memberRows,
        events: eventRows,
        categories: categoryRows,
        crews: crewRows,
        assignments: assignmentRows,
        availability: availabilityRows,
        raceEntries: raceEntryRows,
        timeTrialSessions: sessionRows,
        timeTrialResults: resultRows,
        settings: settingsValue,
      };
    },

    async importSnapshot(snapshot) {
      // Same refuse-whole-file policy as the mock: the user picked this file
      // deliberately, so damaged rows reject the import rather than install
      // part of a backup.
      const { snapshot: migrated, dropped } = migrateSnapshot(snapshot);
      if (dropped.length > 0) {
        throw new UnreadableSnapshotError(
          `This backup has damaged rows, so nothing was imported. (${dropped.join('; ')}.)`,
        );
      }

      await this.clearAll();
      const cid = await clubId();

      // Parents before children, so no insert ever references a missing row.
      const insert = async (table: string, rows: Record<string, unknown>[]) => {
        for (const slab of chunked(rows)) unwrap(await client.from(table).insert(slab));
      };
      await insert('members', migrated.members.map((m) => memberMapper.toRow(m, cid)));
      await insert('events', migrated.events.map((e) => eventMapper.toRow(e, cid)));
      await insert('categories', migrated.categories.map((c) => categoryMapper.toRow(c, cid)));
      // Variants reference their primary crew, so primaries insert first.
      const primaries = migrated.crews.filter((c) => !c.variantOf);
      const variants = migrated.crews.filter((c) => c.variantOf);
      await insert('crews', primaries.map((c) => crewMapper.toRow(c, cid)));
      await insert('crews', variants.map((c) => crewMapper.toRow(c, cid)));
      await insert(
        'assignments',
        migrated.assignments.map((a) => assignmentMapper.toRow(a as Assignment, cid)),
      );
      await insert(
        'availability',
        migrated.availability.map((a: Availability) => availabilityToRow(a, cid)),
      );
      await insert(
        'race_entries',
        migrated.raceEntries.map((r) => raceEntryMapper.toRow(r, cid)),
      );
      await insert(
        'time_trial_sessions',
        migrated.timeTrialSessions.map((s) => timeTrialSessionMapper.toRow(s, cid)),
      );
      await insert(
        'time_trial_results',
        migrated.timeTrialResults.map((r) => timeTrialResultMapper.toRow(r, cid)),
      );
      await settings.save(migrated.settings);
    },

    async loadDemoClub() {
      await this.importSnapshot(buildDemoSnapshot());
    },

    async clearAll() {
      const cid = await clubId();
      // Children first, so the FK backstops never have to fire.
      for (const table of [
        'assignments',
        'race_entries',
        'time_trial_results',
        'availability',
        'crews',
        'categories',
        'time_trial_sessions',
        'events',
        'members',
        'club_settings',
      ]) {
        unwrap(await client.from(table).delete().eq('club_id', cid));
      }
    },
  };

  const sessionFor = async (): Promise<Session | null> => {
    const { data } = await client.auth.getSession();
    if (!data.session) return null;
    const email = data.session.user.email ?? '';
    const standing = await fetchStanding();
    if (!standing) return { email, profile: null };
    return {
      email,
      profile: {
        id: standing.profileId,
        email: standing.email,
        role: standing.role,
        memberId: standing.memberId,
      },
    };
  };

  // createClub changes the session's meaning without any auth event firing,
  // so the gateway keeps its own listener set and re-emits after it.
  const sessionListeners = new Set<(session: Session | null) => void>();
  const emitSession = async () => {
    const session = await sessionFor();
    for (const listener of sessionListeners) listener(session);
  };

  const auth: AuthGateway = {
    getSession: sessionFor,

    async signInWithOAuth(provider) {
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
    },

    async signInWithMagicLink(email) {
      unwrap(
        await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        }),
      );
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async createClub(name) {
      unwrap(await client.rpc('create_club', { p_name: name }));
      clubPromise = undefined;
      await emitSession();
    },

    onSessionChange(callback) {
      sessionListeners.add(callback);
      const { data } = client.auth.onAuthStateChange(() => {
        // Fetch fresh standing outside the auth callback (supabase-js warns
        // against awaiting its own calls inside one).
        setTimeout(() => void emitSession(), 0);
      });
      return () => {
        sessionListeners.delete(callback);
        data.subscription.unsubscribe();
      };
    },

    availableProviders: ['google'],
    magicLinkEnabled: true,
  };

  const access: AccessRepo = {
    async list() {
      const cid = await clubId();
      const rows = unwrap(
        await client
          .from('club_members')
          .select('profile_id, role, member_id, profiles ( email, user_id )')
          .eq('club_id', cid)
          .order('created_at'),
      ) as unknown as {
        profile_id: string;
        role: Profile['role'];
        member_id: string | null;
        profiles: { email: string; user_id: string | null } | null;
      }[];
      return rows.map((row) => ({
        profileId: row.profile_id,
        email: row.profiles?.email ?? '(unknown)',
        role: row.role,
        memberId: row.member_id ?? undefined,
        active: row.profiles?.user_id != null,
      }));
    },

    async invite(email, role, memberId) {
      const cid = await clubId();
      unwrap(
        await client.rpc('invite_member', {
          p_club: cid,
          p_email: email.trim().toLowerCase(),
          p_role: role,
          p_member_id: memberId ?? null,
        }),
      );
    },

    async setRole(profileId, role) {
      const cid = await clubId();
      unwrap(
        await client
          .from('club_members')
          .update({ role })
          .eq('club_id', cid)
          .eq('profile_id', profileId),
      );
    },

    async linkMember(profileId, memberId) {
      const cid = await clubId();
      unwrap(
        await client
          .from('club_members')
          .update({ member_id: memberId ?? null })
          .eq('club_id', cid)
          .eq('profile_id', profileId),
      );
    },

    async revoke(profileId) {
      const cid = await clubId();
      unwrap(
        await client.from('club_members').delete().eq('club_id', cid).eq('profile_id', profileId),
      );
    },
  };

  return {
    name: 'supabase',
    // Realtime lands in a later phase; until then other devices refetch on
    // focus (staleTime-bounded), and nothing subscribes.
    subscribeToExternalChanges: () => () => {},
    takeReadWarnings: () => [],
    members,
    events,
    categories,
    crews,
    assignments,
    raceEntries,
    timeTrialSessions,
    timeTrialResults,
    availability,
    settings,
    admin,
    auth,
    access,
  };
}
