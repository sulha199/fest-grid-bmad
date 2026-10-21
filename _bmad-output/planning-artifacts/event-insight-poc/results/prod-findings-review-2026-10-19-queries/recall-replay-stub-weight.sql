-- IDEA-085 / AD-30 Rule 7, Round 4 ask 1: the same replay as recall-replay.sql, run at three values of the same-poster stub signal (0.00 = today,
-- 0.10, 0.20) so the weight is read off the rows and not off arithmetic. Added to the replay: for a pair whose newer event is a stub and whose places match
-- (the replay's venue test: same text, or coordinates within 150 m), the signal is added to the score; the pairs are same-poster and same-normalized-name by
-- construction. Also reports how many pairs are EXACT REPEATS in the adopted sense (identical date range and start time on the main schedule, same place):
-- those are the pairs the exact-repeat rule merges and so never need the weight. The ceiling for a stub pair is 0.25 + 0.15 + 0.20 = 0.60 (never 'high').
-- Read-only; counts only. Needs events, posts, schedules, event_posts, post_account_associations, event_match_candidates and pg_trgm.
with t0 as (select min(created_at) first_candidate_at from event_match_candidates),
ev as materialized (select e.id, e.source_social_media_account_id acct, e.created_at, e.detail_level, e.post_id, e.event_name,
                    btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname
                    from events e where e.deleted_at is null and e.merged_into_event_id is null),
lk as materialized (select e.id, lower(regexp_replace(split_part(x->>'url','?',1),'/$','')) u
                    from events e, jsonb_array_elements(case when jsonb_typeof(e.links) = 'array' then e.links
                                                            when jsonb_typeof(e.links) = 'string' and left(e.links #>> '{}', 1) = '[' then (e.links #>> '{}')::jsonb
                                                            else '[]'::jsonb end) x
                    where x->>'url' is not null),
pairs as (select a.id aid, b.id bid, greatest(a.created_at, b.created_at) later_created,
                 case when a.created_at <= b.created_at then a.id else b.id end old_id,
                 case when a.created_at <= b.created_at then b.id else a.id end new_id
          from ev a join ev b on a.acct = b.acct and a.nname = b.nname and a.id < b.id),
reach as (select p.* from pairs p
  where not exists (select 1 from event_posts x join event_posts y on x.post_id = y.post_id where x.event_id = p.aid and y.event_id = p.bid)
    and p.later_created >= (select first_candidate_at from t0)
    and exists (select 1 from schedules sa join schedules sb on sb.event_start_date between sa.event_start_date - 2 and sa.event_start_date + 2 where sa.event_id = p.aid and sb.event_id = p.bid)),
inp as (select r.old_id, r.new_id, n.detail_level = 'stub' as new_is_stub,
  (n.detail_level <> 'stub' and exists (select 1 from posts np join event_posts ep on ep.event_id = r.old_id join post_account_associations paa on paa.post_id = ep.post_id
                                       where np.id = n.post_id and paa.account_id = np.account_id)) as organizer_match,
  exists (select 1 from lk x join lk y on x.u = y.u where x.id = r.old_id and y.id = r.new_id) as shared_link,
  similarity(o.event_name, n.event_name)::numeric as name_sim,
  (select min(abs(sn.event_start_date - so.event_start_date)) from schedules so join schedules sn on sn.event_id = r.new_id where so.event_id = r.old_id) as min_day_diff,
  exists (select 1 from schedules so join schedules sn on sn.event_id = r.new_id
          where so.event_id = r.old_id
            and ((so.location is not null and sn.location is not null and lower(btrim(so.location)) = lower(btrim(sn.location)))
              or (so.latitude is not null and so.longitude is not null and sn.latitude is not null and sn.longitude is not null
                  and 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(sn.latitude - so.latitude) / 2), 2)
                        + cos(radians(so.latitude)) * cos(radians(sn.latitude)) * power(sin(radians(sn.longitude - so.longitude) / 2), 2)))) <= 150))) as venue_match,
  exists (select 1 from schedules so join schedules sn on sn.event_id = r.new_id and sn.is_main_schedule
          where so.event_id = r.old_id and so.is_main_schedule and so.event_start_date = sn.event_start_date
            and coalesce(so.event_end_date, so.event_start_date) = coalesce(sn.event_end_date, sn.event_start_date)
            and so.event_start_time is not distinct from sn.event_start_time) as same_range_and_time,
  exists (select 1 from event_match_candidates c where (c.event_id = r.aid and c.candidate_event_id = r.bid) or (c.event_id = r.bid and c.candidate_event_id = r.aid)) as in_candidates
  from reach r join ev n on n.id = r.new_id join ev o on o.id = r.old_id),
w as (select unnest(array[0.00, 0.10, 0.20]) as stub_weight),
scored as (select i.*, w.stub_weight, round(
    (case when organizer_match then 0.40 else 0 end) + (case when shared_link then 0.20 else 0 end)
    + 0.25 * ((least(1, greatest(0, name_sim)) + greatest(0, 1 - coalesce(min_day_diff, 99) / 2.0)) / 2)
    + (case when venue_match then 0.15 else 0 end)
    + (case when new_is_stub and venue_match then w.stub_weight else 0 end), 6) as score from inp i cross join w)
select stub_weight,
       case when new_is_stub then 'newer event is a stub (organizer discounted)' else 'newer event is a full event' end as newer_event,
       case when score >= 0.75 then 'high' when score >= 0.45 then 'mid' else 'low' end as replay_tier,
       count(*) as pairs, count(*) filter (where in_candidates) as in_candidate_list,
       count(*) filter (where not in_candidates and score >= 0.45) as should_have_been_candidate_but_is_not,
       count(*) filter (where venue_match and same_range_and_time) as exact_repeat_pairs,
       count(*) filter (where venue_match) as venue_matched,
       round(avg(score), 3) as mean_score
from scored group by 1, 2, 3 order by 1, 2, 3;
