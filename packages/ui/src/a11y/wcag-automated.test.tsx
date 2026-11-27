/// <reference types="@testing-library/jest-dom" />
/**
 * Automated WCAG 2.2 A/AA ratchet (axe-core, jsdom) for the three surfaces named in project-context.md
 * "Accessibility": the navbar (AppShell), the event list (cards, list view, filters, popups) and the event detail.
 *
 * It cannot see colour contrast, target size, focus order or real screen-reader output: jsdom has no layout. Those
 * are covered by the manual checklist in project-context.md. A passing run means "no violation axe can decide from
 * the DOM", not "WCAG compliant".
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AppShell } from '../core/app-shell/AppShell';
import { EventCard } from '../features/events/EventCard';
import { EventCardCompact } from '../features/events/EventCardCompact';
import { EventListView } from '../features/events/EventListView';
import { EventDetailView } from '../features/events/EventDetailView';
import { SearchBar } from '../features/events/SearchBar';
import { TemporalFilterToggle } from '../features/events/TemporalFilterToggle';
import { CalendarRangeFilterToggle } from '../features/events/CalendarRangeFilterToggle';
import { LocationRadiusFilter } from '../features/events/LocationRadiusFilter';
import { FilterHub } from '../features/events/FilterHub';
import { AIFilterOverlay } from '../features/events/AIFilterOverlay';
import { describeViolations, wcagViolations } from './axe-helper';

vi.mock('nuqs', async () => {
  const ReactMock = await vi.importActual<typeof import('react')>('react');
  return {
    useQueryState: (_key: string, options?: { defaultValue?: unknown }) => ReactMock.useState(options?.defaultValue ?? ''),
    parseAsString: { withDefault: (val: unknown) => ({ defaultValue: val }) },
    parseAsArrayOf: () => ({ withDefault: (val: unknown) => ({ defaultValue: val }) }),
  };
});

async function expectNoViolations(root: Element) {
  const violations = await wcagViolations(root);
  expect(violations, '\n' + describeViolations(violations)).toEqual([]);
}

function TestLink({ href, children, className, ...rest }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}
const navLabels = { discover: 'Discover', feed: 'Feed', favorites: 'Favorites', calendar: 'Calendar', login: 'Login' };

const detailLabels = {
  loadingText: 'Loading event details...', errorText: 'Failed to load event.', locationLabel: 'Location', performersLabel: 'Performers',
  ticketPriceLabel: 'Ticket Price', noSchedulesLabel: 'No schedules available.', defaultScheduleTitle: 'Schedule',
  favoriteButtonLabel: 'Add to Favorites', removeFavoriteButtonLabel: 'Remove from Favorites', addToCalendarButtonLabel: 'Add to Calendar',
  viewOriginalPostLabel: 'View original post', viewSourceLabel: 'View source', addToCalendarDialogTitle: 'Select Schedules',
  addToCalendarConfirmLabel: 'Confirm', addToCalendarCancelLabel: 'Cancel',
  privateContactMessageLabel: 'Contact info is not shown to protect the poster privacy.', moreActionsButtonLabel: 'More actions',
  correctDataMenuItemLabel: 'Correct Data', publishedLabel: 'Published', categoriesAndTypesAriaLabel: 'Event categories and types',
  hashtagsListAriaLabel: 'Hashtags',
};
type DetailProps = React.ComponentProps<typeof EventDetailView>;
const detailFull = {
  eventName: 'Test Event', location: 'Test Location', description: 'A great event description.', labels: detailLabels,
  schedules: [
    { id: 's1', eventStartDate: '2026-08-10T10:00:00Z', eventEndDate: '2026-08-10T12:00:00Z', eventStartTime: '10:00 AM', eventEndTime: '12:00 PM',
      title: 'Morning Session', performers: 'Band A, DJ B', location: 'Stage 1', locationKeywords: ['Stage 1', 'Navy Pier', 'Chicago'], ticketPrice: '$10' },
    { id: 's2', eventStartDate: '2026-08-11T14:00:00Z', title: 'Afternoon Session' },
  ],
  types: [{ value: 'FESTIVAL', label: 'Festival' }], categories: [{ value: 'MUSIC', label: 'Music' }],
  imageUrl: 'https://example.com/image.jpg', imageAlt: 'Custom Alt Text', originalPostUrl: 'https://instagram.com/p/123',
  accountName: 'FestOrganizer', accountHref: '/instagram/festorganizer', accountUsername: 'festorganizer', accountPlatform: 'instagram', accountId: '123',
  isSubscribedToAccount: false, onSubscribeToAccount: vi.fn(),
};

const listEvents = [
  { id: '1', slug: 'summer-fest', eventName: 'Summer Fest', imageUrl: 'http://example.com/summer.jpg', location: 'Central Park', categories: ['MUSIC'], types: ['FESTIVAL'],
    schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-16T18:00:00Z', ticketPrice: 50 }] },
  { id: '2', slug: 'winter-fest', eventName: 'Winter Fest', schedules: [{ isMainSchedule: false, eventStartDate: '2026-12-15T18:00:00Z', ticketPrice: 20 }] },
];

const locationProps = {
  isAuthenticated: true, isLoadingLocations: false, locationsError: false, savedLocations: [{ id: 'loc-1', name: 'Home', radiusKm: 10 }],
  selectedValue: 'loc-1', radiusKm: 5, isCapturingCurrentLocation: false, currentLocationError: null, onSelectLocation: vi.fn(), onRadiusChange: vi.fn(),
  labels: {
    filterLabel: 'Nearby', offOptionLabel: 'All locations', currentLocationOptionLabel: 'Current location', radiusLabel: 'Radius',
    radiusUnit: (n: number) => `${n} km`, detectingLocationLabel: 'Detecting your location...', permissionDeniedLabel: 'Location access denied.',
    unavailableLabel: 'Could not detect your location.', locationsErrorLabel: 'Could not load your saved locations.', noSavedLocationsHint: 'Save a location first.',
  },
};

describe('WCAG automated ratchet', () => {
  afterEach(cleanup);

  describe('navbar', () => {
    it('signed out', async () => {
      const { container } = render(<AppShell isAuthenticated={false} currentPath="/" renderLink={TestLink} labels={navLabels}><h1>Page</h1></AppShell>);
      await expectNoViolations(container);
    });
    it('signed in with the profile menu open and pending moderator items', async () => {
      render(<AppShell isAuthenticated displayName="Shulha" avatarUrl="https://example.com/a.png" currentPath="/" renderLink={TestLink} labels={navLabels} moderatorPendingItemCount={3}><h1>Page</h1></AppShell>);
      fireEvent.click(screen.getAllByRole('button', { name: /Shulha/ })[0]);
      await expectNoViolations(document.body);
    });
  });

  describe('event list', () => {
    const base = { eventName: 'Summer Music Festival', startDate: new Date('2026-08-15T18:00:00Z') };
    it('card: poster, favorited, link, badges', async () => {
      const { container } = render(<EventCard {...base} prominentPoster imageUrl="https://example.com/p.jpg" isFavorited favoriteCount={4} onFavoriteToggle={vi.fn()} href="/en/events/summer" categories={['MUSIC']} types={['FESTIVAL']} locationName="Navy Pier" />);
      await expectNoViolations(container);
    });
    it('card: pending removal, loading, greyed out', async () => {
      for (const el of [<EventCard key="a" {...base} pendingRemoval onClick={vi.fn()} />, <EventCard key="b" {...base} loading />, <EventCard key="c" {...base} isGreyedOut onClick={vi.fn()} />]) {
        const { container, unmount } = render(el);
        await expectNoViolations(container);
        unmount();
      }
    });
    it('favorite toggle exposes its state (aria-pressed) on the card', () => {
      render(<EventCard {...base} prominentPoster imageUrl="https://example.com/p.jpg" isFavorited onFavoriteToggle={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Toggle favorite' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('compact card', async () => {
      const { container } = render(<EventCardCompact eventName="Summer Music Festival" isMainSchedule dateBoxMonth="AUG" dateBoxDay="15" dateBoxTillLabel="till" eventStartDate="2026-08-15" eventStartTime="18:00" locale="en-US" timezone="UTC" onClick={vi.fn()} favoriteToggleLabel="Toggle favorite" onFavoriteToggle={vi.fn()} isFavorited imageUrl="https://example.com/p.jpg" locationName="Navy Pier" />);
      await expectNoViolations(container);
    });
    it('list view: loading, error, empty, success', async () => {
      const common = { events: [] as never[], emptyState: <div>No events found</div>, getCardProps: () => ({}), sentinelRef: vi.fn(), isFetchingNextPage: false, loadingMoreLabel: 'Loading more...' };
      for (const el of [
        <EventListView key="l" {...common} status="loading" />,
        <EventListView key="e" {...common} status="error" errorMessage="Something went wrong!" errorDetail="Database timeout" />,
        <EventListView key="m" {...common} status="success" />,
        <EventListView key="s" {...common} status="success" events={listEvents as never} isFetchingNextPage />,
      ]) {
        const { container, unmount } = render(el);
        await expectNoViolations(container);
        unmount();
      }
    });
  });

  describe('filters and popups', () => {
    it('search bar, empty and with text', async () => {
      for (const query of ['', 'festival']) {
        const { container, unmount } = render(<SearchBar query={query} onChange={() => {}} onSubmit={() => {}} placeholder="Search..." clearLabel="Clear search" />);
        await expectNoViolations(container);
        unmount();
      }
    });
    it('temporal filter (radio group) and calendar range filter (pressed buttons)', async () => {
      const { container } = render(
        <div>
          <TemporalFilterToggle value="TODAY" onChange={vi.fn()} labels={{ today: 'Today', upcoming: 'Upcoming', all: 'All', groupLabel: 'Filter events by time' }} />
          <CalendarRangeFilterToggle value={{ start: true, end: false }} onChange={vi.fn()} labels={{ groupLabel: 'Filter by date range', startsWeek: 'Starts this week', endsWeek: 'Ends this week', startsDay: 'Starts today', endsDay: 'Ends today' }} />
        </div>,
      );
      await expectNoViolations(container);
    });
    it('nearby filter (selects, radius)', async () => {
      const { container } = render(<LocationRadiusFilter {...locationProps} />);
      await expectNoViolations(container);
    });
    it('filter hub with the nearby popover open', async () => {
      render(
        <FilterHub
          labels={{ typeLabel: 'Types', categoryLabel: 'Categories', clearLabel: 'Clear all', locationFilterLabels: locationProps.labels }}
          types={[{ value: 'festival', label: 'Festival' }]} categories={[{ value: 'music', label: 'Music' }]}
          isAuthenticated isLoadingLocations={false} locationsError={false} savedLocations={[]} selectedValue="off" radiusKm={5}
          isCapturingCurrentLocation={false} currentLocationError={null} onSelectLocation={vi.fn()} onRadiusChange={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Nearby' }));
      await expectNoViolations(document.body);
    });
    it('AI filter overlay (dialog)', async () => {
      render(<AIFilterOverlay isOpen onClose={vi.fn()} onSubmit={vi.fn()} labels={{ title: 'Search with AI', description: 'Describe what you are looking for', placeholder: 'e.g. music festivals this weekend', submit: 'Apply Filter', cancel: 'Cancel', errorTitle: 'Error occurred' }} />);
      await expectNoViolations(document.body);
    });
  });

  describe('event detail', () => {
    it('minimal and full', async () => {
      for (const props of [
        { eventName: 'Test Event', location: 'Test Location', schedules: [{ id: 's1', eventStartDate: '2026-08-10T10:00:00Z' }], labels: detailLabels },
        detailFull,
        { ...detailFull, isFavorited: true, favoriteCount: 3, onFavoriteToggle: vi.fn(), onAddToCalendar: vi.fn(), isSubscribedToAccount: true },
      ]) {
        const { container, unmount } = render(<EventDetailView {...(props as unknown as DetailProps)} />);
        await expectNoViolations(container);
        unmount();
      }
    });
    it('loading skeleton and error state', async () => {
      for (const props of [{ ...detailFull, loading: true }, { ...detailFull, error: true }]) {
        const { container, unmount } = render(<EventDetailView {...(props as unknown as DetailProps)} />);
        await expectNoViolations(container);
        unmount();
      }
    });
    it('more-actions menu open, then the add-to-calendar dialog', async () => {
      render(<EventDetailView {...({ ...detailFull, onAddToCalendar: vi.fn(), isAddedToCalendar: false, onCorrectData: vi.fn() } as unknown as DetailProps)} />);
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
      await expectNoViolations(document.body);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Calendar' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await expectNoViolations(document.body);
    });
  });
});
