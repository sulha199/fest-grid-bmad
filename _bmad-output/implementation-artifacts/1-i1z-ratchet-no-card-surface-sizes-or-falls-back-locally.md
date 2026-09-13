---
baseline_commit: 44fec2522f39cfbe7138a6b3045aa98705270847
---

# Story 1.i1z: Ratchet — no card surface sizes or falls back locally

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1z
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an enforced, CI-wired guarantee that the invariant holds,
so that a fifth card surface cannot reintroduce its own image sizing or its own fallback.

## Acceptance Criteria

1. **Given** the full codebase, **when** the repo-wide sweep runs in CI, **then** it fails if `EventCardMediaPrimitives.tsx` (the shared primitive itself) or either of its two adopting call sites — `EventCard.tsx`'s masonry `prominentPoster=false` branch and `WeeklyCalendarView.tsx`'s `CalendarCard` `variant='list'` branch — renders an image slot, thumbnail, favorite icon or date badge with a hardcoded dimension class instead of routing through the `event_card_*` primitive components (`EventCardMediaSlot`/`EventCardDateBox`/`EventCardFavoriteBadge`). **This is a narrowed scope, confirmed by the user via `AskUserQuestion` during this story's creation** (see Dev Notes — User-Resolved Design Decisions, Decision 1): `EventCard.tsx`'s `variant="standard"` and masonry `prominentPoster=true` branches (own hardcoded `h-48`/`aspect-[2/3]` sizing) and `CalendarCard`'s `variant='grid'` path remain **outside** this sweep's reach — they were deliberately left un-migrated to the primitive by Stories 1.i1c/1.i1d, and the 2026-09-11 epic-formation checkpoint already decided Epic 1.i1's surfaces do not need full cross-surface consistency.
2. **And** it fails if the literal "No image available", or any other placeholder text or icon, appears inside an image-fallback branch anywhere under `packages/ui/src/features/events` that renders a **card** (i.e. `EventCard.tsx`'s `standard`/`masonry` variants in either `prominentPoster` state, and `CalendarCard`'s `variant='list'`/`variant='grid'` paths) — this clause is **not** narrowed the way AC1 is, since no placeholder text/icon exists anywhere in the card surfaces today (Story 1.i1c already removed it repo-wide). `EventImage.tsx` is explicitly excluded: it is a different, non-card component (the full event-detail hero image, with video support and a differently-shaped icon-based fallback) per the epic readiness report's own disambiguation note — its `ImageIcon` fallback is a pre-existing, deliberately separate concern this ratchet does not govern.
3. **And** a test asserts every card surface — masonry default, masonry prominent, and the calendar compact row — renders reserved-but-blank on image error with no layout shift.
4. **Given** the codebase's architecture spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`), **when** this story ships, **then** AD-15's Rules 1 and 2 each gain an "Enforced by" citation naming the exact existing test file(s)/test name(s) that fulfill AC1–AC3 above (both the primitive's own tests and the two consumers' tests), and AD-15's "the CI-enforced consumer ratchet is Story 1.i1z" sentence is updated to state the ratchet's narrowed scope and that it is fulfilled by citation + comment-marking, not new test code.
5. **And** each of the existing test files/blocks that fulfill AC1–AC3 carries a short comment identifying it as part of the Story 1.i1z CI ratchet, so a future edit that weakens or deletes one of them is a deliberate, visible act rather than silent drift.

## Tasks / Subtasks

- [x] Task 1: Re-confirm AC1 coverage (narrowed scope) by direct read (AC: #1)
  - [x] Subtask 1.1: Re-read `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx`'s `describe('EventCardMediaSlot - AC1 ...')` block (lines 19–44) and confirm its `flex-fill`→`flex-1 h-full min-w-0` / `fixed-square`→`w-16 h-16 shrink-0` className-shape assertions would fail if the primitive's own layout classes regressed.
  - [x] Subtask 1.2: Re-read `EventCard.test.tsx`'s `'renders a blank, flex-fill fallback on masonry default (prominentPoster=false, top_row_default)'` test (~line 202) and confirm its `[data-event-card-media-slot]`/`[data-event-card-date-box]` presence + class assertions, plus the `.aspect-\[3\/4\]` absence assertion, would fail if `EventCard.tsx`'s masonry-default branch reverted to local hardcoded sizing instead of the primitive.
  - [x] Subtask 1.3: Re-read `WeeklyCalendarView.test.tsx`'s `'renders the thumbnail image and its favorite badge when imageUrl is present (AC1)'` test (~line 756) and confirm its `[data-event-card-media-slot]` presence assertion would fail if `CalendarCard`'s `variant='list'` branch reverted to local hardcoded sizing.
  - [x] Subtask 1.4: Confirm together (1.1 + 1.2, and 1.1 + 1.3) prove the narrowed AC1 invariant end-to-end for both in-scope consumers. No code change expected — verification-only; if a gap is found, add the missing assertion here rather than deferring.
- [x] Task 2: Re-confirm AC2 coverage by direct read (AC: #2)
  - [x] Subtask 2.1: Re-read `EventCard.test.tsx`'s 4 existing `queryByText('No image available')` absence assertions (~lines 184, 195, 205, 221 — covering `standard` with an errored image, `standard` with no `imageUrl`, masonry-default, and masonry-prominent) and confirm each would fail if placeholder text were reintroduced in any of those 4 states.
  - [x] Subtask 2.2: Re-read `WeeklyCalendarView.test.tsx`'s calendar-list fallback tests (~lines 792, 822) and confirm neither renders nor could silently regress into placeholder text (the component has never had a text-fallback branch — it was built directly against the primitive by Story 1.i1d).
  - [x] Subtask 2.3: Confirm `CalendarCard`'s `variant='grid'` path renders no image/thumbnail at all (re-read `WeeklyCalendarView.tsx` lines ~935–982) — no image-fallback branch exists there, so AC2 has nothing to enforce on that path.
  - [x] Subtask 2.4: Confirm `EventImage.tsx`'s `ImageIcon` fallback (lines 96–101) is out of AC2's scope per the epic readiness report's disambiguation note (a different, non-card component) — no action needed, documented in Dev Notes.
- [x] Task 3: Re-confirm AC3 coverage by direct read (AC: #3)
  - [x] Subtask 3.1: Re-read `EventCard.test.tsx`'s `'renders a blank, flex-fill fallback on masonry default...'` (~line 202) and `'renders a blank, correctly-sized fallback on masonry with prominentPoster=true'` (~line 218) tests — confirm both assert the reserved footprint (`flex-1`/`h-full` or `aspect-[2/3]`) survives with no image/no placeholder, proving masonry-default and masonry-prominent.
  - [x] Subtask 3.2: Re-read `WeeklyCalendarView.test.tsx`'s `'renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)'` (~line 792) and `'switches to the reserved-blank fallback when the image onError fires (AC2)'` (~line 822) tests — confirm both prove the calendar-list row's reserved footprint with no reflow.
  - [x] Subtask 3.3: Confirm together these 4 tests satisfy AC3's "a test asserts every card surface" for all 3 named surfaces. No code change expected.
- [x] Task 4: Add "Enforced by" traceability to Architecture Spine AD-15 (AC: #4)
  - [x] Subtask 4.1: In `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, under AD-15's Rule 1 (~line 410–411), append a consumer-level citation: `EventCard.tsx`'s masonry-default test and `WeeklyCalendarView.tsx`'s AC1 thumbnail-present test, alongside the existing primitive-level citation.
  - [x] Subtask 4.2: Under AD-15's Rule 2 (~line 415), append citations to `EventCard.test.tsx`'s masonry-default and masonry-prominent reserved-blank tests, and `WeeklyCalendarView.test.tsx`'s two AC2 reserved-blank tests.
  - [x] Subtask 4.3: Update AD-15's "the CI-enforced consumer ratchet is Story 1.i1z" sentence (~line 399) to state: the ratchet's scope is narrowed to the primitive itself plus its two adopting consumers (masonry-default, calendar-list); `EventCard.tsx`'s `standard`/`prominentPoster=true` branches and `CalendarCard`'s `variant='grid'` path are explicitly excluded (cite Stories 1.i1c/1.i1d's own scope decisions and the epic-formation checkpoint); and the ratchet is fulfilled by citation + comment-marking (Task 5), not a new test suite.
- [x] Task 5: Mark the enforcing test files/blocks as part of the Story 1.i1z ratchet (AC: #5)
  - [x] Subtask 5.1: Add an inline comment directly above `EventCardMediaPrimitives.test.tsx`'s `describe('EventCardMediaSlot - AC1 ...', ...)` block identifying it as enforcing AD-15 Rule 1 / Story 1.i1z AC1 (the primitive's own shape half of the proof).
  - [x] Subtask 5.2: Add an inline comment directly above `EventCardMediaPrimitives.test.tsx`'s `describe('EventCardMediaSlot fallback - AC3 ...', ...)` block identifying it as enforcing AD-15 Rule 2 / Story 1.i1z AC2/AC3.
  - [x] Subtask 5.3: Add an inline comment directly above `EventCard.test.tsx`'s `'renders a blank, flex-fill fallback on masonry default...'` test (~line 202) identifying it as the Story 1.i1z AC1/AC3 ratchet for the masonry-default surface.
  - [x] Subtask 5.4: Add an inline comment directly above `EventCard.test.tsx`'s `'renders a blank, correctly-sized fallback on masonry with prominentPoster=true'` test (~line 218) identifying it as the Story 1.i1z AC2/AC3 ratchet for the masonry-prominent surface — note in the comment that this surface is intentionally excluded from AC1 (legacy, non-primitive sizing).
  - [x] Subtask 5.5: Add inline comments directly above `WeeklyCalendarView.test.tsx`'s 3 relevant tests (~lines 756, 792, 822, all inside `describe('Mobile Vertical List View (AC15)', ...)`) identifying them as the Story 1.i1z AC1/AC2/AC3 ratchet for the calendar compact-row surface.
- [x] Task 6: Verification (AC: all)
  - [x] Subtask 6.1: Run `pnpm --filter @festgrid/ui test` (or `vitest run` from `packages/ui`) and confirm all pre-existing tests in the 3 touched test files still pass unchanged — this story's only production-adjacent edits are comments, so zero behavioral difference is expected.
  - [x] Subtask 6.2: Run `pnpm --filter @festgrid/ui lint` and confirm no new lint errors from the added comments.
  - [x] Subtask 6.3: Confirm `.github/workflows/ci.yml`'s `ci` job's `Run tests` step (`pnpm run test`, i.e. `turbo run test --filter=!@festgrid/ai-dev-orchestrator`) already includes `packages/ui` in its scope (it does — not excluded by the `ai-dev-orchestrator` filter), so no CI workflow file change is needed for this story.

## Dev Notes

- **This story adds no new test logic and no new production code.** Its entire scope is documentation/traceability: two "Enforced by" cross-reference additions to Architecture Spine AD-15, plus short comments on 5 already-existing test blocks across 3 files. This mirrors Story 0.i7z's precedent in this same codebase (the Geoapify-confidence ratchet), which found the same pattern — every literal AC clause already enforced by existing tests — and chose audit + traceability over a duplicate test suite.
- **Why:** direct code+test reads performed during this story's creation (cited file-by-file in Tasks 1–3 above) confirmed that the narrowed AC1, the full AC2, and AC3 are all *already* enforced by real, regression-catching tests shipped by Stories 1.i1a/1.i1c/1.i1d/1.i1e, all of which already run under `pnpm run test` (`turbo run test --filter=!@festgrid/ai-dev-orchestrator`) in `.github/workflows/ci.yml`'s `ci` job on every PR to `master`.
- **What this story is not:** it does not add a new aggregating "ratchet test file" that duplicates assertions already made elsewhere, and it does not attempt a literal, unscoped, directory-wide static sweep — both were considered and explicitly rejected by the user during this story's creation (see User-Resolved Design Decisions below).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13, `stories_covered` includes `1.i1z`), which ran Gate 1 epic-wide: no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC — explicitly including "the 1.i1z ratchet (a CI-wired repo-scoped lint/test, not an infra dependency)." **Lightweight guard, applied fresh:** this story's actual scope — 2 doc citation edits + 5 test-file comments, zero production code — introduces no new external service, data entity, or infra dependency the epic-wide sweep didn't anticipate. Still pure presentational `packages/ui` work; no fresh Gate 1 run warranted.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`: no i18n/analytics/global-shell/codegen dependency is implicated. This story touches no shared/foundational mechanism beyond the existing primitive.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement** (epic readiness report directs only Gate 2 be re-run per story once swept). Dispatched to a Freya-persona one-shot analysis against this story's exact, already-decided scope (see User-Resolved Design Decisions below). **Verdict: NO SPLIT.** Verbatim: "Grep for `ratchet|sweep|1\.i1z` (case-insensitive) across all `design-artifacts/` directories in the repo — including `UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md`, the design docs most relevant to the masonry/calendar card work — returned zero matches. Neither DESIGN.md nor EXPERIENCE.md anticipates any visual treatment, state, or interaction tied to a 'ratchet,' 'sweep,' or this story ID. Applying Gate 2's triggers to the declared scope: no component intended for reuse across ≥2 places is introduced (the shared primitives already exist, from 1.i1a–1.i1e; this story only asserts their continued use); no complex hook/util is introduced; no visual/interaction detail specified in design docs is missing from scope. Scope is test-comment + architecture-spine-citation only. Nothing here meets Gate 2's reuse/complexity/missing-design-spec thresholds, so no dedicated UI-focused story should be split out."

### User-Resolved Design Decisions (AskUserQuestion, 2026-09-13)

1. **Sweep scope — narrow to the 3 named surfaces, not a literal directory-wide scan.** Epics.md's AC1 text ("it fails if any component under `packages/ui/src/features/events`...") read literally would immediately fail against pre-existing, intentionally-unmigrated code: `EventCard.tsx`'s `standard`/`prominentPoster=true` branches (Story 1.i1c's own user-confirmed scope decision left these on local `h-48`/`aspect-[2/3]` sizing) and `CalendarCard`'s `variant='grid'` path (Story 1.i1d's AC8, "deliberately untouched"). Three options were presented: (a) narrow the sweep to exactly the primitive + its 2 adopting consumers, matching what AC3 actually names; (b) a directory-wide sweep with an explicit, documented allowlist for the known legacy branches; (c) split off a new prerequisite story to migrate the legacy branches first, so the eventual sweep needs zero exemptions. **User selected (a).** Rationale recorded at the time: this matches what Stories 1.i1c/1.i1d actually shipped, and (c) would directly contradict the 2026-09-11 epic-formation checkpoint's explicit decision that Epic 1.i1's surfaces do not need full cross-surface consistency ("the members are not one journey... a feature epic carries no mandatory ratchet, which is what 'consistently across every surface' most needs" — `planning-artifacts/epic-formation/checkpoint-2026-09-11.md` §2).
2. **Enforcement mechanism — audit + traceability only, not a new consolidated test file.** Having narrowed the scope per Decision 1, an audit of the 3 named surfaces' existing test coverage (Tasks 1–3 above) found the narrowed AC1, the full AC2, and AC3 are *already* fully proven by ~8 existing tests across `EventCardMediaPrimitives.test.tsx`, `EventCard.test.tsx`, and `WeeklyCalendarView.test.tsx` — closely mirroring Story 0.i7z's own finding for the Geoapify-confidence ratchet in this codebase. Two options were presented: (a) audit + traceability only (AD-15 "Enforced by" citations + short ratchet-marking comments on the existing tests, matching 0.i7z's precedent exactly, zero new test code); (b) a new consolidated `EventCardRatchet.test.tsx` file rendering all 3 surfaces together in one discoverable place, even though it would duplicate assertions the per-story tests already make. **User selected (a).** This avoids the added maintenance surface of a duplicate suite with no additional regression-catching power, consistent with this codebase's own established precedent (0.i7z explicitly rejected the equivalent of option (b) for the same reason).

### Scope Narrowing & Exclusions (read before implementing Task 4/5)

Per Decision 1 above, this ratchet's enforcement covers exactly:
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` (the primitive's own internals — `EventCardMediaSlot`, `EventCardDateBox`, `EventCardFavoriteBadge`).
- `EventCard.tsx`'s masonry `prominentPoster=false` branch (the "masonry default" surface, Story 1.i1e).
- `WeeklyCalendarView.tsx`'s `CalendarCard` `variant='list'` branch (the "calendar compact row" surface, Story 1.i1d).

Explicitly **excluded**, and expected to remain on local/legacy patterns indefinitely unless a future story explicitly revisits them:
- `EventCard.tsx`'s `variant="standard"` (`h-48` wrapper) — never adopted the primitive; Story 1.i1c's user-confirmed scope kept this branch untouched.
- `EventCard.tsx`'s masonry `prominentPoster=true` (`aspect-[2/3]` wrapper, own local `<img>`/`imgError` state) — same 1.i1c scope decision; "masonry prominent" is named in AC3 (reserved-blank behavior) but not AC1 (primitive-routing) for this reason.
- `WeeklyCalendarView.tsx`'s `CalendarCard` `variant='grid'` path — Story 1.i1d's AC8, "deliberately untouched"; renders no image/thumbnail at all, so AC2 has nothing to enforce there either.
- `EventImage.tsx` — a wholly different, non-card component (`EventDetailView`/`InstagramEmbed`'s full hero image, with video support and its own `ImageIcon`-based fallback) sharing naming adjacency with the `event_card_*` primitive; flagged as a "not blocking" disambiguation item (not a gap) in `epic-1-i1-readiness.md` Gate 3 item 5. Out of scope for both AC1 and AC2.
- Every other file in `packages/ui/src/features/events/` (`AIFilterOverlay.tsx`, `CorrectionForm.tsx`, `EventDetailView.tsx`, `EventDiscoveryPanel.tsx`, `FilterHub.tsx`, `InstagramEmbed.tsx`, `LocationRadiusFilter.tsx`, `SearchBar.tsx`) — none render an event **card** surface; not implicated by this story's card-scoped ratchet.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found — not applicable.** This story makes no code change to any data-carrying type, schema, or API contract. Its only edits are prose additions to `festgrid-architecture-spine.md` (a planning doc, not a runtime artifact) and comments inside 3 existing test files (no assertions, fixtures, or types are altered).
- **Impacted fields/contracts:** None.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None.
- **Backward compatibility and rollout notes:** Not applicable — no runtime behavior changes; every edit is a comment or planning-doc prose addition. Depends on Stories 1.i1a/1.i1c/1.i1d/1.i1e, all of which are at `review` status in this worktree (code merged per their own File Lists/git log) as of this story's creation — this story cites their test files by exact name/line and would need adjusted citations if any were renamed/restructured before this story lands.
- **Verification checks:** Task 6's full test-suite run (`packages/ui`) proving the 3 touched test files pass unchanged after their comment-only edits; `pnpm --filter @festgrid/ui lint` clean.

### Project Structure Notes

- **No `packages/domain` change:** this story adds no reusable function/mechanism.
- **No `packages/ui` component/hook change:** per Gate 2 above, no new or reusable UI component/hook is introduced — only test comments and a planning-doc citation.
- **No new state management:** no React Query hook, URL param, or Zustand store is touched.
- **No new async/loader UI:** no user-triggered async flow is introduced or modified.
- **No analytics/PostHog change:** no user interaction is introduced or changed.
- **No i18n change:** no new user-facing string is introduced.
- **No cloud/external service setup:** no new external service; `SETUP_WALKTHROUGH.md` is unaffected.
- **No CI/CD workflow file change:** `.github/workflows/ci.yml` already runs `pnpm run test` (covering `packages/ui`) on every PR to `master`; no workflow YAML edit is needed.
- **AD-1/AD-2 Unified Query DSL:** not applicable — no event-collection retrieval is touched.
- **Three-queue architecture / AI Gateway adapter (Gate 1's project-wide check):** not applicable — no scraping, AI-processing, or data-ingestion queue code is touched.
- **File Change Plan is unusually narrow for a "ratchet" story name** — flagged explicitly so a reviewer doesn't assume missing scope: the smallness is the audited, user-confirmed conclusion of both Design Decisions above, not an oversight.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1z] (this story's 3 literal AC clauses)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1/3 epic-wide sweep, swept: true, `stories_covered` includes `1.i1z`)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (Event Card Media Primitive — cited and amended by this story, adding "Enforced by" citations and clarifying the ratchet's narrowed scope)
- [Source: _bmad-output/planning-artifacts/epic-formation/checkpoint-2026-09-11.md §2] (the epic-formation decision that Epic 1.i1's surfaces do not need full cross-surface consistency, cited in Design Decision 1)
- [Source: _bmad-output/implementation-artifacts/0-i7z-ratchet-no-consumer-trusts-a-geoapify-result-without-its-confidence-signal.md] (this codebase's own precedent for an "audit + traceability only" ratchet story, cited in Design Decision 2)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (the primitive this story ratchets; its Out of Scope explicitly names "The repo-wide CI ratchet sweep test (Story 1.i1z)")
- [Source: _bmad-output/implementation-artifacts/1-i1c-replace-the-local-broken-image-placeholder-with-the-shared-fallback.md] ("AD-15 Rule 2 scope note" — confirms `standard`/`prominentPoster=true` were user-confirmed to stay un-migrated, and that "full cross-surface compliance is what Story 1.i1z's CI ratchet ultimately enforces" refers only to the 2 surfaces 1.i1d/1.i1e actually adopted)
- [Source: _bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md] (Task 3 comment: "The `variant === 'grid'` path below is deliberately untouched (AC8)")
- [Source: _bmad-output/implementation-artifacts/1-i1e-adopt-the-primitive-into-the-masonry-default-state.md] (Out of Scope explicitly names "Story 1.i1z's CI-wired ratchet test enforcing the invariant repo-wide — a separate, later story")
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx] (read in full — confirmed the primitive's layout/fallback/badge-scale implementation)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx] (read in full — confirmed AC1/AC3 suites, lines 19–44 and 75–100)
- [Source: packages/ui/src/features/events/EventCard.tsx] (read in full — confirmed masonry-default routes through the primitive [lines ~278–299] while `standard`/`prominentPoster=true` keep local `h-48`/`aspect-[2/3]` markup with a local `imgError` state [lines ~300–326])
- [Source: packages/ui/src/features/events/EventCard.test.tsx] (read relevant sections — confirmed the 4 "No image available" absence assertions [~184, 195, 205, 221] and the masonry-default/masonry-prominent reserved-blank tests [~202, 218])
- [Source: packages/ui/src/features/events/WeeklyCalendarView.tsx] (read in full — confirmed `CalendarCard`'s `variant='list'` branch routes through `EventCardMediaSlot`/`EventCardDateBox` [lines ~872–932] while `variant='grid'` renders no image at all [lines ~935–982])
- [Source: packages/ui/src/features/events/WeeklyCalendarView.test.tsx] (read relevant sections — confirmed the 3 AC1/AC2 thumbnail tests [~756, 792, 822], all inside `describe('Mobile Vertical List View (AC15)', ...)`)
- [Source: packages/ui/src/features/events/EventImage.tsx] (read in full — confirmed its own separate `ImageIcon`-based fallback [lines 96–101], out of this story's scope)
- [Source: .github/workflows/ci.yml] (confirmed `pnpm run test` step runs on every PR to `master` within the `ci` job, covering `packages/ui`)
- [Source: package.json#scripts.test] (`turbo run test --filter=!@festgrid/ai-dev-orchestrator` — confirms no exclusion of `packages/ui`)

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (no `packages/domain`/`packages/ui` production-code addition, confirmed above); no stack/package-boundary rule is implicated by a doc/comment-only story.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no PRD feature/constraint change; this is a CI-enforcement story for an already-shipped UX invariant.
- [x] `story-content-structure.md` — this story's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (Event Card Media Primitive), amended by this story with "Enforced by" citations and a narrowed-scope clarification.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 sourced from the swept epic readiness report; Gate 2 run fresh this story (NO SPLIT).
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — add "Enforced by" lines to AD-15 Rules 1–2 and update its "CI-enforced consumer ratchet" sentence (Task 4).
- **Modified:** `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` — add 2 inline comments above the AC1/AC3 `describe` blocks (Task 5.1–5.2).
- **Modified:** `packages/ui/src/features/events/EventCard.test.tsx` — add 2 inline comments above the masonry-default/masonry-prominent fallback tests (Task 5.3–5.4).
- **Modified:** `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — add 3 inline comments above the calendar-list AC1/AC2 tests (Task 5.5).
- **Not touched:** `EventCardMediaPrimitives.tsx`, `EventCard.tsx`, `EventCard.types.ts`, `WeeklyCalendarView.tsx`/`.types.ts`, `event-card-media-tokens.ts`, `EventImage.tsx` — no production code in this story (Design Decision 2). No new files.

### Rule Mapping

- `story-split-gate.md` Gate 1/3 (epic-wide sweep) → cited above, no story-specific correction needed.
- `story-split-gate.md` Gate 2 → re-run fresh, no gap (Architecture & UX Gate Findings).
- Data Type Compatibility rule (this workflow) → dedicated section above; not applicable, no data-carrying change.
- Reusable-function/reusable-UI rules (this workflow) → explicitly evaluated and found not applicable (Project Structure Notes).
- Design-decision escalation rule (this workflow's persistent facts) → both Design Decisions above, escalated via `AskUserQuestion` and explicitly answered by the user during this story's creation (not deferred, unlike 0.i7z's equivalent).

### Verification Plan

1. `pnpm --filter @festgrid/ui test` (or `vitest run` from `packages/ui`) — all pre-existing tests in the 3 touched files pass unchanged (comment-only edits).
2. `pnpm --filter @festgrid/ui lint` — clean, no new errors from added comments.
3. Manual read-through: confirm AD-15's new "Enforced by" lines cite real, existing file paths and test names (no invented paths), and that the 5 test-block comments accurately name Story 1.i1z and which AD-15 rule/AC they enforce.

## Pre-Coding Approval Gate

- [x] **Scope confirmation** — this story's scope is deliberately documentation/traceability-only (AD-15 citations + 5 test-block comments), not new test or production code, per the audited finding that the narrowed AC1, full AC2, and AC3 are already enforced by existing tests (Dev Notes, Tasks 1–3).
- [x] **Architecture and boundary confirmation** — no `packages/domain`/`packages/ui`/backend/frontend production code change (Project Structure Notes); the only planning-artifact edit is AD-15's addition of citation lines and a scope clarification, not a change to its Rules' substance.
- [x] **Testing plan confirmation** — Task 6 re-runs the existing suites covering all 3 touched test files to prove the comment-only edits introduce zero regressions; no new tests are added because none are needed (Design Decision 2).
- [x] **Design Decision 1 (sweep scope: narrow to 3 named surfaces vs. directory-wide-with-allowlist vs. split-out-a-migration-prerequisite) — explicit human approval GRANTED via `AskUserQuestion`, 2026-09-13.** User selected the narrow-scope option.
- [x] **Design Decision 2 (enforcement mechanism: audit + traceability only vs. a new consolidated test file) — explicit human approval GRANTED via `AskUserQuestion`, 2026-09-13.** User selected audit + traceability only.
- [x] **Gate 1/2/3 prerequisites confirmed done or gap accepted** — Gate 1/3 findings already resolved via the epic readiness sweep (no story-specific correction needed); Gate 2 fresh check found no gap. Depends-on Stories 1.i1a/1.i1c/1.i1d/1.i1e are all at `review` status in this worktree (code merged per git log) as of this story's creation.
- [x] **Explicit human approval to begin implementation** — granted via this `/bmad-dev-story` invocation (matching Stories 0.i7z/1.i1e's precedent).

## Testing Requirements

- [x] Unit tests — none new (Design Decision 2); re-run existing: `EventCardMediaPrimitives.test.tsx`'s AC1/AC3 suites.
- [x] Integration/component tests — none new; re-run existing: `EventCard.test.tsx`'s masonry-default/masonry-prominent fallback tests, `WeeklyCalendarView.test.tsx`'s AC1/AC2 thumbnail tests.
- [x] E2E tests — not applicable; no user-facing behavior change.
- [x] Migration verification — not applicable; no migration in this story.
- [x] Regression check — confirm all 3 touched test files pass unchanged after their comment-only edits; confirm `pnpm --filter @festgrid/ui lint` is clean.

## Deliverables Checklist

- [x] Architecture Spine AD-15 gains "Enforced by" citations for Rules 1–2, and its "CI-enforced consumer ratchet is Story 1.i1z" sentence is updated to state the narrowed scope and citation-based fulfillment.
- [x] `EventCardMediaPrimitives.test.tsx` carries 2 comments identifying its AC1/AC3 `describe` blocks as the Story 1.i1z ratchet.
- [x] `EventCard.test.tsx` carries 2 comments identifying its masonry-default/masonry-prominent fallback tests as the Story 1.i1z ratchet.
- [x] `WeeklyCalendarView.test.tsx` carries 3 comments identifying its calendar-list AC1/AC2 tests as the Story 1.i1z ratchet.
- [x] Full test suite (`packages/ui`) passes unchanged; lint clean.

## Out of Scope

- **A directory-wide, literal "any component" sweep with an allowlist** — considered and rejected as Design Decision 1's option (b); the narrow-scope option (a) was chosen instead.
- **A new aggregating/duplicate `EventCardRatchet.test.tsx` file** — considered and rejected as Design Decision 2's option (b); the existing tests already provide complete, well-targeted regression coverage.
- **Migrating `EventCard.tsx`'s `standard`/`prominentPoster=true` branches, or `CalendarCard`'s `variant='grid'` path, onto the shared primitive** — considered and rejected as Design Decision 1's option (c); would contradict the epic-formation checkpoint's explicit "surfaces need not be fully consistent" decision. These remain permanently outside this ratchet's reach unless a future story explicitly revisits them.
- **`EventImage.tsx`'s own fallback treatment** — a separate, non-card component; not implicated by this story per the epic readiness report's disambiguation note.
- **Managing GitHub branch-protection "required status check" settings** — outside this codebase (no `.github/settings.yml`/ruleset file exists to manage it as code); the `ci` job already runs the full test suite on every PR, but whether it's a blocking/required check in GitHub's repository settings is a manual, out-of-band administrative action.

## Definition of Done

- [x] AC 1–5 satisfied (AC 1–3 confirmed already-enforced by existing tests via Tasks 1–3; AC 4–5 delivered by Tasks 4–5).
- [x] Required tests passing — all 3 touched test files pass unchanged (Task 6).
- [x] Lint and type checks passing for `packages/ui` (the architecture-spine doc edit has no lint/type surface).
- [x] Story status updated to `review` in this file and in `sprint-status.yaml`.

## Completion Status

Story created via `bmad-create-story` (2026-09-13) — implementation complete via `bmad-dev-story` (2026-09-13): Audit + traceability delivered per Design Decisions 1 & 2. AC 1–3 re-confirmed already-enforced by existing tests (Tasks 1–3); AC 4 delivered (AD-15 "Enforced by" citations + narrowed-scope sentence); AC 5 delivered (5 ratchet-marking comments across 3 test files). Verification: 3 touched test files green (103 tests), full `packages/ui` suite green (48 files / 465 tests), eslint 0 errors (11 pre-existing warnings in `WeeklyCalendarView.test.tsx`), CI workflow already runs `packages/ui`. Status: **review**.

## Dev Agent Record

### Agent Model Used

Anthropic Claude (Cline autonomous coding agent), via `bmad-dev-story`.

### Debug Log References

- `packages/ui` full vitest run — 48 files / 465 tests passed (incl. the 3 touched files, 103 tests) after comment-only edits.
- Direct `eslint` on the 3 touched test files — 0 errors (11 pre-existing warnings in `WeeklyCalendarView.test.tsx`, unrelated to this story's comments).
- `.github/workflows/ci.yml` `ci` job — `Run tests` step (`pnpm run test` = `turbo run test --filter=!@festgrid/ai-dev-orchestrator`) already includes `@festgrid/ui`; no workflow change needed.

### Completion Notes List

- Fixed baseline (current HEAD `44fec25`) — story implemented and committed on top of the Story 1.i1z creation commit. This story is **documentation/traceability only** (Design Decision 2), so it adds no test logic and no production code.
- **Tasks 1–3 (audit, verified by direct read):** narrowed AC1, full AC2, and AC3 are all already enforced by existing tests — `EventCardMediaPrimitives.test.tsx`'s AC1 (className-shape) & AC3 (blank-reserved + onError) suites; `EventCard.test.tsx`'s 4 "No image available" absence assertions + masonry-default (flex-fill/`[data-event-card-media-slot]`/`.aspect-[3/4]`-absence) & masonry-prominent (`aspect-[2/3]`) reserved-blank tests; `WeeklyCalendarView.test.tsx`'s AC1 thumbnail-present + two AC2 reserved-blank tests. Every named surface (primitive, masonry-default, masonry-prominent for AC2/AC3, calendar-list) is covered.
- **Task 4 (AD-15):** appended consumer-level "Enforced by" citations to Rules 1 & 2 naming the exact consumer test files/test names, and rewrote the "CI-enforced consumer ratchet is Story 1.i1z" sentence to state the narrowed scope (primitive + masonry-default + calendar-list), the explicit exclusions (`standard`/`prominentPoster=true`, `variant='grid'`), and that the ratchet is fulfilled by citation + comment-marking, not a new test suite.
- **Task 5 (comments):** added 2 comments to `EventCardMediaPrimitives.test.tsx`, 2 to `EventCard.test.tsx`, 3 to `WeeklyCalendarView.test.tsx`, each identifying the block as the Story 1.i1z ratchet for the relevant AC/surface.
- **Task 6 (verification):** `pnpm exec vitest run` on the 3 touched files → 103 passed; full `packages/ui` suite → 48 files / 465 passed; `eslint` on the 3 touched files → 0 errors; CI workflow already covers `packages/ui`. All Verification Plan commands executed and confirmed clean.

### File List

- **Modified:** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 Rules 1 & 2 "Enforced by" citations + narrowed-scope "CI-enforced consumer ratchet" sentence (Task 4).
- **Modified:** `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` — 2 ratchet-marking comments above AC1 / AC3 `describe` blocks (Task 5.1–5.2).
- **Modified:** `packages/ui/src/features/events/EventCard.test.tsx` — 2 ratchet-marking comments above masonry-default / masonry-prominent fallback tests (Task 5.3–5.4).
- **Modified:** `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — 3 ratchet-marking comments above the calendar-list AC1/AC2 tests (Task 5.5).
- **Not touched:** `EventCardMediaPrimitives.tsx`, `EventCard.tsx`, `EventCard.types.ts`, `WeeklyCalendarView.tsx`/`.types.ts`, `event-card-media-tokens.ts`, `EventImage.tsx`, `.github/workflows/ci.yml` — no production/CI code change in this story (Design Decision 2). No new files.

## Change Log

- 2026-09-13: Story created via `bmad-create-story`. Epic 1.i1 readiness sweep cited (Gate 1/3, `swept: true`, `stories_covered` includes `1.i1z`); Gate 2 re-run fresh (no gap — verbatim subagent verdict recorded in Dev Notes). Two design tradeoffs escalated via `AskUserQuestion` and explicitly resolved by the user: (1) the repo-wide sweep's scope is narrowed to the primitive itself plus its two adopting consumers (masonry-default, calendar-list), excluding `EventCard.tsx`'s `standard`/`prominentPoster=true` branches and `CalendarCard`'s `variant='grid'` path, which were deliberately left un-migrated by Stories 1.i1c/1.i1d and which the epic-formation checkpoint already accepted as permissibly inconsistent; (2) given that narrowed scope, an audit found the invariant already fully proven by ~8 existing tests (mirroring Story 0.i7z's precedent), so the story's deliverable is audit + traceability only (AD-15 "Enforced by" citations + 5 test-block ratchet-marking comments), not a new duplicate test file.
- 2026-09-13: Implemented via `bmad-dev-story` (`ready-for-dev` → `review`). Delivered exactly the audited audit + traceability scope: (a) AD-15 Rules 1 & 2 gained consumer-level "Enforced by" citations (exact test file paths + test names for `EventCard.test.tsx`'s masonry-default/masonry-prominent reserved-blank tests and `WeeklyCalendarView.test.tsx`'s AC1/AC2 tests), and the "CI-enforced consumer ratchet is Story 1.i1z" sentence now states the narrowed scope and citation+comment-based fulfillment; (b) 2 ratchet-marking comments added to `EventCardMediaPrimitives.test.tsx`, 2 to `EventCard.test.tsx`, 3 to `WeeklyCalendarView.test.tsx`. Verification executed (not assumed): 3 touched files → 103 tests passed; full `packages/ui` suite → 48 files / 465 tests passed; `eslint` on touched files → 0 errors (11 pre-existing warnings in `WeeklyCalendarView.test.tsx`); confirmed `ci.yml`'s `Run tests` step already includes `@festgrid/ui`, so no CI change. No production code or new tests added (Design Decision 2). Story status set to `review`.
