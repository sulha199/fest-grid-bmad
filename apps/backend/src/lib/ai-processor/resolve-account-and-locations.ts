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
  // One lookup per distinct address. Roundup posts put many dates on one venue, or on the event-level fallback (the model's
  // "Berbagai lokasi di Kabupaten Sleman" for a flyer with a different place per date), and the schedules were geocoded one
  // after the other, the same text 20 times: a re-extract Apply of that post outlasted the API Lambda's 28 s. `null` is a miss.
  const lookups = new Map<string, Promise<LocationDetails | null>>();
  const missedAddresses = new Map<string, { indices: number[]; error: unknown }>();

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    const addressString =
      schedule.location ||
      explicitTopLevelLocation ||
      (defaultLocation ? (defaultLocation.formattedAddress ?? defaultLocation.placeName) : undefined);

    if (addressString && addressString.trim() !== '') {
      const addressKey = addressString.trim();
      let lookup = lookups.get(addressKey);
      if (!lookup) {
        lookup = resolveLocationSeam({
          kind: 'ADDRESS',
          address: addressString,
          // Bias Geoapify search toward the account's own country so a same-named venue
          // abroad is not preferred over the local one. Gracefully no-ops (behaves like
          // "no bias") when defaultLocation or its countryCode is absent (first-time
          // resolution, or a cached defaultLocation predating this field) — AD-14.
          countryBias: defaultLocation?.countryCode,
          // And bias toward the account's own location: a market or a hall with a common name is, far more often than not, the
          // one near the account that posted it (the venue name alone put "Pasar Porosjayan" in Palu).
          ...(defaultLocation?.coordinates ? { proximity: defaultLocation.coordinates } : {})
        }).catch((error: unknown) => {
          // Do not fail the whole process, AC6 is best-effort enrichment
          missedAddresses.set(addressKey, { indices: [], error });
          return null;
        });
        lookups.set(addressKey, lookup);
      }
      const resolved = await lookup;
      if (resolved) {
        resolvedScheduleLocations.set(i, resolved);
      } else {
        missedAddresses.get(addressKey)?.indices.push(i);
      }
    }
  }

  // One line per address that did not resolve (not one per schedule), with the schedules it affected.
  for (const [address, { indices, error }] of missedAddresses) {
    console.error(
      `Best-effort resolveLocation failed for schedule index ${indices.join(', ')} with address "${address}":`,
      error
    );
  }

  return {
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations
  };
}
