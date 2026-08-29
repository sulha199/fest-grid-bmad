import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateUser } from './user-provisioning.js';
import { users } from '@festgrid/database';
import { db } from '../../db/client.js';
import { eq, inArray } from 'drizzle-orm';

test('getOrCreateUser', async (t) => {
  // Ensure clean state before tests
  await db.delete(users).where(inArray(users.id, ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']));

  await t.test('creates a new user and returns role user', async () => {
    try {
    const payload = {
      sub: '00000000-0000-0000-0000-000000000003',
      email: 'test1@example.com',
      user_metadata: {
        name: 'Test One',
      },
    };

    const user = await getOrCreateUser(payload);
    assert.equal(user.id, '00000000-0000-0000-0000-000000000003');
    assert.equal(user.role, 'user');

    // Verify it was saved to DB
    const dbUser = await db.select().from(users).where(eq(users.id, '00000000-0000-0000-0000-000000000003'));
    assert.equal(dbUser.length, 1);
    assert.equal(dbUser[0].email, 'test1@example.com');
    } catch(e) { console.error('ERROR 1:', e); throw e; }
  });

  await t.test('returns existing user without inserting a duplicate', async () => {
    const payload = {
      sub: '00000000-0000-0000-0000-000000000003',
      email: 'test1-different@example.com', // changed email
      user_metadata: {
        name: 'Test One Changed',
      },
    };

    const user = await getOrCreateUser(payload);
    assert.equal(user.id, '00000000-0000-0000-0000-000000000003');
    assert.equal(user.role, 'user');

    // Verify DB wasn't updated with new email because it did DoNothing
    const dbUser = await db.select().from(users).where(eq(users.id, '00000000-0000-0000-0000-000000000003'));
    assert.equal(dbUser[0].email, 'test1@example.com');
  });

  await t.test('preserves moderator role for existing users', async () => {
    // Seed a moderator
    await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000004',
      email: 'mod@example.com',
      role: 'moderator',
    });

    const payload = {
      sub: '00000000-0000-0000-0000-000000000004',
      email: 'mod@example.com',
    };

    const user = await getOrCreateUser(payload);
    assert.equal(user.id, '00000000-0000-0000-0000-000000000004');
    assert.equal(user.role, 'moderator');
  });

  t.after(async () => {
    // Cleanup test users
    await db.delete(users).where(inArray(users.id, ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']));
  });
});


