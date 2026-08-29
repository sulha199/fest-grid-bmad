import { QueryCondition } from '../query/queryDsl.js';
export type NearbyFilterInput =
  | { locationPreferenceId: string; radiusKm: number }
  | { latitude: number; longitude: number; radiusKm: number };
export enum DateAnchor { TODAY = 'TODAY', THIS_WEEK = 'THIS_WEEK', THIS_MONTH = 'THIS_MONTH' }
export enum DateOffsetUnit { DAY = 'DAY', WEEK = 'WEEK', MONTH = 'MONTH' }
export enum DayOfWeek { MON = 'MON', TUE = 'TUE', WED = 'WED', THU = 'THU', FRI = 'FRI', SAT = 'SAT', SUN = 'SUN' }
export interface DateRangeFilter {
  anchor: DateAnchor | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';
  offsetAmount: number;
  offsetUnit: DateOffsetUnit | 'DAY' | 'WEEK' | 'MONTH';
}
export interface LocationFilter {
  coordinates?: { lat: number; lng: number };
  radiusMeters?: number;
  adminArea?: string;
}
export interface EventFilterInput {
  accountId?: string;
  types?: string[];
  categories?: string[];
  keyword?: string;
  dateRange?: DateRangeFilter;
  dayOfWeek?: DayOfWeek | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  location?: LocationFilter;
  venueType?: string;
  isFree?: boolean;
}
export interface BuildEventsQueryConditionInput {
  search?: string; types?: string[]; categories?: string[]; nearby?: NearbyFilterInput;
  filter?: EventFilterInput; currentDate?: Date;
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
function getDays(fromStr: string, toStr: string, dow: DayOfWeek | string): string[] {
  const map: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const target = map[dow];
  const end = new Date(toStr + 'T00:00:00Z');
  const res: string[] = [], cur = new Date(fromStr + 'T00:00:00Z');
  while (cur <= end) {
    if (cur.getUTCDay() === target) res.push(fmt(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return res;
}
export function buildEventsQueryCondition({
  search, types, categories, nearby, filter, currentDate
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
        const dates = getDays(r.from, r.to, filter.dayOfWeek);
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
  }
  if (conditions.length === 0) return undefined;
  return { operator: 'and', conditions };
}
