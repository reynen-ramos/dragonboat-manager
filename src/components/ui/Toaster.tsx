import { AlertTriangle, X } from 'lucide-react';
import { useNotifications } from '@/stores/notifications';

/**
 * The app's failure surface.
 *
 * Deliberately not auto-dismissing: every message here means an edit was lost,
 * and this app is used on a dock where the screen is not being watched closely.
 */
export function Toaster() {
  const notifications = useNotifications((s) => s.notifications);
  const dismiss = useNotifications((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="no-print fixed inset-x-0 bottom-20 z-50 mx-auto flex w-full max-w-md
        flex-col gap-2 px-4 sm:bottom-6"
    >
      {notifications.map(({ id, message }) => (
        <div
          key={id}
          className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3
            text-sm text-red-900 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
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
