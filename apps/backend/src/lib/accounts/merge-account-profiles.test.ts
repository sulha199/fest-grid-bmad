import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import {
  accountProfileMerges,
  accountVotes,
  events,
  postAccountAssociations,
  posts,
  scraperActorRuns,
  socialMediaAccountProfiles,
  subscriptions,
  users,
} from '@festgrid/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { mergeAccountProfiles, planAccountProfileMerge, findTwinGroups } from './merge-account-profiles.js';

const suffix = Date.now().toString();
const username = 'merge_twin_' + suffix;

const createdProfileIds: string[] = [];
const createdPostIds: string[] = [];
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];
const createdRunIds: string[] = [];
const createdMergeIds: string[] = [];

async function makeProfile(accountId: string, overrides: Partial<typeof socialMediaAccountProfiles.$inferInsert> = {}) {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId, platform: 'instagram', username, displayName: 'Merge Twin', ...overrides })
    .returning();
  createdProfileIds.push(profile.id);
  return profile;
}

async function makePost(accountId: string, tag: string, ownerUsername: string | null = username) {
  const [post] = await db
    .insert(posts)
    .values({
      accountId,
      platform: 'instagram',
      content: 'merge test ' + tag,
      postUrl: `https://instagram.com/p/merge_${tag}_${suffix}`,
      publishedAt: new Date(),
      ownerUsername,
    })
    .returning();
  createdPostIds.push(post.id);
  return post;
}

async function makeUser(tag: string) {
  const [user] = await db.insert(users).values({ email: `merge-${tag}-${suffix}@example.com` }).returning();
  createdUserIds.push(user.id);
  return user;
}

test('merge-account-profiles integration tests', async (t) => {
  t.after(async () => {
    if (createdMergeIds.length > 0) {
      await db.delete(accountProfileMerges).where(inArray(accountProfileMerges.id, createdMergeIds));
    }
    await db.delete(accountProfileMerges).where(inArray(accountProfileMerges.survivorId, createdProfileIds));
    if (createdEventIds.length > 0) await db.delete(events).where(inArray(events.id, createdEventIds));
    if (createdPostIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, createdPostIds));
      await db.delete(posts).where(inArray(posts.id, createdPostIds));
    }
    if (createdRunIds.length > 0) await db.delete(scraperActorRuns).where(inArray(scraperActorRuns.id, createdRunIds));
    if (createdProfileIds.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.accountId, createdProfileIds));
      await db.delete(accountVotes).where(inArray(accountVotes.accountId, createdProfileIds));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    }
    if (createdUserIds.length > 0) await db.delete(users).where(inArray(users.id, createdUserIds));
  });

  await t.test('merges a twin into its survivor: repoints everything, keeps run history, resolves collisions, writes an audit row', async () => {
    const survivorHandle = username;
    const twinNumericId = '4' + suffix;
    const survivor = await makeProfile(survivorHandle, { description: null, firstSeen: new Date('2026-09-01T00:00:00Z') });
    const twin = await makeProfile(twinNumericId, {
      description: 'filled from the twin',
      firstSeen: new Date('2026-08-01T00:00:00Z'),
      isVerifiedForDiscovery: false,
    });
    const userA = await makeUser('a');
    const userB = await makeUser('b');

    // Posts: one published by the twin and scraped under the survivor (the vendor evidence), one only owned by the twin.
    const evidencePost = await makePost(twin.id, 'evidence');
    await db.insert(postAccountAssociations).values([
      { postId: evidencePost.id, accountId: survivor.id, role: 'SCRAPING_SOURCE' },
      { postId: evidencePost.id, accountId: twin.id, role: 'PUBLISHER' },
    ]);
    const ownedPost = await makePost(twin.id, 'owned');
    await db.insert(postAccountAssociations).values({ postId: ownedPost.id, accountId: twin.id, role: 'PUBLISHER' });

    // Collision: both rows co-author the same third-party post (several COAUTHOR rows per post are allowed).
    const thirdParty = await makePost(survivor.id, 'third');
    await db.insert(postAccountAssociations).values([
      { postId: thirdParty.id, accountId: survivor.id, role: 'COAUTHOR' },
      { postId: thirdParty.id, accountId: twin.id, role: 'COAUTHOR' },
    ]);

    // Subscriptions: user A on both rows (keep one), user B only on the twin (repoint).
    await db.insert(subscriptions).values([
      { userId: userA.id, accountId: survivor.id, createdAt: new Date('2026-09-01T00:00:00Z') },
      { userId: userA.id, accountId: twin.id, createdAt: new Date('2026-09-02T00:00:00Z') },
      { userId: userB.id, accountId: twin.id },
    ]);

    // Votes: user A withdrew from the survivor but votes on the twin (re-activate); user B only on the twin.
    await db.insert(accountVotes).values([
      { userId: userA.id, accountId: survivor.id, deletedAt: new Date() },
      { userId: userA.id, accountId: twin.id },
      { userId: userB.id, accountId: twin.id },
    ]);

    // A scraper run for the twin: profile_id cascades on delete, so it must be repointed, not lost.
    const [run] = await db
      .insert(scraperActorRuns)
      .values({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: twin.id,
        runId: 'merge-run-' + suffix,
        rawInput: {},
      })
      .returning();
    createdRunIds.push(run.id);

    // An event whose source account text is the twin's numeric ID.
    const [event] = await db
      .insert(events)
      .values({ eventName: 'Merge Event', location: 'Yogyakarta', sourceSocialMediaAccountId: twinNumericId })
      .returning();
    createdEventIds.push(event.id);

    const plan = await planAccountProfileMerge(survivor.id, twin.id);
    assert.deepStrictEqual(plan.blockers, []);
    assert.strictEqual(plan.evidenceCount, 1);
    assert.strictEqual(plan.safeToAutoMerge, true);

    const result = await mergeAccountProfiles({ survivorId: survivor.id, twinId: twin.id, performedBy: 'test' });
    createdMergeIds.push(result.mergeId);

    // The twin is gone, the survivor remains.
    assert.strictEqual((await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, twin.id))).length, 0);
    const [survivorAfter] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, survivor.id));
    assert.strictEqual(survivorAfter.accountId, survivorHandle, 'the survivor keeps its account_id');
    assert.strictEqual(survivorAfter.description, 'filled from the twin', 'blanks are filled from the twin');
    assert.strictEqual(survivorAfter.isVerifiedForDiscovery, true, 'verified-for-discovery is OR-ed');
    assert.strictEqual(new Date(survivorAfter.firstSeen as Date).toISOString(), '2026-08-01T00:00:00.000Z', 'first_seen takes the earliest');

    // Posts moved.
    const postRows = await db.select().from(posts).where(inArray(posts.id, [evidencePost.id, ownedPost.id]));
    assert.ok(postRows.every((p) => p.accountId === survivor.id));

    // The run history survived the twin's deletion and now belongs to the survivor.
    const [runAfter] = await db.select().from(scraperActorRuns).where(eq(scraperActorRuns.id, run.id));
    assert.ok(runAfter, 'the scraper run was not cascade-deleted');
    assert.strictEqual(runAfter.profileId, survivor.id);

    // Associations: no twin rows left; the duplicate COAUTHOR collapsed to one.
    const assocs = await db.select().from(postAccountAssociations).where(inArray(postAccountAssociations.postId, createdPostIds));
    assert.ok(assocs.every((a) => a.accountId === survivor.id), 'every association points at the survivor');
    assert.strictEqual(assocs.filter((a) => a.postId === thirdParty.id && a.role === 'COAUTHOR').length, 1);

    // Subscriptions: user A has exactly one active row, user B was repointed.
    const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.accountId, survivor.id), isNull(subscriptions.deletedAt)));
    assert.strictEqual(subs.filter((s) => s.userId === userA.id).length, 1);
    assert.strictEqual(subs.filter((s) => s.userId === userB.id).length, 1);

    // Votes: user A's withdrawn survivor vote is active again; one vote per user.
    const votes = await db.select().from(accountVotes).where(eq(accountVotes.accountId, survivor.id));
    assert.strictEqual(votes.length, 2);
    assert.ok(votes.every((v) => v.deletedAt === null), 'an active twin vote re-activates the survivor vote');

    // The event's text copy of the account id was rewritten.
    const [eventAfter] = await db.select().from(events).where(eq(events.id, event.id));
    assert.strictEqual(eventAfter.sourceSocialMediaAccountId, survivorHandle);

    // Audit row: snapshot of the twin and the moved ids.
    const [audit] = await db.select().from(accountProfileMerges).where(eq(accountProfileMerges.id, result.mergeId));
    assert.strictEqual(audit.twinAccountId, twinNumericId);
    assert.strictEqual((audit.twinSnapshot as any).id, twin.id);
    assert.strictEqual(audit.performedBy, 'test');
    assert.deepStrictEqual((audit.repointed as any).scraperActorRuns, [run.id]);
  });

  await t.test('refuses a merge with no vendor evidence unless explicitly allowed', async () => {
    const survivor = await makeProfile('noev_s_' + suffix);
    const twin = await makeProfile('3' + suffix);

    const plan = await planAccountProfileMerge(survivor.id, twin.id);
    assert.strictEqual(plan.evidenceCount, 0);
    assert.strictEqual(plan.safeToAutoMerge, false);
    await assert.rejects(
      () => mergeAccountProfiles({ survivorId: survivor.id, twinId: twin.id, performedBy: 'test' }),
      /no vendor-proven evidence/
    );
    assert.strictEqual((await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, twin.id))).length, 1, 'nothing changed');

    const result = await mergeAccountProfiles({ survivorId: survivor.id, twinId: twin.id, performedBy: 'test', allowWithoutEvidence: true });
    createdMergeIds.push(result.mergeId);
    assert.strictEqual((await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, twin.id))).length, 0);
  });

  await t.test('blockers always refuse: differing confirmed account types, differing image opt-in, differing usernames', async () => {
    const a = await makeProfile('blk_a_' + suffix, { accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' });
    const b = await makeProfile('2' + suffix, { accountType: 'CURATOR_GUIDE', accountTypeStatus: 'CONFIRMED' });
    const typePlan = await planAccountProfileMerge(a.id, b.id);
    assert.ok(typePlan.blockers.some((x) => /account types differ/.test(x)));
    await assert.rejects(
      () => mergeAccountProfiles({ survivorId: a.id, twinId: b.id, performedBy: 'test', allowWithoutEvidence: true }),
      /Refusing to merge/
    );

    const optedIn = await makeProfile('blk_c_' + suffix, { isImageStorageOptedIn: true });
    const optPlan = await planAccountProfileMerge(a.id, optedIn.id);
    assert.ok(optPlan.blockers.some((x) => /opt-in differs/.test(x)));

    const other = await makeProfile('blk_d_' + suffix, { username: 'someone_else_' + suffix });
    const namePlan = await planAccountProfileMerge(a.id, other.id);
    assert.ok(namePlan.blockers.some((x) => /usernames differ/.test(x)));
  });

  await t.test('a failed merge leaves everything untouched (single transaction)', async () => {
    const survivor = await makeProfile('tx_s_' + suffix);
    const twin = await makeProfile('1' + suffix);
    const post = await makePost(twin.id, 'tx');

    await assert.rejects(
      () => mergeAccountProfiles({ survivorId: survivor.id, twinId: '00000000-0000-0000-0000-000000000000', performedBy: 'test', allowWithoutEvidence: true }),
      /Twin profile not found/
    );
    const [postAfter] = await db.select().from(posts).where(eq(posts.id, post.id));
    assert.strictEqual(postAfter.accountId, twin.id);
  });

  await t.test('findTwinGroups lists a duplicated username, best survivor first', async () => {
    const groupName = 'group_twin_' + suffix;
    const subscribed = await makeProfile('grp_s_' + suffix, { username: groupName });
    const numeric = await makeProfile('9' + suffix, { username: groupName.toUpperCase() });
    const user = await makeUser('grp');
    await db.insert(subscriptions).values({ userId: user.id, accountId: subscribed.id });

    const groups = await findTwinGroups();
    const group = groups.find((g) => g.username === groupName);
    assert.ok(group, 'the duplicated username is reported (case-insensitively)');
    assert.deepStrictEqual(group.profiles.map((p) => p.id), [subscribed.id, numeric.id], 'the subscribed row is the survivor');
  });
});
