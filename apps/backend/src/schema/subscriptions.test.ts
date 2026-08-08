import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, apiKeys, subscriptions, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';

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

test('Subscriptions and API Keys resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;
  let createdApiKeyId: string;

  await t.test('setup - get test users and clear existing data', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users for cross-user tests');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, anotherUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, anotherUser.id));
  });

  await t.test('1. createApiKey rejects unsupported provider', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateApiKey($input: CreateApiKeyInput!) {
            createApiKey(input: $input) {
              id
              provider
              maskedKey
            }
          }
        `,
        variables: {
          input: {
            provider: 'openai',
            key: 'sk-1234567890'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have returned validation errors');
    assert.equal(body.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('2. createApiKey persists keyLast4, masks, and returns ApiKey successfully', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateApiKey($input: CreateApiKeyInput!) {
            createApiKey(input: $input) {
              id
              provider
              maskedKey
              isValid
            }
          }
        `,
        variables: {
          input: {
            provider: 'gemini',
            key: 'GEMINI-API-KEY-VALUE-1234'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, 'Should not have errors: ' + JSON.stringify(body.errors));
    assert.equal(body.data.createApiKey.provider, 'gemini');
    assert.equal(body.data.createApiKey.maskedKey, '••••1234');
    assert.equal(body.data.createApiKey.isValid, true);
    createdApiKeyId = body.data.createApiKey.id;
  });

  await t.test('3. myApiKeys query returns active masked keys of authenticated user only', async () => {
    // Authenticated testUser
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
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

    const body = await response.json();
    assert.ok(!body.errors);
    assert.equal(body.data.myApiKeys.length, 1);
    assert.equal(body.data.myApiKeys[0].id, createdApiKeyId);
    assert.equal(body.data.myApiKeys[0].maskedKey, '••••1234');

    // Authenticated anotherUser (who has no keys)
    mockUser = { userId: anotherUser.id, role: anotherUser.role };

    const responseAnother = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            myApiKeys {
              id
            }
          }
        `
      })
    });

    const bodyAnother = await responseAnother.json();
    assert.equal(bodyAnother.data.myApiKeys.length, 0);
  });

  await t.test('4. deleteApiKey(DELETE) soft deletes, twice throws INVALID_STATE_TRANSITION', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1st DELETE
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation DeleteApiKey($id: ID!, $action: SoftDeleteAction!) {
            deleteApiKey(id: $id, action: $action) {
              id
              isValid
            }
          }
        `,
        variables: {
          id: createdApiKeyId,
          action: 'DELETE'
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors);

    // Verify it's not returned in myApiKeys now
    const responseList = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myApiKeys { id } }`
      })
    });
    const bodyList = await responseList.json();
    assert.equal(bodyList.data.myApiKeys.length, 0);

    // 2nd DELETE (Already deleted) should throw
    const responseFail = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation DeleteApiKey($id: ID!, $action: SoftDeleteAction!) {
            deleteApiKey(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: {
          id: createdApiKeyId,
          action: 'DELETE'
        }
      })
    });
    const bodyFail = await responseFail.json();
    assert.equal(bodyFail.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('5. deleteApiKey(RESTORE) brings it back', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation DeleteApiKey($id: ID!, $action: SoftDeleteAction!) {
            deleteApiKey(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: {
          id: createdApiKeyId,
          action: 'RESTORE'
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors);

    // Verify it's returned in myApiKeys again
    const responseList = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myApiKeys { id } }`
      })
    });
    const bodyList = await responseList.json();
    assert.equal(bodyList.data.myApiKeys.length, 1);
  });

  await t.test('6. subscribeToAccount mutation rejects unsupported platform', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubscribeToAccount($input: SubscribeToAccountInput!) {
            subscribeToAccount(input: $input) {
              subscription {
                id
              }
              alreadySubscribed
            }
          }
        `,
        variables: {
          input: {
            platform: 'tiktok',
            accountId: 'jkt_culinary',
            username: 'jkt_culinary',
            displayName: 'Jakarta Culinary'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors);
    assert.equal(body.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('7. subscribeToAccount mutation successfully creates profile and subscription', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubscribeToAccount($input: SubscribeToAccountInput!) {
            subscribeToAccount(input: $input) {
              subscription {
                id
                accountId
                isNewlyAdded
                createdAt
              }
              alreadySubscribed
            }
          }
        `,
        variables: {
          input: {
            platform: 'instagram',
            accountId: 'jkt_festivals_31',
            username: 'jkt_festivals_31',
            displayName: 'Jakarta Festivals'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    assert.equal(body.data.subscribeToAccount.alreadySubscribed, false);
    assert.equal(body.data.subscribeToAccount.subscription.isNewlyAdded, true);
    assert.ok(body.data.subscribeToAccount.subscription.id);
  });

  await t.test('8. mySubscriptions query returns subscriptions with account profile', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            mySubscriptions {
              id
              accountId
              isNewlyAdded
              account {
                platform
                displayName
                username
              }
            }
          }
        `
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    assert.equal(body.data.mySubscriptions.length, 1);
    assert.equal(body.data.mySubscriptions[0].account.platform, 'instagram');
    assert.equal(body.data.mySubscriptions[0].account.username, 'jkt_festivals_31');
  });

  await t.test('9. removeSubscription soft-deletes and is idempotency-guarded', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Get the subscription ID first
    const getList = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ mySubscriptions { id } }` })
    });
    const listBody = await getList.json();
    const subId = listBody.data.mySubscriptions[0].id;

    // 1st DELETE: soft delete
    const responseDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSubscription($id: ID!, $action: SoftDeleteAction!) {
            removeSubscription(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: subId, action: 'DELETE' }
      })
    });
    const deleteBody = await responseDelete.json();
    assert.ok(!deleteBody.errors, JSON.stringify(deleteBody.errors));

    // mySubscriptions should be empty now
    const checkEmpty = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ mySubscriptions { id } }` })
    });
    const emptyBody = await checkEmpty.json();
    assert.equal(emptyBody.data.mySubscriptions.length, 0);

    // 2nd DELETE: throws INVALID_STATE_TRANSITION
    const responseDelete2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSubscription($id: ID!, $action: SoftDeleteAction!) {
            removeSubscription(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: subId, action: 'DELETE' }
      })
    });
    const deleteBody2 = await responseDelete2.json();
    assert.equal(deleteBody2.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // RESTORE brings it back
    const responseRestore = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSubscription($id: ID!, $action: SoftDeleteAction!) {
            removeSubscription(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: subId, action: 'RESTORE' }
      })
    });
    const restoreBody = await responseRestore.json();
    assert.ok(!restoreBody.errors);

    // mySubscriptions should have 1 item again
    const checkRestored = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ mySubscriptions { id } }` })
    });
    const restoredBody = await checkRestored.json();
    assert.equal(restoredBody.data.mySubscriptions.length, 1);
  });

  await t.test('10. removeSubscription on another user\'s subscription throws NOT_FOUND', async () => {
    // Authenticated as anotherUser
    mockUser = { userId: anotherUser.id, role: anotherUser.role };

    // Get testUser's subscription ID
    mockUser = { userId: testUser.id, role: testUser.role };
    const getList = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ mySubscriptions { id } }` })
    });
    const listBody = await getList.json();
    const subId = listBody.data.mySubscriptions[0].id;

    // Try to remove it as anotherUser
    mockUser = { userId: anotherUser.id, role: anotherUser.role };
    const responseDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSubscription($id: ID!, $action: SoftDeleteAction!) {
            removeSubscription(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: subId, action: 'DELETE' }
      })
    });
    const deleteBody = await responseDelete.json();
    assert.equal(deleteBody.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('11. unauthenticated query/mutation throws unauthenticated error', async () => {
    mockUser = null;

    const responseQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ mySubscriptions { id } }` })
    });
    const queryBody = await responseQuery.json();
    assert.equal(queryBody.errors[0].message, 'You must be logged in to perform this action.');

    const responseMutation = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSubscription($id: ID!, $action: SoftDeleteAction!) {
            removeSubscription(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: 'some-id', action: 'DELETE' }
      })
    });
    const mutationBody = await responseMutation.json();
    assert.equal(mutationBody.errors[0].message, 'You must be logged in to perform this action.');
  });

  await t.test('cleanup - delete all created test data', async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'jkt_festivals_31'));
  });
});
