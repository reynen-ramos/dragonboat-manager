import type { Assignment, Crew } from '@/domain/types';
import type { DataAdapter } from './repo';

/**
 * Operations that span more than one collection.
 *
 * Deleting an event has to take its categories, crews, assignments, and race
 * entries with it. Putting that here rather than in the adapters means the
 * cascade is defined once and behaves identically on localStorage and on
 * Supabase — where the database enforces it too, via `on delete cascade`.
 */

export async function deleteCrewCascade(adapter: DataAdapter, crewId: string): Promise<void> {
  const [assignments, raceEntries] = await Promise.all([
    adapter.assignments.list({ crewId }),
    adapter.raceEntries.list({ crewId }),
  ]);
  await Promise.all([
    ...assignments.map((a) => adapter.assignments.remove(a.id)),
    ...raceEntries.map((r) => adapter.raceEntries.remove(r.id)),
  ]);
  await adapter.crews.remove(crewId);
}

export async function deleteCategoryCascade(
  adapter: DataAdapter,
  categoryId: string,
): Promise<void> {
  const crews = await adapter.crews.list({ categoryId });
  for (const crew of crews) await deleteCrewCascade(adapter, crew.id);
  await adapter.categories.remove(categoryId);
}

export async function deleteEventCascade(adapter: DataAdapter, eventId: string): Promise<void> {
  const categories = await adapter.categories.list({ eventId });
  for (const category of categories) await deleteCategoryCascade(adapter, category.id);
  await adapter.availability.removeByEvent(eventId);
  await adapter.events.remove(eventId);
}

/**
 * Removing a member has to clear them out of every crew they were in, or their
 * seats would point at somebody who no longer exists.
 */
export async function deleteMemberCascade(adapter: DataAdapter, memberId: string): Promise<void> {
  const assignments = await adapter.assignments.list({ memberId });
  await Promise.all(assignments.map((a) => adapter.assignments.remove(a.id)));
  await adapter.availability.removeByMember(memberId);
  await adapter.members.remove(memberId);
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
  for (const a of assignments) {
    const input: Omit<Assignment, 'id'> = {
      crewId: copy.id,
      memberId: a.memberId,
      role: a.role,
    };
    if (a.seat) input.seat = { ...a.seat };
    if (a.pinned) input.pinned = a.pinned;
    await adapter.assignments.create(input);
  }

  return copy;
}
