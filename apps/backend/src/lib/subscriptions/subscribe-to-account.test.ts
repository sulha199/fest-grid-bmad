import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { and, eq, inArray } from 'drizzle-orm';
import { subscribeToAccount } from './subscribe-to-account.js';
import { attemptApifyAsyncTrigger, setAttemptApifyAsyncTrigger } from '../scraper/trigger-apify-for-target.js';
import {
  setGetAccountClassificationProfileSeam,
  setCallGeminiForAccountClassificationSeam,
  getAccountClassificationProfileSeam,
  callGeminiForAccountClassificationSeam,
} from '../accounts/classify-account-type.js';
import { accountTypeClassificationReviews } from '@festgrid/database';
import '../scraper/register-adapters.js';

// A classification result above the confidence threshold that resolves to a scrape-eligible
// account type, for tests that only care about exercising the scrape-trigger path itself.
function mockOrganizerConfirmedClassification(username: string) {
  setGetAccountClassificationProfileSeam(async () => ({
    username,
    displayName: 'Test Account',
    biography: 'Music Events',
    businessCategoryName: 'Event',
  }));
  setCallGeminiForAccountClassificationSeam(async () => ({
    text: JSON.stringify({ accountType: 'ORGANIZER_VENUE_EVENT', confidenceScore: 0.9 }),
  }));
}

test('subscribe-to-account tests', async (t) => {
  let testUserId: string;
  const testPlatform = 'instagram';
  const originalAttemptApifyAsyncTrigger = attemptApifyAsyncTrigger;

  const ts = Date.now();
  const testAccountId1 = `account-123-${ts}`;
  const testAccountId2 = `account-456-${ts}`;
  const testAccountId3 = `account-789-${ts}`;
  const testAccountIds = [testAccountId1, testAccountId2, testAccountId3];

  t.before(async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/dummy-queue';
    
    // Clean up any leaked test data from previous failed/aborted runs
    const profileRows = await db
      .select({ id: socialMediaAccountProfiles.id })
      .from(socialMediaAccountProfiles)
      .where(
        and(
          eq(socialMediaAccountProfiles.platform, testPlatform),
          inArray(socialMediaAccountProfiles.accountId, testAccountIds)
        )
      );
    
    if (profileRows.length > 0) {
      const ids = profileRows.map(r => r.id);
      await db.delete(subscriptions).where(inArray(subscriptions.accountId, ids));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, ids));
    }

    const [user] = await db.insert(users).values({
      email: 'test-subscribe-' + Date.now() + '@example.com',
    }).returning({ id: users.id });
    testUserId = user.id;
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
    setGetAccountClassificationProfileSeam(getAccountClassificationProfileSeam);
    setCallGeminiForAccountClassificationSeam(callGeminiForAccountClassificationSeam);
  });

  t.afterEach(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUserId));

    // Delete any classification review rows first: account_type_classification_reviews.account_id
    // has a foreign key to social_media_account_profiles.id with no cascade, so a classified
    // account (AWAITING_APPROVAL inserts a review row) would otherwise block the profile delete below.
    const profileRows = await db
      .select({ id: socialMediaAccountProfiles.id })
      .from(socialMediaAccountProfiles)
      .where(
        and(
          eq(socialMediaAccountProfiles.platform, testPlatform),
          inArray(socialMediaAccountProfiles.accountId, testAccountIds)
        )
      );
    if (profileRows.length > 0) {
      const ids = profileRows.map((r) => r.id);
      await db.delete(accountTypeClassificationReviews).where(inArray(accountTypeClassificationReviews.accountId, ids));
    }

    await db.delete(socialMediaAccountProfiles).where(
      and(
        eq(socialMediaAccountProfiles.platform, testPlatform),
        inArray(socialMediaAccountProfiles.accountId, testAccountIds)
      )
    );
  });

  await t.test('triggers Apify async and skips SQS when async succeeds', async () => {
    let apifyAsyncCalled = false;

    // Mock Apify async trigger to succeed
    setAttemptApifyAsyncTrigger(async () => {
      apifyAsyncCalled = true;
      return true;
    });
    // Classification now gates the scrape trigger (Story 3.4n) — mock it to resolve to a
    // scrape-eligible account type so this test still exercises the Apify-async path it intends to.
    mockOrganizerConfirmedClassification('testaccount');

    const result = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId1,
      profile: {
        displayName: 'Test Account',
        username: 'testaccount',
      },
    });

    assert.ok(result.profile);
    assert.strictEqual(result.alreadySubscribed, false);
    assert.ok(apifyAsyncCalled, 'Apify async trigger should have been called');
  });

  await t.test('falls back to Bright Data when Apify async fails', async () => {
    // Mock Apify async to fail
    setAttemptApifyAsyncTrigger(async () => false);
    // Classification gates the scrape trigger — mock it so the fallback path still fires.
    mockOrganizerConfirmedClassification('testaccount2');

    const result = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId2,
      profile: {
        displayName: 'Test Account 2',
        username: 'testaccount2',
      },
    });

    assert.ok(result.profile);
    assert.strictEqual(result.alreadySubscribed, false);
  });

  await t.test('returns existing subscription if already subscribed', async () => {
    // Mock Apify async to succeed
    setAttemptApifyAsyncTrigger(async () => true);
    // Classification gates the scrape trigger on the first (insert) call this test makes.
    mockOrganizerConfirmedClassification('testaccount3');

    // First subscription
    const firstResult = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId3,
      profile: {
        displayName: 'Test Account 3',
        username: 'testaccount3',
      },
    });

    assert.strictEqual(firstResult.alreadySubscribed, false);

    // Second subscription to same account
    const secondResult = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: testAccountId3,
      profile: {
        displayName: 'Test Account 3',
        username: 'testaccount3',
      },
    });

    assert.strictEqual(secondResult.alreadySubscribed, true);
    assert.strictEqual(firstResult.profile.id, secondResult.profile.id);
    assert.strictEqual(firstResult.subscription.id, secondResult.subscription.id);
  });

  await t.test('classification gating logic: gates scraper trigger based on accountType and accountTypeStatus', async (subT) => {
    const {
      setGetAccountClassificationProfileSeam,
      setCallGeminiForAccountClassificationSeam,
      getAccountClassificationProfileSeam,
      callGeminiForAccountClassificationSeam
    } = await import('../accounts/classify-account-type.js');
    const { accountTypeClassificationReviews } = await import('@festgrid/database');

    subT.afterEach(() => {
      setGetAccountClassificationProfileSeam(getAccountClassificationProfileSeam);
      setCallGeminiForAccountClassificationSeam(callGeminiForAccountClassificationSeam);
    });

    // Case A: ORGANIZER_VENUE_EVENT and CONFIRMED should trigger scrape
    let scrapeCalledA = false;
    setAttemptApifyAsyncTrigger(async () => {
      scrapeCalledA = true;
      return true;
    });
    setGetAccountClassificationProfileSeam(async () => ({
      username: 'org_user',
      displayName: 'Org User',
      biography: 'Music Events',
      businessCategoryName: 'Event'
    }));
    setCallGeminiForAccountClassificationSeam(async () => ({
      text: JSON.stringify({ accountType: 'ORGANIZER_VENUE_EVENT', confidenceScore: 0.9 })
    }));

    const resultA = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: `gated-abc-${ts}`,
      profile: { displayName: 'Org User', username: 'org_user' }
    });
    assert.strictEqual(scrapeCalledA, true, 'Scrape should be triggered for CONFIRMED ORGANIZER_VENUE_EVENT');
    assert.strictEqual(resultA.profile.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.strictEqual(resultA.profile.accountTypeStatus, 'CONFIRMED');

    // Case B: PERSONAL should NOT trigger scrape
    let scrapeCalledB = false;
    setAttemptApifyAsyncTrigger(async () => {
      scrapeCalledB = true;
      return true;
    });
    setGetAccountClassificationProfileSeam(async () => ({
      username: 'pers_user',
      displayName: 'Pers User',
      biography: 'Just blogging',
      businessCategoryName: null
    }));
    setCallGeminiForAccountClassificationSeam(async () => ({
      text: JSON.stringify({ accountType: 'PERSONAL', confidenceScore: 0.85 })
    }));

    const resultB = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: `gated-def-${ts}`,
      profile: { displayName: 'Pers User', username: 'pers_user' }
    });
    assert.strictEqual(scrapeCalledB, false, 'Scrape should NOT be triggered for PERSONAL');
    assert.strictEqual(resultB.profile.accountType, 'PERSONAL');
    assert.strictEqual(resultB.profile.accountTypeStatus, 'CONFIRMED');

    // Case C: CURATOR_GUIDE should NOT trigger scrape
    let scrapeCalledC = false;
    setAttemptApifyAsyncTrigger(async () => {
      scrapeCalledC = true;
      return true;
    });
    setGetAccountClassificationProfileSeam(async () => ({
      username: 'cur_user',
      displayName: 'Cur User',
      biography: 'List of events',
      businessCategoryName: null
    }));
    setCallGeminiForAccountClassificationSeam(async () => ({
      text: JSON.stringify({ accountType: 'CURATOR_GUIDE', confidenceScore: 0.9 })
    }));

    const resultC = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: `gated-ghi-${ts}`,
      profile: { displayName: 'Cur User', username: 'cur_user' }
    });
    assert.strictEqual(scrapeCalledC, false, 'Scrape should NOT be triggered for CURATOR_GUIDE');
    assert.strictEqual(resultC.profile.accountType, 'CURATOR_GUIDE');
    assert.strictEqual(resultC.profile.accountTypeStatus, 'CONFIRMED');

    // Case D: AWAITING_APPROVAL (low confidence) should NOT trigger scrape
    let scrapeCalledD = false;
    setAttemptApifyAsyncTrigger(async () => {
      scrapeCalledD = true;
      return true;
    });
    setGetAccountClassificationProfileSeam(async () => ({
      username: 'low_user',
      displayName: 'Low User',
      biography: 'Blah',
      businessCategoryName: null
    }));
    setCallGeminiForAccountClassificationSeam(async () => ({
      text: JSON.stringify({ accountType: 'ORGANIZER_VENUE_EVENT', confidenceScore: 0.5 })
    }));

    const resultD = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: `gated-jkl-${ts}`,
      profile: { displayName: 'Low User', username: 'low_user' }
    });
    assert.strictEqual(scrapeCalledD, false, 'Scrape should NOT be triggered for AWAITING_APPROVAL');
    assert.strictEqual(resultD.profile.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.strictEqual(resultD.profile.accountTypeStatus, 'AWAITING_APPROVAL');

    // Case E: Classification hard failure should NOT trigger scrape but subscription must still succeed (AC4)
    let scrapeCalledE = false;
    setAttemptApifyAsyncTrigger(async () => {
      scrapeCalledE = true;
      return true;
    });
    setGetAccountClassificationProfileSeam(async () => {
      throw new Error('Apify down');
    });

    const resultE = await subscribeToAccount({
      userId: testUserId,
      platform: testPlatform,
      accountId: `gated-mno-${ts}`,
      profile: { displayName: 'Error User', username: 'err_user' }
    });
    assert.strictEqual(scrapeCalledE, false, 'Scrape should NOT be triggered when classification fails');
    assert.ok(resultE.subscription, 'Subscription must still succeed on classification hard failure');
    assert.equal(resultE.profile.accountTypeStatus, 'AWAITING_APPROVAL');

    // Cleanup extra profiles
    const extraAccountIds = [`gated-abc-${ts}`, `gated-def-${ts}`, `gated-ghi-${ts}`, `gated-jkl-${ts}`, `gated-mno-${ts}`];
    const profileRows = await db
      .select({ id: socialMediaAccountProfiles.id })
      .from(socialMediaAccountProfiles)
      .where(and(eq(socialMediaAccountProfiles.platform, testPlatform), inArray(socialMediaAccountProfiles.accountId, extraAccountIds)));
    if (profileRows.length > 0) {
      const ids = profileRows.map(r => r.id);
      await db.delete(accountTypeClassificationReviews).where(inArray(accountTypeClassificationReviews.accountId, ids));
      await db.delete(subscriptions).where(inArray(subscriptions.accountId, ids));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, ids));
    }
  });
});
