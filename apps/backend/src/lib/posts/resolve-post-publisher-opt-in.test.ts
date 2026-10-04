import test from 'node:test';
import * as assert from 'node:assert';
import { inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, postAccountAssociations } from '@festgrid/database';
import { resolvePostPublisherOptIn } from './resolve-post-publisher-opt-in.js';

// Story 3.20 (Task 2.2, AC2) -- integration tests for the fresh, dedicated PUBLISHER opt-in read.
// Mirrors is-organizer-authored-post.test.ts's fixture conventions (same tables, same cleanup
// pattern).
test('resolvePostPublisherOptIn integration tests', async (t) => {
  const suffix = Date.now();
  const profileIds: string[] = [];
  const postIds: string[] = [];

  async function makeProfile(isImageStorageOptedIn: boolean, imageStorageOptInSource?: 'MODERATOR' | 'ACCOUNT_OWNER') {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'acc-rppoi-' + Math.random().toString(36).slice(2) + '-' + suffix,
        platform: 'instagram',
        displayName: 'RPPOI Test Account',
        username: 'rppoi_' + Math.random().toString(36).slice(2) + '_' + suffix,
        isImageStorageOptedIn,
        imageStorageOptInSource,
      })
      .returning();
    profileIds.push(profile.id);
    return profile;
  }

  async function makePost(accountId: string) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl: 'https://instagram.com/p/rppoi-' + Math.random().toString(36).slice(2) + '-' + suffix,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  async function associate(postId: string, accountId: string, role: 'PUBLISHER' | 'COAUTHOR' | 'SCRAPING_SOURCE' | 'PUBLISHER_UNKNOWN') {
    await db.insert(postAccountAssociations).values({ postId, accountId, role });
  }

  t.after(async () => {
    if (postIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    if (profileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
    }
  });

  await t.test('opted-in PUBLISHER (MODERATOR source) -> true', async () => {
    const publisher = await makeProfile(true, 'MODERATOR');
    const post = await makePost(publisher.id);
    await associate(post.id, publisher.id, 'PUBLISHER');

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), true);
  });

  await t.test('opted-in PUBLISHER (ACCOUNT_OWNER source) -> true', async () => {
    const publisher = await makeProfile(true, 'ACCOUNT_OWNER');
    const post = await makePost(publisher.id);
    await associate(post.id, publisher.id, 'PUBLISHER');

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), true);
  });

  await t.test('opted-in COAUTHOR-only (no PUBLISHER row) -> false (co-author opt-in never counts)', async () => {
    const scraper = await makeProfile(false);
    const coauthor = await makeProfile(true, 'ACCOUNT_OWNER');
    const post = await makePost(scraper.id);
    await associate(post.id, coauthor.id, 'COAUTHOR');

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), false);
  });

  await t.test('PUBLISHER_UNKNOWN row present (even if opted in) -> false (unverified publisher)', async () => {
    const unknownPublisher = await makeProfile(true, 'ACCOUNT_OWNER');
    const post = await makePost(unknownPublisher.id);
    await associate(post.id, unknownPublisher.id, 'PUBLISHER_UNKNOWN');

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), false);
  });

  await t.test('no association rows at all -> false', async () => {
    const scraper = await makeProfile(true, 'ACCOUNT_OWNER');
    const post = await makePost(scraper.id);

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), false);
  });

  await t.test('non-opted-in PUBLISHER -> false', async () => {
    const publisher = await makeProfile(false);
    const post = await makePost(publisher.id);
    await associate(post.id, publisher.id, 'PUBLISHER');

    assert.strictEqual(await resolvePostPublisherOptIn(post.id), false);
  });
});
