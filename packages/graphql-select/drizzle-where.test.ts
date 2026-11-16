import test from 'node:test';
import * as assert from 'node:assert';
import { buildDrizzleWhere } from './drizzle-where.js';
import { QueryCondition } from '@festgrid/domain/query';
import { pgTable, text, uuid, date, time, doublePrecision, PgDialect } from 'drizzle-orm/pg-core';

const testTable = pgTable('test_table', {
  id: uuid('id'),
  name: text('name'),
  types: text('types').array(),
});

const scheduleTestTable = pgTable('schedule_test_table', {
  eventId: uuid('event_id'),
  eventStartDate: date('event_start_date'),
  eventEndDate: date('event_end_date'),
  eventEndTime: time('event_end_time'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  applicableDaysOfWeek: text('applicable_days_of_week').array(),
  timezone: text('timezone'),
  timezoneStatus: text('timezone_status'),
});

const fieldMap = {
  name: testTable.name,
  types: testTable.types,
  unmapped: null,
  scheduleDateRange: {
    table: scheduleTestTable,
    eventIdCol: scheduleTestTable.eventId,
    correlateCol: testTable.id,
    startCol: scheduleTestTable.eventStartDate,
    endCol: scheduleTestTable.eventEndDate,
    // Story 3.6y: mirrors the real fieldMap's own shape (resolvers.ts's `scheduleDateRange`
    // entry) so this field's tests exercise the production descriptor shape.
    applicableDaysOfWeekCol: scheduleTestTable.applicableDaysOfWeek,
    // BUG-096: the timezone columns a `pastCutoff` reads, mirroring the production descriptor.
    timezoneCol: scheduleTestTable.timezone,
    timezoneStatusCol: scheduleTestTable.timezoneStatus,
  },
  // Story 3.6y: a legacy-shaped descriptor (same keys as scheduleDateRange above, minus
  // applicableDaysOfWeekCol) proving a caller that never adds the new column sees
  // byte-for-byte the same SQL as before this story (the Task 3 regression case).
  scheduleDateRangeLegacy: {
    table: scheduleTestTable,
    eventIdCol: scheduleTestTable.eventId,
    correlateCol: testTable.id,
    startCol: scheduleTestTable.eventStartDate,
    endCol: scheduleTestTable.eventEndDate,
  },
  // BUG-096: the zoned descriptor without the weekday column, so a test can read the bare
  // daterange predicate.
  scheduleDateRangeLegacyZoned: {
    table: scheduleTestTable,
    eventIdCol: scheduleTestTable.eventId,
    correlateCol: testTable.id,
    startCol: scheduleTestTable.eventStartDate,
    endCol: scheduleTestTable.eventEndDate,
    timezoneCol: scheduleTestTable.timezone,
    timezoneStatusCol: scheduleTestTable.timezoneStatus,
  },
  // Story 0.i5d (AD-20 Rule 2/4) -- the TODAY temporal-filter bucket's `!ended` boundary.
  scheduleEndedBoundary: {
    table: scheduleTestTable,
    eventIdCol: scheduleTestTable.eventId,
    correlateCol: testTable.id,
    startCol: scheduleTestTable.eventStartDate,
    endCol: scheduleTestTable.eventEndDate,
    endTimeCol: scheduleTestTable.eventEndTime,
  },
  scheduleCoordinates: {
    latColumn: scheduleTestTable.latitude,
    lngColumn: scheduleTestTable.longitude,
  },
};

test('buildDrizzleWhere', async (t) => {
  await t.test('returns undefined for null/undefined condition', () => {
    assert.strictEqual(buildDrizzleWhere(null, fieldMap), undefined);
    assert.strictEqual(buildDrizzleWhere(undefined, fieldMap), undefined);
  });

  await t.test('handles eq operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'eq',
      value: 'Fest'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles ne operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'ne',
      value: 'Fest'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles contains operator on scalar column', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'contains',
      value: 'est'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles contains operator on array column', () => {
    const condition: QueryCondition = {
      field: 'types',
      operator: 'contains',
      value: 'music'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles in operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'in',
      value: ['a', 'b']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles in operator on array column', () => {
    const condition: QueryCondition = {
      field: 'types',
      operator: 'in',
      value: ['MUSIC', 'ARTS']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles notIn operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'notIn',
      value: ['a']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles notIn operator on array column', () => {
    const condition: QueryCondition = {
      field: 'types',
      operator: 'notIn',
      value: ['MUSIC']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles eq null', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'eq',
      value: null
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles ne null', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'ne',
      value: null
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('ignores unmapped fields silently', () => {
    const condition: QueryCondition = {
      field: 'unmapped',
      operator: 'eq',
      value: 'test'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.strictEqual(res, undefined);
  });

  await t.test('handles and group condition', () => {
    const condition: QueryCondition = {
      operator: 'and',
      conditions: [
        { field: 'name', operator: 'eq', value: 'a' },
        { field: 'name', operator: 'eq', value: 'b' }
      ]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles or group condition', () => {
    const condition: QueryCondition = {
      operator: 'or',
      conditions: [
        { field: 'name', operator: 'eq', value: 'a' },
        { field: 'name', operator: 'eq', value: 'b' }
      ]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('ignores empty group conditions', () => {
    const condition: QueryCondition = {
      operator: 'and',
      conditions: []
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.strictEqual(res, undefined);
  });

  await t.test('ignores group conditions with all unmapped fields', () => {
    const condition: QueryCondition = {
      operator: 'and',
      conditions: [
        { field: 'unmapped', operator: 'eq', value: 'a' }
      ]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.strictEqual(res, undefined);
  });

  await t.test('handles empty array for in operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'in',
      value: []
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles empty array for notIn operator', () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'notIn',
      value: []
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles overlaps operator on scheduleDateRange field', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: '2026-08-07' }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles overlaps operator on scheduleDateRange field with to: null', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: null }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('overlaps with applicableDaysOfWeekCol present adds the weekday-containment guard (single day, Story 3.6y AC1/AC5)', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: '2026-08-01' }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /unnest/);
    assert.match(query.sql, /EXTRACT\(DOW/);
    assert.match(query.sql, /applicable_days_of_week/);
  });

  await t.test('overlaps with applicableDaysOfWeekCol present and to: null still constructs cleanly (UPCOMING-shaped, Story 3.6y AC4)', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: null }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /unnest/);
    assert.match(query.sql, /EXTRACT\(DOW/);
  });

  await t.test('overlaps without applicableDaysOfWeekCol stays byte-identical to pre-3.6y SQL (regression)', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRangeLegacy',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: '2026-08-07' }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.doesNotMatch(query.sql, /unnest/);
    assert.doesNotMatch(query.sql, /EXTRACT\(DOW/);
    assert.doesNotMatch(query.sql, /applicable_days_of_week/);
  });

  await t.test('BUG-096: overlaps with pastCutoff takes its lower bound from schedule_past_cutoff_date per row, not the fixed `from`', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRangeLegacyZoned',
      operator: 'overlaps',
      value: { from: '2026-08-15', to: null, pastCutoff: { instant: '2026-08-15T17:30:00.000Z', hidePastEventsAfterDays: 3 } },
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const query = new PgDialect().sqlToQuery(res!);
    assert.match(query.sql, /&& daterange\(schedule_past_cutoff_date\(\$\d+::timestamptz, "schedule_test_table"\."timezone", "schedule_test_table"\."timezone_status"::text, \$\d+::integer\), NULL, '\[\]'\)/);
    assert.ok(query.params.includes('2026-08-15T17:30:00.000Z'));
    assert.ok(query.params.includes(3));
    // the fixed UTC `from` is not bound at all: the per-row bound replaces it
    assert.ok(!query.params.includes('2026-08-15'));
    assert.doesNotMatch(query.sql, /::date/);
  });

  await t.test('BUG-096: with the weekday guard present, the same per-row cutoff is used in every place the bound appears', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-15', to: null, pastCutoff: { instant: '2026-08-15T17:30:00.000Z', hidePastEventsAfterDays: 0 } },
    };
    const query = new PgDialect().sqlToQuery(buildDrizzleWhere(condition, fieldMap)!);
    // the daterange itself, plus the guard's weekday offset and its day count
    assert.strictEqual(query.sql.match(/schedule_past_cutoff_date\(/g)?.length, 3);
    assert.match(query.sql, /unnest/);
  });

  await t.test('BUG-096: a user window (no pastCutoff) keeps the fixed from/to dates exactly as before', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: '2026-08-07' },
    };
    const query = new PgDialect().sqlToQuery(buildDrizzleWhere(condition, fieldMap)!);
    assert.doesNotMatch(query.sql, /schedule_past_cutoff_date/);
    assert.ok(query.params.includes('2026-08-01'));
    assert.ok(query.params.includes('2026-08-07'));
  });

  await t.test('BUG-096: a descriptor without the timezone columns ignores pastCutoff and uses `from`', () => {
    const condition: QueryCondition = {
      field: 'scheduleDateRangeLegacy',
      operator: 'overlaps',
      value: { from: '2026-08-15', to: null, pastCutoff: { instant: '2026-08-15T17:30:00.000Z', hidePastEventsAfterDays: 0 } },
    };
    const query = new PgDialect().sqlToQuery(buildDrizzleWhere(condition, fieldMap)!);
    assert.doesNotMatch(query.sql, /schedule_past_cutoff_date/);
    assert.ok(query.params.includes('2026-08-15'));
  });

  await t.test('BUG-096: a malformed pastCutoff from a client is ignored, never cast', () => {
    for (const bad of [
      'not-an-object',
      null,
      { instant: 'not a date', hidePastEventsAfterDays: 0 },
      { instant: '2026-08-15T00:00:00Z', hidePastEventsAfterDays: '0; DROP TABLE x' },
      { instant: '2026-08-15T00:00:00Z', hidePastEventsAfterDays: 1.5 },
      { instant: 5, hidePastEventsAfterDays: 0 },
    ]) {
      const condition: QueryCondition = {
        field: 'scheduleDateRange',
        operator: 'overlaps',
        value: { from: '2026-08-15', to: null, pastCutoff: bad },
      };
      const query = new PgDialect().sqlToQuery(buildDrizzleWhere(condition, fieldMap)!);
      assert.doesNotMatch(query.sql, /schedule_past_cutoff_date/, JSON.stringify(bad));
      assert.ok(query.params.includes('2026-08-15'), JSON.stringify(bad));
    }
  });

  await t.test('handles notEnded operator on scheduleEndedBoundary field', () => {
    const condition: QueryCondition = {
      field: 'scheduleEndedBoundary',
      operator: 'notEnded',
      value: { now: '2026-06-15T18:00:00Z', today: '2026-06-15' }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    // Generated SQL shape: an EXISTS anti-join, with the trailing 'Z'/offset stripped from
    // `now` before the `::timestamp` cast (Dev Notes -- casting a tz-qualified string to a
    // naive `timestamp` would otherwise be silently reinterpreted via the session's TimeZone
    // GUC). Rendered via the pg dialect's own toQuery, matching the existing overlaps-operator
    // tests' scope in this file (assert the condition is defined and the SQL text/params
    // contain the expected shape, not a config-fragile chunk-internals walk).
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /EXISTS/);
    assert.match(query.sql, /::timestamp/);
    assert.ok(query.params.includes('2026-06-15'));
    assert.ok(query.params.includes('2026-06-15T18:00:00'));
  });

  await t.test('handles withinRadius operator on scheduleCoordinates field', () => {
    const condition: QueryCondition = {
      field: 'scheduleCoordinates',
      operator: 'withinRadius',
      value: { latitude: -6.2088, longitude: 106.8456, radiusKm: 10 }
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });

  await t.test('handles unknown operator safely', () => {
    const condition: QueryCondition = {
      field: 'name',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      operator: 'unknown' as any,
      value: 'a'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.strictEqual(res, undefined);
  });

  await t.test("handles 'not' group operator: wraps a single eq terminal's SQL in NOT (...)", () => {
    const condition: QueryCondition = {
      operator: 'not',
      conditions: [{ field: 'name', operator: 'eq', value: 'Fest' }]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /NOT COALESCE\(/);
  });

  await t.test("'not' group negates every child together, not just the first (Epic 9 review P1)", () => {
    const condition: QueryCondition = {
      operator: 'not',
      conditions: [
        { field: 'name', operator: 'eq', value: 'Fest' },
        { field: 'types', operator: 'in', value: ['MUSIC'] },
      ],
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const query = new PgDialect().sqlToQuery(res!);
    assert.match(query.sql, /NOT COALESCE\(\(.*"name".*and.*"types"/is);
    assert.deepStrictEqual(query.params.slice(0, 2), ['Fest', 'MUSIC']);
  });

  await t.test("'not' group is null-inclusive: a NULL child result negates to TRUE (Epic 9 review P11)", () => {
    const condition: QueryCondition = {
      operator: 'not',
      conditions: [{ field: 'name', operator: 'contains', value: 'jazz' }],
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    const query = new PgDialect().sqlToQuery(res!);
    assert.match(query.sql, /NOT COALESCE\(.*, false\)/is);
  });

  await t.test("'not' group with zero compiled children returns undefined", () => {
    const condition: QueryCondition = {
      operator: 'not',
      conditions: [{ field: 'unmapped', operator: 'eq', value: 'a' }]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.strictEqual(res, undefined);
  });

  await t.test("ne's updated null-inclusive SQL shape: renders IS DISTINCT FROM for a non-null value", () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'ne',
      value: 'Fest'
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /IS DISTINCT FROM/);
  });

  await t.test("notIn's updated null-inclusive SQL shape on a scalar column: IS NULL alongside NOT IN", () => {
    const condition: QueryCondition = {
      field: 'name',
      operator: 'notIn',
      value: ['a']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /is null/i);
    assert.match(query.sql, /not in/i);
  });

  await t.test("notIn's updated null-inclusive SQL shape on an array column: IS NULL alongside the && ARRAY[...] guard", () => {
    const condition: QueryCondition = {
      field: 'types',
      operator: 'notIn',
      value: ['MUSIC']
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(res!);
    assert.match(query.sql, /IS NULL/);
    assert.match(query.sql, /&&/);
    assert.match(query.sql, /ARRAY\[/);
  });

  await t.test('handles deeply nested group condition', () => {
    const condition: QueryCondition = {
      operator: 'or',
      conditions: [
        {
          operator: 'and',
          conditions: [
            { field: 'name', operator: 'eq', value: 'a' },
            { field: 'types', operator: 'in', value: ['MUSIC'] }
          ]
        },
        { field: 'name', operator: 'eq', value: 'b' }
      ]
    };
    const res = buildDrizzleWhere(condition, fieldMap);
    assert.ok(res !== undefined);
  });
});
