import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { monthLabel, monthOf } from '@/domain/calendar';
import { todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { EventsPage } from './EventsPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const shift = (days: number): string => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const seed = (over: Partial<ClubEvent> & Pick<ClubEvent, 'name' | 'startDate'>) =>
  mockAdapter.events.create({ type: 'race', ...over });

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('EventsPage past list', () => {
  it('groups the past by month, races visible, trainings folded away', async () => {
    await seed({ name: 'Spring Regatta', startDate: shift(-20) });
    await seed({ name: 'Old Water Session', startDate: shift(-18), type: 'practice' });
    await seed({ name: 'Nationals Ahead', startDate: shift(10) });

    renderPage();

    // The race stays on the page; the training hides behind its month toggle.
    expect(await screen.findByText('Spring Regatta')).toBeInTheDocument();
    expect(screen.getByText('Nationals Ahead')).toBeInTheDocument();
    expect(screen.queryByText('Old Water Session')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: monthLabel(monthOf(shift(-18))) }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show 1 training' }));
    expect(screen.getByText('Old Water Session')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide trainings' }));
    expect(screen.queryByText('Old Water Session')).not.toBeInTheDocument();
  });

  it('folds custom practice-base types too, by their behaviour', async () => {
    await mockAdapter.settings.save({
      ...(await mockAdapter.settings.get()),
      eventTypes: [
        { id: 'race', label: 'Race / regatta', base: 'race' },
        { id: 'practice', label: 'Practice', base: 'practice' },
        { id: 'gym', label: 'Gym Session', base: 'practice' },
        { id: 'other', label: 'Other', base: 'other' },
      ],
    });
    await seed({ name: 'Old Gym Night', startDate: shift(-15), type: 'gym' });
    await seed({ name: 'Old Fundraiser', startDate: shift(-15), type: 'other' });

    renderPage();

    // The toggle appears only once settings resolve and the custom type is
    // recognised as practice-base — wait on it before asserting the fold.
    expect(await screen.findByRole('button', { name: 'Show 1 training' })).toBeInTheDocument();
    expect(screen.getByText('Old Fundraiser')).toBeInTheDocument();
    expect(screen.queryByText('Old Gym Night')).not.toBeInTheDocument();
  });
});
