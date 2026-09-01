import { useEffect, useState, type ReactNode } from 'react';
import { adapter } from '@/data';
import type { AuthGateway, Session } from '@/data/repo';
import { SessionContext } from './session';

export function SessionProvider({
  gateway = adapter.auth,
  children,
}: {
  /** Injectable for tests; the app always uses the adapter's. */
  gateway?: AuthGateway;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void gateway.getSession().then((session) => {
      if (!cancelled) setState({ session, loading: false });
    });
    const unsubscribe = gateway.onSessionChange((session) => {
      if (!cancelled) setState({ session, loading: false });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gateway]);

  return (
    <SessionContext.Provider value={{ ...state, gateway }}>{children}</SessionContext.Provider>
  );
}
