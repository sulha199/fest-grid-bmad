-- AD-36 Rule 12 (decision 2026-10-20): the "Wacoal promo" shape = the SAME activity at the SAME time in several places (a branch promo), as opposed to a
-- series over time. Does it exist in production, how big is it, and does it come from one account or from each place's own account?
-- Two events are a concurrent pair when they have the same normalized full name, date ranges that overlap, and different (normalized) place texts.
-- Place text = the main schedule's `location`, else the event's. Read-only. Event names and place texts are those shown in the app; no account ids are printed.

-- 1. Pairs, by who posted them.
with ev as (
  select e.id, e.source_social_media_account_id as acct, e.post_id,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         (select min(s.event_start_date) from schedules s where s.event_id = e.id) as d1,
         (select max(coalesce(s.event_end_date, s.event_start_date)) from schedules s where s.event_id = e.id) as d2,
         btrim(regexp_replace(lower(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location)), '[^a-z0-9]+', ' ', 'g')) as place
  from events e where e.deleted_at is null and e.merged_into_event_id is null),
pairs as (
  select a.nname, a.id as a_id, b.id as b_id, a.acct as acct_a, b.acct as acct_b, (a.post_id is not null and a.post_id = b.post_id) as same_post
  from ev a join ev b on a.nname = b.nname and a.id < b.id and a.nname <> ''
   and a.d1 is not null and b.d1 is not null and a.d1 <= b.d2 and b.d1 <= a.d2
   and a.place <> '' and b.place <> '' and a.place <> b.place)
select case when acct_a = acct_b and same_post then '1 same account, same post (the extractor already split it)'
            when acct_a = acct_b then '2 same account, different posts'
            else '3 different accounts (each place posts its own)' end as concurrent_pairs_by_poster,
       count(*) as pairs, count(distinct nname) as distinct_names
from pairs group by 1 order by 1;

-- 2. Clusters (one normalized name) by size and by how many accounts are in them.
with ev as (
  select e.id, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         (select min(s.event_start_date) from schedules s where s.event_id = e.id) as d1,
         (select max(coalesce(s.event_end_date, s.event_start_date)) from schedules s where s.event_id = e.id) as d2,
         btrim(regexp_replace(lower(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location)), '[^a-z0-9]+', ' ', 'g')) as place
  from events e where e.deleted_at is null and e.merged_into_event_id is null),
pairs as (
  select a.nname, a.id as a_id, b.id as b_id, a.acct as acct_a, b.acct as acct_b
  from ev a join ev b on a.nname = b.nname and a.id < b.id and a.nname <> ''
   and a.d1 is not null and b.d1 is not null and a.d1 <= b.d2 and b.d1 <= a.d2
   and a.place <> '' and b.place <> '' and a.place <> b.place),
members as (select nname, a_id as id, acct_a as acct from pairs union select nname, b_id, acct_b from pairs),
cl as (select nname, count(*) as events, count(distinct acct) as accounts from members group by nname)
select case when events = 2 then '2 events' when events = 3 then '3 events' when events <= 5 then '4-5 events' else '6 or more events' end as cluster_size,
       case when accounts = 1 then 'one account' else 'several accounts' end as posted_by,
       count(*) as clusters, sum(events) as events_in_them
from cl group by 1, 2 order by 1, 2;

-- 3. The 25 largest clusters, to look at (names and places as shown in the app).
with ev as (
  select e.id, e.event_name, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         (select min(s.event_start_date) from schedules s where s.event_id = e.id) as d1,
         (select max(coalesce(s.event_end_date, s.event_start_date)) from schedules s where s.event_id = e.id) as d2,
         btrim(regexp_replace(lower(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location)), '[^a-z0-9]+', ' ', 'g')) as place
  from events e where e.deleted_at is null and e.merged_into_event_id is null),
pairs as (
  select a.nname, a.id as a_id, b.id as b_id, a.acct as acct_a, b.acct as acct_b
  from ev a join ev b on a.nname = b.nname and a.id < b.id and a.nname <> ''
   and a.d1 is not null and b.d1 is not null and a.d1 <= b.d2 and b.d1 <= a.d2
   and a.place <> '' and b.place <> '' and a.place <> b.place),
members as (select nname, a_id as id from pairs union select nname, b_id from pairs)
select left(max(ev.event_name), 60) as event_name, count(*) as events, count(distinct ev.acct) as accounts, min(ev.d1) as first_date, max(ev.d2) as last_date,
       left(string_agg(distinct left(ev.place, 24), ' | '), 110) as places
from members m join ev on ev.id = m.id group by m.nname order by count(*) desc, 1 limit 25;

-- 4. The named example: every "Wacoal" event, to see its real shape (one post or many, one place text or many, dates).
select left(e.event_name, 60) as event_name, e.detail_level, e.post_id is not null as has_post,
       (select min(s.event_start_date) from schedules s where s.event_id = e.id) as first_date,
       (select max(coalesce(s.event_end_date, s.event_start_date)) from schedules s where s.event_id = e.id) as last_date,
       (select count(*) from schedules s where s.event_id = e.id) as schedules,
       (select count(distinct lower(s.location)) from schedules s where s.event_id = e.id) as distinct_schedule_places,
       left(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location), 50) as main_place
from events e where e.deleted_at is null and lower(e.event_name) like '%wacoal%' order by 4, 1 limit 40;
