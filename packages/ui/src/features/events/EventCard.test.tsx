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

// Mirrors EventCard's own Intl.DateTimeFormat options, so expected values are
// computed with the same ICU data the component under test uses — this keeps
// the assertions correct regardless of which locale data the CI Node build
// ships (Node bundles full ICU by default since v13, so 'id' formatting is
// expected to be available; this pattern is just defense against the assumption
// ever becoming false, or the format options drifting).
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function expectedDate(locale: string, date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...(timeZone ? { timeZone } : {}) }).format(date);
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
        <EventCard {...defaultProps} />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedDate('id', defaultProps.startDate))).toBeInTheDocument();
    expect(screen.queryByText(expectedDate('en-US', defaultProps.startDate))).not.toBeInTheDocument();
  });

  it('lets an explicit locale prop override the ambient ScopedLocaleProvider', () => {
    render(
      <ScopedLocaleProvider locale="id">
        <EventCard {...defaultProps} locale="en-US" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedDate('en-US', defaultProps.startDate))).toBeInTheDocument();
  });

  it('formats the date using the nearest ScopedLocaleProvider timezone when no timezone prop is given', () => {
    render(
      <ScopedLocaleProvider locale="en-US" timezone="Asia/Jakarta">
        <EventCard {...defaultProps} />
      </ScopedLocaleProvider>
    );
    expect(
      screen.getByText(expectedDate('en-US', defaultProps.startDate, 'Asia/Jakarta'))
    ).toBeInTheDocument();
  });

  it('lets an explicit timezone prop override the ambient ScopedLocaleProvider timezone', () => {
    render(
      <ScopedLocaleProvider locale="en-US" timezone="Asia/Jakarta">
        <EventCard {...defaultProps} timezone="UTC" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText(expectedDate('en-US', defaultProps.startDate, 'UTC'))).toBeInTheDocument();
  });

  it('inherits the timezone from an outer provider when a nested provider only overrides locale', () => {
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <ScopedLocaleProvider locale="en-US">
          <EventCard {...defaultProps} />
        </ScopedLocaleProvider>
      </ScopedLocaleProvider>
    );
    expect(
      screen.getByText(expectedDate('en-US', defaultProps.startDate, 'Asia/Jakarta'))
    ).toBeInTheDocument();
  });

  it('falls back to a safe format instead of crashing when given an invalid timezone', () => {
    render(<EventCard {...defaultProps} locale="en-US" timezone="Not/A_Real_Zone" />);
    // Degrades to locale-only formatting (no timeZone applied) rather than throwing.
    expect(screen.getByText(expectedDate('en-US', defaultProps.startDate))).toBeInTheDocument();
  });

  // DW-070 (BUG-013): a bad `startDate` can still yield an Invalid Date inside
  // combineDateTime (its isNaN guard only covers its internal date+time fallback), and
  // that NaN must not propagate unguarded into getEventDayDiff/formatRelativeDayOrDate
  // (or formatShortEventDateTime, which calls getEventDayDiff internally) and throw in
  // Intl formatting. Both variants must instead degrade to a blank date without crashing.
  it('degrades to a blank date (no throw) when given an invalid startDate (standard variant)', () => {
    render(
      <EventCard eventName="Broken Date Card" startDate={new Date('not-a-real-date')} locale="en-US" />
    );
    expect(screen.getByText('Broken Date Card')).toBeInTheDocument();
  });

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
        categories={['Music', 'Outdoor']}
        types={['Festival']}
        priceFrom={50}
      />
    );
    
    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders translated labels for categories/types/price when provided, falling back to raw values otherwise', () => {
    render(
      <EventCard
        {...defaultProps}
        locale="en-US"
        categories={['MUSIC']}
        types={['FESTIVAL']}
        priceFrom={50}
        labels={{
          categoryLabels: { MUSIC: 'Music' },
          typeLabels: { FESTIVAL: 'Festival' },
          priceFrom: 'Starting at',
        }}
      />
    );

    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Starting at')).toBeInTheDocument();
    expect(screen.queryByText('MUSIC')).not.toBeInTheDocument();
    expect(screen.queryByText('FESTIVAL')).not.toBeInTheDocument();

    cleanup();

    // No labels provided: falls back to the raw value rather than throwing/blanking
    render(
      <EventCard
        {...defaultProps}
        locale="en-US"
        categories={['MUSIC']}
        types={['FESTIVAL']}
        priceFrom={50}
      />
    );
    expect(screen.getByText('MUSIC')).toBeInTheDocument();
    expect(screen.getByText('FESTIVAL')).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
  });

  it('handles image success', () => {
    render(<EventCard {...defaultProps} imageUrl="http://example.com/image.jpg" />);
    
    const img = screen.getByRole('img', { name: 'Summer Music Festival' });
    expect(img).toHaveAttribute('src', 'http://example.com/image.jpg');
  });

  it('handles image error fallback', () => {
    render(<EventCard {...defaultProps} imageUrl="http://example.com/bad-image.jpg" />);

    const img = screen.getByRole('img', { name: 'Summer Music Festival' });
    const imgContainer = img.parentElement;

    // Simulate image load error
    fireEvent.error(img);

    // The image tag is removed and no placeholder text/icon renders instead
    expect(screen.queryByRole('img', { name: 'Summer Music Festival' })).not.toBeInTheDocument();
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();

    // No reflow: the wrapper div keeps its variant-appropriate footprint (standard => h-48)
    expect(imgContainer).not.toBeNull();
    expect(imgContainer).toHaveClass('h-48');
    expect(imgContainer).toHaveClass('bg-muted');
  });

  it('renders no-imageUrl fallback immediately', () => {
    const { container } = render(<EventCard {...defaultProps} />);
    // No imageUrl provided: reserved blank slot, no placeholder text/icon, no img
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const wrapper = container.querySelector('.relative.w-full.bg-muted.overflow-hidden.h-48');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('h-48');
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

  // Story 0.35 (DW-048): the "From" label must only pair with a price value that reads as
  // numeric/currency (contains a digit). Free-form status text (e.g. "Free") has no numeric
  // amount, so pairing it with "From" reads as grammatically broken ("From Free").
  describe('priceFrom "From" label pairing (Story 0.35)', () => {
    it('renders free-form text with no "From" prefix when it contains no digit', () => {
      render(<EventCard {...defaultProps} priceFrom="Free" />);

      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.queryByText('From')).not.toBeInTheDocument();
    });

    it('renders longer free-form text with no "From" prefix when it contains no digit', () => {
      render(<EventCard {...defaultProps} priceFrom="Free with registration" />);

      expect(screen.getByText('Free with registration')).toBeInTheDocument();
      expect(screen.queryByText('From')).not.toBeInTheDocument();
    });

    it('still renders the "From" prefix for a currency-coded amount even though the code starts with letters', () => {
      render(<EventCard {...defaultProps} priceFrom="IDR 150000" />);

      expect(screen.getByText('IDR 150000')).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();
    });

    it('still renders the "From" prefix for a numeric priceFrom', () => {
      render(<EventCard {...defaultProps} priceFrom={50} />);

      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();
    });

    it('still renders the "From" prefix for a currency string with a digit (e.g. "$20")', () => {
      render(<EventCard {...defaultProps} priceFrom="$20" />);

      expect(screen.getByText('$20')).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();
    });
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

    it('renders "Today" for dates 0 days out', () => {
      const today = new Date();
      render(<EventCard eventName="Today Event" startDate={today} locale="en-US" />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('renders "Tomorrow" for dates 1 day out', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      render(<EventCard eventName="Tomorrow Event" startDate={tomorrow} locale="en-US" />);
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    });

    it('renders weekday name for dates 2-6 days out', () => {
      const day2 = new Date();
      day2.setDate(day2.getDate() + 2);
      const expectedWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(day2);

      render(<EventCard eventName="Weekday Event" startDate={day2} locale="en-US" />);
      expect(screen.getByText(expectedWeekday)).toBeInTheDocument();
    });

    it('falls back to standard absolute format for dates exactly 7 days out', () => {
      const day7 = new Date();
      day7.setDate(day7.getDate() + 7);
      const expectedAbsDate = expectedDate('en-US', day7);

      render(<EventCard eventName="Future Event" startDate={day7} locale="en-US" />);
      expect(screen.getByText(expectedAbsDate)).toBeInTheDocument();
    });

    describe('Masonry badge display behavior', () => {
      it('Today WITH a startTime provided -> badge shows the formatted time (via formatEventTime), with the Clock icon present', () => {
        const today = new Date();
        const dateWithTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0);
        const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dateWithTime);
        
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
        expect(screen.getByText(expectedTime)).toBeInTheDocument();
        const clockIcon = container.querySelector('svg.lucide-clock');
        expect(clockIcon).toBeInTheDocument();
      });

      it('Today with NO startTime provided (startTime omitted/null) -> badge shows Today text, no Clock icon', () => {
        const today = new Date();
        const { container } = render(
          <EventCard
            eventName="Masonry Today no Time"
            startDate={today}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.getByText('Today')).toBeInTheDocument();
        const clockIcon = container.querySelector('svg.lucide-clock');
        expect(clockIcon).not.toBeInTheDocument();
      });

      it('Tomorrow (dayDiff===1) -> badge shows Tomorrow', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const { container } = render(
          <EventCard
            eventName="Masonry Tomorrow"
            startDate={tomorrow}
            variant="masonry"
            locale="en-US"
          />
        );

        // Both the date box (AC12) and the below-image status badge (AC15) render
        // "Tomorrow" for a dayDiff===1 event -- scope to the date box (primitive) specifically.
        const datePill = container.querySelector('[data-event-card-date-box]');
        expect(datePill).toHaveTextContent('Tomorrow');
        expect(screen.getAllByText('Tomorrow').length).toBe(2);
      });

      it('Yesterday (dayDiff===-1) -> badge shows Yesterday (new case)', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        render(
          <EventCard
            eventName="Masonry Yesterday"
            startDate={yesterday}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.getByText('Yesterday')).toBeInTheDocument();
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
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard {...defaultProps} onFavoriteToggle={onFavoriteToggle} isFavorited={false} />
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
      const onFavoriteToggle = vi.fn();
      render(
        <EventCard
          {...defaultProps}
          onFavoriteToggle={onFavoriteToggle}
          favoriteCount={42}
        />
      );

      const btn = screen.getByLabelText(/favorite/i);
      expect(btn).toHaveTextContent('42');
      // Button positioning + pill background stay byte-for-byte the same (AC2).
      expect(btn.className).toContain('absolute');
      expect(btn.className).toContain('top-3');
      expect(btn.className).toContain('right-3');
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
    it('renders the nearby badge just under the distanceKm=8 boundary and omits it at/past it (Story 1.i1f AC5)', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={7.99} locale="en-US" />
      );
      expect(screen.getByText('Nearby')).toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={8} locale="en-US" />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={8.01} locale="en-US" />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
    });

    it('respects a caller-supplied nearbyBadgeThreshold override', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={3} nearbyBadgeThreshold={2} locale="en-US" />
      );
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();

      rerender(
        <EventCard {...defaultProps} variant="masonry" distanceKm={3} nearbyBadgeThreshold={4} locale="en-US" />
      );
      expect(screen.getByText('Nearby')).toBeInTheDocument();
    });

    it('omits the nearby badge when distanceKm is null or undefined', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={null} locale="en-US" />
      );
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" locale="en-US" />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
    });

    it('renders the status badge alone (no nearby badge) when distanceKm is absent, and status-then-nearby order when present', () => {
      const { container, rerender } = render(
        <EventCard {...defaultProps} variant="masonry" locale="en-US" />
      );
      const badgeRow = container.querySelector('.p-3.flex-1.flex.flex-col.gap-2 > div');
      expect(badgeRow).not.toBeNull();
      expect(badgeRow?.children.length).toBe(1);

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={1} locale="en-US" />);
      const badgeRowWithNearby = container.querySelector('.p-3.flex-1.flex.flex-col.gap-2 > div');
      expect(badgeRowWithNearby?.children.length).toBe(2);
      expect(badgeRowWithNearby?.children[1]).toHaveTextContent('Nearby');
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
  // Rules 1, 4 and 7 of backlog row IDEA-046 all edit lines that serve BOTH
  // `masonry+prominentPoster` AND `variant='standard'`. Only masonry is in the
  // 2026-09-14 pass's scope, so these guard the gate rather than the new values --
  // without them a later "simplification" that drops the `isMasonry ?` ternary would
  // silently shrink and reposition the standard card and no test would notice.
  describe('Story 1.i1l — masonry-only gating (variant="standard" regression guard)', () => {
    it('caps the card at 230px and declares a query container on masonry only', () => {
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" locale="en-US" />
      );
      const masonryRoot = container.querySelector('article') as HTMLElement;
      expect(masonryRoot).toHaveClass('max-w-[230px]');
      expect(masonryRoot).toHaveClass('[container-type:inline-size]');
      expect(masonryRoot).not.toHaveClass('max-w-sm');

      cleanup();

      const { container: std } = render(<EventCard {...defaultProps} locale="en-US" />);
      const standardRoot = std.querySelector('article') as HTMLElement;
      expect(standardRoot).toHaveClass('max-w-sm');
      expect(standardRoot).not.toHaveClass('max-w-[230px]');
      // No container on the standard card, so the badge font-size step never fires there.
      expect(standardRoot).not.toHaveClass('[container-type:inline-size]');
    });

    it('caps the loading skeleton to match its real card (no CLS on swap)', () => {
      // project-context.md, "Keep Skeletons in Sync With Their Real Component": a skeleton
      // left at 384px while the real card renders at 230px reintroduces the exact layout
      // shift skeletons exist to prevent, just delayed until the swap.
      const { container } = render(
        <EventCard {...defaultProps} variant="masonry" loading locale="en-US" />
      );
      const skeleton = container.querySelector('.animate-pulse') as HTMLElement;
      expect(skeleton).toHaveClass('max-w-[230px]');
      expect(skeleton).not.toHaveClass('max-w-sm');

      cleanup();

      const { container: std } = render(<EventCard {...defaultProps} loading locale="en-US" />);
      expect(std.querySelector('.animate-pulse')).toHaveClass('max-w-sm');
    });

    it('leaves the standard card favorite pill at its shipped top-3 right-3 position', () => {
      // Rule 4 moves the masonry pill to top-2/top-5 and right-2; `standard` is untouched.
      const { container } = render(
        <EventCard {...defaultProps} locale="en-US" onFavoriteToggle={() => {}} />
      );
      const pill = container.querySelector('article > button') as HTMLElement;
      expect(pill).not.toBeNull();
      expect(pill).toHaveClass('top-3');
      expect(pill).toHaveClass('right-3');
      expect(pill).not.toHaveClass('top-2');
      expect(pill).not.toHaveClass('top-5');
      expect(pill).not.toHaveClass('right-2');
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
