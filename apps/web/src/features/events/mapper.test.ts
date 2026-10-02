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
  publishedLabel: 'Published',
  categoriesAndTypesAriaLabel: 'Event categories and types',
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
    publishedAt: null,
    organizerName: null,
    contactInfo: null,
    hasPrivateContact: false,
    isFavorited: false,
    favoriteCount: 0,
    isHiddenForCurrentUser: false,
    links: null,
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

// Story 0.i7z ratchet — AD-14 Rule 2 / Story 0.i7z AC 3 consumer: this mapper is the
// event-detail map-link gate. Story 1.6e moves the confidence-gating logic itself into
// `LocationLink` (Story 1.6d, see `packages/ui/src/core/LocationLink.test.tsx` for the
// confidence-boundary cases); this mapper's own responsibility is now just an unchanged
// passthrough of `locationDetails` onto `ScheduleDetail`, proved below.
describe('mapGraphQLEventToDetailViewProps locationDetails passthrough (Story 1.6e)', () => {
  it('passes locationDetails through onto ScheduleDetail.locationDetails unchanged', () => {
    const locationDetails = {
      placeName: 'Place',
      placeId: 'place-1',
      formattedAddress: '1 Main St',
      timezone: 'America/Chicago',
      confidence: 0.9,
      matchType: 'full_match',
      coordinates: { lat: 41.8758, lng: -87.6245 },
    };
    const event = buildEvent({ locationDetails });
    expect(toSchedule(event).locationDetails).toEqual(locationDetails);
  });

  it('passes through a null locationDetails as null (no locationDetails resolved for this schedule)', () => {
    const event = buildEvent({ locationDetails: null });
    expect(toSchedule(event).locationDetails).toBeNull();
  });
});

// Story 0.37 Task 5.2/5.4: `links` passthrough from the GraphQL event onto
// `EventDetailViewProps`, normalizing GraphQL's `label: string | null` to the
// shared-types `EventLink.label?: string` shape (undefined, not null).
describe('mapGraphQLEventToDetailViewProps links passthrough (Story 0.37)', () => {
  it('maps links to null when the event has no links', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.links).toBeNull();
  });

  it('passes through links, converting a null label to undefined', () => {
    const event = {
      ...buildEvent({}),
      links: [
        { url: 'https://example.com/tickets', label: 'Tickets' },
        { url: 'https://example.com/rsvp', label: null },
      ],
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.links).toEqual([
      { url: 'https://example.com/tickets', label: 'Tickets' },
      { url: 'https://example.com/rsvp', label: undefined },
    ]);
  });
});

// Story 1.6f Task 3 (AC2): publishedAt passthrough onto EventDetailViewProps.
describe('mapGraphQLEventToDetailViewProps publishedAt passthrough (Story 1.6f)', () => {
  it('passes through a non-null publishedAt unchanged', () => {
    const event = { ...buildEvent({}), publishedAt: '2026-01-15T10:30:00.000Z' };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.publishedAt).toBe('2026-01-15T10:30:00.000Z');
  });

  it('passes through a null publishedAt as null (no linked post)', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.publishedAt).toBeNull();
  });
});

// Story 1.6f Task 4 (AC3): types/categories map to { value, label } pairs (raw
// enum value + translated label) instead of translated-label-only strings, and
// the pre-existing null-input cases still resolve to null/undefined (not []),
// preserving EventDetailView.tsx's existing `hasTags` falsy-check.
describe('mapGraphQLEventToDetailViewProps types/categories badge shape (Story 1.6f)', () => {
  it('maps types/categories to { value, label } pairs, value the raw enum, label the translated string', () => {
    const event = {
      ...buildEvent({}),
      types: ['FESTIVAL', 'WORKSHOP'],
      categories: ['MUSIC'],
    } as unknown as NonNullable<GetEventBySlugQuery['eventBySlug']>;
    const tType = (k: string) => `Type:${k}`;
    const tCategory = (k: string) => `Category:${k}`;
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', tType, tCategory);
    expect(props.types).toEqual([
      { value: 'FESTIVAL', label: 'Type:FESTIVAL' },
      { value: 'WORKSHOP', label: 'Type:WORKSHOP' },
    ]);
    expect(props.categories).toEqual([{ value: 'MUSIC', label: 'Category:MUSIC' }]);
  });

  it('resolves types/categories to null/undefined (not []) when the event has neither (existing null-case regression)', () => {
    const event = buildEvent({}); // types: null, categories: null per buildEvent's default fixture
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.types).toBeUndefined();
    expect(props.categories).toBeUndefined();
    expect(props.types).not.toEqual([]);
    expect(props.categories).not.toEqual([]);
  });
});

// Story 0.i7z ratchet — AD-14 Rule 2 consumer: mapper.ts's accountLocation
// derivation passes sourceSocialMediaAccountProfile.defaultLocation's
// confidence/matchType signal through unchanged onto EventDetailViewProps.accountLocation,
// which SubscribedAccountCard (Story 0.i6e) then gates via isLocationTrustworthy.
describe('mapGraphQLEventToDetailViewProps accountLocation derivation (Story 0.i6e)', () => {
  it('uses placeName verbatim when present', () => {
    const event = {
      ...buildEvent({}),
      sourceSocialMediaAccountProfile: {
        accountId: 'acc-1',
        platform: 'instagram',
        username: 'org',
        displayName: 'Org',
        profileImageUrl: null,
        accountType: null,
        defaultLocation: {
          coordinates: { lat: 41.8758, lng: -87.6245 },
          placeName: 'The Grand Hall',
          formattedAddress: '1 Main St',
          confidence: 0.9,
          matchType: 'full_match',
        },
      },
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.accountLocation).toEqual({
      name: 'The Grand Hall',
      coordinates: { lat: 41.8758, lng: -87.6245 },
      confidence: 0.9,
      matchType: 'full_match',
    });
  });

  it('falls back to formattedAddress when placeName is empty', () => {
    const event = {
      ...buildEvent({}),
      sourceSocialMediaAccountProfile: {
        accountId: 'acc-1',
        platform: 'instagram',
        username: 'org',
        displayName: 'Org',
        profileImageUrl: null,
        accountType: null,
        defaultLocation: {
          coordinates: { lat: 41.8758, lng: -87.6245 },
          placeName: '',
          formattedAddress: '1 Main St',
          confidence: 0.9,
          matchType: 'full_match',
        },
      },
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.accountLocation?.name).toBe('1 Main St');
  });

  it('resolves to null when both placeName and formattedAddress are empty', () => {
    const event = {
      ...buildEvent({}),
      sourceSocialMediaAccountProfile: {
        accountId: 'acc-1',
        platform: 'instagram',
        username: 'org',
        displayName: 'Org',
        profileImageUrl: null,
        accountType: null,
        defaultLocation: {
          coordinates: { lat: 41.8758, lng: -87.6245 },
          placeName: '',
          formattedAddress: '',
          confidence: 0.9,
          matchType: 'full_match',
        },
      },
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.accountLocation).toBeNull();
  });

  it('resolves to null when defaultLocation is entirely absent', () => {
    const event = {
      ...buildEvent({}),
      sourceSocialMediaAccountProfile: {
        accountId: 'acc-1',
        platform: 'instagram',
        username: 'org',
        displayName: 'Org',
        profileImageUrl: null,
        accountType: null,
        defaultLocation: null,
      },
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.accountLocation).toBeNull();
  });

  it('resolves to null when sourceSocialMediaAccountProfile itself is absent', () => {
    const event = buildEvent({}); // sourceSocialMediaAccountProfile: null per buildEvent's default fixture
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.accountLocation).toBeNull();
  });
});

// Story 3.7i (AC1, AC2, AC3, AC4): the event-detail oEmbed result now arrives as the
// mapper's new optional 6th parameter (resolved in EventDetailWrapper.tsx from two/three
// parallel React Query hooks) instead of a field on the `event` object itself.
describe('mapGraphQLEventToDetailViewProps instagramEmbed parameter (Story 3.7i)', () => {
  it('maps all three instagramEmbed* fields to null when the parameter is omitted (regression: every pre-existing call site)', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.instagramEmbedStatus).toBeNull();
    expect(props.instagramEmbedHtml).toBeNull();
    expect(props.instagramEmbedDurableImageUrl).toBeNull();
  });

  it('maps an AVAILABLE resolved embed through to the three output fields unchanged', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k, {
      status: 'AVAILABLE',
      html: '<blockquote>...</blockquote>',
      durableImageUrl: null,
    });
    expect(props.instagramEmbedStatus).toBe('AVAILABLE');
    expect(props.instagramEmbedHtml).toBe('<blockquote>...</blockquote>');
    expect(props.instagramEmbedDurableImageUrl).toBeNull();
  });

  it('maps an UNAVAILABLE resolved embed through to the three output fields unchanged', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k, {
      status: 'UNAVAILABLE',
      html: null,
      durableImageUrl: 'https://example.com/durable.jpg',
    });
    expect(props.instagramEmbedStatus).toBe('UNAVAILABLE');
    expect(props.instagramEmbedHtml).toBeNull();
    expect(props.instagramEmbedDurableImageUrl).toBe('https://example.com/durable.jpg');
  });
});
