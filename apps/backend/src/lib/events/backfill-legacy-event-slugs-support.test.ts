import test from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, events, eventSlugAliases } from '@festgrid/database';
import { healPostPlatformIdentity, reslugLegacyEvents } from './backfill-legacy-event-slugs-support.js';

/**
 * Story 3.22, Task 7. Real local-Postgres integration tests (TZ=UTC, run alone per FIND-064)
 * for `healPostPlatformIdentity` (AC1/AC2) and `reslugLegacyEvents` (AC3/AC4), including the
 * idempotent-re-run contract (AC6).
 */
test('backfill-legacy-event-slugs-support integration tests', async (t) => {
  const suffix = Date.now().toString();

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'acc-ble-' + suffix,
      platform: 'instagram',
      displayName: 'BLE Test Account',
      username: 'ble_test_' + suffix,
    })
    .returning();

  const postIds: string[] = [];
  const eventIds: string[] = [];

  t.after(async () => {
    if (eventIds.length > 0) {
      await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    if (postIds.length > 0) await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  async function makePost(opts: { urlSuffix: string; postUrl: string; alreadyHealed?: boolean }) {
    const [post] = await db
      .insert(posts)
      .values({
        accountId: profile.id,
        platform: 'instagram',
        postUrl: opts.postUrl,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        ...(opts.alreadyHealed
          ? { platformPostId: 'already-healed-' + opts.urlSuffix, platformPostType: 'p' }
          : {}),
      })
      .returning();
    postIds.push(post.id);
    return post;
  }

  // Deterministic-but-unique 12-hex-char legacy slug per test row, matching the shape
  // `events.slug`'s own `$defaultFn(generateSlug)` produces (packages/database/schema.ts) --
  // `randomBytes(6).toString('hex')`. An md5 digest (not a plain byte-encode of the tag string)
  // ensures distinct tags with the same `suffix` prefix don't collide on the first 12 hex chars.
  function hexSlug(tag: string): string {
    return createHash('md5').update(suffix + ':' + tag).digest('hex').slice(0, 12);
  }

  async function makeEvent(opts: {
    slug: string;
    postId: string | null;
    extractionOrdinal?: number | null;
    deletedAt?: Date | null;
    mergedIntoEventId?: string | null;
  }) {
    const [event] = await db
      .insert(events)
      .values({
        eventName: 'BLE Test Event ' + opts.slug,
        slug: opts.slug,
        location: 'Integration Test, US',
        postId: opts.postId,
        // events_post_id_extraction_ordinal_check (migration 0065): postId IS NULL OR
        // extractionOrdinal IS NOT NULL -- default to 0 whenever a postId is given.
        extractionOrdinal: opts.extractionOrdinal ?? (opts.postId ? 0 : null),
        deletedAt: opts.deletedAt ?? null,
        mergedIntoEventId: opts.mergedIntoEventId ?? null,
      })
      .returning();
    eventIds.push(event.id);
    return event;
  }

  await t.test('healPostPlatformIdentity - resolvable post is healed, unparseable post is left null and counted, already-healed post is a no-op', async () => {
    const resolvable = await makePost({ urlSuffix: 'resolvable-' + suffix, postUrl: `https://instagram.com/p/hpi-resolvable-${suffix}` });
    const unresolvable = await makePost({ urlSuffix: 'unresolvable-' + suffix, postUrl: 'https://example.com/not-a-permalink' });
    const alreadyHealed = await makePost({ urlSuffix: 'already-' + suffix, postUrl: `https://instagram.com/p/hpi-already-${suffix}`, alreadyHealed: true });

    const result = await healPostPlatformIdentity(db);
    assert.ok(result.healed >= 1, 'expected at least the resolvable row to be healed');
    assert.ok(result.stillUnresolvable >= 1, 'expected at least the unresolvable row to be counted');

    const [healedRow] = await db.select().from(posts).where(eq(posts.id, resolvable.id));
    assert.strictEqual(healedRow.platformPostId, `hpi-resolvable-${suffix}`);
    assert.strictEqual(healedRow.platformPostType, 'p');

    const [unresolvedRow] = await db.select().from(posts).where(eq(posts.id, unresolvable.id));
    assert.strictEqual(unresolvedRow.platformPostId, null);
    assert.strictEqual(unresolvedRow.platformPostType, null);

    const [untouchedRow] = await db.select().from(posts).where(eq(posts.id, alreadyHealed.id));
    assert.strictEqual(untouchedRow.platformPostId, 'already-healed-already-' + suffix);

    // Idempotent re-run (AC6): re-running heals zero further rows for these three.
    const rerun = await healPostPlatformIdentity(db);
    const [healedRowAfterRerun] = await db.select().from(posts).where(eq(posts.id, resolvable.id));
    assert.strictEqual(healedRowAfterRerun.platformPostId, `hpi-resolvable-${suffix}`, 'already-healed row is unchanged on re-run');
    void rerun;
  });

  await t.test('reslugLegacyEvents - hex-slugged event with resolvable post is re-keyed, old slug recorded as alias, extractionOrdinal carries the ~N suffix', async () => {
    const post = await makePost({ urlSuffix: 'reslug-ord-' + suffix, postUrl: `https://instagram.com/p/rle-ordinal-${suffix}` });
    await healPostPlatformIdentity(db);

    const oldSlug = hexSlug('ord');
    const event = await makeEvent({ slug: oldSlug, postId: post.id, extractionOrdinal: 2 });

    const result = await reslugLegacyEvents(db);
    assert.ok(result.reslugged >= 1);

    const [updated] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(updated.slug, `ig_p_rle-ordinal-${suffix}~2`, 'new slug carries the platform prefix, post identity, and ~2 ordinal suffix');

    const [alias] = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    assert.strictEqual(alias.slug, oldSlug, 'the old hex slug is recorded as a permanent alias');

    // Idempotent re-run (AC6): the event's slug no longer matches the legacy hex shape, so a
    // second pass is a no-op -- no second alias row, slug unchanged.
    const rerun = await reslugLegacyEvents(db);
    const [afterRerun] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(afterRerun.slug, updated.slug);
    const aliasesAfterRerun = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    assert.strictEqual(aliasesAfterRerun.length, 1, 'no duplicate alias written on re-run');
    void rerun;
  });

  await t.test('reslugLegacyEvents - event with unresolvable post identity is left on its hex slug and counted', async () => {
    const post = await makePost({ urlSuffix: 'unresolvable-evt-' + suffix, postUrl: 'https://example.com/still-not-a-permalink' });
    await healPostPlatformIdentity(db);

    const oldSlug = hexSlug('unresolvable-evt');
    const event = await makeEvent({ slug: oldSlug, postId: post.id });

    const result = await reslugLegacyEvents(db);
    assert.ok(result.stillUnresolvable >= 1);

    const [unchanged] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(unchanged.slug, oldSlug, 'slug is left exactly as it was -- never a guessed value');

    const aliases = await db.select().from(eventSlugAliases).where(eq(eventSlugAliases.eventId, event.id));
    assert.strictEqual(aliases.length, 0);
  });

  await t.test('reslugLegacyEvents - event with postId IS NULL is skipped entirely (AD-16 Rule 12)', async () => {
    const oldSlug = hexSlug('null-postid');
    const event = await makeEvent({ slug: oldSlug, postId: null });

    await reslugLegacyEvents(db);

    const [unchanged] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(unchanged.slug, oldSlug);
  });

  await t.test('reslugLegacyEvents - soft-deleted event is skipped entirely', async () => {
    const post = await makePost({ urlSuffix: 'soft-deleted-' + suffix, postUrl: `https://instagram.com/p/rle-soft-deleted-${suffix}` });
    await healPostPlatformIdentity(db);

    const oldSlug = hexSlug('soft-deleted');
    const event = await makeEvent({ slug: oldSlug, postId: post.id, deletedAt: new Date() });

    await reslugLegacyEvents(db);

    const [unchanged] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(unchanged.slug, oldSlug, 'a soft-deleted event is never re-keyed');
  });

  await t.test('reslugLegacyEvents - merged-away event is skipped entirely', async () => {
    const post = await makePost({ urlSuffix: 'merged-primary-' + suffix, postUrl: `https://instagram.com/p/rle-merged-primary-${suffix}` });
    await healPostPlatformIdentity(db);

    const winnerSlug = hexSlug('merged-winner');
    const winner = await makeEvent({ slug: winnerSlug, postId: post.id });

    const loserPost = await makePost({ urlSuffix: 'merged-loser-' + suffix, postUrl: `https://instagram.com/p/rle-merged-loser-${suffix}` });
    await healPostPlatformIdentity(db);

    const loserSlug = hexSlug('merged-loser');
    const loser = await makeEvent({ slug: loserSlug, postId: loserPost.id, mergedIntoEventId: winner.id });

    await reslugLegacyEvents(db);

    const [unchangedLoser] = await db.select().from(events).where(eq(events.id, loser.id));
    assert.strictEqual(unchangedLoser.slug, loserSlug, 'a merged-away event is never re-keyed');
  });

  await t.test('reslugLegacyEvents - event already on a platform-prefixed slug is skipped/no-op', async () => {
    const post = await makePost({ urlSuffix: 'already-prefixed-' + suffix, postUrl: `https://instagram.com/p/rle-already-prefixed-${suffix}` });
    await healPostPlatformIdentity(db);

    const alreadyPrefixedSlug = `ig_p_rle-already-prefixed-${suffix}`;
    const event = await makeEvent({ slug: alreadyPrefixedSlug, postId: post.id });

    const result = await reslugLegacyEvents(db);
    const [unchanged] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(unchanged.slug, alreadyPrefixedSlug, 'a slug that does not match the legacy hex shape is never touched');
    void result;
  });
});
