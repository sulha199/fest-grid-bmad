import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobVendorSnapshots, jobs } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import {
  getBrightDataProgress,
  getBrightDataSnapshot,
  setGetBrightDataProgress,
  setGetBrightDataSnapshot,
} from '../scraper/brightdata-client.js';
import { collectLateVendorResults } from '../job-engine/late-results.js';
import { registerLateResultHandler } from '../job-engine/job-registry.js';
import { registerScraperJobHandlers } from '../job-engine/register-scraper-job-handlers.js';
import { reextractLateResultHandler } from './reextract-late-result-handler.js';
import { createReextractFixtures } from './reextract-test-support.js';

// Story 10.6 (AC7) -- a Bright Data snapshot that outlived the refresh budget heals `posts` through the type's late-result handler,
// by the engine's own sweep step. Bright Data is replaced by its existing seams; no vendor call.

const fx = createReextractFixtures('latehandler');
const originalProgress = getBrightDataProgress;
const originalSnapshot = getBrightDataSnapshot;
let records: unknown[] = [];
let ownerId: string;
let accountId: string;
let counter = 0;

test.before(async () => {
  ownerId = await fx.makeUser();
  accountId = (await fx.makeAccount()).id;
  registerScraperJobHandlers(); // the Scraper Lambda's cold start: the late-result handler of the type
  setGetBrightDataProgress(async () => ({ status: 'ready' }));
  setGetBrightDataSnapshot(async () => records);
});
test.after(async () => {
  setGetBrightDataProgress(originalProgress);
  setGetBrightDataSnapshot(originalSnapshot);
  await fx.cleanup();
});

async function setup(jobStatus: 'EXPIRED' | 'RUNNING' | 'SUCCEEDED_WITH_LIMITS', postOverrides: Parameters<typeof fx.makePost>[1] = {}) {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl(`lh${counter}-c`), additionalImageUrls: [fx.expiredUrl(`lh${counter}-s`)], ...postOverrides });
  const job = await fx.makeJob(post.id, ownerId, {
    status: jobStatus,
    reasonCode: jobStatus === 'EXPIRED' ? 'TIMED_OUT' : jobStatus === 'SUCCEEDED_WITH_LIMITS' ? 'TIMED_OUT' : null,
    deadlineAt: new Date(Date.now() - 60_000),
    finishedAt: jobStatus === 'RUNNING' ? null : new Date(Date.now() - 30_000),
    inputKey: `lh-${fx.suffix}-${counter}`,
  });
  const snapshotId = `s_lh_${fx.suffix}_${counter++}`;
  await db.insert(jobVendorSnapshots).values({ jobId: job.id, provider: 'BRIGHTDATA', snapshotId, waitUntil: new Date(Date.now() + 3_600_000) });
  return { post, job, snapshotId };
}
const record = (post: { postUrl: string }, photos: string[]) => ({ url: post.postUrl, photos, description: 'A late vendor caption that must never be stored', date_posted: '2026-10-01T00:00:00.000Z' });
const readLink = async (snapshotId: string) => (await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, snapshotId)))[0];

test('the type registers the handler in the Scraper Lambda\'s registration', async () => {
  const { getLateResultHandler } = await import('../job-engine/job-registry.js');
  assert.equal(getLateResultHandler(REEXTRACT_POST_JOB_TYPE), reextractLateResultHandler);
});

test('a late snapshot saves the fresh links to posts and leaves the job\'s own ending exactly as it was (not revived)', async () => {
  const { post, job, snapshotId } = await setup('EXPIRED');
  records = [record(post, [fx.freshUrl('late-c'), fx.freshUrl('late-s1'), fx.freshUrl('late-s2')])];

  assert.ok((await collectLateVendorResults()) >= 1);

  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('late-c'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('late-s1'), fx.freshUrl('late-s2')]);
  assert.equal(stored.content, post.content, 'the vendor caption is never stored');
  const row = await fx.readJob(job.id);
  assert.equal(row.status, 'EXPIRED', 'an expired job with no preview of its own is not turned into a result-less success');
  assert.equal(row.reasonCode, 'TIMED_OUT');
  assert.equal(row.completedAfterDeadline, false);
  assert.equal(row.resultData, null);
  assert.equal((await readLink(snapshotId)).status, 'COLLECTED');

  // A second sweep finds nothing to do (a duplicate delivery is a no-op).
  const before = await fx.readPost(post.id);
  await collectLateVendorResults();
  assert.equal((await fx.readPost(post.id)).updatedAt.getTime(), before.updatedAt.getTime());
});

test('a job that already finished with its own preview keeps it; only posts is healed', async () => {
  const { post, job } = await setup('SUCCEEDED_WITH_LIMITS');
  await db.update(jobs).set({ resultData: { refresh: { outcome: 'TIMED_OUT' }, events: [] } }).where(eq(jobs.id, job.id));
  records = [record(post, [fx.freshUrl('keep-c')])];
  await collectLateVendorResults();
  assert.equal((await fx.readPost(post.id)).imageUrl, fx.freshUrl('keep-c'));
  const row = await fx.readJob(job.id);
  assert.equal(row.status, 'SUCCEEDED_WITH_LIMITS');
  assert.deepEqual(row.resultData, { refresh: { outcome: 'TIMED_OUT' }, events: [] });
});

test('a job still RUNNING when the late result lands is not settled either', async () => {
  const { post, job } = await setup('RUNNING');
  records = [record(post, [fx.freshUrl('run-c')])];
  await collectLateVendorResults();
  assert.equal((await fx.readPost(post.id)).imageUrl, fx.freshUrl('run-c'));
  assert.equal((await fx.readJob(job.id)).status, 'RUNNING');
});

test('a late 640 px result never replaces full-size links that are still valid', async () => {
  const { post } = await setup('EXPIRED', { imageUrl: fx.freshUrl('full-c'), additionalImageUrls: [fx.freshUrl('full-s')] });
  records = [record(post, [fx.lowResUrl('low-c'), fx.lowResUrl('low-s')])];
  await collectLateVendorResults();
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('full-c'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('full-s')]);
});

test('a snapshot with no readable post saves nothing and the link is still collected', async () => {
  const { post, snapshotId } = await setup('EXPIRED');
  records = [];
  await collectLateVendorResults();
  assert.equal((await fx.readPost(post.id)).imageUrl, fx.expiredUrl(`lh${counter - 1}-c`));
  assert.equal((await readLink(snapshotId)).status, 'COLLECTED');
});

test('the handler ignores a job whose input is not a post id', async () => {
  const outcome = await reextractLateResultHandler({ jobId: 'j', input: { nope: true }, records: [{}] });
  assert.deepEqual(outcome, { outcome: 'NO_CHANGE' });
  registerLateResultHandler(REEXTRACT_POST_JOB_TYPE, reextractLateResultHandler); // keep the registration other tests rely on
});
