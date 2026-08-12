/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PostCard, PostCardSkeleton } from './PostCard';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';
import type { Post } from '@festgrid/shared-types';

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function expectedDate(locale: string, date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...(timeZone ? { timeZone } : {}) }).format(date);
}

describe('PostCard & PostCardSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  const mockPost: Post = {
    id: 'post-1',
    accountId: 'fest_org_1',
    content: 'Get ready for the biggest music festival of the year! Details soon. #festival #music',
    imageUrl: 'https://example.com/banner.jpg',
    postUrl: 'https://instagram.com/p/12345',
    originalPostUrl: 'https://instagram.com/p/12345',
    isExtracted: false,
    publishedAt: '2026-08-12T15:30:00Z',
  };

  it('renders text content, publisher name, and platform icon or label', () => {
    const publisher = {
      displayName: 'Festival Organizer',
      platform: 'instagram',
      profileImageUrl: 'https://example.com/avatar.jpg',
    };

    render(<PostCard post={mockPost} publisher={publisher} />);

    // Text content is rendered
    expect(screen.getByText(/biggest music festival/)).toBeInTheDocument();

    // Publisher name is rendered
    expect(screen.getByText('Festival Organizer')).toBeInTheDocument();

    // Platform is displayed
    expect(screen.getByText('instagram')).toBeInTheDocument();

    // Avatar image is rendered
    const avatar = screen.getByRole('img', { name: 'Festival Organizer' });
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Post image is rendered
    const postImg = screen.getByRole('img', { name: 'Post media' });
    expect(postImg).toBeInTheDocument();
    expect(postImg).toHaveAttribute('src', 'https://example.com/banner.jpg');
  });

  it('falls back to accountId and url-inferred platform if publisher info is missing', () => {
    render(<PostCard post={mockPost} />);

    // Publisher name falls back to accountId with @ prefix
    expect(screen.getByText('@fest_org_1')).toBeInTheDocument();

    // Platform is inferred from postUrl (instagram.com -> instagram)
    expect(screen.getByText('instagram')).toBeInTheDocument();
  });

  it('gracefully formats the publishedAt timestamp using scoped locale and timezone', () => {
    const dateObj = new Date(mockPost.publishedAt);

    // Context formatting (locale="id", timezone="Asia/Jakarta")
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <PostCard post={mockPost} />
      </ScopedLocaleProvider>
    );

    expect(screen.getByText(expectedDate('id', dateObj, 'Asia/Jakarta'))).toBeInTheDocument();
  });

  it('lets an explicit locale and timezone override scoped context', () => {
    const dateObj = new Date(mockPost.publishedAt);

    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <PostCard post={mockPost} locale="en-US" timezone="UTC" />
      </ScopedLocaleProvider>
    );

    expect(screen.getByText(expectedDate('en-US', dateObj, 'UTC'))).toBeInTheDocument();
  });

  it('degrades gracefully to locale-only or en-US format when invalid timezone or locale is supplied', () => {
    const dateObj = new Date(mockPost.publishedAt);

    render(
      <PostCard post={mockPost} locale="en-US" timezone="Invalid_Timezone" />
    );

    // Degrades to locale-only timezone-less rendering
    expect(screen.getByText(expectedDate('en-US', dateObj))).toBeInTheDocument();
  });

  it('renders stylized image fallback on image onError trigger', () => {
    render(<PostCard post={mockPost} labels={{ imageFallbackAlt: 'Failed image load' }} />);

    const postImg = screen.getByRole('img', { name: 'Post media' });
    expect(postImg).toBeInTheDocument();

    // Trigger onError
    fireEvent.error(postImg);

    // The image should be removed, replaced with the fallback text
    expect(postImg).not.toBeInTheDocument();
    expect(screen.getByText('Failed image load')).toBeInTheDocument();
  });

  it('adapts gracefully and does not render image block if no image is present', () => {
    const noImgPost = { ...mockPost, imageUrl: undefined };
    render(<PostCard post={noImgPost} />);

    // No image elements rendered
    expect(screen.queryByRole('img', { name: 'Post media' })).not.toBeInTheDocument();
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();
  });

  it('selection behavior: toggles and triggers onSelectionChange with checkbox click', () => {
    const onSelectionChange = vi.fn();
    render(<PostCard post={mockPost} isSelected={false} onSelectionChange={onSelectionChange} />);

    // Checkbox is rendered
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    // Toggle by clicking card
    fireEvent.click(screen.getByRole('article'));
    expect(onSelectionChange).toHaveBeenCalledWith(true);

    // Toggle by clicking checkbox directly
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenLastCalledWith(true);
  });

  it('disabled behavior: greys out card, disables checkbox, and prevents callbacks', () => {
    const onSelectionChange = vi.fn();
    render(
      <PostCard post={mockPost} isSelected={false} onSelectionChange={onSelectionChange} disabled={true} />
    );

    const card = screen.getByRole('article');
    expect(card).toHaveClass('opacity-60', 'grayscale', 'cursor-not-allowed');

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    // Click card
    fireEvent.click(card);
    expect(onSelectionChange).not.toHaveBeenCalled();

    // Click checkbox
    fireEvent.click(checkbox);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('loading state: PostCardSkeleton renders correct loading layout', () => {
    render(<PostCardSkeleton loadingLabel="Loading post skeleton" />);

    const skeleton = screen.getByRole('article', { name: 'Loading post skeleton' });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveClass('animate-pulse');
  });
});
