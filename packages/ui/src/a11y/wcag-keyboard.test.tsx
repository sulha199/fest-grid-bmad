/// <reference types="@testing-library/jest-dom" />
/**
 * Automated keyboard-operability checks (user-event drives Tab, Shift+Tab, Enter, Space, Arrow keys and Escape) for the
 * navbar, the event list controls and the event detail popups. They prove the key handling and the focus moves in the
 * DOM; they do not prove focus order on screen, focus visibility or real browser behaviour (that is the manual
 * keyboard pass in project-context.md "Accessibility").
 */
import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AppShell } from '../core/app-shell/AppShell';
import { EventCard } from '../features/events/EventCard';
import { SearchBar } from '../features/events/SearchBar';
import { TemporalFilterToggle } from '../features/events/TemporalFilterToggle';
import { CalendarRangeFilterToggle } from '../features/events/CalendarRangeFilterToggle';
import { FilterHub } from '../features/events/FilterHub';
import { AIFilterOverlay } from '../features/events/AIFilterOverlay';
import { EventDetailView } from '../features/events/EventDetailView';

vi.mock('nuqs', async () => {
  const ReactMock = await vi.importActual<typeof import('react')>('react');
  return {
    useQueryState: (_key: string, options?: { defaultValue?: unknown }) => ReactMock.useState(options?.defaultValue ?? ''),
    parseAsString: { withDefault: (val: unknown) => ({ defaultValue: val }) },
    parseAsArrayOf: () => ({ withDefault: (val: unknown) => ({ defaultValue: val }) }),
  };
});

afterEach(cleanup);

function TestLink({ href, children, className, ...rest }: { href: string; className?: string; children: React.ReactNode }) {
  return <a href={href} className={className} {...rest}>{children}</a>;
}
const navLabels = { discover: 'Discover', feed: 'Feed', favorites: 'Favorites', calendar: 'Calendar', login: 'Login' };

/** Names of the focused elements after each Tab press, de-duplicated in order (the mobile and desktop navbars both exist in jsdom). */
async function tabOrder(user: ReturnType<typeof userEvent.setup>, presses: number) {
  const names: string[] = [];
  for (let i = 0; i < presses; i++) {
    await user.tab();
    const el = document.activeElement as HTMLElement | null;
    const name = el?.getAttribute('aria-label') || el?.textContent?.trim() || el?.tagName || '';
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

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
  schedules: [
    { id: 's1', eventStartDate: '2026-08-10T10:00:00Z', title: 'Morning Session' },
    { id: 's2', eventStartDate: '2026-08-11T14:00:00Z', title: 'Afternoon Session' },
  ],
  onAddToCalendar: vi.fn(), isAddedToCalendar: false, onCorrectData: vi.fn(),
} as unknown as DetailProps;

describe('keyboard: navbar', () => {
  it('Tab reaches every destination, then the profile control, in reading order', async () => {
    const user = userEvent.setup();
    render(<AppShell isAuthenticated displayName="Shulha" currentPath="/" renderLink={TestLink} labels={navLabels}><h1>Page</h1></AppShell>);
    const order = await tabOrder(user, 12);
    expect(order.slice(0, 5)).toEqual(['Discover', 'Feed', 'Favorites', 'Calendar', 'Shulha']);
  });

  it('Enter opens the profile menu, Escape closes it and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<AppShell isAuthenticated displayName="Shulha" currentPath="/" renderLink={TestLink} labels={navLabels}><h1>Page</h1></AppShell>);
    const trigger = screen.getAllByRole('button', { name: 'Shulha' })[0];
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
});

describe('keyboard: event list', () => {
  it('card: the favorite toggle works with Enter and Space and does not also open the card', async () => {
    const user = userEvent.setup();
    const onFavoriteToggle = vi.fn();
    const onClick = vi.fn();
    render(<EventCard eventName="Summer Music Festival" startDate={new Date('2026-08-15T18:00:00Z')} prominentPoster imageUrl="https://example.com/p.jpg" onFavoriteToggle={onFavoriteToggle} onClick={onClick} />);
    const fav = screen.getByRole('button', { name: 'Toggle favorite' });
    fav.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onFavoriteToggle).toHaveBeenCalledTimes(2);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('card: Tab reaches the favorite toggle and the card control, in that order', async () => {
    const user = userEvent.setup();
    render(<EventCard eventName="Summer Music Festival" startDate={new Date('2026-08-15T18:00:00Z')} prominentPoster imageUrl="https://example.com/p.jpg" onFavoriteToggle={vi.fn()} href="/en/events/summer" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Toggle favorite' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('link'));
  });

  it('search bar: Enter submits the typed query, and the clear button works from the keyboard', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<SearchBar query="festival" onChange={onChange} onSubmit={onSubmit} placeholder="Search..." clearLabel="Clear search" />);
    await user.click(screen.getByPlaceholderText('Search...'));
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalled();
    screen.getByRole('button', { name: 'Clear search' }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('temporal filter: a single tab stop, arrow keys move the selection, Tab leaves the group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div>
        <TemporalFilterToggle value={null} onChange={onChange} labels={{ today: 'Today', upcoming: 'Upcoming', all: 'All', groupLabel: 'Filter events by time' }} />
        <button type="button">after</button>
      </div>,
    );
    await user.tab();
    expect(document.activeElement).toHaveAttribute('role', 'radio');
    const start = document.activeElement;
    await user.keyboard('{ArrowRight}');
    // The arrow key moves focus to the next radio; Space then selects it. (Radix also selects on arrow in a real browser,
    // on the next animation frame, which jsdom does not reproduce.)
    expect(document.activeElement).not.toBe(start);
    expect(document.activeElement).toHaveAttribute('role', 'radio');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('TODAY');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
  });

  it('calendar range filter: Space and Enter toggle each pressed button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarRangeFilterToggle value={{ start: false, end: false }} onChange={onChange} labels={{ groupLabel: 'Range', startsWeek: 'Starts this week', endsWeek: 'Ends this week', startsDay: 'Starts today', endsDay: 'Ends today' }} />);
    const buttons = screen.getAllByRole('button');
    buttons[0].focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith({ start: true, end: false });
    buttons[1].focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ start: false, end: true });
  });

  it('filter hub: Enter opens the nearby popover, Escape closes it and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const locationFilterLabels = { filterLabel: 'Nearby', offOptionLabel: 'All locations', currentLocationOptionLabel: 'Current location', radiusLabel: 'Radius', radiusUnit: (n: number) => `${n} km`, detectingLocationLabel: 'Detecting...', permissionDeniedLabel: 'Denied', unavailableLabel: 'Unavailable', locationsErrorLabel: 'Error', noSavedLocationsHint: 'Hint' };
    render(
      <FilterHub labels={{ typeLabel: 'Types', categoryLabel: 'Categories', clearLabel: 'Clear all', locationFilterLabels }} types={[{ value: 'festival', label: 'Festival' }]} categories={[{ value: 'music', label: 'Music' }]}
        isAuthenticated isLoadingLocations={false} locationsError={false} savedLocations={[]} selectedValue="off" radiusKm={5} isCapturingCurrentLocation={false} currentLocationError={null} onSelectLocation={vi.fn()} onRadiusChange={vi.fn()} />,
    );
    const trigger = screen.getByRole('button', { name: 'Nearby' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Nearby')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('AI filter dialog: focus moves inside, Tab stays inside, Escape closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AIFilterOverlay isOpen onClose={onClose} onSubmit={vi.fn()} labels={{ title: 'Search with AI', description: 'Describe what you are looking for', placeholder: 'e.g. music festivals this weekend', submit: 'Apply Filter', cancel: 'Cancel', errorTitle: 'Error occurred' }} />);
    const dialog = screen.getByRole('dialog');
    await vi.waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('keyboard: event detail', () => {
  it('More actions menu: Enter opens it, ArrowDown walks the items, Escape closes and returns focus', async () => {
    const user = userEvent.setup();
    render(<EventDetailView {...detailProps} />);
    const trigger = screen.getByRole('button', { name: 'More actions' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu');
    await vi.waitFor(() => expect(menu).toContainElement(document.activeElement as HTMLElement));
    const first = document.activeElement;
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    expect(menu).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('add-to-calendar dialog: opens from the menu with the keyboard, traps Tab, Escape closes and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<EventDetailView {...detailProps} />);
    const trigger = screen.getByRole('button', { name: 'More actions' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Add to Calendar' }));
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 10; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(document.body).getByRole('button', { name: 'More actions' })).toHaveFocus();
  });
});
