import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobs, users } from '@festgrid/database';
import { registerJobTypeDefinition, type JobHandler, type JobHandlerResult } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { setInvokeJobEngineWorker, invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';
import { registerJobHandler } from './job-registry.js';
import { runJobEngineJob } from './run-job.js';

// Story 10.1a Task 3 -- the worker (AC2, AC3): atomic claim, the run's budget, phase writes, WAITING, the
// cross-Lambda hand-off and the guarded writes that keep a late handler from overwriting an ended job.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let typeCounter = 0;
const createdUserIds: string[] = [];
const originalInvoke = invokeJobEngineWorker;
const originalAttemptCap = process.env.JOB_ATTEMPT_DEADLINE_MS;
const originalClaimTtl = process.env.JOB_WORKER_CLAIM_TTL_MINUTES;

async function makeUser(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `run-job-${suffix}-${createdUserIds.length}@example.test` })
    .returning({ id: users.id });
  createdUserIds.push(user.id);
  return user.id;
}

function defineType(handler: JobHandler | null, maxDurationMs = 600_000): string {
  const type = `fixture-run-${suffix}-${typeCounter++}`;
  registerJobTypeDefinition({ type, host: 'scraper', maxDurationMs });
  if (handler) registerJobHandler(type, handler);
  return type;
}

async function insertJob(type: string, overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const ownerUserId = await makeUser();
  const [job] = await db
    .insert(jobs)
    .values({
      type,
      ownerUserId,
      trigger: 'USER',
      inputKey: `k-${suffix}-${typeCounter++}`,
      input: { hello: 'world' },
      admittedAt: new Date(),
      deadlineAt: new Date(Date.now() + 600_000),
      ...overrides,
    })
    .returning();
  return job;
}

async function readJob(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job;
}

function handlerReturning(result: JobHandlerResult): JobHandler {
  return { run: async () => result };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.beforeEach(() => {
  delete process.env.JOB_ATTEMPT_DEADLINE_MS;
  delete process.env.JOB_WORKER_CLAIM_TTL_MINUTES;
});

test.after(async () => {
  setInvokeJobEngineWorker(originalInvoke);
  if (originalAttemptCap === undefined) delete process.env.JOB_ATTEMPT_DEADLINE_MS;
  else process.env.JOB_ATTEMPT_DEADLINE_MS = originalAttemptCap;
  if (originalClaimTtl === undefined) delete process.env.JOB_WORKER_CLAIM_TTL_MINUTES;
  else process.env.JOB_WORKER_CLAIM_TTL_MINUTES = originalClaimTtl;
  if (createdUserIds.length > 0) {
    // jobs.owner_user_id cascades: deleting the users removes every job row this file created.
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

test('runJobEngineJob: claim and outcomes', async (t) => {
  await t.test('SUCCEEDED: writes status, result, finish time, clears the claim', async () => {
    const type = defineType(handlerReturning({ outcome: 'SUCCEEDED', resultData: { ok: true } }));
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'SUCCEEDED');
    assert.deepEqual(row.resultData, { ok: true });
    assert.ok(row.finishedAt instanceof Date);
    assert.equal(row.workerClaimedAt, null);
    assert.equal(row.completedAfterDeadline, false);
  });

  await t.test('SUCCEEDED_WITH_LIMITS and FAILED keep the handler\'s reason code', async () => {
    const limits = defineType(handlerReturning({ outcome: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'STORED_IMAGES_USED' }));
    const failed = defineType(handlerReturning({ outcome: 'FAILED', reasonCode: 'ACCOUNT_NOT_FOUND' }));
    const a = await insertJob(limits);
    const b = await insertJob(failed);
    await runJobEngineJob(a.id, {});
    await runJobEngineJob(b.id, {});
    assert.deepEqual([(await readJob(a.id)).status, (await readJob(a.id)).reasonCode], ['SUCCEEDED_WITH_LIMITS', 'STORED_IMAGES_USED']);
    assert.deepEqual([(await readJob(b.id)).status, (await readJob(b.id)).reasonCode], ['FAILED', 'ACCOUNT_NOT_FOUND']);
  });

  await t.test('an ending that needs a reason but gives none is recorded as UNSPECIFIED, never silently', async () => {
    const type = defineType(handlerReturning({ outcome: 'FAILED' }));
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    assert.equal((await readJob(job.id)).reasonCode, 'UNSPECIFIED');
  });

  await t.test('the handler sees the job id, its stored input and phase, and setPhase is visible mid-run', async () => {
    let seen: { jobId: string; input: unknown; phase: string | null; midRunPhase?: string | null } | undefined;
    const type = defineType({
      run: async (ctx) => {
        await ctx.setPhase('scraping');
        const [row] = await db.select().from(jobs).where(eq(jobs.id, ctx.jobId));
        seen = { jobId: ctx.jobId, input: ctx.input, phase: null, midRunPhase: row.phase };
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { phase: null });
    await runJobEngineJob(job.id, {});
    assert.deepEqual(seen, { jobId: job.id, input: { hello: 'world' }, phase: null, midRunPhase: 'scraping' });
    assert.equal((await readJob(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a thrown error ends the job FAILED with the error message', async () => {
    const type = defineType({
      run: async () => {
        throw new Error('vendor said no');
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'HANDLER_ERROR');
    // Plain words only (PRD: vendor trouble is recorded, never raw): the raw text stays in the logs, never in the row.
    assert.equal(row.errorMessage, 'The job failed with an internal error.');
    assert.ok(!JSON.stringify(row).includes('vendor said no'));
    assert.equal(row.workerClaimedAt, null);
  });

  await t.test('an unregistered handler ends the job FAILED naming the type', async () => {
    const type = defineType(null);
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'HANDLER_NOT_REGISTERED');
    assert.ok(row.errorMessage?.includes(type));
  });
});

test('runJobEngineJob: the run budget and the job deadline', async (t) => {
  await t.test('a handler that outlasts the attempt cap ends the job EXPIRED/TIMED_OUT and cannot overwrite it later', async () => {
    process.env.JOB_ATTEMPT_DEADLINE_MS = '60';
    let finished = false;
    const type = defineType({
      run: async () => {
        await sleep(350);
        finished = true;
        return { outcome: 'SUCCEEDED', resultData: { late: true } };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    let row = await readJob(job.id);
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.reasonCode, 'TIMED_OUT');
    assert.equal(row.workerClaimedAt, null);
    await sleep(500);
    assert.equal(finished, true, 'the late handler did finish');
    row = await readJob(job.id);
    assert.equal(row.status, 'EXPIRED', 'a late result must not overwrite an ended job');
    assert.equal(row.resultData, null);
  });

  await t.test('a job already past its deadline at claim time is EXPIRED without running the handler', async () => {
    let ran = false;
    const type = defineType({
      run: async () => {
        ran = true;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { deadlineAt: new Date(Date.now() - 1000) });
    await runJobEngineJob(job.id, {});
    assert.equal(ran, false);
    const row = await readJob(job.id);
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.reasonCode, 'TIMED_OUT');
  });

  await t.test('the run budget is the smallest of the cap, the time to the deadline and the Lambda\'s own clock', async () => {
    const budgets: number[] = [];
    const type = defineType({
      run: async (ctx) => {
        budgets.push(ctx.getRemainingTimeInMillis());
        return { outcome: 'SUCCEEDED' };
      },
    });
    const a = await insertJob(type);
    await runJobEngineJob(a.id, { getRemainingTimeInMillis: () => 20_000 });
    const b = await insertJob(type, { deadlineAt: new Date(Date.now() + 5_000) });
    await runJobEngineJob(b.id, { getRemainingTimeInMillis: () => 200_000 });
    const c = await insertJob(type);
    await runJobEngineJob(c.id, {});
    assert.ok(budgets[0] <= 20_000 && budgets[0] > 19_000, `lambda-bound budget ${budgets[0]}`);
    assert.ok(budgets[1] <= 5_000 && budgets[1] > 4_000, `deadline-bound budget ${budgets[1]}`);
    assert.ok(budgets[2] <= 150_000 && budgets[2] > 149_000, `cap-bound budget ${budgets[2]}`);
  });
});

test('runJobEngineJob: the claim', async (t) => {
  await t.test('a fresh claim by another worker means this invocation exits without running the handler', async () => {
    let ran = false;
    const type = defineType({
      run: async () => {
        ran = true;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { status: 'RUNNING', workerClaimedAt: new Date() });
    await runJobEngineJob(job.id, {});
    assert.equal(ran, false);
    assert.equal((await readJob(job.id)).status, 'RUNNING');
  });

  await t.test('a claim older than the TTL is taken over', async () => {
    const type = defineType(handlerReturning({ outcome: 'SUCCEEDED' }));
    const job = await insertJob(type, { status: 'RUNNING', workerClaimedAt: new Date(Date.now() - 6 * 60_000) });
    await runJobEngineJob(job.id, {});
    assert.equal((await readJob(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a job that is not admitted yet is never claimed', async () => {
    let ran = false;
    const type = defineType({
      run: async () => {
        ran = true;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { admittedAt: null });
    await runJobEngineJob(job.id, {});
    assert.equal(ran, false);
    assert.equal((await readJob(job.id)).status, 'QUEUED');
  });

  await t.test('an ended job is never run again', async () => {
    let ran = false;
    const type = defineType({
      run: async () => {
        ran = true;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { status: 'SUCCEEDED', finishedAt: new Date() });
    await runJobEngineJob(job.id, {});
    assert.equal(ran, false);
  });

  await t.test('an unknown job id is a quiet no-op', async () => {
    await runJobEngineJob('00000000-0000-4000-8000-000000000000', {});
  });
});

test('runJobEngineJob: WAITING (FR117, FR121)', async (t) => {
  await t.test('a WAITING outcome writes status, phase, resume time and what it waits for, and releases the claim', async () => {
    const resumeAt = new Date(Date.now() + 10 * 60_000);
    const type = defineType(handlerReturning({ outcome: 'WAITING', phase: 'waiting-retry', waitingFor: 'retry of a post', resumeAt }));
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'WAITING');
    assert.equal(row.phase, 'waiting-retry');
    assert.equal(row.resumeAt?.getTime(), resumeAt.getTime());
    assert.deepEqual(row.resultData, { waitingFor: 'retry of a post' });
    assert.equal(row.workerClaimedAt, null);
    assert.equal(row.finishedAt, null);
  });

  await t.test('a WAITING job whose resume time is in the future is not claimed by an early invoke', async () => {
    let ran = false;
    const type = defineType({
      run: async () => {
        ran = true;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type, { status: 'WAITING', resumeAt: new Date(Date.now() + 10 * 60_000) });
    await runJobEngineJob(job.id, {});
    assert.equal(ran, false);
    assert.equal((await readJob(job.id)).status, 'WAITING');
  });

  await t.test('a WAITING job is claimed once its resume time is due, or when it waits for an event (no resume time)', async () => {
    const type = defineType(handlerReturning({ outcome: 'SUCCEEDED' }));
    const due = await insertJob(type, { status: 'WAITING', resumeAt: new Date(Date.now() - 1000) });
    const byEvent = await insertJob(type, { status: 'WAITING', resumeAt: null });
    await runJobEngineJob(due.id, {});
    await runJobEngineJob(byEvent.id, {});
    assert.equal((await readJob(due.id)).status, 'SUCCEEDED');
    assert.equal((await readJob(byEvent.id)).status, 'SUCCEEDED');
  });
});

test('runJobEngineJob: cross-Lambda hand-off (AC3)', async (t) => {
  await t.test('handing off releases the claim, invokes the named function with only the job id, and leaves the job RUNNING', async () => {
    const calls: Array<{ functionName: string; payload: unknown }> = [];
    setInvokeJobEngineWorker(async (functionName, payload) => {
      calls.push({ functionName, payload });
    });
    const type = defineType({
      run: async (ctx) => {
        await ctx.setPhase('extracting');
        await ctx.handOffToLambda('ai-processor-fn');
        return { outcome: 'HANDED_OFF' };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'RUNNING');
    assert.equal(row.phase, 'extracting');
    assert.equal(row.workerClaimedAt, null, 'the claim must be released so the receiving Lambda can take it');
    assert.deepEqual(calls, [{ functionName: 'ai-processor-fn', payload: { jobId: job.id } }]);
  });

  await t.test('a failed hand-off invoke ends the job FAILED', async () => {
    setInvokeJobEngineWorker(async () => {
      throw new Error('not accepted');
    });
    const type = defineType({
      run: async (ctx) => {
        await ctx.handOffToLambda('ai-processor-fn');
        return { outcome: 'HANDED_OFF' };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.errorMessage, 'The job failed with an internal error.');
  });
});

test('runJobEngineJob: review follow-ups (Story 10.1a code review)', async (t) => {
  await t.test('the handler gets an abort signal that fires when the run budget is used up', async () => {
    process.env.JOB_ATTEMPT_DEADLINE_MS = '60';
    let signal: AbortSignal | undefined;
    let sawAbortWhileRunning = false;
    const type = defineType({
      run: async (ctx) => {
        signal = ctx.signal;
        await new Promise<void>((resolve) => {
          ctx.signal.addEventListener('abort', () => {
            sawAbortWhileRunning = true;
            resolve();
          });
          setTimeout(resolve, 400);
        });
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    assert.equal((await readJob(job.id)).status, 'EXPIRED');
    assert.equal(signal?.aborted, true);
    await sleep(100);
    assert.equal(sawAbortWhileRunning, true, 'the handler was told to stop while it was still running');
  });

  await t.test('the signal stays quiet for a run that finishes in time', async () => {
    let signal: AbortSignal | undefined;
    const type = defineType({
      run: async (ctx) => {
        signal = ctx.signal;
        return { outcome: 'SUCCEEDED' };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    assert.equal(signal?.aborted, false);
    assert.equal((await readJob(job.id)).status, 'SUCCEEDED');
  });

  await t.test('after a successful hand-off the sender\'s own timer cannot expire the job', async () => {
    process.env.JOB_ATTEMPT_DEADLINE_MS = '60';
    setInvokeJobEngineWorker(async () => {});
    const type = defineType({
      run: async (ctx) => {
        await ctx.handOffToLambda('ai-processor-fn');
        await sleep(300);
        return { outcome: 'HANDED_OFF' };
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'RUNNING', 'the receiving Lambda owns the job now');
    assert.equal(row.workerClaimedAt, null);
  });

  await t.test('after a successful hand-off an error in the sender cannot fail the job', async () => {
    setInvokeJobEngineWorker(async () => {});
    const type = defineType({
      run: async (ctx) => {
        await ctx.handOffToLambda('ai-processor-fn');
        throw new Error('sender blew up after handing off');
      },
    });
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    assert.equal((await readJob(job.id)).status, 'RUNNING');
  });

  await t.test('HANDED_OFF without a hand-off ends the job FAILED with HANDOFF_MISSING, never stuck RUNNING', async () => {
    const type = defineType(handlerReturning({ outcome: 'HANDED_OFF' }));
    const job = await insertJob(type);
    await runJobEngineJob(job.id, {});
    const row = await readJob(job.id);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'HANDOFF_MISSING');
    assert.equal(row.workerClaimedAt, null);
  });
});

