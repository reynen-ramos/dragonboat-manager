import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import type { Assignment, Availability } from '@/domain/types';
import { keys } from './keys';
import { useSetAvailability } from './hooks';
import { patchAssignmentsCache, patchAvailabilityCache } from './optimistic';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
  vi.restoreAllMocks();
});

const entry = (eventId: string, memberId: string, status: Availability['status']): Availability => ({
  eventId,
  memberId,
  status,
  updatedAt: '2026-09-01T00:00:00.000Z',
});

describe('patchAvailabilityCache', () => {
  it('upserts into the flat cache and respects a keyed slice', () => {
    const cached = [entry('e1', 'm1', 'maybe'), entry('e2', 'm1', 'in')];

    const flat = patchAvailabilityCache(['availability'], cached, [entry('e1', 'm1', 'in')])!;
    expect(flat).toHaveLength(2); // replaced, not appended
    expect(flat.find((a) => a.eventId === 'e1')?.status).toBe('in');

    // A byEvent slice for e2 must not swallow an e1 write.
    const sliced = patchAvailabilityCache(
      ['availability', { eventId: 'e2' }],
      [entry('e2', 'm1', 'in')],
      [entry('e1', 'm1', 'out')],
    );
    expect(sliced).toEqual([entry('e2', 'm1', 'in')]);
  });
});

describe('patchAssignmentsCache', () => {
  it('applies the plan and re-filters a byCrew slice', () => {
    const seated: Assignment = {
      id: 'a1',
      crewId: 'c1',
      memberId: 'm1',
      role: 'paddler',
      seat: { row: 1, side: 'left' },
    };

    // Moving the row to another crew must drop it from this crew's slice.
    const patched = patchAssignmentsCache(
      ['assignments', { crewId: 'c1' }],
      [seated],
      [{ op: 'update', id: 'a1', patch: { crewId: 'c2' } }],
    );
    expect(patched).toEqual([]);

    const swapped = patchAssignmentsCache(
      ['assignments', { crewId: 'c1' }],
      [seated],
      [{ op: 'update', id: 'a1', patch: { seat: { row: 3, side: 'right' } } }],
    )!;
    expect(swapped[0].seat).toEqual({ row: 3, side: 'right' });
  });
});

describe('useSetAvailability optimistic layer', () => {
  const setup = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, wrapper };
  };

  it('paints the answer before the write settles, then keeps it', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(keys.availability.all, []);

    // A write that hangs: the optimistic patch is all the UI has.
    let release!: () => void;
    vi.spyOn(mockAdapter.availability, 'setMany').mockImplementation(
      (entries) =>
        new Promise((resolve) => {
          release = () => resolve(entries);
        }),
    );

    const { result } = renderHook(() => useSetAvailability(), { wrapper });
    result.current.mutate([entry('e1', 'm1', 'in')]);

    await waitFor(() => {
      const cached = queryClient.getQueryData<Availability[]>(keys.availability.all);
      expect(cached).toHaveLength(1); // visible while the network hangs
    });
    release();
  });

  it('rolls the cache back when the write is refused', async () => {
    const { queryClient, wrapper } = setup();
    const before = [entry('e1', 'm1', 'maybe')];
    queryClient.setQueryData(keys.availability.all, before);
    vi.spyOn(mockAdapter.availability, 'setMany').mockRejectedValue(new Error('RLS said no'));

    const { result } = renderHook(() => useSetAvailability(), { wrapper });
    result.current.mutate([entry('e1', 'm1', 'in')]);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(keys.availability.all)).toEqual(before);
  });
});
