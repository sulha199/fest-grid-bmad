import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, fcmTokens } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';

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

test('FCM device token registry integration tests', async (t) => {
  let user1: any;
  let user2: any;
  const tokenString = 'test-fcm-token-12345';

  await t.test('setup - get two seeded test users', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Must have at least 2 seeded users to run FCM token ownership tests');
    user1 = seededUsers[0];
    user2 = seededUsers[1];

    // Cleanup existing tokens for the test token string before starting
    await db.delete(fcmTokens).where(eq(fcmTokens.token, tokenString));
  });

  await t.test('registerFcmToken - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RegisterFcmToken($token: String!) {
            registerFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');

    // Confirm no row was written
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 0);
  });

  await t.test('registerFcmToken - authenticated user registers token', async () => {
    mockUser = { userId: user1.id, role: user1.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RegisterFcmToken($token: String!) {
            registerFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'Should not return any errors');
    assert.strictEqual(result.data.registerFcmToken, true);

    // Confirm row exists
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].userId, user1.id);
  });

  await t.test('registerFcmToken - same user registering same token is idempotent', async () => {
    mockUser = { userId: user1.id, role: user1.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RegisterFcmToken($token: String!) {
            registerFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.registerFcmToken, true);

    // Confirm still exactly one row
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].userId, user1.id);
  });

  await t.test('registerFcmToken - different user registering same token reassigns ownership', async () => {
    mockUser = { userId: user2.id, role: user2.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RegisterFcmToken($token: String!) {
            registerFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.registerFcmToken, true);

    // Confirm row is reassigned to user2
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].userId, user2.id);
  });

  await t.test('unregisterFcmToken - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UnregisterFcmToken($token: String!) {
            unregisterFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');

    // Confirm row is still there
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 1);
  });

  await t.test('unregisterFcmToken - different user unregistering is no-op', async () => {
    // Current owner is user2. Caller is user1.
    mockUser = { userId: user1.id, role: user1.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UnregisterFcmToken($token: String!) {
            unregisterFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.unregisterFcmToken, true);

    // Confirm row is still there and still owned by user2
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].userId, user2.id);
  });

  await t.test('unregisterFcmToken - actual owner can unregister', async () => {
    mockUser = { userId: user2.id, role: user2.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UnregisterFcmToken($token: String!) {
            unregisterFcmToken(token: $token)
          }
        `,
        variables: { token: tokenString }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.unregisterFcmToken, true);

    // Confirm row is deleted
    const rows = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenString));
    assert.strictEqual(rows.length, 0);
  });

  await t.test('teardown - cleanup test token', async () => {
    await db.delete(fcmTokens).where(eq(fcmTokens.token, tokenString));
  });
});
