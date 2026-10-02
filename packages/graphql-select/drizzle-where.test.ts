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
