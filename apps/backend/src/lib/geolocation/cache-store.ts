import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { geolocationCache } from '@festgrid/database';
import { LocationDetails } from '@festgrid/shared-types';

export type GeolocationQueryType = 'GEOCODE' | 'REVERSE_GEOCODE' | 'PLACE_DETAILS';

export async function getCached(cacheKey: string): Promise<LocationDetails | null> {
  const result = await db.query.geolocationCache.findFirst({
    where: eq(geolocationCache.cacheKey, cacheKey),
  });
  
  if (!result) {
    return null;
  }
  
  return result.result as LocationDetails;
}

export async function setCached(cacheKey: string, queryType: GeolocationQueryType, result: LocationDetails): Promise<void> {
  await db
    .insert(geolocationCache)
    .values({
      cacheKey,
      queryType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: result as any, // Cast to any to satisfy Drizzle jsonb expectations
    })
    .onConflictDoUpdate({
      target: geolocationCache.cacheKey,
      set: {
        queryType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: result as any,
        updatedAt: new Date(),
      },
    });
}
