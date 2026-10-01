import { GraphQLResolveInfo } from 'graphql';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { getTableColumns, SQL } from 'drizzle-orm';

export interface OptimizedDrizzleSelectOptions {
  /**
   * A path used to traverse down from the resolver's current `info` scope to a nested object
   * type. Three accepted forms (Story 1.i1h Task 1 — the dot-separated string form is a strict
   * superset of the previous single-segment-only behaviour):
   *
   * - a **dot-separated string**: `'items.schedules'` reaches the `Schedule` type nested under
   *   `EventConnection.items[0]`, and `'items'` reaches `Event` directly;
   * - an **ordered array of segments**: `['items', 'schedules']` — equivalent to the above;
   * - a **single segment string** with no dot: `'schedules'` (`event`/`eventBySlug`'s existing
   *   usage).
   *
   * Dot-separated strings are split on `.`; empty segments (e.g. a leading/trailing dot) are
   * dropped rather than treated as a lookup key.
   */
  path?: string | string[];
  /**
   * A map of computed/virtual field names to Drizzle SQL expressions (e.g. correlated
   * subqueries / `EXISTS` expressions). Each entry is included in the returned select only
   * when the corresponding GraphQL field is actually requested in `info`.
   */
  virtualFields?: Record<string, SQL>;
}

/**
 * Returns the set of leaf GraphQL field names requested for the object type reached by
 * `path` (or the resolver's current type when `path` is omitted), by traversing
 * `parseResolveInfo(info).fieldsByTypeName`. This is the shared signal used by
 * `buildOptimizedDrizzleSelect` and by callers that need field-selection gating outside a
 * table-column select (e.g. deciding whether to fire a nested batch query).
 */
export function getRequestedFieldNames(
  info: GraphQLResolveInfo,
  path?: string | string[]
): Set<string> {
  const requested = new Set<string>();
  let parsedInfo = parseResolveInfo(info) as ResolveTree | null | undefined;

  if (!parsedInfo || !parsedInfo.fieldsByTypeName) {
    return requested;
  }

  // Story 1.i1h (Task 1) — a bare string is now a dot-separated path (`'items.schedules'`),
  // while a no-dot string (`'schedules'`) still yields exactly one segment, so every existing
  // single-segment call site behaves identically. The array form is unchanged.
  const segments = typeof path === 'string'
    ? path.split('.').filter((segment) => segment.length > 0)
    : (path ?? []);

  for (const segment of segments) {
    const typeNames = Object.keys(parsedInfo.fieldsByTypeName);
    let next: ResolveTree | null = null;
    for (const typeName of typeNames) {
      const fieldNode = parsedInfo.fieldsByTypeName[typeName][segment];
      if (fieldNode) {
        next = fieldNode as ResolveTree;
        break;
      }
    }
    if (!next) {
      return requested;
    }
    parsedInfo = next;
  }

  if (!parsedInfo.fieldsByTypeName) {
    return requested;
  }

  for (const typeName of Object.keys(parsedInfo.fieldsByTypeName)) {
    const fields = parsedInfo.fieldsByTypeName[typeName];
    for (const fieldName of Object.keys(fields)) {
      requested.add(fieldName);
    }
  }

  return requested;
}

export function buildOptimizedDrizzleSelect<TTable extends PgTable>(
  table: TTable,
  info: GraphQLResolveInfo,
  options?: OptimizedDrizzleSelectOptions
): Record<string, PgColumn | SQL> {
  const columns = getTableColumns(table);
  const select: Record<string, PgColumn | SQL> = {};

  const requested = getRequestedFieldNames(info, options?.path);

  for (const fieldName of requested) {
    const column = columns[fieldName];
    if (column) {
      select[fieldName] = column;
    } else if (options?.virtualFields?.[fieldName]) {
      select[fieldName] = options.virtualFields[fieldName];
    }
  }

  return select;
}
