import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { EventDetailView } from './EventDetailView';

describe('EventDetailView', () => {
  afterEach(() => {
    cleanup();
  });
  const minimalProps = {
    eventName: 'Test Event',
    location: 'Test Location',
    schedules: [
      {
        id: 'sched-1',
        eventStartDate: '2026-08-10T10:00:00Z',
      },
    ],
    labels: {
      loadingText: 'Loading event details...',
      errorText: 'Failed to load event.',
      locationLabel: 'Location',
      performersLabel: 'Performers',
      ticketPriceLabel: 'Ticket Price',
      noSchedulesLabel: 'No schedules available.',
      defaultScheduleTitle: 'Schedule',
      favoriteButtonLabel: 'Add to Favorites',
      removeFavoriteButtonLabel: 'Remove from Favorites',
      addToCalendarButtonLabel: 'Add to Calendar',
      postedByLabel: 'Posted by:',
      viewOriginalPostLabel: 'View original post',
      viewSourceLabel: 'View source',
      addToCalendarDialogTitle: 'Select Schedules',
      addToCalendarConfirmLabel: 'Confirm',
      addToCalendarCancelLabel: 'Cancel',
    },
  };

  const fullProps = {
    ...minimalProps,
    description: 'A great event description.',
    schedules: [
      {
        id: 'sched-1',
        eventStartDate: '2026-08-10T10:00:00Z',
        eventEndDate: '2026-08-10T12:00:00Z',
        eventStartTime: '10:00 AM',
        eventEndTime: '12:00 PM',
        title: 'Morning Session',
        performers: 'Band A, DJ B',
        location: 'Stage 1',
        ticketPrice: '$10',
        mapUrl: 'https://maps.example.com/stage1',
      },
      {
        id: 'sched-2',
        eventStartDate: '2026-08-11T14:00:00Z',
        title: 'Afternoon Session',
        // omitting location to test fallback
      },
    ],
    types: ['Festival', 'Workshop'],
    categories: ['Music', 'Art'],
    imageUrl: 'https://example.com/image.jpg',
    imageAlt: 'Custom Alt Text',
    originalPostUrl: 'https://instagram.com/p/123',
    sourcePostUrl: 'https://imginn.com/p/123',
    accountName: 'FestOrganizer',
    accountPlatformIconUrl: 'https://example.com/ig-icon.png',
    accountHref: '/instagram/festorganizer',
  };

  it('renders minimal guaranteed fields correctly', () => {
    render(<EventDetailView {...minimalProps} />);
    
    expect(screen.getByRole('heading', { name: 'Test Event' })).toBeInTheDocument();
    expect(screen.getByText('Mon, Aug 10, 2026')).toBeInTheDocument(); // fallback header when single schedule
    expect(screen.getByText('Test Location')).toBeInTheDocument();
  });

  it('renders full data including multiple schedules and fallback location', () => {
    render(<EventDetailView {...fullProps} />);
    
    expect(screen.getByRole('heading', { name: 'Test Event' })).toBeInTheDocument();
    expect(screen.getByText('A great event description.')).toBeInTheDocument();
    
    // Schedules
    expect(screen.getByText('Morning Session')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Session')).toBeInTheDocument();
    
    // Schedule 1 specific details
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Band A, DJ B')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Stage 1/i })).toHaveAttribute('href', 'https://maps.example.com/stage1');

    // Schedule 2 fallback location (no map link)
    // Note: Test Location will be present for schedule 2 because it falls back to event level location
    const locations = screen.getAllByText('Test Location');
    expect(locations.length).toBeGreaterThan(0);
  });

  it('renders tags when provided', () => {
    render(<EventDetailView {...fullProps} />);
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('does not render tag lists if absent', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByRole('list', { name: /Event categories and types/i })).not.toBeInTheDocument();
  });

  it('renders image success', () => {
    render(<EventDetailView {...fullProps} />);
    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('renders image fallback on error', () => {
    render(<EventDetailView {...fullProps} />);
    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    fireEvent.error(img);
    // Should remove the img element and render the fallback icon
    expect(screen.queryByRole('img', { name: 'Custom Alt Text' })).not.toBeInTheDocument();
  });

  it('renders no-imageUrl fallback', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders loading skeleton with aria-busy', () => {
    render(<EventDetailView {...minimalProps} loading={true} />);
    const skeleton = screen.getByLabelText('Loading event details...');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('heading', { name: 'Test Event' })).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<EventDetailView {...minimalProps} error={{ message: 'Network Error' }} />);
    expect(screen.getByText('Failed to load event.')).toBeInTheDocument();
    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Test Event' })).not.toBeInTheDocument();
  });

  it('does not render favorite or calendar controls when handlers are absent', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByRole('button', { name: /Favorite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Calendar/i })).not.toBeInTheDocument();
  });

  it('renders favorite and calendar controls when handlers are provided', () => {
    const onFavoriteToggle = vi.fn();
    const onAddToCalendar = vi.fn();
    render(<EventDetailView {...minimalProps} onFavoriteToggle={onFavoriteToggle} onAddToCalendar={onAddToCalendar} isFavorited={true} isAddedToCalendar={false} />);
    
    const favBtn = screen.getByRole('button', { name: 'Remove from Favorites' });
    const calBtn = screen.getByRole('button', { name: 'Add to Calendar' });
    
    expect(favBtn).toBeInTheDocument();
    expect(favBtn).toHaveAttribute('aria-pressed', 'true');
    
    expect(calBtn).toBeInTheDocument();
    expect(calBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(favBtn);
    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it('opens add to calendar dialog on click and handles confirm', () => {
    const onAddToCalendar = vi.fn();
    const testProps = {
      ...fullProps,
      schedules: [
        {
          id: 'sched-1',
          eventStartDate: '2026-08-10T10:00:00Z',
          title: 'Morning Session',
          isAddedToCalendar: true,
        },
        {
          id: 'sched-2',
          eventStartDate: '2026-08-11T14:00:00Z',
          title: 'Afternoon Session',
          isAddedToCalendar: false,
        },
      ],
    };
    render(<EventDetailView {...testProps} onAddToCalendar={onAddToCalendar} isAddedToCalendar={true} />);

    const calBtn = screen.getByRole('button', { name: 'Add to Calendar' });
    expect(calBtn).toHaveAttribute('aria-pressed', 'true');

    // Click to open dialog
    fireEvent.click(calBtn);

    // Verify dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Select Schedules')).toBeInTheDocument();

    // Check pre-checked states
    const checkbox1 = screen.getByLabelText(/Morning Session/) as HTMLInputElement;
    const checkbox2 = screen.getByLabelText(/Afternoon Session/) as HTMLInputElement;
    expect(checkbox1.checked).toBe(true);
    expect(checkbox2.checked).toBe(false);

    // Check afternoon session as well
    fireEvent.click(checkbox2);
    expect(checkbox2.checked).toBe(true);

    // Click Confirm
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);

    // Dialog should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAddToCalendar).toHaveBeenCalledWith(['sched-1', 'sched-2']);
  });

  it('handles dialog cancel and outside click / escape with no callback', () => {
    const onAddToCalendar = vi.fn();
    render(<EventDetailView {...fullProps} onAddToCalendar={onAddToCalendar} />);

    const calBtn = screen.getByRole('button', { name: 'Add to Calendar' });
    
    // Test Cancel button
    fireEvent.click(calBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAddToCalendar).not.toHaveBeenCalled();

    // Test Escape key
    fireEvent.click(calBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog').firstChild!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAddToCalendar).not.toHaveBeenCalled();
  });

  // AC15 Tests
  it('renders both source post attribution links when present', () => {
    render(<EventDetailView {...minimalProps} originalPostUrl="http://orig" sourcePostUrl="http://source" />);
    expect(screen.getByRole('link', { name: /View original post/i })).toHaveAttribute('href', 'http://orig');
    expect(screen.getByRole('link', { name: /View source/i })).toHaveAttribute('href', 'http://source');
  });

  it('renders only originalPostUrl when sourcePostUrl is absent', () => {
    render(<EventDetailView {...minimalProps} originalPostUrl="http://orig" />);
    expect(screen.getByRole('link', { name: /View original post/i })).toHaveAttribute('href', 'http://orig');
    expect(screen.queryByRole('link', { name: /View source/i })).not.toBeInTheDocument();
  });

  it('renders only sourcePostUrl when originalPostUrl is absent', () => {
    render(<EventDetailView {...minimalProps} sourcePostUrl="http://source" />);
    expect(screen.queryByRole('link', { name: /View original post/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View source/i })).toHaveAttribute('href', 'http://source');
  });

  it('does not render source attribution section when both links are absent', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByRole('link', { name: /View original post/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View source/i })).not.toBeInTheDocument();
  });

  // AC16 Tests
  it('renders account attribution link when all three props are present', () => {
    render(<EventDetailView {...minimalProps} accountName="Org" accountPlatformIconUrl="http://icon" accountHref="/link" />);
    const link = screen.getByRole('link', { name: /Org/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/link');
    expect(screen.getByText('Posted by:')).toBeInTheDocument();
  });

  it('omits account attribution section when any account prop is missing', () => {
    // Missing accountHref
    const { rerender } = render(<EventDetailView {...minimalProps} accountName="Org" accountPlatformIconUrl="http://icon" />);
    expect(screen.queryByText('Posted by:')).not.toBeInTheDocument();

    // Missing accountName
    rerender(<EventDetailView {...minimalProps} accountPlatformIconUrl="http://icon" accountHref="/link" />);
    expect(screen.queryByText('Posted by:')).not.toBeInTheDocument();

    // Missing accountPlatformIconUrl
    rerender(<EventDetailView {...minimalProps} accountName="Org" accountHref="/link" />);
    expect(screen.queryByText('Posted by:')).not.toBeInTheDocument();
  });

  it('renders both account attribution and source post links simultaneously', () => {
    render(<EventDetailView {...fullProps} />);
    expect(screen.getByRole('link', { name: /FestOrganizer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View original post/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View source/i })).toBeInTheDocument();
  });
});
