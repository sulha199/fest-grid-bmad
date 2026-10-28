#!/bin/bash
# Compares a database restored from a Production DB Backup dump with the live database it was
# dumped from: row count per table, then object counts per schema.
#
# Used by .github/workflows/prod-db-restore-test.yml; also runnable by hand against any two
# databases (needs psql and a bash with process substitution, e.g. Git Bash):
#   scripts/compare-restored-db.sh <restored-db-url> <live-db-url>
#
# The live database keeps changing after the dump, so row counts may drift. A table fails only if
#   * it is missing from the restored database,
#   * it is empty there but not in the live database (a truncated dump), or
#   * the counts differ by more than max(TOLERANCE_ROWS, TOLERANCE_PCT % of the live count).
# Anything else that differs is printed as "drift". Object counts (columns, NOT NULL columns,
# indexes, constraints, sequences, functions) must match exactly: a dump is a snapshot, so a
# difference there means the restore lost something, or a migration ran since the dump.
# PostgreSQL 18 also lists NOT NULL constraints in pg_constraint, PostgreSQL 17 does not, so those
# rows are left out and NOT NULL is compared on the columns instead.
#
# Exit status: 0 = restored database matches, 1 = it does not, 2 = usage error or a query failed.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <restored-db-url> <live-db-url>" >&2
  exit 2
fi
RESTORED_URL="$1"
LIVE_URL="$2"
SCHEMAS="${SCHEMAS:-public auth drizzle}"
TOLERANCE_PCT="${TOLERANCE_PCT:-5}"
TOLERANCE_ROWS="${TOLERANCE_ROWS:-25}"

# 'public','auth','drizzle' for use inside IN (...)
SCHEMA_LIST=$(printf "'%s'," $SCHEMAS)
SCHEMA_LIST="${SCHEMA_LIST%,}"

ROWS_SQL="
SELECT 'rows|' || table_schema || '.' || table_name || '|' ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema IN ($SCHEMA_LIST) AND table_type = 'BASE TABLE'
ORDER BY 1;"

OBJECTS_SQL="
SELECT k FROM (
  SELECT 'index|' || schemaname || '|' || count(*) AS k FROM pg_indexes WHERE schemaname IN ($SCHEMA_LIST) GROUP BY schemaname
  UNION ALL SELECT 'constraint:' || c.contype::text || '|' || n.nspname || '|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname IN ($SCHEMA_LIST) AND c.contype <> 'n' GROUP BY c.contype, n.nspname
  UNION ALL SELECT 'sequence|' || schemaname || '|' || count(*) FROM pg_sequences WHERE schemaname IN ($SCHEMA_LIST) GROUP BY schemaname
  UNION ALL SELECT 'function|' || n.nspname || '|' || count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ($SCHEMA_LIST) GROUP BY n.nspname
  UNION ALL SELECT 'column|' || table_schema || '|' || count(*) FROM information_schema.columns WHERE table_schema IN ($SCHEMA_LIST) GROUP BY table_schema
  UNION ALL SELECT 'notnull-column|' || table_schema || '|' || count(*) FROM information_schema.columns WHERE table_schema IN ($SCHEMA_LIST) AND is_nullable = 'NO' GROUP BY table_schema
) t ORDER BY 1;"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# run_query <url> <sql> <out-file>: read-only session, query errors abort with status 2.
run_query() {
  if ! psql "$1" -X -q -At -v ON_ERROR_STOP=1 \
      -c "SET default_transaction_read_only = on" -c "$2" > "$3" 2> "$WORK/psql.err"; then
    echo "query failed against $4:" >&2
    sed -E 's#postgres(ql)?://[^ ]*#<url>#' "$WORK/psql.err" >&2
    exit 2
  fi
  if [ ! -s "$3" ]; then
    echo "query returned nothing from $4; refusing to report a match." >&2
    exit 2
  fi
}

run_query "$RESTORED_URL" "$ROWS_SQL" "$WORK/rows.restored" "the restored database"
run_query "$LIVE_URL" "$ROWS_SQL" "$WORK/rows.live" "the live database"
run_query "$RESTORED_URL" "$OBJECTS_SQL" "$WORK/objects.restored" "the restored database"
run_query "$LIVE_URL" "$OBJECTS_SQL" "$WORK/objects.live" "the live database"

status=0

echo "== Row counts (tolerance: max(${TOLERANCE_ROWS} rows, ${TOLERANCE_PCT}% of live))"
set +e
awk -F'|' -v pct="$TOLERANCE_PCT" -v abs="$TOLERANCE_ROWS" '
  NR == FNR { restored[$2] = $3; next }
  { live[$2] = $3 }
  END {
    failed = 0; compared = 0; drifted = 0; rtotal = 0; ltotal = 0
    for (t in live) {
      compared++
      l = live[t] + 0; ltotal += l
      if (!(t in restored)) { printf "FAIL  %-48s missing from the restored database (live %d)\n", t, l; failed++; continue }
      r = restored[t] + 0; rtotal += r
      d = r - l; ad = (d < 0) ? -d : d
      tol = l * pct / 100; if (tol < abs) tol = abs
      if (r == 0 && l > 0)  { printf "FAIL  %-48s restored 0 rows, live %d\n", t, l; failed++ }
      else if (ad > tol)    { printf "FAIL  %-48s restored %d, live %d (%+d, beyond tolerance %d)\n", t, r, l, d, tol; failed++ }
      else if (d != 0)      { printf "drift %-48s restored %d, live %d (%+d)\n", t, r, l, d; drifted++ }
    }
    for (t in restored) if (!(t in live)) printf "info  %-48s only in the restored database\n", t
    printf "tables compared: %d, failed: %d, drifted within tolerance: %d, rows restored/live: %d/%d\n", compared, failed, drifted, rtotal, ltotal > "/dev/stderr"
    exit (failed > 0)
  }' "$WORK/rows.restored" "$WORK/rows.live" > "$WORK/rows.out" 2> "$WORK/rows.summary"
rows_rc=$?
set -e
sort "$WORK/rows.out"
cat "$WORK/rows.summary"
[ "$rows_rc" -eq 0 ] || status=1

echo
echo "== Object counts (exact)"
if diff "$WORK/objects.restored" "$WORK/objects.live" > "$WORK/objects.diff"; then
  echo "identical across $(wc -l < "$WORK/objects.live" | tr -d ' ') groups"
else
  echo "FAIL  object counts differ (< restored, > live):"
  grep -E '^[<>]' "$WORK/objects.diff"
  status=1
fi

echo
if [ "$status" -eq 0 ]; then echo "RESULT: restored database matches the live database."; else echo "RESULT: MISMATCH."; fi
exit "$status"
