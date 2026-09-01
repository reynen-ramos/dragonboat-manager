import type {
  Assignment,
  Availability,
  Category,
  ClubEvent,
  Crew,
  Member,
  RaceEntry,
  TimeTrialResult,
  TimeTrialSession,
} from '@/domain/types';
import type { DataAdapter } from './repo';

/**
 * Operations that span more than one collection.
 *
 * Deleting an event has to take its categories, crews, assignments, and race
 * entries with it. Putting that here rather than in the adapters means the
 * cascade is defined once and behaves identically on localStorage and on
 * Supabase — where the database enforces it too, via `on delete cascade`.
 *
 * Every cascade returns exactly what it removed. A cascade is the most
 * destructive gesture in the app and it hides behind a single confirm — the
 * bundle is what lets the UI offer a real Undo instead of a warning.
 */

export interface DeletedBundle {
  members: Member[];
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  assignments: Assignment[];
  availability: Availability[];
  raceEntries: RaceEntry[];
  timeTrialSessions: TimeTrialSession[];
  timeTrialResults: TimeTrialResult[];
}

const emptyBundle = (): DeletedBundle => ({
  members: [],
  events: [],
  categories: [],
  crews: [],
  assignments: [],
  availability: [],
  raceEntries: [],
  timeTrialSessions: [],
  timeTrialResults: [],
});

const merge = (into: DeletedBundle, from: DeletedBundle): void => {
  for (const key of Object.keys(into) as (keyof DeletedBundle)[]) {
    (into[key] as unknown[]).push(...from[key]);
  }
};

export async function deleteCrewCascade(
  adapter: DataAdapter,
  crewId: string,
): Promise<DeletedBundle> {
  const bundle = emptyBundle();
  const crew = await adapter.crews.get(crewId);
  if (crew) bundle.crews.push(crew);

  // A crew's alternative plans mean nothing without it — and an orphaned
  // variant would keep existing in storage while rendering nowhere, since the
  // event screen shows variants only beneath their primary.
  const variants = await adapter.crews.list({ variantOf: crewId });
  for (const variant of variants) merge(bundle, await deleteCrewCascade(adapter, variant.id));

  const [assignments, raceEntries] = await Promise.all([
    adapter.assignments.list({ crewId }),
    adapter.raceEntries.list({ crewId }),
  ]);
  bundle.assignments.push(...assignments);
  bundle.raceEntries.push(...raceEntries);

  await Promise.all([
    adapter.assignments.removeMany(assignments.map((a) => a.id)),
    adapter.raceEntries.removeMany(raceEntries.map((r) => r.id)),
  ]);
  await adapter.crews.remove(crewId);
  return bundle;
}

export async function deleteCategoryCascade(
  adapter: DataAdapter,
  categoryId: string,
): Promise<DeletedBundle> {
  const bundle = emptyBundle();
  const category = await adapter.categories.get(categoryId);
  if (category) bundle.categories.push(category);

  const crews = await adapter.crews.list({ categoryId });
  for (const crew of crews) merge(bundle, await deleteCrewCascade(adapter, crew.id));
  await adapter.categories.remove(categoryId);
  return bundle;
}

export async function deleteEventCascade(
  adapter: DataAdapter,
  eventId: string,
): Promise<DeletedBundle> {
  const bundle = emptyBundle();
  const event = await adapter.events.get(eventId);
  if (event) bundle.events.push(event);

  const categories = await adapter.categories.list({ eventId });
  for (const category of categories) merge(bundle, await deleteCategoryCascade(adapter, category.id));

  bundle.availability.push(...(await adapter.availability.listByEvent(eventId)));
  await adapter.availability.removeByEvent(eventId);
  await adapter.events.remove(eventId);
  return bundle;
}

/**
 * Removing a member has to clear them out of every crew they were in, or their
 * seats would point at somebody who no longer exists.
 */
export async function deleteMemberCascade(
  adapter: DataAdapter,
  memberId: string,
): Promise<DeletedBundle> {
  const bundle = emptyBundle();
  const member = await adapter.members.get(memberId);
  if (member) bundle.members.push(member);

  const assignments = await adapter.assignments.list({ memberId });
  const trialResults = await adapter.timeTrialResults.list({ memberId });
  bundle.assignments.push(...assignments);
  bundle.timeTrialResults.push(...trialResults);
  bundle.availability.push(...(await adapter.availability.listByMember(memberId)));

  await adapter.assignments.removeMany(assignments.map((a) => a.id));
  await adapter.timeTrialResults.removeMany(trialResults.map((r) => r.id));
  await adapter.availability.removeByMember(memberId);
  await adapter.members.remove(memberId);
  return bundle;
}

/** Removing a session takes every time recorded in it along. */
export async function deleteTimeTrialSessionCascade(
  adapter: DataAdapter,
  sessionId: string,
): Promise<DeletedBundle> {
  const bundle = emptyBundle();
  const session = await adapter.timeTrialSessions.get(sessionId);
  if (session) bundle.timeTrialSessions.push(session);

  const results = await adapter.timeTrialResults.list({ sessionId });
  bundle.timeTrialResults.push(...results);

  await adapter.timeTrialResults.removeMany(results.map((r) => r.id));
  await adapter.timeTrialSessions.remove(sessionId);
  return bundle;
}

/**
 * Puts back what a cascade removed, ids and all.
 *
 * Parents before children, so restored assignments never reference a crew
 * that does not exist yet. `restoreMany` skips ids that already exist, which
 * makes pressing Undo twice harmless.
 */
export async function restoreDeleted(adapter: DataAdapter, bundle: DeletedBundle): Promise<void> {
  await adapter.members.restoreMany(bundle.members);
  await adapter.events.restoreMany(bundle.events);
  await adapter.categories.restoreMany(bundle.categories);
  await adapter.crews.restoreMany(bundle.crews);
  await adapter.assignments.restoreMany(bundle.assignments);
  await adapter.raceEntries.restoreMany(bundle.raceEntries);
  await adapter.timeTrialSessions.restoreMany(bundle.timeTrialSessions);
  await adapter.timeTrialResults.restoreMany(bundle.timeTrialResults);
  if (bundle.availability.length > 0) await adapter.availability.setMany(bundle.availability);
}

/**
 * Copies a crew and its whole lineup.
 *
 * Coaches build a B crew by starting from the A crew far more often than from
 * an empty boat, so this is a first-class operation rather than a convenience.
 */
export async function duplicateCrew(
  adapter: DataAdapter,
  crewId: string,
  newName: string,
): Promise<Crew> {
  const source = await adapter.crews.get(crewId);
  if (!source) throw new Error('That crew no longer exists.');

  const copy = await adapter.crews.create({
    categoryId: source.categoryId,
    name: newName,
    notes: source.notes,
  });

  const assignments = await adapter.assignments.list({ crewId });
  await adapter.assignments.createMany(
    assignments.map((a) => {
      const input: Omit<Assignment, 'id'> = {
        crewId: copy.id,
        memberId: a.memberId,
        role: a.role,
      };
      if (a.seat) input.seat = { ...a.seat };
      if (a.pinned) input.pinned = a.pinned;
      return input;
    }),
  );

  return copy;
}

/**
 * Creates a Plan B (C, D…) for a crew: a full copy of its lineup, marked as a
 * variant so it never races and never counts toward double-booking.
 */
export async function createCrewVariant(adapter: DataAdapter, crewId: string): Promise<Crew> {
  const source = await adapter.crews.get(crewId);
  if (!source) throw new Error('That crew no longer exists.');

  const siblings = await adapter.crews.list({ categoryId: source.categoryId });
  const existing = siblings.filter((c) => c.variantOf === crewId).length;
  const letter = String.fromCharCode(66 + existing); // B first: the crew itself is plan A.

  const copy = await duplicateCrew(adapter, crewId, `${source.name} · Plan ${letter}`);
  return adapter.crews.update(copy.id, { variantOf: crewId });
}

/**
 * Exchanges the lineups of two crews — how a variant becomes the real plan.
 *
 * The crews swap rows rather than identities: the racing crew keeps its id, so
 * race entries never dangle, and the variant ends up holding the previous
 * lineup as the new fallback. Assignment ids ride along unchanged, which keeps
 * the operation self-inverse — running it again is the undo.
 */
export async function swapCrewLineups(
  adapter: DataAdapter,
  crewIdA: string,
  crewIdB: string,
): Promise<void> {
  const [rowsA, rowsB] = await Promise.all([
    adapter.assignments.list({ crewId: crewIdA }),
    adapter.assignments.list({ crewId: crewIdB }),
  ]);
  await adapter.assignments.bulkUpdate([
    ...rowsA.map((a) => ({ id: a.id, patch: { crewId: crewIdB } })),
    ...rowsB.map((b) => ({ id: b.id, patch: { crewId: crewIdA } })),
  ]);
}
