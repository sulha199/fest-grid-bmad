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
    coauthors: [],
    sourcePosts: [],
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

// Story 0.i6g Task 6: coauthors map to EventDetailViewCoauthor[], with isSubscribed/isTogglePending
// derived from mySubscriptions/pendingCoauthorAccountId, and accountHref built the same way as
// the existing source-account case (getPlatformSlug + accountId).
describe('mapGraphQLEventToDetailViewProps coauthors mapping (Story 0.i6g)', () => {
  it('maps empty/absent coauthors to []', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.coauthors).toEqual([]);
  });

  it('maps each coauthor, deriving accountHref the same way as the existing source-account case', () => {
    const event = {
      ...buildEvent({}),
      coauthors: [
        {
          accountId: 'coauthor-1',
          platform: 'instagram',
          username: 'coauthor_one',
          displayName: 'Coauthor One',
          profileImageUrl: 'https://example.com/coauthor-1.png',
        },
      ],
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.coauthors).toEqual([
      {
        accountId: 'coauthor-1',
        platform: 'instagram',
        username: 'coauthor_one',
        displayName: 'Coauthor One',
        profileImageUrl: 'https://example.com/coauthor-1.png',
        accountHref: '/ig/coauthor-1',
        isSubscribed: false,
        isTogglePending: false,
      },
    ]);
  });

  it('derives isSubscribed from mySubscriptions matching by accountId', () => {
    const event = {
      ...buildEvent({}),
      coauthors: [
        { accountId: 'coauthor-1', platform: 'instagram', username: 'c1', displayName: 'C1', profileImageUrl: null },
        { accountId: 'coauthor-2', platform: 'instagram', username: 'c2', displayName: 'C2', profileImageUrl: null },
      ],
    };
    const mySubscriptions = [
      { id: 'sub-1', account: { accountId: 'coauthor-1' } },
    ] as unknown as NonNullable<Parameters<typeof mapGraphQLEventToDetailViewProps>[6]>;
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k, null, mySubscriptions);
    expect(props.coauthors?.find((c) => c.accountId === 'coauthor-1')?.isSubscribed).toBe(true);
    expect(props.coauthors?.find((c) => c.accountId === 'coauthor-2')?.isSubscribed).toBe(false);
  });

  it('derives isTogglePending from pendingCoauthorAccountId matching by accountId, independently per row', () => {
    const event = {
      ...buildEvent({}),
      coauthors: [
        { accountId: 'coauthor-1', platform: 'instagram', username: 'c1', displayName: 'C1', profileImageUrl: null },
        { accountId: 'coauthor-2', platform: 'instagram', username: 'c2', displayName: 'C2', profileImageUrl: null },
      ],
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k, null, null, 'coauthor-2');
    expect(props.coauthors?.find((c) => c.accountId === 'coauthor-1')?.isTogglePending).toBe(false);
    expect(props.coauthors?.find((c) => c.accountId === 'coauthor-2')?.isTogglePending).toBe(true);
  });
});

// Story 3.6u Task 6: sourcePosts maps to EventDetailViewSourcePost[], with per-post account
// (accountHref derived the same way as the existing source-account/coauthor cases) and per-post
// coauthors (isSubscribed/isTogglePending derived independently per entry, same mechanism as the
// flat coauthors mapping above -- this is a parallel, not a reuse of, that mapping).
describe('mapGraphQLEventToDetailViewProps sourcePosts mapping (Story 3.6u)', () => {
  it('maps empty/absent sourcePosts to []', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.sourcePosts).toEqual([]);
  });

  it('maps each linked post, deriving account.accountHref and passing groupingReason/extractedEventCount/postedAt/urls through verbatim', () => {
    const event = {
      ...buildEvent({}),
      sourcePosts: [
        {
          postId: 'post-1',
          isPrimary: true,
          groupingReason: 'SINGLE_EVENT',
          extractedEventCount: 1,
          postedAt: '2026-08-09T10:00:00Z',
          sourcePostUrl: 'https://imginn.com/p/post-1',
          originalPostUrl: 'https://instagram.com/p/post-1',
          platformPostId: 'post-1-platform-id',
          postType: 'post',
          account: {
            accountId: 'acct-1',
            platform: 'instagram',
            username: 'acct_one',
            displayName: 'Acct One',
            profileImageUrl: 'https://example.com/acct-1.png',
          },
          coauthors: [],
        },
      ],
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.sourcePosts).toEqual([
      {
        postId: 'post-1',
        isPrimary: true,
        groupingReason: 'SINGLE_EVENT',
        extractedEventCount: 1,
        postedAt: '2026-08-09T10:00:00Z',
        sourcePostUrl: 'https://imginn.com/p/post-1',
        originalPostUrl: 'https://instagram.com/p/post-1',
        account: {
          accountId: 'acct-1',
          platform: 'instagram',
          username: 'acct_one',
          displayName: 'Acct One',
          profileImageUrl: 'https://example.com/acct-1.png',
          accountHref: '/ig/acct-1',
        },
        coauthors: [],
      },
    ]);
  });

  it('maps account to null when a post has no linked account', () => {
    const event = {
      ...buildEvent({}),
      sourcePosts: [
        {
          postId: 'post-1',
          isPrimary: true,
          groupingReason: null,
          extractedEventCount: null,
          postedAt: null,
          sourcePostUrl: null,
          originalPostUrl: null,
          platformPostId: null,
          postType: null,
          account: null,
          coauthors: [],
        },
      ],
    };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.sourcePosts?.[0].account).toBeNull();
  });

  it("maps each post's own coauthors independently, deriving isSubscribed/isTogglePending per entry (not the flat coauthors mapping)", () => {
    const event = {
      ...buildEvent({}),
      sourcePosts: [
        {
          postId: 'post-1',
          isPrimary: true,
          groupingReason: null,
          extractedEventCount: null,
          postedAt: null,
          sourcePostUrl: null,
          originalPostUrl: null,
          platformPostId: null,
          postType: null,
          account: null,
          coauthors: [
            { accountId: 'coauthor-1', platform: 'instagram', username: 'c1', displayName: 'C1', profileImageUrl: null },
          ],
        },
        {
          postId: 'post-2',
          isPrimary: false,
          groupingReason: null,
          extractedEventCount: null,
          postedAt: null,
          sourcePostUrl: null,
          originalPostUrl: null,
          platformPostId: null,
          postType: null,
          account: null,
          coauthors: [
            { accountId: 'coauthor-2', platform: 'instagram', username: 'c2', displayName: 'C2', profileImageUrl: null },
          ],
        },
      ],
    };
    const mySubscriptions = [
      { id: 'sub-1', account: { accountId: 'coauthor-1' } },
    ] as unknown as NonNullable<Parameters<typeof mapGraphQLEventToDetailViewProps>[6]>;
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k, null, mySubscriptions, 'coauthor-2');

    expect(props.sourcePosts?.[0].coauthors[0].isSubscribed).toBe(true);
    expect(props.sourcePosts?.[0].coauthors[0].isTogglePending).toBe(false);
    expect(props.sourcePosts?.[1].coauthors[0].isSubscribed).toBe(false);
    expect(props.sourcePosts?.[1].coauthors[0].isTogglePending).toBe(true);
  });
});
