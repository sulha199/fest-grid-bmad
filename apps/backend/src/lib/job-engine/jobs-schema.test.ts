import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobs, jobAttempts, users } from '@festgrid/database';
import { db } from '../../db/client.js';

// Story 10.1a Task 1 -- the shape and constraints of the `jobs` / `job_attempts` tables
// (PRD 3.18, FR117 statuses, FR130 trigger). Real local Postgres, no mocks.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdJobIds: string[] = [];
const createdUserIds: string[] = [];

async function makeUser(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `jobs-schema-${suffix}-${createdUserIds.length}@example.test` })
    .returning({ id: users.id });
  createdUserIds.push(user.id);
  return user.id;
}

function baseJob(overrides: Partial<typeof jobs.$inferInsert> = {}): typeof jobs.$inferInsert {
  return {
    type: 'test-fixture',
    trigger: 'USER',
    inputKey: `fixture:${suffix}`,
    deadlineAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

async function insertJob(overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const [job] = await db.insert(jobs).values(baseJob(overrides)).returning();
  createdJobIds.push(job.id);
  return job;
}

test.after(async () => {
  if (createdJobIds.length > 0) {
    await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

test('jobs table', async (t) => {
  await t.test('a USER job with an owner is accepted and gets the documented defaults', async () => {
    const ownerUserId = await makeUser();
    const job = await insertJob({ ownerUserId });
    assert.equal(job.status, 'QUEUED');
    assert.equal(job.trigger, 'USER');
    assert.equal(job.ownerUserId, ownerUserId);
    assert.equal(job.completedAfterDeadline, false);
    assert.equal(job.admittedAt, null);
    assert.equal(job.resumeAt, null);
    assert.equal(job.workerClaimedAt, null);
    assert.equal(job.phase, null);
  });

  await t.test('the CHECK refuses a USER job with no owner (FR130)', async () => {
    await assert.rejects(
      () => db.insert(jobs).values(baseJob({ trigger: 'USER', ownerUserId: null })),
      (err: unknown) => {
        const message = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
        assert.match(message, /jobs_user_job_has_owner/);
        return true;
      }
    );
  });

  await t.test('the CHECK accepts a SYSTEM job with no owner (FR130, data only)', async () => {
    const job = await insertJob({ trigger: 'SYSTEM', ownerUserId: null });
    assert.equal(job.trigger, 'SYSTEM');
    assert.equal(job.ownerUserId, null);
  });

  await t.test('WAITING is a valid status (FR117)', async () => {
    const ownerUserId = await makeUser();
    const job = await insertJob({ ownerUserId, status: 'WAITING', resumeAt: new Date(Date.now() + 5 * 60_000) });
    assert.equal(job.status, 'WAITING');
    assert.ok(job.resumeAt instanceof Date);
  });

  await t.test('an unknown status is refused by the enum', async () => {
    const ownerUserId = await makeUser();
    await assert.rejects(() =>
      db.insert(jobs).values(baseJob({ ownerUserId, status: 'PAUSED' as never }))
    );
  });
});

test('job_attempts table', async (t) => {
  await t.test('an attempt row references its job and is deleted with it', async () => {
    const ownerUserId = await makeUser();
    const job = await insertJob({ ownerUserId });
    const [attempt] = await db
      .insert(jobAttempts)
      .values({ jobId: job.id, provider: 'BRIGHTDATA', outcome: 'TIMED_OUT', budgetMs: 150_000, elapsedMs: 150_001 })
      .returning();
    assert.equal(attempt.scraperActorRunId, null);
    assert.equal(attempt.reasonCode, null);

    await db.delete(jobs).where(eq(jobs.id, job.id));
    const remaining = await db.select().from(jobAttempts).where(eq(jobAttempts.jobId, job.id));
    assert.equal(remaining.length, 0);
  });

  await t.test('an attempt for a job that does not exist is refused', async () => {
    await assert.rejects(() =>
      db.insert(jobAttempts).values({
        jobId: '00000000-0000-4000-8000-000000000000',
        provider: 'APIFY',
        outcome: 'FAILED',
        budgetMs: 1,
        elapsedMs: 1,
      })
    );
  });
});
