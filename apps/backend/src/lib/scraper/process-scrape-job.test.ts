import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, users, apiKeys, subscriptions } from '@festgrid/database';
import { registerScraperAdapter, ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult } from '@festgrid/domain';
import { processScrapeJob } from './process-scrape-job.js';
import { eq, inArray } from 'drizzle-orm';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';

test('process-scrape-job integration tests', async (t) => {
  let testUser: any;
  const createdProfiles: string[] = [];
  const createdPosts: string[] = [];
  const createdUsers: string[] = [];
  const createdApiKeys: string[] = [];
  const createdSubscriptions: string[] = [];

  const originalSendSqsMessage = sendSqsMessage;
  const originalAiProcessingQueueUrl = process.env.AI_PROCESSING_QUEUE_URL;
  t.after(() => {
    setSendSqsMessage(originalSendSqsMessage);
    if (originalAiProcessingQueueUrl === undefined) {
      delete process.env.AI_PROCESSING_QUEUE_URL;
    } else {
      process.env.AI_PROCESSING_QUEUE_URL = originalAiProcessingQueueUrl;
    }
  });

  // Get a seeded user
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least 1 seeded user');
  testUser = seededUsers[0];

  t.afterEach(async () => {
    if (createdSubscriptions.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubscriptions));
      createdSubscriptions.length = 0;
    }
    if (createdApiKeys.length > 0) {
      await db.delete(apiKeys).where(inArray(apiKeys.id, createdApiKeys));
      createdApiKeys.length = 0;
    }
    if (createdProfiles.length > 0) {
      await db.delete(posts).where(inArray(posts.accountId, createdProfiles));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
      createdProfiles.length = 0;
    }
    if (createdPosts.length > 0) {
      await db.delete(posts).where(inArray(posts.id, createdPosts));
      createdPosts.length = 0;
    }
    if (createdUsers.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUsers));
      createdUsers.length = 0;
    }
  });

  await t.test('processes scrape job correctly, computes lookback default, persists posts and stamps lastScrapedAt', async () => {
    // Register a mock platform for the test
    const mockPlatform = 'test-fake-platform' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let computedNewerThan: string | undefined = undefined;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
        computedNewerThan = options?.newerThan;
        return [
          {
            content: 'Fake post 1',
            postUrl: `${uniqueUrlBase}/p/1`,
            publishedAt: '2026-08-08T12:00:00Z',
          },
        ];
      },
      async lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    // Create profile
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-1-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account 1',
      username: 'fake_acc_1',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    // Run the job
    await processScrapeJob(job);

    // 1. Assert computedNewerThan is lookback default (approx 7 days ago)
    assert.ok(computedNewerThan);
    const newerThanDate = new Date(computedNewerThan);
    const now = new Date();
    const diffDays = (now.getTime() - newerThanDate.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays >= 6.9 && diffDays <= 7.1, 'newerThan should default to ~7 days ago');

    // 2. Assert post persisted
    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 1);
    assert.strictEqual(dbPosts[0].content, 'Fake post 1');
    assert.strictEqual(dbPosts[0].postUrl, `${uniqueUrlBase}/p/1`);
    createdPosts.push(dbPosts[0].id);

    // 3. Assert lastScrapedAt stamped
    const [updatedProfile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.ok(updatedProfile.lastScrapedAt);
  });

  await t.test('computes newerThan correctly based on MAX(posts.publishedAt)', async () => {
    const mockPlatform = 'test-fake-platform-2' as any;
    let computedNewerThan: string | undefined = undefined;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
        computedNewerThan = options?.newerThan;
        return [];
      },
      async lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    // Create profile
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-2-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account 2',
      username: 'fake_acc_2',
    }).returning();
    createdProfiles.push(profile.id);

    // Create an existing post published 2 days ago
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - 2);

    const [existingPost] = await db.insert(posts).values({
      accountId: profile.id,
      platform: mockPlatform,
      content: 'Existing post',
      postUrl: 'https://fake.com/p/existing',
      publishedAt,
    }).returning();
    createdPosts.push(existingPost.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    // Run the job
    await processScrapeJob(job);

    assert.ok(computedNewerThan);
    assert.strictEqual(new Date(computedNewerThan).toISOString(), publishedAt.toISOString(), 'newerThan should equal existing post publishedAt');
  });

  await t.test('retries with wider windows for a brand-new subscription when the adapter cannot filter by newerThan+limit in one call', async () => {
    const mockPlatform = 'test-fake-platform-3' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const seenWindows: string[] = [];

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: false,
      async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
        seenWindows.push(options?.newerThan ?? '');
        if (seenWindows.length === 1) {
          return Array.from({ length: 4 }, (_, index) => ({
            content: `Retry window ${seenWindows.length} post ${index + 1}`,
            postUrl: `${uniqueUrlBase}/r1/p${index + 1}`,
            publishedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
          }));
        }

        if (seenWindows.length === 2) {
          return Array.from({ length: 4 }, (_, index) => ({
            content: `Retry window ${seenWindows.length} post ${index + 1}`,
            postUrl: `${uniqueUrlBase}/r2/p${index + 1}`,
            publishedAt: new Date(Date.now() - (index + 2) * 60 * 60 * 1000).toISOString(),
          }));
        }

        return Array.from({ length: 5 }, (_, index) => ({
          content: `Retry window ${seenWindows.length} post ${index + 1}`,
          postUrl: `${uniqueUrlBase}/r3/p${index + 1}`,
          publishedAt: new Date(Date.now() - (index + 3) * 60 * 60 * 1000).toISOString(),
        }));
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-3-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account 3',
      username: 'fake_acc_3',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
      isInitialNewSubscription: true,
    };

    await processScrapeJob(job);

    assert.ok(seenWindows.length >= 2, 'new-subscribe path should retry across wider lookback windows');
    assert.ok(seenWindows[0] !== seenWindows[1], 'retry windows should widen between attempts');

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.ok(dbPosts.length >= 8, 'retried new-subscribe path should keep fetching until the unique-post threshold is reached');
    createdPosts.push(...dbPosts.map((post) => post.id));
  });

  await t.test('fetches once with the widest lookback window for a brand-new subscription when the adapter supports newerThan+limit filtering', async () => {
    const mockPlatform = 'test-fake-platform-5' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let callCount = 0;
    let seenNewerThan: string | undefined;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
        callCount += 1;
        seenNewerThan = options?.newerThan;
        return Array.from({ length: 3 }, (_, index) => ({
          content: `Single-shot post ${index + 1}`,
          postUrl: `${uniqueUrlBase}/single/p${index + 1}`,
          publishedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
        }));
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-5-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account 5',
      username: 'fake_acc_5',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
      isInitialNewSubscription: true,
    };

    await processScrapeJob(job);

    assert.strictEqual(callCount, 1, 'single-call-capable adapter should be fetched exactly once, not retried across windows');

    assert.ok(seenNewerThan);
    const diffDays = (Date.now() - new Date(seenNewerThan).getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays >= 29.9 && diffDays <= 30.1, 'newerThan should use the widest configured retry window (30 days)');

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 3);
    createdPosts.push(...dbPosts.map((post) => post.id));
  });

  await t.test('handles adapter throw without propagating error (AC7)', async () => {
    const mockPlatform = 'test-fake-platform-4' as any;

    const throwingAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        throw new Error('Fake adapter failure');
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, throwingAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-4-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account 4',
      username: 'fake_acc_4',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    // Run job: should not throw!
    await assert.doesNotReject(async () => {
      await processScrapeJob(job);
    });

    // Stamping still runs in finally block
    const [updatedProfile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.ok(updatedProfile.lastScrapedAt);
  });

  await t.test('persists hashtags and additionalImageUrls from a carousel ScrapedPost through the main scrape path (AC6 + carousel wiring)', async () => {
    const mockPlatform = 'test-fake-platform-carousel' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Carousel post with hashtags',
            postUrl: `${uniqueUrlBase}/p/carousel`,
            publishedAt: '2026-08-08T12:00:00Z',
            hashtags: ['festival', 'music'],
            additionalImageUrls: [
              'https://fake.com/slide2.jpg',
              'https://fake.com/slide3.jpg',
            ],
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-carousel-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Carousel Account',
      username: 'fake_acc_carousel',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await processScrapeJob(job);

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 1);
    createdPosts.push(dbPosts[0].id);

    // AC6: hashtags must now be forwarded through the main scrape path's persistScrapedPost call
    assert.deepStrictEqual(dbPosts[0].hashtags, ['festival', 'music']);
    // Carousel wiring: additionalImageUrls persisted
    assert.deepStrictEqual(dbPosts[0].additionalImageUrls, [
      'https://fake.com/slide2.jpg',
      'https://fake.com/slide3.jpg',
    ]);
  });

  await t.test('calls backfillAccountProfileAndInferDefaultLocationSeam on successful scrape and handles throw gracefully', async (subT) => {
    const {
      backfillAccountProfileAndInferDefaultLocationSeam,
      setBackfillAccountProfileAndInferDefaultLocationSeam,
    } = await import('./process-scrape-job.js');

    subT.after(() => {
      // Restore original seam
      setBackfillAccountProfileAndInferDefaultLocationSeam(backfillAccountProfileAndInferDefaultLocationSeam);
    });

    const mockPlatform = 'test-fake-platform-backfill' as any;
    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Fake post with backfill',
            postUrl: 'https://fake-url/1',
            publishedAt: '2026-08-08T12:00:00Z',
            ownerDisplayName: 'New Display Name',
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-backfill-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account Backfill',
      username: 'fake_acc_backfill',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    // Subtest 1: Verify it calls the seam with correct posts list
    let calledWithPosts: any = null;
    let calledWithAccountId: string | null = null;

    setBackfillAccountProfileAndInferDefaultLocationSeam(async (accountId, posts) => {
      calledWithAccountId = accountId;
      calledWithPosts = posts;
    });

    await processScrapeJob(job);

    assert.strictEqual(calledWithAccountId, profile.id);
    assert.ok(calledWithPosts);
    assert.strictEqual(calledWithPosts.length, 1);
    assert.strictEqual(calledWithPosts[0].content, 'Fake post with backfill');

    // Subtest 2: Verify it catches and swallows if backfill throws, still completes successfully
    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {
      throw new Error('Seam thrown error');
    });

    await assert.doesNotReject(async () => {
      await processScrapeJob(job);
    });

    const [updatedProfile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.ok(updatedProfile.lastScrapedAt);
  });

  await t.test('persists discovered social_media_account_profiles rows for a ScrapedPost with ownerId+coauthors populated (Story 3.14)', async () => {
    const mockPlatform = 'test-fake-platform-attribution' as any;
    const ownerId = 'discovered-owner-psj-' + Date.now();
    const coauthorId = 'discovered-coauthor-psj-' + Date.now();
    const postUrl = `https://fake.com/p/attribution-${Date.now()}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Fake post with attribution',
            postUrl,
            publishedAt: '2026-08-08T12:00:00Z',
            ownerId,
            ownerUsername: 'owner_psj_user',
            coauthors: [{ accountId: coauthorId, username: 'coauthor_psj_user' }],
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(username: string): Promise<any> {
        return null;
      },
      async getPostByUrl(url: string): Promise<ScrapedPost | null> {
        return null;
      },
    };

    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-attribution-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Attribution Account',
      username: 'fake_acc_attribution',
    }).returning();
    createdProfiles.push(profile.id);

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await processScrapeJob(job);

    // Story 3.15 (AC3) resolves a new post's accountId to the discovered publisher (ownerId)
    // profile when ownerId is present and resolves successfully -- not to the scraping
    // account's own profile.id as this Story 3.14 test originally assumed. Look the post up
    // by its known postUrl instead, which is agnostic to that resolution.
    const dbPosts = await db.select().from(posts).where(eq(posts.postUrl, postUrl));
    assert.strictEqual(dbPosts.length, 1);
    createdPosts.push(dbPosts[0].id);

    const discoveredOwnerProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, ownerId))
      .then((rows) => rows[0]);
    assert.ok(discoveredOwnerProfile, 'publisher discovered profile row should exist');
    createdProfiles.push(discoveredOwnerProfile.id);

    const discoveredCoauthorProfile = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, coauthorId))
      .then((rows) => rows[0]);
    assert.ok(discoveredCoauthorProfile, 'coauthor discovered profile row should exist');
    createdProfiles.push(discoveredCoauthorProfile.id);
  });

  await t.test('Story 3.6z: a new post with an available key gets auto-enqueued', async () => {
    const mockPlatform = 'test-fake-platform-autoenqueue-available' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Auto-enqueue available-key post',
            postUrl: `${uniqueUrlBase}/p/1`,
            publishedAt: '2026-08-08T12:00:00Z',
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(): Promise<any> {
        return null;
      },
      async getPostByUrl(): Promise<ScrapedPost | null> {
        return null;
      },
    };
    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-autoenqueue-available-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account Auto-Enqueue Available',
      username: 'fake_acc_autoenqueue_available',
    }).returning();
    createdProfiles.push(profile.id);

    const [subscribedUser] = await db.insert(users).values({
      email: `autoenqueue-available-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    createdUsers.push(subscribedUser.id);

    const [sub] = await db.insert(subscriptions).values({ userId: subscribedUser.id, accountId: profile.id }).returning();
    createdSubscriptions.push(sub.id);

    const [key] = await db.insert(apiKeys).values({
      userId: subscribedUser.id,
      provider: 'gemini',
      keyEncrypted: 'mock-encrypted-key',
      keyLast4: '4321',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
      usageCycleResetAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    }).returning();
    createdApiKeys.push(key.id);

    let sqsSendCount = 0;
    let sentBody = '';
    setSendSqsMessage(async (_queueUrl, body) => {
      sqsSendCount++;
      sentBody = body;
    });
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await processScrapeJob(job);

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 1);
    createdPosts.push(dbPosts[0].id);

    assert.strictEqual(sqsSendCount, 1, 'a new post with an available key should be auto-enqueued exactly once');
    const parsed = JSON.parse(sentBody);
    assert.strictEqual(parsed.postId, dbPosts[0].id);

    const [reloaded] = await db.select().from(posts).where(eq(posts.id, dbPosts[0].id));
    assert.ok(reloaded.queuedForExtractionAt, 'the claimed post should carry a non-null queuedForExtractionAt');
    assert.strictEqual(reloaded.isExtracted, false);
  });

  await t.test('Story 3.6z: a new post with no available key is not enqueued, no throw, job completes normally', async () => {
    const mockPlatform = 'test-fake-platform-autoenqueue-unavailable' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Auto-enqueue no-key post',
            postUrl: `${uniqueUrlBase}/p/1`,
            publishedAt: '2026-08-08T12:00:00Z',
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(): Promise<any> {
        return null;
      },
      async getPostByUrl(): Promise<ScrapedPost | null> {
        return null;
      },
    };
    registerScraperAdapter(mockPlatform, fakeAdapter);

    // No subscribers at all -> hasAvailableApiKeyForAccount returns false immediately.
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-autoenqueue-unavailable-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account Auto-Enqueue Unavailable',
      username: 'fake_acc_autoenqueue_unavailable',
    }).returning();
    createdProfiles.push(profile.id);

    let sqsSendCount = 0;
    setSendSqsMessage(async () => {
      sqsSendCount++;
    });
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await assert.doesNotReject(async () => {
      await processScrapeJob(job);
    });

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 1);
    createdPosts.push(dbPosts[0].id);

    assert.strictEqual(sqsSendCount, 0, 'a new post with no available key must not be auto-enqueued');
    assert.strictEqual(dbPosts[0].isExtracted, false);
    assert.strictEqual(dbPosts[0].queuedForExtractionAt, null);
  });

  await t.test('Story 3.6z: an already-existing post (alreadyExisted: true) never triggers a key check or enqueue attempt', async () => {
    const mockPlatform = 'test-fake-platform-autoenqueue-existing' as any;
    const postUrl = `https://fake.com/p/autoenqueue-existing-${Date.now()}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'Re-scraped existing post, updated',
            postUrl,
            publishedAt: '2026-08-08T12:00:00Z',
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(): Promise<any> {
        return null;
      },
      async getPostByUrl(): Promise<ScrapedPost | null> {
        return null;
      },
    };
    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-autoenqueue-existing-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account Auto-Enqueue Existing',
      username: 'fake_acc_autoenqueue_existing',
    }).returning();
    createdProfiles.push(profile.id);

    // Pre-existing post with the same postUrl, with an available key subscriber -- if the
    // already-existed branch incorrectly ran the key check/enqueue, this would get enqueued.
    const [subscribedUser] = await db.insert(users).values({
      email: `autoenqueue-existing-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    createdUsers.push(subscribedUser.id);

    const [sub] = await db.insert(subscriptions).values({ userId: subscribedUser.id, accountId: profile.id }).returning();
    createdSubscriptions.push(sub.id);

    const [key] = await db.insert(apiKeys).values({
      userId: subscribedUser.id,
      provider: 'gemini',
      keyEncrypted: 'mock-encrypted-key',
      keyLast4: '5678',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
      usageCycleResetAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    }).returning();
    createdApiKeys.push(key.id);

    const [existingPost] = await db.insert(posts).values({
      accountId: profile.id,
      platform: mockPlatform,
      content: 'Original content',
      postUrl,
      publishedAt: new Date('2026-08-08T12:00:00Z'),
      isExtracted: false,
    }).returning();
    createdPosts.push(existingPost.id);

    let sqsSendCount = 0;
    setSendSqsMessage(async () => {
      sqsSendCount++;
    });
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await processScrapeJob(job);

    assert.strictEqual(sqsSendCount, 0, 'a re-scrape of an already-existing post must never trigger auto-enqueue');

    const [reloaded] = await db.select().from(posts).where(eq(posts.id, existingPost.id));
    assert.strictEqual(reloaded.queuedForExtractionAt, null);
  });

  await t.test('Story 3.6z: a thrown auto-enqueue error is caught and logged; the job still persists/attempts auto-enqueue for subsequent posts', async () => {
    const mockPlatform = 'test-fake-platform-autoenqueue-partial-failure' as any;
    const uniqueUrlBase = `https://fake.com/${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const fakeAdapter: ScraperAdapter = {
      supportsNewerThanAndLimitFiltering: true,
      async getNewestPosts(): Promise<ScrapedPost[]> {
        return [
          {
            content: 'First post, auto-enqueue will throw',
            postUrl: `${uniqueUrlBase}/p/1`,
            publishedAt: '2026-08-08T12:00:00Z',
          },
          {
            content: 'Second post, auto-enqueue should still be attempted',
            postUrl: `${uniqueUrlBase}/p/2`,
            publishedAt: '2026-08-08T12:05:00Z',
          },
        ];
      },
      async lookupAccountProfile(): Promise<AccountProfileLookupResult | null> {
        return null;
      },
      async getAccountClassificationProfile(): Promise<any> {
        return null;
      },
      async getPostByUrl(): Promise<ScrapedPost | null> {
        return null;
      },
    };
    registerScraperAdapter(mockPlatform, fakeAdapter);

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'fake-acc-autoenqueue-partial-' + Date.now(),
      platform: mockPlatform,
      displayName: 'Fake Account Auto-Enqueue Partial Failure',
      username: 'fake_acc_autoenqueue_partial',
    }).returning();
    createdProfiles.push(profile.id);

    const [subscribedUser] = await db.insert(users).values({
      email: `autoenqueue-partial-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    createdUsers.push(subscribedUser.id);

    const [sub] = await db.insert(subscriptions).values({ userId: subscribedUser.id, accountId: profile.id }).returning();
    createdSubscriptions.push(sub.id);

    const [key] = await db.insert(apiKeys).values({
      userId: subscribedUser.id,
      provider: 'gemini',
      keyEncrypted: 'mock-encrypted-key',
      keyLast4: '9012',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
      usageCycleResetAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    }).returning();
    createdApiKeys.push(key.id);

    let sendCallCount = 0;
    setSendSqsMessage(async () => {
      sendCallCount++;
      if (sendCallCount === 1) {
        throw new Error('Simulated SQS send failure for first post');
      }
    });
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

    const job = {
      profileId: profile.id,
      platform: mockPlatform,
      accountId: profile.accountId,
      username: profile.username,
    };

    await assert.doesNotReject(async () => {
      await processScrapeJob(job);
    });

    const dbPosts = await db.select().from(posts).where(eq(posts.accountId, profile.id));
    assert.strictEqual(dbPosts.length, 2, 'both posts should still be persisted despite the first auto-enqueue throwing');
    createdPosts.push(...dbPosts.map((p) => p.id));

    assert.strictEqual(sendCallCount, 2, 'auto-enqueue should still be attempted for the second post after the first one threw');
  });
});
