import { useEffect } from 'react';
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adapter, subscribeToExternalChanges, takeReadWarnings } from '@/data';

// Re-exported so the UI can distinguish a refusal worth reading (a backup
// from a newer version, damaged rows) without importing from @/data itself.
export { UnreadableSnapshotError } from '@/data';
import { useNotifications } from '@/stores/notifications';
import {
  createCrewVariant,
  deleteCategoryCascade,
  deleteCrewCascade,
  deleteEventCascade,
  deleteMemberCascade,
  duplicateCrew,
  restoreDeleted,
  swapCrewLineups,
  type DeletedBundle,
} from '@/data/operations';
import { DEFAULT_CLUB_SETTINGS } from '@/domain/rules.config';
import type { SeatingChange } from '@/domain/seating';
import type {
  Assignment,
  AssignmentInput,
  AssignmentPatch,
  Availability,
  Category,
  ClubEvent,
  ClubSettings,
  Crew,
  Member,
  RaceEntry,
  Snapshot,
} from '@/domain/types';
import { keys } from './keys';

/**
 * The data API every screen uses.
 *
 * Components import from here and never from `@/data` directly, so the storage
 * engine stays swappable and caching lives in exactly one layer.
 */

// --- Reads -------------------------------------------------------------------

export const useMembers = () =>
  useQuery({ queryKey: keys.members.all, queryFn: () => adapter.members.list() });

export const useMember = (id: string | undefined) =>
  useQuery({
    queryKey: keys.members.detail(id ?? ''),
    queryFn: () => adapter.members.get(id!),
    enabled: Boolean(id),
  });

export const useEvents = () =>
  useQuery({ queryKey: keys.events.all, queryFn: () => adapter.events.list() });

export const useEvent = (id: string | undefined) =>
  useQuery({
    queryKey: keys.events.detail(id ?? ''),
    queryFn: () => adapter.events.get(id!),
    enabled: Boolean(id),
  });

export const useCategories = (eventId: string | undefined) =>
  useQuery({
    queryKey: keys.categories.byEvent(eventId ?? ''),
    queryFn: () => adapter.categories.list({ eventId }),
    enabled: Boolean(eventId),
  });

export const useAllCategories = () =>
  useQuery({ queryKey: keys.categories.all, queryFn: () => adapter.categories.list() });

export const useCategory = (id: string | undefined) =>
  useQuery({
    queryKey: keys.categories.detail(id ?? ''),
    queryFn: () => adapter.categories.get(id!),
    enabled: Boolean(id),
  });

export const useCrews = (categoryId: string | undefined) =>
  useQuery({
    queryKey: keys.crews.byCategory(categoryId ?? ''),
    queryFn: () => adapter.crews.list({ categoryId }),
    enabled: Boolean(categoryId),
  });

export const useAllCrews = () =>
  useQuery({ queryKey: keys.crews.all, queryFn: () => adapter.crews.list() });

export const useCrew = (id: string | undefined) =>
  useQuery({
    queryKey: keys.crews.detail(id ?? ''),
    queryFn: () => adapter.crews.get(id!),
    enabled: Boolean(id),
  });

export const useAssignments = (crewId: string | undefined) =>
  useQuery({
    queryKey: keys.assignments.byCrew(crewId ?? ''),
    queryFn: () => adapter.assignments.list({ crewId }),
    enabled: Boolean(crewId),
  });

export const useAllAssignments = () =>
  useQuery({ queryKey: keys.assignments.all, queryFn: () => adapter.assignments.list() });

export const useMemberAssignments = (memberId: string | undefined) =>
  useQuery({
    queryKey: keys.assignments.byMember(memberId ?? ''),
    queryFn: () => adapter.assignments.list({ memberId }),
    enabled: Boolean(memberId),
  });

export const useAvailability = (eventId: string | undefined) =>
  useQuery({
    queryKey: keys.availability.byEvent(eventId ?? ''),
    queryFn: () => adapter.availability.listByEvent(eventId!),
    enabled: Boolean(eventId),
  });

export const useMemberAvailability = (memberId: string | undefined) =>
  useQuery({
    queryKey: keys.availability.byMember(memberId ?? ''),
    queryFn: () => adapter.availability.listByMember(memberId!),
    enabled: Boolean(memberId),
  });

export const useRaceEntries = (crewId: string | undefined) =>
  useQuery({
    queryKey: keys.raceEntries.byCrew(crewId ?? ''),
    queryFn: () => adapter.raceEntries.list({ crewId }),
    enabled: Boolean(crewId),
  });

export const useAllRaceEntries = () =>
  useQuery({ queryKey: keys.raceEntries.all, queryFn: () => adapter.raceEntries.list() });

/**
 * The settings query itself, for screens that must not act before it resolves.
 *
 * `useSettings` substitutes the defaults while loading, which is right for a
 * balance bar and wrong for the settings form — editing a field against the
 * defaults would save them over whatever the club had stored.
 */
export const useSettingsQuery = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => adapter.settings.get() });

export function useSettings(): ClubSettings {
  const stored = useSettingsQuery().data;
  // Per-key merge, not `??`: a settings object saved by an older build (or
  // restored from an old backup) predates newer keys like `eventTypes`, and
  // those must fall back to the defaults individually.
  return stored ? { ...DEFAULT_CLUB_SETTINGS, ...stored } : DEFAULT_CLUB_SETTINGS;
}

// --- Writes ------------------------------------------------------------------

/**
 * Wraps `useMutation` so every write invalidates the keys it affects.
 *
 * Invalidating a little too broadly is the right default here: the data is
 * small, refetches are instant against local storage, and a stale seat map is
 * far more damaging than a redundant read.
 */
function useInvalidatingMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  invalidate: readonly (readonly unknown[])[],
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Returned, not fired-and-forgotten: React Query holds `mutateAsync`
    // unresolved until this settles, so a caller that awaits a write reads the
    // refetched cache, not the pre-write one. Undo snapshots depend on that —
    // without it, two rapid edits both capture the same stale lineup.
    onSuccess: () =>
      Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))),
  });
}

export const useCreateMember = () =>
  useInvalidatingMutation((input: Omit<Member, 'id'>) => adapter.members.create(input), [
    keys.members.all,
  ]);

export const useUpdateMember = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<Omit<Member, 'id'>> }) =>
      adapter.members.update(id, patch),
    [keys.members.all],
  );

export const useDeleteMember = () =>
  useInvalidatingMutation((id: string) => deleteMemberCascade(adapter, id), [
    keys.members.all,
    keys.assignments.all,
    keys.availability.all,
  ]);

export const useImportMembers = () =>
  useInvalidatingMutation(
    async (members: Omit<Member, 'id'>[]) => {
      const created: Member[] = [];
      for (const member of members) created.push(await adapter.members.create(member));
      return created;
    },
    [keys.members.all],
  );

export const useCreateEvent = () =>
  useInvalidatingMutation((input: Omit<ClubEvent, 'id'>) => adapter.events.create(input), [
    keys.events.all,
  ]);

export const useUpdateEvent = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<Omit<ClubEvent, 'id'>> }) =>
      adapter.events.update(id, patch),
    [keys.events.all],
  );

export const useDeleteEvent = () =>
  useInvalidatingMutation((id: string) => deleteEventCascade(adapter, id), [
    keys.events.all,
    keys.categories.all,
    keys.crews.all,
    keys.assignments.all,
    keys.availability.all,
    keys.raceEntries.all,
  ]);

export const useCreateCategory = () =>
  useInvalidatingMutation((input: Omit<Category, 'id'>) => adapter.categories.create(input), [
    keys.categories.all,
  ]);

export const useUpdateCategory = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<Omit<Category, 'id'>> }) =>
      adapter.categories.update(id, patch),
    [keys.categories.all],
  );

export const useDeleteCategory = () =>
  useInvalidatingMutation((id: string) => deleteCategoryCascade(adapter, id), [
    keys.categories.all,
    keys.crews.all,
    keys.assignments.all,
    keys.raceEntries.all,
  ]);

export const useCreateCrew = () =>
  useInvalidatingMutation((input: Omit<Crew, 'id'>) => adapter.crews.create(input), [
    keys.crews.all,
  ]);

export const useUpdateCrew = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<Omit<Crew, 'id'>> }) =>
      adapter.crews.update(id, patch),
    [keys.crews.all],
  );

export const useCreateCrewVariant = () =>
  useInvalidatingMutation((crewId: string) => createCrewVariant(adapter, crewId), [
    keys.crews.all,
    keys.assignments.all,
  ]);

export const useSwapCrewLineups = () =>
  useInvalidatingMutation(
    ({ crewIdA, crewIdB }: { crewIdA: string; crewIdB: string }) =>
      swapCrewLineups(adapter, crewIdA, crewIdB),
    [keys.assignments.all],
  );

export const useDeleteCrew = () =>
  useInvalidatingMutation((id: string) => deleteCrewCascade(adapter, id), [
    keys.crews.all,
    keys.assignments.all,
    keys.raceEntries.all,
  ]);

export const useDuplicateCrew = () =>
  useInvalidatingMutation(
    ({ crewId, newName }: { crewId: string; newName: string }) =>
      duplicateCrew(adapter, crewId, newName),
    [keys.crews.all, keys.assignments.all],
  );

export const useCreateAssignment = () =>
  useInvalidatingMutation((input: AssignmentInput) => adapter.assignments.create(input), [
    keys.assignments.all,
  ]);

export const useUpdateAssignment = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: AssignmentPatch }) =>
      adapter.assignments.update(id, patch),
    [keys.assignments.all],
  );

export const useDeleteAssignment = () =>
  useInvalidatingMutation((id: string) => adapter.assignments.remove(id), [keys.assignments.all]);

/** Re-seating moves several paddlers at once and must land as one write. */
export const useBulkUpdateAssignments = () =>
  useInvalidatingMutation(
    (patches: { id: string; patch: AssignmentPatch }[]) =>
      adapter.assignments.bulkUpdate(patches),
    [keys.assignments.all],
  );

/** Applies a set of seating changes as one write, then one refetch. */
export const useApplySeatingChanges = () =>
  useInvalidatingMutation(async (changes: SeatingChange[]) => {
    for (const change of changes) {
      if (change.op === 'create') await adapter.assignments.create(change.assignment);
      else if (change.op === 'update')
        await adapter.assignments.update(change.id, change.patch);
      else await adapter.assignments.remove(change.id);
    }
  }, [keys.assignments.all]);

/** Restores a crew's lineup verbatim — how undo and redo are applied. */
export const useReplaceCrewLineup = () =>
  useInvalidatingMutation(
    ({ crewId, assignments }: { crewId: string; assignments: Assignment[] }) =>
      adapter.assignments.replaceForCrew(crewId, assignments),
    [keys.assignments.all],
  );

export const useSetAvailability = () =>
  useInvalidatingMutation((entries: Availability[]) => adapter.availability.setMany(entries), [
    keys.availability.all,
  ]);

export const useCreateRaceEntry = () =>
  useInvalidatingMutation((input: Omit<RaceEntry, 'id'>) => adapter.raceEntries.create(input), [
    keys.raceEntries.all,
  ]);

export const useUpdateRaceEntry = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<Omit<RaceEntry, 'id'>> }) =>
      adapter.raceEntries.update(id, patch),
    [keys.raceEntries.all],
  );

export const useDeleteRaceEntry = () =>
  useInvalidatingMutation((id: string) => adapter.raceEntries.remove(id), [keys.raceEntries.all]);

export const useSaveSettings = () =>
  useInvalidatingMutation((settings: ClubSettings) => adapter.settings.save(settings), [
    keys.settings,
  ]);

const ALL_KEYS = [
  keys.members.all,
  keys.events.all,
  keys.categories.all,
  keys.crews.all,
  keys.assignments.all,
  keys.availability.all,
  keys.raceEntries.all,
  keys.settings,
] as const;

export const useLoadDemoClub = () =>
  useInvalidatingMutation(() => adapter.admin.loadDemoClub(), ALL_KEYS);

export const useRestoreDeleted = () =>
  useInvalidatingMutation((bundle: DeletedBundle) => restoreDeleted(adapter, bundle), ALL_KEYS);

/**
 * Offers Undo for a cascade that just ran.
 *
 * The bundle is everything the cascade removed; restoring it re-inserts the
 * rows with their original ids, so nothing referencing them dangles. The
 * offer lingers until dismissed — a silently expiring Undo is worse than a
 * lingering one on a screen nobody is watching closely.
 */
export function useUndoableDelete() {
  const restore = useRestoreDeleted();
  const notify = useNotifications((s) => s.notify);
  return (message: string, bundle: DeletedBundle) =>
    notify({
      message,
      tone: 'info',
      action: { label: 'Undo', run: () => void restore.mutateAsync(bundle) },
    });
}

export const useClearAllData = () =>
  useInvalidatingMutation(() => adapter.admin.clearAll(), ALL_KEYS);

export const useImportSnapshot = () =>
  useInvalidatingMutation((snapshot: Snapshot) => adapter.admin.importSnapshot(snapshot), ALL_KEYS);

export const exportSnapshot = () => adapter.admin.exportSnapshot();

/**
 * Reloads every query when another tab replaces the database.
 *
 * Without this a second tab keeps rendering data that no longer exists on
 * disk, and — because every write persists the whole snapshot — its next save
 * overwrites everything the other tab changed. `refetchOnWindowFocus` does not
 * cover it: that refetch was served from the same stale in-memory cache.
 */
export function useExternalStorageSync() {
  const queryClient = useQueryClient();
  useEffect(
    () => subscribeToExternalChanges(() => void queryClient.invalidateQueries()),
    [queryClient],
  );
}

/** Surfaces anything the last read had to skip, once, at startup. */
export function useStorageWarnings() {
  const notify = useNotifications((s) => s.notify);
  useEffect(() => {
    for (const warning of takeReadWarnings()) notify(warning);
  }, [notify]);
}
