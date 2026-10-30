-- IDEA-085, second cut. recall-classes.sql found 166 pairs the matcher can reach, 21 of them in the candidate list.
-- Hypothesis from the code (process-ingestion-job.ts + packages/domain/src/events/match-scoring.ts): for a roundup- or curator-sourced item the organizer
-- weight (0.40) is discounted on purpose (BUG-058), so a same-name, same-day pair scores at most 0.25 (+0.15 same venue) = 0.40, under the 0.45 'mid'
-- threshold: it is never a candidate unless the two events share a link (+0.20). A pair of two organizer-authored events scores at least 0.65 ('mid').
-- If the hypothesis is right, the uncovered reachable pairs are almost all in the 'at least one stub' rows and the 'both full' rows are nearly all covered.
-- Read-only; counts only.
with ev as materialized (select e.id, e.source_social_media_account_id acct, e.created_at, e.detail_level,
                         btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname
                         from events e where e.deleted_at is null and e.merged_into_event_id is null),
t0 as (select min(created_at) first_candidate_at from event_match_candidates),
lk as materialized (select e.id, lower(regexp_replace(split_part(x->>'url','?',1),'/$','')) u
                    from events e, jsonb_array_elements(case when jsonb_typeof(e.links) = 'array' then e.links
                                                            when jsonb_typeof(e.links) = 'string' and left(e.links #>> '{}', 1) = '[' then (e.links #>> '{}')::jsonb
                                                            else '[]'::jsonb end) x
                    where x->>'url' is not null),
pairs as (select a.id aid, b.id bid, greatest(a.created_at, b.created_at) later_created, (a.detail_level = 'stub' or b.detail_level = 'stub') any_stub
          from ev a join ev b on a.acct = b.acct and a.nname = b.nname and a.id < b.id),
reach as (select p.*,
  exists (select 1 from lk x join lk y on x.u = y.u where x.id = p.aid and y.id = p.bid) as shares_link,
  exists (select 1 from event_match_candidates c where (c.event_id = p.aid and c.candidate_event_id = p.bid) or (c.event_id = p.bid and c.candidate_event_id = p.aid)) as in_candidates
  from pairs p
  where not exists (select 1 from event_posts x join event_posts y on x.post_id = y.post_id where x.event_id = p.aid and y.event_id = p.bid)
    and p.later_created >= (select first_candidate_at from t0)
    and exists (select 1 from schedules sa join schedules sb on sb.event_start_date between sa.event_start_date - 2 and sa.event_start_date + 2 where sa.event_id = p.aid and sb.event_id = p.bid))
select case when any_stub then 'at least one stub (organizer weight discounted)' else 'both full (organizer weight applies)' end as pair_kind,
       case when shares_link then 'shares a link' else 'no shared link' end as link,
       count(*) as pairs, count(*) filter (where in_candidates) as in_candidate_list
from reach group by 1, 2 order by 1, 2;
