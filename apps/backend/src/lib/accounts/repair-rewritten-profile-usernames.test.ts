import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  accountProfileRepairs,
  posts,
  scraperActorRuns,
  socialMediaAccountProfiles,
  subscriptions,
  users,
} from '@festgrid/database';
import {
  applyHandleKeyedRepair,
  classifyNumericKeyedLabel,
  extractVendorHandlesForId,
  findNumericKeyedFindings,
  isRewrittenHandleKeyedProfile,
  planHandleKeyedRepairs,
  REPAIR_KIND,
} from './repair-rewritten-profile-usernames.js';

test('isRewrittenHandleKeyedProfile', () => {
  const base = { platform: 'instagram', accountId: 'laridijogja', username: 'laridijogja' };
  assert.equal(isRewrittenHandleKeyedProfile(base), false);
  assert.equal(isRewrittenHandleKeyedProfile({ ...base, username: 'LariDiJogja' }), false, 'case alone is not a rewrite');
  assert.equal(isRewrittenHandleKeyedProfile({ ...base, username: 'kulonprogohalfmarathon' }), true);
  assert.equal(isRewrittenHandleKeyedProfile({ ...base, accountId: '4842911995', username: 'x' }), false, 'numeric-keyed');
  assert.equal(isRewrittenHandleKeyedProfile({ ...base, platform: 'twitter', username: 'x' }), false, 'instagram only');
});

test('extractVendorHandlesForId reads Apify owner/coauthor pairs and Bright Data pairs, array or JSON string', () => {
  const items = [
    { ownerId: '4842911995', ownerUsername: 'JogjaKajian' },
    { ownerId: '111', ownerUsername: 'someone.else' },
    { coauthorProducers: [{ id: '4842911995', username: 'jogjakajian2' }, { id: '222', username: 'other' }, null] },
    { user_posted_id: '4842911995', user_posted: '@bd.handle' },
    null,
    'not an object',
    { ownerId: '4842911995' },
  ];

  const expected = ['jogjakajian', 'jogjakajian2', 'bd.handle'];
  assert.deepEqual(extractVendorHandlesForId(items, '4842911995').sort(), expected.sort());
  assert.deepEqual(extractVendorHandlesForId(JSON.stringify(items), '4842911995').sort(), expected.sort());
});

test('extractVendorHandlesForId never throws on unusable output', () => {
  assert.deepEqual(extractVendorHandlesForId('{not json', '1'), []);
  assert.deepEqual(extractVendorHandlesForId(null, '1'), []);
  assert.deepEqual(extractVendorHandlesForId({ items: [] }, '1'), []);
  assert.deepEqual(extractVendorHandlesForId([{ ownerId: '1', ownerUsername: 42 }], '1'), []);
});

test('classifyNumericKeyedLabel', () => {
  assert.equal(classifyNumericKeyedLabel('masjid', []), 'NO_VENDOR_EVIDENCE');
  assert.equal(classifyNumericKeyedLabel('JogjaKajian', ['jogjakajian']), 'LABEL_MATCHES_VENDOR');
  assert.equal(classifyNumericKeyedLabel('masjidmuhajirinnitikan', ['jogjakajian']), 'LABEL_CONFLICTS_WITH_VENDOR');
});

test('repair of rewritten handle-keyed profiles (database)', async (t) => {
  const stamp = Date.now();
  const handle = `bug081_rep_${stamp}`;
  const healthyHandle = `bug081_ok_${stamp}`;
  const numericId = String(9_300_000_000 + (stamp % 1_000_000));
  const createdProfiles: string[] = [];
  const createdPosts: string[] = [];
  const createdSubs: string[] = [];
  const createdRuns: string[] = [];

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'a seeded user is required');

  const insertProfile = async (values: { accountId: string; username: string; displayName: string }) => {
    const [row] = await db
      .insert(socialMediaAccountProfiles)
      .values({ platform: 'instagram', ...values })
      .returning();
    createdProfiles.push(row.id);
    return row;
  };
  const insertPost = async (profileId: string, n: number, owner: { name: string; username: string }, publishedAt: Date) => {
    const [row] = await db
      .insert(posts)
      .values({
        accountId: profileId,
        platform: 'instagram',
        postUrl: `https://www.instagram.com/p/bug081-${stamp}-${n}/`,
        publishedAt,
        ownerDisplayName: owner.name,
        ownerUsername: owner.username,
      })
      .returning();
    createdPosts.push(row.id);
    return row;
  };

  t.after(async () => {
    if (createdProfiles.length > 0) {
      await db.delete(accountProfileRepairs).where(inArray(accountProfileRepairs.profileId, createdProfiles));
    }
    if (createdPosts.length > 0) await db.delete(posts).where(inArray(posts.id, createdPosts));
    if (createdRuns.length > 0) await db.delete(scraperActorRuns).where(inArray(scraperActorRuns.id, createdRuns));
    if (createdSubs.length > 0) await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubs));
    if (createdProfiles.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfiles));
    }
  });

  // The incident: handle-keyed row relabelled with a collab account's name.
  const rewritten = await insertProfile({
    accountId: handle,
    username: 'kulonprogohalfmarathon',
    displayName: 'Kulonprogo Half Marathon',
  });
  const healthy = await insertProfile({ accountId: healthyHandle, username: healthyHandle, displayName: 'Healthy' });
  // The account's own posts (older and newest) and a collab post by the account the row was relabelled with.
  await insertPost(rewritten.id, 1, { name: 'Old Own Name', username: handle }, new Date('2026-09-01T00:00:00Z'));
  const newestOwn = await insertPost(rewritten.id, 2, { name: 'Newest Own Name', username: handle.toUpperCase() }, new Date('2026-10-20T00:00:00Z'));
  await insertPost(rewritten.id, 3, { name: 'Kulonprogo Half Marathon', username: 'kulonprogohalfmarathon' }, new Date('2026-10-25T00:00:00Z'));

  // A numeric-keyed row whose label disagrees with the vendor's pairing of its ID.
  const relabelled = await insertProfile({ accountId: numericId, username: 'masjidmuhajirinnitikan', displayName: 'Masjid' });
  const [run] = await db
    .insert(scraperActorRuns)
    .values({
      vendor: 'APIFY',
      triggerMode: 'SYNC',
      profileId: relabelled.id,
      runId: `bug081-run-${stamp}`,
      status: 'SUCCEEDED',
      rawInput: {},
      // Stored as a JSON string, as drizzle/postgres.js sometimes double-encodes it.
      rawOutput: JSON.stringify([{ ownerId: numericId, ownerUsername: 'jogjakajian' }]) as unknown as Record<string, unknown>,
    })
    .returning();
  createdRuns.push(run.id);
  for (const profileId of [rewritten.id, healthy.id, relabelled.id]) {
    const [sub] = await db.insert(subscriptions).values({ userId: user.id, accountId: profileId }).returning();
    createdSubs.push(sub.id);
  }

  await t.test('the plan lists only the rewritten handle-keyed row, restoring from its newest own post', async () => {
    const plans = (await planHandleKeyedRepairs()).filter((plan) => createdProfiles.includes(plan.profileId));

    assert.equal(plans.length, 1);
    assert.equal(plans[0].profileId, rewritten.id);
    assert.equal(plans[0].restoreUsername, handle);
    assert.equal(plans[0].restoreDisplayName, 'Newest Own Name');
    assert.equal(plans[0].displayNameEvidencePostUrl, newestOwn.postUrl);

    const [untouched] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, rewritten.id));
    assert.equal(untouched.username, 'kulonprogohalfmarathon', 'planning is read-only');
  });

  await t.test('the numeric-keyed row is reported for a human, with the vendor evidence', async () => {
    const finding = (await findNumericKeyedFindings()).find((entry) => entry.profileId === relabelled.id);

    assert.ok(finding);
    assert.deepEqual(finding.vendorHandles, ['jogjakajian']);
    assert.equal(finding.verdict, 'LABEL_CONFLICTS_WITH_VENDOR');
    assert.equal(finding.activeSubscriptions, 1);
  });

  await t.test('applying restores username and display name, writes the audit row, and is idempotent', async () => {
    const [plan] = (await planHandleKeyedRepairs()).filter((entry) => entry.profileId === rewritten.id);

    const first = await applyHandleKeyedRepair(plan, 'test');
    assert.equal(first.status, 'repaired');

    const [after] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, rewritten.id));
    assert.equal(after.username, handle);
    assert.equal(after.displayName, 'Newest Own Name');

    const audit = await db.select().from(accountProfileRepairs).where(eq(accountProfileRepairs.profileId, rewritten.id));
    assert.equal(audit.length, 1);
    assert.equal(audit[0].repairKind, REPAIR_KIND);
    assert.deepEqual(audit[0].before, { username: 'kulonprogohalfmarathon', displayName: 'Kulonprogo Half Marathon' });
    assert.deepEqual(audit[0].after, { username: handle, displayName: 'Newest Own Name' });
    assert.equal(audit[0].performedBy, 'test');

    const second = await applyHandleKeyedRepair(plan, 'test');
    assert.deepEqual(second, { status: 'skipped', reason: 'username already matches account_id' });
    const auditAfterRerun = await db.select().from(accountProfileRepairs).where(eq(accountProfileRepairs.profileId, rewritten.id));
    assert.equal(auditAfterRerun.length, 1, 'a re-run writes no second audit row');

    const [numeric] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, relabelled.id));
    assert.equal(numeric.username, 'masjidmuhajirinnitikan', 'a numeric-keyed row is never changed');
  });

  await t.test('a row with no post of its own keeps its display name', async () => {
    const noPostsHandle = `bug081_nopost_${stamp}`;
    const lonely = await insertProfile({ accountId: noPostsHandle, username: 'someone.else', displayName: 'Someone Else' });

    const [plan] = (await planHandleKeyedRepairs()).filter((entry) => entry.profileId === lonely.id);
    assert.equal(plan.restoreUsername, noPostsHandle);
    assert.equal(plan.restoreDisplayName, null);

    assert.equal((await applyHandleKeyedRepair(plan, 'test')).status, 'repaired');
    const [after] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, lonely.id));
    assert.equal(after.username, noPostsHandle);
    assert.equal(after.displayName, 'Someone Else');
  });

  await t.test('a profile deleted between plan and apply is skipped', async () => {
    const ghostHandle = `bug081_ghost_${stamp}`;
    const ghost = await insertProfile({ accountId: ghostHandle, username: 'someone.else', displayName: 'Ghost' });
    const [plan] = (await planHandleKeyedRepairs()).filter((entry) => entry.profileId === ghost.id);

    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, ghost.id));
    createdProfiles.splice(createdProfiles.indexOf(ghost.id), 1);

    assert.deepEqual(await applyHandleKeyedRepair(plan, 'test'), { status: 'skipped', reason: 'profile no longer exists' });
  });
});
