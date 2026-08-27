import { AlertTriangle } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

/**
 * What a thrown render error looks like instead of a blank page.
 *
 * The reassurance about stored data is the important part: this app keeps
 * everything in one browser, so a crash looks exactly like data loss unless
 * the screen says otherwise.
 */
export function RouteError() {
  const error = useRouteError();
  const detail = error instanceof Error ? error.message : String(error ?? '');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="size-8 text-amber-600" />
      <div>
        <h1 className="text-lg font-semibold">This screen stopped working.</h1>
        <p className="mt-1 text-sm text-muted">
          Your club data is stored in this browser and has not been touched. Reloading usually
          clears it.
        </p>
      </div>

      {detail && (
        <pre className="max-h-32 w-full overflow-auto rounded-lg surface-sunken p-3 text-left text-xs text-muted">
          {detail}
        </pre>
      )}

      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button variant="secondary" asChild>
          <Link to="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
