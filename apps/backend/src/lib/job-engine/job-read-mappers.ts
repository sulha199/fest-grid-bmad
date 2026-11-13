import {
  decideJobRetry,
  deriveJobOutcome,
  deriveJobSteps,
  deriveJobWaiting,
  deriveVisibleJobStatus,
  getJobTypePresentation,
  mapJobReasonCode,
  userSafeJobProvider,
  type JobStatus,
  type JobSubjectKind,
} from '@festgrid/domain/jobs';
import { hasJobRetryStarter } from './job-retry-registry.js';

// Story 10.4 (Part A) -- turns a `jobs` row and the batched lookups of one page into the GraphQL `Job`. Pure: no query here. The row
// holds only the named JSON-path projections of `input` and `result_data` (AC5), never the columns whole, so nothing in this file can
// copy a caption, a preview, an image URL or a vendor value into the response.

/** What the read query selected for one job. Every optional is present only when the client (or a derived field) needed it. */
export interface JobRowProjection {
  id: string;
  type: string;
  trigger: 'USER' | 'SYSTEM';
  status: JobStatus;
  ownerUserId: string | null;
  reasonCode?: string | null;
  createdAt?: Date;
  finishedAt?: Date | null;
  deadlineAt?: Date;
  completedAfterDeadline?: boolean;
  phase?: string | null;
  admittedAt?: Date | null;
  queuedSince?: Date | null;
  resumeAt?: Date | null;
  /** Moderators only, and only when `moderatorDetails` was asked for. */
  errorMessage?: string | null;
  // named JSON paths (AC5)
  refreshOutcome?: string | null;
  refreshRetryAfter?: string | null;
  previewApplied?: boolean | null;
  inputPostId?: string | null;
  inputUrl?: string | null;
  inputAccountId?: string | null;
  inputPostCount?: number | null;
}

export interface JobAccountLookup {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface JobAttemptLookup {
  provider: 'APIFY' | 'BRIGHTDATA';
  outcome: 'SUCCEEDED' | 'FAILED' | 'EMPTY' | 'TIMED_OUT' | 'OVER_QUOTA' | 'SKIPPED';
  budgetMs: number;
  elapsedMs: number;
  reasonCode: string | null;
}

/** The batched lookups for a page of jobs, keyed by what the rows point at. */
export interface JobPageLookups {
  accounts: Map<string, JobAccountLookup>;
  /** post id -> the platform's public short code */
  postCodes: Map<string, string | null>;
  /** job id -> 1-based place in its owner's queue */
  queuePositions: Map<string, number>;
  /** user id -> display name (only active users) */
  ownerNames: Map<string, string | null>;
  attempts: Map<string, JobAttemptLookup[]>;
  /** parses a URL's platform post code (injected so this file stays free of scraper imports) */
  postCodeFromUrl: (url: string) => string | null;
}

export interface JobMapContext {
  viewer: { userId: string; isModerator: boolean };
  now: Date;
  maxConcurrent: number;
  queueMaxWaitMinutes: number;
  lookups: JobPageLookups;
  /** the GraphQL fields the client selected (leaf names of `Job`) */
  requested: ReadonlySet<string>;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapSubject(row: JobRowProjection, kind: JobSubjectKind, lookups: JobPageLookups) {
  switch (kind) {
    case 'ACCOUNT': {
      const account = row.inputAccountId ? lookups.accounts.get(row.inputAccountId) : undefined;
      return {
        kind,
        accountId: account?.id ?? null,
        platform: account?.platform ?? null,
        username: account?.username ?? null,
        displayName: account?.displayName ?? null,
        profileImageUrl: account?.profileImageUrl ?? null,
      };
    }
    case 'POSTS':
      return { kind, postCount: row.inputPostCount ?? null };
    case 'POST': {
      const postCode = row.inputPostId ? (lookups.postCodes.get(row.inputPostId) ?? null) : row.inputUrl ? lookups.postCodeFromUrl(row.inputUrl) : null;
      return { kind, postId: row.inputPostId ?? null, postCode };
    }
    default:
      return { kind: 'NONE' as const };
  }
}

/** The GraphQL `Job` for one row. Plain values; the DateTime scalar serializes the `Date`s. */
export function mapJobRow(row: JobRowProjection, ctx: JobMapContext) {
  const { viewer, lookups, requested } = ctx;
  const presentation = getJobTypePresentation(row.type);
  const status = deriveVisibleJobStatus(row.status, row.admittedAt ?? null);
  const reasonCode = mapJobReasonCode(row.reasonCode);
  const refreshRetryAfter = parseDate(row.refreshRetryAfter);
  const isOwner = row.ownerUserId !== null && row.ownerUserId === viewer.userId;
  const hasStarted = (row.admittedAt ?? null) !== null;

  const retry = decideJobRetry({
    isOwner,
    status: row.status,
    reasonCode: row.reasonCode ?? null,
    hasRetryStarter: hasJobRetryStarter(row.type, viewer.isModerator ? 'moderator' : 'user'),
    retryAfter: refreshRetryAfter,
    now: ctx.now,
  });

  const queued = status === 'QUEUED' ? lookups.queuePositions.get(row.id) : undefined;
  const queuedSince = row.queuedSince ?? row.createdAt ?? null;

  const waiting = deriveJobWaiting({ status, resumeAt: row.resumeAt ?? null });
  const outcome = deriveJobOutcome({
    outcomeKind: presentation.outcomeKind,
    status,
    finishedAt: row.finishedAt ?? null,
    previewApplied: row.previewApplied === true,
  });

  const showOwner = viewer.isModerator && requested.has('owner');
  const showDetails = viewer.isModerator && requested.has('moderatorDetails');

  return {
    id: row.id,
    type: presentation.graphqlType,
    trigger: row.trigger,
    status,
    isCancelled: row.status === 'FAILED' && row.reasonCode === 'CANCELLED',
    reasonCode,
    reasonRetryAfter: reasonCode === 'COOLDOWN' ? refreshRetryAfter : null,
    reasonQueueMaxWaitMinutes: reasonCode === 'WAITED_TOO_LONG' ? ctx.queueMaxWaitMinutes : null,
    createdAt: row.createdAt,
    startedAt: row.admittedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    deadlineAt: row.deadlineAt,
    completedAfterDeadline: row.completedAfterDeadline ?? false,
    subject: mapSubject(row, presentation.subjectKind, lookups),
    steps: deriveJobSteps({ presentation, status, phase: row.phase ?? null, hasStarted, facts: { refreshOutcome: row.refreshOutcome ?? null } }),
    queue:
      queued !== undefined && queuedSince !== null
        ? { position: queued, maxConcurrent: ctx.maxConcurrent, expiresAt: new Date(queuedSince.getTime() + ctx.queueMaxWaitMinutes * 60_000) }
        : null,
    waiting,
    outcome,
    canRetry: retry.canRetry,
    retryNotBefore: retry.retryNotBefore,
    owner:
      showOwner && row.ownerUserId !== null && lookups.ownerNames.has(row.ownerUserId)
        ? { displayName: lookups.ownerNames.get(row.ownerUserId) ?? null }
        : null,
    moderatorDetails: showDetails
      ? {
          attempts: (lookups.attempts.get(row.id) ?? []).map((a) => ({
            provider: userSafeJobProvider(a.provider),
            outcome: a.outcome,
            budgetMs: a.budgetMs,
            elapsedMs: a.elapsedMs,
            reasonCode: mapJobReasonCode(a.reasonCode),
          })),
          engineReasonCode: row.reasonCode ?? null,
          engineMessage: row.errorMessage ?? null,
        }
      : null,
  };
}

export type JobView = ReturnType<typeof mapJobRow>;
