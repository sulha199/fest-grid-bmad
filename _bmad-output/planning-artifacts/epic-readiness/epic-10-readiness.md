---
epic: 10
swept: true
date: '2026-11-01'
stories_covered:
  - '10.1a'
  - '10.2'
  - '10.3'
  - '10.4'
  - '10.5'
  - '10.6'
  - '10.7'
  - '10.8'
  - '10.9'
  - '10.10'
  - '10.11'
  - '10.12'
  - '10.13'
  - '10.14z'
---

# Epic 10 Readiness Report: Background Vendor Jobs — One Engine, One Jobs Page

Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness)
swept once, epic-wide, per `story-split-gate.md`'s Epic-Level Sweep Mode, against all fourteen stories of Epic 10
(`epics.md`, formed 2026-11-02 by `bmad-form-epics` from BUG-099, IDEA-115, IDEA-047, IDEA-008, IDEA-009, BUG-014,
plus IDEA-116 to IDEA-119). PRD gate already passed: PRD §3.18 (FR116–FR128) and the Job interface (§4.21) are
committed (`c8341998`), and FR116–FR128 are backfilled into `epics.md`'s requirements inventory, FR coverage map
and Epic 10's "FRs covered" line (verified against lines 129–141, 318–330 and 6099 — all three are mutually
consistent). Evidence used: `epics.md`'s full Epic 10 section and the Epic 0.i1/0.i2/0.i3/0.i5/0.i6/0.24 stories it
names; `background-vendor-jobs-design-notes-2026-11-02.md`; `epic-formation/epic-10-outside-the-epic-2026-11-02.md`
and `formation-2026-11-02.md`; `festgrid-architecture-spine.md` AD-32, AD-40, AD-41; PRD §3.7, §3.9.1, §3.9.3,
§3.10–§3.13, §3.16, §4.9, §4.21, §5, §6, §7; `sprint-status.yaml`; and, where a story's claim about unbuilt code was
checkable, the actual repo state (`apps/web/src/features/wizard/wizard-registry.ts`, `git log`).

**Story 10.1a validated as buildable as one story, with the new AD embedded in it (not a separate prerequisite
story).** The three design questions the PRD pass left open were already substantively resolved before this sweep
ran, not deferred to it:
- **Worker host:** already decided — the story's own AC1 invokes the scraper Lambda through the AD-41 seam (the
  only Lambda with both vendor tokens and `BRIGHTDATA_DATASET_ID`), not the API Lambda (28 s hard limit, no
  adapters registered — BUG-100) or the AI-processor Lambda (no vendor tokens at all).
- **Job-table relation to `apify_pending_jobs`, `brightdata_pending_jobs`, `scraper_actor_runs`,
  `vendor_call_locks`:** already decided — AC4 references them, does not replace them; `manual_extraction_jobs` is
  explicitly untouched pending Story 10.9's own decision (OI-4).
- **Slot-reservation storage:** already assigned, not to 10.1a — PRD §4.9's `Subscription` interface says in its
  own doc comment that "how the reservation is stored is decided with the job engine (Story 10.3), not here."
- **One gap this sweep found and corrected directly:** none of the above says how a job whose phases need
  *different* Lambda capabilities is run — Story 10.6 (refresh, then preview) and Story 10.9 (maybe-rescrape, then
  extract) each need a vendor-scrape phase (Scraper Lambda) followed by a Gemini/face-blur phase (AI-processor
  Lambda), but 10.1a's AC2 described only a single worker running the whole handler. **Added as a new AC bullet on
  Story 10.1a**, directly: the new AD must name the cross-Lambda hand-off mechanism (phase hand-off over the same
  async-invoke seam, carrying only the job id and phase, never a token or a caption).

---

## Gate 1 — Architecture / Infrastructure Completeness (epic-wide)

- **Vendor-call layer:** AD-32's guarded wrapper (`callVendor`) already exists (Story 0.i2a, `review`) and is
  already adopted into the Apify/Bright Data *profile*-scrape call sites (Story 0.i2d, status **`done`**) —
  contrary to AD-32's own prose (Rule 6), which still reads as if no adoption story exists; that text is stale
  relative to a later `epics.md` update that added 0.i2d. Story 10.2's own AC1 already requires every new
  post-scraper adapter call to go "through the guarded vendor call," so Epic 10's *new* call sites inherit the
  same lock/timeout/retry/DPA-gate discipline from day one. **No gap, no new story** — checked, not assumed.
- **New API surface:** Story 10.4's `job(id)`/`myJobs`/`activeJobs` GraphQL surface is built in the same story as
  its UI consumer, matching this codebase's established "build X page" pattern elsewhere in `epics.md` (the
  resolver layer is not being bypassed, just co-scoped with its one consumer) — not a Gate 1 violation.
- **Worker Lambda / capability split:** see the cross-Lambda phase-handoff finding above (now AD-scope on Story
  10.1a).
- **IaC/deploy coverage:** Story 10.1a's CDK invoke-grant change is its own IaC story — covered. **One wording
  problem found:** the AC said the change "passes the Lambda-timeout and IAM-grant checks (Epic 0.i3)," but Epic
  0.i3's whole invariant-sweep suite (0-i3a) is itself `backlog` — unstarted, no code, no CI gate exists to pass.
  **Corrected directly on Story 10.1a:** reworded to "declares an explicit timeout... and IAM access matching every
  referenced env var... in the same shape Stories 0-i3b/0-i3c will later enforce automatically," satisfied by
  manual compliance now, re-verified once those land.
- **Boundary enforcement:** Story 10.14z's planned boundary test (no resolver imports a vendor client outside the
  engine) and metafile ratchet directly target the exact bug class (BUG-100) that motivated the epic. One gap:
  BUG-100's actual fix is local-only (branch `fix/bug-100-api-lambda-registers-scraper-adapters`, not on master), so
  by the time 10.14z is built the "red" case it needs may already be fixed on master. **Corrected directly on
  10.14z:** added guidance to produce the red run either via a committed synthetic bad-fixture (preferred — keeps
  the ratchet self-verifying) or a one-time local revert, documented in Dev Notes, if the fix has already landed.

**No other epic-wide bypass found.**

---

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (epic-wide + cross-epic)

- **`callVendor` (AD-32):** see Gate 1 above — closed by Story 0.i2d (`done`), not a gap.
- **Shared list-pagination controller (Epic 0.i5) / `SubscribedAccountCard` (Epic 0.i6), cited by Story 10.4:**
  checked against `sprint-status.yaml`. The actual mechanisms Story 10.4 needs — Story 0.i5a (controller) and
  Story 0.i6a (card base contract) — are both `review` (built, not yet merged), which this project's standing
  convention treats as safe to build against. The specific stories the task asked about (0-i5c, 0-i6b, 0-i6d) are
  adoption stories for *other, unrelated* surfaces (moderator-tools pages, Post Selection, `AccountAvatar`'s
  border token) and are not dependencies of Story 10.4 at all — the task's framing over-named them. The two that
  *are* relevant, 0-i5z and 0-i6z (the ratchets that will CI-enforce adoption repo-wide), are still `backlog`, so
  they cannot fail on Story 10.4 yet, but will once they land if 10.4 did not already comply. **Verdict: soft
  ordering, not a hard block.** Added a `Depends on:` clarification to Story 10.4 naming the real (review-status)
  prerequisites and the pending ratchets, and dropping the unrelated stories from its dependency language.
- **Epic 0.i3's invariant-sweep suite, cited by Story 10.1a:** see Gate 1 above — soft ordering, AC reworded.
- **Epic 0.i1's `notifyAllModerators`, cited by Story 10.13:** **real gap, corrected directly.** Story 0.i1a
  (`backlog`, unstarted) is drafted as an all-moderators fan-out helper with no single-recipient parameter, but
  FR124 needs the job's owner addressed alone when that owner is a moderator. The existing `epics.md` text only
  said Story 10.13 "must check" this — on the contract as drafted, the honest answer is that it currently cannot.
  **Corrected Story 10.13's AC** to require either extending 0.i1a with a single-recipient mode or building a thin
  single-recipient helper that reuses its escaping/throttle/template machinery — not a bare check.
- **Story 0.24 (reusable wizard primitive), cited by Story 10.8:** `sprint-status.yaml` marks it `ready-for-dev`
  (unstarted), but `git log` and a direct file check show `apps/web/src/features/wizard/wizard-registry.ts` and the
  `[wizardKey]/[stepSlug]` route already exist and are committed (consumed by Stories 3.1 and 5.5, both `review`).
  **Verdict: no dependency gap** — the primitive is already built; `sprint-status.yaml`'s status for Story 0.24 is
  stale bookkeeping, flagged here but not corrected (out of this sweep's scope — it is Epic 0's own story, not
  Epic 10's).
- **`project-context.md` loader rule for the engine:** already tracked as Story 10.14z's own documentation
  check (epics.md Story 10.14z AC4) — not a gap.
- **i18n / analytics / testing / codegen foundations:** all pre-existing and already adopted elsewhere in
  `epics.md`; Epic 10 only adds translation keys (Story 10.4), new PostHog-style KPI tracking (PRD §7, Background
  Job Outcomes) and new fixtures within those existing systems — nothing foundational is missing.

**No new Epic 0 (or cross-epic) dependency gap requiring a new story was found.**

---

## Other items from the readiness-check brief

**AD-41 Rule 1 ("the subscription always succeeds") vs. FR122/FR126:** **Amend, do not supersede** — carried by
Story 10.7, which is the story that actually changes `subscribeToAccount`'s outcome on a not-found/private/
no-provider failure (no subscription remains, slot released). Rule 1 was true and complete for the
classify-account-only path AD-41 originally described; FR126 narrows it for the job-engine path, it does not
invalidate it (a successful classify-then-scrape still never un-succeeds a subscription). **Added a new AC bullet
to Story 10.7** stating the failure behavior and naming it as an AD-41 Rule 1 amendment.

**IDEA-101 / IDEA-102 re-scoring:** This sweep did **not** drop or reshape Story 10.2 or Story 10.5 — both remain
single, buildable stories as formed. The `s → xs` re-scoring of IDEA-101 (remember an exhausted Apify cap, answered
by 10.2) and IDEA-102 (Bright Data snapshot-still-running sweep, answered by 10.5) therefore stands; no
`backlog.yaml` re-examination is needed on the strength of this sweep. (Per instructions, `backlog.yaml` itself is
not edited here.)

**Open items OI-1 to OI-4 (PRD §3.18) — not decided here, named for the record:**
| Item | Blocks | Latest decision moment |
|---|---|---|
| OI-1 (default provider order / Apify plan, FIND-103) | Story 10.2's default `POST_SCRAPER_PROVIDER_ORDER` | Before Story 10.2 sets the default |
| OI-2 (IDEA-115 D1, D3, D4 — lookup fallback UX) | Stories 10.4 and 10.7 (background-phase UX) | Before those two stories' `bmad-ux` pass |
| OI-3 (whose vendor credential a job uses — CC-032 / Story 3-4b AC6) | Story 10.2's final credential-selection logic (the design already lets credential depend on job type, so either outcome plugs in without a chain change) | When CC-032 is decided |
| OI-4 (whether `manual_extraction_jobs` moves onto the engine table) | Story 10.9 (explicitly — it is where the decision is recorded) | During Story 10.9 |

**FR→story traceability (item 6):** Every FR116–FR128 maps to exactly one story (table in `epics.md` lines
318–330), and every story maps back to an FR or an absorbed backlog row (BUG-099, IDEA-008/009/047/101/102/116–119,
BUG-014, FIND-079/082/119, BUG-101) — no orphan in either direction. **One AC/FR mismatch found and corrected:**
FR124's PRD text covers two channels — in-app + push for *every* job owner (the main, already-settled requirement)
and, additionally, the Epic 0.i1 moderator helper for a moderator owner — but Story 10.13's AC in `epics.md` only
had the moderator half. **Added the missing in-app/push AC to Story 10.13**, so FR124 is now actually tested by an
AC, not just referenced by one.

---

## New Prerequisite Stories Created

**None.** Every gap this sweep found was a correction to an existing story's AC (Stories 10.1a, 10.4, 10.7, 10.13,
10.14z) — unambiguous, non-epic-wide, and applied directly to `epics.md` per the numbering rule's allowance for
direct corrections. No `sprint-status.yaml` changes were needed: Epic 10's fourteen stories (`epic-10` through
`10-14z`) are already present as `backlog` entries, and this sweep added no new backlog keys.

## AC Corrections Applied Directly to `epics.md`

- **Story 10.1a:** added an AC bullet requiring the new AD to resolve cross-Lambda phase hand-off; reworded the
  CDK-checks bullet to not presuppose Epic 0.i3's unstarted invariant-sweep suite exists yet; reworded `Depends
  on:` to state the design questions were already settled before this sweep and to record the soft Epic 0.i3
  ordering.
- **Story 10.4:** reworded `Depends on:` to name the actual (review-status) prerequisites (0.i5a, 0.i6a), note the
  pending ratchets (0-i5z, 0-i6z) as soft ordering, and drop the unrelated stories (0-i5c, 0-i6b, 0-i6d).
- **Story 10.7:** added an AC bullet for the not-found/private/no-provider failure behavior (no subscription, slot
  released, Retry re-reserves) and named it as the AD-41 Rule 1 amendment this story carries.
- **Story 10.13:** replaced the bare moderator-helper bullet with two bullets — the main FR124 in-app/push channel
  (every job owner) and a strengthened moderator bullet requiring 0.i1a to be extended or thinly wrapped for
  single-recipient addressing, not merely "checked."
- **Story 10.14z:** added guidance for producing the ratchet's first red run via a synthetic fixture (preferred) or
  a documented one-time local revert, in case BUG-100's fix lands on master before this story is built.
- **Epic 10's closing Note:** added a pointer to this sweep summarizing the above, so a reader of `epics.md` alone
  (without this report) sees that the sweep ran and what it changed.

---

**Epic 10 Readiness Sweep Status: APPROVED & READY FOR DEV** — proceed to `bmad-create-story` for Story 10.1a
first (the mechanism story; no story in this epic is unblocked ahead of it), then the remaining stories in
`epics.md` order (10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14z last). Each
will skip Gate 1/3 citing this report and run only Gate 2.
