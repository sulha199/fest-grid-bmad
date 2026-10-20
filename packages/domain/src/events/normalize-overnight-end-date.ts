const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function toSecondsOfDay(time: string): number | null {
  const match = TIME_OF_DAY.exec(time);
  if (!match) return null;
  const [, h, m, s] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = s === undefined ? 0 : Number(s);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/** Adds one calendar day to a `YYYY-MM-DD` string, or returns null when it is not a real date. */
function addOneDay(date: string): string | null {
  const match = DATE_ONLY.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  const base = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject overflowed dates such as 2026-02-31, which `Date.UTC` silently rolls into March.
  if (base.getUTCFullYear() !== Number(y) || base.getUTCMonth() !== Number(m) - 1 || base.getUTCDate() !== Number(d)) {
    return null;
  }
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

/**
 * An event that runs past midnight (a poster saying "21:00 - 02:00") is modelled as an end date
 * on the NEXT calendar day: the PRD's consistency rule (`validateCorrectionConsistency`) rejects
 * an end time that is not later than the start time when the end date is absent or equal to the
 * start date. AI extraction has no such guard and often returns the end time alone, which every
 * reader then takes as "ended at 02:00 on the start day" -- "Ended" before the event has begun.
 *
 * This returns the end date to store: the day after `startDate` when the end date is absent or
 * equal to the start date AND both times are present AND the end time is strictly earlier than
 * the start time. In every other case `endDate` is returned unchanged -- including equal start
 * and end times, which are bad data rather than an overnight event (inventing a 24-hour event
 * would be worse than leaving it), an end date already after the start, a missing time, or an
 * unparseable date/time.
 */
export function normalizeOvernightEndDate(
  startDate: string,
  startTime: string | null | undefined,
  endDate: string | null | undefined,
  endTime: string | null | undefined
): string | null | undefined {
  if (!startTime || !endTime) return endDate;
  if (endDate && endDate !== startDate) return endDate;

  const start = toSecondsOfDay(startTime);
  const end = toSecondsOfDay(endTime);
  if (start === null || end === null || end >= start) return endDate;

  return addOneDay(startDate) ?? endDate;
}
