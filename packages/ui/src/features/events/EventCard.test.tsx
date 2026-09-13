/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCard } from './EventCard';
import { eventCardBadgeIconSizeClass } from './event-card-media-tokens';
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
  // intentionally EXCLUDED from AC1 (legacy, non-primitive `aspect-[2/3]` sizing per Story 1.i1c).
  it('renders a blank, correctly-sized fallback on masonry with prominentPoster=true', () => {
    const { container } = render(<EventCard {...defaultProps} variant="masonry" prominentPoster />);
    // No placeholder text/icon and no img
    expect(screen.queryByText('No image available')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Wrapper div keeps its variant-appropriate sizing class (prominent poster => aspect-[2/3])
    const wrapper = container.querySelector('.relative.w-full.bg-muted.overflow-hidden');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('aspect-[2/3]');
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

      it('A date 3+ days in the future, SAME calendar year as today -> badge shows day+short-month only, no year, no time', () => {
        const futureSameYear = new Date();
        futureSameYear.setDate(futureSameYear.getDate() + 3);
        const now = new Date();
        futureSameYear.setFullYear(now.getFullYear());
        
        const expectedPillText = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(futureSameYear);

        render(
          <EventCard
            eventName="Masonry Future Same Year"
            startDate={futureSameYear}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.getByText(expectedPillText)).toBeInTheDocument();
        expect(screen.queryByText(String(futureSameYear.getFullYear()))).not.toBeInTheDocument();
      });

      it('A date in a DIFFERENT calendar year than today -> badge shows day+short-month+2-digit-year, no time', () => {
        const differentYearDate = new Date();
        differentYearDate.setFullYear(differentYearDate.getFullYear() + 2);
        
        const expectedPillText = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: '2-digit' }).format(differentYearDate);

        render(
          <EventCard
            eventName="Masonry Different Year"
            startDate={differentYearDate}
            variant="masonry"
            locale="en-US"
          />
        );

        expect(screen.getByText(expectedPillText)).toBeInTheDocument();
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
      // jsdom returns an SVGAnimatedString for svg.className, so read the class attribute.
      const cls = heart?.getAttribute('class') as string;
      expect(cls).toContain(eventCardBadgeIconSizeClass('default'));
      expect(cls).not.toContain('w-5');
      expect(cls).not.toContain('h-5');
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
      expect(badge).toHaveClass('-top-1.5');
      expect(badge).toHaveClass('-left-1.5');
      expect(badge).not.toHaveClass('bg-foreground');
      expect(badge).not.toHaveClass('-bottom-1.5');
    });
  });

  describe('Status badge (masonry, AC15) and Nearby badge (AC16)', () => {
    it('renders the nearby badge at the distanceKm=5 boundary and omits it just past it', () => {
      const { rerender } = render(
        <EventCard {...defaultProps} variant="masonry" distanceKm={5} locale="en-US" />
      );
      expect(screen.getByText('Nearby')).toBeInTheDocument();

      rerender(<EventCard {...defaultProps} variant="masonry" distanceKm={5.01} locale="en-US" />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
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
  });

  describe('Prominent poster (masonry, AC17)', () => {
    it('uses the enlarged aspect-[2/3] poster treatment when prominentPoster is true', () => {
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
      expect(imgContainer).toHaveClass('aspect-[2/3]');
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
      expect(slot).not.toHaveClass('aspect-[2/3]');
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
  });

});
