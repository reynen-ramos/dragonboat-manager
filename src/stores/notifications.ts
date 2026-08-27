import { create } from 'zustand';

/**
 * Transient failure messages, shown as a stack of alerts.
 *
 * Writes in this app are mostly fire-and-forget — dragging a paddler, toggling
 * a pin, typing a race time — so a rejected mutation has nowhere of its own to
 * report. Without a shared surface those failures are invisible: the seat
 * simply does not move and nothing says why.
 */

export interface Notification {
  id: number;
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  notify: (message: string) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

/** Enough to show a burst without the stack growing without bound. */
const MAX_VISIBLE = 3;

export const useNotifications = create<NotificationState>((set) => ({
  notifications: [],

  notify: (message) =>
    set((state) => {
      // A failing bulk operation rejects once per row; showing the same
      // sentence five times tells the user nothing extra.
      if (state.notifications.some((n) => n.message === message)) return state;
      const next = [...state.notifications, { id: ++nextId, message }];
      return { notifications: next.slice(-MAX_VISIBLE) };
    }),

  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  clear: () => set({ notifications: [] }),
}));

/** Turns whatever a mutation rejected with into something worth reading. */
export function messageForError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong and your change was not saved.';
}
