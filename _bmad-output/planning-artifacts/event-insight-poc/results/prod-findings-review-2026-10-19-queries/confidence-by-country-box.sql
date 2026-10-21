-- BUG-066 / IDEA-081: the stored geocode confidence of every pin, split by whether the pin is inside Indonesia's bounding box (the box the pack uses).
-- Calibrates the confidence floor from data we already hold: if the outside-the-box pins sit at low confidence and the inside ones at high, a floor
-- separates them; if the two overlap, a floor alone cannot fix BUG-066. 627 of 1,460 pins had a stored confidence under 0.5 on 2026-10-19.
-- Read-only; counts only. location_details is read through the normalising expression because of BUG-068.
with s as (select latitude, longitude,
  (case when jsonb_typeof(location_details) = 'object' then location_details
        when jsonb_typeof(location_details) = 'string' and left(location_details #>> '{}', 1) = '{' then (location_details #>> '{}')::jsonb end) d
  from schedules where latitude is not null and longitude is not null)
select case when latitude between -11.5 and 6.5 and longitude between 94.5 and 141.5 then 'inside Indonesia box' else 'outside Indonesia box' end as pin,
       case when d->>'confidence' is null or d->>'confidence' !~ '^-?[0-9]+(\.[0-9]+)?$' then 'no confidence stored'
            when (d->>'confidence')::float < 0.001 then '0.00'
            when (d->>'confidence')::float < 0.25 then '0.01-0.24'
            when (d->>'confidence')::float < 0.5 then '0.25-0.49'
            when (d->>'confidence')::float < 0.75 then '0.50-0.74'
            when (d->>'confidence')::float < 0.999 then '0.75-0.99'
            else '1.00' end as stored_confidence,
       count(*) as pins
from s group by 1, 2 order by 1, 2;

-- The same, by the geocoder's match type (the probe showed 'full_match' next to confidence 0.00, so match type alone does not help).
with s as (select latitude, longitude,
  (case when jsonb_typeof(location_details) = 'object' then location_details
        when jsonb_typeof(location_details) = 'string' and left(location_details #>> '{}', 1) = '{' then (location_details #>> '{}')::jsonb end) d
  from schedules where latitude is not null and longitude is not null)
select case when latitude between -11.5 and 6.5 and longitude between 94.5 and 141.5 then 'inside Indonesia box' else 'outside Indonesia box' end as pin,
       coalesce(d->>'matchType', '(none)') as match_type, count(*) as pins
from s group by 1, 2 order by 1, 3 desc;

-- Which venue texts produced the pins outside the box, and with what stored confidence (the Sleman City Hall question: the probe geocodes the text
-- correctly today, production stored it in the US). Venue and place names only, as shown in the app.
with s as (select location, latitude, longitude,
  (case when jsonb_typeof(location_details) = 'object' then location_details
        when jsonb_typeof(location_details) = 'string' and left(location_details #>> '{}', 1) = '{' then (location_details #>> '{}')::jsonb end) d
  from schedules where latitude is not null and longitude is not null)
select left(location, 60) as schedule_location_text, d->>'countryCode' as country, d->>'provider' as provider, d->>'matchType' as match_type,
       round(case when d->>'confidence' ~ '^-?[0-9]+(\.[0-9]+)?$' then (d->>'confidence')::numeric end, 2) as confidence, count(*) as schedules
from s where not (latitude between -11.5 and 6.5 and longitude between 94.5 and 141.5)
group by 1, 2, 3, 4, 5 order by 6 desc, 1 limit 40;

-- Is the wrong country inherited from the account's stored default location (BUG-066 mechanism 4: the account's default country is the geocoder's
-- bias for every later event of that account)? Counts only: pin country against the account's default country, for pins outside the box.
with s as (select event_id,
  (case when jsonb_typeof(location_details) = 'object' then location_details
        when jsonb_typeof(location_details) = 'string' and left(location_details #>> '{}', 1) = '{' then (location_details #>> '{}')::jsonb end) d
  from schedules where latitude is not null and longitude is not null and not (latitude between -11.5 and 6.5 and longitude between 94.5 and 141.5)),
acct as (select account_id, max((case when jsonb_typeof(default_location) = 'object' then default_location
        when jsonb_typeof(default_location) = 'string' and left(default_location #>> '{}', 1) = '{' then (default_location #>> '{}')::jsonb end)->>'countryCode') as default_country
  from social_media_account_profiles group by account_id)
select coalesce(s.d->>'countryCode', '(none)') as pin_country, coalesce(a.default_country, '(account has no default location)') as account_default_country, count(*) as schedules
from s join events e on e.id = s.event_id left join acct a on a.account_id = e.source_social_media_account_id
group by 1, 2 order by 3 desc, 1 limit 30;
