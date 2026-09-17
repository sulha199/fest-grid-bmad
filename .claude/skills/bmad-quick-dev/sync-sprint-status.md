# Sync Sprint Status

Shared sub-step for updating `sprint-status.yaml` during quick-dev. Called from any route (plan-code-review, one-shot, future routes) with a `{target_status}` parameter.

## Preconditions

Skip this entire file (return to caller) if ANY of:
- `{story_key}` is unset
- `{sprint_status}` does not exist on disk

## Instructions

1. Run `python3 {project-root}/scripts/sprint-status-tool.py set {story_key} {target_status} --no-regress`. This single call, without ever loading the full ~40k-token file into context:
   - looks up `development_status[{story_key}]` (exit 1, printed to stderr, if not found -- warn the user once with `"{story_key} not found in sprint-status; skipping sprint sync"` and return to caller);
   - performs the idempotency check (`--no-regress` skips the write and exits 0 if the story is already at or past `{target_status}` in the standard lifecycle order -- never regresses a story's status);
   - updates `development_status[{story_key}]` to `{target_status}`;
   - refreshes `last_updated` to a bare ISO timestamp, no trailing comment, no narrative (narrative belongs in the story file's own Dev Notes / Change Log -- this file is read in full elsewhere in the ritual, so an ever-growing inline narrative here is a cost every future session pays).
2. **Epic lift (only when `{target_status}` = `in-progress`).** Derive the parent epic key as `epic-{N}` from the leading numeric segment of `{story_key}` (e.g., `3-2-digest-delivery` → `epic-3`). Run `python3 {project-root}/scripts/sprint-status-tool.py set epic-{N} in-progress --expect backlog` -- a non-zero exit (epic not found, or not currently `backlog`) is expected and fine, just means no lift was needed; do not treat it as an error. Skip this sub-step entirely when `{target_status}` is not `in-progress`.
3. **If the script fails to run** (not a normal non-zero exit from the checks above, but a real execution failure -- e.g. python3 unavailable): fall back to loading the FULL `{sprint_status}` file, finding `development_status[{story_key}]`, applying the same idempotency/update/epic-lift/timestamp rules by hand, and saving while preserving ALL comments and structure including STATUS DEFINITIONS and WORKFLOW NOTES.
