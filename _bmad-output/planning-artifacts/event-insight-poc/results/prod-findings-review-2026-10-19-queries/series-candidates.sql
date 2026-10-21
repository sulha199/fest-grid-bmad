-- Group identity over time (the Riot Jogja "Wednesday Night Run" case): how many series already exist in production as separate events?
-- A series candidate = events of ONE account that share an activity stem (the name before the first spaced dash, normalized: "Wednesday Night Run - Kenes Soho"
-- and "Wednesday Night Run - Fortuna Suites" share "wednesday night run"; a name without a dash is its own stem) and whose first dates are at least 3 days apart.
-- Reported by the span between the first and last member, to size a gap rule (how far apart may two members be and still belong to the same series?).
-- Read-only; counts only, no event names.
with ev as (select e.id, e.source_social_media_account_id as acct, lower(e.event_name) as lname,
  btrim(regexp_replace(regexp_replace(lower(e.event_name), '\s[–—-]\s.*$', ''), '[^a-z0-9]+', ' ', 'g')) as stem,
  (select min(s.event_start_date) from schedules s where s.event_id = e.id) as first_date
  from events e where e.deleted_at is null and e.merged_into_event_id is null),
cl as (select acct, stem, count(*) as members, max(first_date) - min(first_date) as span_days, count(distinct lname) as distinct_names
       from ev where stem <> '' and first_date is not null group by acct, stem
       having count(*) >= 2 and max(first_date) - min(first_date) >= 3)
select case when span_days <= 31 then '1 within one month' when span_days <= 62 then '2 one to two months' when span_days <= 120 then '3 two to four months' else '4 longer than four months' end as span_between_first_and_last,
       count(*) as series_candidates, sum(members) as events_in_them, round(avg(members), 1) as avg_members, max(members) as max_members,
       count(*) filter (where distinct_names = 1) as identical_full_names
from cl group by 1 order by 1;
