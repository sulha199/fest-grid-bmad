with ev as materialized (select e.id, e.source_social_media_account_id acct, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname from events e),
dup as (select a.id aid, b.id bid from ev a join ev b on a.acct=b.acct and a.nname=b.nname and a.id<b.id),
cand as (select least(event_id,candidate_event_id) x, greatest(event_id,candidate_event_id) y, score from event_match_candidates)
select (select count(*) from dup) same_name_pairs,
  (select count(*) from dup d where exists (select 1 from cand c where c.x=least(d.aid,d.bid) and c.y=greatest(d.aid,d.bid))) of_those_in_candidates,
  (select count(*) from cand) candidate_pairs,
  (select count(*) from cand c join ev a on a.id=c.x join ev b on b.id=c.y where a.acct=b.acct) candidate_same_account,
  (select count(*) from cand c join ev a on a.id=c.x join ev b on b.id=c.y where a.nname=b.nname) candidate_same_name;
\echo === are SCH-family duplicates among the candidates (Choir / Halloween / Line Dance / Zumba / REBORN umbrella) ===
select count(*) pairs_touching_family from event_match_candidates m join events a on a.id=m.event_id join events b on b.id=m.candidate_event_id
where a.event_name ~* '^SCH (choir|halloween)|line dance|zumba|8th anniversary' and b.event_name ~* '^SCH (choir|halloween)|line dance|zumba|8th anniversary';
\echo === how the pending candidates were created (age) ===
select min(created_at)::date oldest, max(created_at)::date newest, count(*) filter (where created_at < now() - interval '7 days') older_than_7d from event_match_candidates;
