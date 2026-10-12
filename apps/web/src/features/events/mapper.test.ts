import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { mapGraphQLEventToDetailViewProps } from './mapper';
import { GetEventBySlugQuery, PostGroupingReason } from '@/generated/graphql';
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
  hashtagsListAriaLabel: 'Hashtags',
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
    hashtags: null,
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

// Story 1.6g Task 2 (AC1): hashtags passthrough onto EventDetailViewProps.
describe('mapGraphQLEventToDetailViewProps hashtags passthrough (Story 1.6g)', () => {
  it('passes through a non-null hashtags array unchanged', () => {
    const event = { ...buildEvent({}), hashtags: ['frcc2026', 'jakartaevents'] };
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.hashtags).toEqual(['frcc2026', 'jakartaevents']);
  });

  it('passes through a null hashtags as null (no linked post)', () => {
    const event = buildEvent({});
    const props = mapGraphQLEventToDetailViewProps(event, LABELS, 'en', (k) => k, (k) => k);
    expect(props.hashtags).toBeNull();
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
          groupingReason: PostGroupingReason.SingleEvent,
          extractedEventCount: 1,
          title: null,
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
          title: null,
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
          title: null,
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
          title: null,
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

// FIND-032 (Story 0.50): a locale-parity ratchet for `EventDetailViewLabels` --
// `packages/ui`'s `EventDetailView.types.ts` and `apps/web`'s `en.json`/`id.json`
// `EventDetailsPage` namespace are two independently hand-maintained sources that previously
// had nothing automated enforcing their symmetry (FIND-011's own manual, symmetric
// `postedByLabel` removal across the type and both locale files was caught only by review
// diligence, not a test). This block closes that gap: it parses the interface's real property
// names via the TypeScript compiler API (not a hand-maintained list that could itself drift)
// and asserts every one of them (minus a small, explicitly-named exception list) exists as a
// key in both locale files' `EventDetailsPage` namespace. One-directional only (interface ->
// locale) -- the namespace legitimately holds ~18 keys used via direct `t()` calls elsewhere on
// the page, outside this component's `labels` prop contract, so a bidirectional check would fail
// permanently on those pre-existing, intentional keys (see the story's Dev Notes "Check
// direction and the allow-list").
describe('EventDetailViewLabels locale parity ratchet', () => {
  // Deliberately never localized today -- confirmed absent from both `en.json`'s and `id.json`'s
  // `EventDetailsPage` namespace:
  const DELIBERATELY_UNLOCALIZED_KEYS = [
    // `EventImage.tsx` renders a hardcoded English fallback string when this is absent; no
    // production wiring sets it today.
    'videoUnavailableLabel',
    // Has no production wiring in `mapper.ts`'s `useEventDetailViewLabels()` at all.
    'scheduleCheckboxLabel',
  ] as const;

  /**
   * Parses TypeScript source text via the compiler API and returns the real property-signature
   * names of the first `InterfaceDeclaration` found with the given name. Reading the real
   * interface source at test-run time (rather than a hand-maintained literal array) is the only
   * mechanism that can actually detect a future prop added to/removed from the interface without
   * a matching translation -- a type-level `satisfies` check can only prove a hand-written list
   * matches the interface's *shape*, never that it matches the real *JSON file content* (this
   * repo has no `next-intl` message-type augmentation linking `t()` calls to the real catalog).
   */
  function extractInterfacePropertyNames(sourceText: string, interfaceName: string): string[] {
    const sourceFile = ts.createSourceFile('fixture.ts', sourceText, ts.ScriptTarget.Latest, true);
    const names: string[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
        for (const member of node.members) {
          if (ts.isPropertySignature(member)) {
            names.push(member.name.getText(sourceFile));
          }
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return names;
  }

  /**
   * Diffs `extractedKeys` (minus `DELIBERATELY_UNLOCALIZED_KEYS`) against `localeNamespace`'s own
   * keys and returns the ones missing. Shared by both the real-data assertions below and the
   * fixture-based proof test (AC4), so the proof test exercises the exact same logic the real
   * assertions rely on.
   */
  function findMissingKeys(extractedKeys: string[], localeNamespace: Record<string, unknown>): string[] {
    return extractedKeys
      .filter((key) => !(DELIBERATELY_UNLOCALIZED_KEYS as readonly string[]).includes(key))
      .filter((key) => !(key in localeNamespace));
  }

  // `mapper.test.ts` lives at apps/web/src/features/events/ -- 5 levels up reaches the repo
  // root, matching the one real, already-established dependency edge this file has on
  // `packages/ui` (it already imports `EventDetailViewLabels` as a compiled type from
  // `@festgrid/ui` above; this reads the same file's source text for AST parsing instead).
  const INTERFACE_SOURCE_PATH = join(
    __dirname,
    '../../../../../packages/ui/src/features/events/EventDetailView.types.ts'
  );
  const EN_LOCALE_PATH = join(__dirname, '../../../locales/en.json');
  const ID_LOCALE_PATH = join(__dirname, '../../../locales/id.json');

  const interfaceSourceText = readFileSync(INTERFACE_SOURCE_PATH, 'utf-8');
  const extractedKeys = extractInterfacePropertyNames(interfaceSourceText, 'EventDetailViewLabels');

  const enLocale = JSON.parse(readFileSync(EN_LOCALE_PATH, 'utf-8'));
  const idLocale = JSON.parse(readFileSync(ID_LOCALE_PATH, 'utf-8'));

  it('finds at least one real property on EventDetailViewLabels (sanity check the extractor is reading the real file)', () => {
    expect(extractedKeys.length).toBeGreaterThan(0);
    expect(extractedKeys).toContain('loadingText');
  });

  it('every extracted key (minus the allow-list) exists in en.json\'s EventDetailsPage namespace', () => {
    const missing = findMissingKeys(extractedKeys, enLocale.EventDetailsPage);
    expect(missing, `Missing from en.json's "EventDetailsPage" namespace: ${missing.join(', ')}`).toEqual([]);
  });

  it('every extracted key (minus the allow-list) exists in id.json\'s EventDetailsPage namespace', () => {
    const missing = findMissingKeys(extractedKeys, idLocale.EventDetailsPage);
    expect(missing, `Missing from id.json's "EventDetailsPage" namespace: ${missing.join(', ')}`).toEqual([]);
  });

  // Non-vacuous proof (AC4): a test that only ever exercises today's already-correct real data
  // would pass vacuously without ever proving the check mechanism actually catches a real
  // desync. Matches this repo's existing convention (see
  // `apps/backend/src/lib/events/event-account-match-ratchet.test.ts`'s own "the scan is actually
  // tuned correctly" test) of proving a ratchet's detection logic against a small embedded
  // fixture before trusting it against real data.
  describe('the check is actually tuned correctly (non-vacuous proof)', () => {
    const FIXTURE_INTERFACE_SOURCE = `interface FixtureLabels { knownKey: string; rogueKey: string; }`;
    const FIXTURE_LOCALE_NAMESPACE = { knownKey: 'known' };

    it('reports the key missing from the fixture locale namespace', () => {
      const fixtureKeys = extractInterfacePropertyNames(FIXTURE_INTERFACE_SOURCE, 'FixtureLabels');
      const missing = findMissingKeys(fixtureKeys, FIXTURE_LOCALE_NAMESPACE);
      expect(missing).toEqual(['rogueKey']);
    });

    it('does not false-positive on the key that is actually present', () => {
      const fixtureKeys = extractInterfacePropertyNames(FIXTURE_INTERFACE_SOURCE, 'FixtureLabels');
      const missing = findMissingKeys(fixtureKeys, FIXTURE_LOCALE_NAMESPACE);
      expect(missing).not.toContain('knownKey');
    });
  });
});
