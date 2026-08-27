import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeMember } from '@/domain/testing';
import type { PaddlerAssignment, SeatPosition } from '@/domain/types';
import { BoatView, type SeatedOccupant } from './BoatView';

const ana = makeMember({ id: 'm1', firstName: 'Ana', lastName: 'Reyes' });

const occupantAtRow1Left = (seat: SeatPosition): SeatedOccupant | undefined => {
  if (seat.row !== 1 || seat.side !== 'left') return undefined;
  const assignment: PaddlerAssignment = {
    id: 'a1',
    crewId: 'crew-1',
    memberId: ana.id,
    role: 'paddler',
    seat: { row: 1, side: 'left' },
  };
  return { assignment, member: ana, wrongSide: false, unavailable: false, doubleBooked: false };
};

const renderBoat = (props: Partial<Parameters<typeof BoatView>[0]> = {}) => {
  const onSeatTap = vi.fn();
  render(
    <DndContext>
      <BoatView boatSize={10} occupantAt={occupantAtRow1Left} onSeatTap={onSeatTap} {...props} />
    </DndContext>,
  );
  return { onSeatTap };
};

describe('BoatView tap-to-place', () => {
  it('offers no tap target on an occupied seat when nobody is selected', () => {
    renderBoat();

    expect(screen.queryByRole('button', { name: /swap with Ana Reyes/i })).not.toBeInTheDocument();
  });

  it('places onto an occupied seat once a paddler is selected', async () => {
    // The bug this covers: the prompt said "tap a seat to place X", but only
    // empty seats carried a handler, so tapping an occupied one did nothing.
    const { onSeatTap } = renderBoat({ selectedMemberId: 'm2' });

    await userEvent.click(screen.getByRole('button', { name: /swap with Ana Reyes/i }));

    expect(onSeatTap).toHaveBeenCalledExactlyOnceWith({ row: 1, side: 'left' });
  });

  it('still places onto an empty seat', async () => {
    const { onSeatTap } = renderBoat({ selectedMemberId: 'm2' });

    await userEvent.click(screen.getByRole('button', { name: /empty seat, row 1 right/i }));

    expect(onSeatTap).toHaveBeenCalledExactlyOnceWith({ row: 1, side: 'right' });
  });
});
