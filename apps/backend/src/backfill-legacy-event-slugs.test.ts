import test from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { socialMediaAccountProfiles, posts, events, eventSlugAliases } from '@festgrid/database';
import { runSizing, runBackfill } from './backfill-legacy-event-slugs.js';

/**
 * Story 3.22, Task 5/7 -- `runSizing`/`runBackfill(apply)` dispatch logic, mirroring
 * `backfill-post-media-keys.test.ts`'s own convention. This sandbox has a real local Postgres
 * available (unlike that story's S3 constraint), so these are real integration tests, not
 * deferred to a later pass.
 */
test('backfill-legacy-event-slugs script tests', async (t) => {
  const suffix = Date.now().toString();

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-bls-' + suffix,
      platform: 'instagram',
      displayName: 'BLS Test Account',
      username: 'bls_test_' + suffix,
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: `https://instagram.com/p/bls-${suffix}`,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();

  const [event] = await db
    .insert(events)
    .values({
      eventName: 'BLS Test Event ' + suffix,
      slug: createHash('md5').update('bls:' + suffix).digest('hex').slice(0, 12),
      location: 'Integration Test, US',
      postId: post.id,
      extractionOrdinal: 0,
    })
    .returning();

  t.after(async () => {
    await db.delete(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    await db.delete(events).where(eq(events.id, event.id));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('runSizing - read-only, reports counts, writes nothing', async () => {
    const [beforePost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [beforeEvent] = await db.select().from(events).where(eq(events.id, event.id));

    const report = await runSizing();
    assert.ok(report.postsNeedingHealingResolvable >= 1, 'this test\'s own resolvable post should be counted');
    assert.ok(report.eventsEligibleForReslugResolvable >= 1, 'this test\'s own eligible event should be counted');

    const [afterPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [afterEvent] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(afterPost.platformPostId, beforePost.platformPostId, 'sizing must write nothing');
    assert.strictEqual(afterEvent.slug, beforeEvent.slug, 'sizing must write nothing');
  });

  await t.test('runBackfill(false) - dry run, writes nothing', async () => {
    const [beforePost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [beforeEvent] = await db.select().from(events).where(eq(events.id, event.id));

    const report = await runBackfill(false);
    assert.ok(report.healed >= 1);
    assert.ok(report.reslugged >= 1);

    const [afterPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [afterEvent] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(afterPost.platformPostId, beforePost.platformPostId, 'dry run must write nothing');
    assert.strictEqual(afterEvent.slug, beforeEvent.slug, 'dry run must write nothing');
  });

  await t.test('runBackfill(true) - applies for real: post healed, event re-keyed, old slug aliased', async () => {
    const oldSlug = event.slug;

    const report = await runBackfill(true);
    assert.ok(report.healed >= 1);
    assert.ok(report.reslugged >= 1);

    const [healedPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(healedPost.platformPostId, `bls-${suffix}`);
    assert.strictEqual(healedPost.platformPostType, 'p');

    const [reslugged] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(reslugged.slug, `ig_p_bls-${suffix}`);

    const [alias] = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    assert.strictEqual(alias.slug, oldSlug);
  });

  await t.test('runBackfill(true) re-run - idempotent, zero further writes', async () => {
    const [beforePost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [beforeEvent] = await db.select().from(events).where(eq(events.id, event.id));

    const report = await runBackfill(true);

    const [afterPost] = await db.select().from(posts).where(eq(posts.id, post.id));
    const [afterEvent] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(afterPost.platformPostId, beforePost.platformPostId);
    assert.strictEqual(afterEvent.slug, beforeEvent.slug);

    const aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    assert.strictEqual(aliases.length, 1, 'no duplicate alias written on re-run');
    void report;
  });
});
