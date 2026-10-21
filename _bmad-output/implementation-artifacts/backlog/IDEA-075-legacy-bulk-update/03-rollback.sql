-- IDEA-075 legacy bulk update, step 3 of 4: ROLLBACK (only if needed).
--   psql "$DATABASE_URL" -f 03-rollback.sql
-- Restores the before-state, and only for rows still exactly as 02-apply.sql left them
-- (CURATOR_GUIDE / CONFIRMED with a NULL confidence score) - an account the classifier or a moderator has
-- touched since is left alone.
\set ON_ERROR_STOP on
BEGIN;
WITH restored AS (
  UPDATE social_media_account_profiles p
  SET account_type = b.account_type, account_type_status = b.account_type_status,
      account_type_confidence_score = b.account_type_confidence_score, updated_at = now()
  FROM _bak_account_type_20261018 b
  WHERE p.id = b.id AND p.account_type = 'CURATOR_GUIDE' AND p.account_type_status = 'CONFIRMED' AND p.account_type_confidence_score IS NULL
  RETURNING p.id
)
SELECT count(*) AS restored FROM restored;
COMMIT;
