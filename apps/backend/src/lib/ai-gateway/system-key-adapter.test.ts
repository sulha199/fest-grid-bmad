import test from 'node:test';
import assert from 'node:assert';
import {
  callGeminiForLocationInference,
  setCallGemini,
  callGeminiRef
} from './system-key-adapter.js';
import { AiGatewayExhaustedError } from './adapter.js';
import { setCallGeminiGenerateContent } from './gemini-client.js';

test('system-key-adapter - callGeminiForLocationInference orchestration', async (t) => {
  const originalSystemKey = process.env.SYSTEM_GEMINI_API_KEY;

  t.after(() => {
    // Restore original dependencies & environment
    setCallGemini(callGeminiRef);
    if (originalSystemKey !== undefined) {
      process.env.SYSTEM_GEMINI_API_KEY = originalSystemKey;
    } else {
      delete process.env.SYSTEM_GEMINI_API_KEY;
    }
  });

  await t.test('1. Succeeds on standard Tier 1/2 call without system key fallback', async () => {
    setCallGemini(async () => {
      return { text: 'tier-success' };
    });

    // Even if system key is present, we shouldn't use it
    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret';

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    const result = await callGeminiForLocationInference({
      provider: 'gemini',
      subscriberUserIds: ['user-1'],
      contents: 'Hello',
    });

    assert.equal(result.text, 'tier-success');
    assert.equal(contentCallCount, 0);
  });

  await t.test('2. Fails over to system key on AiGatewayExhaustedError when system key is configured', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });

    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';

    let contentApiKeyUsed: string | null = null;
    setCallGeminiGenerateContent(async (apiKey) => {
      contentApiKeyUsed = apiKey;
      return { text: 'system-key-success' };
    });

    const result = await callGeminiForLocationInference({
      provider: 'gemini',
      subscriberUserIds: ['user-1'],
      contents: 'Hello',
    });

    assert.equal(result.text, 'system-key-success');
    assert.equal(contentApiKeyUsed, 'system-secret-key');
  });

  await t.test('3. Rethrows AiGatewayExhaustedError when system key is NOT configured', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });

    delete process.env.SYSTEM_GEMINI_API_KEY;

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    await assert.rejects(
      async () => {
        await callGeminiForLocationInference({
          provider: 'gemini',
          subscriberUserIds: ['user-1'],
          contents: 'Hello',
        });
      },
      (err: any) => {
        return err instanceof AiGatewayExhaustedError;
      }
    );
    assert.equal(contentCallCount, 0);
  });

  await t.test('4. Does not fall back on non-exhaustion error (e.g. standard Error)', async () => {
    setCallGemini(async () => {
      throw new Error('Standard database failure');
    });

    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    await assert.rejects(
      async () => {
        await callGeminiForLocationInference({
          provider: 'gemini',
          subscriberUserIds: ['user-1'],
          contents: 'Hello',
        });
      },
      (err: any) => {
        return err instanceof Error && !(err instanceof AiGatewayExhaustedError);
      }
    );
    assert.equal(contentCallCount, 0);
  });
});
