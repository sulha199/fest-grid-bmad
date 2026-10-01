/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCardCalendarGridItem } from './EventCardCalendarGridItem';

describe('EventCardCalendarGridItem (Story 1.i1f AC15-16)', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    eventName: 'Summer Music Festival',
    location: 'Central Park',
    isMultiDay: false,
  };

  describe('With-image composition (multi-day, image not errored)', () => {
    it('renders the thumbnail, title, and venue in the 3-column with-image layout', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://img.example/poster.jpg');
      expect(img).toHaveClass('w-14', 'aspect-square', 'object-cover');
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      // 3-column row, items-center per DESIGN.md base token.
      expect(container.firstChild).toHaveClass('flex', 'items-center');
    });

    // User feedback (2026-09-27): the status badge is removed from this card entirely (reverses
    // BUG-048/AC-STATUS-1's adoption) -- the component no longer even accepts
    // eventStartDate/eventEndDate/statusLabels props, so there is no way to make it render.
    it('never renders a status badge, in either composition', () => {
      const { container: withImage } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(withImage.querySelector('[data-event-card-status-badge]')).toBeNull();

      const { container: noImage } = render(<EventCardCalendarGridItem {...defaultProps} />);
      expect(noImage.querySelector('[data-event-card-status-badge]')).toBeNull();
    });

    // User feedback (2026-09-27): "multiple day span no thumbnail: replace the grid layout to
    // use the grid from multiday span with thumbnail, with the thumbnail not displayed" -- a
    // multi-day schedule whose image errors now STAYS in this same 3-column `items-center` row
    // layout, simply without the `<img>` element, instead of falling through to the single-day
    // (VM5) two-row stacked composition.
    it('keeps the multi-day with-image row layout (minus the <img>) when the image errors, instead of falling to the single-day two-row composition', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/broken.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      fireEvent.error(img!);

      expect(container.querySelector('img')).toBeNull();
      expect(container.firstChild).toHaveClass('flex', 'items-center');
      expect(container.firstChild).not.toHaveClass('flex-col');
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
    });

    // BUG-042 (AC-IMG-1): the imageUrl -> imageFallbackUrl -> reserved-blank retry-once chain.
    it('swaps to imageFallbackUrl once when imageUrl errors, and stays in the with-image composition', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/broken.jpg"
          imageFallbackUrl="https://img.example/durable.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      fireEvent.error(img!);

      const swapped = container.querySelector('img');
      expect(swapped).toHaveAttribute('src', 'https://img.example/durable.jpg');
    });

    it('keeps the multi-day with-image row layout (minus the <img>) once both imageUrl and imageFallbackUrl error', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/broken.jpg"
          imageFallbackUrl="https://img.example/also-broken.jpg"
        />
      );

      const img = container.querySelector('img');
      fireEvent.error(img!);
      const swapped = container.querySelector('img');
      expect(swapped).not.toBeNull();
      fireEvent.error(swapped!);

      expect(container.querySelector('img')).toBeNull();
      expect(container.firstChild).toHaveClass('flex', 'items-center');
      expect(container.firstChild).not.toHaveClass('flex-col');
    });

    // Code-review fix (BUG-042 loopback): the original cut only wired the fallback into
    // `onError`, so a multi-day schedule with no `imageUrl` at all from the first render never
    // attempted `imageFallbackUrl` and fell straight to the no-image composition.
    it('attempts imageFallbackUrl directly when imageUrl is absent, staying in the with-image composition', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl={undefined}
          imageFallbackUrl="https://img.example/durable.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://img.example/durable.jpg');
    });

    it('keeps the multi-day with-image row layout (minus the <img>) if the imageUrl-absent fallback itself errors', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl={undefined}
          imageFallbackUrl="https://img.example/also-broken.jpg"
        />
      );

      const img = container.querySelector('img');
      fireEvent.error(img!);

      expect(container.querySelector('img')).toBeNull();
      expect(container.firstChild).toHaveClass('flex', 'items-center');
      expect(container.firstChild).not.toHaveClass('flex-col');
    });

    // Code-review fix (BUG-042 loopback): without the `imageFallbackUrl !== currentImgSrc`
    // guard, an identical fallback URL would be a no-op `setState`, `onError` would never
    // refire, and `showImage` would stay `true` on a permanently broken `<img>`.
    it('keeps the multi-day with-image row layout (minus the <img>) when imageFallbackUrl equals imageUrl, instead of getting stuck', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/same.jpg"
          imageFallbackUrl="https://img.example/same.jpg"
        />
      );

      const img = container.querySelector('img');
      fireEvent.error(img!);

      expect(container.querySelector('img')).toBeNull();
      expect(container.firstChild).toHaveClass('flex', 'items-center');
      expect(container.firstChild).not.toHaveClass('flex-col');
    });
  });

  // User feedback (2026-09-27): this composition is now reachable ONLY by single-day (VM5)
  // schedules -- a multi-day schedule with no usable image uses the with-image row layout
  // instead (minus the `<img>`), see the "With-image composition" describe block above.
  describe('No-image composition (single-day only)', () => {
    it('renders the two-row stacked layout — title/favorite row, then venue/nearby row', () => {
      const { container } = render(<EventCardCalendarGridItem {...defaultProps} />);

      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      expect(container.firstChild).toHaveClass('flex-col');
    });

    it('never renders an image for a single-day event even when imageUrl is supplied', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay={false}
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(container.querySelector('img')).toBeNull();
    });

    it('omits the venue row content entirely when location is absent', () => {
      render(<EventCardCalendarGridItem {...defaultProps} location={undefined} />);
      expect(screen.queryByText('Central Park')).not.toBeInTheDocument();
    });
  });

  describe('Nearby badge (`< nearbyBadgeThreshold` gate, shared with both compositions)', () => {
    it('renders the badge just under 8km with the real distance (BUG-049) and omits it at/past the boundary', () => {
      const { container, rerender } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={7.99} />
      );
      expect(screen.getByText('8 km')).toBeInTheDocument();

      rerender(<EventCardCalendarGridItem {...defaultProps} distanceKm={8} />);
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
    });

    it('delegates to the shared EventCardNearbyBadge primitive (no hand-rolled badge JSX)', () => {
      const { container } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={7.99} />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
    });

    it('respects a caller-supplied nearbyBadgeThreshold override (finding FIND-045)', () => {
      const { container, rerender } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={3} nearbyBadgeThreshold={2} />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

      rerender(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={3} nearbyBadgeThreshold={4} />
      );
      expect(screen.getByText('3 km')).toBeInTheDocument();

      // AC15's gate is strict (`< thresholdKm`), so the override's boundary behaves exactly like
      // the `<8` default's — finding FIND-045 second-review patch (the override test previously
      // only probed 3-vs-2 and 3-vs-4, never the boundary itself).
      rerender(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={4} nearbyBadgeThreshold={4} />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

      rerender(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={3.99} nearbyBadgeThreshold={4} />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).not.toBeNull();
    });

    it('omits the badge when distanceKm is null or undefined', () => {
      const { container, rerender } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={null} />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

      rerender(<EventCardCalendarGridItem {...defaultProps} />);
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
    });

    it('renders the badge in the with-image composition too, with the real distance (BUG-049)', () => {
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
          distanceKm={1}
        />
      );
      expect(screen.getByText('1.0 km')).toBeInTheDocument();
    });
  });

  describe('Favorite toggle', () => {
    it('renders the large favorite control and fires onFavoriteToggle on click', () => {
      const onFavoriteToggle = vi.fn();
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isFavorited
          favoriteCount={12}
          onFavoriteToggle={onFavoriteToggle}
        />
      );

      const button = screen.getByRole('button', { name: 'Toggle favorite' });
      fireEvent.click(button);
      expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('does not render a favorite control when onFavoriteToggle is not provided', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'Toggle favorite' })).not.toBeInTheDocument();
    });
  });

  describe('Title/venue wrap behavior', () => {
    it('title has no truncation class (wraps freely across multiple lines)', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      const title = screen.getByText('Summer Music Festival');
      expect(title).not.toHaveClass('truncate');
      expect(title).not.toHaveClass('line-clamp-1');
      expect(title).not.toHaveClass('line-clamp-2');
    });

    it('venue is clamped to 2 lines', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      const venue = screen.getByText('Central Park');
      expect(venue).toHaveClass('line-clamp-2');
    });
  });

  // ── Story 1.3k Task 7 (AC8) — corner repeat badge ─────────────────────────
  describe('Repeat badge corner (Story 1.3k AC8)', () => {
    it('omits the repeat badge when applicableDaysOfWeek is absent/empty (single-day composition)', () => {
      const { container, rerender } = render(<EventCardCalendarGridItem {...defaultProps} />);
      expect(container.querySelector('[data-event-card-repeat-badge]')).toBeNull();

      rerender(<EventCardCalendarGridItem {...defaultProps} applicableDaysOfWeek={[]} />);
      expect(container.querySelector('[data-event-card-repeat-badge]')).toBeNull();
    });

    it('omits the repeat badge when applicableDaysOfWeek is absent (multi-day/with-image composition)', () => {
      const { container } = render(
        <EventCardCalendarGridItem {...defaultProps} isMultiDay imageUrl="https://img.example/poster.jpg" />
      );
      expect(container.querySelector('[data-event-card-repeat-badge]')).toBeNull();
    });

    it('renders the repeat badge at a distinct corner from the single-day composition when applicableDaysOfWeek is set', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          applicableDaysOfWeek={['MON', 'WED'] as any}
          dayOfWeekLabels={{ MON: 'Monday', WED: 'Wednesday' }}
        />
      );
      const badge = container.querySelector('[data-event-card-repeat-badge]') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge).toHaveClass('absolute', '-bottom-1.5', '-right-1.5');
      const icon = badge.querySelector('svg') as SVGElement;
      expect(icon.getAttribute('aria-label')).toBe('Repeats on Monday, Wednesday');
    });

    it('renders the repeat badge for the multi-day/with-image composition too', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
          applicableDaysOfWeek={['FRI'] as any}
        />
      );
      expect(container.querySelector('[data-event-card-repeat-badge]')).not.toBeNull();
    });

    it("never overlaps the caller's own isAddedToCalendar corner (top-left) -- the repeat badge sits at a different corner (bottom-right)", () => {
      // `isAddedToCalendar`'s CalendarPlus icon is rendered by the CALLER (WeeklyCalendarView.tsx),
      // not this component -- this test only asserts this component's own corner choice never
      // collides with that documented `-top-1.5 -left-1.5` slot.
      const { container } = render(
        <EventCardCalendarGridItem {...defaultProps} applicableDaysOfWeek={['SAT'] as any} />
      );
      const badge = container.querySelector('[data-event-card-repeat-badge]') as HTMLElement;
      expect(badge).not.toHaveClass('-top-1.5');
      expect(badge).not.toHaveClass('-left-1.5');
    });

    it('applies the tooltip via repeatBadgeTooltipVisible, matching EventCardRepeatBadge contract', () => {
      const { container, rerender } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          applicableDaysOfWeek={['SUN'] as any}
          dayOfWeekLabels={{ SUN: 'Sunday' }}
        />
      );
      expect(container.querySelector('[role="tooltip"]')).toBeNull();

      rerender(
        <EventCardCalendarGridItem
          {...defaultProps}
          applicableDaysOfWeek={['SUN'] as any}
          dayOfWeekLabels={{ SUN: 'Sunday' }}
          repeatBadgeTooltipVisible
        />
      );
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip).toHaveTextContent('Repeats on Sunday');
    });
  });
});
