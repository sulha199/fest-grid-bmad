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

function getApiKey(): string {
  const key = loadBackendEnv().geoapifyApiKey;
  if (!key) {
    throw new Error('GEOAPIFY_API_KEY is not configured');
  }
  return key;
}

export async function geocodeAddress(address: string): Promise<LocationDetails> {
  const apiKey = getApiKey();
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&format=json&limit=1&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeolocationApiError(`Geoapify geocode address API returned ${response.status}`, response.status);
  }
  
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new GeolocationNotFoundError();
  }
  
  const result = data.results[0];
  return {
    coordinates: {
      latitude: result.lat,
      longitude: result.lon,
    },
    formattedAddress: result.formatted,
    placeId: result.place_id,
    timezone: result.timezone?.name,
    provider: 'GEOAPIFY',
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
  
  const result = data.results[0];
  return {
    coordinates: {
      latitude: result.lat,
      longitude: result.lon,
    },
    formattedAddress: result.formatted,
    placeId: result.place_id,
    timezone: result.timezone?.name,
    provider: 'GEOAPIFY',
  };
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
