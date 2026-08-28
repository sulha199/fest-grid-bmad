# Sprint Change Proposal — 2026-08-28

## 1. Issue Summary

While investigating a real AI-location-extraction bug (account "Pakuwon Mall Jogja" misgeocoded to Cirebon — root cause: the location-inference prompt has no disambiguating signal when Instagram's own `locationName` tag is absent, traced via `_bmad-output/implementation-artifacts/apify-runs/`), four related gaps in the already-final PRD surfaced:

1. **No confidence gate on AI-inferred Default Location.** Section 3.7 applies every AI inference immediately (same as a human edit); a wrong low-confidence guess (like Pakuwon → Cirebon) reaches subscribers before a moderator ever reviews it.
2. **No moderator pending-item visibility outside the Moderator Items page.** A moderator has no way to know something needs attention without opening the user menu and navigating there.
3. **Hashtags are fully discarded.** The Apify scraper returns a `hashtags` array per post; the codebase never captures it, so a common Indonesian discovery pattern (`#jogjaevent`) is unsearchable — and would also have helped disambiguate the Cirebon bug.
4. **Five EventCategory values are missing** — confirmed by auditing the same `apify-runs` sample data (academic-competition events had no home) plus user-specified gaps (hackathon, career fair, automotive fair) and two promo posts (tech gadget, travel gear) that already have `EventType.PROMOTION` but no matching category.

Item 4 is **already implemented and committed** (`f4ffc5c`) — included here for a single coherent record of everything this investigation produced, not for approval.

## 2. Impact Analysis

- **Epics:** No epic-level restructuring. Items 1–3 land as amendments to existing Epic 3 (Social Media Account Subscription / Moderation) and Epic 1 (Discovery/Search) territory; epics.md FR backfill deliberately deferred to a follow-up `bmad-create-epics-and-stories` pass, matching this PRD's established precedent for prior small amendments.
- **PRD:** Sections 3.1, 3.7, 3.9.3, 4.7, 4.14 amended (items 1–3); Section 4.1 already amended (item 4, done).
- **project-context.md:** Database Indexing rule needs `hashtags` added (item 3).
- **Architecture/DB:** New `posts.hashtags` column + migration (item 3); no new architecture-spine invariant violated — reuses the existing `events` ⋈ `posts` join already present in the search query path.
- **No UX spec exists for this PRD** — n/a.

## 3. Recommended Approach

**Direct Adjustment** for all three open items — modify existing PRD sections and add fields to existing entities; no rollback, no MVP scope reduction. Effort: Low–Medium per item, all independently shippable. Risk: Low — each extends an existing, already-shipped mechanism (moderation queue, search, shared filter type) rather than introducing new subsystems.

## 4. Detailed Change Proposals

### Item 1 — Confidence-gated blocking moderation for AI-inferred Default Location

**PRD §3.7 — "Immediate Apply with Moderator Oversight" bullet**

OLD:
> Editing a "Default Location" takes effect immediately, with no pre-approval gate — extraction is not blocked waiting on review. When a change is made, moderators are notified by email and can, from Moderator Tools (Section 3.9.3), accept the change or revert the account to its previous default location.

NEW:
> Editing a "Default Location" takes effect immediately, with no pre-approval gate — extraction is not blocked waiting on review. When a change is made, moderators are notified by email and can, from Moderator Tools (Section 3.9.3), accept the change or revert the account to its previous default location. This is the default posture for a human edit and for a high-confidence AI inference (see below); a low-confidence AI inference instead requires moderator pre-approval before it applies.

**PRD §3.7 — "AI-Assisted Location Inference" bullet**

OLD (tail sentence):
> The agent's inferred place description is then resolved into full location details (coordinates, formatted address) via the standard geolocation lookup, and the result is written to "Default Location" exactly as a human edit would be — going through the same immediate-apply-with-moderator-oversight flow above, so moderators review an AI-inferred value the same way they review a human one. Which of the two produced a given change is recorded (Section 4.14) so moderators can tell them apart.

NEW (replaces tail sentence):
> The agent's inferred place description is then resolved into full location details (coordinates, formatted address) via the standard geolocation lookup. The inference call also returns a confidence score (0.0–1.0, same scale as `EventInfo.confidenceScore`, Section 4.1). When the score meets or exceeds `LOCATION_INFERENCE_CONFIDENCE_THRESHOLD` (default `0.5`, environment-variable configurable), the result is written to "Default Location" immediately, going through the same immediate-apply-with-moderator-oversight flow above. When the score falls below the threshold, the inferred value is **not** applied — it is held as an `AWAITING_APPROVAL` request (Section 4.14) that a moderator must explicitly approve or reject from Moderator Tools (Section 3.9.3) before it ever reaches `SocialMediaAccountProfile.defaultLocation`; the account's Default Location stays unset (or keeps its prior value) in the meantime, so extraction never runs against an unvetted guess. Which of the two produced a given change, and whether it required pre-approval, is recorded (Section 4.14) so moderators can tell them apart.

**PRD §3.7 — closing "> Note:" callout** — append: `LOCATION_INFERENCE_CONFIDENCE_THRESHOLD=0.5` (score 0.0–1.0) for gating low-confidence AI-inferred Default Location changes to pre-approval.

**PRD §4.14 — `DefaultLocationChangeRequest`**

- `DefaultLocationChangeStatus` gains two members:
  - `AWAITING_APPROVAL` — not yet applied; a low-confidence AI inference sits here until a moderator acts.
  - `REJECTED` — a moderator rejected an `AWAITING_APPROVAL` request; distinct from `REVERTED`, which undoes a change that *was* already applied.
- New field `confidenceScore?: number` — populated only when `changeSource: AI_INFERENCE`.
- Doc comment: "The change applies immediately on write" caveated — untrue for `AWAITING_APPROVAL` records, where `newLocation` is a proposal only until approved.
- The existing SUPERSEDED rule broadens from "every other still-`PENDING_REVIEW` record" to "every other still-`PENDING_REVIEW` or still-`AWAITING_APPROVAL` record."

**PRD §3.9.3** — Moderator Tools bullet gains a clause: Moderator Items now shows both post-hoc `PENDING_REVIEW` items (accept/revert) and pre-hoc `AWAITING_APPROVAL` items (approve/reject), visually distinguished.

---

### Item 2 — Moderator pending-item count badge

**PRD §3.9.3** — new bullet:

> **Moderator Pending-Item Badge:** For users with moderator access, a numeric badge shows the combined count of items awaiting moderator action — pending reports (Section 3.9.2), and Default Location changes in `PENDING_REVIEW` or `AWAITING_APPROVAL` status (Section 3.7/4.14) — in two places: next to the "Moderator Items" entry inside the opened user menu, and on the user's avatar in the navbar when the menu is closed. The badge shows one combined total, not a per-category breakdown; opening Moderator Items itself provides that detail. The count is kept reasonably current (refreshed periodically or on relevant navigation), not necessarily instantaneous.

---

### Item 3 — Hashtag capture and `#`-prefixed hashtag search

**PRD §4.7 — `Post` interface** — new field:

> `hashtags?: string[]` — The hashtags attached to the post, as returned by the scraper adapter. Used for `#`-prefixed hashtag search (Sections 3.1, 3.7); may also inform AI extraction as a secondary location/category signal in a future pass.

**PRD §3.1 — "Search and Filter" bullet** — append: "When a search phrase starts with `#`, it matches exactly against a post's hashtags instead of event-name/performers/location — e.g. `#jogjaevent` matches the literal hashtag, not a substring. Hashtag search combines with type/category filters the same way normal search does."

**PRD §3.7 — "Search and Filter" bullet** (Display Subscribed Events) — same `#`-prefix clause appended, for parity with §3.1.

**project-context.md — Database Indexing rule** — OLD: "...includes columns for `eventName`, `performers`, `location`, `types`, and `categories`." NEW: "...includes columns for `eventName`, `performers`, `location`, `types`, `categories`, and `hashtags` (a GIN index, not a plain btree, since hashtag search is array-containment on an exact value rather than a substring `ILIKE`)."

**Architecture note (not PRD prose, implementation detail):** reuses the existing `events` ⋈ `posts` LEFT JOIN already present in the search query path (`resolvers.ts`) — add `hashtags` to the `fieldMap` pointing at `posts.hashtags`, extend `buildEventsQueryCondition` to route a leading `#` to an array-containment condition instead of the OR-group `ilike` conditions. New Drizzle column `hashtags: text('hashtags').array()` on `posts`, mirroring `events.types`/`events.categories`.

## 5. Implementation Handoff

- **Scope: Minor** for all three items — each is a direct PRD/schema amendment implementable without backlog reorganization, matching this project's precedent of folding small amendments straight into `prd.md` rather than a full `bmad-create-epics-and-stories` pass.
- **Route to:** Developer agent (direct implementation), same pattern as item 4 and the `RELIGION_AND_SPIRITUALITY` precedent.
- **Deferred, not skipped:** epics.md FR backfill for items 1–3 (new FR numbers), consistent with this PRD's established deferral pattern for amendments of this size.
- **Success criteria:** PRD sections read coherently with the rest of the document (cross-references resolve, terminology matches); schema changes pass existing test suites; no regression in existing Moderator Items / search behavior.
