import test from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { promoteQueuedJobs } from './promote-queued-jobs.js';

// Story 10.3 Task 5 (AC4) -- promotion: oldest first, up to the free places, deadline re-set, host invoked after commit,
// a failed invoke ends that job and the next one takes the place.

const fx = createFixtures('promote');
test.after(fx.cleanup);
test.beforeEach(() => fx.stubInvoke());

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

async function startMany(type: string, owner: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = await admitJob({ type, inputKey: `k-${i}`, ownerUserId: owner });
    assert.ok('jobId' in r);
    ids.push(r.jobId);
  }
  return ids;
}

test('promoteQueuedJobs', async (t) => {
  await t.test('with no free place nothing is promoted or invoked', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    await startMany(type, owner, 5);
    assert.equal(await promoteQueuedJobs(owner), 0);
    assert.deepEqual(fx.invoked, []);
  });

  await t.test('a freed place goes to the oldest queued job, which is admitted, gets a fresh deadline and is invoked', async () => {
    const type = fx.defineType({ maxDurationMs: 90_000 });
    const owner = await fx.makeUser();
    const ids = await startMany(type, owner, 5); // 3 admitted, ids[3] then ids[4] queued
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, ids[0]));
    // age the queue so the order is by queued_since, oldest first
    await db.update(jobs).set({ queuedSince: new Date(Date.now() - 60_000) }).where(eq(jobs.id, ids[3]));
    const before = Date.now();
    assert.equal(await promoteQueuedJobs(owner), 1);
    const promoted = await read(ids[3]);
    assert.ok(promoted.admittedAt && promoted.admittedAt.getTime() >= before - 5);
    assert.equal(promoted.deadlineAt.getTime() - promoted.admittedAt.getTime(), 90_000);
    assert.equal(promoted.status, 'QUEUED');
    assert.equal((await read(ids[4])).admittedAt, null, 'the younger job still waits');
    assert.deepEqual(fx.invoked, [ids[3]]);
  });

  await t.test('two freed places promote two jobs, oldest first, never beyond the limit', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await startMany(type, owner, 7); // 3 admitted, 4 queued
    await db.update(jobs).set({ status: 'FAILED', reasonCode: 'X', finishedAt: new Date() }).where(eq(jobs.id, ids[0]));
    await db.update(jobs).set({ status: 'FAILED', reasonCode: 'X', finishedAt: new Date() }).where(eq(jobs.id, ids[1]));
    assert.equal(await promoteQueuedJobs(owner), 2);
    assert.deepEqual([...fx.invoked].sort(), [ids[3], ids[4]].sort());
    const held = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.ownerUserId, owner), eq(jobs.status, 'QUEUED')));
    assert.equal(held.filter((j) => j.admittedAt).length, 3);
  });

  await t.test('a failed invoke ends that job START_FAILED and the next queued job takes the place', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await startMany(type, owner, 5);
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, ids[0]));
    let calls = 0;
    fx.stubInvoke();
    const { setInvokeJobEngineWorker } = await import('../aws/invoke-job-engine-worker.js');
    setInvokeJobEngineWorker(async (_fn, payload) => {
      calls += 1;
      if (calls === 1) throw new Error('refused');
      fx.invoked.push((payload as { jobId: string }).jobId);
    });
    await promoteQueuedJobs(owner);
    const failed = await read(ids[3]);
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.reasonCode, 'START_FAILED');
    assert.ok((await read(ids[4])).admittedAt instanceof Date, 'the next job took the freed place');
    assert.deepEqual(fx.invoked, [ids[4]]);
  });

  await t.test('a queued job of a sharing type is not a leader: another user starting it is admitted, not joined', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true });
    const a = await fx.makeUser();
    const b = await fx.makeUser();
    await startMany(fx.defineType(), a, 3);
    const queuedLeader = await admitJob({ type, inputKey: 'shared', ownerUserId: a });
    assert.ok('outcome' in queuedLeader);
    assert.equal(queuedLeader.outcome, 'QUEUED');
    const other = await admitJob({ type, inputKey: 'shared', ownerUserId: b });
    assert.ok('outcome' in other);
    assert.equal(other.outcome, 'ADMITTED');
  });

  await t.test('a type this Lambda has no definition for stays queued and the others are still promoted', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const ids = await startMany(type, owner, 5);
    await db.update(jobs).set({ type: `unknown-${fx.suffix}`, queuedSince: new Date(Date.now() - 120_000) }).where(eq(jobs.id, ids[3]));
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, ids[0]));
    assert.equal(await promoteQueuedJobs(owner), 1);
    assert.equal((await read(ids[3])).admittedAt, null);
    assert.ok((await read(ids[4])).admittedAt instanceof Date);
  });

  await t.test('an unknown user is a quiet no-op', async () => {
    assert.equal(await promoteQueuedJobs('00000000-0000-4000-8000-000000000000'), 0);
  });
});
