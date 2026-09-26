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

    it('does not render a status badge in the with-image composition', () => {
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(screen.queryByText(/upcoming/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/happening now/i)).not.toBeInTheDocument();
    });

    it('falls back to the no-image (two-row) composition when a multi-day image errors', () => {
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
      expect(container.firstChild).toHaveClass('flex-col');
    });
  });

  describe('No-image composition (single-day, or multi-day without an image)', () => {
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

  describe('Status badge (BUG-048, AC-STATUS-1)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders no status badge when eventStartDate is omitted (e.g. CalendarOverflowDialog, not yet amended)', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      expect(document.querySelector('[data-event-card-status-badge]')).toBeNull();
    });

    it('renders no status badge in the with-image composition either, when eventStartDate is omitted', () => {
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toBeNull();
    });

    it('renders the happeningNow state with the emerald treatment', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          eventStartDate="2026-08-05"
          eventStartTime="00:00:00"
          eventEndDate="2026-08-07"
          eventEndTime="23:00:00"
          timezone="UTC"
        />
      );
      const badge = document.querySelector('[data-event-card-status-badge]') as HTMLElement;
      expect(badge).toHaveTextContent('Now');
      expect(badge).toHaveClass('bg-emerald-600');
    });

    it('renders the Ended state', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T15:00:00Z'));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          eventStartDate="2026-08-05"
          eventStartTime="09:00:00"
          eventEndDate="2026-08-05"
          eventEndTime="10:00:00"
          timezone="UTC"
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Ended');
    });

    it('renders the Ends Today state', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          eventStartDate="2026-08-05"
          eventStartTime="09:00:00"
          eventEndDate="2026-08-05"
          eventEndTime="23:00:00"
          timezone="UTC"
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Ends Today');
    });

    it('renders the In {n} hour(s) state', () => {
      // `combineDateTime` always builds the start instant from the machine's local wall clock
      // (it ignores the `timezone` prop), so "now" is set the same way here — both anchor to
      // the same local calendar day/hour arithmetic regardless of the actual host timezone.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 5, 10, 0, 0));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          eventStartDate="2026-08-05"
          eventStartTime="13:00:00"
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('In 3 hour(s)');
    });

    it('renders the Tomorrow state', () => {
      // A date-only `eventStartDate`/no `eventStartTime` sits on an exact one-day boundary with
      // zero slack, so `timezone` must be pinned — otherwise the host machine's local offset can
      // shift which calendar day the comparison lands on and flip this to a different state.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(<EventCardCalendarGridItem {...defaultProps} eventStartDate="2026-08-06" timezone="UTC" />);
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Tomorrow');
    });

    it('renders a weekday name 2-6 days out', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(<EventCardCalendarGridItem {...defaultProps} eventStartDate="2026-08-08" locale="en-US" timezone="UTC" />);
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Saturday');
    });

    it('renders the In {n} days state 7-13 days out', () => {
      // Pinned for the same reason as the Tomorrow test above — the exact day count asserted
      // here is sensitive to the host machine's local timezone offset without it.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(<EventCardCalendarGridItem {...defaultProps} eventStartDate="2026-08-13" timezone="UTC" />);
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('In 8 days');
    });

    it('renders the Upcoming state 14+ days out', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(<EventCardCalendarGridItem {...defaultProps} eventStartDate="2026-08-25" timezone="UTC" />);
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Upcoming');
    });

    it('renders the status badge in the with-image composition too', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
          eventStartDate="2026-08-25"
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Upcoming');
    });

    it('respects caller-supplied statusLabels overrides', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          eventStartDate="2026-08-25"
          statusLabels={{ statusUpcoming: 'Mendatang' }}
        />
      );
      expect(document.querySelector('[data-event-card-status-badge]')).toHaveTextContent('Mendatang');
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
});
