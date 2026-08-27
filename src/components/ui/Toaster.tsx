import { AlertTriangle, Undo2, X } from 'lucide-react';
import { useNotifications } from '@/stores/notifications';
import { cn } from '@/utils/cn';

/**
 * The app's notification surface.
 *
 * Deliberately not auto-dismissing: an error means an edit was lost, and an
 * info toast carries an offer (chiefly Undo) whose silent expiry would be
 * worse than its lingering — this app is used on a dock where the screen is
 * not being watched closely.
 *
 * The container is mounted permanently and each message carries its own
 * `role="alert"`/`role="status"`. Returning null while empty meant the live
 * region appeared *with* its first message already inside — content present
 * at insertion is exactly what screen readers routinely decline to announce.
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
      {notifications.map(({ id, message, tone, action }) => (
        <div
          key={id}
          role={tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-sm shadow-lg',
            tone === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
              : 'surface border-subtle',
          )}
        >
          {tone === 'error' && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <p className="min-w-0 flex-1">{message}</p>
          {action && (
            <button
              type="button"
              onClick={() => {
                action.run();
                dismiss(id);
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-semibold
                text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-900"
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(id)}
            aria-label="Dismiss"
            className={cn(
              'shrink-0 rounded p-0.5',
              tone === 'error'
                ? 'hover:bg-red-200 dark:hover:bg-red-900'
                : 'hover:surface-sunken',
            )}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
