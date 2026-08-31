/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventListView } from './EventListView';
import { EventListViewItem } from './EventListView.types';

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

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-2');
      expect(grid).toHaveClass('md:grid-cols-3');

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

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-2');
      expect(grid).toHaveClass('md:grid-cols-3');

      const skeletonImages = container.querySelectorAll('.aspect-\\[3\\/4\\]');
      expect(skeletonImages.length).toBe(6);
      const standardImages = container.querySelectorAll('.h-48');
      expect(standardImages.length).toBe(0);
    });

    it('allows overriding default masonry variant via getCardProps', () => {
      render(
        <EventListView
          status="success"
          events={[mockEvents[0]!]}
          emptyState={<div>Empty</div>}
          getCardProps={() => ({
            variant: 'standard',
          })}
          sentinelRef={vi.fn()}
          isFetchingNextPage={false}
          loadingMoreLabel="Loading more..."
        />
      );

      const cardTitle = screen.getByText('Summer Fest');
      const cardContainer = cardTitle.closest('.p-4');
      expect(cardContainer).toBeInTheDocument();
      const masonryContainer = cardTitle.closest('.p-3');
      expect(masonryContainer).not.toBeInTheDocument();
    });
  });
});
