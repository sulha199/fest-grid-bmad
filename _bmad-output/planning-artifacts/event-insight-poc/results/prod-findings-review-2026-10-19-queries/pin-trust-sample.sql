-- AD-14 Rule 4 / BUG-066: a stratified sample of stored pins for a PERSON to label, so the pin-trust floor and the `full_match` clause are calibrated
-- on judged pins instead of guessed. Round 2 already gave the confidence and match-type histograms (confidence-by-country-box.sql); what no query can
-- give is whether a pin is RIGHT. Strata = inside/outside Indonesia's box x stored-confidence band x match class (full_match or other); up to 4 pins per
-- stratum, chosen by a hash of the schedule id (the same rows on every run). Every row carries its stratum's population and sample size, so the scorer
-- (scripts/poc-event-insight/score-pin-trust-labels.ts) can weight the labels back to the whole table.
-- Run with --csv (see the brief, item 14). Read-only. Venue and place names only, as shown in the app; the row reference is a hash, not an id.
-- location_details is read through the normalising expression because of BUG-068.
-- The `label` column is empty: the owner fills it with  Y  (the pin is the place the text means),  C  (right city or area, wrong place),
-- N  (wrong place or country)  or  ?  (cannot tell).
with s as (
  select sc.id, sc.location, sc.latitude, sc.longitude,
         (case when jsonb_typeof(sc.location_details) = 'object' then sc.location_details
               when jsonb_typeof(sc.location_details) = 'string' and left(sc.location_details #>> '{}', 1) = '{' then (sc.location_details #>> '{}')::jsonb end) as d
  from schedules sc where sc.latitude is not null and sc.longitude is not null
), b as (
  select id, location, d,
         (latitude between -11.5 and 6.5 and longitude between 94.5 and 141.5) as inside_box,
         case when d->>'confidence' ~ '^-?[0-9]+(\.[0-9]+)?$' then (d->>'confidence')::float end as conf,
         case when d->>'matchType' = 'full_match' then 'full_match' else 'other' end as match_class
  from s
), c as (
  select *,
         case when conf is null then 'none'
              when conf < 0.001 then '0.00'
              when conf < 0.25 then '0.01-0.24'
              when conf < 0.5 then '0.25-0.49'
              when conf < 0.75 then '0.50-0.74'
              when conf < 0.999 then '0.75-0.99'
              else '1.00' end as band
  from b
), r as (
  select *,
         count(*) over (partition by inside_box, band, match_class) as stratum_population,
         row_number() over (partition by inside_box, band, match_class order by md5(id::text)) as rn
  from c
)
select case when inside_box then 'inside' else 'outside' end as pin_box,
       band as confidence_band,
       match_class,
       stratum_population,
       least(stratum_population, 4) as stratum_sampled,
       left(md5(id::text), 8) as row_ref,
       left(coalesce(location, ''), 90) as schedule_location_text,
       left(coalesce(d->>'formattedAddress', ''), 120) as pin_address,
       coalesce(d->>'city', '') as pin_city,
       coalesce(d->>'countryCode', '') as pin_country,
       round(conf::numeric, 2) as confidence,
       coalesce(d->>'matchType', '') as match_type,
       '' as label
from r
where rn <= 4
order by pin_box, band, match_class, rn;
