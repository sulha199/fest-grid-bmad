-- Unit-of-event decision (the Riot Jogja "Wednesday Night Run" case: one event, three schedules, three venues): how many events in production hold schedules at
-- more than one place, by the post's grouping reason (the extractor's own judgement: single-event, program-lineup, dependent-stages, separate-events, roundup)?
-- A place is the schedule's location text (case-insensitive) or its pin rounded to about 100 m; two venues in one mall may count as one pin and two texts.
-- Shape 2 is the residual a deterministic splitter cannot resolve (BUG-064: a 3-venue festival had location null on every schedule, the venue only in the schedule title).
-- Read-only; counts only, no event names.
with s as (select event_id, nullif(lower(btrim(location)), '') as loc, round(latitude::numeric, 3) as lat, round(longitude::numeric, 3) as lng, event_start_date from schedules),
per_event as (select e.id, e.detail_level, coalesce(p.grouping_reason::text, '(no post)') as grouping_reason,
  count(*) as schedules,
  count(distinct s.loc) as distinct_texts,
  count(distinct (s.lat, s.lng)) filter (where s.lat is not null and s.lng is not null) as distinct_pins,
  bool_or(coalesce(s.event_start_date, current_date) >= current_date) as has_open_schedule
  from events e join s on s.event_id = e.id left join posts p on p.id = e.post_id
  where e.deleted_at is null and e.merged_into_event_id is null
  group by e.id, e.detail_level, p.grouping_reason)
select grouping_reason, detail_level,
  case when distinct_texts > 1 or distinct_pins > 1 then '1 more than one place' when schedules > 1 and distinct_texts = 0 and distinct_pins = 0 then '2 several schedules, no place at all (the place may sit in the schedule titles)' when schedules > 1 then '3 several dates, one place' else '4 one schedule' end as shape,
  count(*) as events, count(*) filter (where has_open_schedule) as events_with_an_open_schedule, sum(schedules) as schedules
from per_event group by 1, 2, 3 order by 1, 2, 3;
