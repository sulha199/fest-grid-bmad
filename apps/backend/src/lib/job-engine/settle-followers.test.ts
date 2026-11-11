import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { failOrphanedFollowers, settleFollowers } from './settle-followers.js';

// Story 10.3 Task 5 (AC2) -- followers take the leader's ending, idempotently; orphans fail with LEADER_LOST.

const fx = createFixtures('settle');
test.after(fx.cleanup);
test.beforeEach(() => fx.stubInvoke());

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

async function leaderWithFollowers(n: number) {
  const type = fx.defineType({ sharedAcrossUsers: true });
  const a = await fx.makeUser();
  const leader = await admitJob({ type, inputKey: 'pub', ownerUserId: a });
  assert.ok('jobId' in leader);
  const followers: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = await admitJob({ type, inputKey: 'pub', ownerUserId: await fx.makeUser() });
    assert.ok('outcome' in f && f.outcome === 'SHARED');
    followers.push(f.jobId);
  }
  return { leaderId: leader.jobId, followers };
}

test('settleFollowers', async (t) => {
  await t.test('while the leader is still open nothing is settled', async () => {
    const { leaderId, followers } = await leaderWithFollowers(2);
    assert.equal(await settleFollowers(leaderId), 0);
    assert.equal((await read(followers[0])).status, 'WAITING');
  });

  await t.test('every follower takes the leader\'s status, reason, result, message and finish time', async () => {
    const { leaderId, followers } = await leaderWithFollowers(2);
    const finishedAt = new Date();
    await db
      .update(jobs)
      .set({
        status: 'SUCCEEDED_WITH_LIMITS',
        reasonCode: 'STORED_IMAGES_USED',
        resultData: { posts: 3 },
        completedAfterDeadline: true,
        finishedAt,
      })
      .where(eq(jobs.id, leaderId));
    assert.equal(await settleFollowers(leaderId), 2);
    for (const id of followers) {
      const row = await read(id);
      assert.equal(row.status, 'SUCCEEDED_WITH_LIMITS');
      assert.equal(row.reasonCode, 'STORED_IMAGES_USED');
      assert.deepEqual(row.resultData, { posts: 3 });
      assert.equal(row.completedAfterDeadline, true);
      assert.equal(row.finishedAt?.getTime(), finishedAt.getTime());
      assert.equal(row.workerClaimedAt, null);
    }
  });

  await t.test('settling twice is idempotent and never rewrites a follower that already ended', async () => {
    const { leaderId, followers } = await leaderWithFollowers(1);
    await db.update(jobs).set({ status: 'FAILED', reasonCode: 'X', errorMessage: 'plain words', finishedAt: new Date() }).where(eq(jobs.id, leaderId));
    assert.equal(await settleFollowers(leaderId), 1);
    const first = await read(followers[0]);
    assert.equal(first.errorMessage, 'plain words');
    assert.equal(await settleFollowers(leaderId), 0);
    assert.equal((await read(followers[0])).updatedAt.getTime(), first.updatedAt.getTime());
  });

  await t.test('an unknown leader settles nothing', async () => {
    assert.equal(await settleFollowers('00000000-0000-4000-8000-000000000000'), 0);
  });

  await t.test('a follower whose leader row was deleted fails with LEADER_LOST', async () => {
    const { leaderId, followers } = await leaderWithFollowers(2);
    await db.delete(jobs).where(eq(jobs.id, leaderId));
    const orphan = await read(followers[0]);
    assert.equal(orphan.leaderJobId, null, 'ON DELETE SET NULL');
    assert.equal(orphan.status, 'WAITING');
    const failed = await failOrphanedFollowers('following-leader');
    assert.ok(failed >= 2);
    for (const id of followers) {
      const row = await read(id);
      assert.equal(row.status, 'FAILED');
      assert.equal(row.reasonCode, 'LEADER_LOST');
    }
  });

  await t.test('an ordinary WAITING job (not a follower) is never failed as an orphan', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const r = await admitJob({ type, inputKey: 'plain', ownerUserId: owner });
    assert.ok('jobId' in r);
    await db.update(jobs).set({ status: 'WAITING', phase: 'waiting-retry' }).where(eq(jobs.id, r.jobId));
    await failOrphanedFollowers('following-leader');
    assert.equal((await read(r.jobId)).status, 'WAITING');
  });
});
