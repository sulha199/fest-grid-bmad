/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  EventCardMediaSlot,
  EventCardFavoriteBadge,
  EventCardDateBox,
  EventCardStatusBadge,
  EventCardNearbyBadge,
  eventCardTillLabelClass,
  EVENT_CARD_BADGE_TEXT_SIZE_CLASS,
  EVENT_CARD_CONTAINER_CLASS,
  formatNearbyBadgeDistance,
} from './EventCardMediaPrimitives';
import {
  EVENT_CARD_BADGE_ICON_SCALE_LARGE,
  EVENT_CARD_BADGE_ICON_SCALE_DEFAULT,
  EVENT_CARD_BADGE_FONT_SIZE,
  EVENT_CARD_BADGE_FONT_SIZE_VAR,
  EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
  eventCardBadgeIconSizeStyle,
  eventCardRowFavoriteIconGrowingStyle,
  EVENT_CARD_ROW_FAVORITE_ICON_MIN_PX,
  EVENT_CARD_ROW_FAVORITE_ICON_MAX_PX,
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

  it('declares the size-keyed badge-font-size custom property on the slot root, defaulting to "default" when size is omitted', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" imageUrl="/a.jpg" />);
    expect(slotRoot(container).style.getPropertyValue('--event-card-badge-font-size')).toBe(
      EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE.default
    );
  });

  it('declares the "compact" size variant\'s badge-font-size value when size="compact" is passed', () => {
    const { container } = render(<EventCardMediaSlot layout="fixed-square" size="compact" imageUrl="/a.jpg" />);
    expect(slotRoot(container).style.getPropertyValue('--event-card-badge-font-size')).toBe(
      EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE.compact
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

describe('EventCardMediaSlot collapseOnFallback (Story 1.i1m AC1/AC3)', () => {
  afterEach(() => cleanup());

  it('defaults to false and preserves the exact reserved-blank fallback when omitted (masonry regression guard)', () => {
    const { container } = render(
      <EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />
    );
    // Today's exact reserved-blank behavior: the slot's own root element still mounts,
    // reserving its footprint, with the large favorite badge centered inside it.
    const slot = container.querySelector('[data-event-card-media-slot]');
    expect(slot).not.toBeNull();
    expect(within(slot as HTMLElement).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
  });

  it('renders null (no slot element at all) when collapseOnFallback is true and no imageUrl is provided', () => {
    const { container } = render(
      <EventCardMediaSlot layout="fixed-square" onFavoriteToggle={vi.fn()} collapseOnFallback />
    );
    expect(container.querySelector('[data-event-card-media-slot]')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('removes the slot element entirely (not merely emptied) when collapseOnFallback is true and the image onError fires', () => {
    const { container } = render(
      <EventCardMediaSlot
        layout="fixed-square"
        imageUrl="/broken.jpg"
        onFavoriteToggle={vi.fn()}
        collapseOnFallback
      />
    );
    const slotBeforeError = container.querySelector('[data-event-card-media-slot]');
    expect(slotBeforeError).not.toBeNull();
    const img = slotBeforeError?.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img as HTMLImageElement);

    expect(container.querySelector('[data-event-card-media-slot]')).toBeNull();
  });

  it('keeps the with-image branch byte-identical when collapseOnFallback is true (only the fallback branch changes)', () => {
    const { container } = render(
      <EventCardMediaSlot
        layout="fixed-square"
        imageUrl="/a.jpg"
        onFavoriteToggle={vi.fn()}
        collapseOnFallback
      />
    );
    const slot = container.querySelector('[data-event-card-media-slot]');
    expect(slot).not.toBeNull();
    expect(slot?.querySelector('img')).toHaveAttribute('src', '/a.jpg');
    expect(within(slot as HTMLElement).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();
  });
});

describe('EventCardFavoriteBadge icon/text-size overrides (Story 1.i1m AC5)', () => {
  afterEach(() => cleanup());

  it('uses the ratio-derived default icon size and fixed text-sm when neither override is supplied (masonry/default regression guard)', () => {
    render(<EventCardFavoriteBadge scale="large" onFavoriteToggle={vi.fn()} favoriteCount={3} />);
    const button = screen.getByRole('button', { name: 'Toggle favorite' });
    expect(button.className).toMatch(/\btext-sm\b/);
    const heart = button.querySelector('svg');
    const expected = expectedIconSize(EVENT_CARD_BADGE_ICON_SCALE_LARGE);
    expect(heart?.style.width).toBe(expected);
    expect(heart?.style.height).toBe(expected);
  });

  it('applies iconSizeStyle and largeTextSizeClassName overrides when supplied, replacing the ratio-derived default', () => {
    // A plain px value proves the override-plumbing mechanism itself (this component passes
    // `iconSizeStyle`/`largeTextSizeClassName` straight through, unconditionally replacing its
    // own ratio-derived computation) without round-tripping a `cqi`/`clamp()` value through
    // JSDOM's CSS parser, which — per this story's own AC7 — does not reliably represent
    // container-query units. `eventCardRowFavoriteIconGrowingStyle()`'s own returned object is
    // verified directly (no DOM involved) in the next test below.
    const overrideStyle = { width: '42px', height: '42px' };
    render(
      <EventCardFavoriteBadge
        scale="large"
        onFavoriteToggle={vi.fn()}
        favoriteCount={3}
        iconSizeStyle={overrideStyle}
        largeTextSizeClassName="text-sm [@container(min-width:490px)]:text-base"
      />
    );
    const button = screen.getByRole('button', { name: 'Toggle favorite' });
    expect(button.className).toMatch(/\[@container\(min-width:490px\)\]:text-base\b/);
    const heart = button.querySelector('svg');
    expect(heart?.style.width).toBe(overrideStyle.width);
    expect(heart?.style.height).toBe(overrideStyle.height);
    // Not the ratio-derived default this override replaces.
    expect(heart?.style.width).not.toBe(expectedIconSize(EVENT_CARD_BADGE_ICON_SCALE_LARGE));
  });

  it("eventCardRowFavoriteIconGrowingStyle() returns the calibrated clamp()/cqi formula (Story 1.i1m AC5/AC7)", () => {
    // Pure function, no DOM/JSDOM CSS parsing involved — proves the formula itself is
    // calibrated to the two validated prototype points (36px @ 326px row, 56px @ 655px row)
    // independently of whether JSDOM can represent the resulting string.
    const style = eventCardRowFavoriteIconGrowingStyle();
    const expected = `clamp(${EVENT_CARD_ROW_FAVORITE_ICON_MIN_PX}px, calc(16.2px + 6.08cqi), ${EVENT_CARD_ROW_FAVORITE_ICON_MAX_PX}px)`;
    expect(style.width).toBe(expected);
    expect(style.height).toBe(expected);
    expect(EVENT_CARD_ROW_FAVORITE_ICON_MIN_PX).toBe(36);
    expect(EVENT_CARD_ROW_FAVORITE_ICON_MAX_PX).toBe(56);
  });
});

describe('EventCardDateBox (Story 1.i1k two-tier month/day chrome)', () => {
  afterEach(() => cleanup());

  it('renders the caller already-formatted month/day content in their own dedicated slots', () => {
    const { container } = render(<EventCardDateBox size="default" month="Oct" day="12" />);
    expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('Oct');
    expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('12');
  });

  it.each(['default', 'compact'] as const)(
    'declares the size-keyed badge-font-size value for size="%s" (AC5)',
    (size) => {
      const { container } = render(<EventCardDateBox size={size} month="Oct" day="12" />);
      const box = container.querySelector('[data-event-card-date-box]') as HTMLElement;
      expect(box).not.toBeNull();
      expect(box.style.getPropertyValue('--event-card-badge-font-size')).toBe(
        EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE[size]
      );
    }
  );

  it('DESIGN.md AC1 default size classes: base_default padding/month/day literals', () => {
    const { container } = render(<EventCardDateBox size="default" month="Oct" day="12" />);
    const box = container.querySelector('[data-event-card-date-box]') as HTMLElement;
    expect(box.className).toContain('px-4 py-3');
    expect(box.className).toContain('bg-slate-800');
    expect(container.querySelector('[data-event-card-date-box-month]')?.className).toContain('text-lg font-bold uppercase tracking-wide');
    expect(container.querySelector('[data-event-card-date-box-day]')?.className).toContain('text-5xl font-extrabold leading-none');
  });

  it('DESIGN.md AC1 compact size classes: event_card_compact.date_box padding/month/day literals', () => {
    const { container } = render(<EventCardDateBox size="compact" month="Oct" day="12" />);
    const box = container.querySelector('[data-event-card-date-box]') as HTMLElement;
    expect(box.className).toContain('px-3 py-2');
    expect(box.className).toContain('bg-slate-800');
    expect(container.querySelector('[data-event-card-date-box-month]')?.className).toContain('text-sm font-bold uppercase tracking-wide');
    expect(container.querySelector('[data-event-card-date-box-day]')?.className).toContain('text-3xl font-extrabold leading-none');
  });

  it('renders the amber tillLabel corner tag when provided', () => {
    const { container } = render(<EventCardDateBox size="default" month="Oct" day="12" tillLabel="till" />);
    expect(container.querySelector('[data-event-card-date-box]')).toHaveTextContent('till');
    expect(screen.getByText('till').className).toContain('bg-amber-700');
  });

  it('renders no amber tag element at all when tillLabel is omitted', () => {
    const { container } = render(<EventCardDateBox size="default" month="Oct" day="12" />);
    expect(container.querySelector('.bg-amber-700')).toBeNull();
  });

  describe('day slot sizing (BUG-047 AC-DATE-4, replaces Story 1.i1n\'s dayVariant mechanism)', () => {
    it('size="default": fixed-width classes (tabular-nums + min-w-[2ch]) so 1-digit/2-digit days render the same width', () => {
      const { container } = render(<EventCardDateBox size="default" month="Oct" day="12" />);
      expect(container.querySelector('[data-event-card-date-box-day]')?.className).toBe(
        'inline-block text-center tabular-nums min-w-[2ch] text-5xl font-extrabold leading-none'
      );
    });

    it('size="default" 1-digit day gets the identical class list (and therefore identical rendered width) as a 2-digit day', () => {
      const { container: oneDigit } = render(<EventCardDateBox size="default" month="Oct" day="3" />);
      const { container: twoDigit } = render(<EventCardDateBox size="default" month="Oct" day="23" />);
      expect(oneDigit.querySelector('[data-event-card-date-box-day]')?.className).toBe(
        twoDigit.querySelector('[data-event-card-date-box-day]')?.className
      );
    });

    it('size="compact" (calendar list row) is unaffected -- no width-fix classes, unchanged from before BUG-047', () => {
      const { container } = render(<EventCardDateBox size="compact" month="Oct" day="12" />);
      expect(container.querySelector('[data-event-card-date-box-day]')?.className).toBe(
        'text-3xl font-extrabold leading-none'
      );
    });
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

  it('renders at 7.99km (just inside the corrected `<8km` gate) with the Navigation icon and the real distance (BUG-049)', () => {
    const { container } = render(<EventCardNearbyBadge distanceKm={7.99} />);
    const badge = container.querySelector('[data-event-card-nearby-badge]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('8 km');
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

  it('renders nothing for a non-finite or negative distanceKm (BUG-049 review finding — a caller-side geolocation bug used to be masked by the static "Nearby" text; formatting it now would surface visibly broken text like "NaN km")', () => {
    const { container, rerender } = render(<EventCardNearbyBadge distanceKm={NaN} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

    rerender(<EventCardNearbyBadge distanceKm={Infinity} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

    rerender(<EventCardNearbyBadge distanceKm={-Infinity} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

    rerender(<EventCardNearbyBadge distanceKm={-3} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
  });

  it('falls back to the default formatter when labels.nearbyBadge is explicitly undefined (BUG-049 review finding — a plain object spread would let this crash instead of falling back)', () => {
    const { container } = render(
      <EventCardNearbyBadge distanceKm={1} labels={{ nearbyBadge: undefined }} />
    );
    expect(container.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('1.0 km');
  });

  it('renders at 0km (the caller passes distance only - never a precomputed showNearbyBadge boolean), formatted with 1 decimal (BUG-049 AC-NEARBY-3)', () => {
    const { container } = render(<EventCardNearbyBadge distanceKm={0} />);
    const badge = container.querySelector('[data-event-card-nearby-badge]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('0.0 km');
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

  it('defaults the label to the formatted distance and accepts the EventCardLabels.nearbyBadge function override (BUG-049)', () => {
    const { container, rerender } = render(<EventCardNearbyBadge distanceKm={1} />);
    expect(container.querySelector('[data-event-card-nearby-badge]')).toHaveTextContent('1.0 km');

    rerender(
      <EventCardNearbyBadge distanceKm={1} labels={{ nearbyBadge: (km) => `Dekat ${km}` }} />
    );
    const badge = container.querySelector('[data-event-card-nearby-badge]') as HTMLElement;
    expect(badge).toHaveTextContent('Dekat 1');
    expect(badge).not.toHaveTextContent('1.0 km');
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

describe('formatNearbyBadgeDistance - BUG-049 AC-NEARBY-3 (decimal-precision boundary)', () => {
  it('renders round numbers >= 2km with no decimal place', () => {
    expect(formatNearbyBadgeDistance(5)).toBe('5 km');
    expect(formatNearbyBadgeDistance(7.99)).toBe('8 km');
  });

  it('renders exactly 2.0km with no decimal place (the >=2 branch includes the boundary itself)', () => {
    expect(formatNearbyBadgeDistance(2)).toBe('2 km');
  });

  it('renders sub-2km distances with exactly 1 decimal place', () => {
    expect(formatNearbyBadgeDistance(1.2)).toBe('1.2 km');
    expect(formatNearbyBadgeDistance(0)).toBe('0.0 km');
  });

  it('selects the branch off the RAW distance, not any rounded display value (1.95 stays <2, verified: JS float repr. makes (1.95).toFixed(1) === "1.9")', () => {
    // 1.95 never reaches 2km -- it takes the <2 branch. Verified against real JS behavior
    // (not assumed): 1.95 isn't exactly representable in IEEE-754 double, so it's actually
    // stored fractionally below 1.95, and (1.95).toFixed(1) === '1.9', not '2.0'. The point of
    // this test is the BRANCH choice (raw value, always <2 branch here), not a specific digit.
    expect(formatNearbyBadgeDistance(1.95)).toBe('1.9 km');
  });

  it('selects the >=2 branch as soon as the raw distance reaches 2km, even fractionally', () => {
    // 2.05 >= 2, so it takes the no-decimal branch; Math.round(2.05) still lands on 2.
    expect(formatNearbyBadgeDistance(2.05)).toBe('2 km');
  });
});

// ── Story 1.i1l ──────────────────────────────────────────────────────────────
// Rules 4, 5 and 7 of backlog row IDEA-046. These are structural ratchets, not
// rendered-size assertions: JSDOM implements neither container queries nor Tailwind,
// so `getComputedStyle().fontSize` here would report the same value at every width and
// prove nothing. What CAN be proven — and is what the rules actually require — is that
// the two badges resolve from ONE shared token, and that the token is a complete
// literal string Tailwind's content scanner can see.
describe('Story 1.i1l — badge font-size harmonization and the TILL offset context', () => {
  afterEach(() => {
    cleanup();
  });

  it('gives the TILL tag and the favorite pill the identical font-size token (favorite >= TILL at every width)', () => {
    // EXPERIENCE.md § Masonry EventCard Badge Row: "Favorite badge font-size >= TILL badge
    // font-size ... Verified at every real width across all three card families." Asserting
    // both carry the SAME token makes the relation hold at every width by construction --
    // strictly stronger than sampling two widths, and it cannot silently regress the way a
    // pair of independently-declared sizes did before round 8.
    const { container } = render(
      <EventCardDateBox size="default" month="OCT" day="12" tillLabel="till" />
    );
    const till = screen.getByText('till');
    expect(till.className).toContain(EVENT_CARD_BADGE_TEXT_SIZE_CLASS);
    expect(container.querySelector('[data-event-card-date-box]')).not.toBeNull();

    cleanup();

    const { container: favContainer } = render(
      <EventCardFavoriteBadge
        scale="default"
        isFavorited={false}
        favoriteCount={12}
        onFavoriteToggle={() => {}}
      />
    );
    const pill = favContainer.querySelector('button') as HTMLElement;
    expect(pill.className).toContain(EVENT_CARD_BADGE_TEXT_SIZE_CLASS);
  });

  it('keeps the favorite pill at the round-8 padding, not the looser value it removed', () => {
    const { container } = render(
      <EventCardFavoriteBadge
        scale="default"
        isFavorited={false}
        favoriteCount={12}
        onFavoriteToggle={() => {}}
      />
    );
    const pill = container.querySelector('button') as HTMLElement;
    // DESIGN.md § event_card_masonry.thumbnail_default.favorite_badge -- "was a looser
    // `px-2.5 py-1.5` at the desktop real width before this pass."
    expect(pill).toHaveClass('px-1.5');
    expect(pill).toHaveClass('py-1');
    expect(pill).not.toHaveClass('px-2.5');
    expect(pill).not.toHaveClass('py-1.5');
  });

  it('lets the favorite count inherit the pill font-size instead of pinning its own', () => {
    // DESIGN.md: the responsive size is "inherited by the count text". A hardcoded
    // `text-xs` on the count would leave it at 12px while its pill grew to 14px.
    const { container } = render(
      <EventCardFavoriteBadge
        scale="default"
        isFavorited={false}
        favoriteCount={12}
        onFavoriteToggle={() => {}}
      />
    );
    const count = screen.getByText('12');
    expect(count.className).not.toContain('text-xs');
    expect(count.className).not.toContain('text-sm');
  });

  it('offsets the TILL tag by context: -top-1.5 on a two-tier pill, -top-3 on the prominent chip', () => {
    // DESIGN.md § event_card_till_badge, "OFFSET DIFFERS BY CONTEXT". Asserted on the helper
    // directly so both contexts are covered even though only one renders through EventCardDateBox.
    expect(eventCardTillLabelClass('default')).toContain('-top-1.5');
    expect(eventCardTillLabelClass('default')).not.toContain('-top-3');
    expect(eventCardTillLabelClass('prominent')).toContain('-top-3');
    expect(eventCardTillLabelClass('prominent')).not.toContain('-top-1.5');

    // Everything except the vertical offset is identical -- position-only, per the token's
    // own note that an asymmetric-padding fix was tried and explicitly rejected.
    const normalize = (s: string) => s.replace('-top-1.5', 'OFFSET').replace('-top-3', 'OFFSET');
    expect(normalize(eventCardTillLabelClass('default'))).toBe(
      normalize(eventCardTillLabelClass('prominent'))
    );
  });

  it('clears the 11px legibility floor on every badge family the primitives own', () => {
    // EXPERIENCE.md's floor rule. `text-xs` is 12px; the TILL tag's old `text-[10px]` was under it.
    expect(eventCardTillLabelClass('default')).not.toContain('text-[10px]');
    expect(EVENT_CARD_BADGE_TEXT_SIZE_CLASS.startsWith('text-xs')).toBe(true);

    const { container } = render(<EventCardStatusBadge text="Now" isHappeningNow />);
    expect(container.querySelector('[data-event-card-status-badge]')).toHaveClass('text-xs');

    cleanup();
    const { container: nearby } = render(<EventCardNearbyBadge distanceKm={1} />);
    expect(nearby.querySelector('[data-event-card-nearby-badge]')).toHaveClass('text-xs');
  });

  it('keeps both class tokens complete literal strings Tailwind can statically see', () => {
    // The FIND-025 / commit 7bf99260 failure mode: a class assembled by runtime
    // interpolation is invisible to Tailwind's content scanner and emits NO CSS at all.
    // `packages/ui`'s own `no-dynamic-tailwind-arbitrary-value` lint rule (Story 1.i1k)
    // guards the `w-[${expr}]` shape; this pins the two tokens Story 1.i1l added, whose
    // arbitrary variant would fail exactly the same way if it were ever interpolated.
    expect(EVENT_CARD_BADGE_TEXT_SIZE_CLASS).toBe('text-xs [@container(min-width:200px)]:text-sm');
    expect(EVENT_CARD_CONTAINER_CLASS).toBe('[container-type:inline-size]');
  });
});
