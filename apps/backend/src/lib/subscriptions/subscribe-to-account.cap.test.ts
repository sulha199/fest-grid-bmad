import test from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray } from 'drizzle-orm';
import { jobs, scraperProviderUsage, socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { ScraperCapacityExceededError } from '@festgrid/domain';
import { SubscriptionCapReachedError } from '@festgrid/domain/subscriptions';
import { registerJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { subscribeToAccount } from './subscribe-to-account.js';
import {
  getAccountClassificationProfileSeam,
  setGetAccountClassificationProfileSeam,
  callGeminiForAccountClassificationSeam,
  setCallGeminiForAccountClassificationSeam,
} from '../accounts/classify-account-type.js';
import { attemptApifyAsyncTrigger, setAttemptApifyAsyncTrigger } from '../scraper/trigger-apify-for-target.js';
import '../scraper/register-adapters.js';

// Story 10.3 Task 7/8 (AC7, AC8, AC10d; PRD FR122) -- the subscription cap in subscribeToAccount. Profiles here are
// pre-classified (CONFIRMED, PERSONAL) so the vendor cascade is skipped unless a test turns it on.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SLOT_TYPE = `fixture-cap-slot-${suffix}`;
registerJobTypeDefinition({ type: SLOT_TYPE, host: 'scraper', maxDurationMs: 600_000, reservesSubscriptionSlot: true });

const userIds: string[] = [];
const profileIds: string[] = [];
const originals = {
  apify: attemptApifyAsyncTrigger,
  profile: getAccountClassificationProfileSeam,
  gemini: callGeminiForAccountClassificationSeam,
};

async function makeUser(role: 'user' | 'moderator' = 'user'): Promise<string> {
  const [user] = await db.insert(users).values({ email: `cap-${suffix}-${userIds.length}@example.test`, role }).returning({ id: users.id });
  userIds.push(user.id);
  return user.id;
}

async function makeProfile(opts: { classified?: boolean } = {}): Promise<{ id: string; accountId: string; username: string }> {
  const n = profileIds.length;
  const accountId = `cap-${suffix}-${n}`;
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId,
      platform: 'instagram',
      username: accountId,
      displayName: 'Cap Test',
      accountType: opts.classified === false ? null : 'PERSONAL',
      accountTypeStatus: opts.classified === false ? null : 'CONFIRMED',
    })
    .returning({ id: socialMediaAccountProfiles.id });
  profileIds.push(profile.id);
  return { id: profile.id, accountId, username: accountId };
}

async function subscribeTo(userId: string, profile: { accountId: string; username: string }) {
  return subscribeToAccount({
    userId,
    platform: 'instagram',
    accountId: profile.accountId,
    profile: { displayName: 'Cap Test', username: profile.username },
  });
}

async function holdSubscriptions(userId: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const profile = await makeProfile();
    await db.insert(subscriptions).values({ userId, accountId: profile.id });
    ids.push(profile.id);
  }
  return ids;
}

const activeCount = async (userId: string) =>
  (await db.select().from(subscriptions).where(eq(subscriptions.userId, userId))).filter((s) => s.deletedAt === null).length;

test.after(async () => {
  setAttemptApifyAsyncTrigger(originals.apify);
  setGetAccountClassificationProfileSeam(originals.profile);
  setCallGeminiForAccountClassificationSeam(originals.gemini);
  if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds));
  if (profileIds.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
});

test('subscribeToAccount: the subscription cap (Story 10.3)', async (t) => {
  await t.test('the fifth subscription is allowed and the sixth is refused with the typed error and the three numbers (AC7)', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 4);
    const fifth = await subscribeTo(user, await makeProfile());
    assert.equal(fifth.alreadySubscribed, false);
    const sixth = await makeProfile();
    await assert.rejects(subscribeTo(user, sixth), (error: unknown) => {
      assert.ok(error instanceof SubscriptionCapReachedError);
      assert.deepEqual({ a: error.activeCount, r: error.reservedCount, c: error.cap }, { a: 5, r: 0, c: 5 });
      return true;
    });
    assert.equal(await activeCount(user), 5, 'the refused subscribe wrote nothing');
  });

  await t.test('a refused subscribe runs no classification and no scrape (it spends no vendor credit) (AC8)', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 5);
    const unclassified = await makeProfile({ classified: false });
    let classified = false;
    let scraped = false;
    setGetAccountClassificationProfileSeam(async () => {
      classified = true;
      return { username: unclassified.username, displayName: 'x', biography: 'b', businessCategoryName: 'Event' };
    });
    setCallGeminiForAccountClassificationSeam(async () => {
      classified = true;
      return { text: JSON.stringify({ accountType: 'ORGANIZER_VENUE_EVENT', confidenceScore: 0.9 }) };
    });
    setAttemptApifyAsyncTrigger(async () => {
      scraped = true;
      return { success: true };
    });
    await assert.rejects(subscribeTo(user, unclassified), SubscriptionCapReachedError);
    assert.equal(classified, false);
    assert.equal(scraped, false);
    const [row] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, unclassified.id));
    assert.equal(row.accountTypeStatus, null, 'the profile was not classified');
    assert.equal(row.classificationClaimedAt, null, 'no classification claim was taken');
  });

  await t.test('an account the user already holds is returned as alreadySubscribed even at or above the cap', async () => {
    const user = await makeUser();
    const held = await holdSubscriptions(user, 7);
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, held[0]));
    const again = await subscribeTo(user, profile);
    assert.equal(again.alreadySubscribed, true);
    assert.equal(await activeCount(user), 7);
  });

  await t.test('a user above the cap keeps every subscription and cannot add another', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 7);
    await assert.rejects(subscribeTo(user, await makeProfile()), SubscriptionCapReachedError);
    assert.equal(await activeCount(user), 7);
  });

  await t.test('soft-deleted subscriptions do not count', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 4);
    for (let i = 0; i < 3; i += 1) {
      const profile = await makeProfile();
      await db.insert(subscriptions).values({ userId: user, accountId: profile.id, deletedAt: new Date() });
    }
    const result = await subscribeTo(user, await makeProfile());
    assert.equal(result.alreadySubscribed, false);
  });

  await t.test('a moderator is exempt from the cap', async () => {
    const moderator = await makeUser('moderator');
    await holdSubscriptions(moderator, 6);
    const result = await subscribeTo(moderator, await makeProfile());
    assert.equal(result.alreadySubscribed, false);
    assert.equal(await activeCount(moderator), 7);
  });

  await t.test('reserved slots count: four subscriptions plus one account being added leaves no room (FR122)', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 4);
    const [reserved] = await db
      .insert(jobs)
      .values({ type: SLOT_TYPE, ownerUserId: user, trigger: 'USER', inputKey: 'being-added', admittedAt: new Date(), deadlineAt: new Date(Date.now() + 60_000) })
      .returning();
    await assert.rejects(subscribeTo(user, await makeProfile()), (error: unknown) => {
      assert.ok(error instanceof SubscriptionCapReachedError);
      assert.equal(error.reservedCount, 1);
      return true;
    });
    // once that job ends, the slot is free again
    await db.update(jobs).set({ status: 'FAILED', reasonCode: 'CANCELLED', finishedAt: new Date() }).where(eq(jobs.id, reserved.id));
    const result = await subscribeTo(user, await makeProfile());
    assert.equal(result.alreadySubscribed, false);
  });

  await t.test('the add-account job whose handler subscribes is not blocked by its own reservation (review finding)', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 4);
    const [job] = await db
      .insert(jobs)
      .values({ type: SLOT_TYPE, ownerUserId: user, trigger: 'USER', inputKey: 'mine', admittedAt: new Date(), deadlineAt: new Date(Date.now() + 60_000) })
      .returning();
    const profile = await makeProfile();
    await assert.rejects(subscribeTo(user, profile), SubscriptionCapReachedError, 'without the job id its own slot counts');
    const result = await subscribeToAccount({
      userId: user,
      platform: 'instagram',
      accountId: profile.accountId,
      profile: { displayName: 'Cap Test', username: profile.username },
      consumesReservationOfJobId: job.id,
    });
    assert.equal(result.alreadySubscribed, false);
    assert.equal(await activeCount(user), 5);
  });

  await t.test('(d) two simultaneous subscribes at four subscriptions: exactly one succeeds', async () => {
    const user = await makeUser();
    await holdSubscriptions(user, 4);
    const [p1, p2] = [await makeProfile(), await makeProfile()];
    const results = await Promise.allSettled([subscribeTo(user, p1), subscribeTo(user, p2)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof SubscriptionCapReachedError);
    assert.equal(await activeCount(user), 5);
  });

  await t.test('the same account subscribed twice at once yields one subscription and one alreadySubscribed', async () => {
    const user = await makeUser();
    const profile = await makeProfile();
    const results = await Promise.all([subscribeTo(user, profile), subscribeTo(user, profile)]);
    assert.deepEqual(results.map((r) => r.alreadySubscribed).sort(), [false, true]);
    assert.equal(await activeCount(user), 1);
  });

  await t.test('capacity exhausted after the subscription was written: it is removed again and the capacity error still surfaces', async () => {
    const user = await makeUser();
    const unclassified = await makeProfile({ classified: false });
    // Exhaust capacity for THIS process only: a threshold ratio of 0 makes any usage row "full". node --test runs each file in
    // its own process, so no other suite sees it; a missing usage row counts as available, so insert the two rows (zero use,
    // which other processes read as available) when absent and remove exactly those afterwards. Existing rows are untouched.
    const existing = await db.select({ provider: scraperProviderUsage.provider }).from(scraperProviderUsage).where(inArray(scraperProviderUsage.provider, ['apify', 'brightdata']));
    const missing = ['apify', 'brightdata'].filter((provider) => !existing.some((row) => row.provider === provider));
    if (missing.length > 0) {
      await db.insert(scraperProviderUsage).values(missing.map((provider) => ({ provider, itemsUsedThisCycle: 0, usageCycleResetAt: new Date() })));
    }
    const savedRatio = process.env.SCRAPER_CAPACITY_THRESHOLD_RATIO;
    process.env.SCRAPER_CAPACITY_THRESHOLD_RATIO = '0';
    try {
      await assert.rejects(subscribeTo(user, unclassified), ScraperCapacityExceededError);
    } finally {
      if (savedRatio === undefined) delete process.env.SCRAPER_CAPACITY_THRESHOLD_RATIO;
      else process.env.SCRAPER_CAPACITY_THRESHOLD_RATIO = savedRatio;
      if (missing.length > 0) await db.delete(scraperProviderUsage).where(inArray(scraperProviderUsage.provider, missing));
    }
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user), eq(subscriptions.accountId, unclassified.id)));
    assert.equal(rows.length, 0, 'no subscription is left behind by a call that threw');
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, unclassified.id));
    assert.equal(profile.classificationClaimedAt, null, 'the claim was released');
  });
});
