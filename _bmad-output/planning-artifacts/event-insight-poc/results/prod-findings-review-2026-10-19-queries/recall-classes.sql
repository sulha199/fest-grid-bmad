-- IDEA-085 / FIND-091: split the "446 same-account, same-name pairs" into the classes the matcher can and cannot act on.
-- Read-only; counts only. Needs the same grants as cand.sql (events incl. source_social_media_account_id, schedules, event_posts, event_match_candidates).
-- Why: the matcher (apps/backend/src/lib/events/match-event-to-existing.ts) only runs when a NEW item is ingested (so pairs that already existed when it
-- first ran are out of reach), skips events that share the new item's post (sibling guard), and only looks at schedules within +/-2 days. A same-name pair
-- outside those rules is not a matcher miss: it is a recurring event, a multi-event post or a legacy pair.
with t0 as (select min(created_at) first_candidate_at from event_match_candidates),
ev as materialized (select e.id, e.source_social_media_account_id acct, e.created_at, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname
                    from events e where e.deleted_at is null and e.merged_into_event_id is null),
pairs as (select a.id aid, b.id bid, greatest(a.created_at, b.created_at) later_created from ev a join ev b on a.acct = b.acct and a.nname = b.nname and a.id < b.id),
cls as (select p.*,
  exists (select 1 from event_posts x join event_posts y on x.post_id = y.post_id where x.event_id = p.aid and y.event_id = p.bid) as same_post,
  exists (select 1 from schedules sa join schedules sb on sb.event_start_date between sa.event_start_date - 2 and sa.event_start_date + 2 where sa.event_id = p.aid and sb.event_id = p.bid) as dates_within_2d,
  exists (select 1 from event_match_candidates c where (c.event_id = p.aid and c.candidate_event_id = p.bid) or (c.event_id = p.bid and c.candidate_event_id = p.aid)) as in_candidates
  from pairs p)
select case when same_post then '1 same post (sibling guard, by design)'
            when later_created < (select first_candidate_at from t0) then '2 created before the matcher produced its first candidate'
            when not dates_within_2d then '3 dates more than 2 days apart (recurring or a different occurrence)'
            else '4 reachable by the matcher' end as class,
       count(*) as pairs, count(*) filter (where in_candidates) as in_candidate_list
from cls group by 1 order by 1;
