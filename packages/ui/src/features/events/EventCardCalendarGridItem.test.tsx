/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCardCalendarGridItem } from './EventCardCalendarGridItem';

describe('EventCardCalendarGridItem (Story 1.i1f AC15-16)', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    eventName: 'Summer Music Festival',
    location: 'Central Park',
    isMultiDay: false,
  };

  describe('With-image composition (multi-day, image not errored)', () => {
    it('renders the thumbnail, title, and venue in the 3-column with-image layout', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://img.example/poster.jpg');
      expect(img).toHaveClass('w-14', 'aspect-square', 'object-cover');
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      // 3-column row, items-center per DESIGN.md base token.
      expect(container.firstChild).toHaveClass('flex', 'items-center');
    });

    it('does not render a status badge in the with-image composition', () => {
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(screen.queryByText(/upcoming/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/happening now/i)).not.toBeInTheDocument();
    });

    it('falls back to the no-image (two-row) composition when a multi-day image errors', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/broken.jpg"
        />
      );

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      fireEvent.error(img!);

      expect(container.querySelector('img')).toBeNull();
      expect(container.firstChild).toHaveClass('flex-col');
    });
  });

  describe('No-image composition (single-day, or multi-day without an image)', () => {
    it('renders the two-row stacked layout — title/favorite row, then venue/nearby row', () => {
      const { container } = render(<EventCardCalendarGridItem {...defaultProps} />);

      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByText('Summer Music Festival')).toBeInTheDocument();
      expect(screen.getByText('Central Park')).toBeInTheDocument();
      expect(container.firstChild).toHaveClass('flex-col');
    });

    it('never renders an image for a single-day event even when imageUrl is supplied', () => {
      const { container } = render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay={false}
          imageUrl="https://img.example/poster.jpg"
        />
      );
      expect(container.querySelector('img')).toBeNull();
    });

    it('omits the venue row content entirely when location is absent', () => {
      render(<EventCardCalendarGridItem {...defaultProps} location={undefined} />);
      expect(screen.queryByText('Central Park')).not.toBeInTheDocument();
    });
  });

  describe('Nearby badge (<8km gate, shared with both compositions)', () => {
    it('renders the badge just under 8km and omits it at/past the boundary', () => {
      const { rerender } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={7.99} />
      );
      expect(screen.getByText('Nearby')).toBeInTheDocument();

      rerender(<EventCardCalendarGridItem {...defaultProps} distanceKm={8} />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
    });

    it('omits the badge when distanceKm is null or undefined', () => {
      const { rerender } = render(
        <EventCardCalendarGridItem {...defaultProps} distanceKm={null} />
      );
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();

      rerender(<EventCardCalendarGridItem {...defaultProps} />);
      expect(screen.queryByText('Nearby')).not.toBeInTheDocument();
    });

    it('renders the badge in the with-image composition too', () => {
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isMultiDay
          imageUrl="https://img.example/poster.jpg"
          distanceKm={1}
        />
      );
      expect(screen.getByText('Nearby')).toBeInTheDocument();
    });
  });

  describe('Favorite toggle', () => {
    it('renders the large favorite control and fires onFavoriteToggle on click', () => {
      const onFavoriteToggle = vi.fn();
      render(
        <EventCardCalendarGridItem
          {...defaultProps}
          isFavorited
          favoriteCount={12}
          onFavoriteToggle={onFavoriteToggle}
        />
      );

      const button = screen.getByRole('button', { name: 'Toggle favorite' });
      fireEvent.click(button);
      expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('does not render a favorite control when onFavoriteToggle is not provided', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'Toggle favorite' })).not.toBeInTheDocument();
    });
  });

  describe('Title/venue wrap behavior', () => {
    it('title has no truncation class (wraps freely across multiple lines)', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      const title = screen.getByText('Summer Music Festival');
      expect(title).not.toHaveClass('truncate');
      expect(title).not.toHaveClass('line-clamp-1');
      expect(title).not.toHaveClass('line-clamp-2');
    });

    it('venue is clamped to 2 lines', () => {
      render(<EventCardCalendarGridItem {...defaultProps} />);
      const venue = screen.getByText('Central Park');
      expect(venue).toHaveClass('line-clamp-2');
    });
  });
});
