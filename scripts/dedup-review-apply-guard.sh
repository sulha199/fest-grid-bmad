#!/usr/bin/env bash
# Guards and summary for the `dedup-review-apply` workflow (AI dedup review, piece B2b-2).
#
#   dedup-review-apply-guard.sh <output-file> <exit-status> <mode> <live>
#
# <output-file> is what the apply script printed on stdout, <exit-status> its exit status, <mode> is
# `validate` or `apply`, <live> is `true` for a live apply (anything else counts as not live).
#
# It runs in the same workflow step as the script because a later step cannot see the script's exit
# status. It prints the output into the log, fails the job when the run cannot be trusted, and writes
# the job summary: counts and fixed reason codes only, never an id, a merge id or any text, because
# this repository is public and so are its job summaries.
#
# Exit status: the script's own status when that was not 0, otherwise 0 or 1.
set -uo pipefail

file="${1:?output file}"
rc="${2:?exit status}"
mode="${3:?mode}"
live="${4:-false}"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

cat "$file"

if [ "$rc" -ne 0 ]; then
  if [ "$mode" = apply ] && [ "$live" = true ]; then
    echo "::error::The live apply exited with status $rc. The run is one transaction, so this usually means it rolled back. The one exception is a report lost after the commit, which the script says on its error output above; if it does, do not run it again for these decisions: list event_merges rows with performed_via = 'ai_skill' (newest first) to see what was merged."
  else
    echo "::error::The apply script exited with status $rc. It changed nothing that persists (a dry run rolls back and validate cannot write)."
  fi
  exit "$rc"
fi

if ! grep -qx 'DEDUP_REVIEW_APPLY_BEGIN' "$file" || ! grep -qx 'DEDUP_REVIEW_APPLY_END' "$file"; then
  echo "::error::The apply script printed no DEDUP_REVIEW_APPLY_BEGIN and DEDUP_REVIEW_APPLY_END markers, so its result is unknown. Check the script's file name and the log above."
  exit 1
fi

# The JSON is the line between the markers, wherever the output puts it.
json=$(awk '/^DEDUP_REVIEW_APPLY_BEGIN$/ {inside=1; next} /^DEDUP_REVIEW_APPLY_END$/ {inside=0} inside' "$file")
if [ -z "$json" ] || ! printf '%s\n' "$json" | jq -e . >/dev/null 2>&1; then
  echo "::error::The apply script's report between the markers is missing or is not valid JSON."
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
if [ "$actual" != "$expected" ] && [ "$actual" != disabled ]; then
  echo "::error::The report says mode '$actual' but this run asked for '$expected'."
  exit 1
fi

{
  echo '### Dedup Review Apply'
  echo ''
  printf '%s\n' "$json" | jq -r '
    "- mode: `\(.mode)`",
    "- run tag: `\(.runTag // "none")`",
    "- kill switch: \(.killSwitch)",
    "- AI decisions in the last 24 hours before this run: \(if .usedLast24h == null then "n/a" else .usedLast24h end)",
    "- caps: \(.caps.perRun) per run, \(.caps.perDay) per day",
    "- eligible: \(.counts.eligible), merged: \(.counts.merged), skipped: \(.counts.skipped)",
    "- skipped by reason: \(([.results[] | select(.reason) | .reason] | group_by(.) | map("\(.[0]): \(length)") | join(", ")) as $r | if $r == "" then "none" else $r end)"'
} >> "$summary"
