import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { geolocationCache } from '@festgrid/database';
import { LocationDetails } from '@festgrid/shared-types';

export type GeolocationQueryType = 'GEOCODE' | 'REVERSE_GEOCODE' | 'PLACE_DETAILS';

/**
 * How long a "not found" answer is reused. A phrase such as "Berbagai lokasi di Kabupaten Sleman" (the model's summary of a poster
 * that lists a different place per date) never resolves, and without this every schedule paid a fresh Geoapify round trip for it
 * (a re-extract of that post took longer than the API Lambda's 28 s). Positive entries never expire; a negative one does, so a
 * place the geocoder learns about later (or a transient miss) is retried the next day.
 */
export const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Stored in the existing `result` column in place of a `LocationDetails` (no schema change): a real result always has
 * `coordinates`, this has only the flag, and its freshness is the row's `updatedAt`.
 */
const NOT_FOUND_MARKER = { notFound: true } as const;

export type GeolocationCacheEntry = { kind: 'hit'; location: LocationDetails } | { kind: 'not-found' };

function isNotFoundMarker(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { notFound?: unknown }).notFound === true;
}

/** The cached answer for a key: a location, a still-fresh "not found", or nothing (a miss, or an expired "not found"). */
export async function getCacheEntry(cacheKey: string, now: Date = new Date()): Promise<GeolocationCacheEntry | null> {
  const row = await db.query.geolocationCache.findFirst({
    where: eq(geolocationCache.cacheKey, cacheKey),
  });

  if (!row) {
    return null;
  }

  if (isNotFoundMarker(row.result)) {
    return now.getTime() - row.updatedAt.getTime() < NOT_FOUND_TTL_MS ? { kind: 'not-found' } : null;
  }

  return { kind: 'hit', location: row.result as LocationDetails };
}

/** The cached location, or null on a miss. A cached "not found" counts as a miss here: callers that can use it call `getCacheEntry`. */
export async function getCached(cacheKey: string): Promise<LocationDetails | null> {
  const entry = await getCacheEntry(cacheKey);
  return entry?.kind === 'hit' ? entry.location : null;
}

async function upsert(cacheKey: string, queryType: GeolocationQueryType, payload: unknown): Promise<void> {
  await db
    .insert(geolocationCache)
    .values({ cacheKey, queryType, result: payload })
    .onConflictDoUpdate({
      target: geolocationCache.cacheKey,
      set: {
        queryType,
        result: payload,
        updatedAt: new Date(),
      },
    });
}

export async function setCached(cacheKey: string, queryType: GeolocationQueryType, result: LocationDetails): Promise<void> {
  await upsert(cacheKey, queryType, result);
}

/** Records that the geocoder found nothing for this key (see `NOT_FOUND_TTL_MS`). Only a definite "no match" is cached, never an outage. */
export async function setCachedNotFound(cacheKey: string, queryType: GeolocationQueryType): Promise<void> {
  await upsert(cacheKey, queryType, NOT_FOUND_MARKER);
}
