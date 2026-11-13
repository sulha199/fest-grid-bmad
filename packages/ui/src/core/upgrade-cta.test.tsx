import * as React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeCta } from './upgrade-cta';

const props = { label: 'Upgrade', comingSoonLabel: 'Coming soon', note: 'Not available yet.', afterClickNote: 'Thanks for your interest.' };

describe('UpgradeCta', () => {
  afterEach(cleanup);

  it('shows the label, the badge and the note', () => {
    render(<UpgradeCta {...props} />);
    expect(screen.getByRole('button')).toHaveTextContent('Upgrade');
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText('Not available yet.')).toBeInTheDocument();
  });

  it('points aria-describedby at the note and has a min touch height', () => {
    render(<UpgradeCta {...props} />);
    const button = screen.getByRole('button');
    const id = button.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toHaveTextContent('Not available yet.');
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('w-full');
  });

  it('swaps the note on click and keeps the button enabled and focusable', async () => {
    render(<UpgradeCta {...props} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(screen.getByText('Thanks for your interest.')).toBeInTheDocument();
    expect(screen.queryByText('Not available yet.')).toBeNull();
    expect(button).toBeEnabled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it('never carries disabled or aria-disabled', async () => {
    render(<UpgradeCta {...props} />);
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).not.toHaveAttribute('aria-disabled');
    await userEvent.click(button);
    expect(button).not.toHaveAttribute('disabled');
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('note is a polite live region', () => {
    render(<UpgradeCta {...props} />);
    expect(screen.getByText('Not available yet.')).toHaveAttribute('aria-live', 'polite');
  });

  it('fires onShown once across re-renders and under StrictMode', () => {
    const onShown = vi.fn();
    const { rerender } = render(
      <React.StrictMode>
        <UpgradeCta {...props} onShown={onShown} />
      </React.StrictMode>,
    );
    rerender(
      <React.StrictMode>
        <UpgradeCta {...props} onShown={onShown} note="changed" />
      </React.StrictMode>,
    );
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on every click', async () => {
    const onClick = vi.fn();
    render(<UpgradeCta {...props} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
