export interface ComputePastEventThresholdInput {
  now: Date;
  hidePastEventsAfterDays: number;
}

/**
 * Computes the UTC-midnight-minus-N-days threshold (as a `YYYY-MM-DD` string) used to decide
 * whether an event counts as "past" for visibility purposes.
 *
 * This is the single shared implementation of a UTC-midnight math that was previously
 * duplicated independently in 3 places: `buildDefaultEventVisibilityConditions.ts`,
 * `Query.events`' local `threshold` computation (feeding the `isPastEvent` SQL expression),
 * and `Event.isExpiredForCurrentUser`'s computation. See Story 0.36 AC6.
 *
 * `now` is required (not defaulted) — every caller must explicitly capture and pass its own
 * "current instant" so multiple computations within the same request are guaranteed to agree
 * on the same instant (see Story 0.36 AC7).
 */
export function computePastEventThreshold({ now, hidePastEventsAfterDays }: ComputePastEventThresholdInput): string {
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();

  const utcMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - hidePastEventsAfterDays);

  const year = utcMidnight.getUTCFullYear();
  const month = String(utcMidnight.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcMidnight.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
