/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventListView } from './EventListView';
import { EventListViewItem } from './EventListView.types';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';

const mockEvents: EventListViewItem[] = [
  {
    id: '1',
    slug: 'summer-fest',
    eventName: 'Summer Fest',
    imageUrl: 'http://example.com/summer.jpg',
    location: 'Central Park',
    categories: ['MUSIC'],
    types: ['FESTIVAL'],
    schedules: [
      {
        isMainSchedule: false,
        eventStartDate: '2026-08-15T18:00:00Z',
        ticketPrice: 40,
      },
      {
        isMainSchedule: true,
        eventStartDate: '2026-08-16T18:00:00Z',
        ticketPrice: 50,
      },
    ],
  },
  {
    id: '2',
    slug: 'winter-fest',
    eventName: 'Winter Fest',
    schedules: [
      {
        isMainSchedule: false,
        eventStartDate: '2026-12-15T18:00:00Z',
        ticketPrice: 20,
      },
    ],
  },
];

describe('EventListView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders loading skeleton grid with default count 6 when status is loading', () => {
    const { container } = render(
      <EventListView
        status="loading"
        events={[]}
        emptyState={<div>Empty</div>}
        getCardProps={() => ({})}
        sentinelRef={vi.fn()}
        isFetchingNextPage={false}
        loadingMoreLabel="Loading more..."
      />
    );

    // Should find skeleton card items (loading={true} causes EventCard to render with aria-busy="true")
    const busyElements = container.querySelectorAll('[aria-busy="true"]');
    expect(busyElements.length).toBe(6);
  });

  it('renders error block with errorMessage and errorDetail when status is error', () => {
    render(
      <EventListView
        status="error"
        events={[]}
        errorMessage="Something went wrong!"
        errorDetail="Database timeout"
        emptyState={<div>Empty</div>}
        getCardProps={() => ({})}
        sentinelRef={vi.fn()}
        isFetchingNextPage={false}
        loadingMoreLabel="Loading more..."
      />
    );

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByText('Database timeout')).toBeInTheDocument();
  });

  it('renders emptyState verbatim when status is success and events is empty', () => {
    render(
      <EventListView
        status="success"
        events={[]}
        emptyState={<div data-testid="custom-empty">No events found</div>}
        getCardProps={() => ({})}
        sentinelRef={vi.fn()}
        isFetchingNextPage={false}
        loadingMoreLabel="Loading more..."
      />
    );

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
    expect(screen.getByText('No events found')).toBeInTheDocument();
  });

  it('renders success grid and derives schedules correctly (main schedule, then fallback)', () => {
    render(
      <EventListView
        status="success"
        events={mockEvents}
        emptyState={<div>Empty</div>}
        getCardProps={() => ({})}
        sentinelRef={vi.fn()}
        isFetchingNextPage={false}
        loadingMoreLabel="Loading more..."
      />
    );

    // Event 1 has mainSchedule (ticketPrice 50, Aug 16)
    expect(screen.getByText('Summer Fest')).toBeInTheDocument();

    // Event 2 has fallback to first schedule (ticketPrice 20, Dec 15)
    expect(screen.getByText('Winter Fest')).toBeInTheDocument();

    // Masonry variant's card body doesn't render priceFrom (it's an
    // intentional, pre-existing EventCard design -- masonry keeps only
    // eventName/locationName in the body), so no price assertions here.
  });

  it('merges card props and prioritizes getCardProps over derived ones', () => {
    render(
      <EventListView
        status="success"
        events={[mockEvents[0]!]}
        emptyState={<div>Empty</div>}
        getCardProps={(event) => ({
          eventName: `Overridden ${event.eventName}`,
          priceFrom: 999,
        })}
        sentinelRef={vi.fn()}
        isFetchingNextPage={false}
        loadingMoreLabel="Loading more..."
      />
    );

    expect(screen.getByText('Overridden Summer Fest')).toBeInTheDocument();
    expect(screen.queryByText('Summer Fest')).not.toBeInTheDocument();

    // Masonry variant's card body doesn't render priceFrom -- see note above.
  });

  it('renders infinite-scroll sentinel and localized spinner when isFetchingNextPage is true', () => {
    const sentinelRef = vi.fn();
    render(
      <EventListView
        status="success"
        events={mockEvents}
        emptyState={<div>Empty</div>}
        getCardProps={() => ({})}
        sentinelRef={sentinelRef}
        isFetchingNextPage={true}
        loadingMoreLabel="Loading more..."
      />
    );

    expect(sentinelRef).toHaveBeenCalled();
    expect(screen.getByText('Loading more...')).toBeInTheDocument();
  });

  describe('masonry and variant behaviors', () => {
    it('renders masonry unconditionally with baseCols=2 and variant="masonry" for Success state', () => {
      const { container } = render(
        <EventListView
          status="success"
          events={mockEvents}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      // Story 0.45: EventListView's grid now uses GridContainer's layout="masonry" JS
      // shortest-column engine (Architecture Spine AD-27), not plain CSS Grid classes — the same
      // baseCols=2/colsStep=1 breakpoint table still applies, just via `useMasonryLayout`'s flex
      // column tracks instead of `grid-cols-*` classes (AC1/AC3/AC6).
      const grid = container.querySelector('[data-grid-container-layout="masonry"]');
      expect(grid).toBeInTheDocument();
      expect(grid?.className).not.toContain('grid-cols');
      const columns = container.querySelectorAll('[data-grid-container-column]');
      expect(columns.length).toBeGreaterThan(0);

      const cardTitle = screen.getByText('Summer Fest');
      const cardContainer = cardTitle.closest('.p-3');
      expect(cardContainer).toBeInTheDocument();
    });

    it('renders masonry unconditionally with baseCols=2 and variant="masonry" for Loading skeleton state', () => {
      const { container } = render(
        <EventListView
          status="loading"
          events={[]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      const grid = container.querySelector('[data-grid-container-layout="masonry"]');
      expect(grid).toBeInTheDocument();
      expect(grid?.className).not.toContain('grid-cols');

      const skeletonImages = container.querySelectorAll('.aspect-\\[3\\/4\\]');
      expect(skeletonImages.length).toBe(6);
    });
  });

  describe('AC16-AC19: end date/time + coordinates threading, prominent poster, distance passthrough, grid spacing', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('threads eventEndDate/eventEndTime from the main schedule into endDate/endTime (TILL badge appears once the event has started and an end is known)', () => {
      // Fixed "now": well after the event's start, same UTC calendar day as its end.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T14:00:00Z'));

      const eventWithEnd: EventListViewItem = {
        id: 'with-end',
        slug: 'with-end',
        eventName: 'Has End',
        schedules: [
          {
            isMainSchedule: true,
            eventStartDate: '2026-01-01T10:00:00Z',
            eventEndDate: '2026-01-01T18:00:00Z',
            eventEndTime: '18:00:00',
          },
        ],
      };

      render(
        <EventListView
          status="success"
          events={[eventWithEnd]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      expect(screen.getByText(/till/i)).toBeInTheDocument();
    });

    it('selects a lone non-main schedule that is still ending today as upcoming (not a past fallback) and threads its end fields too', () => {
      vi.useFakeTimers();
      // "now" is inside this single schedule's day (starts 10:00, ends 18:00 on
      // 2026-01-01, now is 14:00). Its eventEndDate (2026-01-01T18:00:00Z)
      // still compares >= today's date-only string ("2026-01-01"), so under the
      // Story 2.7 algorithm it is selected via the *upcoming* branch — not the
      // all-ended fallback branch. This test pinpoints that distinction and
      // sanity-checks that its end fields are still threaded into the card.
      vi.setSystemTime(new Date('2026-01-01T14:00:00Z'));

      const eventNoMain: EventListViewItem = {
        id: 'no-main',
        slug: 'no-main',
        eventName: 'No Main Schedule',
        schedules: [
          {
            isMainSchedule: false,
            eventStartDate: '2026-01-01T10:00:00Z',
            eventEndDate: '2026-01-01T18:00:00Z',
            eventEndTime: '18:00:00',
          },
        ],
      };

      render(
        <EventListView
          status="success"
          events={[eventNoMain]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      expect(screen.getByText(/till/i)).toBeInTheDocument();
    });

    it('falls back to the earliest-start schedule (all-ended, no main-flagged) for display (real, unmocked Story 2.7 fallback)', () => {
      vi.useFakeTimers();
      // Fixed "now": well after BOTH schedules have fully ended, and neither is
      // main-flagged — so the Story 2.7 algorithm must take the fallback branch
      // (no upcoming, no main) and pick the earliest-start schedule (Schedule A
      // on 2026-01-05), not Schedule B (2026-02-10). This is the genuine
      // fallback-to-first path; the sibling test above only exercises the earlier
      // upcoming-branch selection, which is why this real (unmocked) case exists.
      vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));

      const eventAllEnded: EventListViewItem = {
        id: 'all-ended',
        slug: 'all-ended',
        eventName: 'All End Dates Passed',
        schedules: [
          {
            isMainSchedule: false,
            eventStartDate: '2026-01-05T10:00:00Z',
            eventEndDate: '2026-01-05T18:00:00Z',
          },
          {
            isMainSchedule: false,
            eventStartDate: '2026-02-10T15:00:00Z',
            eventEndDate: '2026-02-10T21:00:00Z',
          },
        ],
      };

      render(
        <ScopedLocaleProvider locale="en-US" timezone="UTC">
          <EventListView
            status="success"
            events={[eventAllEnded]}
            emptyState={<div>Empty</div>}
            getCardProps={() => ({})}
            sentinelRef={vi.fn()}
            isFetchingNextPage={false}
            loadingMoreLabel="Loading more..."
          />
        </ScopedLocaleProvider>
      );

      // The fallback branch must display the earliest-start schedule (A: Jan 5),
      // never Schedule B (Feb 10) — proving the real selection reached the card.
      // Story 1.i1k: month/day now render as separate elements (the two-tier date box),
      // so assert each part rather than a single concatenated "Jan 5" text node.
      expect(screen.getByText('Jan')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.queryByText('Feb')).not.toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
      expect(screen.getByText('All End Dates Passed')).toBeInTheDocument();
    });

    it('does not show a TILL badge when the schedule has no eventEndDate (negative-space check for the endDate/endTime derivation)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T14:00:00Z'));

      const eventNoEnd: EventListViewItem = {
        id: 'no-end',
        slug: 'no-end',
        eventName: 'No End Info',
        schedules: [
          { isMainSchedule: true, eventStartDate: '2026-01-01T10:00:00Z' },
        ],
      };

      render(
        <EventListView
          status="success"
          events={[eventNoEnd]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      expect(screen.queryByText(/till/i)).not.toBeInTheDocument();
    });

    it('derives prominentPoster=true only when durableImageUrl is non-null', () => {
      const withDurable: EventListViewItem = {
        id: 'durable',
        slug: 'durable',
        eventName: 'Durable Poster',
        durableImageUrl: 'http://example.com/durable.jpg',
        schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-16T18:00:00Z' }],
      };
      const withoutDurable: EventListViewItem = {
        id: 'not-durable',
        slug: 'not-durable',
        eventName: 'Not Durable',
        schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-16T18:00:00Z' }],
      };

      const { container } = render(
        <EventListView
          status="success"
          events={[withDurable, withoutDurable]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      const durableCard = screen.getByText('Durable Poster').closest('article');
      const notDurableCard = screen.getByText('Not Durable').closest('article');

      // Story 1.i1l rule 2: the prominent poster's crop is `aspect-square`, not `aspect-[2/3]`.
      expect(durableCard?.querySelector('.aspect-square')).toBeInTheDocument();
      expect(durableCard?.querySelector('.aspect-\\[2\\/3\\]')).not.toBeInTheDocument();
      expect(durableCard?.querySelector('.aspect-\\[3\\/4\\]')).not.toBeInTheDocument();

      // prominentPoster=false now uses the top_row_default flex-fill thumbnail slot,
      // not an aspect-ratio poster wrapper (Story 1.i1e AC1/AC2).
      expect(notDurableCard?.querySelector('[data-event-card-media-slot]')).toBeInTheDocument();
      expect(notDurableCard?.querySelector('.aspect-\\[3\\/4\\]')).not.toBeInTheDocument();
      expect(notDurableCard?.querySelector('.aspect-\\[2\\/3\\]')).not.toBeInTheDocument();

      // No skeleton-state equivalent is expected -- skeleton cards render no real event data.
      expect(container).toBeInTheDocument();
    });

    it('passes a getCardProps-supplied distanceKm through unmodified (EventListView performs no distance computation itself, AC18)', () => {
      render(
        <EventListView
          status="success"
          events={[mockEvents[0]!]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({ distanceKm: 2.5 })}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      expect(screen.getByText('Nearby')).toBeInTheDocument();
    });

    it('does not render a Nearby badge when getCardProps omits distanceKm', () => {
      render(
        <EventListView
          status="success"
          events={[mockEvents[0]!]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
    });

    it('renders the success grid with gap-x-2 gap-y-6 spacing (AC19)', () => {
      const { container } = render(
        <EventListView
          status="success"
          events={mockEvents}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      const grid = container.querySelector('[data-grid-container-layout="masonry"]');
      expect(grid).toHaveClass('gap-x-2');
      expect(grid).toHaveClass('gap-y-6');
      expect(grid).not.toHaveClass('gap-2');
    });

    it('renders the loading skeleton grid with gap-x-2 gap-y-6 spacing (AC19)', () => {
      const { container } = render(
        <EventListView
          status="loading"
          events={[]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({})}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      const grid = container.querySelector('[data-grid-container-layout="masonry"]');
      expect(grid).toHaveClass('gap-x-2');
      expect(grid).toHaveClass('gap-y-6');
      expect(grid).not.toHaveClass('gap-2');
    });
  });
});
