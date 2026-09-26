/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalendarOverflowDialog } from './CalendarOverflowDialog';
import type { CalendarOverflowDialogItemShape } from './CalendarOverflowDialog.types';

/**
 * jsdom ships no `IntersectionObserver`, so `useInfiniteScroll` needs the same hand-rolled
 * stub `packages/ui/src/hooks/useInfiniteScroll.test.ts` already uses. Kept file-local rather
 * than promoted into `@festgrid/testing-config`, matching that existing precedent.
 */
let mockObserverInstance: MockIntersectionObserver | null = null;

/**
 * Registers through a parameter rather than assigning `this` to a module-level binding directly,
 * which `@typescript-eslint/no-this-alias` flags even outside a class body.
 */
function registerMockObserver(instance: MockIntersectionObserver) {
  mockObserverInstance = instance;
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(public callback: IntersectionObserverCallback) {
    registerMockObserver(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

/**
 * Minimal caller-shaped harness for the controller-ownership tests: it drives the dialog
 * through the *public* props contract exactly the way `WeeklyCalendarView` (Task 7) will —
 * locally-owned `open` state, a caller-owned `triggerRef`, and the same `onClose` callback
 * that the Escape / dismiss / outside-pointerdown paths all funnel through.
 */
function OverflowHarness({ harnessItems }: { harnessItems: CalendarOverflowDialogItemShape[] }) {
  const [open, setOpen] = React.useState(true);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button">
        +3 more
      </button>
      <CalendarOverflowDialog
        open={open}
        date="2026-08-05"
        items={harnessItems}
        fetchNextPage={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe('CalendarOverflowDialog (Story 1.i1h Task 6)', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    mockObserverInstance = null;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const items = [
    { id: 'sched-1', eventName: 'Event 1', locationName: 'Blue Note', isFavorited: true, favoriteCount: 4 },
    { id: 'sched-2', eventName: 'Event 2', locationName: 'Central Park' },
    { id: 'sched-3', eventName: 'Event 3' },
  ];

  const defaultProps = {
    open: true,
    date: '2026-08-05',
    items,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    onClose: vi.fn(),
  };

  const getDialog = () => screen.getByTestId('calendar-overflow-dialog');

  /** All focusable controls in the dialog, in document order (focus-trap assertions below). */
  const getFocusables = () => {
    const container = getDialog();
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"], [contenteditable]'
      )
    ).filter((el) => el.tabIndex !== -1);
  };

  it('renders nothing while closed', () => {
    render(<CalendarOverflowDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('calendar-overflow-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-overflow-overlay')).not.toBeInTheDocument();
  });

  it('is a real modal dialog named by its own localized title', () => {
    render(<CalendarOverflowDialog {...defaultProps} labels={{ titleLabel: 'All schedules — Aug 5' }} />);
    const dialog = screen.getByRole('dialog', { name: 'All schedules — Aug 5' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-date', '2026-08-05');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('applies both DESIGN.md responsive surfaces to the single dialog element', () => {
    render(<CalendarOverflowDialog {...defaultProps} />);
    const dialog = getDialog();

    // components.calendar_overflow_dialog.sheet_mobile, verbatim.
    expect(dialog).toHaveClass(
      'fixed', 'inset-x-0', 'bottom-0', 'z-50', 'max-h-[85vh]',
      'rounded-t-xl', 'bg-white', 'shadow-xl', 'flex', 'flex-col'
    );
    // components.calendar_overflow_dialog.dialog_desktop (= components.modal.dialog), verbatim
    // but re-expressed as md:-scoped overrides of the mobile surface above.
    expect(dialog).toHaveClass(
      'md:inset-x-auto', 'md:bottom-auto', 'md:left-1/2', 'md:top-1/2',
      'md:-translate-x-1/2', 'md:-translate-y-1/2', 'md:w-full', 'md:max-w-md',
      'md:max-h-[70vh]', 'md:rounded-lg', 'md:p-6'
    );
    // Exactly one instance — one focus trap, one live region, one sentinel (AC8).
    expect(screen.getAllByTestId('calendar-overflow-dialog')).toHaveLength(1);
    expect(screen.getByTestId('calendar-overflow-overlay')).toHaveClass('fixed', 'inset-0', 'bg-black');
  });

  it('wraps the item list in the DESIGN.md scroll_region token', () => {
    render(<CalendarOverflowDialog {...defaultProps} />);
    expect(screen.getByTestId('calendar-overflow-scroll-region')).toHaveClass(
      'flex-1', 'overflow-y-auto', 'flex', 'flex-col', 'gap-2', 'p-3'
    );
  });

  it("renders every row through EventCardCalendarGridItem's no-image composition", () => {
    const { container } = render(<CalendarOverflowDialog {...defaultProps} />);

    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.getByText('Event 3')).toBeInTheDocument();
    expect(screen.getByText('Blue Note')).toBeInTheDocument();
    expect(screen.getByText('Central Park')).toBeInTheDocument();

    // Task 6.3 — the NO-IMAGE composition: this surface never even attempts an <img>.
    expect(container.querySelector('img')).toBeNull();
  });

  it('omits the venue line entirely for a row with no locationName', () => {
    const { container } = render(<CalendarOverflowDialog {...defaultProps} />);
    const visualLayers = container.querySelectorAll('.z-20');

    expect(visualLayers).toHaveLength(3);
    expect(visualLayers[0].querySelector('p')).toHaveTextContent('Blue Note');
    // No reserved space — Event 3 simply has no venue <p> at all.
    expect(visualLayers[2].querySelector('p')).toBeNull();
  });

  it('forwards the favorite state and count to each row card', () => {
    render(<CalendarOverflowDialog {...defaultProps} onFavoriteToggle={vi.fn()} />);
    const favoriteButtons = screen.getAllByRole('button', { name: 'Toggle favorite' });

    expect(favoriteButtons).toHaveLength(3);
    expect(favoriteButtons[0]).toHaveTextContent('4');
    expect(favoriteButtons[1]).not.toHaveTextContent('4');
  });

  it('renders no favorite control at all when onFavoriteToggle is omitted', () => {
    render(<CalendarOverflowDialog {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Toggle favorite' })).not.toBeInTheDocument();
  });

  it('fires onScheduleClick with the exact row when a row is activated', () => {
    const onScheduleClick = vi.fn();
    render(<CalendarOverflowDialog {...defaultProps} onScheduleClick={onScheduleClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Event 2' }));

    expect(onScheduleClick).toHaveBeenCalledTimes(1);
    expect(onScheduleClick).toHaveBeenCalledWith(items[1]);
  });

  it('renders non-navigating rows when onScheduleClick is omitted', () => {
    render(<CalendarOverflowDialog {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Event 1' })).not.toBeInTheDocument();
    // The visual card is still fully rendered — only the click layer is gone.
    expect(screen.getByText('Event 1')).toBeInTheDocument();
  });

  it('fires onFavoriteToggle with the exact row without also firing onScheduleClick', () => {
    const onScheduleClick = vi.fn();
    const onFavoriteToggle = vi.fn();
    render(
      <CalendarOverflowDialog
        {...defaultProps}
        onScheduleClick={onScheduleClick}
        onFavoriteToggle={onFavoriteToggle}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Toggle favorite' })[0]);

    expect(onFavoriteToggle).toHaveBeenCalledWith(items[0]);
    expect(onScheduleClick).not.toHaveBeenCalled();
  });

  it('drives useInfiniteScroll from the one shared sentinel (Task 6.4)', () => {
    const fetchNextPage = vi.fn();
    render(<CalendarOverflowDialog {...defaultProps} fetchNextPage={fetchNextPage} hasNextPage />);

    expect(mockObserverInstance?.observe).toHaveBeenCalledTimes(1);
    expect(mockObserverInstance?.observe).toHaveBeenCalledWith(
      screen.getByTestId('calendar-overflow-sentinel')
    );

    act(() => {
      mockObserverInstance?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows the loading-more label only while a further page is in flight', () => {
    const { rerender } = render(<CalendarOverflowDialog {...defaultProps} />);
    expect(screen.queryByText('Loading more…')).not.toBeInTheDocument();

    rerender(<CalendarOverflowDialog {...defaultProps} isFetchingNextPage />);
    expect(screen.getByText('Loading more…')).toBeInTheDocument();
  });

  it('surfaces a load-more failure instead of swallowing it', async () => {
    const fetchNextPage = vi.fn().mockRejectedValue(new Error('nope'));
    render(<CalendarOverflowDialog {...defaultProps} fetchNextPage={fetchNextPage} hasNextPage />);

    await act(async () => {
      mockObserverInstance?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load more events.');
  });

  describe('modal behaviour (Task 6.5)', () => {
    const dialogWithControls = () => (
      <CalendarOverflowDialog
        {...defaultProps}
        onScheduleClick={vi.fn()}
        onFavoriteToggle={vi.fn()}
      />
    );

    it('moves focus into the dialog as soon as it opens', () => {
      render(dialogWithControls());
      expect(document.activeElement).toBe(getDialog());
    });

    it('wraps Tab from the last control back to the first (focus trap)', () => {
      render(dialogWithControls());
      const focusables = getFocusables();
      expect(focusables.length).toBeGreaterThan(1);

      focusables[focusables.length - 1].focus();
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBe(focusables[0]);
    });

    it('wraps Shift+Tab from the dialog container itself to the last control', () => {
      render(dialogWithControls());
      const focusables = getFocusables();

      getDialog().focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      expect(document.activeElement).toBe(focusables[focusables.length - 1]);
    });

    it('closes on Escape from anywhere inside the dialog', () => {
      const onClose = vi.fn();
      render(<CalendarOverflowDialog {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on the dismiss control and on an outside pointerdown', () => {
      const onClose = vi.fn();
      render(<CalendarOverflowDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.pointerDown(document.body);
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('does not close on a pointerdown inside the dialog itself', () => {
      const onClose = vi.fn();
      render(<CalendarOverflowDialog {...defaultProps} onClose={onClose} />);

      fireEvent.pointerDown(screen.getByTestId('calendar-overflow-scroll-region'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('returns focus to the caller-owned "+N more" trigger when it closes', async () => {
      render(<OverflowHarness harnessItems={items} />);
      const trigger = screen.getByRole('button', { name: '+3 more' });

      expect(document.activeElement).toBe(getDialog());

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('calendar-overflow-dialog')).not.toBeInTheDocument();

      // The return is deferred one tick so the dialog's own unmount settles first.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('announcements and label overrides', () => {
    const liveRegion = () => screen.getByTestId('calendar-overflow-live-region');

    it('announces newly loaded items politely, staying silent for the first page', () => {
      const { rerender } = render(
        <CalendarOverflowDialog {...defaultProps} items={items.slice(0, 1)} />
      );
      expect(liveRegion()).toHaveTextContent('');
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');

      rerender(<CalendarOverflowDialog {...defaultProps} items={items} />);
      expect(liveRegion()).toHaveTextContent('2 more events loaded');

      // A shrinking list (a day switch) never re-announces.
      rerender(<CalendarOverflowDialog {...defaultProps} items={items.slice(0, 1)} />);
      expect(liveRegion()).toHaveTextContent('2 more events loaded');
    });

    it('uses the caller\'s loadedAnnouncement resolver for the delta wording', () => {
      const { rerender } = render(
        <CalendarOverflowDialog
          {...defaultProps}
          items={items.slice(0, 1)}
          labels={{ loadedAnnouncement: (count) => `${count} nouvelles dates` }}
        />
      );

      rerender(
        <CalendarOverflowDialog
          {...defaultProps}
          items={items}
          labels={{ loadedAnnouncement: (count) => `${count} nouvelles dates` }}
        />
      );

      expect(liveRegion()).toHaveTextContent('2 nouvelles dates');
    });

    it('honours every caller label override', () => {
      render(
        <CalendarOverflowDialog
          {...defaultProps}
          onFavoriteToggle={vi.fn()}
          isFetchingNextPage
          labels={{
            titleLabel: 'Plus de concerts',
            closeLabel: 'Fermer',
            loadingMoreLabel: 'Chargement…',
            favoriteToggleLabel: 'Favori',
          }}
        />
      );

      expect(screen.getByRole('dialog', { name: 'Plus de concerts' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
      expect(screen.getByText('Chargement…')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Favori' })).toHaveLength(3);
    });

    it('forwards distanceKm and the caller threshold to the self-gating nearby badge', () => {
      const withDistance: CalendarOverflowDialogItemShape[] = [
        { id: 'near', eventName: 'Near', distanceKm: 3 },
        { id: 'far', eventName: 'Far', distanceKm: 30 },
        { id: 'unknown', eventName: 'Unknown' },
      ];

      const { container } = render(
        <CalendarOverflowDialog {...defaultProps} items={withDistance} nearbyBadgeThreshold={5} />
      );

      // Exactly one row is inside the 5km gate — the other two render no badge at all.
      // BUG-049: the badge shows the real distance ("3 km"), not a static word.
      expect(screen.getAllByText('3 km')).toHaveLength(1);
      expect(container.querySelectorAll('[data-event-card-nearby-badge]')).toHaveLength(1);
    });
  });
});
