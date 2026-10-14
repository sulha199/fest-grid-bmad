import { QueryCondition } from '../query/queryDsl.js';
import { isValidIanaTimezone } from '../users/validateTimezone.js';
export type NearbyFilterInput =
  | { locationPreferenceId: string; radiusKm: number }
  | { latitude: number; longitude: number; radiusKm: number };
export enum DateAnchor { TODAY = 'TODAY', THIS_WEEK = 'THIS_WEEK', THIS_MONTH = 'THIS_MONTH' }
export enum DateOffsetUnit { DAY = 'DAY', WEEK = 'WEEK', MONTH = 'MONTH' }
export enum DayOfWeek { MON = 'MON', TUE = 'TUE', WED = 'WED', THU = 'THU', FRI = 'FRI', SAT = 'SAT', SUN = 'SUN' }
export enum TemporalFilter { TODAY = 'TODAY', UPCOMING = 'UPCOMING' }
/**
 * DW-077: the single, shared bound table for `offsetAmount` (every caller) and `spanAmount`
 * (Story 9.1b) -- keyed by the respective `offsetUnit`/`spanUnit`. Never re-declared elsewhere;
 * `filter-node-schema.ts`'s `dateRangeFilterSchema` imports this exact table rather than
 * hardcoding its own copy of these numbers.
 */
export const DATE_OFFSET_AMOUNT_BOUNDS: Record<'DAY' | 'WEEK' | 'MONTH', number> = { DAY: 90, WEEK: 52, MONTH: 24 };
/**
 * DW-075: the named, documented replacement for the inline magic `+ 90` days previously used when
 * `dayOfWeek` is set without `dateRange` (lookahead window for "which weekday do you mean"). Same
 * numeric value as before -- this only makes the behavior explicit and testable.
 */
export const DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS = 90;
/**
 * DW-076: the named, documented replacement for the inline magic `'1970-01-01'` literal used to
 * force zero results when no date in the resolved window matches the requested weekday(s). A
 * from/to pair of this sentinel date reliably produces zero `scheduleDateRange` overlap matches
 * for any real event (every event lives well after 1970), which is why it's reused as an
 * "always-false" trick rather than introducing a new, dedicated "always-false" DSL terminal here
 * (see Story 9.1b Dev Notes decision 5 -- that would require extending `DSLOperator`, which is
 * explicitly Story 9.2/9.3's territory).
 */
export const NO_MATCHING_WEEKDAY_SENTINEL_DATE = '1970-01-01';
export interface DateRangeFilter {
  anchor: DateAnchor | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';
  offsetAmount: number;
  offsetUnit: DateOffsetUnit | 'DAY' | 'WEEK' | 'MONTH';
  /**
   * Additive-only span widening (AC1) -- omitting this leaves resolution byte-identical to
   * before. Nullable (not just optional) per Story 9.3's GraphQL exposure: the generated
   * `DateRangeFilterInput.spanAmount`/`spanUnit` (both optional, non-`!` GraphQL fields) type as
   * `| null`, not just `| undefined`, so this domain type must tolerate the same shape for a
   * GraphQL-sourced caller to type-check without a lossy cast.
   */
  spanAmount?: number | null;
  spanUnit?: DateOffsetUnit | 'DAY' | 'WEEK' | 'MONTH' | null;
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
  // Story 9.3: the array branch's element type is widened to the same enum-or-literal union as
  // the singular branch (not bare `DayOfWeek[]`) so a GraphQL-codegen-sourced caller's own
  // generated `DayOfWeek` enum (a distinct nominal type from this one, despite identical string
  // values -- TypeScript string enums are never structurally interchangeable) can still assign
  // its `DayOfWeek[]` array here without a cast, exactly as the singular branch already tolerated.
  dayOfWeek?: (DayOfWeek | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[] | DayOfWeek | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' | null;
  location?: LocationFilter | null;
  venueType?: string | null;
  isFree?: boolean | null;
  temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null;
}
export interface BuildEventsQueryConditionInput {
  search?: string; types?: string[]; categories?: string[]; nearby?: NearbyFilterInput;
  filter?: EventFilterInput; currentDate?: Date;
  temporalFilter?: TemporalFilter | 'TODAY' | 'UPCOMING' | null;
  /** DW-074: optional IANA timezone used to resolve "today" (date boundaries only -- never the `notEnded` instant). */
  timezone?: string | null;
}
const fmt = (d: Date) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
/**
 * DW-074: computes the zoned Y-M-D "today" as seen in `timezone`, degrading gracefully to the
 * instant's own UTC calendar date (via `fmt`) when `timezone` is absent, invalid, or `Intl` throws
 * -- matching `project-context.md`'s established Intl-degradation convention. Used only for
 * date-boundary computation (the resolved `dateRange`/`dayOfWeek` window, and `buildTemporalCondition`'s
 * `today`/`tomorrow`), never for the `notEnded` check's real-time instant comparison.
 */
export function resolveTodayISO(instant: Date, timezone?: string | null): string {
  if (timezone && isValidIanaTimezone(timezone)) {
    try {
      // en-CA formats as YYYY-MM-DD, matching `fmt`'s own output shape.
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
    } catch {
      return fmt(instant);
    }
  }
  return fmt(instant);
}
function checkOffsetAmountBound(amount: number, unit: 'DAY' | 'WEEK' | 'MONTH', label: string): void {
  const bound = DATE_OFFSET_AMOUNT_BOUNDS[unit];
  if (Math.abs(amount) > bound) {
    throw new Error(`${label} (${amount} ${unit}) exceeds the allowed bound of ±${bound} ${unit}(s) (see DATE_OFFSET_AMOUNT_BOUNDS).`);
  }
}
function applySpanWidening(e: Date, spanAmount: number, spanUnit: 'DAY' | 'WEEK' | 'MONTH'): Date {
  if (spanUnit === 'WEEK') {
    const widened = new Date(e);
    widened.setUTCDate(widened.getUTCDate() + spanAmount * 7);
    return widened;
  }
  if (spanUnit === 'MONTH') {
    // Extends `to` through the end of the `spanAmount`-th calendar month, counting `e`'s own
    // month as month 1 (AC1's "rest of this month" worked example: spanAmount=1 -> end of e's
    // own month; spanAmount=2 -> end of the next month). Date.UTC normalizes month overflow
    // (e.g. December + N) into the correct following year automatically.
    return new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + spanAmount, 0));
  }
  const widened = new Date(e);
  widened.setUTCDate(widened.getUTCDate() + spanAmount);
  return widened;
}
export function resolveDateRangeFilter(
  anchor: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | DateAnchor,
  offsetAmount: number,
  offsetUnit: 'DAY' | 'WEEK' | 'MONTH' | DateOffsetUnit,
  currentDate: Date,
  span?: { spanAmount?: number | null; spanUnit?: DateOffsetUnit | 'DAY' | 'WEEK' | 'MONTH' | null }
): { from: string; to: string } {
  checkOffsetAmountBound(offsetAmount, offsetUnit as 'DAY' | 'WEEK' | 'MONTH', 'offsetAmount');
  const hasSpan = span?.spanAmount != null && span?.spanUnit != null;
  if (hasSpan) {
    const spanAmount = span!.spanAmount as number;
    const spanUnit = span!.spanUnit as 'DAY' | 'WEEK' | 'MONTH';
    if (!Number.isInteger(spanAmount) || spanAmount < 1) {
      throw new Error(`spanAmount (${spanAmount}) must be a positive integer >= 1.`);
    }
    checkOffsetAmountBound(spanAmount, spanUnit, 'spanAmount');
  }
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
  if (hasSpan) {
    e = applySpanWidening(e, span!.spanAmount as number, span!.spanUnit as 'DAY' | 'WEEK' | 'MONTH');
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
  now: Date,
  timezone?: string | null
): QueryCondition | undefined {
  if (!temporalFilter) return undefined;
  const todayISO = resolveTodayISO(now, timezone);
  if (temporalFilter === 'UPCOMING') {
    const todayDate = new Date(todayISO + 'T00:00:00Z');
    const tomorrow = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), todayDate.getUTCDate() + 1));
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

/**
 * DW-074: wraps the two-line "what is 'today' for this request" computation (`resolveTodayISO` +
 * the zoned midnight `Date`) so there is exactly one implementation of it -- both the legacy flat
 * `buildEventsQueryCondition` below and Story 9.2's new `compileFilterNodeToQueryCondition`
 * compiler call this one helper, rather than each inlining their own copy that could silently
 * drift apart.
 */
export function resolveZonedToday(now: Date, timezone?: string | null): { zonedTodayISO: string; zonedCurrentDate: Date } {
  const zonedTodayISO = resolveTodayISO(now, timezone);
  const zonedCurrentDate = new Date(zonedTodayISO + 'T00:00:00Z');
  return { zonedTodayISO, zonedCurrentDate };
}

export { buildTemporalCondition };

/** Task 1 leaf builder -- the `filter.accountId` block, verbatim guard. */
export function buildAccountIdCondition(accountId: string | null | undefined): QueryCondition | undefined {
  if (accountId) return { field: 'socialMediaAccountProfileId', operator: 'eq', value: accountId };
  return undefined;
}

/** Task 1 leaf builder -- the `filter.types` block, verbatim guard. */
export function buildTypesCondition(types: string[] | null | undefined): QueryCondition | undefined {
  if (types && types.length > 0) return { field: 'types', operator: 'in', value: types };
  return undefined;
}

/** Task 1 leaf builder -- the `filter.categories` block, verbatim guard. */
export function buildCategoriesCondition(categories: string[] | null | undefined): QueryCondition | undefined {
  if (categories && categories.length > 0) return { field: 'categories', operator: 'in', value: categories };
  return undefined;
}

/** Task 1 leaf builder -- the `filter.keyword` block (hashtag `#`-prefix branch + the 3-way
 * `eventName`/`performers`/`location` OR-contains branch), verbatim. */
export function buildKeywordCondition(keyword: string | null | undefined): QueryCondition | undefined {
  if (!keyword) return undefined;
  const trimmed = keyword.trim();
  if (trimmed.startsWith('#')) {
    const tag = trimmed.slice(1).trim().toLowerCase();
    if (tag) return { field: 'hashtags', operator: 'in', value: [tag] };
    return undefined;
  } else if (trimmed) {
    return {
      operator: 'or',
      conditions: [
        { field: 'eventName', operator: 'contains', value: trimmed },
        { field: 'performers', operator: 'contains', value: trimmed },
        { field: 'location', operator: 'contains', value: trimmed }
      ]
    };
  }
  return undefined;
}

/** Task 1 leaf builder -- the combined `if (filter.dateRange || filter.dayOfWeek) {...}` block,
 * verbatim, including the `DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS` fallback window and the
 * `NO_MATCHING_WEEKDAY_SENTINEL_DATE`/single-date/multi-date-OR branches of the `getDays` result. */
export function buildDateRangeAndDayOfWeekCondition(
  dateRange: DateRangeFilter | null | undefined,
  dayOfWeek: DayOfWeek[] | DayOfWeek | string | null | undefined,
  zonedCurrentDate: Date,
  zonedTodayISO: string
): QueryCondition | undefined {
  if (!dateRange && !dayOfWeek) return undefined;
  const r = dateRange
    ? resolveDateRangeFilter(
        dateRange.anchor,
        dateRange.offsetAmount,
        dateRange.offsetUnit,
        zonedCurrentDate,
        { spanAmount: dateRange.spanAmount, spanUnit: dateRange.spanUnit }
      )
    : {
        from: zonedTodayISO,
        to: fmt(new Date(Date.UTC(
          zonedCurrentDate.getUTCFullYear(),
          zonedCurrentDate.getUTCMonth(),
          zonedCurrentDate.getUTCDate() + DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS
        )))
      };
  if (dayOfWeek) {
    const dowArray = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek as DayOfWeek];
    const dates = getDays(r.from, r.to, dowArray);
    if (dates.length === 0) {
      return { field: 'scheduleDateRange', operator: 'overlaps', value: { from: NO_MATCHING_WEEKDAY_SENTINEL_DATE, to: NO_MATCHING_WEEKDAY_SENTINEL_DATE } };
    } else if (dates.length === 1) {
      return { field: 'scheduleDateRange', operator: 'overlaps', value: { from: dates[0], to: dates[0] } };
    } else {
      return {
        operator: 'or',
        conditions: dates.map(d => ({ field: 'scheduleDateRange', operator: 'overlaps', value: { from: d, to: d } }))
      };
    }
  }
  return { field: 'scheduleDateRange', operator: 'overlaps', value: { from: r.from, to: r.to } };
}

/** Task 1 leaf builder -- the `filter.location` block, verbatim, including the existing
 * "cannot specify both" guard (see AC3; do not remove or relax it). */
export function buildLocationCondition(location: LocationFilter | null | undefined): QueryCondition | undefined {
  if (!location) return undefined;
  const { coordinates, radiusMeters, adminArea } = location;
  if ((coordinates || radiusMeters !== undefined) && adminArea) throw new Error('Cannot specify both coordinates and adminArea in location filter');
  if (adminArea) {
    return { field: 'adminArea', operator: 'eq', value: adminArea };
  } else if (coordinates) {
    return {
      field: 'scheduleCoordinates',
      operator: 'withinRadius',
      value: { latitude: coordinates.lat, longitude: coordinates.lng, radiusKm: (radiusMeters ?? 10000) / 1000 }
    };
  }
  return undefined;
}

/** Task 1 leaf builder -- the `filter.venueType` block, verbatim guard. */
export function buildVenueTypeCondition(venueType: string | null | undefined): QueryCondition | undefined {
  if (venueType) return { field: 'venueType', operator: 'eq', value: venueType };
  return undefined;
}

/** Task 1 leaf builder -- the `filter.isFree` block. Preserves the existing `isFree !== undefined`
 * guard exactly (not also `!== null` -- a literal `null` still produces an `eq`/`value: null`
 * condition; do not "fix" this while extracting it, see Task 1 notes). */
export function buildIsFreeCondition(isFree: boolean | null | undefined): QueryCondition | undefined {
  if (isFree !== undefined) return { field: 'isFree', operator: 'eq', value: isFree };
  return undefined;
}

export function buildEventsQueryCondition({
  search, types, categories, nearby, filter, currentDate, temporalFilter, timezone
}: BuildEventsQueryConditionInput): QueryCondition | undefined {
  const conditions: QueryCondition[] = [];
  const now = currentDate ?? new Date();
  // DW-074: zoned "today" is used for every date-boundary computation below (the resolved
  // dateRange/dayOfWeek window, buildTemporalCondition's today/tomorrow) -- never for the
  // notEnded instant comparison, which stays `now.toISOString()` inside buildTemporalCondition.
  const { zonedTodayISO, zonedCurrentDate } = resolveZonedToday(now, timezone);
  if (filter) {
    const accountIdCondition = buildAccountIdCondition(filter.accountId);
    if (accountIdCondition) conditions.push(accountIdCondition);
    const typesCondition = buildTypesCondition(filter.types);
    if (typesCondition) conditions.push(typesCondition);
    const categoriesCondition = buildCategoriesCondition(filter.categories);
    if (categoriesCondition) conditions.push(categoriesCondition);
    const keywordCondition = buildKeywordCondition(filter.keyword);
    if (keywordCondition) conditions.push(keywordCondition);
    // Story 9.3: see the EventFilterInput.dayOfWeek widening note above -- the runtime value is
    // always a plain DayOfWeek-valued string/array regardless of which nominal enum produced it.
    const dateRangeAndDayOfWeekCondition = buildDateRangeAndDayOfWeekCondition(
      filter.dateRange, filter.dayOfWeek as DayOfWeek[] | DayOfWeek | string | null | undefined, zonedCurrentDate, zonedTodayISO
    );
    if (dateRangeAndDayOfWeekCondition) conditions.push(dateRangeAndDayOfWeekCondition);
    const locationCondition = buildLocationCondition(filter.location);
    if (locationCondition) conditions.push(locationCondition);
    const venueTypeCondition = buildVenueTypeCondition(filter.venueType);
    if (venueTypeCondition) conditions.push(venueTypeCondition);
    const isFreeCondition = buildIsFreeCondition(filter.isFree);
    if (isFreeCondition) conditions.push(isFreeCondition);
    const filterTemporalCondition = buildTemporalCondition(filter.temporalFilter, now, timezone);
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
    const topLevelTemporalCondition = buildTemporalCondition(temporalFilter, now, timezone);
    if (topLevelTemporalCondition) conditions.push(topLevelTemporalCondition);
  }
  if (conditions.length === 0) return undefined;
  return { operator: 'and', conditions };
}
