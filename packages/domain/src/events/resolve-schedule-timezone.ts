/**
 * The IANA timezone a schedule's wall-clock date/time values are expressed in, or `undefined` when
 * the schedule has no trustworthy one (the caller then falls back to the app/viewer timezone).
 *
 * An event poster's "18:30" means 18:30 at the venue, so the schedule's own timezone is what turns
 * its date/time into an instant -- including a date with no time, which is 00:00 in that zone.
 * Only a `RESOLVED` timezone is trusted: `NEEDS_CLARIFICATION` means the value is a guess still
 * waiting for a person to confirm it (the event page asks), and scraped guesses have been
 * demonstrably wrong (e.g. Europe/Paris for a Yogyakarta venue). A value `Intl` rejects is dropped
 * too, so a bad string can never reach a formatter and throw.
 */
export interface ScheduleTimezoneSource {
  timezone?: string | null;
  timezoneStatus?: string | null;
}

export function resolveScheduleTimezone(schedule: ScheduleTimezoneSource | null | undefined): string | undefined {
  const timezone = schedule?.timezone?.trim();
  if (!timezone || schedule?.timezoneStatus !== 'RESOLVED') return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return undefined;
  }
}
