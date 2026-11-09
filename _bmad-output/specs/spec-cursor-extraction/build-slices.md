# Build slices

Order of work for cursor extraction. Each slice ships on its own, dark (the stepped path is off until slice 5 is live-verified and `CURSOR_EXTRACTION_ENABLED` is turned on, AD-51 Rule 2). Each is a `bmad-quick-dev` spec; the architecture is AD-46 to AD-51 in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`.

| # | Slice | Covers | Depends on | Ships value alone? |
|---|---|---|---|---|
| 1 | Gemini client returns `finishReason` and token usage; an unparseable or truncated response is retried or recorded, never dropped silently | AD-49 Rules 1, 2 (signals), parse-failure part of 3; CAP-4 (detection half) | none | Yes: fixes the silent parse failure seen in the live corpus and logs truncation |
| 2 | Pure domain: cursor type (versioned), continue-rules decision function, ordinal range allocation, dedupe key, request-bound check | AD-46 Rules 3-5a, AD-48 Rules 1-2 (pure part), AD-51 Rule 1 (pure part); CAP-2, CAP-6 (pure part) | none | No (library); fully unit-tested to 100% like other domain code |
| 3 | Migration and cursor writer: `posts.extraction_cursor`, `posts.extraction_partial`, the one compare-and-set writer with lease, claim and PENDING-status rules | AD-47 Rules 3, 4, 5a, 5b; AD-50 Rule 1 | 2 | No (dark) |
| 4 | Post plan in the first request (schema verified live against Gemini) | AD-46 Rule 2; CAP-1 | 1 | Yes: plan logged for tuning |
| 5 | The step handler: step message, per-call cap, split on at-risk, reserve-before-enqueue, commit order, kill switch, one log line per step | AD-46, AD-47 Rules 1-4a, AD-48, AD-49 Rule 3, AD-51 Rules 1-3, 5, 6; CAP-3, CAP-4, CAP-5, CAP-6, CAP-8, CAP-10 | 1-4 | Yes once switched on |
| 6 | Resume pass on the tick and the re-scrape before giving up | AD-47 Rules 5, 6; AD-51 Rule 4; CAP-7 | 5 | Yes |
| 7 | Moderator guards (`CHAIN_IN_FLIGHT`, Apply clears the flag) and the roundup sibling list and partial note | AD-50 Rules 2-5; AD-51 Rule 4 (guard); CAP-9 | 3, 5 | Yes |

Then: live regression over the corpus (`evidence.md`) and a replay of `DfRtgnXE_41` in 3 steps, and only then turn the switch on in infra. Slice 1 is the first to build.
