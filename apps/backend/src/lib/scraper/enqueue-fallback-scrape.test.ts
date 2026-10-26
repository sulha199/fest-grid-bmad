import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { enqueueFallbackScrape } from './enqueue-fallback-scrape.js';
import { setSendSqsMessage, sendSqsMessage } from './enqueue-scrape-job.js';

// AD-34 Rule 7: re-queuing a profile after a failed vendor run starts a scrape, so it goes through
// the scrape gate and needs an active subscription.
test('enqueueFallbackScrape', async (t) => {
  const originalSendSqsMessage = sendSqsMessage;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;
  let sqsBodies: string[];
  let sqsShouldFail = false;
  const createdProfileIds: string[] = [];
  let userId: string;

  t.before(async () => {
    const [seededUser] = await db.select().from(users).limit(1);
    assert.ok(seededUser, 'Must have at least 1 seeded user for test');
    userId = seededUser.id;
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue';
    setSendSqsMessage(async (_queueUrl, body) => {
      if (sqsShouldFail) throw new Error('SQS unavailable');
      sqsBodies.push(body);
    });
  });

  t.beforeEach(() => {
    sqsBodies = [];
    sqsShouldFail = false;
  });

  t.afterEach(async () => {
    for (const id of createdProfileIds.splice(0)) {
      await db.delete(subscriptions).where(eq(subscriptions.accountId, id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, id));
    }
  });

  t.after(() => {
    setSendSqsMessage(originalSendSqsMessage);
    if (originalQueueUrl === undefined) {
      delete process.env.SCRAPING_QUEUE_URL;
    } else {
      process.env.SCRAPING_QUEUE_URL = originalQueueUrl;
    }
  });

  async function makeProfile(
    overrides: Partial<typeof socialMediaAccountProfiles.$inferInsert> = {},
    subscription: 'active' | 'deleted' | 'none' = 'active'
  ) {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: `fallback-test-${unique}`,
        platform: 'instagram',
        username: `fallback_test_${unique}`,
        displayName: 'Fallback Test',
        ...overrides,
      })
      .returning();
    createdProfileIds.push(profile.id);
    if (subscription !== 'none') {
      await db.insert(subscriptions).values({
        userId,
        accountId: profile.id,
        deletedAt: subscription === 'deleted' ? new Date() : null,
      });
    }
    return profile;
  }

  await t.test('a confirmed organizer with an active subscription is enqueued', async () => {
    const profile = await makeProfile({ accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' });

    assert.strictEqual(await enqueueFallbackScrape(profile.id), 'enqueued');

    assert.strictEqual(sqsBodies.length, 1);
    assert.deepStrictEqual(JSON.parse(sqsBodies[0]), {
      profileId: profile.id,
      accountId: profile.accountId,
      // A handle-keyed profile is scraped by its account_id, not the mutable username (BUG-081).
      username: profile.accountId,
      platform: 'instagram',
    });
  });

  await t.test('a confirmed curator is enqueued, and so is a legacy account that was never classified', async () => {
    const curator = await makeProfile({ accountType: 'CURATOR_GUIDE', accountTypeStatus: 'CONFIRMED' });
    const legacy = await makeProfile({ accountType: null, accountTypeStatus: null });

    assert.strictEqual(await enqueueFallbackScrape(curator.id), 'enqueued');
    assert.strictEqual(await enqueueFallbackScrape(legacy.id), 'enqueued');
    assert.strictEqual(sqsBodies.length, 2);
  });

  await t.test('a personal account is never scraped, even on the fallback path', async () => {
    const profile = await makeProfile({ accountType: 'PERSONAL', accountTypeStatus: 'CONFIRMED' });

    assert.strictEqual(await enqueueFallbackScrape(profile.id), 'skipped');

    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('an account awaiting approval is not scraped, whatever type was proposed', async () => {
    const profile = await makeProfile({ accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'AWAITING_APPROVAL' });

    assert.strictEqual(await enqueueFallbackScrape(profile.id), 'skipped');

    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('a profile nobody is subscribed to any more is not scraped', async () => {
    const unsubscribed = await makeProfile({ accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' }, 'deleted');
    const neverSubscribed = await makeProfile({ accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' }, 'none');

    assert.strictEqual(await enqueueFallbackScrape(unsubscribed.id), 'skipped');
    assert.strictEqual(await enqueueFallbackScrape(neverSubscribed.id), 'skipped');

    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('only Instagram profiles fall back to the queue; an unknown profile is skipped', async () => {
    const twitter = await makeProfile({ platform: 'twitter', accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' });

    assert.strictEqual(await enqueueFallbackScrape(twitter.id), 'skipped');
    assert.strictEqual(await enqueueFallbackScrape('00000000-0000-0000-0000-000000000000'), 'skipped');

    assert.deepStrictEqual(sqsBodies, []);
  });

  await t.test('a queue failure is reported, never thrown', async () => {
    const profile = await makeProfile({ accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' });
    sqsShouldFail = true;

    assert.strictEqual(await enqueueFallbackScrape(profile.id), 'failed');
  });
});
