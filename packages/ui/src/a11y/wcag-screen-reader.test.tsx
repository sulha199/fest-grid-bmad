/// <reference types="@testing-library/jest-dom" />
/**
 * Automated screen-reader checks with the Guidepup virtual screen reader: it walks the accessibility tree the way a
 * screen reader's virtual cursor does (roles, names, states, levels) and records what would be spoken. This catches what
 * axe cannot: a decorative icon announced as "graphics-document", a toggle spoken without its state, a dialog with no
 * name, a heading at the wrong level. It is a simulation, not NVDA, JAWS or VoiceOver: the manual screen-reader pass in
 * project-context.md "Accessibility" is still required before any conformance statement.
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { virtual } from '@guidepup/virtual-screen-reader';
import { AppShell } from '../core/app-shell/AppShell';
import { EventCard } from '../features/events/EventCard';
import { EventDetailView } from '../features/events/EventDetailView';
import { EventDetailSkeleton } from '../features/events/EventDetailSkeleton';
import { TemporalFilterToggle } from '../features/events/TemporalFilterToggle';
import { CalendarRangeFilterToggle } from '../features/events/CalendarRangeFilterToggle';
import { SearchBar } from '../features/events/SearchBar';

afterEach(cleanup);

/** Everything the virtual cursor speaks while it walks `container` from start to end. */
async function spoken(container: HTMLElement, steps = 80): Promise<string[]> {
  await virtual.start({ container });
  for (let i = 0; i < steps; i++) {
    const before = (await virtual.lastSpokenPhrase()) as string;
    await virtual.next();
    if ((await virtual.lastSpokenPhrase()) === before && i > 0) break;
  }
  const log = (await virtual.spokenPhraseLog()) as string[];
  await virtual.stop();
  return log;
}
const has = (log: string[], text: string) => log.some((p) => p === text || p.includes(text));

function TestLink({ href, children, className, ...rest }: { href: string; className?: string; children: React.ReactNode }) {
  return <a href={href} className={className} {...rest}>{children}</a>;
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
const detailProps = {
  eventName: 'Test Event', location: 'Test Location', description: 'A great event description.', labels: detailLabels,
  schedules: [{ id: 's1', eventStartDate: '2026-08-10T10:00:00Z', title: 'Morning Session' }],
  onAddToCalendar: vi.fn(), isAddedToCalendar: false, onCorrectData: vi.fn(), onFavoriteToggle: vi.fn(), isFavorited: false,
} as unknown as DetailProps;

describe('screen reader: navbar', () => {
  it('announces the navigation landmark, each destination once by name, and the current page', async () => {
    const { container } = render(<AppShell isAuthenticated={false} currentPath="/feed" renderLink={TestLink} labels={navLabels}><h1>Page</h1></AppShell>);
    const log = await spoken(container);
    expect(has(log, 'navigation, Main')).toBe(true);
    expect(has(log, 'link, Feed, current page')).toBe(true);
    for (const name of ['Discover', 'Favorites', 'Calendar', 'Login']) expect(has(log, `link, ${name}`)).toBe(true);
    // A decorative icon must not be spoken as an unnamed graphic (NavRailItem hides it).
    expect(log.filter((p) => p.includes('graphics-document'))).toEqual([]);
  });

  it('announces the profile trigger as a button with its expanded state', async () => {
    const { container } = render(<AppShell isAuthenticated displayName="Shulha" currentPath="/" renderLink={TestLink} labels={navLabels}><h1>Page</h1></AppShell>);
    const log = await spoken(container);
    expect(log.some((p) => p.startsWith('button, Shulha') && p.includes('not expanded'))).toBe(true);
  });
});

describe('screen reader: event list', () => {
  it('card: a pressed favorite toggle, a level-3 heading, and the link name that reaches the event', async () => {
    const { container } = render(<EventCard eventName="Summer Music Festival" startDate={new Date('2026-08-15T18:00:00Z')} prominentPoster imageUrl="https://example.com/p.jpg" isFavorited favoriteCount={4} onFavoriteToggle={vi.fn()} href="/en/events/summer" locationName="Navy Pier" />);
    const log = await spoken(container);
    expect(has(log, 'button, Toggle favorite, pressed')).toBe(true);
    expect(has(log, 'heading, Summer Music Festival, level 3')).toBe(true);
    expect(log.some((p) => p.startsWith('link,') && p.includes('Summer Music Festival'))).toBe(true);
  });

  it('card: an unpressed favorite toggle says so', async () => {
    const { container } = render(<EventCard eventName="Summer Music Festival" startDate={new Date('2026-08-15T18:00:00Z')} prominentPoster imageUrl="https://example.com/p.jpg" onFavoriteToggle={vi.fn()} href="/en/events/summer" />);
    const log = await spoken(container);
    expect(log.some((p) => p.startsWith('button, Toggle favorite') && p.includes('not pressed'))).toBe(true);
  });

  it('filters: the time filter is a named radio group with the selected option checked', async () => {
    const { container } = render(<TemporalFilterToggle value="TODAY" onChange={vi.fn()} labels={{ today: 'Today', upcoming: 'Upcoming', all: 'All', groupLabel: 'Filter events by time' }} />);
    const log = await spoken(container);
    expect(log.some((p) => p.includes('radiogroup') && p.includes('Filter events by time'))).toBe(true);
    expect(log.some((p) => p.includes('radio, Today') && p.includes('checked'))).toBe(true);
    expect(log.some((p) => p.includes('radio, Upcoming') && p.includes('not checked'))).toBe(true);
  });

  it('filters: the date-range toggles are a named group of pressed or unpressed buttons', async () => {
    const { container } = render(<CalendarRangeFilterToggle value={{ start: true, end: false }} onChange={vi.fn()} labels={{ groupLabel: 'Filter by date range', startsWeek: 'Starts this week', endsWeek: 'Ends this week', startsDay: 'Starts today', endsDay: 'Ends today' }} />);
    const log = await spoken(container);
    expect(log.some((p) => p.includes('group') && p.includes('Filter by date range'))).toBe(true);
    expect(log.some((p) => p.startsWith('button, Starts this week') && p.includes('pressed') && !p.includes('not pressed'))).toBe(true);
    expect(log.some((p) => p.startsWith('button, Ends this week'))).toBe(true);
  });

  it('search bar: the field has a name and the clear button is announced', async () => {
    const { container } = render(<SearchBar query="festival" onChange={() => {}} onSubmit={() => {}} placeholder="Search..." clearLabel="Clear search" />);
    const log = await spoken(container);
    expect(log.some((p) => /search|textbox/i.test(p))).toBe(true);
    expect(has(log, 'button, Clear search')).toBe(true);
  });
});

describe('screen reader: event detail', () => {
  it('speaks the title as the level-1 heading, a favorite button with its state, and the More actions menu button', async () => {
    const { container } = render(<EventDetailView {...detailProps} />);
    const log = await spoken(container, 120);
    expect(has(log, 'heading, Test Event, level 1')).toBe(true);
    expect(log.some((p) => p.startsWith('button, Add to Favorites'))).toBe(true);
    expect(log.some((p) => p.startsWith('button, More actions') && p.includes('has popup menu'))).toBe(true);
  });

  it('the loading skeleton is announced as a named status', async () => {
    const { container } = render(<EventDetailSkeleton label="Loading event details..." />);
    const log = await spoken(container, 10);
    expect(log.some((p) => p.includes('status') && p.includes('Loading event details...'))).toBe(true);
  });

  it('the open menu is announced as a menu of named items, and the dialog has a name', async () => {
    render(<EventDetailView {...detailProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    let log = await spoken(document.body, 150);
    expect(log.some((p) => p.startsWith('menu'))).toBe(true);
    expect(has(log, 'menuitem, Add to Calendar')).toBe(true);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Calendar' }));
    log = await spoken(document.body, 200);
    expect(log.some((p) => p.startsWith('dialog') && p.includes('Select Schedules'))).toBe(true);
  });
});
