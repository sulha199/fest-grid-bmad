import '@testing-library/jest-dom/vitest';
import React, { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from '@/lib/graphql-client';
import { JobProgressHost } from './job-progress-host';
import { useJobProgress } from './use-job-progress';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from './job-test-support';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const capture = vi.mocked(capturePostHogEvent);
const subject = { type: 'REEXTRACT_REFRESH' as never, postId: 'p1' };

function Harness({ startId = 'job-1', renderCapNotice }: { startId?: string; renderCapNotice?: boolean }) {
  const controller = useJobProgress({ subject, endedWithinMinutes: 30 });
  const startRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={startRef} onClick={() => controller.attach(startId, { open: true })}>
        Start
      </button>
      <button onClick={() => controller.attach(startId, { open: true, reused: true })}>Start again</button>
      <h1>Page heading</h1>
      <JobProgressHost controller={controller} returnFocusRef={startRef} renderCapNotice={renderCapNotice ? (f) => <p data-testid="cap-slot">cap {f.cap}</p> : undefined} />
    </>
  );
}

const ui = (props: React.ComponentProps<typeof Harness> = {}) => (
  <TestProviders>
    <Harness {...props} />
  </TestProviders>
);

type State = { jobs: Record<string, ReturnType<typeof makeFragment> | null>; active: ReturnType<typeof makeFragment>[]; retry?: unknown };
let state: State;
let log: ReturnType<typeof installGraphqlFake>;

beforeEach(() => {
  setVisibility('visible');
  state = { jobs: { 'job-1': makeFragment() }, active: [] };
  log = installGraphqlFake(request, (operation, variables) => {
    if (operation === 'JobById') return { job: state.jobs[String(variables.id)] ?? null };
    if (operation === 'ActiveJobs') return { activeJobs: state.active.map((j) => ({ ...j, owner: null })) };
    if (operation === 'RetryJob') {
      if (state.retry instanceof Error) throw state.retry;
      return { retryJob: state.retry };
    }
    throw new Error(`unexpected ${operation}`);
  });
  capture.mockClear();
});
afterEach(() => {
  cleanup();
  request.mockReset();
});

describe('JobProgressHost: minimize and re-open from server state', () => {
  it('shows a chip, not a dialog, for a job found on mount (reload or another device), and re-opens it at the last progress', async () => {
    state.active = [makeFragment()];
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(ui());
    const chip = await screen.findByRole('button', { name: /Show progress: .*Post DcntzF0mB7z. In progress/ });
    expect(chip).toHaveTextContent('In progress: step 2 of 2');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(log.find((l) => l.operation === 'ActiveJobs')?.variables).toMatchObject({ subject: { postId: 'p1' }, endedWithinMinutes: 30 });

    await userEvent.click(chip);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Step 2 of 2')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('Fetching fresh images');
    expect(within(dialog).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(capture).toHaveBeenCalledWith('job_progress_reopened', { jobType: 'REEXTRACT_REFRESH', status: 'RUNNING', source: 'chip' });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('opens the dialog by itself only for the user\'s own start; Minimize turns it into a chip with focus on it', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    const dialog = await screen.findByRole('dialog', { name: /Re-extracting a post/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Minimize' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const chip = await screen.findByTestId('job-chip');
    await waitFor(() => expect(chip).toHaveFocus());
    expect(capture).toHaveBeenCalledWith('job_progress_minimized', { jobType: 'REEXTRACT_REFRESH', status: 'RUNNING' });
    expect(screen.getByRole('status')).toHaveTextContent('Progress minimized. The job keeps running.');
  });

  it('Escape minimizes an open job; nothing stops it (no mutation is sent)', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('job-chip')).toBeInTheDocument();
    expect(log.some((l) => l.operation === 'RetryJob')).toBe(false);
  });

  it('an ended job: Close drops the chip and returns focus to the control that started the action', async () => {
    state.jobs['job-1'] = makeFragment({ status: 'SUCCEEDED', finishedAt: '2026-11-13T14:01:20.000Z', steps: [{ key: 'refresh', state: 'DONE', done: null, total: null }, { key: 'preview', state: 'DONE', done: null, total: null }] });
    render(ui());
    const start = screen.getByRole('button', { name: 'Start' });
    await userEvent.click(start);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByTestId('job-succeeded-box')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Minimize' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByTestId('job-chip')).not.toBeInTheDocument();
    await waitFor(() => expect(start).toHaveFocus());
  });

  it('starting the same action again re-attaches and says so', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('status')).toHaveTextContent('This is already running.');
  });

  it('shows the load error with Try again, and not-found with a link to Jobs', async () => {
    state.jobs['gone'] = null;
    render(ui({ startId: 'gone' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('This job was not found.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Jobs' }).some((a) => a.getAttribute('href') === '/jobs')).toBe(true);
  });

  it('links to the account from a finished account job, built from platform and username only', async () => {
    state.jobs['job-1'] = makeFragment({ type: 'SUBSCRIBE', status: 'SUCCEEDED', finishedAt: '2026-11-13T14:01:20.000Z', subject: { kind: 'ACCOUNT', accountId: '999', platform: 'instagram', username: 'venue', displayName: 'Venue', profileImageUrl: null, postCount: null, postCode: null, postId: null }, outcome: { kind: 'ACCOUNT', eventCount: null, postCount: null, previewApplyUntil: null, previewApplied: null }, steps: [{ key: 'lookup', state: 'DONE', done: null, total: null }] });
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    const link = await screen.findByTestId('job-result-link');
    expect(link).toHaveTextContent('Open the account');
    expect(link.getAttribute('href')).toBe('/ig/venue');
    expect(link.getAttribute('href')).not.toContain('999');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Adding an account: @venue');
  });
});

describe('JobProgressHost: announcements', () => {
  it('speaks the user\'s own queued start once, and a watched failure as an alert', async () => {
    state.jobs['job-1'] = makeFragment({ status: 'QUEUED', startedAt: null, steps: [{ key: 'refresh', state: 'PENDING', done: null, total: null }, { key: 'preview', state: 'PENDING', done: null, total: null }], queue: { position: 2, maxConcurrent: 3, expiresAt: '2026-11-13T14:32:00.000Z' } });
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('is waiting for a free place. Number 2 in line'));
    state.jobs['job-1'] = makeFragment({ status: 'FAILED', reasonCode: 'NO_PROVIDER_REACHABLE', finishedAt: '2026-11-13T14:05:00.000Z' });
    await waitFor(() => expect(screen.getByTestId('job-announcer-alert')).toHaveTextContent('failed.'), { timeout: 6000 });
  }, 10_000);
});

describe('JobProgressHost: Retry', () => {
  const failed = () => makeFragment({ status: 'FAILED', reasonCode: 'NO_PROVIDER_REACHABLE', canRetry: true, finishedAt: '2026-11-13T14:05:00.000Z' });
  const open = async (props: React.ComponentProps<typeof Harness> = {}) => {
    state.jobs['job-1'] = failed();
    render(ui(props));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    return screen.findByRole('button', { name: 'Retry' });
  };

  it('is offered only when the server says canRetry', async () => {
    state.jobs['job-1'] = makeFragment({ status: 'FAILED', reasonCode: 'ACCOUNT_NOT_FOUND', canRetry: false });
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByTestId('job-failed-box');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('STARTED moves to the new job and announces "Started again."; the click is tracked with the code only', async () => {
    state.jobs['job-2'] = makeFragment({ id: 'job-2' });
    state.retry = { outcome: 'STARTED', errorCode: null, job: makeFragment({ id: 'job-2' }) };
    await userEvent.click(await open());
    expect(capture).toHaveBeenCalledWith('job_retry_clicked', { jobType: 'REEXTRACT_REFRESH', reasonCode: 'NO_PROVIDER_REACHABLE' });
    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(log.find((l) => l.operation === 'RetryJob')?.variables).toEqual({ jobId: 'job-1' });
    await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('Started again.'));
  });

  it('REUSED moves to the existing job and says it is already running', async () => {
    state.jobs['job-3'] = makeFragment({ id: 'job-3' });
    state.retry = { outcome: 'REUSED', errorCode: null, job: makeFragment({ id: 'job-3' }) };
    await userEvent.click(await open());
    await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('This is already running.'));
  });

  it('queue full: the message with a link to Jobs', async () => {
    state.retry = { outcome: 'REFUSED', errorCode: 'JOB_QUEUE_FULL', maxQueued: 10, job: null };
    await userEvent.click(await open());
    const box = await screen.findByTestId('job-retry-failure');
    expect(box).toHaveTextContent('Too many jobs are waiting (10).');
    expect(within(box).getByRole('link', { name: 'Open Jobs' })).toHaveAttribute('href', '/jobs');
  });

  it('cap refused: renders the cap notice slot with the numbers (the notice itself is Story 10.3a\'s)', async () => {
    state.retry = { outcome: 'REFUSED', errorCode: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap: 5, job: null };
    await userEvent.click(await open({ renderCapNotice: true }));
    expect(await screen.findByTestId('cap-slot')).toHaveTextContent('cap 5');
  });

  it('any other refusal or a thrown error reads as the generic message', async () => {
    state.retry = { outcome: 'REFUSED', errorCode: 'JOB_START_FAILED', job: null };
    const button = await open();
    await userEvent.click(button);
    expect(await screen.findByTestId('job-retry-failure')).toHaveTextContent('Something went wrong on our side');
    state.retry = new Error('network');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(log.filter((l) => l.operation === 'RetryJob')).toHaveLength(2));
    expect(screen.getByTestId('job-retry-failure')).toHaveTextContent('Something went wrong on our side');
  });

  it('cooldown: "Retry at {time}", aria-disabled, and a click does nothing', async () => {
    state.jobs['job-1'] = makeFragment({ status: 'FAILED', reasonCode: 'COOLDOWN', canRetry: true, retryNotBefore: new Date(Date.now() + 3_600_000).toISOString(), reasonRetryAfter: new Date(Date.now() + 3_600_000).toISOString(), finishedAt: '2026-11-13T14:05:00.000Z' });
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    const button = await screen.findByTestId('job-retry');
    expect(button).toHaveTextContent(/^Retry at /);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(log.some((l) => l.operation === 'RetryJob')).toBe(false);
  });
});
