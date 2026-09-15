import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SubscribedAccountCard } from './SubscribedAccountCard';
import React from 'react';

describe('SubscribedAccountCard', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    account: {
      accountId: '123',
      platform: 'instagram',
      displayName: 'Test User',
      username: 'testuser',
      profileImageUrl: 'https://example.com/avatar.jpg',
    },
    accountHref: '/instagram/123',
    isSubscribed: false,
  };

  it('renders AccountAvatar with the account image props and link to accountHref', () => {
    render(<SubscribedAccountCard {...defaultProps} />);

    // Check if link exists and has the right href
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/instagram/123');

    // Check text
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();

    // Check image from AccountAvatar
    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('AccountAvatar renders the platform icon fallback when profileImageUrl is missing (platform is threaded through)', () => {
    const props = {
      ...defaultProps,
      account: {
        ...defaultProps.account,
        profileImageUrl: null,
      },
    };
    render(<SubscribedAccountCard {...props} />);

    // account.platform ('instagram') is threaded into AccountAvatar, so the
    // platform-icon fallback renders instead of the old generic silhouette.
    expect(screen.getByTestId('avatar-fallback-platform-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-fallback-placeholder')).not.toBeInTheDocument();
  });

  it('shows the not-subscribed toggle and calls onSubscribe on click when isSubscribed is false', () => {
    const onSubscribeMock = vi.fn();
    render(<SubscribedAccountCard {...defaultProps} onSubscribe={onSubscribeMock} />);

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Subscribe');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onSubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('shows the subscribed toggle and calls onUnsubscribe on click when isSubscribed is true', () => {
    const onUnsubscribeMock = vi.fn();
    render(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={true}
        onUnsubscribe={onUnsubscribeMock}
      />
    );

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toHaveAttribute('aria-label', 'Unsubscribe');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(onUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('does not fire onSubscribe when clicking the toggle while isSubscribed is true', () => {
    const onSubscribeMock = vi.fn();
    const onUnsubscribeMock = vi.fn();
    render(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={true}
        onSubscribe={onSubscribeMock}
        onUnsubscribe={onUnsubscribeMock}
      />
    );

    fireEvent.click(screen.getByTestId('subscribe-toggle'));
    expect(onUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(onSubscribeMock).not.toHaveBeenCalled();
  });

  it('renders the dimmed neutral pending state, omits aria-pressed, and does not fire a callback when isStatusLoading is true', () => {
    const onSubscribeMock = vi.fn();
    const onUnsubscribeMock = vi.fn();
    render(
      <SubscribedAccountCard
        {...defaultProps}
        isStatusLoading={true}
        onSubscribe={onSubscribeMock}
        onUnsubscribe={onUnsubscribeMock}
      />
    );

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toHaveAttribute('aria-label', 'Checking subscription status');
    expect(button).not.toHaveAttribute('aria-pressed');
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);
    expect(onSubscribeMock).not.toHaveBeenCalled();
    expect(onUnsubscribeMock).not.toHaveBeenCalled();
  });

  it('button is disabled and aria-busy while isTogglePending is true, preserving the pre-toggle icon', () => {
    const onSubscribeMock = vi.fn();
    render(
      <SubscribedAccountCard
        {...defaultProps}
        onSubscribe={onSubscribeMock}
        isTogglePending={true}
      />
    );

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-label', 'Subscribe');

    fireEvent.click(button);
    expect(onSubscribeMock).not.toHaveBeenCalled();
  });

  it('disables the button when onSubscribe is not provided, instead of a silent no-op click', () => {
    render(<SubscribedAccountCard {...defaultProps} />);

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toBeDisabled();
  });

  it('disables the button when onUnsubscribe is not provided while subscribed', () => {
    render(<SubscribedAccountCard {...defaultProps} isSubscribed={true} />);

    const button = screen.getByTestId('subscribe-toggle');
    expect(button).toBeDisabled();
  });

  it('custom labels override the defaults', () => {
    const { rerender } = render(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={false}
        onSubscribe={vi.fn()}
        labels={{ subscribeLabel: 'Follow' }}
      />
    );

    expect(screen.getByTestId('subscribe-toggle')).toHaveAttribute('aria-label', 'Follow');

    rerender(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={true}
        onUnsubscribe={vi.fn()}
        labels={{ unsubscribeLabel: 'Following' }}
      />
    );

    expect(screen.getByTestId('subscribe-toggle')).toHaveAttribute('aria-label', 'Following');
  });

  it('falls back to @username as the primary label when displayName is empty, with no duplicate secondary line', () => {
    const props = {
      ...defaultProps,
      account: { ...defaultProps.account, displayName: '' },
    };
    render(<SubscribedAccountCard {...props} />);

    expect(screen.getByText('@testuser')).toBeInTheDocument();
    // Only one "@testuser" text node should exist (primary label), not a duplicate secondary line.
    expect(screen.getAllByText('@testuser')).toHaveLength(1);
  });

  it('falls back to the default "Unknown account" label when both displayName and username are empty', () => {
    const props = {
      ...defaultProps,
      account: { ...defaultProps.account, displayName: '', username: '' },
    };
    render(<SubscribedAccountCard {...props} />);

    expect(screen.getByText('Unknown account')).toBeInTheDocument();
  });

  it('uses labels.unknownAccountLabel to override the default fallback label', () => {
    const props = {
      ...defaultProps,
      account: { ...defaultProps.account, displayName: '', username: '' },
      labels: { unknownAccountLabel: 'Akun tidak dikenal' },
    };
    render(<SubscribedAccountCard {...props} />);

    expect(screen.getByText('Akun tidak dikenal')).toBeInTheDocument();
    expect(screen.queryByText('Unknown account')).not.toBeInTheDocument();
  });

  it('omits the secondary @username line (no bare @) when username is empty but displayName is present', () => {
    const props = {
      ...defaultProps,
      account: { ...defaultProps.account, username: '' },
    };
    render(<SubscribedAccountCard {...props} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.queryByText('@', { exact: false })).not.toBeInTheDocument();
  });

  it('renders a non-interactive wrapper (no link) when accountHref is empty or missing, while still showing avatar and identity text', () => {
    const props = { ...defaultProps, accountHref: '' };
    render(<SubscribedAccountCard {...props} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
  });

  it('scales the displayName/username text when size="lg", unlike the default size', () => {
    const { rerender } = render(<SubscribedAccountCard {...defaultProps} />);

    expect(screen.getByText('Test User')).not.toHaveClass('text-lg');
    expect(screen.getByText('@testuser')).toHaveClass('text-sm');

    rerender(<SubscribedAccountCard {...defaultProps} size="lg" />);

    expect(screen.getByText('Test User')).toHaveClass('text-lg');
    expect(screen.getByText('@testuser')).toHaveClass('text-base');
    expect(screen.getByText('@testuser')).not.toHaveClass('text-sm');

    rerender(<SubscribedAccountCard {...defaultProps} size="sm" />);

    expect(screen.getByText('Test User')).not.toHaveClass('text-lg');
    expect(screen.getByText('@testuser')).toHaveClass('text-sm');
    expect(screen.getByText('@testuser')).not.toHaveClass('text-base');
  });
});
