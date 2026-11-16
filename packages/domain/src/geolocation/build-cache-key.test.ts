import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationCacheKey } from './build-cache-key.js';
import { GeolocationQuery } from './types.js';

test('buildLocationCacheKey normalizes ADDRESS query', () => {
  const query1: GeolocationQuery = { kind: 'ADDRESS', address: '  123  Main St, Chicago ' };
  const query2: GeolocationQuery = { kind: 'ADDRESS', address: '123 MAIN st, chicago' };
  
  const key1 = buildLocationCacheKey(query1);
  const key2 = buildLocationCacheKey(query2);
  
  assert.equal(key1, 'geocode:123 main st, chicago|filter:none');
  assert.equal(key2, 'geocode:123 main st, chicago|filter:none');
  assert.equal(key1, key2);
});

test('buildLocationCacheKey folds countryFilter into the ADDRESS key', () => {
  const noBias: GeolocationQuery = { kind: 'ADDRESS', address: 'Main Square' };
  const usBias: GeolocationQuery = { kind: 'ADDRESS', address: 'Main Square', countryFilter: 'us' };
  const deBias: GeolocationQuery = { kind: 'ADDRESS', address: 'Main Square', countryFilter: 'de' };

  assert.equal(buildLocationCacheKey(noBias), 'geocode:main square|filter:none');
  assert.equal(buildLocationCacheKey(usBias), 'geocode:main square|filter:us');
  // A proximity point joins the identity, rounded to 0.1 degree; without one the key is unchanged (existing cache entries stay valid).
  const near = buildLocationCacheKey({ kind: 'ADDRESS', address: 'Main Square', countryFilter: 'id', proximity: { latitude: -7.7234, longitude: 110.3512 } });
  assert.equal(near, 'geocode:main square|filter:id|near:-7.7,110.4');
  const sameTown = buildLocationCacheKey({ kind: 'ADDRESS', address: 'Main Square', countryFilter: 'id', proximity: { latitude: -7.69, longitude: 110.36 } });
  assert.equal(sameTown, near, 'accounts of one town share an entry');
  const elsewhere = buildLocationCacheKey({ kind: 'ADDRESS', address: 'Main Square', countryFilter: 'id', proximity: { latitude: -6.2, longitude: 106.8 } });
  assert.notEqual(elsewhere, near);
  assert.equal(buildLocationCacheKey(deBias), 'geocode:main square|filter:de');

  // Identical address with different country filters MUST NOT share a cache entry.
  assert.notEqual(buildLocationCacheKey(usBias), buildLocationCacheKey(deBias));
  // The filter code is lower-cased so "US" and "us" are one entry.
  assert.equal(buildLocationCacheKey({ kind: 'ADDRESS', address: '  MAIN  SQUARE ', countryFilter: 'US' }), 'geocode:main square|filter:us');
});

test('buildLocationCacheKey uses verbatim PLACE_ID query', () => {
  const query: GeolocationQuery = { kind: 'PLACE_ID', placeId: 'SomeCaseSensitiveId123' };
  const key = buildLocationCacheKey(query);
  assert.equal(key, 'place:SomeCaseSensitiveId123');
});

test('buildLocationCacheKey rounds COORDINATES to 5 decimal places', () => {
  // Test inside the rounding window
  const query1: GeolocationQuery = { kind: 'COORDINATES', coordinates: { latitude: 41.878114, longitude: -87.629798 } };
  const query2: GeolocationQuery = { kind: 'COORDINATES', coordinates: { latitude: 41.8781141, longitude: -87.6297982 } };
  
  const key1 = buildLocationCacheKey(query1);
  const key2 = buildLocationCacheKey(query2);
  
  assert.equal(key1, 'reverse:41.87811,-87.62980');
  assert.equal(key1, key2);

  // Test outside the rounding window
  const query3: GeolocationQuery = { kind: 'COORDINATES', coordinates: { latitude: 41.87811, longitude: -87.62979 } };
  const query4: GeolocationQuery = { kind: 'COORDINATES', coordinates: { latitude: 41.87816, longitude: -87.62979 } };
  
  const key3 = buildLocationCacheKey(query3);
  const key4 = buildLocationCacheKey(query4);
  
  assert.equal(key3, 'reverse:41.87811,-87.62979');
  assert.equal(key4, 'reverse:41.87816,-87.62979');
  assert.notEqual(key3, key4);
});

test('buildLocationCacheKey namespaces do not collide', () => {
  const addressQuery: GeolocationQuery = { kind: 'ADDRESS', address: '41.87811,-87.62980' };
  const coordQuery: GeolocationQuery = { kind: 'COORDINATES', coordinates: { latitude: 41.87811, longitude: -87.62980 } };
  const placeQuery: GeolocationQuery = { kind: 'PLACE_ID', placeId: '41.87811,-87.62980' };

  const addressKey = buildLocationCacheKey(addressQuery);
  const coordKey = buildLocationCacheKey(coordQuery);
  const placeKey = buildLocationCacheKey(placeQuery);

  assert.notEqual(addressKey, coordKey);
  assert.notEqual(addressKey, placeKey);
  assert.notEqual(coordKey, placeKey);
});

test('buildLocationCacheKey throws for unknown kind', () => {
  assert.throws(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildLocationCacheKey({ kind: 'UNKNOWN', unknown: true } as any);
  }, /Unhandled query kind: UNKNOWN/);
});
