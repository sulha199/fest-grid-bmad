#!/usr/bin/env bash
# Re-runs the runbook's tests against an EMPTY SCRATCH database (never a real one).
#   DATABASE_URL=postgres://user@host/scratch_db  ./test-on-scratch-db.sh
# It applies the repository's drizzle migrations, seeds made-up rows in the old (JSON-string) and new (object) shapes, and checks: the look script,
# the 'core' apply, a refused second run, the rollback (including a value the app rewrote since), the 'rest' columns, and the ceiling abort.
# It REFUSES to run if the database already has the schema, so it cannot touch real data.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to an empty scratch database}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
psqlq() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -At "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
expect() { [ "$1" = "$2" ] || fail "$3 (expected '$2', got '$1')"; echo "ok   $3"; }

[ -z "$(psqlq -c "select coalesce(to_regclass('public.events')::text,'')")" ] || { echo "refusing: the schema is already there - use an EMPTY scratch database" >&2; exit 2; }
log="$(mktemp)"
for f in $(ls "$repo"/packages/database/migrations/*.sql | sort); do psqlq -f "$f" >/dev/null 2>"$log" || { cat "$log" >&2; fail "migration $(basename "$f") failed"; }; done
rm -f "$log"

OBJ='{"coordinates":{"latitude":-7.7,"longitude":110.4},"city":"Yogyakarta"}'
seed() {
  psqlq -c "DROP TABLE IF EXISTS _bak_bug068" -c "TRUNCATE social_media_account_profiles, geolocation_cache, events CASCADE" >/dev/null 2>&1
  psqlq -c "INSERT INTO social_media_account_profiles (account_id, platform, username, display_name, default_location) VALUES
      ('1','instagram','p_string','P String', to_jsonb('$OBJ'::text)),
      ('2','instagram','p_object','P Object', '$OBJ'::jsonb),
      ('3','instagram','p_plain','P Plain', to_jsonb('hello'::text)),
      ('4','instagram','p_null','P Null', NULL)" \
    -c "INSERT INTO events (id, slug, event_name, location, links) VALUES
      ('00000000-0000-0000-0000-0000000000e1','e-string','E String','Hall', to_jsonb('[{\"url\":\"https://x.id/t\"}]'::text)),
      ('00000000-0000-0000-0000-0000000000e2','e-array','E Array','Hall', '[{\"url\":\"https://x.id/t\"}]'::jsonb)" \
    -c "INSERT INTO schedules (slug, event_id, event_start_date, location_details) VALUES
      ('s-string','00000000-0000-0000-0000-0000000000e1', current_date, to_jsonb('$OBJ'::text)),
      ('s-object','00000000-0000-0000-0000-0000000000e2', current_date, '$OBJ'::jsonb)" \
    -c "INSERT INTO geolocation_cache (cache_key, query_type, result) VALUES ('g-string','GEOCODE', to_jsonb('$OBJ'::text)), ('g-object','GEOCODE','$OBJ'::jsonb)"
}
types() { psqlq -c "select string_agg(t, ' ' order by t) from (
    select 'p:'||username||'='||coalesce(jsonb_typeof(default_location),'null') t from social_media_account_profiles
    union all select 'e:'||slug||'='||coalesce(jsonb_typeof(links),'null') from events
    union all select 's:'||slug||'='||coalesce(jsonb_typeof(location_details),'null') from schedules
    union all select 'g:'||cache_key||'='||jsonb_typeof(result) from geolocation_cache) x"; }
bak() { psqlq -c "select case when to_regclass('_bak_bug068') is not null then 'yes' else 'no' end"; }
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "${@:2}" -f "$1" 2>&1 || true; }

BEFORE="e:e-array=array e:e-string=string g:g-object=object g:g-string=string p:p_null=null p:p_object=object p:p_plain=string p:p_string=string s:s-object=object s:s-string=string"
CORE="e:e-array=array e:e-string=array g:g-object=object g:g-string=string p:p_null=null p:p_object=object p:p_plain=string p:p_string=object s:s-object=object s:s-string=object"
ALL="e:e-array=array e:e-string=array g:g-object=object g:g-string=object p:p_null=null p:p_object=object p:p_plain=string p:p_string=object s:s-object=object s:s-string=object"

seed
expect "$(types)" "$BEFORE" "seed has the old and the new shapes"
out="$(run "$here/01-look.sql")"
echo "$out" | grep -q 'social_media_account_profiles.default_location *| *4 *| *3 *| *1 *| *1 *| *1' || { echo "$out" >&2; fail "01-look did not count 1 convertible, 1 other string, 1 object in default_location"; }
echo "ok   01-look counts the convertible, the other strings and the objects"

run "$here/02-apply.sql" >/dev/null
expect "$(types)" "$CORE" "02-apply converts the core columns only; an object, a null and a plain string are untouched; the cache (rest) is untouched"
out="$(run "$here/02-apply.sql")"; echo "$out" | grep -q 'already exists' || fail "a second run was not refused"
expect "$(types)" "$CORE" "a refused second run changes nothing"

run "$here/03-rollback.sql" >/dev/null
expect "$(types)" "$BEFORE" "03-rollback puts the string shape back (types)"
expect "$(psqlq -c "select (default_location #>> '{}')::jsonb->>'city' from social_media_account_profiles where username='p_string'")" "Yogyakarta" "03-rollback restored the before-state value"

seed
psqlq -c "DROP TABLE IF EXISTS _bak_bug068" >/dev/null
run "$here/02-apply.sql" -v include_rest=1 >/dev/null
expect "$(types)" "$ALL" "02-apply with include_rest=1 also converts the cache column"
psqlq -c "update social_media_account_profiles set default_location = jsonb_set(default_location, '{city}', '\"Sleman\"') where username='p_string'" >/dev/null
run "$here/03-rollback.sql" >/dev/null
expect "$(psqlq -c "select jsonb_typeof(default_location) || ':' || (default_location->>'city') from social_media_account_profiles where username='p_string'")" "object:Sleman" "03-rollback leaves a value the application rewrote since"

seed
run "$here/02-apply.sql" -v max_rows=0 | grep -q 'more than max_rows' || fail "the row ceiling did not abort"
expect "$(types) $(bak)" "$BEFORE no" "abort: ceiling - nothing written, no backup table left"

seed; psqlq -c "update social_media_account_profiles set default_location = '$OBJ'::jsonb where username='p_string'; update events set links = '[]'::jsonb where slug='e-string'; update schedules set location_details = '$OBJ'::jsonb where slug='s-string'" >/dev/null
run "$here/02-apply.sql" | grep -q 'nothing to convert' || fail "the empty run did not abort"
expect "$(bak)" "no" "abort: nothing to convert - no backup table left"
echo "ALL OK"
