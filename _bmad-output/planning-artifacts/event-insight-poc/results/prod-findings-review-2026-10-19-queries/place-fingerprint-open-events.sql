-- AD-39 Rule 7, Round 4 ask 2: the legacy `location_source` fingerprint, counted on OPEN events (a schedule that has not ended) by account type.
-- Sizes how many curator events lose a pin when AD-39 Rule 3 applies (BUG-065) and become `unknown`, and how many events each fingerprint class holds before
-- the derive job runs. Classes (the first that applies, on the event's main schedule):
--   account_default     the schedule's location text is empty AND the pin equals the account's default location (same place id, or coordinates within 150 m)
--   geocoded_from_text  the schedule has a location text
--   legacy_unknown      the rest (a pin and no text that is not the account default, or no place at all)
-- Account default and location_details are read through the normalising expression because of BUG-068 (a jsonb string holding an object).
-- Read-only; counts only; no names, ids or text.
with prof as (
  select p.account_id,
         (case when jsonb_typeof(p.default_location) = 'object' then p.default_location
               when jsonb_typeof(p.default_location) = 'string' and left(p.default_location #>> '{}', 1) = '{' then (p.default_location #>> '{}')::jsonb end) as d,
         p.account_type::text as account_type, (p.account_type_status = 'CONFIRMED') as confirmed
  from social_media_account_profiles p),
acct as (
  select distinct on (account_id) account_id, d,
         (d->'coordinates'->>'latitude') as dlat, (d->'coordinates'->>'longitude') as dlon, (d->>'placeId') as dplace, account_type
  from prof order by account_id, confirmed desc nulls last),
ms as (
  select e.id as event_id, e.source_social_media_account_id as acct_id,
         nullif(btrim(s.location), '') as loc_text, s.latitude, s.longitude,
         ((case when jsonb_typeof(s.location_details) = 'object' then s.location_details
                when jsonb_typeof(s.location_details) = 'string' and left(s.location_details #>> '{}', 1) = '{' then (s.location_details #>> '{}')::jsonb end)->>'placeId') as place_id
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null
    and exists (select 1 from schedules o where o.event_id = e.id and coalesce(o.event_end_date, o.event_start_date) >= current_date)),
cls as (
  select ms.event_id, coalesce(a.account_type, '(unclassified)') as account_type, (ms.latitude is not null and ms.longitude is not null) as has_pin,
         a.d is not null as account_has_default,
         case
           when ms.loc_text is null and ms.latitude is not null and a.d is not null
                and ((ms.place_id is not null and ms.place_id = a.dplace)
                  or (a.dlat ~ '^-?[0-9.]+$' and a.dlon ~ '^-?[0-9.]+$'
                      and 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(ms.latitude - a.dlat::float) / 2), 2)
                          + cos(radians(a.dlat::float)) * cos(radians(ms.latitude)) * power(sin(radians(ms.longitude - a.dlon::float) / 2), 2)))) <= 150))
             then 'account_default'
           when ms.loc_text is not null then 'geocoded_from_text'
           else 'legacy_unknown' end as fingerprint
  from ms left join acct a on a.account_id = ms.acct_id)
select account_type, fingerprint, count(*) as open_events,
       count(*) filter (where has_pin) as with_a_pin,
       count(*) filter (where account_has_default) as account_has_a_default_location
from cls group by 1, 2 order by 1, 2;
