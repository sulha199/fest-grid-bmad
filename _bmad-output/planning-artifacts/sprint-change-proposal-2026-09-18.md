---
backlog_id: CC-022
---

# Sprint Change Proposal — 2026-09-18

**Trigger:** FIND-022 (backlog, `status: triaged`, `impact: user-visible`, `effort: l`) — its
spec is now complete and self-validated at
`_bmad-output/specs/spec-post-coauthor-attribution/` (`SPEC.md`, `vendor-role-mapping.md`,
`.memlog.md`), defining 8 capabilities (CAP-1..CAP-8) for a normalized vendor-role contract
covering post coauthor/publisher attribution.

**Mode:** Incremental (all edit groups reviewed and approved by the user before writing).

---

## Section 1: Issue Summary

`posts.accountId` is always set to the *scraping-source* account (whichever subscription
triggered the fetch), never the post's actual publisher. Instagram's native "Collab"
coauthor feature — and reposts generally — means these can differ: a repost/collab post is
silently misattributed, its real publisher/coauthor is invisible and unsubscribable unless
someone separately discovers and scrapes them directly, and account-based filtering points
at the wrong account.

This is a confirmed live gap, not a hypothesis: `apps/backend/src/lib/scraper/instagram-adapter.ts`
never reads the `coauthorProducers` field the production Apify actor
(`apify/instagram-post-scraper`, the actor actually wired into `GET_POST_BY_URL_ACTOR`/
`GET_NEWEST_POSTS_ACTOR`) already returns on every post — verified against two real captured
runs (`vendor-role-mapping.md`, `run-04`/`run-06`), including a real Pakuwon Mall Jogja post
tagging Crunchmate.id as a coauthor.

The spec's own Open Questions flagged three items for this course-correction pass to resolve
or explicitly scope:
1. An unadjudicated house-convention conflict — CAP-7 mandates a confirm-then-refetch
   subscribe toggle, deviating from this app's default optimistic-mutation pattern
   (`toggleFavorite`'s ±1, BUG-008/Story 2.i1a).
2. Bright Data's `coauthor_producers` exact shape is unverified (cited fixture no longer on
   disk) — Apify's side is fully verified.
3. The new association table's exact uniqueness-constraint DDL is left to architecture.

## Section 2: Impact Analysis

**Epic impact:**
- **Epic 3 (Social Media Event Integration):** gains 7 new stories (3.13–3.19) covering
  CAP-1 (vendor role normalization, Apify only), CAP-2 (deduplicated provenance-tracked
  profiles), CAP-3 (association table + migration, architecture-gated), CAP-4 (immediate
  subscribability), CAP-5 (demand-gated discovery), CAP-6 (union-of-associations filtering),
  and CAP-8 (sanitized analytics). No existing Epic 3 story's scope is reduced or rewritten.
- **Epic 0.i6 (One SubscribedAccountCard...):** gains Story 0.i6g (CAP-7, event/post-detail
  attribution UI). Story 0.i6c's own AC is amended — its prior conditional framing ("if
  SubscribedAccountCard is also the component behind FIND-022's pattern...") is resolved to
  a confirmed dependency, not left as a speculative branch. Story 0.i6z's ratchet
  Depends-on/scope both extended to cover the new surface.
- No epic is removed, resequenced, or made obsolete. No other epic's stories are touched.

**Story impact:** 8 new story entries (3.13–3.19, 0.i6g) added directly to `epics.md` with
full Given/When/Then ACs, each carrying a `bmad-correct-course` provenance Note citing the
spec and its capability ID. 0.i6c and 0.i6z amended in place (no scope removed, only
resolved/extended).

**Artifact conflicts:**
- **PRD:** `Post.accountId`'s doc comment (§4.7) was factually stale (claimed "published this
  post"; actually the scraping-source account) — corrected, with a forward-reference to the
  new §4.7a `PostAccountAssociation` interface (added, CAP-3) and new `SocialMediaAccountProfile`
  fields (`firstSeen`/`lastSeen`/`discoverySource`/`isVerifiedForDiscovery`, §4.5, CAP-2/CAP-5
  incl. the spec's Pass-2 self-validate amendment). MVP scope is unaffected — this is additive,
  not a requirements change.
- **Architecture:** no architecture document exists as a single artifact beyond the spine;
  the association table's DDL is explicitly flagged for a `bmad-architecture` pass (see
  Section 5) rather than decided here.
- **UI/UX:** `project-context.md`'s UI Patterns section gains a new "Scoped Exception" rule
  ratifying confirm-then-refetch for this one toggle only, explicitly non-generalizing in
  either direction.
- **Other artifacts:** `sprint-status.yaml` updated with the 8 new story entries
  (`backlog`, except 3-15 at `blocked` pending architecture output).

**Technical impact:** New DB table (`post_account_associations`) and migration; new
`SocialMediaAccountProfile` columns; a new GraphQL-surfaced interface shape
(`PostAccountAssociation`); extends the existing `subscribeToAccount`/`persistUnprocessedPayload`/
`SubscribedAccountCard` mechanisms rather than replacing them.

## Section 3: Recommended Approach

**Selected approach: Direct Adjustment (Option 1), with an architecture sub-step.** The
issue is addressed entirely by adding new stories within the existing epic structure — no
rollback, no MVP scope reduction. The one nuance: Story 3.15 (CAP-3, the association table)
is intentionally left DDL-unspecified and gated on a `bmad-architecture` pass before
`bmad-create-story` elaborates it, per the user's explicit choice during this workflow.

**Rationale:**
- Direct Adjustment fits cleanly: FIND-022's spec was written precisely to hand off into
  epic/story decomposition (its own non-goal: "Epic/story decomposition itself... is the
  input contract for `bmad-create-epics-and-stories`... not a replacement for it"), and both
  target epics already have live, real content this preserves rather than replaces.
- Rollback is not viable/relevant — no completed work conflicts with this change; it's a
  net-new capability set.
- MVP Review is not warranted — this doesn't touch PRD core goals, only corrects a stale
  doc-comment and adds new interface/field definitions additively.
- Effort: **High** (8 new stories spanning backend ingestion, schema, subscription flow,
  discovery, filtering, UI, and analytics — matches the backlog's own `effort: l` tag).
  Risk: **Medium** — the DDL/architecture gate is the main open risk; everything else is
  additive to well-understood existing mechanisms (`persistUnprocessedPayload`,
  `subscribeToAccount`, `SubscribedAccountCard`).

## Section 4: Detailed Change Proposals

All edits below were drafted, presented to the user in six groups (A–E, with the epics.md
group split C/D for review), approved as drafted, and have been written to disk.

### Group A — `project-context.md`
Added a "Scoped Exception — Confirm-then-Refetch Toggle" rule under UI Patterns & UX
Invariants, ratifying CAP-7's confirm-then-refetch toggle as scoped to Story 0.i6g only,
explicitly non-precedent-setting in either direction. **Rationale:** resolves the spec's
Open Question #1 durably, per the user's "ratify as scoped exception" choice.

### Group B — PRD `prd.md`
- §4.7 `Post.accountId`: doc comment corrected from "published this post" to "triggered
  this post's ingestion... not always the post's actual publisher," with a forward-reference
  to new §4.7a.
- New §4.7a `PostAccountAssociation` interface added (role enum: `PUBLISHER`, `COAUTHOR`,
  `SCRAPING_SOURCE`, `PUBLISHER_UNKNOWN`; `discoverySource` provenance field).
- §4.5 `SocialMediaAccountProfile`: added `firstSeen`, `lastSeen`, `discoverySource`,
  `isVerifiedForDiscovery` fields (CAP-2/CAP-5).
**Rationale:** the accountId comment was actively misleading (a documentation bug the spec
surfaced); the new interface/fields give downstream `bmad-create-story` passes a PRD-level
source of truth instead of inventing shapes inline in epics.md.

### Group C — `epics.md`, Epic 3, Stories 3.13–3.19
New stories 3.13 (CAP-1, Apify-only vendor role normalization), 3.14 (CAP-2, deduplicated
provenance-tracked profiles), 3.15 (CAP-3, association table + migration, architecture-gated),
3.16 (CAP-4, immediate subscribability), 3.17 (CAP-5, demand-gated discovery), 3.18 (CAP-6,
union-of-associations filtering), 3.19 (CAP-8, sanitized analytics) — each with full
Given/When/Then ACs mirroring its capability's `success` criterion, a `Depends on:` line
tying it to the real existing Epic 3 stories it builds on, and a Note citing FIND-022/spec
provenance. **Rationale:** these capabilities are backend/ingestion/subscription/filtering
concerns squarely inside Epic 3's existing invariant and FR coverage (FR18–FR37), not the
card-display concern Epic 0.i6 owns.

### Group D — `epics.md`, Epic 0.i6: amend 0.i6c, add 0.i6g, extend 0.i6z
- Story 0.i6c: resolved its own conditional framing about FIND-022 from hypothetical to
  confirmed, via an Update note — no AC content removed.
- New Story 0.i6g (CAP-7): event/post-detail coauthor attribution UI, `SubscribedAccountCard`
  reuse via 0.i6c's variant prop, confirm-then-refetch toggle citing Group A's now-ratified
  exception, display-only for provisional identities.
- Story 0.i6z: `Depends on:` and sweep-scope both extended to include 0.i6g.
**Rationale:** directly fulfills the command's core instruction — epics.md's own prior note
on 0.i6a already anticipated this landing spot; this makes it real rather than speculative.

### Group E — `sprint-status.yaml`
Added `3-13` through `3-19` under `epic-3` (all `backlog` except `3-15` at `blocked`), and
`0-i6g` under `epic-0-i6` (`backlog`), each with an inline comment explaining the addition
and, for 3-15/0-i6g, their gating dependency.

## Section 5: Implementation Handoff

**Scope classification: Major.** This crosses 5 backlog tags (`app:backend`,
`cross:ai-extraction`, `web:accounts`, `web:events`, `web:subscriptions`, `pkg:ui`) and
requires an architecture decision before one of its stories can be elaborated —
consolidation into existing epics does not make this a Minor/Moderate change on its own.

**Recommended sequencing:**
1. **PM/Architect — run `bmad-architecture`** on the `post_account_associations` table
   before `bmad-create-story` elaborates Story 3.15. Its uniqueness-constraint DDL choice
   (`post_id+account_id+role` vs. `post_id+account_id`) affects how 3.14/3.16/3.18 are
   written, not just 3.15 itself. This was the user's explicit choice during this workflow
   (over deferring the DDL decision to story-level Dev Notes).
2. **PO/Dev — `bmad-create-story` for 3.13, 3.14** can proceed immediately; they have no
   architecture dependency (3.13 depends on the already-built Story 3.3c/3.4d/3.4h; 3.14 on
   3.13 + 3.1a).
3. **PO/Dev — `bmad-create-story` for 3.15** waits on the architecture output (step 1), then
   3.16, 3.17, 3.18 in dependency order.
4. **PO/Dev — `bmad-create-story` for 0.i6c** (if not already elaborated ahead of 0.i6b/0.i6d)
   should account for its now-confirmed dependency from 0.i6g.
5. **PO/Dev — `bmad-create-story` for 0.i6g** waits on 3.15 and 3.16 landing (or reaching
   `review`, per this project's accepted "review-status prerequisite is safe to build
   against" convention) plus 0.i6c.
6. **PO/Dev — `bmad-create-story` for 3.19** waits on 0.i6g (the toggle it instruments).
7. **Separately tracked, not this pass's job:** a fresh Bright Data payload capture is needed
   before any Bright Data-side vendor-role-normalization story can be written — flagging this
   as a backlog carve-out (see below) rather than silently leaving it unowned.

**Backlog carve-out:** Per this project's standing `on_complete` convention, a child backlog
row should be opened for the deferred Bright Data coauthor-shape verification (blocked on a
fresh real-payload capture), separate from FIND-022's now-promoted scope — registered as part
of this proposal's board registration step.

**Success criteria:** all 8 capabilities' `success` statements in `SPEC.md` are met by their
corresponding story's ACs above; the spec's Success signal end-to-end scenario (an Apify post
with coauthors round-trips through ingestion → filtered feed → subscribable, confirm-then-refetch
UI) is achievable once Stories 3.13–3.18 and 0.i6g all land.
