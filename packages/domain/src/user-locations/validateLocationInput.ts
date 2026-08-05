export class InvalidUserLocationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserLocationInputError';
  }
}

export function resolveLocationInputMode(input: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}):
  | { kind: 'ADDRESS'; address: string }
  | { kind: 'COORDINATES'; latitude: number; longitude: number }
  | { kind: 'PLACE_ID'; placeId: string }
  | null {
  const hasAddress = typeof input.address === 'string' && input.address.trim().length > 0;
  const hasCoordinates =
    (typeof input.latitude === 'number' && !isNaN(input.latitude)) ||
    (typeof input.longitude === 'number' && !isNaN(input.longitude));
  const hasPlaceId = typeof input.placeId === 'string' && input.placeId.trim().length > 0;

  let activeModesCount = 0;
  if (hasAddress) activeModesCount++;
  if (hasCoordinates) activeModesCount++;
  if (hasPlaceId) activeModesCount++;

  if (activeModesCount > 1) {
    throw new InvalidUserLocationInputError('Cannot provide multiple location input modes');
  }

  if (hasAddress) {
    return { kind: 'ADDRESS', address: input.address! };
  }

  if (hasPlaceId) {
    return { kind: 'PLACE_ID', placeId: input.placeId! };
  }

  if (hasCoordinates) {
    const hasLatitude = typeof input.latitude === 'number' && !isNaN(input.latitude);
    const hasLongitude = typeof input.longitude === 'number' && !isNaN(input.longitude);
    if (hasLatitude && hasLongitude) {
      return { kind: 'COORDINATES', latitude: input.latitude!, longitude: input.longitude! };
    }
    throw new InvalidUserLocationInputError('Must provide both latitude and longitude for coordinates mode');
  }

  return null;
}

export function validateRadiusMeters(radius: number): void {
  if (typeof radius !== 'number' || isNaN(radius) || radius < 1000 || radius > 50000) {
    throw new InvalidUserLocationInputError('Radius must be between 1000 and 50000 meters inclusive');
  }
}
