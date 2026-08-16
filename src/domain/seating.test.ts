import { describe, expect, it } from 'vitest';
import { applyChanges, planDrop } from './seating';
import type { Assignment } from './types';

const CREW = 'crew-1';

const seated = (id: string, memberId: string, row: number, side: 'left' | 'right'): Assignment => ({
  id,
  crewId: CREW,
  memberId,
  role: 'paddler',
  seat: { row, side },
});

const drop = (assignments: Assignment[], source: Parameters<typeof planDrop>[2], target: Parameters<typeof planDrop>[3]) =>
  applyChanges(assignments, planDrop(CREW, assignments, source, target));

describe('seating a paddler from the roster', () => {
  it('creates an assignment on an empty seat', () => {
    const after = drop([], { memberId: 'm1' }, { kind: 'seat', seat: { row: 3, side: 'left' } });

    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      memberId: 'm1',
      role: 'paddler',
      seat: { row: 3, side: 'left' },
    });
  });

  it('displaces the occupant to the reserves rather than dropping them', () => {
    const after = drop(
      [seated('a1', 'm1', 3, 'left')],
      { memberId: 'm2' },
      { kind: 'seat', seat: { row: 3, side: 'left' } },
    );

    expect(after.find((a) => a.memberId === 'm2')).toMatchObject({
      role: 'paddler',
      seat: { row: 3, side: 'left' },
    });
    expect(after.find((a) => a.memberId === 'm1')).toMatchObject({
      role: 'reserve',
      seat: undefined,
    });
  });

  it('moves a reserve into a seat instead of adding them twice', () => {
    const reserve: Assignment = { id: 'a1', crewId: CREW, memberId: 'm1', role: 'reserve' };
    const after = drop([reserve], { memberId: 'm1' }, { kind: 'seat', seat: { row: 2, side: 'right' } });

    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: 'a1', role: 'paddler', seat: { row: 2, side: 'right' } });
  });
});

describe('moving a paddler already in the boat', () => {
  it('moves to an empty seat', () => {
    const after = drop(
      [seated('a1', 'm1', 1, 'left')],
      { memberId: 'm1', assignmentId: 'a1' },
      { kind: 'seat', seat: { row: 6, side: 'right' } },
    );

    expect(after[0].seat).toEqual({ row: 6, side: 'right' });
  });

  it('swaps two seated paddlers', () => {
    const after = drop(
      [seated('a1', 'm1', 1, 'left'), seated('a2', 'm2', 5, 'right')],
      { memberId: 'm1', assignmentId: 'a1' },
      { kind: 'seat', seat: { row: 5, side: 'right' } },
    );

    expect(after.find((a) => a.id === 'a1')?.seat).toEqual({ row: 5, side: 'right' });
    expect(after.find((a) => a.id === 'a2')?.seat).toEqual({ row: 1, side: 'left' });
    expect(after.every((a) => a.role === 'paddler')).toBe(true);
  });

  it('does nothing when dropped back on its own seat', () => {
    const assignments = [seated('a1', 'm1', 1, 'left')];
    expect(
      planDrop(CREW, assignments, { memberId: 'm1', assignmentId: 'a1' }, {
        kind: 'seat',
        seat: { row: 1, side: 'left' },
      }),
    ).toEqual([]);
  });

  it('clears the seat when moved to the reserves', () => {
    const after = drop(
      [seated('a1', 'm1', 4, 'left')],
      { memberId: 'm1', assignmentId: 'a1' },
      { kind: 'role', role: 'reserve' },
    );

    expect(after[0]).toMatchObject({ role: 'reserve', seat: undefined });
  });

  it('drops the pin when a pinned paddler leaves their seat', () => {
    const pinned: Assignment = { ...seated('a1', 'm1', 4, 'left'), pinned: true };
    const after = drop([pinned], { memberId: 'm1', assignmentId: 'a1' }, { kind: 'role', role: 'cox' });

    expect(after[0]).toMatchObject({ role: 'cox', pinned: undefined });
  });

  it('removes the paddler from the crew when dragged out', () => {
    const after = drop(
      [seated('a1', 'm1', 4, 'left')],
      { memberId: 'm1', assignmentId: 'a1' },
      { kind: 'remove' },
    );

    expect(after).toEqual([]);
  });
});

describe('drummer and cox slots', () => {
  it('moves the previous drummer to the reserves', () => {
    const existing: Assignment = { id: 'a1', crewId: CREW, memberId: 'm1', role: 'drummer' };
    const after = drop([existing], { memberId: 'm2' }, { kind: 'role', role: 'drummer' });

    expect(after.find((a) => a.memberId === 'm1')?.role).toBe('reserve');
    expect(after.find((a) => a.memberId === 'm2')?.role).toBe('drummer');
    expect(after.filter((a) => a.role === 'drummer')).toHaveLength(1);
  });

  it('leaves the crew unchanged when the drummer is dropped on their own slot', () => {
    const existing: Assignment = { id: 'a1', crewId: CREW, memberId: 'm1', role: 'drummer' };
    const after = drop([existing], { memberId: 'm1', assignmentId: 'a1' }, { kind: 'role', role: 'drummer' });

    expect(after).toHaveLength(1);
    expect(after[0].role).toBe('drummer');
  });

  it('empties the seat when a seated paddler becomes the cox', () => {
    const after = drop(
      [seated('a1', 'm1', 2, 'left')],
      { memberId: 'm1', assignmentId: 'a1' },
      { kind: 'role', role: 'cox' },
    );

    expect(after[0]).toMatchObject({ role: 'cox', seat: undefined });
  });

  it('allows any number of reserves', () => {
    let assignments: Assignment[] = [];
    for (const memberId of ['m1', 'm2', 'm3']) {
      assignments = drop(assignments, { memberId }, { kind: 'role', role: 'reserve' });
    }
    expect(assignments.filter((a) => a.role === 'reserve')).toHaveLength(3);
  });
});
