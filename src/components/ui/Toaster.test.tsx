import { MutationCache, QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { messageForError, useNotifications } from '@/stores/notifications';
import { Toaster } from './Toaster';

/** The same wiring main.tsx uses, so this exercises the real arrangement. */
const makeClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => useNotifications.getState().notify(messageForError(error)),
    }),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function FireAndForgetButton({ fail }: { fail: () => Promise<unknown> }) {
  const mutation = useMutation({ mutationFn: fail });
  // Deliberately unhandled, the way every seat drag and pin toggle calls it.
  return (
    <button type="button" onClick={() => mutation.mutate(undefined)}>
      Save
    </button>
  );
}

const renderApp = (fail: () => Promise<unknown>) =>
  render(
    <QueryClientProvider client={makeClient()}>
      <FireAndForgetButton fail={fail} />
      <Toaster />
    </QueryClientProvider>,
  );

beforeEach(() => useNotifications.getState().clear());

describe('failed writes', () => {
  it('surfaces a rejected fire-and-forget mutation', async () => {
    // This is the storage-quota path: writeDb throws, every call site ignores
    // it, and before the mutation cache handler nothing said a word.
    renderApp(() =>
      Promise.reject(new Error('Could not save — browser storage is full or unavailable.')),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save — browser storage is full or unavailable.',
    );
  });

  it('can be dismissed', async () => {
    renderApp(() => Promise.reject(new Error('Could not save.')));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says nothing when the write succeeds', async () => {
    renderApp(() => Promise.resolve('ok'));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('undo offers', () => {
  it('runs the action and dismisses on click', async () => {
    render(
      <QueryClientProvider client={makeClient()}>
        <Toaster />
      </QueryClientProvider>,
    );
    let ran = false;
    useNotifications.getState().notify({
      message: 'Deleted Ana Reyes.',
      tone: 'info',
      action: { label: 'Undo', run: () => (ran = true) },
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Deleted Ana Reyes.');
    await userEvent.click(screen.getByRole('button', { name: /undo/i }));

    expect(ran).toBe(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
