import { CalendarDays, LayoutDashboard, Settings, Users } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui/misc';
import { Toaster } from '@/components/ui/Toaster';
import { useExternalStorageSync, useStorageWarnings } from '@/queries/hooks';
import { cn } from '@/utils/cn';

/**
 * App chrome: a sidebar on desktop, a bottom bar on phones.
 *
 * Bottom navigation is deliberate — this app is used standing on a dock,
 * one-handed, where the top of a phone screen is out of thumb reach.
 */

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/members', label: 'Members', icon: Users, end: false },
  { to: '/events', label: 'Events', icon: CalendarDays, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: true },
];

export function AppShell() {
  useExternalStorageSync();
  useStorageWarnings();

  return (
    <div className="min-h-dvh sm:flex">
      {/* First tab stop: skips the nav, which is identical on every screen. */}
      <a
        href="#main"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3
          focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="main" className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-8 sm:pb-10">
        {/* Pages are lazy chunks; the fallback shows while one is fetched. */}
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomBar />
      <Toaster />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="no-print hidden w-56 shrink-0 border-r border-subtle px-3 py-5 sm:block">
      <Wordmark className="mb-6 px-2" />
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-muted hover:surface-sunken hover:text-[var(--text-strong)]',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Shares the sidebar's "Main" label deliberately.
 *
 * Two navigation landmarks with one name would be ambiguous if both were
 * exposed, but each is `display: none` at the other's breakpoint, which takes
 * it out of the accessibility tree entirely. Exactly one is ever present.
 */
function BottomBar() {
  return (
    <nav
      aria-label="Main"
      className="no-print surface fixed inset-x-0 bottom-0 z-30 flex border-t border-subtle pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium',
              isActive ? 'text-brand-600' : 'text-muted',
            )
          }
        >
          <Icon className="size-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DragonMark />
      <span className="font-semibold tracking-tight">Dragonboat</span>
    </div>
  );
}

function DragonMark(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-brand-600" aria-hidden="true">
      <path
        d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 11h13c2 0 3-1.2 3-2.5S18.8 6 17 6h-1.5C14 6 13 7 11 7H6c-1.5 0-2 1-2 2z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
