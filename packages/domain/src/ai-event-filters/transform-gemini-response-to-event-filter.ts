import { EventType, EventCategory } from '@festgrid/shared-types';
import { DateAnchor, DateOffsetUnit, DayOfWeek, EventFilterInput } from '../events/buildEventsQueryCondition.js';

export function transformGeminiResponseToEventFilter(payload: unknown): EventFilterInput {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const source = payload as Record<string, unknown>;

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
    if (validTypes.length > 0) {
      result.types = validTypes;
    }
  }

  // 3. categories
  if (Array.isArray(source.categories)) {
    const validCategories = source.categories.filter((c: unknown): c is EventCategory =>
      Object.values(EventCategory).includes(c as EventCategory)
    );
    if (validCategories.length > 0) {
      result.categories = validCategories;
    }
  }

  // 4. keyword
  if (typeof source.keyword === 'string' && source.keyword.trim() !== '') {
    result.keyword = source.keyword;
  }

  // 5. dateRange
  if (source.dateRange && typeof source.dateRange === 'object') {
    const dr = source.dateRange as Record<string, unknown>;
    const anchor = Object.values(DateAnchor).includes(dr.anchor as DateAnchor)
      ? (dr.anchor as DateAnchor)
      : undefined;
    const offsetUnit = Object.values(DateOffsetUnit).includes(dr.offsetUnit as DateOffsetUnit)
      ? (dr.offsetUnit as DateOffsetUnit)
      : undefined;
    const offsetAmount = typeof dr.offsetAmount === 'number' ? dr.offsetAmount : parseInt(String(dr.offsetAmount), 10);

    if (anchor && offsetUnit && !isNaN(offsetAmount)) {
      result.dateRange = {
        anchor,
        offsetAmount,
        offsetUnit,
      };
    }
  }

  // 6. dayOfWeek
  if (typeof source.dayOfWeek === 'string') {
    const dow = source.dayOfWeek.toUpperCase() as DayOfWeek;
    if (Object.values(DayOfWeek).includes(dow)) {
      result.dayOfWeek = dow;
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
      if (!isNaN(lat) && !isNaN(lng)) {
        locationObj.coordinates = { lat, lng };
      }
    }

    if (typeof loc.radiusMeters === 'number') {
      locationObj.radiusMeters = loc.radiusMeters;
    } else if (typeof loc.radiusMeters === 'string') {
      const rad = parseInt(loc.radiusMeters, 10);
      if (!isNaN(rad)) {
        locationObj.radiusMeters = rad;
      }
    }

    // Mutual exclusivity: prioritize coordinates over adminArea
    if (locationObj.coordinates && locationObj.adminArea) {
      delete locationObj.adminArea;
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
  }

  return result;
}
