import test from 'node:test';
import * as assert from 'node:assert';
import { inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, postAccountAssociations } from '@festgrid/database';
import { isOrganizerAuthoredPost } from './is-organizer-authored-post.js';

test('isOrganizerAuthoredPost integration tests', async (t) => {
  const suffix = Date.now();
  const profileIds: string[] = [];
  const postIds: string[] = [];

  async function makeProfile(accountType: 'ORGANIZER_VENUE_EVENT' | 'CURATOR_GUIDE' | null, accountTypeStatus: 'CONFIRMED' | 'AWAITING_APPROVAL' | null = 'CONFIRMED') {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'acc-ioap-' + Math.random().toString(36).slice(2) + '-' + suffix,
        platform: 'instagram',
        displayName: 'IOAP Test Account',
        username: 'ioap_' + Math.random().toString(36).slice(2) + '_' + suffix,
        accountType: accountType ?? undefined,
        accountTypeStatus: accountType ? (accountTypeStatus ?? undefined) : undefined,
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
        postUrl: 'https://instagram.com/p/ioap-' + Math.random().toString(36).slice(2) + '-' + suffix,
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

  await t.test('non-curator PUBLISHER association -> true', async () => {
    const organizer = await makeProfile('ORGANIZER_VENUE_EVENT');
    const post = await makePost(organizer.id);
    await associate(post.id, organizer.id, 'PUBLISHER');

    assert.strictEqual(await isOrganizerAuthoredPost(post.id), true);
  });

  await t.test('CURATOR_GUIDE-typed PUBLISHER/COAUTHOR (CONFIRMED and AWAITING_APPROVAL) -> false', async () => {
    const curatorConfirmed = await makeProfile('CURATOR_GUIDE', 'CONFIRMED');
    const postConfirmed = await makePost(curatorConfirmed.id);
    await associate(postConfirmed.id, curatorConfirmed.id, 'PUBLISHER');
    assert.strictEqual(await isOrganizerAuthoredPost(postConfirmed.id), false);

    const curatorAwaiting = await makeProfile('CURATOR_GUIDE', 'AWAITING_APPROVAL');
    const postAwaiting = await makePost(curatorAwaiting.id);
    await associate(postAwaiting.id, curatorAwaiting.id, 'COAUTHOR');
    assert.strictEqual(await isOrganizerAuthoredPost(postAwaiting.id), false);
  });

  await t.test('COAUTHOR row, no PUBLISHER row, non-curator -> true', async () => {
    const scraper = await makeProfile('ORGANIZER_VENUE_EVENT');
    const coauthor = await makeProfile('ORGANIZER_VENUE_EVENT');
    const post = await makePost(scraper.id);
    await associate(post.id, coauthor.id, 'COAUTHOR');

    assert.strictEqual(await isOrganizerAuthoredPost(post.id), true);
  });

  await t.test('only SCRAPING_SOURCE/PUBLISHER_UNKNOWN rows -> falls back to posts.accountId, non-curator -> true', async () => {
    const scraper = await makeProfile('ORGANIZER_VENUE_EVENT');
    const post = await makePost(scraper.id);
    await associate(post.id, scraper.id, 'SCRAPING_SOURCE');

    assert.strictEqual(await isOrganizerAuthoredPost(post.id), true);
  });

  await t.test('same fallback case but posts.accountId profile is curator-typed -> false', async () => {
    const scraper = await makeProfile('CURATOR_GUIDE');
    const post = await makePost(scraper.id);
    await associate(post.id, scraper.id, 'SCRAPING_SOURCE');

    assert.strictEqual(await isOrganizerAuthoredPost(post.id), false);
  });

  await t.test('NULL accountType on the relevant profile -> true (direct-association and fallback paths)', async () => {
    const nullTypeDirect = await makeProfile(null);
    const postDirect = await makePost(nullTypeDirect.id);
    await associate(postDirect.id, nullTypeDirect.id, 'PUBLISHER');
    assert.strictEqual(await isOrganizerAuthoredPost(postDirect.id), true);

    const nullTypeFallback = await makeProfile(null);
    const postFallback = await makePost(nullTypeFallback.id);
    await associate(postFallback.id, nullTypeFallback.id, 'SCRAPING_SOURCE');
    assert.strictEqual(await isOrganizerAuthoredPost(postFallback.id), true);
  });
});
