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
