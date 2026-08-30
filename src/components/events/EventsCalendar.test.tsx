import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { EventsCalendar } from './EventsCalendar';

// The component anchors itself to the real "today", so the clock is frozen to
// a known mid-month date. Only Date is faked — real timers keep userEvent sane.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-15T12:00:00') });
});
afterEach(() => {
  vi.useRealTimers();
});

const events: ClubEvent[] = [
  {
    id: 'regatta',
    name: 'Summer Regatta',
    startDate: '2026-09-15',
    endDate: '2026-09-16',
    type: 'race',
  },
  { id: 'training', name: 'Tuesday Training', startDate: '2026-09-22', type: 'practice' },
  { id: 'social', name: 'Clubhouse Fundraiser', startDate: '2026-09-05', type: 'other' },
  { id: 'next-month', name: 'October Cup', startDate: '2026-10-10', type: 'race' },
];

const renderCalendar = (onPickDay?: (iso: string) => void) =>
  render(
    <MemoryRouter>
      <EventsCalendar events={events} onPickDay={onPickDay} />
    </MemoryRouter>,
  );

describe('EventsCalendar', () => {
  it('puts a two-day regatta on both of its squares', () => {
    renderCalendar();

    expect(screen.getAllByRole('link', { name: 'Summer Regatta' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Tuesday Training' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Clubhouse Fundraiser' })).toHaveLength(1);
  });

  it('shows only the month on screen, and navigates to the next', async () => {
    renderCalendar();

    expect(screen.queryByRole('link', { name: 'October Cup' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('link', { name: 'October Cup' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clubhouse Fundraiser' })).not.toBeInTheDocument();
  });

  it('returns to the current month with the Today button', async () => {
    renderCalendar();

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.queryByRole('link', { name: 'Summer Regatta' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getAllByRole('link', { name: 'Summer Regatta' })).toHaveLength(2);
  });

  it('offers each day as a pre-dated new event', async () => {
    const onPickDay = vi.fn();
    renderCalendar(onPickDay);

    await userEvent.click(
      screen.getByRole('button', { name: `New event on ${formatDate('2026-09-03')}` }),
    );

    expect(onPickDay).toHaveBeenCalledExactlyOnceWith('2026-09-03');
  });

  it('renders plain day numbers when day-picking is not offered', () => {
    renderCalendar();

    expect(screen.queryByRole('button', { name: /New event on/ })).not.toBeInTheDocument();
  });
});
