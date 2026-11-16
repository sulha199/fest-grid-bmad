import test from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { jobs, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { db } from '../../db/client.js';
import { startJob } from './start-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { registerJobHandler } from './job-registry.js';
import { runJobEngineJob } from './run-job.js';
import { sweepExpiredEngineJobs } from './sweep-expired-jobs.js';
import { settleOrphanedAndFinishedFollowers } from './sweep-job-queue.js';

// Story 10.3 Task 8 (AC10 a, b, c, e, f) -- simultaneous starts against real Postgres. The user row lock serializes
// admission, so the counts below are exact, never "about". (d), two simultaneous subscribeToAccount calls, is in
// schema/subscriptions.test.ts next to the existing subscribe tests.

const fx = createFixtures('concur');
const profileIds: string[] = [];
test.after(async () => {
  await fx.cleanup();
  if (profileIds.length > 0) {
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
  }
});
test.beforeEach(() => fx.stubInvoke());

async function giveSubscriptions(userId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ platform: 'instagram', accountId: `concur-${fx.suffix}-${profileIds.length}`, username: `concur-${fx.suffix}-${profileIds.length}`, displayName: 'x' })
      .returning({ id: socialMediaAccountProfiles.id });
    profileIds.push(profile.id);
    await db.insert(subscriptions).values({ userId, accountId: profile.id });
  }
}

test('admission under concurrency', async (t) => {
  await t.test('(a) six simultaneous starts for one user: exactly three are admitted, three queued, none lost, none duplicated', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => startJob(type, { inputKey: `a-${i}` }, owner))
    );
    const outcomes = results.map((r) => (r as { outcome?: string }).outcome);
    assert.equal(outcomes.filter((o) => o === 'ADMITTED').length, 3);
    assert.equal(outcomes.filter((o) => o === 'QUEUED').length, 3);
    const rows = await db.select().from(jobs).where(eq(jobs.ownerUserId, owner));
    assert.equal(rows.length, 6);
    assert.equal(new Set(rows.map((r) => r.id)).size, 6);
    assert.equal(rows.filter((r) => r.admittedAt !== null).length, 3);
    assert.equal(rows.filter((r) => r.admittedAt === null).length, 3);
    assert.equal(fx.invoked.length, 3, 'only admitted jobs were invoked');
    const positions = results.filter((r) => (r as { outcome?: string }).outcome === 'QUEUED').map((r) => (r as { position: number }).position);
    assert.deepEqual([...positions].sort(), [1, 2, 3], 'queue positions are unique');
  });

  await t.test('(b) five slot-reserving starts for a user holding none: three admitted, two queued; a sixth is refused by the cap, not the job limit', async () => {
    const type = fx.defineType({ reservesSubscriptionSlot: true });
    const owner = await fx.makeUser();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => startJob(type, { inputKey: `b-${i}` }, owner))
    );
    const outcomes = results.map((r) => (r as { outcome?: string }).outcome);
    assert.equal(outcomes.filter((o) => o === 'ADMITTED').length, 3);
    assert.equal(outcomes.filter((o) => o === 'QUEUED').length, 2);
    const sixth = await startJob(type, { inputKey: 'b-5' }, owner);
    assert.equal((sixth as { errorCode?: string }).errorCode, 'SUBSCRIPTION_CAP_REACHED');
    assert.deepEqual((sixth as { details?: unknown }).details, { activeCount: 0, reservedCount: 5, cap: 5 });
  });

  await t.test('(c) two simultaneous slot-reserving starts for a user holding four subscriptions: exactly one succeeds', async () => {
    const type = fx.defineType({ reservesSubscriptionSlot: true });
    const owner = await fx.makeUser();
    await giveSubscriptions(owner, 4);
    const results = await Promise.all([
      startJob(type, { inputKey: 'c-1' }, owner),
      startJob(type, { inputKey: 'c-2' }, owner),
    ]);
    const ok = results.filter((r) => 'jobId' in r);
    const refused = results.filter((r) => (r as { errorCode?: string }).errorCode === 'SUBSCRIPTION_CAP_REACHED');
    assert.equal(ok.length, 1);
    assert.equal(refused.length, 1);
    assert.equal((await db.select().from(jobs).where(eq(jobs.ownerUserId, owner))).length, 1);
  });

  await t.test('(e) the same input started eight times at once yields one job and one invoke', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const results = await Promise.all(Array.from({ length: 8 }, () => startJob(type, { inputKey: 'same' }, owner)));
    const ids = new Set(results.map((r) => (r as { jobId: string }).jobId));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((r) => (r as { outcome?: string }).outcome === 'ADMITTED').length, 1);
    assert.equal(results.filter((r) => (r as { outcome?: string }).outcome === 'REUSED').length, 7);
    assert.equal((await db.select().from(jobs).where(eq(jobs.ownerUserId, owner))).length, 1);
    assert.equal(fx.invoked.length, 1);
  });

  await t.test('(e) the partial unique index is the backstop: a second open row for one owner, type and key cannot be written', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const first = await startJob(type, { inputKey: 'dupe' }, owner);
    assert.ok('jobId' in first);
    await assert.rejects(
      db.insert(jobs).values({
        type,
        ownerUserId: owner,
        trigger: 'USER',
        inputKey: 'dupe',
        admittedAt: new Date(),
        deadlineAt: new Date(Date.now() + 1000),
      }),
      /uq_jobs_open_input|duplicate key/
    );
    // an ended job does not block a new one
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, first.jobId));
    await db.insert(jobs).values({ type, ownerUserId: owner, trigger: 'USER', inputKey: 'dupe', deadlineAt: new Date(Date.now() + 1000) });
    // a follower (leader set) is outside the index
    const [leader] = await db.select().from(jobs).where(and(eq(jobs.ownerUserId, owner), isNull(jobs.finishedAt)));
    await db.insert(jobs).values({
      type,
      ownerUserId: owner,
      trigger: 'USER',
      inputKey: 'dupe',
      status: 'WAITING',
      leaderJobId: leader.id,
      deadlineAt: new Date(Date.now() + 1000),
    });
  });

  await t.test('(f) a follower settles with its leader\'s outcome when the leader finishes in the worker', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true });
    registerJobHandler(type, { run: async () => ({ outcome: 'SUCCEEDED', resultData: { public: true } }) });
    const a = await fx.makeUser();
    const [b, c] = [await fx.makeUser(), await fx.makeUser()];
    const [leader, f1, f2] = await Promise.all([
      startJob(type, { inputKey: 'pub' }, a),
      (async () => {
        await new Promise((r) => setTimeout(r, 50));
        return startJob(type, { inputKey: 'pub' }, b);
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 50));
        return startJob(type, { inputKey: 'pub' }, c);
      })(),
    ]);
    assert.ok('jobId' in leader && 'jobId' in f1 && 'jobId' in f2);
    assert.equal((f1 as { outcome: string }).outcome, 'SHARED');
    assert.equal((f2 as { outcome: string }).outcome, 'SHARED');
    await runJobEngineJob(leader.jobId, {});
    for (const id of [f1.jobId, f2.jobId]) {
      const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
      assert.equal(row.status, 'SUCCEEDED');
      assert.deepEqual(row.resultData, { public: true });
    }
  });

  await t.test('(f) ... and when the leader is expired by the sweep, the sweep settles the follower with it', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true });
    const a = await fx.makeUser();
    const b = await fx.makeUser();
    const leader = await startJob(type, { inputKey: 'pub-sweep' }, a);
    const follower = await startJob(type, { inputKey: 'pub-sweep' }, b);
    assert.ok('jobId' in leader && 'jobId' in follower);
    await db.update(jobs).set({ status: 'RUNNING', deadlineAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, leader.jobId));
    await sweepExpiredEngineJobs();
    await settleOrphanedAndFinishedFollowers();
    const [row] = await db.select().from(jobs).where(eq(jobs.id, follower.jobId));
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.reasonCode, 'TIMED_OUT');
  });
});
