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

test('geoapify-client geocodeAddress success', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return {
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
    };
  });

  const result = await geocodeAddress('123 Main St, Chicago');
  
  assert.equal(fetchMock.mock.calls.length, 1);
  const url = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(url.includes('api.geoapify.com/v1/geocode/search'));
  assert.ok(url.includes('text=123%20Main%20St%2C%20Chicago'));
  
  assert.deepEqual(result, {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY'
  });
  
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
          timezone: { name: 'America/Chicago' }
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
    provider: 'GEOAPIFY'
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
            timezone: { name: 'America/Chicago' }
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
    provider: 'GEOAPIFY'
  });
  
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
