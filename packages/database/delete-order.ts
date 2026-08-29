import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import * as schema from './schema';

/**
 * Returns every pgTable in the schema, ordered so that any table can be safely
 * deleted before every table its own foreign keys reference (i.e. children/
 * dependents first, referenced/parent tables last) -- derived from the schema's
 * real FK graph via drizzle's own introspection, not hand-maintained.
 */
export function getTablesInDeleteOrder(excludeTableNames: string[] = []): PgTable[] {
  const allTables: PgTable[] = [];
  const schemaRecord = schema as Record<string, unknown>;
  for (const key in schemaRecord) {
    const value = schemaRecord[key];
    if (is(value, PgTable)) {
      allTables.push(value as PgTable);
    }
  }

  const tables = allTables.filter(t => !excludeTableNames.includes(getTableConfig(t).name));

  const tableMap = new Map<string, PgTable>();
  const adj = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const table of tables) {
    const name = getTableConfig(table).name;
    tableMap.set(name, table);
    adj.set(name, new Set());
    indegree.set(name, 0);
  }

  for (const table of tables) {
    const config = getTableConfig(table);
    const aName = config.name;
    for (const fk of config.foreignKeys) {
      const bTable = fk.reference().foreignTable;
      const bName = getTableConfig(bTable as PgTable).name;

      if (adj.has(aName) && adj.has(bName)) {
        if (!adj.get(aName)!.has(bName)) {
          adj.get(aName)!.add(bName);
          indegree.set(bName, indegree.get(bName)! + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [name, count] of indegree.entries()) {
    if (count === 0) {
      queue.push(name);
    }
  }

  const result: PgTable[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    result.push(tableMap.get(name)!);

    for (const bName of adj.get(name)!) {
      const current = indegree.get(bName)! - 1;
      indegree.set(bName, current);
      if (current === 0) {
        queue.push(bName);
      }
    }
  }

  if (result.length !== tables.length) {
    throw new Error('Cycle detected in foreign key references; cannot determine safe deletion order.');
  }

  return result;
}
