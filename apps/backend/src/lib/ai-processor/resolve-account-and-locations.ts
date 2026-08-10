import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { LocationDetails } from '@festgrid/shared-types';
import { GeminiSchedulePayload } from '@festgrid/domain';
import { resolveLocation as defaultResolveLocation } from '../geolocation/adapter.js';

export let resolveLocationSeam = defaultResolveLocation;

export function setResolveLocationSeam(fn: typeof defaultResolveLocation) {
  resolveLocationSeam = fn;
}

export async function resolveAccountAndLocations(
  accountId: string,
  schedules: GeminiSchedulePayload[],
  explicitTopLevelLocation: string | undefined
): Promise<{
  sourceSocialMediaAccountId: string;
  defaultLocation?: LocationDetails;
  resolvedScheduleLocations: Map<number, LocationDetails>;
}> {
  // 1. Look up profile
  const rows = await db
    .select({
      accountId: socialMediaAccountProfiles.accountId,
      defaultLocation: socialMediaAccountProfiles.defaultLocation
    })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, accountId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Social media account profile not found: ${accountId}`);
  }

  const profile = rows[0];
  const sourceSocialMediaAccountId = profile.accountId;
  const defaultLocation = profile.defaultLocation || undefined;

  // 2. Resolve schedule locations
  const resolvedScheduleLocations = new Map<number, LocationDetails>();

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    const addressString =
      schedule.location ||
      explicitTopLevelLocation ||
      (defaultLocation ? (defaultLocation.formattedAddress ?? defaultLocation.placeName) : undefined);

    if (addressString && addressString.trim() !== '') {
      try {
        const resolved = await resolveLocationSeam({
          kind: 'ADDRESS',
          address: addressString
        });
        resolvedScheduleLocations.set(i, resolved);
      } catch (error) {
        console.error(
          `Best-effort resolveLocation failed for schedule index ${i} with address "${addressString}":`,
          error
        );
        // Do not fail the whole process, AC6 is best-effort enrichment
      }
    }
  }

  return {
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations
  };
}
