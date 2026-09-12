import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { 
  geocodeAddress, 
  reverseGeocode, 
  getPlaceDetails, 
  getAddressPredictions,
  GeolocationNotFoundError, 
  GeolocationApiError 
} from './geoapify-client.js';

process.env.GEOAPIFY_API_KEY = 'test-api-key';

test('geoapify-client geocodeAddress success returns array of candidates', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: [{
          lat: 41.8781,
          lon: -87.6298,
          formatted: '123 Main St, Chicago, IL',
          place_id: 'place123',
          timezone: { name: 'America/Chicago' },
          rank: { confidence: 0.95, match_type: 'full_match' },
          country_code: 'us'
        }]
      })
    };
  });

  const result = await geocodeAddress('123 Main St, Chicago');
  
  assert.equal(fetchMock.mock.calls.length, 1);
  const url = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(url.includes('api.geoapify.com/v1/geocode/search'));
  assert.ok(url.includes('text=123%20Main%20St%2C%20Chicago'));
  // geocodeAddress requests up to 5 candidates for Story 0.i7b re-ranking.
  assert.ok(url.includes('limit=5'));
  // No countryBias passed -> no bias parameter (preserves default countrycode:auto).
  assert.ok(!url.includes('bias='));

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY',
    confidence: 0.95,
    matchType: 'full_match',
    countryCode: 'us'
  });
  
  fetchMock.mock.restore();
});

test('geoapify-client geocodeAddress retains all candidates each with independent confidence/matchType', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            lat: 50.8503, lon: 4.3517, formatted: 'Main Sq, Brussels', place_id: 'p1',
            timezone: { name: 'Europe/Brussels' },
            rank: { confidence: 0.9, match_type: 'full_match' }, country_code: 'be'
          },
          {
            lat: 52.5200, lon: 13.4050, formatted: 'Main Sq, Berlin', place_id: 'p2',
            timezone: { name: 'Europe/Berlin' },
            rank: { confidence: 0.72, match_type: 'postcode_match' }, country_code: 'de'
          },
          {
            lat: 51.5074, lon: -0.1278, formatted: 'Main Sq, London', place_id: 'p3',
            timezone: { name: 'Europe/London' },
            rank: { confidence: 0.4, match_type: 'city_match' }, country_code: 'gb'
          }
        ]
      })
    };
  });

  const result = await geocodeAddress('Main Square');
  assert.equal(result.length, 3);
  // Each candidate carries its own confidence/matchType/countryCode, independently.
  assert.deepEqual(result[0].confidence, 0.9);
  assert.deepEqual(result[0].matchType, 'full_match');
  assert.deepEqual(result[0].countryCode, 'be');
  assert.deepEqual(result[1].confidence, 0.72);
  assert.deepEqual(result[1].matchType, 'postcode_match');
  assert.deepEqual(result[1].countryCode, 'de');
  assert.deepEqual(result[2].confidence, 0.4);
  assert.deepEqual(result[2].matchType, 'city_match');
  assert.deepEqual(result[2].countryCode, 'gb');

  fetchMock.mock.restore();
});

test('geoapify-client geocodeAddress retains only the top 5 candidates for >5 results', async () => {
  const results = Array.from({ length: 8 }, (_, i) => ({
    lat: 10 + i, lon: 20 + i, formatted: `Loc ${i}`, place_id: `p${i}`,
    timezone: { name: 'UTC' },
    rank: { confidence: 1 - i / 10, match_type: 'match' },
    country_code: 'aa'
  }));
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return { ok: true, json: async () => ({ results }) };
  });

  const result = await geocodeAddress('Somewhere');
  assert.equal(result.length, 5);
  assert.equal(result[0].placeId, 'p0');
  assert.equal(result[4].placeId, 'p4');
  // Candidate beyond the top 5 is discarded.
  assert.ok(!result.some((r) => r.placeId === 'p5'));

  fetchMock.mock.restore();
});

test('geoapify-client geocodeAddress adds bias=countrycode only when countryBias is passed', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: [{
          lat: 41.8781, lon: -87.6298, formatted: '123 Main St', place_id: 'place123',
          timezone: { name: 'America/Chicago' },
          rank: { confidence: 0.9, match_type: 'full_match' }, country_code: 'us'
        }]
      })
    };
  });

  await geocodeAddress('123 Main St', { countryBias: 'us' });
  const withBiasUrl = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(withBiasUrl.includes('bias=countrycode:us'));

  fetchMock.mock.resetCalls();
  await geocodeAddress('123 Main St');
  const withoutBiasUrl = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(!withoutBiasUrl.includes('bias='));

  fetchMock.mock.restore();
});

test('geoapify-client geocodeAddress empty results throws GeolocationNotFoundError', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({ results: [] })
    };
  });

  await assert.rejects(
    async () => await geocodeAddress('Unknown Place'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => err instanceof GeolocationNotFoundError
  );
  
  fetchMock.mock.restore();
});

test('geoapify-client reverseGeocode success', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: [{
          lat: 41.8781,
          lon: -87.6298,
          formatted: '123 Main St, Chicago, IL',
          place_id: 'place123',
          timezone: { name: 'America/Chicago' },
          rank: { confidence: 0.88, match_type: 'full_match' },
          country_code: 'us'
        }]
      })
    };
  });

  const result = await reverseGeocode({ latitude: 41.8781, longitude: -87.6298 });
  
  assert.deepEqual(result, {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY',
    confidence: 0.88,
    matchType: 'full_match',
    countryCode: 'us'
  });
  
  fetchMock.mock.restore();
});

test('geoapify-client getPlaceDetails success', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        features: [{
          properties: {
            lat: 41.8781,
            lon: -87.6298,
            formatted: '123 Main St, Chicago, IL',
            name: 'Main St Park',
            timezone: { name: 'America/Chicago' },
            country_code: 'us'
          }
        }]
      })
    };
  });

  const result = await getPlaceDetails('place123');
  
  assert.deepEqual(result, {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    placeName: 'Main St Park',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY',
    // Place Details has no `rank`; synthetic confidence convention (Design Decision 2).
    confidence: 1,
    matchType: 'PLACE_ID_EXACT',
    countryCode: 'us'
  });
  
  fetchMock.mock.restore();
});

test('geoapify-client getPlaceDetails omits countryCode when properties.country_code absent', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        features: [{
          properties: {
            lat: 41.8781,
            lon: -87.6298,
            formatted: '123 Main St, Chicago, IL',
            name: 'Main St Park',
            timezone: { name: 'America/Chicago' }
            // No country_code — treated defensively as optional, like city/province.
          }
        }]
      })
    };
  });

  const result = await getPlaceDetails('place123');
  assert.deepEqual(result, {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    placeName: 'Main St Park',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY',
    confidence: 1,
    matchType: 'PLACE_ID_EXACT'
  });
  // countryCode key must not exist at all (undefined would break deepEqual).
  assert.equal('countryCode' in result, false);

  fetchMock.mock.restore();
});

test('geoapify-client non-2xx throws GeolocationApiError', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: false,
      status: 401
    };
  });

  await assert.rejects(
    async () => await getPlaceDetails('place123'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => err instanceof GeolocationApiError && err.status === 401
  );
  
  fetchMock.mock.restore();
});

test('geoapify-client getAddressPredictions success with multi-result response', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: [
          { place_id: 'p1', formatted: 'Location 1' },
          { place_id: 'p2', formatted: 'Location 2' }
        ]
      })
    };
  });

  const results = await getAddressPredictions('Test Input');
  assert.equal(fetchMock.mock.calls.length, 1);
  const url = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(url.includes('api.geoapify.com/v1/geocode/autocomplete'));
  assert.ok(url.includes('text=Test%20Input'));
  assert.ok(url.includes('limit=5'));

  assert.deepEqual(results, [
    { placeId: 'p1', description: 'Location 1' },
    { placeId: 'p2', description: 'Location 2' }
  ]);

  fetchMock.mock.restore();
});

test('geoapify-client getAddressPredictions success with empty results', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: true,
      json: async () => ({
        results: []
      })
    };
  });

  const results = await getAddressPredictions('Test Input');
  assert.deepEqual(results, []);

  fetchMock.mock.restore();
});

test('geoapify-client getAddressPredictions non-2xx throws GeolocationApiError', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
      ok: false,
      status: 500
    };
  });

  await assert.rejects(
    async () => await getAddressPredictions('Test Input'),
    (err: any) => err instanceof GeolocationApiError && err.status === 500
  );

  fetchMock.mock.restore();
});
