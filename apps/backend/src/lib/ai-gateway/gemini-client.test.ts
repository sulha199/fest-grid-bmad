import test from 'node:test';
import assert from 'node:assert';
import { vendorCallLocks } from '@festgrid/database';
import { db } from '../../db/client.js';
import {
  verifyGeminiApiKey,
  callGeminiGenerateContent,
  setCallGeminiGenerateContent,
  GeminiInvalidKeyError,
  GeminiRateLimitedError,
  GeminiUnknownError,
  isGeminiErrorTransient,
  generateContentSeam,
  setGenerateContentSeam,
} from './gemini-client.js';

test('verifyGeminiApiKey unit tests', async (t) => {
  const originalCall = callGeminiGenerateContent;

  t.after(() => {
    setCallGeminiGenerateContent(originalCall);
  });

  await t.test('returns true on successful API key verification', async () => {
    setCallGeminiGenerateContent(async (apiKey, request) => {
      assert.strictEqual(apiKey, 'valid-key');
      assert.deepStrictEqual(request, { contents: 'ping' });
      return { text: 'success' };
    });

    const result = await verifyGeminiApiKey('valid-key');
    assert.strictEqual(result, true);
  });

  await t.test('returns false on GeminiInvalidKeyError', async () => {
    setCallGeminiGenerateContent(async (apiKey, request) => {
      throw new GeminiInvalidKeyError('API key not valid');
    });

    const result = await verifyGeminiApiKey('invalid-key');
    assert.strictEqual(result, false);
  });

  await t.test('re-throws other types of errors unchanged', async () => {
    const transientError = new Error('Transient network error');
    setCallGeminiGenerateContent(async (apiKey, request) => {
      throw transientError;
    });

    await assert.rejects(
      async () => {
        await verifyGeminiApiKey('some-key');
      },
      (err: any) => {
        assert.strictEqual(err, transientError);
        return true;
      }
    );
  });

  // Story 0.i2b — verifyGeminiApiKey now routes through callVendor with lockKey: undefined
  // (AD-32 Rule 3's named exception to per-key locking). Confirms zero vendor_call_locks rows
  // are ever written by this call path, for both a successful and a failing verification
  // attempt (real local DB, matching guarded-call.test.ts's own convention).
  await t.test('routes through callVendor with lockKey undefined -- writes zero vendor_call_locks rows', async () => {
    // Released leases legitimately persist as rows (release is an UPDATE, not a DELETE), so a
    // previously used dev DB may already hold rows. Compare ordered before/after snapshots
    // rather than requiring an empty table: this tolerates existing rows AND detects any
    // insert, delete or lease change that a bare row-count comparison would miss.
    const snapshot = async () =>
      (await db.select().from(vendorCallLocks)).map((r) => `${r.lockKey}|${r.lockedUntil.toISOString()}`).sort();
    const before = await snapshot();

    setCallGeminiGenerateContent(async () => ({ text: 'ok' }));
    const successResult = await verifyGeminiApiKey('valid-key-for-lock-check');
    assert.strictEqual(successResult, true);
    assert.deepStrictEqual(await snapshot(), before, 'a successful verification must not touch vendor_call_locks');

    setCallGeminiGenerateContent(async () => {
      throw new GeminiInvalidKeyError('API key not valid');
    });
    const failureResult = await verifyGeminiApiKey('invalid-key-for-lock-check');
    assert.strictEqual(failureResult, false);
    assert.deepStrictEqual(await snapshot(), before, 'a failing verification must not touch vendor_call_locks either');
  });
});

// Story 0.i2c — exercises the signal-forwarding contract inside callGeminiGenerateContent, via
// the generateContentSeam swap-point (see gemini-client.ts's own comment on why this seam
// exists). Never touches the network. (Replaces Story 3.6s's deleted internal-timeout cases.)
test('callGeminiGenerateContent: signal forwarding and maxOutputTokens', async (t) => {
  const originalGenerateContentSeam = generateContentSeam;

  t.afterEach(() => {
    setGenerateContentSeam(originalGenerateContentSeam);
  });

  await t.test('a call passed a real AbortSignal forwards it to config.abortSignal', async () => {
    const controller = new AbortController();
    setGenerateContentSeam(async (_ai, params) => {
      assert.strictEqual(params.config.abortSignal, controller.signal);
      return { text: 'ok-with-signal' };
    });

    const result = await callGeminiGenerateContent('test-key', { contents: 'hello' }, controller.signal);

    assert.strictEqual(result.text, 'ok-with-signal');
  });

  await t.test('a call with no third argument omits config.abortSignal entirely (unchanged default behavior)', async () => {
    setGenerateContentSeam(async (_ai, params) => {
      assert.strictEqual('abortSignal' in params.config, false, 'abortSignal must be absent when no signal is passed');
      return { text: 'ok-no-signal' };
    });

    const result = await callGeminiGenerateContent('test-key', { contents: 'hello' });
    assert.strictEqual(result.text, 'ok-no-signal');
  });

  await t.test('maxOutputTokens is correctly passed into the SDK config object when provided', async () => {
    let capturedConfig: any = null;
    setGenerateContentSeam(async (_ai, params) => {
      capturedConfig = params.config;
      return { text: 'ok' };
    });

    await callGeminiGenerateContent('test-key', { contents: 'hello', maxOutputTokens: 4096 });

    assert.strictEqual(capturedConfig.maxOutputTokens, 4096);
  });

  await t.test('maxOutputTokens is undefined in the SDK config object when not provided (no behavior change)', async () => {
    let capturedConfig: any = null;
    setGenerateContentSeam(async (_ai, params) => {
      capturedConfig = params.config;
      return { text: 'ok' };
    });

    await callGeminiGenerateContent('test-key', { contents: 'hello' });

    assert.strictEqual(capturedConfig.maxOutputTokens, undefined);
  });
});

// Story 0.i2c (AC7) — isGeminiErrorTransient's classification contract.
test('isGeminiErrorTransient', async (t) => {
  await t.test('returns true for a GeminiUnknownError with a 5xx originalError.status', () => {
    const error = new GeminiUnknownError('server error', { status: 503 });
    assert.strictEqual(isGeminiErrorTransient(error), true);
  });

  await t.test('returns true for a GeminiUnknownError with a connection-level originalError.code', () => {
    const error = new GeminiUnknownError('connection reset', { code: 'ECONNRESET' });
    assert.strictEqual(isGeminiErrorTransient(error), true);
  });

  await t.test('returns false for a GeminiUnknownError with an unrelated originalError shape', () => {
    const error = new GeminiUnknownError('bad request shape', { message: 'bad request shape' });
    assert.strictEqual(isGeminiErrorTransient(error), false);
  });

  await t.test('returns false for GeminiRateLimitedError, unconditionally', () => {
    const error = new GeminiRateLimitedError('Too many requests', 1);
    assert.strictEqual(isGeminiErrorTransient(error), false);
  });

  await t.test('returns false for GeminiInvalidKeyError, unconditionally', () => {
    const error = new GeminiInvalidKeyError('Invalid API Key');
    assert.strictEqual(isGeminiErrorTransient(error), false);
  });

  await t.test('returns false for any other error type', () => {
    assert.strictEqual(isGeminiErrorTransient(new Error('plain error')), false);
  });
});
