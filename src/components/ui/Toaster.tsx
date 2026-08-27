import { AlertTriangle, X } from 'lucide-react';
import { useNotifications } from '@/stores/notifications';

/**
 * The app's failure surface.
 *
 * Deliberately not auto-dismissing: every message here means an edit was lost,
 * and this app is used on a dock where the screen is not being watched closely.
 *
 * The container is mounted permanently and each message carries its own
 * `role="alert"`. Returning null while empty meant the live region appeared
 * *with* its first message already inside — content present at insertion is
 * exactly what screen readers routinely decline to announce.
 */
export function Toaster() {
  const notifications = useNotifications((s) => s.notifications);
  const dismiss = useNotifications((s) => s.dismiss);

  return (
    <div
      // The overlay is always present, so it must not swallow taps meant for
      // the page underneath it; only the toasts themselves are interactive.
      className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto flex w-full
        max-w-md flex-col gap-2 px-4 sm:bottom-6"
    >
      {notifications.map(({ id, message }) => (
        <div
          key={id}
          role="alert"
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-red-300
            bg-red-50 p-3 text-sm text-red-900 shadow-lg dark:border-red-800 dark:bg-red-950
            dark:text-red-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{message}</p>
          <button
            type="button"
            onClick={() => dismiss(id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-red-200 dark:hover:bg-red-900"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
