# Sprint Change Proposal — 2026-08-12

**Trigger:** User-reported gap in the reporting/moderation feature, raised directly via `bmad-correct-course` (not tied to a single in-flight story).
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`

---

## Section 1: Issue Summary

Two behavior gaps were raised for the event-reporting feature (Epic 4):

1. **"If a user reports an event, that event immediately becomes hidden from that reporting user, regardless of moderator status."**
2. **"If a report's reason is 'personal', it doesn't need moderation — assume it's solved by the moderator."**

Investigation of the actual code (not just planning docs) found:

- **#1 is half-built.** `Event.isHiddenForCurrentUser` (`apps/backend/src/schema/resolvers.ts:1627-1637`) already computes the correct condition — `true` for *any* report the caller filed, *any* reason, *any* status — per Story 4.3a's 2026-08-11 correction. But only the event **detail view** (`apps/web/src/features/events/EventDetailWrapper.tsx:178`) reads this field. The plural `events` query that powers Discovery, Feed, Favorites, My Calendar, and search never selects or filters on it (`apps/web/.../queries.graphql:1-22`), so a self-reported event keeps appearing in every list view except its own detail page. Notably, **Story 2.7 already anticipated this exact rule**: its AC describes the default-visibility mechanism as "an extensible, ordered list of rule-conditions... so that future rules (moderator soft-delete, **personal report-hide**) can each be added as one more list entry later" (epics.md:1461) — that extension point was built but never used for reports.
- **#2 is unbuilt.** `submitReport` (`resolvers.ts:1057-1063`) always inserts `status: 'pending'`, with no branch for `reason: 'personal'`. The moderator-only `reportedEvents` query (`resolvers.ts:1208-1226`) has no filtering to keep personal reports out of the "needs attention" queue. This isn't yet user-visible only because Story 4.7 (Moderator Items page, the query's one real consumer) hasn't been built yet — `ready-for-dev`, not started.

Both are corrected before they cause real user-facing bugs (personal reports cluttering a moderator's queue; reported events reappearing in lists).

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 4 (in-progress)** only. No other epic is affected. Epic scope, sequencing, and priority are unchanged — this is corrective work inside the epic's existing story set, not a re-plan.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **4.3a** — reports backend API layer | `review` | Reopened: `submitReport` needs a `personal`-reason branch; new `ReportStatus` enum value + migration |
| **4.6** — User's Reports page | `review` | Reopened: `StatusBadge` needs to render the new status value |
| **4.7** — Moderator Items page | `ready-for-dev` (not started) | AC amended before any code is written — cheapest possible timing |
| **4.8** — Archive page | `backlog` (not started) | Doc-only wording fix (stale "Personal report hides" reference) |
| **4.3c** *(new)* — extend default visibility to hide self-reported events from lists | n/a | New story, added to close gap #1 |

No story is rolled back or invalidated; Stories 4.3, 4.3b, 4.4, 4.4a, 4.5 are untouched.

### Artifact Conflicts

- **PRD:** No conflict — PRD §3.9.2 already documents each reason ("Cancelled"/"Dangerous"/"Personal") as immediately hiding the event for the reporter, and never states personal reports need moderator review. One clarifying addition is proposed (PRD doesn't currently *state* the moderation-exemption anywhere, so it's worth capturing), but it's additive, not corrective. MVP scope is unaffected.
- **Architecture:** No conflict. `buildDefaultEventVisibilityConditions` (`packages/domain/src/events/`) is the designed extension point for exactly this; using it as intended requires no architectural change, just a new rule + a corresponding `QueryCondition`→Drizzle translation for a `NOT EXISTS`-shaped condition (a schema addition, not a pattern change).
- **UI/UX:** No UX artifact conflict. No new screens or flows — `StatusBadge` needs one more variant color/label (Story 4.6 already built the variant-union extension pattern this reuses).
- **Other artifacts:** One DB migration (new `report_status` enum value). No IaC/CI/deployment impact.

### Technical Impact
- Backend: `submitReport` resolver branch, `report_status` enum migration + `reports.graphql` SDL update + codegen, new default-visibility rule condition (packages/domain) wired into the `events` list resolver only (not singular `event`/`eventBySlug` lookups, so detail-view deep-links to a self-reported event still resolve and still show the existing "you reported this" state).
- Frontend: `StatusBadge` variant addition (Story 4.6); **no change needed for list views** — once the resolver excludes the row, existing list components render correctly with zero client-side filtering, consistent with Story 2.7's "never a client-side/post-fetch filter" rule.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.**

- Effort: **Low–Medium** (one new backend rule condition + DSL case, one enum value + migration, one resolver branch, one UI variant, no new tables, no new pages).
- Risk: **Low.** Both reopened stories (4.3a, 4.6) are additive amendments to already-built code, not redesigns. Story 4.7 is amended before any implementation exists, so there's nothing to unwind there.
- Rollback (Option 2) isn't warranted — nothing needs to be reverted, only extended.
- MVP review (Option 3) isn't warranted — no scope reduction or goal change; this closes a gap inside already-planned MVP behavior (PRD §3.9.2's own stated requirements).

---

## Section 4: Detailed Change Proposals

### 4.1 — `epics.md`: New Story 4.3c (insert after Story 4.3b, before Story 4.4a)

```
### Story 4.3c: Extend default event-visibility rules to exclude self-reported events from list views

**As a** developer,
**I want** the events list resolver's default-visibility rule chain (Story 2.7) to exclude any
event the requesting user has personally reported, of any reason and regardless of resolution
status,
**So that** Discovery, Feed, Favorites, My Calendar, and search results stop surfacing events a
user has already told the platform they don't want to see — closing the gap where
`isHiddenForCurrentUser` (Story 4.3a) is computed correctly but only consumed by the event detail
view.

**Acceptance Criteria:**

*   **Given** Story 2.7's `buildDefaultEventVisibilityConditions`
    (`packages/domain/src/events/buildDefaultEventVisibilityConditions.ts`) already returns an
    ordered list of rule-conditions AND'd into every plural `events` query
    (Discovery/Feed/Favorites/My Calendar/search, `resolvers.ts:1355`/`1436-1439`) — the exact
    extension point its own AC anticipated ("future rules... personal report-hide... can each be
    added as one more list entry"),
*   **When** the authenticated caller's user ID is known (unauthenticated callers have no reports
    and are unaffected),
*   **Then** a new rule-condition excludes any event with a `reports` row where
    `reporter_user_id` equals the caller's ID — any `reason` (cancelled/dangerous/personal),
    regardless of `status` — mirroring `isHiddenForCurrentUser`'s (Story 4.3a) existing "any
    report, any status" semantics exactly, implemented as a `NOT EXISTS` condition (new
    `QueryCondition` field/operator, or an equivalent addition to the Drizzle where-builder that
    consumes the DSL) rather than a post-fetch filter, consistent with Story 2.7's "never a
    client-side/post-fetch filter" rule.
*   **And** this rule applies only to the plural `events` list query — the singular
    `event(id)`/`eventBySlug(slug)` lookups (`resolvers.ts:1532`/`1548`) remain unfiltered by it,
    so Story 4.3's existing detail-view "you reported this" (`isHiddenForCurrentUser`) messaging
    keeps working for direct/deep-link access.
*   **And** no frontend change is required: list-view components already render whatever the
    `events` query returns, so hiding happens transparently once the resolver excludes the row.

**Note:** Added 2026-08-12 via `bmad-correct-course`. Story 2.7 built the extensible
default-visibility mechanism explicitly anticipating this rule, and Story 4.3a already computes
the correct "any reason, any status" hide condition as a per-event field — but no story ever
connected the two for list queries, so a self-reported event kept appearing in every list view
except the one page that reads `isHiddenForCurrentUser` directly. User-reported gap via
`bmad-correct-course`, 2026-08-12 (see `sprint-change-proposal-2026-08-12.md`).

**Depends on:** Story 2.7, Story 4.3a.
```

**Rationale:** Uses the extension point Story 2.7 was explicitly designed to provide, keeps the fix server-side (no client filtering), and doesn't touch the detail-view behavior that already works correctly.

---

### 4.2 — `epics.md`: Correction appended to Story 4.3a

```
**Correction (2026-08-12, via `bmad-correct-course`):** `submitReport`'s insert
(`resolvers.ts:1057-1063`) currently sets `status: 'pending'` unconditionally, regardless of
`reason`. Per PRD 3.9.2, a `personal`-reason report never requires moderator action — the entire
effect of the report (hiding the event from that user) already happens automatically via
`isHiddenForCurrentUser`, so leaving it `pending` would incorrectly surface it in Story 4.7's
moderator queue and misrepresent its status on Story 4.6's My Reports page. AC revised:
`submitReport` sets `status: 'auto_resolved'` (new fourth `ReportStatus` enum value — DB enum
migration + `reports.graphql` SDL update required) and `resolvedAt: now()` when
`reason === 'personal'`; `resolvedByModeratorId` stays `null` since no moderator acted.
`cancelled`/`dangerous` reports are unaffected and still insert as `pending`. Confirmed with the
user via `AskUserQuestion` during `bmad-correct-course`: a new distinct status value (over reusing
`dismissed`) so "auto-resolved, no review needed" reads unambiguously differently from "a
moderator reviewed and dismissed this."
```

**Rationale:** `dismissed` already carries the connotation "a moderator looked at this and decided against action" (`resolveReport`'s `ReportOutcome`). Reusing it for reports no moderator ever saw would make the audit trail lie. A fourth enum value keeps `resolvedByModeratorId: null` + `status: auto_resolved` an unambiguous, queryable signal.

---

### 4.3 — `epics.md`: Correction appended to Story 4.6

```
**Correction (2026-08-12, via `bmad-correct-course`):** `packages/ui/src/core/status-badge.tsx`'s
variant union (already extended by this story to `pending`/`upheld`/`dismissed`) must additionally
support the new `auto_resolved` `ReportStatus` value (Story 4.3a's 2026-08-12 correction) so a
personal report renders a real label (e.g. "Resolved") on the My Reports page instead of falling
through to an unstyled/unknown badge.
```

---

### 4.4 — `epics.md`: Correction appended to Story 4.7 (not yet started)

```
**Correction (2026-08-12, via `bmad-correct-course`):** The moderator-attention `reportedEvents`
query (Story 4.3a) accepts optional `status`/`reason` filters but has no enforced default. AC
revised: this page's default (unfiltered-by-the-moderator) view must call
`reportedEvents(status: PENDING)` explicitly, so `personal`-reason reports — which Story 4.3a's
2026-08-12 correction now auto-resolves to `auto_resolved` at submission — and any already-
`upheld`/`dismissed` report never appear in the "requires my attention" list. A moderator may
still explicitly filter by `reason: personal` or any `status` for audit/history purposes; only the
default view is scoped.
```

---

### 4.5 — `epics.md`: Story 4.8 wording fix

```
OLD: "...have been hidden by the platform's default visibility rules (expired past events,
moderator soft-deletes, my own "Personal" report hides)..."

NEW: "...have been hidden by the platform's default visibility rules (expired past events,
moderator soft-deletes, events I've reported for any reason — Story 4.3a's 2026-08-11 correction
broadened this from personal-only)..."
```

**Rationale:** Story 4.8's description still reflects the pre-correction "personal-only" hide scope; this just realigns it with what 4.3a (and now 4.3c) actually implement.

---

### 4.6 — PRD §3.9.2, "Reason: Personal" bullet

```
OLD:
    *   **Reason: Personal:**
        *   The reporting user will immediately no longer see the event. This action only
            affects the individual user's view and does not impact the event's visibility for
            other users.

NEW:
    *   **Reason: Personal:**
        *   The reporting user will immediately no longer see the event. This action only
            affects the individual user's view and does not impact the event's visibility for
            other users.
        *   This action requires no moderator review — the report is automatically marked
            resolved at submission and never appears in a moderator's pending queue.
```

**Rationale:** The PRD never actually stated the moderation-exemption anywhere; this closes that gap at the source of truth rather than leaving it implicit in epics.md only.

---

### 4.7 — `sprint-status.yaml`

- Add comment above `4-3a-...`: reopened via `bmad-correct-course` 2026-08-12, status stays `review` (additive amendment, not a redo) — consistent with this project's existing precedent (Stories 0.18, 2.3a, 2.4).
- Add comment above `4-6-...`: same, reopened for the `StatusBadge` addition, status stays `review`.
- Add comment above `4-7-...`: AC amended, status stays `ready-for-dev` (unstarted, no rework caused).
- Insert new entry after `4-3b-...`: `4-3c-extend-default-event-visibility-rules-to-exclude-self-reported-events-from-list-views: backlog`, with a comment referencing this proposal.

---

## Section 5: Implementation Handoff

**Change scope classification: Moderate** — adds one new story and reopens two `review`-status stories with real (if small) new code, but requires no epic restructuring, no PRD MVP change, and no architectural redesign.

- **Product Owner / Developer (Amelia):**
  - Apply the `epics.md` and PRD edits above.
  - Update `sprint-status.yaml` per 4.7.
  - Run `bmad-create-story` for Story 4.3c when ready to pick it up (depends on Stories 2.7 and 4.3a both being real — both already are).
  - Re-open Stories 4.3a and 4.6 for the amendments above before their next code-review pass; no separate story files need regenerating since both are small, additive AC corrections onto existing story files.
  - Story 4.7 needs no rework — the correction is folded into a story that hasn't started yet.

**Success criteria:**
- A user who reports an event of any reason no longer sees it in Discovery/Feed/Favorites/My Calendar/search, but can still reach its detail page via a link they already have (which still explains it's hidden).
- A `personal`-reason report is `auto_resolved` immediately and never appears in the Moderator Items "requires my attention" list once Story 4.7 ships.
- `cancelled`/`dangerous` report behavior is completely unchanged.
