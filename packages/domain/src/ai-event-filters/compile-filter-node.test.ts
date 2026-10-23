import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { compileFilterNodeToQueryCondition } from './compile-filter-node.js';
import { expressionFromFlatFilter } from './flat-filter-conversion.js';
import type { FilterLeaf, FilterNode } from './filter-node.js';
import { isGroupCondition } from '../query/queryDsl.js';
import {
  buildEventsQueryCondition,
  buildDateRangeAndDayOfWeekCondition,
  type EventFilterInput,
  resolveZonedToday,
  DayOfWeek,
  TemporalFilter,
  DateAnchor,
  DateOffsetUnit,
} from '../events/buildEventsQueryCondition.js';
import { EVENT_FILTER_FIXTURES } from '../events/buildEventsQueryCondition.test.js';

const MOCK_DATE = new Date('2026-08-29T12:00:00Z'); // a Saturday

describe('compileFilterNodeToQueryCondition: AC2 parity (flat === expression)', () => {
  for (const [i, fixture] of EVENT_FILTER_FIXTURES.entries()) {
    it(`fixture[${i}] compiles identically through both paths`, () => {
      const flatResult = buildEventsQueryCondition({ filter: fixture, currentDate: MOCK_DATE });
      const expressionResult = compileFilterNodeToQueryCondition(expressionFromFlatFilter(fixture), {
        currentDate: MOCK_DATE,
      });
      assert.deepEqual(expressionResult, flatResult);
    });
  }
});

describe('compileFilterNodeToQueryCondition: AC1 native-inversion shapes', () => {
  const accountIdLeaf: FilterLeaf = { field: 'accountId', value: 'acc-123' };
  const typeLeaf: FilterLeaf = { field: 'type', value: [EventType.FESTIVAL] };
  const categoryLeaf: FilterLeaf = { field: 'category', value: [EventCategory.MUSIC] };
  const locationAdminAreaLeaf: FilterLeaf = { field: 'locationAdminArea', value: 'Sleman' };
  const isFreeLeaf: FilterLeaf = { field: 'isFree', value: true };
  const venueTypeLeaf: FilterLeaf = { field: 'venueType', value: 'Mall' };

  it('NOT(accountId leaf) -> ne', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: accountIdLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'socialMediaAccountProfileId', operator: 'ne', value: 'acc-123' });
  });

  it('NOT(type leaf) -> notIn', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: typeLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'types', operator: 'notIn', value: ['FESTIVAL'] });
  });

  it('NOT(category leaf) -> notIn', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: categoryLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'categories', operator: 'notIn', value: ['MUSIC'] });
  });

  it('NOT(locationAdminArea leaf) -> ne', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: locationAdminAreaLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'adminArea', operator: 'ne', value: 'Sleman' });
  });

  it('NOT(isFree leaf) -> ne', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: isFreeLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'isFree', operator: 'ne', value: true });
  });

  it('NOT(venueType leaf) -> ne', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: venueTypeLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'venueType', operator: 'ne', value: 'Mall' });
  });
});

describe("compileFilterNodeToQueryCondition: AC1 'not'-group fallback shapes", () => {
  const dateRangeLeaf: FilterLeaf = {
    field: 'dateRange',
    value: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY },
  };
  const dayOfWeekLeaf: FilterLeaf = { field: 'dayOfWeek', value: [DayOfWeek.FRI] };
  const locationProximityLeaf: FilterLeaf = {
    field: 'locationProximity',
    value: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 5000 },
  };
  const temporalUpcomingLeaf: FilterLeaf = { field: 'temporalFilter', value: TemporalFilter.UPCOMING };
  const temporalTodayLeaf: FilterLeaf = { field: 'temporalFilter', value: TemporalFilter.TODAY };
  const plainKeywordLeaf: FilterLeaf = { field: 'keyword', value: 'jazz' };

  for (const [name, leaf] of [
    ['dateRange', dateRangeLeaf],
    ['dayOfWeek', dayOfWeekLeaf],
    ['locationProximity', locationProximityLeaf],
    ['temporalFilter UPCOMING', temporalUpcomingLeaf],
    ['temporalFilter TODAY', temporalTodayLeaf],
    ['keyword (plain text)', plainKeywordLeaf],
  ] as const) {
    it(`NOT(${name} leaf) compiles to a 'not' group wrapping the compiled child`, () => {
      const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: leaf }, { currentDate: MOCK_DATE });
      assert.ok(result);
      assert.ok(isGroupCondition(result));
      assert.equal(result.operator, 'not');
      assert.equal(result.conditions.length, 1);
      const positiveCompiled = compileFilterNodeToQueryCondition(leaf, { currentDate: MOCK_DATE });
      assert.deepEqual(result.conditions[0], positiveCompiled);
    });
  }

  it("NOT(keyword leaf, hashtag '#jazz') inverts natively to notIn (shape-driven, not field-driven)", () => {
    const hashtagKeywordLeaf: FilterLeaf = { field: 'keyword', value: '#jazz' };
    const result = compileFilterNodeToQueryCondition({ op: 'NOT', child: hashtagKeywordLeaf }, { currentDate: MOCK_DATE });
    assert.deepEqual(result, { field: 'hashtags', operator: 'notIn', value: ['jazz'] });
  });
});

describe('compileFilterNodeToQueryCondition: AC1 group mapping', () => {
  it('an AND group of 2+ leaves compiles to { operator: "and", conditions: [...] } in original order', () => {
    const node: FilterNode = {
      op: 'AND',
      children: [
        { field: 'venueType', value: 'Mall' },
        { field: 'isFree', value: true },
      ],
    };
    const result = compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE });
    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'venueType', operator: 'eq', value: 'Mall' },
        { field: 'isFree', operator: 'eq', value: true },
      ],
    });
  });

  it('an OR group of 2+ leaves compiles to { operator: "or", conditions: [...] } in original order', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'venueType', value: 'Mall' },
        { field: 'isFree', value: true },
      ],
    };
    const result = compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE });
    assert.deepEqual(result, {
      operator: 'or',
      conditions: [
        { field: 'venueType', operator: 'eq', value: 'Mall' },
        { field: 'isFree', operator: 'eq', value: true },
      ],
    });
  });

  it('an empty AND group compiles to undefined', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'AND', children: [] }, { currentDate: MOCK_DATE });
    assert.equal(result, undefined);
  });

  it('an empty OR group compiles to undefined', () => {
    const result = compileFilterNodeToQueryCondition({ op: 'OR', children: [] }, { currentDate: MOCK_DATE });
    assert.equal(result, undefined);
  });
});

describe('compileFilterNodeToQueryCondition: AC3 location-leaf OR-legality', () => {
  it('an OR of locationProximity and locationAdminArea leaves compiles without throwing', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'locationProximity', value: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 5000 } },
        { field: 'locationAdminArea', value: 'Sleman' },
      ],
    };
    assert.doesNotThrow(() => compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE }));
    const result = compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE });
    assert.deepEqual(result, {
      operator: 'or',
      conditions: [
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: { latitude: -7.7, longitude: 110.3, radiusKm: 5 } },
        { field: 'adminArea', operator: 'eq', value: 'Sleman' },
      ],
    });
  });
});

describe('compileFilterNodeToQueryCondition: compileAndChildren sibling-merge', () => {
  const dateRangeValue = { anchor: DateAnchor.THIS_WEEK, offsetAmount: 0, offsetUnit: DateOffsetUnit.WEEK };
  const dayOfWeekValue = [DayOfWeek.FRI];

  it('an AND of a dateRange leaf and a dayOfWeek leaf compiles to ONE condition, matching buildDateRangeAndDayOfWeekCondition directly', () => {
    const node: FilterNode = {
      op: 'AND',
      children: [
        { field: 'dateRange', value: dateRangeValue },
        { field: 'dayOfWeek', value: dayOfWeekValue },
      ],
    };
    const result = compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE });
    const { zonedTodayISO, zonedCurrentDate } = resolveZonedToday(MOCK_DATE, undefined);
    const merged = buildDateRangeAndDayOfWeekCondition(dateRangeValue, dayOfWeekValue, zonedCurrentDate, zonedTodayISO);
    // The top-level AND group never collapses to its bare single compiled child (Dev Notes
    // decision 6) -- it wraps the one merged condition, matching the legacy flat path's own
    // unconditional `{ operator: 'and', conditions }` shape (see e.g. buildEventsQueryCondition's
    // "composes dateRange with dayOfWeek" test, which wraps its single condition the same way).
    assert.deepEqual(result, { operator: 'and', conditions: [merged] });
  });

  it('an OR of the same two leaves compiles to TWO independent conditions (sibling-merge is AND-only)', () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'dateRange', value: dateRangeValue },
        { field: 'dayOfWeek', value: dayOfWeekValue },
      ],
    };
    const result = compileFilterNodeToQueryCondition(node, { currentDate: MOCK_DATE });
    assert.ok(result);
    assert.ok(isGroupCondition(result));
    assert.equal(result.operator, 'or');
    assert.equal(result.conditions.length, 2);
  });
});

describe('compileFilterNodeToQueryCondition: normalization-before-compile', () => {
  it('a non-normalized nested AND(AND(leafA), leafB) compiles identically to its normalized AND(leafA, leafB) form', () => {
    const leafA: FilterLeaf = { field: 'venueType', value: 'Mall' };
    const leafB: FilterLeaf = { field: 'isFree', value: true };
    const nested: FilterNode = { op: 'AND', children: [{ op: 'AND', children: [leafA] }, leafB] };
    const flat: FilterNode = { op: 'AND', children: [leafA, leafB] };
    const nestedResult = compileFilterNodeToQueryCondition(nested, { currentDate: MOCK_DATE });
    const flatResult = compileFilterNodeToQueryCondition(flat, { currentDate: MOCK_DATE });
    assert.deepEqual(nestedResult, flatResult);
  });
});

describe('compileFilterNodeToQueryCondition: single-leaf group parity (Epic 9 review P1)', () => {
  const cases: Array<[string, EventFilterInput]> = [
    ['keyword', { keyword: 'jazz' }],
    ['temporalFilter', { temporalFilter: 'TODAY' }],
    ['single weekday', { dayOfWeek: 'FRI' }],
    ['multi weekday', { dayOfWeek: ['SAT', 'SUN'] }],
  ];
  for (const [name, flat] of cases) {
    it(`a flat ${name} filter and its AND[leaf] expression compile to the same wrapped condition`, () => {
      const flatCondition = buildEventsQueryCondition({ filter: flat, currentDate: MOCK_DATE });
      const expressionCondition = compileFilterNodeToQueryCondition(expressionFromFlatFilter(flat), {
        currentDate: MOCK_DATE,
      });
      assert.deepEqual(expressionCondition, flatCondition);
    });
  }
});
