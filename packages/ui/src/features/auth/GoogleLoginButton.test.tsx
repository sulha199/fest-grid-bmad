import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleLoginButton } from './GoogleLoginButton';

describe('GoogleLoginButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly with default label', () => {
    render(<GoogleLoginButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('renders correctly with custom children', () => {
    render(<GoogleLoginButton>Masuk dengan akun Google</GoogleLoginButton>);
    expect(screen.getByText('Masuk dengan akun Google')).toBeInTheDocument();
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GoogleLoginButton onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not call onClick when disabled is true', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GoogleLoginButton onClick={onClick} disabled={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    // Click should be ignored or throw because it's disabled, or pointer-events are none.
    // Try clicking to verify onClick is not called.
    try {
      await user.click(button);
    } catch {
      // ignore user-event pointer events errors on disabled elements
    }
    expect(onClick).not.toHaveBeenCalled();
  });
});
