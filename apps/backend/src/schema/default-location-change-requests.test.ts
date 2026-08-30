import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, socialMediaAccountProfiles, defaultLocationChangeRequests } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';

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

test('default location change requests resolver integration', async (t) => {
  let regularUser: any;
  let moderatorUser: any;
  let testAccount: any;

  await t.test('setup - seed users and account profile', async () => {
    // Insert test users
    const [user1] = await db.insert(users).values({
      email: `requester-${Date.now()}@test.com`,
      name: 'Requester',
      role: 'user',
    }).returning();
    regularUser = user1;

    const [mod] = await db.insert(users).values({
      email: `mod-loc-${Date.now()}@test.com`,
      name: 'Moderator Loc',
      role: 'moderator',
    }).returning();
    moderatorUser = mod;

    // Insert account profile
    const [insertedAccount] = await db.insert(socialMediaAccountProfiles).values({
      platform: 'instagram',
      accountId: `acc-${Date.now()}`,
      displayName: 'Test Subscribed Account',
      username: 'test_sub',
      defaultLocation: {
        coordinates: { latitude: -6.2, longitude: 106.81 },
        placeName: 'Jakarta, ID',
        formattedAddress: 'Jakarta, Indonesia',
      },
    }).returning();
    testAccount = insertedAccount;
  });

  await t.test('pendingDefaultLocationChanges - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PendingDefaultLocationChanges {
            pendingDefaultLocationChanges {
              id
            }
          }
        `,
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  let firstRequestId: string;

  await t.test('pendingDefaultLocationChanges - moderator query works', async () => {
    // Manually insert a pending location change request
    const [newRequest] = await db.insert(defaultLocationChangeRequests).values({
      accountId: testAccount.id,
      changedByUserId: regularUser.id,
      previousLocation: {
        coordinates: { latitude: -6.2, longitude: 106.81 },
        placeName: 'Jakarta, ID',
        formattedAddress: 'Jakarta, Indonesia',
      },
      newLocation: {
        coordinates: { latitude: -6.17, longitude: 106.82 },
        placeName: 'Monas, ID',
        formattedAddress: 'Monumen Nasional, Jakarta, Indonesia',
      },
      status: 'PENDING_REVIEW',
    }).returning();
    firstRequestId = newRequest.id;

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PendingDefaultLocationChanges {
            pendingDefaultLocationChanges {
              id
              accountId
              status
              account {
                id
                displayName
                username
              }
              previousLocation {
                coordinates {
                  lat
                  lng
                }
                placeName
              }
              newLocation {
                coordinates {
                  lat
                  lng
                }
                placeName
              }
            }
          }
        `,
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const requests = result.data.pendingDefaultLocationChanges;
    const ownRequests = requests.filter((r: any) => r.accountId === testAccount.id);
    assert.strictEqual(ownRequests.length, 1);
    const req = ownRequests[0];
    assert.strictEqual(req.id, firstRequestId);
    assert.strictEqual(req.status, 'PENDING_REVIEW');
    assert.strictEqual(req.account.id, testAccount.id);
    assert.strictEqual(req.account.displayName, 'Test Subscribed Account');
    assert.strictEqual(req.previousLocation.placeName, 'Jakarta, ID');
    assert.strictEqual(req.newLocation.placeName, 'Monas, ID');
  });

  await t.test('resolveDefaultLocationChange - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
            resolveDefaultLocationChange(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: firstRequestId, action: 'ACCEPT' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('resolveDefaultLocationChange - ACCEPT flow', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
            resolveDefaultLocationChange(id: $id, action: $action) {
              id
              status
              reviewedByModeratorId
              reviewedAt
            }
          }
        `,
        variables: { id: firstRequestId, action: 'ACCEPT' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const req = result.data.resolveDefaultLocationChange;
    assert.strictEqual(req.status, 'ACCEPTED');
    assert.strictEqual(req.reviewedByModeratorId, moderatorUser.id);
    assert.ok(req.reviewedAt);

    // Verify account profile location remains unchanged (the change was already applied at edit-time)
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual((profile.defaultLocation as any).placeName, 'Jakarta, ID'); // wait, in our mock we had Jakarta, ID. Wait, the ACCEPT mut does not write to profile. Correct.
  });

  await t.test('resolveDefaultLocationChange - already resolved throws INVALID_STATE_TRANSITION', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
            resolveDefaultLocationChange(id: $id, action: $action) {
              id
            }
          }
        `,
        variables: { id: firstRequestId, action: 'REVERT' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('resolveDefaultLocationChange - REVERT flow', async () => {
    // Create a new pending request on testAccount
    const [newRequest] = await db.insert(defaultLocationChangeRequests).values({
      accountId: testAccount.id,
      changedByUserId: regularUser.id,
      previousLocation: {
        coordinates: { latitude: -6.2, longitude: 106.81 },
        placeName: 'Jakarta, ID',
        formattedAddress: 'Jakarta, Indonesia',
      },
      newLocation: {
        coordinates: { latitude: -6.17, longitude: 106.82 },
        placeName: 'Monas, ID',
        formattedAddress: 'Monumen Nasional, Jakarta, Indonesia',
      },
      status: 'PENDING_REVIEW',
    }).returning();

    // Revert it
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
            resolveDefaultLocationChange(id: $id, action: $action) {
              id
              status
            }
          }
        `,
        variables: { id: newRequest.id, action: 'REVERT' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.resolveDefaultLocationChange.status, 'REVERTED');

    // Verify account profile location is rewritten back to previousLocation (Jakarta, ID)
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual((profile.defaultLocation as any).placeName, 'Jakarta, ID');
  });

  await t.test('resolveDefaultLocationChange - REVERT AI_INFERENCE with null previousLocation', async () => {
    // Set a dummy defaultLocation first
    await db.update(socialMediaAccountProfiles)
      .set({
        defaultLocation: {
          placeName: 'Inferred Place',
          formattedAddress: 'Inferred Place Address',
          coordinates: { latitude: 0, longitude: 0 }
        }
      })
      .where(eq(socialMediaAccountProfiles.id, testAccount.id));

    // Create a new pending AI_INFERENCE request with previousLocation: null
    const [aiRequest] = await db.insert(defaultLocationChangeRequests).values({
      accountId: testAccount.id,
      changedByUserId: null,
      changeSource: 'AI_INFERENCE',
      previousLocation: null,
      newLocation: {
        coordinates: { latitude: -6.17, longitude: 106.82 },
        placeName: 'Inferred Place',
        formattedAddress: 'Inferred Place, Jakarta, Indonesia',
      },
      status: 'PENDING_REVIEW',
    }).returning();

    // Revert it
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveDefaultLocationChange($id: ID!, $action: DefaultLocationChangeAction!) {
            resolveDefaultLocationChange(id: $id, action: $action) {
              id
              status
            }
          }
        `,
        variables: { id: aiRequest.id, action: 'REVERT' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.resolveDefaultLocationChange.status, 'REVERTED');

    // Verify account profile location is reverted back to null
    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual(profile.defaultLocation, null);
  });

  await t.test('pendingDefaultLocationChanges - query request with MODERATOR change source', async () => {
    // Insert a pending request with changeSource: 'MODERATOR'
    const [modRequest] = await db.insert(defaultLocationChangeRequests).values({
      accountId: testAccount.id,
      changedByUserId: moderatorUser.id,
      changeSource: 'MODERATOR',
      previousLocation: {
        coordinates: { latitude: -6.2, longitude: 106.81 },
        placeName: 'Jakarta, ID',
        formattedAddress: 'Jakarta, Indonesia',
      },
      newLocation: {
        coordinates: { latitude: -6.17, longitude: 106.82 },
        placeName: 'Monas, ID',
        formattedAddress: 'Monumen Nasional, Jakarta, Indonesia',
      },
      status: 'PENDING_REVIEW',
    }).returning();

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PendingDefaultLocationChanges {
            pendingDefaultLocationChanges {
              id
              changeSource
            }
          }
        `,
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const requests = result.data.pendingDefaultLocationChanges;
    const req = requests.find((r: any) => r.id === modRequest.id);
    assert.ok(req, 'Expected to find the created request');
    assert.strictEqual(req.changeSource, 'MODERATOR');
  });

  await t.test('cleanup', async () => {
    await db.delete(defaultLocationChangeRequests).where(eq(defaultLocationChangeRequests.accountId, testAccount.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    await db.delete(users).where(inArray(users.id, [regularUser.id, moderatorUser.id]));
  });
});
