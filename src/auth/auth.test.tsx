import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache } from '@/data/mock/db';
import type { AuthGateway, Session } from '@/data/repo';
import { AppShell } from '@/app/AppShell';
import { SessionProvider } from './SessionProvider';

beforeEach(() => {
  localStorage.clear();
  invalidateCache();
});

/** A gateway frozen at one session state, with spyable actions. */
const gatewayFor = (session: Session | null): AuthGateway => ({
  getSession: async () => session,
  signInWithOAuth: vi.fn(async () => {}),
  signInWithMagicLink: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  createClub: vi.fn(async () => {}),
  onSessionChange: (callback) => {
    callback(session);
    return () => {};
  },
  availableProviders: ['google'],
  magicLinkEnabled: true,
});

const renderShell = (gateway: AuthGateway) => {
  const router = createMemoryRouter([
    { path: '/', element: <AppShell />, children: [{ index: true, element: <p>page content</p> }] },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider gateway={gateway}>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
};

describe('the shell gate', () => {
  it('shows sign-in when nobody is signed in, and no page mounts', async () => {
    const gateway = gatewayFor(null);
    renderShell(gateway);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('page content')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(gateway.signInWithMagicLink).toHaveBeenCalledWith('ana@example.com');
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('offers to found a club to a signed-in but unregistered email', async () => {
    const gateway = gatewayFor({ email: 'new@example.com', profile: null });
    renderShell(gateway);

    expect(await screen.findByText('Almost there')).toBeInTheDocument();
    expect(screen.queryByText('page content')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Club name'), 'River Dragons');
    await userEvent.click(screen.getByRole('button', { name: 'Create the club' }));
    expect(gateway.createClub).toHaveBeenCalledWith('River Dragons');
  });

  it('lets an admin through with the full nav', async () => {
    renderShell(
      gatewayFor({
        email: 'coach@example.com',
        profile: { id: 'p1', email: 'coach@example.com', role: 'admin' },
      }),
    );

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Settings/ }).length).toBeGreaterThan(0);
  });

  it('gives a paddler their own nav: My Page, no staff surfaces', async () => {
    renderShell(
      gatewayFor({
        email: 'paddler@example.com',
        profile: { id: 'p2', email: 'paddler@example.com', role: 'paddler', memberId: 'm1' },
      }),
    );

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /My Page/ }).length).toBeGreaterThan(0);
    for (const staffOnly of [/Settings/, /Dashboard/, /Members/, /Reports/]) {
      expect(screen.queryByRole('link', { name: staffOnly })).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('link', { name: /Trainings/ }).length).toBeGreaterThan(0);
  });
});
