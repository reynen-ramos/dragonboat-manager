import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AvailabilityPage } from '@/pages/AvailabilityPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { EventsPage } from '@/pages/EventsPage';
import { LineupPage } from '@/pages/LineupPage';
import { MemberDetailPage } from '@/pages/MemberDetailPage';
import { MembersPage } from '@/pages/MembersPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'members/:memberId', element: <MemberDetailPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      { path: 'events/:eventId/availability', element: <AvailabilityPage /> },
      { path: 'events/:eventId/crews/:crewId', element: <LineupPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
