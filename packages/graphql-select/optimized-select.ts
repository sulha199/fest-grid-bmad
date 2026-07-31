import { GraphQLResolveInfo } from 'graphql';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';

export function buildOptimizedDrizzleSelect<TTable extends PgTable>(
  table: TTable,
  info: GraphQLResolveInfo
): Record<string, PgColumn> {
  const parsedInfo = parseResolveInfo(info) as ResolveTree | null | undefined;
  
  if (!parsedInfo || !parsedInfo.fieldsByTypeName) {
    return {};
  }

  const columns = getTableColumns(table);
  const select: Record<string, PgColumn> = {};

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
