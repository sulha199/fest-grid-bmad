\echo === SIGNAL 4: schedule title of event U equals/contains the NAME of another event C of the same account ===
with ev as materialized (select e.id, e.source_social_media_account_id acct, e.event_name, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname from events e),
st as (select s.event_id, btrim(regexp_replace(lower(s.title),'[^a-z0-9]+',' ','g')) ntitle from schedules s where s.title is not null and length(s.title)>=8),
m as (select u.id uid, c.id cid, u.acct, u.event_name uname, c.event_name cname, st.ntitle
      from st join ev u on u.id=st.event_id join ev c on c.acct=u.acct and c.id<>u.id and c.nname<>u.nname
      and (c.nname = st.ntitle or (length(c.nname)>=10 and st.ntitle like '%'||c.nname||'%') or (length(st.ntitle)>=10 and c.nname like '%'||st.ntitle||'%')))
select count(distinct uid) umbrellas_with_match, count(distinct cid) matched_children, count(*) pairs from m;
\echo --- examples (top 25 umbrellas by distinct matched children) ---
with ev as materialized (select e.id, e.source_social_media_account_id acct, e.event_name, btrim(regexp_replace(lower(e.event_name),'[^a-z0-9]+',' ','g')) nname from events e),
st as (select s.event_id, btrim(regexp_replace(lower(s.title),'[^a-z0-9]+',' ','g')) ntitle from schedules s where s.title is not null and length(s.title)>=8),
m as (select u.id uid, c.id cid, u.acct, u.event_name uname, c.nname cn, st.ntitle
      from st join ev u on u.id=st.event_id join ev c on c.acct=u.acct and c.id<>u.id and c.nname<>u.nname
      and (c.nname = st.ntitle or (length(c.nname)>=10 and st.ntitle like '%'||c.nname||'%') or (length(st.ntitle)>=10 and c.nname like '%'||st.ntitle||'%')))
select left(acct,20) acct, left(uname,44) umbrella, count(distinct cn) kids, left(string_agg(distinct left(cn,20),' | '),90) kid_names from m group by uid, acct, uname order by 3 desc limit 25;
