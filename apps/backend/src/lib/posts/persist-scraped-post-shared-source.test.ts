import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { posts, postAccountAssociations, socialMediaAccountProfiles } from '@festgrid/database';
import { eq, inArray, and } from 'drizzle-orm';
import { persistScrapedPost } from './persist-scraped-post.js';
import { postsAssociatedWithAccount } from './posts-associated-with-account.js';
import { getNewestAssociatedPostPublishedAt } from '../scraper/get-scrape-cursor.js';

// AD-25 Rule 2 (amended 2026-11-26): every account whose scrape returned a post is linked to it.
const profileIds: string[] = [];
const postUrls: string[] = [];

async function makeProfile(suffix: string) {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: `test_shared_src_${suffix}_${Date.now()}`,
      platform: 'instagram',
      username: `test.shared.src.${suffix}`,
      displayName: `Shared source ${suffix}`,
    })
    .returning();
  profileIds.push(profile.id);
  return profile;
}

test('a post returned by the scrapes of two accounts is linked to both', async (t) => {
  t.after(async () => {
    const rows = await db.select({ id: posts.id }).from(posts).where(inArray(posts.postUrl, postUrls));
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, ids));
      await db.delete(posts).where(inArray(posts.id, ids));
    }
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
  });

  const first = await makeProfile('first');
  const second = await makeProfile('second');
  const postUrl = `https://www.instagram.com/p/shared_src_${Date.now()}/`;
  postUrls.push(postUrl);
  const publishedAt = new Date('2026-11-20T10:00:00.000Z');
  const base = { platform: 'instagram', content: '', postUrl, publishedAt: publishedAt.toISOString() };

  await t.test('the first scrape stores the post (with an empty caption) and links its account', async () => {
    const result = await persistScrapedPost({ ...base, accountId: first.id });
    assert.strictEqual(result.alreadyExisted, false);
    assert.strictEqual(result.post.content, '');
  });

  await t.test('the second account\'s scrape of the stored post links it too, once, however often it repeats', async () => {
    const again = await persistScrapedPost({ ...base, accountId: second.id });
    assert.strictEqual(again.alreadyExisted, true);
    await persistScrapedPost({ ...base, accountId: second.id });
    await persistScrapedPost({ ...base, accountId: first.id });

    const rows = await db
      .select()
      .from(postAccountAssociations)
      .where(and(eq(postAccountAssociations.postId, again.post.id), eq(postAccountAssociations.role, 'SCRAPING_SOURCE')));
    assert.deepStrictEqual(rows.map((r) => r.accountId).sort(), [first.id, second.id].sort());
  });

  await t.test('both accounts see the post once, and the second account\'s cursor now advances', async () => {
    for (const profile of [first, second]) {
      const found = await db.select({ id: posts.id }).from(posts).where(postsAssociatedWithAccount(profile.id));
      assert.strictEqual(found.length, 1, 'a post with several scraping sources appears once');
      assert.deepStrictEqual(await getNewestAssociatedPostPublishedAt(profile.id), publishedAt);
    }
  });
});
