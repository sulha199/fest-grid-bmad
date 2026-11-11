import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobs, users } from '@festgrid/database';
import { registerJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../db/client.js';
import { registerJobHandler } from '../lib/job-engine/job-registry.js';
import { handler as scraperHandler } from './scraper.js';
import { handler as aiProcessorHandler } from './ai-processor.js';

// Story 10.1a Task 3 (AC1, AC3) -- both host Lambdas route `{ jobType: 'job-engine-run', jobId }` to the worker: the
// scraper for a job started there, the AI-processor for a job type hosted there and for a cross-Lambda hand-off.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const lambdaContext = { getRemainingTimeInMillis: () => 60_000 } as never;

async function makeJob(type: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `branches-${suffix}-${createdUserIds.length}@example.test` })
    .returning({ id: users.id });
  createdUserIds.push(user.id);
  const [job] = await db
    .insert(jobs)
    .values({
      type,
      ownerUserId: user.id,
      trigger: 'USER',
      inputKey: `k-${suffix}-${createdUserIds.length}`,
      admittedAt: new Date(),
      deadlineAt: new Date(Date.now() + 600_000),
    })
    .returning();
  return job;
}

test.after(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

test('the scraper Lambda runs a job-engine job', async () => {
  const type = `fixture-branch-scraper-${suffix}`;
  registerJobTypeDefinition({ type, host: 'scraper', maxDurationMs: 600_000 });
  registerJobHandler(type, { run: async () => ({ outcome: 'SUCCEEDED', resultData: { via: 'scraper' } }) });
  const job = await makeJob(type);

  await scraperHandler({ jobType: 'job-engine-run', jobId: job.id }, lambdaContext);

  const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  assert.equal(row.status, 'SUCCEEDED');
  assert.deepEqual(row.resultData, { via: 'scraper' });
});

test('the AI-processor Lambda runs a job-engine job', async () => {
  const type = `fixture-branch-ai-${suffix}`;
  registerJobTypeDefinition({ type, host: 'ai-processor', maxDurationMs: 600_000 });
  registerJobHandler(type, { run: async () => ({ outcome: 'SUCCEEDED', resultData: { via: 'ai-processor' } }) });
  const job = await makeJob(type);

  await aiProcessorHandler({ jobType: 'job-engine-run', jobId: job.id }, lambdaContext);

  const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  assert.equal(row.status, 'SUCCEEDED');
  assert.deepEqual(row.resultData, { via: 'ai-processor' });
});

test('the scraper Lambda runs the job-engine sweep', async () => {
  const type = `fixture-branch-sweep-${suffix}`;
  const job = await makeJob(type);
  await db.update(jobs).set({ status: 'RUNNING', deadlineAt: new Date(Date.now() - 60_000) }).where(eq(jobs.id, job.id));

  await scraperHandler({ jobType: 'job-engine-sweep' }, lambdaContext);

  const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  assert.equal(row.status, 'EXPIRED');
  assert.equal(row.reasonCode, 'TIMED_OUT');
});

