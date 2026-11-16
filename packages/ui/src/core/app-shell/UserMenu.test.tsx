import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './UserMenu';

describe('UserMenu component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockRenderLink = ({
    href,
    className,
    children,
    onClick,
  }: {
    href: string;
    className?: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} data-testid={`menu-link-${href}`} onClick={onClick}>
      {children}
    </a>
  );

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    triggerRef: { current: document.createElement('button') },
    avatarUrl: 'https://example.com/avatar.jpg',
    displayName: 'Ahmad Shulhan',
    onSignOut: vi.fn(),
    renderLink: mockRenderLink,
    labels: {
      profile: 'Profile',
      locations: 'Locations',
      accountSettings: 'Account Settings',
      reports: 'Reports',
      moderatorItems: 'Moderator Items',
      logout: 'Log Out',
      close: 'Close',
    },
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<UserMenu {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all menu links and header details when open', () => {
    render(<UserMenu {...defaultProps} />);

    // Verify displayName and avatar are present
    expect(screen.getAllByText('Ahmad Shulhan')).toHaveLength(2); // One for mobile, one for desktop
    const avatars = document.querySelectorAll('img');
    expect(avatars[0]).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Verify links exist
    expect(screen.getByTestId('menu-link-/settings')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/settings/locations')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/settings/account')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/reports')).toBeInTheDocument();

    // Verify Moderator Items is NOT rendered for a regular user
    expect(screen.queryByTestId('menu-link-/moderator/items')).not.toBeInTheDocument();

    // Verify Log Out button exists
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('renders Moderator Items link and dividers when role is moderator', () => {
    render(<UserMenu {...defaultProps} role="moderator" />);

    // Verify Moderator link is rendered
    expect(screen.getByTestId('menu-link-/moderator/items')).toBeInTheDocument();
  });

  it('keeps Moderator Items link hidden when role is user', () => {
    render(<UserMenu {...defaultProps} role="user" />);

    // Verify Moderator link is not rendered
    expect(screen.queryByTestId('menu-link-/moderator/items')).not.toBeInTheDocument();
  });

  it('triggers onSignOut and onClose when Log Out is clicked', () => {
    const onSignOut = vi.fn();
    const onClose = vi.fn();

    render(<UserMenu {...defaultProps} onSignOut={onSignOut} onClose={onClose} />);

    const logoutButton = screen.getByRole('button', { name: 'Log Out' });
    fireEvent.click(logoutButton);

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking close button or backdrop', () => {
    const onClose = vi.fn();
    render(<UserMenu {...defaultProps} onClose={onClose} />);

    // Mobile close button
    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('Jobs badge (Story 10.13, notify when a job finishes)', () => {
    const labels = { ...defaultProps.labels, jobs: 'Jobs' };
    const jobsLink = () => screen.getByTestId('menu-link-/jobs');

    it('shows the count and puts the full sentence in the entry name', () => {
      render(<UserMenu {...defaultProps} labels={labels} jobsBadgeCount={3} jobsBadgeLabel="3 jobs finished since you last looked" />);
      expect(jobsLink()).toHaveTextContent('3');
      expect(jobsLink()).toHaveTextContent('Jobs');
      expect(jobsLink()).toHaveTextContent('3 jobs finished since you last looked');
      expect(jobsLink().querySelector('[aria-hidden="true"]')).toHaveTextContent('3');
    });

    it('caps the visible number at 9+ while the sentence keeps the real count', () => {
      render(<UserMenu {...defaultProps} labels={labels} jobsBadgeCount={42} jobsBadgeLabel="42 jobs finished since you last looked" />);
      expect(jobsLink().querySelector('[aria-hidden="true"]')).toHaveTextContent('9+');
      expect(jobsLink()).toHaveTextContent('42 jobs finished since you last looked');
    });

    it('renders no badge and no sentence at 0 or undefined, and the entry still works', () => {
      const { rerender } = render(<UserMenu {...defaultProps} labels={labels} jobsBadgeCount={0} jobsBadgeLabel="0 jobs" />);
      expect(jobsLink().textContent).toBe('Jobs');
      rerender(<UserMenu {...defaultProps} labels={labels} />);
      expect(jobsLink().textContent).toBe('Jobs');
      expect(jobsLink()).toHaveAttribute('href', '/jobs');
    });

    it('never badges another entry', () => {
      render(<UserMenu {...defaultProps} labels={labels} jobsBadgeCount={3} jobsBadgeLabel="x" />);
      expect(screen.getByTestId('menu-link-/settings')).not.toHaveTextContent('3');
    });
  });
});
