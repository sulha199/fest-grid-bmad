import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { posts, postAccountAssociations, socialMediaAccountProfiles } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { persistPostAccountAssociations } from './persist-post-account-associations.js';

const createdProfileIds: string[] = [];
const createdPostIds: string[] = [];

async function makeProfile(suffix: string) {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_paa_' + suffix + '_' + Date.now(),
      platform: 'instagram',
      username: 'test.paa.' + suffix,
      displayName: 'Test PAA ' + suffix,
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
      content: 'PAA test content ' + suffix,
      postUrl: 'https://instagram.com/p/paa_test_' + suffix + '_' + Date.now(),
      publishedAt: new Date(),
    })
    .returning();
  createdPostIds.push(post.id);
  return post;
}

test('persistPostAccountAssociations integration tests', async (t) => {
  t.after(async () => {
    if (createdPostIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, createdPostIds));
      await db.delete(posts).where(inArray(posts.id, createdPostIds));
    }
    if (createdProfileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    }
  });

  await t.test('(a) writes exactly one SCRAPING_SOURCE row when only scrapingAccountId is given', async () => {
    const scrapingProfile = await makeProfile('a-scraping');
    const post = await makePost(scrapingProfile.id, 'a');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: scrapingProfile.id,
    });

    const rows = await db.select().from(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].role, 'SCRAPING_SOURCE');
    assert.strictEqual(rows[0].accountId, scrapingProfile.id);
  });

  await t.test('(b) writes SCRAPING_SOURCE + PUBLISHER as two separate rows for the same account', async () => {
    const sameProfile = await makeProfile('b-same');
    const post = await makePost(sameProfile.id, 'b');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: sameProfile.id,
      publisherAccountId: sameProfile.id,
    });

    const rows = await db.select().from(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
    assert.strictEqual(rows.length, 2);
    const roles = rows.map((r) => r.role).sort();
    assert.deepStrictEqual(roles, ['PUBLISHER', 'SCRAPING_SOURCE']);
    assert.ok(rows.every((r) => r.accountId === sameProfile.id));
  });

  await t.test('(c) writes SCRAPING_SOURCE + PUBLISHER (different accounts) + N COAUTHOR rows, all independently SELECT-able by role', async () => {
    const scrapingProfile = await makeProfile('c-scraping');
    const publisherProfile = await makeProfile('c-publisher');
    const coauthor1 = await makeProfile('c-coauthor1');
    const coauthor2 = await makeProfile('c-coauthor2');
    const post = await makePost(scrapingProfile.id, 'c');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: scrapingProfile.id,
      publisherAccountId: publisherProfile.id,
      coauthorAccountIds: [coauthor1.id, coauthor2.id],
    });

    const rows = await db.select().from(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
    assert.strictEqual(rows.length, 4);

    const byRole = (role: string) => rows.filter((r) => r.role === role);
    assert.strictEqual(byRole('SCRAPING_SOURCE').length, 1);
    assert.strictEqual(byRole('SCRAPING_SOURCE')[0].accountId, scrapingProfile.id);
    assert.strictEqual(byRole('PUBLISHER').length, 1);
    assert.strictEqual(byRole('PUBLISHER')[0].accountId, publisherProfile.id);
    assert.strictEqual(byRole('COAUTHOR').length, 2);
    const coauthorAccountIds = byRole('COAUTHOR').map((r) => r.accountId).sort();
    assert.deepStrictEqual(coauthorAccountIds, [coauthor1.id, coauthor2.id].sort());
  });

  await t.test('(d) calling twice with identical inputs is idempotent', async () => {
    const scrapingProfile = await makeProfile('d-scraping');
    const publisherProfile = await makeProfile('d-publisher');
    const post = await makePost(scrapingProfile.id, 'd');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: scrapingProfile.id,
      publisherAccountId: publisherProfile.id,
    });

    // Second call with identical inputs must not throw and must not append duplicates.
    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: scrapingProfile.id,
      publisherAccountId: publisherProfile.id,
    });

    const rows = await db.select().from(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
    assert.strictEqual(rows.length, 2);
  });

  await t.test('(e) a second call with a different scrapingAccountId does not throw and does not replace the first SCRAPING_SOURCE row', async () => {
    const firstScrapingProfile = await makeProfile('e-scraping1');
    const secondScrapingProfile = await makeProfile('e-scraping2');
    const post = await makePost(firstScrapingProfile.id, 'e');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: firstScrapingProfile.id,
    });

    await assert.doesNotReject(
      persistPostAccountAssociations({
        postId: post.id,
        scrapingAccountId: secondScrapingProfile.id,
      })
    );

    const rows = await db
      .select()
      .from(postAccountAssociations)
      .where(eq(postAccountAssociations.postId, post.id));
    const scrapingRows = rows.filter((r) => r.role === 'SCRAPING_SOURCE');
    assert.strictEqual(scrapingRows.length, 1, 'exactly one SCRAPING_SOURCE row for this post');
    assert.strictEqual(scrapingRows[0].accountId, firstScrapingProfile.id, 'first SCRAPING_SOURCE row must not be replaced');
  });

  await t.test('(f) same as (e) but for a conflicting publisherAccountId', async () => {
    const scrapingProfile = await makeProfile('f-scraping');
    const firstPublisherProfile = await makeProfile('f-publisher1');
    const secondPublisherProfile = await makeProfile('f-publisher2');
    const post = await makePost(scrapingProfile.id, 'f');

    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: scrapingProfile.id,
      publisherAccountId: firstPublisherProfile.id,
    });

    await assert.doesNotReject(
      persistPostAccountAssociations({
        postId: post.id,
        scrapingAccountId: scrapingProfile.id,
        publisherAccountId: secondPublisherProfile.id,
      })
    );

    const rows = await db
      .select()
      .from(postAccountAssociations)
      .where(eq(postAccountAssociations.postId, post.id));
    const publisherRows = rows.filter((r) => r.role === 'PUBLISHER');
    assert.strictEqual(publisherRows.length, 1, 'exactly one PUBLISHER row for this post');
    assert.strictEqual(publisherRows[0].accountId, firstPublisherProfile.id, 'first PUBLISHER row must not be replaced');
  });
});
