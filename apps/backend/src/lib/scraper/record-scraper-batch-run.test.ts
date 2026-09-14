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
  });
});

