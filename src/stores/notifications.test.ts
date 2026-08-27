import { beforeEach, describe, expect, it } from 'vitest';
import { messageForError, useNotifications } from './notifications';

const state = () => useNotifications.getState();

beforeEach(() => state().clear());

describe('notifications', () => {
  it('keeps a failure until it is dismissed', () => {
    state().notify('Could not save.');
    expect(state().notifications.map((n) => n.message)).toEqual(['Could not save.']);

    state().dismiss(state().notifications[0].id);
    expect(state().notifications).toEqual([]);
  });

  it('does not repeat one message', () => {
    // A failing bulk re-seat rejects once per row; the same sentence five
    // times tells the user nothing the first one did not.
    state().notify('Could not save.');
    state().notify('Could not save.');
    state().notify('Could not save.');

    expect(state().notifications).toHaveLength(1);
  });

  it('keeps only the most recent few', () => {
    for (const m of ['one', 'two', 'three', 'four']) state().notify(m);

    expect(state().notifications.map((n) => n.message)).toEqual(['two', 'three', 'four']);
  });
});

describe('messageForError', () => {
  it('uses the thrown message, which names the real cause', () => {
    // writeDb throws this exact sentence when the quota is exhausted.
    const error = new Error('Could not save — browser storage is full or unavailable.');
    expect(messageForError(error)).toBe('Could not save — browser storage is full or unavailable.');
  });

  it('falls back to something readable for a non-Error', () => {
    expect(messageForError('boom')).toMatch(/was not saved/);
    expect(messageForError(new Error(''))).toMatch(/was not saved/);
  });
});
