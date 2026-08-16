import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './app/router';

const queryClient = new QueryClient({
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
