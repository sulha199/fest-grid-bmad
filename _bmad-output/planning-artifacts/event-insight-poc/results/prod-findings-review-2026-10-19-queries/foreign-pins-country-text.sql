-- AD-14 Rule 4 (e), Round 4 ask 5: for pins OUTSIDE Indonesia's bounding box, does the stated text name a country? The expected-country leg can only
-- withhold a map link when the text says which country the event is in; this sizes how many outside-the-box pins have such a text and how many have none.
-- Text read: the schedule's location text first, then the event's location text. Country names: a short list, English and Indonesian, matched as whole words
-- (the list in packages/domain/src/geolocation/ is the real one; this is a floor and over- or under-counts at the edges, e.g. "Georgia", "Jordan").
-- 'indonesia' is in the list on purpose: an Indonesian text with a pin outside the box is the case the leg corrects.
-- Read-only; counts only (the second result set prints the matched country name, never the text).
with names(n) as (values
  ('indonesia'),('malaysia'),('singapore'),('singapura'),('thailand'),('vietnam'),('filipina'),('philippines'),('jepang'),('japan'),('korea'),('china'),('tiongkok'),
  ('india'),('australia'),('denmark'),('egypt'),('mesir'),('amerika'),('united states'),('usa'),('inggris'),('england'),('united kingdom'),('jerman'),('germany'),
  ('prancis'),('france'),('belanda'),('netherlands'),('spanyol'),('spain'),('italia'),('italy'),('brazil'),('brasil'),('turki'),('turkey'),('kanada'),('canada'),
  ('selandia baru'),('new zealand'),('arab saudi'),('saudi arabia'),('hong kong'),('taiwan'),('uni emirat arab'),('uae')),
s as (
  select s.id, s.event_id, nullif(btrim(s.location), '') as stext, nullif(btrim(e.location), '') as etext
  from schedules s join events e on e.id = s.event_id
  where e.deleted_at is null and e.merged_into_event_id is null and s.latitude is not null and s.longitude is not null
    and not (s.latitude between -11.5 and 6.5 and s.longitude between 94.5 and 141.5)),
hit as (
  select s.id,
         (select min(n.n) from names n where s.stext is not null and lower(s.stext) ~ ('(^|[^a-z])' || n.n || '([^a-z]|$)')) as in_schedule_text,
         (select min(n.n) from names n where s.etext is not null and lower(s.etext) ~ ('(^|[^a-z])' || n.n || '([^a-z]|$)')) as in_event_text
  from s)
select case when in_schedule_text is not null then '1 country named in the schedule text'
            when in_event_text is not null then '2 country named only in the event text'
            else '3 no country named' end as text_situation,
       count(*) as pins_outside_the_box
from hit group by 1 order by 1;

with names(n) as (values
  ('indonesia'),('malaysia'),('singapore'),('singapura'),('thailand'),('vietnam'),('filipina'),('philippines'),('jepang'),('japan'),('korea'),('china'),('tiongkok'),
  ('india'),('australia'),('denmark'),('egypt'),('mesir'),('amerika'),('united states'),('usa'),('inggris'),('england'),('united kingdom'),('jerman'),('germany'),
  ('prancis'),('france'),('belanda'),('netherlands'),('spanyol'),('spain'),('italia'),('italy'),('brazil'),('brasil'),('turki'),('turkey'),('kanada'),('canada'),
  ('selandia baru'),('new zealand'),('arab saudi'),('saudi arabia'),('hong kong'),('taiwan'),('uni emirat arab'),('uae')),
s as (
  select s.id, coalesce(nullif(btrim(s.location), ''), nullif(btrim(e.location), '')) as t,
         ((case when jsonb_typeof(s.location_details) = 'object' then s.location_details
                when jsonb_typeof(s.location_details) = 'string' and left(s.location_details #>> '{}', 1) = '{' then (s.location_details #>> '{}')::jsonb end)->>'countryCode') as pin_country
  from schedules s join events e on e.id = s.event_id
  where e.deleted_at is null and e.merged_into_event_id is null and s.latitude is not null and s.longitude is not null
    and not (s.latitude between -11.5 and 6.5 and s.longitude between 94.5 and 141.5))
select n.n as country_named_in_the_text, coalesce(upper(s.pin_country), '(none stored)') as pin_country_code, count(*) as pins
from s join names n on s.t is not null and lower(s.t) ~ ('(^|[^a-z])' || n.n || '([^a-z]|$)')
group by 1, 2 order by 3 desc, 1 limit 30;
