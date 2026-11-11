import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobs, users } from '@festgrid/database';
import { db } from '../../db/client.js';
import { sweepExpiredEngineJobs } from './sweep-expired-jobs.js';

// Story 10.1a Task 4 (AC4) -- the database-only job sweep: ends admitted, non-terminal jobs past their deadline.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let owner: string;
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 600_000);

async function insertJob(overrides: Partial<typeof jobs.$inferInsert>) {
  const [job] = await db
    .insert(jobs)
    .values({
      type: 'fixture-sweep',
      ownerUserId: owner,
      trigger: 'USER',
      inputKey: `k-${suffix}-${Math.random()}`,
      admittedAt: new Date(Date.now() - 120_000),
      deadlineAt: future(),
      ...overrides,
    })
    .returning();
  return job;
}
const readJob = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

test.before(async () => {
  const [user] = await db.insert(users).values({ email: `sweep-jobs-${suffix}@example.test` }).returning({ id: users.id });
  owner = user.id;
});
test.after(async () => {
  await db.delete(users).where(inArray(users.id, [owner]));
});

test('sweepExpiredEngineJobs', async (t) => {
  await t.test('a RUNNING, a WAITING and an admitted QUEUED job past their deadline end EXPIRED/TIMED_OUT, claim cleared', async () => {
    const running = await insertJob({ status: 'RUNNING', workerClaimedAt: new Date(), deadlineAt: past() });
    const waiting = await insertJob({ status: 'WAITING', resumeAt: future(), deadlineAt: past() });
    const queued = await insertJob({ status: 'QUEUED', deadlineAt: past() });
    const count = await sweepExpiredEngineJobs();
    assert.ok(count >= 3, `swept ${count}`);
    for (const job of [running, waiting, queued]) {
      const row = await readJob(job.id);
      assert.equal(row.status, 'EXPIRED');
      assert.equal(row.reasonCode, 'TIMED_OUT');
      assert.equal(row.workerClaimedAt, null);
      assert.ok(row.finishedAt instanceof Date);
    }
  });

  await t.test('a job not yet past its deadline is untouched', async () => {
    const running = await insertJob({ status: 'RUNNING', workerClaimedAt: new Date() });
    await sweepExpiredEngineJobs();
    const row = await readJob(running.id);
    assert.equal(row.status, 'RUNNING');
    assert.ok(row.workerClaimedAt instanceof Date);
  });

  await t.test('a job that is not admitted yet is untouched, even past a placeholder deadline (Story 10.3 bounds it)', async () => {
    const waitingForPlace = await insertJob({ status: 'QUEUED', admittedAt: null, deadlineAt: past() });
    await sweepExpiredEngineJobs();
    assert.equal((await readJob(waitingForPlace.id)).status, 'QUEUED');
  });

  await t.test('an ended job is never rewritten', async () => {
    const done = await insertJob({ status: 'SUCCEEDED', deadlineAt: past(), reasonCode: null, finishedAt: new Date() });
    await sweepExpiredEngineJobs();
    const row = await readJob(done.id);
    assert.equal(row.status, 'SUCCEEDED');
    assert.equal(row.reasonCode, null);
  });

  await t.test('the sweep takes its clock as a parameter', async () => {
    const running = await insertJob({ status: 'RUNNING', workerClaimedAt: new Date(), deadlineAt: new Date(Date.now() + 10 * 60_000) });
    await sweepExpiredEngineJobs(new Date(Date.now() + 20 * 60_000));
    assert.equal((await readJob(running.id)).status, 'EXPIRED');
  });
});
