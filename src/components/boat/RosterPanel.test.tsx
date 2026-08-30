import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeMember } from '@/domain/testing';
import type { AvailabilityStatus } from '@/domain/types';
import { RosterPanel } from './RosterPanel';

const ana = makeMember({ id: 'in-1', firstName: 'Ana', lastName: 'Reyes' });
const ben = makeMember({ id: 'maybe-1', firstName: 'Ben', lastName: 'Cruz' });
const carl = makeMember({ id: 'unsigned-1', firstName: 'Carl', lastName: 'Diaz' });
const dana = makeMember({ id: 'out-1', firstName: 'Dana', lastName: 'Enriquez' });

const signups = new Map<string, AvailabilityStatus>([
  [ana.id, 'in'],
  [ben.id, 'maybe'],
  [dana.id, 'out'],
]);

const renderPanel = (over: Partial<Parameters<typeof RosterPanel>[0]> = {}) =>
  render(
    <DndContext>
      <RosterPanel
        members={[ana, ben, carl, dana]}
        inCrewMemberIds={new Set()}
        availability={signups}
        doubleBookedIds={new Set()}
        onSelectMember={vi.fn()}
        {...over}
      />
    </DndContext>,
  );

// The drag handle's label is the one stable, per-member accessible name.
const card = (name: string) => screen.queryByRole('button', { name: `Drag ${name}` });

describe('RosterPanel opt-in pool', () => {
  it('offers only the signed-up by default, with Maybe flagged', () => {
    renderPanel();

    expect(card('Ana Reyes')).toBeInTheDocument();
    expect(card('Ben Cruz')).toBeInTheDocument();
    expect(card('Carl Diaz')).not.toBeInTheDocument();
    expect(card('Dana Enriquez')).not.toBeInTheDocument();
    expect(screen.getByText('maybe')).toBeInTheDocument();
  });

  it('names how many the toggle is hiding', () => {
    renderPanel();

    expect(
      screen.getByLabelText('Show everyone (2 not signed up or out)'),
    ).not.toBeChecked();
  });

  it('reveals the unsigned and the declined when toggled, each flagged', async () => {
    renderPanel();

    await userEvent.click(screen.getByLabelText(/Show everyone/));

    expect(card('Carl Diaz')).toBeInTheDocument();
    expect(card('Dana Enriquez')).toBeInTheDocument();
    expect(screen.getByText('not signed up')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });

  it('points at the sign-up sheet when nobody has signed up at all', () => {
    renderPanel({ availability: new Map() });

    expect(
      screen.getByText(/Nobody has signed up for this event yet/),
    ).toBeInTheDocument();
  });

  it('says so when everyone signed up is already seated', () => {
    renderPanel({ inCrewMemberIds: new Set([ana.id, ben.id]) });

    expect(screen.getByText('Everyone signed up is already in this crew.')).toBeInTheDocument();
  });
});
