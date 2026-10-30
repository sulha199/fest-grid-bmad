-- IDEA-075 legacy bulk update, step 1 of 4: LOOK. READ-ONLY - it changes nothing.
--   psql "$DATABASE_URL" -f 01-look.sql
-- Decision 2026-10-18: the never-classified accounts that have NO default location are all Indonesian curators;
-- they are set to CURATOR_GUIDE / CONFIRMED. Never-classified accounts that already have a location are NOT changed.
-- Read the list below before running 02-apply.sql: the statement is about data this file's author could not see.
\set ON_ERROR_STOP on

\echo '== classification states (a null account_type_status = never classified)'
SELECT account_type, account_type_status, count(*) AS accounts
FROM social_media_account_profiles GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '== never classified: without / with a default location'
SELECT count(*) FILTER (WHERE default_location IS NULL)     AS no_location__will_be_set,
       count(*) FILTER (WHERE default_location IS NOT NULL) AS with_location__left_as_is
FROM social_media_account_profiles WHERE account_type_status IS NULL;

\echo '== THE SET (never classified, no default location): every row should be a curator'
SELECT p.username, p.display_name, p.platform, p.last_scraped_at,
       (SELECT count(*) FROM subscriptions s WHERE s.account_id = p.id AND s.deleted_at IS NULL) AS active_subscribers
FROM social_media_account_profiles p
WHERE p.account_type_status IS NULL AND p.default_location IS NULL
ORDER BY p.last_scraped_at DESC NULLS LAST, p.username;

\echo '== of those, how many are being classified right now (02-apply.sql skips and then ABORTS on them)'
SELECT count(*) AS mid_classification
FROM social_media_account_profiles
WHERE account_type_status IS NULL AND default_location IS NULL AND classification_claimed_at IS NOT NULL;
