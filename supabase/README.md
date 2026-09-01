# Supabase backend

The Postgres schema behind the `supabase` data adapter. Multi-club from day
one (every row carries `club_id`), but the app currently pins itself to one
club — real per-club access control arrives with the auth migration.

> **⚠️ Staging only.** Until the auth migration replaces the temporary open
> row-level-security policies in `migrations/0001_init.sql`, anyone holding
> the anon key can read and write everything. Point the adapter only at a
> local stack or a disposable staging project. Never real club data.

## Local stack (development and contract tests)

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli)
(`scoop install supabase` or `npm i -g supabase`).

```sh
supabase init      # once; keeps this migrations/ directory
supabase start     # boots Postgres + APIs in Docker; prints URL and keys
supabase db reset  # (re)applies every migration to a clean database
```

Run the app against it — create `.env.local`:

```
VITE_DATA_ADAPTER=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```

Run the adapter contract suite against it (same spec the mock passes on every
CI run):

```sh
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_ANON_KEY=<anon key> \
npx vitest run src/data/supabase/contract.test.ts
```

## Cloud project (staging)

Create a project at supabase.com, then:

```sh
supabase link --project-ref <ref>
supabase db push   # applies migrations/
```

Set the same three `VITE_*` variables to the project's URL and anon key.

## Migrations

Hand-authored SQL in `migrations/`, applied in filename order. The snapshot
format the app itself migrates (`src/data/migrate.ts`) is a separate concern:
that one governs JSON backups, this one governs the database.
