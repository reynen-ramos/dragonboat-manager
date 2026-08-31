import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { addDays, dayOfWeek } from '@/domain/calendar';
import { todayIso } from '@/domain/dates';
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

describe('EventForm weekly series', () => {
  it('creates the series on the chosen day, skipping dates already scheduled', async () => {
    const today = todayIso();
    // One session of the series already exists a week in — it must be skipped.
    await mockAdapter.events.create({
      name: 'Water Training',
      startDate: addDays(today, 7),
      type: 'practice',
    });

    renderForm();
    await userEvent.type(screen.getByLabelText('Name'), 'Water Training');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'practice');
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), 'weekly');

    // Defaults: today's weekday, until today + 8 weeks → 9 dates, 1 taken.
    expect(await screen.findByText(/1 date already scheduled — skipped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create 8 sessions' }));

    await waitFor(async () => {
      const series = (await mockAdapter.events.list()).filter((e) => e.name === 'Water Training');
      expect(series).toHaveLength(9); // 8 new + the pre-existing one
      expect(new Set(series.map((e) => e.startDate)).size).toBe(9); // no doubled dates
      expect(series.every((e) => dayOfWeek(e.startDate) === dayOfWeek(today))).toBe(true);
      expect(series.every((e) => e.type === 'practice' && e.endDate === undefined)).toBe(true);
    });
  });

  it('adding a weekday grows the series', async () => {
    const today = todayIso();
    renderForm();
    await userEvent.type(screen.getByLabelText('Name'), 'Water Training');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'practice');
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), 'weekly');
    await screen.findByRole('button', { name: 'Create 9 sessions' });

    const tomorrowName = new Date(`${addDays(today, 1)}T00:00:00Z`).toLocaleDateString(undefined, {
      weekday: 'long',
      timeZone: 'UTC',
    });
    await userEvent.click(screen.getByRole('button', { name: tomorrowName }));

    // Tomorrow's weekday recurs 8 times inside [today, today+56].
    expect(screen.getByRole('button', { name: 'Create 17 sessions' })).toBeInTheDocument();
  });

  it('refuses a series with no weekday picked', async () => {
    const today = todayIso();
    renderForm();
    await userEvent.type(screen.getByLabelText('Name'), 'Water Training');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'practice');
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), 'weekly');

    const todayName = new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, {
      weekday: 'long',
      timeZone: 'UTC',
    });
    await userEvent.click(screen.getByRole('button', { name: todayName })); // untick the default
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Pick at least one weekday.')).toBeInTheDocument();
    expect(await mockAdapter.events.list()).toHaveLength(0);
  });
});

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
