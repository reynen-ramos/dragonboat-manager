-- Auth: identities, per-club roles, and the real security policies.
--
-- Identity is two-layered: `profiles` is a person (linked to auth.users on
-- their first sign-in, by email), `club_members` is that person's role in one
-- club. Roles live on the membership, not the profile - that is what makes
-- the schema genuinely multi-club.
--
-- The invite flow needs no service key anywhere: an admin pre-creates the
-- profile + membership rows by email from the app, and the trigger below
-- links the auth user to them whenever that email first signs in.

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique check (email = lower(email)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create table club_members (
  club_id text not null references clubs (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role text not null default 'paddler' check (role in ('admin', 'coach', 'paddler')),
  member_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, profile_id),
  unique (club_id, member_id),
  foreign key (club_id, member_id) references members (club_id, id) on delete set null
);
create trigger club_members_updated_at before update on club_members
  for each row execute function set_updated_at();

-- First sign-in: attach the auth user to the pre-provisioned profile.
create function link_profile_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set user_id = new.id
  where user_id is null and email = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function link_profile_on_signup();

-- Policy helpers ------------------------------------------------------------
--
-- security definer so they can read profiles/club_members regardless of the
-- policies on those tables; stable so the planner caches them per statement.

create function current_profile_id() returns uuid
language sql security definer stable set search_path = public as $$
  select id from profiles where user_id = auth.uid();
$$;

create function club_role(p_club text) returns text
language sql security definer stable set search_path = public as $$
  select role from club_members
  where club_id = p_club and profile_id = current_profile_id();
$$;

create function is_club_member(p_club text) returns boolean
language sql security definer stable set search_path = public as $$
  select club_role(p_club) is not null;
$$;

create function is_staff(p_club text) returns boolean
language sql security definer stable set search_path = public as $$
  select club_role(p_club) in ('admin', 'coach');
$$;

create function current_member_id(p_club text) returns text
language sql security definer stable set search_path = public as $$
  select member_id from club_members
  where club_id = p_club and profile_id = current_profile_id();
$$;

-- Onboarding and access management ------------------------------------------

-- A signed-in user founds a club and becomes its admin. Creates their
-- profile row too if they signed in without an invitation.
create function create_club(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_club text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  v_profile := current_profile_id();
  if v_profile is null then
    insert into profiles (user_id, email)
    values (auth.uid(), lower((select email from auth.users where id = auth.uid())))
    returning id into v_profile;
  end if;
  insert into clubs (name) values (p_name) returning id into v_club;
  insert into club_members (club_id, profile_id, role) values (v_club, v_profile, 'admin');
  return v_club;
end;
$$;

-- Admin invites an email: profile row (created if new) + membership. The
-- invited person just signs in with that email - no email is sent from here.
create function invite_member(p_club text, p_email text, p_role text, p_member_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
begin
  if club_role(p_club) <> 'admin' then
    raise exception 'Only a club admin can invite members.';
  end if;
  insert into profiles (email) values (lower(p_email))
  on conflict (email) do nothing;
  select id into v_profile from profiles where email = lower(p_email);
  insert into club_members (club_id, profile_id, role, member_id)
  values (p_club, v_profile, p_role, p_member_id);
end;
$$;

-- A paddler's one write to the members table: their own contact details.
-- An RPC because row-level security cannot do column-level grants cleanly.
create function update_my_contact(
  p_club text, p_email text, p_phone text,
  p_emergency_name text, p_emergency_phone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update members set
    email = p_email,
    phone = p_phone,
    emergency_contact_name = p_emergency_name,
    emergency_contact_phone = p_emergency_phone
  where id = current_member_id(p_club) and club_id = p_club;
  if not found then
    raise exception 'No roster member is linked to your login.';
  end if;
end;
$$;

-- Whether the caller may see a member's personal details: staff of the club,
-- the member themself, or the service key (which bypasses RLS everywhere
-- else and must not be blinded by a view's WHERE clause).
create function sees_private(p_club text, p_member text) returns boolean
language sql security definer stable set search_path = public as $$
  select auth.role() = 'service_role'
      or is_staff(p_club)
      or p_member = current_member_id(p_club);
$$;

-- The roster as paddlers may see it: names and paddling facts for everyone,
-- personal details only on your own row or for staff. A security-definer
-- view (the default), so it can read `members` past its staff-only policy -
-- the WHERE and CASEs are the actual gate.
create view member_directory as
select
  id, club_id, first_name, last_name, gender, side_preference,
  can_drum, can_steer, preferred_zones, status, joined_at,
  case when sees_private(club_id, id) then date_of_birth end as date_of_birth,
  case when sees_private(club_id, id) then weight_kg end as weight_kg,
  case when sees_private(club_id, id) then email end as email,
  case when sees_private(club_id, id) then phone end as phone,
  case when sees_private(club_id, id) then emergency_contact_name end as emergency_contact_name,
  case when sees_private(club_id, id) then emergency_contact_phone end as emergency_contact_phone,
  case when is_staff(club_id) or auth.role() = 'service_role' then notes end as notes,
  created_at, updated_at
from members
where is_club_member(club_id) or auth.role() = 'service_role';

-- The real policies ---------------------------------------------------------

-- The Phase B stopgap goes away entirely.
do $$
declare t text;
begin
  foreach t in array array[
    'clubs', 'members', 'events', 'categories', 'crews', 'assignments',
    'race_entries', 'availability', 'time_trial_sessions',
    'time_trial_results', 'club_settings'
  ] loop
    execute format('drop policy %I on %I', t || '_temporary_open', t);
  end loop;
end;
$$;

alter table profiles enable row level security;
alter table club_members enable row level security;

-- clubs: visible to members; renamed by admins; created only via create_club.
create policy clubs_select on clubs for select to authenticated
  using (is_club_member(id));
create policy clubs_update on clubs for update to authenticated
  using (club_role(id) = 'admin');

-- members: staff manage the roster directly; paddlers read member_directory.
create policy members_staff on members for all to authenticated
  using (is_staff(club_id)) with check (is_staff(club_id));

-- Club data: staff write, every member reads.
do $$
declare t text;
begin
  foreach t in array array[
    'events', 'categories', 'crews', 'assignments', 'race_entries',
    'time_trial_sessions', 'time_trial_results'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (is_club_member(club_id))',
      t || '_member_read', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_staff(club_id)) with check (is_staff(club_id))',
      t || '_staff_write', t);
  end loop;
end;
$$;

-- availability: everyone reads the sheet; paddlers write their own row only.
create policy availability_member_read on availability for select to authenticated
  using (is_club_member(club_id));
create policy availability_staff_write on availability for all to authenticated
  using (is_staff(club_id)) with check (is_staff(club_id));
create policy availability_own_write on availability for insert to authenticated
  with check (is_club_member(club_id) and member_id = current_member_id(club_id));
create policy availability_own_update on availability for update to authenticated
  using (is_club_member(club_id) and member_id = current_member_id(club_id))
  with check (is_club_member(club_id) and member_id = current_member_id(club_id));
create policy availability_own_delete on availability for delete to authenticated
  using (is_club_member(club_id) and member_id = current_member_id(club_id));

-- club_settings: every member reads the rules; only admins change them.
create policy club_settings_read on club_settings for select to authenticated
  using (is_club_member(club_id));
create policy club_settings_admin on club_settings for all to authenticated
  using (club_role(club_id) = 'admin') with check (club_role(club_id) = 'admin');

-- profiles: your own row, plus the profiles of clubmates if you are staff.
-- Creation happens inside create_club/invite_member (definer), never direct.
create policy profiles_own on profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_staff on profiles for select to authenticated
  using (exists (
    select 1 from club_members theirs
    where theirs.profile_id = profiles.id and is_staff(theirs.club_id)
  ));

-- club_members: see your own membership; staff see the club's; admins manage.
create policy club_members_own on club_members for select to authenticated
  using (profile_id = current_profile_id());
create policy club_members_staff_read on club_members for select to authenticated
  using (is_staff(club_id));
create policy club_members_admin_write on club_members for all to authenticated
  using (club_role(club_id) = 'admin') with check (club_role(club_id) = 'admin');
