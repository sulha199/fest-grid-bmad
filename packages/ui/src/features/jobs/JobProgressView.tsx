import React from 'react';
import { cn } from '../../lib/utils';
import { JobRetryButton } from './JobRetryButton';
import { JobStatusBadge } from './JobStatusBadge';
import { JobStepper, JobStepperSkeleton } from './JobStepper';
import { getDisplayStatus, getStepProgress, isJobOpen, isStoppedStep, resolveSteps } from './job-display';
import type { JobFormatters, JobProgressJob, JobProgressLabels } from './job-progress.types';

const NOTICE = {
  info: 'rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  limits: 'rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  failed: 'rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  neutral: 'rounded-md border bg-muted p-3 text-sm text-foreground',
  success: 'rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
} as const;

export interface JobProgressViewProps {
  /** `ready` needs `job`. The other three are the loading skeleton, the load error and "not found". */
  state?: 'ready' | 'loading' | 'error' | 'not-found';
  job?: JobProgressJob | null;
  title?: string;
  labels: JobProgressLabels;
  format: JobFormatters;
  /** `dialog`: the title is the DialogTitle outside. `panel`: the title is rendered here as a heading. */
  form?: 'dialog' | 'panel';
  /** `Date.now()` from `useJobClock`, for the running-for text. */
  now?: number;
  /** True while the poll is failing but a last known state is shown ("Reconnecting"). */
  reconnecting?: boolean;
  /** Load error: "Try again". */
  onRetryLoad?: () => void;
  /** Retry the job. Offered only when the server says `canRetry`. */
  onRetry?: () => void;
  retryPending?: boolean;
  /** A result link ("Open the account"), built by the host. */
  resultAction?: React.ReactNode;
  /** Filled by Story 10.3a (cap notice) or a refusal message; rendered under the outcome box. */
  notice?: React.ReactNode;
  /** The not-found link back to Jobs. */
  notFoundAction?: React.ReactNode;
  className?: string;
}

function reasonText(job: JobProgressJob, labels: JobProgressLabels, format: JobFormatters): string {
  const iso = job.reasonRetryAfter ?? job.retryNotBefore;
  return labels.reason(job.reasonCode, {
    time: iso ? format.time(iso) : undefined,
    minutes: job.reasonQueueMaxWaitMinutes ?? undefined,
  });
}

/** Loading skeleton: a title bar and three stepper rows, the heights of the real ones. */
export function JobProgressSkeleton({ form = 'dialog' }: { form?: 'dialog' | 'panel' }) {
  return (
    <div className="space-y-4" aria-hidden="true" data-testid="job-progress-skeleton">
      {form === 'panel' && <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />}
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <JobStepperSkeleton rows={3} />
    </div>
  );
}

export function JobProgressView({
  state = 'ready',
  job,
  title,
  labels,
  format,
  form = 'dialog',
  now,
  reconnecting = false,
  onRetryLoad,
  onRetry,
  retryPending,
  resultAction,
  notice,
  notFoundAction,
  className,
}: JobProgressViewProps) {
  if (state === 'loading') {
    return (
      <div className={className} role="status" aria-busy="true">
        <JobProgressSkeleton form={form} />
      </div>
    );
  }
  if (state === 'error' || (state === 'ready' && !job)) {
    return (
      <div className={cn(NOTICE.failed, 'space-y-2', className)} role="alert" data-testid="job-load-error">
        <p>{labels.loadError}</p>
        {onRetryLoad && (
          <button type="button" className="min-h-11 rounded-md border px-3 text-sm font-medium" onClick={onRetryLoad}>
            {labels.tryAgain}
          </button>
        )}
      </div>
    );
  }
  if (state === 'not-found') {
    return (
      <div className={cn('space-y-2', className)} data-testid="job-not-found">
        <p className="text-sm">{labels.notFound}</p>
        {notFoundAction}
      </div>
    );
  }

  const j = job as JobProgressJob;
  const status = getDisplayStatus(j);
  const open = isJobOpen(j);
  const steps = resolveSteps(j);
  const progress = getStepProgress(j);
  const items = steps.map((step) => ({ step, label: labels.phase(j.type, step.key), stopped: isStoppedStep(j, step), stoppedWord: labels.status[status] }));
  const startMs = j.startedAt ? new Date(j.startedAt).getTime() : NaN;
  const endMs = j.finishedAt ? new Date(j.finishedAt).getTime() : NaN;
  const tookMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : null;
  const runningMs = j.status === 'RUNNING' && Number.isFinite(startMs) && now !== undefined ? now - startMs : null;

  let box: React.ReactNode = null;
  if (j.status === 'QUEUED' && j.queue) {
    box = (
      <div className={cn(NOTICE.info, 'space-y-1')} data-testid="job-queued-box">
        <p className="font-semibold">{labels.queued.title}</p>
        <p>{labels.queued.body(j.queue.maxConcurrent)}</p>
        <p>{labels.queued.position(j.queue.position)}</p>
        <p>{labels.queued.expires(format.time(j.queue.expiresAt))}</p>
      </div>
    );
  } else if (j.status === 'WAITING') {
    const w = j.waiting;
    let line: string;
    if (w?.waitingFor === 'EXTRACTION_QUEUE' && typeof w.total === 'number') {
      line = w.resumeAt ? labels.waiting.extractionRetryAt(format.time(w.resumeAt)) : labels.waiting.extraction(w.done ?? 0, w.total);
    } else if (w?.waitingFor === 'RETRY_AT' && w.resumeAt) {
      line = labels.waiting.retryAt(format.time(w.resumeAt));
    } else {
      line = labels.waiting.result;
    }
    box = (
      <div className={cn(NOTICE.info, 'space-y-1')} data-testid="job-waiting-box">
        <p className="font-semibold">{labels.waiting.title}</p>
        <p>{line}</p>
        <p>{labels.waiting.noPlaceHeld}</p>
      </div>
    );
  } else if (j.status === 'SUCCEEDED') {
    const o = j.outcome;
    box = (
      <div className={cn(NOTICE.success, 'space-y-1')} data-testid="job-succeeded-box">
        <p className="font-semibold">{labels.outcome.succeededTitle}</p>
        {o?.kind === 'EVENTS' && typeof o.eventCount === 'number' && typeof o.postCount === 'number' && <p>{labels.outcome.eventsFromPosts(o.eventCount, o.postCount)}</p>}
        {tookMs !== null && <p>{labels.outcome.took(format.duration(tookMs))}</p>}
        {j.completedAfterDeadline && <p>{labels.outcome.lateResult}</p>}
      </div>
    );
  } else if (j.status === 'SUCCEEDED_WITH_LIMITS') {
    box = (
      <div className={cn(NOTICE.limits, 'space-y-1')} data-testid="job-limits-box">
        <p className="font-semibold">{labels.outcome.limitsTitle}</p>
        <p>{reasonText(j, labels, format)}</p>
        {j.completedAfterDeadline && <p>{labels.outcome.lateResult}</p>}
        {tookMs !== null && <p>{labels.outcome.took(format.duration(tookMs))}</p>}
      </div>
    );
  } else if (status === 'CANCELLED') {
    box = (
      <div className={cn(NOTICE.neutral, 'space-y-1')} data-testid="job-cancelled-box">
        <p className="font-semibold">{labels.outcome.cancelledTitle}</p>
        <p>{reasonText(j, labels, format)}</p>
      </div>
    );
  } else if (j.status === 'FAILED') {
    box = (
      <div className={cn(NOTICE.failed, 'space-y-1')} data-testid="job-failed-box">
        <p className="font-semibold">{labels.outcome.failedTitle}</p>
        <p>{reasonText(j, labels, format)}</p>
      </div>
    );
  } else if (j.status === 'EXPIRED') {
    box = (
      <div className={cn(NOTICE.neutral, 'space-y-1')} data-testid="job-expired-box">
        <p className="font-semibold">{labels.outcome.expiredTitle}</p>
        <p>{reasonText(j, labels, format)}</p>
      </div>
    );
  }

  const showRetry = j.canRetry && !open && onRetry;

  return (
    <div className={cn('min-w-0 space-y-4', className)} data-testid="job-progress-view" data-form={form} data-status={status}>
      {form === 'panel' && title && <h2 className="break-words text-lg font-bold">{title}</h2>}
      <div className="flex flex-wrap items-center gap-2">
        <JobStatusBadge status={status} label={labels.status[status]} />
        {runningMs !== null && <span className="text-xs text-muted-foreground">{labels.elapsed(format.duration(runningMs))}</span>}
        {progress && j.status === 'RUNNING' && <span className="text-xs text-muted-foreground">{labels.stepOf(progress.current, progress.total)}</span>}
      </div>
      {reconnecting && (
        <p className="text-xs text-muted-foreground" data-testid="job-reconnecting">
          {labels.reconnecting}
        </p>
      )}
      {box}
      <JobStepper items={items} labels={labels} />
      {j.status === 'RUNNING' && <p className="text-xs text-muted-foreground">{labels.leavingNote}</p>}
      {notice}
      {(showRetry || resultAction) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {showRetry && <JobRetryButton retryNotBefore={j.retryNotBefore} labels={labels} formatTime={format.time} onRetry={onRetry as () => void} pending={retryPending} />}
          {resultAction}
        </div>
      )}
    </div>
  );
}
