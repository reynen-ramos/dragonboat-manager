-- Fix a composite-FK footgun: `on delete set null` on a multi-column foreign
-- key nulls EVERY referencing column - including club_id, which is not-null
-- and part of club_members' primary key. Deleting any roster member linked
-- to a login therefore blew up the delete (and every snapshot import, which
-- clears members first). The referential action needs a column list so only
-- the member link is severed, never the membership itself.

alter table club_members
  drop constraint club_members_club_id_member_id_fkey;

alter table club_members
  add foreign key (club_id, member_id) references members (club_id, id)
    on delete set null (member_id);
