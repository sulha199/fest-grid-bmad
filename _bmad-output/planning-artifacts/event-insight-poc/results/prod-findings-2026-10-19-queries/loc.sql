\echo === coordinates: columns vs location_details ===
select count(*) schedules, count(*) filter (where latitude is not null and longitude is not null) with_lat_lng_cols,
  count(*) filter (where location_details->'coordinates' is not null) with_details_coordinates,
  count(*) filter (where location_details is null and latitude is null) no_location_at_all,
  count(*) filter (where latitude is not null and (latitude not between -11.5 and 6.5 or longitude not between 94.5 and 141.5)) pins_outside_indonesia_bbox,
  count(*) filter (where latitude is not null and latitude between -8.3 and -7.4 and longitude between 109.9 and 110.9) pins_in_diy_region_bbox
from schedules;
\echo === location_details top-level keys (counts) ===
select k, count(*) from schedules, jsonb_object_keys(location_details) k where location_details is not null group by 1 order by 2 desc;
\echo === events with location text vs schedules ===
select count(*) events, count(*) filter (where location is null or btrim(location)='') event_location_empty,
  count(*) filter (where not exists (select 1 from schedules s where s.event_id=e.id and s.latitude is not null)) events_no_pin_on_any_schedule
from events e;
\echo === in the SCH/REBORN family: how many schedules have pins ===
select count(*) schedules, count(*) filter (where s.latitude is not null) pinned, count(*) filter (where s.location is null or btrim(s.location)='') schedule_location_empty
from events e join schedules s on s.event_id=e.id where e.source_social_media_account_id='slemancityhall';
