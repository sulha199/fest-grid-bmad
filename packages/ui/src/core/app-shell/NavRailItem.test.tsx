import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavRailItem } from './NavRailItem';

describe('NavRailItem component', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  const mockRenderLink = ({
    href,
    className,
    children,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    ...rest
  }: any) => (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      data-testid="mock-link"
      {...rest}
    >
      {children}
    </a>
  );

  const testIcon = <svg data-testid="test-icon" />;

  it('renders a link variant correctly (AC4, AC5, AC6)', () => {
    render(
      <NavRailItem
        variant="link"
        icon={testIcon}
        label="Discover"
        href="/discover"
        currentPath="/discover"
        renderLink={mockRenderLink}
      />
    );

    const link = screen.getByTestId('mock-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/discover');
    expect(link).toHaveAttribute('aria-label', 'Discover');
    expect(link).toHaveAttribute('aria-current', 'page');

    // Should contain active icon swap class
    const iconContainer = screen.getByTestId('test-icon').parentElement;
    expect(iconContainer).toHaveClass('text-nav-active-indicator');

    // Focus ring class should be present on the link
    expect(link).toHaveClass('focus-visible:outline-secondary');
  });

  it('renders a trigger variant correctly (AC8)', () => {
    const onActivate = vi.fn();
    render(
      <NavRailItem
        variant="trigger"
        icon={testIcon}
        label="Profile"
        onActivate={onActivate}
        ariaExpanded={true}
      />
    );

    const button = screen.getByRole('button', { name: 'Profile' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-haspopup', 'true');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Focus ring class should be present on the button
    expect(button).toHaveClass('focus-visible:outline-secondary');

    // Trigger should invoke onActivate when clicked
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('shows tooltip on hover or focus and hides on escape (AC1)', () => {
    render(
      <NavRailItem
        variant="link"
        icon={testIcon}
        label="Favorites"
        href="/favorites"
        currentPath="/discover"
        renderLink={mockRenderLink}
      />
    );

    // Initially tooltip shouldn't be rendered or visible
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const link = screen.getByTestId('mock-link');

    // Hover
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    let tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Favorites');

    // Leave
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Focus
    fireEvent.focus(link);
    tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();

    // Escape key
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
