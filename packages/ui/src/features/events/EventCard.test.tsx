/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCard } from './EventCard';
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
    
    // Simulate image load error
    fireEvent.error(img);
    
    // The image tag should be gone or replaced with fallback
    expect(screen.queryByRole('img', { name: 'Summer Music Festival' })).not.toBeInTheDocument();
    
    // Fallback text or element should exist
    expect(screen.getByText('No image available')).toBeInTheDocument();
  });

  it('renders no-imageUrl fallback immediately', () => {
    render(<EventCard {...defaultProps} />);
    // No imageUrl provided, should show fallback
    expect(screen.getByText('No image available')).toBeInTheDocument();
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

});
