import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateUserSettings } from './get-or-create-user-settings.js';
import { users, userSettings } from '@festgrid/database';
import { db } from '../../db/client.js';
import { eq, inArray } from 'drizzle-orm';

test('getOrCreateUserSettings', async (t) => {
  const testUserIds: string[] = [];

  t.after(async () => {
    if (testUserIds.length > 0) {
      // userSettings cascades on user delete, so deleting users is sufficient cleanup.
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
  });

  async function createTestUser(emailSuffix: string) {
    const [u] = await db.insert(users).values({
      email: `get-or-create-user-settings-${emailSuffix}-${Math.random()}@example.com`,
      name: 'Get Or Create User Settings Test User',
      role: 'user',
    }).returning();
    testUserIds.push(u.id);
    return u;
  }

  await t.test('a brand-new userId creates and returns a settings row with default values', async () => {
    const user = await createTestUser('new');

    const preCount = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    assert.equal(preCount.length, 0);

    const settings = await getOrCreateUserSettings(user.id);

    assert.equal(settings.userId, user.id);
    assert.equal(settings.hidePastEventsAfterDays, 0);
    assert.equal(settings.pushNotificationsEnabled, true);

    const postCount = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    assert.equal(postCount.length, 1);
  });

  await t.test('an existing userId returns its existing row unmodified, including a non-default hidePastEventsAfterDays', async () => {
    const user = await createTestUser('existing');

    // Seed a row with a non-default value first.
    await db.insert(userSettings).values({
      userId: user.id,
      hidePastEventsAfterDays: 14,
      pushNotificationsEnabled: false,
    });

    const settings = await getOrCreateUserSettings(user.id);

    // Proves the upsert's DO UPDATE (a no-op on userId) doesn't reset existing columns.
    assert.equal(settings.hidePastEventsAfterDays, 14);
    assert.equal(settings.pushNotificationsEnabled, false);

    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    assert.equal(rows.length, 1);
  });

  await t.test('two concurrent calls for the same new userId both resolve without throwing and return equivalent rows', async () => {
    const user = await createTestUser('concurrent');

    const [settingsA, settingsB] = await Promise.all([
      getOrCreateUserSettings(user.id),
      getOrCreateUserSettings(user.id),
    ]);

    assert.equal(settingsA.userId, user.id);
    assert.equal(settingsB.userId, user.id);
    assert.deepEqual(settingsA, settingsB);

    // Exactly one row persisted -- the race is closed by construction (a single atomic
    // upsert statement per call), not merely by luck within one process.
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    assert.equal(rows.length, 1);
  });
});
