import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';
import { cancelJob } from './cancel-job.js';
import { createFixtures } from './job-engine-test-support.js';

// Story 10.3 Task 5 (AC6) -- cancelJob: owner only, guarded, releases the place and the slot, promotes, settles followers.

const fx = createFixtures('cancel');
test.after(fx.cleanup);
test.beforeEach(() => fx.stubInvoke());

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

test('cancelJob', async (t) => {
  await t.test('ends an owned job FAILED / CANCELLED and promotes the next queued job', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const r = await admitJob({ type, inputKey: `c-${i}`, ownerUserId: owner });
      assert.ok('jobId' in r);
      ids.push(r.jobId);
    }
    assert.equal(await cancelJob(ids[0], owner), 'CANCELLED');
    const row = await read(ids[0]);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'CANCELLED');
    assert.ok(row.finishedAt instanceof Date);
    assert.equal(row.workerClaimedAt, null);
    assert.ok((await read(ids[3])).admittedAt instanceof Date, 'the queued job took the place');
    assert.deepEqual(fx.invoked, [ids[3]]);
  });

  await t.test('another user cannot cancel it, and an ended or unknown job is untouched', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const other = await fx.makeUser();
    const r = await admitJob({ type, inputKey: 'mine', ownerUserId: owner });
    assert.ok('jobId' in r);
    assert.equal(await cancelJob(r.jobId, other), 'NOT_CANCELLABLE');
    assert.equal((await read(r.jobId)).status, 'QUEUED');

    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, r.jobId));
    assert.equal(await cancelJob(r.jobId, owner), 'NOT_CANCELLABLE');
    assert.equal((await read(r.jobId)).status, 'SUCCEEDED');
    assert.equal(await cancelJob('00000000-0000-4000-8000-000000000000', owner), 'NOT_CANCELLABLE');
  });

  await t.test('cancelling releases the reserved subscription slot', async () => {
    const type = fx.defineType({ reservesSubscriptionSlot: true });
    const owner = await fx.makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await admitJob({ type, inputKey: `s-${i}`, ownerUserId: owner });
      assert.ok('jobId' in r, `slot ${i}`);
      ids.push(r.jobId);
    }
    const sixth = await admitJob({ type, inputKey: 's-5', ownerUserId: owner });
    assert.equal((sixth as { refused?: string }).refused, 'SUBSCRIPTION_CAP_REACHED');
    assert.equal(await cancelJob(ids[4], owner), 'CANCELLED');
    const retry = await admitJob({ type, inputKey: 's-5', ownerUserId: owner });
    assert.ok('outcome' in retry);
  });

  await t.test('cancelling a queued job (no place held) works and promotes nothing extra', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const r = await admitJob({ type, inputKey: `q-${i}`, ownerUserId: owner });
      assert.ok('jobId' in r);
      ids.push(r.jobId);
    }
    assert.equal(await cancelJob(ids[3], owner), 'CANCELLED');
    assert.deepEqual(fx.invoked, []);
  });

  await t.test('cancelling a leader settles its followers with the same ending', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true });
    const a = await fx.makeUser();
    const b = await fx.makeUser();
    const leader = await admitJob({ type, inputKey: 'pub', ownerUserId: a });
    const follower = await admitJob({ type, inputKey: 'pub', ownerUserId: b });
    assert.ok('jobId' in leader && 'jobId' in follower);
    assert.equal(await cancelJob(leader.jobId, a), 'CANCELLED');
    const row = await read(follower.jobId);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'CANCELLED');
  });
});
