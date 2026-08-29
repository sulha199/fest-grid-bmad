import { test, expect } from 'vitest';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import * as schema from './schema';
import { getTablesInDeleteOrder } from './delete-order';

test('getTablesInDeleteOrder returns all tables except excluded ones', () => {
  const allTables: PgTable[] = [];
  const schemaRecord = schema as Record<string, unknown>;
  for (const key in schemaRecord) {
    const value = schemaRecord[key];
    if (is(value, PgTable)) {
      allTables.push(value as PgTable);
    }
  }

  const expectedLength = allTables.length; // 26 currently

  const ordered = getTablesInDeleteOrder();
  expect(ordered.length).toBe(expectedLength);

  const orderedExclude = getTablesInDeleteOrder(['reports']);
  expect(orderedExclude.length).toBe(expectedLength - 1);
  expect(orderedExclude.find(t => getTableConfig(t).name === 'reports')).toBeUndefined();
});

test('getTablesInDeleteOrder produces a valid FK deletion order', () => {
  const ordered = getTablesInDeleteOrder();

  for (let i = 0; i < ordered.length; i++) {
    const table = ordered[i];
    const config = getTableConfig(table);

    for (const fk of config.foreignKeys) {
      const referencedTable = fk.reference().foreignTable;
      const referencedName = getTableConfig(referencedTable as PgTable).name;

      const referencedIndex = ordered.findIndex(t => getTableConfig(t).name === referencedName);
      
      // The referencing table (child) must appear before the referenced table (parent)
      expect(i).toBeLessThan(referencedIndex);
    }
  }
});