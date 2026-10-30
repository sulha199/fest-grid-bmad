import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { postAccountAssociations, posts, scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { getScrapeCursor } from './get-scrape-cursor.js';

// BUG-074 / BUG-075: the scrape cursor is where the stored posts end, never when a run finished.
test('getScrapeCursor', async (t) => {
  let profileId: string;
  const fallback = '2026-10-13T00:00:00.000Z';
  const newestPostAt = new Date('2026-10-20T15:30:00.000Z');

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'cursor-test-' + Date.now(),
        platform: 'instagram',
        username: 'cursor_test_user',
        displayName: 'Cursor Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;
  });

  t.afterEach(async () => {
    await db.delete(posts).where(eq(posts.accountId, profileId));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  async function insertPost(url: string, publishedAt: Date) {
    await db.insert(posts).values({ accountId: profileId, platform: 'instagram', postUrl: url, publishedAt });
  }

  async function insertRun(
    vendor: 'APIFY' | 'BRIGHTDATA',
    status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT',
    itemCount: number | null,
    completedAt: Date
  ) {
    await db.insert(scraperActorRuns).values({
      vendor,
      triggerMode: 'ASYNC',
      profileId,
      runId: `cursor-test-${vendor}-${status}-${completedAt.getTime()}-${Math.random()}`,
      rawInput: {},
      status,
      itemCount,
      completedAt,
    });
  }

  await t.test('uses the fallback window for a profile with no stored post', async () => {
    assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), fallback);
    assert.strictEqual(await getScrapeCursor('BRIGHTDATA', profileId, fallback), fallback);
  });

  await t.test('Apify starts one second after the newest stored post (its filter includes the boundary)', async () => {
    await insertPost('https://www.instagram.com/p/older/', new Date('2026-10-10T08:00:00.000Z'));
    await insertPost('https://www.instagram.com/p/newest/', newestPostAt);

    assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), '2026-10-20T15:30:01.000Z');
  });

  await t.test('Bright Data starts one day before the newest stored post (time-zone margin)', async () => {
    await insertPost('https://www.instagram.com/p/newest/', newestPostAt);

    assert.strictEqual(await getScrapeCursor('BRIGHTDATA', profileId, fallback), '2026-10-19T15:30:00.000Z');
  });

  await t.test('a later empty, failed or timed-out run does not move the cursor (BUG-074/BUG-075)', async () => {
    await insertPost('https://www.instagram.com/p/newest/', newestPostAt);
    const before = {
      apify: await getScrapeCursor('APIFY', profileId, fallback),
      brightData: await getScrapeCursor('BRIGHTDATA', profileId, fallback),
    };

    // The 2026-10-21/22 outage: runs that "succeeded" with zero items, plus failures, all finishing
    // after the newest stored post. Before the fix the newest of these became the next start date.
    await insertRun('BRIGHTDATA', 'SUCCEEDED', 0, new Date('2026-10-22T03:00:00.000Z'));
    await insertRun('BRIGHTDATA', 'FAILED', 0, new Date('2026-10-22T04:00:00.000Z'));
    await insertRun('APIFY', 'SUCCEEDED', 0, new Date('2026-10-22T05:00:00.000Z'));
    await insertRun('APIFY', 'TIMED_OUT', null, new Date('2026-10-22T06:00:00.000Z'));

    assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), before.apify);
    assert.strictEqual(await getScrapeCursor('BRIGHTDATA', profileId, fallback), before.brightData);
    assert.strictEqual(before.apify, '2026-10-20T15:30:01.000Z');
  });

  await t.test('a run alone never produces a cursor for a profile with no stored post', async () => {
    await insertRun('BRIGHTDATA', 'SUCCEEDED', 0, new Date('2026-10-22T03:00:00.000Z'));

    assert.strictEqual(await getScrapeCursor('BRIGHTDATA', profileId, fallback), fallback);
  });

  await t.test('only this profile\'s posts count', async () => {
    const [other] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'cursor-test-other-' + Date.now(), platform: 'instagram', username: 'cursor_other', displayName: 'Other' })
      .returning({ id: socialMediaAccountProfiles.id });
    try {
      await db.insert(posts).values({
        accountId: other.id,
        platform: 'instagram',
        postUrl: 'https://www.instagram.com/p/someone-else/',
        publishedAt: new Date('2026-10-21T00:00:00.000Z'),
      });

      assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), fallback);
    } finally {
      await db.delete(posts).where(eq(posts.accountId, other.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, other.id));
    }
  });

  // 2026-10-23..29: a post stored under its owner (or another co-author) never moved the cursor of the
  // profile it was scraped from, so that profile re-fetched (and was billed for) the same posts daily.
  await t.test('a post stored under another account but associated with this profile moves the cursor', async () => {
    const [owner] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'cursor-test-owner-' + Date.now(), platform: 'instagram', username: 'cursor_owner', displayName: 'Owner' })
      .returning({ id: socialMediaAccountProfiles.id });
    try {
      await insertPost('https://www.instagram.com/p/own-older/', new Date('2026-10-10T08:00:00.000Z'));
      const [collab] = await db
        .insert(posts)
        .values({
          accountId: owner.id,
          platform: 'instagram',
          postUrl: 'https://www.instagram.com/p/collab/',
          publishedAt: new Date('2026-10-22T09:00:00.000Z'),
        })
        .returning({ id: posts.id });
      await db.insert(postAccountAssociations).values({ postId: collab.id, accountId: profileId, role: 'COAUTHOR' });

      assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), '2026-10-22T09:00:01.000Z');
      assert.strictEqual(await getScrapeCursor('BRIGHTDATA', profileId, fallback), '2026-10-21T09:00:00.000Z');
    } finally {
      await db.delete(posts).where(eq(posts.accountId, owner.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, owner.id));
    }
  });

  await t.test('the newest post wins whether it is owned or associated', async () => {
    const [owner] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: 'cursor-test-owner2-' + Date.now(), platform: 'instagram', username: 'cursor_owner2', displayName: 'Owner 2' })
      .returning({ id: socialMediaAccountProfiles.id });
    try {
      await insertPost('https://www.instagram.com/p/own-newest/', newestPostAt);
      const [older] = await db
        .insert(posts)
        .values({ accountId: owner.id, platform: 'instagram', postUrl: 'https://www.instagram.com/p/assoc-older/', publishedAt: new Date('2026-10-12T00:00:00.000Z') })
        .returning({ id: posts.id });
      await db.insert(postAccountAssociations).values({ postId: older.id, accountId: profileId, role: 'SCRAPING_SOURCE' });

      assert.strictEqual(await getScrapeCursor('APIFY', profileId, fallback), '2026-10-20T15:30:01.000Z');
    } finally {
      await db.delete(posts).where(eq(posts.accountId, owner.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, owner.id));
    }
  });
});
