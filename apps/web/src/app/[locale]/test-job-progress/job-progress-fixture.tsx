'use client';

import React, { useState } from 'react';
import { JobProgressDialog, JobProgressView, type JobProgressJob } from '@festgrid/ui';
import { JobRetryFailureNotice } from '@/features/jobs/job-retry-failure-notice';
import { useJobLabels } from '@/features/jobs/use-job-labels';
import { Link } from '@/i18n/navigation';

const LONG_HANDLE = 'a_very_long_account_handle_that_has_no_break_points_at_all_1234567890';

const base: JobProgressJob = {
  id: 'fixture-job',
  type: 'SUBSCRIBE',
  status: 'RUNNING',
  isCancelled: false,
  reasonCode: null,
  createdAt: '2026-11-13T13:59:00.000Z',
  startedAt: '2026-11-13T14:00:00.000Z',
  finishedAt: null,
  completedAfterDeadline: false,
  steps: [
    { key: 'lookup', state: 'DONE' },
    { key: 'classify', state: 'CURRENT' },
    { key: 'firstPosts', state: 'PENDING' },
  ],
  queue: null,
  waiting: null,
  outcome: null,
  canRetry: false,
  retryNotBefore: null,
};

const running: JobProgressJob = base;
// The tallest state: a failed job with a reason, the three steps, Retry, a result link and a refusal notice.
const failed: JobProgressJob = {
  ...base,
  status: 'FAILED',
  reasonCode: 'NO_PROVIDER_REACHABLE',
  finishedAt: '2026-11-13T14:02:00.000Z',
  canRetry: true,
  steps: [
    { key: 'lookup', state: 'DONE' },
    { key: 'classify', state: 'DONE' },
    { key: 'firstPosts', state: 'CURRENT' },
  ],
};

/** Fixed jobs, shown in the real dialog and the real view, so the matrix measures the shipped shapes. */
export function JobProgressFixture() {
  const { labels, format } = useJobLabels();
  const [which, setWhich] = useState<'running' | 'failed' | null>(null);
  const job = which === 'failed' ? failed : running;
  const title = `Adding an account: @${LONG_HANDLE}`;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">Job progress fixture</h1>
      <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => setWhich('running')}>
        Open running job
      </button>
      <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => setWhich('failed')}>
        Open failed job
      </button>
      <JobProgressDialog
        open={which !== null}
        ended={which === 'failed'}
        title={title}
        labels={{ description: 'You can minimize this and keep using the app.', minimize: 'Minimize', close: 'Close' }}
        onMinimize={() => setWhich(null)}
        onClose={() => setWhich(null)}
        footerLinks={
          <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center text-sm font-medium underline">
            See all in Jobs
          </Link>
        }
      >
        <JobProgressView
          state="ready"
          job={job}
          labels={labels}
          format={format}
          form="dialog"
          now={Date.parse('2026-11-13T14:01:20.000Z')}
          onRetry={() => undefined}
          resultAction={
            <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center text-sm font-medium underline">
              Open the account
            </Link>
          }
          notice={which === 'failed' ? <JobRetryFailureNotice failure={{ kind: 'queue-full', maxQueued: 10 }} /> : null}
        />
      </JobProgressDialog>
    </div>
  );
}
