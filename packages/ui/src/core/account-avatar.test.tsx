import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AccountAvatar } from './account-avatar';

describe('AccountAvatar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders image when profileImageUrl is provided and valid', () => {
    const imageUrl = 'https://example.com/avatar.jpg';
    render(
      <AccountAvatar
        profileImageUrl={imageUrl}
        displayName="Jane Doe"
        username="janedoe"
      />
    );

    const img = screen.getByTestId('avatar-image') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe(imageUrl);
    expect(img.alt).toBe('Jane Doe');
    expect(img).toHaveClass('w-10 h-10');
  });

  it('falls back to placeholder on empty profileImageUrl', () => {
    render(
      <AccountAvatar
        profileImageUrl=""
        displayName="Jane Doe"
        username="janedoe"
      />
    );

    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    
    const fallbackContainer = screen.getByTestId('avatar-fallback-container');
    expect(fallbackContainer).toBeInTheDocument();
    expect(fallbackContainer).toHaveAttribute('role', 'img');
    expect(fallbackContainer).toHaveAttribute('aria-label', 'Jane Doe');
    
    expect(screen.getByTestId('avatar-fallback-placeholder')).toBeInTheDocument();
  });

  it('falls back to placeholder on null profileImageUrl', () => {
    render(
      <AccountAvatar
        profileImageUrl={null}
        displayName="Jane Doe"
        username="janedoe"
      />
    );

    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('avatar-fallback-container')).toBeInTheDocument();
  });

  it('falls back to placeholder when image load errors out', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/broken.jpg"
        displayName="Jane Doe"
        username="janedoe"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toBeInTheDocument();

    // Fire error on the image element
    fireEvent.error(img);

    // Image should be unmounted and replaced by the fallback
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('avatar-fallback-container')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-fallback-placeholder')).toBeInTheDocument();
  });

  it('supports the lg size prop', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/avatar.jpg"
        size="lg"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveClass('w-16 h-16 sm:w-20 sm:h-20');
  });

  it('supports default sm size when not provided', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/avatar.jpg"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveClass('w-10 h-10');
  });

  it('constructs correct alt text with displayName', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/avatar.jpg"
        displayName="Alex Smith"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveAttribute('alt', 'Alex Smith');
  });

  it('constructs correct alt text with username if displayName is missing', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/avatar.jpg"
        username="alex_smith"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveAttribute('alt', '@alex_smith');
  });

  it('uses default alt text if both displayName and username are missing', () => {
    render(
      <AccountAvatar
        profileImageUrl="https://example.com/avatar.jpg"
      />
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toHaveAttribute('alt', 'User avatar');
  });
});
