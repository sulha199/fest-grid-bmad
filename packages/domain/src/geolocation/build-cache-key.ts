import { GeolocationQuery } from './types.js';

export function buildLocationCacheKey(query: GeolocationQuery): string {
  switch (query.kind) {
    case 'ADDRESS': {
      const normalized = query.address
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      // countryFilter (a HARD Geoapify `filter=countrycode:`) is part of the cache identity: the identical address string
      // searched inside two countries, or inside one and everywhere, must not share a cached result. Lower-cased so "ID" and "id" are
      // one entry; 'none' is the sentinel for "no filter".
      // The proximity point is part of the identity too, rounded to 0.1 degree (about 11 km) so accounts of one town share an
      // entry while a same-named place elsewhere does not (the proximity bias changes which candidate wins).
      const near = query.proximity
        ? `${query.proximity.latitude.toFixed(1)},${query.proximity.longitude.toFixed(1)}`
        : 'none';
      const base = `geocode:${normalized}|filter:${query.countryFilter?.toLowerCase() ?? 'none'}`;
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
