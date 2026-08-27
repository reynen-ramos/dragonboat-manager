import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeeSaw } from './BalancePanel';

const props = {
  label: 'Left / right',
  leftLabel: 'Left',
  rightLabel: 'Right',
  leftKg: 520,
  rightKg: 480,
  deltaKg: 40,
  fraction: 0.04,
};

describe('the balance bar', () => {
  it('exposes the reading as a meter, not just a coloured div', () => {
    render(<SeeSaw {...props} withinTolerance={false} />);

    const meter = screen.getByRole('meter', { name: /left \/ right balance/i });
    expect(meter).toHaveAttribute('aria-valuenow', '4');
  });

  it('says whether it is in tolerance, rather than only colouring it', () => {
    // Previously the sentence read identically either way and only the text
    // colour differed, so the verdict never reached a screen reader, a
    // colour-blind user, or a phone screen in bright sun.
    const { rerender } = render(<SeeSaw {...props} withinTolerance={false} />);
    expect(screen.getByRole('meter')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('out of tolerance'),
    );

    rerender(<SeeSaw {...props} withinTolerance />);
    expect(screen.getByRole('meter')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('balanced'),
    );
  });

  it('names the heavier side in the reading', () => {
    render(<SeeSaw {...props} withinTolerance={false} />);

    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/40kg Left/);
  });

  it('reads as even when the boat is level', () => {
    render(<SeeSaw {...props} leftKg={500} rightKg={500} deltaKg={0} fraction={0} withinTolerance />);

    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/even, balanced/);
  });
});
