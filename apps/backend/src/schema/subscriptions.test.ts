import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, apiKeys, subscriptions, socialMediaAccountProfiles, posts, events, schedules } from '@festgrid/database';
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

  await t.test('12. isFromSubscribedAccount query filters events based on subscriptions', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Clean up in case of previous failed test run (respect FK order)
    const existingProfiles = await db.select({ id: socialMediaAccountProfiles.id })
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, 'test_sub_account_1'));
    if (existingProfiles.length > 0) {
      const profileId = existingProfiles[0].id;
      const existingPosts = await db.select({ id: posts.id })
        .from(posts)
        .where(eq(posts.accountId, profileId));
      if (existingPosts.length > 0) {
        const postIds = existingPosts.map(p => p.id);
        for (const pid of postIds) {
          await db.delete(events).where(eq(events.postId, pid));
        }
      }
      await db.delete(posts).where(eq(posts.accountId, profileId));
      await db.delete(subscriptions).where(eq(subscriptions.accountId, profileId));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    }

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      platform: 'instagram',
      accountId: 'test_sub_account_1',
      username: 'test_sub_account_1',
      displayName: 'Test Account 1'
    }).returning();

    const [sub] = await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: profile.id,
    }).returning();

    const [post] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/test_post_1',
      content: 'Test Event 1 Content',
      rawContent: 'Test Event 1 Content',
      publishedAt: new Date(),
    }).returning();

    const [event] = await db.insert(events).values({
      postId: post.id,
      eventName: 'Subscribed Event 1',
      slug: 'subscribed-event-1',
      description: 'Test Event from Subscribed Account',
      location: 'Test Location 1',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
    }).returning();

    const [schedule] = await db.insert(schedules).values({
      eventId: event.id,
      eventStartDate: '2026-08-11',
      eventEndDate: '2026-08-12',
      isMainSchedule: true,
      performers: ['Test Performer'],
    }).returning();

    const responseQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetSubscribedEvents($query: EventQueryConditionInput) {
            events(query: $query) {
              items {
                id
                eventName
              }
              totalCount
            }
          }
        `,
        variables: {
          query: {
            field: 'isFromSubscribedAccount',
            operator: 'eq',
            value: true
          }
        }
      })
    });

    const bodyQuery = await responseQuery.json();
    assert.ok(!bodyQuery.errors, JSON.stringify(bodyQuery.errors));
    assert.strictEqual(bodyQuery.data.events.items.length, 1);
    assert.strictEqual(bodyQuery.data.events.items[0].id, event.id);

    mockUser = null;
    const responseUnauth = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetSubscribedEvents($query: EventQueryConditionInput) {
            events(query: $query) {
              items {
                id
              }
              totalCount
            }
          }
        `,
        variables: {
          query: {
            field: 'isFromSubscribedAccount',
            operator: 'eq',
            value: true
          }
        }
      })
    });

    const bodyUnauth = await responseUnauth.json();
    assert.ok(!bodyUnauth.errors, JSON.stringify(bodyUnauth.errors));
    assert.strictEqual(bodyUnauth.data.events.items.length, 0);

    await db.delete(schedules).where(eq(schedules.id, schedule.id));
    await db.delete(events).where(eq(events.id, event.id));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('13. socialMediaAccountProfileId query filters events based on profile id', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Clean up test_sub_account_2 in case of previous failed test run
    const existingProfiles = await db.select({ id: socialMediaAccountProfiles.id })
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.accountId, 'test_sub_account_2'));
    if (existingProfiles.length > 0) {
      const profileId = existingProfiles[0].id;
      const existingPosts = await db.select({ id: posts.id })
        .from(posts)
        .where(eq(posts.accountId, profileId));
      if (existingPosts.length > 0) {
        const postIds = existingPosts.map(p => p.id);
        for (const pid of postIds) {
          await db.delete(events).where(eq(events.postId, pid));
        }
      }
      await db.delete(posts).where(eq(posts.accountId, profileId));
      await db.delete(subscriptions).where(eq(subscriptions.accountId, profileId));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    }

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      platform: 'instagram',
      accountId: 'test_sub_account_2',
      username: 'test_sub_account_2',
      displayName: 'Test Account 2'
    }).returning();

    const [sub] = await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: profile.id,
    }).returning();

    const [post] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/test_post_2',
      content: 'Test Event 2 Content',
      rawContent: 'Test Event 2 Content',
      publishedAt: new Date(),
    }).returning();

    const [event] = await db.insert(events).values({
      postId: post.id,
      eventName: 'Subscribed Event 2',
      slug: 'subscribed-event-2',
      description: 'Test Event from Subscribed Account 2',
      location: 'Test Location 2',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
    }).returning();

    const [schedule] = await db.insert(schedules).values({
      eventId: event.id,
      eventStartDate: '2026-08-11',
      eventEndDate: '2026-08-12',
      isMainSchedule: true,
      performers: ['Test Performer 2'],
    }).returning();

    // Query using operator 'eq'
    const responseQueryEq = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventsByProfile($query: EventQueryConditionInput) {
            events(query: $query) {
              items {
                id
                eventName
              }
              totalCount
            }
          }
        `,
        variables: {
          query: {
            field: 'socialMediaAccountProfileId',
            operator: 'eq',
            value: profile.id
          }
        }
      })
    });

    const bodyQueryEq = await responseQueryEq.json();
    assert.ok(!bodyQueryEq.errors, JSON.stringify(bodyQueryEq.errors));
    assert.strictEqual(bodyQueryEq.data.events.items.length, 1);
    assert.strictEqual(bodyQueryEq.data.events.items[0].id, event.id);

    // Query using operator 'in'
    const responseQueryIn = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventsByProfiles($query: EventQueryConditionInput) {
            events(query: $query) {
              items {
                id
                eventName
              }
              totalCount
            }
          }
        `,
        variables: {
          query: {
            field: 'socialMediaAccountProfileId',
            operator: 'in',
            value: [profile.id]
          }
        }
      })
    });

    const bodyQueryIn = await responseQueryIn.json();
    assert.ok(!bodyQueryIn.errors, JSON.stringify(bodyQueryIn.errors));
    assert.strictEqual(bodyQueryIn.data.events.items.length, 1);
    assert.strictEqual(bodyQueryIn.data.events.items[0].id, event.id);

    await db.delete(schedules).where(eq(schedules.id, schedule.id));
    await db.delete(events).where(eq(events.id, event.id));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('14. mySubscriptions pendingExtractionCount', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Create a new social media profile
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      platform: 'instagram',
      accountId: 'test_queue_status_acc',
      username: 'test_queue_status_acc',
      displayName: 'Test Queue Status Acc'
    }).returning();

    // Create active subscription
    const [sub] = await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: profile.id,
    }).returning();

    // Create 3 posts under this profile (2 unextracted, 1 extracted)
    const [post1] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/q_test_post_1',
      content: 'Post 1 Content',
      rawContent: 'Post 1 Content',
      isExtracted: false,
      publishedAt: new Date(),
    }).returning();

    const [post2] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/q_test_post_2',
      content: 'Post 2 Content',
      rawContent: 'Post 2 Content',
      isExtracted: false,
      publishedAt: new Date(),
    }).returning();

    const [post3] = await db.insert(posts).values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/q_test_post_3',
      content: 'Post 3 Content',
      rawContent: 'Post 3 Content',
      isExtracted: true,
      publishedAt: new Date(),
    }).returning();

    // Query pendingExtractionCount
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            mySubscriptions {
              id
              pendingExtractionCount
              account {
                displayName
              }
            }
          }
        `
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    
    // Find our specific subscription
    const foundSub = body.data.mySubscriptions.find((s: any) => s.id === sub.id);
    assert.ok(foundSub, 'Should find subscription we just created');
    assert.strictEqual(foundSub.pendingExtractionCount, 2, 'Pending extraction count should be 2');

    // Clean up
    await db.delete(posts).where(eq(posts.accountId, profile.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('cleanup - delete all created test data', async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'jkt_festivals_31'));
  });
});
