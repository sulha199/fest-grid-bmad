\echo === location_details jsonb types ===
select jsonb_typeof(location_details) t, count(*) from schedules group by 1 order by 2 desc;
\echo === outside-Indonesia pins: rounded cluster (lat,lng) with sample location text ===
select round(latitude::numeric,0) lat, round(longitude::numeric,0) lng, count(*) n, count(distinct e.source_social_media_account_id) accts,
  left(min(coalesce(s.location,e.location)),40) sample_a, left(max(coalesce(s.location,e.location)),40) sample_b
from schedules s join events e on e.id=s.event_id
where s.latitude is not null and (s.latitude not between -11.5 and 6.5 or s.longitude not between 94.5 and 141.5)
group by 1,2 order by 3 desc limit 15;
\echo === how many of these outside pins are on slemancityhall events ===
select count(*) filter (where e.source_social_media_account_id='slemancityhall') sch_outside, count(*) outside_total
from schedules s join events e on e.id=s.event_id where s.latitude is not null and (s.latitude not between -11.5 and 6.5 or s.longitude not between 94.5 and 141.5);
