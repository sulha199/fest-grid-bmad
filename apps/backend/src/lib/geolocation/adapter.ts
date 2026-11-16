import { GeolocationQuery, buildLocationCacheKey, meetsAutocompleteInputThreshold, AddressPrediction, selectBestCandidate, filterPlausibleCandidates } from '@festgrid/domain/geolocation';
import { LocationDetails } from '@festgrid/shared-types';
import { getCacheEntry, getCached, setCached, setCachedNotFound, GeolocationQueryType } from './cache-store.js';
import { GeolocationNotFoundError, geocodeAddress, reverseGeocode, getPlaceDetails, getAddressPredictions as getClientPredictions } from './geoapify-client.js';

export interface ResolveLocationOptions {
  /**
   * Called right before a lookup would reach the geocoder (a cache miss), never for a cached answer. It may throw to refuse the
   * lookup (a request's budget is spent); a refusal is not "not found" and is not cached.
   */
  beforeGeocode?: () => void;
}

export async function resolveLocation(query: GeolocationQuery, options?: ResolveLocationOptions): Promise<LocationDetails> {
  const cacheKey = buildLocationCacheKey(query);

  const cached = await getCacheEntry(cacheKey);
  if (cached?.kind === 'hit') {
    return cached.location;
  }
  if (cached?.kind === 'not-found') {
    // The geocoder found nothing for this exact query within the last day: do not pay for the same answer again.
    throw new GeolocationNotFoundError('No geolocation match found (cached)');
  }

  options?.beforeGeocode?.();

  let outcome: { result: LocationDetails; queryType: GeolocationQueryType };
  try {
    outcome = await geocodeUncached(query);
  } catch (error) {
    // Only a definite "no match" is remembered; an outage, a rate limit or a bad key must be retried, not cached.
    if (error instanceof GeolocationNotFoundError) {
      await setCachedNotFound(cacheKey, queryTypeOf(query));
    }
    throw error;
  }

  await setCached(cacheKey, outcome.queryType, outcome.result);

  return outcome.result;
}

function queryTypeOf(query: GeolocationQuery): GeolocationQueryType {
  switch (query.kind) {
    case 'ADDRESS':
      return 'GEOCODE';
    case 'COORDINATES':
      return 'REVERSE_GEOCODE';
    case 'PLACE_ID':
      return 'PLACE_DETAILS';
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = query;
      throw new Error(`Unhandled query kind: ${(query as { kind: string }).kind}`);
    }
  }
}

async function geocodeUncached(query: GeolocationQuery): Promise<{ result: LocationDetails; queryType: GeolocationQueryType }> {
  switch (query.kind) {
    case 'ADDRESS': {
      // geocodeAddress returns up to 5 ranked candidates; re-rank them by the
      // Geoapify confidence signal (with a matchType-priority tiebreak) instead of
      // blindly taking Geoapify's first result, so a low-confidence top hit doesn't
      // win over a correct, lower-ranked one (BUG-017).
      const candidates = await geocodeAddress(query.address, { countryFilter: query.countryFilter, proximity: query.proximity });
      // With a proximity point (the account's own location), a far low-confidence guess is dropped: no match is better than a
      // pin on another continent (it also decides the event's timezone). Without one nothing is filtered, as before.
      const plausible = filterPlausibleCandidates(candidates, query.proximity);
      if (plausible.length === 0) {
        throw new GeolocationNotFoundError('Every candidate is far from the account and low confidence');
      }
      return { result: selectBestCandidate(plausible), queryType: 'GEOCODE' };
    }
    case 'COORDINATES':
      return { result: await reverseGeocode(query.coordinates), queryType: 'REVERSE_GEOCODE' };
    case 'PLACE_ID':
      return { result: await getPlaceDetails(query.placeId), queryType: 'PLACE_DETAILS' };
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = query;
      throw new Error(`Unhandled query kind: ${(query as { kind: string }).kind}`);
    }
  }
}

export async function getAddressPredictions(input: string): Promise<AddressPrediction[]> {
  if (!meetsAutocompleteInputThreshold(input)) {
    return [];
  }
  return getClientPredictions(input);
}

export async function resolveAdminRegion(coordinates: { latitude: number; longitude: number }): Promise<{ city: string; province: string }> {
  const cacheKey = `reverse:${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
  const cached = await getCached(cacheKey);
  if (cached && (cached.city || cached.province)) {
    return {
      city: cached.city || 'Unknown',
      province: cached.province || 'Unknown'
    };
  }

  try {
    const details = await reverseGeocode(coordinates);
    return {
      city: details.city || 'Unknown',
      province: details.province || 'Unknown'
    };
  } catch {
    return {
      city: 'Unknown',
      province: 'Unknown'
    };
  }
}
