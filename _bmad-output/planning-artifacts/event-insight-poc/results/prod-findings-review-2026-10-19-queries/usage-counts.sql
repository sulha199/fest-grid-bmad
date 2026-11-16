-- Personalization plan, measurement feasibility: how many users, favorites and calendar additions exist, so the offline replay (proposal section 5) and an
-- A/B on the ranking can be judged before they are planned. COUNTS ONLY: no user id, email, name, location or event is printed.
-- Replay needs users with enough history to split into "before" and "later" favorites; an A/B needs enough weekly active signed-in users to see a difference.
-- Read-only. Four result sets: (1) people, (2) favorites per user, (3) activity by window, (4) subscriptions and notification fan-out.

-- (1) people
select (select count(*) from users where deleted_at is null) as users,
       (select count(*) from users where deleted_at is null and created_at >= now() - interval '30 days') as new_users_30_days,
       (select count(distinct user_id) from favorites where deleted_at is null) as users_with_a_favorite,
       (select count(distinct user_id) from calendar_additions where deleted_at is null) as users_with_a_calendar_addition,
       (select count(distinct user_id) from user_locations where deleted_at is null) as users_with_a_saved_location,
       (select count(distinct user_id) from subscriptions where deleted_at is null) as users_with_a_subscription;

-- (2) favorites per user (active favorites), the replay's raw material
with f as (select user_id, count(*) as n from favorites where deleted_at is null group by user_id)
select case when n = 1 then '1' when n <= 4 then '2-4' when n <= 9 then '5-9' when n <= 19 then '10-19' else '20+' end as favorites_per_user,
       count(*) as users, sum(n) as favorites
from f group by 1 order by min(n);

-- (3) activity by window: distinct users who favorited or added to a calendar in the last 7 / 28 / 90 days, and the counts of events
select w.days,
       (select count(distinct user_id) from (select user_id, created_at from favorites where deleted_at is null
                                             union all select user_id, created_at from calendar_additions where deleted_at is null) a
         where a.created_at >= now() - make_interval(days => w.days)) as active_users,
       (select count(*) from favorites where deleted_at is null and created_at >= now() - make_interval(days => w.days)) as favorites_created,
       (select count(*) from calendar_additions where deleted_at is null and created_at >= now() - make_interval(days => w.days)) as calendar_additions_created
from (values (7), (28), (90)) as w(days) order by w.days;

-- (4) subscriptions per user, and how many have push on: the fan-out the per-user notification suppression acts on
with sub as (select user_id, count(*) as n from subscriptions where deleted_at is null group by user_id)
select case when n = 1 then '1' when n = 2 then '2' when n <= 4 then '3-4' when n <= 9 then '5-9' else '10+' end as accounts_followed,
       count(*) as users,
       count(*) filter (where exists (select 1 from user_settings us where us.user_id = sub.user_id and us.push_notifications_enabled)) as users_with_push_on
from sub group by 1 order by min(n);
