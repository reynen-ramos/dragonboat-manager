import { beforeEach, describe, expect, it } from 'vitest';
import { emptySnapshot, UnreadableSnapshotError } from '../migrate';
import { invalidateCache } from './db';
import { mockAdapter } from './index';

const availability = {
  eventId: 'e1',
  memberId: 'm1',
  status: 'in' as const,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

describe('batch primitives', () => {
  it('createMany inserts in order with fresh ids', async () => {
    const created = await mockAdapter.events.createMany([
      { name: 'One', type: 'practice', startDate: '2026-09-01' },
      { name: 'Two', type: 'practice', startDate: '2026-09-02' },
    ]);

    expect(created.map((e) => e.name)).toEqual(['One', 'Two']);
    expect(new Set(created.map((e) => e.id)).size).toBe(2);
    expect(await mockAdapter.events.list()).toHaveLength(2);
    expect(await mockAdapter.events.createMany([])).toEqual([]);
  });

  it('removeMany ignores ids that no longer exist', async () => {
    const [a, b] = await mockAdapter.events.createMany([
      { name: 'One', type: 'practice', startDate: '2026-09-01' },
      { name: 'Two', type: 'practice', startDate: '2026-09-02' },
    ]);

    await mockAdapter.events.removeMany([a.id, 'never-existed']);
    expect((await mockAdapter.events.list()).map((e) => e.id)).toEqual([b.id]);

    // Removing the same id twice is harmless.
    await mockAdapter.events.removeMany([a.id]);
    expect(await mockAdapter.events.list()).toHaveLength(1);
  });

  it('applyChanges applies mixed seating operations as one write', async () => {
    const seated = await mockAdapter.assignments.create({
      crewId: 'c1',
      memberId: 'm1',
      role: 'paddler',
      seat: { row: 1, side: 'left' },
    });
    const reserve = await mockAdapter.assignments.create({
      crewId: 'c1',
      memberId: 'm2',
      role: 'reserve',
    });

    await mockAdapter.assignments.applyChanges([
      { op: 'create', assignment: { crewId: 'c1', memberId: 'm3', role: 'reserve' } },
      { op: 'update', id: seated.id, patch: { seat: { row: 2, side: 'right' } } },
      { op: 'delete', id: reserve.id },
    ]);

    const rows = await mockAdapter.assignments.list();
    expect(rows).toHaveLength(2);
    expect(rows.find((a) => a.id === seated.id)?.seat).toEqual({ row: 2, side: 'right' });
    expect(rows.some((a) => a.memberId === 'm3' && a.role === 'reserve')).toBe(true);
    expect(rows.some((a) => a.id === reserve.id)).toBe(false);
  });

  it('applyChanges lands fully or not at all', async () => {
    const seated = await mockAdapter.assignments.create({
      crewId: 'c1',
      memberId: 'm1',
      role: 'paddler',
      seat: { row: 1, side: 'left' },
    });

    await expect(
      mockAdapter.assignments.applyChanges([
        { op: 'delete', id: seated.id },
        { op: 'update', id: 'missing', patch: { role: 'reserve' } },
      ]),
    ).rejects.toThrow();

    // The valid delete ahead of the broken update must not have applied.
    expect(await mockAdapter.assignments.list()).toHaveLength(1);
  });
});

describe('importSnapshot', () => {
  it('round-trips availability, which has no id', async () => {
    await mockAdapter.admin.importSnapshot({ ...emptySnapshot(), availability: [availability] });

    // Through the full read path, cache dropped, so the migration runs too.
    invalidateCache();
    expect(await mockAdapter.availability.listByEvent('e1')).toHaveLength(1);
  });

  it('refuses a backup with damaged rows rather than installing part of it', async () => {
    const damaged = {
      ...emptySnapshot(),
      members: [{ id: 'm1', firstName: 'Ana' }, { broken: true }],
    };

    await expect(mockAdapter.admin.importSnapshot(damaged as never)).rejects.toThrow(
      UnreadableSnapshotError,
    );
    // The stated policy is refuse, not best-effort: nothing may be written.
    expect(await mockAdapter.members.list()).toHaveLength(0);
  });

  it('accepts a clean backup', async () => {
    await mockAdapter.admin.importSnapshot({
      ...emptySnapshot(),
      members: [{ id: 'm1', firstName: 'Ana' } as never],
    });

    expect(await mockAdapter.members.list()).toHaveLength(1);
  });
});
