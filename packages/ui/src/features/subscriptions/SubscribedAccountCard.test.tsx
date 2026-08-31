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

  it('AccountAvatar fallback applies when profileImageUrl is missing', () => {
    const props = {
      ...defaultProps,
      account: {
        ...defaultProps.account,
        profileImageUrl: null,
      },
    };
    render(<SubscribedAccountCard {...props} />);
    
    // AccountAvatar should render its fallback container
    expect(screen.getByTestId('avatar-fallback-container')).toBeInTheDocument();
  });

  it('shows Subscribe button and calls onSubscribe on click when isSubscribed is false', () => {
    const onSubscribeMock = vi.fn();
    render(<SubscribedAccountCard {...defaultProps} onSubscribe={onSubscribeMock} />);
    
    const button = screen.getByRole('button', { name: 'Subscribe' });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    
    fireEvent.click(button);
    expect(onSubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('shows Subscribed text (no button) when isSubscribed is true', () => {
    render(<SubscribedAccountCard {...defaultProps} isSubscribed={true} />);
    
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('button is disabled and onSubscribe is not called while isSubscribing is true', () => {
    const onSubscribeMock = vi.fn();
    render(
      <SubscribedAccountCard
        {...defaultProps}
        onSubscribe={onSubscribeMock}
        isSubscribing={true}
      />
    );
    
    const button = screen.getByRole('button', { name: 'Subscribe' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);
    expect(onSubscribeMock).not.toHaveBeenCalled();
  });

  it('disables the button when onSubscribe is not provided, instead of a silent no-op click', () => {
    render(<SubscribedAccountCard {...defaultProps} />);

    const button = screen.getByRole('button', { name: 'Subscribe' });
    expect(button).toBeDisabled();
  });

  it('custom labels override the defaults', () => {
    const { rerender } = render(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={false}
        labels={{ subscribeLabel: 'Follow' }}
      />
    );
    
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();

    rerender(
      <SubscribedAccountCard
        {...defaultProps}
        isSubscribed={true}
        labels={{ subscribedLabel: 'Following' }}
      />
    );
    
    expect(screen.getByText('Following')).toBeInTheDocument();
  });
});
