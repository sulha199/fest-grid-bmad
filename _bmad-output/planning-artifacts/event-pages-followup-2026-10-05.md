# Event Pages & CC-024 — Follow-up Tracker (2026-10-05)

**Created:** 2026-10-05
**Status:** working doc. The single place to see what is still open after the 2026-10-05
reconciliation of the five event-pages / CC-024 plans, with a step-by-step order and a prompt for each
step. Tick boxes live. **Source of truth on conflict:** `sprint-status.yaml` (story state) and
`backlog.yaml` (intake rows) always win over this file; if a box here disagrees, fix the box.

Reconciled plans (now history, each has a "Reconciliation, 2026-10-05" section at the top):
`event-pages-remaining-backlog-plan.md`, `event-pages-followthrough-plan.md`,
`event-pages-dev-story-tracking.md`, `event-pages-closeout-wave-plan.md`,
`cc-024-multi-event-wave-plan.md` (the last two still own their open wave checklists).

`bmad-code-review` is deliberately **out of scope** here (user instruction): every built story stays
at `review`.

## How to use a prompt

- Run each step in a **fresh chat** (context hygiene). Paste the prompt as the first message.
- Every prompt names its own inputs, so no earlier chat is needed.
- After each step: tick the box, add the commit hash in the log at the bottom, and re-run
  `uv run --python 3.11 --with pyyaml scripts/backlog-check.py --quiet` (the 16 non-check-15 lines
  that exist today are the baseline; a step must not add to them).
- Several stories in one go: use `ritual-orchestrator` and its own tooling (`run-check.ts`,
  `run-act-with-checks.ts`), never raw `pnpm`. Keep the batch's `.batch-plan-*.json` current after
  every item.
- Before any test run after a pull: `pnpm install --frozen-lockfile`, then `pnpm build`, and run
  tests with `TZ=UTC` with the volume seed cleaned (`seed:volume:clean`). Run the backend suite on
  its own (FIND-064: it shares the dev database).

## Done on 2026-10-05 (for the record)

- [x] Reconciled the five plans against `sprint-status.yaml`, `backlog.yaml`, `git log` and code
      (commit `6f9a5d04`).
- [x] Corrected my own first pass: **IDEA-038** (temporal filter on Feed/Favorites/Account) and
      **IDEA-048** (compact-row favorite pill) were already shipped out-of-band by commit
      `d3414728` (2026-10-03). **FIND-053** was shipped 2026-09-26 (`f214f4e4`).
- [x] `backlog.yaml`: IDEA-038, IDEA-048, FIND-053 closed with notes; CC-020 and CC-021 given their
      `stories:` and set to `promoted`; new row **IDEA-060** (z-index layering tiers) with capture doc
      `backlog/IDEA-060-z-index-layering-tiers.md`. Checker: no new failures.
- [x] Fixed the stale Story 1.i1m comment in `EventCardCompact.tsx`.
- [ ] **Not done, now step 5:** deleting the favorite-badge branches inside `EventCardMediaSlot`.
      They are unused by production callers but are a tested contract (AC4 and Story 1.i1e's
      additive props, a `visual-audit` manifest), so deleting them needs the tests and ACs amended.

## Steps (suggested order)

### Group 1 — small, independent cleanups (`bmad-quick-dev`)

- [x] **Step 1 — Fix the stale `max_width` token in `EVENT-CARD-DESIGN.md`** (closeout Wave 0) — DONE 2026-10-05, commit `b11fc620` (also fixed the same claim in `EXPERIENCE.md`; `DESIGN.md` was already clean)
  - **Why:** line 277 still says every masonry card is capped at `max-w-[230px]`; Story 0.45 (done)
    removed it (its AC7).
  - **Done when:** the token and comment describe the shipped behavior (card fills its column),
    cross-references in `EventCardMediaPrimitives.tsx` comments are consistent.
  - **Prompt:**
    ```
    /bmad-quick-dev Fix design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md: the
    event_card_masonry.max_width token (around line 277) still says max-w-[230px] applies to all
    masonry states, but Story 0.45 (0-45-replace-grid-containers-masonry-engine-with-shortest-column-placement,
    done) removed that cap per its AC7. Read that story file and packages/ui/src/features/events/EventCard.tsx
    first, then correct the token and its comment to match shipped behavior. Doc-only change; do not touch
    source code. Read _bmad-output/project-context.md and the PRD first as CLAUDE.md requires.
    ```

- [x] **Step 2 — FIND-059 + FIND-054 together** (closeout Wave 1) — DONE 2026-10-05: FIND-059 reproduced and fixed with 3 new `home-content` tests (`19788ae9`, row closed `4a3365fd`); FIND-054 does not reproduce (the BUG-045 spec shows the contained variant cannot overflow; re-derived by the child, not independently re-checked), closed `4c78d7e0`
  - **FIND-059 (Story 1.i1o review: card-list `/id` tests only assert `favoriteToggle`):** add the
    missing till / status / nearby assertions to the card-list page integration tests.
  - **FIND-054 (`PageContainer` `fullWidth=false` overflow):** the contained variant has the same
    min-width-floor vs nav-rail-inset overflow BUG-045 fixed on the other variant.
  - **Verify first:** no commit references either; check the code before assuming they still reproduce.
  - **Prompt:**
    ```
    /bmad-quick-dev Two small backlog findings, verify each still reproduces before fixing.
    (1) FIND-059 (card-list /id page integration tests only assert favoriteToggle, missing till/status/nearby
    assertions): see backlog.yaml FIND-059 and Story 1.i1o (1-i1o-wire-eventcard-and-weeklycalendarview-labels-to-nextintl).
    (2) FIND-054 (PageContainer's fullWidth=false variant has the same latent min-w-floor-vs-nav-rail-inset
    overflow BUG-045 already fixed on the other variant): see commit 9e04ca91 and
    _bmad-output/implementation-artifacts/spec-bug-045-masonry-horizontal-overflow.md for the pattern.
    Run TZ=UTC for tests. On finish, set both rows to done in backlog.yaml with a one-line note.
    ```

### Group 2 — decisions and design-doc work

- [x] **Step 3 — FIND-052: decide keep-deferred or fix** (masonry reflow remounts items)
  - **DONE 2026-10-05 (commit `9d140826`): recommendation is FIX, build the mount-stable engine.**
    New repro `packages/ui/src/core/grid-container.find052.investigation.test.tsx` (5/5, real
    `GridContainer` + `useMasonryLayout`, mocked `ResizeObserver`). Every column reassignment remounts
    the item (100%, structural). Results: (a) same-breakpoint resize 0/6 moved, focus kept; (b)
    column-count change 4/6 moved and remounted, **focus lost**; (c) an earlier item's image-load height
    change 3/6 moved and remounted, **focus lost**; (d) infinite-scroll page append 0/6 moved, focus kept.
    Design is appended to `deferred-work.md`: one flat parent, `key={itemIndex}`, transform-positioned,
    container height from a new `columnHeights` field on `useMasonryLayout`, and the tab-order change
    (column-major to index-major) must be its own AC. Next: `bmad-create-story FIND-052` (Step 3b).
  - **State:** deliberate deferral from the Story 0.45 review. Cause: `grid-container.tsx` renders
    `key={itemIndex}` wrappers under one parent per column, so an item that changes column
    unmounts/remounts (ref churn, keyboard focus lost inside the moved card).
  - **Not known:** how often a column change actually happens in practice (expected on image load,
    height change, or column-count change on resize). Measure before committing to the rewrite.
  - **Likely fix:** one parent, items in index order, each positioned by transform, container
    height from the tallest column. Bonus: tab order follows reading order instead of column order.
  - **Prompt (measure, then decide):**
    ```
    /bmad-quick-dev FIND-052 investigation only, no source changes. Read
    packages/ui/src/core/grid-container.tsx, packages/ui/src/hooks/useMasonryLayout.ts and
    _bmad-output/implementation-artifacts/deferred-work.md (entry "Masonry reflow remount churn + focus
    loss"). Write a vitest/RTL reproduction that counts how often an item crosses a column on (a) a
    container resize that keeps the column count, (b) a column-count change, (c) an image-load height change,
    and records whether keyboard focus is lost when it does. Report the numbers and recommend either "keep
    deferred" or a mount-stable engine design. Do not change production code.
    ```
  - **Step 3b (the recommendation is "fix"):** `/bmad-create-story FIND-052`.
    - [x] create (Story 0.48, `7df5a60`, `ready-for-dev`, 2026-10-05)  - [x] dev (`9348909` + `d292b75`, `review`, 2026-10-06)
    - **Decision (user, 2026-10-05):** two-phase render (CSS-grid flow until the first measurement, then absolute + transform) to avoid the SSR/CLS height collapse; tab-order change is AC4. Story 0.47 was set to `ready-for-dev` in sprint-status at the user's call.

- [ ] **Step 4 — IDEA-060: z-index layering tiers** (architecture first, then one story)
  - **Inputs:** `backlog/IDEA-060-z-index-layering-tiers.md` (inventory, open questions, proposal).
  - **Prompt (architecture):**
    ```
    /bmad-architecture Decide the z-index layering model for packages/ui and apps/web (backlog row
    IDEA-060, capture doc _bmad-output/implementation-artifacts/backlog/IDEA-060-z-index-layering-tiers.md).
    Record it as a new Architecture Spine AD. Resolve the capture doc's three open questions (what the two
    EventDetailView z-50 sites are; whether Radix portals take their tier from a shared wrapper; Tailwind theme
    tokens vs CSS variables). Define the tiers, their names, and the migration rule. The ratchet must be a Vitest
    test, not an ESLint rule (packages/ui has no ESLint config; Story 0.41 / FIND-036). Do not modify source code.
    ```
  - **Then (fresh chat):**
    ```
    /bmad-create-story IDEA-060
    ```
    Check `epic-formation-gate.md` before splitting: about 25 files migrate, so it may want a
    mechanism story + adoption stories + a ratchet.

- [ ] **Step 5 — Remove `EventCardMediaSlot`'s unused internal favorite badge** (carved from IDEA-048's close)
  - **State:** `EventCardCompact.tsx` and `EventCard.tsx` both pass `hideFavoriteBadge`; the slot's
    badge code (`EventCardMediaPrimitives.tsx` about lines 255-266 with-image, about 281 fallback) is
    unused in production. It is still covered by tests (AC4 tests around lines 241-330 of the test
    file, Story 1.i1e's `hideFavoriteBadge` tests) and `packages/visual-audit/manifests/event-card-date-box-sizing.ts`.
  - **Why it needs care:** Story 1.i1m hit the same wall — it contradicts shipped ACs, so amend them
    explicitly rather than quietly deleting tests.
  - **Prompt:**
    ```
    /bmad-create-story Remove the unused internal favorite-badge rendering from EventCardMediaSlot
    (packages/ui/src/features/events/EventCardMediaPrimitives.tsx). Context: IDEA-048 is closed; both callers
    (EventCard.tsx, EventCardCompact.tsx) pass hideFavoriteBadge, so the slot's own with-image and fallback badge
    branches are unreachable in production. Scope: delete the dead branches and the props only they use
    (isFavorited, favoriteCount, onFavoriteToggle, labels on the slot, hideFavoriteBadge), rewrite or remove the
    tests that cover them (EventCardMediaPrimitives.test.tsx AC4 and Story 1.i1e blocks), update
    packages/visual-audit/manifests/event-card-date-box-sizing.ts, and amend the shipped ACs that assert the
    behavior (Story 1.i1e, Story 1.i1m, Story 1.i1z ratchet tests). Gate 3 must list every shipped AC this
    contradicts and get my confirmation before drafting. Add a backlog row (finding, internal, xs) for it.
    ```

### Group 3 — CC-024 / CC-023 tail (story creation then build)

Run these with `ritual-orchestrator`; each needs `create` then `dev`. Order matters where noted.

- [ ] **Step 6 — Story 3.6n2: expose the face-blurred thumbnail through the read path** (backlog row
      **FIND-070**, same work; CC-023 tail)
  - **Needs:** 3.6n (`review`). The only Wave 4C story left, and the only one with frontend scope.
    Served-URL rule already decided: "thumbnail fills the gap only".
  - [x] create (`19f90438`)  - [x] dev (`2b3e9451`..`196d9182`, status `review`, 2026-10-05)
  - **Result:** lint 8/8, build 8/8 (build probably cache-served), forced uncached tests with `TZ=UTC`:
    domain, ui, web all pass; backend 1087 run, 1060 pass, **24 fail, none from this story**
    (its own Case 4 integration test and `resolveServedImageUrl` cases pass). Causes of the 24, from
    the raw log: the dev database has not had migrations 0071/0072 applied (`manual_extraction_jobs`
    and `event_match_candidates` do not exist, 12 failures); leftover rows collide on
    `events_slug_unique` (3); two seed posts now carry real CloudFront durable image URLs, which the
    `eventBySlug`/Yoga test assumes are null (2); a 3.6z source-shape test expects
    `process-scrape-job.ts` to import `enqueuePostForProcessing` directly (1, file touched only by
    another session's commit `282a1e3c`); one moderator-accounts test (1); the rest are parent suites.
    All are FIND-064-style database state, not the read path.
  - **Follow-up, 2026-10-05:** migrations 0071/0072 turned out to be applied by then (all tables
    exist, 73 of 73). Re-running the backend suite alone: 1088 run, 1078 pass, **7 fail** (4 leaf).
    The slug collisions (3.7g, 3.6t) were **38 debris events from my own three earlier test runs**
    (names ending in a 13-digit timestamp, created 11:18/11:23/11:27): the first run aborted its
    cleanup on the then-missing tables and later runs collided with the fixed slugs. Deleted exactly
    those 38 (all dependents cascade); `process-ingestion-job.test.ts` then passes 16/16 and leaves the
    event count unchanged at 13, so the tests do clean up after themselves.
  - **Still failing, not this story, left alone:** `eventBySlug` / `events resolver integration via
    Yoga` (the two seed posts `60000000-...-0033`/`-0034` carry real CloudFront durable image URLs
    and the test asserts null for seed data) and `queryModeratorAccountProfiles - Happy Path` (335
    account profiles in the dev DB push the seeded account off the first page). Both are dev-DB state
    (FIND-064); the fix is test isolation, not data surgery.
  - **Prompt (original, for reference):**
    ```
    /ritual-orchestrator Dispatch bmad-create-story for 3-6n2-expose-the-face-blurred-thumbnail-through-the-read-path-and-widen-the-prominent-card-trigger
    (backlog row FIND-070, CC-023 tail), then bmad-dev-story for it. Inputs: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md
    (Wave 4C, 3.6n2 entry), AD-28, sprint-change-proposal-2026-09-30.md. Served-URL precedence is decided:
    "thumbnail fills the gap only" (original keeps serving while valid; once expired, opted-in gets durableImageUrl,
    non-opted-in gets durableThumbnailUrl instead of null). Test with TZ=UTC; backend suite alone. Update the
    batch state file after each item.
    ```

- [ ] **Step 7 — FIND-071: backfill post identity and re-key legacy hex slugs via aliases**
  - **State:** forward path fixed 2026-10-05 (`process-ingestion-job.ts`); already-ingested events
    keep legacy slugs. Needs an AD-16 / alias-aware migration; check 3.6v's `event_slug_aliases`
    machinery and its migration-number collision note in the CC-024 plan first (SQL must go through
    drizzle-kit, next sequential number).
  - [x] create (Story 3.22, `ebbaa09`, `ready-for-dev`, 2026-10-05)  - [ ] dev
  - **Create decision (user, 2026-10-05):** one-shot backfill script (sizing dry-run, then batched `--apply`, plus a manual `workflow_dispatch` workflow), not a scheduled lazy re-key. No DDL needed (Task 1 proves it with `generate`), so no migration; old-slug redirects reuse Story 3.6v's `event_slug_aliases` unchanged.
  - **Prompt:**
    ```
    /bmad-create-story FIND-071 (backlog.yaml): already-ingested events keep legacy hex slugs; backfill post
    identity and re-key slugs via aliases. Read AD-16 and AD-30 in the architecture spine, Story 3.7g, Story 3.6v
    (event_slug_aliases, enrichAndPromoteEvent re-slug path) and deferred-work.md for the 2026-10-05 quick-dev
    entry. Gate 1 must cover migration safety on a live table and old-slug redirects. Ask me via AskUserQuestion
    before choosing between a one-shot migration and a lazy re-key.
    ```

- [ ] **Step 8 — Wave 5: Stories 3.6w, 3.6x, 3.18** (all `backlog`, no story file yet)
  - **3.6w** merge duplicate events with slug redirects. Needs 3.6v and 4.7b (both `review`).
  - **3.6x** post collection page. Needs 3.6u (`review`); reuses the existing event-list UI.
  - **3.18** union-of-associations account filtering. Needs 3.15 and 3.6r (both `review`).
  - [x] 3.6w create (`625571b`, `ready-for-dev`, 2026-10-05)  - [x] 3.6w dev (`bf479b9`, `review`, 2026-10-06)  - [x] 3.6x create (`e40ca88`, `ready-for-dev`, 2026-10-05)  - [x] 3.6x dev (`160bc9c`, `review`, 2026-10-05)  - [x] 3.18 create (`a7756e3`, `ready-for-dev`, 2026-10-05)  - [x] 3.18 dev (`031a0f8`, `review`, 2026-10-05)
  - **3.6w create decisions (user, 2026-10-05):** review list is a new tab on `/moderator/tools` (the child counts it as the fourth tab, since Story 3.6g already added one); manual free-form merge is out of scope (backlog **IDEA-061**); the merge confirm dialog is split into new prerequisite **Story 0.47** (reusable `ConfirmActionDialog`, `backlog` in sprint-status although its file says `ready-for-dev`; 3.6w dev needs it built first). The child also found `apps/web/src/components/ui/dialog.tsx` is already Radix-backed, contrary to the premise in the question put to the user; see 0.47's Dev Notes.
  - **3.6x create decisions (user, 2026-10-05):** partial unique index on `posts(platform, platform_post_type, platform_post_id)` with a mandatory pre-migration dedupe check; Next/Previous nav context frozen into a URL param (mirrors the favorites branch). Gate 2 ran fresh, no split needed.
  - **3.18 create decisions (user, 2026-10-05):** remove the legacy `posts.accountId` leg (association-only); add the missing 3.6v AC3 ratchet test; extend the fix to `Query.event`/`eventBySlug` `includeMyArchived`. Backlog: CC-027 promoted, 3.17/3.19 carved to new CC-029.
  - **Prompt:**
    ```
    /ritual-orchestrator Run a batch for CC-024 Wave 5, in this order: 3-18-union-of-associations-account-filtering,
    3-6x-show-all-events-from-a-post-on-a-post-collection-page, 3-6w-let-moderators-merge-duplicate-events-with-slug-redirects.
    For each: bmad-create-story then bmad-dev-story. Inputs: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md
    (Wave 5 and the Dependency summary), AD-30, AD-31, PRD FR113/FR114. Prerequisites are at review, which the
    standing rule accepts. Surface every design question via AskUserQuestion; Gate 2 (UI) is per story for 3.6x and 3.6w.
    ```

### Group 4 — blocked on a decision from you

- [ ] **Step 9 — AD-32 guarded vendor-call wrapper, then 0.i2a → 0.i2c → 0.i2b → 0.i2z** (all `backlog`)
  - **Also:** FIND-004 vendor-DPA confirmation is your decision, not only a code change. BUG-012
    (Gemini request timeout) is covered by 0.i2c; Story 3.6s's inline guard is deleted when 0.i2c lands.
  - [ ] AD-32 written  - [ ] FIND-004 decision recorded  - [ ] 0.i2a  - [ ] 0.i2c  - [ ] 0.i2b  - [ ] 0.i2z
  - **Prompt:**
    ```
    /bmad-architecture Write AD-32, the guarded vendor-call wrapper decision (Architecture Spine currently ends at AD-31).
    Inputs: Stories 0.i2a/0.i2b/0.i2c/0.i2z in epics.md, backlog rows BUG-012 and FIND-004, and the inline Gemini guard
    in Story 3.6s (build-gemini-request.ts), which 0.i2c later replaces. The wrapper must cover callGemini and every async
    inference path. Ask me via AskUserQuestion about the FIND-004 vendor-DPA gate (what "confirmed" means and where it is
    enforced) before deciding. Do not modify source code.
    ```

### Group 5 — rows with no story that need a product/scope call

Decide each: skip (`skipped` with a `cost:`/`value:` note), `bmad-create-story`, or fold into an epic.

- [ ] **IDEA-034 — Moderator Tools accounts-tab card: location edit/clear** (`triaged`, Epic 4)
- [ ] **IDEA-036 — manual add/edit of event links in the Correct Data dialog** (`backlog`)
- [ ] **IDEA-037 — event-detail hashtags display, clickable** (`backlog`; BUG-032 data fix is in)
- [ ] **FIND-058 — `isAddedToCalendar` treatment across card families** (deferred; needs a product
      call on which families show it. Ready layout answer: reuse the sibling grid card's corner icon,
      `WeeklyCalendarView.tsx:1373-1379`)
- [ ] **FIND-031 / FIND-032 / IDEA-035** — event-detail client hygiene; label key-parity guardrail;
      scroll-to-top-on-filter-reset as an EXPERIENCE.md convention (all independent, quick-dev or
      create-story each)
- [ ] **Story 3.17, Story 3.19, Story 0.41 (FIND-036)** — all `backlog`; 3.17 and 3.19 were never
      readiness-swept
- [ ] **FIND-064** — backend integration tests share the developer database (explains most
      "red gate" noise; worth fixing before the next big batch)
- **Prompt (one at a time, replace the ID):**
  ```
  /bmad-help I need a decision on backlog row <ID> (see _bmad-output/implementation-artifacts/backlog.yaml). Read the row and its
  ref, verify against current code whether it still applies, then recommend skip / quick-dev / create-story with the reason,
  and ask me via AskUserQuestion before changing the row.
  ```

### Group 6 — closeout and housekeeping

- [ ] **Step 10 — CC-024 Wave 6 closeout** (after Steps 6-8)
  - One whole-repo lint + build + test pass, and a clean whole-repo `turbo build` confirmed on this
    Windows machine (it has only passed per-package in the sandbox).
  - Verify CC-024's success criteria (proposal §5) and CC-023's (proposal §6); update `backlog.yaml`
    for CC-024 (its `stories:` lists only 3.6r-3.6u; add 3.6v-3.6z, 3.6ua, 3.7f-3.7i, 3.13-3.16,
    3.18), CC-023, BUG-051 (still `backlog`), BUG-052, BUG-026, BUG-039.
  - Revisit the deferred rows IDEA-054 (notification burst throttling), IDEA-056 (LLM tie-break for
    mid-confidence matches), IDEA-051 (face-detection false-negative sampling).
  - **Prompt:**
    ```
    /ritual-orchestrator Run the CC-024/CC-023 batch-end gate (Step 4.5): whole-repo lint, build and test with TZ=UTC,
    volume seed cleaned, backend suite alone. Then walk the success criteria in
    _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md "Wave 6" and report which are verified, which are
    not, and why. Update backlog.yaml row statuses only where the story states in sprint-status.yaml justify it.
    ```

- [ ] **Step 11 — Housekeeping** (no prompt needed)
  - [ ] Push `master` (many local commits) or move them to a branch + PR.
  - [ ] Delete or fast-forward the stale `docs/cc-024-multi-event-posts-proposal` branch (at `1aca854e`).
  - [ ] Pre-existing `backlog-check.py` failures (not caused by today's work, 16 non-check-15 lines):
        stale derived statuses on BUG-018 (`done` but its story is `review`), BUG-044, CC-028,
        FIND-047, IDEA-026, IDEA-049, IDEA-050; broken `project-context.md` refs on FIND-047/FIND-048;
        five `deferred-work.md` sections with no quoting row. Worth one cleanup pass.

## Progress log

| Date | Step | Result | Commit |
|---|---|---|---|
| 2026-10-05 | Reconcile five plans | Done; IDEA-038/048/FIND-053 found already shipped | `6f9a5d04` |
| 2026-10-05 | Board fixes + IDEA-060 + this tracker | Done; dead-branch deletion deferred to Step 5 | `d68218c2` |
| 2026-10-05 | Steps 1, 2, 3 (quick-dev children) | Done; Step 3 recommends building the mount-stable masonry engine | `b11fc620`, `19788ae9`..`4c78d7e0`, `9d140826` |
| 2026-10-05 | Step 6: Story 3.6n2 create + dev via ritual-orchestrator (`all-claude-medium`) | Built, `review`; backend suite has 24 database-state failures, none from the story (see Step 6) | `19f90438`..`196d9182` |
| 2026-10-05 | Step 8: Story 3.18 create via ritual-orchestrator (`all-claude-medium`, cloud session) | `ready-for-dev`, 236-line story, verify-story PASS, no new stories | `a7756e3` |
| 2026-10-05 | Step 8: Story 3.6x create via ritual-orchestrator (`all-claude-medium`) | `ready-for-dev`, 268-line story, verify-story PASS, no new stories | `e40ca88` |
| 2026-10-05 | Step 8: Story 3.6w create via ritual-orchestrator (`all-claude-medium`) | `ready-for-dev`, 263-line story; new prerequisite Story 0.47 (172-line file, sprint-status `backlog`); IDEA-061 filed; verify-story PASS | `625571b` |
| 2026-10-05 | Step 3b: FIND-052 create via ritual-orchestrator (`all-claude-medium`; child killed by a container restart mid-question and resumed from its saved session) | Story 0.48 `ready-for-dev`, 209-line story, verify-story PASS; Story 0.47 set `ready-for-dev` | `7df5a60` + this commit |
| 2026-10-05 | Step 7: FIND-071 create via ritual-orchestrator (`all-claude-medium`; child hit a usage limit mid-run and was resumed after the reset) | Story 3.22 `ready-for-dev`, 218-line story, verify-story PASS. **Section A (create-story chain) complete: 3.18, 3.6x, 3.6w (+0.47), FIND-052 (0.48), FIND-071 (3.22). Stopped before any dev-story, awaiting the user.** | `ebbaa09` + this commit |
| 2026-10-05 | Section B: Story 3.18 dev via ritual-order (`all-claude-medium`, targeted tests only) | `review`; 8 files, ratchet test added, `Query.event`/`eventBySlug` archived check fixed, EXPLAIN gate run in a rolled-back transaction (no seq scan), lint/build/drizzle-generate clean. Pre-Coding gate approved by the orchestrator (user delegated routine gates; scope was exactly the user's create-story decisions). Denied one child INSERT into the shared DB (FIND-064 hazard). | `031a0f8` |
| 2026-10-05 | Section B: Story 3.6x dev (`all-claude-medium`; child killed by two container restarts and resumed from its saved session each time) | `review`; 24 files, migration `0073` (drizzle-kit generated, `WHERE` predicate hand-added per the repo's documented AD-8 workaround), `Query.postByPlatformIdentifiers`, widened `relatedEventIds(postId)`, new page + `'post'` nav branch, EXPLAIN doc, i18n en/id. Child-reported: 113 backend + 1 database + 19 web targeted tests pass; scoped lint/build clean. **Gate approved by the user** (schema + UI). Denied: `seed:volume` as written (re-submitted with same-step cleanup), whole-repo lint. **Open at batch end:** the story's Testing/Deliverables/DoD checklists (16 boxes) and Completion Status ("Not started") were left stale by the child; reconcile after my own test evidence. | `160bc9c` |
| 2026-10-05 | Section B: Story 0.47 dev (`all-claude-medium`) | `review`; `ConfirmActionDialog` in `packages/ui/src/core` on the existing Radix dialog (`^1.1.21`, same range as `apps/web`); 7 new tests, full `packages/ui` suite 876/876, `packages/ui` lint/tsc clean. Gate approved by the orchestrator (fully specified, no design/architecture decision). Lockfile: the child's `pnpm install` rewrote 161 unrelated lines; I reverted it to the committed lockfile plus the single 3-line importer entry and confirmed `pnpm install --frozen-lockfile --offline` passes. Denied an `npm view` registry lookup. **Not done: the manual browser smoke check of focus-in/focus-return (no browser in the cloud env); verify by hand before relying on it.** Whole-repo lint/build left to the batch-end pass. | `64b0555` |
| 2026-10-06 | Story 3.6w dev via ritual-orchestrator (`all-claude-medium`; child restarted twice, Pre-Coding gate approved by the user). Migration 0074 (`event_merges` + 3 columns), backend merge/undo, "Duplicate Events" tab using ConfirmActionDialog. verify-story PASS, status `review`; 5 story checkboxes unchecked, reconcile at the batch-end pass. Orchestrator self-approved the 3.18 and 0.47 gates (routine, non-architectural); 0.47 manual focus smoke check still outstanding. Migrations 0073/0074 applied to the local DB only. | `review` | bf479b9 + this commit |
| 2026-10-06 | Story 0.48 (FIND-052 mount-stable masonry) dev via ritual-orchestrator (`all-claude-medium`). The first child attached to the wrong story (0.24, picked by a "next ready-for-dev" lookup), was stopped before any change and relaunched pinned to the 0.48 file. Two commits (the first was an accidental rename-only commit from a pathspec error; the second holds the content). verify-story PASS, status `review`. Open: 20 unchecked story boxes to reconcile at the batch-end pass; the Playwright visual-audit proof could not run (no browser binaries in this sandbox) and needs a follow-up run. | `review` | 9348909 + this commit |
