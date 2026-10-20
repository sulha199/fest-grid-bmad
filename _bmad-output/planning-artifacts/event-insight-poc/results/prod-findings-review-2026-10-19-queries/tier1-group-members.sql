-- AD-36 Rule 12 (decision 2026-10-20): "Umbrella - Child" titles are a PROGRAMME when the child is a different activity (SCH "8th Anniversary - Zumba") and a
-- SERIES only when the text after the dash is the event's own PLACE ("Wednesday Night Run - Kenes Soho"). Tier 1 measured 17 groups / 52 events (all genuine);
-- this lists them so the kind can be read on real names. Proxy for "the child is the member's own place": the child text appears inside the member's own place text.
-- Tier 1 here = one account, one text before the first spaced dash, 2 or more distinct children. Read-only. Names and places as shown in the app; no account ids.

-- 1. Summary of the proxy.
with ev as (
  select e.id, e.source_social_media_account_id as acct, e.event_name,
         btrim(regexp_replace(regexp_replace(lower(e.event_name), '\s[–—-]\s.*$', ''), '[^a-z0-9]+', ' ', 'g')) as stem,
         btrim(regexp_replace(regexp_replace(lower(e.event_name), '^.*?\s[–—-]\s', ''), '[^a-z0-9]+', ' ', 'g')) as child,
         (e.event_name ~ '\s[–—-]\s') as has_dash,
         btrim(regexp_replace(lower(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location)), '[^a-z0-9]+', ' ', 'g')) as place
  from events e where e.deleted_at is null and e.merged_into_event_id is null),
g as (select acct, stem, count(*) as members, count(distinct child) as children,
             count(*) filter (where place <> '' and child <> '' and position(child in place) > 0) as child_is_own_place
      from ev where has_dash and stem <> '' group by acct, stem having count(distinct child) >= 2)
select case when child_is_own_place = members then '1 every member: child text is inside its own place (series-like)'
            when child_is_own_place = 0 then '2 no member: child text is not its place (programme-like)'
            else '3 some members (mixed: read these by hand)' end as proxy_class,
       count(*) as groups, sum(members) as events
from g group by 1 order by 1;

-- 2. The groups themselves (up to 60), largest first.
with ev as (
  select e.id, e.source_social_media_account_id as acct, e.event_name,
         btrim(regexp_replace(regexp_replace(lower(e.event_name), '\s[–—-]\s.*$', ''), '[^a-z0-9]+', ' ', 'g')) as stem,
         btrim(regexp_replace(regexp_replace(lower(e.event_name), '^.*?\s[–—-]\s', ''), '[^a-z0-9]+', ' ', 'g')) as child,
         (e.event_name ~ '\s[–—-]\s') as has_dash,
         btrim(regexp_replace(lower(coalesce((select s.location from schedules s where s.event_id = e.id order by s.is_main_schedule desc, s.event_start_date limit 1), e.location)), '[^a-z0-9]+', ' ', 'g')) as place
  from events e where e.deleted_at is null and e.merged_into_event_id is null)
select left(stem, 40) as umbrella, count(*) as members, count(distinct child) as children,
       count(*) filter (where place <> '' and child <> '' and position(child in place) > 0) as child_is_own_place,
       left(string_agg(left(child, 22) || ' @ ' || left(place, 22), ' | ' order by child), 150) as children_at_places
from ev where has_dash and stem <> ''
group by acct, stem having count(distinct child) >= 2
order by count(*) desc, 1 limit 60;
