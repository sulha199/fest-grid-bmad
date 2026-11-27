-- Review SQL for online-only schedule locations that carry a map pin (handoff L, 2026-11-24).
-- Parts A and B are read-only. Part C is an UPDATE inside a transaction that ends in ROLLBACK: nothing is written until the last line is changed.
-- Read-only run (part A):  psql "$PROD_READONLY_DATABASE_URL" -X -A -F '|' -f online-locations-review.sql   (part C fails on a read-only role; that is fine)
--
-- The predicate (used in A and C): the location text consists ONLY of online words and meeting platforms. Every word of the text is removed
-- when it is in the list; if nothing is left, no place is named. "Online di Hotel X" leaves "di hotel x", so a hybrid text is not touched.
-- This list is a placeholder for the shared predicate of the extraction update (packages/domain, next to GENERIC_KEYWORDS).

-- ---- A. the rows, for review: location text, how it was resolved, what the pin says
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
WITH s AS (
  SELECT s.id AS schedule_id, s.event_id, s.location, s.location_resolution,
         CASE WHEN jsonb_typeof(s.location_details) = 'string' THEN (s.location_details #>> '{}')::jsonb ELSE s.location_details END AS d
  FROM schedules s JOIN events e ON e.id = s.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND s.location IS NOT NULL
    AND btrim(regexp_replace(lower(s.location),
        '\m(online|daring|virtual|via|zoom|meetings?|google|meet|teams|microsoft|instagram|youtube|live|streaming|webinar|link|dan|and|atau|or)\M|[^a-z0-9]+', ' ', 'g')) = ''
)
SELECT schedule_id, event_id, location, coalesce(location_resolution, '(none)') AS resolution,
       d->>'placeName' AS pin_place_name, left(d->>'formattedAddress', 80) AS pin_address, d->>'countryCode' AS pin_country
FROM s ORDER BY location, schedule_id;
ROLLBACK;

-- ---- B. rollback copy: keep this file before any write (psql, from the shell, with the ids of part A):
--   psql "$URL" -X -c "\copy (SELECT id, location_details, location_resolution FROM schedules WHERE id IN (<schedule_id list of part A>)) TO 'online-rows-rollback.csv' CSV"
-- Restore = the same ids with the saved values.

-- ---- C. the write, rolled back by default
BEGIN;
UPDATE schedules s
SET location_details = NULL, location_resolution = 'online'
FROM events e
WHERE e.id = s.event_id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND s.location IS NOT NULL
  AND btrim(regexp_replace(lower(s.location),
      '\m(online|daring|virtual|via|zoom|meetings?|google|meet|teams|microsoft|instagram|youtube|live|streaming|webinar|link|dan|and|atau|or)\M|[^a-z0-9]+', ' ', 'g')) = '';
-- 'online' is a new value of the TypeScript LocationResolution type (the column is plain text; no migration seen): add it in the extraction-update story.
ROLLBACK;  -- change to COMMIT only with the owner's go-ahead and the writer role
