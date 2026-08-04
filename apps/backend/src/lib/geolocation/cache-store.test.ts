import test from 'node:test';
import assert from 'node:assert/strict';
import { getCached, setCached } from './cache-store.js';
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
