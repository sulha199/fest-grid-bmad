import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { posts, postAccountAssociations, socialMediaAccountProfiles } from '@festgrid/database';
import { and, eq, inArray } from 'drizzle-orm';
import { postsAssociatedWithAccount, getPostAccessAccountIds } from './posts-associated-with-account.js';

const createdProfileIds: string[] = [];
const createdPostIds: string[] = [];

async function makeProfile(suffix: string) {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_psua_' + suffix + '_' + Date.now(),
      platform: 'instagram',
      username: 'test.psua.' + suffix,
      displayName: 'Test PSUA ' + suffix,
    })
    .returning();
  createdProfileIds.push(profile.id);
  return profile;
}

async function makePost(accountId: string, suffix: string) {
  const [post] = await db
    .insert(posts)
    .values({
      accountId,
      platform: 'instagram',
      content: 'PSUA test content ' + suffix,
      postUrl: 'https://instagram.com/p/psua_test_' + suffix + '_' + Date.now(),
      publishedAt: new Date(),
    })
    .returning();
  createdPostIds.push(post.id);
  return post;
}

async function associate(postId: string, accountId: string, role: 'SCRAPING_SOURCE' | 'PUBLISHER' | 'COAUTHOR') {
  await db.insert(postAccountAssociations).values({ postId, accountId, role });
}

async function idsFor(accountId: string) {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(postsAssociatedWithAccount(accountId), inArray(posts.id, createdPostIds)));
  return rows.map((r) => r.id);
}

test('posts-associated-with-account integration tests', async (t) => {
  t.after(async () => {
    if (createdPostIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, createdPostIds));
      await db.delete(posts).where(inArray(posts.id, createdPostIds));
    }
    if (createdProfileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    }
  });

  const subscribed = await makeProfile('subscribed');
  const twin = await makeProfile('twin');
  const other = await makeProfile('other');

  const ownPost = await makePost(subscribed.id, 'own');
  const twinPost = await makePost(twin.id, 'twin');
  await associate(twinPost.id, subscribed.id, 'SCRAPING_SOURCE');
  await associate(twinPost.id, twin.id, 'PUBLISHER');
  const coauthorOnlyPost = await makePost(other.id, 'coauthor');
  await associate(coauthorOnlyPost.id, other.id, 'SCRAPING_SOURCE');
  await associate(coauthorOnlyPost.id, subscribed.id, 'COAUTHOR');
  const unrelatedPost = await makePost(other.id, 'unrelated');
  await associate(unrelatedPost.id, other.id, 'SCRAPING_SOURCE');

  await t.test('postsAssociatedWithAccount: includes posts owned by the account', async () => {
    assert.ok((await idsFor(subscribed.id)).includes(ownPost.id));
  });

  await t.test('postsAssociatedWithAccount: includes posts owned by a twin profile but scraped under the account', async () => {
    assert.ok((await idsFor(subscribed.id)).includes(twinPost.id));
  });

  await t.test('postsAssociatedWithAccount: includes a post the account only co-authored (the same post appears in each co-author tab)', async () => {
    assert.ok((await idsFor(subscribed.id)).includes(coauthorOnlyPost.id));
  });

  await t.test('postsAssociatedWithAccount: excludes posts with no association to the account', async () => {
    assert.ok(!(await idsFor(subscribed.id)).includes(unrelatedPost.id));
  });

  await t.test('postsAssociatedWithAccount: the twin profile itself still sees only what it owns', async () => {
    const ids = await idsFor(twin.id);
    assert.deepStrictEqual(ids, [twinPost.id]);
  });

  await t.test('getPostAccessAccountIds: a post is reachable via its owner and its scraping source', async () => {
    const access = await getPostAccessAccountIds([
      { id: ownPost.id, accountId: subscribed.id },
      { id: twinPost.id, accountId: twin.id },
      { id: unrelatedPost.id, accountId: other.id },
    ]);
    assert.deepStrictEqual([...access.get(ownPost.id)!], [subscribed.id]);
    assert.deepStrictEqual([...access.get(twinPost.id)!].sort(), [subscribed.id, twin.id].sort());
    assert.deepStrictEqual([...access.get(unrelatedPost.id)!], [other.id]);
  });

  await t.test('getPostAccessAccountIds: an empty list returns an empty map without querying', async () => {
    assert.strictEqual((await getPostAccessAccountIds([])).size, 0);
  });
});
