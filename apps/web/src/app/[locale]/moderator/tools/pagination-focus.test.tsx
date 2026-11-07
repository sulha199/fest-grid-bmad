import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { ActorRunsContent } from './actor-runs-content';
import { ModeratorAccountsContent } from './moderator-accounts-content';
import { UnprocessedPayloadsContent } from './unprocessed-payloads-content';
import { DuplicateEventsContent } from './duplicate-events-content';
import { graphqlClient } from '@/lib/graphql-client';

// Keyboard focus while paging. The page tests next to this file mock the data hooks and always report
// `isLoading: false`, which is exactly the state in which this bug cannot appear: with a real
// `useQuery`, moving to the next page starts a new query whose `isLoading` is true, and the pages used to
// answer that with `<RouteLoader />`, unmounting the Next button the moderator had just pressed so that
// focus fell to <body>. Here the real hooks, the real controller and the real controls run against a
// `graphqlClient.request` whose answers the test releases by hand.

vi.mock('@/features/auth/use-require-moderator', () => ({ useRequireModerator: () => ({ status: 'authorized' }) }));
vi.mock('sonner', () => {
  const toastFn: any = vi.fn();
  toastFn.success = vi.fn();
  toastFn.error = vi.fn();
  return { toast: toastFn };
});
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('../../settings/account/set-default-location-dialog', () => ({ SetDefaultLocationDialog: () => null }));
// The row and the filter panel have their own tests; stand-ins keep this about paging.
vi.mock('./payload-list-item', () => ({
  PayloadListItem: ({ payload }: { payload: { id: string } }) => <div data-testid="row">{payload.id}</div>,
}));
vi.mock('./filter-panel', () => ({ FilterPanel: () => null }));

type Deferred = { resolve: () => void; cursor: string | undefined };
const pending: Deferred[] = [];
const requests: Array<string | undefined> = [];

/** Answers `request` for one page: `first` has a next page, `second` is the last. Held until released. */
function stubRequests(buildPage: (cursor: string | undefined) => unknown) {
  vi.mocked(graphqlClient.request).mockImplementation(((arg: any, vars?: any) => {
    const variables = arg && typeof arg === 'object' && 'variables' in arg ? arg.variables : vars;
    const cursor: string | undefined = variables?.after ?? variables?.cursor ?? undefined;
    requests.push(cursor);
    return new Promise((resolve) => {
      pending.push({ cursor, resolve: () => resolve(buildPage(cursor)) });
    });
  }) as never);
}

async function release(cursor: string | undefined) {
  await waitFor(() => expect(pending.some((p) => p.cursor === cursor)).toBe(true));
  await act(async () => {
    pending.filter((p) => p.cursor === cursor).forEach((p) => p.resolve());
  });
}

const connection = (rowNode: unknown, hasNextPage: boolean, endCursor: string | null, extra: object = {}) => ({
  edges: [{ node: rowNode, cursor: endCursor ?? 'last' }],
  pageInfo: { hasNextPage, endCursor },
  ...extra,
});

const run = (id: string) => ({
  id, vendor: 'APIFY', triggerMode: 'SYNC', status: 'SUCCEEDED', profileId: 'p1', runId: id, itemCount: 1,
  startedAt: '2026-11-01T00:00:00Z', rawInput: {}, rawOutput: null, errorMessage: null,
});
const account = (id: string) => ({
  id, accountId: `acc-${id}`, platform: 'INSTAGRAM', username: id, displayName: id, isImageStorageOptedIn: false,
  defaultLocation: null, hasPendingDefaultLocationReview: false,
});
const suggestion = (id: string) => {
  const event = (suffix: string) => ({
    id: `${id}-${suffix}`, slug: `${id}-${suffix}`, eventName: `${id} ${suffix}`, location: 'Jakarta', imageUrl: null,
    durableImageUrl: null,
    schedules: [{ id: `s-${id}-${suffix}`, isMainSchedule: true, eventStartDate: '2026-12-01', eventEndDate: null, eventStartTime: null, eventEndTime: null, timezone: null }],
  });
  return { id, score: 0.6, status: 'pending', event: event('new'), candidateEvent: event('existing') };
};

const pages: Array<{
  name: string;
  Component: React.ComponentType;
  response: (cursor: string | undefined) => unknown;
  firstRow: string | RegExp;
  secondRow: string | RegExp;
}> = [
  {
    name: 'actor runs',
    Component: ActorRunsContent,
    response: (c) => ({ queryActorRuns: c ? connection(run('run-two'), false, null, { totalCount: 40 }) : connection(run('run-one'), true, 'c1', { totalCount: 40 }) }),
    firstRow: /run-one/,
    secondRow: /run-two/,
  },
  {
    name: 'moderator accounts',
    Component: ModeratorAccountsContent,
    response: (c) => ({ queryModeratorAccountProfiles: c ? connection(account('Second Account'), false, null, { totalCount: 40 }) : connection(account('First Account'), true, 'c1', { totalCount: 40 }) }),
    firstRow: 'First Account',
    secondRow: 'Second Account',
  },
  {
    name: 'unprocessed payloads',
    Component: UnprocessedPayloadsContent,
    response: (c) => ({ queryUnprocessedPayloads: c ? connection({ id: 'payload-two' }, false, null, { totalCount: 40 }) : connection({ id: 'payload-one' }, true, 'c1', { totalCount: 40 }) }),
    firstRow: 'payload-one',
    secondRow: 'payload-two',
  },
  {
    name: 'duplicate events',
    Component: DuplicateEventsContent,
    response: (c) => ({ suggestedEventMatches: c ? connection(suggestion('sugg-two'), false, null) : connection(suggestion('sugg-one'), true, 'c1') }),
    firstRow: /sugg-one new/,
    secondRow: /sugg-two new/,
  },
];

const renderPage = (Component: React.ComponentType) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages as never}>
        <Component />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe.each(pages)('$name: keyboard focus while paging (real queries)', ({ Component, response, firstRow, secondRow }) => {
  beforeEach(() => {
    pending.length = 0;
    requests.length = 0;
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    stubRequests(response);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the Next button mounted and focused while the next page loads and after it arrives', async () => {
    const user = userEvent.setup();
    renderPage(Component);
    await release(undefined);
    expect(await screen.findByText(firstRow)).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    expect(next).toHaveFocus();
    await user.keyboard('{Enter}');

    // The second page is still in flight. The old rows stay, the same button element keeps focus, and it
    // is unavailable (aria-disabled) so a second Enter cannot start another page.
    await waitFor(() => expect(requests).toEqual([undefined, 'c1']));
    expect(screen.getByRole('button', { name: 'Next' })).toBe(next);
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(firstRow)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(requests).toEqual([undefined, 'c1']);

    await release('c1');
    expect(await screen.findByText(secondRow)).toBeInTheDocument();

    // On the last page Next is unavailable, yet it still holds focus (a natively disabled button would not),
    // and Previous works from the keyboard.
    expect(screen.getByRole('button', { name: 'Next' })).toBe(next);
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('does not report the previous page\'s numbers for the new page, so Next cannot reuse a stale cursor', async () => {
    const user = userEvent.setup();
    renderPage(Component);
    await release(undefined);
    await screen.findByText(firstRow);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(requests).toEqual([undefined, 'c1']));
    await release('c1');
    await screen.findByText(secondRow);

    // Last page: hasNextPage came from the second page's own answer, not from the first page's.
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
    // Never asked for a page beyond the second.
    expect(requests).toEqual([undefined, 'c1']);
  });
});

describe('moderator accounts: the search box keeps focus while the list refilters', () => {
  beforeEach(() => {
    pending.length = 0;
    requests.length = 0;
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    // Every search term gets its own page; the cursor is irrelevant here.
    vi.mocked(graphqlClient.request).mockImplementation(((arg: any) => {
      const term: string = arg.variables?.filters?.search ?? '';
      requests.push(term);
      return new Promise((resolve) => {
        pending.push({
          cursor: term,
          resolve: () => resolve({ queryModeratorAccountProfiles: connection(account(term ? `Match ${term}` : 'Everyone'), false, null, { totalCount: term ? 1 : 40 }) }),
        });
      });
    }) as never);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('typing a letter does not replace the page with a loader', async () => {
    const user = userEvent.setup();
    renderPage(ModeratorAccountsContent);
    await release('');
    await screen.findByText('Everyone');

    const search = screen.getByLabelText('Search Accounts');
    await user.click(search);
    await user.keyboard('a');

    await waitFor(() => expect(requests).toEqual(['', 'a']));
    // Same input element, still focused, still holding what was typed, while the new answer is pending.
    expect(screen.getByLabelText('Search Accounts')).toBe(search);
    expect(search).toHaveFocus();
    expect(search).toHaveValue('a');
    // The old list's total is not carried over to the new filter while its answer is pending.
    expect(screen.queryByText('40 total')).not.toBeInTheDocument();

    await release('a');
    expect(await screen.findByText('Match a')).toBeInTheDocument();
    expect(search).toHaveFocus();
  });
});

// A page past the end of the list: the moderator resolved or removed every row on the last page while standing on
// it, so the next fetch of that page returns no rows although earlier pages exist. The list used to render an empty
// block with only the controls; now it says so, and Previous brings the earlier page back.
const PAGE_NAMESPACE: Record<string, string> = {
  'actor runs': 'ActorRunsPage',
  'moderator accounts': 'ModeratorAccountsPage',
  'unprocessed payloads': 'UnprocessedPayloadsPage',
  'duplicate events': 'DuplicateEventsPage',
};

describe.each(pages)('$name: a page left empty after its rows were resolved (real queries)', ({ name, Component, response, firstRow }) => {
  const noRows = { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 20 };

  beforeEach(() => {
    pending.length = 0;
    requests.length = 0;
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    stubRequests((cursor) => {
      const first = response(undefined) as Record<string, unknown>;
      return cursor ? { [Object.keys(first)[0]]: noRows } : first;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('says so, keeps the controls, and goes back with Previous', async () => {
    const user = userEvent.setup();
    renderPage(Component);
    await release(undefined);
    await screen.findByText(firstRow);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await release('c1');

    const notice = await screen.findByText('Nothing is left on this page. Use Previous to go back.');
    expect(notice).toHaveAttribute('role', 'status');
    expect(screen.queryByText(firstRow)).not.toBeInTheDocument();
    // Previous stays available, Next does not.
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText(firstRow)).toBeInTheDocument();
    expect(screen.queryByText('Nothing is left on this page. Use Previous to go back.')).not.toBeInTheDocument();
  });

  it('does not show the notice on an empty first page: the list\'s own empty state covers it', async () => {
    stubRequests(() => ({ [Object.keys(response(undefined) as Record<string, unknown>)[0]]: noRows }));
    renderPage(Component);
    await release(undefined);

    // The page's own empty state is up (so the data has arrived), and the end-of-list notice is not.
    const headline = (enMessages as unknown as Record<string, Record<string, string>>)[PAGE_NAMESPACE[name]].emptyHeadline;
    expect(await screen.findByText(headline)).toBeInTheDocument();
    expect(screen.queryByText('Nothing is left on this page. Use Previous to go back.')).not.toBeInTheDocument();
  });
});
