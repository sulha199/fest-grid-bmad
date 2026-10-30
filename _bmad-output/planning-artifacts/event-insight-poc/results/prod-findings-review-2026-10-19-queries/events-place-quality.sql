-- Filtering and scoring for events with a target area but no usable pin: how many events are in which place situation?
-- Per event (not deleted, not merged), the best situation over its schedules, split by detail level and by whether the event is still open:
--   'trusted-looking pin'      a pin with stored confidence >= 0.5 inside Indonesia's bounding box (the box is a floor: a pin in the wrong province still passes)
--   'pin, but untrusted'       a pin exists but its confidence is below 0.5, or missing, or it lies outside the box
--   'place text only'          no pin on any schedule, but at least one schedule has a location text
--   'no place at all'          no pin and no location text on any schedule
-- Read-only; counts only. location_details is read through the normalising expression because of BUG-068.
with s as (select event_id, latitude, longitude, nullif(btrim(location), '') as loc_text,
  ((case when jsonb_typeof(location_details) = 'object' then location_details
         when jsonb_typeof(location_details) = 'string' and left(location_details #>> '{}', 1) = '{' then (location_details #>> '{}')::jsonb end)->>'confidence') as conf,
  coalesce(event_end_date, event_start_date) >= current_date as is_open
  from schedules),
per_event as (select e.id, e.detail_level,
  bool_or(s.is_open) as open_event,
  bool_or(s.latitude is not null and s.longitude is not null and s.latitude between -11.5 and 6.5 and s.longitude between 94.5 and 141.5
          and s.conf ~ '^-?[0-9]+(\.[0-9]+)?$' and s.conf::float >= 0.5) as has_trusted_pin,
  bool_or(s.latitude is not null and s.longitude is not null) as has_any_pin,
  bool_or(s.loc_text is not null) as has_text
  from events e join s on s.event_id = e.id where e.deleted_at is null and e.merged_into_event_id is null group by e.id, e.detail_level)
select detail_level, case when open_event then 'open' else 'past' end as status,
  case when has_trusted_pin then '1 trusted-looking pin' when has_any_pin then '2 pin, but untrusted' when has_text then '3 place text only' else '4 no place at all' end as place_situation,
  count(*) as events
from per_event group by 1, 2, 3 order by 1, 2, 3;
