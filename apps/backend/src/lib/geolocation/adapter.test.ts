import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation, getAddressPredictions } from './adapter.js';
import { GeolocationNotFoundError } from './geoapify-client.js';
import { LocationDetails } from '@festgrid/shared-types';
import { db } from '../../db/client.js';
import { geolocationCache } from '@festgrid/database';
import { NOT_FOUND_TTL_MS } from './cache-store.js';

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
    
    // The miss is remembered (see the not-found cache tests below) but nothing that looks like a location is stored.
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 1);
    assert.deepEqual(cachedRows[0].result, { notFound: true });
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

const wrongCityResult = (placeId: string, lat: number, lon: number, confidence: number) => ({
  lat,
  lon,
  formatted: placeId,
  place_id: placeId,
  timezone: { name: 'Asia/Jakarta' },
  rank: { confidence, match_type: 'full_match' },
  country_code: 'id',
});

test('adapter resolveLocation with a proximity point drops far low-confidence candidates and keeps the local one', async () => {
  await db.delete(geolocationCache);
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      results: [
        wrongCityResult('palu', -0.9, 119.87, 0),
        wrongCityResult('pasar-potrojayan', -7.8, 110.5, 0),
        wrongCityResult('new-york', 40.85, -73.86, 0),
      ],
    }),
  }));
  try {
    const result = await resolveLocation({
      kind: 'ADDRESS',
      address: 'Pasar Porosjayan',
      countryBias: 'id',
      proximity: { latitude: -7.72, longitude: 110.35 },
    });
    assert.equal(result.placeId, 'pasar-potrojayan', 'the first-ranked far guess (Palu) no longer wins');
    assert.equal(new URL(fetchMock.mock.calls[0].arguments[0] as string).searchParams.get('bias'), 'countrycode:id|proximity:110.35,-7.72');
    const rows = await db.select().from(geolocationCache);
    assert.equal(rows[0].cacheKey, 'geocode:pasar porosjayan|bias:id|near:-7.7,110.3');
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

test('adapter resolveLocation with a proximity point and only far low-confidence candidates is not found, and remembers that', async () => {
  await db.delete(geolocationCache);
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ results: [wrongCityResult('palu', -0.9, 119.87, 0), wrongCityResult('new-york', 40.85, -73.86, 0)] }),
  }));
  try {
    await assert.rejects(
      () => resolveLocation({ kind: 'ADDRESS', address: 'Pasar Porosjayan', proximity: { latitude: -7.72, longitude: 110.35 } }),
      /far from the account/
    );
    const rows = await db.select().from(geolocationCache);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].result, { notFound: true });
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

test('adapter resolveLocation without a proximity point is unchanged: nothing is filtered', async () => {
  await db.delete(geolocationCache);
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ results: [wrongCityResult('palu', -0.9, 119.87, 0)] }),
  }));
  try {
    const result = await resolveLocation({ kind: 'ADDRESS', address: 'Pasar Porosjayan' });
    assert.equal(result.placeId, 'palu');
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

// Story 0.i7z ratchet — AD-14 Rule 2 / Story 0.i7z AC 2 (re-ranking beats position).
// End-to-end proof that `resolveLocation`'s ADDRESS branch actually calls
// `selectBestCandidate` on real mock candidates (not just that the pure function exists).
test('adapter resolveLocation re-ranks ADDRESS by confidence (BUG-017)', async () => {
  await db.delete(geolocationCache);

  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      results: [
        // Position 0: a generic/low-confidence top hit (the wrong sub-venue).
        {
          lat: -7.7831,
          lon: 110.3854,
          formatted: 'Pakuwon Mall Jogja, Yogyakarta',
          place_id: 'generic_top_hit',
          timezone: { name: 'Asia/Jakarta' },
          rank: { confidence: 0.4, match_type: 'match_by_city_or_district' },
          country_code: 'id'
        },
        // A later, more specific, higher-confidence match: the correct sub-venue.
        {
          lat: -7.7812,
          lon: 110.3839,
          formatted: 'Grand Atrium, Pakuwon Mall Jogja, Yogyakarta',
          place_id: 'correct_subvenue',
          timezone: { name: 'Asia/Jakarta' },
          rank: { confidence: 0.9, match_type: 'match_by_building' },
          country_code: 'id'
        }
      ]
    })
  }));

  try {
    const result = await resolveLocation({ kind: 'ADDRESS', address: 'Grand Atrium, Pakuwon Mall Jogja' });

    // The higher-confidence, later-position candidate wins over the first result.
    assert.equal(result.placeId, 'correct_subvenue');
    assert.equal(result.confidence, 0.9);
    assert.deepEqual(result.coordinates, { latitude: -7.7812, longitude: 110.3839 });

    // The re-ranked candidate is still written through to the cache as today.
    const cachedRows = await db.select().from(geolocationCache);
    assert.equal(cachedRows.length, 1);
    assert.equal(cachedRows[0].queryType, 'GEOCODE');
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

// "Not found" is cached for a day (a flyer's "Berbagai lokasi di Kabupaten Sleman" never resolves; a re-extract Apply geocoded it
// once per schedule and outlasted the API Lambda's 28 s).
test('adapter resolveLocation remembers "not found" and does not call Geoapify again for the same query', async () => {
  await db.delete(geolocationCache);
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [] }) }));
  try {
    const query = { kind: 'ADDRESS' as const, address: 'Berbagai lokasi di Kabupaten Sleman', countryBias: 'id' };
    await assert.rejects(() => resolveLocation(query), (err: unknown) => err instanceof GeolocationNotFoundError);
    assert.equal(fetchMock.mock.callCount(), 1);

    await assert.rejects(() => resolveLocation(query), (err: unknown) => err instanceof GeolocationNotFoundError);
    await assert.rejects(() => resolveLocation({ ...query, address: ' BERBAGAI LOKASI di Kabupaten Sleman ' }), (err: unknown) => err instanceof GeolocationNotFoundError);
    assert.equal(fetchMock.mock.callCount(), 1, 'repeats (and a spelling that normalizes to the same key) are served from the cache');

    // A different query is not affected.
    await assert.rejects(() => resolveLocation({ ...query, address: 'Somewhere else' }), (err: unknown) => err instanceof GeolocationNotFoundError);
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

test('adapter resolveLocation retries a "not found" older than the cache window, and a later hit replaces it', async () => {
  await db.delete(geolocationCache);
  let found = false;
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ results: found ? [{ lat: -7.72, lon: 110.35, formatted: 'Pasar', place_id: 'pasar-1', timezone: { name: 'Asia/Jakarta' } }] : [] }),
  }));
  try {
    const query = { kind: 'ADDRESS' as const, address: 'Pasar Porosjayan' };
    await assert.rejects(() => resolveLocation(query), (err: unknown) => err instanceof GeolocationNotFoundError);

    // Age the stored miss past the window: the next call asks Geoapify again.
    await db.update(geolocationCache).set({ updatedAt: new Date(Date.now() - NOT_FOUND_TTL_MS - 60_000) });
    found = true;
    const result = await resolveLocation(query);
    assert.equal(result.placeId, 'pasar-1');
    assert.equal(fetchMock.mock.callCount(), 2);

    // The hit replaced the miss and is served from the cache from then on.
    assert.equal((await resolveLocation(query)).placeId, 'pasar-1');
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal((await db.select().from(geolocationCache)).length, 1);
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});

test('adapter resolveLocation does not remember an outage: a failure that is not "not found" is retried', async () => {
  await db.delete(geolocationCache);
  let down = true;
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    if (down) return { ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) };
    return { ok: true, json: async () => ({ results: [{ lat: 1, lon: 2, formatted: 'X', place_id: 'x', timezone: { name: 'Asia/Jakarta' } }] }) };
  });
  try {
    const query = { kind: 'ADDRESS' as const, address: 'Pasar Porosjayan' };
    await assert.rejects(() => resolveLocation(query), (err: unknown) => !(err instanceof GeolocationNotFoundError));
    assert.equal((await db.select().from(geolocationCache)).length, 0, 'an outage leaves no cache row');

    down = false;
    assert.equal((await resolveLocation(query)).placeId, 'x');
  } finally {
    fetchMock.mock.restore();
    await db.delete(geolocationCache);
  }
});
