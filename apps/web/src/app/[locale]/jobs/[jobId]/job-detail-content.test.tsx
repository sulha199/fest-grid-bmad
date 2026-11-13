import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from '@/features/jobs/job-test-support';
import { JobDetailContent } from './job-detail-content';

const replace = vi.fn();
vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace }),
}));
vi.mock('@/components/providers/auth-session-provider', () => ({ useAuthSession: () => ({ session: { user: { id: 'u1' } }, isLoading: false }) }));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const capture = vi.mocked(capturePostHogEvent);

const failed = (overrides: Record<string, unknown> = {}) =>
  ({
    ...makeFragment({
      id: 'job-9',
      status: 'FAILED',
      reasonCode: 'TIMED_OUT',
      startedAt: '2026-11-13T12:00:00.000Z',
      finishedAt: '2026-11-13T12:02:00.000Z',
      steps: [{ key: 'refresh', state: 'CURRENT', done: null, total: null }],
      canRetry: true,
      ...overrides,
    }),
    owner: { displayName: 'Wayan Moderator' },
    moderatorDetails: null,
  }) as Record<string, unknown>;

const moderatorDetails = {
  attempts: [
    { provider: 'APIFY', outcome: 'TIMED_OUT', budgetMs: 20000, elapsedMs: 20000, reasonCode: 'TIMED_OUT' },
    { provider: 'BRIGHT_DATA', outcome: 'OVER_QUOTA', budgetMs: 20000, elapsedMs: 900, reasonCode: 'PROVIDER_OVER_QUOTA' },
  ],
  engineReasonCode: 'HANDLER_ERROR',
  engineMessage: 'The handler stopped before it finished.',
};

const ui = (id = 'job-9') => (
  <TestProviders>
    <JobDetailContent jobId={id} />
  </TestProviders>
);

beforeEach(() => {
  setVisibility('visible');
  replace.mockClear();
  capture.mockClear();
});
afterEach(() => {
  cleanup();
  request.mockReset();
});

describe('JobDetailContent', () => {
  it('shows the back link, the panel, the timing and no technical details for an ordinary user', async () => {
    installGraphqlFake(request, () => ({ job: failed({ canRetry: false }) }));
    render(ui());
    expect(await screen.findByTestId('job-progress-view')).toHaveAttribute('data-form', 'panel');
    expect(screen.getByTestId('job-back-link')).toHaveAttribute('href', '/jobs');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Re-extracting a post: Post DcntzF0mB7z');
    expect(screen.getByTestId('job-timing')).toHaveTextContent('Took 2 min');
    expect(screen.queryByTestId('job-technical-details')).not.toBeInTheDocument();
    expect(screen.queryByText(/Apify|Bright Data|HANDLER_ERROR/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows collapsed technical details to a moderator: attempts as a table and a stacked list, the engine code and message, the job id and who started it', async () => {
    installGraphqlFake(request, () => ({ job: { ...failed(), moderatorDetails } }));
    render(ui());
    const details = await screen.findByTestId('job-technical-details');
    expect(details.tagName).toBe('DETAILS');
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText('Technical details (moderators)')).toBeInTheDocument();
    const table = within(details).getByTestId('job-attempts-table');
    expect(table.className).toContain('overflow-x-auto');
    expect(table.className).toContain('md:block');
    expect(within(table).getByText('Apify')).toBeInTheDocument();
    expect(within(table).getByText('Over quota')).toBeInTheDocument();
    expect(within(table).getAllByText(/^20 sec/).length).toBeGreaterThan(0);
    expect(within(details).getByTestId('job-attempts-list').className).toContain('md:hidden');
    expect(within(details).getByText('HANDLER_ERROR')).toBeInTheDocument();
    expect(within(details).getByText('The handler stopped before it finished.')).toBeInTheDocument();
    expect(within(details).getByText('job-9')).toBeInTheDocument();
    expect(within(details).getByText('A user: Wayan Moderator')).toBeInTheDocument();
  });

  it('reads "This job was not found." with a link to Jobs for a missing, retained-out or foreign job', async () => {
    installGraphqlFake(request, () => ({ job: null }));
    render(ui('gone'));
    expect(await screen.findByText('This job was not found.')).toBeInTheDocument();
    expect(within(screen.getByTestId('job-not-found')).getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/jobs');
  });

  it('notes a late result on an ended job that is not already saying so', async () => {
    installGraphqlFake(request, () => ({ job: failed({ completedAfterDeadline: true, canRetry: false }) }));
    render(ui());
    expect(await screen.findByText('The answer arrived late but was still used.')).toBeInTheDocument();
  });

  it('Retry started moves this page to the new job and announces it', async () => {
    const user = userEvent.setup();
    const log = installGraphqlFake(request, (operation) => {
      if (operation === 'JobDetail') return { job: failed() };
      return { retryJob: { outcome: 'STARTED', errorCode: null, activeCount: null, reservedCount: null, cap: null, maxQueued: null, retryNotBefore: null, job: makeFragment({ id: 'job-10' }) } };
    });
    render(ui());
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/jobs/job-10'));
    expect(log.find((l) => l.operation === 'RetryJob')?.variables).toEqual({ jobId: 'job-9' });
    expect(capture).toHaveBeenCalledWith('job_retry_clicked', { jobType: 'REEXTRACT_REFRESH', reasonCode: 'TIMED_OUT' });
    await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('Started again.'));
  });

  it('Retry reused says it is already running; queue full links to Jobs; a cap refusal leaves the notice slot empty', async () => {
    const user = userEvent.setup();
    let result: Record<string, unknown> = { outcome: 'REUSED', job: makeFragment({ id: 'job-open' }) };
    installGraphqlFake(request, (operation) => (operation === 'JobDetail' ? { job: failed() } : { retryJob: result }));
    render(ui());
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/jobs/job-open'));
    await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('This is already running.'));

    result = { outcome: 'REFUSED', job: null, errorCode: 'JOB_QUEUE_FULL', maxQueued: 10 };
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    const notice = await screen.findByTestId('job-retry-failure');
    expect(notice).toHaveTextContent('Too many jobs are waiting (10).');
    expect(within(notice).getByRole('link', { name: 'Open Jobs' })).toHaveAttribute('href', '/jobs');

    result = { outcome: 'REFUSED', job: null, errorCode: 'SUBSCRIPTION_CAP_REACHED', activeCount: 5, reservedCount: 0, cap: 5 };
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('job-retry-failure')).not.toBeInTheDocument());
  });

  it('a cooldown reads "Retry at {time}" and is aria-disabled', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    installGraphqlFake(request, () => ({ job: failed({ reasonCode: 'COOLDOWN', retryNotBefore: future }) }));
    render(ui());
    const button = await screen.findByRole('button', { name: /^Retry at / });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
