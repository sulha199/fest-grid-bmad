---
backlog_id: CC-013
title: Sprint Change Proposal — Moderator Default-Location Override Authority
status: approved
created: 2026-08-24
updated: 2026-08-24
---

**Approved 2026-08-24.** Routing: `bmad-prd` (§3.7/§4.14 amendment) → `bmad-architecture` (AD-11) → `bmad-ux` (shared account-location component) → `bmad-create-story` (Story 3.3b amendment; Story 4.7 shaped for later drafting).

# Sprint Change Proposal: Moderator Default-Location Override Authority

## Change Navigation Checklist

### Section 1 — Trigger and Context

**1.1 Triggering story:** Story 3.4m's Pre-Coding Approval Gate (AI-inferred default location, PRD §3.7/FR89-92/AD-10) — Decision 2 ("moderator-flow parity for AI-inferred changes"). [x] Done

**1.2 Problem statement:** Story 3.3b's moderator review flow for `DefaultLocationChangeRequest` offers only `ACCEPT`/`REVERT` — there is no way for a moderator to directly correct a wrong value to the actually-correct one. Category: **pre-existing gap in original requirements**, not a new requirement — `editAccountDefaultLocation` (the mutation that *can* set an arbitrary value) has always been subscriber-only (`apps/backend/src/schema/resolvers.ts:496-513`, requires an active subscription). This was a low-impact gap while default-location changes were rare, subscriber-initiated edits. Story 3.4m makes it high-impact: every account with no default now automatically gets an AI guess awaiting review, so "the AI guessed wrong, and REVERT only blanks it rather than fixing it" becomes a routine moderator scenario, not an edge case. [x] Done

**1.3 Evidence (read directly from current `master`, not assumed):**
- `editAccountDefaultLocation` (resolvers.ts:496-513): requires `subscriptions` row for `(authUser.userId, accountId)` — no moderator path exists.
- `resolveDefaultLocationChange` (resolvers.ts:1459+) and `DefaultLocationChangeAction` enum (default-location-change-requests.graphql): only `ACCEPT`/`REVERT`, no third action.
- `editAccountDefaultLocation` has **no existing check for other pending requests** — a subscriber can already call it repeatedly, stacking multiple `PENDING_REVIEW` rows for one account before any are reviewed. This predates 3.4m and predates moderator access; it just becomes worth fixing at the same time since we're touching this code path anyway.
[x] Done

### Section 2 — Epic Impact Assessment

**2.1/2.2 Epic 3 (Story 3.3b, `review` status — already implemented on `master`, not yet in final code review):** Fully completable, needs amendment: extend `editAccountDefaultLocation` auth to accept a moderator (`requireModerator`, Story 0.17/AD-7 rule 5 pattern) in addition to an active subscriber; add `changeSource: 'MODERATOR'`; when the caller is a moderator, insert the `DefaultLocationChangeRequest` already resolved (not `PENDING_REVIEW` — no redundant second review); on **any** successful call (subscriber or moderator), auto-supersede every other still-`PENDING_REVIEW` request for that `accountId` (new `SUPERSEDED` terminal status). [x] Done

**2.2 Epic 4 (Story 4.7, `done` — corrected during implementation, was mischaracterized as `backlog` earlier in this proposal; the moderator review page is already shipped code, `apps/web/.../moderator/items/moderator-items-content.tsx`, with a real `handleResolveLocationChange` ACCEPT/REVERT handler):** Needs its already-shipped review page amended to also render the new shared `AccountLocationField` component per pending row, alongside — not replacing — the existing `ACCEPT`/`REVERT` actions. Also closes a real, confirmed-live gap: Story 3.3b's original design (`sprint-status.yaml`) left a forward note asking 4.7 to dedupe stacked pending requests per account, which was never actually implemented — `moderator-items-content.tsx` has no dedupe logic at all today. [x] Done

**2.3-2.5 Other epics:** No other epic touches `DefaultLocationChangeRequest`/`editAccountDefaultLocation`. No resequencing needed — 3.3b is already built (amendment layers on top, doesn't unwind it); 4.7 hasn't started, so this shapes it before any wasted build effort. [x] Done

### Section 3 — Artifact Conflict Analysis

**3.1 PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`):** §4.14 `DefaultLocationChangeRequest`/`changeSource` needs a third enum value (`MODERATOR`, alongside `USER`/`AI_INFERENCE` added earlier today) and `DefaultLocationChangeStatus` needs a `SUPERSEDED` value. §3.7's moderator-oversight paragraph needs one sentence establishing that moderators may also directly set a corrected value via the same mechanism a subscriber uses, and that doing so requires no further review. [x] Done → routes to `bmad-prd`

**3.2 Architecture (`festgrid-architecture-spine.md`):** Needs a short `AD-n` establishing the auth pattern precedent — a mutation gaining a second, independent authorization path (`requireModerator` OR active-subscription, not one replacing the other) — since this is the first place in the codebase a subscriber-scoped mutation also becomes moderator-callable, and future stories may want the same shape. Also states the supersede-on-any-write rule as a `Rule` so it's not silently reinvented differently in 4.7. Not related to AD-10 (system key) — separate concern, same story family. [x] Done → routes to `bmad-architecture`

**3.3 UX (`design-artifacts/UX-festgrid-run-1/`):** Needs a new shared component spec — an "account-location" status/edit component reused between the subscriber settings page (Story 3.2/3.3b) and the moderator review page (Story 4.7), showing current location + moderation status, with the override-edit trigger and status detail conditionally visible only to moderators. [x] Done → routes to `bmad-ux`

**3.4 Other artifacts:** No IaC/infra impact (pure application logic + one enum value + one status value). Testing: Story 3.3b's existing test suite (subscriber path) must keep passing unmodified; new tests needed for the moderator path, the self-resolved-request behavior, and the supersede-on-write logic. [x] Done

### Section 4 — Path Forward Evaluation

**4.1 Option 1 — Direct Adjustment:** Viable. Amend Story 3.3b's ACs (already-built resolver gets additive changes, no rewrite) and shape Story 4.7's ACs before it's built (zero rework cost). Effort: **Low-Medium**. Risk: **Low** — the subscriber path's existing behavior is preserved exactly; the only new side effect (supersede) fires only in a scenario that was already latent but unreachable in practice. [x] Viable

**4.2 Option 2 — Rollback:** Not applicable — nothing needs reverting; 3.3b's shipped behavior is being extended, not undone. [x] Not viable

**4.3 Option 3 — MVP Review:** Not applicable — this doesn't change MVP scope, it closes a gap inside already-in-scope moderator oversight. [x] Not viable

**4.4 Selected path: Option 1, Direct Adjustment.** Rationale: additive to shipped code, zero rework on not-yet-built Story 4.7, low risk, and directly resolves the redundant-review loop the user flagged. [x] Done

## Detailed Change Proposals

### PRD (`§3.7`, `§4.14`) — routes to `bmad-prd`
- §4.14 `changeSource` enum: `USER | AI_INFERENCE | MODERATOR`.
- §4.14 `DefaultLocationChangeRequest.status`: add `SUPERSEDED` (a request that was pending when a later edit — by anyone — overtook it; terminal, not actionable).
- §3.7: one new sentence — moderators may set an account's default location directly (same mechanism, `editAccountDefaultLocation`, extended auth); a moderator-sourced change requires no further review and auto-supersedes any other pending request for that account.

### Architecture (`festgrid-architecture-spine.md`) — routes to `bmad-architecture`
- New `AD-11` (next available ID): **Moderator Override on Subscriber-Scoped Mutations**.
  - Binds: `editAccountDefaultLocation`'s auth check.
  - Prevents: a moderator-only fork of subscriber-facing edit mutations; the "second reviewer for a moderator's own correction" loop.
  - Rule: auth accepts `requireModerator(context)` OR the existing active-subscription check (either satisfies, not both); a caller identified as moderator writes `changeSource: 'MODERATOR'` and the request is inserted pre-resolved (no `PENDING_REVIEW`); every successful write (any `changeSource`) supersedes other `PENDING_REVIEW` rows for that `accountId`.

### UX (`design-artifacts/UX-festgrid-run-1/`) — routes to `bmad-ux`
- New shared component: account current-location + moderation-status display, with a moderator-only override-edit trigger, reused by Story 3.2/3.3b's subscriber settings page and Story 4.7's moderator review page.

### Stories
- **Story 3.3b** (amend, already `review`, real shipped code): new AC for moderator-callable auth, `changeSource: MODERATOR`, self-resolved insert, supersede-on-write logic + new tests. Reopened in `sprint-status.yaml`. Routes to `bmad-create-story` next.
- **Story 4.7** (amend, already `done`, real shipped code — corrected from this proposal's earlier `backlog` mischaracterization): new AC to render `AccountLocationField` per pending-request row alongside existing `ACCEPT`/`REVERT`, and to actually implement the never-built stacked-request dedupe its own original design assumed. Reopened in `sprint-status.yaml`, depends on 3.3b's amendment landing first.
- **Story 3.4m**: no change needed — its own Pre-Coding Gate Decision 2 (`ACCEPT`/`REVERT` only) stands as designed; the correction capability lives in 3.3b/4.7, not duplicated into 3.4m.

## Implementation Handoff

**Scope classification: Major** — touches PRD, architecture, and UX. Routed through PM/Architect (this session, via `bmad-prd` → `bmad-architecture` → `bmad-ux`, all committed); next is story-level updates via `bmad-create-story` on 3.3b, then 4.7.

**Success criteria:** PRD §3.7/§4.14 amended ✓; `AD-11` logged ✓; UX component spec exists ✓; `sprint-status.yaml` updated (Stories 3.3b/4.7 reopened) ✓. Remaining: `bmad-create-story` on 3.3b, then 4.7.
