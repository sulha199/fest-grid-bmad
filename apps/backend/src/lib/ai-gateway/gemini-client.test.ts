import test from 'node:test';
import assert from 'node:assert';
import {
  verifyGeminiApiKey,
  callGeminiGenerateContent,
  setCallGeminiGenerateContent,
  GeminiInvalidKeyError,
  GeminiTimeoutError,
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
});

// Story 3.6s (Task 5.4, AC7) — exercises the REAL AbortController timeout / maxOutputTokens
// wiring inside callGeminiGenerateContent, via the generateContentSeam swap-point (see
// gemini-client.ts's own comment on why this seam exists). Never touches the network.
test('callGeminiGenerateContent: timeout and maxOutputTokens (Task 5.4)', async (t) => {
  const originalGenerateContentSeam = generateContentSeam;

  t.afterEach(() => {
    setGenerateContentSeam(originalGenerateContentSeam);
  });

  await t.test('a call that resolves before the timeout succeeds normally (no behavior change for the common case)', async () => {
    setGenerateContentSeam(async (_ai, params) => {
      assert.strictEqual(params.config.abortSignal.aborted, false);
      return { text: 'ok-before-timeout' };
    });

    const result = await callGeminiGenerateContent('test-key', {
      contents: 'hello',
      timeoutMs: 5000
    });

    assert.strictEqual(result.text, 'ok-before-timeout');
  });

  await t.test('a call with no timeoutMs set never attaches an abortSignal (unchanged default behavior)', async () => {
    setGenerateContentSeam(async (_ai, params) => {
      assert.strictEqual('abortSignal' in params.config, false, 'abortSignal must be absent when timeoutMs is not provided');
      return { text: 'ok-no-timeout' };
    });

    const result = await callGeminiGenerateContent('test-key', { contents: 'hello' });
    assert.strictEqual(result.text, 'ok-no-timeout');
  });

  await t.test('a call that never resolves within the configured timeout throws GeminiTimeoutError', async () => {
    // A short test-only timeout (not the real 120000ms default) to keep the test fast. The mock
    // mimics a real SDK honoring AbortSignal: it never resolves on its own, but rejects once the
    // signal fires -- exactly the "client-side cancellation" behavior confirmed against the real
    // @google/genai SDK types (gemini-client.ts's own comment).
    setGenerateContentSeam((_ai, params) => {
      return new Promise((_resolve, reject) => {
        params.config.abortSignal.addEventListener('abort', () => {
          reject(new Error('simulated abort'));
        });
      });
    });

    await assert.rejects(
      () => callGeminiGenerateContent('test-key', { contents: 'hello', timeoutMs: 20 }),
      (err: any) => {
        assert.ok(err instanceof GeminiTimeoutError, `expected GeminiTimeoutError, got ${err?.constructor?.name}`);
        assert.ok(err.message.includes('20ms'));
        return true;
      }
    );
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
