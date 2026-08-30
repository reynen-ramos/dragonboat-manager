import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import type { Member } from '@/domain/types';
import { MembersPage } from './MembersPage';

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

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('MembersPage gender', () => {
  it('marks each row with the member’s gender', async () => {
    await seedMember({ firstName: 'Ana', lastName: 'Reyes', gender: 'female' });
    await seedMember({ firstName: 'Alex', lastName: 'Quinto', gender: 'other' });
    renderPage();

    const ana = within((await screen.findByText('Ana Reyes')).closest('li')!);
    expect(ana.getByText('F')).toBeInTheDocument();
    const alex = within((await screen.findByText('Alex Quinto')).closest('li')!);
    expect(alex.getByText('O')).toBeInTheDocument();
  });

  it('filters the list by gender', async () => {
    await seedMember({ firstName: 'Ana', lastName: 'Reyes', gender: 'female' });
    await seedMember({ firstName: 'Ben', lastName: 'Cruz', gender: 'male' });
    renderPage();
    await screen.findByText('Ana Reyes');

    await userEvent.selectOptions(screen.getByLabelText('Filter by gender'), 'male');

    expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Reyes')).not.toBeInTheDocument();
  });
});
