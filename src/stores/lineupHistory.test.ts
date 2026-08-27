import { beforeEach, describe, expect, it } from 'vitest';
import type { Assignment } from '@/domain/types';
import { useLineupHistory } from './lineupHistory';

const state = () => useLineupHistory.getState();

const snap = (id: string): Assignment[] => [
  { id, crewId: 'crew-1', memberId: `m-${id}`, role: 'paddler', seat: { row: 1, side: 'left' } },
];

beforeEach(() => state().clear());

describe('undo and redo', () => {
  it('round-trips a change', () => {
    state().begin('crew-1');
    state().record('crew-1', snap('before'));

    const restored = state().undo(snap('after'));
    expect(restored?.[0].id).toBe('before');

    const redone = state().redo(snap('before'));
    expect(redone?.[0].id).toBe('after');
  });

  it('has nothing to undo before anything was recorded', () => {
    state().begin('crew-1');
    expect(state().undo(snap('current'))).toBeUndefined();
  });

  it('a new edit invalidates the redo branch', () => {
    state().begin('crew-1');
    state().record('crew-1', snap('one'));
    state().undo(snap('two'));
    expect(state().future).toHaveLength(1);

    state().record('crew-1', snap('three'));
    expect(state().future).toHaveLength(0);
  });

  it('caps the stack depth', () => {
    state().begin('crew-1');
    for (let i = 0; i < 60; i++) state().record('crew-1', snap(`s${i}`));
    expect(state().past).toHaveLength(50);
  });
});

describe('crew scoping', () => {
  it('does not let one crew inherit another crew history', () => {
    // The page's unmount cleanup normally prevents this, but the invariant
    // belongs to the store: a record for crew B landing on crew A's stack
    // means the next undo writes A's lineup into B.
    state().begin('crew-A');
    state().record('crew-A', snap('a-lineup'));

    state().record('crew-B', snap('b-before'));
    const restored = state().undo(snap('b-now'));

    expect(restored?.[0].id).toBe('b-before');
    expect(state().past).toHaveLength(0);
  });

  it('begin() for the same crew keeps the existing history', () => {
    state().begin('crew-A');
    state().record('crew-A', snap('one'));
    state().begin('crew-A');
    expect(state().past).toHaveLength(1);
  });
});
