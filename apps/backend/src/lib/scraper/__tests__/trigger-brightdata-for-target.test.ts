// apps/backend/src/lib/scraper/__tests__/trigger-brightdata-for-target.test.ts
import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { attemptBrightDataTrigger, setAttemptBrightDataTrigger } from '../trigger-brightdata-for-target.js';

const BRIGHTDATA_TEST_PROVIDER = 'brightdata';

test('trigger-brightdata-for-target', async (t) => {
  const originalAttemptBrightDataTrigger = attemptBrightDataTrigger;

  t.after(async () => {
    await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, BRIGHTDATA_TEST_PROVIDER));
    setAttemptBrightDataTrigger(originalAttemptBrightDataTrigger);
  });

  await t.test('attemptBrightDataTrigger function exists', async () => {
    // Basic test to verify the function exists and is callable
    assert.ok(typeof attemptBrightDataTrigger === 'function');
    // Full mocking requires additional setup; integration tests should cover detailed behavior
  });

  await t.test('returns CAPACITY_EXHAUSTED when capacity unavailable', async () => {
    // Exhaust capacity for the real brightdata provider (real-DB technique, no HTTP mocking --
    // mirrors trigger-apify-for-target.test.ts's own approach).
    await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, BRIGHTDATA_TEST_PROVIDER));
    await db.insert(scraperProviderUsage).values({
      provider: BRIGHTDATA_TEST_PROVIDER,
      itemsUsedThisCycle: 10000,
      usageCycleResetAt: new Date(Date.now() + 86400000),
    });

    const result = await attemptBrightDataTrigger(
      { profileId: 'test-brightdata-profile', username: 'test_user' },
      '2026-08-01T00:00:00Z'
    );

    assert.deepStrictEqual(result, { success: false, failureReason: 'CAPACITY_EXHAUSTED' });
  });
});

