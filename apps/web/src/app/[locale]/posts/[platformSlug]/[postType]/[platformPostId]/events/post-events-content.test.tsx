import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../../../../locales/en.json';
import PostEventsContent from './post-events-content';

// Story 3.6x (AC4) -- render/loading/empty/error states; pagination batch-fetch over the frozen
// ids returned by `relatedEventIds(postId)`. Mirrors `account-content.test.tsx`'s mocking
// approach (real `graphqlClient.request` mock dispatching per-document, real `@festgrid/ui`
// with only `useInfiniteScroll` swapped for a manually-triggerable stub).

const mockRouterPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

let mockRelatedEventIdsResult: { postId: string; eventIds: string[] }[] = [];
let mockEventsItems: any[] = [];
let mockRelatedEventIdsError: Error | null = null;
let mockEventsError: Error | null = null;

function extractDocumentAndVariables(args: any[]): { document: any; variables: any } {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && 'document' in args[0]) {
    return { document: args[0].document, variables: args[0].variables };
  }
  return { document: args[0], variables: args[1] };
}

const mockRequestSpy = vi.fn().mockImplementation(async (...args: any[]) => {
  const { document, variables } = extractDocumentAndVariables(args);
  const docString = document.toString();

  if (docString.includes('relatedEventIds')) {
    if (mockRelatedEventIdsError) {
      throw mockRelatedEventIdsError;
    }
    return { relatedEventIds: mockRelatedEventIdsResult };
  }

  if (mockEventsError) {
    throw mockEventsError;
  }

  const ids: string[] = variables?.query?.conditions?.[0]?.value ?? [];
  const items = mockEventsItems.filter((item) => ids.includes(item.id));
  return {
    events: {
      items,
      hasMore: false,
      totalCount: ids.length,
    },
  };
});

vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {
    request: (...args: any[]) => mockRequestSpy(...args),
  },
}));

let triggerScroll: (() => void) | null = null;
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    useInfiniteScroll: ({ fetchNextPage, hasNextPage, isFetchingNextPage }: any) => {
      triggerScroll = () => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      };
      return { sentinelRef: vi.fn() };
    },
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const ACCOUNT = {
  accountId: 'acc_1',
  platform: 'instagram',
  username: 'someacct',
  displayName: 'Some Account',
  profileImageUrl: null,
};

describe('PostEventsContent', () => {
  beforeEach(() => {
    mockRelatedEventIdsResult = [];
    mockEventsItems = [];
    mockRelatedEventIdsError = null;
    mockEventsError = null;
    mockRequestSpy.mockClear();
    mockRouterPush.mockClear();
    triggerScroll = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the PageHeader title reusing EventDetailsPage.relatedEventsGroupLabel with the account display name', async () => {
    mockRelatedEventIdsResult = [{ postId: 'post_1', eventIds: [] }];

    renderWithProviders(<PostEventsContent postId="post_1" account={ACCOUNT} />);

    expect(await screen.findByRole('heading', { name: 'Events from Some Account' })).toBeInTheDocument();
  });

  it('renders the empty state when the post has no live linked events', async () => {
    mockRelatedEventIdsResult = [{ postId: 'post_1', eventIds: [] }];

    renderWithProviders(<PostEventsContent postId="post_1" account={ACCOUNT} />);

    await waitFor(() => {
      expect(screen.getByText(enMessages.PostCollectionPage.emptyState)).toBeInTheDocument();
    });
  });

  it('renders the batch-fetched events for the frozen ids returned by relatedEventIds(postId)', async () => {
    mockRelatedEventIdsResult = [{ postId: 'post_1', eventIds: ['evt_1', 'evt_2'] }];
    mockEventsItems = [
      {
        id: 'evt_1',
        eventName: 'First Event',
        slug: 'first-event',
        imageUrl: null,
        durableImageUrl: null,
        location: 'Location 1',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          { id: 'evt_1_sch', isMainSchedule: true, eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString() },
        ],
      },
      {
        id: 'evt_2',
        eventName: 'Second Event',
        slug: 'second-event',
        imageUrl: null,
        durableImageUrl: null,
        location: 'Location 2',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          { id: 'evt_2_sch', isMainSchedule: true, eventStartDate: new Date('2026-08-13T12:00:00Z').toISOString() },
        ],
      },
    ];

    renderWithProviders(<PostEventsContent postId="post_1" account={ACCOUNT} />);

    expect(await screen.findByText('First Event')).toBeInTheDocument();
    expect(await screen.findByText('Second Event')).toBeInTheDocument();

    // The batch fetch used the reused events(id in [...]) DSL condition, not a new document.
    // Pass each call's own argument array through unmodified (not rebuilt into a fixed-length
    // tuple) so extractDocumentAndVariables can correctly tell apart the fetcher's single-object
    // call shape (relatedEventIds, via the generated hook) from the direct two-arg call shape
    // (events, called directly on graphqlClient.request below).
    const eventsCall = mockRequestSpy.mock.calls.find((callArgs) => {
      const { document } = extractDocumentAndVariables(callArgs);
      return !document.toString().includes('relatedEventIds');
    });
    expect(eventsCall).toBeTruthy();
    const { variables } = extractDocumentAndVariables(eventsCall!);
    expect(variables.query).toEqual({
      operator: 'and',
      conditions: [{ field: 'id', operator: 'in', value: ['evt_1', 'evt_2'] }],
    });
  });

  it('renders the error state when the relatedEventIds lookup fails', async () => {
    mockRelatedEventIdsError = new Error('lookup failed');

    renderWithProviders(<PostEventsContent postId="post_1" account={ACCOUNT} />);

    await waitFor(() => {
      expect(screen.getByText(enMessages.PostCollectionPage.errorState)).toBeInTheDocument();
    });
  });

  it('navigates to the event detail page with fromList=post and the frozen postEventIds on card click', async () => {
    mockRelatedEventIdsResult = [{ postId: 'post_1', eventIds: ['evt_1', 'evt_2'] }];
    mockEventsItems = [
      {
        id: 'evt_1',
        eventName: 'First Event',
        slug: 'first-event',
        imageUrl: null,
        durableImageUrl: null,
        location: 'Location 1',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          { id: 'evt_1_sch', isMainSchedule: true, eventStartDate: new Date('2026-08-12T12:00:00Z').toISOString() },
        ],
      },
      {
        id: 'evt_2',
        eventName: 'Second Event',
        slug: 'second-event',
        imageUrl: null,
        durableImageUrl: null,
        location: 'Location 2',
        types: ['FESTIVAL'],
        categories: ['MUSIC'],
        schedules: [
          { id: 'evt_2_sch', isMainSchedule: true, eventStartDate: new Date('2026-08-13T12:00:00Z').toISOString() },
        ],
      },
    ];

    renderWithProviders(<PostEventsContent postId="post_1" account={ACCOUNT} />);

    const card = await screen.findByText('First Event');
    card.closest('[role="button"], a, div[tabindex], *')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // EventCard's own click target: click the nearest ancestor that actually carries the onClick.
    // Fall back to clicking the text node directly if the structural click above didn't resolve.
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.click(card);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalled();
    });
    const [pushedUrl] = mockRouterPush.mock.calls[mockRouterPush.mock.calls.length - 1];
    expect(pushedUrl).toContain('/events/first-event?');
    expect(pushedUrl).toContain('fromList=post');
    expect(pushedUrl).toContain(`postEventIds=${encodeURIComponent('evt_1,evt_2')}`);
  });
});
