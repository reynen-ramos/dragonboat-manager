import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache } from './mock/db';
import { mockAdapter as adapter } from './mock/index';
import {
  createCrewVariant,
  deleteCrewCascade,
  deleteEventCascade,
  deleteMemberCascade,
  deleteTimeTrialSessionCascade,
  restoreDeleted,
  swapCrewLineups,
} from './operations';

/**
 * Seeds one small club: an event with a category, a crew with a seated
 * paddler and a reserve, a race entry, and one availability answer.
 */
async function seed() {
  const member = await adapter.members.create({
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    canDrum: false,
    canSteer: false,
    status: 'active',
  });
  const spare = await adapter.members.create({
    firstName: 'Ben',
    lastName: 'Cruz',
    gender: 'male',
    sidePreference: 'both',
    canDrum: false,
    canSteer: false,
    status: 'active',
  });
  const event = await adapter.events.create({
    name: 'Spring Regatta',
    type: 'race',
    startDate: '2026-09-05',
  });
  const category = await adapter.categories.create({
    eventId: event.id,
    boatSize: 10,
    genderClass: 'open',
  });
  const crew = await adapter.crews.create({ categoryId: category.id, name: 'A Crew' });
  const seated = await adapter.assignments.create({
    crewId: crew.id,
    memberId: member.id,
    role: 'paddler',
    seat: { row: 1, side: 'left' },
  });
  await adapter.assignments.create({ crewId: crew.id, memberId: spare.id, role: 'reserve' });
  const entry = await adapter.raceEntries.create({ crewId: crew.id, stage: 'heat', heat: 1 });
  await adapter.availability.set({
    eventId: event.id,
    memberId: member.id,
    status: 'in',
    updatedAt: '2026-08-27T00:00:00.000Z',
  });

  return { member, spare, event, category, crew, seated, entry };
}

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cascade batching', () => {
  // A cascade over the network must cost a handful of round trips, not one
  // per row — the Supabase adapter inherits whatever call pattern this makes.
  it('deletes an event with batched writes, never row by row', async () => {
    const { event } = await seed();
    const removeAssignment = vi.spyOn(adapter.assignments, 'remove');
    const removeEntry = vi.spyOn(adapter.raceEntries, 'remove');
    const removeManyAssignments = vi.spyOn(adapter.assignments, 'removeMany');
    const removeManyEntries = vi.spyOn(adapter.raceEntries, 'removeMany');

    await deleteEventCascade(adapter, event.id);

    expect(removeAssignment).not.toHaveBeenCalled();
    expect(removeEntry).not.toHaveBeenCalled();
    // One crew in the seed → one batch per collection.
    expect(removeManyAssignments).toHaveBeenCalledTimes(1);
    expect(removeManyEntries).toHaveBeenCalledTimes(1);
  });

  it('duplicates a lineup with one batched insert', async () => {
    const { crew } = await seed();
    const createOne = vi.spyOn(adapter.assignments, 'create');
    const createBatch = vi.spyOn(adapter.assignments, 'createMany');

    await createCrewVariant(adapter, crew.id);

    expect(createOne).not.toHaveBeenCalled();
    expect(createBatch).toHaveBeenCalledTimes(1);
  });
});

describe('deleteEventCascade', () => {
  it('returns everything it removed', async () => {
    const { event, category, crew } = await seed();

    const bundle = await deleteEventCascade(adapter, event.id);

    expect(bundle.events.map((e) => e.id)).toEqual([event.id]);
    expect(bundle.categories.map((c) => c.id)).toEqual([category.id]);
    expect(bundle.crews.map((c) => c.id)).toEqual([crew.id]);
    expect(bundle.assignments).toHaveLength(2);
    expect(bundle.raceEntries).toHaveLength(1);
    expect(bundle.availability).toHaveLength(1);

    expect(await adapter.events.list()).toHaveLength(0);
    expect(await adapter.assignments.list()).toHaveLength(0);
  });

  it('restore puts the whole event back, ids intact', async () => {
    const { event, crew, seated } = await seed();

    const bundle = await deleteEventCascade(adapter, event.id);
    await restoreDeleted(adapter, bundle);

    expect((await adapter.events.get(event.id))?.name).toBe('Spring Regatta');
    expect((await adapter.crews.get(crew.id))?.name).toBe('A Crew');
    // Identity matters: anything referencing the old ids must not dangle.
    expect((await adapter.assignments.get(seated.id))?.seat).toEqual({ row: 1, side: 'left' });
    expect(await adapter.availability.listByEvent(event.id)).toHaveLength(1);
  });

  it('pressing Undo twice is harmless', async () => {
    const { event } = await seed();

    const bundle = await deleteEventCascade(adapter, event.id);
    await restoreDeleted(adapter, bundle);
    await restoreDeleted(adapter, bundle);

    expect(await adapter.events.list()).toHaveLength(1);
    expect(await adapter.assignments.list()).toHaveLength(2);
    expect(await adapter.availability.listByEvent(event.id)).toHaveLength(1);
  });
});

describe('deleteMemberCascade', () => {
  it('collects the member, their seats, and their availability', async () => {
    const { member } = await seed();

    const bundle = await deleteMemberCascade(adapter, member.id);

    expect(bundle.members.map((m) => m.id)).toEqual([member.id]);
    expect(bundle.assignments).toHaveLength(1);
    expect(bundle.availability).toHaveLength(1);
    expect(bundle.events).toHaveLength(0); // the event is not theirs to take
  });

  it('restore returns them to their seat', async () => {
    const { member, seated } = await seed();

    const bundle = await deleteMemberCascade(adapter, member.id);
    await restoreDeleted(adapter, bundle);

    expect((await adapter.assignments.get(seated.id))?.memberId).toBe(member.id);
    expect(await adapter.availability.listByMember(member.id)).toHaveLength(1);
  });

  it('takes their time-trial results along, and restore brings them back', async () => {
    const { member } = await seed();
    const session = await adapter.timeTrialSessions.create({ date: '2026-08-01', distanceM: 200 });
    const result = await adapter.timeTrialResults.create({
      sessionId: session.id,
      memberId: member.id,
      timeMs: 65_000,
    });

    const bundle = await deleteMemberCascade(adapter, member.id);
    expect(bundle.timeTrialResults.map((r) => r.id)).toEqual([result.id]);
    expect(bundle.timeTrialSessions).toHaveLength(0); // the session is not theirs to take
    expect(await adapter.timeTrialResults.list()).toHaveLength(0);

    await restoreDeleted(adapter, bundle);
    expect((await adapter.timeTrialResults.get(result.id))?.timeMs).toBe(65_000);
  });
});

describe('deleteTimeTrialSessionCascade', () => {
  it('takes every recorded time with it, and restore is exact', async () => {
    const { member, spare } = await seed();
    const session = await adapter.timeTrialSessions.create({
      date: '2026-08-01',
      distanceM: 200,
      discipline: 'oc1',
    });
    await adapter.timeTrialResults.createMany([
      { sessionId: session.id, memberId: member.id, timeMs: 65_000 },
      { sessionId: session.id, memberId: spare.id },
    ]);

    const bundle = await deleteTimeTrialSessionCascade(adapter, session.id);

    expect(bundle.timeTrialSessions.map((s) => s.id)).toEqual([session.id]);
    expect(bundle.timeTrialResults).toHaveLength(2);
    expect(await adapter.timeTrialSessions.list()).toHaveLength(0);
    expect(await adapter.timeTrialResults.list()).toHaveLength(0);

    await restoreDeleted(adapter, bundle);
    expect((await adapter.timeTrialSessions.get(session.id))?.discipline).toBe('oc1');
    expect(await adapter.timeTrialResults.list({ sessionId: session.id })).toHaveLength(2);
  });
});

describe('deleteCrewCascade', () => {
  it('takes the lineup and race entries, and restore brings them back', async () => {
    const { crew, entry } = await seed();

    const bundle = await deleteCrewCascade(adapter, crew.id);
    expect(bundle.crews).toHaveLength(1);
    expect(bundle.assignments).toHaveLength(2);
    expect(bundle.raceEntries.map((r) => r.id)).toEqual([entry.id]);

    await restoreDeleted(adapter, bundle);
    expect(await adapter.assignments.list({ crewId: crew.id })).toHaveLength(2);
    expect((await adapter.raceEntries.get(entry.id))?.stage).toBe('heat');
  });
});

describe('crew variants', () => {
  it('creates a marked copy named Plan B, then Plan C', async () => {
    const { crew } = await seed();

    const planB = await createCrewVariant(adapter, crew.id);
    const planC = await createCrewVariant(adapter, crew.id);

    expect(planB.name).toBe('A Crew · Plan B');
    expect(planB.variantOf).toBe(crew.id);
    expect(planC.name).toBe('A Crew · Plan C');
    expect(await adapter.assignments.list({ crewId: planB.id })).toHaveLength(2);
  });

  it('swap exchanges lineups but not identities', async () => {
    const { crew, seated } = await seed();
    const planB = await createCrewVariant(adapter, crew.id);
    // Change the plan so the two lineups differ.
    await adapter.assignments.update(seated.id, { seat: { row: 5, side: 'right' } });

    await swapCrewLineups(adapter, crew.id, planB.id);

    // The original seated row now belongs to the variant, id unchanged.
    expect((await adapter.assignments.get(seated.id))?.crewId).toBe(planB.id);
    expect(await adapter.assignments.list({ crewId: crew.id })).toHaveLength(2);

    // Self-inverse: running it again is the undo.
    await swapCrewLineups(adapter, crew.id, planB.id);
    expect((await adapter.assignments.get(seated.id))?.crewId).toBe(crew.id);
  });
});

describe('deleting a crew with plans', () => {
  it('takes its variants along, and restore brings the whole family back', async () => {
    const { crew } = await seed();
    const planB = await createCrewVariant(adapter, crew.id);

    const bundle = await deleteCrewCascade(adapter, crew.id);

    // An orphaned variant would persist in storage while rendering nowhere.
    expect(bundle.crews.map((c) => c.id).sort()).toEqual([crew.id, planB.id].sort());
    expect(await adapter.crews.list()).toHaveLength(0);
    expect(await adapter.assignments.list()).toHaveLength(0);

    await restoreDeleted(adapter, bundle);
    expect((await adapter.crews.get(planB.id))?.variantOf).toBe(crew.id);
    expect(await adapter.assignments.list({ crewId: planB.id })).toHaveLength(2);
  });
});
