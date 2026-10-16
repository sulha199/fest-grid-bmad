import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { postAccountAssociations, posts, socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { getActiveSubscriberUserIdsForPost } from './get-active-subscriber-user-ids-for-post.js';

const suffix = Date.now().toString();

test('getActiveSubscriberUserIdsForPost integration tests', async (t) => {
  const profileIds: string[] = [];
  const userIds: string[] = [];
  const postIds: string[] = [];

  const makeProfile = async (tag: string) => {
    const [p] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `subs-${tag}-${suffix}`, platform: 'instagram', username: `subs_${tag}_${suffix}`, displayName: tag })
      .returning();
    profileIds.push(p.id);
    return p;
  };
  const makeUser = async (tag: string) => {
    const [u] = await db.insert(users).values({ email: `subs-${tag}-${suffix}@example.com` }).returning();
    userIds.push(u.id);
    return u;
  };

  t.after(async () => {
    if (postIds.length) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    if (profileIds.length) await db.delete(subscriptions).where(inArray(subscriptions.accountId, profileIds));
    if (profileIds.length) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  });

  const owner = await makeProfile('owner');
  const coauthor = await makeProfile('coauthor');
  const source = await makeProfile('source');
  const unrelated = await makeProfile('unrelated');
  const [ownerUser, coauthorUser, sourceUser, unrelatedUser, leftUser] = await Promise.all(
    ['ou', 'cu', 'su', 'uu', 'lu'].map(makeUser)
  );
  await db.insert(subscriptions).values([
    { userId: ownerUser.id, accountId: owner.id },
    { userId: coauthorUser.id, accountId: coauthor.id },
    { userId: sourceUser.id, accountId: source.id },
    { userId: unrelatedUser.id, accountId: unrelated.id },
    { userId: leftUser.id, accountId: coauthor.id, deletedAt: new Date() },
  ]);
  const [post] = await db
    .insert(posts)
    .values({ accountId: owner.id, platform: 'instagram', content: 'x', postUrl: `https://instagram.com/p/subs_${suffix}`, publishedAt: new Date() })
    .returning();
  postIds.push(post.id);
  await db.insert(postAccountAssociations).values([
    { postId: post.id, accountId: owner.id, role: 'PUBLISHER' },
    { postId: post.id, accountId: coauthor.id, role: 'COAUTHOR' },
    { postId: post.id, accountId: source.id, role: 'SCRAPING_SOURCE' },
  ]);

  await t.test('returns the subscribers of the owner, every co-author and the scraping source, once each', async () => {
    const ids = await getActiveSubscriberUserIdsForPost(post.id);
    assert.deepStrictEqual([...ids].sort(), [ownerUser.id, coauthorUser.id, sourceUser.id].sort());
  });

  await t.test('excludes unrelated accounts\' subscribers and soft-deleted subscriptions', async () => {
    const ids = await getActiveSubscriberUserIdsForPost(post.id);
    assert.ok(!ids.includes(unrelatedUser.id));
    assert.ok(!ids.includes(leftUser.id));
  });

  await t.test('a user subscribed to two associated accounts is returned once', async () => {
    const [extraSub] = await db.insert(subscriptions).values({ userId: ownerUser.id, accountId: coauthor.id }).returning();
    try {
      const ids = await getActiveSubscriberUserIdsForPost(post.id);
      assert.strictEqual(ids.filter((id) => id === ownerUser.id).length, 1);
    } finally {
      await db.delete(subscriptions).where(eq(subscriptions.id, extraSub.id));
    }
  });

  await t.test('the owner account passed in is honored even when the post row is not visible', async () => {
    const ids = await getActiveSubscriberUserIdsForPost('00000000-0000-4000-8000-0000000000ff', owner.id);
    assert.deepStrictEqual(ids, [ownerUser.id]);
  });

  await t.test('an unknown post with no owner returns no subscribers', async () => {
    assert.deepStrictEqual(await getActiveSubscriberUserIdsForPost('00000000-0000-4000-8000-0000000000fe'), []);
  });
});
