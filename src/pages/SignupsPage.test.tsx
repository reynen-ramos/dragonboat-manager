import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { ageOn, todayIso } from '@/domain/dates';
import type { Member } from '@/domain/types';
import { SignupsPage } from './SignupsPage';

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

const seedAll = async () => {
  const event = await mockAdapter.events.create({
    name: 'Test Regatta',
    startDate: '2026-09-01',
    type: 'race',
  });
  await seedMember({
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    weightKg: 58,
    dateOfBirth: '1996-01-01',
  });
  await seedMember({
    firstName: 'Ben',
    lastName: 'Cruz',
    gender: 'male',
    sidePreference: 'right',
    weightKg: 85,
  });
  await seedMember({ firstName: 'Alex', lastName: 'Quinto', gender: 'other' });
  return event;
};

const renderPage = (eventId: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/events/${eventId}/signups`]}>
        <Routes>
          <Route path="/events/:eventId/signups" element={<SignupsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const rowOf = async (name: string) =>
  (await screen.findByText(name)).closest('li')!;

const rowNames = () =>
  screen.getAllByRole('radiogroup').map((g) => g.getAttribute('aria-label'));

describe('SignupsPage filters and row details', () => {
  it('shows gender, weight, and age on each row', async () => {
    const event = await seedAll();
    renderPage(event.id);

    const ana = within(await rowOf('Ana Reyes'));
    expect(ana.getByText('F')).toBeInTheDocument();
    expect(ana.getByText('L')).toBeInTheDocument();
    const age = ageOn('1996-01-01', todayIso());
    expect(ana.getByText(`58kg · ${age}y`)).toBeInTheDocument();

    // No weight and no birth date leaves the stats column out, not "—".
    const alex = within(await rowOf('Alex Quinto'));
    expect(alex.getByText('O')).toBeInTheDocument();
    expect(alex.queryByText(/kg|—/)).not.toBeInTheDocument();
  });

  it('filters by gender and by side', async () => {
    const event = await seedAll();
    renderPage(event.id);
    await screen.findByText('Ana Reyes');

    await userEvent.selectOptions(screen.getByLabelText('Filter by gender'), 'female');
    expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.queryByText('Ben Cruz')).not.toBeInTheDocument();
    expect(screen.queryByText('Alex Quinto')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter by gender'), 'all');
    await userEvent.selectOptions(screen.getByLabelText('Filter by paddling side'), 'right');
    expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Reyes')).not.toBeInTheDocument();
  });

  it('sorts by weight, heaviest first', async () => {
    const event = await seedAll();
    renderPage(event.id);
    await screen.findByText('Ana Reyes');

    await userEvent.selectOptions(screen.getByLabelText('Sort members'), 'weight');

    expect(rowNames()).toEqual([
      'Sign-up for Ben Cruz',
      'Sign-up for Ana Reyes',
      'Sign-up for Alex Quinto',
    ]);
  });
});
