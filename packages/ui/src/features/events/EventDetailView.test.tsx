import React from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
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
      privateContactMessageLabel: "Contact info isn't shown to protect the poster's privacy — see the original post for details.",
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
    accountUsername: 'festorganizer',
    accountPlatform: 'instagram',
    accountId: '123',
    isSubscribedToAccount: false,
    onSubscribeToAccount: vi.fn(),
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

  it('renders video when videoUrl is present', () => {
    const props = {
      ...fullProps,
      videoUrl: 'https://example.com/video.mp4',
      videoAlt: 'Test Video Alt',
    };
    render(<EventDetailView {...props} />);

    // Assert video element exists
    const video = screen.getByTestId('event-video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    expect((video as HTMLVideoElement).autoplay).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect((video as HTMLVideoElement).loop).toBe(true);
    expect((video as HTMLVideoElement).playsInline || video.getAttribute('playsinline')).toBeTruthy();
  });

  it('falls back to poster image and shows unavailable note on video error', () => {
    const props = {
      ...fullProps,
      videoUrl: 'https://example.com/video.mp4',
      videoAlt: 'Test Video Alt',
      labels: {
        ...fullProps.labels,
        videoUnavailableLabel: 'Custom Video Unavailable Label',
      },
    };
    render(<EventDetailView {...props} />);

    const video = screen.getByTestId('event-video');
    expect(video).toBeInTheDocument();

    // Trigger video load error
    fireEvent.error(video);

    // It should fall back to showing the poster image
    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    expect(img).toBeInTheDocument();

    // And since originalPostUrl / sourcePostUrl are present in fullProps, the video-unavailable note+link appears
    const note = screen.getByTestId('video-unavailable-note');
    expect(note).toBeInTheDocument();
    expect(screen.getByText('Custom Video Unavailable Label')).toBeInTheDocument();
    
    const link = within(note).getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://instagram.com/p/123'); // prioritized originalPostUrl from fullProps
  });

  it('image fallback URL retry on image load failure', () => {
    const props = {
      ...fullProps,
      imageFallbackUrl: 'https://example.com/fallback.jpg',
    };
    render(<EventDetailView {...props} />);

    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');

    // First error: should swap to imageFallbackUrl
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'https://example.com/fallback.jpg');

    // Second error: should render placeholder icon and remove the img element
    fireEvent.error(img);
    expect(screen.queryByRole('img', { name: 'Custom Alt Text' })).not.toBeInTheDocument();
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

  it('shows the favorite count beside the icon when favoriteCount is provided', () => {
    const onFavoriteToggle = vi.fn();
    render(<EventDetailView {...minimalProps} onFavoriteToggle={onFavoriteToggle} isFavorited={false} favoriteCount={12} />);

    const favBtn = screen.getByRole('button', { name: 'Add to Favorites' });
    expect(favBtn).toHaveTextContent('12');
  });

  it('shows a zero favorite count rather than hiding it', () => {
    const onFavoriteToggle = vi.fn();
    render(<EventDetailView {...minimalProps} onFavoriteToggle={onFavoriteToggle} isFavorited={false} favoriteCount={0} />);

    const favBtn = screen.getByRole('button', { name: 'Add to Favorites' });
    expect(favBtn).toHaveTextContent('0');
  });

  it('does not render a count when favoriteCount is not provided', () => {
    const onFavoriteToggle = vi.fn();
    render(<EventDetailView {...minimalProps} onFavoriteToggle={onFavoriteToggle} isFavorited={false} />);

    const favBtn = screen.getByRole('button', { name: 'Add to Favorites' });
    expect(favBtn).toHaveTextContent('');
  });

  it('opens add to calendar dialog on click and handles confirm', async () => {
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

    // Confirm now awaits onConfirm before closing (so a caller's async failure
    // can keep the dialog open) -- so closing happens after that promise resolves.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
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

  it('ignores Escape and outside click while a confirm is still in flight', async () => {
    let resolveConfirm: () => void;
    const onAddToCalendar = vi.fn(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );
    render(<EventDetailView {...fullProps} onAddToCalendar={onAddToCalendar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to Calendar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Mutation is in flight -- Escape must not close the dialog early
    fireEvent.keyDown(screen.getByRole('dialog').firstChild!, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Nor should an outside click
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Once the mutation resolves, the dialog is free to close normally
    resolveConfirm!();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
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

  // Story 3.6i Task 8 Tests: business contactInfo display + private-contact fallback
  it('renders business contactInfo text when contactInfo is set and hasPrivateContact is false/absent', () => {
    render(<EventDetailView {...minimalProps} contactInfo="events@venue.com" />);
    expect(screen.getByText('events@venue.com')).toBeInTheDocument();
    expect(screen.queryByText(minimalProps.labels.privateContactMessageLabel)).not.toBeInTheDocument();
  });

  it('renders the private-contact fallback message as a link to originalPostUrl when hasPrivateContact is true', () => {
    render(
      <EventDetailView
        {...minimalProps}
        hasPrivateContact
        contactInfo={null}
        originalPostUrl="http://orig"
      />
    );
    const links = screen.getAllByRole('link', { name: new RegExp(minimalProps.labels.privateContactMessageLabel) });
    expect(links[0]).toHaveAttribute('href', 'http://orig');
  });

  it('falls back to sourcePostUrl for the private-contact link when originalPostUrl is absent', () => {
    render(
      <EventDetailView
        {...minimalProps}
        hasPrivateContact
        contactInfo={null}
        sourcePostUrl="http://source"
      />
    );
    const link = screen.getByRole('link', { name: new RegExp(minimalProps.labels.privateContactMessageLabel) });
    expect(link).toHaveAttribute('href', 'http://source');
  });

  it('renders nothing in the contact section when neither contactInfo nor hasPrivateContact is present', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByText(minimalProps.labels.privateContactMessageLabel)).not.toBeInTheDocument();
  });

  // AC16 Tests
  it('renders SubscribedAccountCard when accountId, platform, and username are present', () => {
    const onSubscribe = vi.fn();
    render(<EventDetailView {...minimalProps} accountName="Org" accountPlatformIconUrl="http://icon" accountHref="/link" accountId="123" accountPlatform="instagram" accountUsername="org" isSubscribedToAccount={false} onSubscribeToAccount={onSubscribe} />);
    const link = screen.getByRole('link', { name: /@org/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/link');
    const subscribeBtn = screen.getByRole('button', { name: /Subscribe/i });
    expect(subscribeBtn).toBeInTheDocument();
    fireEvent.click(subscribeBtn);
    expect(onSubscribe).toHaveBeenCalled();
  });

  it('omits SubscribedAccountCard when essential account props are missing', () => {
    // Missing accountId
    const { rerender } = render(<EventDetailView {...minimalProps} accountPlatform="instagram" accountUsername="org" />);
    expect(screen.queryByRole('button', { name: /Subscribe/i })).not.toBeInTheDocument();

    // Missing accountPlatform
    rerender(<EventDetailView {...minimalProps} accountId="123" accountUsername="org" />);
    expect(screen.queryByRole('button', { name: /Subscribe/i })).not.toBeInTheDocument();

    // Missing accountUsername
    rerender(<EventDetailView {...minimalProps} accountId="123" accountPlatform="instagram" />);
    expect(screen.queryByRole('button', { name: /Subscribe/i })).not.toBeInTheDocument();
  });

  it('renders both SubscribedAccountCard and source post links simultaneously', () => {
    render(<EventDetailView {...fullProps} />);
    expect(screen.getByRole('link', { name: /@festorganizer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View original post/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View source/i })).toBeInTheDocument();
  });

  it('shows a Subscribed indicator (no button) when already subscribed', () => {
    render(<EventDetailView {...fullProps} isSubscribedToAccount={true} />);
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subscribe/i })).not.toBeInTheDocument();
  });

  // More Actions Menu Tests (Story 4.1, Task 3)
  it('renders more actions menu and calls onCorrectData on click', () => {
    const onCorrectData = vi.fn();
    const props = {
      ...minimalProps,
      onCorrectData,
      labels: {
        ...minimalProps.labels,
        moreActionsButtonLabel: 'More actions',
        correctDataMenuItemLabel: 'Correct Data',
      },
    };

    render(<EventDetailView {...props} />);

    const moreBtn = screen.getByRole('button', { name: 'More actions' });
    expect(moreBtn).toBeInTheDocument();
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open menu
    fireEvent.click(moreBtn);
    expect(moreBtn).toHaveAttribute('aria-expanded', 'true');

    const correctItem = screen.getByRole('menuitem', { name: 'Correct Data' });
    expect(correctItem).toBeInTheDocument();

    // Click menu item
    fireEvent.click(correctItem);
    expect(onCorrectData).toHaveBeenCalledTimes(1);
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes more actions menu on Escape key press', () => {
    const onCorrectData = vi.fn();
    const props = {
      ...minimalProps,
      onCorrectData,
      labels: {
        ...minimalProps.labels,
        moreActionsButtonLabel: 'More actions',
        correctDataMenuItemLabel: 'Correct Data',
      },
    };

    render(<EventDetailView {...props} />);

    const moreBtn = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(moreBtn);
    
    // Press Escape
    fireEvent.keyDown(moreBtn, { key: 'Escape' });
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not render more actions button if onCorrectData is not passed', () => {
    render(<EventDetailView {...minimalProps} />);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('renders both menu items and calls correct handlers when both are provided', () => {
    const onCorrectData = vi.fn();
    const onReport = vi.fn();
    const props = {
      ...minimalProps,
      onCorrectData,
      onReport,
      labels: {
        ...minimalProps.labels,
        moreActionsButtonLabel: 'More actions',
        correctDataMenuItemLabel: 'Correct Data',
        reportMenuItemLabel: 'Report Event',
      },
    };

    render(<EventDetailView {...props} />);

    const moreBtn = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(moreBtn);

    const correctItem = screen.getByRole('menuitem', { name: 'Correct Data' });
    const reportItem = screen.getByRole('menuitem', { name: 'Report Event' });
    expect(correctItem).toBeInTheDocument();
    expect(reportItem).toBeInTheDocument();

    // Click report item
    fireEvent.click(reportItem);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onCorrectData).not.toHaveBeenCalled();
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders more actions button and functions when only onReport is provided', () => {
    const onReport = vi.fn();
    const props = {
      ...minimalProps,
      onReport,
      labels: {
        ...minimalProps.labels,
        moreActionsButtonLabel: 'More actions',
        reportMenuItemLabel: 'Report Event',
      },
    };

    render(<EventDetailView {...props} />);

    const moreBtn = screen.getByRole('button', { name: 'More actions' });
    expect(moreBtn).toBeInTheDocument();
    fireEvent.click(moreBtn);

    const reportItem = screen.getByRole('menuitem', { name: 'Report Event' });
    expect(reportItem).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Correct Data' })).not.toBeInTheDocument();

    fireEvent.click(reportItem);
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
