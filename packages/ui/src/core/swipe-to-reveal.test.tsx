import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwipeToReveal } from './swipe-to-reveal';

describe('SwipeToReveal', () => {
  beforeEach(() => {
    // Mock getComputedStyle for text direction and offsetWidth for measurement
    vi.spyOn(window, 'getComputedStyle').mockImplementation((elem) => {
      // Return 'rtl' if we set dir="rtl" on the wrapper or document
      const dir = (elem as HTMLElement).closest('[dir]')?.getAttribute('dir') || 'ltr';
      return { direction: dir } as CSSStyleDeclaration;
    });

    // Mock setPointerCapture and releasePointerCapture
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = vi.fn();
    }
    
    // Mock offsetWidth to return 100 for the action button container
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: function () {
        // Only return 100 if it's the action wrapper (checking for absolute)
        if (this.className.includes('absolute')) return 100;
        return 0;
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders children and action', () => {
    render(
      <SwipeToReveal action={<span data-testid="action">Delete</span>} onAction={() => {}}>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('reveals action on pointer drag past threshold and shifts content', async () => {
    render(
      <SwipeToReveal action={<span>Delete</span>} onAction={() => {}}>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    const content = screen.getByTestId('content').parentElement!;
    
    // Default threshold is 50, drag -60 (past threshold)
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 140, pointerId: 1 });
    
    // Verify it moved to -60 temporarily
    expect(content.style.transform).toBe('translateX(-60px)');
    
    fireEvent.pointerUp(content, { isPrimary: true, pointerId: 1 });

    // After release, it should snap to -100
    expect(content.style.transform).toBe('translateX(-100px)');
  });

  it('snaps back to offset 0 if drag is below threshold', async () => {
    const onAction = vi.fn();
    render(
      <SwipeToReveal action={<span>Delete</span>} onAction={onAction}>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    const content = screen.getByTestId('content').parentElement!;
    
    // Default threshold is 50, drag -40 (below threshold)
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 160, pointerId: 1 });
    
    // Verify it moved to -40 temporarily
    expect(content.style.transform).toBe('translateX(-40px)');
    
    fireEvent.pointerUp(content, { isPrimary: true, pointerId: 1 });

    // After release, it should snap back to 0
    expect(content.style.transform).toBe('translateX(0px)');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('calls onAction exactly once when revealed action is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <SwipeToReveal action={<span>Delete</span>} onAction={onAction}>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    const content = screen.getByTestId('content').parentElement!;
    
    // Reveal first
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(content, { isPrimary: true, pointerId: 1 });

    const actionButton = screen.getByRole('button');
    await user.click(actionButton);

    expect(onAction).toHaveBeenCalledTimes(1);
    
    // State does not auto-reset (transform stays -100px)
    expect(content.style.transform).toBe('translateX(-100px)');
  });

  it('can activate action via keyboard (Tab and Enter/Space) without swipe simulation', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <SwipeToReveal action={<span>Delete</span>} onAction={onAction}>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    const actionButton = screen.getByRole('button');
    
    // Initially not focused
    expect(actionButton).not.toHaveFocus();
    
    // Tab to it
    await user.tab();
    expect(actionButton).toHaveFocus();
    
    // Activate via Enter
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);

    // Activate via Space
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('mirrors drag direction in RTL layout', async () => {
    render(
      <div dir="rtl">
        <SwipeToReveal action={<span>Delete</span>} onAction={() => {}}>
          <div data-testid="content">Content</div>
        </SwipeToReveal>
      </div>
    );

    const content = screen.getByTestId('content').parentElement!;
    
    // In LTR, dragging left (-60) reveals. In RTL, dragging left (-60) should clamp to 0.
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 140, pointerId: 1 });
    expect(content.style.transform).toBe('translateX(0px)'); // Clamped to 0
    fireEvent.pointerUp(content, { isPrimary: true, pointerId: 1 });

    // In RTL, dragging right (+60) reveals.
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 260, pointerId: 1 });
    expect(content.style.transform).toBe('translateX(60px)');
    fireEvent.pointerUp(content, { isPrimary: true, pointerId: 1 });

    // After release, snaps fully open to +100
    expect(content.style.transform).toBe('translateX(100px)');
  });

  it('is inert when disabled', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <SwipeToReveal action={<span>Delete</span>} onAction={onAction} disabled>
        <div data-testid="content">Content</div>
      </SwipeToReveal>
    );

    const content = screen.getByTestId('content').parentElement!;
    
    // Drag does nothing
    fireEvent.pointerDown(content, { isPrimary: true, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(content, { isPrimary: true, clientX: 100, pointerId: 1 });
    expect(content.style.transform).toBe('translateX(0px)');
    
    // Tab skips it
    await user.tab();
    const actionButton = screen.getByRole('button');
    expect(actionButton).not.toHaveFocus();
    
    // Clicking does nothing
    await user.click(actionButton);
    expect(onAction).not.toHaveBeenCalled();
  });
});
