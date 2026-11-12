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
