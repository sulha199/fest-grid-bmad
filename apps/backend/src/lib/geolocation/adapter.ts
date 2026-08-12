import { GeolocationQuery, buildLocationCacheKey, meetsAutocompleteInputThreshold, AddressPrediction } from '@festgrid/domain/geolocation';
import { LocationDetails } from '@festgrid/shared-types';
import { getCached, setCached, GeolocationQueryType } from './cache-store.js';
import { geocodeAddress, reverseGeocode, getPlaceDetails, getAddressPredictions as getClientPredictions } from './geoapify-client.js';

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
      result = await geocodeAddress(query.address);
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
