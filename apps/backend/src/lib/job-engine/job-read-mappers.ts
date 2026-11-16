import {
  REEXTRACT_POST_JOB_TYPE,
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
import { REEXTRACT_IMAGE_ROLES, REEXTRACT_IMAGE_STATES, REEXTRACT_REFRESH_OUTCOMES, type ReextractImageRole, type ReextractImageState, type ReextractRefreshOutcome } from '@festgrid/domain/posts';
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
  // Story 10.6a -- the refresh report's named paths (moderator reads of a `refresh` selection only)
  refreshSaved?: string | null;
  refreshLateResultPending?: string | null;
  refreshExpiredLinks?: string | null;
  resultImagesAvailable?: string | null;
  resultImagesSent?: string | null;
  resultImageCap?: string | null;
  /** The stored `images` array as the driver returned it (parsed, or its JSON text): never trusted, copied field by field. */
  resultImages?: unknown;
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
  /** The slide cap an old preview (no `imageCap` stored) is reported with. */
  defaultPreviewImageCap: number;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The most image entries one report carries (a post lists a cover and a few dozen slides at most): a hostile array cannot grow the response. */
export const MAX_REFRESH_REPORT_IMAGES = 100;

export interface JobRefreshImage {
  position: number;
  role: ReextractImageRole;
  state: ReextractImageState;
}

export interface JobRefreshReportView {
  outcome: ReextractRefreshOutcome;
  saved: boolean;
  lateResultPending: boolean;
  retryAfter: Date | null;
  expiredLinks: number;
  images: JobRefreshImage[];
  imagesAvailable: number;
  imagesRead: number;
  previewImageCap: number;
}

function nonNegativeInt(value: string | null | undefined): number | null {
  if (value === null || value === undefined || !/^\d{1,9}$/.test(value)) return null;
  return Number(value);
}

/** The stored `images` copied field by field: an entry with an unknown role or state, a bad position or any other shape is dropped, and the list is bounded. */
export function mapRefreshImages(stored: unknown): JobRefreshImage[] {
  let list = stored;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const images: JobRefreshImage[] = [];
  for (const entry of list.slice(0, MAX_REFRESH_REPORT_IMAGES)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { position, role, state } = entry as { position?: unknown; role?: unknown; state?: unknown };
    if (typeof position !== 'number' || !Number.isInteger(position) || position < 0 || position > 10_000) continue;
    if (!REEXTRACT_IMAGE_ROLES.includes(role as ReextractImageRole) || !REEXTRACT_IMAGE_STATES.includes(state as ReextractImageState)) continue;
    images.push({ position, role: role as ReextractImageRole, state: state as ReextractImageState });
  }
  return images;
}

/**
 * Story 10.6a (AC1, AC2) -- `Job.refresh`: the refresh report of a Re-extract job for a moderator, built only from the named paths of the
 * row. Null for any other viewer, any other job type, a job that has not run its refresh phase and an outcome this build does not know.
 */
export function mapRefreshReport(row: JobRowProjection, ctx: JobMapContext): JobRefreshReportView | null {
  if (!ctx.viewer.isModerator || !ctx.requested.has('refresh') || row.type !== REEXTRACT_POST_JOB_TYPE) return null;
  const outcome = REEXTRACT_REFRESH_OUTCOMES.find((known) => known === row.refreshOutcome);
  if (!outcome) return null;
  const images = mapRefreshImages(row.resultImages);
  const imagesAvailable = nonNegativeInt(row.resultImagesAvailable) ?? 0;
  const imagesRead = nonNegativeInt(row.resultImagesSent) ?? 0;
  return {
    outcome,
    saved: row.refreshSaved === 'true',
    lateResultPending: row.refreshLateResultPending === 'true',
    retryAfter: outcome === 'COOLDOWN' ? parseDate(row.refreshRetryAfter) : null,
    expiredLinks: nonNegativeInt(row.refreshExpiredLinks) ?? 0,
    images,
    imagesAvailable,
    imagesRead,
    previewImageCap: nonNegativeInt(row.resultImageCap) ?? ctx.defaultPreviewImageCap,
  };
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
    refresh: mapRefreshReport(row, ctx),
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
