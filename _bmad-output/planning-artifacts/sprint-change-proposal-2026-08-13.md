---
backlog_id: CC-009
---

# Sprint Change Proposal — 2026-08-13

**Trigger:** Two post-implementation scope gaps discovered on review for Epic 3: onboarding-form completion and retry behavior for newly-subscribed accounts. Both were explicitly routed through `bmad-correct-course` rather than ad-hoc code edits.
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`

---

## Section 1: Issue Summary

This proposal resolves two already-verified gaps in the shipped Epic 3 work:

1. **Onboarding list-display, form-reset, and uniqueness gaps (Stories 3.1b and 3.2)**
   - The onboarding key step already clears the input and updates the `GetMyApiKeys` cache after create, but it never renders a list of keys and there is no visible list on the subscribe step either.
   - The subscribe step does not reset `platform` / `handleInput` after a successful subscribe and never renders a visible list of subscriptions on that screen.
   - Duplicate social-account subscriptions are already handled by the lookup-or-create logic (`alreadySubscribed: true`), so this proposal does not reopen that behavior.
   - Duplicate API keys are not yet handled, and the design choice was explicitly confirmed via `AskUserQuestion`: use the current deterministic encryption path and reject duplicates at the API layer with a clear GraphQL error rather than adding a separate `keyHash` column unless the encryption proves non-deterministic. This keeps the fix small and aligns with the existing security model.

2. **Scraper incremental-window retry + duplicate-avoidance (Story 3.4)**
   - Story 3.4's shipped behavior uses one attempted scrape window per account per run: `newerThan = MAX(posts.publishedAt)` or `now - SCRAPE_INITIAL_LOOKBACK_DAYS`.
   - The user confirmed an incremental retry loop only for the on-demand, newly-subscribed-account path; the scheduled daily batch path is unchanged.
   - The retry loop should accept overlap billing (Apify bills on items returned, not unique-new items), while stopping once the total returned count or unique-new count reaches the chosen threshold. The user confirmed this design via `AskUserQuestion` and explicitly rejected a broader daily-batch retry policy.

These corrections are not redesigns. They close concrete review findings and preserve the project’s existing code patterns, security model, and Epic 3 sequencing.

### Mandatory references used
- [_bmad-output/project-context.md](_bmad-output/project-context.md)
- [_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md](_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md)
- Story files reviewed in full before drafting this proposal:
  - [_bmad-output/implementation-artifacts/3-1b-manage-and-revoke-api-keys.md](_bmad-output/implementation-artifacts/3-1b-manage-and-revoke-api-keys.md)
  - [_bmad-output/implementation-artifacts/3-2-subscribe-to-a-social-media-account.md](_bmad-output/implementation-artifacts/3-2-subscribe-to-a-social-media-account.md)
  - [_bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md](_bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md)

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 3** is affected in a narrow, contained way.
- This proposal does not re-plan the epic or alter the MVP goal; it reopens already-reviewed stories and tightens their acceptance criteria to match the shipped implementation and the confirmed product decisions.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **3.1b** — Manage and revoke API keys | `review` | Reopened for list rendering, form reset validation, and duplicate-key rejection rule |
| **3.2** — Subscribe to a social media account | `review` | Reopened for list rendering, form reset behavior, and final confirmation of duplicate-subscription behavior |
| **3.4** — Scrape new posts from subscribed accounts | `review` | Reopened for retry-loop scope and the per-run stop conditions |

No other stories are invalidated. Existing shipped behavior for account dedupe and the stored-post dedupe logic remains intact.

### Artifact Conflicts
- **PRD:** No direct conflict. The PRD already describes the user-controlled subscription and BYOK behavior; the missing details are UI completeness and the operational retry design, which this proposal makes explicit without changing the MVP goal.
- **Architecture:** No structural conflict. The design stays within the current GraphQL + database + scraper-adapter patterns already used across the epic.
- **UI/UX:** Some onboarding flows already have the state-update logic but are missing the visible list/clear-form behavior. This is a direct UI completeness fix, not a new interaction model.
- **Technical Impact:** Small backend and frontend adjustments only; no new foundational infrastructure is required.

### Technical Impact
- **Story 3.1b**: add explicit duplicate-key validation at the API layer, ensure the create mutation still updates the list cache correctly, and surface the just-added key in a visible list with proper reset behavior.
- **Story 3.2**: ensure successful subscribe resets the form and renders the newly added account in the visible subscription list.
- **Story 3.4**: add an incremental retry loop only on the new-subscribe, on-demand path; no change to the daily batch schedule or its existing `SCRAPE_SKIP_RECENT_HOURS` logic.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.**

- Effort: **Low–Medium**.
- Risk: **Low**. These are all additive clarifications to stories already in review, with no architectural redesign or rollback needed.
- Rollback is not warranted because the issues are narrow and already localized to the relevant onboarding and scraper code paths.
- MVP review is not warranted because the change does not reduce scope or alter the product’s core goals; it only makes the shipped behavior complete and explicitly testable.

---

## Section 4: Detailed Change Proposals

### 4.1 — Story 3.1b: Add missing visibility and duplicate-key guard

**Proposed revision to Story 3.1b Acceptance Criteria**

```
**Updated AC 4 (reopened via bmad-correct-course):**
**And** submitting the add-key form calls `createApiKey(input: CreateApiKeyInput!): ApiKey!`...

**And** when the create succeeds, the new key is listed in the visible API-key list immediately without a full page reload, and the form is reset to a clean, empty state.

**And** duplicate API keys are rejected at the API layer via a clear GraphQL error when the current encryption path is deterministic for the same normalized key value; the system does not silently merge, and it does not add a second `keyHash` column unless a follow-up investigation shows the encryption is not deterministic.

**And** if the same key already exists for the current user or for another user under the same deterministic-encryption policy, the mutation returns `extensions.code = 'DUPLICATE_API_KEY'` (or the project’s existing validation convention for duplicates), preserving the user-visible list as a single source of truth.
```

**Rationale:** This matches the confirmed design decision and closes the actual gap: the key create flow already patches the cache, but it never presents the newly created key in a visible list.

---

### 4.2 — Story 3.2: Reset and list the newly subscribed account

**Proposed revision to Story 3.2 Acceptance Criteria**

```
**Updated AC 5 (reopened via bmad-correct-course):**
**And** I see the new subscription appear in my list of subscriptions without a full page reload, and the form resets to its default values on success.

**Updated AC 7 (clarifying the current shipped behavior):**
**And** the "already subscribed to this account" check, as implemented by the existing `subscribeToAccount` lookup-or-create logic, returns `alreadySubscribed: true` and does not throw an error; the user still sees the existing account in the list and the form is left in a clean state after the handled duplicate path.

**And** the subscription list on this page visibly includes the account just added, not only a boolean status banner or a hidden mutation result.
```

**Rationale:** This captures the verified implementation behavior: duplicate account subscriptions are already handled upstream and the missing feature is the visible list + reset state on the screen itself.

---

### 4.3 — Story 3.4: Retry loop only on first-time new-subscribe path

**Proposed revision to Story 3.4 Acceptance Criteria**

```
**Updated AC 3 (reopened via bmad-correct-course):**
**And** for an account that is being scraped through the on-demand, brand-new-subscribe path, the system retries with progressively wider lookback windows (`3d`, `7d`, `10d`, `14d`, `17d`, `21d`, `24d`, `27d`, `30d` hard cap) until either:
- the total number of returned posts (including overlapping returns from earlier retries) reaches 15, or
- the number of unique posts not already seen in this same run reaches 10,
whichever condition is hit first.

**And** the daily scheduled batch path does not run this retry loop; it continues to use the existing single-window logic already in place.

**Updated AC 5 (clarifying the cost model):**
**And** because Apify charges per item returned rather than per new item, the retry loop accepts overlap billing across retries within the same run; it does not attempt a server-side `between` filter because the provider supports only `onlyPostsNewerThan` and no documented upper-bound filter. The loop still checks the existing `SCRAPER_CAPACITY_THRESHOLD_RATIO` gate before each real provider call and exits early if the provider has reached capacity.
```

**Rationale:** This resolves the user-confirmed behavior: on-demand path only, wider-window incremental retry, accept overlap billing, and stop once meaningful return thresholds are reached without changing the daily batch footprint.

---

### 4.4 — Story 3.4: same-run dedupe remains a data-integrity guarantee, not a billing mechanism

**Proposed additional note to the Story 3.4 Dev Notes**

```
**Confirmed design decision (2026-08-13 via AskUserQuestion):**
A `between` filter is not required for correctness because `persistScrapedPost` already deduplicates by `post_url`, preventing duplicate rows from landing in the database even when retry windows overlap. The retry loop therefore optimizes for returning enough data in a bounded set of calls while accepting the fact that Apify will continue to bill for overlapping items returned in earlier attempts within the same run.
```

**Rationale:** This matches the user’s confirmed direction and avoids re-litigating the vendor limitation when the real issue is billing efficiency versus correctness.

---

## Section 5: Implementation Handoff

**Change scope classification: Moderate** — a small re-open of existing review stories, but no large re-plan or architecture change.

### Handoff recipients
- **Developer agent**: implement the reopened AC changes for Stories 3.1b, 3.2, and 3.4.
- **Product/PM check**: optional pass only if a final review of acceptance wording is desired, but no scope renegotiation is required.

### Deliverables
- Updated story acceptance criteria for the three affected stories as listed above.
- Backend/API validation for duplicate API keys using the confirmed deterministic-encryption approach.
- Frontend list rendering + form reset on the onboarding flows.
- Incremental retry loop for the on-demand new-subscribe path only, with explicit stop conditions and capacity recheck.

### Success criteria
- The onboarding list view shows the newly added API key and newly subscribed account immediately after successful mutation.
- The form resets on success for both onboarding flows.
- Duplicate API-key attempts reject with a clear GraphQL error instead of silently merging.
- Duplicate social-account subscription attempts remain handled as `alreadySubscribed: true` without error.
- The new-subscribe path retries with wider windows only when appropriate, stops at the confirmed thresholds, and respects the existing capacity gate without changing the daily batch path.

---

## Section 6: Workflow Completion Summary

- **Issue addressed:** onboarding list-display/reset gaps and the incremental retry design for Story 3.4.
- **Change scope:** Moderate.
- **Artifacts affected:** Stories 3.1b, 3.2, and 3.4; no PRD rewrite required.
- **Routed to:** Developer agent for implementation followed by a focused review pass.

This proposal resolves both open design questions via `AskUserQuestion` and keeps the implementation aligned with the confirmed product direction already captured in the Epic 3 stories and the project’s required project context and PRD references.
