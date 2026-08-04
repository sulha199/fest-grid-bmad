import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation } from './adapter.js';
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
    assert.equal(cachedRows[0].cacheKey, 'geocode:123 main st, chicago');
    assert.equal(cachedRows[0].queryType, 'GEOCODE');
  });

  await t.test('cache hit skips Geoapify call', async () => {
    fetchMock.mock.resetCalls();
    // Write manually first to set up hit
    await db.insert(geolocationCache).values({
      cacheKey: 'geocode:123 main st, chicago',
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
