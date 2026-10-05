import test from 'node:test';
import * as assert from 'node:assert';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, eventPosts, postAccountAssociations } from '@festgrid/database';
import { insertEventWithPrimaryPost, setEventPrimaryPost } from './set-event-primary-post.js';
import { buildEventAccountMatchCondition } from './event-account-match.js';

test('buildEventAccountMatchCondition integration tests', async (t) => {
  const suffix = Date.now();

  const [publisherAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eam-publisher-' + suffix,
      platform: 'instagram',
      displayName: 'EAM Publisher',
      username: 'eam_publisher_' + suffix,
    })
    .returning();

  const [legacyAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eam-legacy-' + suffix,
      platform: 'instagram',
      displayName: 'EAM Legacy',
      username: 'eam_legacy_' + suffix,
    })
    .returning();

  const [unrelatedAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eam-unrelated-' + suffix,
      platform: 'instagram',
      displayName: 'EAM Unrelated',
      username: 'eam_unrelated_' + suffix,
    })
    .returning();

  const [coauthorAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eam-coauthor-' + suffix,
      platform: 'instagram',
      displayName: 'EAM Coauthor',
      username: 'eam_coauthor_' + suffix,
    })
    .returning();

  const [scrapingSourceAccount] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-eam-scraping-source-' + suffix,
      platform: 'instagram',
      displayName: 'EAM Scraping Source',
      username: 'eam_scraping_source_' + suffix,
    })
    .returning();

  // postPrimary carries a PUBLISHER association (the "real" post-3.15 signal).
  const [postPrimary] = await db
    .insert(posts)
    .values({
      accountId: legacyAccount.id, // bare posts.accountId leg deliberately points elsewhere
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/eam-primary-' + suffix,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();
  await db.insert(postAccountAssociations).values({ postId: postPrimary.id, accountId: publisherAccount.id, role: 'PUBLISHER' });

  // postSecondary carries no association row at all -- only the legacy posts.accountId leg,
  // which this story (3.18) removes as a matching leg entirely.
  const [postSecondary] = await db
    .insert(posts)
    .values({
      accountId: legacyAccount.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/eam-secondary-' + suffix,
      publishedAt: new Date('2026-01-02T00:00:00Z'),
    })
    .returning();

  // postCoauthored carries a COAUTHOR association specifically -- this story's headline scenario
  // (AC1): posts.accountId points at an unrelated/legacy account, but coauthorAccount is matched
  // via the COAUTHOR association row.
  const [postCoauthored] = await db
    .insert(posts)
    .values({
      accountId: legacyAccount.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/eam-coauthored-' + suffix,
      publishedAt: new Date('2026-01-03T00:00:00Z'),
    })
    .returning();
  await db.insert(postAccountAssociations).values({ postId: postCoauthored.id, accountId: coauthorAccount.id, role: 'COAUTHOR' });

  // postScrapingSource's posts.accountId is deliberately a DIFFERENT account than its
  // SCRAPING_SOURCE association row's account (simulating the publisher-resolved case) -- directly
  // proving AC3's safety argument: the SCRAPING_SOURCE account matches via the association leg
  // even though it is not posts.accountId.
  const [postScrapingSource] = await db
    .insert(posts)
    .values({
      accountId: legacyAccount.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/eam-scraping-source-' + suffix,
      publishedAt: new Date('2026-01-04T00:00:00Z'),
    })
    .returning();
  await db.insert(postAccountAssociations).values({ postId: postScrapingSource.id, accountId: scrapingSourceAccount.id, role: 'SCRAPING_SOURCE' });

  const postIds = [postPrimary.id, postSecondary.id, postCoauthored.id, postScrapingSource.id];
  const createdEventIds: string[] = [];

  t.after(async () => {
    if (createdEventIds.length > 0) {
      await db.delete(eventPosts).where(inArray(eventPosts.eventId, createdEventIds));
      await db.delete(events).where(inArray(events.id, createdEventIds));
    }
    await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
    await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(
      inArray(socialMediaAccountProfiles.id, [
        publisherAccount.id,
        legacyAccount.id,
        unrelatedAccount.id,
        coauthorAccount.id,
        scrapingSourceAccount.id,
      ])
    );
  });

  const inserted = await insertEventWithPrimaryPost(db, {
    eventName: 'EAM Test Event ' + suffix,
    location: 'Nowhere',
    hasPrivateContact: false,
    postId: postPrimary.id,
    sourceSocialMediaAccountId: publisherAccount.accountId,
  });
  assert.ok(inserted);
  createdEventIds.push(inserted!.id);

  // Link the second post onto the SAME event via event_posts, exactly as Task 5's promotion
  // path will do -- this is the behavior AD-31 Rule 4 exists to cover (matching must follow
  // event_posts, not just the event's current primary postId).
  await setEventPrimaryPost(db, { eventId: inserted!.id, postId: postSecondary.id, extractionOrdinal: 1 });

  // Link postCoauthored and postScrapingSource onto the same event via event_posts directly
  // (not via setEventPrimaryPost, which would also move the primary pointer and disturb the
  // "matches via a secondary post" assertion below that depends on postSecondary being primary).
  await db.insert(eventPosts).values({ eventId: inserted!.id, postId: postCoauthored.id, extractionOrdinal: 2 });
  await db.insert(eventPosts).values({ eventId: inserted!.id, postId: postScrapingSource.id, extractionOrdinal: 3 });

  async function matches(accountId: string): Promise<boolean> {
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, inserted!.id), buildEventAccountMatchCondition(accountId)));
    return rows.length === 1;
  }

  await t.test('association-leg match: publisherAccount has a PUBLISHER row on a linked post', async () => {
    assert.strictEqual(await matches(publisherAccount.id), true);
  });

  await t.test('legacy leg removed: an account with only bare posts.account_id and no association row no longer matches', async () => {
    assert.strictEqual(await matches(legacyAccount.id), false);
  });

  await t.test('COAUTHOR association match: coauthorAccount has a COAUTHOR row, posts.accountId points elsewhere', async () => {
    assert.strictEqual(await matches(coauthorAccount.id), true);
  });

  await t.test('SCRAPING_SOURCE association match: scrapingSourceAccount has a SCRAPING_SOURCE row distinct from posts.accountId', async () => {
    // Proves AC3's safety argument directly: the SCRAPING_SOURCE account matches via the
    // association leg even though it is not the post's bare posts.accountId value.
    assert.strictEqual(await matches(scrapingSourceAccount.id), true);
  });

  await t.test('no match: an account with neither leg returns false', async () => {
    assert.strictEqual(await matches(unrelatedAccount.id), false);
  });

  await t.test('matches via a secondary (non-primary) linked post, not only the current primary', async () => {
    // publisherAccount's association is on postPrimary, which is no longer events.postId after
    // the setEventPrimaryPost promotion above (now postSecondary) -- confirming the helper
    // follows event_posts rather than the single postId pointer.
    const [current] = await db.select({ postId: events.postId }).from(events).where(eq(events.id, inserted!.id));
    assert.strictEqual(current.postId, postSecondary.id);
    assert.strictEqual(await matches(publisherAccount.id), true);
  });

  await t.test('correlated-column usage: a SQL column expression works the same as a literal id', async () => {
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .innerJoin(socialMediaAccountProfiles, eq(socialMediaAccountProfiles.id, publisherAccount.id))
      .where(and(eq(events.id, inserted!.id), buildEventAccountMatchCondition(socialMediaAccountProfiles.id)));
    assert.strictEqual(rows.length, 1);
  });
});
