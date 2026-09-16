import { ExtractedEventMessage, EventInsertValues, ScheduleInsertValues, ExtractedScheduleMessage } from './types.js';

export function buildEventInsertValues(message: ExtractedEventMessage): {
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
  };

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
    };
  });

  normalizeMainSchedule(schedules);

  return { event, schedules };
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
