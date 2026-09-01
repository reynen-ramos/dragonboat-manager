import { createContext, useContext } from 'react';
import { adapter } from '@/data';
import type { AuthGateway, Session } from '@/data/repo';
import type { AppRole } from '@/domain/types';

/**
 * Who is signed in, for the whole tree.
 *
 * Plumbing, not a query: the session gates rendering (the shell won't mount
 * pages without one), so it lives above the router as plain context rather
 * than in the query cache. This module sits at the same tier as main.tsx —
 * the one place outside `src/data`/`src/queries` that may touch the adapter.
 */

export interface SessionState {
  session: Session | null;
  loading: boolean;
  gateway: AuthGateway;
}

export const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  gateway: adapter.auth,
});

export const useSession = (): SessionState => useContext(SessionContext);

/** The signed-in role, or null while logged out / unregistered. */
export function useRole(): AppRole | null {
  return useSession().session?.profile?.role ?? null;
}

/** Whether the signed-in person may manage club data (create/edit/delete). */
export function useCanManage(): boolean {
  const role = useRole();
  return role === 'admin' || role === 'coach';
}
