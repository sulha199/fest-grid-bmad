import { and, asc, count, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import {
  FOLLOWER_PHASE,
  JOB_TERMINAL_STATUSES,
  computeJobDeadline,
  decideAdmission,
  getJobTypeDefinition,
  type JobTypeDefinition,
} from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { checkSubscriptionCap, lockUserRow, type DbTransaction } from '../subscriptions/subscription-cap.js';

// Story 10.3 (AC1 to AC4, AC7; PRD FR120 to FR122; AD-53) -- THE admission function. `startJob`, `promoteQueuedJobs` and
// `readmitWaitingJob` all decide who may run through the counting helpers and the insert here, never their own.
//
// One transaction holding a row lock on the user (SELECT ... FOR NO KEY UPDATE on `users`), so two simultaneous starts for one
// user are serialized. Inside it, in this order: reuse, the subscription cap, sharing, then the limits.

export type AdmitJobInput = {
  type: string;
  inputKey: string;
  payload?: unknown;
  ownerUserId: string;
  /** For a `reservesSubscriptionSlot` type: the user already holds this account, so no extra slot is needed. */
  alreadyHeldSubscription?: boolean;
};

export type AdmitJobResult =
  | { outcome: 'ADMITTED'; jobId: string }
  | { outcome: 'QUEUED'; jobId: string; position: number }
  | { outcome: 'REUSED'; jobId: string }
  | { outcome: 'SHARED'; jobId: string; leaderJobId: string }
  | { refused: 'JOB_QUEUE_FULL' | 'UNKNOWN_JOB_TYPE' | 'UNKNOWN_USER' }
  | { refused: 'SUBSCRIPTION_CAP_REACHED'; activeCount: number; reservedCount: number; cap: number };

const OPEN_STATUSES_EXCLUDED = [...JOB_TERMINAL_STATUSES];

/** Places the user holds: admitted QUEUED or RUNNING jobs (domain `holdsPlace`). Call after `lockUserRow`. */
export async function countPlacesHeld(tx: DbTransaction, ownerUserId: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerUserId, ownerUserId),
        inArray(jobs.status, ['QUEUED', 'RUNNING']),
        isNotNull(jobs.admittedAt)
      )
    );
  return row?.value ?? 0;
}

/** Jobs of the user waiting for a place (QUEUED, not admitted). Call after `lockUserRow`. */
export async function countQueuedJobs(tx: DbTransaction, ownerUserId: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(jobs)
    .where(and(eq(jobs.ownerUserId, ownerUserId), eq(jobs.status, 'QUEUED'), isNull(jobs.admittedAt)));
  return row?.value ?? 0;
}

/** Postgres unique_violation: the partial unique index `uq_jobs_open_input` caught a duplicate open job (the reuse backstop). */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if ((current as { code?: unknown }).code === '23505') {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function findOpenJobOfOwner(
  tx: DbTransaction | typeof db,
  input: Pick<AdmitJobInput, 'type' | 'inputKey' | 'ownerUserId'>
): Promise<string | undefined> {
  const [existing] = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerUserId, input.ownerUserId),
        eq(jobs.type, input.type),
        eq(jobs.inputKey, input.inputKey),
        notInArray(jobs.status, OPEN_STATUSES_EXCLUDED)
      )
    )
    .orderBy(asc(jobs.createdAt))
    .limit(1);
  return existing?.id;
}

async function findLeader(
  tx: DbTransaction,
  input: Pick<AdmitJobInput, 'type' | 'inputKey' | 'ownerUserId'>
): Promise<string | undefined> {
  const [leader] = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, input.type),
        eq(jobs.inputKey, input.inputKey),
        isNotNull(jobs.ownerUserId),
        sql`${jobs.ownerUserId} <> ${input.ownerUserId}`,
        isNull(jobs.leaderJobId),
        // An orphaned follower (its leader row was deleted) has no leader id either: never join it.
        sql`${jobs.phase} IS DISTINCT FROM ${FOLLOWER_PHASE}`,
        isNotNull(jobs.admittedAt),
        notInArray(jobs.status, OPEN_STATUSES_EXCLUDED)
      )
    )
    .orderBy(asc(jobs.admittedAt), asc(jobs.id))
    .limit(1);
  return leader?.id;
}

/**
 * The columns that make a job ADMITTED: it may run now, and its whole-job bound starts here (FR117). Used for a new
 * start, a promotion and a system-job re-admission.
 */
export function admittedColumns(definition: JobTypeDefinition, now: Date) {
  return { status: 'QUEUED' as const, admittedAt: now, queuedSince: null, deadlineAt: computeJobDeadline(now, definition) };
}

export async function admitJob(input: AdmitJobInput): Promise<AdmitJobResult> {
  const definition = getJobTypeDefinition(input.type);
  if (!definition) {
    return { refused: 'UNKNOWN_JOB_TYPE' };
  }
  const env = loadBackendEnv();

  try {
    return await db.transaction(async (tx): Promise<AdmitJobResult> => {
      const user = await lockUserRow(tx, input.ownerUserId);
      if (!user) {
        return { refused: 'UNKNOWN_USER' };
      }

      // 1. Reuse (FR120): the same work, already open for this user, joins it. Followers count: a user never holds two jobs
      // for one input.
      const existingId = await findOpenJobOfOwner(tx, input);
      if (existingId) {
        return { outcome: 'REUSED', jobId: existingId };
      }

      // 2. The subscription cap (FR122), only for a type that reserves a slot; a moderator is exempt.
      if (definition.reservesSubscriptionSlot) {
        const cap = await checkSubscriptionCap(tx, {
          userId: input.ownerUserId,
          isModerator: user.role === 'moderator',
          alreadyHeld: input.alreadyHeldSubscription ?? false,
        });
        if (!cap.allowed) {
          return { refused: 'SUBSCRIPTION_CAP_REACHED', activeCount: cap.activeCount, reservedCount: cap.reservedCount, cap: cap.cap };
        }
      }

      const now = new Date();
      const base = {
        type: input.type,
        ownerUserId: input.ownerUserId,
        trigger: 'USER' as const,
        inputKey: input.inputKey,
        input: input.payload ?? null,
      };

      // 3. Sharing (FR120): join another user's open job of a type that opted in. No place is held, no vendor call is made.
      if (definition.sharedAcrossUsers) {
        const leaderId = await findLeader(tx, input);
        if (leaderId) {
          const [follower] = await tx
            .insert(jobs)
            .values({
              ...base,
              status: 'WAITING',
              phase: FOLLOWER_PHASE,
              leaderJobId: leaderId,
              admittedAt: now,
              deadlineAt: computeJobDeadline(now, definition),
            })
            .returning({ id: jobs.id });
          return { outcome: 'SHARED', jobId: follower.id, leaderJobId: leaderId };
        }
      }

      // 4. The limits (FR121): admit, queue behind those already waiting, or refuse when the queue is full.
      const [placesHeld, queued] = await Promise.all([countPlacesHeld(tx, input.ownerUserId), countQueuedJobs(tx, input.ownerUserId)]);
      const decision = decideAdmission({
        placesHeld,
        queued,
        maxPlaces: env.maxConcurrentJobsPerUser,
        maxQueued: env.maxQueuedJobsPerUser,
      });
      if (decision.decision === 'REFUSE_QUEUE_FULL') {
        return { refused: 'JOB_QUEUE_FULL' };
      }
      if (decision.decision === 'ADMIT') {
        const [job] = await tx.insert(jobs).values({ ...base, ...admittedColumns(definition, now) }).returning({ id: jobs.id });
        return { outcome: 'ADMITTED', jobId: job.id };
      }
      // QUEUED: not admitted. The deadline column is required, so it holds the bound as if admitted now; promotion re-sets it
      // and the queue-wait rule (not this deadline) ends a job that waits too long.
      const [job] = await tx
        .insert(jobs)
        .values({
          ...base,
          status: 'QUEUED',
          admittedAt: null,
          queuedSince: now,
          deadlineAt: computeJobDeadline(now, definition),
        })
        .returning({ id: jobs.id });
      return { outcome: 'QUEUED', jobId: job.id, position: decision.position };
    });
  } catch (error) {
    // The backstop: two writers got past the lock-protected check (never expected for one user). Return the winner.
    if (isUniqueViolation(error)) {
      const existingId = await findOpenJobOfOwner(db, input);
      if (existingId) {
        return { outcome: 'REUSED', jobId: existingId };
      }
    }
    throw error;
  }
}
