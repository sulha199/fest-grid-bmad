import { test, expect } from 'vitest';
import { is, getTableColumns } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// BUG-068 ratchet. drizzle-orm 0.30's own jsonb() column stringifies the value and postgres.js stringifies it again, so the database stores a jsonb
// *string* (not an object) and every SQL-side ->>, @> or jsonb_array_elements sees nothing. `customJsonb` (schema.ts) hands the raw object to the
// driver instead. A new jsonb column declared with jsonb() would silently bring the bug back; this test is the stop.
const jsonbColumns = (): Array<{ table: string; column: string; columnType: string }> => {
  const found: Array<{ table: string; column: string; columnType: string }> = [];
  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (!is(value, PgTable)) continue;
    const { name } = getTableConfig(value);
    for (const column of Object.values(getTableColumns(value))) {
      if (column.getSQLType() === 'jsonb') found.push({ table: name, column: column.name, columnType: column.columnType });
    }
  }
  return found;
};

test('no jsonb column is declared with drizzle jsonb(): use customJsonb (BUG-068)', () => {
  const all = jsonbColumns();
  expect(all.length, 'the scan found no jsonb column at all: the test itself is broken').toBeGreaterThan(20);
  const plain = all.filter((c) => c.columnType === 'PgJsonb').map((c) => `${c.table}.${c.column}`);
  expect(plain, `declare these with customJsonb<T>('column'), not jsonb('column'): ${plain.join(', ')}`).toEqual([]);
});

test('customJsonb gives the driver the raw value and parses a legacy JSON string back (the two shapes BUG-068 leaves in the database)', () => {
  const column = getTableColumns(schema.schedules).locationDetails;
  const value = { coordinates: { latitude: -7.7, longitude: 110.4 }, city: 'Yogyakarta' };
  // writing: the object itself, never a string (postgres.js serializes it exactly once)
  expect(column.mapToDriverValue(value)).toBe(value);
  expect(column.mapToDriverValue([1, 2])).toEqual([1, 2]);
  // reading: an object passes through; a double-encoded legacy string is parsed; a string that is not JSON is returned as it is
  expect(column.mapFromDriverValue(value)).toBe(value);
  expect(column.mapFromDriverValue(JSON.stringify(value))).toEqual(value);
  expect(column.mapFromDriverValue('not json')).toBe('not json');
});
