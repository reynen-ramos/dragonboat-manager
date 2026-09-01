import { BarChart3, CalendarDays, CloudOff, Dumbbell, LayoutDashboard, LogOut, Settings, Users } from 'lucide-react';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LoginScreen, UnregisteredScreen } from '@/auth/LoginScreen';
import { useRole, useSession } from '@/auth/session';
import { Spinner } from '@/components/ui/misc';
import { Toaster } from '@/components/ui/Toaster';
import type { AppRole } from '@/domain/types';
import { adapterName, useExternalStorageSync, useStorageWarnings } from '@/queries/hooks';
import { cn } from '@/utils/cn';

/**
 * App chrome: a sidebar on desktop, a bottom bar on phones.
 *
 * Bottom navigation is deliberate — this app is used standing on a dock,
 * one-handed, where the top of a phone screen is out of thumb reach.
 */

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; end: boolean; roles?: AppRole[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/members', label: 'Members', icon: Users, end: false },
  { to: '/events', label: 'Events', icon: CalendarDays, end: false },
  { to: '/trainings', label: 'Trainings', icon: Dumbbell, end: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, end: true },
  // Settings holds club rules and access control — admin territory.
  { to: '/settings', label: 'Settings', icon: Settings, end: true, roles: ['admin'] },
];

const navFor = (role: AppRole | null) =>
  NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

export function AppShell() {
  const { session, loading } = useSession();
  useExternalStorageSync();
  useStorageWarnings();

  // The gate: no pages mount before we know who is looking. Rendered in
  // place rather than via a /login route, so OAuth returns to the URL it
  // left and deep links survive sign-in untouched.
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (!session.profile) return <UnregisteredScreen />;

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
        <OfflineBanner />
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

/**
 * Honest about the one thing the network backend cannot do: work offline.
 * The PWA shell still loads; reads fail into their retry states and writes
 * are refused — so say why, up front, rather than letting every action toast
 * an inscrutable fetch error. The localStorage adapter never shows this: it
 * has no network to lose.
 */
function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (adapterName !== 'supabase' || online) return null;
  return (
    <p className="no-print mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <CloudOff className="size-4 shrink-0" />
      No connection — changes can't be saved until you're back online.
    </p>
  );
}

function Sidebar() {
  const role = useRole();
  const { session, gateway } = useSession();
  return (
    <aside className="no-print hidden w-56 shrink-0 flex-col border-r border-subtle px-3 py-5 sm:flex">
      <Wordmark className="mb-6 px-2" />
      <nav aria-label="Main" className="flex flex-col gap-1">
        {navFor(role).map(({ to, label, icon: Icon, end }) => (
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
      {/* The mock has no one to sign out; hiding the button beats a no-op. */}
      {adapterName !== 'mock' && (
        <div className="mt-auto border-t border-subtle pt-3">
          <p className="truncate px-3 text-xs text-muted" title={session?.email}>
            {session?.email}
          </p>
          <button
            type="button"
            onClick={() => void gateway.signOut()}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:surface-sunken"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
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
  const role = useRole();
  const { gateway } = useSession();
  const items = navFor(role);
  // A role that can't see Settings still needs a way out on a phone; the
  // freed slot becomes Sign out, keeping the bar at six items either way.
  const showSignOut = adapterName !== 'mock' && items.length < NAV.length;
  return (
    <nav
      aria-label="Main"
      className="no-print surface fixed inset-x-0 bottom-0 z-30 flex border-t border-subtle pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map(({ to, label, icon: Icon, end }) => (
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
      {showSignOut && (
        <button
          type="button"
          onClick={() => void gateway.signOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium text-muted"
        >
          <LogOut className="size-5" />
          Sign out
        </button>
      )}
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
