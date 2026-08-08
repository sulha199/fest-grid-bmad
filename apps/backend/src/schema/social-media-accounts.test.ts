import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, subscriptions, socialMediaAccountProfiles, defaultLocationChangeRequests } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';

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

// Setup mock fetch for Geolocation adapter
const fetchMock = mock.method(globalThis, 'fetch', async (url: any) => {
  const urlStr = String(url);
  if (urlStr.includes('/place-details')) {
    return {
      ok: true,
      json: async () => ({
        features: [{
          properties: {
            lat: -6.2088,
            lon: 106.8456,
            formatted: 'Jakarta, Indonesia (PlaceDetails)',
            name: 'Jakarta Park',
            timezone: { name: 'Asia/Jakarta' }
          }
        }]
      })
    };
  }
  return {
    ok: true,
    json: async () => ({
      results: [{
        lat: -6.2088,
        lon: 106.8456,
        formatted: 'Jakarta, Indonesia',
        place_id: 'place123',
        timezone: { name: 'Asia/Jakarta' }
      }]
    })
  };
});

test('setAccountDefaultLocation mutation resolver integration', async (t) => {
  let testUser: any;
  let anotherUser: any;
  let accountProfile1: any;
  let accountProfile2: any;
  let subId1: string;

  t.afterEach(() => {
    fetchMock.mock.resetCalls();
  });

  await t.test('setup - get test users and create account profiles', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    // Clean any old subscriptions or profiles
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, anotherUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'test_profile_1'));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'test_profile_2'));

    // Create 2 test profiles
    const [p1] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test_profile_1',
      platform: 'instagram',
      displayName: 'Test Profile 1',
      username: 'test_profile_1',
      defaultLocation: null,
    }).returning();
    accountProfile1 = p1;

    const [p2] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'test_profile_2',
      platform: 'instagram',
      displayName: 'Test Profile 2',
      username: 'test_profile_2',
      defaultLocation: {
        placeName: 'Existing Default',
        formattedAddress: 'Existing Default Address',
        coordinates: { lat: -6.2, lng: 106.8 }
      } as any,
    }).returning();
    accountProfile2 = p2;

    // Create active subscription for testUser to accountProfile1
    const [sub1] = await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: accountProfile1.id,
    }).returning();
    subId1 = sub1.id;

    // Create active subscription for testUser to accountProfile2 (the one with pre-existing default location)
    await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: accountProfile2.id,
    });
  });

  await t.test('1. requires authentication', async () => {
    mockUser = null;

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfile1.id,
          input: {
            placeId: 'ChIJ59_W2-XzaS4R5aB_WqZ6wU0'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have authentication error');
    assert.equal(body.errors[0].message, 'You must be logged in to perform this action.');
  });

  await t.test('2. rejects with NOT_FOUND when the caller has no active subscription to the account', async () => {
    // Authenticate as anotherUser (who is not subscribed)
    mockUser = { userId: anotherUser.id, role: anotherUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfile1.id,
          input: {
            placeId: 'ChIJ59_W2-XzaS4R5aB_WqZ6wU0'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have error');
    assert.equal(body.errors[0].extensions?.code, 'NOT_FOUND');
    assert.equal(body.errors[0].message, 'Subscription not found');
  });

  await t.test('3. rejects with NOT_FOUND for a non-existent accountId', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: '99999999-9999-9999-9999-999999999999',
          input: {
            placeId: 'ChIJ59_W2-XzaS4R5aB_WqZ6wU0'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have error');
    assert.equal(body.errors[0].extensions?.code, 'NOT_FOUND');
    assert.equal(body.errors[0].message, 'Subscription not found'); // subscription check happens first and is scoped to accountId
  });

  await t.test('4. rejects with INVALID_STATE_TRANSITION when defaultLocation is already set', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfile2.id,
          input: {
            placeId: 'ChIJ59_W2-XzaS4R5aB_WqZ6wU0'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have error');
    assert.equal(body.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
    assert.equal(body.errors[0].message, 'Default location already set');
  });

  await t.test('5. happy path via placeId', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
              defaultLocation {
                coordinates {
                  lat
                  lng
                }
                formattedAddress
                placeName
              }
            }
          }
        `,
        variables: {
          accountId: accountProfile1.id,
          input: {
            placeId: 'some-place-id'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    assert.ok(body.data.setAccountDefaultLocation.defaultLocation, 'Should return defaultLocation');
    assert.equal(body.data.setAccountDefaultLocation.id, accountProfile1.id);
  });

  await t.test('6. happy path via latitude/longitude (re-using profile 1 after clearing its defaultLocation first)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Clear default location first
    await db.update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, accountProfile1.id));

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SetAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            setAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
              defaultLocation {
                coordinates {
                  lat
                  lng
                }
                formattedAddress
                placeName
              }
            }
          }
        `,
        variables: {
          accountId: accountProfile1.id,
          input: {
            latitude: -6.21,
            longitude: 106.84
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    assert.ok(body.data.setAccountDefaultLocation.defaultLocation, 'Should return defaultLocation');
    assert.equal(body.data.setAccountDefaultLocation.id, accountProfile1.id);
  });

  await t.test('cleanup - delete all created test data', async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'test_profile_1'));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'test_profile_2'));
  });
});

test('editAccountDefaultLocation mutation resolver integration', async (t) => {
  let testUser: any;
  let anotherUser: any;
  let accountProfileWithLocation: any;
  let accountProfileNoLocation: any;

  t.afterEach(() => {
    fetchMock.mock.resetCalls();
  });

  await t.test('setup - get test users and create account profiles', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    // Clean any old subscriptions or profiles
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, anotherUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'edit_test_profile_1'));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'edit_test_profile_2'));

    // Create a profile with defaultLocation set
    const [p1] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'edit_test_profile_1',
      platform: 'instagram',
      displayName: 'Edit Profile With Location',
      username: 'edit_test_profile_1',
      defaultLocation: {
        placeName: 'Original Place',
        formattedAddress: 'Original Address',
        coordinates: { lat: -6.2, lng: 106.8 }
      } as any,
    }).returning();
    accountProfileWithLocation = p1;

    // Create a profile with NO defaultLocation set
    const [p2] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'edit_test_profile_2',
      platform: 'instagram',
      displayName: 'Edit Profile No Location',
      username: 'edit_test_profile_2',
      defaultLocation: null,
    }).returning();
    accountProfileNoLocation = p2;

    // Create active subscription for testUser to both profiles
    await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: accountProfileWithLocation.id,
    });

    await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: accountProfileNoLocation.id,
    });
  });

  await t.test('1. requires authentication', async () => {
    mockUser = null;

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation EditAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            editAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfileWithLocation.id,
          input: {
            placeId: 'new-place-id'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have authentication error');
    assert.equal(body.errors[0].message, 'You must be logged in to perform this action.');
  });

  await t.test('2. rejects with NOT_FOUND when caller is not subscribed', async () => {
    mockUser = { userId: anotherUser.id, role: anotherUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation EditAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            editAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfileWithLocation.id,
          input: {
            placeId: 'new-place-id'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have error');
    assert.equal(body.errors[0].extensions?.code, 'NOT_FOUND');
    assert.equal(body.errors[0].message, 'Subscription not found');
  });

  await t.test('3. rejects with INVALID_STATE_TRANSITION when defaultLocation is not yet set', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation EditAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            editAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
            }
          }
        `,
        variables: {
          accountId: accountProfileNoLocation.id,
          input: {
            placeId: 'new-place-id'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(body.errors, 'Should have error');
    assert.equal(body.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
    assert.equal(body.errors[0].message, 'No default location set yet');
  });

  await t.test('4. happy path with placeId and default_location_change_requests logging', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation EditAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            editAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
              defaultLocation {
                coordinates {
                  lat
                  lng
                }
                formattedAddress
                placeName
              }
              hasPendingDefaultLocationReview
            }
          }
        `,
        variables: {
          accountId: accountProfileWithLocation.id,
          input: {
            placeId: 'new-place-id'
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));
    assert.ok(body.data.editAccountDefaultLocation.defaultLocation, 'Should return defaultLocation');
    assert.equal(body.data.editAccountDefaultLocation.hasPendingDefaultLocationReview, true);

    // Verify change requests row
    const changeRequests = await db.select().from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, accountProfileWithLocation.id));
    assert.equal(changeRequests.length, 1);
    assert.equal(changeRequests[0].status, 'PENDING_REVIEW');
    assert.equal((changeRequests[0].previousLocation as any).placeName, 'Original Place');
    assert.equal((changeRequests[0].newLocation as any).formattedAddress, 'Jakarta, Indonesia (PlaceDetails)');
  });

  await t.test('5. allows stacking concurrent edits', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Trigger a second edit
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation EditAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
            editAccountDefaultLocation(accountId: $accountId, input: $input) {
              id
              defaultLocation {
                formattedAddress
              }
            }
          }
        `,
        variables: {
          accountId: accountProfileWithLocation.id,
          input: {
            latitude: -8.4095,
            longitude: 115.1889
          }
        }
      })
    });

    const body = await response.json();
    assert.ok(!body.errors, JSON.stringify(body.errors));

    // Verify multiple requests exist
    const changeRequests = await db.select().from(defaultLocationChangeRequests)
      .where(eq(defaultLocationChangeRequests.accountId, accountProfileWithLocation.id))
      .orderBy(defaultLocationChangeRequests.createdAt);
    assert.equal(changeRequests.length, 2, 'Should have stacked 2 change requests');
  });

  await t.test('cleanup - delete all created test data', async () => {
    await db.delete(defaultLocationChangeRequests).where(eq(defaultLocationChangeRequests.accountId, accountProfileWithLocation.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'edit_test_profile_1'));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.accountId, 'edit_test_profile_2'));
  });
});
