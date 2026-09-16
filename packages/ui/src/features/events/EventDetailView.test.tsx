import React from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { EventDetailView } from './EventDetailView';
import { formatShortEventDateTime } from './format-event-date';

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
      viewOriginalPostLabel: 'View original post',
      viewSourceLabel: 'View source',
      addToCalendarDialogTitle: 'Select Schedules',
      addToCalendarConfirmLabel: 'Confirm',
      addToCalendarCancelLabel: 'Cancel',
      privateContactMessageLabel: "Contact info isn't shown to protect the poster's privacy — see the original post for details.",
      moreActionsButtonLabel: 'More actions',
      correctDataMenuItemLabel: 'Correct Data',
      publishedLabel: 'Published',
      categoriesAndTypesAriaLabel: 'Event categories and types',
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
    types: [{ value: 'FESTIVAL', label: 'Festival' }, { value: 'WORKSHOP', label: 'Workshop' }],
    categories: [{ value: 'MUSIC', label: 'Music' }, { value: 'ART', label: 'Art' }],
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

  // Story 1.6f Task 1 (AC1): responsive layout reorder -- jsdom doesn't evaluate
  // @media queries, so assert on the className string containing the expected
  // order-*/lg:order-* tokens rather than a real layout measurement.
  it('applies order-2 lg:order-1 to the media column and order-1 lg:order-2 to the details column', () => {
    const { container } = render(<EventDetailView {...fullProps} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    const gridChildren = Array.from(grid!.children);
    expect(gridChildren.length).toBe(2);
    const mediaColumn = gridChildren[0] as HTMLElement;
    const detailsColumn = gridChildren[1] as HTMLElement;
    expect(mediaColumn.className).toContain('order-2');
    expect(mediaColumn.className).toContain('lg:order-1');
    expect(detailsColumn.className).toContain('order-1');
    expect(detailsColumn.className).toContain('lg:order-2');
  });

  it('renders tags when provided', () => {
    render(<EventDetailView {...fullProps} />);
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  // Story 1.6f Task 4 (AC3, AC7): clickable category/type badges
  describe('category/type badge click-through (Story 1.6f, AC3)', () => {
    it('renders badges as plain, non-interactive text when no click handler is passed', () => {
      render(<EventDetailView {...fullProps} />);
      expect(screen.queryByRole('button', { name: 'Music' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Festival' })).not.toBeInTheDocument();
      expect(screen.getByText('Music')).toBeInTheDocument();
      expect(screen.getByText('Festival')).toBeInTheDocument();
    });

    it('renders a category badge as a button and fires onCategoryClick with the raw value', () => {
      const onCategoryClick = vi.fn();
      render(<EventDetailView {...fullProps} onCategoryClick={onCategoryClick} />);
      const musicBtn = screen.getByRole('button', { name: 'Music' });
      fireEvent.click(musicBtn);
      expect(onCategoryClick).toHaveBeenCalledWith('MUSIC');
    });

    it('renders a type badge as a button and fires onTypeClick with the raw value', () => {
      const onTypeClick = vi.fn();
      render(<EventDetailView {...fullProps} onTypeClick={onTypeClick} />);
      const festivalBtn = screen.getByRole('button', { name: 'Festival' });
      fireEvent.click(festivalBtn);
      expect(onTypeClick).toHaveBeenCalledWith('FESTIVAL');
    });

    it('uses the categoriesAndTypesAriaLabel from labels for the badge list', () => {
      render(
        <EventDetailView
          {...fullProps}
          labels={{ ...fullProps.labels, categoriesAndTypesAriaLabel: 'Custom badges label' }}
        />
      );
      expect(screen.getByRole('list', { name: 'Custom badges label' })).toBeInTheDocument();
    });
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

  it('renders InstagramEmbed (not EventImage) when instagramEmbedStatus is set (AC1)', () => {
    const props = {
      ...fullProps,
      instagramEmbedStatus: 'AVAILABLE' as const,
      instagramEmbedHtml: '<blockquote class="instagram-media">post</blockquote>',
    };
    render(<EventDetailView {...props} />);

    // The InstagramEmbed's labeled region replaces EventImage's plain <img>.
    expect(screen.getByRole('region', { name: 'Embedded post' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Custom Alt Text' })).not.toBeInTheDocument();
  });

  it('renders the unchanged EventImage path when instagramEmbedStatus is absent (AC2 regression guard)', () => {
    render(<EventDetailView {...fullProps} />);

    expect(screen.queryByRole('region', { name: 'Embedded post' })).not.toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('renders the InstagramEmbed durableImageUrl fallback when instagramEmbedStatus is UNAVAILABLE with a durableImageUrl', () => {
    const props = {
      ...fullProps,
      instagramEmbedStatus: 'UNAVAILABLE' as const,
      instagramEmbedHtml: null,
      instagramEmbedDurableImageUrl: 'https://example.com/durable.jpg',
    };
    render(<EventDetailView {...props} />);

    const img = screen.getByRole('img', { name: 'Custom Alt Text' });
    expect(img).toHaveAttribute('src', 'https://example.com/durable.jpg');
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

  // Story 1.6f Task 5 (AC4, AC5): favorite control moves beside the title; title shrinks to text-2xl
  it('renders the favorite control inline beside the title, and no standalone calendar button, when handlers are provided', () => {
    const onFavoriteToggle = vi.fn();
    const onAddToCalendar = vi.fn();
    render(<EventDetailView {...minimalProps} onFavoriteToggle={onFavoriteToggle} onAddToCalendar={onAddToCalendar} isFavorited={true} isAddedToCalendar={false} />);

    const favBtn = screen.getByRole('button', { name: 'Remove from Favorites' });
    const heading = screen.getByRole('heading', { name: 'Test Event' });

    expect(favBtn).toBeInTheDocument();
    expect(favBtn).toHaveAttribute('aria-pressed', 'true');
    expect(heading.parentElement).toContainElement(favBtn);
    expect(heading).toHaveClass('text-2xl');
    expect(heading).not.toHaveClass('text-3xl');

    fireEvent.click(favBtn);
    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);

    // AC6: no standalone top-level Add to Calendar button
    expect(screen.queryByRole('button', { name: 'Add to Calendar' })).not.toBeInTheDocument();
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

  // Story 1.6f Task 6 (AC6): the standalone top-level Add to Calendar button is gone;
  // opening the (retained) AddToCalendarDialog now goes through the overflow "more
  // actions" menu's "Add to Calendar" entry.
  const openAddToCalendarFromMenu = () => {
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Calendar' }));
  };

  it('renders an "Add to Calendar" entry in the overflow menu which opens the retained AddToCalendarDialog', () => {
    const onAddToCalendar = vi.fn();
    render(<EventDetailView {...fullProps} onAddToCalendar={onAddToCalendar} />);

    expect(screen.queryByRole('button', { name: 'Add to Calendar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const calendarItem = screen.getByRole('menuitem', { name: 'Add to Calendar' });
    expect(calendarItem).toBeInTheDocument();

    fireEvent.click(calendarItem);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens add to calendar dialog via the overflow menu and handles confirm', async () => {
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

    // Open dialog via the overflow menu
    openAddToCalendarFromMenu();

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

    // Test Cancel button
    openAddToCalendarFromMenu();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAddToCalendar).not.toHaveBeenCalled();

    // Test Escape key
    openAddToCalendarFromMenu();
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

    openAddToCalendarFromMenu();
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

  // Story 1.6f Task 3 (AC2, AC7): published-date prefix + PlatformIcon selection in Attributions
  describe('published date + platform icon in Attributions (Story 1.6f)', () => {
    const publishedAt = '2020-01-15T10:00:00.000Z';
    const expectedDateText = formatShortEventDateTime('en-US', undefined, new Date(publishedAt), false, {
      today: 'Today',
      tomorrow: 'Tomorrow',
      yesterday: 'Yesterday',
    });

    it('renders the formatted publishedAt prefix when hasSourceAttribution and publishedAt are both present', () => {
      render(
        <EventDetailView
          {...minimalProps}
          originalPostUrl="http://orig"
          publishedAt={publishedAt}
        />
      );
      expect(screen.getByText(expectedDateText)).toBeInTheDocument();
      expect(screen.getByText(minimalProps.labels.publishedLabel)).toBeInTheDocument();
    });

    it('does not render the published-date prefix when hasSourceAttribution is false', () => {
      render(<EventDetailView {...minimalProps} publishedAt={publishedAt} />);
      expect(screen.queryByText(expectedDateText)).not.toBeInTheDocument();
    });

    it('does not render the published-date prefix when publishedAt is absent', () => {
      render(<EventDetailView {...minimalProps} originalPostUrl="http://orig" />);
      expect(screen.queryByText(minimalProps.labels.publishedLabel)).not.toBeInTheDocument();
    });

    it('uses PlatformIcon driven by accountPlatform for the originalPostUrl link', () => {
      render(
        <EventDetailView
          {...minimalProps}
          originalPostUrl="http://orig"
          accountPlatform="instagram"
        />
      );
      const link = screen.getByRole('link', { name: /View original post/i });
      expect(link.querySelector('svg')).toBeInTheDocument();
    });

    it('falls back to detectPlatformFromUrl when no accountPlatform is present', () => {
      render(
        <EventDetailView
          {...minimalProps}
          originalPostUrl="https://instagram.com/p/abc123"
        />
      );
      const link = screen.getByRole('link', { name: /View original post/i });
      expect(link.querySelector('svg')).toBeInTheDocument();
    });
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

  // Story 0.37 Task 5.4 Tests: additional links section
  describe('additional links (Story 0.37, AC5)', () => {
    it('renders nothing when links is absent', () => {
      render(<EventDetailView {...minimalProps} />);
      expect(screen.queryByRole('link', { name: /example\.com/i })).not.toBeInTheDocument();
    });

    it('renders nothing when links is an empty array', () => {
      render(<EventDetailView {...minimalProps} links={[]} />);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('renders one row for a single link with a label', () => {
      render(
        <EventDetailView
          {...minimalProps}
          links={[{ url: 'https://example.com/tickets', label: 'Tickets' }]}
        />
      );
      const link = screen.getByRole('link', { name: /Tickets/ });
      expect(link).toHaveAttribute('href', 'https://example.com/tickets');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the raw url as text when a link has no label', () => {
      render(
        <EventDetailView
          {...minimalProps}
          links={[{ url: 'https://example.com/rsvp' }]}
        />
      );
      const link = screen.getByRole('link', { name: /https:\/\/example\.com\/rsvp/ });
      expect(link).toHaveAttribute('href', 'https://example.com/rsvp');
    });

    it('renders N distinct rows for N links', () => {
      render(
        <EventDetailView
          {...minimalProps}
          links={[
            { url: 'https://example.com/tickets', label: 'Tickets' },
            { url: 'https://example.com/merch', label: 'Merch' },
            { url: 'https://example.com/rsvp' },
          ]}
        />
      );

      const ticketsLink = screen.getByRole('link', { name: /Tickets/ });
      const merchLink = screen.getByRole('link', { name: /Merch/ });
      const rsvpLink = screen.getByRole('link', { name: /https:\/\/example\.com\/rsvp/ });

      for (const link of [ticketsLink, merchLink, rsvpLink]) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });

  // AC16 Tests
  it('renders SubscribedAccountCard when accountId, platform, and username are present', () => {
    const onSubscribe = vi.fn();
    render(<EventDetailView {...minimalProps} accountName="Org" accountPlatformIconUrl="http://icon" accountHref="/link" accountId="123" accountPlatform="instagram" accountUsername="org" isSubscribedToAccount={false} onSubscribeToAccount={onSubscribe} />);
    const link = screen.getByRole('link', { name: /@org/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/link');
    const subscribeBtn = screen.getByTestId('subscribe-toggle');
    expect(subscribeBtn).toBeInTheDocument();
    fireEvent.click(subscribeBtn);
    expect(onSubscribe).toHaveBeenCalled();
  });

  it('omits SubscribedAccountCard entirely only when accountId is missing; disables (not hides) the toggle when platform/username is missing', () => {
    // Missing accountId: no attribution to show at all — card omitted entirely.
    const { rerender } = render(<EventDetailView {...minimalProps} accountPlatform="instagram" accountUsername="org" />);
    expect(screen.queryByTestId('subscribe-toggle')).not.toBeInTheDocument();

    // Missing accountPlatform: card still renders (accountId present), but there
    // isn't enough data to act on the subscription, so the toggle is disabled.
    rerender(<EventDetailView {...minimalProps} accountId="123" accountUsername="org" />);
    expect(screen.getByTestId('subscribe-toggle')).toBeDisabled();

    // Missing accountUsername: same disabled-not-hidden behavior.
    rerender(<EventDetailView {...minimalProps} accountId="123" accountPlatform="instagram" />);
    expect(screen.getByTestId('subscribe-toggle')).toBeDisabled();
  });

  it('renders both SubscribedAccountCard and source post links simultaneously', () => {
    render(<EventDetailView {...fullProps} />);
    expect(screen.getByRole('link', { name: /@festorganizer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View original post/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View source/i })).toBeInTheDocument();
  });

  it('shows the subscribed toggle state (aria-pressed true) when already subscribed', () => {
    render(<EventDetailView {...fullProps} isSubscribedToAccount={true} onUnsubscribeFromAccount={vi.fn()} />);
    const toggle = screen.getByTestId('subscribe-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('threads isSubscriptionStatusLoading/onUnsubscribeFromAccount/isUnsubscribingFromAccount to SubscribedAccountCard', () => {
    const onUnsubscribe = vi.fn();
    const { rerender } = render(
      <EventDetailView
        {...fullProps}
        isSubscribedToAccount={true}
        isSubscriptionStatusLoading={true}
        onUnsubscribeFromAccount={onUnsubscribe}
      />
    );
    let toggle = screen.getByTestId('subscribe-toggle');
    expect(toggle).not.toHaveAttribute('aria-pressed');
    expect(toggle).toHaveAttribute('aria-busy', 'true');

    rerender(
      <EventDetailView
        {...fullProps}
        isSubscribedToAccount={true}
        isSubscriptionStatusLoading={false}
        onUnsubscribeFromAccount={onUnsubscribe}
      />
    );
    toggle = screen.getByTestId('subscribe-toggle');
    fireEvent.click(toggle);
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('isTogglePending is the OR of isSubscribingToAccount and isUnsubscribingFromAccount', () => {
    const { rerender } = render(
      <EventDetailView {...fullProps} isSubscribingToAccount={true} onUnsubscribeFromAccount={vi.fn()} />
    );
    expect(screen.getByTestId('subscribe-toggle')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <EventDetailView {...fullProps} isSubscribingToAccount={false} isUnsubscribingFromAccount={true} onUnsubscribeFromAccount={vi.fn()} />
    );
    expect(screen.getByTestId('subscribe-toggle')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <EventDetailView {...fullProps} isSubscribingToAccount={false} isUnsubscribingFromAccount={false} onUnsubscribeFromAccount={vi.fn()} />
    );
    expect(screen.getByTestId('subscribe-toggle')).toHaveAttribute('aria-busy', 'false');
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
