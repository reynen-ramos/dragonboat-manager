import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChangeFanout, TABLE_TO_COLLECTION } from './realtime';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('makeChangeFanout', () => {
  it('collapses a burst of row events into one invalidation per collection', () => {
    const emit = vi.fn();
    const fanout = makeChangeFanout(emit, 200);

    // A 20-seat fill: twenty WAL events in quick succession.
    for (let i = 0; i < 20; i++) fanout.onTableChange('assignments');
    expect(emit).not.toHaveBeenCalled(); // trailing edge, nothing yet

    vi.advanceTimersByTime(250);
    expect(emit).toHaveBeenCalledExactlyOnceWith('assignments');
  });

  it('debounces collections independently and maps table names', () => {
    const emit = vi.fn();
    const fanout = makeChangeFanout(emit, 200);

    fanout.onTableChange('race_entries');
    fanout.onTableChange('availability');
    vi.advanceTimersByTime(250);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith('raceEntries'); // snake table → key root
    expect(emit).toHaveBeenCalledWith('availability');
  });

  it('emits undefined for an unmapped table, and dispose cancels pending work', () => {
    const emit = vi.fn();
    const fanout = makeChangeFanout(emit, 200);

    fanout.onTableChange('clubs');
    vi.advanceTimersByTime(250);
    expect(emit).toHaveBeenCalledExactlyOnceWith(undefined);

    fanout.onTableChange('members');
    fanout.dispose();
    vi.advanceTimersByTime(1000);
    expect(emit).toHaveBeenCalledTimes(1); // nothing after dispose
  });

  it('covers every replicated table', () => {
    // The 0003 migration adds exactly these to the publication; a table
    // added there but not here would invalidate the whole cache per event.
    for (const table of [
      'members', 'events', 'categories', 'crews', 'assignments', 'race_entries',
      'availability', 'time_trial_sessions', 'time_trial_results', 'club_settings',
    ]) {
      expect(TABLE_TO_COLLECTION[table], table).toBeDefined();
    }
  });
});
