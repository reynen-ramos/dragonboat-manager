import { lazy } from 'react';
import { createBrowserRouter, redirect } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

/**
 * Every page loads lazily, so a route's code is fetched when it is first
 * visited rather than shipped to everyone up front.
 *
 * The win that matters is LineupPage: it is the only consumer of dnd-kit and
 * by far the largest screen, and splitting it takes roughly a fifth off the
 * entry bundle — which is first-visit paint on a dock over cellular, this
 * app's stated habitat. After the service worker installs, every chunk is
 * precached and the split instead buys cheaper updates: editing one page
 * invalidates one small file, not the whole bundle.
 *
 * The shell and the error screen stay static — the error screen least of all
 * may depend on a network fetch succeeding.
 */
const page = <T extends object>(load: () => Promise<T>, pick: (m: T) => React.ComponentType) =>
  lazy(() => load().then((m) => ({ default: pick(m) })));

const DashboardPage = page(() => import('@/pages/DashboardPage'), (m) => m.DashboardPage);
const MembersPage = page(() => import('@/pages/MembersPage'), (m) => m.MembersPage);
const MemberDetailPage = page(() => import('@/pages/MemberDetailPage'), (m) => m.MemberDetailPage);
const EventsPage = page(() => import('@/pages/EventsPage'), (m) => m.EventsPage);
const EventDetailPage = page(() => import('@/pages/EventDetailPage'), (m) => m.EventDetailPage);
const SignupsPage = page(() => import('@/pages/SignupsPage'), (m) => m.SignupsPage);
const RaceDayPage = page(() => import('@/pages/RaceDayPage'), (m) => m.RaceDayPage);
const LineupPage = page(() => import('@/pages/LineupPage'), (m) => m.LineupPage);
const SettingsPage = page(() => import('@/pages/SettingsPage'), (m) => m.SettingsPage);
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), (m) => m.NotFoundPage);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    // Without this a thrown render error replaces the whole app with React
    // Router's default screen, which looks indistinguishable from data loss.
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'members/:memberId', element: <MemberDetailPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      { path: 'events/:eventId/signups', element: <SignupsPage /> },
      {
        // The sign-up sheet lived at /availability before it was reframed.
        path: 'events/:eventId/availability',
        loader: ({ params }) => redirect(`/events/${params.eventId}/signups`),
      },
      { path: 'events/:eventId/racing', element: <RaceDayPage /> },
      { path: 'events/:eventId/crews/:crewId', element: <LineupPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
