// One-off backfill for schedules saved before ingestion normalized overnight events: a schedule
// with an end time earlier than its start time and no (or the same-day) end date -- "21:00 - 02:00"
// stored as ending at 02:00 on its start day. Every reader then treats it as already ended.
//
// The decision of what the corrected end date is lives in `normalizeOvernightEndDate`
// (packages/domain), the same function ingestion uses, so the backfill and new writes can never
// disagree. DB-coupled (Drizzle tables), so this lives in apps/backend, never packages/domain.
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { schedules } from '@festgrid/database';
import { normalizeOvernightEndDate } from '@festgrid/domain/events';
import { db } from '../../db/client.js';

export interface OvernightEndDateFix {
  scheduleId: string;
  eventId: string;
  eventStartDate: string;
  eventStartTime: string;
  eventEndTime: string;
  currentEndDate: string | null;
  newEndDate: string;
}

/**
 * Schedules whose stored end date would change under `normalizeOvernightEndDate`. SQL pre-filters
 * to the cheap superset (both times present, end time earlier, end date absent or equal to start);
 * the domain function then has the final say per row.
 */
export async function findOvernightEndDateFixes(): Promise<OvernightEndDateFix[]> {
  const rows = await db
    .select({
      scheduleId: schedules.id,
      eventId: schedules.eventId,
      eventStartDate: schedules.eventStartDate,
      eventStartTime: schedules.eventStartTime,
      eventEndTime: schedules.eventEndTime,
      currentEndDate: schedules.eventEndDate,
    })
    .from(schedules)
    .where(
      and(
        isNotNull(schedules.eventStartTime),
        isNotNull(schedules.eventEndTime),
        sql`${schedules.eventEndTime} < ${schedules.eventStartTime}`,
        or(isNull(schedules.eventEndDate), eq(schedules.eventEndDate, schedules.eventStartDate))
      )
    );

  const fixes: OvernightEndDateFix[] = [];
  for (const row of rows) {
    const newEndDate = normalizeOvernightEndDate(
      row.eventStartDate,
      row.eventStartTime,
      row.currentEndDate,
      row.eventEndTime
    );
    if (newEndDate && newEndDate !== row.currentEndDate) {
      fixes.push({
        scheduleId: row.scheduleId,
        eventId: row.eventId,
        eventStartDate: row.eventStartDate,
        eventStartTime: row.eventStartTime!,
        eventEndTime: row.eventEndTime!,
        currentEndDate: row.currentEndDate,
        newEndDate,
      });
    }
  }
  return fixes;
}

/**
 * Applies the fixes in one transaction. Each update re-checks the end date it was planned from,
 * so a row edited since the dry run is skipped rather than overwritten. Returns the rows changed.
 */
export async function applyOvernightEndDateFixes(fixes: OvernightEndDateFix[]): Promise<number> {
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const fix of fixes) {
      const result = await tx
        .update(schedules)
        .set({ eventEndDate: fix.newEndDate, updatedAt: new Date() })
        .where(
          and(
            eq(schedules.id, fix.scheduleId),
            fix.currentEndDate === null ? isNull(schedules.eventEndDate) : eq(schedules.eventEndDate, fix.currentEndDate)
          )
        )
        .returning({ id: schedules.id });
      updated += result.length;
    }
  });
  return updated;
}
