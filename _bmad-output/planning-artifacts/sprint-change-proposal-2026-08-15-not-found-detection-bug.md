---
backlog_id: CC-011
---

# Sprint Change Proposal: Scraper Adapter Correctness and Reliability Fixes

- **Date:** 2026-08-15, amended 2026-08-17
- **Trigger:** Story 3.4d, Task 1b (valid/invalid-input testing of `getPostByUrl`/`lookupAccountProfile`); amended by a follow-up question the user raised before approving the original proposal
- **Mode:** Incremental

**Amendment (2026-08-17):** Originally scoped around a single finding (Section 1's not-found-detection bug, Story 3.4e). Before this proposal was approved, the user asked whether scheduled-batch scraping via Apify (which can run minutes to ~1 hour per Apify's own actor documentation) had been anticipated, then clarified the intended multi-vendor split (Bright Data for scheduled batch only; Apify for scheduled batch as fallback, vote-time profile check, and subscribe-time). Investigating surfaced a second, independent, more severe finding — the entire CDK stack has no Lambda timeout configured anywhere, silently defaulting to AWS's 3-second minimum — plus a design gap (Apify's long-running `getNewestPosts` path has no async/webhook handling the way Bright Data's does, Story 3.4a). Per the user's explicit direction ("Add as a 3rd split-off story now"), this is folded into the *same* proposal as a third split-off story, Story 3.4f, rather than opened as a separate correct-course pass. This document now covers three findings and three split-off stories (3.4d unchanged/actor-selection, 3.4e/not-found-detection, 3.4f/Lambda-timeouts+async-Apify), all originating from the same Story 3.4d investigation thread. See Section 1b, Section 4.6, and the updated Section 5 for the new material.

## 1. Issue Summary

Neither `getPostByUrl` nor `lookupAccountProfile` (`apps/backend/src/lib/scraper/instagram-adapter.ts`) can distinguish "this post/account doesn't exist" from "this post/account exists." Both Apify actors tested (`apify/instagram-api-scraper`, `apify/instagram-post-scraper`) return a **truthy 1-item array** for genuinely invalid input — `{"url": ..., "username": ..., "error": "not_found", "errorDescription": "Post does not exist"}` — not an empty array. The adapter's existing `if (!items || items.length === 0) return null` guard never fires, since `items.length === 1`.

**Discovery:** While testing Story 3.4d's sync-path actor comparison (Task 1b), the plan was revised from "3x-repeat a valid call" to "test valid vs. invalid input," on the reasoning that both `getPostByUrl` and `lookupAccountProfile` have an untested correctness dependency on not-found detection (`resolvers.ts:994`, `resolvers.ts:1434`). All 4 invalid-input runs (`3-4d-task1b-runs/run-02`, `-04`, `-06`, `-08`) reproduced the identical bug shape, across both actors and both methods.

**Traced consequence, field by field:**
- **`getPostByUrl`:** none of `item.caption`/`item.text`/`item.description` exist on the error object → `content: ''`. But `item.url` *is* present (the error object echoes the input URL back) → `postUrl` gets set. `publishedAt` falls through to `new Date().toISOString()`. Result: a non-null `ScrapedPost` with empty content. `resolvers.ts:994`'s `if (!scrapedPost) return SCRAPE_FAILED` never fires — a hollow post proceeds into the Gemini extraction pipeline instead.
- **`lookupAccountProfile`:** the fallback chain `item.fullName || item.displayName || item.name || item.username || ''` lands on `item.username` — present, and equal to the garbled input handle. `accountId` resolves the same way. Result: a fully plausible-looking fabricated profile. `resolvers.ts:1434`'s `if (!lookupResult) throw 'not found'` never fires — `castVote` proceeds to `db.insert(socialMediaAccountProfiles)` with fabricated data, and the mutation reports success.

**Confirmed already live, not a future risk:** `sprint-status.yaml` shows **Story 6.1a (`account-vote backend GraphQL API layer`) at `review` status** — already implemented. Its own written AC (epics.md, Story 6.1) states: *"resolves the account's `accountId`/`displayName`/`username`... **never from placeholder handle text**... And if the platform is unsupported or the account can't be found on the platform, I see an error and **no vote/profile is created**."* The confirmed bug does the exact opposite of both clauses. PRD §3.13 states the same requirement independently: *"so the new record never depends on a placeholder or the entered handle text."*

## 1b. Second Issue Summary (added 2026-08-17)

**No Lambda in the stack has an explicit execution timeout.** Confirmed via direct read of `apps/infrastructure/lib/festgrid-backend-stack.ts`: `sharedLambdaProps` (line 77) sets no `timeout` property, and none of `apiLambda`, `scraperLambda`, `aiProcessorLambda`, or `ingestorLambda`'s individual definitions override it either. AWS Lambda's default when unset is 3 seconds. This is an already-live availability defect, not a hypothetical — no real Apify call (even the already-timeout-wrapped `getPostByUrl`, whose own internal 20s timeout can never fire before Lambda itself kills the invocation at 3s) or downstream GraphQL resolver work can complete in production today under this configuration.

**Separately, a design gap:** Apify's `getNewestPosts` role — used for the scheduled-batch fallback (Story 3.4a AC4, when Bright Data is unavailable) and new-account-subscription backfill (Story 3.4 AC6) — is called synchronously today, with no async/webhook handling the way Story 3.4a built for Bright Data. Apify's own actor page states runs can take "a few seconds to a few hours" (already noted in Story 3.4d's epics.md entry). Even a correctly-configured Lambda timeout is bounded by AWS's own hard 900-second (15-minute) ceiling — insufficient for Apify's documented worst case.

**Discovery:** While the original not-found-detection proposal (Section 1) was pending the user's approval, the user asked whether a scheduled batch scrape taking minutes to ~1 hour had been anticipated, then clarified the intended multi-vendor design: Bright Data is scheduled-batch-only; Apify covers scheduled batch (as fallback), vote-time profile check, and subscribe-time — "for scheduled batch we would have same long process but different mechanism." Investigating this directly surfaced the missing-timeout finding above, plus confirmed (via Apify's own API documentation) that Apify supports the same building blocks Story 3.4a already used for Bright Data: ad-hoc per-run webhooks (`webhooks` query parameter at trigger time) and independent run-status polling (`GET /v2/actor-runs/{runId}`).

## 2. Impact Analysis

**Epic Impact:** None at the epic level — Epic 3 (scraper adapters) and Epic 6 (vote feature) both proceed as planned. No epic resequencing, no new/removed epic.

**Story Impact:**
- **Story 3.4d** — AC6/Task 6 (added earlier the same day as this proposal, in response to the same finding) are removed from this story's active scope and carried forward verbatim into a new split-off story. 3.4d's remaining scope (AC1-5, actor selection + timeout) is unaffected. (As of 2026-08-17, a separate `bmad-create-story` pass has already progressed this story to `ready-for-dev` with full task-level detail — this proposal's original recommendation was independently carried out.)
- **Story 3.3c** (`ScraperAdapter` interface) — amended with a contract note (not a signature change): every adapter/method must reliably distinguish "not found" from "found." Forward-looking — protects the still-unimplemented Twitter/X stub adapter (and any future platform) from independently reintroducing the same failure mode.
- **New Story 3.4e** — created to carry the concrete fix, split off 3.4d specifically so it isn't gated behind 3.4d's non-urgent actor-selection work. See Section 4 for full content. (As of 2026-08-17, also already progressed to `ready-for-dev` via a separate `bmad-create-story` pass.)
- **Story 6.1a / 6.1** — no AC changes needed; the fix brings the existing implementation into compliance with ACs already written correctly. No PRD or epics.md edit needed on the 6.1/6.1a side.
- **New Story 3.4f (added 2026-08-17)** — carries the Lambda-timeout fix and Apify async-job-handling extension (Section 1b). Split off rather than folded into 3.4d/3.4a because it combines an urgent, already-live infra defect (the timeout gap) with a genuinely new architectural layer (Apify webhook route + pending-job tracking + sweep extension) — same Gate-1 splitting rationale Story 3.4a itself was split under. Still `backlog`, not yet through its own `bmad-create-story` pass. See Section 4.6.
- **Story 3.4a** (Bright Data) — no AC changes; Story 3.4f explicitly reuses/extends its `L_Webhook` Lambda, webhook route pattern, pending-job tracking, and hourly stale-job sweep rather than duplicating them. Referenced, not modified.

**Artifact Conflicts:**
- **PRD:** none — §3.13 already specifies the correct behavior; the fix implements what's already required, it doesn't change the requirement. Story 3.4f has no PRD-level conflict either (an infra/reliability fix, not a behavior/requirement change).
- **Architecture:** one contract-note addition to Story 3.3c (not a spine-level AD; this is method-contract detail, not a cross-cutting binding invariant). Story 3.4f touches `festgrid-backend-stack.ts` directly (Lambda timeouts, new webhook route) — infra-level, not spine-level; no AD conflict identified.
- **UI/UX:** none for either finding — `castVote`'s error path already has a mapped GraphQL error code (`BAD_REQUEST`); the fix makes that path reachable, it doesn't change the client contract. Story 3.4f has zero UI surface (matching Story 3.4a's own confirmed no-UI-surface precedent).
- **Other artifacts:** `instagram-adapter.test.ts` gains fixture-based not-found test cases (Story 3.4e, Task/AC 4). `festgrid-backend-stack.test.ts` will need a timeout assertion and a new webhook-route assertion (Story 3.4f). No CI impact identified beyond each story's own new/updated tests.

**Technical Impact:** The not-found fix (3.4e) is application-code-only, no schema/migration/infra change — low technical risk, already fully specified from real test evidence. The Lambda-timeout half of 3.4f is a minimal, low-risk CDK change (adding a `timeout` prop) but fixes a currently-live availability defect — high urgency, low effort. The async-Apify-handling half of 3.4f is architecturally larger (new webhook route, pending-job tracking, sweep extension) — moderate technical risk/effort, mitigated by directly reusing Story 3.4a's already-designed pattern rather than inventing a new one.

## 3. Recommended Approach

**Selected: Option 1 (Direct Adjustment) — split two new sub-stories, 3.4e and 3.4f, off Story 3.4d.**

| Option | Viable? | Notes |
|---|---|---|
| 1. Direct Adjustment (modify/add stories) | ✅ Selected | Low effort for 3.4e; moderate for 3.4f's async-handling half — but both are additive, well-scoped, and splitting avoids gating urgent/architectural work behind 3.4d's non-urgent actor-selection optimization. |
| 2. Rollback | Not viable | Nothing to roll back to — neither finding was introduced by a recent story; the timeout gap has existed since Story 0.14/3.4's original CDK stack, the not-found bug predates this story too. |
| 3. PRD MVP Review | Not viable | PRD already specifies correct behavior for the not-found case; the Lambda-timeout/async-Apify finding is an infra/reliability concern the PRD doesn't speak to at all. No scope reduction needed for either. |

**Effort:** Low for 3.4e; Low (timeout fix) + Moderate (async Apify handling) for 3.4f. **Risk:** Low technically for both; the risk of *not* acting is the ongoing one — a live data-integrity defect (3.4e) and a live availability defect plus an unhandled long-running-job failure mode (3.4f).

**Why split rather than fix inside 3.4d:** 3.4d's remaining scope (`getNewestPosts` actor swap already confirmed, sync-path actor pick, timeout handling) is a cost/reliability optimization with no urgency — it's still pending a `bmad-create-story` pass (as of 2026-08-17, that pass has completed and 3.4d is `ready-for-dev`, independently confirming this splitting decision was sound). Bundling either fix inside it would have meant waiting on the slower story's full dev-ready cycle. Splitting let 3.4e go through `bmad-create-story`/`bmad-dev-story` — or `bmad-quick-dev`, given its size — independently and fast (it has since done so, also already `ready-for-dev`).

**Why 3.4f is its own story rather than folded into 3.4e or 3.4a:** Not related to 3.4e's fix at all (different root cause, different files) beyond sharing this proposal's origin. Extends rather than duplicates 3.4a's async-job/webhook/sweep pattern, but is scoped separately because (a) the Lambda-timeout half applies to `apiLambda` too, outside 3.4a's Bright-Data-only scope, and (b) the async-Apify half is a genuinely new consumer of 3.4a's pattern (a second vendor, a second webhook route, a second pending-job correlation scheme) — matching the same Gate-1 "new architectural layer, not an incremental adapter change" reasoning Story 3.4a was itself split under.

## 4. Detailed Change Proposals

### 4.1 `epics.md` — Story 3.3c (amendment added)

```
**Amendment (2026-08-15, Sprint Change Proposal, triggered by Story 3.4d's confirmed
not-found-detection bug):** Added a contract note, not a signature change —
`getPostByUrl` and `lookupAccountProfile` (and any future per-item lookup method
added to this interface) must reliably distinguish "not found" from "found."
[...full text in epics.md]
```

**Rationale:** Protects future adapters (Twitter/X) from independently rediscovering this failure mode.

### 4.2 `epics.md` — Story 3.4d (Amendment 4 added; AC6/Task 6 struck through with cross-reference)

AC6 and the Task 6 entry are marked struck-through with `SPLIT OUT to Story 3.4e` and a pointer to the new story's carried-forward content, rather than deleted outright — preserves the discovery history in place.

### 4.3 `epics.md` — new Story 3.4e added (full content)

Full AS-A/I-WANT/SO-THAT, 5 ACs (not-found check for both methods, field-absence fallback, test fixtures, Twitter/X explicitly out of scope), priority note flagging it as a `bmad-quick-dev` candidate. Depends on Story 3.4 (the adapter it fixes) and Story 3.3c (informational, the contract-note amendment).

### 4.4 `sprint-status.yaml`

- `3-4d-...`: comment updated to record the split and point to this proposal; status unchanged (`backlog`).
- `3-4e-fix-not-found-detection-in-the-instagram-scraper-adapter: backlog` — new entry added, with a comment summarizing the bug, evidence, and elevated-priority/quick-dev note.

### 4.5 Story file `3-4d-per-use-case-actor-selection-and-sync-path-timeout.md`

- AC6 struck through in the Acceptance Criteria list, with a pointer to Story 3.4e.
- Task 6 struck through in Tasks/Subtasks, with a pointer to Story 3.4e.
- Definition of Done and Completion Status updated to reflect the split (not-found detection marked "out of scope, see Story 3.4e" rather than an open item on this story).

### 4.6 `epics.md` — new Story 3.4f added (draft-level, added 2026-08-17)

AS-A/I-WANT/SO-THAT plus a 7-item **draft** AC list ("to be fully detailed when this story is created," matching Story 3.4a's own original split-off convention) — explicit Lambda timeouts for `apiLambda`/`scraperLambda` (with `aiProcessorLambda`/`ingestorLambda`'s identical gap flagged as a scope decision for that future `bmad-create-story` pass, not pre-decided here), plus extending Story 3.4a's async job-trigger/webhook/stale-job-sweep pattern to Apify's `getNewestPosts` role via a new `POST /webhooks/apify` sibling route. Includes a Note recording the two directly-verified facts this story rests on (the stack's missing-timeout confirmation; Apify's documented `webhooks` trigger-time parameter and `GET /v2/actor-runs/{runId}` polling endpoint). Explicitly states `getPostByUrl`/`lookupAccountProfile` (3.4d's sync paths) are unaffected. Depends on Story 3.4, Story 3.4a, Story 3.4d.

**Rationale:** Fixes a currently-live availability defect (undersized default Lambda timeout) and closes a real gap in the multi-vendor scraping design the user clarified (Bright-Data-scheduled-batch-only / Apify-scheduled-batch-fallback-plus-sync-lookups) — without this, a long Apify batch-fallback or new-account-backfill run has no completion path that survives Lambda's own hard ceiling, let alone the currently-misconfigured 3-second one.

### 4.7 `sprint-status.yaml` (added 2026-08-17)

- `3-4f-fix-missing-lambda-timeouts-and-extend-async-job-handling-to-apifys-long-running-scrape-paths: backlog` — new entry, with a comment summarizing both findings and their evidence, and noting this story has not yet been through its own `bmad-create-story` pass.

## 5. Implementation Handoff

**Scope classification: Minor** for Story 3.4e; **Mixed (Minor + Moderate)** for Story 3.4f — the Lambda-timeout half is a minor, low-risk config change, the async-Apify-handling half is a moderate architectural extension of Story 3.4a's already-designed pattern.

**Story 3.4e — routed to:** Developer agent (`bmad-agent-dev` / Amelia), via either:
- `bmad-quick-dev` — recommended given the fix's size and urgency, bypasses the full story pipeline.
- `bmad-create-story 3-4e` → `bmad-dev-story` — if the standard pipeline is preferred for traceability/testing rigor.
- **Status as of 2026-08-17:** already carried out independently — `bmad-create-story 3-4e` has run, story is `ready-for-dev`.

**Story 3.4f — routed to:** Architect/PM agent first, via `bmad-create-story 3-4f`, **not** `bmad-quick-dev` — unlike 3.4e, this story's async-Apify-handling half involves genuine architectural decisions (schema reuse-vs-new-table for pending-job tracking, exact webhook payload verification against a live Apify call, whether to fold `aiProcessorLambda`/`ingestorLambda`'s timeout gap in) that the draft-level AC list in Section 4.6 deliberately leaves open rather than pre-deciding, matching how Story 3.4a itself was handled at the same stage. The Lambda-timeout half (AC1) could reasonably be pulled out and shipped immediately via `bmad-quick-dev` ahead of the rest, given its severity and near-zero risk — flagged here as an option for the user/Developer agent to consider, not decided by this proposal.

**Success criteria — 3.4e:** `instagram-adapter.test.ts` passes new fixture cases (the real `{"error": "not_found", ...}` shape) asserting `getPostByUrl` and `lookupAccountProfile` both return `null`; manual verification that `castVote` with a garbled handle now returns a `BAD_REQUEST` GraphQL error instead of silently creating a `SocialMediaAccountProfile` row.

**Success criteria — 3.4f:** `festgrid-backend-stack.test.ts` asserts explicit, non-default timeouts on `apiLambda`/`scraperLambda`; a real Apify actor run triggered via the new async path completes end-to-end through the `POST /webhooks/apify` route without blocking the triggering Lambda invocation; a simulated lost webhook is recovered by the extended stale-job sweep polling `GET /v2/actor-runs/{runId}` directly.

**Deliverables produced by this proposal:**
- This Sprint Change Proposal document (originally scoped to the not-found bug, amended 2026-08-17 to also cover the Lambda-timeout/async-Apify finding).
- `epics.md`: Story 3.3c amendment, Story 3.4d Amendment 4 + AC6/Task 6 struck through, new Story 3.4e, new Story 3.4f.
- `sprint-status.yaml`: 3-4d comment updated, new 3-4e entry added, new 3-4f entry added.
- `3-4d-per-use-case-actor-selection-and-sync-path-timeout.md`: AC6/Task 6/DoD/Completion Status updated to reflect the split.
- **Note:** As of 2026-08-17, Stories 3.4d and 3.4e have already progressed to `ready-for-dev` via independent `bmad-create-story` passes (confirmed by direct read of their story files and `sprint-status.yaml`) — this proposal's recommendations for those two stories were carried out before this document's own final approval was obtained. Story 3.4f remains `backlog`, not yet drafted beyond the epics.md entry above.

## 6. Approval

**Approved by the user, 2026-08-17** — full, consolidated proposal (Story 3.3c's contract-note amendment, Story 3.4d's Amendment 4, Story 3.4e, and the new Story 3.4f), no conditions attached. Story 3.3c/3.4d/3.4e's portions were already carried out (independent `bmad-create-story` passes, both `ready-for-dev`) prior to this approval; this approval formally closes out this proposal for those two and authorizes Story 3.4f to proceed to its own `bmad-create-story 3-4f` pass per Section 5's routing (with the option, also noted there and not yet decided, to pull AC1's Lambda-timeout fix out for an immediate `bmad-quick-dev` ahead of the rest, given its severity).
