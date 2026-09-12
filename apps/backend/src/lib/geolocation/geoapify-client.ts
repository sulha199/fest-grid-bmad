import { Coordinates, LocationDetails } from '@festgrid/shared-types';
import { AddressPrediction } from '@festgrid/domain/geolocation';
import { loadBackendEnv } from '../../env.js';

export class GeolocationNotFoundError extends Error {
  constructor(message = 'No geolocation match found') {
    super(message);
    this.name = 'GeolocationNotFoundError';
  }
}

export class GeolocationApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'GeolocationApiError';
  }
}

/**
 * Shape of a single entry in a Geoapify geocode/reverse-geocode `results[]` array. All
 * fields optional/camelCased-snake because Geoapify's payload is untyped JSON; only the
 * fields this mapper reads are declared. `rank` is absent from some responses (and from
 * Place Details entirely), so `confidence`/`matchType` are only spread when present.
 */
interface GeoapifyGeocodeResult {
  lat: number;
  lon: number;
  formatted: string;
  place_id: string;
  timezone?: { name?: string };
  city?: string;
  state?: string;
  province?: string;
  county?: string;
  country_code?: string;
  rank?: {
    confidence?: number;
    match_type?: string;
  };
}

function getApiKey(): string {
  const key = loadBackendEnv().geoapifyApiKey;
  if (!key) {
    throw new Error('GEOAPIFY_API_KEY is not configured');
  }
  return key;
}

export async function geocodeAddress(
  address: string,
  options?: { countryBias?: string }
): Promise<LocationDetails[]> {
  const apiKey = getApiKey();
  let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&format=json&limit=5&apiKey=${apiKey}`;
  if (options?.countryBias) {
    url += `&bias=countrycode:${options.countryBias}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeolocationApiError(`Geoapify geocode address API returned ${response.status}`, response.status);
  }
  
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new GeolocationNotFoundError();
  }

  // Retain the top 5 candidates, each carrying its own confidence/matchType, so
  // Story 0.i7b has a real candidate set to re-rank. (Matching conventions in
  // getAddressPredictions, which already requests limit=5.)
  const results: GeoapifyGeocodeResult[] = data.results;
  return results.slice(0, 5).map((result) => mapGeocodeResult(result));
}

// Shared mapping for the ranked geocode/reverse-geocode endpoints (both return a
// `results[]` array whose entries carry `lat`/`lon`/`rank`/`country_code`). confidence
// and matchType are only spread when `rank` is present (conditional-spread convention so
// partial fixtures and responses without a `rank` object never leak an `undefined` key
// into deepEqual comparisons).
function mapGeocodeResult(result: GeoapifyGeocodeResult): LocationDetails {
  return {
    coordinates: {
      latitude: result.lat,
      longitude: result.lon,
    },
    formattedAddress: result.formatted,
    placeId: result.place_id,
    timezone: result.timezone?.name,
    provider: 'GEOAPIFY',
    ...(result.city && { city: result.city }),
    ...((result.state || result.province || result.county) && { province: result.state || result.province || result.county }),
    ...(result.rank?.confidence !== undefined && { confidence: result.rank.confidence }),
    ...(result.rank?.match_type && { matchType: result.rank.match_type }),
    ...(result.country_code && { countryCode: result.country_code }),
  };
}
export async function reverseGeocode(coordinates: Coordinates): Promise<LocationDetails> {

  const apiKey = getApiKey();
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json&limit=1&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeolocationApiError(`Geoapify reverse geocode API returned ${response.status}`, response.status);
  }
  
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new GeolocationNotFoundError();
  }
  
  return mapGeocodeResult(data.results[0]);
}

export async function getPlaceDetails(placeId: string): Promise<LocationDetails> {
  const apiKey = getApiKey();
  const url = `https://api.geoapify.com/v2/place-details?id=${encodeURIComponent(placeId)}&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeolocationApiError(`Geoapify place details API returned ${response.status}`, response.status);
  }
  
  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    throw new GeolocationNotFoundError();
  }
  
  const properties = data.features[0].properties;
  return {
    coordinates: {
      latitude: properties.lat,
      longitude: properties.lon,
    },
    formattedAddress: properties.formatted,
    placeId: placeId,
    placeName: properties.name,
    timezone: properties.timezone?.name,
    provider: 'GEOAPIFY',
    // Place Details is a direct ID lookup with no `rank` object at all, so there is no
    // provider confidence signal to pass through. We set a synthetic convention — "no
    // ambiguity left to resolve" — rather than omitting the signal (Design Decision 2).
    confidence: 1,
    matchType: 'PLACE_ID_EXACT',
    ...(properties.city && { city: properties.city }),
    ...((properties.state || properties.province || properties.county) && { province: properties.state || properties.province || properties.county }),
    ...(properties.country_code && { countryCode: properties.country_code }),
  };
}

export async function getAddressPredictions(input: string): Promise<AddressPrediction[]> {
  const apiKey = getApiKey();
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(input)}&format=json&limit=5&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeolocationApiError(`Geoapify autocomplete API returned ${response.status}`, response.status);
  }
  
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return [];
  }
  
  return data.results.map((result: any) => ({
    placeId: result.place_id,
    description: result.formatted,
  }));
}
