#!/usr/bin/env bash
# IDEA-015: empirical research script -- is batching multiple accounts into one
# scrape request cheaper/faster than one request per account, for Apify and
# Bright Data? Calls vendor REST APIs directly (mirrors scripts/apify-smoke-test.sh's
# pattern) -- does NOT import attemptApifyAsyncTrigger/attemptBrightDataTrigger
# (those have DB side effects) and makes ZERO writes to the app DB.
#
# Triggers real vendor actor/collector runs when not run with --dry-run ->
# incurs real USD charges.
#
# Usage:
#   scripts/scrape-batching-cost-research.sh [options]
#
# Options:
#   --dry-run          Print the planned requests and exit without calling any vendor API.
#   --yes, -y           Skip the confirmation prompt before real-money-triggering calls.
#   --limit N           Posts-per-account limit passed to both vendors (default: 3).
#   --accounts a,b,...  Comma-separated target usernames (default: infoeventjogja,plazaambarrukmo).
#   --vendor <apify|brightdata|both>  Restrict to one vendor (default: both).
#   -h, --help          Show this help.
#
# Requires: curl, node (>=18), and APIFY_API_TOKEN / BRIGHTDATA_API_TOKEN /
# BRIGHTDATA_DATASET_ID in the environment or in the repo-root .env file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HELPER="$SCRIPT_DIR/scrape-batching-cost-research.mjs"
OUT_DIR="$REPO_ROOT/_bmad-output/implementation-artifacts/scrape-batching-research"

APIFY_API_BASE="https://api.apify.com/v2"
APIFY_ACTOR_ID="apify~instagram-api-scraper"
BRIGHTDATA_API_BASE="https://api.brightdata.com"

# Formula pricing defaults mirror apps/backend/src/lib/scraper/usage-store.ts's
# getProviderPricing() fallbacks (env-overridable there; hardcoded here since this
# script is intentionally decoupled from loadBackendEnv()/the app runtime).
APIFY_PRICE_PER_1000_ITEMS_USD="2.3"
BRIGHTDATA_PRICE_PER_1000_ITEMS_USD="1.5"

GET_CURL_OPTS=(--max-time 60 --retry 3 --retry-delay 3 --retry-all-errors)
POST_CURL_OPTS=(--max-time 60)

ACCOUNTS="infoeventjogja,plazaambarrukmo"
LIMIT=3
DRY_RUN=0
ASSUME_YES=0
VENDOR="both"
POLL_INTERVAL=5
MAX_WAIT_SEC=600

usage() {
  sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

require_value() {
  # $1 = flag name (for the error message), $2 = remaining-arg count check
  if [[ "$2" -lt 2 ]]; then
    echo "ERROR: $1 requires a value" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --limit) require_value "--limit" "$#"; LIMIT="$2"; shift 2 ;;
    --accounts) require_value "--accounts" "$#"; ACCOUNTS="$2"; shift 2 ;;
    --vendor) require_value "--vendor" "$#"; VENDOR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$VENDOR" != "apify" && "$VENDOR" != "brightdata" && "$VENDOR" != "both" ]]; then
  echo "ERROR: --vendor must be apify, brightdata, or both" >&2
  exit 1
fi

if [[ ! "$LIMIT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --limit must be a positive integer, got: $LIMIT" >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "ERROR: node is required." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 1; }

load_env_var() {
  local var_name="$1"
  local current="${!var_name:-}"
  if [[ -z "$current" && -f "$REPO_ROOT/.env" ]]; then
    current="$(node -e "
      const fs = require('fs');
      const txt = fs.readFileSync(process.argv[1], 'utf8');
      const m = txt.match(new RegExp('^' + process.argv[2] + '=(.*)\$', 'm'));
      if (m) process.stdout.write(m[1].trim().replace(/^['\"]|['\"]\$/g, ''));
    " "$REPO_ROOT/.env" "$var_name")"
  fi
  printf '%s' "$current"
}

APIFY_API_TOKEN="$(load_env_var APIFY_API_TOKEN)"
BRIGHTDATA_API_TOKEN="$(load_env_var BRIGHTDATA_API_TOKEN)"
BRIGHTDATA_DATASET_ID="$(load_env_var BRIGHTDATA_DATASET_ID)"

IFS=',' read -r -a ACCOUNT_ARR_RAW <<< "$ACCOUNTS"
ACCOUNT_ARR=()
for a in "${ACCOUNT_ARR_RAW[@]}"; do
  # Drop empty entries (e.g. "a,,b" or a trailing comma) -- an empty username
  # would otherwise become a real "separate" request against instagram.com//
  # and desync ACCOUNT_COUNT from the actual directUrls/input array size the
  # node helper's filter(Boolean) sends, corrupting the batched-vs-separate
  # comparison this script exists to produce.
  [[ -n "$a" ]] && ACCOUNT_ARR+=("$a")
done
ACCOUNT_COUNT=${#ACCOUNT_ARR[@]}

if [[ $ACCOUNT_COUNT -lt 2 ]]; then
  echo "ERROR: need at least 2 --accounts to compare batched vs separate requests." >&2
  exit 1
fi

echo "Planned research runs:"
[[ "$VENDOR" == "apify" || "$VENDOR" == "both" ]] && {
  echo "  - Apify ($APIFY_ACTOR_ID): separate ($ACCOUNT_COUNT calls, 1 directUrl each) vs batched (1 call, $ACCOUNT_COUNT directUrls)"
}
[[ "$VENDOR" == "brightdata" || "$VENDOR" == "both" ]] && {
  echo "  - Bright Data (dataset trigger): separate ($ACCOUNT_COUNT calls, 1-element input each) vs batched (1 call, $ACCOUNT_COUNT-element input)"
}
echo "  Accounts: ${ACCOUNTS}  Limit/account: ${LIMIT}"

if [[ $DRY_RUN -eq 1 ]]; then
  echo
  echo "Dry run only -- no API calls made."
  [[ "$VENDOR" == "apify" || "$VENDOR" == "both" ]] && {
    echo "Apify batched input would be:"
    node "$HELPER" build-apify-input "$ACCOUNTS" "$LIMIT"
    echo
  }
  [[ "$VENDOR" == "brightdata" || "$VENDOR" == "both" ]] && {
    start_date="$(date -u -d '7 days ago' +%m-%d-%Y 2>/dev/null || date -u -v-7d +%m-%d-%Y)"
    echo "Bright Data batched input would be:"
    node "$HELPER" build-brightdata-input "$ACCOUNTS" "$LIMIT" "$start_date"
    echo
  }
  exit 0
fi

if [[ "$VENDOR" == "apify" || "$VENDOR" == "both" ]] && [[ -z "$APIFY_API_TOKEN" ]]; then
  echo "ERROR: APIFY_API_TOKEN not set and not found in $REPO_ROOT/.env" >&2
  exit 1
fi
if [[ "$VENDOR" == "brightdata" || "$VENDOR" == "both" ]] && { [[ -z "$BRIGHTDATA_API_TOKEN" ]] || [[ -z "$BRIGHTDATA_DATASET_ID" ]]; }; then
  echo "ERROR: BRIGHTDATA_API_TOKEN/BRIGHTDATA_DATASET_ID not set and not found in $REPO_ROOT/.env" >&2
  exit 1
fi

if [[ $ASSUME_YES -ne 1 ]]; then
  echo
  echo "WARNING: this triggers real Apify/Bright Data runs and incurs real USD charges."
  read -r -p "Continue? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"

ROWS_FILE="$TMP_DIR/rows.json"
echo "[]" > "$ROWS_FILE"

# If anything later fails unexpectedly (a vendor response the node helper's own
# guards didn't anticipate, a curl edge case, etc.), still render whatever rows
# were collected so far before exiting -- losing the report entirely would also
# lose the record of any already-triggered (already-paid-for) vendor run.
on_error() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 ]]; then
    local row_count
    row_count="$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).length)}catch{console.log(0)}" "$ROWS_FILE" 2>/dev/null || echo 0)"
    if [[ "$row_count" -gt 0 ]]; then
      local partial_report="$OUT_DIR/report-partial-$(date +%Y%m%d-%H%M%S).md"
      node "$HELPER" render-report "$ROWS_FILE" "$partial_report" 2>/dev/null || true
      echo "ERROR: script failed (exit $exit_code) -- partial report ($row_count row(s)) written to $partial_report" >&2
    fi
  fi
  rm -rf "$TMP_DIR"
}
trap on_error EXIT

append_row() {
  local row_json="$1"
  node -e "
    const fs = require('fs');
    const rows = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    rows.push(JSON.parse(process.argv[2]));
    fs.writeFileSync(process.argv[1], JSON.stringify(rows));
  " "$ROWS_FILE" "$row_json"
}

# --- Apify: trigger + poll + dataset fetch, given a JSON input body ---------
apify_run() {
  local mode="$1" account_count="$2" input_file="$3"
  local run_file="$TMP_DIR/apify-run-$mode.json"

  local http_code
  if ! http_code=$(curl -sS "${POST_CURL_OPTS[@]}" -o "$run_file" -w '%{http_code}' \
    -X POST "$APIFY_API_BASE/acts/$APIFY_ACTOR_ID/runs?token=$APIFY_API_TOKEN&waitForFinish=0" \
    -H 'Content-Type: application/json' \
    --data @"$input_file"); then
    append_row "$(node -e "console.log(JSON.stringify({vendor:'apify',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_NETWORK_ERROR',notes:'network error, not retried to avoid double-billing'}))" "$mode" "$account_count")"
    return
  fi
  if [[ "$http_code" -ge 300 ]]; then
    local body; body="$(cat "$run_file")"
    append_row "$(node -e "console.log(JSON.stringify({vendor:'apify',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_FAILED ('+process.argv[3]+')',notes:process.argv[4]}))" "$mode" "$account_count" "$http_code" "$body")"
    return
  fi

  local run_id status
  run_id="$(node "$HELPER" get "$run_file" data.id)"
  status="$(node "$HELPER" get "$run_file" data.status)"

  if [[ -z "$run_id" ]]; then
    local body; body="$(cat "$run_file" 2>/dev/null || echo '')"
    append_row "$(node -e "console.log(JSON.stringify({vendor:'apify',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_RESPONSE_MISSING_ID',notes:'HTTP 2xx but response body had no data.id -- unexpected schema, not polled',raw:{body:process.argv[3]}}))" "$mode" "$account_count" "$body")"
    return
  fi

  local waited=0
  while [[ "$status" != "SUCCEEDED" && "$status" != "FAILED" && "$status" != "TIMED-OUT" && "$status" != "ABORTED" && $waited -lt $MAX_WAIT_SEC ]]; do
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
    if ! curl -sS "${GET_CURL_OPTS[@]}" -o "$run_file" "$APIFY_API_BASE/actor-runs/$run_id?token=$APIFY_API_TOKEN"; then
      echo "  [apify/$mode] ...poll request failed after retries, will try again (${waited}s elapsed)"
      continue
    fi
    status="$(node "$HELPER" get "$run_file" data.status)"
    echo "  [apify/$mode] ...status=$status (${waited}s elapsed)"
  done
  if [[ "$status" != "SUCCEEDED" && "$status" != "FAILED" && "$status" != "TIMED-OUT" && "$status" != "ABORTED" ]]; then
    status="${status:-unknown} (CLIENT_TIMEOUT: gave up polling after ${MAX_WAIT_SEC}s -- vendor run may still be in progress)"
  fi

  local started finished duration
  started="$(node "$HELPER" get "$run_file" data.startedAt)"
  finished="$(node "$HELPER" get "$run_file" data.finishedAt)"
  duration=""
  if [[ -n "$started" && -n "$finished" ]]; then
    duration=$(( ($(date -u -d "$finished" +%s 2>/dev/null || date -u -jf '%Y-%m-%dT%H:%M:%S' "${finished%%.*}" +%s) - $(date -u -d "$started" +%s 2>/dev/null || date -u -jf '%Y-%m-%dT%H:%M:%S' "${started%%.*}" +%s)) ))
  fi

  local cost_json vendor_total formula_total item_count
  cost_json="$(node "$HELPER" apify-cost "$run_file")"
  vendor_total="$(node -e "const c=JSON.parse(process.argv[1]); console.log(c.total===null?'':c.total)" "$cost_json")"
  item_count="$(node "$HELPER" get "$run_file" data.stats.outputItemCount 2>/dev/null || echo '')"
  [[ -z "$item_count" ]] && item_count=0
  formula_total="$(node "$HELPER" formula-cost "$item_count" "$APIFY_PRICE_PER_1000_ITEMS_USD")"

  local raw; raw="$(cat "$run_file")"
  append_row "$(node -e "
    console.log(JSON.stringify({
      vendor: 'apify', mode: process.argv[1], accountCount: process.argv[2],
      status: process.argv[3], durationSec: process.argv[4] || null,
      vendorCost: process.argv[5] || null, formulaCost: process.argv[6],
      notes: '', raw: JSON.parse(process.argv[7]),
    }));
  " "$mode" "$account_count" "$status" "$duration" "$vendor_total" "$formula_total" "$raw")"
}

# --- Bright Data: trigger (no webhook -- poll instead) + dataset fetch -----
brightdata_run() {
  local mode="$1" account_count="$2" input_file="$3"
  local run_file="$TMP_DIR/brightdata-run-$mode.json"

  local url="$BRIGHTDATA_API_BASE/datasets/v3/trigger?dataset_id=$BRIGHTDATA_DATASET_ID&type=discover_new&discover_by=url&format=json"
  local http_code
  if ! http_code=$(curl -sS "${POST_CURL_OPTS[@]}" -o "$run_file" -w '%{http_code}' \
    -X POST "$url" \
    -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
    -H 'Content-Type: application/json' \
    --data @"$input_file"); then
    append_row "$(node -e "console.log(JSON.stringify({vendor:'brightdata',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_NETWORK_ERROR',notes:'network error, not retried to avoid double-billing'}))" "$mode" "$account_count")"
    return
  fi
  if [[ "$http_code" -ge 300 ]]; then
    local body; body="$(cat "$run_file")"
    local note="HTTP $http_code"
    if [[ "$mode" == "batched" ]]; then
      note="RESEARCH FINDING: Bright Data's trigger endpoint rejected a multi-element input array (HTTP $http_code) -- batching is NOT supported by this endpoint."
    fi
    append_row "$(node -e "console.log(JSON.stringify({vendor:'brightdata',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_FAILED ('+process.argv[3]+')',notes:process.argv[4],raw:{body:process.argv[5]}}))" "$mode" "$account_count" "$http_code" "$note" "$body")"
    return
  fi

  local snapshot_id status
  snapshot_id="$(node "$HELPER" get "$run_file" snapshot_id)"
  status="scheduled"

  if [[ -z "$snapshot_id" ]]; then
    local body; body="$(cat "$run_file" 2>/dev/null || echo '')"
    append_row "$(node -e "console.log(JSON.stringify({vendor:'brightdata',mode:process.argv[1],accountCount:process.argv[2],status:'TRIGGER_RESPONSE_MISSING_ID',notes:'HTTP 2xx but response body had no snapshot_id -- unexpected schema (possibly an embedded-error response), not polled',raw:{body:process.argv[3]}}))" "$mode" "$account_count" "$body")"
    return
  fi

  local waited=0 progress_file="$TMP_DIR/brightdata-progress-$mode.json"
  while [[ "$status" != "ready" && "$status" != "failed" && $waited -lt $MAX_WAIT_SEC ]]; do
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
    if ! curl -sS "${GET_CURL_OPTS[@]}" -o "$progress_file" \
      -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
      "$BRIGHTDATA_API_BASE/datasets/v3/progress/$snapshot_id"; then
      echo "  [brightdata/$mode] ...poll request failed after retries, will try again (${waited}s elapsed)"
      continue
    fi
    status="$(node "$HELPER" get "$progress_file" status)"
    echo "  [brightdata/$mode] ...status=$status (${waited}s elapsed)"
  done
  if [[ "$status" != "ready" && "$status" != "failed" ]]; then
    status="${status:-unknown} (CLIENT_TIMEOUT: gave up polling after ${MAX_WAIT_SEC}s -- vendor run may still be in progress)"
  fi

  local snapshot_file="$TMP_DIR/brightdata-snapshot-$mode.json"
  curl -sS "${GET_CURL_OPTS[@]}" -o "$snapshot_file" \
    -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
    "$BRIGHTDATA_API_BASE/datasets/v3/snapshot/$snapshot_id?format=json" || true

  local item_count formula_total
  item_count="$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(Array.isArray(d)?d.length:0)}catch{console.log(0)}" "$snapshot_file")"
  formula_total="$(node "$HELPER" formula-cost "$item_count" "$BRIGHTDATA_PRICE_PER_1000_ITEMS_USD")"

  append_row "$(node -e "
    console.log(JSON.stringify({
      vendor: 'brightdata', mode: process.argv[1], accountCount: process.argv[2],
      status: process.argv[3], durationSec: process.argv[4],
      vendorCost: null, formulaCost: process.argv[5],
      notes: 'Bright Data trigger/progress/snapshot responses carry no per-run billing field -- formula cost only.',
      raw: { snapshotId: process.argv[6], itemCount: process.argv[7] },
    }));
  " "$mode" "$account_count" "$status" "$waited" "$formula_total" "$snapshot_id" "$item_count")"
}

if [[ "$VENDOR" == "apify" || "$VENDOR" == "both" ]]; then
  echo; echo "=== Apify: separate (1 call per account) ==="
  for u in "${ACCOUNT_ARR[@]}"; do
    input_file="$TMP_DIR/apify-input-separate-$u.json"
    node "$HELPER" build-apify-input "$u" "$LIMIT" > "$input_file"
    apify_run "separate-$u" 1 "$input_file"
  done

  echo; echo "=== Apify: batched (1 call, $ACCOUNT_COUNT directUrls) ==="
  input_file="$TMP_DIR/apify-input-batched.json"
  node "$HELPER" build-apify-input "$ACCOUNTS" "$LIMIT" > "$input_file"
  apify_run "batched" "$ACCOUNT_COUNT" "$input_file"
fi

if [[ "$VENDOR" == "brightdata" || "$VENDOR" == "both" ]]; then
  start_date="$(date -u -d '7 days ago' +%m-%d-%Y 2>/dev/null || date -u -v-7d +%m-%d-%Y)"

  echo; echo "=== Bright Data: separate (1 call per account) ==="
  for u in "${ACCOUNT_ARR[@]}"; do
    input_file="$TMP_DIR/brightdata-input-separate-$u.json"
    node "$HELPER" build-brightdata-input "$u" "$LIMIT" "$start_date" > "$input_file"
    brightdata_run "separate-$u" 1 "$input_file"
  done

  echo; echo "=== Bright Data: batched (1 call, $ACCOUNT_COUNT-element input) ==="
  input_file="$TMP_DIR/brightdata-input-batched.json"
  node "$HELPER" build-brightdata-input "$ACCOUNTS" "$LIMIT" "$start_date" > "$input_file"
  brightdata_run "batched" "$ACCOUNT_COUNT" "$input_file"
fi

report_file="$OUT_DIR/report-$(date +%Y%m%d-%H%M%S).md"
node "$HELPER" render-report "$ROWS_FILE" "$report_file"
echo
echo "Report written to $report_file"
