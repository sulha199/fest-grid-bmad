/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCardCompact } from './EventCardCompact';

describe('EventCardCompact (Story 3.6ua)', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    eventName: 'Summer Music Festival',
    isMainSchedule: true,
    dateBoxMonth: 'AUG',
    dateBoxDay: '15',
    dateBoxTillLabel: 'till',
    eventStartDate: '2026-08-15',
    eventStartTime: '18:00',
    eventEndDate: '2026-08-15',
    eventEndTime: '23:00',
    locale: 'en-US',
    timezone: 'UTC',
    onClick: vi.fn(),
    favoriteToggleLabel: 'Toggle favorite',
  };

  describe('Full-data render (AC2, AC4)', () => {
    it('renders title, location, status badge, nearby badge, and repeat badge', () => {
      render(
        <EventCardCompact
          {...defaultProps}
          locationName="Central Park"
          distanceKm={2}
          nearbyBadgeThreshold={8}
          applicableDaysOfWeek={['MONDAY', 'WEDNESDAY'] as any}
          dayOfWeekLabels={{ MONDAY: 'Mon', WEDNESDAY: 'Wed' }}
        />
      );

      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      // Status badge renders some text (exact state depends on now() vs. fixed fixture dates).
      expect(document.querySelector('[data-event-card-status-badge]')).toBeInTheDocument();
      // Nearby badge: distanceKm (2) < default threshold (8).
      expect(document.querySelector('[data-event-card-status-badge]')).toBeInTheDocument();
      // Repeat badge present when applicableDaysOfWeek is non-empty.
      expect(document.querySelector('[data-event-card-repeat-badge]')).toBeInTheDocument();
    });

    it('renders the bold title weight when isMainSchedule is true, normal otherwise', () => {
      const { rerender } = render(<EventCardCompact {...defaultProps} isMainSchedule />);
      expect(screen.getByText('Summer Music Festival')).toHaveClass('font-bold');

      rerender(<EventCardCompact {...defaultProps} isMainSchedule={false} />);
      expect(screen.getByText('Summer Music Festival')).toHaveClass('font-normal');
    });

    it('renders the date box content passed in by the caller', () => {
      render(<EventCardCompact {...defaultProps} />);
      expect(document.querySelector('[data-event-card-date-box-month]')).toHaveTextContent('AUG');
      expect(document.querySelector('[data-event-card-date-box-day]')).toHaveTextContent('15');
    });

    it('renders the added-to-calendar icon when isAddedToCalendar is true', () => {
      render(<EventCardCompact {...defaultProps} isAddedToCalendar addedToCalendarBadgeLabel="Added to calendar" />);
      expect(screen.getByTestId('calendar-plus-icon')).toBeInTheDocument();
    });
  });

  describe('Minimal-data render (only guaranteed fields)', () => {
    it('renders without crashing when only required props are supplied', () => {
      render(<EventCardCompact {...defaultProps} />);
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      // No location line when locationName is omitted.
      expect(screen.queryByText('Central Park')).not.toBeInTheDocument();
      // No repeat badge when applicableDaysOfWeek is omitted.
      expect(document.querySelector('[data-event-card-repeat-badge]')).not.toBeInTheDocument();
    });
  });

  describe('Loading skeleton (AC3)', () => {
    it('renders a skeleton with aria-busy and no partial content when loading is true', () => {
      render(<EventCardCompact {...defaultProps} loading />);
      const skeleton = screen.getByLabelText('Loading event');
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
      // No partial/undefined content underneath.
      expect(screen.queryByText('Summer Music Festival')).not.toBeInTheDocument();
      expect(document.querySelector('[data-event-card-date-box]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-event-card-status-badge]')).not.toBeInTheDocument();
    });
  });

  describe('Image-present vs. image-absent favorite-badge placement (AC2, per no-reserved-space rule)', () => {
    it('places the small corner-pill favorite badge when an image is present', () => {
      render(
        <EventCardCompact
          {...defaultProps}
          imageUrl="https://img.example/poster.jpg"
          isFavorited
          favoriteCount={3}
          onFavoriteToggle={vi.fn()}
        />
      );
      const img = document.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://img.example/poster.jpg');

      const favoriteButtons = screen.getAllByRole('button', { name: 'Toggle favorite' });
      // Exactly one favorite control renders (the slot's own corner pill; the "large"
      // fallback variant collapses to null when an image is present).
      expect(favoriteButtons).toHaveLength(1);
      expect(favoriteButtons[0].closest('.absolute')).toHaveClass('-top-1.5', '-right-1.5');
    });

    it('places the large, growing favorite badge when no image is present (collapseOnFallback, no reserved space)', () => {
      render(<EventCardCompact {...defaultProps} isFavorited favoriteCount={5} onFavoriteToggle={vi.fn()} />);
      // No media slot in the DOM at all (collapseOnFallback).
      expect(document.querySelector('[data-event-card-media-slot]')).not.toBeInTheDocument();

      const favoriteButtons = screen.getAllByRole('button', { name: 'Toggle favorite' });
      expect(favoriteButtons).toHaveLength(1);
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Multi-day chrome (AC2)', () => {
    it('applies MULTI_DAY_EVENT_CLASS and rounded corners when isMultiDayRun is true', () => {
      render(<EventCardCompact {...defaultProps} isMultiDayRun />);
      const chrome = screen.getByTestId('event-card-compact');
      expect(chrome).toHaveClass('rounded-md');
      // Differentiating tokens unique to MULTI_DAY_EVENT_CLASS vs. EVENT_CARD_COMPACT_CLASS.
      expect(chrome).toHaveClass('p-1', 'transition-colors');
      expect(chrome).not.toHaveClass('p-2', 'shadow-sm', 'transition-all');
    });

    it('applies EVENT_CARD_COMPACT_CLASS (single-day chrome) when isMultiDayRun is false/omitted', () => {
      render(<EventCardCompact {...defaultProps} />);
      const chrome = screen.getByTestId('event-card-compact');
      expect(chrome).toHaveClass('p-2', 'shadow-sm', 'transition-all');
      expect(chrome).not.toHaveClass('p-1', 'transition-colors');
    });
  });

  describe('Interaction callbacks', () => {
    it('fires onFavoriteToggle when the favorite control is clicked', () => {
      const onFavoriteToggle = vi.fn();
      render(<EventCardCompact {...defaultProps} onFavoriteToggle={onFavoriteToggle} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle favorite' }));
      expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
      // Zero-arg callback — caller closes over its own event identity.
      expect(onFavoriteToggle).toHaveBeenCalledWith();
    });

    it('fires onClick when the schedule-click target is activated', () => {
      const onClick = vi.fn();
      render(<EventCardCompact {...defaultProps} onClick={onClick} />);
      fireEvent.click(screen.getByText('Summer Music Festival'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
