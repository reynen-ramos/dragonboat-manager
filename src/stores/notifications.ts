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
  /** Errors mean an edit was lost; info carries offers like Undo. */
  tone: 'error' | 'info';
  action?: { label: string; run: () => void };
}

export type NotifyInput =
  | string
  | { message: string; tone?: 'error' | 'info'; action?: Notification['action'] };

interface NotificationState {
  notifications: Notification[];
  notify: (input: NotifyInput) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useNotifications = create<NotificationState>((set) => ({
  notifications: [],

  notify: (input) =>
    set((state) => {
      const next: Omit<Notification, 'id'> =
        typeof input === 'string'
          ? { message: input, tone: 'error' }
          : { message: input.message, tone: input.tone ?? 'error', action: input.action };
      // A failing bulk operation rejects once per row; showing the same
      // sentence five times tells the user nothing extra. Distinct messages
      // are all kept — every one means an edit was lost, and a cap that
      // silently evicted the oldest contradicted the Toaster's promise not
      // to auto-dismiss. Dedup bounds the realistic worst case. Info offers
      // (Undo) are not deduped: two deletions are two offers.
      if (next.tone === 'error' && state.notifications.some((n) => n.message === next.message)) {
        return state;
      }
      return { notifications: [...state.notifications, { id: ++nextId, ...next }] };
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
