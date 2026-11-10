import { GeolocationQuery } from './types.js';

export function buildLocationCacheKey(query: GeolocationQuery): string {
  switch (query.kind) {
    case 'ADDRESS': {
      const normalized = query.address
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      // countryBias is part of the cache identity: two accounts geocoding the identical
      // address string with different country biases must not share a cached result
      // (Design Decision 3, Story 0.i7a). 'none' is the sentinel for "no bias".
      // The proximity point is part of the identity too, rounded to 0.1 degree (about 11 km) so accounts of one town share an
      // entry while a same-named place elsewhere does not (the proximity bias changes which candidate wins).
      const near = query.proximity
        ? `${query.proximity.latitude.toFixed(1)},${query.proximity.longitude.toFixed(1)}`
        : 'none';
      const base = `geocode:${normalized}|bias:${query.countryBias ?? 'none'}`;
      return query.proximity ? `${base}|near:${near}` : base;
    }
    case 'PLACE_ID': {
      return `place:${query.placeId}`;
    }
    case 'COORDINATES': {
      const lat = query.coordinates.latitude.toFixed(5);
      const lng = query.coordinates.longitude.toFixed(5);
      const latNormalized = Number(lat).toFixed(5);
      const lngNormalized = Number(lng).toFixed(5);
      return `reverse:${latNormalized},${lngNormalized}`;
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = query;
      throw new Error(`Unhandled query kind: ${(query as { kind: string }).kind}`);
    }
  }
}
