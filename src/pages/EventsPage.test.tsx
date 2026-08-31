import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

describe('EventsPage', () => {
  it('lists races and one-offs by month — trainings live in their own section', async () => {
    await seed({ name: 'Spring Regatta', startDate: shift(-20) });
    await seed({ name: 'Old Water Session', startDate: shift(-18), type: 'practice' });
    await seed({ name: 'Next Water Session', startDate: shift(3), type: 'practice' });
    await seed({ name: 'Nationals Ahead', startDate: shift(10) });

    renderPage();

    expect(await screen.findByText('Spring Regatta')).toBeInTheDocument();
    expect(screen.getByText('Nationals Ahead')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: monthLabel(monthOf(shift(-20))) }),
    ).toBeInTheDocument();

    // No trainings anywhere — not upcoming, not past, not behind a toggle.
    expect(screen.queryByText('Old Water Session')).not.toBeInTheDocument();
    expect(screen.queryByText('Next Water Session')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show .* training/ })).not.toBeInTheDocument();
  });

  it('excludes custom practice-base types by behaviour, keeping other one-offs', async () => {
    await mockAdapter.settings.save({
      ...(await mockAdapter.settings.get()),
      eventTypes: [
        { id: 'race', label: 'Race / regatta', base: 'race' },
        { id: 'gym', label: 'Gym Session', base: 'practice' },
        { id: 'other', label: 'Other', base: 'other' },
      ],
    });
    await seed({ name: 'Old Gym Night', startDate: shift(-15), type: 'gym' });
    await seed({ name: 'Old Fundraiser', startDate: shift(-15), type: 'other' });
    await seed({ name: 'Spring Regatta', startDate: shift(-40) });

    renderPage();

    expect(await screen.findByText('Old Fundraiser')).toBeInTheDocument();
    expect(screen.getByText('Spring Regatta')).toBeInTheDocument();
    expect(screen.queryByText('Old Gym Night')).not.toBeInTheDocument();
  });
});
