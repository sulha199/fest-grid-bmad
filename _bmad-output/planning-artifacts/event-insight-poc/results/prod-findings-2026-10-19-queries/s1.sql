\echo === SIGNAL 1: Prefix - Child title split (same account, >=2 distinct child names) ===
with ev as materialized (select e.id, e.source_social_media_account_id acct, e.event_name, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname from events e),
t as (select acct, nname, lower(btrim((regexp_split_to_array(event_name, '\s+[-–—]\s+'))[1])) pfx from ev where event_name ~ '\s[-–—]\s'),
g as (select acct, pfx, count(distinct nname) kids, count(*) rows_ from t where length(pfx)>=4 group by 1,2 having count(distinct nname)>=2)
select count(*) groups, sum(kids) distinct_children, sum(rows_) event_rows, max(kids) biggest from g;
\echo --- top 30 ---
with ev as materialized (select e.id, e.source_social_media_account_id acct, e.event_name, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname from events e),
t as (select acct, nname, lower(btrim((regexp_split_to_array(event_name, '\s+[-–—]\s+'))[1])) pfx from ev where event_name ~ '\s[-–—]\s')
select left(acct,24) acct, left(pfx,42) prefix, count(distinct nname) kids, count(*) rows_ from t where length(pfx)>=4 group by 1,2 having count(distinct nname)>=2 order by 3 desc, 4 desc limit 30;
