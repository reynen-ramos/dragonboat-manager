-- Dragonboat Manager: initial schema.
--
-- Multi-club from day one: every row carries club_id, and every primary key
-- is COMPOSITE - (club_id, id) - because row ids are only unique within a
-- club. Ids are opaque text the app controls: new rows get client-generated
-- UUIDs, but demo data and imported backups carry readable ids like
-- 'demo-member-1' that must restore verbatim, and two clubs loading the same
-- backup must both succeed. Foreign keys are composite for the same reason.
--
-- Conventions:
--  * text + CHECK instead of Postgres enums - checks are painless to alter,
--    and the app remains the validation source of truth.
--  * FK `on delete cascade` is an integrity BACKSTOP. The app deletes
--    children first itself (it needs the deleted rows back for Undo), so
--    these cascades never fire in normal operation.

create table clubs (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
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
  updated_at timestamptz not null default now(),
  primary key (club_id, id)
);

create table events (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
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
  updated_at timestamptz not null default now(),
  primary key (club_id, id)
);

create table categories (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  event_id text not null,
  boat_size smallint not null check (boat_size in (10, 20)),
  gender_class text not null check (gender_class in ('open', 'mixed', 'women')),
  age_division text check (
    age_division in ('junior', 'u24', 'premier', 'seniorA', 'seniorB', 'seniorC')
  ),
  distance_m integer,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, event_id) references events (club_id, id) on delete cascade
);
create index categories_event_idx on categories (club_id, event_id);

create table crews (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  category_id text not null,
  name text not null,
  notes text,
  -- A variant of a deleted crew is meaningless, so it goes down with it.
  variant_of text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, category_id) references categories (club_id, id) on delete cascade,
  foreign key (club_id, variant_of) references crews (club_id, id) on delete cascade
);
create index crews_category_idx on crews (club_id, category_id);

create table assignments (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  crew_id text not null,
  member_id text not null,
  role text not null check (role in ('paddler', 'drummer', 'cox', 'reserve')),
  seat_row smallint,
  seat_side text check (seat_side in ('left', 'right')),
  pinned boolean,
  -- Stricter than the app's loose StoredAssignment shape on purpose: the app
  -- runs validateCrew at the boundary, so real data always passes; the
  -- database is simply the tier that refuses to store a seatless paddler.
  check ((role = 'paddler') = (seat_row is not null and seat_side is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, crew_id) references crews (club_id, id) on delete cascade,
  foreign key (club_id, member_id) references members (club_id, id) on delete cascade
);
create index assignments_crew_idx on assignments (club_id, crew_id);
create index assignments_member_idx on assignments (club_id, member_id);

create table race_entries (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  crew_id text not null,
  stage text not null check (stage in ('heat', 'semi', 'final')),
  heat smallint,
  lane smallint,
  time_ms integer,
  -- Legacy field: written for snapshot fidelity, read by nothing (placement
  -- is always derived from times).
  placement smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, crew_id) references crews (club_id, id) on delete cascade
);
create index race_entries_crew_idx on race_entries (club_id, crew_id);

create table availability (
  club_id text not null references clubs (id) on delete cascade,
  event_id text not null,
  member_id text not null,
  status text not null check (status in ('in', 'out', 'maybe')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (club_id, event_id, member_id),
  foreign key (club_id, event_id) references events (club_id, id) on delete cascade,
  foreign key (club_id, member_id) references members (club_id, id) on delete cascade
);
create index availability_member_idx on availability (club_id, member_id);

create table time_trial_sessions (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  date date not null,
  name text,
  distance_m integer not null,
  discipline text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id)
);

create table time_trial_results (
  club_id text not null references clubs (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  session_id text not null,
  member_id text not null,
  time_ms integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, session_id) references time_trial_sessions (club_id, id) on delete cascade,
  foreign key (club_id, member_id) references members (club_id, id) on delete cascade
);
create index time_trial_results_session_idx on time_trial_results (club_id, session_id);

-- One settings row per club; the app migrates the blob's shape client-side,
-- exactly as it does for the localStorage snapshot.
create table club_settings (
  club_id text primary key references clubs (id) on delete cascade,
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

-- Every table except availability: its updated_at is data the app writes at
-- answer time, not storage bookkeeping — a trigger would clobber it on upsert.
do $$
declare t text;
begin
  foreach t in array array[
    'clubs', 'members', 'events', 'categories', 'crews', 'assignments',
    'race_entries', 'time_trial_sessions',
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

create function replace_for_crew(p_club_id text, p_crew_id text, p_rows jsonb)
returns void
language plpgsql as $$
begin
  delete from assignments where crew_id = p_crew_id and club_id = p_club_id;
  insert into assignments (id, club_id, crew_id, member_id, role, seat_row, seat_side, pinned)
  select
    r ->> 'id',
    p_club_id,
    r ->> 'crewId',
    r ->> 'memberId',
    r ->> 'role',
    (r ->> 'seatRow')::smallint,
    r ->> 'seatSide',
    (r ->> 'pinned')::boolean
  from jsonb_array_elements(p_rows) as r;
end;
$$;

create function apply_seating_changes(p_club_id text, p_changes jsonb)
returns void
language plpgsql as $$
declare
  c jsonb;
begin
  for c in select * from jsonb_array_elements(p_changes) loop
    if c ->> 'op' = 'create' then
      insert into assignments (id, club_id, crew_id, member_id, role, seat_row, seat_side, pinned)
      values (
        coalesce(c ->> 'id', gen_random_uuid()::text),
        p_club_id,
        c ->> 'crewId',
        c ->> 'memberId',
        c ->> 'role',
        (c ->> 'seatRow')::smallint,
        c ->> 'seatSide',
        (c ->> 'pinned')::boolean
      );
    elsif c ->> 'op' = 'update' then
      update assignments set
        crew_id  = coalesce(c ->> 'crewId', crew_id),
        member_id = coalesce(c ->> 'memberId', member_id),
        role = coalesce(c ->> 'role', role),
        -- Patches carry explicit nulls to clear a seat; presence of the key
        -- is what distinguishes "clear it" from "leave it".
        seat_row = case when c ? 'seatRow' then (c ->> 'seatRow')::smallint else seat_row end,
        seat_side = case when c ? 'seatSide' then c ->> 'seatSide' else seat_side end,
        pinned = case when c ? 'pinned' then (c ->> 'pinned')::boolean else pinned end
      where id = c ->> 'id' and club_id = p_club_id;
      if not found then
        raise exception 'No assignment with id %', c ->> 'id';
      end if;
    else
      delete from assignments where id = c ->> 'id' and club_id = p_club_id;
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
