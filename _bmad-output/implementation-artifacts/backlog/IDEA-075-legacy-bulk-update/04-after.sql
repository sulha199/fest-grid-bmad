-- IDEA-075 legacy bulk update, step 4 of 4: AFTER. READ-ONLY.
--   psql "$DATABASE_URL" -f 04-after.sql
\set ON_ERROR_STOP on

\echo '== the accounts that were set: what they are now'
SELECT p.account_type, p.account_type_status, p.account_type_confidence_score IS NULL AS hand_set, count(*) AS accounts
FROM _bak_account_type_20261018 b JOIN social_media_account_profiles p ON p.id = b.id GROUP BY 1, 2, 3;

\echo '== never-classified accounts remaining (all of them should have a default location now)'
SELECT count(*) FILTER (WHERE default_location IS NULL) AS no_location_should_be_0, count(*) FILTER (WHERE default_location IS NOT NULL) AS with_location
FROM social_media_account_profiles WHERE account_type_status IS NULL;

\echo '== residual risk: never-classified accounts WITH a location whose events are scattered over many cities (a curator tends to look like this)'
SELECT p.username, p.default_location->>'formattedAddress' AS stored_default_location,
       count(DISTINCT s.location_details->>'city') AS distinct_cities, count(*) AS pinned_schedules
FROM social_media_account_profiles p
JOIN events e ON e.source_social_media_account_id = p.account_id
JOIN schedules s ON s.event_id = e.id
WHERE p.account_type_status IS NULL AND p.default_location IS NOT NULL AND s.location_details IS NOT NULL
GROUP BY p.id, p.username, p.default_location
HAVING count(DISTINCT s.location_details->>'city') >= 5
ORDER BY distinct_cities DESC, pinned_schedules DESC;

\echo '== when you are sure, remove the scratch table:  DROP TABLE _bak_account_type_20261018;'
