import { EventType, EventCategory } from '@festgrid/shared-types';
import {
  DateAnchor,
  DateOffsetUnit,
  DayOfWeek,
  EventFilterInput,
  TemporalFilter,
  DATE_OFFSET_AMOUNT_BOUNDS,
} from '../events/buildEventsQueryCondition.js';

const MAX_RADIUS_METERS = 1_000_000;

/**
 * `onDropped` (Epic 9 review P9) receives one plain-English sentence per fragment of the model's
 * answer that had to be discarded as unusable, so the caller can surface it as a caveat instead of
 * silently returning a wider filter than the user asked for (SPEC CAP-2). The returned filter is
 * identical with or without it.
 */
/** A numeric value as the model wrote it: a number as-is, a numeric string parsed WHOLE (`parseInt`
 * would turn "2.7" into 2 and "3 days" into 3 without anyone noticing), anything else NaN. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

export function transformGeminiResponseToEventFilter(
  payload: unknown,
  onDropped?: (message: string) => void
): EventFilterInput {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const source = payload as Record<string, unknown>;
  const dropped = (message: string): void => onDropped?.(message);

  const result: EventFilterInput = {};

  // 1. accountId
  if (typeof source.accountId === 'string' && source.accountId.trim() !== '') {
    result.accountId = source.accountId;
  }

  // 2. types
  if (Array.isArray(source.types)) {
    const validTypes = source.types.filter((t: unknown): t is EventType =>
      Object.values(EventType).includes(t as EventType)
    );
    if (validTypes.length < source.types.length) {
      dropped('Some event types in your prompt are not supported and were ignored.');
    }
    if (validTypes.length > 0) {
      result.types = validTypes;
    }
  }

  // 3. categories
  if (Array.isArray(source.categories)) {
    const validCategories = source.categories.filter((c: unknown): c is EventCategory =>
      Object.values(EventCategory).includes(c as EventCategory)
    );
    if (validCategories.length < source.categories.length) {
      dropped('Some event categories in your prompt are not supported and were ignored.');
    }
    if (validCategories.length > 0) {
      result.categories = validCategories;
    }
  }

  // 4. keyword
  if (typeof source.keyword === 'string' && source.keyword.trim() !== '') {
    result.keyword = source.keyword;
  }

  // 5. dateRange (DW-077: offsetAmount is bounds-checked here too; a violation omits the whole
  // dateRange, same as every other unparseable-field case in this function -- untrusted model
  // output degrades gracefully rather than throwing, unlike resolveDateRangeFilter's throw path
  // for the trusted/direct-GraphQL caller.)
  if (source.dateRange && typeof source.dateRange === 'object') {
    const dr = source.dateRange as Record<string, unknown>;
    const anchor = Object.values(DateAnchor).includes(dr.anchor as DateAnchor)
      ? (dr.anchor as DateAnchor)
      : undefined;
    let offsetUnit = Object.values(DateOffsetUnit).includes(dr.offsetUnit as DateOffsetUnit)
      ? (dr.offsetUnit as DateOffsetUnit)
      : undefined;
    let offsetAmount = toNumber(dr.offsetAmount);
    if (anchor && dr.offsetAmount == null && dr.offsetUnit == null) {
      // The response schema does not require the offset, so a bare `{ anchor: "THIS_WEEK" }` is a
      // legitimate answer meaning "the anchor window itself" -- not a reason to drop the whole date.
      offsetAmount = 0;
      offsetUnit = DateOffsetUnit.DAY;
    }

    if (
      anchor &&
      offsetUnit &&
      Number.isInteger(offsetAmount) &&
      Math.abs(offsetAmount) <= DATE_OFFSET_AMOUNT_BOUNDS[offsetUnit]
    ) {
      const dateRange: NonNullable<EventFilterInput['dateRange']> = { anchor, offsetAmount, offsetUnit };

      // Additive-only span (AC1): omits just the span fields (not the whole dateRange) on a
      // bound violation or malformed shape -- span is a strictly additive enhancement, so the
      // base anchor/offset resolution should still work even if the model's span value is bad.
      const spanUnit = Object.values(DateOffsetUnit).includes(dr.spanUnit as DateOffsetUnit)
        ? (dr.spanUnit as DateOffsetUnit)
        : undefined;
      const spanAmount = toNumber(dr.spanAmount);
      if (
        spanUnit &&
        !isNaN(spanAmount) &&
        Number.isInteger(spanAmount) &&
        spanAmount >= 1 &&
        spanAmount <= DATE_OFFSET_AMOUNT_BOUNDS[spanUnit]
      ) {
        dateRange.spanAmount = spanAmount;
        dateRange.spanUnit = spanUnit;
      } else if (dr.spanAmount != null || dr.spanUnit != null) {
        dropped('The date span in your prompt was out of range and was ignored.');
      }

      result.dateRange = dateRange;
    } else {
      dropped('The date range in your prompt could not be understood or is out of range, so it was ignored.');
    }
  }

  // 6. dayOfWeek -- accepts either a single weekday string (existing behavior, output stays a
  // bare string) or an array of weekday strings (new, AC2): filters to valid DayOfWeek members,
  // outputting a bare string when exactly one valid value survives (preserves the existing
  // singular-output contract) or an array when 2+.
  if (typeof source.dayOfWeek === 'string') {
    const dow = source.dayOfWeek.toUpperCase() as DayOfWeek;
    if (Object.values(DayOfWeek).includes(dow)) {
      result.dayOfWeek = dow;
    } else {
      dropped('The weekday in your prompt was not recognised and was ignored.');
    }
  } else if (Array.isArray(source.dayOfWeek)) {
    const validDows = source.dayOfWeek
      .filter((d): d is string => typeof d === 'string')
      .map((d) => d.toUpperCase() as DayOfWeek)
      .filter((d) => Object.values(DayOfWeek).includes(d));
    if (validDows.length < source.dayOfWeek.length) {
      dropped('Some weekdays in your prompt were not recognised and were ignored.');
    }
    if (validDows.length === 1) {
      result.dayOfWeek = validDows[0];
    } else if (validDows.length > 1) {
      result.dayOfWeek = validDows;
    }
  }

  // temporalFilter (AC2): extracted the same way as dayOfWeek/anchor -- a field this function
  // did not read at all before this story.
  if (typeof source.temporalFilter === 'string') {
    const tf = source.temporalFilter.toUpperCase() as TemporalFilter;
    if (Object.values(TemporalFilter).includes(tf)) {
      result.temporalFilter = tf;
    } else {
      dropped('The "happening now / upcoming" setting in your prompt was not recognised and was ignored.');
    }
  }

  // 7. location
  if (source.location && typeof source.location === 'object') {
    const loc = source.location as Record<string, unknown>;
    const locationObj: NonNullable<EventFilterInput['location']> = {};

    if (typeof loc.adminArea === 'string' && loc.adminArea.trim() !== '') {
      locationObj.adminArea = loc.adminArea;
    }

    if (loc.coordinates && typeof loc.coordinates === 'object') {
      const coords = loc.coordinates as Record<string, unknown>;
      const lat = typeof coords.lat === 'number' ? coords.lat : parseFloat(String(coords.lat));
      const lng = typeof coords.lng === 'number' ? coords.lng : parseFloat(String(coords.lng));
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        locationObj.coordinates = { lat, lng };
      } else {
        dropped('The coordinates in your prompt were invalid and were ignored.');
      }
    }

    // A radius only means something when it is a positive, finite distance; anything else (0, a
    // negative, NaN) is dropped so the default radius applies rather than a leaf the schema rejects.
    if (loc.radiusMeters != null) {
      const rad = typeof loc.radiusMeters === 'number' ? loc.radiusMeters : parseInt(String(loc.radiusMeters), 10);
      if (Number.isFinite(rad) && rad > 0 && rad <= MAX_RADIUS_METERS) {
        locationObj.radiusMeters = rad;
      } else {
        dropped('The search radius in your prompt was invalid and was ignored.');
      }
    }

    // Mutual exclusivity: prioritize coordinates over adminArea
    if (locationObj.coordinates && locationObj.adminArea) {
      delete locationObj.adminArea;
      dropped('Both an area name and coordinates were given; only the coordinates are used.');
    }

    if (Object.keys(locationObj).length > 0) {
      result.location = locationObj;
    }
  }

  // 8. venueType
  if (typeof source.venueType === 'string' && source.venueType.trim() !== '') {
    result.venueType = source.venueType;
  }

  // 9. isFree
  if (typeof source.isFree === 'boolean') {
    result.isFree = source.isFree;
  } else if (source.isFree === 'true' || source.isFree === 'false') {
    result.isFree = source.isFree === 'true';
  } else if (source.isFree != null) {
    dropped('The free/paid setting in your prompt was not understood and was ignored.');
  }

  return result;
}
