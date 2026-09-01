import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './app/router';
import { messageForError, useNotifications } from './stores/notifications';

const queryClient = new QueryClient({
  // Most writes here are fire-and-forget — a seat drag, a pin toggle, a race
  // time. Reporting failures once, centrally, is what stops a rejected write
  // from being invisible; the alternative is an error branch at every call
  // site, and the ones that were missing are exactly how edits went missing.
  mutationCache: new MutationCache({
    onError: (error) => useNotifications.getState().notify(messageForError(error)),
  }),
  defaultOptions: {
    queries: {
      // One minute, not zero: with a network backend, staleTime 0 plus
      // focus-refetch re-reads roughly ten whole tables on every tab switch.
      // Writes stay instantly fresh regardless — every mutation awaits its
      // invalidations — and cross-tab changes invalidate explicitly, so the
      // stale-seat-map danger this used to guard against is already covered.
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
