#!/usr/bin/env bash
# Smoke-test and cost-compare Instagram profile-scraper Apify actors against
# real target accounts. Triggers real actor runs -> incurs real USD charges.
#
# Usage:
#   scripts/apify-smoke-test.sh [options]
#
# Options:
#   --dry-run          Print the planned runs and exit without calling the API.
#   --yes, -y           Skip the confirmation prompt.
#   --limit N           Result limit passed to actors that take one (default: 3).
#   --actor <substr>    Only run actors whose id contains <substr>. Repeatable.
#   --target <username> Only run this target username. Repeatable.
#   -h, --help          Show this help.
#
# Requires: curl, node (>=18), and APIFY_API_TOKEN in the environment or in
# the repo-root .env file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HELPER="$SCRIPT_DIR/apify-smoke-test.mjs"
OUT_DIR="$REPO_ROOT/_bmad-output/implementation-artifacts/apify-runs"
API_BASE="https://api.apify.com/v2"

# GETs are idempotent, safe to retry on transient network errors (e.g. TLS
# connection resets). The trigger POST is NOT auto-retried: retrying an
# ambiguous failure (server may have already started the run) risks starting
# and paying for a second run.
GET_CURL_OPTS=(--max-time 60 --retry 3 --retry-delay 3 --retry-all-errors)
POST_CURL_OPTS=(--max-time 60)

ACTORS=(
  "apify~instagram-profile-scraper|Apify: Instagram Profile Scraper"
  "figue~instagram-profile-scraper|Figue: Instagram Profile Scraper"
  "danek~instagram-profiles-scraper-ppr|Danek: Instagram Profiles Scraper (PPR)"
  "instagram-scraper~fast-instagram-post-scraper|Fast Instagram Post Scraper"
)

TARGETS=(infoeventjogja plazaambarrukmo)

LIMIT=3
DRY_RUN=0
ASSUME_YES=0
ONLY_ACTORS=()
ONLY_TARGETS=()
POLL_INTERVAL=5
MAX_WAIT_SEC=600

usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --actor) ONLY_ACTORS+=("$2"); shift 2 ;;
    --target) ONLY_TARGETS+=("$2"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "ERROR: node is required." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 1; }

if [[ -z "${APIFY_API_TOKEN:-}" && -f "$REPO_ROOT/.env" ]]; then
  APIFY_API_TOKEN="$(node -e "
    const fs = require('fs');
    const txt = fs.readFileSync(process.argv[1], 'utf8');
    const m = txt.match(/^APIFY_API_TOKEN=(.*)\$/m);
    if (m) process.stdout.write(m[1].trim().replace(/^['\"]|['\"]\$/g, ''));
  " "$REPO_ROOT/.env")"
fi
if [[ -z "${APIFY_API_TOKEN:-}" ]]; then
  echo "ERROR: APIFY_API_TOKEN not set and not found in $REPO_ROOT/.env" >&2
  exit 1
fi

should_run_actor() {
  local id="$1"
  [[ ${#ONLY_ACTORS[@]} -eq 0 ]] && return 0
  local a
  for a in "${ONLY_ACTORS[@]}"; do [[ "$id" == *"$a"* ]] && return 0; done
  return 1
}

should_run_target() {
  local u="$1"
  [[ ${#ONLY_TARGETS[@]} -eq 0 ]] && return 0
  local t
  for t in "${ONLY_TARGETS[@]}"; do [[ "$u" == "$t" ]] && return 0; done
  return 1
}

PLANNED=()
for actor_entry in "${ACTORS[@]}"; do
  actor_id="${actor_entry%%|*}"
  actor_label="${actor_entry#*|}"
  should_run_actor "$actor_id" || continue
  for username in "${TARGETS[@]}"; do
    should_run_target "$username" || continue
    PLANNED+=("$actor_id|$actor_label|$username")
  done
done

echo "Planned smoke-test runs (${#PLANNED[@]}):"
for p in "${PLANNED[@]}"; do
  IFS='|' read -r a l u <<< "$p"
  echo "  - $l  [$a]  -> @$u"
done

if [[ ${#PLANNED[@]} -eq 0 ]]; then
  echo "Nothing matched --actor/--target filters." >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run only — no API calls made."
  exit 0
fi

if [[ $ASSUME_YES -ne 1 ]]; then
  echo
  echo "WARNING: this triggers ${#PLANNED[@]} real Apify actor run(s) and incurs real USD charges."
  read -r -p "Continue? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SUMMARY_ROWS=()

for p in "${PLANNED[@]}"; do
  IFS='|' read -r actor_id actor_label username <<< "$p"
  echo
  echo "=== $actor_label  [$actor_id]  -> @$username ==="

  input_file="$TMP_DIR/input.json"
  node "$HELPER" build-input "$actor_id" "$username" "$LIMIT" > "$input_file"

  run_file="$TMP_DIR/run.json"
  # waitForFinish=0: fire-and-forget trigger only. Do NOT synchronously wait
  # here (avoid long-held connections) and never auto-retry this POST.
  if ! http_code=$(curl -sS "${POST_CURL_OPTS[@]}" -o "$run_file" -w '%{http_code}' \
    -X POST "$API_BASE/acts/$actor_id/runs?token=$APIFY_API_TOKEN&waitForFinish=0" \
    -H 'Content-Type: application/json' \
    --data @"$input_file"); then
    echo "  FAILED to trigger run (network error, not retried to avoid double-billing)"
    SUMMARY_ROWS+=("$actor_label|@$username|TRIGGER_NETWORK_ERROR|-|-")
    continue
  fi

  if [[ "$http_code" -ge 300 ]]; then
    echo "  FAILED to trigger run (HTTP $http_code):"
    cat "$run_file"
    SUMMARY_ROWS+=("$actor_label|@$username|TRIGGER_FAILED ($http_code)|-|-")
    continue
  fi

  run_id="$(node "$HELPER" get "$run_file" data.id)"
  status="$(node "$HELPER" get "$run_file" data.status)"

  waited=0
  while [[ "$status" != "SUCCEEDED" && "$status" != "FAILED" && "$status" != "TIMED-OUT" && "$status" != "ABORTED" && $waited -lt $MAX_WAIT_SEC ]]; do
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
    if ! curl -sS "${GET_CURL_OPTS[@]}" -o "$run_file" "$API_BASE/actor-runs/$run_id?token=$APIFY_API_TOKEN"; then
      echo "  ...poll request failed after retries, will try again (${waited}s elapsed)"
      continue
    fi
    status="$(node "$HELPER" get "$run_file" data.status)"
    echo "  ...status=$status (${waited}s elapsed)"
  done

  dataset_id="$(node "$HELPER" get "$run_file" data.defaultDatasetId)"
  dataset_file="$TMP_DIR/dataset.json"
  if ! curl -sS "${GET_CURL_OPTS[@]}" -o "$dataset_file" "$API_BASE/datasets/$dataset_id/items?token=$APIFY_API_TOKEN&clean=true&limit=$LIMIT"; then
    echo "  FAILED to fetch dataset items (network error)"
    SUMMARY_ROWS+=("$actor_label|@$username|$status (dataset fetch failed)|$run_id|-")
    continue
  fi

  report_file="$OUT_DIR/run-$run_id.$username.md"
  node "$HELPER" render-report "$run_file" "$dataset_file" "$input_file" "$actor_id" "$actor_label" "$username" "$report_file"

  cost="$(node "$HELPER" get "$run_file" data.totalChargeUsd)"
  echo "  status=$status  cost=\$${cost:-?}  report=$report_file"
  SUMMARY_ROWS+=("$actor_label|@$username|$status|$run_id|$report_file")
done

if [[ ${#SUMMARY_ROWS[@]} -gt 0 ]]; then
  summary_file="$OUT_DIR/smoke-test-summary-$(date +%Y%m%d-%H%M%S).md"
  {
    echo "# Apify Instagram Scraper Smoke Test Summary"
    echo
    echo "Generated: $(date '+%Y-%m-%d %H:%M')"
    echo
    echo "| Actor | Target | Status | Run ID | Report |"
    echo "|---|---|---|---|---|"
    for row in "${SUMMARY_ROWS[@]}"; do
      IFS='|' read -r al un st rid rf <<< "$row"
      if [[ "$rf" == "-" ]]; then
        echo "| $al | $un | $st | - | - |"
      else
        rel="${rf#"$REPO_ROOT"/}"
        echo "| $al | $un | $st | $rid | [$(basename "$rf")]($rel) |"
      fi
    done
  } > "$summary_file"
  echo
  echo "Summary written to $summary_file"
fi
