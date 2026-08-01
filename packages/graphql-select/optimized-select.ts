import { GraphQLResolveInfo } from 'graphql';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';

export function buildOptimizedDrizzleSelect<TTable extends PgTable>(
  table: TTable,
  info: GraphQLResolveInfo,
  options?: { path?: string }
): Record<string, PgColumn> {
  let parsedInfo = parseResolveInfo(info) as ResolveTree | null | undefined;
  
  if (!parsedInfo || !parsedInfo.fieldsByTypeName) {
    return {};
  }

  if (options?.path && parsedInfo.fieldsByTypeName) {
    // Attempt to traverse down to the specified path
    // Typically fieldsByTypeName has the query type (e.g. Query), and inside is the field (e.g. events)
    // Actually parsedInfo represents the current field.
    // So fieldsByTypeName has the returned object type, e.g. EventConnection.
    const typeNames = Object.keys(parsedInfo.fieldsByTypeName);
    for (const typeName of typeNames) {
      const fieldNode = parsedInfo.fieldsByTypeName[typeName][options.path];
      if (fieldNode) {
        parsedInfo = fieldNode as ResolveTree;
        break;
      }
    }
  }

  const columns = getTableColumns(table);
  const select: Record<string, PgColumn> = {};

  if (!parsedInfo.fieldsByTypeName) {
    return select;
  }

  for (const typeName of Object.keys(parsedInfo.fieldsByTypeName)) {
    const fields = parsedInfo.fieldsByTypeName[typeName];
    for (const fieldName of Object.keys(fields)) {
      const column = columns[fieldName];
      if (column) {
        select[fieldName] = column;
      }
    }
  }

  return select;
}
