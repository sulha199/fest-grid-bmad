import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { apiKeys, users } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { callGemini, AiGatewayExhaustedError } from './adapter.js';
import { setDecryptApiKey } from './kms.js';
import { setCallGeminiGenerateContent, GeminiRateLimitedError, GeminiInvalidKeyError } from './gemini-client.js';

test('AI Gateway Adapter - callGemini orchestration', async (t) => {
  // 1. Create mock users and api keys in the DB
  const [testUser] = await db.insert(users).values({
    email: `gateway-test-${Date.now()}@example.com`,
    name: 'Gateway Tester',
  }).returning();

  const key1Data = {
    userId: testUser.id,
    keyEncrypted: Buffer.from('key-1-secret').toString('base64'),
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
    usageCount: 2,
  };

  const key2Data = {
    userId: testUser.id,
    keyEncrypted: Buffer.from('key-2-secret').toString('base64'),
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
    usageCount: 5,
  };

  const [dbKey1] = await db.insert(apiKeys).values(key1Data).returning();
  const [dbKey2] = await db.insert(apiKeys).values(key2Data).returning();

  // Cleanup after tests
  t.after(async () => {
    await db.delete(apiKeys).where(inArray(apiKeys.id, [dbKey1.id, dbKey2.id]));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  await t.test('1. Tier 1 single-key success path records usage', async () => {
    setDecryptApiKey(async (ciphertextBase64) => {
      return Buffer.from(ciphertextBase64, 'base64').toString('utf-8');
    });

    setCallGeminiGenerateContent(async (apiKey) => {
      assert.equal(apiKey, 'key-1-secret');
      return { text: 'Gemini response text' };
    });

    // Reset before running
    await db.update(apiKeys).set({ usageCount: 2 }).where(eq(apiKeys.id, dbKey1.id));

    const result = await callGemini({
      provider: 'gemini',
      subscriberUserIds: [testUser.id],
      contents: 'Hello',
    });

    assert.equal(result.text, 'Gemini response text');

    const [updatedKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKey1.id));
    assert.equal(updatedKey.usageCount, 3);
  });

  await t.test('2. Rate-limited first key falls through to second candidate and succeeds', async () => {
    let callCount = 0;
    setCallGeminiGenerateContent(async (apiKey) => {
      callCount++;
      if (apiKey === 'key-1-secret') {
        throw new GeminiRateLimitedError('Too many requests', 0.01); // 10ms for fast tests
      }
      return { text: 'Key 2 success response' };
    });

    // Reset usages
    await db.update(apiKeys).set({ usageCount: 2, invalidAttempts: 0, isValid: true }).where(eq(apiKeys.id, dbKey1.id));
    await db.update(apiKeys).set({ usageCount: 5, invalidAttempts: 0, isValid: true }).where(eq(apiKeys.id, dbKey2.id));

    const result = await callGemini({
      provider: 'gemini',
      subscriberUserIds: [testUser.id],
      contents: 'Hello',
    });

    assert.equal(result.text, 'Key 2 success response');
    assert.equal(callCount, 2);

    const [k1] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKey1.id));
    const [k2] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKey2.id));

    assert.equal(k1.usageCount, 2);
    assert.equal(k2.usageCount, 6);
  });

  await t.test('3. Invalid-key error increments invalidAttempts and at threshold sets isValid to false', async () => {
    setCallGeminiGenerateContent(async (apiKey) => {
      if (apiKey === 'key-1-secret') {
        throw new GeminiInvalidKeyError('Invalid API Key');
      }
      return { text: 'Fallback success' };
    });

    process.env.API_KEY_INVALID_ATTEMPTS_THRESHOLD = '2';
    await db.update(apiKeys).set({ invalidAttempts: 0, isValid: true, usageCount: 2 }).where(eq(apiKeys.id, dbKey1.id));
    await db.update(apiKeys).set({ invalidAttempts: 0, isValid: true, usageCount: 5 }).where(eq(apiKeys.id, dbKey2.id));

    const result = await callGemini({
      provider: 'gemini',
      subscriberUserIds: [testUser.id],
      contents: 'Hello',
    });

    assert.equal(result.text, 'Fallback success');

    const [k1] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKey1.id));
    assert.equal(k1.invalidAttempts, 1);
    assert.equal(k1.isValid, true);

    const result2 = await callGemini({
      provider: 'gemini',
      subscriberUserIds: [testUser.id],
      contents: 'Hello',
    });

    assert.equal(result2.text, 'Fallback success');

    const [k1Updated] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKey1.id));
    assert.equal(k1Updated.invalidAttempts, 2);
    assert.equal(k1Updated.isValid, false);
  });

  await t.test('4. Exhausting all candidates throws AiGatewayExhaustedError', async () => {
    setCallGeminiGenerateContent(async () => {
      throw new GeminiInvalidKeyError('Invalid key');
    });

    await db.update(apiKeys).set({ invalidAttempts: 0, isValid: true, usageCount: 0 }).where(eq(apiKeys.id, dbKey1.id));
    await db.update(apiKeys).set({ invalidAttempts: 0, isValid: true, usageCount: 0 }).where(eq(apiKeys.id, dbKey2.id));

    await assert.rejects(
      async () => {
        await callGemini({
          provider: 'gemini',
          subscriberUserIds: [testUser.id],
          contents: 'Hello',
        });
      },
      (err: any) => {
        return err instanceof AiGatewayExhaustedError;
      }
    );
  });
});
