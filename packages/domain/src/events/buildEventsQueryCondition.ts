import { QueryCondition } from '../query/queryDsl.js';
export type NearbyFilterInput =
  | { locationPreferenceId: string; radiusKm: number }
  | { latitude: number; longitude: number; radiusKm: number };
export enum DateAnchor { TODAY = 'TODAY', THIS_WEEK = 'THIS_WEEK', THIS_MONTH = 'THIS_MONTH' }
export enum DateOffsetUnit { DAY = 'DAY', WEEK = 'WEEK', MONTH = 'MONTH' }
export enum DayOfWeek { MON = 'MON', TUE = 'TUE', WED = 'WED', THU = 'THU', FRI = 'FRI', SAT = 'SAT', SUN = 'SUN' }
export enum TemporalFilter { TODAY = 'TODAY', UPCOMING = 'UPCOMING' }
export interface DateRangeFilter {
  anchor: DateAnchor | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';
  offsetAmount: number;
  offsetUnit: DateOffsetUnit | 'DAY' | 'WEEK' | 'MONTH';
}
export interface LocationFilter {
  coordinates?: { lat: number; lng: number } | null;
  radiusMeters?: number | null;
  adminArea?: string | null;
}
export interface EventFilterInput {
  accountId?: string | null;
  types?: string[] | null;
  categories?: string[] | null;
  keyword?: string | null;
  dateRange?: DateRangeFilter | null;
  dayOfWeek?: DayOfWeek | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' | null;
  location?: LocationFilter | null;
  venueType?: string | null;
  isFree?: boolean | null;
  temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null;
}
export interface BuildEventsQueryConditionInput {
  search?: string; types?: string[]; categories?: string[]; nearby?: NearbyFilterInput;
  filter?: EventFilterInput; currentDate?: Date;
  temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null;
}
const fmt = (d: Date) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
export function resolveDateRangeFilter(
  anchor: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | DateAnchor,
  offsetAmount: number,
  offsetUnit: 'DAY' | 'WEEK' | 'MONTH' | DateOffsetUnit,
  currentDate: Date
): { from: string; to: string } {
  const base = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
  let s = new Date(base), e = new Date(base);
  // Compared against the plain string literal only (not also DateOffsetUnit.MONTH/DateAnchor.TODAY etc below):
  // since this string enum's members' values equal their literal names, TS narrows the enum-member
  // comparison as unreachable ("no overlap", TS2367) once the literal comparison has already run.
  const isMonthUnit = offsetUnit === 'MONTH';
  const isWeekUnit = offsetUnit === 'WEEK';
  const shiftDays = (a: Date, b: Date, days: number) => { a.setUTCDate(a.getUTCDate() + days); b.setUTCDate(b.getUTCDate() + days); };
  const applyDayOrWeekOffset = (a: Date, b: Date) => {
    if (isWeekUnit) shiftDays(a, b, offsetAmount * 7);
    else shiftDays(a, b, offsetAmount);
  };
  if (anchor === 'TODAY') {
    if (isMonthUnit) { s.setUTCMonth(s.getUTCMonth() + offsetAmount); e.setUTCMonth(e.getUTCMonth() + offsetAmount); }
    else applyDayOrWeekOffset(s, e);
  } else if (anchor === 'THIS_WEEK') {
    const day = base.getUTCDay();
    s.setUTCDate(s.getUTCDate() + (day === 0 ? -6 : 1 - day));
    e.setUTCDate(s.getUTCDate() + 6);
    if (isMonthUnit) { s.setUTCMonth(s.getUTCMonth() + offsetAmount); e.setUTCMonth(e.getUTCMonth() + offsetAmount); }
    else applyDayOrWeekOffset(s, e);
  } else if (isMonthUnit) {
    // Day-1/day-0-of-next-month anchors avoid setUTCMonth's day-of-month overflow
    // (e.g. Aug 31 shifted a month would normalize into October, not September).
    s = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offsetAmount, 1));
    e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
  } else {
    s = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    e = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    applyDayOrWeekOffset(s, e);
  }
  return { from: fmt(s), to: fmt(e) };
}
/**
 * AD-19 Rule 1: returns every date in `[fromStr, toStr]` whose weekday matches ANY member of
 * `dow` (a union over the array, not just one weekday). Exported/generalized from the original
 * module-local single-weekday helper so `packages/ui`'s day-of-week occurrence-narrowing (AC4)
 * can share this exact matching logic instead of a second reimplementation.
 */
export function getDays(fromStr: string, toStr: string, dow: DayOfWeek[]): string[] {
  const map: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const targets = new Set(dow.map((d) => map[d]));
  const end = new Date(toStr + 'T00:00:00Z');
  const res: string[] = [], cur = new Date(fromStr + 'T00:00:00Z');
  while (cur <= end) {
    if (targets.has(cur.getUTCDay())) res.push(fmt(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return res;
}
/**
 * AD-20 Rules 2-3: translates the temporal filter's committed value into a `QueryCondition`.
 * `UPCOMING` reuses the existing, unmodified `scheduleDateRange`/`overlaps` mechanism (zero new
 * SQL). `TODAY` ANDs that same `overlaps` condition with exactly one new `scheduleEndedBoundary`/
 * `notEnded` condition, whose literal `now` instant is `now.toISOString()` -- never a live SQL
 * `NOW()` -- so both sides of the DSL/SQL boundary agree on a single resolved instant.
 * Shared by both the `filter`/AI-filter branch and the top-level-param branch below so the
 * translation logic itself is never duplicated (Dev Notes).
 */
function buildTemporalCondition(
  temporalFilter: TemporalFilter | string | null | undefined,
  now: Date
): QueryCondition | undefined {
  if (!temporalFilter) return undefined;
  const todayISO = fmt(now);
  if (temporalFilter === 'UPCOMING') {
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const tomorrowISO = fmt(tomorrow);
    return { field: 'scheduleDateRange', operator: 'overlaps', value: { from: tomorrowISO, to: null } };
  }
  if (temporalFilter === 'TODAY') {
    return {
      operator: 'and',
      conditions: [
        { field: 'scheduleDateRange', operator: 'overlaps', value: { from: todayISO, to: todayISO } },
        { field: 'scheduleEndedBoundary', operator: 'notEnded', value: { now: now.toISOString(), today: todayISO } },
      ],
    };
  }
  return undefined;
}

export function buildEventsQueryCondition({
  search, types, categories, nearby, filter, currentDate, temporalFilter
}: BuildEventsQueryConditionInput): QueryCondition | undefined {
  const conditions: QueryCondition[] = [];
  const now = currentDate ?? new Date();
  if (filter) {
    if (filter.accountId) conditions.push({ field: 'socialMediaAccountProfileId', operator: 'eq', value: filter.accountId });
    if (filter.types && filter.types.length > 0) conditions.push({ field: 'types', operator: 'in', value: filter.types });
    if (filter.categories && filter.categories.length > 0) conditions.push({ field: 'categories', operator: 'in', value: filter.categories });
    if (filter.keyword) {
      const trimmed = filter.keyword.trim();
      if (trimmed.startsWith('#')) {
        const tag = trimmed.slice(1).trim().toLowerCase();
        if (tag) conditions.push({ field: 'hashtags', operator: 'in', value: [tag] });
      } else if (trimmed) {
        conditions.push({
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: trimmed },
            { field: 'performers', operator: 'contains', value: trimmed },
            { field: 'location', operator: 'contains', value: trimmed }
          ]
        });
      }
    }
    if (filter.dateRange || filter.dayOfWeek) {
      const r = filter.dateRange
        ? resolveDateRangeFilter(filter.dateRange.anchor, filter.dateRange.offsetAmount, filter.dateRange.offsetUnit, now)
        : { from: fmt(now), to: fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 90))) };
      if (filter.dayOfWeek) {
        const dates = getDays(r.from, r.to, [filter.dayOfWeek as DayOfWeek]);
        if (dates.length === 0) {
          conditions.push({ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '1970-01-01', to: '1970-01-01' } });
        } else if (dates.length === 1) {
          conditions.push({ field: 'scheduleDateRange', operator: 'overlaps', value: { from: dates[0], to: dates[0] } });
        } else {
          conditions.push({
            operator: 'or',
            conditions: dates.map(d => ({ field: 'scheduleDateRange', operator: 'overlaps', value: { from: d, to: d } }))
          });
        }
      } else {
        conditions.push({ field: 'scheduleDateRange', operator: 'overlaps', value: { from: r.from, to: r.to } });
      }
    }
    if (filter.location) {
      const { coordinates, radiusMeters, adminArea } = filter.location;
      if ((coordinates || radiusMeters !== undefined) && adminArea) throw new Error('Cannot specify both coordinates and adminArea in location filter');
      if (adminArea) {
        conditions.push({ field: 'adminArea', operator: 'eq', value: adminArea });
      } else if (coordinates) {
        conditions.push({
          field: 'scheduleCoordinates',
          operator: 'withinRadius',
          value: { latitude: coordinates.lat, longitude: coordinates.lng, radiusKm: (radiusMeters ?? 10000) / 1000 }
        });
      }
    }
    if (filter.venueType) conditions.push({ field: 'venueType', operator: 'eq', value: filter.venueType });
    if (filter.isFree !== undefined) conditions.push({ field: 'isFree', operator: 'eq', value: filter.isFree });
    const filterTemporalCondition = buildTemporalCondition(filter.temporalFilter, now);
    if (filterTemporalCondition) conditions.push(filterTemporalCondition);
  } else {
    const trimmed = (search ?? '').trim();
    if (trimmed.startsWith('#')) {
      const tag = trimmed.slice(1).trim().toLowerCase();
      if (tag) conditions.push({ field: 'hashtags', operator: 'in', value: [tag] });
    } else if (trimmed) {
      conditions.push({
        operator: 'or',
        conditions: [
          { field: 'eventName', operator: 'contains', value: trimmed },
          { field: 'performers', operator: 'contains', value: trimmed },
          { field: 'location', operator: 'contains', value: trimmed }
        ]
      });
    }
    if (types && types.length > 0) conditions.push({ field: 'types', operator: 'in', value: types });
    if (categories && categories.length > 0) conditions.push({ field: 'categories', operator: 'in', value: categories });
    if (nearby) conditions.push({ field: 'scheduleCoordinates', operator: 'withinRadius', value: nearby });
    const topLevelTemporalCondition = buildTemporalCondition(temporalFilter, now);
    if (topLevelTemporalCondition) conditions.push(topLevelTemporalCondition);
  }
  if (conditions.length === 0) return undefined;
  return { operator: 'and', conditions };
}
