# Supabase backend

The Postgres schema behind the `supabase` data adapter. Multi-club (every row
carries `club_id`), with sign-in and per-club roles: identities live in
`profiles`, a person's role in a club lives in `club_members`, and row-level
security enforces the matrix — staff write, members read, paddlers additionally
write only their own availability row and see clubmates through the
`member_directory` view (contact details, weight, birth dates, and notes
hidden). The anon key alone can read nothing.

## How access works

- **Founding**: a signed-in user with no club creates one in the app
  (`create_club` — they become its admin).
- **Inviting**: an admin registers an email + role (+ linked roster member) in
  Settings → Access. No email is sent; the invitee just signs in with that
  address (magic link or Google) and a database trigger connects their login
  on arrival.
- **Paddler privacy**: paddlers read the roster through `member_directory`,
  which nulls private columns on every row but their own.

## Local stack (development and tests)

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli)
(`scoop install supabase` or `npm i -g supabase`).

```sh
supabase start     # boots Postgres + auth + APIs in Docker; prints URL and keys
supabase db reset  # (re)applies every migration to a clean database
```

Run the app against it — create `.env.local`:

```
VITE_DATA_ADAPTER=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```

Local magic-link emails land in Mailpit (`http://127.0.0.1:54324`), not a real
inbox.

### Test suites (both gated; skipped when the variables are unset)

```sh
# Storage semantics — the same contract the mock passes on every CI run.
# Service key: this suite tests CRUD, not access control.
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_KEY=<service_role key> \
npx vitest run src/data/supabase/contract.test.ts

# The policy matrix, with real signed-in admin/paddler/anon users.
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_KEY=<service_role key> \
SUPABASE_TEST_ANON_KEY=<anon key> \
npx vitest run src/data/supabase/rls.test.ts
```

Both wipe or write data freely — never point them at a database you love.

## Cloud project

Create a project at supabase.com, then:

```sh
supabase link --project-ref <ref>
supabase db push   # applies migrations/
```

Then in the project's Auth settings:
- add the app's URL (and `http://localhost:5173` for development) to the
  redirect allowlist and set the Site URL;
- enable the Google provider if the club wants "Continue with Google"
  (magic links work with no extra setup).

Note: a magic link opened on a phone lands in the browser, not an installed
PWA — installed-app users have a smoother time with Google sign-in.

## Realtime

Open devices stay in sync live: the adapter holds one channel over the
schema, and each row change invalidates just the collection that moved (with
a short debounce, so a 20-seat fill refetches once, not twenty times). The
channel rejoins on every auth transition — a realtime subscription's
row-security filter is fixed at join time — and heals itself with backoff if
the server drops it. Sync is sub-second in steady state; right after a
whole-snapshot import (thousands of rows) the event stream can lag for a
minute or two while the server works through the backlog — a once-per-club
cost, and focus-refetch covers the gap.

## Migrations

Hand-authored SQL in `migrations/`, applied in filename order. The snapshot
format the app itself migrates (`src/data/migrate.ts`) is a separate concern:
that one governs JSON backups, this one governs the database.
