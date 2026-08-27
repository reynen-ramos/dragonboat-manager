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
      // Local storage reads are instant, and a stale seat map is dangerous —
      // so refetch freely rather than serving cached lineups.
      staleTime: 0,
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
