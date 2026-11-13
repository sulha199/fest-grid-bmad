import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from '@/features/jobs/job-test-support';
import { JobsContent } from './jobs-content';
import { JOB_ROW_MIN_HEIGHT, JobRowSkeletons } from './job-row';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/components/providers/auth-session-provider', () => ({ useAuthSession: () => ({ session: { user: { id: 'u1' } }, isLoading: false }) }));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const capture = vi.mocked(capturePostHogEvent);

const finished = (id: string, overrides: Record<string, unknown> = {}) =>
  ({
    ...makeFragment({ id, status: 'SUCCEEDED', startedAt: '2026-11-13T12:00:00.000Z', finishedAt: '2026-11-13T12:01:20.000Z', steps: [], ...overrides }),
    owner: null,
  }) as unknown as ReturnType<typeof makeFragment>;

interface Page {
  ids: string[];
  hasNext?: boolean;
  fail?: boolean;
  overrides?: Record<string, unknown>;
}

/** A fake API: `pages` is keyed by the cursor the client sends (undefined is page 1). */
function installApi(options: { role: 'moderator' | 'user'; pages: Record<string, Page>; active?: Array<ReturnType<typeof makeFragment>> }) {
  return installGraphqlFake(request, (operation, variables) => {
    if (operation === 'me') return { me: { id: 'u1', email: 'a@example.test', role: options.role } };
    if (operation === 'ActiveJobs') return { activeJobs: (options.active ?? []).map((j) => ({ ...j, owner: null })) };
    if (operation === 'MyJobs') {
      const page = options.pages[String(variables.after ?? 'first')];
      if (!page) throw new Error(`no page for ${String(variables.after)}`);
      if (page.fail) throw new Error('boom');
      return {
        myJobs: {
          edges: page.ids.map((id) => ({ cursor: `cur-${id}`, node: finished(id, page.overrides) })),
          pageInfo: { hasNextPage: !!page.hasNext, endCursor: page.ids.length ? `cur-${page.ids[page.ids.length - 1]}` : null },
        },
      };
    }
    throw new Error(`unexpected ${operation}`);
  });
}

const ui = () => (
  <TestProviders>
    <JobsContent />
  </TestProviders>
);
const calls = (log: Array<{ operation: string; variables: Record<string, unknown> }>, op: string) => log.filter((l) => l.operation === op);

beforeEach(() => {
  setVisibility('visible');
  capture.mockClear();
});
afterEach(() => {
  cleanup();
  request.mockReset();
});

describe('JobsContent, an ordinary user', () => {
  it('shows In progress above Finished, rows that link to the job, and no filter row', async () => {
    const running = makeFragment({ id: 'run-1' });
    installApi({ role: 'user', pages: { first: { ids: ['fin-1'] } }, active: [running] });
    render(ui());

    const rows = await screen.findAllByTestId('job-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', '/jobs/run-1');
    expect(rows[1]).toHaveAttribute('href', '/jobs/fin-1');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['In progress', 'Finished']);
    expect(within(rows[1]).getByText('Took 1 min 20 s', { exact: false })).toBeInTheDocument();
    expect(within(rows[0]).getByText('Post DcntzF0mB7z')).toBeInTheDocument();
    // The status is text as well as colour, and the row's link name carries title and status.
    expect(rows[1]).toHaveAccessibleName(/^Open details: .*, Done$/);
    // Ordinary users never see the filter row or an owner line.
    expect(screen.queryByTestId('jobs-filters')).not.toBeInTheDocument();
    expect(screen.queryByText(/Started by/)).not.toBeInTheDocument();
  });

  it('does not send a filter for an ordinary user (it would be FORBIDDEN)', async () => {
    const log = installApi({ role: 'user', pages: { first: { ids: ['fin-1'] } } });
    render(ui());
    await screen.findByTestId('job-row');
    expect(calls(log, 'MyJobs')[0].variables.filter).toBeUndefined();
    expect(calls(log, 'MyJobs')[0].variables).toMatchObject({ onlyEnded: true, first: 20 });
    expect(calls(log, 'ActiveJobs')[0].variables.filter).toBeUndefined();
  });

  it('renders an account row as a SubscribedAccountCard without a subscribe toggle or a nested link', async () => {
    const account = {
      kind: 'ACCOUNT',
      accountId: 'acc-1',
      platform: 'instagram',
      username: 'venue',
      displayName: 'The Venue',
      profileImageUrl: null,
      postCount: null,
      postCode: null,
      postId: null,
    };
    installApi({ role: 'user', pages: { first: { ids: ['fin-acc'], overrides: { type: 'SUBSCRIBE', subject: account } } } });
    render(ui());
    const row = await screen.findByTestId('job-row');
    expect(within(row).getByText('The Venue')).toBeInTheDocument();
    expect(within(row).getByText('Instagram')).toBeInTheDocument();
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(row.querySelectorAll('a')).toHaveLength(0);
  });

  it('shows the empty state, and the queue position and next try on open rows', async () => {
    installApi({ role: 'user', pages: { first: { ids: [] } } });
    render(ui());
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing is running right now.')).toBeInTheDocument();
    cleanup();

    installApi({
      role: 'user',
      pages: { first: { ids: [] } },
      active: [
        makeFragment({ id: 'q-1', status: 'QUEUED', startedAt: null, steps: [], queue: { position: 2, maxConcurrent: 3, expiresAt: '2026-11-13T14:30:00.000Z' } }),
        makeFragment({ id: 'w-1', status: 'WAITING', steps: [], waiting: { waitingFor: 'RETRY_AT', resumeAt: '2026-11-13T14:20:00.000Z', done: null, total: null } }),
      ],
    });
    render(ui());
    expect(await screen.findByText(/Number 2 in line/)).toBeInTheDocument();
    expect(screen.getByText(/Next try/)).toBeInTheDocument();
  });

  it('shows a loading skeleton whose rows keep the real row height class', async () => {
    const { container } = render(<JobRowSkeletons count={2} />);
    expect(Array.from(container.querySelectorAll('div')).filter((d) => d.className.includes(JOB_ROW_MIN_HEIGHT))).toHaveLength(2);
    cleanup();
    // The real row carries the same minimum height, so the page does not jump when the data arrives.
    installApi({ role: 'user', pages: { first: { ids: ['fin-1'] } } });
    render(ui());
    expect((await screen.findByTestId('job-row')).className).toContain(JOB_ROW_MIN_HEIGHT);
  });

  it('shows a load error with Try again for the finished list', async () => {
    installApi({ role: 'user', pages: { first: { ids: [], fail: true } } });
    render(ui());
    expect(await screen.findByText('We could not load your jobs.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('JobsContent paging (AD-18 rule 4)', () => {
  it('pages with Previous and Next through the controller cursor', async () => {
    const user = userEvent.setup();
    const log = installApi({ role: 'user', pages: { first: { ids: ['a', 'b'], hasNext: true }, 'cur-b': { ids: ['c'] } } });
    render(ui());
    await screen.findAllByTestId('job-row');
    const next = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    await waitFor(() => expect(screen.getAllByTestId('job-row')).toHaveLength(1));
    expect(calls(log, 'MyJobs').map((c) => c.variables.after)).toEqual([undefined, 'cur-b']);
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(screen.getAllByTestId('job-row')).toHaveLength(2));
  });

  it('an empty later page shows the notice above the controls; a failing later page shows its error instead', async () => {
    const user = userEvent.setup();
    installApi({ role: 'user', pages: { first: { ids: ['a'], hasNext: true }, 'cur-a': { ids: [] } } });
    render(ui());
    await screen.findByTestId('job-row');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/Nothing is left on this page/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    cleanup();
    request.mockReset();

    installApi({ role: 'user', pages: { first: { ids: ['a'], hasNext: true }, 'cur-a': { ids: [], fail: true } } });
    render(ui());
    await screen.findByTestId('job-row');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('We could not load your jobs.')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is left on this page/)).not.toBeInTheDocument();
  });
});

describe('JobsContent, a moderator', () => {
  const pages = { first: { ids: ['a'], hasNext: true }, 'cur-a': { ids: ['b'] } };

  it('shows the filter row, the owner line, and applies a filter at once on page 1 without a refetch of the old query', async () => {
    const user = userEvent.setup();
    const log = installApi({ role: 'moderator', pages });
    render(ui());
    await screen.findByTestId('job-row');
    expect(screen.getByRole('radiogroup', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'My jobs' })).toBeChecked();
    expect(calls(log, 'MyJobs')[0].variables.filter).toEqual({ scope: 'MINE', includeSystem: false });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls(log, 'MyJobs')).toHaveLength(2));

    const before = calls(log, 'MyJobs').length;
    await user.click(screen.getByRole('radio', { name: 'All users' }));
    // The filter changed the query key, so the query fetched by itself: one new request, for page 1, with the new filter.
    await waitFor(() => expect(calls(log, 'MyJobs').length).toBe(before + 1));
    const last = calls(log, 'MyJobs').at(-1)!;
    expect(last.variables.filter).toEqual({ scope: 'ALL_USERS', includeSystem: false });
    expect(last.variables.after).toBeUndefined();
    expect(capture).toHaveBeenCalledWith('jobs_filter_changed', { scope: 'ALL_USERS', includeSystem: false });

    await user.click(screen.getByRole('checkbox', { name: 'Include system jobs' }));
    await waitFor(() => expect(calls(log, 'MyJobs').at(-1)!.variables.filter).toEqual({ scope: 'ALL_USERS', includeSystem: true }));
    expect(capture).toHaveBeenCalledWith('jobs_filter_changed', { scope: 'ALL_USERS', includeSystem: true });
  });

  it('Clear filters resets the filters and returns to page 1', async () => {
    const user = userEvent.setup();
    const log = installApi({ role: 'moderator', pages: { first: { ids: ['a'], hasNext: true }, 'cur-a': { ids: ['b'] } } });
    render(ui());
    await screen.findByTestId('job-row');
    await user.click(screen.getByRole('checkbox', { name: 'Include system jobs' }));
    await waitFor(() => expect(calls(log, 'MyJobs').at(-1)!.variables.filter).toEqual({ scope: 'MINE', includeSystem: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls(log, 'MyJobs').at(-1)!.variables.after).toBe('cur-a'));

    await user.click(screen.getByTestId('jobs-clear-filters'));
    await waitFor(() => expect(calls(log, 'MyJobs').at(-1)!.variables).toMatchObject({ filter: { scope: 'MINE', includeSystem: false } }));
    expect(calls(log, 'MyJobs').at(-1)!.variables.after).toBeUndefined();
    expect(screen.getByRole('checkbox', { name: 'Include system jobs' })).not.toBeChecked();
  });

  it('shows "Started by {name}" and "System job"', async () => {
    installGraphqlFake(request, (operation) => {
      if (operation === 'me') return { me: { id: 'm1', email: 'm@example.test', role: 'moderator' } };
      if (operation === 'ActiveJobs') return { activeJobs: [] };
      return {
        myJobs: {
          edges: [
            { cursor: 'c1', node: { ...finished('j1'), owner: { displayName: 'Alice Reporter' } } },
            { cursor: 'c2', node: { ...finished('j2', { trigger: 'SYSTEM' }), owner: null } },
          ],
          pageInfo: { hasNextPage: false, endCursor: 'c2' },
        },
      };
    });
    render(ui());
    expect(await screen.findByText('Started by Alice Reporter')).toBeInTheDocument();
    expect(screen.getByText('System job')).toBeInTheDocument();
  });

  it('a filtered-empty list says so and offers Clear filters', async () => {
    const user = userEvent.setup();
    installApi({ role: 'moderator', pages: { first: { ids: ['a'] } } });
    render(ui());
    await screen.findByTestId('job-row');
    // No page for the new filter's first request returns rows: the API fake serves the same page, so swap it.
    request.mockReset();
    installGraphqlFake(request, (operation, variables) => {
      if (operation === 'me') return { me: { id: 'm1', email: 'm@example.test', role: 'moderator' } };
      if (operation === 'ActiveJobs') return { activeJobs: [] };
      const filter = variables.filter as { scope?: string } | undefined;
      return { myJobs: { edges: filter?.scope === 'ALL_USERS' ? [] : [{ cursor: 'c', node: finished('a') }], pageInfo: { hasNextPage: false, endCursor: null } } };
    });
    await user.click(screen.getByRole('radio', { name: 'All users' }));
    expect(await screen.findByText('No jobs match these filters')).toBeInTheDocument();
  });
});
