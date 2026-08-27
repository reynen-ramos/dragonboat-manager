import { create } from 'zustand';
import type { Assignment } from '@/domain/types';

/**
 * Undo/redo for seat changes.
 *
 * Seating is fiddly and mistakes are constant — a paddler dropped one seat off,
 * an auto-balance that shuffled more than expected. Snapshots of the crew's
 * assignments are cheap (at most 22 small rows) and restore exactly, so this is
 * a snapshot stack rather than an inverse-operation log.
 *
 * The history is scoped to one crew and cleared on navigation, so an undo can
 * never reach back into a crew that is no longer on screen.
 */

const MAX_DEPTH = 50;

interface LineupHistoryState {
  crewId?: string;
  past: Assignment[][];
  future: Assignment[][];
  /** Starts (or restarts) history for a crew. */
  begin: (crewId: string) => void;
  /** Records the state *before* a change is applied. */
  record: (crewId: string, snapshot: Assignment[]) => void;
  /** Returns the snapshot to restore, moving `current` onto the redo stack. */
  undo: (current: Assignment[]) => Assignment[] | undefined;
  redo: (current: Assignment[]) => Assignment[] | undefined;
  clear: () => void;
}

export const useLineupHistory = create<LineupHistoryState>((set, get) => ({
  crewId: undefined,
  past: [],
  future: [],

  begin: (crewId) => {
    if (get().crewId === crewId) return;
    set({ crewId, past: [], future: [] });
  },

  record: (crewId, snapshot) =>
    set((state) => ({
      crewId,
      // Any new edit invalidates the redo branch, as in every editor.
      future: [],
      // A record for a different crew must not extend the previous crew's
      // stack — undo would then write that crew's lineup into this one. The
      // page's mount effect makes that unreachable today, but the invariant
      // belongs to the store, not to its caller's cleanup ordering.
      past: [...(state.crewId === crewId ? state.past : []), snapshot].slice(-MAX_DEPTH),
    })),

  undo: (current) => {
    const { past, future } = get();
    const previous = past.at(-1);
    if (!previous) return undefined;
    set({ past: past.slice(0, -1), future: [...future, current] });
    return previous;
  },

  redo: (current) => {
    const { past, future } = get();
    const next = future.at(-1);
    if (!next) return undefined;
    set({ past: [...past, current], future: future.slice(0, -1) });
    return next;
  },

  clear: () => set({ crewId: undefined, past: [], future: [] }),
}));
