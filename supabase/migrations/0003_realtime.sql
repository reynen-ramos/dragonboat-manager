-- Realtime: broadcast row changes on the club's data tables.
--
-- The supabase_realtime publication starts empty; a table not in it emits no
-- postgres_changes events, no matter what the client subscribes to. The app
-- treats an event purely as an invalidation hint - "this collection moved,
-- refetch it" - so the data itself always arrives through PostgREST where
-- row-level security applies in full. Realtime additionally filters events
-- per subscriber against RLS, but nothing here depends on that: a hint about
-- a row you cannot read produces a refetch that cannot see it.
--
-- profiles and club_members stay out: access changes are rare, admin-driven,
-- and the Access screen refetches on its own writes.

alter publication supabase_realtime add table
  members, events, categories, crews, assignments, race_entries,
  availability, time_trial_sessions, time_trial_results, club_settings;
