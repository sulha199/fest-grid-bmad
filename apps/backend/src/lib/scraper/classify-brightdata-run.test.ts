import test from 'node:test';
import assert from 'node:assert';
import { classifyBrightDataRun, describeBrightDataVendorFailure } from './classify-brightdata-run.js';
import { setGetBrightDataProgress, type BrightDataProgressResponse } from './brightdata-client.js';

// The wiring around the pure rule in @festgrid/domain: when a progress report is fetched, what happens
// when that fails or hangs, and what an audit message says.
test('classifyBrightDataRun', async (t) => {
  const outage: BrightDataProgressResponse = { status: 'ready', records: 0, errors: 0 };
  let lookups: string[];
  let lookup: () => Promise<BrightDataProgressResponse>;

  t.before(() => {
    setGetBrightDataProgress(async (snapshotId) => {
      lookups.push(snapshotId);
      return lookup();
    });
  });

  t.beforeEach(() => {
    lookups = [];
    lookup = async () => outage;
  });

  await t.test('delivered records are ok and cost no lookup', async () => {
    const result = await classifyBrightDataRun('snap-1', 3);

    assert.deepStrictEqual(result, { resultClass: 'ok', progress: null });
    assert.deepStrictEqual(lookups, []);
  });

  await t.test('no records: the progress report decides', async () => {
    const result = await classifyBrightDataRun('snap-2', 0);

    assert.strictEqual(result.resultClass, 'vendor_failure');
    assert.deepStrictEqual(result.progress, outage);
    assert.deepStrictEqual(lookups, ['snap-2']);
  });

  await t.test('a progress report the caller already has is used as it is: no second lookup', async () => {
    const result = await classifyBrightDataRun('snap-3', 0, {
      progress: { status: 'ready', records: 0, errors: 1, errorCodes: { dead_page: 1 } },
    });

    assert.strictEqual(result.resultClass, 'empty');
    assert.deepStrictEqual(lookups, []);
  });

  await t.test('a progress report the caller could not get (null) is inconclusive and costs no lookup either', async () => {
    const result = await classifyBrightDataRun('snap-4', 0, { progress: null });

    assert.strictEqual(result.resultClass, 'empty');
    assert.deepStrictEqual(lookups, []);
  });

  await t.test('a lookup that fails is inconclusive, never an outage', async () => {
    lookup = async () => {
      throw new Error('progress endpoint down');
    };

    const result = await classifyBrightDataRun('snap-5', 0);

    assert.deepStrictEqual(result, { resultClass: 'empty', progress: null });
  });

  await t.test('a lookup that hangs is cut off at the timeout and is inconclusive, so the webhook can still answer', async () => {
    lookup = () => new Promise(() => {});
    const startedAt = Date.now();

    const result = await classifyBrightDataRun('snap-6', 0, { lookupTimeoutMs: 50 });

    assert.deepStrictEqual(result, { resultClass: 'empty', progress: null });
    assert.ok(Date.now() - startedAt < 2_000, 'returned on the timeout, not on the hung lookup');
  });

  await t.test('a lookup that loses the race and fails later raises no unhandled rejection', async () => {
    lookup = () => new Promise((_, reject) => setTimeout(() => reject(new Error('late failure')), 120));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await classifyBrightDataRun('snap-7', 0, { lookupTimeoutMs: 20 });
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    assert.deepStrictEqual(unhandled, []);
  });

  await t.test('progress that reports records that never arrived is not a vendor failure', async () => {
    lookup = async () => ({ status: 'ready', records: 25, errors: 0 });

    const result = await classifyBrightDataRun('snap-8', 0);

    assert.strictEqual(result.resultClass, 'empty');
  });
});

test('describeBrightDataVendorFailure', async (t) => {
  await t.test('names the missing dead_page error and the status, with the vendor message', () => {
    const text = describeBrightDataVendorFailure({
      status: 'ready',
      records: 0,
      errors: 0,
      errorMessage: 'No records found. The data may not be available or has changed...',
    });

    assert.match(text, /returned 0 records with no dead_page error \(status ready\)/);
    assert.match(text, /No records found/);
  });

  await t.test('includes the error codes when there are some', () => {
    assert.match(
      describeBrightDataVendorFailure({ status: 'ready', errorCodes: { crawl_failed: 2 } }),
      /error_codes=\{"crawl_failed":2\}/
    );
  });

  await t.test('a snapshot Bright Data reported as failed says so, instead of claiming a missing dead_page', () => {
    const text = describeBrightDataVendorFailure({ status: 'failed', errorCodes: { dead_page: 1 } });

    assert.match(text, /reported the snapshot as failed/);
    assert.doesNotMatch(text, /no dead_page error/);
  });

  await t.test('with no report at all it still reads sensibly', () => {
    assert.strictEqual(describeBrightDataVendorFailure(null), 'Bright Data returned 0 records with no dead_page error (status unknown)');
  });
});
