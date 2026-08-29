import test from 'node:test';
import assert from 'node:assert';
import {
  verifyGeminiApiKey,
  callGeminiGenerateContent,
  setCallGeminiGenerateContent,
  GeminiInvalidKeyError,
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
