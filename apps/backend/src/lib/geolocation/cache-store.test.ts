import test from 'node:test';
import assert from 'node:assert/strict';
import { NOT_FOUND_TTL_MS, getCacheEntry, getCached, setCached, setCachedNotFound } from './cache-store.js';
import { db } from '../../db/client.js';
import { geolocationCache } from '@festgrid/database';
import { LocationDetails } from '@festgrid/shared-types';
import { eq } from 'drizzle-orm';

test('geolocation cache-store', async (t) => {
  const cacheKey = 'test-cache-key-123';
  
  // Clean up any existing data first
  await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, cacheKey));

  await t.test('getCached returns null on miss', async () => {
    const result = await getCached(cacheKey);
    assert.equal(result, null);
  });

  const locationDetails: LocationDetails = {
    coordinates: { latitude: 41.8781, longitude: -87.6298 },
    formattedAddress: '123 Main St, Chicago, IL',
    placeId: 'place123',
    timezone: 'America/Chicago',
    provider: 'GEOAPIFY'
  };

  await t.test('setCached and getCached round-trip', async () => {
    await setCached(cacheKey, 'GEOCODE', locationDetails);
    
    const result = await getCached(cacheKey);
    assert.deepEqual(result, locationDetails);
  });

  await t.test('setCached updates on conflict', async () => {
    const updatedDetails: LocationDetails = {
      ...locationDetails,
      formattedAddress: '456 Updated St, Chicago, IL'
    };
    
    await setCached(cacheKey, 'GEOCODE', updatedDetails);
    
    const result = await getCached(cacheKey);
    assert.deepEqual(result, updatedDetails);
    
    // Check we haven't duplicated the row
    const countQuery = await db
      .select({ count: geolocationCache.id })
      .from(geolocationCache)
      .where(eq(geolocationCache.cacheKey, cacheKey));
    
    assert.equal(countQuery.length, 1);
  });
  
  // Cleanup after tests
  await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, cacheKey));
});

test('geolocation cache-store: "not found" entries', async (t) => {
  const key = 'test-not-found-key-456';
  await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, key));
  t.after(async () => {
    await db.delete(geolocationCache).where(eq(geolocationCache.cacheKey, key));
  });

  await t.test('a fresh "not found" is returned by getCacheEntry and reads as a miss through getCached', async () => {
    await setCachedNotFound(key, 'GEOCODE');
    assert.deepEqual(await getCacheEntry(key), { kind: 'not-found' });
    assert.equal(await getCached(key), null);
  });

  await t.test('a "not found" past the window is a miss', async () => {
    await db.update(geolocationCache).set({ updatedAt: new Date(Date.now() - NOT_FOUND_TTL_MS - 1000) }).where(eq(geolocationCache.cacheKey, key));
    assert.equal(await getCacheEntry(key), null);
    // Boundary: the clock can be injected.
    const row = await db.query.geolocationCache.findFirst({ where: eq(geolocationCache.cacheKey, key) });
    assert.ok(row);
    assert.deepEqual(await getCacheEntry(key, new Date(row.updatedAt.getTime() + NOT_FOUND_TTL_MS - 1)), { kind: 'not-found' });
    assert.equal(await getCacheEntry(key, new Date(row.updatedAt.getTime() + NOT_FOUND_TTL_MS)), null);
  });

  await t.test('a location replaces a "not found" and a "not found" replaces a location (one row)', async () => {
    const details: LocationDetails = { coordinates: { latitude: 1, longitude: 2 }, formattedAddress: 'X', placeId: 'x', provider: 'GEOAPIFY' };
    await setCached(key, 'GEOCODE', details);
    assert.deepEqual(await getCacheEntry(key), { kind: 'hit', location: details });
    await setCachedNotFound(key, 'GEOCODE');
    assert.deepEqual(await getCacheEntry(key), { kind: 'not-found' });
    assert.equal((await db.select().from(geolocationCache).where(eq(geolocationCache.cacheKey, key))).length, 1);
  });
});
