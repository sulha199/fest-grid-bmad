import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobProgressView } from './JobProgressView';
import { JobChip } from './JobChip';
import { JobStepper } from './JobStepper';
import { JobRetryButton } from './JobRetryButton';
import { formatJobDuration, formatJobTime } from './format-job';
import { getChipText } from './JobChip';
import { getDisplayStatus, getJobSignature, getStepProgress, resolveSteps } from './job-display';
import { chipLabels, format, labels, makeJob } from './job-test-fixtures';

afterEach(cleanup);
const view = (job = makeJob(), extra: Partial<React.ComponentProps<typeof JobProgressView>> = {}) => render(<JobProgressView job={job} labels={labels} format={format} {...extra} />);

describe('JobProgressView states (Story 10.4 table)', () => {
  it('loading: a skeleton with three rows and no text', () => {
    view(undefined, { state: 'loading' });
    expect(screen.getByTestId('job-progress-skeleton')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(3);
  });

  it('load error: alert text and a Try again button', async () => {
    const onRetryLoad = vi.fn();
    view(undefined, { state: 'error', onRetryLoad });
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this job.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryLoad).toHaveBeenCalled();
  });

  it('not found: the plain sentence and the host link', () => {
    view(undefined, { state: 'not-found', notFoundAction: <a href="/jobs">Jobs</a> });
    expect(screen.getByText('This job was not found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jobs' })).toBeInTheDocument();
  });

  it('queued: position, the limit and the drop warning, all steps not started', () => {
    view(makeJob({ status: 'QUEUED', startedAt: null, steps: [{ key: 'refresh', state: 'PENDING' }, { key: 'preview', state: 'PENDING' }], queue: { position: 2, maxConcurrent: 3, expiresAt: '2026-11-13T14:32:00.000Z' } }));
    const box = screen.getByTestId('job-queued-box');
    expect(box).toHaveTextContent('Number 2 in line');
    expect(box).toHaveTextContent('You can run 3 at once');
    expect(box).toHaveTextContent('Dropped if not started by T(14:32)');
    expect(screen.getByText('Waiting for a place')).toBeInTheDocument();
    expect(screen.queryByText('Leaving this page does not stop it.')).not.toBeInTheDocument();
  });

  it('running: stepper, "Step 2 of 3", elapsed time and the leaving note', () => {
    view(makeJob({ steps: [{ key: 'a', state: 'DONE' }, { key: 'b', state: 'CURRENT', done: 3, total: 8 }, { key: 'c', state: 'PENDING' }] }), { now: new Date('2026-11-13T14:01:20.000Z').getTime() });
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Running for 80s')).toBeInTheDocument();
    expect(screen.getByText('3 of 8 finished')).toBeInTheDocument();
    expect(screen.getByText('Leaving this page does not stop it.')).toBeInTheDocument();
  });

  it('waiting: retry time, result and extraction forms, and that no place is held', () => {
    const { unmount } = view(makeJob({ status: 'WAITING', waiting: { waitingFor: 'RETRY_AT', resumeAt: '2026-11-13T14:20:00.000Z' } }));
    expect(screen.getByTestId('job-waiting-box')).toHaveTextContent('Waiting to try again at T(14:20).');
    expect(screen.getByTestId('job-waiting-box')).toHaveTextContent('You can start other jobs meanwhile.');
    unmount();
    const r = view(makeJob({ status: 'WAITING', waiting: { waitingFor: 'RESULT_FROM_PROVIDER' } }));
    expect(screen.getByTestId('job-waiting-box')).toHaveTextContent('Waiting for the answer.');
    r.unmount();
    view(makeJob({ status: 'WAITING', waiting: { waitingFor: 'EXTRACTION_QUEUE', done: 3, total: 8 } }));
    expect(screen.getByTestId('job-waiting-box')).toHaveTextContent('Extracting (3 of 8 done).');
  });

  it('succeeded: done, took, events count, and the late-result note', () => {
    view(makeJob({ status: 'SUCCEEDED', finishedAt: '2026-11-13T14:01:20.000Z', completedAfterDeadline: true, outcome: { kind: 'EVENTS', eventCount: 4, postCount: 2 }, steps: [{ key: 'a', state: 'DONE' }] }), { resultAction: <a href="/x">Open the account</a> });
    const box = screen.getByTestId('job-succeeded-box');
    expect(box).toHaveTextContent('Took 80s');
    expect(box).toHaveTextContent('4 events from 2 posts');
    expect(box).toHaveTextContent('The answer arrived late but was still used.');
    expect(screen.getByRole('link', { name: 'Open the account' })).toBeInTheDocument();
  });

  it('succeeded with limits: the reason text comes from the code, never an engine message', () => {
    view(makeJob({ status: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'COOLDOWN', reasonRetryAfter: '2026-11-13T14:42:00.000Z', finishedAt: '2026-11-13T14:01:00.000Z' }));
    expect(screen.getByTestId('job-limits-box')).toHaveTextContent('reason:COOLDOWN@T(14:42)');
  });

  it('failed: red box with the reason, a stopped current step, and Retry only when canRetry', async () => {
    const onRetry = vi.fn();
    const failed = makeJob({ status: 'FAILED', reasonCode: 'NO_PROVIDER_REACHABLE', canRetry: true });
    const { unmount } = view(failed, { onRetry });
    expect(screen.getByTestId('job-failed-box')).toHaveTextContent('reason:NO_PROVIDER_REACHABLE');
    expect(screen.getByText(/stopped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();
    view(makeJob({ ...failed, canRetry: false }), { onRetry });
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('expired and cancelled have their own titles', () => {
    const { unmount } = view(makeJob({ status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', reasonQueueMaxWaitMinutes: 30 }));
    expect(screen.getByTestId('job-expired-box')).toHaveTextContent('Stopped');
    expect(screen.getByTestId('job-expired-box')).toHaveTextContent('reason:WAITED_TOO_LONG/30');
    unmount();
    view(makeJob({ status: 'FAILED', isCancelled: true, reasonCode: 'CANCELLED' }));
    expect(screen.getByTestId('job-cancelled-box')).toHaveTextContent('Cancelled');
    expect(screen.getByTestId('job-status-badge')).toHaveAttribute('data-status', 'CANCELLED');
  });

  it('shows "Reconnecting" and the panel heading', () => {
    view(makeJob(), { reconnecting: true, form: 'panel', title: 'Re-extracting a post' });
    expect(screen.getByTestId('job-reconnecting')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Re-extracting a post' })).toBeInTheDocument();
  });

  it('a job with no steps shows one generic step', () => {
    view(makeJob({ steps: [] }));
    expect(screen.getByText('phase:working')).toBeInTheDocument();
  });
});

describe('JobStepper', () => {
  it('is an ordered list with aria-current on the current step and a hidden state word per item', () => {
    render(<JobStepper labels={labels} items={[{ step: { key: 'a', state: 'DONE' }, label: 'A' }, { step: { key: 'b', state: 'CURRENT' }, label: 'B' }, { step: { key: 'c', state: 'SKIPPED' }, label: 'C' }, { step: { key: 'd', state: 'PENDING' }, label: 'D' }]} />);
    expect(screen.getByRole('list', { name: 'Steps' }).tagName).toBe('OL');
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[0]).toHaveTextContent('(done)');
    expect(items[1]).toHaveTextContent('(in progress)');
    expect(items[2]).toHaveTextContent('(skipped)');
    expect(items[3]).toHaveTextContent('(not started)');
  });

  it('draws a static dot instead of a spinner under prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia;
    render(<JobStepper labels={labels} items={[{ step: { key: 'b', state: 'CURRENT' }, label: 'B' }]} />);
    expect(screen.getByTestId('job-step-static-dot')).toBeInTheDocument();
    expect(screen.queryByTestId('job-step-spinner')).not.toBeInTheDocument();
    window.matchMedia = original;
  });
});

describe('JobChip', () => {
  it.each([
    [makeJob({ status: 'QUEUED', queue: { position: 2, maxConcurrent: 3, expiresAt: '2026-11-13T14:32:00.000Z' } }), 'Waiting for a place (#2)'],
    [makeJob(), 'In progress: step 2 of 2'],
    [makeJob({ steps: [] , status: 'RUNNING' }), 'In progress: step 1 of 1'],
    [makeJob({ status: 'WAITING', waiting: { waitingFor: 'RETRY_AT', resumeAt: '2026-11-13T14:20:00.000Z' } }), 'Waiting until T(14:20)'],
    [makeJob({ status: 'WAITING' }), 'Waiting'],
    [makeJob({ status: 'SUCCEEDED' }), 'Done'],
    [makeJob({ status: 'SUCCEEDED_WITH_LIMITS' }), 'Done, with limits'],
    [makeJob({ status: 'FAILED' }), 'Failed'],
    [makeJob({ status: 'EXPIRED' }), 'Expired'],
    [makeJob({ status: 'FAILED', isCancelled: true }), 'Cancelled'],
  ])('reads %#', (job, text) => {
    expect(getChipText(job, chipLabels, format)).toBe(text);
  });

  it('is a button whose name has title and status, and it opens on click', async () => {
    const onOpen = vi.fn();
    render(<JobChip job={makeJob()} title="Re-extracting a post" labels={chipLabels} statusLabels={labels.status} format={format} onOpen={onOpen} />);
    const chip = screen.getByRole('button', { name: 'Show progress: Re-extracting a post. In progress' });
    expect(chip).toHaveTextContent('In progress: step 2 of 2');
    expect(chip.className).toContain('min-h-11');
    await userEvent.click(chip);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('JobRetryButton cooldown', () => {
  it('reads "Retry at" while cooling down, is aria-disabled, ignores clicks, and enables itself at the time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T14:00:00.000Z'));
    const onRetry = vi.fn();
    render(<JobRetryButton retryNotBefore="2026-11-13T14:00:30.000Z" labels={labels} formatTime={format.time} onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: 'Retry at T(14:00)' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Retry at T(14:00)');
    button.click();
    expect(onRetry).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    const enabled = screen.getByRole('button', { name: 'Retry' });
    expect(enabled).not.toHaveAttribute('aria-disabled');
    enabled.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('is enabled at once for a past or missing retryNotBefore, and blocked while pending', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<JobRetryButton retryNotBefore="2020-01-01T00:00:00.000Z" labels={labels} formatTime={format.time} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Retry' })).not.toHaveAttribute('aria-disabled');
    rerender(<JobRetryButton labels={labels} formatTime={format.time} onRetry={onRetry} pending />);
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('pure helpers', () => {
  it('formats durations and times with Intl', () => {
    expect(formatJobDuration(80_000, 'en-US')).toMatch(/1\s?min.*20\s?(s|sec)/);
    expect(formatJobDuration(0, 'en-US')).toMatch(/0\s?(s|sec)/);
    expect(formatJobDuration(7_500_000, 'en-US')).toMatch(/2\s?h.*5\s?min/);
    expect(formatJobDuration(Number.NaN, 'en-US')).toMatch(/0/);
    const now = new Date('2026-11-13T14:30:00.000Z');
    expect(formatJobTime('2026-11-13T14:02:00.000Z', 'en-US', now, 'UTC')).toMatch(/02:02|2:02/);
    expect(formatJobTime('2026-11-10T14:02:00.000Z', 'en-US', now, 'UTC')).toMatch(/Nov/);
    expect(formatJobTime('2026-11-13T14:02:00.000Z', 'en-US', now, 'Not/AZone')).not.toBe('');
    expect(formatJobTime('garbage', 'en-US')).toBe('');
  });

  it('derives status, steps, progress and the announcer signature', () => {
    expect(getDisplayStatus({ status: 'FAILED', isCancelled: true })).toBe('CANCELLED');
    expect(resolveSteps({ status: 'QUEUED', steps: [] })[0].state).toBe('PENDING');
    expect(resolveSteps({ status: 'SUCCEEDED', steps: [] })[0].state).toBe('DONE');
    expect(getStepProgress(makeJob({ status: 'SUCCEEDED', steps: [{ key: 'a', state: 'DONE' }] }))).toBeNull();
    // queue position is not part of the signature
    const a = makeJob({ status: 'QUEUED', queue: { position: 3, maxConcurrent: 3, expiresAt: 'x' } });
    const b = makeJob({ status: 'QUEUED', queue: { position: 2, maxConcurrent: 3, expiresAt: 'x' } });
    expect(getJobSignature(a)).toBe(getJobSignature(b));
    expect(getJobSignature(makeJob())).not.toBe(getJobSignature(makeJob({ steps: [{ key: 'refresh', state: 'CURRENT' }] })));
  });
});
