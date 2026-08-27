import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioCards } from './RadioCards';

const OPTIONS = [
  { value: 'in', label: 'In' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'out', label: 'Out' },
];

function Harness({ onChange, initial = 'in' }: { onChange?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <RadioCards
      label="Availability"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      renderOption={(o) => o.label}
    />
  );
}

describe('RadioCards', () => {
  it('exposes the choices as one exclusive group', () => {
    // As `aria-pressed` buttons these announced as independent toggles:
    // "Maybe, pressed" says nothing about the two it just turned off.
    render(<Harness />);

    expect(screen.getByRole('radiogroup', { name: 'Availability' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marks exactly one option as checked', () => {
    render(<Harness initial="maybe" />);

    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'In' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Out' })).not.toBeChecked();
  });

  it('selects on click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Out' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('out');
    expect(screen.getByRole('radio', { name: 'Out' })).toBeChecked();
  });

  it('moves between options with the arrow keys', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'In' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Out' })).toBeChecked();
  });

  it('wraps around at the ends', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'In' }).focus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByRole('radio', { name: 'Out' })).toBeChecked();
  });

  it('is a single tab stop', async () => {
    // A roving tabindex: the group is one stop, not one per option, so a page
    // of these does not bury the next control behind a dozen presses.
    render(
      <>
        <button type="button">before</button>
        <Harness initial="maybe" />
        <button type="button">after</button>
      </>,
    );

    screen.getByRole('button', { name: 'before' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Maybe' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });
});
