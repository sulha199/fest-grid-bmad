import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { geolocationCache } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// Read all required schema fragments dynamically just like server.ts does
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
  const isPlaceDetails = String(url).includes('place-details');
  if (isPlaceDetails) {
    return {
      ok: true,
      json: async () => ({
        features: [{
          properties: {
            lat: -6.2088,
            lon: 106.8456,
            formatted: 'Jakarta, Indonesia',
            name: 'Jakarta',
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

test('geolocation resolvers integration', async (t) => {
  t.afterEach(() => {
    fetchMock.mock.resetCalls();
  });

  await t.test('unauthenticated calls to previewLocation are rejected', async () => {
    mockUser = null;

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation(latitude: -6.2088, longitude: 106.8456) {
              formattedAddress
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should return error');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('authenticated call to previewLocation returns successfully', async () => {
    mockUser = { userId: 'user-123', role: 'USER' };

    // Let's clear any cache for these coordinates first
    // cache key coordinates rounded to 5 decimal places: reverse:-6.20880,106.84560
    const testCacheKey = 'reverse:-6.20880,106.84560';
    await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, testCacheKey));

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation(latitude: -6.2088, longitude: 106.8456) {
              formattedAddress
              placeName
              provider
              coordinates {
                lat
                lng
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    if (result.errors) {
      console.error('PREVIEW LOCATION ERRORS:', JSON.stringify(result.errors, null, 2));
    }
    assert.ok(!result.errors, 'should not have errors');
    const data = result.data.previewLocation;
    assert.strictEqual(data.formattedAddress, 'Jakarta, Indonesia');
    assert.strictEqual(data.provider, 'GEOAPIFY');
    assert.strictEqual(data.coordinates.lat, -6.2088);
    assert.strictEqual(data.coordinates.lng, 106.8456);
    assert.strictEqual(fetchMock.mock.calls.length, 1, 'Should call Geoapify API once');
  });

  await t.test('repeated calls reuse geolocation cache', async () => {
    mockUser = { userId: 'user-123', role: 'USER' };

    // We make a call first to make sure it's cached (it was cached in the previous test case)
    // Let's run a preview query again
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation(latitude: -6.2088, longitude: 106.8456) {
              formattedAddress
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.previewLocation.formattedAddress, 'Jakarta, Indonesia');
    assert.strictEqual(fetchMock.mock.calls.length, 0, 'Should reuse cache and make 0 fetch calls');
  });

  await t.test('authenticated call with placeId only returns successfully', async () => {
    mockUser = { userId: 'user-123', role: 'USER' };

    // Let's clear cache first for the placeId
    const testCacheKey = 'place:place-456';
    await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, testCacheKey));

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation(placeId: "place-456") {
              formattedAddress
              placeName
              provider
              coordinates {
                lat
                lng
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    if (result.errors) {
      console.error('PREVIEW PLACE_ID ERRORS:', JSON.stringify(result.errors, null, 2));
    }
    assert.ok(!result.errors, 'should not have errors');
    const data = result.data.previewLocation;
    assert.strictEqual(data.formattedAddress, 'Jakarta, Indonesia');
    assert.strictEqual(data.provider, 'GEOAPIFY');
    assert.strictEqual(data.coordinates.lat, -6.2088);
    assert.strictEqual(data.coordinates.lng, 106.8456);
    assert.strictEqual(fetchMock.mock.calls.length, 1, 'Should call Geoapify API once');
  });

  await t.test('call with coordinates AND placeId returns BAD_REQUEST', async () => {
    mockUser = { userId: 'user-123', role: 'USER' };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation(latitude: -6.2088, longitude: 106.8456, placeId: "place-456") {
              formattedAddress
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should return error');
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
    assert.strictEqual(result.errors[0].message, 'Exactly one of coordinates or placeId is required');
  });

  await t.test('call with neither coordinates nor placeId returns BAD_REQUEST', async () => {
    mockUser = { userId: 'user-123', role: 'USER' };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            previewLocation {
              formattedAddress
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should return error');
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
    assert.strictEqual(result.errors[0].message, 'Exactly one of coordinates or placeId is required');
  });
});
