import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label as a button', () => {
    render(<Button>Balance sides</Button>);
    expect(screen.getByRole('button', { name: 'Balance sides' })).toBeInTheDocument();
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add crew</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Add crew' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Add crew
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add crew' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a 44px touch target at the default size', () => {
    // The comment in Button.tsx calls this the minimum comfortable target for a
    // phone used at a dock, so it is worth pinning rather than trusting.
    render(<Button>Seat</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });

  it('renders as the child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/members">Members</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Members' });
    expect(link).toHaveAttribute('href', '/members');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
