import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAdapter } from '@/data/mock/index';
import { invalidateCache } from '@/data/mock/db';
import { useUpdateMember } from './hooks';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

describe('mutation invalidation', () => {
  it('holds mutateAsync unresolved until the invalidations settle', async () => {
    // Undo snapshots read the cache right after awaiting a write. If the
    // invalidation is fired and forgotten instead of returned, mutateAsync
    // resolves against the pre-write cache and two rapid edits capture the
    // same stale lineup.
    const member = await mockAdapter.members.create({
      firstName: 'Ana',
      lastName: 'Reyes',
      gender: 'female',
      sidePreference: 'left',
      canDrum: false,
      canSteer: false,
      status: 'active',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    let settle!: () => void;
    const gate = new Promise<void>((resolve) => (settle = resolve));
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockReturnValue(gate as never);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateMember(), { wrapper });

    let resolved = false;
    const pending = result.current
      .mutateAsync({ id: member.id, patch: { firstName: 'Anna' } })
      .then(() => {
        resolved = true;
      });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    // The write is done and invalidation was requested — but not yet settled.
    await new Promise((r) => setTimeout(r, 20));
    expect(resolved).toBe(false);

    settle();
    await pending;
    expect(resolved).toBe(true);
  });
});
