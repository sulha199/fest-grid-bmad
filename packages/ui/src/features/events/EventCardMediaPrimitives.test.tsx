/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  EventCardMediaSlot,
  EventCardFavoriteBadge,
  EventCardDateBox,
  EventCardStatusBadge,
  EventCardNearbyBadge,
} from './EventCardMediaPrimitives';
import {
  EVENT_CARD_BADGE_ICON_SCALE_LARGE,
  EVENT_CARD_BADGE_ICON_SCALE_DEFAULT,
  EVENT_CARD_BADGE_FONT_SIZE,
  EVENT_CARD_BADGE_FONT_SIZE_VAR,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
  eventCardBadgeIconSizeStyle,
} from './event-card-media-tokens';

// Built independently from the raw exported constants, not by calling
// eventCardBadgeIconSizeStyle itself -- so a wrong formula inside that function
// (wrong ratio, wrong var name, wrong operator) actually fails these assertions
// instead of trivially matching them by construction.
function expectedIconSize(ratio: number): string {
  return `calc(var(${EVENT_CARD_BADGE_FONT_SIZE_VAR},${EVENT_CARD_BADGE_FONT_SIZE})*${ratio})`;
}

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
    const largeStyle = eventCardBadgeIconSizeStyle('large');
    const expected = expectedIconSize(EVENT_CARD_BADGE_ICON_SCALE_LARGE);
    expect(largeStyle.width).toBe(expected);
    expect(largeStyle.height).toBe(expected);
  });

  it('uses a distinct, smaller ratio for the default scale (close to EventCard current 20px corner heart)', () => {
    const defaultRatio = EVENT_CARD_BADGE_ICON_SCALE_DEFAULT;
    expect(defaultRatio).toBeLessThan(EVENT_CARD_BADGE_ICON_SCALE_LARGE);
    expect(12 * defaultRatio).toBeCloseTo(20, 4);

    const defaultStyle = eventCardBadgeIconSizeStyle('default');
    const expected = expectedIconSize(defaultRatio);
    expect(defaultStyle.width).toBe(expected);
    expect(defaultStyle.height).toBe(expected);
  });

  // Regression test for the bug this fix addresses: the icon size used to be built as a
  // Tailwind arbitrary-value class via runtime string interpolation
  // (`w-[calc(var(...)*ratio)]`), which Tailwind's static content scanner can never see,
  // so no CSS rule was ever generated for it — the icon silently fell back to lucide's
  // default 24x24 regardless of scale. Asserting the *inline style* actually reaches the
  // SVG element (not just that a class string contains the right substring) is what would
  // have caught that.
  it('renders a large badge whose icon carries the calibrated size as an inline style', () => {
    render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    const heart = screen.getByRole('button').querySelector('svg');
    expect(heart).not.toBeNull();
    const expected = expectedIconSize(EVENT_CARD_BADGE_ICON_SCALE_LARGE);
    expect(heart?.style.width).toBe(expected);
    expect(heart?.style.height).toBe(expected);
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

  // Regression test: a `layout="flex-fill"` slot inherits its height from whatever row
  // it's stretched to match (e.g. a short date box), which can be shorter than the badge's
  // own min-h-11 above -- without a minHeight floor on this wrapper, the badge overflows
  // and gets clipped by the slot's own overflow-hidden (`slotRoot`'s className).
  it('never lets the large-badge wrapper be shorter than the badge\'s own min-h-11 touch target', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />);
    const badge = container.querySelector('button');
    const wrapper = badge?.parentElement as HTMLElement;
    expect(wrapper.style.minHeight).toBe(`${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem`);
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

// Story 1.i1i AC6 — both new badge primitives are presentation-only. These blocks pin the two
// DESIGN.md status_badge shapes (neutral base + the single happening_now emerald exception), the
// self-gating `<8km` nearby contract, and the non-interactive rule that keeps them from adding a
// second focus stop to EventCard's poster/media link.
describe('EventCardStatusBadge - AC1/AC6 (two DESIGN.md shapes, non-interactive)', () => {
  afterEach(() => cleanup());

  const NEUTRAL_STATES = [
    'Ended',
    'Ends Today',
    'In 4 hour(s)',
    'Tomorrow',
    'Wednesday',
    'In 7 days',
    'Upcoming',
  ];

  it.each(NEUTRAL_STATES)('renders the "%s" state with the shared neutral base shape', (text) => {
    const { container } = render(<EventCardStatusBadge text={text} />);
    const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveClass('bg-muted');
    expect(badge).toHaveClass('text-muted-foreground');
    expect(badge).not.toHaveClass('bg-emerald-600');
    expect(badge).not.toHaveClass('text-white');
  });

  it('renders happeningNow with the emerald DESIGN.md exception instead of the neutral base', () => {
    const { container } = render(<EventCardStatusBadge text="Happening Now" isHappeningNow />);
    const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    expect(badge).toHaveTextContent('Happening Now');
    expect(badge).toHaveClass('bg-emerald-600');
    expect(badge).toHaveClass('text-white');
    expect(badge).not.toHaveClass('bg-muted');
    expect(badge).not.toHaveClass('text-muted-foreground');
  });

  it('defaults isHappeningNow to false, so the neutral base needs no explicit prop', () => {
    const { container } = render(<EventCardStatusBadge text="Upcoming" />);
    const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    expect(badge).toHaveClass('bg-muted');
  });

  it('keeps one shared geometry across both variants (only color differs per state)', () => {
    // Strips only the four color utilities that distinguish the two DESIGN.md shapes, so any
    // geometry drift between the neutral and emerald variants fails here.
    const COLOR_CLASSES = ['bg-muted', 'text-muted-foreground', 'bg-emerald-600', 'text-white'];
    const shapeOf = (className: string) => className.split(' ').filter((c) => !COLOR_CLASSES.includes(c));

    const { container, rerender } = render(<EventCardStatusBadge text="Upcoming" />);
    const neutral = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    const neutralShape = shapeOf(neutral.className);

    rerender(<EventCardStatusBadge text="Happening Now" isHappeningNow />);
    const happening = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    const happeningShape = shapeOf(happening.className);

    expect(neutralShape).toEqual(happeningShape);
    expect(neutralShape).toContain('text-xs');
    expect(neutralShape).toContain('shrink-0');
  });

  it('stays non-interactive: no aria-label, no title/tooltip, no extra focus stop', () => {
    const { container } = render(<EventCardStatusBadge text="Happening Now" isHappeningNow />);
    const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('aria-label')).toBeNull();
    expect(badge.getAttribute('title')).toBeNull();
    expect(badge.getAttribute('tabindex')).toBeNull();
    expect(badge.getAttribute('role')).toBeNull();
    expect(container.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });
});

describe('EventCardNearbyBadge - AC1/AC2/AC6 (self-gating <8km, non-interactive)', () => {
  afterEach(() => cleanup());

  it('renders at 7.99km (just inside the corrected `<8km` gate) with the Navigation icon', () => {
    const { container } = render(<EventCardNearbyBadge distanceKm={7.99} />);
    const badge = container.querySelector('[data-event-card-nearby-badge]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('Nearby');
    expect(badge).toHaveClass('bg-secondary');
    expect(badge).toHaveClass('text-secondary-foreground');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it.each([8, 8.01, 25])('renders nothing at %skm (at or past the gate) - omitted, never a placeholder', (km) => {
    const { container } = render(<EventCardNearbyBadge distanceKm={km} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the distance is unknown (null or omitted)', () => {
    const { container, rerender } = render(<EventCardNearbyBadge distanceKm={null} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

    rerender(<EventCardNearbyBadge />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
  });

  it('renders at 0km (the caller passes distance only - never a precomputed showNearbyBadge boolean)', () => {
    const { container } = render(<EventCardNearbyBadge distanceKm={0} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
  });

  it('self-gates on its own default threshold; only a caller-level thresholdKm override changes it', () => {
    const { container, rerender } = render(<EventCardNearbyBadge distanceKm={9} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

    // EventCardProps.nearbyBadgeThreshold forwards through this one additive prop only.
    rerender(<EventCardNearbyBadge distanceKm={9} thresholdKm={10} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();

    rerender(<EventCardNearbyBadge distanceKm={3} thresholdKm={2} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
  });

  it('defaults the label to "Nearby" and accepts the EventCardLabels.nearbyBadge override', () => {
    const { container, rerender } = render(<EventCardNearbyBadge distanceKm={1} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('Nearby');

    rerender(<EventCardNearbyBadge distanceKm={1} labels={{ nearbyBadge: 'Dekat' }} />);
    const badge = container.querySelector('[data-event-card-nearby-badge]') as HTMLElement;
    expect(badge).toHaveTextContent('Dekat');
    expect(badge).not.toHaveTextContent('Nearby');
  });

  it('stays non-interactive: no aria-label, no title/tooltip, no extra focus stop', () => {
    const { container } = render(<EventCardNearbyBadge distanceKm={1} />);
    const badge = container.querySelector('[data-event-card-nearby-badge]') as HTMLElement;
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('aria-label')).toBeNull();
    expect(badge.getAttribute('title')).toBeNull();
    expect(badge.getAttribute('tabindex')).toBeNull();
    expect(container.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });
});
