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

  // Story 3.6v -- a "match condition" descriptor: used when a field's membership test can't be
  // expressed as a direct column comparison (e.g. the AD-31 Rule 4 account-match helper, which
  // must OR across two link tables rather than compare one column). The descriptor's callback
  // receives the normalized value list and returns the ready SQL boolean; this keeps this
  // generic DSL file free of any app-specific join knowledge -- the callback is supplied by the
  // caller's own fieldMap, same dependency-injection shape the table/column descriptors below
  // (scheduleDateRange, withinRadius) already use, just made operator-agnostic.
  if (column && typeof column === "object" && typeof (column as { matchCondition?: unknown }).matchCondition === "function") {
    const matchCondition = (column as { matchCondition: (values: unknown[]) => SQL }).matchCondition;
    switch (operator) {
      case "eq":
        return value === null ? sql`false` : matchCondition([value]);
      case "ne":
        return value === null ? sql`true` : sql`NOT ${matchCondition([value])}`;
      case "in":
        if (!Array.isArray(value) || value.length === 0) return sql`false`;
        return matchCondition(value);
      case "notIn":
        if (!Array.isArray(value) || value.length === 0) return sql`true`;
        return sql`NOT ${matchCondition(value)}`;
      default:
        return undefined;
    }
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
        const elements = value.map((v) => sql`${v}`);
        return sql`${column} && ARRAY[${sql.join(elements, sql`, `)}]`;
      }
      return inArray(column, value);
    case "notIn":
      if (!Array.isArray(value) || value.length === 0) return sql`true`; // Not in empty array is always true
      if (isArrayColumn) {
        const elements = value.map((v) => sql`${v}`);
        return sql`NOT (${column} && ARRAY[${sql.join(elements, sql`, `)}])`;
      }
      return notInArray(column, value);
    case "overlaps": {
      const { from, to } = value as { from: string; to: string | null };
      const { table, eventIdCol, correlateCol, startCol, endCol, applicableDaysOfWeekCol } = column as {
        table: PgTable;
        eventIdCol: PgColumn;
        correlateCol: PgColumn;
        startCol: PgColumn;
        endCol: PgColumn;
        applicableDaysOfWeekCol?: PgColumn;
      };
      const toSql = to === null ? sql`NULL` : sql`${to}::date`;
      // Story 3.6y (AD-19 "single domain mechanism") -- when the fieldMap descriptor carries
      // applicableDaysOfWeekCol, append a closed-form weekday-containment guard so a schedule
      // narrowed to specific weekdays (e.g. `['MON']`) does not match a day-of-week/dateRange/
      // temporal-filter query window that contains none of those weekdays, even though the
      // schedule's raw [startCol, endCol] span overlaps the window. See drizzle-where.test.ts
      // and this story's Dev Notes for the O(1)-per-row rationale (unnest over the schedule's
      // own tiny array, never a per-day generate_series loop over the query's own range).
      const weekdayGuard = applicableDaysOfWeekCol
        ? sql`
          AND (
            ${applicableDaysOfWeekCol} IS NULL
            OR cardinality(${applicableDaysOfWeekCol}) = 0
            OR EXISTS (
              SELECT 1 FROM unnest(${applicableDaysOfWeekCol}) AS aw(code)
              WHERE MOD(
                (CASE aw.code
                  WHEN 'SUN' THEN 0 WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
                  WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5 WHEN 'SAT' THEN 6 END)
                - EXTRACT(DOW FROM GREATEST(${startCol}, ${from}::date))::int + 7, 7
              ) <= (
                LEAST(COALESCE(${endCol}, ${startCol}), COALESCE(${toSql}, COALESCE(${endCol}, ${startCol})))
                - GREATEST(${startCol}, ${from}::date)
              )
            )
          )
        `
        : sql``;
      return sql`EXISTS (
        SELECT 1 FROM ${table}
        WHERE ${eventIdCol} = ${correlateCol}
          AND daterange(${startCol}, COALESCE(${endCol}, ${startCol}), '[]')
              && daterange(${from}::date, ${toSql}, '[]')
          ${weekdayGuard}
      )`;
    }
    case "notEnded": {
      // AD-20 Rule 2/4 -- exactly mirrors `isEventEnded`'s (packages/ui/src/features/events/
      // format-event-date.ts) own boolean, with NO timezone conversion on either side (see this
      // story's Dev Notes, "Timezone scope of the `!ended` mirror" -- a deliberate scope
      // decision, not an oversight: no call site in this codebase passes a real per-event
      // timezone today, so both sides already agree on the same lack of conversion).
      const { now, today } = value as { now: string; today: string };
      const { table, eventIdCol, correlateCol, startCol, endCol, endTimeCol } = column as {
        table: PgTable;
        eventIdCol: PgColumn;
        correlateCol: PgColumn;
        startCol: PgColumn;
        endCol: PgColumn;
        endTimeCol: PgColumn;
      };
      // Strip any trailing 'Z'/offset before interpolating into a `::timestamp`
      // (timezone-naive) cast -- see Dev Notes "Timezone scope of the !ended mirror."
      // Casting a tz-qualified string to a naive `timestamp` type makes Postgres
      // silently reinterpret it via the session's `TimeZone` GUC, which this app's
      // connection (apps/backend/src/db/client.ts) does not pin to UTC.
      const naiveNow = now.replace(/Z$|[+-]\d{2}:?\d{2}$/, '');
      return sql`EXISTS (
        SELECT 1 FROM ${table}
        WHERE ${eventIdCol} = ${correlateCol}
          AND NOT (
            COALESCE(${endCol}, ${startCol}) < ${today}::date
            OR (
              COALESCE(${endCol}, ${startCol}) = ${today}::date
              AND ${endTimeCol} IS NOT NULL
              AND (COALESCE(${endCol}, ${startCol})::timestamp + ${endTimeCol}) <= ${naiveNow}::timestamp
            )
          )
      )`;
    }
    case "withinRadius": {
      const { latitude, longitude, radiusKm } = value as { latitude: number; longitude: number; radiusKm: number };
      const { latColumn, lngColumn } = column as { latColumn: PgColumn; lngColumn: PgColumn };
      // Bounding-box pre-filter (uses the schedule_coordinates_idx btree index) + exact
      // spherical-law-of-cosines trim (NOT the haversine formula — see the note in
      // packages/domain/src/geolocation/computeDistanceKm.ts, Story 1.i1f finding 10).
      // 1 degree of latitude ≈ 111.32 km; longitude degree length shrinks with cos(latitude).
      // NOTE: This exact formula must be mirrored client-side by packages/domain/src/geolocation/computeDistanceKm.ts
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
