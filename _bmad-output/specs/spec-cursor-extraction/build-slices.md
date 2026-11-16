# Build slices

Order of work for cursor extraction. Each slice ships on its own, dark (the stepped path is off until slice 5 is live-verified and `CURSOR_EXTRACTION_ENABLED` is turned on, AD-51 Rule 2). Each is a `bmad-quick-dev` spec; the architecture is AD-46 to AD-51 in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`.

| # | Slice | Covers | Depends on | Ships value alone? |
|---|---|---|---|---|
| 1 | Gemini client returns `finishReason` and token usage; an unparseable or truncated response is retried or recorded, never dropped silently | AD-49 Rules 1, 2 (signals), parse-failure part of 3; CAP-4 (detection half) | none | Yes: fixes the silent parse failure seen in the live corpus and logs truncation |
| 1b | One retry policy: the situation set and `decideRetry` in `packages/domain`, adopted by `callVendor` and the Gemini key loop; the eval policy folds in | AD-52 Rules 1-3, 7, 8 (Gemini only) | 1 | Yes: smarter in-call retries; no migration |
| 1c | Durable post retry: ledger columns, resume pass for due posts, derived `ATTEMPT_FAILED` status (domain rule, SQL twin, GraphQL enum, moderator filter and reason) | AD-52 Rules 4-6; shares the resume pass with AD-47 Rule 5 | 1, 1b | Yes: failed posts are visible and retried by themselves |
| 2 | Pure domain: cursor type (versioned), continue-rules decision function, ordinal range allocation, dedupe key, request-bound check | AD-46 Rules 3-5a, AD-48 Rules 1-2 (pure part), AD-51 Rule 1 (pure part); CAP-2, CAP-6 (pure part) | none | No (library); fully unit-tested to 100% like other domain code |
| 3 | Migration and cursor writer: `posts.extraction_cursor`, `posts.extraction_partial`, the one compare-and-set writer with lease, claim and PENDING-status rules | AD-47 Rules 3, 4, 5a, 5b; AD-50 Rule 1 | 2 | No (dark) |
| 4 | Post plan in the first request (schema verified live against Gemini) | AD-46 Rule 2; CAP-1 | 1 | Yes: plan logged for tuning |
| 5 | The step handler: step message, per-call cap, split on at-risk, reserve-before-enqueue, commit order, kill switch, one log line per step | AD-46, AD-47 Rules 1-4a, AD-48, AD-49 Rule 3, AD-51 Rules 1-3, 5, 6; CAP-3, CAP-4, CAP-5, CAP-6, CAP-8, CAP-10 | 1-4 | Yes once switched on |
| 6 | Resume pass on the tick and the re-scrape before giving up | AD-47 Rules 5, 6; AD-51 Rule 4; CAP-7 | 5 | Yes |
| 7 | Moderator guards (`CHAIN_IN_FLIGHT`, Apply clears the flag) and the roundup sibling list and partial note | AD-50 Rules 2-5; AD-51 Rule 4 (guard); CAP-9 | 3, 5 | Yes |

## Status (2026-11-12)

All slices are built and merged: 1 (#190), 1b, 1c, 2 (#194), 3 (#195), 4 (#196), 5 (#197), 6 (#198) and 7 (#199), plus two fixes found by live runs: the claim watchdog (#200) and the first window that finds nothing (#201). 1c and 6 share the one resume pass.

The switch is on: PR #203 made `CURSOR_EXTRACTION_ENABLED` default to true in the AI Lambda (deployed). The repository variable of the same name is the kill switch; `false` stops new chains and flags chains in flight as partial (AD-51 Rule 2).

**What was verified before the switch:** a live replay of `DfRtgnXE_41` (26 events in 2 requests, contiguous ordinals; real Gemini, scratch DB, queues mocked). The corpus regression in `evidence.md` was not repeated as a whole.

**What production shows (read-only check, 2026-11-12):** four posts published 2026-11-10 have more than one `extraction_audit_logs` row, i.e. they ran as chains: 16 events in 4 steps (17 images), 11 in 3 (12 images), 7 in 2 (8 images) and 5 in 2 (9 images), all `separate-events`. No post has a cursor left (it is cleared when a chain completes). The URUP post (`DfLcqoqj-al`) cannot be re-run: its slides have expired.

**Open (on the backlog board):** FIND-261112-gnf (a replay after a crash can ingest an event twice under new ordinals), FIND-261112-zrr (a first request cut off by the token limit is not split), FIND-261112-znv (Apply's `CHAIN_IN_FLIGHT` guard is a pre-check outside its transaction), FIND-261112-qjf (the re-scrape cooldown lives in the cursor, not in the moderator preview's ledger), FIND-261112-ifs (a replayed step repeats its keywords call, among the keywords call's deferred findings), and IDEA-261111-9ch (the accuracy eval scores only the first call, not a chain).
