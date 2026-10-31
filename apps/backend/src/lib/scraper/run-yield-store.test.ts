import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { recordActorRunStart } from './record-actor-run.js';
import { recordRunNewPosts, reportBrightDataYield } from './run-yield-store.js';
import { setGetBrightDataProgress, type BrightDataProgressResponse } from './brightdata-client.js';

test('run yield store', async (t) => {
  let profileId: string;
  let progressCalls: string[] = [];
  let progressResult: BrightDataProgressResponse | Error = { status: 'ready', records: 4, errors: 0 };

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'yield-store-' + Date.now(), platform: 'instagram', username: 'yield_store_user', displayName: 'Yield Store' })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;
    setGetBrightDataProgress(async (snapshotId) => {
      progressCalls.push(snapshotId);
      if (progressResult instanceof Error) throw progressResult;
      return progressResult;
    });
  });

  t.beforeEach(() => {
    progressCalls = [];
    progressResult = { status: 'ready', records: 4, errors: 0 };
  });

  t.afterEach(async () => {
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  async function startRun(label: string) {
    const snapshotId = `yield-store-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const id = await recordActorRunStart({ vendor: 'BRIGHTDATA', triggerMode: 'ASYNC', profileId, runId: snapshotId, rawInput: {}, status: 'PENDING' });
    assert.ok(id);
    return { id, snapshotId };
  }
  const readRun = async (id: string) => (await db.select().from(scraperActorRuns).where(eq(scraperActorRuns.id, id)))[0];

  async function captureWarnings(fn: () => Promise<void>): Promise<string[]> {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };
    try {
      await fn();
    } finally {
      console.warn = originalWarn;
    }
    return warnings;
  }

  await t.test('recordRunNewPosts writes the count, and does nothing without a run id', async () => {
    const { id } = await startRun('newposts');
    await recordRunNewPosts(id, 3);
    assert.strictEqual((await readRun(id)).newPosts, 3);

    await assert.doesNotReject(recordRunNewPosts(undefined, 5));
    await assert.doesNotReject(recordRunNewPosts('not-a-uuid', 5));
  });

  await t.test('reportBrightDataYield stores a report the caller already read, without a second lookup', async () => {
    const { id, snapshotId } = await startRun('known');
    await reportBrightDataYield(snapshotId, 0, { status: 'ready', records: 0, errors: 1, errorCodes: { dead_page: 1 } });

    const run = await readRun(id);
    assert.strictEqual(run.recordsReported, 0);
    assert.strictEqual(run.errorsReported, 1);
    assert.deepStrictEqual(run.errorCodes, { dead_page: 1 });
    assert.deepStrictEqual(progressCalls, []);
  });

  await t.test('a snapshot that delivered records is looked up once when no report was read', async () => {
    const { id, snapshotId } = await startRun('lookup');
    progressResult = { status: 'ready', records: 11, errors: 1, errorCodes: { dead_page: 1 } };
    await reportBrightDataYield(snapshotId, 11);

    assert.deepStrictEqual(progressCalls, [snapshotId]);
    const run = await readRun(id);
    assert.strictEqual(run.recordsReported, 11);
    assert.strictEqual(run.errorsReported, 1);
  });

  await t.test('a zero-record snapshot with no report read is not looked up here (the classifier owns that case)', async () => {
    const { id, snapshotId } = await startRun('zero');
    await reportBrightDataYield(snapshotId, 0);

    assert.deepStrictEqual(progressCalls, []);
    assert.strictEqual((await readRun(id)).recordsReported, null);
  });

  await t.test('a failed lookup leaves the columns null and never throws', async () => {
    const { id, snapshotId } = await startRun('failed');
    progressResult = new Error('progress lookup failed');
    await assert.doesNotReject(reportBrightDataYield(snapshotId, 5));

    assert.strictEqual((await readRun(id)).recordsReported, null);
  });

  await t.test('a report with unknown error codes is stored and warned about, not rejected', async () => {
    const { id, snapshotId } = await startRun('unknown');
    const warnings = await captureWarnings(() =>
      reportBrightDataYield(snapshotId, 5, { status: 'ready', records: 5, errors: 2, errorCodes: { something_new: 2 } })
    );

    assert.deepStrictEqual((await readRun(id)).errorCodes, { something_new: 2 });
    assert.ok(warnings.some((line) => line.includes('partial-unknown') && line.includes('something_new')));
  });

  await t.test('an expected partial (dead_page only) and a complete delivery are stored without a warning', async () => {
    const warnings = await captureWarnings(async () => {
      const a = await startRun('expected');
      await reportBrightDataYield(a.snapshotId, 11, { status: 'ready', records: 11, errors: 1, errorCodes: { dead_page: 1 } });
      const b = await startRun('complete');
      await reportBrightDataYield(b.snapshotId, 3, { status: 'ready', records: 3, errors: 0 });
    });
    assert.deepStrictEqual(warnings, []);
  });
});
