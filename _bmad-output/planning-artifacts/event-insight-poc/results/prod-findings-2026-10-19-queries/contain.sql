with ev as materialized (select e.source_social_media_account_id acct, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname,
  min(e.event_name) disp, (select min(event_start_date) from schedules s where s.event_id=e.id) d1,
  (select max(coalesce(event_end_date,event_start_date)) from schedules s where s.event_id=e.id) d2, e.id
  from events e group by e.id),
u as (select acct, nname, min(disp) disp, min(d1) d1, max(d2) d2 from ev where d2-d1 >= 2 group by acct, nname),
m as (select u.acct, u.disp, u.nname un, u.d1, u.d2, count(distinct c.nname) kids
      from u join ev c on c.acct=u.acct and c.nname<>u.nname and c.d1>=u.d1 and c.d2<=u.d2 and (c.d2-c.d1) < (u.d2-u.d1) group by 1,2,3,4,5)
select count(*) umbrella_candidates, count(*) filter (where kids>=2) ge2, count(*) filter (where kids>=3) ge3, count(*) filter (where kids>=5) ge5, count(*) filter (where kids>=10) ge10, max(kids) max_kids from m;
\echo --- top 14 by distinct children (date containment only, same account) ---
with ev as materialized (select e.source_social_media_account_id acct, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname,
  min(e.event_name) disp, (select min(event_start_date) from schedules s where s.event_id=e.id) d1,
  (select max(coalesce(event_end_date,event_start_date)) from schedules s where s.event_id=e.id) d2, e.id
  from events e group by e.id),
u as (select acct, nname, min(disp) disp, min(d1) d1, max(d2) d2 from ev where d2-d1 >= 2 group by acct, nname)
select left(u.acct,20) acct, left(u.disp,42) umbrella, u.d1, u.d2, count(distinct c.nname) kids
from u join ev c on c.acct=u.acct and c.nname<>u.nname and c.d1>=u.d1 and c.d2<=u.d2 and (c.d2-c.d1) < (u.d2-u.d1)
group by 1,2,3,4 order by 5 desc limit 14;
