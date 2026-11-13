import type { JobChipLabels, JobFormatters, JobProgressJob, JobProgressLabels } from './job-progress.types';

export const labels: JobProgressLabels = {
  status: { QUEUED: 'Waiting for a place', RUNNING: 'In progress', WAITING: 'Waiting', SUCCEEDED: 'Done', SUCCEEDED_WITH_LIMITS: 'Done, with limits', FAILED: 'Failed', EXPIRED: 'Expired', CANCELLED: 'Cancelled' },
  stepsLabel: 'Steps',
  stepOf: (c, t) => `Step ${c} of ${t}`,
  stepState: { done: 'done', current: 'in progress', pending: 'not started', skipped: 'skipped', stopped: 'stopped' },
  countDetail: (d, t) => `${d} of ${t} finished`,
  phase: (_type, key) => `phase:${key}`,
  leavingNote: 'Leaving this page does not stop it.',
  elapsed: (d) => `Running for ${d}`,
  queued: { title: 'Waiting for a free place', body: (n) => `You can run ${n} at once`, position: (p) => `Number ${p} in line`, expires: (t) => `Dropped if not started by ${t}` },
  waiting: { title: 'Waiting', retryAt: (t) => `Waiting to try again at ${t}.`, result: 'Waiting for the answer.', extraction: (d, t) => `Extracting (${d} of ${t} done).`, extractionRetryAt: (t) => `Retry a post at ${t}.`, noPlaceHeld: 'You can start other jobs meanwhile.' },
  outcome: { succeededTitle: 'Done', limitsTitle: 'Finished with what we had', failedTitle: 'Could not finish', expiredTitle: 'Stopped', cancelledTitle: 'Cancelled', lateResult: 'The answer arrived late but was still used.', took: (d) => `Took ${d}`, eventsFromPosts: (e, p) => `${e} events from ${p} posts` },
  reason: (code, p) => `reason:${code ?? 'none'}${p.time ? `@${p.time}` : ''}${p.minutes ? `/${p.minutes}` : ''}`,
  retry: 'Retry',
  retryAt: (t) => `Retry at ${t}`,
  loadError: 'We could not load this job.',
  tryAgain: 'Try again',
  notFound: 'This job was not found.',
  reconnecting: 'Reconnecting.',
};

export const chipLabels: JobChipLabels = {
  ariaLabel: (t, s) => `Show progress: ${t}. ${s}`,
  queued: (p) => `Waiting for a place (#${p})`,
  running: (c, t) => `In progress: step ${c} of ${t}`,
  runningNoSteps: 'In progress',
  waiting: 'Waiting',
  waitingUntil: (t) => `Waiting until ${t}`,
  done: 'Done',
  doneWithLimits: 'Done, with limits',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const format: JobFormatters = { time: (iso) => `T(${iso.slice(11, 16)})`, duration: (ms) => `${Math.round(ms / 1000)}s` };

export function makeJob(overrides: Partial<JobProgressJob> = {}): JobProgressJob {
  return {
    id: 'job-1',
    type: 'REEXTRACT_REFRESH',
    status: 'RUNNING',
    isCancelled: false,
    reasonCode: null,
    startedAt: '2026-11-13T14:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-11-13T13:59:00.000Z',
    completedAfterDeadline: false,
    steps: [
      { key: 'refresh', state: 'DONE' },
      { key: 'preview', state: 'CURRENT' },
    ],
    canRetry: false,
    ...overrides,
  };
}
