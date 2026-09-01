import { beforeEach, describe, expect, it } from 'vitest';
import type { Assignment, Availability } from '@/domain/types';
import { deleteEventCascade, restoreDeleted } from './operations';
import type { DataAdapter } from './repo';

/**
 * The behavioural contract every DataAdapter must satisfy.
 *
 * One spec, two implementations: the mock runs it on every test pass, and the
 * Supabase adapter runs the identical file against a local stack when
 * SUPABASE_TEST_URL is set. Anything the app relies on that only one adapter
 * does belongs here as a failing test, not in a bug report.
 *
 * Seeds build full FK chains (event → category → crew → assignment) because
 * Postgres enforces the references the mock merely stores.
 */
export function describeAdapterContract(
  name: string,
  getAdapter: () => DataAdapter,
  reset: () => Promise<void> | void,
): void {
  describe(`${name} adapter contract`, () => {
    let adapter: DataAdapter;

    beforeEach(async () => {
      await reset();
      adapter = getAdapter();
    });

    const seedMember = (firstName = 'Ana', lastName = 'Reyes') =>
      adapter.members.create({
        firstName,
        lastName,
        gender: 'female',
        sidePreference: 'left',
        canDrum: false,
        canSteer: false,
        status: 'active',
      });

    const seedCrewChain = async () => {
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
      return { event, category, crew };
    };

    it('creates, gets, and lists with exact-equality filters', async () => {
      const { event, category, crew } = await seedCrewChain();
      const other = await adapter.categories.create({
        eventId: event.id,
        boatSize: 20,
        genderClass: 'mixed',
      });

      expect((await adapter.crews.get(crew.id))?.name).toBe('A Crew');
      expect(await adapter.crews.get('00000000-0000-0000-0000-000000000000')).toBeUndefined();
      expect(await adapter.crews.list({ categoryId: category.id })).toHaveLength(1);
      expect(await adapter.crews.list({ categoryId: other.id })).toHaveLength(0);
      // An undefined filter value means "any", not "must be null".
      expect(await adapter.crews.list({ categoryId: undefined })).toHaveLength(1);
    });

    it('createMany inserts in order with distinct ids; empty input is a no-op', async () => {
      const created = await adapter.events.createMany([
        { name: 'One', type: 'practice', startDate: '2026-09-01' },
        { name: 'Two', type: 'practice', startDate: '2026-09-02' },
        { name: 'Three', type: 'practice', startDate: '2026-09-03' },
      ]);

      expect(created.map((e) => e.name)).toEqual(['One', 'Two', 'Three']);
      expect(new Set(created.map((e) => e.id)).size).toBe(3);
      expect(await adapter.events.createMany([])).toEqual([]);
      expect(await adapter.events.list()).toHaveLength(3);
    });

    it('update merges the patch, and an explicitly-undefined value clears the field', async () => {
      const event = await adapter.events.create({
        name: 'Water Session',
        type: 'practice',
        trainingKind: 'water',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      });

      const updated = await adapter.events.update(event.id, {
        location: 'Club dock',
        endDate: undefined, // the clear-a-field shape every form emits
      });

      expect(updated.location).toBe('Club dock');
      expect(updated.endDate).toBeUndefined();
      expect(updated.trainingKind).toBe('water'); // untouched keys survive
      const stored = await adapter.events.get(event.id);
      expect(stored?.endDate).toBeUndefined();
      expect(stored?.location).toBe('Club dock');
    });

    it('update on a missing id throws rather than inventing a row', async () => {
      await expect(
        adapter.events.update('00000000-0000-0000-0000-000000000000', { name: 'ghost' }),
      ).rejects.toThrow();
    });

    it('remove and removeMany tolerate ids that no longer exist', async () => {
      const [a, b] = await adapter.events.createMany([
        { name: 'One', type: 'practice', startDate: '2026-09-01' },
        { name: 'Two', type: 'practice', startDate: '2026-09-02' },
      ]);

      await adapter.events.removeMany([a.id, '00000000-0000-0000-0000-000000000000']);
      expect((await adapter.events.list()).map((e) => e.id)).toEqual([b.id]);
      await adapter.events.removeMany([a.id]); // twice is harmless
      await adapter.events.remove('00000000-0000-0000-0000-000000000000');
      expect(await adapter.events.list()).toHaveLength(1);
    });

    it('bulkUpdate applies every patch', async () => {
      const created = await adapter.events.createMany([
        { name: 'One', type: 'practice', startDate: '2026-09-01' },
        { name: 'Two', type: 'practice', startDate: '2026-09-02' },
      ]);

      await adapter.events.bulkUpdate(created.map((e) => ({ id: e.id, patch: { location: 'Dock' } })));

      const stored = await adapter.events.list();
      expect(stored.every((e) => e.location === 'Dock')).toBe(true);
    });

    it('restoreMany reinserts rows with their ids and skips ids that exist', async () => {
      const event = await adapter.events.create({
        name: 'Keeper',
        type: 'race',
        startDate: '2026-09-01',
      });
      const ghost = { ...event, id: newUuid(), name: 'Restored' };

      await adapter.events.restoreMany([{ ...event, name: 'MUST NOT OVERWRITE' }, ghost]);

      expect((await adapter.events.get(event.id))?.name).toBe('Keeper');
      expect((await adapter.events.get(ghost.id))?.name).toBe('Restored');
    });

    it('replaceForCrew swaps the whole lineup, preserving the given row ids', async () => {
      const { crew } = await seedCrewChain();
      const ana = await seedMember('Ana', 'Reyes');
      const ben = await seedMember('Ben', 'Cruz');
      const before = await adapter.assignments.create({
        crewId: crew.id,
        memberId: ana.id,
        role: 'paddler',
        seat: { row: 1, side: 'left' },
      });

      const replacement: Assignment[] = [
        { id: newUuid(), crewId: crew.id, memberId: ben.id, role: 'paddler', seat: { row: 2, side: 'right' } },
      ];
      await adapter.assignments.replaceForCrew(crew.id, replacement);

      const rows = await adapter.assignments.list({ crewId: crew.id });
      expect(rows.map((a) => a.id)).toEqual([replacement[0].id]); // identity kept
      expect(await adapter.assignments.get(before.id)).toBeUndefined();
    });

    it('applyChanges lands mixed operations fully, or not at all', async () => {
      const { crew } = await seedCrewChain();
      const ana = await seedMember('Ana', 'Reyes');
      const ben = await seedMember('Ben', 'Cruz');
      const seated = await adapter.assignments.create({
        crewId: crew.id,
        memberId: ana.id,
        role: 'paddler',
        seat: { row: 1, side: 'left' },
      });

      await adapter.assignments.applyChanges([
        { op: 'create', assignment: { crewId: crew.id, memberId: ben.id, role: 'reserve' } },
        // The bumped-to-reserve patch, exactly as planDrop emits it: the
        // explicit undefineds must clear the seat, not be dropped.
        { op: 'update', id: seated.id, patch: { role: 'reserve', seat: undefined, pinned: undefined } },
      ]);

      const rows = await adapter.assignments.list({ crewId: crew.id });
      expect(rows).toHaveLength(2);
      expect(rows.every((a) => a.role === 'reserve' && a.seat === undefined)).toBe(true);

      await expect(
        adapter.assignments.applyChanges([
          { op: 'delete', id: seated.id },
          { op: 'update', id: newUuid(), patch: { role: 'reserve' } },
        ]),
      ).rejects.toThrow();
      // The valid delete ahead of the broken update must not have applied.
      expect(await adapter.assignments.list({ crewId: crew.id })).toHaveLength(2);
    });

    it('availability upserts on (eventId, memberId) and round-trips updatedAt', async () => {
      const { event } = await seedCrewChain();
      const ana = await seedMember();
      const first: Availability = {
        eventId: event.id,
        memberId: ana.id,
        status: 'maybe',
        updatedAt: '2026-08-27T09:00:00.000Z',
      };

      await adapter.availability.set(first);
      await adapter.availability.set({
        ...first,
        status: 'in',
        note: 'Changed my mind',
        updatedAt: '2026-08-28T10:30:00.000Z',
      });

      const rows = await adapter.availability.listByEvent(event.id);
      expect(rows).toHaveLength(1); // upsert, not append
      expect(rows[0]).toMatchObject({
        status: 'in',
        note: 'Changed my mind',
        // updatedAt is data the app writes, never something storage stamps.
        updatedAt: '2026-08-28T10:30:00.000Z',
      });
      expect(await adapter.availability.listByMember(ana.id)).toHaveLength(1);

      await adapter.availability.removeByEvent(event.id);
      expect(await adapter.availability.listAll()).toHaveLength(0);
    });

    it('settings round-trip, with defaults before anything is saved', async () => {
      const defaults = await adapter.settings.get();
      expect(defaults.eventTypes.length).toBeGreaterThan(0);

      const saved = await adapter.settings.save({
        ...defaults,
        sideBalanceTolerance: 0.11,
        trainingKinds: [...defaults.trainingKinds, { id: 'yoga', label: 'Yoga' }],
      });
      const stored = await adapter.settings.get();
      expect(stored.sideBalanceTolerance).toBe(saved.sideBalanceTolerance);
      expect(stored.trainingKinds.some((k) => k.id === 'yoga')).toBe(true);
    });

    it('a cascade delete plus restore is a round trip', async () => {
      const { event, crew } = await seedCrewChain();
      const ana = await seedMember();
      const seated = await adapter.assignments.create({
        crewId: crew.id,
        memberId: ana.id,
        role: 'paddler',
        seat: { row: 1, side: 'left' },
      });
      await adapter.raceEntries.create({ crewId: crew.id, stage: 'heat', heat: 1, timeMs: 125_000 });
      await adapter.availability.set({
        eventId: event.id,
        memberId: ana.id,
        status: 'in',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      const bundle = await deleteEventCascade(adapter, event.id);
      expect(await adapter.events.list()).toHaveLength(0);
      expect(await adapter.assignments.list()).toHaveLength(0);

      await restoreDeleted(adapter, bundle);
      expect((await adapter.assignments.get(seated.id))?.memberId).toBe(ana.id);
      expect(await adapter.raceEntries.list({ crewId: crew.id })).toHaveLength(1);
      expect(await adapter.availability.listByEvent(event.id)).toHaveLength(1);
    });

    it('a snapshot export imports back identically', async () => {
      const { event, crew } = await seedCrewChain();
      const ana = await seedMember();
      await adapter.assignments.create({
        crewId: crew.id,
        memberId: ana.id,
        role: 'paddler',
        seat: { row: 3, side: 'right' },
      });
      const session = await adapter.timeTrialSessions.create({
        date: '2026-08-01',
        distanceM: 200,
        discipline: 'oc1',
      });
      await adapter.timeTrialResults.create({
        sessionId: session.id,
        memberId: ana.id,
        timeMs: 65_420,
      });

      const snapshot = await adapter.admin.exportSnapshot();
      await adapter.admin.clearAll();
      expect(await adapter.members.list()).toHaveLength(0);

      await adapter.admin.importSnapshot(snapshot);
      expect((await adapter.events.get(event.id))?.name).toBe('Spring Regatta');
      expect((await adapter.members.get(ana.id))?.firstName).toBe('Ana');
      const [result] = await adapter.timeTrialResults.list({ sessionId: session.id });
      expect(result?.timeMs).toBe(65_420);
      const [assignment] = await adapter.assignments.list({ crewId: crew.id });
      expect(assignment?.seat).toEqual({ row: 3, side: 'right' });
    });
  });
}

/** Valid UUIDs, because Postgres columns reject 'not-a-uuid' where the mock stores it. */
const newUuid = (): string => crypto.randomUUID();
