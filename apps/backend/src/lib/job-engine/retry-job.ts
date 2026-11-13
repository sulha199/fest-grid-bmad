import { and, eq, sql } from 'drizzle-orm';
import { GraphQLError, type GraphQLResolveInfo } from 'graphql';
import { jobs } from '@festgrid/database';
import { decideJobRetry } from '@festgrid/domain/jobs';
import { getRequestedFieldNames } from '@festgrid/graphql-select';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { getJobRetryStarter, hasJobRetryStarter } from './job-retry-registry.js';
import { readJobById, type JobViewer } from './read-jobs.js';
import type { JobView } from './job-read-mappers.js';

// Story 10.4 (AC8; Dev Notes decision 6; PRD FR123) -- Retry: a NEW job for the same input through the type's own start path (the registry,
// `job-retry-registry.ts`), so reuse, admission, cooldown, the subscription cap and the slot rules are the ones that type already has.
// Owner only (another user's job and a missing one are both NOT_FOUND). A job that is not retryable is BAD_REQUEST; a COOLDOWN ending
// whose time has not come is a REFUSED / COOLDOWN answer with `retryNotBefore`. The old job's input is read here to start the new one and
// never returned. Like the read layer it takes `input` and `result_data` only through named JSON paths, never whole: the identity keys of
// the input (`postId`, `url`, `accountId`, `postIds`) are all a starter gets, so a caption held in `input.held` (AD-40 Rule 9) cannot reach it.

// drizzle writes a jsonb object through postgres.js as a jsonb STRING holding the JSON text (project-context: the `events.links` trap), so
// a path read must unwrap with `#>> '{}'` first; the unwrap also works on a real object. Same helper shape as the sweep's.
const inputJson = sql`(${jobs.input} #>> '{}')::jsonb`;
const resultJson = sql`(${jobs.resultData} #>> '{}')::jsonb`;

export interface RetryJobResultView {
  outcome: 'STARTED' | 'REUSED' | 'REFUSED';
  job: JobView | null;
  errorCode: 'JOB_QUEUE_FULL' | 'SUBSCRIPTION_CAP_REACHED' | 'COOLDOWN' | 'JOB_START_FAILED' | null;
  activeCount: number | null;
  reservedCount: number | null;
  cap: number | null;
  maxQueued: number | null;
  retryNotBefore: Date | null;
}

const refused = (errorCode: NonNullable<RetryJobResultView['errorCode']>, extra: Partial<RetryJobResultView> = {}): RetryJobResultView => ({
  outcome: 'REFUSED',
  job: null,
  errorCode,
  activeCount: null,
  reservedCount: null,
  cap: null,
  maxQueued: null,
  retryNotBefore: null,
  ...extra,
});

export async function retryJob(viewer: JobViewer, jobId: string, info: GraphQLResolveInfo, now: Date = new Date()): Promise<RetryJobResultView> {
  const notFound = () => new GraphQLError('Job not found.', { extensions: { code: 'NOT_FOUND' } });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) throw notFound();

  const [old] = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      reasonCode: jobs.reasonCode,
      inputKey: jobs.inputKey,
      postId: sql<string | null>`${inputJson} ->> 'postId'`,
      url: sql<string | null>`${inputJson} ->> 'url'`,
      accountId: sql<string | null>`${inputJson} ->> 'accountId'`,
      postIds: sql<unknown>`${inputJson} -> 'postIds'`,
      retryAfter: sql<string | null>`${resultJson} #>> '{refresh,retryAfter}'`,
    })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerUserId, viewer.userId), eq(jobs.trigger, 'USER')))
    .limit(1);
  if (!old) throw notFound();

  const retryAfter = old.retryAfter && !Number.isNaN(new Date(old.retryAfter).getTime()) ? new Date(old.retryAfter) : null;
  const identity: Record<string, unknown> = {};
  if (old.postId) identity.postId = old.postId;
  if (old.url) identity.url = old.url;
  if (old.accountId) identity.accountId = old.accountId;
  if (Array.isArray(old.postIds)) identity.postIds = old.postIds;
  const decision = decideJobRetry({
    isOwner: true,
    status: old.status,
    reasonCode: old.reasonCode,
    hasRetryStarter: hasJobRetryStarter(old.type, viewer.role),
    retryAfter,
    now,
  });
  if (!decision.canRetry) {
    throw new GraphQLError('This job cannot be retried.', { extensions: { code: 'BAD_REQUEST' } });
  }
  if (decision.retryNotBefore) {
    return refused('COOLDOWN', { retryNotBefore: decision.retryNotBefore });
  }

  const starter = getJobRetryStarter(old.type)!; // decideJobRetry said a starter exists
  const started = await starter.start({ ownerUserId: viewer.userId, input: identity, inputKey: old.inputKey });
  if (started.outcome === 'REFUSED') {
    return refused(started.errorCode, {
      activeCount: started.details?.activeCount ?? null,
      reservedCount: started.details?.reservedCount ?? null,
      cap: started.details?.cap ?? null,
      maxQueued: started.errorCode === 'JOB_QUEUE_FULL' ? loadBackendEnv().maxQueuedJobsPerUser : null,
    });
  }

  const wantsJob = getRequestedFieldNames(info).has('job');
  return {
    outcome: started.outcome,
    job: wantsJob ? await readJobById(viewer, started.jobId, { info, path: 'job' }, now) : null,
    errorCode: null,
    activeCount: null,
    reservedCount: null,
    cap: null,
    maxQueued: null,
    retryNotBefore: null,
  };
}
