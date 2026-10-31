import { SQL, sql } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";
import type { PastCutoff } from "@festgrid/domain/query";

/**
 * BUG-096 -- narrows an untrusted `overlaps` value's `pastCutoff` to the shape the SQL builder
 * binds. A client can put its own JSON in a condition's `value`, so a malformed one is ignored
 * (the plain `from` date applies) rather than reaching the `::timestamptz`/`::integer` casts.
 */
export function readPastCutoff(value: unknown): PastCutoff | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const { instant, hidePastEventsAfterDays } = value as Record<string, unknown>;
  if (typeof instant !== "string" || Number.isNaN(Date.parse(instant))) return undefined;
  if (!Number.isInteger(hidePastEventsAfterDays)) return undefined;
  return { instant, hidePastEventsAfterDays: hidePastEventsAfterDays as number };
}

/**
 * BUG-096 -- the single SQL definition of "the first day an event still counts as not past", per
 * schedule row: the date of `cutoff.instant` in the row's own timezone (only when its
 * `timezone_status` is RESOLVED, the card's wall-clock rule) minus `hidePastEventsAfterDays`;
 * UTC otherwise. The default-visibility filter (drizzle-where `overlaps`), the Archive's
 * `isPastEvent` and `Event.isExpiredForCurrentUser` all build their bound from this one fragment
 * so they stay exact complements. The `schedule_past_cutoff_date` function (migration 0087) also
 * absorbs a zone name Postgres does not recognise, so one bad row cannot fail the whole query.
 */
export function buildPastCutoffDateSql(
  cutoff: PastCutoff,
  timezoneCol: PgColumn,
  timezoneStatusCol: PgColumn
): SQL {
  return sql`schedule_past_cutoff_date(${cutoff.instant}::timestamptz, ${timezoneCol}, ${timezoneStatusCol}::text, ${cutoff.hidePastEventsAfterDays}::integer)`;
}
