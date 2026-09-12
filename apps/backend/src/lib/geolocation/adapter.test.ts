import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation, getAddressPredictions } from './adapter.js';
import { GeolocationNotFoundError } from './geoapify-client.js';
import { LocationDetails } from '@festgrid/shared-types';
import { db } from '../../db/client.js';
import { geolocationCache } from '@festgrid/database';

const locationDetails: LocationDetails = {
  coordinates: { latitude: 41.8781, longitude: -87.6298 },
  formattedAddress: '123 Main St, Chicago, IL',
  placeId: 'place123',
  timezone: 'America/Chicago',
  provider: 'GEOAPIFY'
};

process.env.GEOAPIFY_API_KEY = 'test-api-key';

test('adapter resolveLocation integration', async (t) => {
  // Clear any pre-existing cache entries before starting integration tests
  await db.delete(geolocationCache);

  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      results: [{
        lat: 41.8781,
        lon: -87.6298,
        formatted: '123 Main St, Chicago, IL',
        place_id: 'place123',
        timezone: { name: 'America/Chicago' }
      }]
    })
  }));

  t.afterEach(async () => {
    fetchMock.mock.resetCalls();
    // clear the cache table
    await db.delete(geolocationCache);
  });

  await t.test('cache miss calls geocodeAddress and writes through', async () => {
    fetchMock.mock.resetCalls();
    const result = await resolveLocation({ kind: 'ADDRESS', address: '123 Main St, Chicago' });
    
    assert.deepEqual(result, locationDetails);
    assert.equal(fetchMock.mock.calls.length, 1);
    
    // Check DB
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 1);
    assert.equal(cachedRows[0].cacheKey, 'geocode:123 main st, chicago|bias:none');
    assert.equal(cachedRows[0].queryType, 'GEOCODE');
  });

  await t.test('cache hit skips Geoapify call', async () => {
    fetchMock.mock.resetCalls();
    // Write manually first to set up hit
    await db.insert(geolocationCache).values({
      cacheKey: 'geocode:123 main st, chicago|bias:none',
      queryType: 'GEOCODE',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: locationDetails as any
    });

    const result = await resolveLocation({ kind: 'ADDRESS', address: '123 Main St, Chicago' });
    
    assert.deepEqual(result, locationDetails);
    assert.equal(fetchMock.mock.calls.length, 0); // Should be 0 since it was cached!
  });

  await t.test('propagates GeolocationNotFoundError unmodified', async () => {
    fetchMock.mock.resetCalls();
    fetchMock.mock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ results: [] })
    }));
    
    await assert.rejects(
      async () => await resolveLocation({ kind: 'ADDRESS', address: 'Unknown' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => err instanceof GeolocationNotFoundError
    );
    
    // Check DB is empty
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 0);
  });
});

test('adapter resolveLocation with countryBias folds bias into cache key', async () => {
  await db.delete(geolocationCache);

  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      results: [{
        lat: 41.8781,
        lon: -87.6298,
        formatted: '123 Main St, Chicago, IL',
        place_id: 'place123',
        timezone: { name: 'America/Chicago' },
        rank: { confidence: 0.9, match_type: 'full_match' },
        country_code: 'us'
      }]
    })
  }));

  try {
    const result = await resolveLocation({ kind: 'ADDRESS', address: '123 Main St, Chicago', countryBias: 'us' });

    assert.equal(result.placeId, 'place123');
    assert.equal(result.confidence, 0.9);
    assert.equal(result.matchType, 'full_match');
    assert.equal(result.countryCode, 'us');

    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 1);
    // Bias is part of the cache identity so a differently-biased account can't be served
    // this cached result (Task 1, Design Decision 3).
    assert.equal(cachedRows[0].cacheKey, 'geocode:123 main st, chicago|bias:us');
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

test('adapter getAddressPredictions', async (t) => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      results: [
        { place_id: 'p1', formatted: 'Result 1' }
      ]
    })
  }));

  t.afterEach(async () => {
    fetchMock.mock.resetCalls();
    await db.delete(geolocationCache);
  });

  await t.test('input below threshold returns empty array immediately', async () => {
    fetchMock.mock.resetCalls();
    const result = await getAddressPredictions('ab');
    assert.deepEqual(result, []);
    assert.equal(fetchMock.mock.calls.length, 0);
    
    // Confirm no cache records
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 0);
  });

  await t.test('input at/above threshold calls client predictions and is not cached', async () => {
    fetchMock.mock.resetCalls();
    const result = await getAddressPredictions('abc');
    assert.deepEqual(result, [{ placeId: 'p1', description: 'Result 1' }]);
    assert.equal(fetchMock.mock.calls.length, 1);
    
    // Assert cache table is NOT written to (AC3)
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 0);
  });
});
