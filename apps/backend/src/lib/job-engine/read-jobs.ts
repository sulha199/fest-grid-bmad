import { and, asc, count, desc, eq, gte, inArray, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { GraphQLError, type GraphQLResolveInfo } from 'graphql';
import { jobAttempts, jobs, posts, socialMediaAccountProfiles, users } from '@festgrid/database';
import { activeOnly, buildOptimizedDrizzleSelect, getRequestedFieldNames } from '@festgrid/graphql-select';
import {
  JOB_TERMINAL_STATUSES,
  getJobTypePresentation,
  jobHistoryCutoff,
  listEngineTypesForGraphqlType,
  listRegisteredPresentationTypes,
  queuePosition,
  type JobGraphqlType,
} from '@festgrid/domain/jobs';
import { parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import {
  mapJobRow,
  type JobAccountLookup,
  type JobAttemptLookup,
  type JobPageLookups,
  type JobRowProjection,
  type JobView,
} from './job-read-mappers.js';

// Story 10.4 (Part A; PRD 3.18 FR123, FR130; AD-7, AD-53) -- the read layer behind `Query.job`, `Query.myJobs`, `Query.activeJobs` and
// the `job` of `retryJob`. The resolvers (inline in `resolvers.ts`, each with `requireAuth` first) call these functions.
//
// What this file guarantees, and where the tests pin it (`jobs-read-api.test.ts`):
//  - Scope: an ordinary user sees only their own USER jobs; a moderator may widen it (`ALL_USERS`, `includeSystem`). A job the viewer
//    may not see reads as no job at all.
//  - No leak (AC5): `jobs.input` and `jobs.result_data` are read ONLY through the named JSON paths of `JobRowProjection` (a held caption
//    and the preview live in them), never whole; `error_message` only for a moderator who asked for `moderatorDetails`.
//  - No unrequested work: attempts, owner names, queue positions and subject lookups run only when the client selected them, one batched
//    query per page (no per-row query).
//  - Retention (FR123, owner override 2026-11-13: hide-only): a finished job older than `JOBS_HISTORY_RETENTION_DAYS` is hidden from every
//    read. Nothing is deleted anywhere.

export const MY_JOBS_DEFAULT_PAGE_SIZE = 20;
export const MY_JOBS_MAX_PAGE_SIZE = 50;
export const ACTIVE_JOBS_LIMIT = 50;
export const ENDED_WITHIN_MAX_MINUTES = 60;

export interface JobViewer {
  userId: string;
  role: 'user' | 'moderator';
}

export interface JobsFilterInput {
  scope?: 'MINE' | 'ALL_USERS' | null;
  includeSystem?: boolean | null;
}

export interface JobSubjectFilterInput {
  type: JobGraphqlType;
  postId?: string | null;
  postUrlKey?: string | null;
  accountId?: string | null;
}

/** Where the `Job` selection sits under the resolver's own field (`undefined` for `job` and `activeJobs`, `edges.node` for `myJobs`). */
export interface JobReadRequest {
  info: GraphQLResolveInfo;
  path?: string;
}

// drizzle writes a jsonb object through postgres.js as a jsonb STRING holding the JSON text (project-context: the `events.links` trap), so
// a path read must unwrap with `#>> '{}'` first; the unwrap also works on a real object. Same helper shape as the sweep's.
const inputJson = sql`(${jobs.input} #>> '{}')::jsonb`;
const resultJson = sql`(${jobs.resultData} #>> '{}')::jsonb`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_STATUSES = ['QUEUED', 'RUNNING', 'WAITING'] as const;

/** `scope: ALL_USERS` and `includeSystem: true` need a moderator (the check after the resolver's top-level `requireAuth`). */
export function assertJobsFilterAllowed(viewer: JobViewer, filter: JobsFilterInput | null | undefined): void {
  if (viewer.role === 'moderator') return;
  if (filter?.scope === 'ALL_USERS' || filter?.includeSystem === true) {
    throw new GraphQLError('You must be a moderator to perform this action.', { extensions: { code: 'FORBIDDEN' } });
  }
}

/** Which rows the viewer may see. */
function visibleToViewer(viewer: JobViewer, filter: JobsFilterInput | null | undefined): SQL {
  const includeSystem = viewer.role === 'moderator' && filter?.includeSystem === true;
  const allUsers = viewer.role === 'moderator' && filter?.scope === 'ALL_USERS';
  const mine = eq(jobs.ownerUserId, viewer.userId);
  const userJobs = eq(jobs.trigger, 'USER');
  const system = eq(jobs.trigger, 'SYSTEM');
  if (allUsers) return (includeSystem ? sql`true` : userJobs) as SQL;
  return (includeSystem ? or(and(mine, userJobs), system) : and(mine, userJobs)) as SQL;
}

/** A finished job older than the retention is hidden (never deleted). */
export function withinRetention(now: Date): SQL {
  const cutoff = jobHistoryCutoff(now, loadBackendEnv().jobsHistoryRetentionDays);
  // A terminal job with no finished_at is measured from created_at, so it cannot stay visible forever.
  return or(notInArray(jobs.status, [...JOB_TERMINAL_STATUSES]), sql`coalesce(${jobs.finishedAt}, ${jobs.createdAt}) >= ${cutoff.toISOString()}::timestamptz`) as SQL;
}

/**
 * The only `jobs` columns the optimized select may contribute. `getRequestedFieldNames` reads ALIAS names, so `job(id) { input: id }`
 * would make `buildOptimizedDrizzleSelect` take the whole `input` column; keeping only these names closes that. Aliased derived fields
 * are not supported (the generated web client never aliases).
 */
const PLAIN_JOB_COLUMNS = new Set(['id', 'type', 'trigger', 'status', 'reasonCode', 'createdAt', 'finishedAt', 'deadlineAt', 'completedAfterDeadline']);

/**
 * The columns to read. The plain columns come from `buildOptimizedDrizzleSelect` (only what the client selected); the dependency columns
 * the derived fields need and the named JSON paths are added by hand. `input`, `result_data` and `error_message` are never taken through
 * the optimized select (no `Job` field has those names) and `error_message` is added only for a moderator who asked for it.
 */
function buildJobSelect(request: JobReadRequest, viewer: JobViewer) {
  const requested = getRequestedFieldNames(request.info, request.path);
  const select: Record<string, PgColumn | SQL> = {
    ...Object.fromEntries(Object.entries(buildOptimizedDrizzleSelect(jobs, request.info, { path: request.path })).filter(([name]) => PLAIN_JOB_COLUMNS.has(name))),
    id: jobs.id,
    type: jobs.type,
    trigger: jobs.trigger,
    status: jobs.status,
    ownerUserId: jobs.ownerUserId,
    reasonCode: jobs.reasonCode,
    // the derived status, `startedAt` and "has it started" all read the admission time
    admittedAt: jobs.admittedAt,
  };
  const wants = (...fields: string[]) => fields.some((field) => requested.has(field));

  if (wants('steps')) {
    select.phase = jobs.phase;
    select.refreshOutcome = sql<string | null>`${resultJson} #>> '{refresh,outcome}'`;
  }
  // Story 10.6a (AC1, AC2) -- the refresh report: moderator-only, and only when the client selected `refresh`. Named paths of `result_data`
  // only (never the column whole, never a caption, an image link or the preview); the mapper copies them field by field.
  if (viewer.role === 'moderator' && wants('refresh')) {
    select.refreshOutcome = sql<string | null>`${resultJson} #>> '{refresh,outcome}'`;
    select.refreshSaved = sql<string | null>`${resultJson} #>> '{refresh,saved}'`;
    select.refreshLateResultPending = sql<string | null>`${resultJson} #>> '{refresh,lateResultPending}'`;
    select.refreshRetryAfter = sql<string | null>`${resultJson} #>> '{refresh,retryAfter}'`;
    select.refreshExpiredLinks = sql<string | null>`${resultJson} #>> '{refresh,expiredLinks}'`;
    select.resultImagesAvailable = sql<string | null>`${resultJson} #>> '{imagesAvailable}'`;
    select.resultImagesSent = sql<string | null>`${resultJson} #>> '{imagesSent}'`;
    select.resultImageCap = sql<string | null>`${resultJson} #>> '{imageCap}'`;
    select.resultImages = sql<unknown>`${resultJson} #> '{images}'`;
  }
  if (wants('queue')) {
    select.queuedSince = jobs.queuedSince;
    select.createdAt = jobs.createdAt;
  }
  if (wants('waiting')) select.resumeAt = jobs.resumeAt;
  if (wants('outcome')) {
    select.finishedAt = jobs.finishedAt;
    select.previewApplied = sql<boolean>`(${resultJson} ->> 'appliedAt') is not null`;
  }
  if (wants('canRetry', 'retryNotBefore', 'reasonRetryAfter')) {
    select.refreshRetryAfter = sql<string | null>`${resultJson} #>> '{refresh,retryAfter}'`;
  }
  if (wants('subject')) {
    select.inputPostId = sql<string | null>`${inputJson} ->> 'postId'`;
    select.inputUrl = sql<string | null>`${inputJson} ->> 'url'`;
    select.inputAccountId = sql<string | null>`${inputJson} ->> 'accountId'`;
    select.inputPostCount = sql<number | null>`case when jsonb_typeof(${inputJson} -> 'postIds') = 'array' then jsonb_array_length(${inputJson} -> 'postIds') end`;
  }
  if (viewer.role === 'moderator' && wants('moderatorDetails')) select.errorMessage = jobs.errorMessage;
  return { select, requested };
}

async function loadAccounts(ids: string[]): Promise<Map<string, JobAccountLookup>> {
  const valid = [...new Set(ids.filter((id) => UUID_PATTERN.test(id)))];
  if (valid.length === 0) return new Map();
  const rows = await db
    .select({
      id: socialMediaAccountProfiles.id,
      platform: socialMediaAccountProfiles.platform,
      username: socialMediaAccountProfiles.username,
      displayName: socialMediaAccountProfiles.displayName,
      profileImageUrl: socialMediaAccountProfiles.profileImageUrl,
    })
    .from(socialMediaAccountProfiles)
    .where(inArray(socialMediaAccountProfiles.id, valid));
  return new Map(rows.map((row) => [row.id, row]));
}

/** A post is identified by its public short code only (never its URL, caption or image). */
async function loadPostCodes(ids: string[]): Promise<Map<string, string | null>> {
  const valid = [...new Set(ids.filter((id) => UUID_PATTERN.test(id)))];
  if (valid.length === 0) return new Map();
  const rows = await db.select({ id: posts.id, platformPostId: posts.platformPostId }).from(posts).where(inArray(posts.id, valid));
  return new Map(rows.map((row) => [row.id, row.platformPostId]));
}

/** One query for every owner that has a QUEUED row on the page; the position is the domain's `queuePosition` over that owner's queue. */
async function loadQueuePositions(queuedRows: JobRowProjection[]): Promise<Map<string, number>> {
  const owners = [...new Set(queuedRows.map((row) => row.ownerUserId).filter((id): id is string => id !== null))];
  const positions = new Map<string, number>();
  if (owners.length === 0) return positions;
  const waiting = await db
    .select({ id: jobs.id, ownerUserId: jobs.ownerUserId, queuedSince: sql<Date>`coalesce(${jobs.queuedSince}, ${jobs.createdAt})` })
    .from(jobs)
    .where(and(inArray(jobs.ownerUserId, owners), eq(jobs.status, 'QUEUED'), isNull(jobs.admittedAt)));
  for (const row of queuedRows) {
    const queue = waiting
      .filter((job) => job.ownerUserId === row.ownerUserId)
      .map((job) => ({ id: job.id, queuedSince: new Date(job.queuedSince) }));
    const position = queuePosition(row.id, queue);
    if (position !== null) positions.set(row.id, position);
  }
  return positions;
}

async function loadOwnerNames(ids: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  // activeOnly: a soft-deleted user reads as no owner label at all
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(and(inArray(users.id, unique), activeOnly(users)));
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function loadAttempts(jobIds: string[]): Promise<Map<string, JobAttemptLookup[]>> {
  const result = new Map<string, JobAttemptLookup[]>();
  if (jobIds.length === 0) return result;
  const rows = await db
    .select({
      jobId: jobAttempts.jobId,
      provider: jobAttempts.provider,
      outcome: jobAttempts.outcome,
      budgetMs: jobAttempts.budgetMs,
      elapsedMs: jobAttempts.elapsedMs,
      reasonCode: jobAttempts.reasonCode,
    })
    .from(jobAttempts)
    .where(inArray(jobAttempts.jobId, jobIds))
    .orderBy(asc(jobAttempts.createdAt), asc(jobAttempts.id));
  for (const row of rows) {
    const list = result.get(row.jobId) ?? [];
    list.push(row);
    result.set(row.jobId, list);
  }
  return result;
}

function postCodeFromUrl(url: string): string | null {
  return parsePlatformPostIdentity({ postUrl: url, originalPostUrl: null }).platformPostId;
}

async function toJobViews(rows: JobRowProjection[], viewer: JobViewer, requested: ReadonlySet<string>, now: Date): Promise<JobView[]> {
  if (rows.length === 0) return [];
  const wantsSubject = requested.has('subject');
  const kindOf = (row: JobRowProjection) => getJobTypePresentation(row.type).subjectKind;
  const accountRows = wantsSubject ? rows.filter((row) => kindOf(row) === 'ACCOUNT' && row.inputAccountId) : [];
  const postRows = wantsSubject ? rows.filter((row) => kindOf(row) === 'POST' && row.inputPostId) : [];
  const queuedRows = requested.has('queue') ? rows.filter((row) => row.status === 'QUEUED' && (row.admittedAt ?? null) === null) : [];
  const ownerIds = viewer.role === 'moderator' && requested.has('owner') ? rows.map((row) => row.ownerUserId).filter((id): id is string => id !== null) : [];
  const attemptIds = viewer.role === 'moderator' && requested.has('moderatorDetails') ? rows.map((row) => row.id) : [];

  const [accounts, postCodes, queuePositions, ownerNames, attempts] = await Promise.all([
    loadAccounts(accountRows.map((row) => row.inputAccountId as string)),
    loadPostCodes(postRows.map((row) => row.inputPostId as string)),
    loadQueuePositions(queuedRows),
    loadOwnerNames(ownerIds),
    loadAttempts(attemptIds),
  ]);
  const lookups: JobPageLookups = { accounts, postCodes, queuePositions, ownerNames, attempts, postCodeFromUrl };
  const env = loadBackendEnv();
  const context = { viewer: { userId: viewer.userId, isModerator: viewer.role === 'moderator' }, now, maxConcurrent: env.maxConcurrentJobsPerUser, queueMaxWaitMinutes: env.jobQueueMaxWaitMinutes, lookups, requested, defaultPreviewImageCap: env.maxReextractCarouselImages };
  return rows.map((row) => mapJobRow(row, context));
}

/** `Query.job`: null for a missing id, someone else's job, a system job (ordinary user) or a job past retention. */
export async function readJobById(viewer: JobViewer, id: string, request: JobReadRequest, now: Date = new Date()): Promise<JobView | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const { select, requested } = buildJobSelect(request, viewer);
  // A moderator may open any job by id (a SYSTEM job and another user's included); everyone else only their own USER jobs.
  const scope = viewer.role === 'moderator' ? sql`true` : visibleToViewer(viewer, null);
  const [row] = await db
    .select(select)
    .from(jobs)
    .where(and(eq(jobs.id, id), scope, withinRetention(now)))
    .limit(1);
  if (!row) return null;
  const [view] = await toJobViews([row as unknown as JobRowProjection], viewer, requested, now);
  return view;
}

export interface MyJobsArgs {
  filter?: JobsFilterInput | null;
  onlyEnded?: boolean | null;
  first?: number | null;
  offset: number;
}

export function clampPageSize(first: number | null | undefined): number {
  if (first === null || first === undefined || !Number.isFinite(first)) return MY_JOBS_DEFAULT_PAGE_SIZE;
  return Math.min(MY_JOBS_MAX_PAGE_SIZE, Math.max(1, Math.trunc(first)));
}

/**
 * `Query.myJobs`: newest first, `ORDER BY created_at DESC, id DESC` (the unique key last). Reads one row more than the page to know whether
 * another page exists; the resolver builds the cursors (the position after each row) and counts only when `totalCount` was selected.
 */
export async function readMyJobsPage(
  viewer: JobViewer,
  args: MyJobsArgs,
  request: JobReadRequest,
  options: { wantsTotal: boolean },
  now: Date = new Date()
): Promise<{ jobs: JobView[]; hasNextPage: boolean; totalCount: number }> {
  const pageSize = clampPageSize(args.first);
  const { select, requested } = buildJobSelect(request, viewer);
  const where = and(
    visibleToViewer(viewer, args.filter),
    withinRetention(now),
    args.onlyEnded ? inArray(jobs.status, [...JOB_TERMINAL_STATUSES]) : undefined
  );
  const rows = await db
    .select(select)
    .from(jobs)
    .where(where)
    .orderBy(desc(jobs.createdAt), desc(jobs.id))
    .limit(pageSize + 1)
    .offset(args.offset);
  const totalCount = options.wantsTotal ? ((await db.select({ count: count() }).from(jobs).where(where))[0]?.count ?? 0) : 0;
  const views = await toJobViews(rows.slice(0, pageSize) as unknown as JobRowProjection[], viewer, requested, now);
  return { jobs: views, hasNextPage: rows.length > pageSize, totalCount };
}

/** `Query.activeJobs`: open jobs (and, with `endedWithinMinutes`, ones that ended inside that window), newest first, at most 50. */
export async function readActiveJobs(
  viewer: JobViewer,
  args: { filter?: JobsFilterInput | null; subject?: JobSubjectFilterInput | null; endedWithinMinutes?: number | null },
  request: JobReadRequest,
  now: Date = new Date()
): Promise<JobView[]> {
  const minutes = Math.min(ENDED_WITHIN_MAX_MINUTES, Math.max(0, Math.trunc(Number.isFinite(args.endedWithinMinutes ?? 0) ? (args.endedWithinMinutes ?? 0) : 0)));
  const subjectConditions = subjectToConditions(args.subject);
  if (subjectConditions === null) return [];

  const { select, requested } = buildJobSelect(request, viewer);
  const open = inArray(jobs.status, [...OPEN_STATUSES]);
  const recentlyEnded =
    minutes > 0 ? and(inArray(jobs.status, [...JOB_TERMINAL_STATUSES]), gte(jobs.finishedAt, new Date(now.getTime() - minutes * 60_000))) : undefined;
  const rows = await db
    .select(select)
    .from(jobs)
    .where(and(visibleToViewer(viewer, args.filter), withinRetention(now), recentlyEnded ? or(open, recentlyEnded) : open, ...subjectConditions))
    .orderBy(desc(jobs.createdAt), desc(jobs.id))
    .limit(ACTIVE_JOBS_LIMIT);
  return toJobViews(rows as unknown as JobRowProjection[], viewer, requested, now);
}

/** The conditions a subject adds, or null when nothing can match (a type no engine type maps to). */
function subjectToConditions(subject: JobSubjectFilterInput | null | undefined): SQL[] | null {
  if (!subject) return [];
  const conditions: SQL[] = [];
  if (subject.type === 'OTHER') {
    conditions.push(notInArray(jobs.type, listRegisteredPresentationTypes()));
  } else {
    const types = listEngineTypesForGraphqlType(subject.type);
    if (types.length === 0) return null;
    conditions.push(inArray(jobs.type, types));
  }
  if (subject.postId) conditions.push(sql`${inputJson} ->> 'postId' = ${subject.postId}`);
  if (subject.postUrlKey) conditions.push(eq(jobs.inputKey, subject.postUrlKey));
  if (subject.accountId) conditions.push(sql`${inputJson} ->> 'accountId' = ${subject.accountId}`);
  return conditions;
}
