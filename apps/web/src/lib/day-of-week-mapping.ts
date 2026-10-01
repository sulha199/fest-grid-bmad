import { DayOfWeek as GqlDayOfWeek } from '../generated/graphql';
import { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';

/**
 * AD-19 Rule 2: explicit `Record`-based mapping between the GraphQL-generated `DayOfWeek` enum
 * (nominal, distinct type even though its string values coincide with the domain enum's) and
 * `packages/domain`'s own `DayOfWeek` enum. Never rely on an implicit cast or the two enums'
 * string values coincidentally matching — TypeScript enums are nominal, not structurally
 * compatible, so a `GqlDayOfWeek[]` cannot satisfy a `DomainDayOfWeek[]`-typed field without this
 * explicit conversion. This `Record` is exhaustive by construction: removing a member from either
 * enum without updating this map is a TypeScript compile error (verified manually during
 * development by temporarily deleting one entry and confirming the error; do not ship the
 * deletion).
 */
export const GQL_TO_DOMAIN_DAY_OF_WEEK: Record<GqlDayOfWeek, DomainDayOfWeek> = {
  [GqlDayOfWeek.Mon]: DomainDayOfWeek.MON,
  [GqlDayOfWeek.Tue]: DomainDayOfWeek.TUE,
  [GqlDayOfWeek.Wed]: DomainDayOfWeek.WED,
  [GqlDayOfWeek.Thu]: DomainDayOfWeek.THU,
  [GqlDayOfWeek.Fri]: DomainDayOfWeek.FRI,
  [GqlDayOfWeek.Sat]: DomainDayOfWeek.SAT,
  [GqlDayOfWeek.Sun]: DomainDayOfWeek.SUN,
};

/**
 * Maps a schedule's GraphQL-typed `applicableDaysOfWeek` to the domain enum consumed by
 * `getDays`/occurrence logic (AC4/AC5). Returns `undefined` for `null`/`undefined` input so
 * callers can pass a schedule's optional field straight through without a separate null check.
 */
export function mapDaysOfWeekToDomain(
  days: GqlDayOfWeek[] | null | undefined
): DomainDayOfWeek[] | undefined {
  if (!days) return undefined;
  return days.map((d) => GQL_TO_DOMAIN_DAY_OF_WEEK[d]);
}
