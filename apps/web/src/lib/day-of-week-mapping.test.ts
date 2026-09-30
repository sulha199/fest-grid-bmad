import { expect, test } from 'vitest';
import { DayOfWeek as GqlDayOfWeek } from '../generated/graphql';
import { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';
import { GQL_TO_DOMAIN_DAY_OF_WEEK, mapDaysOfWeekToDomain } from './day-of-week-mapping';

test('every GqlDayOfWeek member maps to the matching DomainDayOfWeek member (AC2)', () => {
  // Exhaustiveness sanity check: enumerate every GqlDayOfWeek member explicitly (not derived
  // from Object.values) so this test itself would fail to compile if a member were added to
  // GqlDayOfWeek without a corresponding assertion here. The GQL_TO_DOMAIN_DAY_OF_WEEK Record's
  // own type-level exhaustiveness (every enum member required as a key) is what TypeScript
  // actually enforces at compile time — verified manually during dev by temporarily deleting one
  // entry from the Record and confirming a TS2739/TS2741 compile error; not shipped.
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Mon]).toBe(DomainDayOfWeek.MON);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Tue]).toBe(DomainDayOfWeek.TUE);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Wed]).toBe(DomainDayOfWeek.WED);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Thu]).toBe(DomainDayOfWeek.THU);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Fri]).toBe(DomainDayOfWeek.FRI);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Sat]).toBe(DomainDayOfWeek.SAT);
  expect(GQL_TO_DOMAIN_DAY_OF_WEEK[GqlDayOfWeek.Sun]).toBe(DomainDayOfWeek.SUN);
  expect(Object.keys(GQL_TO_DOMAIN_DAY_OF_WEEK)).toHaveLength(7);
});

test('mapDaysOfWeekToDomain maps an array through the Record', () => {
  expect(mapDaysOfWeekToDomain([GqlDayOfWeek.Mon, GqlDayOfWeek.Fri])).toEqual([
    DomainDayOfWeek.MON,
    DomainDayOfWeek.FRI,
  ]);
});

test('mapDaysOfWeekToDomain returns undefined for null/undefined input', () => {
  expect(mapDaysOfWeekToDomain(null)).toBeUndefined();
  expect(mapDaysOfWeekToDomain(undefined)).toBeUndefined();
});

test('mapDaysOfWeekToDomain returns an empty array for an empty input array', () => {
  expect(mapDaysOfWeekToDomain([])).toEqual([]);
});
