import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { manualExtractionJobs, users } from '@festgrid/database';
import { REEXTRACT_APPLY_WINDOW_MS, MANUAL_EXTRACTION_JOB_STALE_AFTER_MS, type ManualExtractionRequestPayload } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { sweepStaleManualExtractionRetention } from './sweep-stale-manual-extraction-jobs.js';

// Story 10.1a Task 4 (AC4) -- absorbs FIND-086 finding 1 (an unclaimed job keeps its caption past the stale limit) and
// FIND-111 finding 1 (an unapplied re-extract preview keeps its extraction past the Apply window).

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let owner: string;
const CAPTION = `secret caption ${suffix}`;

function payload(mode?: 'REEXTRACT_PREVIEW' | 'CORRECTION'): ManualExtractionRequestPayload {
  return {
    mode,
    message: { postId: 'p', accountId: 'a', content: CAPTION, postUrl: `https://instagram.com/p/${suffix}`, publishedAt: new Date().toISOString() },
  };
}
async function insertJob(overrides: Partial<typeof manualExtractionJobs.$inferInsert> & { ageMs?: number }) {
  const { ageMs = 0, ...rest } = overrides;
  const created = new Date(Date.now() - ageMs);
  const [job] = await db
    .insert(manualExtractionJobs)
    .values({ requestedByUserId: owner, sourceUrl: `https://instagram.com/p/${suffix}`, requestPayload: payload(), createdAt: created, ...rest })
    .returning();
  return job;
}
const readJob = async (id: string) => (await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, id)))[0];

test.before(async () => {
  const [user] = await db.insert(users).values({ email: `sweep-manual-${suffix}@example.test` }).returning({ id: users.id });
  owner = user.id;
});
test.after(async () => {
  await db.delete(users).where(inArray(users.id, [owner]));
});

test('sweepStaleManualExtractionRetention: FIND-086 (unclaimed or stuck jobs keep their caption)', async (t) => {
  await t.test('a PENDING and a PROCESSING job older than the stale limit end FAILED and lose their caption', async () => {
    const pending = await insertJob({ status: 'PENDING', ageMs: MANUAL_EXTRACTION_JOB_STALE_AFTER_MS + 60_000 });
    const processing = await insertJob({ status: 'PROCESSING', ageMs: MANUAL_EXTRACTION_JOB_STALE_AFTER_MS + 60_000 });
    await sweepStaleManualExtractionRetention();
    for (const job of [pending, processing]) {
      const row = await readJob(job.id);
      assert.equal(row.status, 'FAILED');
      assert.equal(row.errorCode, 'EXTRACTION_FAILED');
      assert.ok(row.completedAt instanceof Date);
      assert.equal(row.requestPayload.message.content, '');
    }
  });

  await t.test('a job inside the stale limit is untouched', async () => {
    const fresh = await insertJob({ status: 'PENDING', ageMs: 30_000 });
    await sweepStaleManualExtractionRetention();
    const row = await readJob(fresh.id);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.requestPayload.message.content, CAPTION);
  });
});

test('sweepStaleManualExtractionRetention: FIND-111 (an unapplied preview keeps its extraction)', async (t) => {
  const result = (extra: Record<string, unknown> = {}) => ({ postStored: true, imagesAvailable: 3, extracted: [{ eventName: 'X' }], ...extra });

  await t.test('an unapplied preview past the Apply window loses its extracted items and keeps its other fields', async () => {
    const job = await insertJob({
      status: 'SUCCEEDED',
      requestPayload: payload('REEXTRACT_PREVIEW'),
      resultData: result(),
      completedAt: new Date(Date.now() - REEXTRACT_APPLY_WINDOW_MS - 60_000),
    });
    await sweepStaleManualExtractionRetention();
    const row = await readJob(job.id);
    assert.deepEqual(row.resultData, { postStored: true, imagesAvailable: 3, extracted: null });
  });

  await t.test('a preview inside the Apply window keeps its extracted items', async () => {
    const job = await insertJob({
      status: 'SUCCEEDED',
      requestPayload: payload('REEXTRACT_PREVIEW'),
      resultData: result(),
      completedAt: new Date(Date.now() - 60_000),
    });
    await sweepStaleManualExtractionRetention();
    assert.deepEqual((await readJob(job.id)).resultData, result());
  });

  await t.test('an applied preview, and a correction job, are left exactly as they are', async () => {
    const appliedResult = result({ extracted: null, appliedAt: new Date().toISOString() });
    const applied = await insertJob({
      status: 'SUCCEEDED',
      requestPayload: payload('REEXTRACT_PREVIEW'),
      resultData: appliedResult,
      completedAt: new Date(Date.now() - REEXTRACT_APPLY_WINDOW_MS - 60_000),
    });
    const correction = await insertJob({
      status: 'SUCCEEDED',
      requestPayload: payload('CORRECTION'),
      resultData: { proposal: { eventName: 'Y' } },
      completedAt: new Date(Date.now() - REEXTRACT_APPLY_WINDOW_MS - 60_000),
    });
    await sweepStaleManualExtractionRetention();
    assert.deepEqual((await readJob(applied.id)).resultData, appliedResult);
    assert.deepEqual((await readJob(correction.id)).resultData, { proposal: { eventName: 'Y' } });
  });
});

// Story 10.6 -- the same retention for the engine's re-extract preview (PRD 5, Data Minimization).
test('sweepReextractPreviewRetention: an unapplied engine preview keeps no extraction past the Apply window', async (t) => {
  const { jobs } = await import('@festgrid/database');
  const { REEXTRACT_POST_JOB_TYPE } = await import('@festgrid/domain/jobs');
  const { sweepReextractPreviewRetention } = await import('./sweep-stale-manual-extraction-jobs.js');
  const extracted = { events: [{ eventName: 'x' }], groupingReason: 'roundup', postTitle: null, childrensDataMatch: false };
  let n = 0;
  async function insertEngineJob(overrides: Partial<typeof jobs.$inferInsert> & { finishedAgoMs?: number }) {
    const { finishedAgoMs = REEXTRACT_APPLY_WINDOW_MS + 60_000, ...rest } = overrides;
    const [job] = await db
      .insert(jobs)
      .values({
        type: REEXTRACT_POST_JOB_TYPE,
        ownerUserId: owner,
        trigger: 'USER',
        inputKey: `retention-${suffix}-${n++}`,
        status: 'SUCCEEDED',
        deadlineAt: new Date(Date.now() + 60_000),
        finishedAt: new Date(Date.now() - finishedAgoMs),
        resultData: { events: [], imagesSent: 2, refresh: { outcome: 'REFRESHED' }, extracted },
        ...rest,
      })
      .returning();
    return job;
  }
  const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

  await t.test('past the window, `extracted` is cleared and every other field of the result is kept', async () => {
    const old = await insertEngineJob({});
    const limits = await insertEngineJob({ status: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'COOLDOWN' });
    assert.ok((await sweepReextractPreviewRetention()) >= 2);
    for (const job of [old, limits]) {
      const result = (await read(job.id)).resultData as Record<string, unknown>;
      assert.equal(result.extracted, null);
      assert.equal(result.imagesSent, 2);
      assert.deepEqual(result.refresh, { outcome: 'REFRESHED' });
    }
  });

  await t.test('inside the window, an applied preview, another job type and a failed job are untouched', async () => {
    const young = await insertEngineJob({ finishedAgoMs: 60_000 });
    const applied = await insertEngineJob({ resultData: { events: [], extracted, appliedAt: new Date().toISOString(), applied: {} } });
    const other = await insertEngineJob({ type: `fixture-retention-${suffix}` });
    const failed = await insertEngineJob({ status: 'FAILED' });
    await sweepReextractPreviewRetention();
    for (const job of [young, applied, other, failed]) {
      assert.deepEqual(((await read(job.id)).resultData as { extracted: unknown }).extracted, extracted);
    }
  });

  await t.test('a second sweep has nothing left to do', async () => {
    await sweepReextractPreviewRetention();
    assert.equal(await sweepReextractPreviewRetention(), 0);
  });

  await t.test('the engine sweep\'s retention step runs it', async () => {
    const job = await insertEngineJob({});
    await sweepStaleManualExtractionRetention();
    assert.equal(((await read(job.id)).resultData as { extracted: unknown }).extracted, null);
  });
});

// Owner decision 2026-11-12 -- the backstop that blanks a post held on a re-extract job between its two phases.
test('sweepHeldPostRetention: a held post that outlived its job or the 30-minute window is blanked', async (t) => {
  const { jobs } = await import('@festgrid/database');
  const { REEXTRACT_POST_JOB_TYPE, readHeldPost } = await import('@festgrid/domain/jobs');
  const { sweepHeldPostRetention } = await import('./sweep-stale-manual-extraction-jobs.js');
  const { sweepExpiredEngineJobs } = await import('../job-engine/sweep-expired-jobs.js');
  const HELD = `held caption ${suffix}`;
  let n = 0;
  async function insertHeldJob(overrides: Partial<typeof jobs.$inferInsert> & { ageMs?: number } = {}) {
    const { ageMs = 0, ...rest } = overrides;
    const [job] = await db
      .insert(jobs)
      .values({
        type: REEXTRACT_POST_JOB_TYPE,
        ownerUserId: owner,
        trigger: 'USER',
        inputKey: `held-retention-${suffix}-${n++}`,
        input: { url: `https://www.instagram.com/p/held${n}/`, held: { content: HELD, postUrl: 'https://www.instagram.com/p/x/', publishedAt: '2026-10-01T00:00:00.000Z' } },
        status: 'RUNNING',
        admittedAt: new Date(),
        deadlineAt: new Date(Date.now() + 600_000),
        createdAt: new Date(Date.now() - ageMs),
        ...rest,
      })
      .returning();
    return job;
  }
  const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

  await t.test('a job that has ended, however it ended, loses its held post; the identity of the job stays', async () => {
    const ended = [] as Awaited<ReturnType<typeof insertHeldJob>>[];
    for (const status of ['SUCCEEDED', 'SUCCEEDED_WITH_LIMITS', 'FAILED', 'EXPIRED'] as const) ended.push(await insertHeldJob({ status, finishedAt: new Date() }));
    assert.ok((await sweepHeldPostRetention()) >= 4);
    for (const job of ended) {
      const row = await read(job.id);
      assert.equal(readHeldPost(row.input), null);
      assert.deepEqual(row.input, { url: (job.input as { url: string }).url });
      assert.equal(JSON.stringify(row).includes(HELD), false, 'the caption is nowhere on the row');
    }
  });

  await t.test('a job the engine expired (its run timed out, no phase 2 finally ran) is blanked by the next retention pass', async () => {
    const overdue = await insertHeldJob({ deadlineAt: new Date(Date.now() - 60_000) });
    assert.ok((await sweepExpiredEngineJobs()) >= 1);
    assert.equal((await read(overdue.id)).status, 'EXPIRED');
    assert.equal(readHeldPost((await read(overdue.id)).input)?.content, HELD, 'still held until the retention step runs');
    await sweepStaleManualExtractionRetention();
    assert.equal(readHeldPost((await read(overdue.id)).input), null);
  });

  await t.test('a job still open but older than the 30-minute window is blanked too; a young open job keeps its held post for phase 2', async () => {
    const old = await insertHeldJob({ ageMs: REEXTRACT_APPLY_WINDOW_MS + 60_000 });
    const young = await insertHeldJob({ ageMs: 60_000 });
    await sweepHeldPostRetention();
    assert.equal(readHeldPost((await read(old.id)).input), null);
    assert.equal(readHeldPost((await read(young.id)).input)?.content, HELD);
  });

  await t.test('jobs with nothing held, other job types and a second pass are left alone', async () => {
    const plain = await insertHeldJob({ status: 'SUCCEEDED', finishedAt: new Date(), input: { postId: '0a1b2c3d-0000-4000-8000-000000000001' } });
    const other = await insertHeldJob({ status: 'SUCCEEDED', finishedAt: new Date(), type: `fixture-held-${suffix}` });
    await sweepHeldPostRetention();
    assert.deepEqual((await read(plain.id)).input, { postId: '0a1b2c3d-0000-4000-8000-000000000001' });
    assert.equal(readHeldPost((await read(other.id)).input)?.content, HELD, 'another type\'s input is never touched');
    assert.equal(await sweepHeldPostRetention(), 0, 'nothing left to blank');
  });
});
