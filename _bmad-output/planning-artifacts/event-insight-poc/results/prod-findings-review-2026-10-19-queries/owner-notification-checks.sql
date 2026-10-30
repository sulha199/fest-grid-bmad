-- BUG-069 / the 2026-10-20 notification investigation. OWNER-RUN, not for the read-only role: it reads users, user_settings, fcm_tokens and subscriptions,
-- which the production pack's role cannot see by design. Run it yourself, as the database owner, in psql or the Supabase SQL editor, in a read-only
-- transaction. It prints counts, flags and ages only: no e-mail address, no token value, no user id.
--   psql "$YOUR_OWNER_URL" -X -v owner_email='you@example.com' -f owner-notification-checks.sql        (in the SQL editor: replace :'owner_email' by hand)
begin read only;

-- 1. The moderators as a group: can any of them receive an e-mail or a push at all?
select count(*) filter (where u.role = 'moderator' and u.deleted_at is null) as moderators,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from fcm_tokens t where t.user_id = u.id)) as with_push_token,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from user_settings s where s.user_id = u.id)) as with_settings_row,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from user_settings s where s.user_id = u.id and s.push_notifications_enabled)) as push_enabled,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from subscriptions b where b.user_id = u.id and b.deleted_at is null)) as with_active_subscription
from users u;

-- 2. Your own row: role, settings, tokens (a token is per browser or installed app; ages tell whether it was ever refreshed).
select u.role, (u.deleted_at is not null) as soft_deleted,
       (select count(*) from user_settings s where s.user_id = u.id) as settings_rows,
       (select s.push_notifications_enabled from user_settings s where s.user_id = u.id) as push_enabled,
       (select count(*) from fcm_tokens t where t.user_id = u.id) as token_rows,
       (select min(t.created_at)::date from fcm_tokens t where t.user_id = u.id) as oldest_token_created,
       (select max(t.updated_at)::date from fcm_tokens t where t.user_id = u.id) as newest_token_updated
from users u where lower(u.email) = lower(:'owner_email');

-- 3. The accounts you subscribe to: what kind they are, whether a twin profile exists (BUG-059: the push query joins on profile.account_id = the event's
--    source account id), and what happened to their last 30 days of events (created, stub, notified).
select p.platform, p.username, p.account_type, p.account_type_status,
       (select count(*) from social_media_account_profiles q where q.platform = p.platform and lower(q.username) = lower(p.username) and q.id <> p.id) as other_profiles_same_username,
       (select count(*) from events e where e.source_social_media_account_id = p.account_id and e.deleted_at is null and e.created_at > now() - interval '30 days') as events_30d,
       (select count(*) from events e where e.source_social_media_account_id = p.account_id and e.deleted_at is null and e.created_at > now() - interval '30 days' and e.detail_level = 'stub') as stubs_30d,
       (select count(*) from events e where e.source_social_media_account_id = p.account_id and e.deleted_at is null and e.created_at > now() - interval '30 days' and e.notified_at is not null) as notified_30d
from subscriptions b
join users u on u.id = b.user_id
join social_media_account_profiles p on p.id = b.account_id
where lower(u.email) = lower(:'owner_email') and b.deleted_at is null
order by 7 desc, p.username;

-- 4. Across all accounts: of the events created in the last 30 days, how many were marked notified, and how many of the others are stubs (a stub never notifies).
select count(*) as events_30d,
       count(*) filter (where notified_at is not null) as notified,
       count(*) filter (where notified_at is null and detail_level = 'stub') as not_notified_stub,
       count(*) filter (where notified_at is null and detail_level <> 'stub') as not_notified_full
from events where deleted_at is null and created_at > now() - interval '30 days';
rollback;
