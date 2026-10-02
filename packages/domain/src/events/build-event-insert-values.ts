import {
  ExtractedEventMessage,
  EventInsertValues,
  EventSourcePostIdentity,
  ScheduleInsertValues,
  ExtractedScheduleMessage,
  EventDetailLevel,
} from './types.js';
import { getPlatformSlug } from '../scraper/platform-registry.js';
import { ScrapablePlatform } from '../subscriptions/platforms.js';

export function buildEventInsertValues(
  message: ExtractedEventMessage,
  sourcePost: EventSourcePostIdentity | null,
  detailLevel?: EventDetailLevel
): {
  event: EventInsertValues;
  schedules: ScheduleInsertValues[];
} {
  const event: EventInsertValues = {
    postId: message.postId,
    sourceSocialMediaAccountId: message.sourceSocialMediaAccountId,
    eventName: message.eventName,
    types: message.types || [],
    categories: message.categories || [],
    location: message.location ?? 'Location not specified',
    organizerName: message.organizerName || null,
    contactInfo: message.contactInfo || null,
    hasPrivateContact: message.hasPrivateContact ?? false,
    description: message.description || null,
    confidenceScore: message.confidenceScore ?? null,
    links: message.links ?? null,
  };

  // Story 3.6t — unconditional, unlike `slug`: insertEventWithPrimaryPost always recomputes and
  // overwrites extractionOrdinal at its own DB-write boundary before the real insert, so passing
  // `undefined` through here (a pre-deploy message, AC2) is harmless and needs no special-casing.
  event.extractionOrdinal = message.extractionOrdinal;

  // Story 3.6t — conditional, like `slug`: an omitted detailLevel must leave the key physically
  // absent so Drizzle's events.detail_level DEFAULT 'full' fires, never an explicit 'full' write.
  if (detailLevel !== undefined) {
    event.detailLevel = detailLevel;
  }

  const slug = buildPlatformPrefixedSlug(sourcePost, message.extractionOrdinal);
  if (slug !== undefined) {
    event.slug = slug;
  }

  const schedules: ScheduleInsertValues[] = (message.schedules || []).map((s: ExtractedScheduleMessage) => {
    return {
      isMainSchedule: s.isMainSchedule,
      eventStartDate: s.eventStartDate,
      eventEndDate: s.eventEndDate || null,
      eventStartTime: s.eventStartTime || null,
      eventEndTime: s.eventEndTime || null,
      title: s.title || null,
      performers: s.performers || null,
      location: s.location || null,
      ticketPrice: s.ticketPrice || null,
      locationDetails: s.locationDetails || null,
      latitude: s.locationDetails?.coordinates?.latitude ?? null,
      longitude: s.locationDetails?.coordinates?.longitude ?? null,
      timezone: s.timezone || null,
      timezoneStatus: s.timezoneStatus || null,
      // Story 3.6t (BUG-026) — mapped through from ExtractedScheduleMessage.applicableDaysOfWeek.
      applicableDaysOfWeek: s.applicableDaysOfWeek ?? null,
    };
  });

  normalizeMainSchedule(schedules);

  return { event, schedules };
}

/**
 * Builds the platform-prefixed event slug (e.g. `ig_p_Cx9uWttkSN`, or `ig_p_Cx9uWttkSN~2` for
 * ordinal 2) from the source post's identity, per Architecture Spine AD-16 Rules 1/3/4/8-9.
 *
 * Returns `undefined` — never a guessed/placeholder value — whenever the slug can't be derived:
 * no source post row (`sourcePost` is `null`), the post's `platformPostId`/`platformPostType`
 * are null (unparseable at scrape time, or pre-3.7f data), or the post's `platform` doesn't
 * resolve via `getPlatformSlug()` (unsupported/unrecognized platform). The caller
 * (`buildEventInsertValues`) treats `undefined` as "omit the `slug` key," which lets Drizzle's
 * existing `events.slug` `$defaultFn` (legacy hex) fire unchanged (AC2). The ordinal suffix never
 * fires on top of this fallback path, since it is appended only when a base slug was built.
 *
 * Story 3.6t (AD-16 Rule 9, amended 2026-10-01): the ordinal suffix separator is `~`, not `-`.
 * Instagram shortcodes are base64url and can themselves contain `-`, so a `-`-suffixed slug
 * would be ambiguous between "post X, ordinal N" and "post X-N, ordinal 0" (e.g. `ig_p_Ddi9wU6RCRQ`
 * vs. `ig_p_Ddi9wU6RCRQ~2`). `.` is unusable because `apps/web/src/middleware.ts`'s matcher skips
 * any path containing a dot.
 */
function buildPlatformPrefixedSlug(
  sourcePost: EventSourcePostIdentity | null,
  extractionOrdinal?: number
): string | undefined {
  if (sourcePost === null || sourcePost.platformPostId === null || sourcePost.platformPostType === null) {
    return undefined;
  }

  const platformSlug = getPlatformSlug(sourcePost.platform as ScrapablePlatform);
  if (!platformSlug) {
    return undefined;
  }

  const base = `${platformSlug}_${sourcePost.platformPostType}_${sourcePost.platformPostId}`;
  return extractionOrdinal !== undefined && extractionOrdinal > 0 ? `${base}~${extractionOrdinal}` : base;
}

/**
 * Ensures `schedules` has at most one `isMainSchedule: true` entry, mutating it in place.
 *
 * Gemini's extraction prompt requires `isMainSchedule` per schedule but never instructs
 * "exactly one must be true," so a malformed extraction can produce zero or multiple `true`
 * entries. Without this normalization, an ingestion insert with 2+ `isMainSchedule: true`
 * schedules would violate the `idx_schedules_one_main_per_event` partial unique index
 * (Story 0.36 AC3) inside the same transaction as the parent `events` insert, aborting the
 * whole insert and silently dropping a real event instead of storing it. See Story 0.36 AC5.
 *
 * Deterministic normalization rule:
 * - Exactly one `true` → unchanged.
 * - Multiple `true` → keep only the first one (source array order) `true`; set the rest `false`.
 * - Zero `true` → promote the chronologically-earliest schedule (`eventStartDate` ascending,
 *   then `eventStartTime` ascending with nulls last) to `true`. Ties (identical date/time, or
 *   all schedules dateless) are broken by stable source array order — the first entry wins.
 */
function normalizeMainSchedule(schedules: ScheduleInsertValues[]): void {
  if (schedules.length === 0) {
    return;
  }

  const mainIndexes = schedules.reduce<number[]>((acc, s, i) => {
    if (s.isMainSchedule) {
      acc.push(i);
    }
    return acc;
  }, []);

  if (mainIndexes.length === 1) {
    return;
  }

  if (mainIndexes.length > 1) {
    for (const i of mainIndexes.slice(1)) {
      schedules[i].isMainSchedule = false;
    }
    return;
  }

  // Zero true entries — promote the chronologically-earliest schedule.
  let earliestIndex = 0;
  for (let i = 1; i < schedules.length; i++) {
    if (compareScheduleChronologically(schedules[i], schedules[earliestIndex]) < 0) {
      earliestIndex = i;
    }
  }
  schedules[earliestIndex].isMainSchedule = true;
}

function compareScheduleChronologically(a: ScheduleInsertValues, b: ScheduleInsertValues): number {
  const dateCompare = compareNullableAscending(a.eventStartDate, b.eventStartDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }
  return compareNullableAscending(a.eventStartTime, b.eventStartTime);
}

// Ascending comparison where a null/undefined value sorts last (treated as "latest").
function compareNullableAscending(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
