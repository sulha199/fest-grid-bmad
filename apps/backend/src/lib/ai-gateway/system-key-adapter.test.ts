import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { vendorCallLocks } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  callGeminiForLocationInference,
  callGeminiForAccountClassification,
  setCallGemini,
  callGeminiRef
} from './system-key-adapter.js';
import { AiGatewayExhaustedError } from './adapter.js';
import { setCallGeminiGenerateContent, callGeminiGenerateContent } from './gemini-client.js';
import { VendorKeyBusyError } from '../vendor-gateway/guarded-call.js';

const SYSTEM_LOCK_KEY = 'gemini:system';

async function deleteSystemLockRow(): Promise<void> {
  await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, SYSTEM_LOCK_KEY));
}

test('system-key-adapter - callGeminiForLocationInference orchestration', async (t) => {
  const originalSystemKey = process.env.SYSTEM_GEMINI_API_KEY;
  const originalCallGeminiGenerateContent = callGeminiGenerateContent;

  t.after(async () => {
    // Restore original dependencies & environment
    setCallGemini(callGeminiRef);
    setCallGeminiGenerateContent(originalCallGeminiGenerateContent);
    if (originalSystemKey !== undefined) {
      process.env.SYSTEM_GEMINI_API_KEY = originalSystemKey;
    } else {
      delete process.env.SYSTEM_GEMINI_API_KEY;
    }
    // Story 0.i2c: the fallback now goes through callVendor, which claims/releases a
    // vendor_call_locks row for 'gemini:system' -- clean up any leftover row.
    await deleteSystemLockRow();
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

    // Use '' rather than `delete` here: loadBackendEnv() calls dotenv.config() on every
    // invocation, and dotenv only fills in vars that are `undefined` in process.env. A real
    // SYSTEM_GEMINI_API_KEY lives in the repo's .env, so deleting the var lets dotenv silently
    // refill it from disk before this assertion runs, flipping the "not configured" case into
    // the "configured" one. An empty string is still a defined value, so dotenv leaves it alone.
    process.env.SYSTEM_GEMINI_API_KEY = '';

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

  await t.test('5 (Story 0.i2c): claims the gemini:system lease during the fallback call and releases it after', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });
    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';
    await deleteSystemLockRow();

    let resolveInFlight: (() => void) | undefined;
    const callStarted = new Promise<void>((resolveStarted) => {
      setCallGeminiGenerateContent(async () => {
        resolveStarted();
        await new Promise<void>((resolve) => {
          resolveInFlight = resolve;
        });
        return { text: 'system-key-success' };
      });
    });

    try {
      const resultPromise = callGeminiForLocationInference({
        provider: 'gemini',
        subscriberUserIds: ['user-1'],
        contents: 'Hello',
      });

      await callStarted;
      const rowsWhileInFlight = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, SYSTEM_LOCK_KEY));
      assert.equal(rowsWhileInFlight.length, 1);
      assert.ok(rowsWhileInFlight[0].lockedUntil.getTime() > Date.now());

      resolveInFlight?.();
      const result = await resultPromise;
      assert.equal(result.text, 'system-key-success');

      const rowsAfter = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, SYSTEM_LOCK_KEY));
      assert.equal(rowsAfter.length, 1);
      assert.ok(rowsAfter[0].lockedUntil.getTime() <= Date.now() + 1000);
    } finally {
      await deleteSystemLockRow();
    }
  });

  await t.test('6 (Story 0.i2c): a pre-held gemini:system lease causes VendorKeyBusyError rather than invoking the SDK', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });
    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';
    await deleteSystemLockRow();
    await db.insert(vendorCallLocks).values({
      lockKey: SYSTEM_LOCK_KEY,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    try {
      await assert.rejects(
        () =>
          callGeminiForLocationInference({
            provider: 'gemini',
            subscriberUserIds: ['user-1'],
            contents: 'Hello',
          }),
        VendorKeyBusyError
      );
      assert.equal(contentCallCount, 0);
    } finally {
      await deleteSystemLockRow();
    }
  });
});

test('system-key-adapter - callGeminiForAccountClassification orchestration', async (t) => {
  const originalSystemKey = process.env.SYSTEM_GEMINI_API_KEY;
  const originalCallGeminiGenerateContent = callGeminiGenerateContent;

  t.after(async () => {
    setCallGemini(callGeminiRef);
    setCallGeminiGenerateContent(originalCallGeminiGenerateContent);
    if (originalSystemKey !== undefined) {
      process.env.SYSTEM_GEMINI_API_KEY = originalSystemKey;
    } else {
      delete process.env.SYSTEM_GEMINI_API_KEY;
    }
    await deleteSystemLockRow();
  });

  await t.test('1. Succeeds on standard Tier 1/2 call without system key fallback', async () => {
    setCallGemini(async () => {
      return { text: 'tier-success' };
    });

    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret';

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    const result = await callGeminiForAccountClassification({
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

    const result = await callGeminiForAccountClassification({
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

    // See the matching comment in the location-inference block above: '' (not `delete`)
    // prevents loadBackendEnv()'s per-call dotenv.config() from refilling this from the
    // repo's real .env, which contains a live SYSTEM_GEMINI_API_KEY.
    process.env.SYSTEM_GEMINI_API_KEY = '';

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    await assert.rejects(
      async () => {
        await callGeminiForAccountClassification({
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

  await t.test('4. Does not fall back on non-exhaustion error', async () => {
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
        await callGeminiForAccountClassification({
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

  await t.test('5 (Story 0.i2c): claims the gemini:system lease during the fallback call and releases it after', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });
    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';
    await deleteSystemLockRow();

    let resolveInFlight: (() => void) | undefined;
    const callStarted = new Promise<void>((resolveStarted) => {
      setCallGeminiGenerateContent(async () => {
        resolveStarted();
        await new Promise<void>((resolve) => {
          resolveInFlight = resolve;
        });
        return { text: 'system-key-success' };
      });
    });

    try {
      const resultPromise = callGeminiForAccountClassification({
        provider: 'gemini',
        subscriberUserIds: ['user-1'],
        contents: 'Hello',
      });

      await callStarted;
      const rowsWhileInFlight = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, SYSTEM_LOCK_KEY));
      assert.equal(rowsWhileInFlight.length, 1);
      assert.ok(rowsWhileInFlight[0].lockedUntil.getTime() > Date.now());

      resolveInFlight?.();
      const result = await resultPromise;
      assert.equal(result.text, 'system-key-success');

      const rowsAfter = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, SYSTEM_LOCK_KEY));
      assert.equal(rowsAfter.length, 1);
      assert.ok(rowsAfter[0].lockedUntil.getTime() <= Date.now() + 1000);
    } finally {
      await deleteSystemLockRow();
    }
  });

  await t.test('6 (Story 0.i2c): a pre-held gemini:system lease causes VendorKeyBusyError rather than invoking the SDK', async () => {
    setCallGemini(async () => {
      throw new AiGatewayExhaustedError('Gateway exhausted');
    });
    process.env.SYSTEM_GEMINI_API_KEY = 'system-secret-key';
    await deleteSystemLockRow();
    await db.insert(vendorCallLocks).values({
      lockKey: SYSTEM_LOCK_KEY,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    let contentCallCount = 0;
    setCallGeminiGenerateContent(async () => {
      contentCallCount++;
      return { text: 'should-not-reach' };
    });

    try {
      await assert.rejects(
        () =>
          callGeminiForAccountClassification({
            provider: 'gemini',
            subscriberUserIds: ['user-1'],
            contents: 'Hello',
          }),
        VendorKeyBusyError
      );
      assert.equal(contentCallCount, 0);
    } finally {
      await deleteSystemLockRow();
    }
  });
});
