import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateCache,
  readDb,
  subscribeToExternalChanges,
  takeReadWarnings,
  writeDb,
} from './db';
import { emptySnapshot } from '../migrate';

const KEY = 'dragonboat:db:v1';

const snapshotWith = (memberIds: string[]) => ({
  ...emptySnapshot(),
  members: memberIds.map((id) => ({ id, firstName: id })),
});

/** What the browser fires in *this* tab when another tab writes. */
const otherTabWrote = (value: string) => {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: value }));
};

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
  takeReadWarnings();
});

describe('cross-tab consistency', () => {
  it('re-reads storage after another tab writes', () => {
    writeDb(snapshotWith(['a']) as never);
    expect(readDb().members).toHaveLength(1);

    otherTabWrote(JSON.stringify(snapshotWith(['a', 'b', 'c'])));

    // Before the storage listener this returned the cached one-member
    // snapshot, and the next write here would have erased b and c.
    expect(readDb().members).toHaveLength(3);
  });

  it('tells subscribers so the screens can reload', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToExternalChanges(listener);

    otherTabWrote(JSON.stringify(snapshotWith(['a'])));
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    otherTabWrote(JSON.stringify(snapshotWith(['a', 'b'])));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('ignores writes to unrelated storage keys', () => {
    const listener = vi.fn();
    subscribeToExternalChanges(listener);

    window.dispatchEvent(new StorageEvent('storage', { key: 'something:else' }));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('unreadable data', () => {
  it('sets the corrupt blob aside instead of overwriting it', () => {
    localStorage.setItem(KEY, '{ this is not json');
    invalidateCache();

    expect(readDb().members).toEqual([]);

    // The next write must not be the thing that destroys the only copy.
    writeDb(snapshotWith(['fresh']) as never);
    const quarantined = Object.keys(localStorage).filter((k) => k.includes(':unreadable:'));
    expect(quarantined).toHaveLength(1);
    expect(localStorage.getItem(quarantined[0])).toBe('{ this is not json');
  });

  it('warns the user rather than silently starting empty', () => {
    localStorage.setItem(KEY, '{ this is not json');
    invalidateCache();
    readDb();

    expect(takeReadWarnings()[0]).toMatch(/could not be read/i);
  });

  it('reports skipped rows from a partly damaged snapshot', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...emptySnapshot(), members: [{ id: 'm1' }, null, {}] }),
    );
    invalidateCache();

    expect(readDb().members).toHaveLength(1);
    expect(takeReadWarnings()).toEqual(['members: 2 unreadable row(s) skipped']);
  });
});

describe('failed writes', () => {
  it('leaves the cache matching disk when saving throws', () => {
    writeDb(snapshotWith(['a']) as never);

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeDb(snapshotWith(['a', 'b']) as never)).toThrow(/storage is full/);
    setItem.mockRestore();

    // Assigning the cache before the write would leave the UI showing a
    // member who was never saved, until the next reload dropped them.
    expect(readDb().members).toHaveLength(1);
  });
});
