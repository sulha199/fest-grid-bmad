/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EventCardMediaSlot, EventCardFavoriteBadge, EventCardDateBox } from './EventCardMediaPrimitives';
import {
  EVENT_CARD_BADGE_ICON_SCALE_LARGE,
  EVENT_CARD_BADGE_ICON_SCALE_DEFAULT,
  EVENT_CARD_BADGE_FONT_SIZE,
  eventCardBadgeIconSizeClass,
} from './event-card-media-tokens';

function slotRoot(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-event-card-media-slot]');
  if (!el) throw new Error('media slot root not found');
  return el as HTMLElement;
}

// Story 1.i1z CI ratchet — AD-15 Rule 1 / AC1 (primitive's own shape half of the proof):
// these className-shape assertions fail if the primitive's own layout classes regress.
// This block is part of the Story 1.i1z ratchet; weakening/deleting it is a deliberate, visible act.
describe('EventCardMediaSlot - AC1 (dimensions come from the surrounding chrome, never the image)', () => {
  afterEach(() => cleanup());

  it('renders the flex-fill (masonry) className shape when layout="flex-fill"', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" />);
    const cls = slotRoot(container).className;
    expect(cls).toContain('flex-1');
    expect(cls).toContain('h-full');
    expect(cls).toContain('min-w-0');
  });

  it('renders the fixed-square (compact) className shape when layout="fixed-square"', () => {
    const { container } = render(<EventCardMediaSlot layout="fixed-square" imageUrl="/a.jpg" />);
    const cls = slotRoot(container).className;
    expect(cls).toContain('w-16');
    expect(cls).toContain('h-16');
    expect(cls).toContain('shrink-0');
  });

  it('declares the shared badge-font-size custom property on the slot root', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" />);
    expect(slotRoot(container).style.getPropertyValue('--event-card-badge-font-size')).toBe(
      EVENT_CARD_BADGE_FONT_SIZE
    );
  });
});

describe('EventCardFavoriteBadge - AC2 (icon size derives from the shared token, calibrated off text-xs)', () => {
  afterEach(() => cleanup());

  it('calibrates the large scale to exactly 2x (24px / 12px text-xs), per DESIGN.md', () => {
    expect(EVENT_CARD_BADGE_ICON_SCALE_LARGE).toBe(2);
    const largeIconClass = eventCardBadgeIconSizeClass('large');
    expect(largeIconClass).toContain('*2');
    expect(largeIconClass).toContain('var(--event-card-badge-font-size');
  });

  it('uses a distinct, smaller ratio for the default scale (close to EventCard current 20px corner heart)', () => {
    const defaultRatio = EVENT_CARD_BADGE_ICON_SCALE_DEFAULT;
    expect(defaultRatio).toBeLessThan(EVENT_CARD_BADGE_ICON_SCALE_LARGE);
    expect(12 * defaultRatio).toBeCloseTo(20, 4);

    const largeIconClass = eventCardBadgeIconSizeClass('large');
    const defaultIconClass = eventCardBadgeIconSizeClass('default');
    expect(defaultIconClass).not.toBe(largeIconClass);
  });

  it('renders a large badge whose icon spans the full calibrated size', () => {
    render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    const heart = screen.getByRole('button').querySelector('svg');
    expect(heart).not.toBeNull();
    // jsdom returns an SVGAnimatedString for svg.className, so read the class attribute.
    expect(heart?.getAttribute('class')).toContain('*2');
  });
});

// Story 1.i1z CI ratchet — AD-15 Rule 2 / AC2+AC3: these blank-reserved + onError-switch assertions
// fail if a placeholder icon/text or an unreserved (reflowing) fallback is reintroduced into the
// primitive. This block is part of the Story 1.i1z ratchet.
describe('EventCardMediaSlot fallback - AC3 (reserved blank, no placeholder icon/text)', () => {
  afterEach(() => cleanup());

  it('renders no image, no placeholder text, and no filler in the slot when imageUrl is absent', () => {
    render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText(/no image available/i)).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders nothing at all in the slot when both imageUrl and onFavoriteToggle are absent', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(screen.queryByText(/no image available/i)).toBeNull();
  });

  it('switches to the reserved-blank fallback when the image onError fires', () => {
    render(<EventCardMediaSlot layout="flex-fill" imageUrl="/broken.jpg" onFavoriteToggle={vi.fn()} />);
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText(/no image available/i)).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

describe('EventCardMediaSlot - AC4 (one live favorite-toggle control, adequate tap target, no extra focus stop)', () => {
  afterEach(() => cleanup());

  it('renders exactly one focusable element per slot regardless of layout/error state', () => {
    const { container, rerender } = render(
      <EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" onFavoriteToggle={vi.fn()} />
    );
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(1);

    rerender(<EventCardMediaSlot layout="fixed-square" onFavoriteToggle={vi.fn()} />);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(1);
  });

  it('gives the large fallback badge a real min-h-11 min-w-11 (>=44px) tap target', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    const badge = container.querySelector('button');
    expect(badge?.className).toContain('min-h-11');
    expect(badge?.className).toContain('min-w-11');
  });

  it('keeps the large badge the same reachable favorite-toggle control as the small one', () => {
    const { container, rerender } = render(
      <EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" onFavoriteToggle={vi.fn()} isFavorited />
    );
    const smallBadge = container.querySelector('button');
    expect(smallBadge).not.toBeNull();
    expect(smallBadge?.getAttribute('aria-label')).toBe('Toggle favorite');

    rerender(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    const largeBadge = container.querySelector('button');
    expect(largeBadge).not.toBeNull();
    expect(largeBadge?.getAttribute('aria-label')).toBe('Toggle favorite');
  });
});

describe('EventCardFavoriteBadge - AC5 (i18n label plumbing matching EventCard convention)', () => {
  afterEach(() => cleanup());

  it('falls back to the English default "Toggle favorite" when no label is provided', () => {
    render(<EventCardFavoriteBadge scale="default" onFavoriteToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
  });

  it('accepts the same favoriteToggle override shape as EventCardLabels', () => {
    render(
      <EventCardFavoriteBadge
        scale="large"
        onFavoriteToggle={vi.fn()}
        labels={{ favoriteToggle: 'Favoritkan' }}
      />
    );
    expect(screen.getByRole('button', { name: 'Favoritkan' })).toBeInTheDocument();
  });
});

describe('EventCardMediaSlot additive props (Story 1.i1e)', () => {
  afterEach(() => cleanup());

  it('hideFavoriteBadge suppresses the internal badge in both branches even when onFavoriteToggle is provided', () => {
    const { container: imagePresentContainer } = render(
      <EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" onFavoriteToggle={vi.fn()} hideFavoriteBadge />
    );
    expect(imagePresentContainer.querySelector('button')).toBeNull();

    const { container: fallbackContainer } = render(
      <EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} hideFavoriteBadge />
    );
    expect(fallbackContainer.querySelector('button')).toBeNull();
    expect(fallbackContainer.querySelector('img')).toBeNull();
  });

  it('renders the internal badge normally when hideFavoriteBadge is omitted (defaults falsy)', () => {
    const { container } = render(
      <EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" onFavoriteToggle={vi.fn()} />
    );
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('fires onImagePresenceChange(true) on mount with a valid imageUrl, then false after the img onError fires', () => {
    const onImagePresenceChange = vi.fn();
    const { container } = render(
      <EventCardMediaSlot
        layout="flex-fill"
        imageUrl="/a.jpg"
        onFavoriteToggle={vi.fn()}
        onImagePresenceChange={onImagePresenceChange}
      />
    );
    // Initial mount value, before any error.
    expect(onImagePresenceChange).toHaveBeenCalledWith(true);

    const img = container.querySelector('img');
    fireEvent.error(img as HTMLImageElement);
    expect(onImagePresenceChange).toHaveBeenLastCalledWith(false);
  });

  it('fires onImagePresenceChange(false) on mount when no imageUrl is provided', () => {
    const onImagePresenceChange = vi.fn();
    render(
      <EventCardMediaSlot
        layout="flex-fill"
        onFavoriteToggle={vi.fn()}
        onImagePresenceChange={onImagePresenceChange}
      />
    );
    expect(onImagePresenceChange).toHaveBeenCalledWith(false);
  });
});

describe('EventCardDateBox', () => {
  afterEach(() => cleanup());

  it('renders the caller already-formatted children unchanged (no locale re-formatting)', () => {
    render(<EventCardDateBox>12 Oct</EventCardDateBox>);
    expect(screen.getByText('12 Oct')).toBeInTheDocument();
  });

  it('uses the text-xs shape and declares the badge-font-size source for the icon token', () => {
    const { container } = render(<EventCardDateBox>12 Oct</EventCardDateBox>);
    const box = container.querySelector('[data-event-card-date-box]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.className).toContain('text-xs');
    expect(box.style.getPropertyValue('--event-card-badge-font-size')).toBe(EVENT_CARD_BADGE_FONT_SIZE);
  });
});

});
