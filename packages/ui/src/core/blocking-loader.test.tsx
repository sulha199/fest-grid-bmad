import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockingLoader } from './blocking-loader';

describe('BlockingLoader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when active is false', () => {
    const { container } = render(<BlockingLoader active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with aria-busy="true" when active is true', () => {
    render(<BlockingLoader active={true} />);
    const overlay = screen.getByRole('status').parentElement?.parentElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-busy', 'true');
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-[60]');
  });

  it('renders supplied label content', () => {
    render(<BlockingLoader active={true} label={<span>Processing OAuth...</span>} />);
    expect(screen.getByText('Processing OAuth...')).toBeInTheDocument();
  });

  it('falls back to default busyLabel ("Loading") when label is omitted', () => {
    render(<BlockingLoader active={true} />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('respects a labels.busyLabel override', () => {
    render(<BlockingLoader active={true} labels={{ busyLabel: 'Please wait' }} />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Please wait');
  });

  it('moves focus into overlay on activation and restores it to previous element on deactivation', () => {
    // Create an input outside to act as previously focused element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    const { rerender } = render(<BlockingLoader active={true} />);
    
    const overlay = screen.getByRole('status').parentElement?.parentElement;
    expect(overlay).toBeInTheDocument();
    expect(document.activeElement).toBe(overlay);

    // Deactivate loader
    rerender(<BlockingLoader active={false} />);
    expect(document.activeElement).toBe(input);

    // Cleanup external DOM element
    document.body.removeChild(input);
  });

  it('Tab and Shift+Tab do not move focus outside the overlay while active', async () => {
    const user = userEvent.setup();

    // Create inputs outside
    const buttonBefore = document.createElement('button');
    buttonBefore.textContent = 'Before';
    document.body.appendChild(buttonBefore);

    const buttonAfter = document.createElement('button');
    buttonAfter.textContent = 'After';
    document.body.appendChild(buttonAfter);

    const { rerender } = render(
      <BlockingLoader active={true} label="Loading..." />
    );

    const overlay = screen.getByRole('status').parentElement?.parentElement;
    expect(document.activeElement).toBe(overlay);

    // Press Tab, since there are no focusable elements inside the overlay,
    // focus should stay on the overlay container
    await user.tab();
    expect(document.activeElement).toBe(overlay);

    // Press Shift+Tab, should also stay on overlay
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(overlay);

    // Now let's try with a focusable element inside the overlay via the label
    cleanup();
    render(
      <BlockingLoader
        active={true}
        label={
          <div>
            <span>Loading...</span>
            <button type="button">Cancel</button>
          </div>
        }
      />
    );

    const innerButton = screen.getByRole('button', { name: 'Cancel' });
    const innerOverlay = screen.getByRole('status').parentElement?.parentElement;
    
    // Initial focus on container
    expect(document.activeElement).toBe(innerOverlay);

    // Tab moves focus to Cancel button (only focusable child)
    await user.tab();
    expect(document.activeElement).toBe(innerButton);

    // Tab again loops focus back to Cancel button (or container, let's check focus trapping)
    await user.tab();
    expect(document.activeElement).toBe(innerButton);

    // Cleanup external DOM elements
    document.body.removeChild(buttonBefore);
    document.body.removeChild(buttonAfter);
  });
});
