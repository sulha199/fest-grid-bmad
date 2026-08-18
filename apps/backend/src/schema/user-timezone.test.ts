import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// read the generated schema for the yoga server
const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs: `
    ${typeDefs}
    type Query {
      health: Boolean
    }
  `,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('updateUserTimezone mutation integration tests', async (t) => {
  let user1: any;
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length >= 1, 'Must have at least 1 seeded user');
  user1 = seededUsers[0];

  // Clean up any existing timezone before starting tests
  await db.update(users).set({ timezone: null }).where(eq(users.id, user1.id));

  await t.test('unauthenticated call is rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { updateUserTimezone(timezone: "UTC") }`,
      }),
    }));
    const result = await response.json() as any;
    assert.ok(result.errors, 'Should have errors');
    assert.strictEqual(result.errors[0].extensions.code, 'UNAUTHENTICATED');
  });

  await t.test('invalid timezone string is rejected', async () => {
    mockUser = { userId: user1.id };
    const response = await yoga.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { updateUserTimezone(timezone: "invalid/zone") }`,
      }),
    }));
    const result = await response.json() as any;
    assert.ok(result.errors, 'Should have errors');
    assert.strictEqual(result.errors[0].extensions.code, 'BAD_REQUEST');

    // Verify no DB write occurred
    const updated = await db.select({ timezone: users.timezone }).from(users)
      .where(eq(users.id, user1.id));
    assert.strictEqual(updated[0].timezone, null, 'Timezone should remain null');
  });

  await t.test('first-time capture writes the value and returns true', async () => {
    mockUser = { userId: user1.id };
    const response = await yoga.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { updateUserTimezone(timezone: "America/New_York") }`,
      }),
    }));
    const result = await response.json() as any;
    assert.ok(!result.errors, `Should not have errors: ${result.errors?.[0]?.message}`);
    assert.strictEqual(result.data.updateUserTimezone, true);

    // Verify DB write occurred
    const updated = await db.select({ timezone: users.timezone, updatedAt: users.updatedAt })
      .from(users).where(eq(users.id, user1.id));
    assert.strictEqual(updated[0].timezone, 'America/New_York');
  });

  await t.test('resubmitting identical value returns true without updating', async () => {
    mockUser = { userId: user1.id };
    // Get current updatedAt
    const before = await db.select({ updatedAt: users.updatedAt }).from(users)
      .where(eq(users.id, user1.id));
    const beforeUpdatedAt = before[0].updatedAt;

    // Wait a tiny bit to ensure timestamp would be different if updated
    await new Promise(r => setTimeout(r, 10));

    // Resubmit same value
    const response = await yoga.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { updateUserTimezone(timezone: "America/New_York") }`,
      }),
    }));
    const result = await response.json() as any;
    assert.ok(!result.errors, `Should not have errors: ${result.errors?.[0]?.message}`);
    assert.strictEqual(result.data.updateUserTimezone, true);

    // Verify no DB write occurred (updatedAt unchanged)
    const after = await db.select({ updatedAt: users.updatedAt }).from(users)
      .where(eq(users.id, user1.id));
    assert.strictEqual(
      after[0].updatedAt.getTime(),
      beforeUpdatedAt.getTime(),
      'updatedAt should be unchanged when submitting identical value'
    );
  });

  await t.test('submitting different valid value updates it', async () => {
    mockUser = { userId: user1.id };
    const response = await yoga.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { updateUserTimezone(timezone: "Asia/Jakarta") }`,
      }),
    }));
    const result = await response.json() as any;
    assert.ok(!result.errors, `Should not have errors: ${result.errors?.[0]?.message}`);
    assert.strictEqual(result.data.updateUserTimezone, true);

    // Verify DB write occurred
    const updated = await db.select({ timezone: users.timezone }).from(users)
      .where(eq(users.id, user1.id));
    assert.strictEqual(updated[0].timezone, 'Asia/Jakarta');
  });

  // Cleanup
  await db.update(users).set({ timezone: null }).where(eq(users.id, user1.id));
});
