import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, apiKeys, socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
import { hasAvailableApiKeyForAccount } from './has-available-api-key-for-account.js';

test('hasAvailableApiKeyForAccount integration tests', async (t) => {
  const createdUserIds: string[] = [];
  const createdProfileIds: string[] = [];
  const createdApiKeyIds: string[] = [];
  const createdSubscriptionIds: string[] = [];

  t.after(async () => {
    if (createdSubscriptionIds.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubscriptionIds));
    }
    if (createdApiKeyIds.length > 0) {
      await db.delete(apiKeys).where(inArray(apiKeys.id, createdApiKeyIds));
    }
    if (createdProfileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  async function createUser() {
    const [user] = await db.insert(users).values({
      email: `has-available-key-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    createdUserIds.push(user.id);
    return user;
  }

  async function createProfile(label: string) {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `fake-acc-${label}-${Date.now()}-${Math.random()}`,
      platform: 'instagram',
      username: `fake_${label}`,
      displayName: `Fake ${label}`,
    }).returning();
    createdProfileIds.push(profile.id);
    return profile;
  }

  async function subscribe(userId: string, accountId: string) {
    const [sub] = await db.insert(subscriptions).values({ userId, accountId }).returning();
    createdSubscriptionIds.push(sub.id);
    return sub;
  }

  async function createKey(userId: string, overrides: Partial<typeof apiKeys.$inferInsert> = {}) {
    const [key] = await db.insert(apiKeys).values({
      userId,
      provider: 'gemini',
      keyEncrypted: 'mock-encrypted-key',
      keyLast4: '1234',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
      usageCycleResetAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      ...overrides,
    }).returning();
    createdApiKeyIds.push(key.id);
    return key;
  }

  await t.test('(a) Tier-1 account (one active subscriber) with one valid key -> true', async () => {
    const user = await createUser();
    const profile = await createProfile('tier1-valid');
    await subscribe(user.id, profile.id);
    await createKey(user.id);

    assert.strictEqual(await hasAvailableApiKeyForAccount(profile.id), true);
  });

  await t.test('(b) Tier-2 account (two+ active subscribers) where only one holds a valid key -> true', async () => {
    const userWithKey = await createUser();
    const userWithoutKey = await createUser();
    const profile = await createProfile('tier2-one-valid');
    await subscribe(userWithKey.id, profile.id);
    await subscribe(userWithoutKey.id, profile.id);
    await createKey(userWithKey.id);

    assert.strictEqual(await hasAvailableApiKeyForAccount(profile.id), true);
  });

  await t.test('(c) an account whose only key(s) are all isValid: false -> false', async () => {
    const user = await createUser();
    const profile = await createProfile('all-invalid');
    await subscribe(user.id, profile.id);
    await createKey(user.id, { isValid: false, invalidAttempts: 5 });

    assert.strictEqual(await hasAvailableApiKeyForAccount(profile.id), false);
  });

  await t.test('(d) an account with zero active subscribers -> false', async () => {
    const profile = await createProfile('no-subscribers');

    assert.strictEqual(await hasAvailableApiKeyForAccount(profile.id), false);
  });
});
