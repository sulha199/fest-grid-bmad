import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { postAccountAssociations, posts, scraperActorRuns, socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { findProfilesDeferredByBackoff } from './scrape-backoff.js';
import { getBatchScrapeTargets } from './get-scrape-targets.js';
import './register-adapters.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

test('scrape backoff (IDEA-105)', async (t) => {
  const createdProfiles: string[] = [];
  const createdSubs: string[] = [];
  const now = new Date();
  // A scheduled cycle fired just now: its daily cutoff is one margin (1 h) before the fire time.
  const cutoff = new Date(now.getTime() - HOUR_MS);

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least 1 seeded user for test');

  t.afterEach(async () => {
    delete process.env.SCRAPE_BACKOFF_MAX_DAYS;
    // Posts and runs reference the profile; the profile delete cascades the runs, the posts go first.
    if (createdProfiles.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.accountId, createdProfiles));
      await db.delete(posts).where(inArray(posts.accountId, createdProfiles));
    }
    if (createdSubs.length > 0) await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
    if (createdProfiles.length > 0) {
      await db.delete(scraperActorRuns).where(inArray(scraperActorRuns.profileId, createdProfiles));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
    }
    createdSubs.length = 0;
    createdProfiles.length = 0;
  });

  /** A profile that posts every `gapDays` days on `postingDays` days, the last one `lastPostDaysAgo` days ago. */
  async function addProfile(
    key: string,
    options: {
      seeded?: boolean;
      postingDays?: number;
      gapDays?: number;
      lastPostDaysAgo?: number;
      lastScrapedHoursAgo?: number | null;
      lastRunNewPosts?: number | null;
      subscribe?: boolean;
    } = {}
  ) {
    const {
      seeded = true,
      postingDays = 6,
      gapDays = 2,
      lastPostDaysAgo = 4,
      lastScrapedHoursAgo = 20,
      lastRunNewPosts = 0,
      subscribe = false,
    } = options;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: `test-backoff-${key}-` + Date.now(),
        platform: 'instagram',
        username: `backoff_${key}_` + Date.now(),
        displayName: key,
        historySeededAt: seeded ? new Date() : null,
        lastScrapedAt: lastScrapedHoursAgo === null ? null : new Date(now.getTime() - lastScrapedHoursAgo * HOUR_MS),
      })
      .returning();
    createdProfiles.push(profile.id);

    for (let index = 0; index < postingDays; index += 1) {
      await db.insert(posts).values({
        accountId: profile.id,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/${key}-${index}-${Date.now()}/`,
        publishedAt: new Date(now.getTime() - (lastPostDaysAgo + index * gapDays) * DAY_MS),
      });
    }
    if (lastRunNewPosts !== null) {
      await db.insert(scraperActorRuns).values({
        vendor: 'BRIGHTDATA',
        triggerMode: 'ASYNC',
        profileId: profile.id,
        runId: `backoff-${key}-${Date.now()}-${Math.random()}`,
        rawInput: {},
        status: 'SUCCEEDED',
        itemCount: lastRunNewPosts,
        newPosts: lastRunNewPosts,
        completedAt: new Date(now.getTime() - 20 * HOUR_MS),
      });
    }
    if (subscribe) {
      const [sub] = await db.insert(subscriptions).values({ userId: user.id, accountId: profile.id }).returning();
      createdSubs.push(sub.id);
    }
    return profile;
  }

  const candidate = (profile: { id: string; lastScrapedAt: Date | null }) => ({ profileId: profile.id, lastScrapedAt: profile.lastScrapedAt });

  await t.test('a known rhythm and an empty last run defers the profile by its typical gap', async () => {
    const profile = await addProfile('quiet');
    const deferred = await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now });
    assert.deepStrictEqual([...deferred], [[profile.id, 2]]);
  });

  await t.test('a profile whose last run found a new post stays daily', async () => {
    const profile = await addProfile('fresh', { lastRunNewPosts: 3 });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now })).size, 0);
  });

  await t.test('only the newest run decides: an old empty run behind a newer productive one does not defer', async () => {
    const profile = await addProfile('recovered', { lastRunNewPosts: 0 });
    await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId: profile.id,
      runId: `backoff-recovered-newer-${Date.now()}`,
      rawInput: {},
      status: 'SUCCEEDED',
      itemCount: 2,
      newPosts: 2,
      completedAt: new Date(now.getTime() - 2 * HOUR_MS),
    });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now })).size, 0);
  });

  await t.test('a profile with no recorded run, or one older than the lookback, stays daily', async () => {
    const none = await addProfile('norun', { lastRunNewPosts: null });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(none)], { cutoff, now })).size, 0);
  });

  await t.test('an unseeded profile (known only from other accounts) stays daily whatever posts it holds', async () => {
    const profile = await addProfile('unseeded', { seeded: false });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now })).size, 0);
  });

  await t.test('too few posting days to read a rhythm stays daily', async () => {
    const profile = await addProfile('thin', { postingDays: 3 });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now })).size, 0);
  });

  await t.test('a daily poster (gap of one day) stays daily', async () => {
    const profile = await addProfile('daily', { gapDays: 1 });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now })).size, 0);
  });

  await t.test('the wait is capped at SCRAPE_BACKOFF_MAX_DAYS, and a cap of 1 turns the backoff off', async () => {
    const sparse = await addProfile('sparse', { gapDays: 7, lastScrapedHoursAgo: 20 });
    assert.deepStrictEqual([...(await findProfilesDeferredByBackoff([candidate(sparse)], { cutoff, now }))], [[sparse.id, 3]]);

    process.env.SCRAPE_BACKOFF_MAX_DAYS = '1';
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(sparse)], { cutoff, now })).size, 0);
  });

  await t.test('the profile is scraped again once the wait has passed', async () => {
    const due = await addProfile('due', { lastScrapedHoursAgo: 44 });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(due)], { cutoff, now })).size, 0, 'two days since the last scrape');
  });

  await t.test('a never-scraped profile is never deferred', async () => {
    const fresh = await addProfile('never', { lastScrapedHoursAgo: null });
    assert.strictEqual((await findProfilesDeferredByBackoff([candidate(fresh)], { cutoff, now })).size, 0);
  });

  await t.test('posts the profile is only associated with (co-authored) count toward its rhythm', async () => {
    const profile = await addProfile('coauthored', { postingDays: 0 });
    const [owner] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'test-backoff-owner-' + Date.now(), platform: 'instagram', username: 'backoff_owner_' + Date.now(), displayName: 'Owner' })
      .returning();
    createdProfiles.push(owner.id);
    for (let index = 0; index < 6; index += 1) {
      const [post] = await db
        .insert(posts)
        .values({
          accountId: owner.id,
          platform: 'instagram',
          postUrl: `https://www.instagram.com/p/coauthored-${index}-${Date.now()}/`,
          publishedAt: new Date(now.getTime() - (4 + index * 2) * DAY_MS),
        })
        .returning({ id: posts.id });
      await db.insert(postAccountAssociations).values({ postId: post.id, accountId: profile.id, role: 'COAUTHOR' });
      // The owner also owns it: counted once for the owner, and not at all for this profile twice.
    }

    const deferred = await findProfilesDeferredByBackoff([candidate(profile)], { cutoff, now });
    assert.deepStrictEqual([...deferred], [[profile.id, 2]]);
  });

  await t.test('a failure reading the inputs defers nothing instead of throwing', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const result = await findProfilesDeferredByBackoff([{ profileId: 'not-a-uuid', lastScrapedAt: new Date(now.getTime() - 20 * HOUR_MS) }], { cutoff, now });
      assert.strictEqual(result.size, 0);
    } finally {
      console.error = originalError;
    }
  });

  await t.test('a scheduled cycle leaves the deferred profile out, a manual invoke and a daily-rhythm profile are untouched', async () => {
    const quiet = await addProfile('sched_quiet', { subscribe: true, lastScrapedHoursAgo: 20 });
    const busy = await addProfile('sched_busy', { subscribe: true, lastScrapedHoursAgo: 20, lastRunNewPosts: 4 });

    const scheduled = (await getBatchScrapeTargets({ scheduledTime: now })).map((target) => target.profileId);
    assert.strictEqual(scheduled.includes(quiet.id), false, 'quiet profile is deferred by its rhythm');
    assert.ok(scheduled.includes(busy.id), 'a profile whose last run found posts is scraped');

    // A manual invoke keeps its rolling window (20 h > 12 h) and does not apply the backoff.
    const manual = (await getBatchScrapeTargets()).map((target) => target.profileId);
    assert.ok(manual.includes(quiet.id), 'a manual invoke scrapes what it is asked to');
  });
});
