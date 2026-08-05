import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, userLocations } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';

// Read all required schema fragments
const eventsDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/events.graphql'), 'utf-8');
const authDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/auth.graphql'), 'utf-8');
const favDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/favorites-and-calendar.graphql'), 'utf-8');
const locDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/user-locations.graphql'), 'utf-8');

const schema = createSchema({
  typeDefs: `
    ${eventsDefs}
    ${authDefs}
    ${favDefs}
    ${locDefs}
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
  if (urlStr.includes('/autocomplete')) {
    return {
      ok: true,
      json: async () => ({
        results: [
          { place_id: 'place123', formatted: 'Jakarta Autocomplete Suggestion 1' }
        ]
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

test('user locations resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;

  t.afterEach(() => {
    fetchMock.mock.resetCalls();
  });

  await t.test('setup - get test users and clear existing data', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users for cross-user tests');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    await db.delete(userLocations).where(eq(userLocations.userId, testUser.id));
    await db.delete(userLocations).where(eq(userLocations.userId, anotherUser.id));
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
            createUserLocation(input: { name: "Home", address: "Jakarta", radius: 5000 }) {
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
        query: `{ myLocations { id } }`
      })
    });
    const resultQuery = await resQuery.json();
    assert.ok(resultQuery.errors, 'should return error');
    assert.strictEqual(resultQuery.errors[0].extensions?.code, 'UNAUTHENTICATED');

    // Autocomplete unauthenticated
    const resAutocompleteUnauth = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ addressAutocomplete(input: "Jakarta") { placeId description } }`
      })
    });
    const resultAutocompleteUnauth = await resAutocompleteUnauth.json();
    assert.ok(resultAutocompleteUnauth.errors, 'should return error');
    assert.strictEqual(resultAutocompleteUnauth.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('createUserLocation - validation of both address and coordinates', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "Confused",
              address: "Jakarta",
              latitude: -6.2,
              longitude: 106.8,
              radius: 5000
            }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('createUserLocation - validation of radius bounds', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "Out of bounds",
              address: "Jakarta",
              radius: 500
            }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  let createdId: string;

  await t.test('createUserLocation - validation of both address and placeId', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "Confused 2",
              address: "Jakarta",
              placeId: "p123",
              radius: 5000
            }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('createUserLocation - validation of both coordinates and placeId', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "Confused 3",
              latitude: -6.2,
              longitude: 106.8,
              placeId: "p123",
              radius: 5000
            }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('createUserLocation - success (placeId mode)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "My Place",
              placeId: "p123",
              radius: 5000
            }) {
              id
              name
              radius
              locationDetails {
                formattedAddress
                coordinates {
                  lat
                  lng
                }
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.ok(result.data.createUserLocation.id);
    assert.strictEqual(result.data.createUserLocation.name, 'My Place');
    assert.strictEqual(result.data.createUserLocation.locationDetails.formattedAddress, 'Jakarta, Indonesia (PlaceDetails)');
    assert.strictEqual(result.data.createUserLocation.locationDetails.coordinates.lat, -6.2088);
    assert.strictEqual(result.data.createUserLocation.locationDetails.coordinates.lng, 106.8456);

    // Clean up created location to prevent noise in other tests
    await db.delete(userLocations).where(eq(userLocations.id, result.data.createUserLocation.id));
  });

  await t.test('createUserLocation - success (address mode)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createUserLocation(input: {
              name: "My Home",
              address: "Jakarta",
              radius: 5000
            }) {
              id
              name
              radius
              locationDetails {
                formattedAddress
                coordinates {
                  lat
                  lng
                }
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    if (result.errors) {
      console.error('CREATE USER LOCATION ERRORS:', JSON.stringify(result.errors, null, 2));
    }
    assert.ok(!result.errors, 'should not have errors');
    assert.ok(result.data.createUserLocation.id);
    createdId = result.data.createUserLocation.id;
    assert.strictEqual(result.data.createUserLocation.name, 'My Home');
    assert.strictEqual(result.data.createUserLocation.radius, 5000);
    assert.strictEqual(result.data.createUserLocation.locationDetails.formattedAddress, 'Jakarta, Indonesia');
    assert.strictEqual(result.data.createUserLocation.locationDetails.coordinates.lat, -6.2088);
    assert.strictEqual(result.data.createUserLocation.locationDetails.coordinates.lng, 106.8456);
  });

  await t.test('addressAutocomplete - success and input-length guard', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Valid query
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ addressAutocomplete(input: "Jakarta") { placeId description } }`
      })
    });
    const result = await res.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.addressAutocomplete.length, 1);
    assert.strictEqual(result.data.addressAutocomplete[0].placeId, 'place123');
    assert.strictEqual(result.data.addressAutocomplete[0].description, 'Jakarta Autocomplete Suggestion 1');

    // Too short query
    const resShort = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ addressAutocomplete(input: "Ja") { placeId description } }`
      })
    });
    const resultShort = await resShort.json();
    assert.ok(!resultShort.errors);
    assert.strictEqual(resultShort.data.addressAutocomplete.length, 0); // Gracefully returns empty array (AC2)
  });

  await t.test('myLocations query returns sorted items', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          {
            myLocations {
              id
              name
              radius
              locationDetails {
                formattedAddress
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.myLocations.length, 1);
    assert.strictEqual(result.data.myLocations[0].id, createdId);
    assert.strictEqual(result.data.myLocations[0].name, 'My Home');
  });

  await t.test('updateUserLocation - radius only (no re-resolution)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            updateUserLocation(id: "${createdId}", input: {
              radius: 10000
            }) {
              id
              radius
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.updateUserLocation.radius, 10000);
    assert.strictEqual(fetchMock.mock.calls.length, 0, 'No fetch/geolocation should be called when no address/coordinates supplied');
  });

  await t.test('updateUserLocation - cross-user updates are rejected', async () => {
    // Authenticate as another user, try updating testUser's location
    mockUser = { userId: anotherUser.id, role: anotherUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            updateUserLocation(id: "${createdId}", input: {
              name: "Hacked"
            }) {
              id
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('deleteUserLocation - idempotent, cross-user deletes are safe no-ops', async () => {
    // Try to delete testUser's location as anotherUser (should not delete)
    mockUser = { userId: anotherUser.id, role: anotherUser.role };
    const resCross = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { deleteUserLocation(id: "${createdId}") }`
      })
    });
    const resultCross = await resCross.json();
    assert.strictEqual(resultCross.data.deleteUserLocation, true);

    // Verify it still exists for testUser
    mockUser = { userId: testUser.id, role: testUser.role };
    const resVerify = await db.select().from(userLocations).where(eq(userLocations.id, createdId));
    assert.strictEqual(resVerify.length, 1);

    // Delete as owner
    const resOwner = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { deleteUserLocation(id: "${createdId}") }`
      })
    });
    const resultOwner = await resOwner.json();
    assert.strictEqual(resultOwner.data.deleteUserLocation, true);

    // Verify it's gone
    const resVerifyGone = await db.select().from(userLocations).where(eq(userLocations.id, createdId));
    assert.strictEqual(resVerifyGone.length, 0);

    // Delete again (idempotency check)
    const resAgain = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { deleteUserLocation(id: "${createdId}") }`
      })
    });
    const resultAgain = await resAgain.json();
    assert.strictEqual(resultAgain.data.deleteUserLocation, true);
  });
});
