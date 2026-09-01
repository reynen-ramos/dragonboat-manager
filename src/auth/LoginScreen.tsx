import { LogOut, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Wordmark } from '@/app/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card } from '@/components/ui/misc';
import { useSession } from './session';

/**
 * Sign-in, rendered in place by the shell — no /login route, no redirect
 * dance. OAuth comes back to whatever URL it left, and the PWA's auto-update
 * never has a navigation to trip over.
 */
export function LoginScreen() {
  const { gateway } = useSession();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      await gateway.signInWithMagicLink(target);
      setSentTo(target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the link.');
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: 'google' | 'facebook') => {
    setError(undefined);
    try {
      await gateway.signInWithOAuth(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    }
  };

  return (
    <AuthFrame>
      {sentTo ? (
        <>
          <Mail className="mx-auto size-8 text-brand-600" />
          <h1 className="mt-3 text-center text-lg font-semibold">Check your email</h1>
          <p className="mt-2 text-center text-sm text-muted">
            A sign-in link is on its way to <strong>{sentTo}</strong>. Open it on this device.
          </p>
          <Button className="mt-4 w-full" onClick={() => setSentTo(undefined)}>
            Use a different email
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-center text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-center text-sm text-muted">
            Use the email address your club invited.
          </p>

          {gateway.magicLinkEnabled && (
            <form onSubmit={sendLink} className="mt-4 flex flex-col gap-3">
              <Input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
            </form>
          )}

          {gateway.availableProviders.includes('google') && (
            <Button className="mt-3 w-full" onClick={() => void oauth('google')}>
              Continue with Google
            </Button>
          )}

          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        </>
      )}
    </AuthFrame>
  );
}

/**
 * Signed in, but no club knows this email: either they beat their invitation
 * here (ask a coach), or they are the club's first user (found it).
 */
export function UnregisteredScreen() {
  const { session, gateway } = useSession();
  const [clubName, setClubName] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const found = async (e: FormEvent) => {
    e.preventDefault();
    const name = clubName.trim();
    if (!name) return;
    setBusy(true);
    setError(undefined);
    try {
      await gateway.createClub(name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the club.');
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1 className="text-center text-lg font-semibold">Almost there</h1>
      <p className="mt-2 text-center text-sm text-muted">
        You're signed in as <strong>{session?.email}</strong>, but this email isn't registered
        with a club yet. Ask a coach to invite it — or start a club of your own.
      </p>

      <form onSubmit={found} className="mt-4 flex flex-col gap-3">
        <Input
          required
          placeholder="Club name"
          aria-label="Club name"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create the club'}
        </Button>
      </form>

      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

      <Button
        variant="ghost"
        className="mt-4 w-full"
        onClick={() => void gateway.signOut()}
      >
        <LogOut /> Sign out
      </Button>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <Wordmark className="mb-6 justify-center" />
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  );
}
