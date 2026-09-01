import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import type { Member } from '@/domain/types';
import { TimeTrialSessionPage } from './TimeTrialSessionPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const seedMember = (over: Partial<Member> & Pick<Member, 'firstName' | 'lastName'>) =>
  mockAdapter.members.create({
    gender: 'female',
    sidePreference: 'both',
    canDrum: false,
    canSteer: false,
    status: 'active',
    ...over,
  });

const renderPage = (sessionId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/time-trials/${sessionId}`]}>
        <Routes>
          <Route path="/time-trials/:sessionId" element={<TimeTrialSessionPage />} />
          <Route path="/time-trials" element={<p>back at the list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('TimeTrialSessionPage', () => {
  it('adds a paddler to the sheet, takes a time, and ranks the field', async () => {
    const session = await mockAdapter.timeTrialSessions.create({
      date: '2026-08-01',
      distanceM: 200,
      discipline: 'oc1',
    });
    const ana = await seedMember({ firstName: 'Ana', lastName: 'Reyes' });
    const ben = await seedMember({ firstName: 'Ben', lastName: 'Cruz' });
    await mockAdapter.timeTrialResults.create({
      sessionId: session.id,
      memberId: ben.id,
      timeMs: 70_000,
    });

    renderPage(session.id);

    // Ben is already on the sheet with the only time — placed 1st.
    expect(await screen.findByLabelText('Placed 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add paddlers' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Reyes' }));

    // Ana lands on the sheet untimed; typing a faster time takes 1st off Ben.
    const anaInput = await screen.findByLabelText('Time for Ana Reyes');
    await userEvent.type(anaInput, '1:05.42');
    await userEvent.tab();

    await waitFor(async () => {
      const results = await mockAdapter.timeTrialResults.list({ sessionId: session.id });
      const anaRow = results.find((r) => r.memberId === ana.id);
      expect(anaRow?.timeMs).toBe(65_420);
    });
    expect(screen.getByLabelText('Time for Ben Cruz')).toHaveValue('1:10.000');
    expect(screen.getByText('2 of 2 timed')).toBeInTheDocument();
  });

  it('rejects an unparseable time without writing it', async () => {
    const session = await mockAdapter.timeTrialSessions.create({
      date: '2026-08-01',
      distanceM: 200,
    });
    const ana = await seedMember({ firstName: 'Ana', lastName: 'Reyes' });
    await mockAdapter.timeTrialResults.create({ sessionId: session.id, memberId: ana.id });

    renderPage(session.id);
    const input = await screen.findByLabelText('Time for Ana Reyes');
    await userEvent.type(input, 'not a time');
    await userEvent.tab();

    expect(input).toHaveAttribute('aria-invalid', 'true');
    const [row] = await mockAdapter.timeTrialResults.list({ sessionId: session.id });
    expect(row.timeMs).toBeUndefined();
  });

  it('deletes the session with everything in it, back to the list', async () => {
    const session = await mockAdapter.timeTrialSessions.create({
      date: '2026-08-01',
      distanceM: 500,
      discipline: 'erg',
    });
    const ana = await seedMember({ firstName: 'Ana', lastName: 'Reyes' });
    await mockAdapter.timeTrialResults.create({
      sessionId: session.id,
      memberId: ana.id,
      timeMs: 110_000,
    });

    renderPage(session.id);
    await screen.findByLabelText('Placed 1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete session' }));

    await screen.findByText('back at the list');
    expect(await mockAdapter.timeTrialSessions.list()).toHaveLength(0);
    expect(await mockAdapter.timeTrialResults.list()).toHaveLength(0);
  });
});
