import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

const field = () => screen.getByRole('spinbutton', { name: /tolerance/i });

/**
 * Mirrors how SettingsPage uses the field: a commit updates the stored value,
 * which flows back down as the new prop. Testing against a spy that never
 * updates would assert behaviour the real page never sees.
 */
function Controlled({
  initial,
  max,
  onCommit,
}: {
  initial: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      label="Tolerance"
      value={value}
      max={max}
      onCommit={(next) => {
        onCommit(next);
        setValue(next);
      }}
    />
  );
}

describe('NumberField', () => {
  it('does not commit while the value is still being typed', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial={3} onCommit={onCommit} />);

    await userEvent.clear(field());
    await userEvent.type(field(), '3.5');

    // Committing per keystroke would have fired for "", "3" and "3." by now,
    // and the "3." step would have rewritten the box as "3" mid-word.
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue(3.5);
  });

  it('commits the typed value on blur', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial={3} onCommit={onCommit} />);

    await userEvent.clear(field());
    await userEvent.type(field(), '4.5');
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(4.5);
    expect(field()).toHaveValue(4.5);
  });

  it('restores the stored value when the field is left empty', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial={3} onCommit={onCommit} />);

    await userEvent.clear(field());
    await userEvent.tab();

    // Number('') is 0, which per-keystroke saving would have written as a real
    // tolerance of zero — flagging every crew as out of balance.
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue(3);
  });

  it('clamps a value above the maximum', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial={3} max={25} onCommit={onCommit} />);

    await userEvent.clear(field());
    await userEvent.type(field(), '90');
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(25);
    expect(field()).toHaveValue(25);
  });

  it('abandons the edit on Escape', async () => {
    const onCommit = vi.fn();
    render(<Controlled initial={3} onCommit={onCommit} />);

    await userEvent.clear(field());
    await userEvent.type(field(), '9');
    await userEvent.keyboard('{Escape}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue(3);
  });

  it('adopts a new stored value while it is not being edited', () => {
    const { rerender } = render(<NumberField label="Tolerance" value={3} onCommit={vi.fn()} />);
    rerender(<NumberField label="Tolerance" value={5} onCommit={vi.fn()} />);

    expect(field()).toHaveValue(5);
  });
});
