import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { DashboardPage } from './DashboardPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const shift = (days: number): string => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const seed = (over: Partial<ClubEvent> & Pick<ClubEvent, 'name' | 'type'>) =>
  mockAdapter.events.create({ startDate: shift(7), ...over });

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const section = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('section')!);

describe('DashboardPage upcoming split', () => {
  it('separates races from trainings, with the training kind on the row', async () => {
    await seed({ name: 'City Regatta', type: 'race' });
    await seed({ name: 'Evening Paddle', type: 'practice', trainingKind: 'water' });
    await seed({ name: 'Gym Circuit', type: 'practice', trainingKind: 'supplementary' });

    renderDashboard();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Upcoming races' })).toBeInTheDocument(),
    );

    expect(section('Upcoming races').getByText('City Regatta')).toBeInTheDocument();
    expect(section('Upcoming races').queryByText('Evening Paddle')).not.toBeInTheDocument();

    const trainings = section('Upcoming trainings');
    expect(trainings.getByText('Evening Paddle')).toBeInTheDocument();
    expect(trainings.getByText('Water training')).toBeInTheDocument();
    expect(trainings.getByText('Supplementary training')).toBeInTheDocument();
    expect(trainings.queryByText('City Regatta')).not.toBeInTheDocument();
  });

  it('omits a group with nothing in it, and hides past events entirely', async () => {
    await seed({ name: 'City Regatta', type: 'race' });
    await seed({ name: 'Last Month Paddle', type: 'practice', startDate: shift(-30) });

    renderDashboard();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Upcoming races' })).toBeInTheDocument(),
    );

    expect(screen.queryByRole('heading', { name: 'Upcoming trainings' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Other upcoming events' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Last Month Paddle')).not.toBeInTheDocument();
  });

  it('files events of type other under their own heading', async () => {
    await seed({ name: 'City Regatta', type: 'race' });
    await seed({ name: 'Clubhouse Quiz Night', type: 'other' });

    renderDashboard();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Other upcoming events' })).toBeInTheDocument(),
    );

    expect(section('Other upcoming events').getByText('Clubhouse Quiz Night')).toBeInTheDocument();
  });
});
