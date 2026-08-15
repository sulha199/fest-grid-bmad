# Sprint Change Proposal: Not-Found Detection Bug in Scraper Adapter

- **Date:** 2026-08-15
- **Trigger:** Story 3.4d, Task 1b (valid/invalid-input testing of `getPostByUrl`/`lookupAccountProfile`)
- **Mode:** Incremental

## 1. Issue Summary

Neither `getPostByUrl` nor `lookupAccountProfile` (`apps/backend/src/lib/scraper/instagram-adapter.ts`) can distinguish "this post/account doesn't exist" from "this post/account exists." Both Apify actors tested (`apify/instagram-api-scraper`, `apify/instagram-post-scraper`) return a **truthy 1-item array** for genuinely invalid input — `{"url": ..., "username": ..., "error": "not_found", "errorDescription": "Post does not exist"}` — not an empty array. The adapter's existing `if (!items || items.length === 0) return null` guard never fires, since `items.length === 1`.

**Discovery:** While testing Story 3.4d's sync-path actor comparison (Task 1b), the plan was revised from "3x-repeat a valid call" to "test valid vs. invalid input," on the reasoning that both `getPostByUrl` and `lookupAccountProfile` have an untested correctness dependency on not-found detection (`resolvers.ts:994`, `resolvers.ts:1434`). All 4 invalid-input runs (`3-4d-task1b-runs/run-02`, `-04`, `-06`, `-08`) reproduced the identical bug shape, across both actors and both methods.

**Traced consequence, field by field:**
- **`getPostByUrl`:** none of `item.caption`/`item.text`/`item.description` exist on the error object → `content: ''`. But `item.url` *is* present (the error object echoes the input URL back) → `postUrl` gets set. `publishedAt` falls through to `new Date().toISOString()`. Result: a non-null `ScrapedPost` with empty content. `resolvers.ts:994`'s `if (!scrapedPost) return SCRAPE_FAILED` never fires — a hollow post proceeds into the Gemini extraction pipeline instead.
- **`lookupAccountProfile`:** the fallback chain `item.fullName || item.displayName || item.name || item.username || ''` lands on `item.username` — present, and equal to the garbled input handle. `accountId` resolves the same way. Result: a fully plausible-looking fabricated profile. `resolvers.ts:1434`'s `if (!lookupResult) throw 'not found'` never fires — `castVote` proceeds to `db.insert(socialMediaAccountProfiles)` with fabricated data, and the mutation reports success.

**Confirmed already live, not a future risk:** `sprint-status.yaml` shows **Story 6.1a (`account-vote backend GraphQL API layer`) at `review` status** — already implemented. Its own written AC (epics.md, Story 6.1) states: *"resolves the account's `accountId`/`displayName`/`username`... **never from placeholder handle text**... And if the platform is unsupported or the account can't be found on the platform, I see an error and **no vote/profile is created**."* The confirmed bug does the exact opposite of both clauses. PRD §3.13 states the same requirement independently: *"so the new record never depends on a placeholder or the entered handle text."*

## 2. Impact Analysis

**Epic Impact:** None at the epic level — Epic 3 (scraper adapters) and Epic 6 (vote feature) both proceed as planned. No epic resequencing, no new/removed epic.

**Story Impact:**
- **Story 3.4d** — AC6/Task 6 (added earlier the same day as this proposal, in response to the same finding) are removed from this story's active scope and carried forward verbatim into a new split-off story. 3.4d's remaining scope (AC1-5, actor selection + timeout) is unaffected.
- **Story 3.3c** (`ScraperAdapter` interface) — amended with a contract note (not a signature change): every adapter/method must reliably distinguish "not found" from "found." Forward-looking — protects the still-unimplemented Twitter/X stub adapter (and any future platform) from independently reintroducing the same failure mode.
- **New Story 3.4e** — created to carry the concrete fix, split off 3.4d specifically so it isn't gated behind 3.4d's non-urgent actor-selection work. See Section 4 for full content.
- **Story 6.1a / 6.1** — no AC changes needed; the fix brings the existing implementation into compliance with ACs already written correctly. No PRD or epics.md edit needed on the 6.1/6.1a side.

**Artifact Conflicts:**
- **PRD:** none — §3.13 already specifies the correct behavior; the fix implements what's already required, it doesn't change the requirement.
- **Architecture:** one contract-note addition to Story 3.3c (not a spine-level AD; this is method-contract detail, not a cross-cutting binding invariant).
- **UI/UX:** none — `castVote`'s error path already has a mapped GraphQL error code (`BAD_REQUEST`); the fix makes that path reachable, it doesn't change the client contract.
- **Other artifacts:** `instagram-adapter.test.ts` gains fixture-based not-found test cases (Story 3.4e, Task/AC 4). No infra, deployment, or CI impact.

**Technical Impact:** Application-code-only fix, no schema/migration/infra change. Low technical risk, well-scoped, already fully specified from real test evidence.

## 3. Recommended Approach

**Selected: Option 1 (Direct Adjustment) — split a new sub-story, 3.4e, off Story 3.4d.**

| Option | Viable? | Notes |
|---|---|---|
| 1. Direct Adjustment (modify/add stories) | ✅ Selected | Low effort — fix is small and fully specified; splitting avoids gating an urgent correctness fix behind a non-urgent optimization story. |
| 2. Rollback | Not viable | Nothing to roll back to — this bug predates this story; no recent story introduced it. |
| 3. PRD MVP Review | Not viable | PRD already specifies correct behavior; no scope reduction needed. |

**Effort:** Low. **Risk:** Low technically; the risk of *not* acting is the ongoing one (live data-integrity defect).

**Why split rather than fix inside 3.4d:** 3.4d's remaining scope (`getNewestPosts` actor swap already confirmed, sync-path actor pick, timeout handling) is a cost/reliability optimization with no urgency — it's still pending a `bmad-create-story` pass. Bundling the urgent fix inside it means the fix waits on the slower story's full dev-ready cycle. Splitting lets Story 3.4e go through `bmad-create-story`/`bmad-dev-story` — or `bmad-quick-dev`, given its size — independently and fast.

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

## 5. Implementation Handoff

**Scope classification: Minor.** Story 3.4e is a small, fully-specified, application-code-only fix with no schema/architecture/PRD change — implementable directly by a Developer agent.

**Routed to:** Developer agent (`bmad-agent-dev` / Amelia), via either:
- `bmad-quick-dev` — recommended given the fix's size and urgency, bypasses the full story pipeline.
- `bmad-create-story 3-4e` → `bmad-dev-story` — if the standard pipeline is preferred for traceability/testing rigor.

**Success criteria:** `instagram-adapter.test.ts` passes new fixture cases (the real `{"error": "not_found", ...}` shape) asserting `getPostByUrl` and `lookupAccountProfile` both return `null`; manual verification that `castVote` with a garbled handle now returns a `BAD_REQUEST` GraphQL error instead of silently creating a `SocialMediaAccountProfile` row.

**Deliverables produced by this proposal:**
- This Sprint Change Proposal document.
- `epics.md`: Story 3.3c amendment, Story 3.4d Amendment 4 + AC6/Task 6 struck through, new Story 3.4e.
- `sprint-status.yaml`: 3-4d comment updated, new 3-4e entry added.
- `3-4d-per-use-case-actor-selection-and-sync-path-timeout.md`: AC6/Task 6/DoD/Completion Status updated to reflect the split.
