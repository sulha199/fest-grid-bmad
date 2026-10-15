import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventsQueryCondition,
  resolveDateRangeFilter,
  resolveTodayISO,
  getDays,
  DayOfWeek,
  DATE_OFFSET_AMOUNT_BOUNDS,
  DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS,
  NO_MATCHING_WEEKDAY_SENTINEL_DATE,
  type EventFilterInput,
} from './buildEventsQueryCondition.js';
import { compileFilterNodeToQueryCondition } from '../ai-event-filters/compile-filter-node.js';
import type { FilterNode } from '../ai-event-filters/filter-node.js';

/**
 * Populated-field `EventFilterInput` fixtures exercised below. Exported so Story 9.1a's
 * `flat-filter-conversion.test.ts` (AC3) can reuse them directly as the `expressionFromFlatFilter`
 * <-> `flatFilterFromExpression` round-trip's input set, instead of inventing a parallel fixture
 * set. The "coordinates + adminArea together" case is intentionally excluded here -- it's an
 * invalid combination `buildEventsQueryCondition` itself rejects (see the "throws" test below),
 * not a valid round-trip target.
 */
export const EVENT_FILTER_FIXTURES: EventFilterInput[] = [
  { accountId: 'acc-123', types: ['FESTIVAL'], categories: ['MUSIC'], keyword: 'jazz' },
  { dateRange: { anchor: 'TODAY', offsetAmount: 1, offsetUnit: 'DAY' } },
  { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: 'FRI' },
  { dateRange: { anchor: 'THIS_MONTH', offsetAmount: 0, offsetUnit: 'MONTH' }, dayOfWeek: 'FRI' },
  { location: { adminArea: 'Sleman' } },
  { location: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 5000 } },
  { venueType: 'Mall', isFree: true },
];

describe('getDays (AC1, Task 1)', () => {
  it('returns every date matching a single weekday (regression: unchanged single-value behavior)', () => {
    // 2026-08-01 is a Saturday; 2026-08-31 is a Monday.
    assert.deepEqual(getDays('2026-08-01', '2026-08-31', [DayOfWeek.FRI]), [
      '2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'
    ]);
  });
  it('returns the union of dates matching any of 2+ weekdays', () => {
    assert.deepEqual(getDays('2026-08-01', '2026-08-14', [DayOfWeek.MON, DayOfWeek.TUE]), [
      '2026-08-03', '2026-08-04', '2026-08-10', '2026-08-11'
    ]);
  });
  it('returns an empty array when dow is empty', () => {
    assert.deepEqual(getDays('2026-08-01', '2026-08-31', []), []);
  });
  it('returns every date in range when all 7 weekdays are supplied', () => {
    const res = getDays('2026-08-01', '2026-08-07', [
      DayOfWeek.SUN, DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT
    ]);
    assert.deepEqual(res, [
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'
    ]);
  });
});
describe('buildEventsQueryCondition', () => {
  it('returns undefined when no filters are provided', () => {
    assert.equal(buildEventsQueryCondition({ search: ' ', types: [], categories: [] }), undefined);
  });
  it('builds search', () => {
    const res = buildEventsQueryCondition({ search: 'jazz', types: [], categories: [] });
    assert.ok(res);
  });
  it('builds tags', () => {
    const res = buildEventsQueryCondition({ search: '#Jogja', types: [], categories: [] });
    assert.deepEqual(res, { operator: 'and', conditions: [{ field: 'hashtags', operator: 'in', value: ['jogja'] }] });
  });
  describe('structured filter input', () => {
    const mockDate = new Date('2026-08-29T12:00:00Z');
    it('filters by accountId, types, categories, keyword', () => {
      const res = buildEventsQueryCondition({
        filter: EVENT_FILTER_FIXTURES[0]
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [
          { field: 'socialMediaAccountProfileId', operator: 'eq', value: 'acc-123' },
          { field: 'types', operator: 'in', value: ['FESTIVAL'] },
          { field: 'categories', operator: 'in', value: ['MUSIC'] },
          { operator: 'or', conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' }
          ] }
        ]
      });
    });
    it('filters by dateRange TODAY', () => {
      const res = buildEventsQueryCondition({
        filter: EVENT_FILTER_FIXTURES[1], currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-30', to: '2026-08-30' } }]
      });
    });
    it('composes dateRange with dayOfWeek', () => {
      const res = buildEventsQueryCondition({
        filter: EVENT_FILTER_FIXTURES[2], currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-28', to: '2026-08-28' } }]
      });
    });
    it('composes dateRange spanning weeks with dayOfWeek', () => {
      const res = buildEventsQueryCondition({
        filter: EVENT_FILTER_FIXTURES[3], currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{
          operator: 'or',
          conditions: [
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-07', to: '2026-08-07' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-14', to: '2026-08-14' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-21', to: '2026-08-21' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-28', to: '2026-08-28' } }
          ]
        }]
      });
    });
    it('resolves THIS_MONTH shifted by DAY offset as a whole-month window shift, not a day-of-month slice', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 5, 'DAY', mockDate);
      assert.deepEqual(res, { from: '2026-08-06', to: '2026-09-05' });
    });
    it('resolves THIS_MONTH shifted by WEEK offset as a whole-month window shift', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 1, 'WEEK', mockDate);
      assert.deepEqual(res, { from: '2026-08-08', to: '2026-09-07' });
    });
    it('resolves THIS_MONTH shifted by MONTH offset without day-of-month overflow', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 1, 'MONTH', mockDate);
      assert.deepEqual(res, { from: '2026-09-01', to: '2026-09-30' });
    });
    it('filters by location adminArea', () => {
      const res = buildEventsQueryCondition({ filter: EVENT_FILTER_FIXTURES[4] });
      assert.deepEqual(res, { operator: 'and', conditions: [{ field: 'adminArea', operator: 'eq', value: 'Sleman' }] });
    });
    it('filters by location coordinates', () => {
      const res = buildEventsQueryCondition({ filter: EVENT_FILTER_FIXTURES[5] });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleCoordinates', operator: 'withinRadius', value: { latitude: -7.7, longitude: 110.3, radiusKm: 5 } }]
      });
    });
    it('throws error when coordinates and adminArea are specified together', () => {
      assert.throws(() => {
        buildEventsQueryCondition({ filter: { location: { coordinates: { lat: -7.7, lng: 110.3 }, adminArea: 'Sleman' } } });
      }, /Cannot specify both coordinates and adminArea/);
    });
    it('filters by venueType and isFree', () => {
      const res = buildEventsQueryCondition({ filter: EVENT_FILTER_FIXTURES[6] });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [
          { field: 'venueType', operator: 'eq', value: 'Mall' },
          { field: 'isFree', operator: 'eq', value: true }
        ]
      });
    });
  });
});

describe('resolveDateRangeFilter span widening (AC1, Task 10)', () => {
  const mockDate = new Date('2026-08-29T00:00:00Z'); // a Saturday

  it('widens the resolved `to` boundary by spanAmount days for spanUnit DAY ("next 7 days")', () => {
    const res = resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 7, spanUnit: 'DAY' });
    assert.deepEqual(res, { from: '2026-08-29', to: '2026-09-05' });
  });

  it('widens the resolved `to` boundary by spanAmount * 7 days for spanUnit WEEK ("next 2 weeks")', () => {
    const res = resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 2, spanUnit: 'WEEK' });
    assert.deepEqual(res, { from: '2026-08-29', to: '2026-09-12' });
  });

  it('widens `to` through the end of the current month for spanUnit MONTH, spanAmount 1 ("rest of this month")', () => {
    const res = resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 1, spanUnit: 'MONTH' });
    assert.deepEqual(res, { from: '2026-08-29', to: '2026-08-31' });
  });

  it('widens `to` through the end of the *next* month for spanUnit MONTH, spanAmount 2', () => {
    const res = resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 2, spanUnit: 'MONTH' });
    assert.deepEqual(res, { from: '2026-08-29', to: '2026-09-30' });
  });

  it('is additive-only: omitting spanAmount/spanUnit leaves resolution byte-identical to the 4-arg call', () => {
    const withoutSpan = resolveDateRangeFilter('TODAY', 1, 'DAY', mockDate);
    const withEmptySpan = resolveDateRangeFilter('TODAY', 1, 'DAY', mockDate, {});
    assert.deepEqual(withoutSpan, { from: '2026-08-30', to: '2026-08-30' });
    assert.deepEqual(withEmptySpan, withoutSpan);
  });

  it('throws a descriptive Error when offsetAmount exceeds its DATE_OFFSET_AMOUNT_BOUNDS bound', () => {
    assert.throws(() => resolveDateRangeFilter('TODAY', 91, 'DAY', mockDate), /offsetAmount.*exceeds.*bound/);
    assert.throws(() => resolveDateRangeFilter('TODAY', 53, 'WEEK', mockDate), /offsetAmount.*exceeds.*bound/);
    assert.throws(() => resolveDateRangeFilter('TODAY', 25, 'MONTH', mockDate), /offsetAmount.*exceeds.*bound/);
  });

  it('throws a descriptive Error when spanAmount exceeds its DATE_OFFSET_AMOUNT_BOUNDS bound', () => {
    assert.throws(
      () => resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 91, spanUnit: 'DAY' }),
      /spanAmount.*exceeds.*bound/
    );
  });

  it('throws when spanAmount is not a positive integer >= 1', () => {
    assert.throws(
      () => resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 0, spanUnit: 'DAY' }),
      /spanAmount.*positive integer/
    );
    assert.throws(
      () => resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: 1.5, spanUnit: 'DAY' }),
      /spanAmount.*positive integer/
    );
    assert.throws(
      () => resolveDateRangeFilter('TODAY', 0, 'DAY', mockDate, { spanAmount: -2, spanUnit: 'DAY' }),
      /spanAmount.*positive integer/
    );
  });

  it('confirms the 3 pre-existing THIS_MONTH DAY/WEEK/MONTH-offset tests stay unaffected by span/bound changes', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 5, 'DAY', new Date('2026-08-29T12:00:00Z')), { from: '2026-08-06', to: '2026-09-05' });
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 1, 'WEEK', new Date('2026-08-29T12:00:00Z')), { from: '2026-08-08', to: '2026-09-07' });
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 1, 'MONTH', new Date('2026-08-29T12:00:00Z')), { from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('resolveTodayISO (AC3, DW-074, Task 10)', () => {
  it('computes the zoned Y-M-D "today" when the instant is already a different calendar day in that timezone', () => {
    // 2026-08-29T23:30:00Z is still Aug 29 in UTC, but already Aug 30 06:30 local in Asia/Jakarta (UTC+7).
    const instant = new Date('2026-08-29T23:30:00Z');
    assert.equal(resolveTodayISO(instant, 'Asia/Jakarta'), '2026-08-30');
    assert.equal(resolveTodayISO(instant), '2026-08-29');
  });

  it('degrades gracefully to the UTC calendar date on an absent or invalid timezone', () => {
    const instant = new Date('2026-08-29T23:30:00Z');
    assert.equal(resolveTodayISO(instant, null), '2026-08-29');
    assert.equal(resolveTodayISO(instant, 'Not/ARealTimezone'), '2026-08-29');
  });
});

describe('named fallback/sentinel/bound constants (DW-075, DW-076, DW-077, Task 10)', () => {
  it('have the exact documented shapes', () => {
    assert.deepEqual(DATE_OFFSET_AMOUNT_BOUNDS, { DAY: 90, WEEK: 52, MONTH: 24 });
    assert.equal(DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS, 90);
    assert.equal(NO_MATCHING_WEEKDAY_SENTINEL_DATE, '1970-01-01');
  });
});

describe('buildEventsQueryCondition: multi-weekday, timezone, and sentinel composition (AC2, AC3, Task 10)', () => {
  const mockDate = new Date('2026-08-29T12:00:00Z'); // a Saturday

  it('composes a dayOfWeek-only filter with multiple weekdays (weekends) using the DAY_OF_WEEK_ONLY_LOOKAHEAD_DAYS window', () => {
    const res = buildEventsQueryCondition({
      filter: { dayOfWeek: [DayOfWeek.SAT, DayOfWeek.SUN] },
      currentDate: mockDate
    });
    assert.ok(res);
    // 2026-08-29 is itself a Saturday, so it's included in the matched set.
    if (res && res.operator === 'and') {
      const first = res.conditions[0];
      assert.equal(first.operator, 'or');
    }
  });

  it('falls back to the sentinel date when a dateRange + dayOfWeek combination matches no date', () => {
    // A single-day dateRange (TODAY, offset 0) on a Saturday, filtered to MON -- no overlap.
    const res = buildEventsQueryCondition({
      filter: {
        dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' },
        dayOfWeek: DayOfWeek.MON
      },
      currentDate: mockDate
    });
    assert.deepEqual(res, {
      operator: 'and',
      conditions: [{
        field: 'scheduleDateRange',
        operator: 'overlaps',
        value: { from: NO_MATCHING_WEEKDAY_SENTINEL_DATE, to: NO_MATCHING_WEEKDAY_SENTINEL_DATE }
      }]
    });
  });

  it('resolves "today" from the timezone param, not the raw UTC instant, for dateRange resolution', () => {
    const lateUtcInstant = new Date('2026-08-29T23:30:00Z'); // already Aug 30 in Asia/Jakarta
    const res = buildEventsQueryCondition({
      filter: { dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } },
      currentDate: lateUtcInstant,
      timezone: 'Asia/Jakarta'
    });
    assert.deepEqual(res, {
      operator: 'and',
      conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-30', to: '2026-08-30' } }]
    });
  });

  it('resolves the TODAY temporalFilter boundary from the timezone param, leaving the notEnded instant untouched', () => {
    const lateUtcInstant = new Date('2026-08-29T23:30:00Z');
    const res = buildEventsQueryCondition({
      temporalFilter: 'TODAY',
      currentDate: lateUtcInstant,
      timezone: 'Asia/Jakarta'
    });
    assert.deepEqual(res, {
      operator: 'and',
      conditions: [{
        operator: 'and',
        conditions: [
          { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-30', to: '2026-08-30' } },
          { field: 'scheduleEndedBoundary', operator: 'notEnded', value: { now: lateUtcInstant.toISOString(), today: '2026-08-30' } }
        ]
      }]
    });
  });
});

describe('buildEventsQueryCondition: expression branch (Story 9.4a, AC2, Task 9)', () => {
  it('an expression-only call returns the exact same compiled condition as calling compileFilterNodeToQueryCondition directly', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        { field: 'type', value: ['FESTIVAL'] },
        { field: 'type', value: ['CONCERT'] },
      ],
    };
    const res = buildEventsQueryCondition({ expression });
    const expected = compileFilterNodeToQueryCondition(expression, {});
    assert.deepEqual(res, expected);
  });

  it('when both filter and expression are supplied, expression wins and filter/search/types/categories/nearby/temporalFilter are all ignored', () => {
    const expression: FilterNode = { field: 'isFree', value: true };
    const res = buildEventsQueryCondition({
      expression,
      filter: { types: ['FESTIVAL'], keyword: 'jazz' },
      search: 'blues',
      types: ['CONCERT'],
      categories: ['MUSIC'],
      nearby: { latitude: -7.7, longitude: 110.3, radiusKm: 5 },
      temporalFilter: 'TODAY',
    });
    const expected = compileFilterNodeToQueryCondition(expression, {});
    assert.deepEqual(res, expected);
    assert.deepEqual(res, { field: 'isFree', operator: 'eq', value: true });
  });

  it('an expression that compiles to undefined (an empty AND group) returns undefined, matching the existing "no conditions" return shape', () => {
    const expression: FilterNode = { op: 'AND', children: [] };
    const res = buildEventsQueryCondition({ expression });
    assert.equal(res, undefined);
  });

  it('threads currentDate/timezone through to the compiled expression, matching the flat-filter branch\'s own timezone resolution', () => {
    const lateUtcInstant = new Date('2026-08-29T23:30:00Z'); // already Aug 30 in Asia/Jakarta
    const expression: FilterNode = { field: 'dateRange', value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } };
    const res = buildEventsQueryCondition({ expression, currentDate: lateUtcInstant, timezone: 'Asia/Jakarta' });
    assert.deepEqual(res, { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-30', to: '2026-08-30' } });
  });
});