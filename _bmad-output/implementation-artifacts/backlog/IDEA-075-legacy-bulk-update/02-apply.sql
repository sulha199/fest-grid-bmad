-- IDEA-075 legacy bulk update, step 2 of 4: APPLY. One transaction, all or nothing.
--   psql "$DATABASE_URL" -f 02-apply.sql
-- Sets every never-classified account WITHOUT a default location to CURATOR_GUIDE / CONFIRMED.
-- It aborts (and changes nothing) if: the set is empty, larger than max_rows, or a row changed between the
-- snapshot and the update (for example someone subscribed and classification started).
-- The before-state is kept in _bak_account_type_20261018 (a scratch table outside the drizzle migrations: export it, drop it later).
-- account_type_confidence_score stays NULL: that is how a hand-set row is told apart from a classified one.
-- NOT done here, on purpose: captions already stored are NOT deleted; no country or time-zone column exists yet.
\set ON_ERROR_STOP on
\set max_rows 300

BEGIN;

CREATE TABLE _bak_account_type_20261018 AS
SELECT id, account_type, account_type_status, account_type_confidence_score, updated_at
FROM social_media_account_profiles
WHERE account_type_status IS NULL AND default_location IS NULL;

SELECT count(*) AS n, (count(*) > :max_rows) AS too_many, (count(*) = 0) AS empty FROM _bak_account_type_20261018 \gset
\echo 'accounts in the set:' :n

\if :too_many
  \echo 'ABORT: the set is larger than max_rows (' :max_rows '). Read 01-look.sql again; raise max_rows only on purpose.'
  ROLLBACK;
  \quit
\endif
\if :empty
  \echo 'ABORT: the set is empty - nothing to do.'
  ROLLBACK;
  \quit
\endif

WITH changed AS (
  UPDATE social_media_account_profiles p
  SET account_type = 'CURATOR_GUIDE', account_type_status = 'CONFIRMED', updated_at = now()
  FROM _bak_account_type_20261018 b
  WHERE p.id = b.id
    AND p.account_type_status IS NULL
    AND p.default_location IS NULL
    AND p.classification_claimed_at IS NULL
  RETURNING p.id
)
SELECT count(*) AS changed FROM changed \gset

SELECT (:changed <> :n) AS mismatch \gset
\if :mismatch
  \echo 'ABORT: expected to change' :n 'accounts but could change' :changed '- some changed in the meantime. Nothing was written.'
  ROLLBACK;
  \quit
\endif

\echo 'set to CURATOR_GUIDE / CONFIRMED:' :changed
COMMIT;
