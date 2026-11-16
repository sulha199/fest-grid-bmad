/**
 * Story 10.4 Part B -- the data and copy contracts of the shared inline job progress component.
 * `packages/ui` never fetches and never imports next-intl: apps/web passes a job (a projection of the
 * server's `Job`, plain strings so the generated GraphQL enums are accepted) and a `labels` object.
 */

export type JobProgressStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING'
  | 'SUCCEEDED'
  | 'SUCCEEDED_WITH_LIMITS'
  | 'FAILED'
  | 'EXPIRED';

/** What the user sees: a cancelled job is a FAILED one with its own neutral look. */
export type JobDisplayStatus = JobProgressStatus | 'CANCELLED';

export type JobStepStateName = 'DONE' | 'CURRENT' | 'PENDING' | 'SKIPPED';

export interface JobProgressStep {
  key: string;
  state: `${JobStepStateName}`;
  done?: number | null;
  total?: number | null;
}

export interface JobProgressJob {
  id: string;
  type: string;
  status: `${JobProgressStatus}`;
  isCancelled: boolean;
  reasonCode?: string | null;
  reasonRetryAfter?: string | null;
  reasonQueueMaxWaitMinutes?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  completedAfterDeadline: boolean;
  steps: ReadonlyArray<JobProgressStep>;
  queue?: { position: number; maxConcurrent: number; expiresAt: string } | null;
  waiting?: {
    waitingFor: 'RETRY_AT' | 'RESULT_FROM_PROVIDER' | 'EXTRACTION_QUEUE';
    resumeAt?: string | null;
    done?: number | null;
    total?: number | null;
  } | null;
  outcome?: { kind: string; eventCount?: number | null; postCount?: number | null } | null;
  canRetry: boolean;
  retryNotBefore?: string | null;
}

export interface JobFormatters {
  /** A clock time (or date and time when it is not today), already in the viewer's locale. */
  time: (iso: string) => string;
  /** A duration in milliseconds as "1 min 20 s" (Intl.NumberFormat units). */
  duration: (ms: number) => string;
}

export interface JobProgressLabels {
  status: Record<JobDisplayStatus, string>;
  stepsLabel: string;
  stepOf: (current: number, total: number) => string;
  stepState: { done: string; current: string; pending: string; skipped: string; stopped: string };
  countDetail: (done: number, total: number) => string;
  /** The label of a step key for a job type; an unknown key reads as the generic "Working on it". */
  phase: (jobType: string, key: string) => string;
  leavingNote: string;
  elapsed: (duration: string) => string;
  queued: {
    title: string;
    body: (limit: number) => string;
    position: (position: number) => string;
    expires: (time: string) => string;
  };
  waiting: {
    title: string;
    retryAt: (time: string) => string;
    result: string;
    extraction: (done: number, total: number) => string;
    extractionRetryAt: (time: string) => string;
    noPlaceHeld: string;
  };
  outcome: {
    succeededTitle: string;
    limitsTitle: string;
    failedTitle: string;
    expiredTitle: string;
    cancelledTitle: string;
    lateResult: string;
    took: (duration: string) => string;
    eventsFromPosts: (events: number, posts: number) => string;
  };
  /** Plain words for a reason CODE (never the engine message). Unknown codes read as GENERIC. */
  reason: (code: string | null | undefined, params: { time?: string; minutes?: number }) => string;
  retry: string;
  retryAt: (time: string) => string;
  loadError: string;
  tryAgain: string;
  notFound: string;
  reconnecting: string;
}

export interface JobChipLabels {
  ariaLabel: (title: string, status: string) => string;
  queued: (position: number) => string;
  running: (current: number, total: number) => string;
  runningNoSteps: string;
  waiting: string;
  waitingUntil: (time: string) => string;
  done: string;
  doneWithLimits: string;
  failed: string;
  expired: string;
  cancelled: string;
}
