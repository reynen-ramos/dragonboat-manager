-- Close a linking gap: the signup trigger connects an auth user to a
-- pre-provisioned profile, but only fires when the auth user is CREATED.
-- Someone who signed in BEFORE being invited never triggers it again, and
-- stayed unlinked forever - permanently stuck on the "Almost there" screen.
-- Inviting now links immediately when the auth user already exists, making
-- invite-then-sign-in and sign-in-then-invite equally valid orders.

create or replace function invite_member(p_club text, p_email text, p_role text, p_member_id text)
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
  -- The invitee may have signed in already; connect their login now rather
  -- than waiting for a signup trigger that will never fire again.
  update profiles set user_id = u.id
  from auth.users u
  where profiles.id = v_profile
    and profiles.user_id is null
    and lower(u.email) = lower(p_email);
  insert into club_members (club_id, profile_id, role, member_id)
  values (p_club, v_profile, p_role, p_member_id);
end;
$$;
