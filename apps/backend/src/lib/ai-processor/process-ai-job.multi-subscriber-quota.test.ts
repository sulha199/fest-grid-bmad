import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users, apiKeys } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { callGemini } from '../ai-gateway/adapter.js';
import { setDecryptApiKey } from '../ai-gateway/kms.js';
import { setCallGeminiGenerateContent, GeminiInvalidKeyError } from '../ai-gateway/gemini-client.js';

test('processAiJob Multi-Subscriber Quota Integration Test', async (t) => {
  // Setup users A and B
  const [userA] = await db.insert(users).values({
    email: `proc-tier2-a-${Date.now()}@example.com`,
    name: 'Proc Tier 2 User A',
  }).returning();

  const [userB] = await db.insert(users).values({
    email: `proc-tier2-b-${Date.now()}@example.com`,
    name: 'Proc Tier 2 User B',
  }).returning();

  // Insert a test social media account profile
  const testProfileAccountId = 'proc-acc-multi-' + Date.now();
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: testProfileAccountId,
      platform: 'instagram',
      displayName: 'Proc Multi Fest Account',
      username: 'proc_multi_' + Date.now()
    })
    .returning();

  // Create subscriptions linking both users to that account (isNewlyAdded: true)
  const [subA] = await db
    .insert(subscriptions)
    .values({
      userId: userA.id,
      accountId: profile.id,
      isNewlyAdded: true
    })
    .returning();

  const [subB] = await db
    .insert(subscriptions)
    .values({
      userId: userB.id,
      accountId: profile.id,
      isNewlyAdded: true
    })
    .returning();

  // Seed API keys
  const [dbKeyA] = await db.insert(apiKeys).values({
    userId: userA.id,
    keyEncrypted: Buffer.from('proc-key-a-secret').toString('base64'),
    keyLast4: 'cret',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
    usageCount: 2,
  }).returning();

  const [dbKeyB] = await db.insert(apiKeys).values({
    userId: userB.id,
    keyEncrypted: Buffer.from('proc-key-b-secret').toString('base64'),
    keyLast4: 'cret',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
    usageCount: 5,
  }).returning();

  t.after(async () => {
    // Cleanup database rows
    await db.delete(apiKeys).where(inArray(apiKeys.id, [dbKeyA.id, dbKeyB.id]));
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    await db.delete(users).where(inArray(users.id, [userA.id, userB.id]));
  });

  await t.test('Integration: derive subscribers real-db -> callGemini multi-subscriber selection with fallback', async () => {
    // Setup Decrypt & Gemini generation seams
    setDecryptApiKey(async (ciphertextBase64) => {
      return Buffer.from(ciphertextBase64, 'base64').toString('utf-8');
    });

    setCallGeminiGenerateContent(async (apiKey) => {
      if (apiKey === 'proc-key-a-secret') {
        throw new GeminiInvalidKeyError('Invalid API Key');
      }
      if (apiKey === 'proc-key-b-secret') {
        return { text: '{"isEvent": true, "eventName": "Proc Conc"}' };
      }
      throw new Error('Unknown key: ' + apiKey);
    });

    // 1. Retrieve subscriber user IDs using real getActiveSubscriberUserIds
    const subscriberUserIds = await getActiveSubscriberUserIds(profile.id);
    assert.ok(subscriberUserIds.includes(userA.id), 'subscriberUserIds should include User A');
    assert.ok(subscriberUserIds.includes(userB.id), 'subscriberUserIds should include User B');
    assert.equal(subscriberUserIds.length, 2, 'Should have exactly 2 subscribers');

    // 2. Call Gemini adapter with derived subscribers
    const result = await callGemini({
      provider: 'gemini',
      subscriberUserIds,
      contents: 'Analyze post',
    });

    assert.equal(result.text, '{"isEvent": true, "eventName": "Proc Conc"}');

    // 3. Assert DB-level changes
    const [updatedKeyA] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKeyA.id));
    const [updatedKeyB] = await db.select().from(apiKeys).where(eq(apiKeys.id, dbKeyB.id));

    // User A key invalid attempt registered
    assert.equal(updatedKeyA.invalidAttempts, 1);
    assert.equal(updatedKeyA.isValid, true);
    assert.equal(updatedKeyA.usageCount, 2);

    // User B key succeeded and count incremented
    assert.equal(updatedKeyB.invalidAttempts, 0);
    assert.equal(updatedKeyB.isValid, true);
    assert.equal(updatedKeyB.usageCount, 6);
  });
});
