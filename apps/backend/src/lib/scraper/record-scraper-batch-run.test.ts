import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperBatchRuns } from '@festgrid/database';
import { inArray, eq } from 'drizzle-orm';
import {
  recordScraperBatchRunStart,
  completeScraperBatchRun,
} from './record-scraper-batch-run.js';

test('record-scraper-batch-run per-cycle audit row', async (t) => {
  const createdIds: string[] = [];

  t.after(async () => {
    if (createdIds.length > 0) {
      await db.delete(scraperBatchRuns).where(inArray(scraperBatchRuns.id, createdIds));
    }
  });

  await t.test('start inserts a row and returns its id', async () => {
    const id = await recordScraperBatchRunStart();
    createdIds.push(id);

    const [row] = await db
      .select()
      .from(scraperBatchRuns)
      .where(eq(scraperBatchRuns.id, id));

    assert.ok(row);
    assert.ok(row.startedAt);
    assert.strictEqual(row.targetsFound, 0);
    assert.strictEqual(row.dispatchedSucceeded, 0);
    assert.strictEqual(row.dispatchedFailed, 0);
    assert.strictEqual(row.dispatchedQueued, 0);
    assert.strictEqual(row.noTargetsReason, null);
    assert.strictEqual(row.completedAt, null);
  });

  await t.test('complete fills in tallies and completedAt on the same row', async () => {
    const id = await recordScraperBatchRunStart();
    createdIds.push(id);

    await completeScraperBatchRun(id, {
      targetsFound: 7,
      dispatchedSucceeded: 5,
      dispatchedFailed: 2,
    });

    const [row] = await db
      .select()
      .from(scraperBatchRuns)
      .where(eq(scraperBatchRuns.id, id));

    assert.ok(row);
    assert.ok(row.completedAt);
    assert.strictEqual(row.targetsFound, 7);
    assert.strictEqual(row.dispatchedSucceeded, 5);
    assert.strictEqual(row.dispatchedFailed, 2);
    assert.strictEqual(row.dispatchedQueued, 0, 'a caller that does not report queued targets leaves the count at 0');
  });

  await t.test('complete records targets that fell back to the queue separately from failures', async () => {
    const id = await recordScraperBatchRunStart();
    createdIds.push(id);

    await completeScraperBatchRun(id, {
      targetsFound: 38,
      dispatchedSucceeded: 7,
      dispatchedFailed: 0,
      dispatchedQueued: 31,
    });

    const [row] = await db.select().from(scraperBatchRuns).where(eq(scraperBatchRuns.id, id));
    assert.strictEqual(row.dispatchedSucceeded, 7);
    assert.strictEqual(row.dispatchedFailed, 0);
    assert.strictEqual(row.dispatchedQueued, 31);
  });

  await t.test('complete records why a cycle found no targets, and leaves the reason null when it had targets', async () => {
    const emptyId = await recordScraperBatchRunStart();
    const busyId = await recordScraperBatchRunStart();
    createdIds.push(emptyId, busyId);

    await completeScraperBatchRun(emptyId, {
      targetsFound: 0,
      dispatchedSucceeded: 0,
      dispatchedFailed: 0,
      noTargetsReason: '38 subscribed profile(s) eligible: 38 skipped as scraped since 2026-10-24T02:13:00.000Z',
    });
    await completeScraperBatchRun(busyId, { targetsFound: 3, dispatchedSucceeded: 3, dispatchedFailed: 0 });

    const [empty] = await db.select().from(scraperBatchRuns).where(eq(scraperBatchRuns.id, emptyId));
    const [busy] = await db.select().from(scraperBatchRuns).where(eq(scraperBatchRuns.id, busyId));
    assert.match(empty.noTargetsReason ?? '', /38 skipped as scraped since/);
    assert.strictEqual(busy.noTargetsReason, null);
  });
});

