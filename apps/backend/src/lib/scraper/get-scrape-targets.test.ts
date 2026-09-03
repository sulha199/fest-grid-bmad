import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { getBatchScrapeTargets } from './get-scrape-targets.js';
import { eq, inArray } from 'drizzle-orm';
import './register-adapters.js';

test('get-scrape-targets batch targeting tests', async (t) => {
  let user1: any;
  let user2: any;
  const createdProfiles: string[] = [];
  const createdSubs: string[] = [];

  // Get two seeded users
  const seededUsers = await db.select().from(users).limit(2);
  assert.ok(seededUsers.length >= 2, 'Must have at least 2 seeded users for test');
  user1 = seededUsers[0];
  user2 = seededUsers[1];

  t.afterEach(async () => {
    if (createdSubs.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
      createdSubs.length = 0;
    }
    if (createdProfiles.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
      createdProfiles.length = 0;
    }
  });

  await t.test('selects targets with active subscriptions and appropriate lastScrapedAt', async () => {
    // 1. Profile 1: null lastScrapedAt (should be included)
    const [p1] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-1-' + Date.now(),
      platform: 'instagram',
      displayName: 'Test Target 1',
      username: 'target_1',
    }).returning();
    createdProfiles.push(p1.id);

    // 2. Profile 2: scraped 25 hours ago (should be included)
    const scraped25hAgo = new Date();
    scraped25hAgo.setHours(scraped25hAgo.getHours() - 25);
    const [p2] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-2-' + Date.now(),
      platform: 'instagram',
      displayName: 'Test Target 2',
      username: 'target_2',
      lastScrapedAt: scraped25hAgo,
    }).returning();
    createdProfiles.push(p2.id);

    // 3. Profile 3: scraped 1 hour ago (should be excluded)
    const scraped1hAgo = new Date();
    scraped1hAgo.setHours(scraped1hAgo.getHours() - 1);
    const [p3] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-3-' + Date.now(),
      platform: 'instagram',
      displayName: 'Test Target 3',
      username: 'target_3',
      lastScrapedAt: scraped1hAgo,
    }).returning();
    createdProfiles.push(p3.id);

    // 4. Profile 4: unsupported platform (should be filtered out)
    const [p4] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-4-' + Date.now(),
      platform: 'unsupported-platform',
      displayName: 'Test Target 4',
      username: 'target_4',
    }).returning();
    createdProfiles.push(p4.id);

    // Create subscriptions
    // user1 subscribes to p1 (active)
    const [s1] = await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: p1.id,
    }).returning();
    createdSubs.push(s1.id);

    // user1 and user2 subscribe to p2 (deduplication test)
    const [s2a] = await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: p2.id,
    }).returning();
    createdSubs.push(s2a.id);

    const [s2b] = await db.insert(subscriptions).values({
      userId: user2.id,
      accountId: p2.id,
    }).returning();
    createdSubs.push(s2b.id);

    // user1 subscribes to p3 (active but scraped recently, so excluded)
    const [s3] = await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: p3.id,
    }).returning();
    createdSubs.push(s3.id);

    // user1 subscribes to p4 (unsupported, should be excluded)
    const [s4] = await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: p4.id,
    }).returning();
    createdSubs.push(s4.id);

    // 5. Profile 5: soft-deleted subscription (should be excluded)
    const [p5] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-5-' + Date.now(),
      platform: 'instagram',
      displayName: 'Test Target 5',
      username: 'target_5',
    }).returning();
    createdProfiles.push(p5.id);

    const [s5] = await db.insert(subscriptions).values({
      userId: user1.id,
      accountId: p5.id,
      deletedAt: new Date(),
    }).returning();
    createdSubs.push(s5.id);

    const targets = await getBatchScrapeTargets();

    const targetIds = targets.map((t) => t.profileId);

    // Check inclusions
    assert.ok(targetIds.includes(p1.id), 'Profile 1 should be included (lastScrapedAt is null)');
    assert.ok(targetIds.includes(p2.id), 'Profile 2 should be included (lastScrapedAt is 25h ago)');

    // Check deduplication (p2 was joined twice, but should appear once in the return list)
    const p2Occurrences = targetIds.filter((id) => id === p2.id).length;
    assert.strictEqual(p2Occurrences, 1, 'Profile 2 should appear exactly once due to deduplication');

    // Check exclusions
    assert.strictEqual(targetIds.includes(p3.id), false, 'Profile 3 should be excluded (lastScrapedAt is 1h ago)');
    assert.strictEqual(targetIds.includes(p4.id), false, 'Profile 4 should be excluded (unsupported platform)');
    assert.strictEqual(targetIds.includes(p5.id), false, 'Profile 5 should be excluded (soft-deleted subscription)');
  });

  await t.test('filters targets based on accountType classification and status (AC1, AC5)', async () => {
    // 1. Profile Legacy: accountType/Status is NULL (AC5 grandfathering, should be included)
    const [pLegacy] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-legacy-' + Date.now(),
      platform: 'instagram',
      displayName: 'Grandfathered Legacy',
      username: 'legacy_username',
      accountType: null,
      accountTypeStatus: null,
    }).returning();
    createdProfiles.push(pLegacy.id);

    // 2. Profile Confirmed: ORGANIZER_VENUE_EVENT & CONFIRMED (should be included)
    const [pConfirmed] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-confirmed-' + Date.now(),
      platform: 'instagram',
      displayName: 'Confirmed Organizer',
      username: 'confirmed_username',
      accountType: 'ORGANIZER_VENUE_EVENT',
      accountTypeStatus: 'CONFIRMED',
    }).returning();
    createdProfiles.push(pConfirmed.id);

    // 3. Profile Personal: PERSONAL & CONFIRMED (should be excluded)
    const [pPersonal] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-personal-' + Date.now(),
      platform: 'instagram',
      displayName: 'Personal Blog',
      username: 'personal_username',
      accountType: 'PERSONAL',
      accountTypeStatus: 'CONFIRMED',
    }).returning();
    createdProfiles.push(pPersonal.id);

    // 4. Profile Curator: CURATOR_GUIDE & CONFIRMED (should be excluded)
    const [pCurator] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-curator-' + Date.now(),
      platform: 'instagram',
      displayName: 'Curator Guide',
      username: 'curator_username',
      accountType: 'CURATOR_GUIDE',
      accountTypeStatus: 'CONFIRMED',
    }).returning();
    createdProfiles.push(pCurator.id);

    // 5. Profile Awaiting: ORGANIZER_VENUE_EVENT & AWAITING_APPROVAL (should be excluded)
    const [pAwaiting] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test-target-awaiting-' + Date.now(),
      platform: 'instagram',
      displayName: 'Awaiting Review',
      username: 'awaiting_username',
      accountType: 'ORGANIZER_VENUE_EVENT',
      accountTypeStatus: 'AWAITING_APPROVAL',
    }).returning();
    createdProfiles.push(pAwaiting.id);

    // Create active subscriptions for all of them
    const newSubs = await db.insert(subscriptions).values([
      { userId: user1.id, accountId: pLegacy.id },
      { userId: user1.id, accountId: pConfirmed.id },
      { userId: user1.id, accountId: pPersonal.id },
      { userId: user1.id, accountId: pCurator.id },
      { userId: user1.id, accountId: pAwaiting.id },
    ]).returning();
    createdSubs.push(...newSubs.map(s => s.id));

    const targets = await getBatchScrapeTargets();
    const targetIds = targets.map((t) => t.profileId);

    // Assert correct inclusions/exclusions
    assert.ok(targetIds.includes(pLegacy.id), 'Legacy pre-existing profiles should be included (status IS NULL)');
    assert.ok(targetIds.includes(pConfirmed.id), 'Confirmed organizer venue event profiles should be included');
    assert.strictEqual(targetIds.includes(pPersonal.id), false, 'Personal profiles should be excluded');
    assert.strictEqual(targetIds.includes(pCurator.id), false, 'Curator guide profiles should be excluded');
    assert.strictEqual(targetIds.includes(pAwaiting.id), false, 'Awaiting approval profiles should be excluded');
  });
});
