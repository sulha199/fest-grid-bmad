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
registerJobTypeDefinition({ type: SCRAPER_TYPE, host: 'scraper', maxDurationMs: 600_000 });
registerJobTypeDefinition({ type: AI_TYPE, host: 'ai-processor', maxDurationMs: 90_000 });

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
});
