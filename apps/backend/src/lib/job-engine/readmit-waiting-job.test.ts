import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { readmitWaitingJob } from './readmit-waiting-job.js';

// Story 10.3 Task 5 (AC5) -- a WAITING job is re-admitted like a new start: it joins the queue, then takes the next free
// place or waits its turn. Followers and ended jobs are never re-admitted.

const fx = createFixtures('readmit');
test.after(fx.cleanup);
test.beforeEach(() => fx.stubInvoke());

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

async function waitingJob(type: string, owner: string, key = 'w') {
  const r = await admitJob({ type, inputKey: key, ownerUserId: owner });
  assert.ok('jobId' in r);
  await db
    .update(jobs)
    .set({ status: 'WAITING', phase: 'waiting-retry', resumeAt: new Date(Date.now() - 1000), workerClaimedAt: null })
    .where(eq(jobs.id, r.jobId));
  return r.jobId;
}

test('readmitWaitingJob', async (t) => {
  await t.test('with a free place the job is queued and promoted at once: admitted, deadline re-set, host invoked, phase kept', async () => {
    const type = fx.defineType({ maxDurationMs: 120_000 });
    const owner = await fx.makeUser();
    const id = await waitingJob(type, owner);
    assert.equal(await readmitWaitingJob(id), 'READMITTED');
    const row = await read(id);
    assert.equal(row.status, 'QUEUED');
    assert.ok(row.admittedAt instanceof Date);
    assert.equal(row.resumeAt, null);
    assert.equal(row.phase, 'waiting-retry');
    assert.equal(row.deadlineAt.getTime() - row.admittedAt.getTime(), 120_000);
    assert.deepEqual(fx.invoked, [id]);
  });

  await t.test('with no free place it waits its turn in the queue and is not invoked', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const id = await waitingJob(type, owner);
    for (let i = 0; i < 3; i += 1) {
      await admitJob({ type, inputKey: `busy-${i}`, ownerUserId: owner });
    }
    assert.equal(await readmitWaitingJob(id), 'READMITTED');
    const row = await read(id);
    assert.equal(row.status, 'QUEUED');
    assert.equal(row.admittedAt, null);
    assert.ok(row.queuedSince instanceof Date);
    assert.deepEqual(fx.invoked, []);
  });

  await t.test('a job that is not WAITING, or is unknown, is left alone', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const r = await admitJob({ type, inputKey: 'running', ownerUserId: owner });
    assert.ok('jobId' in r);
    assert.equal(await readmitWaitingJob(r.jobId), 'NOT_WAITING');
    assert.equal(await readmitWaitingJob('00000000-0000-4000-8000-000000000000'), 'NOT_WAITING');
  });

  await t.test('a follower is never re-admitted: it waits on its leader, not on time', async () => {
    const type = fx.defineType({ sharedAcrossUsers: true });
    const a = await fx.makeUser();
    const b = await fx.makeUser();
    await admitJob({ type, inputKey: 'pub', ownerUserId: a });
    const follower = await admitJob({ type, inputKey: 'pub', ownerUserId: b });
    assert.ok('outcome' in follower && follower.outcome === 'SHARED');
    await db.update(jobs).set({ resumeAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, follower.jobId));
    assert.equal(await readmitWaitingJob(follower.jobId), 'NOT_WAITING');
    assert.equal((await read(follower.jobId)).status, 'WAITING');
  });

  await t.test('a WAITING job already past its whole-job deadline is left for the deadline sweep', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const id = await waitingJob(type, owner);
    await db.update(jobs).set({ deadlineAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, id));
    assert.equal(await readmitWaitingJob(id), 'NOT_WAITING');
    assert.equal((await read(id)).status, 'WAITING');
  });

  await t.test('a type without a definition in this Lambda stays WAITING', async () => {
    const type = fx.defineType();
    const owner = await fx.makeUser();
    const id = await waitingJob(type, owner);
    await db.update(jobs).set({ type: `unknown-${fx.suffix}` }).where(eq(jobs.id, id));
    assert.equal(await readmitWaitingJob(id), 'UNKNOWN_JOB_TYPE');
    assert.equal((await read(id)).status, 'WAITING');
  });

  await t.test('a SYSTEM job is admitted at once and uses no user place (FR130)', async () => {
    const type = fx.defineType();
    const [system] = await db
      .insert(jobs)
      .values({
        type,
        trigger: 'SYSTEM',
        ownerUserId: null,
        inputKey: `sys-${fx.suffix}`,
        status: 'WAITING',
        phase: 'waiting-retry',
        resumeAt: new Date(Date.now() - 1000),
        admittedAt: new Date(Date.now() - 60_000),
        deadlineAt: new Date(Date.now() + 600_000),
      })
      .returning();
    try {
      assert.equal(await readmitWaitingJob(system.id), 'READMITTED');
      const row = await read(system.id);
      assert.equal(row.status, 'QUEUED');
      assert.ok(row.admittedAt instanceof Date);
      assert.deepEqual(fx.invoked, [system.id]);
    } finally {
      await fx.deleteJobs([system.id]);
    }
  });

  await t.test('a SYSTEM job whose invoke fails ends START_FAILED', async () => {
    const type = fx.defineType();
    fx.stubInvoke(new Error('refused'));
    const [system] = await db
      .insert(jobs)
      .values({
        type,
        trigger: 'SYSTEM',
        ownerUserId: null,
        inputKey: `sys2-${fx.suffix}`,
        status: 'WAITING',
        admittedAt: new Date(),
        deadlineAt: new Date(Date.now() + 600_000),
      })
      .returning();
    try {
      await readmitWaitingJob(system.id);
      const row = await read(system.id);
      assert.equal(row.status, 'FAILED');
      assert.equal(row.reasonCode, 'START_FAILED');
    } finally {
      await fx.deleteJobs([system.id]);
    }
  });
});
