import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { resolveAttemptBudgetMs, type JobHandlerContext, type JobHandlerResult } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';
import { afterJobEnded } from './after-job-ended.js';
import { getJobHandler } from './job-registry.js';

// Story 10.1a -- the job-engine worker (AC2, AC3; PRD FR117, FR121; AD-53). Runs inside a host Lambda
// (scraper or AI-processor) that was invoked with `{ jobType: 'job-engine-run', jobId }`.
//
//  * One atomic conditional UPDATE ... RETURNING claims the job (the shape of AD-41 Rule 3's claim): a live claim
//    held by another worker, an ended job, a job not admitted yet (it waits in Story 10.3's queue) and a WAITING job all
//    return no row, so this invocation exits quietly (an async invoke can be redelivered). A WAITING job is never claimed
//    directly: `readmitWaitingJob` sends it back through admission first.
//  * One RUN of the handler is raced against a budget: the smallest of the per-attempt cap, the time left to the job's
//    own deadline and the Lambda's remaining time.
//  * Every write after the claim is GUARDED (still RUNNING, still this worker's claim or released), so a late handler
//    can never overwrite a job that already ended.

// Plain words only (PRD: vendor trouble is recorded, never raw). The raw error goes to the logs, never to the row, because the Jobs
// page reads this column and a vendor SDK error can carry a request URL, a response body or caption text.
const HANDLER_ERROR_MESSAGE = 'The job failed with an internal error.';

type ClaimedJob = typeof jobs.$inferSelect;

export async function runJobEngineJob(
  jobId: string,
  lambdaContext: { getRemainingTimeInMillis?: () => number }
): Promise<void> {
  const env = loadBackendEnv();
  const claimedAt = new Date();
  const staleBefore = new Date(claimedAt.getTime() - env.jobWorkerClaimTtlMinutes * 60_000);

  const [job] = await db
    .update(jobs)
    .set({ status: 'RUNNING', workerClaimedAt: claimedAt, resumeAt: null, updatedAt: claimedAt })
    .where(
      and(
        eq(jobs.id, jobId),
        inArray(jobs.status, ['QUEUED', 'RUNNING']),
        isNotNull(jobs.admittedAt),
        or(isNull(jobs.workerClaimedAt), lt(jobs.workerClaimedAt, staleBefore))
      )
    )
    .returning();
  if (!job) {
    return;
  }

  // The write guard: still RUNNING and still ours (or released by our own hand-off).
  const stillOurs = and(
    eq(jobs.id, job.id),
    eq(jobs.status, 'RUNNING'),
    or(eq(jobs.workerClaimedAt, claimedAt), isNull(jobs.workerClaimedAt))
  );

  const finish = async (values: Partial<typeof jobs.$inferInsert>): Promise<void> => {
    const now = new Date();
    const ended = await db
      .update(jobs)
      .set({ ...values, workerClaimedAt: null, finishedAt: now, updatedAt: now })
      .where(stillOurs)
      .returning({ id: jobs.id });
    // Story 10.3: the run ended the job, so its place is free for the next queued job and its followers settle. Skipped
    // when the guard refused the write (the job had already ended some other way, and that path did its own follow-up).
    if (ended.length > 0) {
      await afterJobEnded(job, true);
    }
  };
  const expire = (message: string) =>
    finish({ status: 'EXPIRED', reasonCode: 'TIMED_OUT', errorMessage: message, completedAfterDeadline: false });

  if (job.deadlineAt.getTime() <= Date.now()) {
    await expire('The job was past its deadline when a worker picked it up.');
    return;
  }

  const handler = getJobHandler(job.type);
  if (!handler) {
    await finish({
      status: 'FAILED',
      reasonCode: 'HANDLER_NOT_REGISTERED',
      errorMessage: `No handler is registered for job type "${job.type}" in this Lambda.`,
    });
    return;
  }

  const budgetMs = resolveAttemptBudgetMs({
    attemptCapMs: env.jobAttemptDeadlineMs,
    msToDeadline: job.deadlineAt.getTime() - Date.now(),
    lambdaRemainingMs: lambdaContext.getRemainingTimeInMillis?.(),
  });
  const runEndsAt = Date.now() + budgetMs;
  const controller = new AbortController();
  // True once handOffToLambda's invoke was accepted: the receiving Lambda owns the job from then on, so nothing this run
  // does afterwards (finish, throw, run out of time) may write to it.
  let handedOff = false;

  const handlerContext: JobHandlerContext = {
    jobId: job.id,
    input: job.input,
    phase: job.phase,
    getRemainingTimeInMillis: () => Math.max(0, runEndsAt - Date.now()),
    signal: controller.signal,
    setPhase: async (phase: string) => {
      await db.update(jobs).set({ phase, updatedAt: new Date() }).where(stillOurs);
    },
    handOffToLambda: async (functionName: string) => {
      // Release the claim BEFORE the invoke: the receiving Lambda claims with the same conditional UPDATE and would be
      // refused for the whole claim TTL while ours is live. The job stays RUNNING; the receiver resumes from its phase.
      await db.update(jobs).set({ workerClaimedAt: null, updatedAt: new Date() }).where(stillOurs);
      await invokeJobEngineWorker(functionName, { jobId: job.id });
      handedOff = true;
    },
  };

  const TIMED_OUT = Symbol('timed-out');
  let timer: NodeJS.Timeout | undefined;
  const outcome = await Promise.race([
    (async (): Promise<{ result: JobHandlerResult } | { error: unknown }> => {
      try {
        return { result: await handler.run(handlerContext) };
      } catch (error) {
        return { error };
      }
    })(),
    new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), budgetMs);
    }),
  ]);
  clearTimeout(timer);

  if (outcome === TIMED_OUT) {
    controller.abort();
    if (handedOff) {
      console.warn(`[job-engine] job ${job.id} (${job.type}) ran out of time after handing off; the receiving Lambda owns it`);
      return;
    }
    await expire('The run used up its time budget.');
    return;
  }
  if ('error' in outcome) {
    console.error(`[job-engine] job ${job.id} (${job.type}) failed:`, outcome.error);
    if (handedOff) {
      return;
    }
    await finish({ status: 'FAILED', reasonCode: 'HANDLER_ERROR', errorMessage: HANDLER_ERROR_MESSAGE });
    return;
  }
  if (handedOff && outcome.result.outcome !== 'HANDED_OFF') {
    console.warn(`[job-engine] job ${job.id} (${job.type}) returned ${outcome.result.outcome} after handing off; ignored`);
    return;
  }

  await applyResult(job, outcome.result, handedOff, finish, stillOurs);
}

async function applyResult(
  job: ClaimedJob,
  result: JobHandlerResult,
  handedOff: boolean,
  finish: (values: Partial<typeof jobs.$inferInsert>) => Promise<void>,
  stillOurs: ReturnType<typeof and>
): Promise<void> {
  switch (result.outcome) {
    case 'HANDED_OFF':
      // The receiving Lambda continues the job; this run writes no terminal status. But a handler that returns HANDED_OFF
      // without having handed off would leave the job RUNNING with nobody invoked, holding a place until its deadline.
      if (!handedOff) {
        await finish({
          status: 'FAILED',
          reasonCode: 'HANDOFF_MISSING',
          errorMessage: 'The job reported a hand-off but did not hand off.',
        });
      }
      return;
    case 'WAITING': {
      const waiting = await db
        .update(jobs)
        .set({
          status: 'WAITING',
          phase: result.phase,
          resumeAt: result.resumeAt ?? null,
          resultData: { waitingFor: result.waitingFor },
          workerClaimedAt: null,
          updatedAt: new Date(),
        })
        .where(stillOurs)
        .returning({ id: jobs.id });
      // WAITING holds no place (FR121), so the next queued job may take it.
      if (waiting.length > 0) {
        await afterJobEnded(job, false);
      }
      return;
    }
    case 'SUCCEEDED':
      await finish({
        status: 'SUCCEEDED',
        resultData: result.resultData ?? null,
        reasonCode: result.reasonCode ?? null,
        completedAfterDeadline: Date.now() > job.deadlineAt.getTime(),
      });
      return;
    case 'SUCCEEDED_WITH_LIMITS':
    case 'FAILED':
      // FR117: every ending other than Succeeded carries a reason. A handler that forgot one is recorded as
      // UNSPECIFIED rather than ending with none.
      await finish({
        status: result.outcome,
        resultData: result.resultData ?? null,
        reasonCode: result.reasonCode ?? 'UNSPECIFIED',
        completedAfterDeadline: Date.now() > job.deadlineAt.getTime(),
      });
      return;
  }
}
