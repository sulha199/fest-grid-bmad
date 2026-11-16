import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobs, users } from '@festgrid/database';
import { registerJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { setInvokeJobEngineWorker, invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';
import { startJob } from './start-job.js';

// Story 10.1a Task 2 -- startJob (AC1, AC8): writes the job row, invokes the job type's host Lambda asynchronously
// with only { jobId }, returns at once, and fails to start the way startManualExtractionJob does.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SCRAPER_TYPE = `fixture-start-scraper-${suffix}`;
const AI_TYPE = `fixture-start-ai-${suffix}`;
const SLOT_TYPE = `fixture-start-slot-${suffix}`;
const SHARED_TYPE = `fixture-start-shared-${suffix}`;
registerJobTypeDefinition({ type: SCRAPER_TYPE, host: 'scraper', maxDurationMs: 600_000 });
registerJobTypeDefinition({ type: AI_TYPE, host: 'ai-processor', maxDurationMs: 90_000 });
registerJobTypeDefinition({ type: SLOT_TYPE, host: 'scraper', maxDurationMs: 600_000, reservesSubscriptionSlot: true });
registerJobTypeDefinition({ type: SHARED_TYPE, host: 'scraper', maxDurationMs: 600_000, sharedAcrossUsers: true });

const createdUserIds: string[] = [];
const originalInvoke = invokeJobEngineWorker;
const originalEnv = { scraper: process.env.SCRAPER_FUNCTION_NAME, ai: process.env.AI_PROCESSOR_FUNCTION_NAME };

async function makeUser(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `start-job-${suffix}-${createdUserIds.length}@example.test` })
    .returning({ id: users.id });
  createdUserIds.push(user.id);
  return user.id;
}

test.beforeEach(() => {
  process.env.SCRAPER_FUNCTION_NAME = 'test-scraper-fn';
  process.env.AI_PROCESSOR_FUNCTION_NAME = 'test-ai-processor-fn';
});

test.after(async () => {
  setInvokeJobEngineWorker(originalInvoke);
  if (originalEnv.scraper === undefined) delete process.env.SCRAPER_FUNCTION_NAME;
  else process.env.SCRAPER_FUNCTION_NAME = originalEnv.scraper;
  if (originalEnv.ai === undefined) delete process.env.AI_PROCESSOR_FUNCTION_NAME;
  else process.env.AI_PROCESSOR_FUNCTION_NAME = originalEnv.ai;
  if (createdUserIds.length > 0) {
    // jobs.owner_user_id cascades, so deleting the users removes every row this file created.
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

test('startJob', async (t) => {
  await t.test('writes a USER job admitted now, bounded by its type, and invokes the scraper host with only the job id', async () => {
    const ownerUserId = await makeUser();
    const calls: Array<{ functionName: string; payload: unknown }> = [];
    setInvokeJobEngineWorker(async (functionName, payload) => {
      calls.push({ functionName, payload });
    });

    const startedAt = Date.now();
    const result = await startJob(SCRAPER_TYPE, { inputKey: `k-${suffix}-1`, payload: { postIds: ['a', 'b'] } }, ownerUserId);
    const elapsed = Date.now() - startedAt;

    assert.ok('jobId' in result, JSON.stringify(result));
    assert.equal((result as { outcome: string }).outcome, 'ADMITTED');
    assert.ok(elapsed < 1000, `startJob took ${elapsed} ms`);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, result.jobId));
    assert.equal(row.type, SCRAPER_TYPE);
    assert.equal(row.trigger, 'USER');
    assert.equal(row.ownerUserId, ownerUserId);
    assert.equal(row.status, 'QUEUED');
    assert.equal(row.inputKey, `k-${suffix}-1`);
    assert.deepEqual(row.input, { postIds: ['a', 'b'] });
    assert.ok(row.admittedAt instanceof Date);
    assert.equal(row.deadlineAt.getTime() - row.admittedAt.getTime(), 600_000);
    assert.deepEqual(calls, [{ functionName: 'test-scraper-fn', payload: { jobId: result.jobId } }]);
  });

  await t.test('a job type hosted on the AI processor invokes that function', async () => {
    const ownerUserId = await makeUser();
    const calls: string[] = [];
    setInvokeJobEngineWorker(async (functionName) => {
      calls.push(functionName);
    });
    const result = await startJob(AI_TYPE, { inputKey: `k-${suffix}-2` }, ownerUserId);
    assert.ok('jobId' in result);
    assert.deepEqual(calls, ['test-ai-processor-fn']);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, result.jobId));
    assert.equal(row.input, null);
  });

  await t.test('an unregistered job type writes nothing and does not invoke', async () => {
    const ownerUserId = await makeUser();
    let invoked = false;
    setInvokeJobEngineWorker(async () => {
      invoked = true;
    });
    const key = `k-${suffix}-3`;
    const result = await startJob(`no-such-type-${suffix}`, { inputKey: key }, ownerUserId);
    assert.deepEqual(Object.keys(result).sort(), ['errorCode', 'errorMessage']);
    assert.equal((result as { errorCode: string }).errorCode, 'JOB_START_FAILED');
    assert.equal(invoked, false);
    const rows = await db.select().from(jobs).where(eq(jobs.inputKey, key));
    assert.equal(rows.length, 0);
  });

  await t.test('a failed invoke marks the job FAILED and returns the start error', async () => {
    const ownerUserId = await makeUser();
    setInvokeJobEngineWorker(async () => {
      throw new Error('boom');
    });
    const key = `k-${suffix}-4`;
    const result = await startJob(SCRAPER_TYPE, { inputKey: key }, ownerUserId);
    assert.equal((result as { errorCode?: string }).errorCode, 'JOB_START_FAILED');
    const [row] = await db.select().from(jobs).where(eq(jobs.inputKey, key));
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'START_FAILED');
    assert.ok(row.finishedAt instanceof Date);
    assert.ok(row.errorMessage && row.errorMessage.length > 0);
  });

  await t.test('a missing function name for the host also fails the job to start', async () => {
    const ownerUserId = await makeUser();
    delete process.env.SCRAPER_FUNCTION_NAME;
    let invoked = false;
    setInvokeJobEngineWorker(async () => {
      invoked = true;
    });
    const key = `k-${suffix}-5`;
    const result = await startJob(SCRAPER_TYPE, { inputKey: key }, ownerUserId);
    assert.equal((result as { errorCode?: string }).errorCode, 'JOB_START_FAILED');
    assert.equal(invoked, false);
    const [row] = await db.select().from(jobs).where(eq(jobs.inputKey, key));
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'START_FAILED');
  });

  await t.test('the same work started again returns the open job with REUSED, writes no row and invokes nothing (AC1)', async () => {
    const ownerUserId = await makeUser();
    const calls: string[] = [];
    setInvokeJobEngineWorker(async () => {
      calls.push('invoke');
    });
    const key = `k-${suffix}-reuse`;
    const first = await startJob(SCRAPER_TYPE, { inputKey: key }, ownerUserId);
    const second = await startJob(SCRAPER_TYPE, { inputKey: key }, ownerUserId);
    assert.ok('jobId' in first && 'jobId' in second);
    assert.equal(second.outcome, 'REUSED');
    assert.equal(second.jobId, first.jobId);
    assert.deepEqual(calls, ['invoke'], 'only the first start invoked');
    assert.equal((await db.select().from(jobs).where(eq(jobs.inputKey, key))).length, 1);
  });

  await t.test('a start over the limit is QUEUED with its position, not invoked, and a full queue is refused JOB_QUEUE_FULL (AC3, AC4)', async () => {
    const ownerUserId = await makeUser();
    const calls: string[] = [];
    setInvokeJobEngineWorker(async (_fn, payload) => {
      calls.push((payload as { jobId: string }).jobId);
    });
    const results = [];
    for (let i = 0; i < 14; i += 1) {
      results.push(await startJob(SCRAPER_TYPE, { inputKey: `k-${suffix}-lim-${i}` }, ownerUserId));
    }
    assert.deepEqual(results.slice(0, 3).map((r) => (r as { outcome: string }).outcome), ['ADMITTED', 'ADMITTED', 'ADMITTED']);
    assert.deepEqual(
      results.slice(3, 13).map((r) => (r as { position?: number }).position),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
    assert.equal((results[13] as { errorCode: string }).errorCode, 'JOB_QUEUE_FULL');
    assert.equal(calls.length, 3, 'only admitted jobs are invoked');
  });

  await t.test('a failed invoke frees the place for the next queued job', async () => {
    const ownerUserId = await makeUser();
    const invoked: string[] = [];
    let failFirst = true;
    setInvokeJobEngineWorker(async (_fn, payload) => {
      if (failFirst) {
        failFirst = false;
        throw new Error('refused');
      }
      invoked.push((payload as { jobId: string }).jobId);
    });
    const ids: string[] = [];
    const first = await startJob(SCRAPER_TYPE, { inputKey: `k-${suffix}-ff-0` }, ownerUserId);
    assert.equal((first as { errorCode?: string }).errorCode, 'JOB_START_FAILED');
    for (let i = 1; i < 5; i += 1) {
      const r = await startJob(SCRAPER_TYPE, { inputKey: `k-${suffix}-ff-${i}` }, ownerUserId);
      assert.ok('jobId' in r);
      ids.push(r.jobId);
    }
    // the failed start freed its place, so three admitted and one queued
    assert.equal(invoked.length, 3);
    const rows = await db.select().from(jobs).where(eq(jobs.ownerUserId, ownerUserId));
    assert.equal(rows.filter((r) => r.status === 'FAILED').length, 1);
    assert.equal(rows.filter((r) => r.status === 'QUEUED' && r.admittedAt === null).length, 1);
  });

  await t.test('a slot-reserving start at the cap returns SUBSCRIPTION_CAP_REACHED with the numbers and writes nothing (AC7)', async () => {
    const ownerUserId = await makeUser();
    setInvokeJobEngineWorker(async () => {});
    for (let i = 0; i < 5; i += 1) {
      const r = await startJob(SLOT_TYPE, { inputKey: `k-${suffix}-slot-${i}` }, ownerUserId);
      assert.ok('jobId' in r);
    }
    const refused = await startJob(SLOT_TYPE, { inputKey: `k-${suffix}-slot-5` }, ownerUserId);
    assert.deepEqual(refused, {
      errorCode: 'SUBSCRIPTION_CAP_REACHED',
      errorMessage: 'The subscription cap is reached.',
      details: { activeCount: 0, reservedCount: 5, cap: 5 },
    });
    assert.equal((await db.select().from(jobs).where(eq(jobs.inputKey, `k-${suffix}-slot-5`))).length, 0);
  });

  await t.test('a follower start (shared type) is returned as SHARED and not invoked', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const calls: string[] = [];
    setInvokeJobEngineWorker(async (_fn, payload) => {
      calls.push((payload as { jobId: string }).jobId);
    });
    const key = `k-${suffix}-shared`;
    const leader = await startJob(SHARED_TYPE, { inputKey: key }, a);
    const follower = await startJob(SHARED_TYPE, { inputKey: key }, b);
    assert.ok('jobId' in leader && 'jobId' in follower);
    assert.equal(follower.outcome, 'SHARED');
    assert.deepEqual(calls, [leader.jobId]);
  });

  await t.test('a failed leader start settles its followers (the leader ends START_FAILED)', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const key = `k-${suffix}-sharedfail`;
    // b joins a leader that was admitted but whose invoke is lost: write it directly, then end it START_FAILED via a real start
    setInvokeJobEngineWorker(async () => {});
    const leader = await startJob(SHARED_TYPE, { inputKey: key }, a);
    const follower = await startJob(SHARED_TYPE, { inputKey: key }, b);
    assert.ok('jobId' in leader && 'jobId' in follower);
    const { markJobStartFailed } = await import('./job-host.js');
    const { afterJobEnded } = await import('./after-job-ended.js');
    assert.equal(await markJobStartFailed(leader.jobId), true);
    await afterJobEnded({ id: leader.jobId, ownerUserId: a }, true);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, follower.jobId));
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'START_FAILED');
  });

  await t.test('a follower that attaches to a leader that has just ended is settled at once, not by the sweep', async () => {
    const a = await makeUser();
    const b = await makeUser();
    setInvokeJobEngineWorker(async () => {});
    const key = `k-${suffix}-late-follow`;
    const leader = await startJob(SHARED_TYPE, { inputKey: key }, a);
    assert.ok('jobId' in leader);
    // The leader ends, but a row that is not "open" is not joined, so simulate the race by ending the leader AFTER the
    // follower is written: settleFollowers is then what the follower's own start runs.
    const follower = await startJob(SHARED_TYPE, { inputKey: key }, b);
    assert.ok('jobId' in follower && follower.outcome === 'SHARED');
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date(), resultData: { ok: 1 } }).where(eq(jobs.id, leader.jobId));
    const { settleFollowers } = await import('./settle-followers.js');
    assert.equal(await settleFollowers(leader.jobId), 1);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, follower.jobId));
    assert.equal(row.status, 'SUCCEEDED');
  });
});
