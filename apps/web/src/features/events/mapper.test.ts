import { describe, it, expect } from 'vitest';
import { mapGraphQLEventToDetailViewProps } from './mapper';
import { GetEventBySlugQuery } from '@/generated/graphql';
import { EventDetailViewLabels } from '@festgrid/ui';

/**
 * Minimal fixture matching `GetEventBySlugQuery['eventBySlug']`'s shape — only
 * the fields `mapGraphQLEventToDetailViewProps` reads. Direct Vitest unit test
 * of the pure mapping function (no msw/rendering needed), following the local
 * precedent in this same directory and Stories 0.i7a/0.i7b's convention of
 * matching a file's existing local testing style.
 */

const LABELS: EventDetailViewLabels = {
  loadingText: 'Loading',
  errorText: 'Error',
  locationLabel: 'Location',
  performersLabel: 'Performers',
  ticketPriceLabel: 'Ticket',
  noSchedulesLabel: 'No schedules',
  defaultScheduleTitle: 'Schedule',
  favoriteButtonLabel: 'Favorite',
  removeFavoriteButtonLabel: 'Remove',
  addToCalendarButtonLabel: 'Add',
  postedByLabel: 'Posted by',
  viewOriginalPostLabel: 'View original',
  viewSourceLabel: 'View source',
  addToCalendarDialogTitle: 'Add to calendar',
  addToCalendarConfirmLabel: 'Confirm',
  addToCalendarCancelLabel: 'Cancel',
  moreActionsButtonLabel: 'More',
  correctDataMenuItemLabel: 'Correct data',
  timezoneClarificationLabel: 'Clarify timezone',
  timezoneSelectLabel: 'Timezone',
  timezoneSelectPlaceholder: 'Select',
  timezoneSubmitLabel: 'Submit',
  timezoneSubmitSuccessAnnouncement: 'Saved',
  timezoneSubmitErrorAnnouncement: 'Failed',
  privateContactMessageLabel: 'Private',
  contentNoLongerAvailableLabel: 'Unavailable',
  embedLoadingLabel: 'Loading embed',
  embedRegionLabel: 'Region',
};

function buildEvent(
  scheduleOverrides: Partial<NonNullable<GetEventBySlugQuery['eventBySlug']>['schedules'][number]>
): NonNullable<GetEventBySlugQuery['eventBySlug']> {
  return {
    id: 'event-1',
    eventName: 'Test Event',
    slug: 'test-event',
    description: 'A test event',
    location: 'Somevenue, City',
    types: null,
    categories: null,
    imageUrl: null,
    durableImageUrl: null,
    videoUrl: null,
    originalPostUrl: null,
    sourcePostUrl: null,
    organizerName: null,
    contactInfo: null,
    hasPrivateContact: false,
    isFavorited: false,
    favoriteCount: 0,
    isHiddenForCurrentUser: false,
    instagramEmbed: null,
    sourceSocialMediaAccountProfile: null,
    schedules: [
      {
        id: 'schedule-1',
        isMainSchedule: true,
        title: 'Main Stage',
        eventStartDate: '2026-09-20T18:00:00Z',
        isAddedToCalendar: false,
        eventEndDate: null,
        eventStartTime: null,
        eventEndTime: null,
        timezone: null,
        timezoneStatus: null,
        performers: ['Artist'],
        location: 'Stage 1',
        ticketPrice: null,
        ticketUrl: null,
        registrationUrl: null,
        locationDetails: null,
        ...scheduleOverrides,
      },
    ],
  };
}

function toSchedule(event: NonNullable<GetEventBySlugQuery['eventBySlug']>) {
  return mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k).schedules[0];
}

describe('mapGraphQLEventToDetailViewProps mapUrl gating (Story 0.i7c)', () => {
  it('links the raw coordinate for a trustworthy (confidence>=0.5, full_match) locationDetails', () => {
    const event = buildEvent({
      locationDetails: {
        placeName: 'Place',
        placeId: 'place-1',
        formattedAddress: '1 Main St',
        timezone: 'America/Chicago',
        confidence: 0.9,
        matchType: 'full_match',
        coordinates: { lat: 41.8758, lng: -87.6245 },
      },
    });
    expect(toSchedule(event).mapUrl).toBe(
      `https://www.google.com/maps/search/?api=1&query=41.8758,-87.6245`
    );
  });

  it('falls back to a text query when confidence is below the bar despite full_match', () => {
    const event = buildEvent({
      location: 'Stage 1',
      locationDetails: {
        placeName: 'Place',
        placeId: 'place-1',
        formattedAddress: '1 Main St',
        timezone: 'America/Chicago',
        confidence: 0.3,
        matchType: 'full_match',
        coordinates: { lat: 41.8758, lng: -87.6245 },
      },
    });
    expect(toSchedule(event).mapUrl).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stage 1')}`
    );
  });

  it('falls back to a text query when confidence/matchType are null (legacy pre-epic data)', () => {
    const event = buildEvent({
      location: 'Stage 1',
      locationDetails: {
        placeName: 'Place',
        placeId: 'place-1',
        formattedAddress: '1 Main St',
        timezone: 'America/Chicago',
        confidence: null,
        matchType: null,
        coordinates: { lat: 41.8758, lng: -87.6245 },
      },
    });
    expect(toSchedule(event).mapUrl).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stage 1')}`
    );
  });

  it('falls back to a text query when there is no locationDetails at all (unchanged behavior)', () => {
    const event = buildEvent({ location: 'Stage 1' });
    expect(toSchedule(event).mapUrl).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stage 1')}`
    );
  });

  it('yields a null mapUrl when there is neither locationDetails nor location (unchanged behavior)', () => {
    const event = buildEvent({ location: null });
    expect(toSchedule(event).mapUrl).toBeNull();
  });
});
