with ev as materialized (select e.source_social_media_account_id acct, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname, min(e.event_name) disp, e.id,
  (select min(event_start_date) from schedules s where s.event_id=e.id) d1,
  (select max(coalesce(event_end_date,event_start_date)) from schedules s where s.event_id=e.id) d2 from events e group by e.id),
u as (select acct, nname, min(disp) disp, min(d1) d1, max(d2) d2 from ev where d2-d1 between 2 and 6 group by acct, nname),
m as (select u.acct, u.disp, u.d1, u.d2, count(distinct c.nname) kids from u join ev c on c.acct=u.acct and c.nname<>u.nname and c.d1>=u.d1 and c.d2<=u.d2 and (c.d2-c.d1) < (u.d2-u.d1) group by 1,2,3,4)
select count(*) tight_umbrellas, count(*) filter (where kids>=2) ge2, count(*) filter (where kids>=3) ge3, count(*) filter (where kids>=5) ge5, max(kids) max_kids from m;
\echo --- top 12 (span 3-7 days, same account, children inside) ---
with ev as materialized (select e.source_social_media_account_id acct, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname, min(e.event_name) disp, e.id,
  (select min(event_start_date) from schedules s where s.event_id=e.id) d1,
  (select max(coalesce(event_end_date,event_start_date)) from schedules s where s.event_id=e.id) d2 from events e group by e.id),
u as (select acct, nname, min(disp) disp, min(d1) d1, max(d2) d2 from ev where d2-d1 between 2 and 6 group by acct, nname)
select left(u.acct,20) acct, left(u.disp,44) umbrella, u.d1, u.d2, count(distinct c.nname) kids
from u join ev c on c.acct=u.acct and c.nname<>u.nname and c.d1>=u.d1 and c.d2<=u.d2 and (c.d2-c.d1) < (u.d2-u.d1) group by 1,2,3,4 order by 5 desc limit 12;
