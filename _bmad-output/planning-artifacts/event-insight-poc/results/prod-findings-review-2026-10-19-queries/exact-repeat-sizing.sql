-- AD-30 Rule 7, exact repeats (adopted 2026-10-20): size the rule on the real rows, WITH the start time the names export did not carry.
-- The rule: the same poster, the same normalized name, the same place, the same date range AND the same start time on the main schedule is one event posted twice.
-- The export-based figure was 195 pairs, 56 clusters, 150 events, about 94 soft deletes; it had no start time and only a crude place check. This replays the
-- rule on the database and applies the exclusions the rule lists (a rejected pair, a correction or pending report, two items of one post).
-- Place check here = the same place text after lower-casing and dropping punctuation (a floor: "Atrium Shinta, Lantai GF, Sleman City Hall" against
-- "Atrium Shinta, Ground Floor, Sleman City Hall" is NOT counted, so the real isSamePlace count is higher). Poster = events.source_social_media_account_id.
-- Read-only; counts first, then at most 15 groups as the app shows them (name, place, dates, time; no caption, link, handle or platform id).
-- Five result sets: (1) the summary, (2) by account type and detail level, (3) the lenient pairs by how they differ (the 195-versus-227 question),
-- (4) the exclusions, (5) the largest groups.
with m as (
  select e.id, e.event_name, e.detail_level, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         s.event_start_date as d1, coalesce(s.event_end_date, s.event_start_date) as d2, s.event_start_time as t1,
         s.location as place, btrim(regexp_replace(lower(coalesce(s.location, '')), '[^a-z0-9]+', ' ', 'g')) as pnorm,
         (select p.account_type::text from social_media_account_profiles p where p.account_id = e.source_social_media_account_id
           order by (p.account_type_status = 'CONFIRMED') desc nulls last, p.id limit 1) as acct_type
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null and e.source_social_media_account_id is not null),
g as (
  select acct, nname, d1, d2, t1, pnorm, count(*) as n, array_agg(id) as ids, min(event_name) as nm, min(place) as pl,
         min(acct_type) as acct_type, min(detail_level) as detail_level, bool_and(d2 < current_date) as all_past
  from m where nname <> '' group by acct, nname, d1, d2, t1, pnorm having count(*) > 1),
flag as (
  select g.*,
    exists (select 1 from corrections c where c.event_id = any (g.ids) and c.status in ('pending', 'applied', 'awaiting_verification')) as has_correction,
    exists (select 1 from reports r where r.event_id = any (g.ids) and r.status = 'pending') as has_pending_report,
    exists (select 1 from event_posts a join event_posts b on a.post_id = b.post_id and a.event_id < b.event_id
             where a.event_id = any (g.ids) and b.event_id = any (g.ids)) as same_post,
    exists (select 1 from event_match_candidates c where c.status = 'rejected' and c.event_id = any (g.ids) and c.candidate_event_id = any (g.ids)) as rejected_pair
  from g)
-- (1) the summary
select 'identity groups: same poster, name, place text, date range, start time' as measure,
       count(*) as groups, sum(n) as events, sum(n - 1) as would_be_soft_deleted,
       count(*) filter (where t1 is null) as groups_without_a_start_time,
       count(*) filter (where all_past) as groups_already_ended,
       count(*) filter (where has_correction or has_pending_report or same_post or rejected_pair) as groups_blocked_by_an_exclusion,
       coalesce(sum(n - 1) filter (where not (has_correction or has_pending_report or same_post or rejected_pair)), 0) as would_be_soft_deleted_after_exclusions
from flag;

-- (2) by account type and detail level
with m as (
  select e.id, e.detail_level, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         s.event_start_date as d1, coalesce(s.event_end_date, s.event_start_date) as d2, s.event_start_time as t1,
         btrim(regexp_replace(lower(coalesce(s.location, '')), '[^a-z0-9]+', ' ', 'g')) as pnorm
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null and e.source_social_media_account_id is not null),
g as (select acct, nname, d1, d2, t1, pnorm, count(*) as n, min(detail_level) as detail_level
      from m where nname <> '' group by acct, nname, d1, d2, t1, pnorm having count(*) > 1)
select coalesce((select p.account_type::text from social_media_account_profiles p where p.account_id = g.acct
                  order by (p.account_type_status = 'CONFIRMED') desc nulls last, p.id limit 1), '(unclassified)') as acct_type,
       g.detail_level, count(*) as groups, sum(g.n) as events, sum(g.n - 1) as would_be_soft_deleted
from g group by 1, 2 order by 3 desc, 1, 2;

-- (3) the lenient pairs (same poster, name, place text, overlapping date ranges) by how they differ: identical range and time is the rule; the others stay in the queue
with m as (
  select e.id, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         s.event_start_date as d1, coalesce(s.event_end_date, s.event_start_date) as d2, s.event_start_time as t1,
         btrim(regexp_replace(lower(coalesce(s.location, '')), '[^a-z0-9]+', ' ', 'g')) as pnorm
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null and e.source_social_media_account_id is not null)
select case when a.d1 = b.d1 and a.d2 = b.d2 and a.t1 is not distinct from b.t1 then '1 identical range and start time (the rule)'
            when a.d1 = b.d1 and a.d2 = b.d2 then '2 identical range, start time differs or is missing on one side'
            else '3 ranges overlap but differ (stays in the moderator queue)' end as relation,
       count(*) as pairs
from m a join m b on a.acct = b.acct and a.nname = b.nname and a.pnorm = b.pnorm and a.id < b.id and a.nname <> ''
 and a.d1 <= b.d2 and b.d1 <= a.d2
group by 1 order by 1;

-- (4) the exclusions, counted over the events in identity groups (a group with any flagged event is treated as blocked)
with m as (
  select e.id, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         s.event_start_date as d1, coalesce(s.event_end_date, s.event_start_date) as d2, s.event_start_time as t1,
         btrim(regexp_replace(lower(coalesce(s.location, '')), '[^a-z0-9]+', ' ', 'g')) as pnorm
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null and e.source_social_media_account_id is not null),
g as (select acct, nname, d1, d2, t1, pnorm, array_agg(id) as ids from m where nname <> '' group by acct, nname, d1, d2, t1, pnorm having count(*) > 1)
select 'groups with an event that has a correction (pending, applied or awaiting verification)' as exclusion,
       count(*) filter (where exists (select 1 from corrections c where c.event_id = any (g.ids) and c.status in ('pending', 'applied', 'awaiting_verification'))) as groups
from g
union all
select 'groups with an event that has a pending report',
       count(*) filter (where exists (select 1 from reports r where r.event_id = any (g.ids) and r.status = 'pending'))
from g
union all
select 'groups where two events are linked to the same post (the extractor said they are distinct)',
       count(*) filter (where exists (select 1 from event_posts a join event_posts b on a.post_id = b.post_id and a.event_id < b.event_id
                                       where a.event_id = any (g.ids) and b.event_id = any (g.ids)))
from g
union all
select 'groups where a moderator already rejected the pair',
       count(*) filter (where exists (select 1 from event_match_candidates c where c.status = 'rejected' and c.event_id = any (g.ids) and c.candidate_event_id = any (g.ids)))
from g;

-- (5) the 15 largest identity groups, as the app shows them, so the owner can read what would be merged
with m as (
  select e.id, e.event_name, e.source_social_media_account_id as acct,
         btrim(regexp_replace(lower(e.event_name), '[^a-z0-9]+', ' ', 'g')) as nname,
         s.event_start_date as d1, coalesce(s.event_end_date, s.event_start_date) as d2, s.event_start_time as t1, s.location as place,
         btrim(regexp_replace(lower(coalesce(s.location, '')), '[^a-z0-9]+', ' ', 'g')) as pnorm
  from events e
  join lateral (select * from schedules x where x.event_id = e.id order by x.is_main_schedule desc, x.event_start_date, x.id limit 1) s on true
  where e.deleted_at is null and e.merged_into_event_id is null and e.source_social_media_account_id is not null)
select count(*) as events, left(min(event_name), 70) as event_name, left(min(place), 50) as place, d1 as first_date, d2 as last_date, t1 as start_time,
       coalesce((select p.account_type::text from social_media_account_profiles p where p.account_id = m.acct
                  order by (p.account_type_status = 'CONFIRMED') desc nulls last, p.id limit 1), '(unclassified)') as acct_type
from m where nname <> '' group by acct, nname, d1, d2, t1, pnorm having count(*) > 1
order by count(*) desc, min(event_name) limit 15;
