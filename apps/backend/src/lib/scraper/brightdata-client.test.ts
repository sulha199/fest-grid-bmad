import test from 'node:test';
import assert from 'node:assert';
import {
  triggerBrightDataJob,
  getBrightDataProgress,
  getBrightDataSnapshot,
  isBrightDataErrorTransient,
  BrightDataApiError,
} from './brightdata-client.js';

// Story 0.i2d -- brightdata-client.ts had no test file before this story. These tests cover:
//   1. triggerBrightDataJob/getBrightDataProgress/getBrightDataSnapshot's still-correct mapped
//      output against a mocked global fetch (functional regression coverage this file never had).
//   2. isBrightDataErrorTransient classification.
//   3. DPA gate rejection when BRIGHTDATA_SCRAPING_CONFIRMED="false", with the mocked fetch
//      never invoked.

function withEnvVars(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }
  return fn().finally(() => {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  });
}

function mockFetchOnce(response: { ok: boolean; status?: number; statusText?: string; json: () => Promise<any> }) {
  const original = global.fetch;
  let callCount = 0;
  let capturedSignal: AbortSignal | undefined;
  (global as any).fetch = async (_url: string, init?: RequestInit) => {
    callCount += 1;
    capturedSignal = init?.signal as AbortSignal | undefined;
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      statusText: response.statusText ?? '',
      json: response.json,
    } as any;
  };
  return {
    restore: () => {
      global.fetch = original;
    },
    getCallCount: () => callCount,
    getCapturedSignal: () => capturedSignal,
  };
}

test('brightdata-client tests', async (t) => {
  // Every test except the DPA-gate one needs credentials configured -- _triggerBrightDataJob/
  // _getBrightDataProgress/_getBrightDataSnapshot all check env.brightdataApiToken/
  // brightdataDatasetId (inside the guarded callVendor thunk, after the DPA gate) before
  // ever reaching fetch, and the local dev/test .env does not define a real token.
  const originalToken = process.env.BRIGHTDATA_API_TOKEN;
  const originalDatasetId = process.env.BRIGHTDATA_DATASET_ID;
  t.before(() => {
    process.env.BRIGHTDATA_API_TOKEN = 'test-brightdata-token';
    process.env.BRIGHTDATA_DATASET_ID = 'test-brightdata-dataset-id';
  });
  t.after(() => {
    if (originalToken === undefined) {
      delete process.env.BRIGHTDATA_API_TOKEN;
    } else {
      process.env.BRIGHTDATA_API_TOKEN = originalToken;
    }
    if (originalDatasetId === undefined) {
      delete process.env.BRIGHTDATA_DATASET_ID;
    } else {
      process.env.BRIGHTDATA_DATASET_ID = originalDatasetId;
    }
  });

  await t.test('triggerBrightDataJob maps a successful response to { snapshotId }', async () => {
    const mock = mockFetchOnce({ ok: true, json: async () => ({ snapshot_id: 'snap-123' }) });
    try {
      const result = await triggerBrightDataJob(
        { url: 'https://www.instagram.com/test_user/', numOfPosts: 10, startDate: '01-01-2026' },
        'https://example.com/webhook'
      );
      assert.deepStrictEqual(result, { snapshotId: 'snap-123' });
      assert.strictEqual(mock.getCallCount(), 1);
      assert.ok(mock.getCapturedSignal(), 'expected the fetch call to receive an AbortSignal');
    } finally {
      mock.restore();
    }
  });

  await t.test('triggerBrightDataJob throws BrightDataApiError with statusCode on a non-ok response', async () => {
    const mock = mockFetchOnce({ ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) });
    try {
      await assert.rejects(
        () =>
          triggerBrightDataJob(
            { url: 'https://www.instagram.com/test_user/', numOfPosts: 10, startDate: '01-01-2026' },
            'https://example.com/webhook'
          ),
        (err: any) => {
          assert.ok(err instanceof BrightDataApiError);
          assert.strictEqual(err.statusCode, 503);
          return true;
        }
      );
      // Story 0.i2d review: the trigger POST creates a billed snapshot and is not idempotent, so a
      // 5xx must NOT be retried by the wrapper (a retry could create a second, untracked job).
      assert.strictEqual(mock.getCallCount(), 1, 'trigger POST is attempted exactly once');
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataProgress maps a response correctly', async () => {
    const mock = mockFetchOnce({ ok: true, json: async () => ({ status: 'running' }) });
    try {
      const result = await getBrightDataProgress('snap-123');
      assert.deepStrictEqual(result, { status: 'running' });
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataProgress defaults to "scheduled" when status is missing', async () => {
    const mock = mockFetchOnce({ ok: true, json: async () => ({}) });
    try {
      const result = await getBrightDataProgress('snap-123');
      assert.deepStrictEqual(result, { status: 'scheduled' });
    } finally {
      mock.restore();
    }
  });

  // BUG-074: a zero-record snapshot is told apart as an empty account (error_codes.dead_page) or a
  // vendor failure from the finished snapshot's progress report -- measured 2026-10-22, undocumented.
  await t.test('getBrightDataProgress maps records, errors, error_codes and error_message of a finished snapshot', async () => {
    const mock = mockFetchOnce({
      ok: true,
      json: async () => ({
        status: 'ready',
        records: 0,
        errors: 1,
        error_codes: { dead_page: 1 },
        error_message: 'No records found. The data may not be available or has changed...',
        collection_duration: 12,
      }),
    });
    try {
      const result = await getBrightDataProgress('snap-123');
      assert.deepStrictEqual(result, {
        status: 'ready',
        records: 0,
        errors: 1,
        errorCodes: { dead_page: 1 },
        errorMessage: 'No records found. The data may not be available or has changed...',
      });
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataProgress leaves out fields of the wrong type instead of passing them on', async () => {
    const mock = mockFetchOnce({
      ok: true,
      json: async () => ({ status: 'ready', records: '3', errors: null, error_codes: 'dead_page', error_message: 5 }),
    });
    try {
      const result = await getBrightDataProgress('snap-123');
      assert.deepStrictEqual(result, { status: 'ready' });
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataProgress reads error_codes only when it is a map of codes to counts', async () => {
    const cases: Array<[string, unknown, unknown]> = [
      ['an array', ['dead_page'], undefined],
      ['an empty map', {}, undefined],
      ['a map of non-numbers', { dead_page: '1', other: true }, undefined],
      ['a map with one valid count among junk', { dead_page: 1, other: 'x', nested: { a: 1 } }, { dead_page: 1 }],
      ['a zero count', { dead_page: 0 }, { dead_page: 0 }],
    ];
    for (const [label, errorCodes, expected] of cases) {
      const mock = mockFetchOnce({ ok: true, json: async () => ({ status: 'ready', error_codes: errorCodes }) });
      try {
        const result = await getBrightDataProgress('snap-123');
        assert.deepStrictEqual(result.errorCodes, expected, label);
      } finally {
        mock.restore();
      }
    }
  });

  await t.test('getBrightDataProgress throws BrightDataApiError with statusCode on a non-ok response', async () => {
    const mock = mockFetchOnce({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) });
    try {
      await assert.rejects(
        () => getBrightDataProgress('snap-123'),
        (err: any) => {
          assert.ok(err instanceof BrightDataApiError);
          assert.strictEqual(err.statusCode, 500);
          return true;
        }
      );
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataSnapshot returns the raw parsed items', async () => {
    const mock = mockFetchOnce({ ok: true, json: async () => [{ id: 'post-1' }, { id: 'post-2' }] });
    try {
      const result = await getBrightDataSnapshot('snap-123');
      assert.deepStrictEqual(result, [{ id: 'post-1' }, { id: 'post-2' }]);
    } finally {
      mock.restore();
    }
  });

  await t.test('getBrightDataSnapshot throws BrightDataApiError with statusCode on a non-ok response', async () => {
    const mock = mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) });
    try {
      await assert.rejects(
        () => getBrightDataSnapshot('snap-123'),
        (err: any) => {
          assert.ok(err instanceof BrightDataApiError);
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    } finally {
      mock.restore();
    }
  });

  await t.test('isBrightDataErrorTransient classifies a 500 BrightDataApiError and an ECONNRESET-coded error as transient, a 404 as not', () => {
    assert.strictEqual(isBrightDataErrorTransient(new BrightDataApiError('server error', 500)), true);
    assert.strictEqual(isBrightDataErrorTransient(new BrightDataApiError('server error', 599)), true);
    assert.strictEqual(isBrightDataErrorTransient(new BrightDataApiError('not found', 404)), false);

    const connResetError: any = new Error('fetch failed');
    connResetError.cause = { code: 'ECONNRESET' };
    assert.strictEqual(isBrightDataErrorTransient(connResetError), true);

    assert.strictEqual(isBrightDataErrorTransient(new Error('some other error')), false);
    assert.strictEqual(isBrightDataErrorTransient('not even an Error instance'), false);
  });

  await t.test('DPA gate: triggerBrightDataJob/getBrightDataProgress/getBrightDataSnapshot reject with BRIGHTDATA_SCRAPING_CONFIRMED="false", mocked fetch never invoked', async () => {
    await withEnvVars({ BRIGHTDATA_SCRAPING_CONFIRMED: 'false' }, async () => {
      const mock = mockFetchOnce({ ok: true, json: async () => ({ snapshot_id: 'should-not-be-reached' }) });
      try {
        await assert.rejects(
          () => triggerBrightDataJob({ url: 'https://www.instagram.com/x/', numOfPosts: 1, startDate: '01-01-2026' }, 'https://example.com/webhook'),
          (err: any) => {
            assert.strictEqual(err.name, 'VendorDpaNotConfirmedError');
            return true;
          }
        );
        await assert.rejects(
          () => getBrightDataProgress('snap-x'),
          (err: any) => {
            assert.strictEqual(err.name, 'VendorDpaNotConfirmedError');
            return true;
          }
        );
        await assert.rejects(
          () => getBrightDataSnapshot('snap-x'),
          (err: any) => {
            assert.strictEqual(err.name, 'VendorDpaNotConfirmedError');
            return true;
          }
        );
        assert.strictEqual(mock.getCallCount(), 0, 'the mocked fetch must never be invoked when the DPA gate rejects');
      } finally {
        mock.restore();
      }
    });
  });
});
