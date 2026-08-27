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
