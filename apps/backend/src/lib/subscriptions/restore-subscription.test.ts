import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { SubscriptionCapReachedError } from '@festgrid/domain/subscriptions';
import { db } from '../../db/client.js';
import { restoreSubscription } from './restore-subscription.js';

// Story 10.3 (AC8) -- RESTORE under the cap, and the two edges the review found: an already-active row reports its state
// instead of a cap error, and an account the user re-subscribed to is already held (no extra slot).

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];
const profileIds: string[] = [];

async function makeUser(): Promise<string> {
  const [user] = await db.insert(users).values({ email: `restore-${suffix}-${userIds.length}@example.test` }).returning({ id: users.id });
  userIds.push(user.id);
  return user.id;
}
async function sub(userId: string, deleted: boolean, accountId?: string): Promise<{ id: string; accountId: string }> {
  let account = accountId;
  if (!account) {
    const n = profileIds.length;
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `restore-${suffix}-${n}`, platform: 'instagram', username: `restore-${suffix}-${n}`, displayName: 'x' })
      .returning({ id: socialMediaAccountProfiles.id });
    profileIds.push(profile.id);
    account = profile.id;
  }
  const [row] = await db.insert(subscriptions).values({ userId, accountId: account, deletedAt: deleted ? new Date() : null }).returning();
  return { id: row.id, accountId: account };
}

test.after(async () => {
  if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds));
  if (profileIds.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
});

test('restoreSubscription', async (t) => {
  await t.test('restores below the cap', async () => {
    const user = await makeUser();
    const deleted = await sub(user, true);
    const restored = await restoreSubscription(user, deleted.id);
    assert.equal(restored?.deletedAt, null);
  });

  await t.test('is refused at the cap with the typed error and leaves the row deleted', async () => {
    const user = await makeUser();
    for (let i = 0; i < 5; i += 1) await sub(user, false);
    const deleted = await sub(user, true);
    await assert.rejects(restoreSubscription(user, deleted.id), SubscriptionCapReachedError);
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, deleted.id));
    assert.notEqual(row.deletedAt, null);
  });

  await t.test('an already-active (or foreign, or unknown) row returns undefined even at the cap, not a cap error', async () => {
    const user = await makeUser();
    const other = await makeUser();
    const active: { id: string }[] = [];
    for (let i = 0; i < 5; i += 1) active.push(await sub(user, false));
    assert.equal(await restoreSubscription(user, active[0].id), undefined);
    const foreign = await sub(other, true);
    assert.equal(await restoreSubscription(user, foreign.id), undefined);
    assert.equal(await restoreSubscription(user, '00000000-0000-4000-8000-000000000000'), undefined);
  });

  await t.test('an account re-subscribed after the delete is already held: restoring it needs no extra slot', async () => {
    const user = await makeUser();
    const deleted = await sub(user, true);
    await sub(user, false, deleted.accountId); // re-subscribed to the same account: a second row
    for (let i = 0; i < 4; i += 1) await sub(user, false); // 5 active in all
    const restored = await restoreSubscription(user, deleted.id);
    assert.equal(restored?.deletedAt, null);
  });

  await t.test('a moderator is exempt', async () => {
    const [moderator] = await db.insert(users).values({ email: `restore-mod-${suffix}@example.test`, role: 'moderator' }).returning({ id: users.id });
    userIds.push(moderator.id);
    for (let i = 0; i < 6; i += 1) await sub(moderator.id, false);
    const deleted = await sub(moderator.id, true);
    assert.equal((await restoreSubscription(moderator.id, deleted.id))?.deletedAt, null);
  });
});
