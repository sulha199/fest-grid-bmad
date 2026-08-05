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
}): { kind: 'ADDRESS'; address: string } | { kind: 'COORDINATES'; latitude: number; longitude: number } | null {
  const hasAddress = typeof input.address === 'string' && input.address.trim().length > 0;
  const hasLatitude = typeof input.latitude === 'number' && !isNaN(input.latitude);
  const hasLongitude = typeof input.longitude === 'number' && !isNaN(input.longitude);

  if (hasAddress && (hasLatitude || hasLongitude)) {
    throw new InvalidUserLocationInputError('Cannot provide both address and coordinates');
  }

  if (hasAddress) {
    return { kind: 'ADDRESS', address: input.address! };
  }

  if (hasLatitude && hasLongitude) {
    return { kind: 'COORDINATES', latitude: input.latitude!, longitude: input.longitude! };
  }

  if (hasLatitude || hasLongitude) {
    throw new InvalidUserLocationInputError('Must provide both latitude and longitude for coordinates mode');
  }

  return null;
}

export function validateRadiusMeters(radius: number): void {
  if (typeof radius !== 'number' || isNaN(radius) || radius < 1000 || radius > 50000) {
    throw new InvalidUserLocationInputError('Radius must be between 1000 and 50000 meters inclusive');
  }
}
