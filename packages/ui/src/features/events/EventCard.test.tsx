/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { EventCard } from './EventCard';
import {
  EVENT_CARD_BADGE_FONT_SIZE_VAR,
  EVENT_CARD_BADGE_FONT_SIZE,
  EVENT_CARD_BADGE_ICON_SCALE_DEFAULT,
  EVENT_CARD_BADGE_MIN_TOUCH_REM,
} from './event-card-media-tokens';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';

// FIND-053 removed `variant='standard'` (dead code -- no production call site ever passed
// it), which was the only EventCard render path that ever showed a full month/day/year/
// time date string. The masonry date overlay (rendered whenever `prominentPoster` is true)
// instead mirrors `formatShortEventDateTime`'s same-year branch: locale/timezone-sensitive
// short month + day, no year, no time -- this helper matches that for the locale/timezone
// resolution tests below (all fixtures share `defaultProps.startDate`'s 2026 year with
// "now", so the same-year branch always applies). Mirrors EventCard's own Intl call so
// assertions stay correct regardless of which locale data the CI Node build ships (Node
// bundles full ICU by default since v13, so 'id' formatting is expected to be available;
// this pattern is just defense against the assumption ever becoming false).
function expectedShortDate(locale: string, date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

describe('EventCard', () => {
  afterEach(() => {
    cleanup();
  });
  const defaultProps = {
    eventName: 'Summer Music Festival',
    startDate: new Date('2026-08-15T18:00:00Z'),
  };

  it('formats the date using the nearest ScopedLocaleProvider when no locale prop is given', () => {
    render(
      <ScopedLocaleProvider locale="id">
        <EventCard {...defaultProps} prominentPoster />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedShortDate('id', defaultProps.startDate))).toBeInTheDocument();
    expect(screen.queryByText(expectedShortDate('en-US', defaultProps.startDate))).not.toBeInTheDocument();
  });

  it('lets an explicit locale prop override the ambient ScopedLocaleProvider', () => {
    render(
      <ScopedLocaleProvider locale="id">
        <EventCard {...defaultProps} prominentPoster locale="en-US" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedShortDate('en-US', defaultProps.startDate))).toBeInTheDocument();
  });

  it('formats the date using the nearest ScopedLocaleProvider timezone when no timezone prop is given', () => {
    render(
      <ScopedLocaleProvider locale="en-US" timezone="Asia/Jakarta">
        <EventCard {...defaultProps} prominentPoster />
      </ScopedLocaleProvider>
    );
    expect(
      screen.getByText(expectedShortDate('en-US', defaultProps.startDate, 'Asia/Jakarta'))
    ).toBeInTheDocument();
  });

  it('lets an explicit timezone prop override the ambient ScopedLocaleProvider timezone', () => {
    render(
      <ScopedLocaleProvider locale="en-US" timezone="Asia/Jakarta">
        <EventCard {...defaultProps} prominentPoster timezone="UTC" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedShortDate('en-US', defaultProps.startDate, 'UTC'))).toBeInTheDocument();
  });

  it('inherits the timezone from an outer provider when a nested provider only overrides locale', () => {
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <ScopedLocaleProvider locale="en-US">
          <EventCard {...defaultProps} prominentPoster />
        </ScopedLocaleProvider>
      </ScopedLocaleProvider>
    );
    expect(
      screen.getByText(expectedShortDate('en-US', defaultProps.startDate, 'Asia/Jakarta'))
    ).toBeInTheDocument();
  });

  it('falls back to a safe format instead of crashing when given an invalid timezone', () => {
    render(<EventCard {...defaultProps} prominentPoster locale="en-US" timezone="Not/A_Real_Zone" />);
    // Degrades to locale-only formatting (no timeZone applied) rather than throwing.
    expect(screen.getByText(expectedShortDate('en-US', defaultProps.startDate))).toBeInTheDocument();
  });

  // DW-070 (BUG-013): a bad `startDate` can still yield an Invalid Date inside
  // combineDateTime (its isNaN guard only covers its internal date+time fallback), and
  // that NaN must not propagate unguarded into getEventDayDiff/formatRelativeDayOrDate
  // (or formatShortEventDateTime, which calls getEventDayDiff internally) and throw in
  // Intl formatting. Both variants must instead degrade to a blank date without crashing.
  it('degrades to a blank date (no throw) when given an invalid startDate (masonry variant)', () => {
    render(
      <EventCard eventName="Broken Date Card Masonry" startDate="not-a-real-date" variant="masonry" locale="en-US" />
    );
    expect(screen.getByText('Broken Date Card Masonry')).toBeInTheDocument();
  });

  it('renders the guaranteed fields only (minimal render)', () => {
    render(<EventCard {...defaultProps} />);
    
    // Name should be present
    expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
    
    // Date should be formatted and present
    // Since we use Intl.DateTimeFormat, exact output might vary slightly by default locale,
    // but the card must render it. We can provide a locale='en-US' for deterministic testing.
    render(<EventCard {...defaultProps} locale="en-US" />);
    // Just expecting it not to throw and contain some form of date.
    // 'Aug 15, 2026' or similar should be found.
  });

  it('renders full data (all optional slots provided)', () => {
    render(
      <EventCard
        {...defaultProps}
        locale="en-US"
        locationName="Central Park"
      />
    );

    expect(screen.getByText('Central Park')).toBeInTheDocument();
  });

  it('handles image success', () => {
    render(<EventCard {...defaultProps} imageUrl="http://example.com/image.jpg" />);
    
    const img = screen.getByRole('img', { name: 'Summer Music Festival' });
    expect(img).toHaveAttribute('src', 'http://example.com/image.jpg');
  });

  it('handles image error fallback (prominentPoster, the only remaining raw-<img> path)', () => {
    // FIND-053 removed `variant='standard'` (dead code), which was the only path using this
    // wrapper's default-state `<img onError>` handling. The masonry `prominentPoster=true`
    // state is the sole surviving consumer of the same raw-<img> code, so this test now
    // exercises that state directly instead of the removed default.
    render(<EventCard {...defaultProps} prominentPoster imageUrl="http://example.com/bad-image.jpg" />);

    const img = screen.getByRole('img', { name: 'Summer Music Festival' });
    const imgContainer = img.parentElement;

    // Simulate image load error
    fireEvent.error(img);

    // The image tag is removed and no placeholder text/icon renders instead
    expect(screen.queryByRole('img', { name: 'Summer Music Festival' })).not.toBeInTheDocument();
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();

    // No reflow: the wrapper div keeps its prominent-poster footprint (aspect-square)
    expect(imgContainer).not.toBeNull();
    expect(imgContainer).toHaveClass('aspect-square');
    expect(imgContainer).toHaveClass('bg-muted');
  });

  // Story 1.i1z CI ratchet — AC1/AC3 for the masonry-default surface: this test fails if
  // `EventCard.tsx`'s masonry `prominentPoster=false` branch reverts to local hardcoded sizing or a
  // non-reserved fallback instead of routing through the `event_card_*` primitive. Part of Story 1.i1z.
  it('renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)', () => {
    const { container } = render(<EventCard {...defaultProps} variant="masonry" />);
    // Reserved-blank fallback: no placeholder text/icon and no img
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // The media slot keeps its flex-fill footprint (no reflow/no collapse on error)
    const slot = container.querySelector('[data-event-card-media-slot]');
    expect(slot).not.toBeNull();
    expect(slot).toHaveClass('flex-1');
    expect(slot).toHaveClass('h-full');
    // The date box (base_default primitive) is a flex sibling (top_row_default)
    expect(container.querySelector('[data-event-card-date-box]')).not.toBeNull();
    // No full-width aspect-ratio poster wrapper in the default state
    expect(container.querySelector('.aspect-\\[3\\/4\\]')).toBeNull();
  });

  // Story 1.i1z CI ratchet — AC2/AC3 for the masonry-prominent surface: this test fails if a
  // placeholder/icon or an unreserved (reflowing) fallback is reintroduced here. Note: this surface is
  // intentionally EXCLUDED from AC1 (legacy, non-primitive aspect sizing per Story 1.i1c;
  // `aspect-[2/3]` -> `aspect-square` per Story 1.i1l rule 2).
  it('renders a blank, correctly-sized fallback on masonry with prominentPoster=true', () => {
    const { container } = render(<EventCard {...defaultProps} variant="masonry" prominentPoster />);
    // No placeholder text/icon and no img
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Wrapper div keeps its variant-appropriate sizing class (prominent poster => aspect-square,
    // Story 1.i1l rule 2 / DESIGN.md event_card_masonry.image_prominent)
    const wrapper = container.querySelector('.relative.w-full.bg-muted.overflow-hidden');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('aspect-square');
    expect(wrapper).not.toHaveClass('aspect-[2/3]');
    expect(wrapper).not.toHaveClass('aspect-[3/4]');
  });

  it('applies pending-removal visual state when pendingRemoval is true', () => {
    render(<EventCard {...defaultProps} pendingRemoval={true} />);

    const article = screen.getByRole('article');
    expect(article).toHaveClass('opacity-50');
    expect(article).toHaveClass('grayscale');
    expect(article).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders loading skeleton with aria-busy', () => {
    const { container } = render(<EventCard {...defaultProps} loading={true} />);
    
    const element = container.querySelector('[aria-busy="true"]');
    expect(element).toBeInTheDocument();
    
    // Should not render the actual data
    expect(screen.queryByText('Summer Music Festival')).not.toBeInTheDocument();
  });

  it('allows keyboard focus and activation of the card root', () => {
    const onClick = vi.fn();
    render(<EventCard {...defaultProps} onClick={onClick} />);
    
    const cardRoot = screen.getByRole('button');
    expect(cardRoot).toBeInTheDocument();
    
    cardRoot.focus();
    expect(cardRoot).toHaveFocus();
    
    fireEvent.click(cardRoot);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render favorite control when onFavoriteToggle is absent', () => {
    render(<EventCard {...defaultProps} isFavorited={true} />);
    // Look for anything representing a favorite button
    const favButton = screen.queryByLabelText(/favorite/i);
    expect(favButton).not.toBeInTheDocument();
  });

  it('renders favorite control and calls onFavoriteToggle when clicked', () => {
    const onFavoriteToggle = vi.fn();
    render(
      <EventCard 
        {...defaultProps} 
        isFavorited={false} 
        onFavoriteToggle={onFavoriteToggle}
        labels={{ favoriteToggle: 'Toggle favorite' }}
      />
    );
    
    const favButton = screen.getByLabelText('Toggle favorite');
    expect(favButton).toBeInTheDocument();
    
    fireEvent.click(favButton);
    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it('renders statusBadge when provided', () => {
    render(
      <EventCard 
        {...defaultProps} 
        statusBadge={<span data-testid="test-badge">Archived</span>}
      />
    );
    expect(screen.getByTestId('test-badge')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('renders masonry variant with a flex-fill thumbnail (not an aspect poster) and reduced caption', () => {
    render(
      <EventCard
        {...defaultProps}
        variant="masonry"
        imageUrl="http://example.com/image.jpg"
        locationName="Great Hall"
        categories={['MUSIC']}
        types={['CONCERT']}
        priceFrom="$20"
      />
    );

    const img = screen.getByRole('img', { name: 'Summer Music Festival' });
    expect(img).toBeInTheDocument();

    // The image renders inside the flex-fill thumbnail slot, not a full-width aspect-[3/4] poster
    const slot = img.closest('[data-event-card-media-slot]');
    expect(slot).not.toBeNull();
    expect(slot).toHaveClass('flex-1');
    expect(slot).toHaveClass('h-full');
    expect(slot).not.toHaveClass('h-48');

    expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
    expect(screen.getByText('Great Hall')).toBeInTheDocument();

    expect(screen.queryByText('MUSIC')).not.toBeInTheDocument();
    expect(screen.queryByText('CONCERT')).not.toBeInTheDocument();
    expect(screen.queryByText('$20')).not.toBeInTheDocument();
  });

  describe('Relative-day date display', () => {
    // FIND-009: freeze the clock to a fixed reference instant so every relative-day
    // assertion ("Today"/"Tomorrow"/weekday/absolute fallback) is deterministic
    // regardless of the real wall-clock date — otherwise these tests drift and fail
    // on date rollover (midnight / month / year boundaries). Same 2026-08-12 reference
    // instant used across the repo (CalendarView, WeeklyCalendarView, etc.).
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('renders real numeric start-date digits (never "Today") for a dayDiff===0, no-time, no-endDate event (BUG-047 AC-DATE-1: already "ended" as of now, since endDateTime===startDateTime)', () => {
      const today = new Date();
      const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(today);
      const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(today);
      const { container } = render(<EventCard eventName="Today Event" startDate={today} locale="en-US" />);
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
    });

    it('renders real numeric digits (never "Tomorrow") for dates 1 day out -- not yet started, so the START date shows', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(tomorrow);
      const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(tomorrow);
      const { container } = render(
        <EventCard eventName="Tomorrow Event" startDate={tomorrow} locale="en-US" />
      );
      // The status badge (AC15, formatEventStatus -- untouched) still says "Tomorrow" in prose;
      // the date box (AC-DATE-1) never does -- scope to the date box (primitive) specifically.
      const datePill = container.querySelector('[data-event-card-date-box]');
      expect(datePill).not.toHaveTextContent('Tomorrow');
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
    });

    describe('Masonry badge display behavior', () => {
      it('Today WITH a startTime provided -> Clock icon still shows (unchanged trigger), but the date box shows real digits, never a bare time string (BUG-047 AC-DATE-1, supersedes the old time-string branch)', () => {
        const today = new Date();
        const dateWithTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0);
        const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dateWithTime);
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(today);

        const { container } = render(
          <EventCard
            eventName="Masonry Today with Time"
            startDate={today}
            startTime="18:00:00"
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.queryByText('Today')).not.toBeInTheDocument();
        expect(screen.queryByText(expectedTime)).not.toBeInTheDocument();
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
        const clockIcon = container.querySelector('svg.lucide-clock');
        expect(clockIcon).toBeInTheDocument();
      });

      it('Today with NO startTime provided (startTime omitted/null) -> date box shows real digits, no Clock icon', () => {
        const today = new Date();
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(today);
        const { container } = render(
          <EventCard
            eventName="Masonry Today no Time"
            startDate={today}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.queryByText('Today')).not.toBeInTheDocument();
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
        const clockIcon = container.querySelector('svg.lucide-clock');
        expect(clockIcon).not.toBeInTheDocument();
      });

      it('Tomorrow (dayDiff===1) -> date box shows real digits, never the word "Tomorrow"', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(tomorrow);
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(tomorrow);
        const { container } = render(
          <EventCard
            eventName="Masonry Tomorrow"
            startDate={tomorrow}
            variant="masonry"
            locale="en-US"
          />
        );

        // The status badge (AC15, untouched) still renders "Tomorrow" in prose; the date box
        // (AC-DATE-1) never does -- scope to the date box (primitive) specifically, and confirm
        // exactly one "Tomorrow" text node exists (the status badge's, not a second date-box one).
        const datePill = container.querySelector('[data-event-card-date-box]');
        expect(datePill).not.toHaveTextContent('Tomorrow');
        expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
        expect(screen.getAllByText('Tomorrow').length).toBe(1);
      });

      it('Yesterday (dayDiff===-1) -> date box shows real digits, never the word "Yesterday"', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(yesterday);
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(yesterday);
        const { container } = render(
          <EventCard
            eventName="Masonry Yesterday"
            startDate={yesterday}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
        expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
      });

      it('A date 3+ days in the future, SAME calendar year as today -> badge shows short-month/day-number two-tier split, no year, no time', () => {
        const futureSameYear = new Date();
        futureSameYear.setDate(futureSameYear.getDate() + 3);
        const now = new Date();
        futureSameYear.setFullYear(now.getFullYear());

        const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(futureSameYear);
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(futureSameYear);

        const { container } = render(
          <EventCard
            eventName="Masonry Future Same Year"
            startDate={futureSameYear}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
        expect(screen.queryByText(String(futureSameYear.getFullYear()))).not.toBeInTheDocument();
      });

      it('A date in a DIFFERENT calendar year than today -> badge shows short-month/day-number split, no year (Story 1.i1k accepted simplification, no time)', () => {
        const differentYearDate = new Date();
        differentYearDate.setFullYear(differentYearDate.getFullYear() + 2);

        const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(differentYearDate);
        const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(differentYearDate);

        const { container } = render(
          <EventCard
            eventName="Masonry Different Year"
            startDate={differentYearDate}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
        expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
        // Story 1.i1k's formatShortEventDateTimeParts deliberately omits the 2-digit year
        // formatShortEventDateTime's own non-sameYear branch appends (accepted simplification) --
        // there is no comma-separated year suffix anywhere in the date box's content.
        const dateBox = container.querySelector('[data-event-card-date-box]');
        expect(dateBox?.textContent).not.toContain(',');
      });
    });
  });

  describe('Favorite count rendering', () => {
    it('renders count next to the heart icon when both favoriteCount and onFavoriteToggle are provided', () => {
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard
          {...defaultProps}
          onFavoriteToggle={onFavoriteToggle}
          favoriteCount={42}
        />
      );

      const btn = screen.getByLabelText(/favorite/i);
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent('42');
    });

    it('does not render favorite count button when onFavoriteToggle is absent even if favoriteCount is provided', () => {
      render(
        <EventCard
          {...defaultProps}
          favoriteCount={42}
        />
      );

      expect(screen.queryByLabelText(/favorite/i)).not.toBeInTheDocument();
      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('sizes the heart icon by the shared badge-scale token, not hardcoded w-5 h-5', () => {
      // FIND-053 removed `variant='standard'` (dead code), which was the only default-state
      // path rendering this raw corner button. `prominentPoster` is the sole surviving masonry
      // state that still uses it (masonry-default renders its own EventCardFavoriteBadge
      // instead), so it's made explicit here to keep exercising this exact code.
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard {...defaultProps} prominentPoster onFavoriteToggle={onFavoriteToggle} isFavorited={false} />
      );

      const btn = screen.getByLabelText(/favorite/i);
      const heart = btn.querySelector('svg');
      expect(heart).not.toBeNull();
      // The size is applied as an inline style (not a Tailwind class -- a class built via
      // runtime string interpolation is invisible to Tailwind's static content scanner and
      // generates no CSS, which is the bug this token was rewritten to avoid). Built
      // independently from the raw exported constants here, rather than calling
      // eventCardBadgeIconSizeStyle itself, so a wrong formula inside that function
      // would actually fail this assertion instead of matching it by construction.
      const expectedWidth = `calc(var(${EVENT_CARD_BADGE_FONT_SIZE_VAR},${EVENT_CARD_BADGE_FONT_SIZE})*${EVENT_CARD_BADGE_ICON_SCALE_DEFAULT})`;
      expect(heart?.style.width).toBe(expectedWidth);
    });

    it('keeps the count-span classes and the button positioning/background classes unchanged', () => {
      // See the previous test's note -- `prominentPoster` is required to reach this raw button.
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard
          {...defaultProps}
          prominentPoster
          onFavoriteToggle={onFavoriteToggle}
          favoriteCount={42}
        />
      );

      const btn = screen.getByLabelText(/favorite/i);
      expect(btn).toHaveTextContent('42');
      // Button positioning + pill background stay byte-for-byte the same (AC2). FIND-053
      // removed the `standard`-only `top-3 right-3` corner position -- masonry's own
      // `top-2`/`right-2` (no TILL tag present here) is now the only value this renders.
      expect(btn.className).toContain('absolute');
      expect(btn.className).toContain('top-2');
      expect(btn.className).toContain('right-2');
      expect(btn.className).toContain('z-10');
      expect(btn.className).toContain('rounded-full');
      expect(btn.className).toContain('bg-background/80');
      expect(btn.className).toContain('backdrop-blur-sm');
      expect(btn.className).toContain('shadow-sm');
      expect(btn.className).toContain('hover:bg-background');
      // The count span's own classes remain intact (AC2).
      const span = btn.querySelector('span');
      expect(span?.className).toContain('text-black');
      expect(span?.className).toContain('pr-0.5');
    });
  });

  describe('TILL badge (masonry, AC14)', () => {
    // FIND-009: this block derives yesterday/today/tomorrow from the real wall clock,
    // so a midnight rollover mid-test makes the fixture "today" and EventCard's own
    // internal "now" disagree. Freeze the clock to the same repo reference instant so
    // every TILL/day-diff assertion is deterministic.
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('renders no TILL badge when the event has not started yet', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <EventCard
          eventName="Not Started"
          startDate={tomorrow}
          endDate={(() => { const d = new Date(); d.setDate(d.getDate() + 2); return d; })()}
          variant="masonry"
          locale="en-US"
        />
      );
      expect(screen.queryByText(/till/)).not.toBeInTheDocument();
    });

    it('renders "till hh:mm" when started and endDate is today with a known endTime', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();
      const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0)
      );

      render(
        <EventCard
          eventName="Ends Today"
          startDate={yesterday}
          endDate={today}
          endTime="23:59:00"
          variant="masonry"
          locale="en-US"
        />
      );

      expect(screen.getByText(`till ${expectedTime}`)).toBeInTheDocument();
    });

    it('renders bare "till" (no time) when started and endDate is tomorrow or later', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      render(
        <EventCard
          eventName="Ends Tomorrow"
          startDate={yesterday}
          endDate={tomorrow}
          variant="masonry"
          locale="en-US"
        />
      );

      expect(screen.getByText('till')).toBeInTheDocument();
    });

    it('BUG-047 review loop 1 regression: on the actual last day of a multi-day event with NO known endTime, the date-box shows the END date (not the start date), staying consistent with the still-shown TILL badge', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const today = new Date();
      const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(today);
      const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(today);

      const { container } = render(
        <EventCard
          eventName="Ends Today No Time"
          startDate={twoDaysAgo}
          endDate={today}
          variant="masonry"
          locale="en-US"
        />
      );

      // Before the review-loop-1 fix, a strict raw-timestamp `notYetEnded` compare against
      // `endDate`'s midnight-collapsed instant would have already flipped this back to the START
      // date for the entire day -- the exact BUG-022 contradiction this story exists to fix.
      expect(container.querySelector('[data-event-card-date-box-month]')).toHaveTextContent(expectedMonth);
      expect(container.querySelector('[data-event-card-date-box-day]')).toHaveTextContent(expectedDay);
      expect(screen.getByText('till')).toBeInTheDocument();
    });

    it('renders no TILL badge for the absent-endDate fallback with no known end time', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      render(
        <EventCard
          eventName="Absent End, No Fallback Time"
          startDate={twoDaysAgo}
          variant="masonry"
          locale="en-US"
        />
      );

      expect(screen.queryByText(/till/)).not.toBeInTheDocument();
    });

    it('renders "till hh:mm" for the absent-endDate fallback when endTime is present and the fallback day is today', () => {
      const today = new Date();
      const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0)
      );

      render(
        <EventCard
          eventName="Absent End, Fallback Time Present"
          startDate={today}
          startTime="00:00:01"
          endTime="23:59:00"
          variant="masonry"
          locale="en-US"
        />
      );

      expect(screen.getByText(`till ${expectedTime}`)).toBeInTheDocument();
    });

    it('renders the TILL badge in the amber/corner treatment for prominentPoster=false (top_row_default)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();
      const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0)
      );

      render(
        <EventCard
          eventName="Amber Default"
          startDate={yesterday}
          startTime="00:00:01"
          endDate={today}
          endTime="23:59:00"
          variant="masonry"
          locale="en-US"
        />
      );

      const badge = screen.getByText(`till ${expectedTime}`);
      expect(badge).toHaveClass('bg-amber-700');
      expect(badge).toHaveClass('text-white');
      expect(badge).toHaveClass('-top-1.5');
      expect(badge).toHaveClass('-left-1.5');
      expect(badge).not.toHaveClass('bg-foreground');
      expect(badge).not.toHaveClass('-bottom-1.5');
    });

    it('renders the TILL badge in the amber/corner treatment for prominentPoster=true as well (AC3 both-states scope)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();
      const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0)
      );

      render(
        <EventCard
          eventName="Amber Prominent"
          startDate={yesterday}
          startTime="00:00:01"
          endDate={today}
          endTime="23:59:00"
          variant="masonry"
          prominentPoster
          imageUrl="http://example.com/image.jpg"
          locale="en-US"
        />
      );

      const badge = screen.getByText(`till ${expectedTime}`);
      expect(badge).toHaveClass('bg-amber-700');
      expect(badge).toHaveClass('text-white');
      // Story 1.i1l rule 4 (DESIGN.md event_card_till_badge, "OFFSET DIFFERS BY CONTEXT"):
      // prominentPoster=true is the ONE context taking the larger `-top-3` offset, so the tag
      // clears that short single-line chip's own text. The masonry-default two-tier pill above
      // keeps `-top-1.5`.
      expect(badge).toHaveClass('-top-3');
      expect(badge).not.toHaveClass('-top-1.5');
      expect(badge).toHaveClass('-left-1.5');
      expect(badge).not.toHaveClass('bg-foreground');
      expect(badge).not.toHaveClass('-bottom-1.5');
    });

    it('BUG-041: wraps the masonry-default date-box+thumbnail row in padding so the TILL badge is not flush against the card edge', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();
      const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0)
      );

      const { container } = render(
        <EventCard
          eventName="Amber Default"
          startDate={yesterday}
          startTime="00:00:01"
          endDate={today}
          endTime="23:59:00"
          variant="masonry"
          locale="en-US"
        />
      );

      // jsdom does not compute real layout/clipping, so the available, deterministic proof
      // is structural: the row that owns the date box (and therefore the TILL badge's
      // -top-1.5/-left-1.5 corner offset) must carry the p-2 padding matching the validated
      // prototype (default-with-thumbnail.html:62) -- without it the badge sits flush
      // against the <article>'s own overflow-hidden edge and gets clipped.
      const dateBox = container.querySelector('[data-event-card-date-box]');
      const row = dateBox?.closest('.relative.flex.items-stretch');
      expect(row).not.toBeNull();
      expect(row).toHaveClass('p-2');

      const badge = screen.getByText(`till ${expectedTime}`);
      expect(row?.contains(badge)).toBe(true);
    });
  });

  describe('Status badge (masonry, AC15) and Nearby badge (AC16)', () => {
    it('renders the nearby badge just under the distanceKm=8 boundary with the real distance (BUG-049) and omits it at/past it (Story 1.i1f AC5)', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={7.99} locale="en-US" />
      );
      expect(screen.getByText('8 km')).toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={8} locale="en-US" />);
      expect(screen.queryByText('8 km')).not.toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={8.01} locale="en-US" />);
      expect(screen.queryByText('8 km')).not.toBeInTheDocument();
    });

    it('respects a caller-supplied nearbyBadgeThreshold override', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={3} nearbyBadgeThreshold={2} locale="en-US" />
      );
      expect(screen.queryByText('3 km')).not.toBeInTheDocument();

      rerender(
        <EventCard {...defaultProps} variant="masonry" distanceKm={3} nearbyBadgeThreshold={4} locale="en-US" />
      );
      expect(screen.getByText('3 km')).toBeInTheDocument();
    });

    it('omits the nearby badge when distanceKm is null or undefined', () => {
      const { container, rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={null} locale="en-US" />
      );
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();

      rerender(<EventCard {...defaultProps} variant="masonry" locale="en-US" />);
      expect(container.querySelector('[data-event-card-nearby-badge]')).toBeNull();
    });

    it('renders the status badge alone (no nearby badge) when distanceKm is absent, and status-then-nearby order with the real distance (BUG-049) when present', () => {
      const { container, rerender } = render(
        <EventCard {...defaultProps} variant="masonry" locale="en-US" />
      );
      const badgeRow = container.querySelector('.p-3.flex-1.flex.flex-col.gap-2 > div');
      expect(badgeRow).not.toBeNull();
      expect(badgeRow?.children.length).toBe(1);

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={1} locale="en-US" />);
      const badgeRowWithNearby = container.querySelector('.p-3.flex-1.flex.flex-col.gap-2 > div');
      expect(badgeRowWithNearby?.children.length).toBe(2);
      expect(badgeRowWithNearby?.children[1]).toHaveTextContent('1.0 km');
    });

    it('renders the happeningNow status badge with the emerald DESIGN.md exception (Story 1.i1i AC4)', () => {
      const started = new Date();
      started.setDate(started.getDate() - 2);
      const ending = new Date();
      ending.setDate(ending.getDate() + 2);

      const { container } = render(
        <EventCard
          eventName="Happening Now Festival"
          startDate={started}
          endDate={ending}
          variant="masonry"
          locale="en-US"
        />
      );

      const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge).toHaveTextContent('Now');
      expect(badge).toHaveClass('bg-emerald-600');
      expect(badge).toHaveClass('text-white');
      expect(badge).not.toHaveClass('bg-muted');
      expect(badge).not.toHaveClass('text-muted-foreground');
    });

    it('renders every non-happeningNow state with the shared neutral base, never the emerald fill (Story 1.i1i AC4)', () => {
      const { container } = render(
        <EventCard
          eventName="Long Ended Festival"
          startDate={new Date('2020-01-01T10:00:00Z')}
          variant="masonry"
          locale="en-US"
        />
      );

      const badge = container.querySelector('[data-event-card-status-badge]') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge).toHaveTextContent('Ended');
      expect(badge).toHaveClass('bg-muted');
      expect(badge).toHaveClass('text-muted-foreground');
      expect(badge).not.toHaveClass('bg-emerald-600');
      expect(badge).not.toHaveClass('text-white');
    });

    it('marks each badge-row child with its primitive hook, in status-then-nearby order (Story 1.i1i AC5)', () => {
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={1} locale="en-US" />
      );
      const badgeRow = container.querySelector('.p-3.flex-1.flex.flex-col.gap-2 > div') as HTMLElement;
      expect(badgeRow.children[0].hasAttribute('data-event-card-status-badge')).toBe(true);
      expect(badgeRow.children[1].hasAttribute('data-event-card-nearby-badge')).toBe(true);
      expect(container.querySelectorAll('[data-event-card-status-badge]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-event-card-nearby-badge]')).toHaveLength(1);
    });
  });

  // ── Story 1.i1l ────────────────────────────────────────────────────────────
  // Rules 1, 4 and 7 of backlog row IDEA-046 originally edited lines shared by
  // `masonry+prominentPoster` AND `variant='standard'`. FIND-053 removed `standard`
  // entirely (dead code -- no production call site ever passed it), so these guards
  // now assert the masonry values directly instead of contrasting them against a
  // `standard` render.
  describe('Story 1.i1l — masonry sizing (AD-27)', () => {
    it('Story 0.45 AC7 — no longer caps the masonry card at 230px, but still declares a query container', () => {
      // Story 0.45 (AD-27): the fixed 230px cap is removed so the card fills its actual JS
      // masonry column width instead of centering inside a wider, mostly-empty grid cell. The
      // container-query mechanism (AC8) stays — it now steps off the card's real, JS-computed
      // width instead of a value that used to be pinned by the removed cap.
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" locale="en-US" />
      );
      const masonryRoot = container.querySelector('article') as HTMLElement;
      expect(masonryRoot).not.toHaveClass('max-w-[230px]');
      expect(masonryRoot).toHaveClass('[container-type:inline-size]');
      expect(masonryRoot).not.toHaveClass('max-w-sm');
      expect(masonryRoot).toHaveClass('w-full');
    });

    it('Story 0.45 AC7 — the loading skeleton drops the 230px cap in lockstep with the real card (no CLS on swap)', () => {
      // project-context.md, "Keep Skeletons in Sync With Their Real Component": a skeleton still
      // capped at 230px while the real card now fills its actual column width would reintroduce
      // the exact layout shift skeletons exist to prevent, just delayed until the swap.
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" loading locale="en-US" />
      );
      const skeleton = container.querySelector('.animate-pulse') as HTMLElement;
      expect(skeleton).not.toHaveClass('max-w-[230px]');
      expect(skeleton).not.toHaveClass('max-w-sm');
      expect(skeleton).toHaveClass('w-full');
    });

    it('Story 0.45 AC8 — the masonry title scales via a container-query step, not a viewport breakpoint', () => {
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" locale="en-US" />
      );
      const title = screen.getByText(defaultProps.eventName).closest('h3') as HTMLElement;
      expect(title).toHaveClass('text-sm');
      expect(title).toHaveClass('[@container(min-width:200px)]:text-base');
      // No viewport-breakpoint (sm:/md:/…) font-size class — the card's own rendered width
      // drives this, not the viewport (AC8's explicit constraint).
      expect(title.className).not.toMatch(/\b(sm|md|lg|xl|2xl):text-/);
    });

    it('moves the masonry date and favorite pills to top-5 together only when a TILL tag is present', () => {
      // DESIGN.md § event_card_date_box.base: the two move in lockstep so the tag has room
      // to clear the poster's own `overflow-hidden` edge.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { container } = render(
        <EventCard
          eventName="Has Till"
          startDate={yesterday}
          endDate={tomorrow}
          variant="masonry"
          prominentPoster
          imageUrl="http://example.com/image.jpg"
          locale="en-US"
          onFavoriteToggle={() => {}}
        />
      );
      const favPill = container.querySelector('article > button') as HTMLElement;
      expect(favPill).toHaveClass('top-5');
      expect(favPill).toHaveClass('right-2');
      const datePill = container.querySelector('.rounded-md.bg-background\\/80') as HTMLElement;
      expect(datePill).toHaveClass('top-5');
      expect(datePill).toHaveClass('left-2');
      // Padding stays uniform -- the rejected asymmetric-padding mechanism must not return.
      expect(datePill).toHaveClass('p-1');
      expect(datePill).not.toHaveClass('px-2.5');

      cleanup();

      // Already ended -> no TILL tag -> both pills stay at their default top-2.
      const longAgoStart = new Date();
      longAgoStart.setDate(longAgoStart.getDate() - 10);
      const longAgoEnd = new Date();
      longAgoEnd.setDate(longAgoEnd.getDate() - 9);
      const { container: noTill } = render(
        <EventCard
          eventName="No Till"
          startDate={longAgoStart}
          endDate={longAgoEnd}
          variant="masonry"
          prominentPoster
          imageUrl="http://example.com/image.jpg"
          locale="en-US"
          onFavoriteToggle={() => {}}
        />
      );
      expect(noTill.querySelector('article > button')).toHaveClass('top-2');
      expect(noTill.querySelector('.rounded-md.bg-background\\/80')).toHaveClass('top-2');
    });
  });

  describe('Prominent poster (masonry, AC17)', () => {
    it('uses the square poster treatment when prominentPoster is true (Story 1.i1l rule 2)', () => {
      render(
        <EventCard
          {...defaultProps}
          variant="masonry"
          imageUrl="http://example.com/image.jpg"
          prominentPoster
          locale="en-US"
        />
      );
      const img = screen.getByRole('img', { name: 'Summer Music Festival' });
      const imgContainer = img.parentElement;
      expect(imgContainer).toHaveClass('aspect-square');
      expect(imgContainer).not.toHaveClass('aspect-[2/3]');
      expect(imgContainer).not.toHaveClass('aspect-[3/4]');
    });

    it('renders the flex-fill thumbnail treatment (no aspect poster) when prominentPoster is false/omitted', () => {
      render(
        <EventCard
          {...defaultProps}
          variant="masonry"
          imageUrl="http://example.com/image.jpg"
          locale="en-US"
        />
      );
      const img = screen.getByRole('img', { name: 'Summer Music Festival' });
      // Default state uses the flex-fill thumbnail slot, not a full-width aspect poster
      const slot = img.closest('[data-event-card-media-slot]');
      expect(slot).not.toBeNull();
      expect(slot).toHaveClass('flex-1');
      expect(slot).toHaveClass('h-full');
      expect(slot).not.toHaveClass('aspect-[3/4]');
      expect(slot).not.toHaveClass('aspect-square');
    });
  });

  describe('Masonry default state favorite composition (AC4/AC5/AC6)', () => {
    it('renders exactly one focusable favorite-toggle control (outer top-right button suppressed) when onFavoriteToggle is provided', () => {
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" imageUrl="http://example.com/image.jpg" onFavoriteToggle={vi.fn()} />
      );
      // No href/onClick here, so RootTag is a <div> — the ONLY button on the card is the favorite control.
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Toggle favorite' })).toHaveLength(1);
    });

    it('calls onFavoriteToggle — and not the card onClick/navigation — when the sibling favorite badge is clicked', () => {
      const onFavoriteToggle = vi.fn();
      const onClick = vi.fn();
      render(
        <EventCard {...defaultProps} variant="masonry" imageUrl="http://example.com/image.jpg" onFavoriteToggle={onFavoriteToggle} onClick={onClick} />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Toggle favorite' }));
      expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('navigates (fires the card onClick) when clicking the thumbnail image area, not the favorite button (AC6)', () => {
      const onClick = vi.fn();
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard {...defaultProps} variant="masonry" imageUrl="http://example.com/image.jpg" onFavoriteToggle={onFavoriteToggle} onClick={onClick} />
      );
      fireEvent.click(screen.getByRole('img', { name: 'Summer Music Festival' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onFavoriteToggle).not.toHaveBeenCalled();
    });

    it('places the favorite control before the navigate-to-event root among <article> children (tab order, AC5)', () => {
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" imageUrl="http://example.com/image.jpg" onFavoriteToggle={vi.fn()} onClick={vi.fn()} />
      );
      const article = container.querySelector('article') as HTMLElement;
      const favButton = screen.getByRole('button', { name: 'Toggle favorite' });
      const favWrapper = favButton.parentElement as HTMLElement;
      const rootButton = Array.from(article.children).find(
        (child) => child.tagName === 'BUTTON' || child.tagName === 'A'
      ) as HTMLElement;
      const children = Array.from(article.children);
      expect(favWrapper).not.toBeNull();
      expect(rootButton).toBeDefined();
      expect(children.indexOf(favWrapper)).toBeGreaterThanOrEqual(0);
      expect(children.indexOf(favWrapper)).toBeLessThan(children.indexOf(rootButton));
    });

    // Regression test for the clipping bug: the no-thumbnail favorite badge is
    // min-h-11, but its wrapper's `height` here tracks the date box's own measured
    // height, which can be shorter -- without a minHeight floor, the badge overflows
    // its wrapper and gets clipped by the article's overflow-hidden (only the heart's
    // bottom point remained visible; confirmed live via Playwright against a seeded card).
    it('never lets the favorite-badge wrapper be shorter than the badge\'s own min-h-11 touch target', () => {
      render(<EventCard {...defaultProps} variant="masonry" onFavoriteToggle={vi.fn()} />);
      const favButton = screen.getByRole('button', { name: 'Toggle favorite' });
      const favWrapper = favButton.parentElement as HTMLElement;
      expect(favWrapper.style.minHeight).toBe(`${EVENT_CARD_BADGE_MIN_TOUCH_REM}rem`);
    });
  });

});
