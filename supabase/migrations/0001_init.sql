-- Dragonboat Manager: initial schema.
--
-- Multi-club from day one: every row carries club_id (denormalized onto child
-- tables too, so row-level-security predicates never join). The v1 app UI is
-- still one-club-per-user; the club_id machinery is what makes real policies
-- possible when auth lands.
--
-- Conventions:
--  * text + CHECK instead of Postgres enums - checks are painless to alter,
--    and the app remains the validation source of truth.
--  * ids are client-generated UUIDs (crypto.randomUUID), so `default` is a
--    fallback, not the normal path.
--  * FK `on delete cascade` is an integrity BACKSTOP. The app deletes
--    children first itself (it needs the deleted rows back for Undo), so
--    these cascades never fire in normal operation.

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  date_of_birth date,
  weight_kg numeric,
  side_preference text not null check (side_preference in ('left', 'right', 'both')),
  can_drum boolean not null default false,
  can_steer boolean not null default false,
  preferred_zones text[],
  status text not null check (status in ('active', 'inactive', 'alumni')),
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_club_idx on members (club_id);

create table events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date,
  location text,
  -- Soft reference into club_settings' eventTypes: resolution in the app
  -- deliberately never throws, so no FK here.
  type text not null,
  training_kind text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_club_idx on events (club_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  boat_size smallint not null check (boat_size in (10, 20)),
  gender_class text not null check (gender_class in ('open', 'mixed', 'women')),
  age_division text check (
    age_division in ('junior', 'u24', 'premier', 'seniorA', 'seniorB', 'seniorC')
  ),
  distance_m integer,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_club_idx on categories (club_id);
create index categories_event_idx on categories (event_id);

create table crews (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  notes text,
  -- A variant of a deleted crew is meaningless, so it goes down with it.
  variant_of uuid references crews (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crews_club_idx on crews (club_id);
create index crews_category_idx on crews (category_id);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  crew_id uuid not null references crews (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  role text not null check (role in ('paddler', 'drummer', 'cox', 'reserve')),
  seat_row smallint,
  seat_side text check (seat_side in ('left', 'right')),
  pinned boolean,
  -- Stricter than the app's loose StoredAssignment shape on purpose: the app
  -- runs validateCrew at the boundary, so real data always passes; the
  -- database is simply the tier that refuses to store a seatless paddler.
  check ((role = 'paddler') = (seat_row is not null and seat_side is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_club_idx on assignments (club_id);
create index assignments_crew_idx on assignments (crew_id);
create index assignments_member_idx on assignments (member_id);

create table race_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  crew_id uuid not null references crews (id) on delete cascade,
  stage text not null check (stage in ('heat', 'semi', 'final')),
  heat smallint,
  lane smallint,
  time_ms integer,
  -- Legacy field: written for snapshot fidelity, read by nothing (placement
  -- is always derived from times).
  placement smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index race_entries_club_idx on race_entries (club_id);
create index race_entries_crew_idx on race_entries (crew_id);

create table availability (
  club_id uuid not null references clubs (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  status text not null check (status in ('in', 'out', 'maybe')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index availability_club_idx on availability (club_id);
create index availability_member_idx on availability (member_id);

create table time_trial_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  date date not null,
  name text,
  distance_m integer not null,
  discipline text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_trial_sessions_club_idx on time_trial_sessions (club_id);

create table time_trial_results (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  session_id uuid not null references time_trial_sessions (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  time_ms integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_trial_results_club_idx on time_trial_results (club_id);
create index time_trial_results_session_idx on time_trial_results (session_id);

-- One settings row per club; the app migrates the blob's shape client-side,
-- exactly as it does for the localStorage snapshot.
create table club_settings (
  club_id uuid primary key references clubs (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at maintenance --------------------------------------------------

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clubs', 'members', 'events', 'categories', 'crews', 'assignments',
    'race_entries', 'availability', 'time_trial_sessions',
    'time_trial_results', 'club_settings'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- Atomic multi-statement writes --------------------------------------------
--
-- Two operations must be transactions: replacing a crew's whole lineup (the
-- undo path - restored rows must keep their ids) and applying a seating plan
-- (a half-applied drop leaves a boat no one planned). Everything else is
-- client-orchestrated, identically to the localStorage adapter.

create function replace_for_crew(p_club_id uuid, p_crew_id uuid, p_rows jsonb)
returns void
language plpgsql as $$
begin
  delete from assignments where crew_id = p_crew_id and club_id = p_club_id;
  insert into assignments (id, club_id, crew_id, member_id, role, seat_row, seat_side, pinned)
  select
    (r ->> 'id')::uuid,
    p_club_id,
    (r ->> 'crewId')::uuid,
    (r ->> 'memberId')::uuid,
    r ->> 'role',
    (r ->> 'seatRow')::smallint,
    r ->> 'seatSide',
    (r ->> 'pinned')::boolean
  from jsonb_array_elements(p_rows) as r;
end;
$$;

create function apply_seating_changes(p_club_id uuid, p_changes jsonb)
returns void
language plpgsql as $$
declare
  c jsonb;
begin
  for c in select * from jsonb_array_elements(p_changes) loop
    if c ->> 'op' = 'create' then
      insert into assignments (id, club_id, crew_id, member_id, role, seat_row, seat_side, pinned)
      values (
        coalesce((c ->> 'id')::uuid, gen_random_uuid()),
        p_club_id,
        (c ->> 'crewId')::uuid,
        (c ->> 'memberId')::uuid,
        c ->> 'role',
        (c ->> 'seatRow')::smallint,
        c ->> 'seatSide',
        (c ->> 'pinned')::boolean
      );
    elsif c ->> 'op' = 'update' then
      update assignments set
        crew_id  = coalesce((c ->> 'crewId')::uuid, crew_id),
        member_id = coalesce((c ->> 'memberId')::uuid, member_id),
        role = coalesce(c ->> 'role', role),
        -- Patches carry explicit nulls to clear a seat; presence of the key
        -- is what distinguishes "clear it" from "leave it".
        seat_row = case when c ? 'seatRow' then (c ->> 'seatRow')::smallint else seat_row end,
        seat_side = case when c ? 'seatSide' then c ->> 'seatSide' else seat_side end,
        pinned = case when c ? 'pinned' then (c ->> 'pinned')::boolean else pinned end
      where id = (c ->> 'id')::uuid and club_id = p_club_id;
      if not found then
        raise exception 'No assignment with id %', c ->> 'id';
      end if;
    else
      delete from assignments where id = (c ->> 'id')::uuid and club_id = p_club_id;
    end if;
  end loop;
end;
$$;

-- Row-level security --------------------------------------------------------
--
-- TEMPORARY: removed in the auth migration. RLS is enabled from day one so
-- forgetting a policy fails closed, but until sign-in exists (Phase C) the
-- anon key is allowed everything. THIS SCHEMA MUST ONLY EVER HOLD LOCAL OR
-- STAGING DATA until that migration replaces these policies.

do $$
declare t text;
begin
  foreach t in array array[
    'clubs', 'members', 'events', 'categories', 'crews', 'assignments',
    'race_entries', 'availability', 'time_trial_sessions',
    'time_trial_results', 'club_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_temporary_open', t
    );
  end loop;
end;
$$;
