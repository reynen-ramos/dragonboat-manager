import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionProvider } from '@/auth/SessionProvider';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { addDays, startOfWeek } from '@/domain/calendar';
import { todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { TrainingsPage } from './TrainingsPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const seed = (over: Partial<ClubEvent> & Pick<ClubEvent, 'name' | 'startDate'>) =>
  mockAdapter.events.create({ type: 'practice', ...over });

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MemoryRouter>
          <TrainingsPage />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
};

const section = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('section')!);

describe('TrainingsPage', () => {
  it('plans the week: this week, next week, later, and a folded past', async () => {
    const today = todayIso();
    const weekEnd = addDays(startOfWeek(today), 7);
    await seed({ name: 'Tonight Paddle', startDate: today, trainingKind: 'water' });
    await seed({ name: 'Next Week Erg', startDate: weekEnd, trainingKind: 'land' });
    await seed({ name: 'Far Ahead Session', startDate: addDays(weekEnd, 7) });
    await seed({ name: 'Bygone Session', startDate: addDays(today, -30) });

    renderPage();

    expect(await screen.findByText('Tonight Paddle')).toBeInTheDocument();
    expect(section('This week').getByText('Tonight Paddle')).toBeInTheDocument();
    expect(section('This week').getByText('Water training')).toBeInTheDocument();
    expect(section('Next week').getByText('Next Week Erg')).toBeInTheDocument();
    expect(section('Later').getByText('Far Ahead Session')).toBeInTheDocument();

    // The past folds by month, like the Events section.
    expect(screen.queryByText('Bygone Session')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show 1 training' }));
    expect(screen.getByText('Bygone Session')).toBeInTheDocument();
  });

  it('shows only trainings, each with a direct sign-ups link', async () => {
    const today = todayIso();
    await seed({ name: 'Tonight Paddle', startDate: today });
    const race = await mockAdapter.events.create({
      name: 'Tonight Regatta',
      startDate: today,
      type: 'race',
    });

    renderPage();

    expect(await screen.findByText('Tonight Paddle')).toBeInTheDocument();
    expect(screen.queryByText('Tonight Regatta')).not.toBeInTheDocument();
    const signups = screen.getByRole('link', { name: /Sign-ups/ });
    expect(signups.getAttribute('href')).toContain('/signups');
    expect(signups.getAttribute('href')).not.toContain(race.id);
  });

  it('pre-selects a practice-like type in the New training form', async () => {
    await seed({ name: 'Tonight Paddle', startDate: todayIso() });
    renderPage();
    await screen.findByText('Tonight Paddle');

    await userEvent.click(screen.getByRole('button', { name: /New training/ }));

    expect(screen.getByLabelText('Type')).toHaveValue('practice');
    expect(screen.getByLabelText('Training kind')).toBeInTheDocument();
  });
});
