import { SQL, and, or, ilike, inArray, notInArray, eq, ne, sql, isNotNull, isNull } from "drizzle-orm";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { QueryCondition, isGroupCondition } from "@festgrid/domain/query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldColumnMap = Record<string, PgColumn | any>;

export function buildDrizzleWhere(
  condition: QueryCondition | null | undefined,
  fieldMap: FieldColumnMap
): SQL | undefined {
  if (!condition) return undefined;

  if (isGroupCondition(condition)) {
    if (!condition.conditions || condition.conditions.length === 0) {
      return undefined;
    }

    const parts = condition.conditions
      .map(c => buildDrizzleWhere(c, fieldMap))
      .filter((p): p is SQL => p !== undefined);

    if (parts.length === 0) return undefined;

    if (condition.operator === "and") {
      return and(...parts);
    } else if (condition.operator === "or") {
      return or(...parts);
    }
    return undefined;
  }

  // Terminal Condition
  const { field, operator, value } = condition;
  const column = fieldMap[field];

  if (!column) {
    // If the field isn't explicitly mapped, we ignore it silently (per DSL intent to ignore unknown fields/out-of-scope fields)
    return undefined;
  }

  // Special handling for array columns vs scalar columns when using "in" or "contains"
  // If the column is an array column (like text[] for types/categories), we need to handle "in" properly.
  // Actually, Drizzle array contains is `arrayContains(col, [val])`
  const isArrayColumn = column.dataType === "array";

  switch (operator) {
    case "eq":
      if (value === null) return isNull(column);
      return eq(column, value);
    case "ne":
      if (value === null) return isNotNull(column);
      return ne(column, value);
    case "contains":
      if (isArrayColumn) {
        // We assume "contains" on an array column means the array contains the value.
        // Wait, Drizzle pg-core array doesn't have a direct ilike inside array. But wait, AD-1 says `contains` is substring match.
        // For array columns (like performers), we can do `sql\`${value} = ANY(${column})\`` for exact match, or for substring:
        // `EXISTS (SELECT 1 FROM unnest(${column}) AS elem WHERE elem ILIKE ${`%${value}%`})`
        // Let's implement array ilike matching
        return sql`EXISTS (SELECT 1 FROM unnest(${column}) AS elem WHERE elem ILIKE ${`%${value}%`})`;
      }
      return ilike(column, `%${value}%`);
    case "in":
      if (!Array.isArray(value) || value.length === 0) return sql`false`; // In empty array is always false
      if (isArrayColumn) {
        // If the column is an array, "in" means there's an intersection between the column array and the value array.
        // Drizzle provides overlap operator `&&`. Array must be constructed safely to avoid comma expansion.
        const elements = value.map((v: any) => sql`${v}`);
        return sql`${column} && ARRAY[${sql.join(elements, sql`, `)}]`;
      }
      return inArray(column, value);
    case "notIn":
      if (!Array.isArray(value) || value.length === 0) return sql`true`; // Not in empty array is always true
      if (isArrayColumn) {
        const elements = value.map((v: any) => sql`${v}`);
        return sql`NOT (${column} && ARRAY[${sql.join(elements, sql`, `)}])`;
      }
      return notInArray(column, value);
    case "overlaps": {
      const { from, to } = value as { from: string; to: string };
      const { table, eventIdCol, correlateCol, startCol, endCol } = column as {
        table: PgTable;
        eventIdCol: PgColumn;
        correlateCol: PgColumn;
        startCol: PgColumn;
        endCol: PgColumn;
      };
      return sql`EXISTS (
        SELECT 1 FROM ${table}
        WHERE ${eventIdCol} = ${correlateCol}
          AND daterange(${startCol}, COALESCE(${endCol}, ${startCol}), '[]')
              && daterange(${from}::date, ${to}::date, '[]')
      )`;
    }
    case "withinRadius": {
      const { latitude, longitude, radiusKm } = value as { latitude: number; longitude: number; radiusKm: number };
      const { latColumn, lngColumn } = column as { latColumn: PgColumn; lngColumn: PgColumn };
      // Bounding-box pre-filter (uses the schedule_coordinates_idx btree index) + exact Haversine trim.
      // 1 degree of latitude ≈ 111.32 km; longitude degree length shrinks with cos(latitude).
      const latDelta = radiusKm / 111.32;
      const lngDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
      return and(
        sql`${latColumn} BETWEEN ${latitude - latDelta} AND ${latitude + latDelta}`,
        sql`${lngColumn} BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}`,
        sql`(
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${latitude})) * cos(radians(${latColumn})) *
              cos(radians(${lngColumn}) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(${latColumn}))
            ))
          )
        ) <= ${radiusKm}`
      );
    }
    default:
      return undefined;
  }
}
