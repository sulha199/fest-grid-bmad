import test from 'node:test';
import * as assert from 'node:assert';
import { buildDrizzleWhere } from './drizzle-where.js';
import { QueryCondition } from '@festgrid/domain/query';
import { pgTable, text, uuid, date } from 'drizzle-orm/pg-core';

const testTable = pgTable('test_table', {
  id: uuid('id'),
  name: text('name'),
  types: text('types').array(),
});

const scheduleTestTable = pgTable('schedule_test_table', {
  eventId: uuid('event_id'),
  eventStartDate: date('event_start_date'),
  eventEndDate: date('event_end_date'),
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
