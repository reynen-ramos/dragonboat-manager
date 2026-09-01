import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionProvider } from '@/auth/SessionProvider';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter, setDevRole } from '@/data/mock/index';
import { addDays } from '@/domain/calendar';
import { todayIso } from '@/domain/dates';
import { MyPage } from './MyPage';
import { TrainingsPage } from './TrainingsPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
  // The dev role switcher is how the mock becomes a paddler: the session
  // borrows the first active roster member as "you".
  setDevRole('paddler');
});

const renderPage = (element: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MemoryRouter>{element}</MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
};

const seedSelf = () =>
  mockAdapter.members.create({
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    canDrum: false,
    canSteer: false,
    status: 'active',
  });

describe('MyPage', () => {
  it('answers an upcoming sign-up with the paddler’s own row', async () => {
    const ana = await seedSelf();
    const training = await mockAdapter.events.create({
      name: 'Saturday Water Session',
      type: 'practice',
      trainingKind: 'water',
      startDate: addDays(todayIso(), 2),
    });

    renderPage(<MyPage />);

    // Their own page, their own name.
    expect(await screen.findByRole('heading', { name: 'Ana Reyes' })).toBeInTheDocument();

    const row = (await screen.findByText('Saturday Water Session')).closest('li')!;
    await userEvent.click(within(row).getByRole('radio', { name: 'In' }));

    await waitFor(async () => {
      const answers = await mockAdapter.availability.listByEvent(training.id);
      expect(answers).toEqual([
        expect.objectContaining({ memberId: ana.id, status: 'in' }),
      ]);
    });
  });

  it('asks for a linked login when the session has no member', async () => {
    setDevRole('coach'); // staff sessions carry no memberId in the mock
    renderPage(<MyPage />);

    expect(
      await screen.findByText("Your login isn't linked to the roster yet"),
    ).toBeInTheDocument();
  });
});

describe('paddler affordances', () => {
  it('shows the schedule without any manage controls', async () => {
    await seedSelf();
    await mockAdapter.events.create({
      name: 'Sunday Water Session',
      type: 'practice',
      startDate: addDays(todayIso(), 3),
    });

    renderPage(<TrainingsPage />);

    expect(await screen.findByText('Sunday Water Session')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New training/ })).not.toBeInTheDocument();
    // Reading stays: the time-trials link is a view, not a write.
    expect(screen.getByRole('link', { name: /Time trials/ })).toBeInTheDocument();
  });
});
