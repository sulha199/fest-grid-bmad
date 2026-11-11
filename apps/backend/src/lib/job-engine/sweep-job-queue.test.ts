import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { sweepExpiredEngineJobs } from './sweep-expired-jobs.js';
import {
  expireQueuedJobsWaitedTooLong,
  promoteOwnersWithQueuedJobs,
  readmitDueWaitingJobs,
  settleOrphanedAndFinishedFollowers,
} from './sweep-job-queue.js';

// Story 10.3 Task 6 (AC2, AC4, AC5) -- the admission steps of the 5-minute sweep.

const fx = createFixtures('sweepq');
test.after(fx.cleanup);
test.beforeEach(() => fx.stubInvoke());

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

async function fill(type: string, owner: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = await admitJob({ type, inputKey: `k-${i}`, ownerUserId: owner });
    assert.ok('jobId' in r);
    ids.push(r.jobId);
  }
  return ids;
}

test('expireQueuedJobsWaitedTooLong', async (t) => {
  await t.test('a job queued longer than JOB_QUEUE_MAX_WAIT_MINUTES ends EXPIRED / WAITED_TOO_LONG; a fresh one and an admitted one do not', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await fill(type, owner, 5); // 3 admitted, ids[3], ids[4] queued
    await db.update(jobs).set({ queuedSince: new Date(Date.now() - 31 * 60_000) }).where(eq(jobs.id, ids[3]));
    await db.update(jobs).set({ admittedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(jobs.id, ids[0]));
    await expireQueuedJobsWaitedTooLong();
    const expired = await read(ids[3]);
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.reasonCode, 'WAITED_TOO_LONG');
    assert.ok(expired.finishedAt instanceof Date);
    assert.equal((await read(ids[4])).status, 'QUEUED');
    assert.equal((await read(ids[0])).status, 'QUEUED', 'an admitted job is bounded by its deadline, not the queue wait');
  });

  await t.test('the wait is counted from queued_since and honours the setting', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await fill(type, owner, 4);
    await db.update(jobs).set({ queuedSince: new Date(Date.now() - 10 * 60_000) }).where(eq(jobs.id, ids[3]));
    await expireQueuedJobsWaitedTooLong();
    assert.equal((await read(ids[3])).status, 'QUEUED');
    process.env.JOB_QUEUE_MAX_WAIT_MINUTES = '5';
    try {
      await expireQueuedJobsWaitedTooLong();
    } finally {
      delete process.env.JOB_QUEUE_MAX_WAIT_MINUTES;
    }
    assert.equal((await read(ids[3])).status, 'EXPIRED');
  });
});

test('readmitDueWaitingJobs', async (t) => {
  await t.test('re-admits WAITING jobs whose resume time is due; leaves future, event-waiting and follower jobs', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await fill(type, owner, 3);
    for (const id of ids) {
      await db.update(jobs).set({ status: 'WAITING', phase: 'waiting-retry' }).where(eq(jobs.id, id));
    }
    await db.update(jobs).set({ resumeAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, ids[0]));
    await db.update(jobs).set({ resumeAt: new Date(Date.now() + 600_000) }).where(eq(jobs.id, ids[1]));
    // ids[2]: no resume time (waits for an event)
    assert.ok((await readmitDueWaitingJobs()) >= 1);
    assert.equal((await read(ids[0])).status, 'QUEUED');
    assert.ok(fx.invoked.includes(ids[0]));
    assert.equal((await read(ids[1])).status, 'WAITING');
    assert.equal((await read(ids[2])).status, 'WAITING');
  });
});

test('settleOrphanedAndFinishedFollowers', async (t) => {
  await t.test('settles followers whose leader the sweep itself expired (AC10f) and fails orphans', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true, maxDurationMs: 60_000 });
    const a = await fx.makeUser();
    const b = await fx.makeUser();
    const c = await fx.makeUser();
    const leader = await admitJob({ type, inputKey: 'pub', ownerUserId: a });
    const follower = await admitJob({ type, inputKey: 'pub', ownerUserId: b });
    assert.ok('jobId' in leader && 'jobId' in follower);
    // the leader's worker died: its deadline passes and the deadline sweep expires it
    await db.update(jobs).set({ status: 'RUNNING', deadlineAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, leader.jobId));
    await sweepExpiredEngineJobs();
    assert.equal((await read(leader.jobId)).status, 'EXPIRED');
    assert.equal((await read(follower.jobId)).status, 'WAITING', 'not settled yet');
    assert.ok((await settleOrphanedAndFinishedFollowers()) >= 1);
    const row = await read(follower.jobId);
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.reasonCode, 'TIMED_OUT');

    // an orphan: leader row deleted
    const leader2 = await admitJob({ type, inputKey: 'pub2', ownerUserId: a });
    const orphan = await admitJob({ type, inputKey: 'pub2', ownerUserId: c });
    assert.ok('jobId' in leader2 && 'jobId' in orphan);
    await db.delete(jobs).where(eq(jobs.id, leader2.jobId));
    await settleOrphanedAndFinishedFollowers();
    assert.equal((await read(orphan.jobId)).reasonCode, 'LEADER_LOST');
  });
});

test('promoteOwnersWithQueuedJobs', async (t) => {
  await t.test('a lost wake-up cannot strand a queued job: the sweep gives it the free place', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const other = await fx.makeUser();
    const ids = await fill(type, owner, 4);
    const otherIds = await fill(type, other, 4);
    // two places freed with no promotion (the worker that would have promoted never ran)
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, ids[0]));
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, otherIds[0]));
    assert.ok((await promoteOwnersWithQueuedJobs()) >= 2);
    assert.ok((await read(ids[3])).admittedAt instanceof Date);
    assert.ok((await read(otherIds[3])).admittedAt instanceof Date);
    assert.ok(fx.invoked.includes(ids[3]) && fx.invoked.includes(otherIds[3]));
  });
});
