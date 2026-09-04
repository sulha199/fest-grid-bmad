---
backlog_id: CC-017
---

# Sprint Change Proposal — 2026-08-29

**Trigger:** User decision to require viewing an event's detail page before it can be reported, raised directly via `bmad-correct-course` (not tied to a code defect).
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`

---

## Section 1: Issue Summary

Story 4.3b ("Add a Report trigger to `EventCard` (list-view)") was split off Story 4.3 on 2026-08-11 specifically to satisfy PRD 3.9.2's literal text — a 'Report' button "in list-view or detailed view" — by adding a "more actions → Report" affordance directly to list/grid cards (Discovery, Favorites, Feed, Account page), so a user wouldn't have to open an event's full detail view just to report it.

The user has now reversed that premise: **reporting should require viewing the event's detail first**, so a card-level report trigger is no longer wanted. This is a deliberate UX/product decision, not a technical failure or a misunderstanding — it directly narrows PRD 3.9.2's own requirement text, which is the source Story 4.3b was built to satisfy.

**Status check:** Story 4.3b is `ready-for-dev` — no code has been written for it. Nothing needs to be rolled back.

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 4 (in-progress)** only. No other epic is affected. Epic scope, sequencing, and priority are otherwise unchanged.
- Stories 4.3 (detail-view report, `review`) and 4.3a (reports backend, `review`) are both already implemented and are **unaffected** — they were already scoped to the detail view only.
- Story 4.3c (server-side default-visibility exclusion of self-reported events from list *queries*, `review`) is **unaffected** — it governs what happens to an event *after* it's reported (excluding it from future list-query results), regardless of which view the report was filed from. It has no dependency on 4.3b.
- No story depends on 4.3b (`sprint-status.yaml`/`epics.md` grep confirms nothing references it as a prerequisite).

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **4.3b** — Report trigger on `EventCard` (list-view) | `ready-for-dev` (not started) | Cancelled — will not be built |
| 4.3, 4.3a, 4.3c | `review` | Untouched |

### Artifact Conflicts

- **PRD:** Real conflict. §3.9.2 states a 'Report' button is available "in list-view or detailed view" — this is the literal clause Story 4.3b existed to satisfy. Needs a wording correction so the PRD no longer promises a capability the product no longer wants. MVP scope narrows slightly (one fewer entry point to an already-shipped feature) but is not otherwise affected.
- **Architecture:** No conflict — confirmed no reference to Story 4.3b or a card-level report affordance anywhere in `festgrid-architecture-spine.md`.
- **UI/UX:** No conflict — confirmed no reference to a card-level report/overflow-menu pattern in `DESIGN.md` or `EXPERIENCE.md` (Story 4.3b's own Dev Notes made the same finding when it was created).
- **Other artifacts:** None. No infra, no CI, no tests exist for 4.3b to unwind (nothing was started).

### Technical Impact
None — no code exists for this story to remove.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.**

- Effort: **Low** (one story cancelled before any code was written, one PRD sentence corrected).
- Risk: **Low.** No rollback needed. No other story's dependency chain touches 4.3b.
- Rollback (Option 2) isn't applicable — there's nothing built to revert.
- MVP review (Option 3) isn't warranted — this is a targeted narrowing of one requirement clause, not a scope crisis.

---

## Section 4: Detailed Change Proposals

### 4.1 — PRD §3.9.2, opening sentence

```
OLD:
A 'Report' button will be available for all events (whether from Social Media Account
Subscription or the main event discovery page, in list-view or detailed view). Unauthenticated
users will need to log in to access the reporting functionality.

NEW:
A 'Report' button will be available for all events (whether from Social Media Account
Subscription or the main event discovery page), accessible from the event's detailed view.
Reporting is intentionally not available directly from list/grid cards — a user must open an
event's detail view first, ensuring they've reviewed the full event before reporting it.
Unauthenticated users will need to log in to access the reporting functionality.
```

**Rationale:** Removes the "list-view or detailed view" clause that Story 4.3b existed to satisfy, and states the new constraint explicitly rather than leaving it implicit, matching this PRD's existing level of specificity elsewhere in 3.9.2.

---

### 4.2 — `epics.md`: Story 4.3b marked cancelled

```
### Story 4.3b: Add a Report trigger to EventCard (list-view) — CANCELLED

**Cancelled (2026-08-29, via `bmad-correct-course`):** User decision reverses this story's own
premise — reporting now requires viewing an event's detail view first, so a card-level report
trigger is deliberately not wanted. PRD 3.9.2's "list-view or detailed view" clause (the
requirement this story was split off Story 4.3 to satisfy) has been narrowed to detail-view only.
No code was written for this story (`ready-for-dev`, unstarted) — nothing to roll back. Story 4.3's
existing detail-view report flow, Story 4.3a's backend, and Story 4.3c's server-side list-visibility
exclusion are all unaffected. See `sprint-change-proposal-2026-08-29.md`.

<original AC/Note text retained below for history>

[... existing story body unchanged beneath the cancellation notice ...]
```

**Rationale:** Follows this doc's existing convention of appending a dated correction/notice rather than deleting history (see the `4-3a`/`4-6`/`4-7`/`4-8` corrections in `sprint-change-proposal-2026-08-12.md`) — the original design work (Gate 2 placement decision, `AskUserQuestion` tradeoffs) stays visible as a record of what was decided and why it changed, but the heading and a leading notice make it unambiguous this story will not be built.

---

### 4.3 — `sprint-status.yaml`

```
OLD:
  4-3b-add-a-report-trigger-to-eventcard-list-view: ready-for-dev

NEW:
  # cancelled 2026-08-29 via bmad-correct-course: user decision reverses this story's own premise
  # -- reporting now requires viewing an event's detail view first, so a card-level report trigger
  # is deliberately not wanted. PRD 3.9.2's "list-view or detailed view" clause is narrowed to
  # detail-view only. No code was written (was ready-for-dev, unstarted) -- nothing rolled back.
  # Stories 4.3/4.3a/4.3c unaffected. See sprint-change-proposal-2026-08-29.md.
  4-3b-add-a-report-trigger-to-eventcard-list-view: wont-do
```

**Rationale:** `wont-do` is a new terminal status value — this file has no existing precedent for a cancelled-before-started story (every other entry is `backlog`/`ready-for-dev`/`review`/`done`/`in-progress`). Kept as an explicit line (not deleted) so `bmad-sprint-status`/`bmad-help` and future readers see it was deliberately retired, not missed.

---

### 4.4 — `4-3b-add-a-report-trigger-to-eventcard-list-view.md` (implementation-artifacts story file)

- Update `## Story Details` → `**Status:**` from `ready-for-dev` to `wont-do`.
- Add a `## Cancellation` section at the top (mirroring 4.2's notice) so a dev agent that opens this file directly (not just `sprint-status.yaml`) doesn't start implementing it.

**Rationale:** This file is the actual document a `bmad-dev-story` run would load; the status line in `sprint-status.yaml` alone isn't enough of a guardrail if someone opens the story file directly.

---

## Section 5: Implementation Handoff

**Change scope classification: Minor** — cancels one unstarted story and corrects one PRD sentence; no epic restructuring, no architecture change, no rework of shipped code.

- **Product Owner / Developer (Amelia):**
  - Apply the PRD edit (4.1).
  - Apply the `epics.md` cancellation notice (4.2).
  - Update `sprint-status.yaml` (4.3).
  - Update the 4.3b story file's status/cancellation notice (4.4).

**Success criteria:**
- PRD 3.9.2 no longer promises a list-view report entry point.
- `sprint-status.yaml` and the 4.3b story file both clearly show the story is cancelled, not merely stale.
- No other story's status or content changes as a side effect.
