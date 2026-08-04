import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { 
  geocodeAddress, 
  reverseGeocode, 
  getPlaceDetails, 
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
