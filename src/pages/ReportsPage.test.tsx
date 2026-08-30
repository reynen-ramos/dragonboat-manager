import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { todayIso } from '@/domain/dates';
import { ReportsPage } from './ReportsPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const shift = (days: number): string => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** A past training: Ana signed in and was seated, Ben signed in and was not. */
const seed = async () => {
  const ana = await mockAdapter.members.create({
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    canDrum: false,
    canSteer: false,
    status: 'active',
  });
  const ben = await mockAdapter.members.create({
    firstName: 'Ben',
    lastName: 'Cruz',
    gender: 'male',
    sidePreference: 'right',
    canDrum: false,
    canSteer: false,
    status: 'active',
  });
  const event = await mockAdapter.events.create({
    name: 'Tuesday Paddle',
    startDate: shift(-7),
    type: 'practice',
  });
  const category = await mockAdapter.categories.create({
    eventId: event.id,
    boatSize: 10,
    genderClass: 'open',
  });
  const crew = await mockAdapter.crews.create({ categoryId: category.id, name: 'A Crew' });
  await mockAdapter.assignments.create({
    crewId: crew.id,
    memberId: ana.id,
    role: 'paddler',
    seat: { row: 1, side: 'left' },
  });
  await mockAdapter.availability.setMany([
    { eventId: event.id, memberId: ana.id, status: 'in', updatedAt: 'x' },
    { eventId: event.id, memberId: ben.id, status: 'in', updatedAt: 'x' },
  ]);
};

const renderPage = (url = '/reports') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ReportsPage', () => {
  it('opens on attendance with a row per member', async () => {
    await seed();
    renderPage();

    expect(await screen.findByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    expect(screen.getByText('1 training')).toBeInTheDocument();
  });

  it('switches to the bench report and shows who was left ashore', async () => {
    await seed();
    renderPage();
    await screen.findByText('Ana Reyes');

    await userEvent.click(screen.getByRole('radio', { name: 'Bench' }));

    // Ben signed in and was never seated; Ana was seated so she has no row.
    expect(await screen.findByText('Ben Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Reyes')).not.toBeInTheDocument();
    expect(screen.getByText(/1 other member signed in/)).toBeInTheDocument();
  });

  it('deep-links straight to a report via the query string', async () => {
    await seed();
    renderPage('/reports?report=composition');

    expect(await screen.findByText('Age band')).toBeInTheDocument();
    expect(screen.getByText('Paddling side')).toBeInTheDocument();
  });
});
