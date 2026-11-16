#!/usr/bin/env bash
# Re-runs the runbook's tests against an EMPTY SCRATCH database (never a real one).
#   DATABASE_URL=postgres://user@host/scratch_db  ./test-on-scratch-db.sh
# It applies the repository's drizzle migrations, seeds six made-up accounts, and checks: the look script, the happy path,
# a refused second run, the rollback, and the three abort paths (too many rows, a row changed in between, an empty set).
# It REFUSES to run if the database already has the schema, so it cannot touch real data.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to an empty scratch database}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
psqlq() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -At "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
expect() { [ "$1" = "$2" ] || fail "$3 (expected '$2', got '$1')"; echo "ok   $3"; }

[ -z "$(psqlq -c "select coalesce(to_regclass('public.social_media_account_profiles')::text,'')")" ] || { echo "refusing: the schema is already there - use an EMPTY scratch database" >&2; exit 2; }
log="$(mktemp)"
for f in $(ls "$repo"/packages/database/migrations/*.sql | sort); do psqlq -f "$f" >/dev/null 2>"$log" || { cat "$log" >&2; fail "migration $(basename "$f") failed"; }; done
rm -f "$log"

seed() {
  psqlq -c "DROP TABLE IF EXISTS _bak_account_type_20261018" -c "TRUNCATE social_media_account_profiles CASCADE" >/dev/null 2>&1
  psqlq -c "INSERT INTO social_media_account_profiles (account_id, platform, username, display_name, account_type, account_type_status, default_location, last_scraped_at) VALUES
    ('1','instagram','cur1','Curator One',NULL,NULL,NULL,now()),
    ('2','instagram','cur2','Curator Two',NULL,NULL,NULL,now()),
    ('3','instagram','cur3','Curator Three',NULL,NULL,NULL,NULL),
    ('4','instagram','venue_legacy','Venue Legacy',NULL,NULL,'{\"coordinates\":{\"latitude\":-7.78,\"longitude\":110.4},\"countryCode\":\"id\"}'::jsonb,now()),
    ('5','instagram','org_confirmed','Org Confirmed','ORGANIZER_VENUE_EVENT','CONFIRMED',NULL,now()),
    ('6','instagram','awaiting','Awaiting','CURATOR_GUIDE','AWAITING_APPROVAL',NULL,now())"
}
state() { psqlq -c "select string_agg(username||':'||coalesce(account_type::text,'-')||'/'||coalesce(account_type_status::text,'-'), ' ' order by username) from social_media_account_profiles"; }
bak() { psqlq -c "select case when to_regclass('_bak_account_type_20261018') is not null then 'yes' else 'no' end"; }
UNTOUCHED="awaiting:CURATOR_GUIDE/AWAITING_APPROVAL cur1:-/- cur2:-/- cur3:-/- org_confirmed:ORGANIZER_VENUE_EVENT/CONFIRMED venue_legacy:-/-"
SET="awaiting:CURATOR_GUIDE/AWAITING_APPROVAL cur1:CURATOR_GUIDE/CONFIRMED cur2:CURATOR_GUIDE/CONFIRMED cur3:CURATOR_GUIDE/CONFIRMED org_confirmed:ORGANIZER_VENUE_EVENT/CONFIRMED venue_legacy:-/-"
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1" 2>&1 || true; }

seed
expect "$(run "$here/01-look.sql" | grep -c 'cur[123]')" "3" "01-look lists exactly the three accounts without a location"
expect "$(run "$here/01-look.sql" | grep -c 'venue_legacy')" "0" "01-look does not list the never-classified account that has a location"

run "$here/02-apply.sql" >/dev/null
expect "$(state)" "$SET" "02-apply sets the three; the legacy account WITH a location, the confirmed organizer and the awaiting account are untouched"
expect "$(psqlq -c "select count(*) from social_media_account_profiles where account_type_confidence_score is not null")" "0" "a hand-set row keeps a NULL confidence score"
out="$(run "$here/02-apply.sql")"; echo "$out" | grep -q 'already exists' || fail "a second run was not refused"
expect "$(state)" "$SET" "a refused second run changes nothing"
run "$here/04-after.sql" | grep -q 'no_location_should_be_0' || fail "04-after did not run"
run "$here/03-rollback.sql" >/dev/null
expect "$(state)" "$UNTOUCHED" "03-rollback restores the before-state"

seed
sed 's/^\\set max_rows 300/\\set max_rows 2/' "$here/02-apply.sql" > "${TMPDIR:-/tmp}/apply-max2.$$.sql"
run "${TMPDIR:-/tmp}/apply-max2.$$.sql" | grep -q 'larger than max_rows' || fail "the row ceiling did not abort"
rm -f "${TMPDIR:-/tmp}/apply-max2.$$.sql"
expect "$(state) $(bak)" "$UNTOUCHED no" "abort: too many rows - nothing written, no backup table left"

seed; psqlq -c "update social_media_account_profiles set classification_claimed_at = now() where username='cur3'" >/dev/null
run "$here/02-apply.sql" | grep -q 'some changed in the meantime' || fail "the changed-in-between check did not abort"
expect "$(state) $(bak)" "$UNTOUCHED no" "abort: an account started classification in between - nothing written"

seed; psqlq -c "update social_media_account_profiles set account_type='CURATOR_GUIDE', account_type_status='CONFIRMED' where default_location is null" >/dev/null
run "$here/02-apply.sql" | grep -q 'the set is empty' || fail "the empty set did not abort"
expect "$(bak)" "no" "abort: empty set - no backup table left"
echo "ALL RUNBOOK TESTS PASSED (scratch database; no production data involved)"
