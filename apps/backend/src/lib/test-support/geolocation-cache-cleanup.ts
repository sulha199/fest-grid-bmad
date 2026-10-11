import { after, before } from 'node:test';
import { inArray } from 'drizzle-orm';
import { geolocationCache } from '@festgrid/database';
import { db } from '../../db/client.js';

// Test-only helper for the row-count ratchet (Story 0.51). Resolvers that geocode (previewLocation,
// set/editAccountDefaultLocation, createUserLocation, ...) write `geolocation_cache` rows keyed by
// the looked-up coordinates/place id, which a test cannot enumerate up front. Register this once at
// the top of a test file: it snapshots the existing cache keys before the file's tests and removes
// only the keys created since, after them -- never a row that was already there (dev DBs keep real cache).
export function registerGeolocationCacheCleanup(): void {
  let existingKeys = new Set<string>();

  before(async () => {
    const rows = await db.select({ cacheKey: geolocationCache.cacheKey }).from(geolocationCache);
    existingKeys = new Set(rows.map((row) => row.cacheKey));
  });

  after(async () => {
    const rows = await db.select({ cacheKey: geolocationCache.cacheKey }).from(geolocationCache);
    const created = rows.map((row) => row.cacheKey).filter((key) => !existingKeys.has(key));
    if (created.length > 0) {
      await db.delete(geolocationCache).where(inArray(geolocationCache.cacheKey, created));
    }
  });
}
