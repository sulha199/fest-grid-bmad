import { GeolocationQuery, buildLocationCacheKey, meetsAutocompleteInputThreshold, AddressPrediction, selectBestCandidate, filterPlausibleCandidates } from '@festgrid/domain/geolocation';
import { LocationDetails } from '@festgrid/shared-types';
import { getCached, setCached, GeolocationQueryType } from './cache-store.js';
import { GeolocationNotFoundError, geocodeAddress, reverseGeocode, getPlaceDetails, getAddressPredictions as getClientPredictions } from './geoapify-client.js';

export async function resolveLocation(query: GeolocationQuery): Promise<LocationDetails> {
  const cacheKey = buildLocationCacheKey(query);
  
  const cached = await getCached(cacheKey);
  if (cached) {
    return cached;
  }
  
  let result: LocationDetails;
  let queryType: GeolocationQueryType;
  
  switch (query.kind) {
    case 'ADDRESS':
      // geocodeAddress returns up to 5 ranked candidates; re-rank them by the
      // Geoapify confidence signal (with a matchType-priority tiebreak) instead of
      // blindly taking Geoapify's first result, so a low-confidence top hit doesn't
      // win over a correct, lower-ranked one (BUG-017).
      const candidates = await geocodeAddress(query.address, { countryBias: query.countryBias, proximity: query.proximity });
      // With a proximity point (the account's own location), a far low-confidence guess is dropped: no match is better than a
      // pin on another continent (it also decides the event's timezone). Without one nothing is filtered, as before.
      const plausible = filterPlausibleCandidates(candidates, query.proximity);
      if (plausible.length === 0) {
        throw new GeolocationNotFoundError('Every candidate is far from the account and low confidence');
      }
      result = selectBestCandidate(plausible);
      queryType = 'GEOCODE';
      break;
    case 'COORDINATES':
      result = await reverseGeocode(query.coordinates);
      queryType = 'REVERSE_GEOCODE';
      break;
    case 'PLACE_ID':
      result = await getPlaceDetails(query.placeId);
      queryType = 'PLACE_DETAILS';
      break;
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = query;
      throw new Error(`Unhandled query kind: ${(query as { kind: string }).kind}`);
    }
  }
  
  await setCached(cacheKey, queryType, result);
  
  return result;
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
