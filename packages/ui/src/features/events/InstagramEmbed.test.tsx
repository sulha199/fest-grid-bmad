import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { InstagramEmbed } from './InstagramEmbed';

describe('InstagramEmbed', () => {
  beforeEach(() => {
    // Reset any script tags/globals injected by a previous test's idempotent script-loading.
    document.querySelectorAll('script[src*="instagram.com/embed.js"]').forEach((el) => el.remove());
    delete (window as any).instgrm;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders a layout-stable loading state before the embed becomes ready', () => {
    render(
      <InstagramEmbed
        status="AVAILABLE"
        html="<blockquote class='instagram-media'>post</blockquote>"
        eventName="Test Event"
      />
    );

    const region = screen.getByRole('region', { name: 'Embedded post' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('instagram-embed-loading')).toBeInTheDocument();
  });

  it('injects the embed.js script exactly once and calls Embeds.process() when AVAILABLE', async () => {
    const processMock = vi.fn();

    render(
      <InstagramEmbed
        status="AVAILABLE"
        html="<blockquote class='instagram-media'>post</blockquote>"
        eventName="Test Event"
      />
    );

    const script = document.querySelector<HTMLScriptElement>('script[src*="instagram.com/embed.js"]');
    expect(script).not.toBeNull();

    // Simulate the script finishing its load and exposing window.instgrm, then firing 'load'.
    (window as any).instgrm = { Embeds: { process: processMock } };
    script?.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(processMock).toHaveBeenCalledTimes(1);
    });

    // A second AVAILABLE embed must not inject a second script tag.
    render(
      <InstagramEmbed
        status="AVAILABLE"
        html="<blockquote class='instagram-media'>post 2</blockquote>"
        eventName="Test Event 2"
      />
    );
    const scripts = document.querySelectorAll('script[src*="instagram.com/embed.js"]');
    expect(scripts.length).toBe(1);
  });

  it('reveals the embed once the widget script injects an iframe', async () => {
    render(
      <InstagramEmbed
        status="AVAILABLE"
        html="<blockquote class='instagram-media'>post</blockquote>"
        eventName="Test Event"
      />
    );

    const contentContainer = screen.getByTestId('instagram-embed-content');
    const iframe = document.createElement('iframe');
    contentContainer.appendChild(iframe);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Embedded post' })).toHaveAttribute('aria-busy', 'false');
    });
    expect(screen.queryByTestId('instagram-embed-loading')).not.toBeInTheDocument();
  });

  it('renders the "content no longer available" state when UNAVAILABLE with no durableImageUrl', () => {
    render(
      <InstagramEmbed
        status="UNAVAILABLE"
        html={null}
        durableImageUrl={null}
        eventName="Test Event"
      />
    );

    expect(screen.getByTestId('instagram-embed-unavailable')).toBeInTheDocument();
    expect(screen.getByText('This content is no longer available')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Embedded post' })).toBeInTheDocument();
  });

  it('composes the existing EventImage fallback when UNAVAILABLE with a durableImageUrl (opted-in)', () => {
    render(
      <InstagramEmbed
        status="UNAVAILABLE"
        html={null}
        durableImageUrl="https://example.com/durable.jpg"
        durableImageAlt="Durable alt text"
        eventName="Test Event"
      />
    );

    const img = screen.getByRole('img', { name: 'Durable alt text' });
    expect(img).toHaveAttribute('src', 'https://example.com/durable.jpg');
    expect(screen.queryByTestId('instagram-embed-unavailable')).not.toBeInTheDocument();
  });

  it('honors label overrides for loading, unavailable, and region announcements', () => {
    render(
      <InstagramEmbed
        status="UNAVAILABLE"
        html={null}
        durableImageUrl={null}
        eventName="Test Event"
        labels={{
          contentNoLongerAvailableLabel: 'Post removed',
          embedLoadingLabel: 'Custom loading',
          embedRegionLabel: 'Custom embed region',
        }}
      />
    );

    expect(screen.getByText('Post removed')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Custom embed region' })).toBeInTheDocument();
  });

  it('does not independently render a profileImageUrl anywhere in its output', () => {
    const { container } = render(
      <InstagramEmbed
        status="UNAVAILABLE"
        html={null}
        durableImageUrl="https://example.com/durable.jpg"
        eventName="Test Event"
      />
    );

    // The only <img> present must be the durableImageUrl fallback, never a profile photo.
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('src')).toBe('https://example.com/durable.jpg');
    });
  });
});
