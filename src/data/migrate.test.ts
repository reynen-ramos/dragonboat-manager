import { describe, expect, it } from 'vitest';
import { CURRENT_VERSION, migrateSnapshot, UnreadableSnapshotError } from './migrate';

const good = {
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  members: [{ id: 'm1', firstName: 'Ana' }],
  events: [],
  categories: [],
  crews: [],
  assignments: [],
  availability: [],
  raceEntries: [],
};

describe('migrateSnapshot', () => {
  it('reads a current snapshot unchanged', () => {
    const { snapshot, dropped } = migrateSnapshot(good);

    expect(dropped).toEqual([]);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.exportedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refuses a snapshot from a newer version rather than guessing', () => {
    // The bug this closes: `version` was written from the first release and
    // read by nothing, so a v1 build loaded a v2 database blindly.
    expect(() => migrateSnapshot({ ...good, version: CURRENT_VERSION + 1 })).toThrow(
      UnreadableSnapshotError,
    );
  });

  it('refuses input that is not an object at all', () => {
    for (const bad of [null, 'text', 42, []]) {
      expect(() => migrateSnapshot(bad)).toThrow(UnreadableSnapshotError);
    }
  });

  it('backfills a collection added since the snapshot was written', () => {
    const { version, ...withoutRaceEntries } = { ...good };
    delete (withoutRaceEntries as Record<string, unknown>).raceEntries;

    const { snapshot, dropped } = migrateSnapshot({ ...withoutRaceEntries, version });

    expect(snapshot.raceEntries).toEqual([]);
    expect(dropped).toEqual([]);
  });

  it('skips unusable rows and says how many', () => {
    const { snapshot, dropped } = migrateSnapshot({
      ...good,
      members: [{ id: 'm1' }, null, { noId: true }, 'nonsense', { id: '' }],
    });

    expect(snapshot.members).toHaveLength(1);
    expect(dropped).toEqual(['members: 4 unreadable row(s) skipped']);
  });

  it('reports a collection that is not a list instead of crashing', () => {
    const { snapshot, dropped } = migrateSnapshot({ ...good, crews: { nope: true } });

    expect(snapshot.crews).toEqual([]);
    expect(dropped).toEqual(['crews: not a list, ignored']);
  });

  it('fills in settings that a partial backup omitted', () => {
    const { snapshot } = migrateSnapshot({ ...good, settings: { sideBalanceTolerance: 0.09 } });

    expect(snapshot.settings.sideBalanceTolerance).toBe(0.09);
    expect(snapshot.settings.minWomenMixed).toBeDefined();
  });

  it('stamps the snapshot with the version this build writes', () => {
    expect(migrateSnapshot(good).snapshot.version).toBe(CURRENT_VERSION);
  });
});
