import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { EventForm } from './EventForm';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const renderForm = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventForm open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
};

describe('EventForm training kind', () => {
  it('offers the kind only for practices, and stores the choice', async () => {
    renderForm();

    expect(screen.queryByLabelText('Training kind')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'Evening Paddle');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'practice');
    await userEvent.selectOptions(screen.getByLabelText('Training kind'), 'land');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const [event] = await mockAdapter.events.list();
      expect(event).toMatchObject({ name: 'Evening Paddle', type: 'practice', trainingKind: 'land' });
    });
  });

  it('offers custom types from settings, with kinds following the declared behaviour', async () => {
    const { DEFAULT_CLUB_SETTINGS } = await import('@/domain/rules.config');
    await mockAdapter.settings.save({
      ...DEFAULT_CLUB_SETTINGS,
      eventTypes: [
        ...DEFAULT_CLUB_SETTINGS.eventTypes,
        { id: 'gym-session', label: 'Gym Session', base: 'practice' },
      ],
    });
    renderForm();

    await userEvent.type(await screen.findByLabelText('Name'), 'Tuesday Gym');
    // A custom practice-base type gets the training-kind select too.
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'gym-session');
    await userEvent.selectOptions(screen.getByLabelText('Training kind'), 'supplementary');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const [event] = await mockAdapter.events.list();
      expect(event).toMatchObject({ type: 'gym-session', trainingKind: 'supplementary' });
    });
  });

  it('drops a stale kind when the type is switched away from practice', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Not A Practice After All');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'practice');
    await userEvent.selectOptions(screen.getByLabelText('Training kind'), 'water');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'race');

    expect(screen.queryByLabelText('Training kind')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const [event] = await mockAdapter.events.list();
      expect(event.type).toBe('race');
      expect(event.trainingKind).toBeUndefined();
    });
  });
});
