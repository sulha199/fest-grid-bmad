import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobAttempts, jobs, users } from '@festgrid/database';
import { PostUnavailableError, ScraperCapacityExceededError, type PostAdapterAttempt } from '@festgrid/domain';
import { ApifyRequestTimeoutError } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';
import { recordJobAttempt, toJobAttemptRow } from './record-job-attempt.js';

// Story 10.2 AC2: one job_attempts row per provider considered, with a reason CODE only (never the raw vendor error).

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];

async function makeJob(): Promise<string> {
  const [user] = await db.insert(users).values({ email: `attempt-${suffix}-${userIds.length}@example.test` }).returning({ id: users.id });
  userIds.push(user.id);
  const [job] = await db
    .insert(jobs)
    .values({ type: `fixture-attempt-${suffix}`, ownerUserId: user.id, trigger: 'USER', inputKey: `k-${suffix}`, deadlineAt: new Date(Date.now() + 60_000) })
    .returning({ id: jobs.id });
  return job.id;
}

test.after(async () => {
  if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds)); // jobs and attempts cascade
});

const failed = (error: unknown): PostAdapterAttempt => ({ adapter: 'brightdata', outcome: 'failed', error, elapsedMs: 1234.4, budgetMs: 5000.6 });

test('toJobAttemptRow maps every attempt outcome to the plain outcome and reason code', () => {
  assert.deepEqual(toJobAttemptRow({ adapter: 'apify', outcome: 'found', elapsedMs: 900, budgetMs: 5000 }), { provider: 'APIFY', outcome: 'SUCCEEDED', budgetMs: 5000, elapsedMs: 900 });
  assert.deepEqual(toJobAttemptRow({ adapter: 'apify', outcome: 'not-found', elapsedMs: 900, budgetMs: 5000 }), { provider: 'APIFY', outcome: 'SUCCEEDED', budgetMs: 5000, elapsedMs: 900, reasonCode: 'POST_NOT_FOUND' });
  assert.deepEqual(toJobAttemptRow({ adapter: 'brightdata', outcome: 'skipped', reason: 'budget', detail: 'needs 90000ms, 1000ms left', budgetMs: 1000 }), { provider: 'BRIGHTDATA', outcome: 'SKIPPED', budgetMs: 1000, elapsedMs: 0, reasonCode: 'BUDGET_TOO_SMALL' });
  assert.deepEqual(toJobAttemptRow({ adapter: 'apify', outcome: 'skipped', reason: 'quota', detail: 'over its quota', budgetMs: 4000 }), { provider: 'APIFY', outcome: 'OVER_QUOTA', budgetMs: 4000, elapsedMs: 0, reasonCode: 'CAP_KNOWN_USED_UP' });
});

test('toJobAttemptRow classifies a failure: cap, empty result, timeout, anything else; numbers are rounded', () => {
  assert.deepEqual(toJobAttemptRow(failed(new ScraperCapacityExceededError('Apify capacity exceeded for URL https://x.test/secret'))), { provider: 'BRIGHTDATA', outcome: 'OVER_QUOTA', budgetMs: 5001, elapsedMs: 1234, reasonCode: 'CAP_REACHED' });
  assert.equal(toJobAttemptRow(failed(new PostUnavailableError('an empty result'))).outcome, 'EMPTY');
  assert.equal(toJobAttemptRow(failed(new PostUnavailableError('an empty result'))).reasonCode, 'EMPTY_RESULT');
  assert.equal(toJobAttemptRow(failed(new ApifyRequestTimeoutError('slow'))).outcome, 'TIMED_OUT');
  assert.equal(toJobAttemptRow(failed(new VendorCallTimeoutError('apify call timed out'))).outcome, 'TIMED_OUT');
  assert.equal(toJobAttemptRow(failed(new Error('the snapshot was still running'))).outcome, 'TIMED_OUT');
  const other = toJobAttemptRow(failed(new Error('401 Unauthorized for https://api.example/secret-token')));
  assert.deepEqual([other.outcome, other.reasonCode], ['FAILED', 'PROVIDER_ERROR']);
});

test('no row ever carries the raw error: only codes and numbers', () => {
  const row = toJobAttemptRow(failed(new Error('caption text and https://signed.example/img.jpg?sig=abc')));
  assert.equal(JSON.stringify(row).includes('caption'), false);
  assert.equal(JSON.stringify(row).includes('signed.example'), false);
});

test('recordJobAttempt writes one row per call, linked to the job', async () => {
  const jobId = await makeJob();
  await recordJobAttempt({ jobId, attempt: failed(new Error('boom')) });
  await recordJobAttempt({ jobId, attempt: { adapter: 'apify', outcome: 'found', elapsedMs: 800, budgetMs: 4000 } });
  const rows = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, jobId));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.outcome).sort(), ['FAILED', 'SUCCEEDED']);
  assert.equal(rows.every((r) => r.scraperActorRunId === null), true);
});

test('recordJobAttempt never throws: an unknown job is logged and ignored', async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    await recordJobAttempt({ jobId: '00000000-0000-4000-8000-000000000000', attempt: failed(new Error('x')) });
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
});
