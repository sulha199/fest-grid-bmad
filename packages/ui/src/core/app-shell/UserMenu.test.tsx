import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './UserMenu';

describe('UserMenu component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockRenderLink = ({ href, className, children, onClick }: any) => (
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
      subscriptions: 'Subscribed Accounts',
      apiKeys: 'API Keys',
      notifications: 'Notifications',
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
    expect(screen.getByTestId('menu-link-/settings/subscriptions')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/settings/api-keys')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/settings/notifications')).toBeInTheDocument();
    expect(screen.getByTestId('menu-link-/reports')).toBeInTheDocument();

    // Verify Moderator Items is NOT rendered for a regular user
    expect(screen.queryByTestId('menu-link-/moderator/items')).not.toBeInTheDocument();

    // Verify Log Out button exists
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('renders Moderator Items link and dividers when role is MODERATOR', () => {
    render(<UserMenu {...defaultProps} role="MODERATOR" />);

    // Verify Moderator link is rendered
    expect(screen.getByTestId('menu-link-/moderator/items')).toBeInTheDocument();
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
});
