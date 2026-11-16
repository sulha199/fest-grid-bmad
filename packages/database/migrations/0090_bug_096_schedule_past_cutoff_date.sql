-- BUG-096: the day an event stops being "upcoming" is decided in the event's own timezone.
--
-- The list used to cut at the UTC date, while the card judges "Ended" in the schedule's own zone,
-- so for about 7 hours of every Jakarta day Discovery still listed events whose card said Ended
-- (and, west of UTC, hid an event that was still live). This function is the one definition of
-- the cutoff date that the default-visibility filter, the Archive's `isPastEvent` and
-- `Event.isExpiredForCurrentUser` all call, so the three stay exact complements.
--
-- Same wall-clock rule as the card (`resolveScheduleTimezone`): the schedule's own zone counts
-- only when `timezone_status` is RESOLVED; otherwise (and for a NULL zone) the UTC date is used,
-- which is the behaviour before this change.
--
-- A zone name Postgres does not recognise raises 22023 in AT TIME ZONE, which would turn the
-- whole Discovery query into an error because of one bad row, so that case falls back to UTC.
-- The handler is cheap: about 0.3 microseconds per call, measured over 200k calls.
--
-- STABLE, not IMMUTABLE: the result depends on the tz database, which can change between
-- Postgres releases. `tz_status` is text (callers cast the enum) so this file does not depend on
-- the enum type.
CREATE OR REPLACE FUNCTION schedule_past_cutoff_date(
  instant timestamptz,
  tz text,
  tz_status text,
  hide_after_days integer
) RETURNS date
LANGUAGE plpgsql
STABLE
AS $fn$
BEGIN
  IF tz_status = 'RESOLVED' AND tz IS NOT NULL THEN
    RETURN (instant AT TIME ZONE tz)::date - hide_after_days;
  END IF;
  RETURN (instant AT TIME ZONE 'UTC')::date - hide_after_days;
EXCEPTION WHEN invalid_parameter_value THEN
  RETURN (instant AT TIME ZONE 'UTC')::date - hide_after_days;
END
$fn$;
