import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { Coordinates, LocationDetails, LocationResolution } from '@festgrid/shared-types';
import { GeminiSchedulePayload } from '@festgrid/domain';
import { normalizeLocationKeywords } from '@festgrid/domain/events';
import {
  buildFallbackLocationQueries,
  buildKeywordQueries,
  buildLocationCacheKey,
  planLocationLookups,
  resolveCountryHint,
  type CountryHint,
  type GeolocationQuery,
  type LocationLadderStep,
} from '@festgrid/domain/geolocation';
import { resolveLocation as defaultResolveLocation } from '../geolocation/adapter.js';
import { GeolocationNotFoundError } from '../geolocation/geoapify-client.js';
import { createGeocodeSession, GeocodeBudgetExhaustedError, type GeocodeSession } from '../geolocation/geocode-session.js';
import { loadBackendEnv } from '../../env.js';

export let resolveLocationSeam = defaultResolveLocation;

export function setResolveLocationSeam(fn: typeof defaultResolveLocation) {
  resolveLocationSeam = fn;
}

export interface ResolveLocationsOptions {
  /** The event's own keywords and country code (slice 1), used for schedules that have no location text of their own. */
  event?: { locationKeywords?: string[]; locationCountryCode?: string };
  /** Shared by everything one request geocodes (memo across events, budget); omitted = a private one for this call. */
  session?: GeocodeSession;
  /** Overrides the backend env (tests): the kill switch and the platform default country. */
  config?: { keywordGeocoding: boolean; defaultCountryCode: string | null };
}

interface AddressSource {
  text: string;
  keywords?: string[];
  countryCode?: string;
}

/**
 * The account default location only helps (proximity bias and the 300 km plausibility filter) when it is in the same country as
 * the text's hint: a wrong default (Poland, Pennsylvania) would otherwise discard correct matches. No hint = used as before; a
 * default whose country is unknown is not trusted against a hint.
 */
function proximityFor(defaultLocation: LocationDetails | undefined, hint: CountryHint): Coordinates | undefined {
  const coordinates = defaultLocation?.coordinates;
  if (!coordinates) return undefined;
  if (!hint.code) return coordinates;
  return defaultLocation?.countryCode?.toUpperCase() === hint.code ? coordinates : undefined;
}

export async function resolveAccountAndLocations(
  accountId: string,
  schedules: GeminiSchedulePayload[],
  explicitTopLevelLocation: string | undefined,
  options?: ResolveLocationsOptions
): Promise<{
  sourceSocialMediaAccountId: string;
  defaultLocation?: LocationDetails;
  resolvedScheduleLocations: Map<number, LocationDetails>;
  /** How each geocoded schedule was resolved (see `LocationResolution`); absent for a schedule that was never looked up. */
  resolvedScheduleResolutions: Map<number, LocationResolution>;
}> {
  // 1. Look up profile
  const rows = await db
    .select({
      accountId: socialMediaAccountProfiles.accountId,
      defaultLocation: socialMediaAccountProfiles.defaultLocation
    })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, accountId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Social media account profile not found: ${accountId}`);
  }

  const profile = rows[0];
  const sourceSocialMediaAccountId = profile.accountId;
  const defaultLocation = profile.defaultLocation || undefined;

  const env = options?.config ? undefined : loadBackendEnv();
  const keywordGeocoding = options?.config?.keywordGeocoding ?? env!.keywordGeocodingEnabled;
  const defaultCountryCode = options?.config ? options.config.defaultCountryCode : env!.defaultCountryCode;
  // One memo for the request (shared across events when the caller passes its session), so a place used by many schedules, or
  // by many events of one Apply, is looked up once. `null` outcomes are misses; failures are shared too, never retried per schedule.
  const session = options?.session ?? createGeocodeSession();
  // One log line per address that failed (not one per schedule), with the schedules it affected.
  const failures = new Map<string, { indices: number[]; error: unknown }>();

  const lookup = (query: GeolocationQuery): Promise<LocationDetails> =>
    session.memo(buildLocationCacheKey(query), () => resolveLocationSeam(query, { beforeGeocode: () => session.spend() }));

  const logFailure = (address: string, index: number, error: unknown) => {
    if (error instanceof GeocodeBudgetExhaustedError) return; // already logged once by the session
    const known = failures.get(address);
    if (known) known.indices.push(index);
    else failures.set(address, { indices: [index], error });
  };

  // The text is geocoded as one query: the account default's own address, and everything while the kill switch is off.
  const resolveText = async (address: string, index: number): Promise<LocationDetails | undefined> => {
    const proximity = defaultLocation?.coordinates;
    try {
      return await lookup({ kind: 'ADDRESS', address, ...(proximity ? { proximity } : {}) });
    } catch (error) {
      logFailure(address, index, error);
      return undefined;
    }
  };

  const resolveSource = async (
    source: AddressSource,
    index: number
  ): Promise<{ details?: LocationDetails; resolution: LocationResolution; hint: CountryHint }> => {
    const hint = resolveCountryHint({ stringCountryCode: source.countryCode, platformDefault: defaultCountryCode });
    const keywords = normalizeLocationKeywords(source.keywords);
    let steps: LocationLadderStep[] = keywords ? buildKeywordQueries(keywords) : buildFallbackLocationQueries(source.text, hint.code);
    if (steps.length === 0) steps = [{ step: 'fb1', query: source.text }];
    const proximity = proximityFor(defaultLocation, hint);
    for (const attempt of planLocationLookups(steps, hint)) {
      const query: GeolocationQuery = {
        kind: 'ADDRESS',
        address: attempt.query,
        ...(attempt.countryFilter ? { countryFilter: attempt.countryFilter } : {}),
        ...(proximity ? { proximity } : {}),
      };
      try {
        return { details: await lookup(query), resolution: attempt.step, hint };
      } catch (error) {
        // "Not found" moves down the ladder; anything else (an outage, a spent budget) ends it: nothing was learned about the place.
        if (error instanceof GeolocationNotFoundError) continue;
        logFailure(attempt.query, index, error);
        return { resolution: 'skipped', hint };
      }
    }
    return { resolution: 'none', hint };
  };

  // 2. Resolve schedule locations
  const resolvedScheduleLocations = new Map<number, LocationDetails>();
  const resolvedScheduleResolutions = new Map<number, LocationResolution>();
  const eventText = explicitTopLevelLocation?.trim() ?? '';

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    const ownText = schedule.location?.trim() ?? '';
    const defaultAddress = defaultLocation ? (defaultLocation.formattedAddress ?? defaultLocation.placeName) : undefined;

    let source: AddressSource | undefined;
    if (ownText !== '') {
      source = { text: ownText, keywords: schedule.locationKeywords, countryCode: schedule.locationCountryCode };
    } else if (eventText !== '') {
      source = { text: eventText, keywords: options?.event?.locationKeywords, countryCode: options?.event?.locationCountryCode };
    }

    if (source && keywordGeocoding) {
      const outcome = await resolveSource(source, i);
      if (outcome.details) resolvedScheduleLocations.set(i, outcome.details);
      resolvedScheduleResolutions.set(i, outcome.resolution);
      console.info(
        `[resolveLocations] schedule=${i} step=${outcome.resolution} hint=${outcome.hint.code ?? 'none'}/${outcome.hint.source}`
      );
      continue;
    }

    // No text of its own, or the kill switch is off: the plain single-address lookup as before keywords existed. Nothing is
    // recorded about how it was resolved (coordinates from the account default location carry no `location_resolution`).
    const address = source?.text ?? (defaultAddress && defaultAddress.trim() !== '' ? defaultAddress.trim() : undefined);
    if (address) {
      const resolved = await resolveText(address, i);
      if (resolved) resolvedScheduleLocations.set(i, resolved);
    }
  }

  for (const [address, { indices, error }] of failures) {
    // Best-effort: a failed lookup never fails the post.
    console.error(`Best-effort resolveLocation failed for schedule index ${indices.join(', ')} with address "${address}":`, error);
  }

  return {
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations,
    resolvedScheduleResolutions,
  };
}
