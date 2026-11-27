/// <reference types="@testing-library/jest-dom" />
/**
 * Second half of the automated WCAG 2.2 A/AA ratchet: the shared components the navbar, event list and event detail
 * reuse (weekly calendar, discovery panel, multi-select, banners, user menu variants, location link, embeds,
 * correction form). See `wcag-automated.test.tsx` and project-context.md "Accessibility" for scope and limits.
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { EventType, EventCategory } from '@festgrid/shared-types';
import type { ProposedEventCorrection } from '@festgrid/domain/events';
import { WeeklyCalendarView } from '../features/events/WeeklyCalendarView';
import { EventDiscoveryPanel } from '../features/events/EventDiscoveryPanel';
import { EventCardCalendarGridItem } from '../features/events/EventCardCalendarGridItem';
import { InstagramEmbed } from '../features/events/InstagramEmbed';
import { CorrectionForm } from '../features/events/CorrectionForm';
import { MultiSelect } from '../core/multi-select';
import { LocationLink } from '../core/LocationLink';
import { PwaInstallBanner } from '../core/PwaInstallBanner';
import { AmbientLocationBanner } from '../core/AmbientLocationBanner';
import { UserMenu } from '../core/app-shell/UserMenu';
import { ScopedLocaleProvider } from '../hooks/useScopedLocale';
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

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
  });
});
afterAll(() => vi.unstubAllGlobals());

const schedules = [
  { id: 'sched-1', eventSlug: 'music-fest', eventName: 'Main Stage Concert', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-05', eventStartTime: '18:00:00', eventEndTime: '21:00:00' },
  { id: 'sched-2', eventSlug: 'art-exhibition', eventName: 'Gallery Tour', isMainSchedule: false, eventStartDate: '2026-08-06', eventEndDate: '2026-08-06', eventStartTime: '10:00:00', eventEndTime: '12:00:00' },
  { id: 'sched-3', eventSlug: 'workshop', eventName: 'Tech Workshop', isMainSchedule: true, eventStartDate: '2026-08-05', eventEndDate: '2026-08-07', eventStartTime: '09:00:00', eventEndTime: '17:00:00' },
];
const getWeekRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
};
const calendarProps = { weekStart: '2026-08-05', schedules, getWeekRange, onToday: vi.fn(), onPrevWeek: vi.fn(), onNextWeek: vi.fn(), onScheduleClick: vi.fn(), status: 'success' as const };

const locationLabels = {
  filterLabel: 'Nearby', offOptionLabel: 'All locations', currentLocationOptionLabel: 'Current location', radiusLabel: 'Radius', radiusUnit: (n: number) => `${n} km`,
  detectingLocationLabel: 'Detecting...', permissionDeniedLabel: 'Denied', unavailableLabel: 'Unavailable', locationsErrorLabel: 'Error', noSavedLocationsHint: 'Hint',
};
const panelProps = {
  query: '', onSearchSubmit: vi.fn(), onSearchEnter: vi.fn(), searchPlaceholder: 'Search events...', searchClearLabel: 'Clear search',
  filterLabels: { typeLabel: 'All Types', categoryLabel: 'All Categories', clearLabel: 'Clear filters', locationFilterLabels: locationLabels },
  types: [{ value: 'MUSIC', label: 'Music' }, { value: 'ART', label: 'Art' }], categories: [{ value: 'CONCERT', label: 'Concert' }],
  onFilterChange: vi.fn(), isAuthenticated: true, isLoadingLocations: false, locationsError: false, savedLocations: [], selectedValue: 'off', radiusKm: 5,
  isCapturingCurrentLocation: false, currentLocationError: null, onSelectLocation: vi.fn(), onRadiusChange: vi.fn(),
  views: [
    { id: 'card', label: 'Card View', content: <div>Card View Content</div> },
    { id: 'calendar', label: 'Calendar View', content: <div>Calendar View Content</div> },
  ],
  temporalFilter: null, onTemporalFilterChange: vi.fn(), temporalFilterLabels: { today: 'Today', upcoming: 'Upcoming', all: 'All', groupLabel: 'Filter events by time' },
};

const correctionLabels = {
  eventNameLabel: 'Event Name', typesLabel: 'Types', categoriesLabel: 'Categories', locationLabel: 'Location', organizerNameLabel: 'Organizer Name',
  contactInfoLabel: 'Contact Info', descriptionLabel: 'Description', scheduleStartDateLabel: 'Start Date', scheduleEndDateLabel: 'End Date',
  scheduleStartTimeLabel: 'Start Time', scheduleEndTimeLabel: 'End Time', scheduleTitleLabel: 'Schedule Title', schedulePerformersLabel: 'Performers',
  scheduleLocationLabel: 'Schedule Location', scheduleTicketPriceLabel: 'Ticket Price', submitButtonLabel: 'Submit', cancelButtonLabel: 'Cancel',
  unmatchedErrorFallbackLabel: 'Unmatched Errors Found', guardianPermissionCheckboxLabel: 'I confirm I have parent/guardian permission if this includes a minor',
  linksLabel: 'Links', addLinkButtonLabel: 'Add link', maxLinksReachedLabel: 'Maximum of 10 links reached', linkUrlLabel: (n: number) => `Link ${n} URL`,
  linkLabelLabel: (n: number) => `Link ${n} label (optional)`, removeLinkLabel: (n: number) => `Remove link ${n}`,
};
const initialValues: ProposedEventCorrection = {
  eventName: 'Initial Event', types: [EventType.FESTIVAL], categories: [EventCategory.MUSIC], location: 'Event Location', organizerName: 'Organizer',
  contactInfo: 'Contact', description: 'Description text',
  schedules: [{ id: 'sched-1', isMainSchedule: true, eventStartDate: '2026-08-11', eventEndDate: '2026-08-12', eventStartTime: '18:00', eventEndTime: '22:00', title: 'Main Stage', performers: ['Performer A', 'Performer B'], location: 'Main Location', ticketPrice: '$20' }],
};

const menuLink = ({ href, className, children, onClick }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void }) => (
  <a href={href} className={className} onClick={onClick}>{children}</a>
);
const menuProps = {
  isOpen: true, onClose: vi.fn(), triggerRef: { current: document.createElement('button') }, avatarUrl: 'https://example.com/avatar.jpg', displayName: 'Ahmad Shulhan',
  onSignOut: vi.fn(), renderLink: menuLink,
  labels: { profile: 'Profile', locations: 'Locations', accountSettings: 'Account Settings', reports: 'Reports', moderatorItems: 'Moderator Items', logout: 'Log Out', close: 'Close' },
};

describe('WCAG automated ratchet, shared components', () => {
  afterEach(cleanup);

  describe('weekly calendar (event list, calendar view)', () => {
    it('success: desktop grid and mobile day tabs', async () => {
      const { container } = render(<ScopedLocaleProvider locale="en-US"><WeeklyCalendarView {...calendarProps} /></ScopedLocaleProvider>);
      await expectNoViolations(container);
    });
    it('loading, error and empty', async () => {
      for (const props of [{ ...calendarProps, status: 'loading' as const }, { ...calendarProps, status: 'error' as const }, { ...calendarProps, schedules: [] }]) {
        const { container, unmount } = render(<ScopedLocaleProvider locale="en-US"><WeeklyCalendarView {...props} /></ScopedLocaleProvider>);
        await expectNoViolations(container);
        unmount();
      }
    });
    it('grid item with and without an image', async () => {
      const { container } = render(
        <div>
          <EventCardCalendarGridItem eventName="Summer Music Festival" location="Central Park" isMultiDay imageUrl="https://img.example/poster.jpg" />
          <EventCardCalendarGridItem eventName="Gallery Tour" location="Museum" isMultiDay={false} />
        </div>,
      );
      await expectNoViolations(container);
    });
  });

  describe('discovery panel (search, filters, view switcher)', () => {
    it('renders search, filters and the active view', async () => {
      const { container } = render(<EventDiscoveryPanel {...(panelProps as unknown as React.ComponentProps<typeof EventDiscoveryPanel>)} />);
      await expectNoViolations(container);
    });
    it('after switching view', async () => {
      const { container } = render(<EventDiscoveryPanel {...(panelProps as unknown as React.ComponentProps<typeof EventDiscoveryPanel>)} />);
      const switcher = screen.queryByRole('tab', { name: /Calendar View/ }) ?? screen.queryByRole('button', { name: /Calendar View/ });
      if (switcher) fireEvent.click(switcher);
      await expectNoViolations(container);
    });
  });

  describe('small shared controls', () => {
    it('multi-select with a selection', async () => {
      const { container } = render(<MultiSelect facetLabel="Categories" options={[{ value: 'music', label: 'Music' }, { value: 'tech', label: 'Technology' }]} selectedValues={['music']} onChange={vi.fn()} />);
      await expectNoViolations(container);
    });
    it('location link, with and without a search query', async () => {
      const { container } = render(<div><LocationLink name="Central Park" /><LocationLink name="Pasar Porosjayan" searchQuery="Pasar Porosjayan Gamping Sleman" /></div>);
      await expectNoViolations(container);
    });
    it('ambient banners (install and location)', async () => {
      const { container } = render(
        <div>
          <PwaInstallBanner labels={{ message: 'Install FestDaily for faster access.', installButtonLabel: 'Install', howToInstallButtonLabel: 'How to install', notNowButtonLabel: 'Not now', remindLaterButtonLabel: 'Remind me in 2 weeks' }} platform="android" onInstallClick={vi.fn()} onDismissPermanent={vi.fn()} onRemindLater={vi.fn()} />
          <AmbientLocationBanner labels={{ message: 'Enable your location to see nearby distances.', enableButtonLabel: 'Enable nearby distances', notNowButtonLabel: 'Not now', remindLaterButtonLabel: 'Remind me in 2 weeks' }} onEnableClick={vi.fn()} onDismissPermanent={vi.fn()} onRemindLater={vi.fn()} />
        </div>,
      );
      await expectNoViolations(container);
    });
    it('instagram embed states', async () => {
      for (const status of ['AVAILABLE', 'UNAVAILABLE', 'PENDING']) {
        const { container, unmount } = render(<InstagramEmbed {...({ status, html: "<blockquote class='instagram-media'>post</blockquote>", eventName: 'Test Event' } as unknown as React.ComponentProps<typeof InstagramEmbed>)} />);
        await expectNoViolations(container);
        unmount();
      }
    });
  });

  describe('user menu variants (navbar)', () => {
    it('regular user', async () => {
      render(<UserMenu {...(menuProps as unknown as React.ComponentProps<typeof UserMenu>)} />);
      await expectNoViolations(document.body);
    });
    it('moderator with pending items and a jobs badge', async () => {
      render(<UserMenu {...({ ...menuProps, role: 'moderator', moderatorPendingItemCount: 5, jobsBadgeCount: 2, jobsBadgeLabel: '2 jobs finished' } as unknown as React.ComponentProps<typeof UserMenu>)} />);
      await expectNoViolations(document.body);
    });
  });

  describe('correction form (event detail popup)', () => {
    it('pre-filled form', async () => {
      const { container } = render(
        <CorrectionForm initialValues={initialValues} typeOptions={[{ value: EventType.FESTIVAL, label: 'Festival' }, { value: EventType.PERFORMANCE, label: 'Gig' }]} categoryOptions={[{ value: EventCategory.MUSIC, label: 'Music' }]} onSubmit={vi.fn()} onCancel={vi.fn()} labels={correctionLabels as never} />,
      );
      await expectNoViolations(container);
    });
  });
});
