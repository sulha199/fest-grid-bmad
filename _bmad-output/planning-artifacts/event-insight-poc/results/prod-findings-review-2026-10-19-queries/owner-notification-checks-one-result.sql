-- BUG-069 / BUG-073, replaces result sets 1 to 3 of owner-notification-checks.sql in ONE statement, because the Supabase SQL editor shows only the last
-- result of a script and cannot read the :'owner_email' variable. Production has 2 registered users (2026-10-21), so no e-mail is needed: one row per
-- user ("user 1" is the older account), no e-mail address, token value or id. OWNER-RUN (it reads users, user_settings, fcm_tokens and subscriptions,
-- which the read-only role cannot see). Paste it into the editor and run; paste the rows back.
-- Reading: push needs settings_rows = 1, push_enabled = true, token_rows >= 1 and active_subscriptions >= 1, and the subscription must not be a twin
-- profile (BUG-059). A token is per browser or installed app. role = 'moderator' is what the moderator e-mails and alerts look for.
select row_number() over (order by u.created_at) as user_no,
       u.role,
       (u.deleted_at is not null) as soft_deleted,
       (select count(*) from user_settings s where s.user_id = u.id) as settings_rows,
       (select bool_or(s.push_notifications_enabled) from user_settings s where s.user_id = u.id) as push_enabled,
       (select count(*) from fcm_tokens t where t.user_id = u.id) as token_rows,
       (select min(t.created_at)::date from fcm_tokens t where t.user_id = u.id) as oldest_token_created,
       (select max(t.updated_at)::date from fcm_tokens t where t.user_id = u.id) as newest_token_updated,
       (select count(*) from subscriptions b where b.user_id = u.id and b.deleted_at is null) as active_subscriptions,
       (select count(*) from subscriptions b join social_media_account_profiles p on p.id = b.account_id
         where b.user_id = u.id and b.deleted_at is null
           and exists (select 1 from social_media_account_profiles q where q.platform = p.platform and lower(q.username) = lower(p.username) and q.id <> p.id)) as subscriptions_to_twin_profiles,
       (select count(*) from subscriptions b join social_media_account_profiles p on p.id = b.account_id
         where b.user_id = u.id and b.deleted_at is null and p.account_type::text = 'ORGANIZER_VENUE_EVENT') as subscriptions_to_organizer_accounts
from users u
order by 1;
