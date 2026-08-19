import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { triggerScrapeForAccount } from './trigger-scrape-for-account.js';
import type { ScrapeTarget } from './get-scrape-targets.js';

// Force off to prevent real Apify calls during tests
process.env.SCRAPE_INLINE_FALLBACK_ENABLED = 'false';
process.env.SCRAPING_QUEUE_URL = '';

test('triggerScrapeForAccount function', async (t) => {
  let testProfile: any;

  await t.test('setup - create test profile', async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test_trigger_account',
      platform: 'instagram',
      username: 'test_trigger_user',
      displayName: 'Test Trigger Account',
      profileImageUrl: null,
      description: null,
      scrapeTriggeredAt: null,
      lastScrapedAt: null,
    }).returning();
    testProfile = profile;
  });

  await t.test('stamps scrapeTriggeredAt before attempting cascade', async () => {
    const before = new Date();

    const scrapeTarget: ScrapeTarget = {
      profileId: testProfile.id,
      platform: 'instagram',
      accountId: testProfile.accountId,
      username: testProfile.username,
      isInitialNewSubscription: true,
    };

    const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Call the function (it will fail due to no queue, but should still stamp the timestamp)
    await triggerScrapeForAccount(scrapeTarget, newerThan);

    const after = new Date();

    // Verify scrapeTriggeredAt was set
    const updated = await db.select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, testProfile.id))
      .limit(1);

    const scrapeTriggeredAt = (updated[0] as any).scrapeTriggeredAt;
    assert.ok(scrapeTriggeredAt, 'scrapeTriggeredAt should be set');
    assert.ok(
      scrapeTriggeredAt >= before && scrapeTriggeredAt <= after,
      'scrapeTriggeredAt should be between before and after timestamps'
    );
  });

  await t.test('cleanup - delete test profile', async () => {
    await db.delete(posts).where(eq(posts.accountId, testProfile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
  });
});
