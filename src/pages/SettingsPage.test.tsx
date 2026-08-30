import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import { mockAdapter } from '@/data/mock/index';
import { BUILTIN_EVENT_TYPES, BUILTIN_TRAINING_KINDS } from '@/domain/eventTypes';
import { DEFAULT_CLUB_SETTINGS } from '@/domain/rules.config';
import { SettingsPage } from './SettingsPage';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

const renderSettings = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
};

describe('SettingsPage event types', () => {
  it('adds a custom event type with its declared behaviour', async () => {
    renderSettings();
    await screen.findByText('Event types');

    await userEvent.type(screen.getByLabelText('New event type name'), 'Time trial');
    await userEvent.selectOptions(screen.getByLabelText('New event type behaviour'), 'race');
    await userEvent.click(screen.getByRole('button', { name: /Add event type/ }));

    await waitFor(async () => {
      const settings = await mockAdapter.settings.get();
      expect(settings.eventTypes).toContainEqual({
        id: 'time-trial',
        label: 'Time trial',
        base: 'race',
      });
    });
  });

  it('renames a built-in without touching its id or behaviour', async () => {
    renderSettings();
    await screen.findByText('Event types');

    const input = screen.getByLabelText('Rename Race / regatta');
    await userEvent.clear(input);
    await userEvent.type(input, 'Regatta');
    await userEvent.tab();

    await waitFor(async () => {
      const settings = await mockAdapter.settings.get();
      expect(settings.eventTypes).toContainEqual({ id: 'race', label: 'Regatta', base: 'race' });
    });
  });

  it('re-bases and deletes the defaults like any other type', async () => {
    renderSettings();
    await screen.findByText('Event types');

    // The seeded 'Other' is no more protected than a custom type.
    await userEvent.selectOptions(screen.getByLabelText('Behaviour of Other'), 'race');
    await waitFor(async () => {
      const settings = await mockAdapter.settings.get();
      expect(settings.eventTypes).toContainEqual({ id: 'other', label: 'Other', base: 'race' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Practice' }));
    await waitFor(async () => {
      const settings = await mockAdapter.settings.get();
      expect(settings.eventTypes.map((t) => t.id)).not.toContain('practice');
    });
  });

  it('never deletes the last remaining type', async () => {
    await mockAdapter.settings.save({
      ...DEFAULT_CLUB_SETTINGS,
      eventTypes: [{ id: 'race', label: 'Race / regatta', base: 'race' }],
    });
    renderSettings();
    await screen.findByText('Event types');

    expect(screen.getByRole('button', { name: 'Delete Race / regatta' })).toBeDisabled();
  });

  it('refuses to delete a type or kind that events still wear', async () => {
    await mockAdapter.settings.save({
      ...DEFAULT_CLUB_SETTINGS,
      eventTypes: [...BUILTIN_EVENT_TYPES, { id: 'social', label: 'Social', base: 'other' }],
    });
    await mockAdapter.events.create({
      name: 'Quiz night',
      startDate: '2026-09-01',
      type: 'social',
      trainingKind: undefined,
    });
    await mockAdapter.events.create({
      name: 'Paddle',
      startDate: '2026-09-02',
      type: 'practice',
      trainingKind: 'water',
    });

    renderSettings();
    // The usage counts arrive with the events query; assert only once the
    // "1 event" labels are on screen, or the buttons are momentarily enabled.
    // Three rows wear one event each: Social, the built-in Practice, and the
    // water training kind.
    await waitFor(() => expect(screen.getAllByText('1 event')).toHaveLength(3));

    expect(screen.getByRole('button', { name: 'Delete Social' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Practice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Water training' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Land training' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete Race / regatta' })).toBeEnabled();
  });

  it('deletes an unused training kind', async () => {
    renderSettings();
    await screen.findByText('Training kinds');

    await userEvent.click(screen.getByRole('button', { name: 'Delete Land training' }));

    await waitFor(async () => {
      const settings = await mockAdapter.settings.get();
      expect(settings.trainingKinds.map((k) => k.id)).toEqual(
        BUILTIN_TRAINING_KINDS.map((k) => k.id).filter((id) => id !== 'land'),
      );
    });
  });
});
