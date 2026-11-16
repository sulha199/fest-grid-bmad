import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { REEXTRACT_STALE_AFTER_MS, reextractPostInputKey } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { createFixtures } from '../job-engine/job-engine-test-support.js';
import { createReextractFixtures } from './reextract-test-support.js';
import { STUCK_JOB_CANCEL_MESSAGE, startReextractPostJob } from './start-reextract-post-job.js';

// Story 10.6 (owner decision 2026-11-12, rule B) -- a re-click joins the open job for the post, EXCEPT a job with no progress for five
// minutes, which is cancelled (plainly) and replaced. The rule is in the re-extract start path only. No Lambda is invoked (stub).

const fx = createReextractFixtures('stale');
const engine = createFixtures('stale');
let moderator: string;
let accountId: string;

test.before(async () => {
  engine.stubInvoke();
  moderator = await fx.makeUser();
  accountId = (await fx.makeAccount()).id;
});
test.after(async () => {
  await fx.cleanup();
  await engine.cleanup();
});

const ago = (ms: number) => new Date(Date.now() - ms);
const target = (postId: string) => ({ inputKey: reextractPostInputKey(postId), payload: { postId } });
const openJobsOf = async (postId: string) => (await db.select().from(jobs).where(eq(jobs.inputKey, reextractPostInputKey(postId)))).filter((j) => !['SUCCEEDED', 'SUCCEEDED_WITH_LIMITS', 'FAILED', 'EXPIRED'].includes(j.status));

test('a job with progress inside the five minutes is reused: the same job id comes back, nothing is cancelled', async () => {
  const post = await fx.makePost(accountId);
  const open = await fx.makeJob(post.id, moderator, { updatedAt: ago(REEXTRACT_STALE_AFTER_MS - 60_000) });
  assert.deepEqual(await startReextractPostJob(moderator, target(post.id)), { jobId: open.id });
  assert.equal((await fx.readJob(open.id)).status, 'RUNNING');
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, open.id));
});

test('a job idle for more than five minutes is cancelled with a plain reason and a fresh job is started in its place', async () => {
  const post = await fx.makePost(accountId);
  const stuck = await fx.makeJob(post.id, moderator, {
    updatedAt: ago(REEXTRACT_STALE_AFTER_MS + 60_000),
    input: { postId: post.id, held: { content: 'a held caption', postUrl: post.postUrl, publishedAt: '2026-10-01T00:00:00.000Z' } },
  });
  const started = await startReextractPostJob(moderator, target(post.id));
  assert.ok('jobId' in started);
  assert.notEqual(started.jobId, stuck.id);

  const old = await fx.readJob(stuck.id);
  assert.equal(old.status, 'FAILED');
  assert.equal(old.reasonCode, 'CANCELLED');
  assert.equal(old.errorMessage, STUCK_JOB_CANCEL_MESSAGE);
  assert.match(old.errorMessage ?? '', /no progress for 5 minutes/);
  assert.ok(old.finishedAt);
  assert.equal(old.workerClaimedAt, null);
  assert.deepEqual(old.input, { postId: post.id }, 'a held caption does not survive the cancel');

  const fresh = await fx.readJob(started.jobId);
  assert.equal(fresh.status, 'QUEUED');
  assert.ok(fresh.admittedAt, 'the new job was admitted into the place the cancelled one released');
  assert.deepEqual((await openJobsOf(post.id)).map((j) => j.id), [started.jobId], 'exactly one open job for the post');
  assert.ok(engine.invoked.includes(started.jobId), 'and it was started');
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, started.jobId));
});

test('the cancelled job\'s place is released: with the limit full of stuck jobs, the replacement still gets a place instead of queueing', async () => {
  const user = await fx.makeUser();
  const posts3 = [await fx.makePost(accountId), await fx.makePost(accountId), await fx.makePost(accountId)];
  for (const p of posts3) await fx.makeJob(p.id, user, { updatedAt: ago(REEXTRACT_STALE_AFTER_MS + 120_000) }); // three places held, all stuck
  const started = await startReextractPostJob(user, target(posts3[0].id));
  assert.ok('jobId' in started);
  const fresh = await fx.readJob(started.jobId);
  assert.ok(fresh.admittedAt, 'admitted (a place was free once the stuck job was cancelled), not queued behind the other two');
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.ownerUserId, user));
});

test('a job still waiting in the queue for a place is not stuck: it is reused however long it has waited', async () => {
  const post = await fx.makePost(accountId);
  const waiting = await fx.makeJob(post.id, moderator, {
    status: 'QUEUED',
    admittedAt: null,
    queuedSince: ago(20 * 60_000),
    updatedAt: ago(20 * 60_000),
  });
  assert.deepEqual(await startReextractPostJob(moderator, target(post.id)), { jobId: waiting.id });
  assert.equal((await fx.readJob(waiting.id)).status, 'QUEUED');
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, waiting.id));
});

test('another user\'s idle job is never touched, and an ended job is simply followed by a new one', async () => {
  const post = await fx.makePost(accountId);
  const other = await fx.makeUser();
  const theirs = await fx.makeJob(post.id, other, { updatedAt: ago(REEXTRACT_STALE_AFTER_MS + 60_000) });
  const started = await startReextractPostJob(moderator, target(post.id));
  assert.ok('jobId' in started && started.jobId !== theirs.id);
  assert.equal((await fx.readJob(theirs.id)).status, 'RUNNING', 'owner-scoped: only the moderator\'s own job is ever replaced');
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, started.jobId));
  await db.update(jobs).set({ status: 'SUCCEEDED' }).where(eq(jobs.id, theirs.id));
  const again = await startReextractPostJob(moderator, target(post.id));
  assert.ok('jobId' in again && again.jobId !== started.jobId);
});
