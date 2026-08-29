import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, apiKeys } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { setCallGeminiGenerateContent, callGeminiGenerateContent, GeminiInvalidKeyError } from '../lib/ai-gateway/gemini-client.js';

// Read all required schema fragments dynamically from the schema directory
const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('api keys resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;

  const originalCall = callGeminiGenerateContent;
  t.after(() => {
    setCallGeminiGenerateContent(originalCall);
  });

  // Set default stub behavior to resolve successfully for non-verification tests
  setCallGeminiGenerateContent(async () => {
    return { text: 'ok' };
  });

  await t.test('setup - get test users and clear existing data', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users for cross-user tests');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    await db.delete(apiKeys).where(eq(apiKeys.userId, testUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, anotherUser.id));
  });

  await t.test('unauthenticated calls are rejected', async () => {
    mockUser = null;

    // Create mutation unauthenticated
    const resCreate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "test-key-1234" }) {
              id
            }
          }
        `
      })
    });
    const resultCreate = await resCreate.json();
    assert.ok(resultCreate.errors, 'should return error');
    assert.strictEqual(resultCreate.errors[0].extensions?.code, 'UNAUTHENTICATED');

    // Query unauthenticated
    const resQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myApiKeys { id } }`
      })
    });
    const resultQuery = await resQuery.json();
    assert.ok(resultQuery.errors, 'should return error');
    assert.strictEqual(resultQuery.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('createApiKey - validation of provider', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "unsupported", key: "test-key" }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should return validation error for unsupported provider');
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('createApiKey rejects duplicate keys for the same provider', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const resCreate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "duplicate-key-1234" }) {
              id
            }
          }
        `
      })
    });
    const resultCreate = await resCreate.json();
    assert.ok(!resultCreate.errors, 'first duplicate key insert should succeed');

    const resDuplicate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "duplicate-key-1234" }) {
              id
            }
          }
        `
      })
    });
    const resultDuplicate = await resDuplicate.json();
    assert.ok(resultDuplicate.errors, 'duplicate key should be rejected');
    assert.strictEqual(resultDuplicate.errors[0].extensions?.code, 'DUPLICATE_API_KEY');

    await db.delete(apiKeys).where(eq(apiKeys.id, resultCreate.data.createApiKey.id));
  });

  await t.test('createApiKey, myApiKeys, deleteApiKey flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Create API key
    const resCreate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "AIzaSyDummyKey5678" }) {
              id
              provider
              maskedKey
              isValid
              createdAt
              updatedAt
            }
          }
        `
      })
    });
    const resultCreate = await resCreate.json();
    assert.ok(!resultCreate.errors, 'should not have errors: ' + JSON.stringify(resultCreate.errors));
    const apiKey = resultCreate.data.createApiKey;
    assert.strictEqual(apiKey.provider, 'gemini');
    assert.strictEqual(apiKey.maskedKey, '••••5678');
    assert.strictEqual(apiKey.isValid, true);
    assert.ok(apiKey.createdAt);
    assert.ok(apiKey.updatedAt);

    // Verify key encrypted row exists in DB
    const [dbRow] = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKey.id));
    assert.ok(dbRow);
    assert.strictEqual(dbRow.keyLast4, '5678');
    assert.ok(dbRow.keyEncrypted);
    assert.notStrictEqual(dbRow.keyEncrypted, 'AIzaSyDummyKey5678');

    // 2. Query my API keys
    const resQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          {
            myApiKeys {
              id
              provider
              maskedKey
              isValid
            }
          }
        `
      })
    });
    const resultQuery = await resQuery.json();
    assert.ok(!resultQuery.errors, 'query should not have errors');
    const keysList = resultQuery.data.myApiKeys;
    assert.strictEqual(keysList.length, 1);
    assert.strictEqual(keysList[0].id, apiKey.id);
    assert.strictEqual(keysList[0].maskedKey, '••••5678');

    // 3. Delete / Soft-Delete (DELETE)
    const resDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteApiKey(id: "${apiKey.id}", action: DELETE) {
              id
              isValid
            }
          }
        `
      })
    });
    const resultDelete = await resDelete.json();
    assert.ok(!resultDelete.errors, 'delete should not have errors');

    // Query list again - should be empty now because of activeOnly filter
    const resQuery2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myApiKeys { id } }`
      })
    });
    const resultQuery2 = await resQuery2.json();
    assert.strictEqual(resultQuery2.data.myApiKeys.length, 0);

    // 4. Repeated DELETE should throw INVALID_STATE_TRANSITION
    const resDeleteRepeat = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteApiKey(id: "${apiKey.id}", action: DELETE) {
              id
            }
          }
        `
      })
    });
    const resultDeleteRepeat = await resDeleteRepeat.json();
    assert.ok(resultDeleteRepeat.errors);
    assert.strictEqual(resultDeleteRepeat.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // 5. Restore (RESTORE)
    const resRestore = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteApiKey(id: "${apiKey.id}", action: RESTORE) {
              id
            }
          }
        `
      })
    });
    const resultRestore = await resRestore.json();
    assert.ok(!resultRestore.errors, 'restore should succeed');

    // Query list again - should be visible again
    const resQuery3 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myApiKeys { id } }`
      })
    });
    const resultQuery3 = await resQuery3.json();
    assert.strictEqual(resultQuery3.data.myApiKeys.length, 1);

    // 6. Repeated RESTORE should throw INVALID_STATE_TRANSITION
    const resRestoreRepeat = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteApiKey(id: "${apiKey.id}", action: RESTORE) {
              id
            }
          }
        `
      })
    });
    const resultRestoreRepeat = await resRestoreRepeat.json();
    assert.ok(resultRestoreRepeat.errors);
    assert.strictEqual(resultRestoreRepeat.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // 7. Isolation check: another user cannot delete this user's API Key
    mockUser = { userId: anotherUser.id, role: anotherUser.role };
    const resCrossDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteApiKey(id: "${apiKey.id}", action: DELETE) {
              id
            }
          }
        `
      })
    });
    const resultCrossDelete = await resCrossDelete.json();
    assert.ok(resultCrossDelete.errors);
    assert.strictEqual(resultCrossDelete.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('createApiKey rejects with INVALID_API_KEY when verifyGeminiApiKey returns false', async () => {
    setCallGeminiGenerateContent(async (apiKey) => {
      if (apiKey === 'invalid-key-value') {
        throw new GeminiInvalidKeyError('Invalid key');
      }
      return { text: 'ok' };
    });

    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "invalid-key-value" }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should be rejected');
    assert.strictEqual(result.errors[0].message, 'Invalid Gemini API key');
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_API_KEY');

    // Confirm not inserted in DB
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, testUser.id));
    const invalidInserted = keys.find(k => k.keyLast4 === 'alue'); // 'invalid-key-value'.slice(-4) => 'alue'
    assert.ok(!invalidInserted, 'should not be inserted in db');
  });

  await t.test('createApiKey proceeds and persists when verification throws a non-invalid-key error (fail-open)', async () => {
    setCallGeminiGenerateContent(async (apiKey) => {
      if (apiKey === 'transient-error-key') {
        throw new Error('Some DNS timeout error');
      }
      return { text: 'ok' };
    });

    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKey(input: { provider: "gemini", key: "transient-error-key" }) {
              id
              maskedKey
              isValid
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'should not fail because we fail open on transient errors: ' + JSON.stringify(result.errors));
    assert.strictEqual(result.data.createApiKey.maskedKey, '••••-key');
    assert.strictEqual(result.data.createApiKey.isValid, true);

    // Confirm it exists in DB
    const [dbRow] = await db.select().from(apiKeys).where(eq(apiKeys.id, result.data.createApiKey.id));
    assert.ok(dbRow);
    assert.strictEqual(dbRow.keyLast4, '-key'); // 'transient-error-key'.slice(-4) => '-key'

    // Cleanup
    await db.delete(apiKeys).where(eq(apiKeys.id, dbRow.id));
  });
});
