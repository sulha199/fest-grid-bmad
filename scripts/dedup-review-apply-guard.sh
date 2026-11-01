#!/usr/bin/env bash
# Guards and summary for the `dedup-review-apply` workflow (AI dedup review, piece B2b-2).
#
#   dedup-review-apply-guard.sh <output-file> <exit-status> <mode> <live>
#
# <output-file> is what the apply script printed on stdout, <exit-status> its exit status (a number), <mode>
# is `validate` or `apply`, <live> is `true` for a live apply (anything else counts as not live).
#
# It runs in the same workflow step as the script because a later step cannot see the script's exit
# status. It prints the output into the log, fails the job when the run cannot be trusted, and writes
# the job summary: counts and fixed reason codes only, never an id, a merge id or any text, because
# this repository is public and so are its job summaries. (The log still holds the script's whole report.)
#
# Exit status: the script's own status when that was not 0; 2 for a bad argument; otherwise 0, or 1 when the
# report is missing, malformed, inconsistent, of the wrong mode, or says the kill switch stopped the run.
set -uo pipefail

file="${1:-}"
rc="${2:-}"
mode="${3:-}"
live="${4:-false}"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::The guard script needs jq."
  exit 1
fi
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "::error::The guard script needs the apply script's output file."
  exit 2
fi
case "$mode" in
  validate | apply) ;;
  *) echo "::error::The guard script needs mode validate or apply."; exit 2 ;;
esac
case "$rc" in
  '' | *[!0-9]*) echo "::error::The guard script needs a numeric exit status."; exit 2 ;;
esac
if [ "$mode" = validate ] || [ "$live" != true ]; then
  live=false
fi

cat "$file"

if [ "$rc" -ne 0 ]; then
  if [ "$live" = true ]; then
    echo "::error::The live apply exited with status $rc. The run is one transaction, so this usually means it rolled back. The one exception is a report lost after the commit, which the script says on its error output above; if it does, do not run it again for these decisions: list event_merges rows with performed_via = 'ai_skill' (newest first) to see what was merged."
  else
    echo "::error::The apply script exited with status $rc. It changed nothing that persists (a dry run rolls back and validate cannot write)."
  fi
  exit "$rc"
fi

# Exactly one BEGIN and one END, in that order, with exactly one line of JSON between them.
begins=$(grep -cx 'DEDUP_REVIEW_APPLY_BEGIN' "$file")
ends=$(grep -cx 'DEDUP_REVIEW_APPLY_END' "$file")
if [ "$begins" -ne 1 ] || [ "$ends" -ne 1 ]; then
  echo "::error::The apply script must print exactly one DEDUP_REVIEW_APPLY_BEGIN and one DEDUP_REVIEW_APPLY_END marker (found $begins and $ends), so its result is unknown. Check the script's file name and the log above."
  exit 1
fi
begin_line=$(grep -nx 'DEDUP_REVIEW_APPLY_BEGIN' "$file" | cut -d: -f1)
end_line=$(grep -nx 'DEDUP_REVIEW_APPLY_END' "$file" | cut -d: -f1)
if [ "$end_line" -ne $((begin_line + 2)) ]; then
  echo "::error::The apply script's report must be exactly one line between its markers."
  exit 1
fi
json=$(sed -n "$((begin_line + 1))p" "$file")

# The shape the summary and the checks below rely on. A report of the wrong shape must not give a green job
# with a half-written summary.
if ! printf '%s\n' "$json" | jq -e '
    (.mode | type == "string") and (.killSwitch | type == "boolean")
    and (.usedLast24h == null or (.usedLast24h | type == "number"))
    and (.caps.perRun | type == "number") and (.caps.perDay | type == "number")
    and (.counts.eligible | type == "number") and (.counts.merged | type == "number") and (.counts.skipped | type == "number")
    and (.results | type == "array")' >/dev/null 2>&1; then
  echo "::error::The apply script's report is missing fields or has the wrong shape."
  exit 1
fi

if [ "$mode" = validate ]; then
  expected=validate
elif [ "$live" = true ]; then
  expected=live
else
  expected=dry-run
fi
actual=$(printf '%s\n' "$json" | jq -r '.mode')

if [ "$actual" != disabled ]; then
  if [ "$actual" != "$expected" ]; then
    echo "::error::The report says mode '$actual' but this run asked for '$expected'."
    exit 1
  fi
  # The counts must match the results, and only a live run may have merged anything.
  if ! printf '%s\n' "$json" | jq -e '
      ([.results[] | select(.outcome == "merged")] | length) as $m
      | ([.results[] | select(.outcome == "eligible")] | length) as $e
      | ([.results[] | select(.outcome == "skipped")] | length) as $s
      | (.counts.merged == $m and .counts.eligible == $e and .counts.skipped == $s)
        and (if .mode == "live" then true else $m == 0 end)' >/dev/null 2>&1; then
    echo "::error::The report is inconsistent: its counts do not match its results, or a run that is not live reports a merge."
    exit 1
  fi
fi

if ! text=$(printf '%s\n' "$json" | jq -r '
    "- mode: `\(.mode)`",
    "- run tag: `\(.runTag // "none")`",
    "- kill switch: \(.killSwitch)",
    "- AI decisions in the last 24 hours before this run: \(if .usedLast24h == null then "n/a" else .usedLast24h end)",
    "- caps: \(.caps.perRun) per run, \(.caps.perDay) per day",
    "- eligible: \(.counts.eligible), merged: \(.counts.merged), skipped: \(.counts.skipped)",
    "- skipped by reason: \(([.results[] | select(.reason) | .reason] | group_by(.) | map("\(.[0]): \(length)") | join(", ")) as $r | if $r == "" then "none" else $r end)"' 2>/dev/null); then
  echo "::error::The summary could not be built from the apply script's report."
  exit 1
fi
{
  echo '### Dedup Review Apply'
  echo ''
  printf '%s\n' "$text"
} >> "$summary"

if [ "$actual" = disabled ]; then
  echo "- apply was switched off by the script's own kill switch: nothing ran" >> "$summary"
  echo "::error::The script reports that its kill switch is on, so the run did nothing. The workflow's own check should have stopped it first: look at the variable DEDUP_REVIEW_APPLY_DISABLED."
  exit 1
fi
