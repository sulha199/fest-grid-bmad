# Event Pages & CC-024 — Follow-up Tracker (2026-10-05)

**Created:** 2026-10-05
**Last reconciled against `sprint-status.yaml` / `backlog.yaml` / master:** 2026-10-07 (after PRs #52, #53, #54, #55)
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
- [x] **Done in step 5 (2026-10-07, PR #54):** deleting the favorite-badge branches inside `EventCardMediaSlot`.
      They were unused by production callers but a tested contract (AC4 and Story 1.i1e's
      additive props, a `visual-audit` manifest), so the delete amended those tests and ACs (see step 5).

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
    - **Reconciled 2026-10-07:** Stories 0.47 and 0.48 are both `review` in sprint-status (0.47 was `backlog` when this was written). Backlog row **CC-030** (`triaged`, from PR #53) is the follow-up for Phase 2 layout defects found by a real-browser run; its note still lists remaining work (sibling-gap rule, Phase 2 manifest, 0.48 AC2/AC14, AD-27 wording), so the 0.48 browser proof is **not** closed by the backlog yet, whatever the earlier log row says.
    - **Decision (user, 2026-10-05):** two-phase render (CSS-grid flow until the first measurement, then absolute + transform) to avoid the SSR/CLS height collapse; tab-order change is AC4. Story 0.47 was set to `ready-for-dev` in sprint-status at the user's call.

- [x] **Step 4 — IDEA-060: z-index layering tiers** (architecture first, then one story) — DONE 2026-10-07 via PR #54 (merged): **AD-33** + Stories 0.49, 0.49a-0.49e, all at `review`
  - [x] architecture (`6b486a82`, AD-33)  - [x] create (`55e34dbf`, six stories, all `ready-for-dev`)  - [x] dev (0.49 `6b8e3b87`; 0.49a `ebdc9608`; 0.49b `e07295f9` WIP + `fc90333b` close-out; 0.49c `58069bf5`; 0.49d `dfe45a05`; 0.49e `bdf3ed38`; all `review`, verify-story PASS)
  - **Number is AD-33, not AD-32:** the backend lane's branch already used AD-32 for the guarded vendor-call wrapper (Step 9), so the z-index AD was renumbered to AD-33 before commit. Step 9 still writes AD-32.
  - **Decisions (user, 2026-10-06):** kebab dropdown in the Overlay-modal tier; Radix overlays share one imported constant (`OVERLAY_MODAL_Z`); Tailwind theme tokens only, no CSS variables; plain Epic 0 stories rather than an `epic-0-i8` (one row fails `epic-formation-gate.md` criterion 1); four adoption groups by consumer area. Tiers: Local (bare `z-0/10/20/30`), Chrome 40, Overlay-sticky 45, Overlay-modal 50, Overlay-blocking 60.
  - **Stories:** 0.49 tokens (both Tailwind configs, incl. the visual-audit vendor mirror) + `OVERLAY_MODAL_Z`; 0.49a Radix wrappers; 0.49b AppShell + blocking loader; 0.49c events overlays + summary bar; 0.49d three suggestion dropdowns; 0.49e Vitest ratchet (2 assertions, passes on the merged tree, proven to fail on a reverted scratch edit).
  - **User-visible, not browser-checked:** two intentional stacking changes in 0.49c, `CalendarOverflowDialog` backdrop 40 to 50 and `summary-bar` 50 to 45 (both sanctioned by AD-33).
  - **Self-approved Pre-Coding gates (orchestrator, routine):** 0.49, 0.49a, 0.49b, 0.49c, 0.49d, 0.49e.
  - **New backlog rows:** FIND-077 (visual-audit's vendor Tailwind config is a second hand-maintained theme with no sync check; `backlog`, mitigated in 0.49 by a one-time mirror). IDEA-060 is now `promoted` to the six stories.
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

- [x] **Step 5 — Remove `EventCardMediaSlot`'s unused internal favorite badge** (carved from IDEA-048's close) — DONE 2026-10-07 via PR #54 (merged): Story **1.i1p**, `review`, backlog row **FIND-076**
  - [x] create (`d0e01c85`, `ready-for-dev`)  - [x] dev (`e99717fa`, `review`, verify-story PASS)
  - **Gate 3 (user confirmed before drafting):** the removal contradicted shipped ACs in 1.i1a (AC3/4/5), 1.i1e (AC4 wording, Task 1), 1.i1m (AC4 wording) and the 1.i1z ratchet tests (recorded as a Change Log entry), plus Architecture Spine AD-15 Rule 4 (reworded to a per-consumer guarantee, re-cited to the `EventCard`/`EventCardCompact` tests). All amended.
  - **Result:** the slot's two badge branches and the five props only they used are gone; `EventCard.test.tsx` and `EventCardCompact.test.tsx` pass unmodified (87/87, identical rendered output at both call sites); `EventCardMediaPrimitives.test.tsx` 84/84 after the rewrite; visual-audit manifest comment fixed.
  - **Backlog ID:** created as FIND-073, renumbered to **FIND-076** at merge because PR #53 landed a different FIND-073 (masonry date-box text clipping) on master first. Commit messages `d0e01c85`/`e99717fa` still say FIND-073.
  - **State (before):** `EventCardCompact.tsx` and `EventCard.tsx` both pass `hideFavoriteBadge`; the slot's
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

- [x] **Step 6 — Story 3.6n2: expose the face-blurred thumbnail through the read path** (backlog row
      **FIND-070**, same work; CC-023 tail) — BUILT 2026-10-05, `review` (sprint-status), FIND-070 `promoted`
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

- [x] **Step 7 — FIND-071: backfill post identity and re-key legacy hex slugs via aliases** — BUILT 2026-10-06, Story 3.22 `review` (sprint-status), FIND-071 `promoted`; the backfill itself has not been run anywhere
  - **State:** forward path fixed 2026-10-05 (`process-ingestion-job.ts`); already-ingested events
    keep legacy slugs. Needs an AD-16 / alias-aware migration; check 3.6v's `event_slug_aliases`
    machinery and its migration-number collision note in the CC-024 plan first (SQL must go through
    drizzle-kit, next sequential number).
  - [x] create (Story 3.22, `ebbaa09`, `ready-for-dev`, 2026-10-05)  - [x] dev (`a086359`, `review`, 2026-10-06)
  - **Create decision (user, 2026-10-05):** one-shot backfill script (sizing dry-run, then batched `--apply`, plus a manual `workflow_dispatch` workflow), not a scheduled lazy re-key. No DDL needed (Task 1 proves it with `generate`), so no migration; old-slug redirects reuse Story 3.6v's `event_slug_aliases` unchanged.
  - **Prompt:**
    ```
    /bmad-create-story FIND-071 (backlog.yaml): already-ingested events keep legacy hex slugs; backfill post
    identity and re-key slugs via aliases. Read AD-16 and AD-30 in the architecture spine, Story 3.7g, Story 3.6v
    (event_slug_aliases, enrichAndPromoteEvent re-slug path) and deferred-work.md for the 2026-10-05 quick-dev
    entry. Gate 1 must cover migration safety on a live table and old-slug redirects. Ask me via AskUserQuestion
    before choosing between a one-shot migration and a lazy re-key.
    ```

- [x] **Step 8 — Wave 5: Stories 3.6w, 3.6x, 3.18** — BUILT 2026-10-05/06, all three plus prerequisite 0.47 are `review` (sprint-status); they were `backlog` with no story file when this step was written
  - **3.6w** merge duplicate events with slug redirects. Needs 3.6v and 4.7b (both `review`).
  - **3.6x** post collection page. Needs 3.6u (`review`); reuses the existing event-list UI.
  - **3.18** union-of-associations account filtering. Needs 3.15 and 3.6r (both `review`).
  - [x] 3.6w create (`625571b`, `ready-for-dev`, 2026-10-05)  - [x] 3.6w dev (`bf479b9`, `review`, 2026-10-06)  - [x] 3.6x create (`e40ca88`, `ready-for-dev`, 2026-10-05)  - [x] 3.6x dev (`160bc9c`, `review`, 2026-10-05)  - [x] 3.18 create (`a7756e3`, `ready-for-dev`, 2026-10-05)  - [x] 3.18 dev (`031a0f8`, `review`, 2026-10-05)
  - **3.6w create decisions (user, 2026-10-05):** review list is a new tab on `/moderator/tools` (the child counts it as the fourth tab, since Story 3.6g already added one); manual free-form merge is out of scope (backlog **IDEA-062**); the merge confirm dialog is split into new prerequisite **Story 0.47** (reusable `ConfirmActionDialog`, `backlog` in sprint-status although its file says `ready-for-dev`; 3.6w dev needs it built first). The child also found `apps/web/src/components/ui/dialog.tsx` is already Radix-backed, contrary to the premise in the question put to the user; see 0.47's Dev Notes.
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

- [x] **Step 9 — AD-32 guarded vendor-call wrapper, then 0.i2a → 0.i2c → 0.i2b → 0.i2z** — DONE 2026-10-08 via PR #57 (merged, `ffeced6`): AD-32 written, FIND-004 decided, Stories 0.i2a/0.i2c/0.i2b/0.i2z at `review`
  - **Reconciled 2026-10-08 (master `ffeced6`):** all four stories and AD-32 are on master; the four stories are `review` in sprint-status (code review not run). FIND-004 decided by the user: the vendors' public docs (logged-out, public data only) plus *Meta v. Bright Data* count as the confirmation; the gate covers Apify and Bright Data only (`APIFY_SCRAPING_CONFIRMED` / `BRIGHTDATA_SCRAPING_CONFIRMED`, default true, false is a kill switch). Migration 0076 adds `vendor_call_locks`. New backlog-only Story **0.i2d** (adopt the wrapper at the Apify/Bright Data call sites; must empty the 0.i2z ratchet's allowlist) and new row **FIND-079** (the subscribe path never checks whether an Instagram account is private). BUG-011/DW-068 and BUG-012 are closed by 0.i2b/0.i2c per the PR.
  - **Also:** FIND-004 vendor-DPA confirmation is your decision, not only a code change. BUG-012
    (Gemini request timeout) is covered by 0.i2c; Story 3.6s's inline guard is deleted when 0.i2c lands.
  - [x] AD-32 written  - [x] FIND-004 decision recorded  - [x] 0.i2a  - [x] 0.i2c  - [x] 0.i2b  - [x] 0.i2z
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

- [x] **IDEA-034 — Moderator Tools accounts-tab card: location edit/clear** (`triaged`, Epic 4) — **DECIDED 2026-10-06 (user): create a story (reuse set-default-location dialog + existing mutations; ConfirmActionDialog for clear).**
- [x] **IDEA-036 — manual add/edit of event links in the Correct Data dialog** (`backlog`) — **DECIDED 2026-10-06 (user): create a story with a Gate 2 UX pass for the repeatable url+label input.**
- [x] **IDEA-037 — event-detail hashtags display, clickable** (`backlog`; BUG-032 data fix is in) — **DECIDED 2026-10-06 (user): create a story (BUG-032 is done, hashtags are persisted).**
- [x] **FIND-058 — `isAddedToCalendar` treatment across card families** (deferred; needs a product — **DECIDED 2026-10-06 (user): quick-dev the spanning-bar fix (copy the single-day card corner icon) + visual-audit check; other card families unchanged.**
      call on which families show it. Ready layout answer: reuse the sibling grid card's corner icon,
      `WeeklyCalendarView.tsx:1373-1379`)
- [x] **FIND-031 / FIND-032 / IDEA-035** — event-detail client hygiene; label key-parity guardrail; — **DECIDED 2026-10-06 (user): FIND-031 quick-dev; FIND-032 create a story (Vitest key-parity ratchet); IDEA-035 quick-dev the EXPERIENCE.md doc update.**
      scroll-to-top-on-filter-reset as an EXPERIENCE.md convention (all independent, quick-dev or
      create-story each)
- [x] **Story 3.17, Story 3.19, Story 0.41 (FIND-036)** — all `backlog`; 3.17 and 3.19 were never — **DECIDED 2026-10-06 (user): 3.17 + 3.19: readiness sweep together, then create and build; 0.41: measured 0 errors / 167 warnings in 48 files, fix all in the story.**
      readiness-swept
- [x] **FIND-064** — backend integration tests share the developer database (explains most — **DECIDED 2026-10-06 (user): create a story for a dedicated test database (dev DB leaked to 72 posts vs 35 baseline on 2026-10-06).**
      "red gate" noise; worth fixing before the next big batch)
- **Outcome of the Group 5 decisions, reconciled 2026-10-07 from sprint-status / backlog:**
  - IDEA-034 → Story **4.9**; IDEA-036 → Story **4.10**; IDEA-037 → Story **1.6g**; FIND-032 → Story **0.50**; FIND-036 → Story **0.41**; FIND-064 → Story **0.51** (renumbered from 0.49, which the UI lane took for AD-33); FIND-022 CAP-5 → Story **3.17** (backlog **CC-029**); FIND-022 CAP-8 → Story **3.19** (backlog **CC-031**). All eight are `ready-for-dev`; their rows are `promoted`.
  - FIND-031 (`2abbcffe`) and IDEA-035 (`dcbe7873`, EXPERIENCE.md convention) are `done` in backlog.
  - **FIND-058 is still `backlog`** in backlog.yaml although its spanning-bar quick-dev shipped (`f9bd91f`): the row's treatment of the other card families stays deferred. The row, not this box, is the source of truth; close or re-scope it in backlog.yaml if you consider it finished.
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
| 2026-10-05 | Step 8: Story 3.6w create via ritual-orchestrator (`all-claude-medium`) | `ready-for-dev`, 263-line story; new prerequisite Story 0.47 (172-line file, sprint-status `backlog`); IDEA-062 filed; verify-story PASS | `625571b` |
| 2026-10-05 | Step 3b: FIND-052 create via ritual-orchestrator (`all-claude-medium`; child killed by a container restart mid-question and resumed from its saved session) | Story 0.48 `ready-for-dev`, 209-line story, verify-story PASS; Story 0.47 set `ready-for-dev` | `7df5a60` + this commit |
| 2026-10-05 | Step 7: FIND-071 create via ritual-orchestrator (`all-claude-medium`; child hit a usage limit mid-run and was resumed after the reset) | Story 3.22 `ready-for-dev`, 218-line story, verify-story PASS. **Section A (create-story chain) complete: 3.18, 3.6x, 3.6w (+0.47), FIND-052 (0.48), FIND-071 (3.22). Stopped before any dev-story, awaiting the user.** | `ebbaa09` + this commit |
| 2026-10-05 | Section B: Story 3.18 dev via ritual-order (`all-claude-medium`, targeted tests only) | `review`; 8 files, ratchet test added, `Query.event`/`eventBySlug` archived check fixed, EXPLAIN gate run in a rolled-back transaction (no seq scan), lint/build/drizzle-generate clean. Pre-Coding gate approved by the orchestrator (user delegated routine gates; scope was exactly the user's create-story decisions). Denied one child INSERT into the shared DB (FIND-064 hazard). | `031a0f8` |
| 2026-10-05 | Section B: Story 3.6x dev (`all-claude-medium`; child killed by two container restarts and resumed from its saved session each time) | `review`; 24 files, migration `0074` (drizzle-kit generated, `WHERE` predicate hand-added per the repo's documented AD-8 workaround), `Query.postByPlatformIdentifiers`, widened `relatedEventIds(postId)`, new page + `'post'` nav branch, EXPLAIN doc, i18n en/id. Child-reported: 113 backend + 1 database + 19 web targeted tests pass; scoped lint/build clean. **Gate approved by the user** (schema + UI). Denied: `seed:volume` as written (re-submitted with same-step cleanup), whole-repo lint. **Open at batch end:** the story's Testing/Deliverables/DoD checklists (16 boxes) and Completion Status ("Not started") were left stale by the child; reconcile after my own test evidence. | `160bc9c` |
| 2026-10-05 | Section B: Story 0.47 dev (`all-claude-medium`) | `review`; `ConfirmActionDialog` in `packages/ui/src/core` on the existing Radix dialog (`^1.1.21`, same range as `apps/web`); 7 new tests, full `packages/ui` suite 876/876, `packages/ui` lint/tsc clean. Gate approved by the orchestrator (fully specified, no design/architecture decision). Lockfile: the child's `pnpm install` rewrote 161 unrelated lines; I reverted it to the committed lockfile plus the single 3-line importer entry and confirmed `pnpm install --frozen-lockfile --offline` passes. Denied an `npm view` registry lookup. **Not done: the manual browser smoke check of focus-in/focus-return (no browser in the cloud env); verify by hand before relying on it.** Whole-repo lint/build left to the batch-end pass. | `64b0555` |
| 2026-10-06 | Story 3.6w dev via ritual-orchestrator (`all-claude-medium`; child restarted twice, Pre-Coding gate approved by the user). Migration 0075 (`event_merges` + 3 columns), backend merge/undo, "Duplicate Events" tab using ConfirmActionDialog. verify-story PASS, status `review`; 5 story checkboxes unchecked, reconcile at the batch-end pass. Orchestrator self-approved the 3.18 and 0.47 gates (routine, non-architectural); 0.47 manual focus smoke check still outstanding. Migrations 0074/0075 applied to the local DB only. | `review` | bf479b9 + this commit |
| 2026-10-06 | Story 0.48 (FIND-052 mount-stable masonry) dev via ritual-orchestrator (`all-claude-medium`). The first child attached to the wrong story (0.24, picked by a "next ready-for-dev" lookup), was stopped before any change and relaunched pinned to the 0.48 file. Two commits (the first was an accidental rename-only commit from a pathspec error; the second holds the content). verify-story PASS, status `review`. Open: 20 unchecked story boxes to reconcile at the batch-end pass; the Playwright visual-audit proof could not run (no browser binaries in this sandbox) and needs a follow-up run. | `review` | 9348909 + this commit |
| 2026-10-06 | Story 3.22 (FIND-071 backfill legacy hex slugs) dev via ritual-orchestrator (`all-claude-medium`). One-shot idempotent backfill script (dry-run default, `--apply`) plus support module, tests, and a manual-only `workflow_dispatch` workflow (`environment: production`, dry-run by default), no DDL, no new migration. Denied along the way: migration generation (no DDL), reading `.env`, `find /`. verify-story PASS, status `review`; 20 unchecked story boxes to reconcile at the batch-end pass. **The backfill has not been run against any real environment; running it is a manual, human-triggered step.** **Section B (dev-story) complete for all six: 3.18, 3.6x, 0.47, 3.6w, 0.48, 3.22, all at `review`. Next: the batch-end whole-repo pass.** | `review` | a086359 + this commit |
| 2026-10-06 | **Batch-end pass** (whole repo, `--env-mode=loose`, `TZ=UTC`, backend suite alone). **Build** 8/9: only `@festgrid/ai-dev-orchestrator` fails (type errors in its own `node-context.test.ts`; untouched by this work, pre-existing). **Lint** 8/9: same package, 1 unused-var error, pre-existing. **Non-backend tests** all green after one fix: Story 3.6x's real-DB `unique-index.test.ts` used `node:test` but was picked up by vitest, so it was renamed `unique-index.integration.test.ts` (the existing convention) with a `test:unique-index` script. **Backend suite** 1138 tests: 28 failed; **6 were a Story 3.18 regression**: removing the legacy `posts.account_id` leg meant fixture posts in `match-event-to-existing.test.ts` and `process-ingestion-job.test.ts` had no `post_account_associations` row, so organizer-match never fired (high scored mid). Fixed by seeding the PUBLISHER row; both files now pass 26/26. The remaining 22 failures are the known cloud-only set (geolocation needs `GEOAPIFY_API_KEY`, one Bright Data trigger test). **DB check:** events 12, `event_merges` 0 (clean), but posts are 72 vs the 35 baseline: the extra rows come from older test files that never clean up (e.g. `persist-post-account-associations.test.ts` has no deletes; unchanged by this work), the known shared-dev-DB leak (FIND-064). Story checklists reconciled against this evidence; still unchecked on purpose: 0.47 manual focus smoke check (2), 3.6w reference-read boxes + `epics.md` amendment (5), 0.48 Playwright visual-audit proof (1). | n/a | this commit + 3 earlier fix commits |
| 2026-10-06 | **Group 5 product calls (all decided by the user)**: IDEA-034 create story; IDEA-036 create story + UX pass; IDEA-037 create story; FIND-058 quick-dev; FIND-031 quick-dev; FIND-032 create story; IDEA-035 quick-dev (doc); Stories 3.17 + 3.19 sweep then build; Story 0.41 fix all 167 warnings; FIND-064 create story. No backlog rows changed yet; each promotes when its story is created. **PR #52** (master merged, migrations renumbered 0074/0075, `IDEA-061`->`IDEA-062` for our idea) open, CI running. Lanes A (UI: Steps 5 then 4) and B (backend: Step 9) run in separate sessions on branches from this one. | n/a | this commit |
| 2026-10-07 | **PR #52 merged to master** (`0fb6a3e`, CI green) after merging master and renumbering migrations (0073 master `posts.title`, 0074 = 3.6x, 0075 = 3.6w). Lanes A (UI) and B (backend) spawned by the user in separate sessions; they must retarget to master and re-check migration numbers (next free 0076) and story/backlog IDs on merge. | merged | `0fb6a3e` |
| 2026-10-07 | **Lane A (UI), Step 5: Story 1.i1p** via ritual-orchestrator (`all-claude-medium`, one story in flight). Create then dev. Gate 3 listed every shipped AC the removal contradicts (1.i1a AC3/4/5, 1.i1e AC4, 1.i1m AC4, 1.i1z ratchet, AD-15 Rule 4) and the user confirmed before drafting; the create child briefly implemented the source change to validate its plan (84/84 and 87/87 targeted tests), then reverted it so the dev step owns the code. `review`, verify-story PASS. Backlog row created as FIND-073, renumbered **FIND-076** at merge (PR #53 put a different FIND-073 on master). **Incident:** the orchestrator's `--checks test` option starts a whole-repo `pnpm test` (it connected to localhost:5432); I killed it about a minute in. Whether a backend test touched the dev database in that minute is unknown, so check it for debris. Later dev children were dispatched without that gate. | `review` | `d0e01c85`, `e99717fa` |
| 2026-10-07 | **Lane A (UI), Step 4: AD-33 + Stories 0.49, 0.49a-0.49e** via ritual-orchestrator. Architecture (user answered the three open questions; AD renumbered from AD-32, which the backend lane owns), create (user chose plain Epic 0 stories, four adoption groups), then dev in dependency order. All six at `review`, verify-story PASS, ratchet 2/2 on the merged tree. Gates self-approved by the orchestrator: 0.49, 0.49a-0.49e. Two intentional stacking changes in 0.49c (`CalendarOverflowDialog` backdrop 40 to 50, `summary-bar` 50 to 45), not browser-checked. Usage limits interrupted 0.49a, 0.49b and 0.49d; their saved sessions were resumed, so 0.49b has a WIP commit plus a close-out commit. Denied along the way: whole-package vitest, whole-repo lint, `apps/web` production build, `git stash` of a child's own files, a commit with a wrong trailer. New row FIND-077 (visual-audit vendor Tailwind config has no sync check). Pre-existing `apps/web` `tsc` TS5101 tsconfig error recorded in 0.49b. | `review` | `6b486a82`, `55e34dbf`, `6b8e3b87`, `ebdc9608`, `e07295f9`+`fc90333b`, `58069bf5`, `dfe45a05`, `bdf3ed38` |
| 2026-10-07 | **PR #54 merged** (lane A: Steps 5 and 4). Master was merged into the lane first (conflicts only in `backlog.yaml` and `sprint-status.yaml`; master's FIND-073 kept, this lane's rows renumbered FIND-076/FIND-077, AD-33 unique in the spine). `backlog-check.py` stays at the 16-line baseline. **Still open:** `bmad-code-review` for all seven stories; a browser look at the two 0.49c stacking changes; the dev-DB debris check above. | n/a | `1bda4d28`, PR `f8f84558` |
| 2026-10-07 | Group 5 create-story chain via ritual-orchestrator (`all-claude-medium`): Stories 0.41, 0.51 (renumbered from 0.49 on 2026-10-07, the UI lane took 0.49 for AD-33 z-index tiers), 0.50, 4.9, 1.6g, 4.10, 3.17, 3.19 all `ready-for-dev`, verify-story PASS. 3.17 questions answered by the user (shared helper refactoring both call sites; backfill deferred and documented). 3.19 `source`/`errorCode` vocabulary chosen by the orchestrator (toggle-instance label; `'unknown'` fallback). Dev for these is not started. | `ready-for-dev` | `658c587`..`ac80dd7` |
| 2026-10-07 | Group 5 quick-devs via ritual-orchestrator (`all-claude-medium`), one at a time: **FIND-058** (CalendarPlus corner icon on `MultiDaySpanningBar`; Playwright audit not run, no browser binaries; masonry `EventCard` stays deferred) `f9bd91f`; **FIND-031** (mapper memoized, carousel-peek on `next/image` with `unoptimized`; hero `EventImage` stays raw `<img>` because `packages/ui` must stay framework-agnostic, carved out as **FIND-075**, skipped; the child first filed it as FIND-074, which collides with the UI lane branch, so it was renumbered) `2abbcff`; **IDEA-035** (scroll-to-top-on-filter-reset convention added to `EXPERIENCE.md`, docs only) `dcbe787`. FIND-031 was interrupted once by a usage limit and resumed from its saved session. | done | `f9bd91f`, `2abbcff`, `dcbe787` |
| 2026-10-07 | **Tracker reconciled against master** (PRs #52-#55 merged; one conflict, in this file's progress log, kept both sides in order). Ticked Steps 6, 7 and 8 (built, `review` per sprint-status); fixed Step 8's stale "all `backlog`" header; added the Group 5 outcome (stories 4.9, 4.10, 1.6g, 0.50, 0.41, 0.51, 3.17, 3.19 all `ready-for-dev`; FIND-031 and IDEA-035 `done`; FIND-058 still `backlog`); noted in Step 9 that AD-32 is not on master and the spine now reads AD-31 then AD-33; noted in Step 3b that CC-030 keeps the 0.48 browser proof open. Merged tree checked: no duplicate backlog IDs, sprint-status keys, story numbers, AD headings or epics.md headings; AD-33 ratchet passes on master's new UI changes; `backlog-check.py` stays at the 16-line baseline. | n/a | `56941455` + this commit |
| 2026-10-08 | **PRs #56 and #57 merged.** #56 was the UI lane's own tracker update (Steps 4-5). #57 was the backend lane (Step 9): AD-32, migration 0076, Stories 0.i2a/0.i2c/0.i2b/0.i2z at `review`, new backlog-only 0.i2d, FIND-079 (renumbered from FIND-073 on its master merge). The lane's FIND-004 decision is recorded above. | merged | `ffeced6` |
| 2026-10-08 | **Reconciled against master `ffeced6`.** Step 9 ticked. Master pushes run the prod `Database Migrations` and `Deploy Infrastructure to AWS` jobs; both succeeded on #55 (`5e05dcb`) and #57 (`ffeced6`), so migrations 0074-0076 are applied in prod through CI (3.6x's dedupe pre-check was not separately evidenced). Remaining: Step 10 closeout (now unblocked), Step 11 housekeeping, code review of everything at `review`, dev for the 8 new `ready-for-dev` stories, the manual checks listed in the follow-up summary, and one stale-ID fix (FIND-004's note said FIND-073 where FIND-079 is meant). | reconciled | this commit |
| 2026-10-08 | **Batch readiness sweep for 3.17, 3.19, 1.6g, 4.9, 4.10** run in a separate session; **PR #58 open, not merged** (docs and backlog only, mergeable `clean`, branch `claude/readiness-sweep-group5`, report `epic-readiness/batch-group5-readiness.md`). Verdicts: 3.17, 3.19, 1.6g, 4.10 ready (3.17 line refs corrected; 1.6g was missing `pnpm --filter backend codegen`); **4.9 blocked on FIND-080**. New rows: **FIND-080** (`ConfirmActionDialog` never resets `isConfirming` after a successful confirm, so a reopened dialog is stuck disabled; live today in the Duplicate Events tab; I re-read the source and the bug is real), **FIND-081** (the dialog has no AD-33 z-index tier, paints under the nav rail), **IDEA-064** (tracks 3.17's deferred backfill only, deletable). Two scope changes you approved in that session: 4.9 gains AC15 (`setAccountDefaultLocation` needs a moderator path via AD-11 `asModeratorCorrection`) and 4.10 changes semantics (omitted `links` = unchanged, `[]` = clear). Only 4.9 uses `ConfirmActionDialog`, not 4.10. No migration needed (next free is 0077). **Dev order now: FIND-080 + FIND-081 quick-dev, then 3.17, 3.19, 1.6g, 4.10, 4.9**; 0.50, 0.51 and 0.41 are outside the sweep (0.41 last). | sweep done, PR open | `7352c04` (PR #58 head) |
| 2026-10-08 | **PR #58 merged** (`aae78df`), then the **Group 5 dev lane finished in a separate session: PR #60 open, not merged** (`claude/group5-dev-lane`, head `ee4c7b9c`, mergeable `clean`, CI green, Copilot review still running). Seven commits: FIND-080 + FIND-081 `12c9d829` (both set `done` in backlog.yaml since finding rows have no review state), Story 3.17 `b38f299a`, 3.19 `100eaed0`, 1.6g `1e6ff05c`, 4.10 `59f92130`, 4.9 `7a61ce15` + type-error fix `ee4c7b9c`. All five stories are `review`; no code review run, no migration (next free 0077), no new IDs. Whole-repo pass: lint passes; web build needs the sandbox CA bundle for Google Fonts and then compiles all 39 pages; ui, web, domain, database, analytics pass; infrastructure 8 failures (CDK bundling needs network); backend 23 of 1214 fail, one more than the ~22 baseline because the new 4.9 AC15 moderator test fails on `GEOAPIFY_API_KEY` like its siblings. **Not verified:** every browser or visual check, and 4.9's AC15 moderator case plus the clear-mutation supersede case (need a Geoapify key or a mocked geocoder). Decisions waiting on you in the PR body: FIND-080/081 `done` vs `backlog` until reviewed; a dedupe line added to `apps/web/fix-codegen.js` for `EventLinkInput`; 3.17 was built while 3.16 is still at `review`; an extra ratchet assertion was added under FIND-081. | PR open | `ee4c7b9c` |
| 2026-10-08 | **PR #60 merged** (`47bd77e`). Copilot raised five findings; all fixed in `dd8b09d` and resolved before the merge: `clearAccountDefaultLocation` update now conditional on a non-null location (throws `INVALID_STATE_TRANSITION` otherwise); in 3.17 the `isVerifiedForDiscovery` flip now runs AFTER the vote write on all three outcomes (a failed vote write can no longer leave a profile discoverable; a retry re-runs it); 3.19 failure payloads read the mutation's own `variables` instead of shared state; `ConfirmActionDialog` also resets on a synchronous `onConfirm` throw; `AccountLocationField` types require `clearLabel` whenever `onClear` is given. State on master: FIND-080/081 `done`; Stories 3.17, 3.19, 1.6g, 4.9, 4.10 `review`; IDEA-064 `backlog`; 0.50, 0.51, 0.41 still `ready-for-dev`. Starting dev on 0.50 then 0.51 in this session. | merged | `47bd77e` |
