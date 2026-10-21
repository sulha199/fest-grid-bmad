-- Round 4 ask 3 (round-3-analysis-2026-10-20.md section 6): one row per live event with just what the phrase-and-order series score needs, so the
-- cut-off can be read off real pairs and the cross-account candidates (Sports Station, J.CO, ...) can be looked at. Read-only, a single SELECT.
--
-- What is printed: the event name and place text exactly as the app shows them, the main schedule's date range, and four facts about the poster.
-- What is NOT printed: no caption, no link, no handle, no platform account id. The account is a pseudonym that is stable only inside this
-- result ("A0001"); `acct_type` is the profile's classification (ORGANIZER_VENUE_EVENT, CURATOR_GUIDE, PERSONAL, or empty), which is how a
-- brand/mall account is told from an aggregator. `organizer_name` is cut to 40 characters because BUG-071 stores model reasoning in some rows;
-- drop that column if you would rather not share it.
-- Scope: events not deleted and not merged into another, past and future (the cut-off needs as many real pairs as possible).
-- Run it however you query production; to get a file, export the result as CSV (Supabase SQL editor: Results > Download CSV; psql: `\pset format csv`
-- then `\o event-names.csv` before running it). About 1,400 rows.

with ev as (
  select e.id, e.event_name, e.detail_level, e.post_id is not null as has_post,
         e.source_social_media_account_id as acct, left(e.organizer_name, 40) as organizer_name,
         (select min(s.event_start_date) from schedules s where s.event_id = e.id) as d1,
         (select max(coalesce(s.event_end_date, s.event_start_date)) from schedules s where s.event_id = e.id) as d2,
         coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location) as place
  from events e
  where e.deleted_at is null and e.merged_into_event_id is null),
acc as (
  select acct, dense_rank() over (order by acct) as n
  from (select distinct acct from ev where acct is not null) x)
select left(ev.id::text, 8)                              as row_ref,
       left(ev.event_name, 120)                          as event_name,
       left(ev.place, 120)                               as place,
       ev.d1                                             as first_date,
       ev.d2                                             as last_date,
       ev.detail_level,
       ev.has_post,
       case when acc.n is null then '' else 'A' || lpad(acc.n::text, 4, '0') end as acct,
       (select p.account_type::text
          from social_media_account_profiles p
         where p.account_id = ev.acct
         order by (p.account_type_status = 'CONFIRMED') desc nulls last, p.id
         limit 1)                                        as acct_type,
       ev.organizer_name
from ev left join acc on acc.acct = ev.acct
order by ev.d1 nulls last, ev.event_name, ev.id;
