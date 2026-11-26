// An extracted time looks like `20:00`, `8:30`, `20:00:00`, or -- the common Indonesian way of
// writing it -- `20.00`. The model has also been seen mixing the two (`20.10:00`, prod ingestor
// errors 2026-11-12..25), so the separator between any two parts is `:` or `.`.
const EXTRACTED_TIME = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/;
// A trailing Indonesian zone label ("19.00 WIB"). The schedule's own timezone fields carry the
// zone, so the label is dropped here, never interpreted.
const ZONE_LABEL = /\s*(?:WIB|WITA|WIT)$/i;

/**
 * Turns an extracted time string into a valid `HH:MM:SS` for a Postgres `time` column, or `null`.
 *
 * Accepts `H:MM`, `HH:MM`, `HH:MM:SS` with `:` or `.` as separator (also mixed), surrounding
 * whitespace and a trailing `WIB` / `WITA` / `WIT`. Everything else -- an out-of-range part, a
 * range such as `20:00 - 22:00`, free text, an empty string, `null`, `undefined` -- is `null`:
 * a time is never guessed, and this never throws.
 *
 * `24:00` and `24:00:00` stay `24:00:00`: Postgres accepts them today, so an extraction that
 * inserts successfully now keeps inserting the same value. (`normalizeOvernightEndDate` does not
 * treat it as a time of day, exactly as before.)
 */
export function normalizeExtractedTime(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const match = EXTRACTED_TIME.exec(raw.trim().replace(ZONE_LABEL, ''));
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  // Postgres accepts exactly 24:00:00 as end-of-day and nothing later.
  if (hours === 24 ? minutes !== 0 || seconds !== 0 : hours > 23) return null;

  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export interface DroppedScheduleTime {
  scheduleIndex: number;
  field: 'eventStartTime' | 'eventEndTime';
  value: string;
}

/**
 * Lists the non-empty extracted times `normalizeExtractedTime` turns into `null`, so a caller can
 * make a dropped value visible (a log line) while this package stays free of I/O.
 */
export function listDroppedScheduleTimes(
  schedules: ReadonlyArray<{ eventStartTime?: string | null; eventEndTime?: string | null }> | null | undefined
): DroppedScheduleTime[] {
  const dropped: DroppedScheduleTime[] = [];
  (schedules ?? []).forEach((schedule, scheduleIndex) => {
    for (const field of ['eventStartTime', 'eventEndTime'] as const) {
      const value = schedule[field];
      if (value && normalizeExtractedTime(value) === null) {
        dropped.push({ scheduleIndex, field, value });
      }
    }
  });
  return dropped;
}
